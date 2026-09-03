import { describe, expect, it } from "vitest";

import {
  assertInterval,
  intersectIntervals,
  mergeIntervals,
  splitAcrossMidnight,
  subtractIntervals
} from "../src/domain/intervals.js";

describe("interval maths", () => {
  it("rejects boundaries that are not whole minutes inside one day", () => {
    expect(() => assertInterval({ start: 0, end: 1441 })).toThrow();
    expect(() => assertInterval({ start: 600, end: 600 })).toThrow();
    expect(() => assertInterval({ start: 9.5, end: 600 })).toThrow();
  });

  it("merges touching and overlapping bands into one", () => {
    expect(mergeIntervals([{ start: 540, end: 660 }, { start: 660, end: 720 }])).toEqual([{ start: 540, end: 720 }]);
    expect(mergeIntervals([{ start: 540, end: 700 }, { start: 600, end: 660 }])).toEqual([{ start: 540, end: 700 }]);
  });

  it("leaves a real break between two bands", () => {
    expect(mergeIntervals([{ start: 540, end: 600 }, { start: 660, end: 720 }])).toHaveLength(2);
  });

  it("subtracts coverage from a requirement", () => {
    expect(subtractIntervals([{ start: 480, end: 1020 }], [{ start: 480, end: 930 }])).toEqual([
      { start: 930, end: 1020 }
    ]);
  });

  it("returns two gaps when coverage sits in the middle of the requirement", () => {
    expect(subtractIntervals([{ start: 480, end: 1020 }], [{ start: 600, end: 700 }])).toEqual([
      { start: 480, end: 600 },
      { start: 700, end: 1020 }
    ]);
  });

  it("returns no gap when coverage fully contains the requirement", () => {
    expect(subtractIntervals([{ start: 540, end: 900 }], [{ start: 480, end: 1020 }])).toEqual([]);
  });

  // AC 2.1.1: start_A < end_B AND start_B < end_A. Adjacency is not overlap.
  it("treats adjacency as no overlap", () => {
    expect(intersectIntervals({ start: 480, end: 600 }, { start: 600, end: 720 })).toBeNull();
    expect(intersectIntervals({ start: 480, end: 601 }, { start: 600, end: 720 })).toEqual({ start: 600, end: 601 });
  });

  it("splits an entry that runs past midnight into two linked days", () => {
    expect(splitAcrossMidnight({ dateLocal: "2026-09-03", start: 1320, end: 360 })).toEqual([
      { dateLocal: "2026-09-03", start: 1320, end: 1440 },
      { dateLocal: "2026-09-04", start: 0, end: 360 }
    ]);
  });

  it("leaves a same-day entry alone", () => {
    expect(splitAcrossMidnight({ dateLocal: "2026-09-03", start: 540, end: 1020 })).toHaveLength(1);
  });
});
