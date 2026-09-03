import { useState } from "react";

import Icon from "../components/Icon.jsx";
import { Button, Card, Eyebrow, Note } from "../components/primitives.jsx";
import { formatMinute, localDateAt, addDays } from "../domain/dates.js";
import { buildSchedule, hourLabel } from "../store/derive.js";
import { useStore } from "../store/context.jsx";

// Iteration 1 does not generate plans — the CP-SAT planner arrives with the
// later epics. What this screen shows is the shape of the review step, built
// from the user's own first conflict and their own support circle, and labelled
// as a draft throughout. Nothing here can contact anyone.
function draftPaths(conflict, carer) {
  if (!conflict) return [];
  const window = `${formatMinute(conflict.start_minute)} — ${formatMinute(conflict.end_minute)}`;
  const paths = [];

  if (carer) {
    paths.push({
      id: "carer",
      title: `${carer.name} covers the gap`,
      subtitle: "Support circle · one request",
      accent: "var(--orange)",
      icon: "people",
      steps: [
        `${carer.name} would cover ${window}`,
        `You collect from ${carer.name} after work`,
        "Nothing is sent until you approve a request"
      ]
    });
  }

  paths.push({
    id: "work",
    title: "Move the flexible block",
    subtitle: "Work change · no request to anyone",
    accent: "var(--blue)",
    icon: "flexible",
    steps: [
      `Free up ${hourLabel(conflict.duration_minutes)} before ${formatMinute(conflict.end_minute)}`,
      "Leave in time for the collection deadline",
      "No carer is contacted"
    ]
  });

  return paths;
}

export default function Plans({ onBack }) {
  const { state } = useStore();
  const [reviewing, setReviewing] = useState(null);
  const today = localDateAt();
  const schedule = buildSchedule(state, { horizonStart: today });
  const firstConflictDay = schedule.days.find((day) => day.conflicts.some((item) => item.state === "uncovered"));
  const conflict = firstConflictDay?.conflicts.find((item) => item.state === "uncovered");
  const carer = state.supportNetwork.find((person) => !person.isOwner);
  const paths = draftPaths(conflict, carer);

  return (
    <div className="app">
      <div className="navbar">
        <button type="button" className="navbar__action" onClick={onBack}>
          <Icon name="chevronLeft" size={20} />
          <span className="sr-only">Back</span>
        </button>
        <span className="navbar__title">Possible paths</span>
        <span className="navbar__action navbar__action--ghost" />
      </div>

      <div className="screen">
        <div className="screen__inner">
          <Eyebrow>Drafts only</Eyebrow>
          <h2 className="screen__title">
            {paths.length === 0 ? "No gap to plan around" : `${paths.length === 1 ? "One" : "Two"} possible paths`}
          </h2>
          <p className="screen__lede">
            {paths.length === 0
              ? "EqualPath found no uncovered time in the next fourteen days, so there is nothing to plan around yet."
              : "These are sketches based on the people and flexibility you recorded. EqualPath will never contact anyone."}
          </p>

          {conflict ? (
            <Card>
              <p className="row__title">
                {conflict.child_name} · {formatMinute(conflict.start_minute)} — {formatMinute(conflict.end_minute)}
              </p>
              <p className="row__subtitle">
                {firstConflictDay.dateLocal === addDays(today, 1) ? "Tomorrow" : firstConflictDay.dateLocal} ·{" "}
                {hourLabel(conflict.duration_minutes)} uncovered
              </p>
            </Card>
          ) : null}

          {paths.map((path) => (
            <article className="plan-card" key={path.id} style={{ "--accent": path.accent }}>
              <header className="plan-card__head">
                <span className="row__icon" style={{ "--accent": path.accent, width: "40px", height: "40px" }}>
                  <Icon name={path.icon} />
                </span>
                <span className="row__body">
                  <span className="screen__section-title" style={{ fontSize: "21px" }}>
                    {path.title}
                  </span>
                  <span className="row__subtitle">{path.subtitle}</span>
                </span>
              </header>
              <ul className="plan-card__steps">
                {path.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <Button variant="secondary" onClick={() => setReviewing(path)}>
                Review this path
              </Button>
            </article>
          ))}

          <Note>
            Plan generation, sending and carer confirmation are later-iteration services. This screen
            shows the review step without claiming a request has been made.
          </Note>
        </div>
      </div>

      {reviewing ? (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={reviewing.title}>
          <div className="sheet">
            <span className="sheet__grabber" aria-hidden="true" />
            <div className="sheet__body">
              <Eyebrow>Review only</Eyebrow>
              <h3 className="screen__title" style={{ fontSize: "28px" }}>
                {reviewing.title}
              </h3>
              <ul className="plan-card__steps" style={{ "--accent": reviewing.accent }}>
                {reviewing.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <Note>
                Sending and confirmation are not enabled in this iteration, so this review cannot
                contact anyone.
              </Note>
            </div>
            <div className="sheet__footer">
              <Button onClick={() => setReviewing(null)}>Done</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
