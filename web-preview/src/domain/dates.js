// Local-date helpers. A "local date" is always the string yyyy-MM-dd; the app
// never stores an instant, so a schedule entry cannot drift across a timezone
// boundary. Ported from appwrite-backend/functions/iteration1-core/src/domain.

const DAY_MS = 86_400_000;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export const WEEKDAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export const WEEKDAY_NAMES = {
  MON: { initial: "M", short: "Mon", full: "Monday" },
  TUE: { initial: "T", short: "Tue", full: "Tuesday" },
  WED: { initial: "W", short: "Wed", full: "Wednesday" },
  THU: { initial: "T", short: "Thu", full: "Thursday" },
  FRI: { initial: "F", short: "Fri", full: "Friday" },
  SAT: { initial: "S", short: "Sat", full: "Saturday" },
  SUN: { initial: "S", short: "Sun", full: "Sunday" }
};

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

export function dateRange(startDateLocal, count) {
  if (!Number.isInteger(count) || count < 0) throw new Error("Date range count must be non-negative");
  return Array.from({ length: count }, (_, index) => addDays(startDateLocal, index));
}

export function daysBetween(fromDateLocal, toDateLocal) {
  const parse = (value) => {
    const [year, month, day] = assertLocalDate(value).split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(toDateLocal) - parse(fromDateLocal)) / DAY_MS);
}

// The web build reads the browser's own clock rather than a fixed zone: this is
// a single-user local application, so the user's calendar day is the authority.
export function localDateAt(instant = new Date()) {
  const year = instant.getFullYear();
  const month = `${instant.getMonth() + 1}`.padStart(2, "0");
  const day = `${instant.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDate(dateLocal) {
  const [year, month, day] = assertLocalDate(dateLocal).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatMinute(minute) {
  const clamped = Math.max(0, Math.min(1440, Math.round(minute)));
  return `${`${Math.floor(clamped / 60) % 24}`.padStart(2, "0")}:${`${clamped % 60}`.padStart(2, "0")}`;
}

export function formatRange(startMinute, endMinute) {
  return `${formatMinute(startMinute)} — ${formatMinute(endMinute)}`;
}

const LONG_DATE = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const MEDIUM_DATE = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "short" });
const SHORT_DATE = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export const formatLongDate = (dateLocal) => LONG_DATE.format(toDate(dateLocal));
export const formatMediumDate = (dateLocal) => MEDIUM_DATE.format(toDate(dateLocal));
export const formatShortDate = (dateLocal) => SHORT_DATE.format(toDate(dateLocal));

export function formatClock(instant) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(instant);
}
