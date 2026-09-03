// React equivalents of equalpath/EqualPath/Core/Components.swift.

import Icon from "./Icon.jsx";
import { formatMinute } from "../domain/dates.js";
import { COVERAGE_STATE, STATE_LABEL, hourLabel, ringFraction } from "../store/derive.js";

export const stateClass = (state) => `state-${state}`;

export const STATE_ICON = {
  [COVERAGE_STATE.noGap]: "checkCircle",
  [COVERAGE_STATE.uncovered]: "alert",
  [COVERAGE_STATE.unknown]: "question"
};

export function Eyebrow({ children, state }) {
  return (
    <p className={`eyebrow ${state ? stateClass(state) : ""}`} style={state ? { "--eyebrow-color": "var(--state-text)" } : undefined}>
      {children}
    </p>
  );
}

export function SectionLabel({ children, tone }) {
  return (
    <p className="section-label" style={tone === "alert" ? { color: "var(--rose-text)" } : undefined}>
      {children}
    </p>
  );
}

export function Card({ children, className = "", ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Note({ children, tone = "default" }) {
  return <p className={`note ${tone === "alert" ? "note--alert" : ""}`}>{children}</p>;
}

export function Button({ variant = "primary", icon, trailingIcon, children, className = "", ...rest }) {
  const variantClass =
    variant === "secondary"
      ? "btn btn--secondary"
      : variant === "dashed"
        ? "btn btn--dashed"
        : variant === "danger"
          ? "btn btn--danger"
          : "btn";
  return (
    <button type="button" className={`${variantClass} ${className}`} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
      {trailingIcon ? <Icon name={trailingIcon} /> : null}
    </button>
  );
}

export function StatusBadge({ state }) {
  return (
    <span className={`badge ${stateClass(state)}`}>
      <Icon name={STATE_ICON[state]} size={14} />
      {STATE_LABEL[state]}
    </span>
  );
}

// The ring shows uncovered (or unverified) time as a fraction of the day it was
// measured against. A stale result is drawn in a muted colour and says so,
// rather than being presented as current.
export function CoverageRing({ summary, size = 220, stale = false }) {
  const radius = (size - 18) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = ringFraction(summary);
  return (
    <div className={`ring__figure ${stateClass(summary.state)}`} style={{ "--ring-size": `${size}px` }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${hourLabel(summary.gapMinutes)}, ${STATE_LABEL[summary.state].toLowerCase()}`}>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: circumference * (1 - fraction),
            stroke: stale ? "#6e5a38" : undefined
          }}
        />
      </svg>
      <div className="ring__label">
        <span className="ring__hours">{hourLabel(summary.gapMinutes)}</span>
        <span className="ring__state" style={stale ? { color: "#a68a55" } : undefined}>
          {stale ? "LAST SWEEP" : STATE_LABEL[summary.state]}
        </span>
      </div>
    </div>
  );
}

export function SourceRow({ icon, title, detail }) {
  return (
    <div className="row">
      <span className="row__icon">
        <Icon name={icon} />
      </span>
      <span className="row__body">
        <span className="row__title">{title}</span>
        <span className="row__subtitle">{detail}</span>
      </span>
    </div>
  );
}

export function Field({ label, hint, id, ...rest }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <input id={id} className="field__control" {...rest} />
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export function TimeInput({ label, minute, onChange, id }) {
  return (
    <div className="inline">
      <span className="inline__label">{label}</span>
      <input
        id={id}
        type="time"
        className="time-input"
        value={formatMinute(minute)}
        step={300}
        onChange={(event) => {
          const [hours, minutes] = event.target.value.split(":").map(Number);
          if (Number.isFinite(hours) && Number.isFinite(minutes)) onChange(hours * 60 + minutes);
        }}
      />
    </div>
  );
}

export function Toggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <button type="button" className="toggle" aria-pressed={checked} disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="toggle__switch" aria-hidden="true" />
      <span className="row__body">
        <span className="row__title">{label}</span>
        {description ? <span className="row__subtitle">{description}</span> : null}
      </span>
    </button>
  );
}

export function ChoiceRow({ options, value, onChange, disabled = false }) {
  return (
    <div className="choice-row">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="choice"
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <Icon name={option.icon} size={15} /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, step = 5, min = 0, max = 360, suffix = "min", label }) {
  return (
    <span className="stepper">
      <button
        type="button"
        className="stepper__button"
        onClick={() => onChange(Math.max(min, value - step))}
        aria-label={`Decrease ${label}`}
      >
        <Icon name="minus" size={14} strokeWidth={2.2} />
      </button>
      <span className="stepper__value">
        {value} {suffix}
      </span>
      <button
        type="button"
        className="stepper__button"
        onClick={() => onChange(Math.min(max, value + step))}
        aria-label={`Increase ${label}`}
      >
        <Icon name="plus" size={14} strokeWidth={2.2} />
      </button>
    </span>
  );
}

export function ProgressRail({ current, total }) {
  return (
    <div className="progress-rail" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total} aria-label={`Setup step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} data-done={index <= current} />
      ))}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <strong style={{ color: "var(--text-primary)", fontSize: "14px" }}>{title}</strong>
      <span>{children}</span>
    </div>
  );
}
