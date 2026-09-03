import { StatusBadge } from "../components/primitives.jsx";
import { CONFLICT_KIND_LABEL, humaniseSources } from "./sources.js";
import { formatMinute } from "../domain/dates.js";
import { priorityExplanation } from "../domain/conflicts.js";
import { hourLabel } from "../store/derive.js";

export default function ConflictCard({ conflict }) {
  const isHandover = conflict.kind.startsWith("handover_");
  return (
    <article className={`conflict-card state-${conflict.state}`}>
      <header className="conflict-card__head">
        <StatusBadge state={conflict.state} />
        <span className="conflict-card__priority">{conflict.priority.toUpperCase()}</span>
      </header>

      <p className="conflict-card__title">
        {conflict.child_name ? `${conflict.child_name} · ` : ""}
        {formatMinute(conflict.start_minute)} — {formatMinute(conflict.end_minute)} ·{" "}
        {hourLabel(conflict.duration_minutes)}
      </p>

      {isHandover ? (
        <div className="handover-bar" aria-hidden="true">
          <span>{formatMinute(conflict.start_minute)}</span>
          <span className="handover-bar__line" />
          <span>{formatMinute(conflict.end_minute)}</span>
        </div>
      ) : null}

      <p className="screen__lede" style={{ fontSize: "12.5px" }}>
        {CONFLICT_KIND_LABEL[conflict.kind] ?? "Conflict"} · {priorityExplanation(conflict.priority)}
      </p>

      <ul className="source-list">
        {humaniseSources(conflict.source_records).map((source, index) => (
          <li key={`${conflict.rowId}-${index}`}>{source}</li>
        ))}
      </ul>
    </article>
  );
}
