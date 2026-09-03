// The local shape mirrors the five owner-scoped Appwrite collections of
// Iteration 1 — users, children, work_commitments, care_commitments and
// schedule_patterns — plus the support network the People surface reads. Names
// are kept identical to the backend so the domain code ported from
// appwrite-backend runs against these rows unchanged.

import { addDays, dateRange, localDateAt, weekdayOf, WEEKDAY_ORDER } from "../domain/dates.js";
import { createId } from "../domain/hash.js";

export const STORAGE_KEY = "equalpath.iteration1.web.v1";
export const STATE_VERSION = 1;
export const HORIZON_DAYS = 14;
export const OWNER_ID = "owner";

export const ENTRY_KINDS = {
  work: { id: "work", label: "Work", patternKind: "work", accent: "blue" },
  careRequired: { id: "careRequired", label: "Care needed", patternKind: "care_required", accent: "amber" },
  careCoverage: { id: "careCoverage", label: "Care coverage", patternKind: "care_coverage", accent: "teal" }
};

export const AGE_GROUPS = ["0-4", "5-12", "13-17"];

export function emptyState() {
  return {
    version: STATE_VERSION,
    phase: "welcome",
    profile: {
      id: OWNER_ID,
      name: "",
      email: "",
      home_area: "",
      work_area: "",
      travel_home_care_min: null,
      travel_care_work_min: null,
      travel_home_work_min: null,
      notification_enabled: true,
      onboarding_completed: false,
      sample_data: false
    },
    children: [],
    supportNetwork: [],
    work_commitments: [],
    care_commitments: [],
    schedule_patterns: [],
    skips: [],
    lastSweepAt: null,
    lastSweepError: null
  };
}

// The onboarding draft carries the same defaults as the iOS OnboardingDraft, so
// the setup flow reads identically on both platforms.
export function emptyDraft() {
  const today = localDateAt();
  return {
    name: "Aina",
    email: "",
    children: [
      { name: "Nia", ageGroup: "5-12" },
      { name: "Idris", ageGroup: "5-12" }
    ],
    providerName: "TASKA Seri Kasih",
    workArea: "KL Sentral",
    homeArea: "Ampang",
    careDays: ["MON", "TUE", "WED", "THU", "FRI"],
    careStartMinute: 8 * 60,
    careEndMinute: 16 * 60,
    collectionBy: "You",
    officeDays: ["MON", "TUE", "WED", "THU"],
    officeStartMinute: 9 * 60,
    officeEndMinute: 17 * 60 + 30,
    homeWorkDays: ["FRI"],
    homeWorkStartMinute: 9 * 60,
    homeWorkEndMinute: 15 * 60,
    travelHomeCareMinutes: 20,
    travelCareWorkMinutes: 30,
    travelHomeWorkMinutes: 35,
    notificationEnabled: true,
    carers: ["Farid", "Mother"],
    effectiveFrom: today
  };
}

function pattern({ kind, childId, weekdays, startMinute, endMinute, effectiveFrom, payload }) {
  return {
    $id: createId("pat"),
    user_id: OWNER_ID,
    kind,
    child_id: childId ?? null,
    byweekday: weekdays,
    start_minute: startMinute,
    end_minute: endMinute,
    effective_from: effectiveFrom,
    effective_until: null,
    active: true,
    payload_json: JSON.stringify(payload)
  };
}

// Turning the setup answers into stored rows. The rules here mirror
// AppwriteEqualPathService.completeOnboarding exactly, so the web build and the
// iOS build derive the same patterns from the same answers:
//   required care runs on every work day, from the earlier of the provider
//   opening and the first work start, to the later of the provider closing and
//   the last work end plus that commitment's travel leg;
//   coverage runs on the provider's own days and ends at its collection time.
export function stateFromDraft(draft) {
  const state = emptyState();
  const effectiveFrom = draft.effectiveFrom ?? localDateAt();

  state.profile = {
    ...state.profile,
    name: draft.name.trim(),
    email: draft.email.trim(),
    home_area: draft.homeArea.trim(),
    work_area: draft.workArea.trim(),
    travel_home_care_min: draft.travelHomeCareMinutes,
    travel_care_work_min: draft.travelCareWorkMinutes,
    travel_home_work_min: draft.travelHomeWorkMinutes,
    notification_enabled: draft.notificationEnabled,
    onboarding_completed: true
  };

  state.children = draft.children
    .filter((child) => child.name.trim().length > 0)
    .map((child) => ({ id: createId("child"), name: child.name.trim(), age_group: child.ageGroup }));

  state.supportNetwork = [
    {
      id: OWNER_ID,
      name: draft.name.trim() || "You",
      relationship: "Account owner",
      availability: "OWNER",
      isOwner: true
    },
    ...draft.carers
      .filter((carer) => carer.trim().length > 0)
      .map((carer, index) => ({
        id: createId("person"),
        name: carer.trim(),
        relationship: index === 0 ? "Partner" : "Family",
        availability: index === 0 ? "AVAILABLE" : "ADDED",
        isOwner: false
      }))
  ];

  const workWeekdays = [...new Set([...draft.officeDays, ...draft.homeWorkDays])].sort(
    (left, right) => WEEKDAY_ORDER.indexOf(left) - WEEKDAY_ORDER.indexOf(right)
  );
  // Travel is counted on the far end of the work day, otherwise a 16:00
  // collection after a 15:30 finish looks possible when it is not.
  const workEnds = [
    draft.officeEndMinute + draft.travelCareWorkMinutes,
    draft.homeWorkEndMinute + draft.travelHomeCareMinutes
  ];
  const requiredStart = Math.min(draft.careStartMinute, draft.officeStartMinute, draft.homeWorkStartMinute);
  const requiredEnd = Math.min(1440, Math.max(draft.careEndMinute, ...workEnds));

  for (const child of state.children) {
    if (workWeekdays.length > 0) {
      state.schedule_patterns.push(
        pattern({
          kind: "care_required",
          childId: child.id,
          weekdays: workWeekdays,
          startMinute: requiredStart,
          endMinute: requiredEnd,
          effectiveFrom,
          payload: {
            location_label: "Care needed",
            source_label: "Care needed while parent works",
            source_records: [`Care needed while parent works · ${child.name}`]
          }
        })
      );
    }
    if (draft.careDays.length > 0) {
      state.schedule_patterns.push(
        pattern({
          kind: "care_coverage",
          childId: child.id,
          weekdays: draft.careDays,
          startMinute: draft.careStartMinute,
          endMinute: draft.careEndMinute,
          effectiveFrom,
          payload: {
            location_label: draft.providerName.trim(),
            resource_type: "registered_provider",
            collect_by_minute: draft.careEndMinute,
            handover_in_ref: OWNER_ID,
            handover_out_ref: OWNER_ID,
            band_state: "covered",
            source_label: `${draft.providerName.trim()} · registered hours`,
            source_records: [`${draft.providerName.trim()} · registered hours`]
          }
        })
      );
    }
  }

  if (draft.officeDays.length > 0) {
    state.schedule_patterns.push(
      pattern({
        kind: "work",
        weekdays: draft.officeDays,
        startMinute: draft.officeStartMinute,
        endMinute: draft.officeEndMinute,
        effectiveFrom,
        payload: {
          commitment_type: "Office day",
          location_mode: "office",
          remote_possible: false,
          priority: "fixed",
          source_label: "Regular office days"
        }
      })
    );
  }

  if (draft.homeWorkDays.length > 0) {
    state.schedule_patterns.push(
      pattern({
        kind: "work",
        weekdays: draft.homeWorkDays,
        startMinute: draft.homeWorkStartMinute,
        endMinute: draft.homeWorkEndMinute,
        effectiveFrom,
        payload: {
          commitment_type: "Work from home",
          location_mode: "home",
          remote_possible: true,
          priority: "flexible",
          source_label: "Regular work-from-home days"
        }
      })
    );
  }

  // Setup ends on the first-result screen, not in the tab bar: the point of the
  // sweep is that the user sees what their own answers produced before the app
  // opens. `enter-main` moves on from there.
  state.phase = "onboarding";
  state.lastSweepAt = new Date().toISOString();
  return state;
}

function oneOff(fields) {
  return {
    $id: createId(fields.entry_kind ? "care" : "work"),
    user_id: OWNER_ID,
    pattern_id: null,
    is_override: false,
    suppresses: null,
    span_group: null,
    span_part: null,
    status: "active",
    ...fields
  };
}

// A sample family whose fourteen days contain all three results: weekday
// collection gaps that the setup answers produce on their own, a weekend where
// coverage exists but nobody recorded who collects, and empty days that are
// shown as having no data rather than as covered. Tomorrow is arranged to hold
// a gap whichever weekday a visitor arrives on, so the first screen always
// demonstrates the product. Every row here is one a user could have typed.
export function sampleState() {
  const state = stateFromDraft(emptyDraft());
  state.phase = "main";
  state.profile.sample_data = true;
  state.profile.email = "aina@example.com";

  const today = localDateAt();
  const nia = state.children[0];
  if (!nia) return state;

  const tomorrow = addDays(today, 1);
  const tomorrowWeekday = weekdayOf(tomorrow);
  const patternCovers = (kind, test = () => true) =>
    state.schedule_patterns.some(
      (item) => item.kind === kind && item.byweekday.includes(tomorrowWeekday) && test(JSON.parse(item.payload_json))
    );

  const hasRequiredTomorrow = patternCovers("care_required");
  const hasOfficeTomorrow = patternCovers("work", (payload) => payload.location_mode === "office");

  if (!hasRequiredTomorrow) {
    state.care_commitments.push(
      oneOff({
        date_local: tomorrow,
        child_id: nia.id,
        entry_kind: "required",
        location_label: "Care needed",
        notes: "Weekend shift",
        band_state: "covered",
        source_label: "Care needed while parent works",
        source_records: [`Care needed while parent works · ${nia.name}`],
        start_minute: 8 * 60,
        end_minute: 17 * 60 + 30
      })
    );
    state.care_commitments.push(
      oneOff({
        date_local: tomorrow,
        child_id: nia.id,
        entry_kind: "coverage",
        location_label: "TASKA Seri Kasih",
        notes: "Weekend opening hours",
        collect_by_minute: 15 * 60 + 30,
        handover_in_ref: OWNER_ID,
        handover_out_ref: OWNER_ID,
        band_state: "covered",
        source_label: "TASKA Seri Kasih · registered hours",
        source_records: ["TASKA Seri Kasih · registered hours"],
        start_minute: 8 * 60,
        end_minute: 15 * 60 + 30
      })
    );
  }

  if (!hasOfficeTomorrow || !hasRequiredTomorrow) {
    state.work_commitments.push(
      oneOff({
        date_local: tomorrow,
        start_minute: 9 * 60,
        end_minute: 17 * 60,
        commitment_type: "Client review",
        location_mode: "office",
        remote_possible: false,
        priority: "fixed",
        notes: "Cannot be moved",
        source_label: "Client review · fixed, in office"
      })
    );
  }

  const saturday = dateRange(today, 14).find((date) => weekdayOf(date) === "SAT" && date !== tomorrow);
  if (saturday) {
    state.care_commitments.push(
      oneOff({
        date_local: saturday,
        child_id: nia.id,
        entry_kind: "required",
        location_label: "Care needed",
        notes: "Weekend shift",
        band_state: "covered",
        source_label: "Care needed · weekend shift",
        source_records: [`Care needed · ${nia.name} · weekend shift`],
        start_minute: 9 * 60,
        end_minute: 13 * 60
      })
    );
    state.care_commitments.push(
      oneOff({
        date_local: saturday,
        child_id: nia.id,
        entry_kind: "coverage",
        location_label: "Family cover",
        notes: "Offered by a family member; collection responsibility not recorded",
        collect_by_minute: null,
        handover_in_ref: null,
        handover_out_ref: null,
        band_state: "unknown",
        source_label: "Family cover · collection responsibility Unknown",
        source_records: ["Family cover · collection responsibility Unknown"],
        start_minute: 9 * 60,
        end_minute: 13 * 60
      })
    );
    state.work_commitments.push(
      oneOff({
        date_local: saturday,
        start_minute: 9 * 60,
        end_minute: 13 * 60,
        commitment_type: "Weekend shift",
        location_mode: "office",
        remote_possible: false,
        priority: "fixed",
        notes: "",
        source_label: "Weekend shift · fixed"
      })
    );
  }

  return state;
}
