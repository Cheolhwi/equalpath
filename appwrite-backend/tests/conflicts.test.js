import test from "node:test";
import assert from "node:assert/strict";
import { detectConflictCandidates, totalUncoveredMinutes } from "../functions/iteration1-core/src/domain/conflicts.js";

const base = { user_id: "user_1", child_id: "child_1", date_local: "2026-08-29", status: "active" };
const required = { ...base, entry_kind: "required", start_minute: 480, end_minute: 1080, source_records: ["Child A requirement"] };
const work = { ...base, start_minute: 840, end_minute: 1020, priority: "fixed", remote_possible: false, source_label: "Office shift" };

function detect(careRows, workRows = [work], profile = {}) {
  return detectConflictCandidates({
    userId: "user_1",
    childId: "child_1",
    dateLocal: "2026-08-29",
    careRows,
    workRows,
    profile
  });
}

test("unknown coverage is distinct from an uncovered gap", () => {
  const conflicts = detect([
    required,
    { ...base, entry_kind: "coverage", start_minute: 480, end_minute: 900, band_state: "covered", source_records: ["School"] },
    { ...base, entry_kind: "coverage", start_minute: 900, end_minute: 960, band_state: "unknown", source_records: ["Unverified pickup"] }
  ]);
  assert.deepEqual(conflicts.map(({ kind, state, start_minute, end_minute }) => ({ kind, state, start_minute, end_minute })), [
    { kind: "care_work_overlap", state: "uncovered", start_minute: 960, end_minute: 1020 },
    { kind: "coverage_unknown", state: "unknown", start_minute: 900, end_minute: 960 }
  ]);
  assert.equal(totalUncoveredMinutes(conflicts), 60);
});

test("care gaps outside work hours are not conflicts", () => {
  const conflicts = detect([
    required,
    { ...base, entry_kind: "coverage", start_minute: 480, end_minute: 840, band_state: "covered" }
  ], [{ ...work, start_minute: 600, end_minute: 840 }]);
  assert.deepEqual(conflicts, []);
});

test("handover gap includes travel after work", () => {
  const conflicts = detect([
    required,
    { ...base, entry_kind: "coverage", start_minute: 480, end_minute: 1020, collect_by_minute: 960, handover_out_ref: "user_1", band_state: "covered", source_records: ["Provider"] }
  ], [{ ...work, start_minute: 540, end_minute: 900 }], { travel_care_work_min: 90 });
  const handover = conflicts.find((item) => item.kind === "handover_out");
  assert.deepEqual({ start: handover.start_minute, end: handover.end_minute }, { start: 960, end: 990 });
  assert.ok(handover.source_records.some((value) => value.includes("collect_by 960")));
});

test("missing travel produces review state, not a fabricated gap", () => {
  const conflicts = detect([
    required,
    { ...base, entry_kind: "coverage", start_minute: 480, end_minute: 1020, collect_by_minute: 960, handover_out_ref: "user_1", band_state: "covered" }
  ], [{ ...work, start_minute: 540, end_minute: 900 }]);
  const handover = conflicts.find((item) => item.kind === "handover_out_unknown");
  assert.equal(handover.state, "unknown");
  assert.equal(handover.priority, "review");
});

test("arriving exactly at collect_by creates no outbound handover gap", () => {
  const conflicts = detect([
    required,
    { ...base, entry_kind: "coverage", start_minute: 480, end_minute: 1020, collect_by_minute: 960, handover_out_ref: "user_1", band_state: "covered" }
  ], [{ ...work, start_minute: 540, end_minute: 900 }], { travel_care_work_min: 60 });
  assert.equal(conflicts.some((item) => item.kind.startsWith("handover_out")), false);
});

test("provider opening after the owner must leave creates an inbound handover gap", () => {
  const conflicts = detect([
    { ...required, start_minute: 420, end_minute: 1080 },
    { ...base, entry_kind: "coverage", start_minute: 480, end_minute: 1020, handover_in_ref: "user_1", band_state: "covered", source_records: ["Provider opens 08:00"] }
  ], [{ ...work, start_minute: 510, end_minute: 900 }], { travel_care_work_min: 60 });
  const handover = conflicts.find((item) => item.kind === "handover_in");
  assert.deepEqual({ start: handover.start_minute, end: handover.end_minute }, { start: 450, end: 480 });
  assert.ok(handover.source_records.some((value) => value.includes("must leave by 450")));
});

test("handover assigned to a person without stored work does not invent a gap", () => {
  const conflicts = detect([
    required,
    { ...base, entry_kind: "coverage", start_minute: 480, end_minute: 1020, collect_by_minute: 960, handover_out_ref: "carer_1", band_state: "covered" }
  ], [{ ...work, start_minute: 540, end_minute: 900 }], { travel_care_work_min: 90 });
  assert.equal(conflicts.some((item) => item.kind.startsWith("handover_")), false);
});

test("home-based work uses home-to-care travel", () => {
  const conflicts = detect([
    required,
    { ...base, entry_kind: "coverage", start_minute: 480, end_minute: 1020, collect_by_minute: 960, handover_out_ref: "user_1", band_state: "covered" }
  ], [{ ...work, location_mode: "home", start_minute: 540, end_minute: 930 }], {
    travel_home_care_min: 45,
    travel_care_work_min: 10
  });
  const handover = conflicts.find((item) => item.kind === "handover_out");
  assert.deepEqual({ start: handover.start_minute, end: handover.end_minute }, { start: 960, end: 975 });
  assert.ok(handover.source_records.some((value) => value.includes("travel_home_care_min 45")));
});

test("a different child's coverage never covers this child", () => {
  const conflicts = detect([
    required,
    { ...base, child_id: "child_2", entry_kind: "coverage", start_minute: 480, end_minute: 1080, band_state: "covered" }
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].child_id, "child_1");
});

test("a partially resolved gap keeps the same logical conflict identity", () => {
  const first = detect([
    { ...required, $id: "required_1" },
    { ...base, $id: "coverage_1", entry_kind: "coverage", start_minute: 480, end_minute: 900, band_state: "covered" }
  ], [{ ...work, $id: "work_1" }]);
  const partiallyCovered = detect([
    { ...required, $id: "required_1" },
    { ...base, $id: "coverage_1", entry_kind: "coverage", start_minute: 480, end_minute: 960, band_state: "covered" }
  ], [{ ...work, $id: "work_1" }]);

  assert.equal(first.length, 1);
  assert.equal(partiallyCovered.length, 1);
  assert.equal(first[0].deterministic_key, partiallyCovered[0].deterministic_key);
  assert.deepEqual(
    { start: partiallyCovered[0].start_minute, end: partiallyCovered[0].end_minute },
    { start: 960, end: 1020 }
  );
});

test("fixed non-remote conflicts are ordered before normal priority conflicts", () => {
  const conflicts = detect([required], [
    { ...work, $id: "flexible", start_minute: 840, end_minute: 900, priority: "flexible", remote_possible: true },
    { ...work, $id: "fixed", start_minute: 960, end_minute: 1020, priority: "fixed", remote_possible: false }
  ]);
  assert.deepEqual(conflicts.map((item) => item.priority), ["high", "normal"]);
});

test("repeating the same calculation is idempotent", () => {
  const care = [
    { ...required, $id: "required_1" },
    { ...base, $id: "coverage_1", entry_kind: "coverage", start_minute: 480, end_minute: 900, band_state: "covered" }
  ];
  const workRows = [{ ...work, $id: "work_1" }];

  const first = detect(care, workRows);
  const second = detect(care, workRows);

  assert.deepEqual(second, first);
  assert.equal(new Set(first.map((item) => item.deterministic_key)).size, first.length);
});
