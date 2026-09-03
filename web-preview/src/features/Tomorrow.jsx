import Icon from "../components/Icon.jsx";
import {
  Button,
  Card,
  CoverageRing,
  Eyebrow,
  Note,
  SourceRow,
  StatusBadge,
  STATE_ICON
} from "../components/primitives.jsx";
import { sourceIcon } from "./onboarding/SetupFlow.jsx";
import { formatClock, formatLongDate, formatRange } from "../domain/dates.js";
import { COVERAGE_STATE, hourLabel, tomorrowSnapshot } from "../store/derive.js";
import { useStore } from "../store/context.jsx";

export default function Tomorrow({ onOpenDay, onOpenSchedule }) {
  const { state } = useStore();
  const snapshot = tomorrowSnapshot(state);
  const { summary } = snapshot;

  const headline = !snapshot.hasScheduleData
    ? "Tomorrow has\nno schedule data"
    : summary.state === COVERAGE_STATE.noGap
      ? "Tomorrow has\nno care gap"
      : summary.state === COVERAGE_STATE.uncovered
        ? `Tomorrow needs\n${hourLabel(summary.gapMinutes)} of cover`
        : `Tomorrow has\n${hourLabel(summary.gapMinutes)} to verify`;

  const childSummary = (childState, minutes) =>
    childState === COVERAGE_STATE.noGap
      ? "No care gap found"
      : childState === COVERAGE_STATE.uncovered
        ? `${hourLabel(minutes)} needs cover`
        : `${hourLabel(minutes)} needs verification`;

  return (
    <div className="screen">
      <div className="screen__inner">
        <Eyebrow>Tonight · checked {formatClock(summary.checkedAt ?? new Date())}</Eyebrow>
        <h2 className="screen__title">{headline}</h2>
        <p className="screen__lede">{formatLongDate(snapshot.dateLocal)}</p>

        <div style={{ justifySelf: "center", display: "grid", justifyItems: "center", gap: "12px", padding: "8px 0" }}>
          {snapshot.hasScheduleData ? (
            <CoverageRing summary={summary} />
          ) : (
            <div className="centered">
              <Icon name="calendar" size={54} strokeWidth={1.1} />
              <span className="ring__sweep">No schedule records for this date</span>
            </div>
          )}
          {summary.endMinute > summary.startMinute ? (
            <p className="ring__range">{formatRange(summary.startMinute, summary.endMinute)}</p>
          ) : null}
          <p className="ring__sweep">
            {snapshot.hasScheduleData ? "Recalculated from your records" : "Waiting for schedule records"}
          </p>
        </div>

        {snapshot.sources.length > 0 ? (
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <StatusBadge state={summary.state} />
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                {snapshot.featuredChildName ?? "Tomorrow"}
              </span>
            </div>
            {snapshot.sources.map((source) => (
              <SourceRow key={source.id} icon={sourceIcon(source.icon)} title={source.title} detail={source.detail} />
            ))}
          </Card>
        ) : null}

        {snapshot.hasScheduleData ? (
          <Button trailingIcon="arrowRight" onClick={() => onOpenDay(snapshot.dateLocal)}>
            See the day
          </Button>
        ) : null}

        {state.children.length === 0 ? (
          <Note>No children are recorded yet. Add one in Me, then enter their care hours in Schedule.</Note>
        ) : !snapshot.hasScheduleData ? (
          <>
            <Note>
              No work, required-care or coverage records exist for tomorrow. EqualPath is not claiming
              the day is covered; add the missing records in Schedule.
            </Note>
            <Button variant="secondary" icon="calendar" onClick={onOpenSchedule}>
              Open Schedule
            </Button>
          </>
        ) : (
          <div className="card card--flush">
            {snapshot.children.map((child, index) => (
              <div className="row" key={child.id} style={index === 0 ? { borderTop: "none" } : undefined}>
                <span className={`row__icon ${`state-${child.summary.state}`}`} style={{ "--accent": "var(--state-text)" }}>
                  <Icon name={STATE_ICON[child.summary.state]} size={16} />
                </span>
                <span className="row__body">
                  <span className="row__title">{child.name}</span>
                  <span className="row__subtitle">{childSummary(child.summary.state, child.summary.gapMinutes)}</span>
                </span>
                <span className="row__trailing">
                  <StatusBadge state={child.summary.state} />
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="screen__footnote">
          Every number above comes from the records that produced it. Unknown time is kept separate
          from uncovered time: EqualPath will not call a day covered because evidence is missing.
        </p>
      </div>
    </div>
  );
}
