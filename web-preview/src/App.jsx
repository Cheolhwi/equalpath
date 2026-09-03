import { useEffect, useState } from "react";

import Icon from "./components/Icon.jsx";
import Welcome from "./features/Welcome.jsx";
import SetupFlow from "./features/onboarding/SetupFlow.jsx";
import Tomorrow from "./features/Tomorrow.jsx";
import DayDetail from "./features/DayDetail.jsx";
import Schedule from "./features/Schedule.jsx";
import Plans from "./features/Plans.jsx";
import People from "./features/People.jsx";
import Me from "./features/Me.jsx";
import { useStore } from "./store/context.jsx";
import { formatClock } from "./domain/dates.js";

const TABS = [
  { id: "tomorrow", label: "Tonight", icon: "moon" },
  { id: "schedule", label: "Schedule", icon: "calendar" },
  { id: "people", label: "People", icon: "people" },
  { id: "me", label: "Me", icon: "person" }
];

function MainTabs() {
  const [tab, setTab] = useState("tomorrow");
  const [pushed, setPushed] = useState(null);

  // A pushed screen belongs to the tab that opened it; changing tab pops it.
  const select = (next) => {
    setPushed(null);
    setTab(next);
  };

  return (
    <div className="app">
      {pushed?.name === "day" ? (
        <DayDetail dateLocal={pushed.dateLocal} onBack={() => setPushed(null)} onSeePaths={() => setPushed({ name: "plans" })} />
      ) : pushed?.name === "plans" ? (
        <Plans onBack={() => setPushed(null)} />
      ) : tab === "tomorrow" ? (
        <Tomorrow onOpenDay={(dateLocal) => setPushed({ name: "day", dateLocal })} onOpenSchedule={() => select("schedule")} />
      ) : tab === "schedule" ? (
        <Schedule onOpenDay={(dateLocal) => setPushed({ name: "day", dateLocal })} />
      ) : tab === "people" ? (
        <People />
      ) : (
        <Me />
      )}

      <nav className="tabbar" aria-label="Main">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="tabbar__item"
            aria-current={tab === item.id && !pushed ? "page" : undefined}
            onClick={() => select(item.id)}
          >
            <Icon name={item.icon} size={20} />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function ContextRail() {
  return (
    <section className="context-rail">
      <p className="context-rail__brand">
        <Icon name="diamond" size={13} filled />
        EqualPath
      </p>
      <h1>
        Know about tomorrow <em>tonight.</em>
      </h1>
      <p>
        The Iteration&nbsp;1 product, running as a web application. Enter your work, required-care and
        coverage records and EqualPath finds the gap between them across a rolling fourteen-day
        window — the same interval rules, weekly patterns and handover checks as the iOS build.
      </p>
      <ul className="context-rail__list">
        <li>
          <span aria-hidden="true">✓</span> Everything is calculated and stored in this browser
        </li>
        <li>
          <span aria-hidden="true">✓</span> No account, no sign-in, no service is contacted
        </li>
        <li>
          <span aria-hidden="true">✓</span> Nothing can be sent, booked or confirmed
        </li>
      </ul>
      <div className="context-rail__key" aria-label="The three results EqualPath can report">
        <span className="state-uncovered">
          <i className="dot" style={{ background: "var(--state-text)" }} /> Uncovered
        </span>
        <span className="state-covered">
          <i className="dot" style={{ background: "var(--state-text)" }} /> No gap
        </span>
        <span className="state-unknown">
          <i className="dot" style={{ background: "var(--state-text)" }} /> Unknown
        </span>
      </div>
      <a className="context-rail__link" href="https://github.com/Cheolhwi/equalpath">
        View the Iteration 1 source ↗
      </a>
    </section>
  );
}

export default function App() {
  const { state, storageAvailable } = useStore();
  const [clock, setClock] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatClock(new Date())), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="page">
      <a className="skip-link" href="#app">
        Skip to the application
      </a>
      <ContextRail />
      <div className="device-stage">
        <div className="phone" id="app">
          <div className="phone__status">
            <span>{clock}</span>
            <span className="phone__pill">{state.profile.sample_data ? "Sample records" : "Local only"}</span>
            <span>{storageAvailable ? "Saved here" : "Not saved"}</span>
          </div>
          {state.phase === "welcome" ? <Welcome /> : state.phase === "onboarding" ? <SetupFlow /> : <MainTabs />}
        </div>
        <p className="stage-note">
          A working web build of Iteration 1 · not the native iOS application and not a production client
        </p>
      </div>
    </div>
  );
}
