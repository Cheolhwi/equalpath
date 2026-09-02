import {
  DAYS,
  VIEWS,
  createInitialState,
  formatGap,
  reducePreview,
  selectedDay,
  statusCopy
} from "./model.mjs";

const root = document.querySelector("#preview-app");
const announcer = document.querySelector("#preview-announcer");
let state = createInitialState();

const icons = Object.freeze({
  tonight: "◒",
  schedule: "▦",
  people: "●●",
  me: "◉"
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setState(action, announcement) {
  state = reducePreview(state, action);
  render();
  if (announcement) announcer.textContent = announcement;
}

function navMarkup() {
  return `<nav class="tab-bar" aria-label="Preview sections">
    ${VIEWS.map((view) => `<button type="button" class="tab-button ${state.activeView === view ? "is-active" : ""}" data-action="navigate" data-view="${view}" aria-current="${state.activeView === view ? "page" : "false"}">
      <span class="tab-icon" aria-hidden="true">${icons[view]}</span>
      <span>${view[0].toUpperCase()}${view.slice(1)}</span>
    </button>`).join("")}
  </nav>`;
}

function shell(content) {
  return `<div class="app-shell">${content}${navMarkup()}</div>`;
}

function welcomeView() {
  return `<section class="welcome-view">
    <div class="orb orb-blue" aria-hidden="true"></div>
    <div class="orb orb-gold" aria-hidden="true"></div>
    <div class="welcome-content">
      <p class="eyebrow gold">EqualPath · safe preview</p>
      <h2>See the gap before the day begins.</h2>
      <p>This interactive sample stays in your browser. It never signs in, saves family data, or sends a request.</p>
      <button type="button" class="primary-button" data-action="enter">Enter safe preview</button>
      <p class="fine-print">Uses fictional records for Nia · nothing is sent anywhere.</p>
    </div>
  </section>`;
}

function ringMarkup(day) {
  return `<div class="coverage-ring status-${day.status}" role="img" aria-label="${escapeHtml(formatGap(day.gapMinutes))}, ${escapeHtml(statusCopy(day.status))}">
    <div class="ring-centre">
      <strong>${escapeHtml(formatGap(day.gapMinutes))}</strong>
      <span>${escapeHtml(statusCopy(day.status))}</span>
    </div>
  </div>`;
}

function evidenceMarkup(day) {
  return `<div class="evidence-panel" ${state.evidenceOpen ? "" : "hidden"}>
    <p class="eyebrow">Why this result</p>
    <ul>${day.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <p class="evidence-rule">EqualPath reports only what these records support. Missing evidence remains Unknown.</p>
  </div>`;
}

function tonightView() {
  const day = DAYS[1];
  return shell(`<section class="screen scroll-screen">
    <div class="screen-header">
      <p class="eyebrow gold">Tonight · checked 21:00</p>
      <h2>Tomorrow needs<br><em>9h of cover.</em></h2>
      <p class="muted">Wednesday, 2 September</p>
    </div>
    ${ringMarkup(day)}
    <p class="window-label">${escapeHtml(day.window)} · sweep is current</p>
    <article class="status-card status-${day.status}">
      <div class="status-card-heading"><span class="status-badge">${escapeHtml(statusCopy(day.status))}</span><span>Nia</span></div>
      <h3>${escapeHtml(day.summary)}</h3>
      <p>Provider closure and work travel leave the full care window uncovered.</p>
    </article>
    <button type="button" class="secondary-button" data-action="toggle-evidence" aria-expanded="${state.evidenceOpen}">${state.evidenceOpen ? "Hide source evidence" : "Show source evidence"}</button>
    ${evidenceMarkup(day)}
  </section>`);
}

function scheduleView() {
  const day = selectedDay(state);
  return shell(`<section class="screen scroll-screen">
    <div class="compact-header">
      <p class="eyebrow gold">Fourteen-day plan</p>
      <h2>1–14 September</h2>
      <p class="muted">Select a day to inspect its verified state.</p>
    </div>
    <div class="day-grid" role="list" aria-label="Fourteen-day schedule">
      ${DAYS.map((item) => `<button type="button" role="listitem" class="day-button status-${item.status} ${state.selectedDayId === item.id ? "is-selected" : ""}" data-action="select-day" data-day-id="${item.id}" aria-pressed="${state.selectedDayId === item.id}">
        <span>${item.weekday}</span><strong>${item.day}</strong><i aria-label="${statusCopy(item.status)}"></i>
      </button>`).join("")}
    </div>
    <article class="day-detail status-${day.status}">
      <div class="day-detail-top"><span class="status-badge">${escapeHtml(statusCopy(day.status))}</span><span>${escapeHtml(day.weekday)}, ${day.day} September</span></div>
      <div class="day-summary">
        ${ringMarkup(day)}
        <div><h3>${escapeHtml(day.summary)}</h3><p>${escapeHtml(day.window)}</p></div>
      </div>
      <button type="button" class="text-button" data-action="toggle-evidence" aria-expanded="${state.evidenceOpen}">${state.evidenceOpen ? "Hide records" : "Inspect records"} <span aria-hidden="true">→</span></button>
      ${evidenceMarkup(day)}
    </article>
  </section>`);
}

function peopleView() {
  const people = [
    ["Aina Rahman", "Family carer", "Available after 15:30", "confirmed"],
    ["TASKA Seri Kasih", "Registered provider", "Closed tomorrow · JKM record", "closed"],
    ["Idris's school club", "Community programme", "Availability not verified", "unknown"]
  ];
  return shell(`<section class="screen scroll-screen">
    <div class="compact-header">
      <p class="eyebrow gold">People · read only</p>
      <h2>Your support circle</h2>
      <p class="muted">Iteration 1 can explain possible paths, but it does not contact or book anyone.</p>
    </div>
    <div class="people-list">
      ${people.map(([name, role, note, status], index) => `<article class="person-card">
        <div class="avatar avatar-${index}" aria-hidden="true">${escapeHtml(name.split(" ").map((part) => part[0]).join("").slice(0, 2))}</div>
        <div><h3>${escapeHtml(name)}</h3><p>${escapeHtml(role)}</p><span class="person-status status-${status}">${escapeHtml(note)}</span></div>
      </article>`).join("")}
    </div>
    <div class="boundary-note"><span class="diamond" aria-hidden="true"></span><p>No invitation, message or confirmation is sent from this preview.</p></div>
  </section>`);
}

function meView() {
  return shell(`<section class="screen scroll-screen">
    <div class="compact-header">
      <p class="eyebrow gold">Me · local preview</p>
      <h2>Preview controls</h2>
      <p class="muted">These preferences change only this browser session.</p>
    </div>
    <div class="settings-card">
      <label class="setting-row">
        <span><strong>Evening reminder</strong><small>Visual demonstration only</small></span>
        <input type="checkbox" data-action="set-reminders" ${state.reminders ? "checked" : ""}>
      </label>
      <div class="setting-row"><span><strong>Data source</strong><small>Deterministic local fixtures</small></span><span class="value-chip">Local</span></div>
      <div class="setting-row"><span><strong>Account</strong><small>No session has been created</small></span><span class="value-chip">None</span></div>
    </div>
    <div class="boundary-note"><span class="diamond" aria-hidden="true"></span><p>Google OAuth, Appwrite writes and account deletion are intentionally unavailable.</p></div>
    <button type="button" class="secondary-button" data-action="reset">Reset the preview</button>
  </section>`);
}

function render() {
  if (!root) return;
  if (state.welcome) {
    root.innerHTML = welcomeView();
    return;
  }
  const views = { tonight: tonightView, schedule: scheduleView, people: peopleView, me: meView };
  root.innerHTML = views[state.activeView]();
}

root?.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "enter") setState({ type: "enter" }, "Safe preview opened on Tonight.");
  if (action === "navigate") setState({ type: "navigate", view: target.dataset.view }, `${target.dataset.view} opened.`);
  if (action === "select-day") {
    const day = DAYS.find((item) => item.id === target.dataset.dayId);
    setState({ type: "select-day", dayId: target.dataset.dayId }, `${day.weekday} ${day.day} September: ${statusCopy(day.status)}.`);
  }
  if (action === "toggle-evidence") setState({ type: "toggle-evidence" }, state.evidenceOpen ? "Evidence hidden." : "Evidence shown.");
  if (action === "reset") setState({ type: "reset" }, "Preview reset.");
});

root?.addEventListener("change", (event) => {
  if (event.target.matches('[data-action="set-reminders"]')) {
    setState({ type: "set-reminders", value: event.target.checked }, `Preview reminder ${event.target.checked ? "on" : "off"}.`);
  }
});

render();
