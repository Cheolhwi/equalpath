const DAY_MS = 86_400_000;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function assertLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
    throw new Error(`Invalid local date: ${value}`);
  }
  return value;
}

export function addDays(dateLocal, days) {
  const [year, month, day] = assertLocalDate(dateLocal).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

export function weekdayOf(dateLocal) {
  const [year, month, day] = assertLocalDate(dateLocal).split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function localDateAt(instant = new Date(), timeZone = "Asia/Kuala_Lumpur") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function localHourAt(instant = new Date(), timeZone = "Asia/Kuala_Lumpur") {
  return Number.parseInt(new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23"
  }).format(instant), 10);
}

export function dateRange(startDateLocal, count) {
  if (!Number.isInteger(count) || count < 0) throw new Error("Date range count must be non-negative");
  return Array.from({ length: count }, (_, index) => addDays(startDateLocal, index));
}

