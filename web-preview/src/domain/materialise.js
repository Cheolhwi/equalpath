// Weekly-pattern expansion, ported from
// appwrite-backend/functions/iteration1-core/src/domain/materialise.js.
//
// A pattern is entered once and expanded into dated rows across the rolling
// 14-day planning horizon. Expansion is idempotent on (pattern, date) because
// each occurrence's id is derived from exactly those two values, so a re-run
// produces the same rows rather than duplicates. Only weekly repetition exists:
// no RRULE, no monthly or fortnightly rules, no calendar import.

import { dateRange, weekdayOf } from "./dates.js";
import { deterministicHash } from "./hash.js";

const CARE_KINDS = new Set(["care_required", "care_coverage"]);
const ALLOWED_KINDS = new Set(["work", ...CARE_KINDS]);

export function parsePayload(pattern) {
  if (!pattern.payload_json) return {};
  const payload = JSON.parse(pattern.payload_json);
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("Pattern payload_json must contain an object");
  }
  return payload;
}

export function validatePattern(pattern) {
  if (!ALLOWED_KINDS.has(pattern.kind)) throw new Error(`Unsupported pattern kind: ${pattern.kind}`);
  if (!Array.isArray(pattern.byweekday) || pattern.byweekday.length === 0) {
    throw new Error("A weekly pattern needs at least one weekday");
  }
  if (
    !Number.isInteger(pattern.start_minute) ||
    !Number.isInteger(pattern.end_minute) ||
    pattern.start_minute < 0 ||
    pattern.end_minute > 1440 ||
    pattern.end_minute <= pattern.start_minute
  ) {
    throw new Error("Pattern end_minute must be after start_minute within one local day");
  }
  if (CARE_KINDS.has(pattern.kind) && !pattern.child_id) {
    throw new Error(`${pattern.kind} requires child_id`);
  }
  return pattern;
}

export function occurrenceId(patternId, dateLocal) {
  return `p_${deterministicHash(`${patternId}|${dateLocal}`).slice(0, 32)}`;
}

export function expectedDates(pattern, horizonStart, horizonDays) {
  validatePattern(pattern);
  if (pattern.active === false) return [];
  const weekdays = new Set(pattern.byweekday.map((value) => value.toUpperCase()));
  return dateRange(horizonStart, horizonDays).filter((dateLocal) => {
    if (dateLocal < pattern.effective_from) return false;
    if (pattern.effective_until && dateLocal > pattern.effective_until) return false;
    return weekdays.has(weekdayOf(dateLocal));
  });
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

export function occurrenceData(pattern, dateLocal) {
  const payload = parsePayload(pattern);
  const common = {
    $id: occurrenceId(pattern.$id, dateLocal),
    user_id: pattern.user_id,
    pattern_id: pattern.$id,
    is_override: false,
    date_local: dateLocal,
    start_minute: pattern.start_minute,
    end_minute: pattern.end_minute
  };

  if (pattern.kind === "work") {
    return {
      table: "work_commitments",
      data: compact({
        ...common,
        commitment_type: payload.commitment_type ?? "work",
        location_mode: payload.location_mode,
        remote_possible: payload.remote_possible ?? false,
        flexibility_level: payload.flexibility_level,
        priority: payload.priority ?? "fixed",
        notes: payload.notes,
        source_label: payload.source_label ?? "Weekly work pattern",
        status: payload.status ?? "active"
      })
    };
  }

  return {
    table: "care_commitments",
    data: compact({
      ...common,
      child_id: pattern.child_id,
      entry_kind: pattern.kind === "care_required" ? "required" : "coverage",
      resource_type: payload.resource_type,
      resource_ref: payload.resource_ref,
      location_label: payload.location_label,
      notes: payload.notes,
      collect_by_minute: payload.collect_by_minute,
      handover_in_ref: payload.handover_in_ref,
      handover_out_ref: payload.handover_out_ref,
      band_state: payload.band_state ?? "covered",
      source_records: payload.source_records ?? [payload.source_label ?? "Weekly care pattern"],
      status: payload.status ?? "active"
    })
  };
}

// Expand every active pattern across the horizon, dropping any (pattern, date)
// the user has overridden with a single-day edit or skipped outright. An
// override is never regenerated — that is the rule that lets "only this day"
// survive a re-materialisation.
export function materialiseHorizon({ patterns, horizonStart, horizonDays, suppressed = new Set() }) {
  const work = [];
  const care = [];
  for (const pattern of patterns) {
    for (const dateLocal of expectedDates(pattern, horizonStart, horizonDays)) {
      if (suppressed.has(`${pattern.$id}|${dateLocal}`)) continue;
      const occurrence = occurrenceData(pattern, dateLocal);
      (occurrence.table === "work_commitments" ? work : care).push(occurrence.data);
    }
  }
  return { work, care };
}
