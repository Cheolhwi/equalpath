// Conflict detection, ported from
// appwrite-backend/functions/iteration1-core/src/domain/conflicts.js.
//
// Three results are possible and they never collapse into each other:
//   uncovered — required care with no coverage behind it, or a handover the
//               user cannot physically make;
//   unknown   — coverage exists but something needed to judge it is missing,
//               so EqualPath refuses to claim the time is covered;
//   (neither) — no candidate is emitted, which is the only way a day reads
//               "no gap".
// Every candidate carries the records it came from, so a result can always be
// explained by naming its sources rather than asserting a conclusion.

import { deterministicHash } from "./hash.js";
import { durationMinutes, intersections, mergeIntervals, subtractIntervals } from "./intervals.js";

function rowInterval(row) {
  return { start: row.start_minute, end: row.end_minute };
}

function sourcesOf(...rows) {
  return [...new Set(rows.flatMap((row) => row?.source_records ?? [row?.source_label].filter(Boolean)))];
}

function identityOf(row) {
  return (
    row?.$id ??
    [
      row?.child_id,
      row?.date_local,
      row?.entry_kind,
      row?.start_minute,
      row?.end_minute,
      row?.source_label,
      ...(row?.source_records ?? [])
    ]
      .filter((value) => value !== undefined)
      .join(":")
  );
}

function keyFor({ userId, childId, dateLocal, kind, state, identity }) {
  return deterministicHash([userId, childId, dateLocal, kind, state, identity].join("|"));
}

function candidate(base) {
  const deterministicKey = keyFor(base);
  return {
    rowId: `c_${deterministicKey.slice(0, 32)}`,
    deterministic_key: deterministicKey,
    user_id: base.userId,
    child_id: base.childId,
    child_name: base.childName,
    date_local: base.dateLocal,
    kind: base.kind,
    state: base.state,
    start_minute: base.start,
    end_minute: base.end,
    duration_minutes: base.end - base.start,
    priority: base.priority,
    status: "open",
    source_records: base.sources.length > 0 ? base.sources : ["Source record unavailable"]
  };
}

function priorityFor(work, state) {
  if (state === "unknown") return "review";
  if (work?.priority === "fixed" && work?.remote_possible !== true) return "high";
  return "normal";
}

function responsibilityUsesOwner(ref, userId) {
  return ref === userId || ref === "self" || ref === "account_owner";
}

// A commitment attended from home is reached from the care provider by the
// home↔care leg; an office commitment uses the care↔work leg.
function travelBetweenCareAndWork(work, profile) {
  return work?.location_mode === "home" ? profile?.travel_home_care_min : profile?.travel_care_work_min;
}

export function detectConflictCandidates({ userId, childId, childName, dateLocal, careRows, workRows, profile }) {
  const requiredRows = careRows.filter(
    (row) => row.child_id === childId && row.entry_kind === "required" && row.status !== "cancelled"
  );
  const coverageRows = careRows.filter(
    (row) => row.child_id === childId && row.entry_kind === "coverage" && row.status !== "cancelled"
  );
  const coveredRows = coverageRows.filter((row) => row.band_state !== "unknown");
  const unknownRows = coverageRows.filter((row) => row.band_state === "unknown");
  const required = requiredRows.map(rowInterval);

  // Coverage ends when the child is collected, not when the provider closes.
  const covered = coveredRows.map((row) => ({
    start: row.start_minute,
    end: Number.isInteger(row.collect_by_minute) ? Math.min(row.end_minute, row.collect_by_minute) : row.end_minute
  }));
  const unknown = unknownRows.map(rowInterval);
  const uncoveredAfterKnown = subtractIntervals(required, covered);
  const actualGaps = subtractIntervals(uncoveredAfterKnown, unknown);
  const unknownBands = uncoveredAfterKnown.flatMap((gap) => intersections(gap, unknown));
  const results = [];

  for (const [state, bands] of [
    ["uncovered", actualGaps],
    ["unknown", unknownBands]
  ]) {
    const mergedBands = mergeIntervals(bands);
    for (const work of workRows.filter((row) => row.status !== "cancelled")) {
      const overlaps = mergeIntervals(mergedBands.flatMap((band) => intersections(band, [rowInterval(work)])));
      for (const [ordinal, overlap] of overlaps.entries()) {
        const careSources = state === "unknown" ? unknownRows : requiredRows;
        const relatedCare = careSources.filter((row) => intersections(overlap, [rowInterval(row)]).length > 0);
        results.push(
          candidate({
            userId,
            childId,
            childName,
            dateLocal,
            kind: state === "unknown" ? "coverage_unknown" : "care_work_overlap",
            state,
            start: overlap.start,
            end: overlap.end,
            priority: priorityFor(work, state),
            sources: sourcesOf(...relatedCare, work),
            identity: [identityOf(work), ...relatedCare.map(identityOf).sort(), ordinal].join("|")
          })
        );
      }
    }
  }

  // Evening handover: the collector leaves their last commitment, travels, and
  // arrives after the provider's collection deadline.
  for (const coverage of coveredRows.filter((row) => Number.isInteger(row.collect_by_minute))) {
    if (!responsibilityUsesOwner(coverage.handover_out_ref, userId)) continue;
    const precedingWork = workRows
      .filter((work) => work.status !== "cancelled" && work.end_minute <= coverage.collect_by_minute)
      .sort((left, right) => right.end_minute - left.end_minute)[0];
    if (!precedingWork) continue;
    const travel = travelBetweenCareAndWork(precedingWork, profile);
    const travelField = precedingWork.location_mode === "home" ? "travel_home_care_min" : "travel_care_work_min";
    const requirementEnd = requiredRows
      .filter((row) => row.start_minute < coverage.end_minute && row.end_minute > coverage.collect_by_minute)
      .reduce((maximum, row) => Math.max(maximum, row.end_minute), coverage.collect_by_minute);

    if (!Number.isInteger(travel)) {
      if (requirementEnd > coverage.collect_by_minute) {
        results.push(
          candidate({
            userId,
            childId,
            childName,
            dateLocal,
            kind: "handover_out_unknown",
            state: "unknown",
            start: coverage.collect_by_minute,
            end: requirementEnd,
            priority: "review",
            sources: sourcesOf(coverage, precedingWork, {
              source_label: `${travelField} is missing; collection ETA has not been calculated`
            }),
            identity: [identityOf(coverage), identityOf(precedingWork)].join("|")
          })
        );
      }
      continue;
    }

    const arrival = Math.min(1440, precedingWork.end_minute + travel);
    const end = Math.min(arrival, requirementEnd);
    if (end > coverage.collect_by_minute) {
      results.push(
        candidate({
          userId,
          childId,
          childName,
          dateLocal,
          kind: "handover_out",
          state: "uncovered",
          start: coverage.collect_by_minute,
          end,
          priority: priorityFor(precedingWork, "uncovered"),
          sources: sourcesOf(coverage, precedingWork, {
            source_label: `${travelField} ${travel} min; work ends ${precedingWork.end_minute}; collect_by ${coverage.collect_by_minute}; ETA ${arrival}`
          }),
          identity: [identityOf(coverage), identityOf(precedingWork)].join("|")
        })
      );
    }
  }

  // Morning handover: required care starts before the provider opens, and the
  // adult has to leave for work before they can hand the child over.
  for (const coverage of coveredRows) {
    if (!responsibilityUsesOwner(coverage.handover_in_ref, userId)) continue;
    const followingWork = workRows
      .filter((work) => work.status !== "cancelled" && work.start_minute >= coverage.start_minute)
      .sort((left, right) => left.start_minute - right.start_minute)[0];
    if (!followingWork) continue;
    const requirementStart = requiredRows
      .filter((row) => row.start_minute < coverage.start_minute && row.end_minute > row.start_minute)
      .reduce((minimum, row) => Math.min(minimum, row.start_minute), coverage.start_minute);
    if (requirementStart >= coverage.start_minute) continue;
    const travel = travelBetweenCareAndWork(followingWork, profile);
    const travelField = followingWork.location_mode === "home" ? "travel_home_care_min" : "travel_care_work_min";

    if (!Number.isInteger(travel)) {
      results.push(
        candidate({
          userId,
          childId,
          childName,
          dateLocal,
          kind: "handover_in_unknown",
          state: "unknown",
          start: requirementStart,
          end: coverage.start_minute,
          priority: "review",
          sources: sourcesOf(coverage, followingWork, {
            source_label: `${travelField} is missing; drop-off departure time has not been calculated`
          }),
          identity: [identityOf(coverage), identityOf(followingWork)].join("|")
        })
      );
      continue;
    }

    const mustLeaveBy = Math.max(0, followingWork.start_minute - travel);
    const start = Math.max(requirementStart, mustLeaveBy);
    if (coverage.start_minute > start) {
      results.push(
        candidate({
          userId,
          childId,
          childName,
          dateLocal,
          kind: "handover_in",
          state: "uncovered",
          start,
          end: coverage.start_minute,
          priority: priorityFor(followingWork, "uncovered"),
          sources: sourcesOf(coverage, followingWork, {
            source_label: `${travelField} ${travel} min; work starts ${followingWork.start_minute}; must leave by ${mustLeaveBy}; provider opens ${coverage.start_minute}`
          }),
          identity: [identityOf(coverage), identityOf(followingWork)].join("|")
        })
      );
    }
  }

  const unique = new Map(results.map((item) => [item.deterministic_key, item]));
  const rank = { high: 0, normal: 1, review: 2 };
  return [...unique.values()].sort(
    (left, right) =>
      (rank[left.priority] ?? 9) - (rank[right.priority] ?? 9) ||
      left.start_minute - right.start_minute ||
      left.deterministic_key.localeCompare(right.deterministic_key)
  );
}

export function totalUncoveredMinutes(conflicts) {
  return conflicts
    .filter((item) => item.state === "uncovered")
    .reduce((sum, item) => sum + durationMinutes({ start: item.start_minute, end: item.end_minute }), 0);
}

export function totalUnknownMinutes(conflicts) {
  return conflicts
    .filter((item) => item.state === "unknown")
    .reduce((sum, item) => sum + durationMinutes({ start: item.start_minute, end: item.end_minute }), 0);
}

export const PRIORITY_EXPLANATION = {
  high: "Fixed, non-remote work is ranked first.",
  review: "Verification is required before EqualPath can call this uncovered.",
  normal: "Flexible or remote-capable work follows fixed, non-remote commitments."
};

export function priorityExplanation(priority) {
  return PRIORITY_EXPLANATION[priority] ?? PRIORITY_EXPLANATION.normal;
}
