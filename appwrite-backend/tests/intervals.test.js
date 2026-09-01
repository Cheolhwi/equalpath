import test from "node:test";
import assert from "node:assert/strict";
import { assertInterval, intersectIntervals, mergeIntervals, splitAcrossMidnight, subtractIntervals } from "../functions/iteration1-core/src/domain/intervals.js";

test("mergeIntervals merges nested, overlapping, and touching bands", () => {
  assert.deepEqual(mergeIntervals([
    { start: 600, end: 660 },
    { start: 540, end: 720 },
    { start: 720, end: 780 },
    { start: 900, end: 960 }
  ]), [
    { start: 540, end: 780 },
    { start: 900, end: 960 }
  ]);
});

test("subtractIntervals keeps only uncovered care", () => {
  assert.deepEqual(subtractIntervals(
    [{ start: 480, end: 1080 }],
    [{ start: 480, end: 600 }, { start: 660, end: 900 }]
  ), [
    { start: 600, end: 660 },
    { start: 900, end: 1080 }
  ]);
});

test("touching intervals do not overlap", () => {
  assert.equal(intersectIntervals({ start: 480, end: 540 }, { start: 540, end: 600 }), null);
});

test("nested intervals return the exact positive-duration overlap", () => {
  assert.deepEqual(intersectIntervals({ start: 480, end: 1080 }, { start: 600, end: 660 }), { start: 600, end: 660 });
});

test("zero-length intervals are rejected", () => {
  assert.throws(() => assertInterval({ start: 600, end: 600 }), /Invalid interval/);
});

test("cross-midnight spans are split into two local calendar days", () => {
  assert.deepEqual(splitAcrossMidnight({ dateLocal: "2026-08-31", start: 1380, end: 60 }), [
    { dateLocal: "2026-08-31", start: 1380, end: 1440 },
    { dateLocal: "2026-09-01", start: 0, end: 60 }
  ]);
});
