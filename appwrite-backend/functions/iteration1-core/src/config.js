export const DATABASE_ID = process.env.EQUALPATH_DATABASE_ID ?? "equalpath";
export const TIMEZONE = process.env.EQUALPATH_TIMEZONE ?? "Asia/Kuala_Lumpur";
export const HORIZON_DAYS = Number.parseInt(process.env.EQUALPATH_HORIZON_DAYS ?? "14", 10);

export const TABLES = Object.freeze({
  users: "users",
  children: "children",
  patterns: "schedule_patterns",
  work: "work_commitments",
  care: "care_commitments",
  sweeps: "sweeps",
  conflicts: "conflicts",
  support: "support_network",
  feedback: "plan_feedback",
  plans: "plans"
});

export const USER_INPUT_TABLES = new Set([
  TABLES.children,
  TABLES.patterns,
  TABLES.work,
  TABLES.care
]);
