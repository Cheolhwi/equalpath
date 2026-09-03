// Read models. Stored rows are turned into the 14-day schedule, the per-day
// conflict results and the tomorrow snapshot that the screens render.

import { addDays, dateRange, formatMinute, localDateAt } from "../domain/dates.js";
import { detectConflictCandidates, totalUncoveredMinutes, totalUnknownMinutes } from "../domain/conflicts.js";
import { mergeIntervals, subtractIntervals } from "../domain/intervals.js";
import { materialiseHorizon } from "../domain/materialise.js";
import { HORIZON_DAYS, OWNER_ID } from "./schema.js";

export const COVERAGE_STATE = { noGap: "covered", uncovered: "uncovered", unknown: "unknown" };

export const STATE_LABEL = {
  covered: "NO GAP",
  uncovered: "UNCOVERED",
  unknown: "UNKNOWN"
};

export function suppressedKeys(state) {
  const overrides = [...state.work_commitments, ...state.care_commitments]
    .map((row) => row.suppresses)
    .filter(Boolean);
  return new Set([...state.skips, ...overrides]);
}

function personName(state, ref) {
  if (!ref) return null;
  if (ref === OWNER_ID) return "You";
  return state.supportNetwork.find((person) => person.id === ref)?.name ?? null;
}

function childName(state, childId) {
  return state.children.find((child) => child.id === childId)?.name ?? null;
}

function workEntry(state, row) {
  return {
    id: row.$id,
    kind: "work",
    dateLocal: row.date_local,
    title: row.commitment_type || "Work",
    notes: row.notes ?? "",
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    childId: null,
    childName: null,
    locationMode: row.location_mode ?? "office",
    remotePossible: Boolean(row.remote_possible),
    priority: row.priority ?? "fixed",
    collectByMinute: null,
    handoverInRef: null,
    handoverOutRef: null,
    handoverInName: null,
    handoverOutName: null,
    patternId: row.pattern_id ?? null,
    generatedFromPattern: Boolean(row.pattern_id) && !row.is_override,
    isOverride: Boolean(row.is_override),
    spanGroup: row.span_group ?? null,
    spanPart: row.span_part ?? null,
    bandState: "covered"
  };
}

function careEntry(state, row) {
  return {
    id: row.$id,
    kind: row.entry_kind === "required" ? "careRequired" : "careCoverage",
    dateLocal: row.date_local,
    title: row.location_label || (row.entry_kind === "required" ? "Care needed" : "Care coverage"),
    notes: row.notes ?? "",
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    childId: row.child_id,
    childName: childName(state, row.child_id),
    locationMode: "",
    remotePossible: false,
    priority: "normal",
    collectByMinute: Number.isInteger(row.collect_by_minute) ? row.collect_by_minute : null,
    handoverInRef: row.handover_in_ref ?? null,
    handoverOutRef: row.handover_out_ref ?? null,
    handoverInName: personName(state, row.handover_in_ref),
    handoverOutName: personName(state, row.handover_out_ref),
    patternId: row.pattern_id ?? null,
    generatedFromPattern: Boolean(row.pattern_id) && !row.is_override,
    isOverride: Boolean(row.is_override),
    spanGroup: row.span_group ?? null,
    spanPart: row.span_part ?? null,
    bandState: row.band_state ?? "covered"
  };
}

const ENTRY_ORDER = { work: 0, careRequired: 1, careCoverage: 2 };

// Every stored and generated row that falls inside the horizon.
export function collectRows(state, horizonStart, horizonDays = HORIZON_DAYS) {
  const generated = materialiseHorizon({
    patterns: state.schedule_patterns,
    horizonStart,
    horizonDays,
    suppressed: suppressedKeys(state)
  });
  const dates = new Set(dateRange(horizonStart, horizonDays));
  const inHorizon = (row) => dates.has(row.date_local);
  return {
    work: [...state.work_commitments.filter(inHorizon), ...generated.work.filter(inHorizon)],
    care: [...state.care_commitments.filter(inHorizon), ...generated.care.filter(inHorizon)]
  };
}

function careGapsFor(state, careRows) {
  const gaps = [];
  for (const child of state.children) {
    const required = careRows
      .filter((row) => row.child_id === child.id && row.entry_kind === "required" && row.status !== "cancelled")
      .map((row) => ({ start: row.start_minute, end: row.end_minute }));
    if (required.length === 0) continue;
    const covered = careRows
      .filter(
        (row) =>
          row.child_id === child.id &&
          row.entry_kind === "coverage" &&
          row.status !== "cancelled" &&
          row.band_state !== "unknown"
      )
      .map((row) => ({
        start: row.start_minute,
        end: Number.isInteger(row.collect_by_minute) ? Math.min(row.end_minute, row.collect_by_minute) : row.end_minute
      }));
    for (const [index, gap] of subtractIntervals(required, covered).entries()) {
      gaps.push({
        id: `${child.id}-${index}-${gap.start}`,
        childName: child.name,
        startMinute: gap.start,
        endMinute: gap.end
      });
    }
  }
  return gaps.sort((left, right) => left.startMinute - right.startMinute || left.id.localeCompare(right.id));
}

function summaryFrom({ conflicts, spanIntervals, checkedAt }) {
  const uncovered = totalUncoveredMinutes(conflicts);
  const unknown = totalUnknownMinutes(conflicts);
  const span = mergeIntervals(spanIntervals);
  const startMinute = span.length > 0 ? span[0].start : 0;
  const endMinute = span.length > 0 ? span.at(-1).end : 0;
  const spanMinutes = span.reduce((sum, interval) => sum + (interval.end - interval.start), 0);

  // Uncovered outranks unknown: a gap that is certainly open is never softened
  // into "needs verification".
  const state = uncovered > 0 ? COVERAGE_STATE.uncovered : unknown > 0 ? COVERAGE_STATE.unknown : COVERAGE_STATE.noGap;
  const gapMinutes = state === COVERAGE_STATE.uncovered ? uncovered : state === COVERAGE_STATE.unknown ? unknown : 0;

  return {
    state,
    gapMinutes,
    uncoveredMinutes: uncovered,
    unknownMinutes: unknown,
    spanMinutes,
    startMinute,
    endMinute,
    checkedAt
  };
}

export function hourLabel(minutes) {
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}

export function ringFraction(summary) {
  if (summary.state === COVERAGE_STATE.noGap) return 1;
  if (!summary.spanMinutes) return 0;
  return Math.min(Math.max(summary.gapMinutes / summary.spanMinutes, 0), 1);
}

export function buildDay(state, dateLocal, rows, checkedAt) {
  const workRows = rows.work.filter((row) => row.date_local === dateLocal);
  const careRows = rows.care.filter((row) => row.date_local === dateLocal);

  const conflicts = state.children.flatMap((child) =>
    detectConflictCandidates({
      userId: OWNER_ID,
      childId: child.id,
      childName: child.name,
      dateLocal,
      careRows,
      workRows,
      profile: state.profile
    })
  );

  const entries = [...workRows.map((row) => workEntry(state, row)), ...careRows.map((row) => careEntry(state, row))].sort(
    (left, right) =>
      left.startMinute - right.startMinute ||
      ENTRY_ORDER[left.kind] - ENTRY_ORDER[right.kind] ||
      left.title.localeCompare(right.title)
  );

  const spanIntervals = [...workRows, ...careRows.filter((row) => row.entry_kind === "required")].map((row) => ({
    start: row.start_minute,
    end: row.end_minute
  }));

  const perChild = state.children
    .map((child) => {
      const childConflicts = conflicts.filter((item) => item.child_id === child.id);
      const childSpans = [
        ...workRows,
        ...careRows.filter((row) => row.entry_kind === "required" && row.child_id === child.id)
      ].map((row) => ({ start: row.start_minute, end: row.end_minute }));
      return {
        id: child.id,
        name: child.name,
        conflicts: childConflicts,
        summary: summaryFrom({ conflicts: childConflicts, spanIntervals: childSpans, checkedAt })
      };
    })
    .filter((child) => careRows.some((row) => row.child_id === child.id) || workRows.length > 0);

  return {
    dateLocal,
    entries,
    conflicts,
    children: perChild,
    careGaps: careGapsFor(state, careRows),
    hasRequiredCare: careRows.some((row) => row.entry_kind === "required"),
    hasScheduleData: entries.length > 0,
    summary: summaryFrom({ conflicts, spanIntervals, checkedAt })
  };
}

export function buildSchedule(state, { horizonStart = localDateAt(), horizonDays = HORIZON_DAYS } = {}) {
  const rows = collectRows(state, horizonStart, horizonDays);
  const checkedAt = state.lastSweepAt ? new Date(state.lastSweepAt) : new Date();
  return {
    horizonStart,
    horizonDays,
    checkedAt,
    days: dateRange(horizonStart, horizonDays).map((dateLocal) => buildDay(state, dateLocal, rows, checkedAt))
  };
}

// Timeline bands for the day view: the records themselves, then the conflicts
// laid over them, so a gap is always shown next to what produced it.
export function timelineFor(day) {
  const records = day.entries.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    detail:
      entry.kind === "work"
        ? `${entry.priority === "fixed" ? "Fixed" : "Flexible"} · ${entry.locationMode || "office"}`
        : entry.childName ?? "",
    startMinute: entry.startMinute,
    endMinute: entry.endMinute
  }));
  const bands = day.conflicts.map((conflict) => ({
    id: conflict.rowId,
    kind: conflict.state === "unknown" ? "unknown" : "uncovered",
    title:
      conflict.state === "unknown"
        ? `${conflict.child_name ?? "Care"} · needs verification`
        : `${conflict.child_name ?? "Care"} needs cover`,
    detail: conflict.kind.startsWith("handover_") ? "Handover" : "Care and work overlap",
    startMinute: conflict.start_minute,
    endMinute: conflict.end_minute
  }));
  return [...records, ...bands].sort((left, right) => left.startMinute - right.startMinute);
}

// The records behind tomorrow's result, named rather than summarised.
export function sourceRecordsFor(day, profile) {
  const sources = [];
  for (const entry of day.entries) {
    if (entry.kind === "careCoverage") {
      sources.push({
        id: `src-${entry.id}`,
        icon: "provider",
        title: entry.title,
        detail:
          entry.bandState === "unknown"
            ? `${formatMinute(entry.startMinute)} — ${formatMinute(entry.endMinute)} · collection responsibility Unknown`
            : `${formatMinute(entry.startMinute)} — ${formatMinute(entry.endMinute)} · collect by ${formatMinute(entry.collectByMinute ?? entry.endMinute)}`
      });
    }
    if (entry.kind === "work") {
      sources.push({
        id: `src-${entry.id}`,
        icon: "work",
        title: entry.title,
        detail: `${formatMinute(entry.startMinute)} — ${formatMinute(entry.endMinute)} · ${entry.priority === "fixed" ? "fixed" : "flexible"} · ${entry.remotePossible ? "remote possible" : entry.locationMode || "office"}`
      });
    }
    if (entry.kind === "careRequired") {
      sources.push({
        id: `src-${entry.id}`,
        icon: "care",
        title: `${entry.title}${entry.childName ? ` · ${entry.childName}` : ""}`,
        detail: `${formatMinute(entry.startMinute)} — ${formatMinute(entry.endMinute)}`
      });
    }
  }

  const hasCoverage = day.entries.some((entry) => entry.kind === "careCoverage");
  if (hasCoverage) {
    sources.push({
      id: "src-travel",
      icon: "travel",
      title: Number.isInteger(profile.travel_care_work_min)
        ? `Travel ${profile.travel_care_work_min} min`
        : "Travel Unknown",
      detail: Number.isInteger(profile.travel_care_work_min)
        ? "Your estimate · counted between care and work"
        : "No estimate entered · handover is not calculated"
    });
  }
  return sources;
}

export function tomorrowSnapshot(state) {
  const today = localDateAt();
  const dateLocal = addDays(today, 1);
  const schedule = buildSchedule(state, { horizonStart: today });
  const day = schedule.days.find((item) => item.dateLocal === dateLocal) ?? buildDay(state, dateLocal, { work: [], care: [] }, schedule.checkedAt);
  const featured =
    day.children.find((child) => child.summary.state === COVERAGE_STATE.uncovered) ??
    day.children.find((child) => child.summary.state === COVERAGE_STATE.unknown) ??
    day.children[0];

  return {
    dateLocal,
    day,
    schedule,
    summary: day.summary,
    children: day.children,
    featuredChildName: featured?.name ?? null,
    sources: sourceRecordsFor(day, state.profile),
    hasScheduleData: day.hasScheduleData
  };
}
