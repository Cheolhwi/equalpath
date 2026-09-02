export const STATUS = Object.freeze({
  GAP: "gap",
  COVERED: "covered",
  UNKNOWN: "unknown"
});

export const DAYS = Object.freeze([
  {
    id: "2026-09-01",
    weekday: "Tue",
    day: 1,
    status: STATUS.COVERED,
    gapMinutes: 0,
    window: "08:00 — 17:00",
    summary: "Care covers the full work and travel window.",
    evidence: ["Care needed · 08:00–17:00", "TASKA Seri Kasih · 08:00–17:30", "Work · 09:00–17:00"]
  },
  {
    id: "2026-09-02",
    weekday: "Wed",
    day: 2,
    status: STATUS.GAP,
    gapMinutes: 540,
    window: "08:00 — 17:00",
    summary: "Nia needs nine hours of cover tomorrow.",
    evidence: ["Provider closed · JKM record", "Client review ends 15:30 · fixed", "Travel 30 min · counted between work and care"]
  },
  {
    id: "2026-09-03",
    weekday: "Thu",
    day: 3,
    status: STATUS.COVERED,
    gapMinutes: 0,
    window: "08:00 — 17:00",
    summary: "No uncovered time in the current records.",
    evidence: ["Care needed · 08:00–17:00", "Aina · 07:45–17:30", "Remote work · flexible"]
  },
  {
    id: "2026-09-04",
    weekday: "Fri",
    day: 4,
    status: STATUS.COVERED,
    gapMinutes: 0,
    window: "08:00 — 15:30",
    summary: "Registered care covers Friday's shorter work day.",
    evidence: ["Care needed · 08:00–15:30", "TASKA Seri Kasih · 08:00–16:00", "Work · 09:00–15:00"]
  },
  {
    id: "2026-09-05",
    weekday: "Sat",
    day: 5,
    status: STATUS.UNKNOWN,
    gapMinutes: null,
    window: "Evidence incomplete",
    summary: "Collection responsibility is missing, so EqualPath cannot claim No gap.",
    evidence: ["Care needed · 09:00–12:00", "Coverage record · present", "Collection responsibility · Unknown"]
  },
  { id: "2026-09-06", weekday: "Sun", day: 6, status: STATUS.COVERED, gapMinutes: 0, window: "No care needed", summary: "No required-care window is recorded.", evidence: ["Required care · none"] },
  { id: "2026-09-07", weekday: "Mon", day: 7, status: STATUS.COVERED, gapMinutes: 0, window: "08:00 — 17:00", summary: "The current records show full cover.", evidence: ["Registered care · 08:00–17:30", "Work · 09:00–17:00"] },
  { id: "2026-09-08", weekday: "Tue", day: 8, status: STATUS.COVERED, gapMinutes: 0, window: "08:00 — 17:00", summary: "The current records show full cover.", evidence: ["Registered care · 08:00–17:30", "Work · 09:00–17:00"] },
  { id: "2026-09-09", weekday: "Wed", day: 9, status: STATUS.GAP, gapMinutes: 90, window: "15:30 — 17:00", summary: "A 90-minute collection gap remains.", evidence: ["Provider closes · 15:30", "Work ends · 16:30", "Travel · 30 min"] },
  { id: "2026-09-10", weekday: "Thu", day: 10, status: STATUS.COVERED, gapMinutes: 0, window: "08:00 — 17:00", summary: "The current records show full cover.", evidence: ["Aina · 08:00–17:30", "Work · 09:00–17:00"] },
  { id: "2026-09-11", weekday: "Fri", day: 11, status: STATUS.COVERED, gapMinutes: 0, window: "08:00 — 15:30", summary: "The current records show full cover.", evidence: ["Registered care · 08:00–16:00", "Work · 09:00–15:00"] },
  { id: "2026-09-12", weekday: "Sat", day: 12, status: STATUS.UNKNOWN, gapMinutes: null, window: "Evidence incomplete", summary: "Travel evidence is missing.", evidence: ["Family cover · 09:00–12:00", "Travel duration · Unknown"] },
  { id: "2026-09-13", weekday: "Sun", day: 13, status: STATUS.COVERED, gapMinutes: 0, window: "No care needed", summary: "No required-care window is recorded.", evidence: ["Required care · none"] },
  { id: "2026-09-14", weekday: "Mon", day: 14, status: STATUS.COVERED, gapMinutes: 0, window: "08:00 — 17:00", summary: "The current records show full cover.", evidence: ["Registered care · 08:00–17:30", "Work · 09:00–17:00"] }
]);

export const VIEWS = Object.freeze(["tonight", "schedule", "people", "me"]);

export function createInitialState() {
  return {
    welcome: true,
    activeView: "tonight",
    selectedDayId: "2026-09-02",
    evidenceOpen: false,
    reminders: true
  };
}

export function selectedDay(state) {
  return DAYS.find((day) => day.id === state.selectedDayId) ?? DAYS[1];
}

export function statusCopy(status) {
  if (status === STATUS.GAP) return "Uncovered";
  if (status === STATUS.COVERED) return "No gap";
  return "Unknown";
}

export function formatGap(minutes) {
  if (minutes === null) return "?";
  if (minutes === 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function reducePreview(state, action) {
  switch (action.type) {
    case "enter":
      return { ...state, welcome: false };
    case "navigate":
      return VIEWS.includes(action.view)
        ? { ...state, activeView: action.view, evidenceOpen: false }
        : state;
    case "select-day":
      return DAYS.some((day) => day.id === action.dayId)
        ? { ...state, selectedDayId: action.dayId, evidenceOpen: false }
        : state;
    case "toggle-evidence":
      return { ...state, evidenceOpen: !state.evidenceOpen };
    case "set-reminders":
      return { ...state, reminders: Boolean(action.value) };
    case "reset":
      return createInitialState();
    default:
      return state;
  }
}
