import test from "node:test";
import assert from "node:assert/strict";
import { expectedDates, occurrenceData, occurrenceId } from "../functions/iteration1-core/src/domain/materialise.js";

const pattern = {
  $id: "pattern_1",
  user_id: "user_1",
  child_id: "child_1",
  kind: "care_coverage",
  byweekday: ["MON", "WED"],
  start_minute: 480,
  end_minute: 1020,
  effective_from: "2026-08-31",
  effective_until: "2026-09-09",
  payload_json: JSON.stringify({
    collect_by_minute: 960,
    handover_in_ref: "user_1",
    handover_out_ref: "user_1",
    source_label: "School"
  }),
  active: true
};

test("weekly patterns materialise only matching dates inside their effective range", () => {
  assert.deepEqual(expectedDates(pattern, "2026-08-28", 14), [
    "2026-08-31", "2026-09-02", "2026-09-07", "2026-09-09"
  ]);
});

test("occurrence IDs are deterministic and occurrence rows preserve source data", () => {
  assert.equal(occurrenceId("pattern_1", "2026-08-31"), occurrenceId("pattern_1", "2026-08-31"));
  const occurrence = occurrenceData(pattern, "2026-08-31");
  assert.equal(occurrence.table, "care_commitments");
  assert.equal(occurrence.data.entry_kind, "coverage");
  assert.equal(occurrence.data.collect_by_minute, 960);
  assert.equal(occurrence.data.handover_in_ref, "user_1");
  assert.equal(occurrence.data.handover_out_ref, "user_1");
  assert.deepEqual(occurrence.data.source_records, ["School"]);
});

test("care patterns cannot exist without a child", () => {
  assert.throws(() => expectedDates({ ...pattern, child_id: undefined }, "2026-08-28", 14), /requires child_id/);
});
