import test from "node:test";
import assert from "node:assert/strict";
import { addDays, dateRange, localDateAt, localHourAt, weekdayOf } from "../functions/iteration1-core/src/domain/dates.js";

test("local date helpers do not depend on the server timezone", () => {
  const instant = new Date("2026-08-28T16:30:00.000Z");
  assert.equal(localDateAt(instant, "Asia/Kuala_Lumpur"), "2026-08-29");
  assert.equal(localHourAt(instant, "Asia/Kuala_Lumpur"), 0);
});

test("date arithmetic crosses month boundaries", () => {
  assert.equal(addDays("2026-08-31", 1), "2026-09-01");
  assert.equal(weekdayOf("2026-08-31"), "MON");
  assert.deepEqual(dateRange("2026-08-31", 3), ["2026-08-31", "2026-09-01", "2026-09-02"]);
});
