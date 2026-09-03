import { useCallback, useEffect, useRef, useState } from "react";

import Icon from "../../components/Icon.jsx";
import {
  Button,
  Card,
  CoverageRing,
  Eyebrow,
  Field,
  Note,
  ProgressRail,
  SectionLabel,
  SourceRow,
  Stepper,
  TimeInput,
  Toggle
} from "../../components/primitives.jsx";
import { WEEKDAY_NAMES, WEEKDAY_ORDER, formatRange } from "../../domain/dates.js";
import { AGE_GROUPS, emptyDraft } from "../../store/schema.js";
import { hourLabel, tomorrowSnapshot } from "../../store/derive.js";
import { useStore } from "../../store/context.jsx";

const TOTAL_STEPS = 8;

function toggleDay(days, day) {
  const next = days.includes(day) ? days.filter((value) => value !== day) : [...days, day];
  return next.sort((left, right) => WEEKDAY_ORDER.indexOf(left) - WEEKDAY_ORDER.indexOf(right));
}

function daySummary(days) {
  if (days.length === 0) return "Choose days";
  const ordered = [...days].sort((left, right) => WEEKDAY_ORDER.indexOf(left) - WEEKDAY_ORDER.indexOf(right));
  if (ordered.length === 1) return WEEKDAY_NAMES[ordered[0]].full;
  const indexes = ordered.map((day) => WEEKDAY_ORDER.indexOf(day));
  const contiguous = indexes.every((value, position) => position === 0 || value === indexes[position - 1] + 1);
  if (contiguous) {
    const first = WEEKDAY_NAMES[ordered[0]];
    const last = WEEKDAY_NAMES[ordered.at(-1)];
    return ordered.length > 2 ? `${first.full} – ${last.full}` : `${first.short} – ${last.short}`;
  }
  return ordered.map((day) => WEEKDAY_NAMES[day].short).join(", ");
}

function WeekdayPicker({ value, onChange, label }) {
  return (
    <div className="weekday-row" role="group" aria-label={label}>
      {WEEKDAY_ORDER.map((day) => (
        <button
          key={day}
          type="button"
          className="weekday"
          aria-pressed={value.includes(day)}
          aria-label={WEEKDAY_NAMES[day].full}
          onClick={() => onChange(toggleDay(value, day))}
        >
          {WEEKDAY_NAMES[day].initial}
        </button>
      ))}
    </div>
  );
}

function SetupPage({ eyebrow, title, subtitle, children }) {
  return (
    <div className="screen">
      <div className="screen__inner">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="screen__title">{title}</h2>
        <p className="screen__lede">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function TravelRow({ label, hint, value, onChange }) {
  return (
    <div className="inline">
      <span className="inline__label">
        <span className="row__icon">
          <Icon name="car" size={15} />
        </span>
        <span className="row__body">
          <span className="row__title">{label}</span>
          <span className="row__subtitle">{hint}</span>
        </span>
      </span>
      <Stepper value={value} onChange={onChange} label={label} />
    </div>
  );
}

export default function SetupFlow() {
  const { state, dispatch } = useStore();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => emptyDraft());
  const [error, setError] = useState(null);
  const patch = (changes) => setDraft((current) => ({ ...current, ...changes }));

  const validate = () => {
    if (step === 0 && draft.name.trim().length === 0) return "Enter the name your support circle should recognise.";
    if (step === 1 && (draft.children.length === 0 || draft.children.some((child) => child.name.trim().length === 0)))
      return "Enter a name for every child, or remove the empty child row.";
    if (step === 2 && draft.providerName.trim().length === 0) return "Enter the provider or carer covering these hours.";
    if (step === 2 && draft.careDays.length === 0) return "Select at least one registered-care day.";
    if (step === 2 && draft.careEndMinute <= draft.careStartMinute) return "Registered care must end after it starts.";
    if (step === 3 && draft.officeDays.length === 0 && draft.homeWorkDays.length === 0) return "Select at least one work day.";
    if (
      step === 3 &&
      ((draft.officeDays.length > 0 && draft.officeEndMinute <= draft.officeStartMinute) ||
        (draft.homeWorkDays.length > 0 && draft.homeWorkEndMinute <= draft.homeWorkStartMinute))
    )
      return "Each work period must end after it starts.";
    if (step === 3 && draft.workArea.trim().length === 0) return "Enter a work area.";
    if (step === 5 && (draft.homeArea.trim().length === 0 || draft.workArea.trim().length === 0))
      return "Enter both broad areas; exact addresses are not required.";
    return null;
  };

  const finishSweep = useCallback(() => setStep(8), []);

  const advance = () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, 7));
  };

  if (step === 7) return <Sweep draft={draft} dispatch={dispatch} onDone={finishSweep} />;
  if (step >= 8) return <FirstResultScreen state={state} dispatch={dispatch} />;

  return (
    <div className="app">
      <div className="navbar">
        <button
          type="button"
          className={`navbar__action ${step === 0 ? "navbar__action--ghost" : ""}`}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0}
        >
          <Icon name="chevronLeft" size={20} />
          <span className="sr-only">Back</span>
        </button>
        <span className="navbar__title">Set up EqualPath</span>
        <button type="button" className="navbar__action" onClick={advance}>
          Next
        </button>
      </div>

      <ProgressRail current={step} total={TOTAL_STEPS} />

      {step === 0 ? (
        <SetupPage
          eyebrow="1 · About you"
          title={"What should carers\ncall you?"}
          subtitle="Use the name people in your support circle will recognise."
        >
          <Field
            id="setup-name"
            label="Your name"
            placeholder="Aina"
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
          <Field
            id="setup-email"
            label="Email (optional)"
            placeholder="you@example.com"
            type="email"
            value={draft.email}
            onChange={(event) => patch({ email: event.target.value })}
            hint="Shown on your own profile only. It is never sent anywhere."
          />
          <Note>
            Carers see only this name. The iOS build takes it from your Google account; here you type
            it, and it stays in this browser.
          </Note>
        </SetupPage>
      ) : null}

      {step === 1 ? (
        <SetupPage
          eyebrow="2 · Family"
          title="Your children"
          subtitle="Add each child once. EqualPath keeps a separate coverage result for every child."
        >
          {draft.children.map((child, index) => (
            <div className="child-editor" key={index}>
              <div className="child-editor__head">
                <input
                  className="field__control"
                  aria-label={`Child ${index + 1} name`}
                  placeholder="Child’s name"
                  value={child.name}
                  onChange={(event) =>
                    patch({
                      children: draft.children.map((item, position) =>
                        position === index ? { ...item, name: event.target.value } : item
                      )
                    })
                  }
                />
                {draft.children.length > 1 ? (
                  <button
                    type="button"
                    className="link-button link-button--danger"
                    onClick={() => patch({ children: draft.children.filter((_, position) => position !== index) })}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="segmented" role="group" aria-label={`Age group for child ${index + 1}`}>
                {AGE_GROUPS.map((group) => (
                  <button
                    key={group}
                    type="button"
                    aria-pressed={child.ageGroup === group}
                    onClick={() =>
                      patch({
                        children: draft.children.map((item, position) =>
                          position === index ? { ...item, ageGroup: group } : item
                        )
                      })
                    }
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Button
            variant="dashed"
            icon="plus"
            onClick={() => patch({ children: [...draft.children, { name: "", ageGroup: "5-12" }] })}
          >
            Add another child
          </Button>
        </SetupPage>
      ) : null}

      {step === 2 ? (
        <SetupPage
          eyebrow="3 · Registered care"
          title="Care hours"
          subtitle="Start with the hours your provider has registered for a normal week."
        >
          <Field
            id="setup-provider"
            label="Provider"
            placeholder="TASKA Seri Kasih"
            value={draft.providerName}
            onChange={(event) => patch({ providerName: event.target.value })}
          />
          <Card>
            <TimeInput label="Opens" minute={draft.careStartMinute} onChange={(value) => patch({ careStartMinute: value })} />
            <TimeInput label="Collection by" minute={draft.careEndMinute} onChange={(value) => patch({ careEndMinute: value })} />
          </Card>
          <div className="stack">
            <SectionLabel>How that week looks</SectionLabel>
            <div className="week-preview">
              {WEEKDAY_ORDER.map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={draft.careDays.includes(day)}
                  aria-label={WEEKDAY_NAMES[day].full}
                  onClick={() => patch({ careDays: toggleDay(draft.careDays, day) })}
                >
                  {WEEKDAY_NAMES[day].initial}
                  <span className="week-preview__bar" style={{ "--accent": "var(--teal)" }}>
                    {draft.careDays.includes(day) ? <Icon name="check" size={14} strokeWidth={2.6} /> : null}
                  </span>
                </button>
              ))}
            </div>
            <p className="screen__footnote">
              {daySummary(draft.careDays)} · {formatRange(draft.careStartMinute, draft.careEndMinute)}
            </p>
          </div>
          <Note>
            A public-holiday closure is uncovered, not unknown. EqualPath always names the source
            behind that result.
          </Note>
        </SetupPage>
      ) : null}

      {step === 3 ? (
        <SetupPage
          eyebrow="4 · Work"
          title="Your work week"
          subtitle="EqualPath compares these commitments with every child’s care hours."
        >
          <div className="stack">
            <SectionLabel>Office days · {daySummary(draft.officeDays)}</SectionLabel>
            <WeekdayPicker value={draft.officeDays} onChange={(days) => patch({ officeDays: days })} label="Office days" />
            <Card>
              <TimeInput label="Starts" minute={draft.officeStartMinute} onChange={(value) => patch({ officeStartMinute: value })} />
              <TimeInput label="Ends" minute={draft.officeEndMinute} onChange={(value) => patch({ officeEndMinute: value })} />
            </Card>
          </div>
          <div className="stack">
            <SectionLabel>Work-from-home days · {daySummary(draft.homeWorkDays)}</SectionLabel>
            <WeekdayPicker
              value={draft.homeWorkDays}
              onChange={(days) => patch({ homeWorkDays: days })}
              label="Work-from-home days"
            />
            <Card>
              <TimeInput
                label="Starts"
                minute={draft.homeWorkStartMinute}
                onChange={(value) => patch({ homeWorkStartMinute: value })}
              />
              <TimeInput label="Ends" minute={draft.homeWorkEndMinute} onChange={(value) => patch({ homeWorkEndMinute: value })} />
            </Card>
          </div>
          <Field
            id="setup-work-area"
            label="Work area"
            placeholder="KL Sentral"
            value={draft.workArea}
            onChange={(event) => patch({ workArea: event.target.value })}
          />
          <Note>
            Travel is counted on both ends. Otherwise a 16:00 collection after a 15:30 finish could
            look possible when it is not.
          </Note>
        </SetupPage>
      ) : null}

      {step === 4 ? (
        <SetupPage
          eyebrow="5 · Alerts"
          title="Know the night before"
          subtitle="The iOS build schedules a 21:00 reminder on the phone for the next fourteen days."
        >
          <Card>
            <Toggle
              label="Tomorrow’s care gap · 21:00"
              description="Recorded as a preference in this browser"
              checked={draft.notificationEnabled}
              onChange={(value) => patch({ notificationEnabled: value })}
            />
          </Card>
          <Note>
            A web page cannot wake itself up at 21:00, so this build does not pretend to send a
            reminder. The preference is stored and the Tonight screen shows the same result the
            reminder would have carried.
          </Note>
        </SetupPage>
      ) : null}

      {step === 5 ? (
        <SetupPage
          eyebrow="6 · Travel"
          title="Areas, not addresses"
          subtitle="EqualPath uses broad home and work areas to judge whether a collection is physically possible."
        >
          <Field
            id="setup-home-area"
            label="Home area"
            placeholder="Ampang"
            value={draft.homeArea}
            onChange={(event) => patch({ homeArea: event.target.value })}
          />
          <Field
            id="setup-work-area-2"
            label="Work area"
            placeholder="KL Sentral"
            value={draft.workArea}
            onChange={(event) => patch({ workArea: event.target.value })}
          />
          <Card>
            <TravelRow
              label="Home ↔ care"
              hint="Used when a home-based day is followed by collection"
              value={draft.travelHomeCareMinutes}
              onChange={(value) => patch({ travelHomeCareMinutes: value })}
            />
            <TravelRow
              label="Care ↔ work"
              hint="Used between the provider and an office commitment"
              value={draft.travelCareWorkMinutes}
              onChange={(value) => patch({ travelCareWorkMinutes: value })}
            />
            <TravelRow
              label="Home ↔ work"
              hint="Stored for complete journey planning"
              value={draft.travelHomeWorkMinutes}
              onChange={(value) => patch({ travelHomeWorkMinutes: value })}
            />
          </Card>
          <Note>
            No live tracking and no map service. These three estimates are typed by you and let
            EqualPath calculate both the morning drop-off and the evening collection.
          </Note>
        </SetupPage>
      ) : null}

      {step === 6 ? (
        <SetupPage
          eyebrow="7 · Support"
          title="People you trust"
          subtitle="Adding carers helps EqualPath suggest a path when a gap opens. Nothing is sent without your approval."
        >
          {draft.carers.map((carer, index) => (
            <Field
              key={index}
              id={`setup-carer-${index}`}
              label={`Carer ${index + 1}`}
              placeholder="Name"
              value={carer}
              onChange={(event) =>
                patch({ carers: draft.carers.map((item, position) => (position === index ? event.target.value : item)) })
              }
            />
          ))}
          <Button variant="secondary" icon="plus" onClick={() => patch({ carers: [...draft.carers, ""] })}>
            Add another carer
          </Button>
          <Note>
            Skipping this still finds gaps. It only means EqualPath cannot suggest someone from your
            support circle yet.
          </Note>
        </SetupPage>
      ) : null}

      {error ? (
        <div style={{ padding: "0 22px 14px" }}>
          <Note tone="alert">{error}</Note>
        </div>
      ) : null}

      <div className="sheet__footer">
        <Button trailingIcon="arrowRight" onClick={advance}>
          {step === 6 ? "Run the first sweep" : "Continue"}
        </Button>
      </div>
    </div>
  );

}

const SWEEP_STEPS = [
  { label: "Reading registered care", at: 0.2 },
  { label: "Placing work and travel", at: 0.45 },
  { label: "Keeping unknown time separate", at: 0.7 },
  { label: "Finding tomorrow’s gaps", at: 1 }
];

function Sweep({ draft, onDone, dispatch }) {
  const [progress, setProgress] = useState(0.04);
  const finish = useRef(onDone);
  finish.current = onDone;

  useEffect(() => {
    // The rows are built synchronously; the staged progress exists so the four
    // steps of the sweep are legible rather than to imitate a slow server.
    const stages = [
      window.setTimeout(() => setProgress(0.35), 220),
      window.setTimeout(() => setProgress(0.62), 620),
      window.setTimeout(() => setProgress(0.86), 1000),
      window.setTimeout(() => {
        setProgress(1);
        dispatch({ type: "complete-setup", draft });
      }, 1340),
      window.setTimeout(() => finish.current(), 1800)
    ];
    return () => stages.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <div className="sweep">
        <div className="ring__figure" style={{ "--ring-size": "170px" }}>
          <svg viewBox="0 0 170 170" aria-hidden="true">
            <circle className="ring__track" cx="85" cy="85" r="76" style={{ strokeWidth: 8 }} />
            <circle
              className="ring__value"
              cx="85"
              cy="85"
              r="76"
              style={{
                stroke: "var(--gold)",
                strokeWidth: 8,
                strokeDasharray: 2 * Math.PI * 76,
                strokeDashoffset: 2 * Math.PI * 76 * (1 - progress)
              }}
            />
          </svg>
          <div className="ring__label">
            <span className="sweep__percent">{Math.round(progress * 100)}%</span>
          </div>
        </div>
        <div>
          <Eyebrow>Setting up</Eyebrow>
          <h2 className="screen__title" style={{ textAlign: "center", marginTop: "10px" }}>
            {"Reading the next\nfourteen days"}
          </h2>
          <p className="screen__lede" style={{ textAlign: "center" }}>
            Comparing each child’s care hours against your work week, day by day.
          </p>
        </div>
        <div className="sweep__steps">
          {SWEEP_STEPS.map((item) => (
            <div className="sweep__step" key={item.label} data-done={progress >= item.at}>
              <span className="sweep__dot" />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FirstResultScreen({ state, dispatch }) {
  const snapshot = tomorrowSnapshot(state);
  const child = snapshot.featuredChildName ?? "Your family";
  const title =
    snapshot.summary.state === "covered"
      ? "Setup found no\ngap tomorrow"
      : snapshot.summary.state === "uncovered"
        ? "Setup found a\ncare gap tomorrow"
        : "Setup found time\nto verify tomorrow";
  const detail =
    snapshot.summary.state === "covered"
      ? `${child}’s registered care covers the work commitments you entered.`
      : snapshot.summary.state === "uncovered"
        ? `${child} needs ${hourLabel(snapshot.summary.gapMinutes)} of cover based on tomorrow’s care and work records.`
        : `${child} has ${hourLabel(snapshot.summary.gapMinutes)} that could not be verified from tomorrow’s records.`;

  return (
    <div className="app">
      <div className="screen">
        <div className="screen__inner">
          <Eyebrow state={snapshot.summary.state}>First sweep · your records</Eyebrow>
          <h2 className="screen__title">{title}</h2>
          <p className="screen__lede">{detail}</p>
          <div style={{ justifySelf: "center" }}>
            <CoverageRing summary={snapshot.summary} size={190} />
          </div>
          {snapshot.sources.length > 0 ? (
            <Card>
              {snapshot.sources.map((source) => (
                <SourceRow key={source.id} icon={sourceIcon(source.icon)} title={source.title} detail={source.detail} />
              ))}
            </Card>
          ) : null}
          <Button trailingIcon="arrowRight" onClick={() => dispatch({ type: "enter-main" })}>
            Open tomorrow
          </Button>
          <p className="screen__footnote" style={{ textAlign: "center" }}>
            This result is recalculated from your records every time the app opens, and again after
            every edit.
          </p>
        </div>
      </div>
    </div>
  );
}

export function sourceIcon(kind) {
  if (kind === "provider") return "building";
  if (kind === "work") return "briefcase";
  if (kind === "travel") return "car";
  return "clock";
}
