// A small stroked icon set standing in for the SF Symbols the iOS build uses.
// Icons are decorative: every one sits beside a text label, so they are hidden
// from assistive technology.

const PATHS = {
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z",
  calendar: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2ZM4 10h16M8 3v4M16 3v4",
  people: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 2.7-5 6-5s6 2 6 5M17 11a3 3 0 1 0 0-6M18 20c0-2.2-.7-3.7-1.8-4.6",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5",
  briefcase: "M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18",
  building: "M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M14 10h4a2 2 0 0 1 2 2v9M7 8h4M7 12h4M7 16h4M17 14h1M17 18h1M2 21h20",
  house: "m3 11 9-7 9 7M6 10v11h12V10",
  car: "M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM19 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 15h10M3 15v-3l2-5h14l2 5v3",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  check: "m5 13 4 4L19 7",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-4-9 3 3 5-5",
  alert: "M12 3 2 20h20L12 3ZM12 10v5M12 17.5v.5",
  question: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5A2.5 2.5 0 1 1 12 13v1.5M12 17.5v.5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  chevronLeft: "m14 6-6 6 6 6",
  chevronRight: "m10 6 6 6-6 6",
  chevronDown: "m6 10 6 6 6-6",
  arrowRight: "M4 12h15m-6-6 6 6-6 6",
  arrowIn: "M4 12h11m-4-4 4 4-4 4M20 4v16",
  arrowOut: "M20 12H9m4-4-4 4 4 4M4 4v16",
  close: "m6 6 12 12M18 6 6 18",
  ellipsis: "M6 12h.01M12 12h.01M18 12h.01",
  pencil: "M4 20h4l10-10a2.8 2.8 0 1 0-4-4L4 16Z",
  trash: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6",
  repeat: "M4 9V7a2 2 0 0 1 2-2h11l-3-3m3 3-3 3M20 15v2a2 2 0 0 1-2 2H7l3 3m-3-3 3-3",
  refresh: "M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5",
  lock: "M6 11h12v9H6ZM9 11V8a3 3 0 0 1 6 0v3",
  flexible: "M4 12h16m-4-4 4 4-4 4M8 8l-4 4 4 4",
  pin: "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  doc: "M6 3h8l4 4v14H6ZM14 3v4h4M9 12h6M9 16h6",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 3H4ZM10 22h4",
  shield: "M12 3 5 6v6c0 4.4 3 7.5 7 9 4-1.5 7-4.6 7-9V6Z",
  sunrise: "M12 3v5m-5 4a5 5 0 0 1 10 0M3 16h18M6 20h12M5.5 7 7 8.5M18.5 7 17 8.5",
  sunset: "M12 8V3m-5 9a5 5 0 0 1 10 0M3 16h18M6 20h12M5.5 7 7 8.5M18.5 7 17 8.5",
  diamond: "m12 3 9 9-9 9-9-9Z",
  sparkle: "M12 3v18M3 12h18",
  circle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
};

export default function Icon({ name, size = 18, strokeWidth = 1.7, className, filled = false }) {
  const path = PATHS[name] ?? PATHS.circle;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}
