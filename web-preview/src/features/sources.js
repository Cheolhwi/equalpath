// The domain layer is a faithful port of the backend, so a handover conflict
// carries its evidence in the backend's own wording: field names and raw
// minute counts. R3.5 requires a handover gap to expose its three inputs, so
// these strings are shown rather than summarised — but they are rewritten into
// clock times and readable leg names first. The wording states the interval and
// its inputs; it never delivers a verdict such as "you will be late".

import { formatMinute } from "../domain/dates.js";

const FIELD_NAMES = {
  travel_care_work_min: "Care ↔ work travel",
  travel_home_care_min: "Home ↔ care travel",
  travel_home_work_min: "Home ↔ work travel"
};

const PHRASES = [
  [/\bwork ends (\d+)\b/, (minute) => `work ends ${formatMinute(minute)}`],
  [/\bwork starts (\d+)\b/, (minute) => `work starts ${formatMinute(minute)}`],
  [/\bcollect_by (\d+)\b/, (minute) => `collection deadline ${formatMinute(minute)}`],
  [/\bmust leave by (\d+)\b/, (minute) => `you must leave by ${formatMinute(minute)}`],
  [/\bprovider opens (\d+)\b/, (minute) => `provider opens ${formatMinute(minute)}`],
  [/\bETA (\d+)\b/, (minute) => `you arrive ${formatMinute(minute)}`]
];

function humaniseFragment(fragment) {
  let text = fragment.trim();
  for (const [field, label] of Object.entries(FIELD_NAMES)) {
    text = text.replace(new RegExp(`\\b${field}\\b`, "g"), label);
  }
  for (const [pattern, format] of PHRASES) {
    const match = text.match(pattern);
    if (match) text = text.replace(pattern, format(Number(match[1])));
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function humaniseSource(record) {
  return String(record)
    .split(";")
    .map(humaniseFragment)
    .filter((fragment) => fragment.length > 0);
}

export function humaniseSources(records) {
  return records.flatMap(humaniseSource);
}

export const CONFLICT_KIND_LABEL = {
  care_work_overlap: "Care and work overlap",
  coverage_unknown: "Coverage cannot be verified",
  handover_out: "Evening collection",
  handover_out_unknown: "Evening collection not calculated",
  handover_in: "Morning drop-off",
  handover_in_unknown: "Morning drop-off not calculated"
};
