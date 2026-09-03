import { describe, expect, it } from "vitest";

import { reducer } from "../src/store/reducer.js";
import { emptyDraft, emptyState, sampleState, OWNER_ID } from "../src/store/schema.js";
import { buildSchedule } from "../src/store/derive.js";
import { localDateAt, addDays } from "../src/domain/dates.js";

const START = "2026-09-07"; // a Monday

function seeded() {
  return {
    ...emptyState(),
    phase: "main",
    profile: { ...emptyState().profile, name: "Aina", onboarding_completed: true },
    children: [{ id: "nia", name: "Nia", age_group: "5-12" }],
    supportNetwork: [{ id: OWNER_ID, name: "Aina", relationship: "Account owner", availability: "OWNER", isOwner: true }]
  };
}

const draft = (overrides = {}) => ({
  id: null,
  spanGroup: null,
  patternId: null,
  occurrenceDate: null,
  editingPattern: false,
  kind: "work",
  dateLocal: START,
  childId: "nia",
  title: "Client review",
  notes: "",
  startMinute: 540,
  endMinute: 1020,
  locationMode: "office",
  remotePossible: false,
  priority: "fixed",
  collectByMinute: null,
  handoverInRef: OWNER_ID,
  handoverOutRef: OWNER_ID,
  travelHomeCareMinutes: 20,
  travelCareWorkMinutes: 30,
  travelHomeWorkMinutes: 35,
  repeatWeekly: false,
  weekdays: ["MON"],
  effectiveFrom: START,
  effectiveUntil: null,
  ...overrides
});

const dayOf = (state, dateLocal) =>
  buildSchedule(state, { horizonStart: START }).days.find((item) => item.dateLocal === dateLocal);

describe("schedule entries", () => {
  it("stores a one-off entry on its own date only", () => {
    const state = reducer(seeded(), { type: "save-entry", draft: draft() });
    expect(dayOf(state, START).entries).toHaveLength(1);
    expect(dayOf(state, "2026-09-08").entries).toHaveLength(0);
  });

  it("splits an entry that runs past midnight into two linked parts", () => {
    const state = reducer(seeded(), {
      type: "save-entry",
      draft: draft({ title: "Night shift", startMinute: 1320, endMinute: 360 })
    });
    const first = dayOf(state, START).entries[0];
    const second = dayOf(state, "2026-09-08").entries[0];
    expect(first.spanGroup).toBe(second.spanGroup);
    expect([first.spanPart, second.spanPart]).toEqual([0, 1]);
  });

  it("records travel estimates on the profile when coverage is saved", () => {
    const state = reducer(seeded(), {
      type: "save-entry",
      draft: draft({ kind: "careCoverage", title: "TASKA Seri Kasih", collectByMinute: 960, endMinute: 960 })
    });
    expect(state.profile.travel_care_work_min).toBe(30);
  });

  // Coverage whose collection deadline or responsible adult is missing cannot
  // be called covered; it becomes Unknown, which is a separate result.
  it("marks incomplete coverage as unknown rather than covered", () => {
    const state = reducer(seeded(), {
      type: "save-entry",
      draft: draft({ kind: "careCoverage", title: "Family cover", collectByMinute: null, handoverOutRef: null })
    });
    expect(state.care_commitments[0].band_state).toBe("unknown");
  });
});

describe("weekly patterns", () => {
  const withPattern = () =>
    reducer(seeded(), {
      type: "save-entry",
      draft: draft({ title: "Office day", repeatWeekly: true, weekdays: ["MON", "WED"] })
    });

  it("creates one occurrence per selected weekday", () => {
    const state = withPattern();
    const schedule = buildSchedule(state, { horizonStart: START });
    const dates = schedule.days.filter((day) => day.entries.length > 0).map((day) => day.dateLocal);
    expect(dates).toEqual(["2026-09-07", "2026-09-09", "2026-09-14", "2026-09-16"]);
  });

  it("labels generated occurrences as coming from a pattern", () => {
    expect(dayOf(withPattern(), START).entries[0].generatedFromPattern).toBe(true);
  });

  it("replaces one occurrence with an override and does not regenerate over it", () => {
    const base = withPattern();
    const occurrence = dayOf(base, "2026-09-09").entries[0];
    const state = reducer(base, {
      type: "save-entry",
      draft: draft({
        id: occurrence.id,
        patternId: occurrence.patternId,
        occurrenceDate: "2026-09-09",
        dateLocal: "2026-09-09",
        title: "Client review",
        startMinute: 600
      })
    });
    const day = dayOf(state, "2026-09-09");
    expect(day.entries).toHaveLength(1);
    expect(day.entries[0]).toMatchObject({ title: "Client review", startMinute: 600, isOverride: true });
    expect(dayOf(state, "2026-09-07").entries[0].title).toBe("Office day");
  });

  it("skips a single day without touching the rest of the pattern", () => {
    const base = withPattern();
    const state = reducer(base, { type: "delete-occurrence", entry: dayOf(base, "2026-09-09").entries[0] });
    expect(dayOf(state, "2026-09-09").entries).toHaveLength(0);
    expect(dayOf(state, "2026-09-07").entries).toHaveLength(1);
    expect(dayOf(state, "2026-09-14").entries).toHaveLength(1);
  });

  // The iOS dialog promises that single-day changes survive removing a pattern.
  it("keeps single-day edits when the pattern itself is deleted", () => {
    const base = withPattern();
    const occurrence = dayOf(base, "2026-09-09").entries[0];
    const edited = reducer(base, {
      type: "save-entry",
      draft: draft({
        id: occurrence.id,
        patternId: occurrence.patternId,
        occurrenceDate: "2026-09-09",
        dateLocal: "2026-09-09",
        title: "Client review"
      })
    });
    const state = reducer(edited, { type: "delete-pattern", patternId: occurrence.patternId });
    expect(state.schedule_patterns).toHaveLength(0);
    expect(dayOf(state, "2026-09-07").entries).toHaveLength(0);
    const kept = dayOf(state, "2026-09-09").entries;
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ title: "Client review", patternId: null, generatedFromPattern: false });
  });
});

describe("derived results", () => {
  it("reports a day with no records as having no schedule data, not as covered", () => {
    const day = dayOf(seeded(), START);
    expect(day.hasScheduleData).toBe(false);
    expect(day.entries).toHaveLength(0);
  });

  it("finds the collection gap the setup answers produce", () => {
    let state = reducer(seeded(), {
      type: "save-entry",
      draft: draft({ kind: "careRequired", title: "Care needed", startMinute: 480, endMinute: 1080 })
    });
    state = reducer(state, {
      type: "save-entry",
      draft: draft({ kind: "careCoverage", title: "TASKA Seri Kasih", startMinute: 480, endMinute: 960, collectByMinute: 960 })
    });
    state = reducer(state, { type: "save-entry", draft: draft({ startMinute: 540, endMinute: 1050 }) });

    const day = dayOf(state, START);
    expect(day.summary.state).toBe("uncovered");
    expect(day.careGaps).toEqual([expect.objectContaining({ startMinute: 960, endMinute: 1080 })]);
    expect(day.conflicts[0]).toMatchObject({ state: "uncovered", priority: "high" });
  });

  it("shows all three results somewhere in the sample family's fourteen days", () => {
    const state = sampleState();
    const days = buildSchedule(state, { horizonStart: localDateAt() }).days;
    const states = new Set(days.map((day) => day.summary.state));
    expect(states).toContain("uncovered");
    expect(states).toContain("unknown");
    expect(states).toContain("covered");
  });

  it("puts a gap on tomorrow whichever weekday the sample is opened on", () => {
    const state = sampleState();
    const tomorrow = buildSchedule(state, { horizonStart: localDateAt() }).days.find(
      (day) => day.dateLocal === addDays(localDateAt(), 1)
    );
    expect(tomorrow.summary.state).toBe("uncovered");
  });
});

describe("phases", () => {
  it("ends setup on the first-result screen rather than in the tab bar", () => {
    const state = reducer(seeded(), { type: "complete-setup", draft: { ...emptyDraft(), effectiveFrom: START } });
    expect(state.phase).toBe("onboarding");
    expect(reducer(state, { type: "enter-main" }).phase).toBe("main");
  });

  it("opens the sample family straight into the app", () => {
    expect(sampleState().phase).toBe("main");
  });
});

describe("reset", () => {
  it("returns to an empty welcome state", () => {
    const state = reducer(sampleState(), { type: "reset" });
    expect(state.phase).toBe("welcome");
    expect(state.children).toHaveLength(0);
    expect(state.schedule_patterns).toHaveLength(0);
  });
});
