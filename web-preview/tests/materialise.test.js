import { describe, expect, it } from "vitest";

import { expectedDates, materialiseHorizon, occurrenceId, validatePattern } from "../src/domain/materialise.js";

const pattern = (overrides = {}) => ({
  $id: "pat1",
  user_id: "owner",
  kind: "care_coverage",
  child_id: "nia",
  byweekday: ["MON", "WED", "FRI"],
  start_minute: 480,
  end_minute: 960,
  effective_from: "2026-09-01",
  effective_until: null,
  active: true,
  payload_json: JSON.stringify({ location_label: "TASKA Seri Kasih", collect_by_minute: 960 }),
  ...overrides
});

describe("weekly pattern materialisation", () => {
  it("only accepts weekly patterns that name a weekday and a valid span", () => {
    expect(() => validatePattern(pattern({ byweekday: [] }))).toThrow();
    expect(() => validatePattern(pattern({ start_minute: 960, end_minute: 480 }))).toThrow();
    expect(() => validatePattern(pattern({ kind: "care_required", child_id: null }))).toThrow();
  });

  it("expands only the named weekdays inside the horizon", () => {
    const dates = expectedDates(pattern(), "2026-09-07", 14);
    expect(dates).toEqual([
      "2026-09-07",
      "2026-09-09",
      "2026-09-11",
      "2026-09-14",
      "2026-09-16",
      "2026-09-18"
    ]);
  });

  it("respects the effective window at both ends", () => {
    expect(expectedDates(pattern({ effective_from: "2026-09-11" }), "2026-09-07", 14)).not.toContain("2026-09-09");
    expect(expectedDates(pattern({ effective_until: "2026-09-11" }), "2026-09-07", 14)).not.toContain("2026-09-14");
  });

  it("produces nothing for an inactive pattern", () => {
    expect(expectedDates(pattern({ active: false }), "2026-09-07", 14)).toEqual([]);
  });

  // R1.5: re-running materialisation must not duplicate rows.
  it("is idempotent on (pattern, date)", () => {
    const first = materialiseHorizon({ patterns: [pattern()], horizonStart: "2026-09-07", horizonDays: 14 });
    const second = materialiseHorizon({ patterns: [pattern()], horizonStart: "2026-09-07", horizonDays: 14 });
    expect(first).toEqual(second);
    expect(new Set(first.care.map((row) => row.$id)).size).toBe(first.care.length);
    expect(occurrenceId("pat1", "2026-09-07")).toBe(occurrenceId("pat1", "2026-09-07"));
    expect(occurrenceId("pat1", "2026-09-07")).not.toBe(occurrenceId("pat1", "2026-09-09"));
  });

  it("leaves a suppressed date alone", () => {
    const all = materialiseHorizon({ patterns: [pattern()], horizonStart: "2026-09-07", horizonDays: 14 });
    const withSkip = materialiseHorizon({
      patterns: [pattern()],
      horizonStart: "2026-09-07",
      horizonDays: 14,
      suppressed: new Set(["pat1|2026-09-09"])
    });
    expect(withSkip.care).toHaveLength(all.care.length - 1);
    expect(withSkip.care.some((row) => row.date_local === "2026-09-09")).toBe(false);
  });

  it("routes work patterns to work rows and care patterns to care rows", () => {
    const rows = materialiseHorizon({
      patterns: [pattern(), pattern({ $id: "pat2", kind: "work", child_id: null, payload_json: "{}" })],
      horizonStart: "2026-09-07",
      horizonDays: 7
    });
    expect(rows.work.every((row) => row.pattern_id === "pat2")).toBe(true);
    expect(rows.care.every((row) => row.entry_kind === "coverage")).toBe(true);
  });

  it("marks generated rows as not being overrides", () => {
    const rows = materialiseHorizon({ patterns: [pattern()], horizonStart: "2026-09-07", horizonDays: 7 });
    expect(rows.care.every((row) => row.is_override === false)).toBe(true);
  });
});
