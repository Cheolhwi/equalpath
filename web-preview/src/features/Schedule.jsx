import { useEffect, useMemo, useState } from "react";

import Icon from "../components/Icon.jsx";
import { Button, Card, Eyebrow, Note, SectionLabel, StatusBadge } from "../components/primitives.jsx";
import ConflictCard from "./ConflictCard.jsx";
import EntryEditor from "./EntryEditor.jsx";
import {
  addDays,
  formatLongDate,
  formatMinute,
  formatShortDate,
  localDateAt,
  toDate,
  weekdayOf,
  WEEKDAY_NAMES
} from "../domain/dates.js";
import { HORIZON_DAYS, OWNER_ID } from "../store/schema.js";
import { buildSchedule, hourLabel } from "../store/derive.js";
import { useStore } from "../store/context.jsx";

const ENTRY_STYLE = {
  work: { icon: "briefcase", color: "var(--blue)", label: "Work" },
  careRequired: { icon: "clock", color: "var(--amber)", label: "Care needed" },
  careCoverage: { icon: "people", color: "var(--teal)", label: "Care coverage" }
};

function EntryCard({ entry, onEdit, onEditPattern, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const style = ENTRY_STYLE[entry.kind];
  const handoverIncomplete =
    entry.kind === "careCoverage" && (!entry.handoverInRef || !entry.handoverOutRef || entry.collectByMinute === null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <article className="entry-card">
      <span className="row__icon" style={{ "--accent": style.color }}>
        <Icon name={style.icon} />
      </span>
      <div className="entry-card__body">
        <span className="row__title">{entry.title}</span>
        <span className="row__subtitle">
          {formatMinute(entry.startMinute)} — {formatMinute(entry.endMinute)} · {style.label}
        </span>
        {entry.childName ? (
          <span style={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-secondary)" }}>{entry.childName}</span>
        ) : null}
        {entry.generatedFromPattern ? <span className="tag">WEEKLY PATTERN</span> : null}
        {entry.isOverride ? <span className="tag tag--muted">EDITED FOR THIS DAY ONLY</span> : null}
        {entry.spanPart === 1 ? <span className="tag tag--muted">CONTINUES FROM PREVIOUS DAY</span> : null}
        {entry.kind === "careCoverage" ? (
          <div className="entry-card__handover" data-incomplete={handoverIncomplete}>
            <span>
              Drop-off · {entry.handoverInName ?? "Not assigned"} · {formatMinute(entry.startMinute)}
            </span>
            <span>
              Collect · {entry.handoverOutName ?? "Not assigned"} ·{" "}
              {entry.collectByMinute === null ? "Time missing" : formatMinute(entry.collectByMinute)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="entry-card__menu">
        <button
          type="button"
          className="icon-button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Actions for ${entry.title}`}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <Icon name="ellipsis" strokeWidth={2.6} />
        </button>
        {menuOpen ? (
          <div className="menu" role="menu" onClick={(event) => event.stopPropagation()}>
            {entry.spanPart !== 1 ? (
              <button type="button" role="menuitem" onClick={() => (setMenuOpen(false), onEdit())}>
                {entry.patternId ? "Edit only this day" : "Edit"}
              </button>
            ) : null}
            {entry.patternId && entry.spanPart !== 1 ? (
              <button type="button" role="menuitem" onClick={() => (setMenuOpen(false), onEditPattern())}>
                Edit the weekly pattern
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              data-destructive="true"
              onClick={() => (setMenuOpen(false), onDelete())}
            >
              {entry.generatedFromPattern ? "Skip only this day" : "Delete"}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function DeleteDialog({ entry, onSkip, onDeletePattern, onDelete, onCancel }) {
  const fromPattern = Boolean(entry.patternId);
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Delete this schedule entry?">
      <div className="sheet">
        <span className="sheet__grabber" aria-hidden="true" />
        <div className="sheet__body">
          <Eyebrow>Delete this entry</Eyebrow>
          <h3 className="screen__section-title">{entry.title}</h3>
          <p className="screen__lede">
            {fromPattern
              ? "Choose whether to skip this date only or remove the complete weekly pattern. Single-day changes are kept when the pattern is removed."
              : "This removes the selected schedule entry."}
          </p>
        </div>
        <div className="sheet__footer">
          {fromPattern ? (
            <>
              <Button variant="danger" onClick={onSkip}>
                Skip only this day
              </Button>
              <Button variant="secondary" onClick={onDeletePattern}>
                Delete the weekly pattern
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Schedule({ onOpenDay }) {
  const { state, dispatch } = useStore();
  const today = localDateAt();
  const [windowStart, setWindowStart] = useState(today);
  const [selected, setSelected] = useState(today);
  const [editor, setEditor] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const schedule = useMemo(() => buildSchedule(state, { horizonStart: windowStart }), [state, windowStart]);
  const day = schedule.days.find((item) => item.dateLocal === selected) ?? schedule.days[0];

  const moveWindow = (days) => {
    const next = addDays(windowStart, days);
    setWindowStart(next);
    setSelected(next);
  };

  const handoverWarning = (() => {
    if (!day) return null;
    const coverages = day.entries.filter((entry) => entry.kind === "careCoverage");
    if (coverages.length === 0) return null;
    if (coverages.some((entry) => entry.collectByMinute === null || !entry.handoverInRef || !entry.handoverOutRef)) {
      return "Handover gap not calculated: add the provider’s collection deadline and choose who handles drop-off and collection.";
    }
    const { travel_home_care_min: home, travel_care_work_min: care, travel_home_work_min: work } = state.profile;
    if (![home, care, work].every(Number.isInteger)) {
      return "Handover gap not calculated: enter home ↔ care, care ↔ work and home ↔ work travel minutes in Me.";
    }
    return null;
  })();

  const openEditor = (draft) => setEditor(draft);

  const beginAdd = () =>
    openEditor({
      mode: "create",
      dateLocal: selected,
      childId: state.children[0]?.id ?? null,
      weekdays: [weekdayOf(selected)]
    });

  return (
    <div className="app">
      <div className="navbar">
        <span className="navbar__action navbar__action--ghost" />
        <span className="navbar__title">Schedule</span>
        <button
          type="button"
          className="navbar__action"
          onClick={beginAdd}
          disabled={state.children.length === 0 && false}
          aria-label="Add schedule entry"
        >
          <Icon name="plus" size={20} strokeWidth={2.2} />
        </button>
      </div>

      <div className="screen">
        <div className="screen__inner">
          <div className="window-nav">
            <button type="button" className="icon-button" onClick={() => moveWindow(-HORIZON_DAYS)} aria-label="Previous fourteen days">
              <Icon name="chevronLeft" />
            </button>
            <span className="window-nav__label">
              <Eyebrow>Fourteen-day plan</Eyebrow>
              <span className="window-nav__range">
                {formatShortDate(windowStart)} — {formatShortDate(addDays(windowStart, HORIZON_DAYS - 1))}
              </span>
            </span>
            <button type="button" className="icon-button" onClick={() => moveWindow(HORIZON_DAYS)} aria-label="Next fourteen days">
              <Icon name="chevronRight" />
            </button>
          </div>

          <div className="day-grid" role="group" aria-label="Choose a day">
            {schedule.days.map((item) => (
              <button
                key={item.dateLocal}
                type="button"
                className={`day-cell state-${item.summary.state}`}
                aria-pressed={item.dateLocal === selected}
                data-today={item.dateLocal === today}
                aria-label={`${formatLongDate(item.dateLocal)} · ${item.conflicts.length > 0 ? item.summary.state : "no conflict"}`}
                onClick={() => setSelected(item.dateLocal)}
              >
                <span>{WEEKDAY_NAMES[weekdayOf(item.dateLocal)].initial}</span>
                <span className="day-cell__date">{toDate(item.dateLocal).getDate()}</span>
                <span
                  className="day-cell__dot"
                  style={item.conflicts.length === 0 ? { background: "transparent" } : undefined}
                />
              </button>
            ))}
          </div>

          <div className="legend">
            <span>
              <i className="dot" style={{ background: "var(--blue)" }} /> Work
            </span>
            <span>
              <i className="dot" style={{ background: "var(--amber)" }} /> Care needed
            </span>
            <span>
              <i className="dot" style={{ background: "var(--teal)" }} /> Coverage
            </span>
          </div>

          {day ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <Eyebrow>{formatLongDate(day.dateLocal)}</Eyebrow>
                {day.hasScheduleData ? <StatusBadge state={day.summary.state} /> : null}
              </div>

              {day.entries.length === 0 ? (
                <Card>
                  <p className="row__title" style={{ marginBottom: "6px" }}>
                    No schedule data
                  </p>
                  <p className="screen__lede" style={{ fontSize: "12.5px" }}>
                    No work, required-care or coverage records exist for this day. EqualPath is not
                    claiming the day is covered.
                  </p>
                </Card>
              ) : (
                <div className="stack">
                  {day.entries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      onEdit={() => openEditor({ mode: "edit", entry })}
                      onEditPattern={() => openEditor({ mode: "pattern", entry })}
                      onDelete={() => setPendingDelete(entry)}
                    />
                  ))}
                </div>
              )}

              {day.hasRequiredCare ? (
                day.careGaps.length === 0 ? (
                  <Note>Required care is fully covered once overlapping coverage records are merged.</Note>
                ) : (
                  <Card>
                    <SectionLabel tone="alert">Uncovered care</SectionLabel>
                    {day.careGaps.map((gap) => (
                      <div className="gap-row" key={gap.id}>
                        <span className="row__body">
                          <span className="row__title">{gap.childName}</span>
                          <span className="row__subtitle">
                            {formatMinute(gap.startMinute)} — {formatMinute(gap.endMinute)}
                          </span>
                        </span>
                        <span className="gap-row__duration">{hourLabel(gap.endMinute - gap.startMinute)}</span>
                      </div>
                    ))}
                    <p className="screen__footnote" style={{ marginTop: "8px" }}>
                      Overlapping coverage is merged before these remaining periods are calculated.
                    </p>
                  </Card>
                )
              ) : null}

              {handoverWarning ? <Note tone="alert">{handoverWarning}</Note> : null}

              {day.conflicts.length === 0 ? (
                day.entries.length > 0 && !handoverWarning ? (
                  <Note>No care–work conflict was detected from the records shown for this day.</Note>
                ) : null
              ) : (
                day.conflicts.map((conflict) => <ConflictCard key={conflict.rowId} conflict={conflict} />)
              )}

              {day.hasScheduleData ? (
                <Button variant="secondary" trailingIcon="arrowRight" onClick={() => onOpenDay(day.dateLocal)}>
                  See the day
                </Button>
              ) : null}
            </>
          ) : null}

          <Button variant="dashed" icon="plus" onClick={beginAdd}>
            Add a schedule entry
          </Button>
        </div>
      </div>

      {editor ? (
        <EntryEditor
          request={editor}
          windowStart={windowStart}
          onClose={() => setEditor(null)}
          onSave={(draft) => {
            dispatch({ type: "save-entry", draft });
            setEditor(null);
            setSelected(draft.repeatWeekly ? selected : draft.dateLocal);
          }}
        />
      ) : null}

      {pendingDelete ? (
        <DeleteDialog
          entry={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onDelete={() => {
            dispatch({ type: "delete-occurrence", entry: pendingDelete });
            setPendingDelete(null);
          }}
          onSkip={() => {
            dispatch({ type: "delete-occurrence", entry: pendingDelete });
            setPendingDelete(null);
          }}
          onDeletePattern={() => {
            dispatch({ type: "delete-pattern", patternId: pendingDelete.patternId });
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}

export { OWNER_ID };
