import test from "node:test";
import assert from "node:assert/strict";
import {
  DAYS,
  STATUS,
  createInitialState,
  formatGap,
  reducePreview,
  selectedDay,
  statusCopy
} from "../model.mjs";

test("the preview starts at a safe welcome state", () => {
  const state = createInitialState();
  assert.equal(state.welcome, true);
  assert.equal(state.activeView, "tonight");
  assert.equal(state.evidenceOpen, false);
});

test("entering and navigating never adds integration state", () => {
  const entered = reducePreview(createInitialState(), { type: "enter" });
  const schedule = reducePreview(entered, { type: "navigate", view: "schedule" });
  assert.equal(schedule.welcome, false);
  assert.equal(schedule.activeView, "schedule");
  assert.deepEqual(Object.keys(schedule).sort(), ["activeView", "evidenceOpen", "reminders", "selectedDayId", "welcome"]);
});

test("invalid navigation and dates are ignored", () => {
  const initial = createInitialState();
  assert.equal(reducePreview(initial, { type: "navigate", view: "admin" }), initial);
  assert.equal(reducePreview(initial, { type: "select-day", dayId: "2099-01-01" }), initial);
});

test("all three truthful schedule states are represented", () => {
  assert.deepEqual(new Set(DAYS.map((day) => day.status)), new Set([STATUS.GAP, STATUS.COVERED, STATUS.UNKNOWN]));
  assert.equal(DAYS.length, 14);
});

test("Unknown never becomes a zero-minute no-gap result", () => {
  const unknownDays = DAYS.filter((day) => day.status === STATUS.UNKNOWN);
  assert.ok(unknownDays.length > 0);
  assert.ok(unknownDays.every((day) => day.gapMinutes === null));
  assert.equal(statusCopy(STATUS.UNKNOWN), "Unknown");
});

test("the main conflict names exact source evidence", () => {
  const conflict = DAYS.find((day) => day.id === "2026-09-02");
  assert.equal(conflict.status, STATUS.GAP);
  assert.equal(formatGap(conflict.gapMinutes), "9h");
  assert.match(conflict.evidence.join(" "), /Provider closed/);
  assert.match(conflict.evidence.join(" "), /Travel 30 min/);
});

test("select, evidence and reminder transitions are reversible", () => {
  let state = reducePreview(createInitialState(), { type: "select-day", dayId: "2026-09-05" });
  assert.equal(selectedDay(state).status, STATUS.UNKNOWN);
  state = reducePreview(state, { type: "toggle-evidence" });
  assert.equal(state.evidenceOpen, true);
  state = reducePreview(state, { type: "set-reminders", value: false });
  assert.equal(state.reminders, false);
  state = reducePreview(state, { type: "reset" });
  assert.deepEqual(state, createInitialState());
});
