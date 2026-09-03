import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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

// iPhone 17: a 402 × 874 pt display, plus the bezel and the metal rail around
// it. The whole device is drawn at true size and scaled to fit the window, so
// the app inside always lays out at the same point size a phone would give it.
const DEVICE_HEIGHT = 902;
const DEVICE_WIDTH = 430;
const CHROME_ALLOWANCE = 116;

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

function StatusBar({ clock }) {
  return (
    <div className="phone__status">
      <span className="phone__clock">{clock}</span>
      <span className="phone__indicators" aria-hidden="true">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M1 4.2a10 10 0 0 1 14 0M3.6 7a6.4 6.4 0 0 1 8.8 0" />
          <circle cx="8" cy="10.2" r="1" fill="currentColor" stroke="none" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
          <rect x="0.6" y="0.6" width="21" height="10.8" rx="3.2" stroke="currentColor" strokeOpacity="0.45" />
          <rect x="2.2" y="2.2" width="17.8" height="7.6" rx="2" fill="currentColor" />
          <path d="M23.4 4.2v3.6a2 2 0 0 0 0-3.6Z" fill="currentColor" fillOpacity="0.45" />
        </svg>
      </span>
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
  const stage = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatClock(new Date())), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Fit the device to the window without distorting it: one scale factor, and
  // the slot reserves exactly the space the scaled device occupies.
  const fit = useCallback(() => {
    const node = stage.current;
    if (!node) return;
    const shellVisible = window.matchMedia("(min-width: 721px)").matches;
    const scale = shellVisible ? Math.min(1, (window.innerHeight - CHROME_ALLOWANCE) / DEVICE_HEIGHT) : 1;
    node.style.setProperty("--device-scale", Math.max(scale, 0.45).toFixed(4));
  }, []);

  useLayoutEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  const screen = state.phase === "welcome" ? <Welcome /> : state.phase === "onboarding" ? <SetupFlow /> : <MainTabs />;

  return (
    <div className="page">
      <a className="skip-link" href="#app">
        Skip to the application
      </a>
      <ContextRail />

      <div className="device-stage" ref={stage} style={{ "--device-w": `${DEVICE_WIDTH}px`, "--device-h": `${DEVICE_HEIGHT}px` }}>
        <div className="device-stage__slot">
          <div className="device">
            <span className="device__rail device__rail--action" aria-hidden="true" />
            <span className="device__rail device__rail--volume-up" aria-hidden="true" />
            <span className="device__rail device__rail--volume-down" aria-hidden="true" />
            <span className="device__rail device__rail--power" aria-hidden="true" />
            <span className="device__rail device__rail--camera" aria-hidden="true" />

            <div className="device__bezel">
              <div className="phone" id="app">
                {state.phase === "welcome" ? (
                  <div className="phone__ambient" aria-hidden="true">
                    <span className="phone__blob phone__blob--blue" />
                    <span className="phone__blob phone__blob--gold" />
                  </div>
                ) : null}
                <span className="phone__island" aria-hidden="true" />
                <StatusBar clock={clock} />
                {screen}
                <span className="phone__home" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        <p className="stage-note">
          {state.profile.sample_data ? "Sample records" : "Your records"} ·{" "}
          {storageAvailable ? "kept in this browser only" : "this browser is blocking storage, so nothing is kept"}
          <br />A working web build of Iteration 1 · not the native iOS application
        </p>
      </div>
    </div>
  );
}
