import { useState } from "react";

import Icon from "../components/Icon.jsx";
import { Button, Card, Eyebrow, Note, SectionLabel, Toggle } from "../components/primitives.jsx";
import { WEEKDAY_NAMES } from "../domain/dates.js";
import { useStore } from "../store/context.jsx";

function Row({ icon, title, detail }) {
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

export default function Me() {
  const { state, dispatch, reset, storageAvailable } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const { profile } = state;

  const coveragePatterns = state.schedule_patterns.filter((pattern) => pattern.kind === "care_coverage");
  const workPatterns = state.schedule_patterns.filter((pattern) => pattern.kind === "work");
  const providerNames = [
    ...new Set(coveragePatterns.map((pattern) => JSON.parse(pattern.payload_json).location_label).filter(Boolean))
  ];
  const workDays = [...new Set(workPatterns.flatMap((pattern) => pattern.byweekday))];
  const travel = [profile.travel_home_care_min, profile.travel_care_work_min, profile.travel_home_work_min];

  return (
    <div className="screen">
      <div className="screen__inner">
        <Eyebrow>{profile.sample_data ? "Sample records" : "Local account"}</Eyebrow>
        <h2 className="screen__title">{profile.name || "Your records"}</h2>
        {profile.email ? <p className="row__subtitle">{profile.email}</p> : null}

        <div className="stack">
          <SectionLabel>Schedule sources</SectionLabel>
          <Card className="card--flush">
            <Row
              icon="people"
              title="Children"
              detail={state.children.length > 0 ? state.children.map((child) => child.name).join(", ") : "None recorded"}
            />
            <Row
              icon="building"
              title="Registered care"
              detail={providerNames.length > 0 ? providerNames.join(", ") : "No coverage pattern recorded"}
            />
            <Row
              icon="briefcase"
              title="Work week"
              detail={
                workDays.length > 0
                  ? `${workDays.map((day) => WEEKDAY_NAMES[day].short).join(", ")} · travel counted on both ends`
                  : "No work pattern recorded"
              }
            />
            <Row
              icon="car"
              title="Travel estimates"
              detail={
                travel.every(Number.isInteger)
                  ? `Home ↔ care ${travel[0]} min · care ↔ work ${travel[1]} min · home ↔ work ${travel[2]} min`
                  : "Incomplete — handover gaps stay uncalculated"
              }
            />
          </Card>
        </div>

        <div className="stack">
          <SectionLabel>Where your data lives</SectionLabel>
          <Card className="card--flush">
            <Row
              icon="shield"
              title="Storage"
              detail={
                storageAvailable
                  ? "This browser only · nothing is uploaded and no account exists"
                  : "This browser is blocking storage, so records are lost on reload"
              }
            />
            <Row icon="pin" title="Location" detail="Areas only · no coordinates, no map service, no tracking" />
          </Card>
        </div>

        <div className="stack">
          <SectionLabel>Reminders</SectionLabel>
          <Card>
            <Toggle
              label="Tomorrow’s care gap · 21:00"
              description="A preference only — see the note below"
              checked={profile.notification_enabled}
              onChange={(value) => dispatch({ type: "set-notifications", value })}
            />
          </Card>
          <Note>
            The iOS build schedules this reminder on the phone itself. A web page cannot wake up at
            21:00, so this build stores the preference and shows the same result on Tonight rather
            than pretending a reminder was delivered.
          </Note>
        </div>

        {confirming ? (
          <Card>
            <div className="stack">
              <p className="row__title">Clear everything?</p>
              <p className="row__subtitle">
                This removes every record from this browser and returns to the welcome screen. It
                cannot be undone.
              </p>
              <input
                className="field__control"
                aria-label="Type CLEAR to confirm"
                placeholder="CLEAR"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
              />
              <div className="btn-row">
                <Button variant="danger" disabled={confirmation !== "CLEAR"} onClick={reset}>
                  Clear stored records
                </Button>
                <Button variant="secondary" onClick={() => (setConfirming(false), setConfirmation(""))}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Clear stored records
          </Button>
        )}

        <p className="screen__footnote">
          The iOS build signs out of Appwrite and deletes owner-scoped rows on request. There is no
          account here to delete: clearing this browser’s storage removes everything EqualPath holds
          about you.
        </p>
      </div>
    </div>
  );
}
