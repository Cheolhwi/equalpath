// Every mutation the web app supports. The reducer is pure so the same
// transitions can be exercised in tests without a browser.

import { splitAcrossMidnight } from "../domain/intervals.js";
import { createId } from "../domain/hash.js";
import { emptyState, sampleState, stateFromDraft, OWNER_ID } from "./schema.js";

function payloadFromDraft(draft) {
  if (draft.kind === "work") {
    return {
      commitment_type: draft.title.trim(),
      location_mode: draft.locationMode,
      remote_possible: draft.remotePossible,
      priority: draft.priority,
      notes: draft.notes.trim(),
      source_label: draft.title.trim()
    };
  }
  const complete =
    Number.isInteger(draft.collectByMinute) && Boolean(draft.handoverInRef) && Boolean(draft.handoverOutRef);
  return {
    location_label: draft.title.trim(),
    notes: draft.notes.trim(),
    collect_by_minute: draft.kind === "careCoverage" ? draft.collectByMinute ?? null : null,
    handover_in_ref: draft.kind === "careCoverage" ? draft.handoverInRef ?? null : null,
    handover_out_ref: draft.kind === "careCoverage" ? draft.handoverOutRef ?? null : null,
    // Coverage whose collection deadline or responsible adult is missing cannot
    // be called covered. It becomes Unknown, which is a distinct result.
    band_state: draft.kind === "careCoverage" && !complete ? "unknown" : "covered",
    source_label: draft.title.trim(),
    source_records: [draft.title.trim()]
  };
}

function rowsFromDraft(draft, { suppresses = null } = {}) {
  const spans = splitAcrossMidnight({
    dateLocal: draft.dateLocal,
    start: draft.startMinute,
    end: draft.endMinute
  });
  const spanGroup = spans.length > 1 ? draft.spanGroup ?? createId("span") : null;
  const payload = payloadFromDraft(draft);

  return spans.map((span, index) => {
    const base = {
      $id: createId(draft.kind === "work" ? "work" : "care"),
      user_id: OWNER_ID,
      pattern_id: draft.patternId ?? null,
      is_override: Boolean(draft.patternId),
      suppresses: index === 0 ? suppresses : null,
      span_group: spanGroup,
      span_part: spanGroup ? index : null,
      date_local: span.dateLocal,
      start_minute: span.start,
      end_minute: span.end,
      status: "active"
    };

    if (draft.kind === "work") {
      return { table: "work_commitments", row: { ...base, ...payload } };
    }
    return {
      table: "care_commitments",
      row: {
        ...base,
        child_id: draft.childId,
        entry_kind: draft.kind === "careRequired" ? "required" : "coverage",
        ...payload
      }
    };
  });
}

function withoutSpan(rows, { spanGroup, id }) {
  if (spanGroup) return rows.filter((row) => row.span_group !== spanGroup);
  return rows.filter((row) => row.$id !== id);
}

function insert(state, entries) {
  const work = [...state.work_commitments];
  const care = [...state.care_commitments];
  for (const entry of entries) {
    (entry.table === "work_commitments" ? work : care).push(entry.row);
  }
  return { ...state, work_commitments: work, care_commitments: care };
}

function applyTravel(state, draft) {
  if (draft.kind !== "careCoverage") return state;
  return {
    ...state,
    profile: {
      ...state.profile,
      travel_home_care_min: Number.isInteger(draft.travelHomeCareMinutes) ? draft.travelHomeCareMinutes : null,
      travel_care_work_min: Number.isInteger(draft.travelCareWorkMinutes) ? draft.travelCareWorkMinutes : null,
      travel_home_work_min: Number.isInteger(draft.travelHomeWorkMinutes) ? draft.travelHomeWorkMinutes : null
    }
  };
}

function saveEntry(state, draft) {
  let next = applyTravel(state, draft);

  if (draft.repeatWeekly) {
    const pattern = {
      $id: draft.patternId && draft.editingPattern ? draft.patternId : createId("pat"),
      user_id: OWNER_ID,
      kind: draft.kind === "work" ? "work" : draft.kind === "careRequired" ? "care_required" : "care_coverage",
      child_id: draft.kind === "work" ? null : draft.childId,
      byweekday: [...draft.weekdays],
      start_minute: draft.startMinute,
      end_minute: draft.endMinute,
      effective_from: draft.effectiveFrom,
      effective_until: draft.effectiveUntil ?? null,
      active: true,
      payload_json: JSON.stringify(payloadFromDraft(draft))
    };
    const existing = next.schedule_patterns.some((item) => item.$id === pattern.$id);
    return {
      ...next,
      schedule_patterns: existing
        ? next.schedule_patterns.map((item) => (item.$id === pattern.$id ? pattern : item))
        : [...next.schedule_patterns, pattern]
    };
  }

  // Editing one occurrence of a weekly pattern writes a standalone override
  // row and suppresses the generated one for that date only. Re-materialising
  // never regenerates over an override.
  const suppresses = draft.patternId ? `${draft.patternId}|${draft.occurrenceDate ?? draft.dateLocal}` : null;

  if (draft.id) {
    next = {
      ...next,
      work_commitments: withoutSpan(next.work_commitments, { spanGroup: draft.spanGroup, id: draft.id }),
      care_commitments: withoutSpan(next.care_commitments, { spanGroup: draft.spanGroup, id: draft.id })
    };
  }

  return insert(next, rowsFromDraft(draft, { suppresses }));
}

function deleteOccurrence(state, entry) {
  // A generated occurrence has no stored row of its own; skipping it records
  // the exception so materialisation leaves that date alone.
  if (entry.generatedFromPattern) {
    const key = `${entry.patternId}|${entry.dateLocal}`;
    return state.skips.includes(key) ? state : { ...state, skips: [...state.skips, key] };
  }

  const spanGroup = entry.spanGroup;
  const dropped = [...state.work_commitments, ...state.care_commitments].filter((row) =>
    spanGroup ? row.span_group === spanGroup : row.$id === entry.id
  );
  const suppression = dropped.map((row) => row.suppresses).filter(Boolean);

  return {
    ...state,
    work_commitments: withoutSpan(state.work_commitments, { spanGroup, id: entry.id }),
    care_commitments: withoutSpan(state.care_commitments, { spanGroup, id: entry.id }),
    skips: [...new Set([...state.skips, ...suppression])]
  };
}

// Removing a pattern keeps the single-day edits the user made against it; they
// become ordinary one-off rows rather than disappearing with the pattern.
function deletePattern(state, patternId) {
  const detach = (rows) =>
    rows.map((row) =>
      row.pattern_id === patternId ? { ...row, pattern_id: null, is_override: false, suppresses: null } : row
    );
  return {
    ...state,
    schedule_patterns: state.schedule_patterns.filter((pattern) => pattern.$id !== patternId),
    work_commitments: detach(state.work_commitments),
    care_commitments: detach(state.care_commitments),
    skips: state.skips.filter((key) => !key.startsWith(`${patternId}|`))
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "start-setup":
      return { ...state, phase: "onboarding" };

    case "load-sample":
      return sampleState();

    case "complete-setup":
      return stateFromDraft(action.draft);

    case "enter-main":
      return { ...state, phase: "main" };

    case "save-entry":
      return { ...saveEntry(state, action.draft), lastSweepAt: new Date().toISOString(), lastSweepError: null };

    case "delete-occurrence":
      return { ...deleteOccurrence(state, action.entry), lastSweepAt: new Date().toISOString() };

    case "delete-pattern":
      return { ...deletePattern(state, action.patternId), lastSweepAt: new Date().toISOString() };

    case "set-notifications":
      return { ...state, profile: { ...state.profile, notification_enabled: Boolean(action.value) } };

    case "add-person":
      return {
        ...state,
        supportNetwork: [
          ...state.supportNetwork,
          {
            id: createId("person"),
            name: action.name.trim(),
            relationship: action.relationship?.trim() || "Support circle",
            availability: "ADDED",
            isOwner: false
          }
        ]
      };

    case "remove-person":
      return { ...state, supportNetwork: state.supportNetwork.filter((person) => person.id !== action.id || person.isOwner) };

    case "record-sweep":
      return { ...state, lastSweepAt: new Date().toISOString(), lastSweepError: null };

    case "reset":
      return emptyState();

    default:
      return state;
  }
}
