import Icon from "../components/Icon.jsx";
import { Button, Card, Eyebrow, Note, SectionLabel } from "../components/primitives.jsx";
import ConflictCard from "./ConflictCard.jsx";
import { formatMediumDate, formatMinute } from "../domain/dates.js";
import { COVERAGE_STATE, buildSchedule, timelineFor } from "../store/derive.js";
import { localDateAt } from "../domain/dates.js";
import { useStore } from "../store/context.jsx";

const BAND = {
  careRequired: { color: "var(--amber)", label: "CARE NEEDED" },
  careCoverage: { color: "var(--teal)", label: "CARE COVERAGE" },
  work: { color: "var(--blue)", label: "WORK" },
  uncovered: { color: "var(--rose)", label: "UNCOVERED" },
  unknown: { color: "var(--unknown-text)", label: "UNKNOWN" }
};

export default function DayDetail({ dateLocal, onBack, onSeePaths }) {
  const { state } = useStore();
  const today = localDateAt();
  const horizonStart = dateLocal < today ? dateLocal : today;
  const schedule = buildSchedule(state, { horizonStart });
  const day = schedule.days.find((item) => item.dateLocal === dateLocal);
  const records = day ? timelineFor(day) : [];

  return (
    <div className="app">
      <div className="navbar">
        <button type="button" className="navbar__action" onClick={onBack}>
          <Icon name="chevronLeft" size={20} />
          <span className="sr-only">Back</span>
        </button>
        <span className="navbar__title">{formatMediumDate(dateLocal)}</span>
        <span className="navbar__action navbar__action--ghost" />
      </div>

      <div className="screen">
        <div className="screen__inner">
          <Eyebrow state={day?.summary.state}>The day · {day?.children[0]?.name ?? "Records"}</Eyebrow>
          <h2 className="screen__title">
            {!day?.hasScheduleData
              ? "No schedule data"
              : day.summary.state === COVERAGE_STATE.noGap
                ? "The day’s records"
                : "Where the gap opens"}
          </h2>
          <p className="screen__lede">
            These work, care and conflict bands are calculated from the records stored for this date.
          </p>

          <Card>
            {records.length === 0 ? (
              <div className="row">
                <span className="row__icon">
                  <Icon name="calendar" />
                </span>
                <span className="row__body">
                  <span className="row__subtitle">
                    No care, work or conflict records exist for this date.
                  </span>
                </span>
              </div>
            ) : (
              <div className="timeline">
                {records.map((record) => (
                  <div className="timeline__row" key={record.id}>
                    <span className="timeline__times">
                      <span>{formatMinute(record.startMinute)}</span>
                      <span>{formatMinute(record.endMinute)}</span>
                    </span>
                    <span className="timeline__band" style={{ "--accent": BAND[record.kind].color }} />
                    <span className="timeline__body" style={{ "--accent": BAND[record.kind].color }}>
                      <span className="row__title">{record.title}</span>
                      {record.detail ? <span className="row__subtitle">{record.detail}</span> : null}
                      <span className="timeline__kind">{BAND[record.kind].label}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {day && day.conflicts.length > 0 ? (
            <>
              <SectionLabel>Why EqualPath flagged this</SectionLabel>
              {day.conflicts.map((conflict) => (
                <ConflictCard key={conflict.rowId} conflict={conflict} />
              ))}
              <Button trailingIcon="arrowRight" onClick={onSeePaths}>
                See possible paths
              </Button>
            </>
          ) : null}

          <Note>
            Unknown records stay separate from uncovered records. Times shown here come from the
            materialised commitments for this date, not from an estimate.
          </Note>
        </div>
      </div>
    </div>
  );
}
