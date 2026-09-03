import { useMemo, useState } from "react";

import Icon from "../components/Icon.jsx";
import {
  Button,
  Card,
  ChoiceRow,
  Eyebrow,
  Field,
  Note,
  SectionLabel,
  Stepper,
  TimeInput,
  Toggle
} from "../components/primitives.jsx";
import { addDays, WEEKDAY_NAMES, WEEKDAY_ORDER, weekdayOf } from "../domain/dates.js";
import { HORIZON_DAYS, OWNER_ID } from "../store/schema.js";
import { parsePayload } from "../domain/materialise.js";
import { useStore } from "../store/context.jsx";

const KINDS = [
  { id: "work", label: "Work", icon: "briefcase" },
  { id: "careRequired", label: "Care needed", icon: "clock" },
  { id: "careCoverage", label: "Care coverage", icon: "people" }
];

function baseDraft(dateLocal, childId) {
  return {
    id: null,
    spanGroup: null,
    patternId: null,
    occurrenceDate: null,
    editingPattern: false,
    kind: "work",
    dateLocal,
    childId,
    title: "",
    notes: "",
    startMinute: 9 * 60,
    endMinute: 17 * 60,
    locationMode: "office",
    remotePossible: false,
    priority: "fixed",
    collectByMinute: null,
    handoverInRef: OWNER_ID,
    handoverOutRef: OWNER_ID,
    travelHomeCareMinutes: null,
    travelCareWorkMinutes: null,
    travelHomeWorkMinutes: null,
    repeatWeekly: false,
    weekdays: [weekdayOf(dateLocal)],
    effectiveFrom: dateLocal,
    effectiveUntil: null
  };
}

function draftFromRequest(request, state) {
  const { profile } = state;
  const travel = {
    travelHomeCareMinutes: profile.travel_home_care_min,
    travelCareWorkMinutes: profile.travel_care_work_min,
    travelHomeWorkMinutes: profile.travel_home_work_min
  };

  if (request.mode === "create") {
    return {
      ...baseDraft(request.dateLocal, request.childId),
      ...travel,
      weekdays: request.weekdays ?? [weekdayOf(request.dateLocal)]
    };
  }

  if (request.mode === "pattern") {
    const pattern = state.schedule_patterns.find((item) => item.$id === request.entry.patternId);
    if (!pattern) return { ...baseDraft(request.entry.dateLocal, request.entry.childId), ...travel };
    const payload = parsePayload(pattern);
    return {
      ...baseDraft(pattern.effective_from, pattern.child_id),
      ...travel,
      editingPattern: true,
      patternId: pattern.$id,
      repeatWeekly: true,
      kind: pattern.kind === "work" ? "work" : pattern.kind === "care_required" ? "careRequired" : "careCoverage",
      childId: pattern.child_id,
      title: payload.commitment_type ?? payload.location_label ?? "",
      notes: payload.notes ?? "",
      startMinute: pattern.start_minute,
      endMinute: pattern.end_minute,
      locationMode: payload.location_mode ?? "office",
      remotePossible: Boolean(payload.remote_possible),
      priority: payload.priority ?? "fixed",
      collectByMinute: payload.collect_by_minute ?? null,
      handoverInRef: payload.handover_in_ref ?? OWNER_ID,
      handoverOutRef: payload.handover_out_ref ?? OWNER_ID,
      weekdays: pattern.byweekday,
      effectiveFrom: pattern.effective_from,
      effectiveUntil: pattern.effective_until
    };
  }

  const { entry } = request;
  return {
    ...baseDraft(entry.dateLocal, entry.childId),
    ...travel,
    id: entry.id,
    spanGroup: entry.spanGroup,
    patternId: entry.patternId,
    occurrenceDate: entry.generatedFromPattern || entry.isOverride ? entry.dateLocal : null,
    kind: entry.kind,
    dateLocal: entry.dateLocal,
    childId: entry.childId,
    title: entry.title,
    notes: entry.notes,
    startMinute: entry.startMinute,
    endMinute: entry.endMinute,
    locationMode: entry.locationMode || "office",
    remotePossible: entry.remotePossible,
    priority: entry.priority === "normal" ? "fixed" : entry.priority,
    collectByMinute: entry.collectByMinute,
    handoverInRef: entry.handoverInRef ?? OWNER_ID,
    handoverOutRef: entry.handoverOutRef ?? OWNER_ID,
    weekdays: [weekdayOf(entry.dateLocal)],
    effectiveFrom: entry.dateLocal
  };
}

// Mirrors ScheduleEntryDraft.validationMessages in the iOS build.
function validate(draft, { firstDate, lastDate }) {
  const messages = [];
  if (!draft.repeatWeekly && (draft.dateLocal < firstDate || draft.dateLocal > lastDate)) {
    messages.push("Choose a date inside the rolling fourteen-day planning window.");
  }
  if (draft.title.trim().length === 0) {
    messages.push(draft.kind === "work" ? "Enter the work commitment type or title." : "Enter the care source or label.");
  }
  if (draft.startMinute === draft.endMinute) messages.push("Start and end time cannot be the same.");
  if (draft.kind !== "work" && !draft.childId) messages.push("Choose the child this care record belongs to.");
  if (draft.kind === "careCoverage" && draft.collectByMinute === null) {
    messages.push("Enter the provider’s latest collection time.");
  }
  if (draft.kind === "careCoverage" && !draft.handoverInRef) messages.push("Choose who is responsible for drop-off.");
  if (draft.kind === "careCoverage" && !draft.handoverOutRef) messages.push("Choose who is responsible for collection.");
  if (draft.kind === "work" && draft.locationMode.trim().length === 0) {
    messages.push("Choose where this work commitment happens.");
  }
  if (draft.repeatWeekly && draft.weekdays.length === 0) {
    messages.push("Choose at least one weekday for this weekly pattern.");
  }
  if (draft.repeatWeekly && draft.endMinute <= draft.startMinute) {
    messages.push("A weekly pattern must end later on the same day.");
  }
  if (
    draft.kind === "careCoverage" &&
    [draft.travelHomeCareMinutes, draft.travelCareWorkMinutes, draft.travelHomeWorkMinutes].some(
      (value) => !Number.isInteger(value)
    )
  ) {
    messages.push("Enter all three travel times so EqualPath can calculate both handovers.");
  }
  if (draft.effectiveUntil && draft.effectiveUntil < draft.effectiveFrom) {
    messages.push("The weekly pattern’s end date cannot be before its start date.");
  }
  return messages;
}

export default function EntryEditor({ request, windowStart, onClose, onSave }) {
  const { state } = useStore();
  const [draft, setDraft] = useState(() => draftFromRequest(request, state));
  const [messages, setMessages] = useState([]);
  const patch = (changes) => setDraft((current) => ({ ...current, ...changes }));

  const bounds = useMemo(
    () => ({ firstDate: windowStart, lastDate: addDays(windowStart, HORIZON_DAYS - 1) }),
    [windowStart]
  );

  const people = [{ id: OWNER_ID, name: "You" }, ...state.supportNetwork.filter((person) => !person.isOwner)];
  const lockedKind = request.mode !== "create";
  const crossesMidnight = draft.endMinute < draft.startMinute;

  const submit = () => {
    const found = validate(draft, bounds);
    setMessages(found);
    if (found.length === 0) onSave(draft);
  };

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={draft.id ? "Edit schedule entry" : "New schedule entry"}>
      <div className="sheet" style={{ maxHeight: "100%", flex: 1 }}>
        <div className="editor-header">
          <button type="button" className="close-button" onClick={onClose} aria-label="Cancel">
            <Icon name="close" size={15} strokeWidth={2.4} />
          </button>
          <span className="editor-header__label">
            {draft.editingPattern ? "Weekly pattern" : draft.id ? "Edit entry" : "New entry"}
          </span>
          <span style={{ width: "42px" }} />
        </div>

        <div className="sheet__body">
          <div className="stack--tight" style={{ display: "grid", gap: "8px" }}>
            <Eyebrow>{draft.editingPattern ? "Every week" : draft.id ? "Schedule entry" : "New schedule entry"}</Eyebrow>
            <h3 className="screen__section-title">
              {draft.editingPattern ? "Edit the weekly pattern" : draft.id ? "Edit schedule" : "Add to schedule"}
            </h3>
            <p className="screen__lede" style={{ fontSize: "13px" }}>
              Choose what this record represents, then add the time and details EqualPath should use.
            </p>
          </div>

          <div className="stack">
            <SectionLabel>Record type</SectionLabel>
            <div className="record-type" role="group" aria-label="Record type">
              {KINDS.map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  aria-pressed={draft.kind === kind.id}
                  disabled={lockedKind}
                  onClick={() => patch({ kind: kind.id, title: kind.id === "careRequired" && !draft.title ? "Care needed" : draft.title })}
                >
                  <span className="record-type__icon">
                    <Icon name={kind.icon} />
                  </span>
                  {kind.label}
                </button>
              ))}
            </div>
            {lockedKind ? <p className="screen__footnote">A saved record keeps its type. Delete it to record something different.</p> : null}
          </div>

          <div className="stack">
            <SectionLabel>Repeat</SectionLabel>
            <Card>
              <Toggle
                label="Repeat every week"
                description="Creates one occurrence for each selected day in the rolling 14-day plan."
                checked={draft.repeatWeekly}
                disabled={Boolean(draft.id) || draft.editingPattern}
                onChange={(value) => patch({ repeatWeekly: value })}
              />
              {draft.repeatWeekly ? (
                <div className="stack" style={{ marginTop: "14px", borderTop: "1px solid var(--divider)", paddingTop: "14px" }}>
                  <div className="weekday-row" role="group" aria-label="Repeat on">
                    {WEEKDAY_ORDER.map((day) => (
                      <button
                        key={day}
                        type="button"
                        className="weekday"
                        aria-pressed={draft.weekdays.includes(day)}
                        aria-label={WEEKDAY_NAMES[day].full}
                        onClick={() =>
                          patch({
                            weekdays: draft.weekdays.includes(day)
                              ? draft.weekdays.filter((value) => value !== day)
                              : [...draft.weekdays, day].sort(
                                  (left, right) => WEEKDAY_ORDER.indexOf(left) - WEEKDAY_ORDER.indexOf(right)
                                )
                          })
                        }
                      >
                        {WEEKDAY_NAMES[day].initial}
                      </button>
                    ))}
                  </div>
                  <label className="inline">
                    <span className="inline__label">Effective from</span>
                    <input
                      type="date"
                      className="time-input"
                      value={draft.effectiveFrom}
                      onChange={(event) => patch({ effectiveFrom: event.target.value })}
                    />
                  </label>
                  <Toggle
                    label="Set an end date"
                    checked={draft.effectiveUntil !== null}
                    onChange={(value) => patch({ effectiveUntil: value ? draft.effectiveFrom : null })}
                  />
                  {draft.effectiveUntil !== null ? (
                    <label className="inline">
                      <span className="inline__label">Effective until</span>
                      <input
                        type="date"
                        className="time-input"
                        value={draft.effectiveUntil}
                        min={draft.effectiveFrom}
                        onChange={(event) => patch({ effectiveUntil: event.target.value })}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </Card>
          </div>

          <div className="stack">
            <SectionLabel>When</SectionLabel>
            <Card>
              {!draft.repeatWeekly ? (
                <label className="inline">
                  <span className="inline__label">Date</span>
                  <input
                    type="date"
                    className="time-input"
                    value={draft.dateLocal}
                    min={bounds.firstDate}
                    max={bounds.lastDate}
                    onChange={(event) => patch({ dateLocal: event.target.value })}
                  />
                </label>
              ) : null}
              <TimeInput label="Starts" minute={draft.startMinute} onChange={(value) => patch({ startMinute: value })} />
              <TimeInput label="Ends" minute={draft.endMinute} onChange={(value) => patch({ endMinute: value })} />
            </Card>
          </div>

          {crossesMidnight ? (
            <Note>
              This entry ends after midnight. EqualPath splits it across the two calendar days and
              keeps both parts linked.
            </Note>
          ) : null}

          <div className="stack">
            <SectionLabel>{draft.kind === "work" ? "Work details" : "Care details"}</SectionLabel>
            <Field
              id="entry-title"
              label={draft.kind === "work" ? "Commitment" : draft.kind === "careRequired" ? "Care label" : "Provider or carer"}
              placeholder={draft.kind === "work" ? "Client review" : draft.kind === "careRequired" ? "Care needed" : "TASKA Seri Kasih"}
              value={draft.title}
              onChange={(event) => patch({ title: event.target.value })}
            />

            {draft.kind === "work" ? (
              <>
                <SectionLabel>Location</SectionLabel>
                <ChoiceRow
                  value={draft.locationMode}
                  onChange={(value) => patch({ locationMode: value })}
                  options={[
                    { value: "office", label: "Office", icon: "building" },
                    { value: "home", label: "Home", icon: "house" },
                    { value: "other", label: "Other", icon: "pin" }
                  ]}
                />
                <Card>
                  <Toggle
                    label="Can be attended remotely"
                    description="Used when EqualPath ranks a conflict"
                    checked={draft.remotePossible}
                    onChange={(value) => patch({ remotePossible: value })}
                  />
                </Card>
                <SectionLabel>Priority</SectionLabel>
                <ChoiceRow
                  value={draft.priority}
                  onChange={(value) => patch({ priority: value })}
                  options={[
                    { value: "fixed", label: "Fixed", icon: "lock" },
                    { value: "flexible", label: "Flexible", icon: "flexible" }
                  ]}
                />
              </>
            ) : (
              <>
                <Card>
                  <div className="inline">
                    <span className="inline__label">
                      <span className="row__body">
                        <span className="row__title">Child</span>
                        <span className="row__subtitle">Care is calculated separately for each child</span>
                      </span>
                    </span>
                    <select
                      className="select select--inline"
                      aria-label="Child"
                      value={draft.childId ?? ""}
                      onChange={(event) => patch({ childId: event.target.value || null })}
                    >
                      <option value="">Choose</option>
                      {state.children.map((child) => (
                        <option key={child.id} value={child.id}>
                          {child.name} · {child.age_group}
                        </option>
                      ))}
                    </select>
                  </div>
                </Card>
                <Field
                  id="entry-notes"
                  label="Notes"
                  placeholder="Optional context"
                  value={draft.notes}
                  onChange={(event) => patch({ notes: event.target.value })}
                />
              </>
            )}

            {draft.kind === "careCoverage" ? (
              <>
                <SectionLabel>Handover</SectionLabel>
                <p className="screen__footnote">
                  EqualPath uses these hand-entered times to check both drop-off before work and
                  collection after work.
                </p>
                <Card>
                  <TimeInput
                    label="Collect by"
                    minute={draft.collectByMinute ?? draft.endMinute}
                    onChange={(value) => patch({ collectByMinute: value })}
                  />
                  <div className="inline">
                    <span className="inline__label">Drop-off by</span>
                    <select
                      className="select select--inline"
                      aria-label="Drop-off by"
                      value={draft.handoverInRef ?? ""}
                      onChange={(event) => patch({ handoverInRef: event.target.value || null })}
                    >
                      <option value="">Choose</option>
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="inline">
                    <span className="inline__label">Collection by</span>
                    <select
                      className="select select--inline"
                      aria-label="Collection by"
                      value={draft.handoverOutRef ?? ""}
                      onChange={(event) => patch({ handoverOutRef: event.target.value || null })}
                    >
                      <option value="">Choose</option>
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </Card>

                <SectionLabel>Travel times</SectionLabel>
                <Card>
                  {[
                    ["Home ↔ care", "travelHomeCareMinutes"],
                    ["Care ↔ work", "travelCareWorkMinutes"],
                    ["Home ↔ work", "travelHomeWorkMinutes"]
                  ].map(([label, key]) => (
                    <div className="inline" key={key}>
                      <span className="inline__label">
                        <span className="row__icon">
                          <Icon name="car" size={15} />
                        </span>
                        <span className="row__body">
                          <span className="row__title">{label}</span>
                          <span
                            className="row__subtitle"
                            style={!Number.isInteger(draft[key]) ? { color: "var(--rose-text)" } : undefined}
                          >
                            {Number.isInteger(draft[key]) ? "Your estimate" : "Required for the handover calculation"}
                          </span>
                        </span>
                      </span>
                      <Stepper value={draft[key] ?? 0} onChange={(value) => patch({ [key]: value })} label={label} />
                    </div>
                  ))}
                </Card>
                <Note>
                  These are your estimates, not live location data. Missing values keep the handover
                  state as “not calculated” instead of claiming there is no conflict.
                </Note>
              </>
            ) : null}
          </div>

          {messages.length > 0 ? (
            <div className="note note--alert" style={{ display: "grid", gap: "8px" }}>
              <strong>Please check these details</strong>
              <ul className="source-list">
                {messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="sheet__footer">
          <Button trailingIcon="arrowRight" onClick={submit}>
            {draft.editingPattern ? "Save the pattern" : draft.id ? "Save changes" : "Add to schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
