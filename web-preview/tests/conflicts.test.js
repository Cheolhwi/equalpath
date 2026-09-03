import { describe, expect, it } from "vitest";

import { detectConflictCandidates, totalUncoveredMinutes, totalUnknownMinutes } from "../src/domain/conflicts.js";

const USER = "owner";
const CHILD = "nia";

const required = (overrides = {}) => ({
  $id: "req",
  child_id: CHILD,
  entry_kind: "required",
  status: "active",
  start_minute: 480,
  end_minute: 1080,
  source_records: ["Care needed"],
  ...overrides
});

const coverage = (overrides = {}) => ({
  $id: "cov",
  child_id: CHILD,
  entry_kind: "coverage",
  status: "active",
  start_minute: 480,
  end_minute: 960,
  collect_by_minute: 960,
  handover_in_ref: USER,
  handover_out_ref: USER,
  band_state: "covered",
  source_records: ["TASKA Seri Kasih"],
  ...overrides
});

const work = (overrides = {}) => ({
  $id: "work",
  status: "active",
  start_minute: 540,
  end_minute: 1050,
  priority: "fixed",
  remote_possible: false,
  location_mode: "office",
  source_label: "Office day",
  ...overrides
});

const run = (careRows, workRows, profile = { travel_care_work_min: 30, travel_home_care_min: 20 }) =>
  detectConflictCandidates({
    userId: USER,
    childId: CHILD,
    childName: "Nia",
    dateLocal: "2026-09-07",
    careRows,
    workRows,
    profile
  });

describe("conflict detection", () => {
  it("reports no candidate when coverage spans the whole requirement", () => {
    expect(run([required({ end_minute: 960 }), coverage()], [work()])).toEqual([]);
  });

  it("flags the overlap between an uncovered band and a work commitment", () => {
    const [conflict] = run([required(), coverage()], [work()]);
    expect(conflict).toMatchObject({ kind: "care_work_overlap", state: "uncovered", start_minute: 960, end_minute: 1050 });
  });

  it("names the records the conflict came from instead of asserting a result", () => {
    const [conflict] = run([required(), coverage()], [work()]);
    expect(conflict.source_records).toEqual(["Care needed", "Office day"]);
  });

  it("ranks fixed, non-remote work above flexible work", () => {
    const [fixed] = run([required(), coverage()], [work()]);
    const [flexible] = run([required(), coverage()], [work({ priority: "flexible" })]);
    const [remote] = run([required(), coverage()], [work({ remote_possible: true })]);
    expect(fixed.priority).toBe("high");
    expect(flexible.priority).toBe("normal");
    expect(remote.priority).toBe("normal");
  });

  // Unknown is a separate result, never folded into covered or into uncovered.
  it("keeps unverifiable coverage as unknown rather than covered", () => {
    const conflicts = run([required({ end_minute: 1020 }), coverage({ band_state: "unknown", end_minute: 1020 })], [work()]);
    expect(conflicts.every((item) => item.state === "unknown")).toBe(true);
    expect(conflicts[0].kind).toBe("coverage_unknown");
    expect(conflicts[0].priority).toBe("review");
    expect(totalUncoveredMinutes(conflicts)).toBe(0);
    expect(totalUnknownMinutes(conflicts)).toBeGreaterThan(0);
  });

  it("counts coverage as ending at the collection deadline, not at closing time", () => {
    const [conflict] = run([required({ end_minute: 1020 }), coverage({ end_minute: 1020, collect_by_minute: 900 })], [work()]);
    expect(conflict.start_minute).toBe(900);
  });

  describe("evening handover", () => {
    const evening = (profile) =>
      run([required({ end_minute: 1080 }), coverage({ collect_by_minute: 930, end_minute: 930 })], [work({ end_minute: 900 })], profile);

    it("opens a gap when the collector cannot arrive before the deadline", () => {
      const handover = evening({ travel_care_work_min: 60 }).find((item) => item.kind === "handover_out");
      expect(handover).toMatchObject({ state: "uncovered", start_minute: 930, end_minute: 960 });
    });

    it("exposes travel, the work end and the deadline in its evidence", () => {
      const handover = evening({ travel_care_work_min: 60 }).find((item) => item.kind === "handover_out");
      const evidence = handover.source_records.join(" ");
      expect(evidence).toContain("travel_care_work_min 60 min");
      expect(evidence).toContain("work ends 900");
      expect(evidence).toContain("collect_by 930");
    });

    it("reports unknown, not covered, when the travel estimate is missing", () => {
      const handover = evening({}).find((item) => item.kind === "handover_out_unknown");
      expect(handover.state).toBe("unknown");
      expect(handover.priority).toBe("review");
    });

    it("stays silent when the collector arrives in time", () => {
      expect(evening({ travel_care_work_min: 10 }).some((item) => item.kind.startsWith("handover_out"))).toBe(false);
    });
  });

  describe("morning handover", () => {
    // Care is required from 07:30 but the provider only opens at 08:00.
    const morning = (workStart, profile) =>
      run(
        [required({ start_minute: 450, end_minute: 1020 }), coverage({ start_minute: 480, end_minute: 960, collect_by_minute: 960 })],
        [work({ start_minute: workStart, end_minute: 1020 })],
        profile
      );

    it("opens a gap when you must leave before the provider opens", () => {
      // Work starts 08:00 and is 30 minutes away, so you have to leave at 07:30
      // — half an hour before there is anyone to hand the child to.
      const handover = morning(480, { travel_care_work_min: 30 }).find((item) => item.kind === "handover_in");
      expect(handover).toMatchObject({ state: "uncovered", start_minute: 450, end_minute: 480 });
    });

    it("stays silent when you can drop off and still reach work", () => {
      // Leaving at 08:15 for an 08:30 start is after the 08:00 opening.
      expect(morning(510, { travel_care_work_min: 15 }).some((item) => item.kind === "handover_in")).toBe(false);
    });

    it("reports unknown when the travel estimate is missing", () => {
      const handover = morning(510, {}).find((item) => item.kind === "handover_in_unknown");
      expect(handover.state).toBe("unknown");
      expect(handover).toMatchObject({ start_minute: 450, end_minute: 480 });
    });
  });

  it("produces the same keys and the same order for the same input", () => {
    const first = run([required(), coverage()], [work()]);
    const second = run([required(), coverage()], [work()]);
    expect(first.map((item) => item.deterministic_key)).toEqual(second.map((item) => item.deterministic_key));
  });

  it("ignores cancelled rows", () => {
    expect(run([required({ status: "cancelled" }), coverage()], [work()])).toEqual([]);
  });
});
