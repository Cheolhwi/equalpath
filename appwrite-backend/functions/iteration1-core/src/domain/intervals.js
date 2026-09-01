import { addDays } from "./dates.js";

export function assertInterval(interval) {
  if (!Number.isInteger(interval?.start) || !Number.isInteger(interval?.end)) {
    throw new Error("Interval boundaries must be integer minutes");
  }
  if (interval.start < 0 || interval.end > 1440 || interval.end <= interval.start) {
    throw new Error(`Invalid interval ${interval.start}-${interval.end}`);
  }
  return interval;
}

export function splitAcrossMidnight({ dateLocal, start, end }) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > 1439 || end < 0 || end > 1439 || start === end) {
    throw new Error(`Invalid local span ${start}-${end}`);
  }
  if (end > start) return [{ dateLocal, start, end }];
  return [
    { dateLocal, start, end: 1440 },
    { dateLocal: addDays(dateLocal, 1), start: 0, end }
  ];
}

export function mergeIntervals(intervals) {
  const ordered = intervals.map((value) => ({ ...assertInterval(value) }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged = [];
  for (const interval of ordered) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) {
      merged.push({ start: interval.start, end: interval.end });
    } else {
      previous.end = Math.max(previous.end, interval.end);
    }
  }
  return merged;
}

export function subtractIntervals(required, covered) {
  const requirements = mergeIntervals(required);
  const coverage = mergeIntervals(covered);
  const gaps = [];
  for (const requirement of requirements) {
    let cursor = requirement.start;
    for (const band of coverage) {
      if (band.end <= cursor) continue;
      if (band.start >= requirement.end) break;
      if (band.start > cursor) gaps.push({ start: cursor, end: Math.min(band.start, requirement.end) });
      cursor = Math.max(cursor, band.end);
      if (cursor >= requirement.end) break;
    }
    if (cursor < requirement.end) gaps.push({ start: cursor, end: requirement.end });
  }
  return gaps;
}

export function intersectIntervals(left, right) {
  const start = Math.max(assertInterval(left).start, assertInterval(right).start);
  const end = Math.min(left.end, right.end);
  return start < end ? { start, end } : null;
}

export function intersections(interval, candidates) {
  return mergeIntervals(candidates)
    .map((candidate) => intersectIntervals(interval, candidate))
    .filter(Boolean);
}

export function durationMinutes(interval) {
  return assertInterval(interval).end - interval.start;
}
