import test from "node:test";
import assert from "node:assert/strict";
import { EqualPathService } from "../functions/iteration1-core/src/service.js";

test("a failed scan never resolves a previously visible conflict", async () => {
  const updates = [];
  const oldConflict = {
    $id: "old_conflict",
    user_id: "user_1",
    child_id: "child_1",
    date_local: "2026-08-29",
    deterministic_key: "old",
    status: "open"
  };
  const rows = {
    children: [{ $id: "child_1", user_id: "user_1", active: true }],
    work_commitments: [{ user_id: "user_1", date_local: "2026-08-29", start_minute: 540, end_minute: 1020, priority: "fixed" }],
    care_commitments: [{ user_id: "user_1", child_id: "child_1", date_local: "2026-08-29", entry_kind: "required", start_minute: 480, end_minute: 1080, status: "active" }],
    conflicts: [oldConflict]
  };
  const tables = {
    getRow: async () => ({ $id: "user_1", email: "u@example.com", timezone: "Asia/Kuala_Lumpur" }),
    createRow: async () => ({}),
    listRows: async ({ tableId, queries }) => {
      const offsetQuery = queries.find((query) => query.includes('"offset"'));
      return { rows: offsetQuery && !offsetQuery.includes('0') ? [] : (rows[tableId] ?? []) };
    },
    upsertRow: async ({ tableId }) => {
      if (tableId === "conflicts") throw Object.assign(new Error("simulated write failure"), { code: 503 });
      return {};
    },
    updateRow: async (input) => { updates.push(input); return {}; }
  };
  const service = new EqualPathService({
    tables,
    users: {},
    now: () => new Date("2026-08-28T16:00:00.000Z")
  });

  await assert.rejects(service.detectForUser("user_1", "test"), /simulated write failure/);
  assert.equal(updates.some((item) => item.tableId === "conflicts" && item.rowId === "old_conflict"), false);
  assert.equal(updates.some((item) => item.tableId === "sweeps" && item.data.overall === "failed"), true);
});

test("a successful schedule-change scan resolves a conflict with an explicit reason", async () => {
  const updates = [];
  const oldConflict = {
    $id: "old_conflict",
    user_id: "user_1",
    child_id: "child_1",
    date_local: "2026-08-29",
    deterministic_key: "old",
    status: "open"
  };
  const rows = {
    children: [{ $id: "child_1", user_id: "user_1", active: true }],
    work_commitments: [],
    care_commitments: [],
    conflicts: [oldConflict]
  };
  const tables = {
    getRow: async () => ({ $id: "user_1", email: "u@example.com", timezone: "Asia/Kuala_Lumpur" }),
    createRow: async () => ({}),
    listRows: async ({ tableId, queries }) => {
      const offsetQuery = queries.find((query) => query.includes('"offset"'));
      return { rows: offsetQuery && !offsetQuery.includes('0') ? [] : (rows[tableId] ?? []) };
    },
    upsertRow: async () => ({}),
    updateRow: async (input) => { updates.push(input); return {}; }
  };
  const service = new EqualPathService({
    tables,
    users: {},
    now: () => new Date("2026-08-28T16:00:00.000Z")
  });

  await service.detectForUser("user_1", "client_mutation");

  const resolution = updates.find((item) => item.tableId === "conflicts" && item.rowId === "old_conflict");
  assert.equal(resolution.data.status, "resolved");
  assert.equal(resolution.data.resolution_reason, "schedule_change");
});

test("deleting generated span rows creates tombstones while manual rows are removed", async () => {
  const updates = [];
  const deletes = [];
  const first = { $id: "generated", user_id: "user_1", span_group: "span_1", pattern_id: "pattern_1" };
  const second = { $id: "manual", user_id: "user_1", span_group: "span_1" };
  const tables = {
    getRow: async () => first,
    listRows: async ({ queries }) => {
      const offsetQuery = queries.find((query) => query.includes('"offset"'));
      return { rows: offsetQuery && !offsetQuery.includes('0') ? [] : [first, second] };
    },
    updateRow: async (input) => { updates.push(input); return {}; },
    deleteRow: async (input) => { deletes.push(input); }
  };
  const service = new EqualPathService({ tables, users: {} });
  let trigger;
  service.detectForUser = async (_userId, value) => { trigger = value; };

  await service.deleteUserRow({ userId: "user_1", tableId: "work_commitments", rowId: "generated" });

  assert.deepEqual(updates[0].data, { status: "cancelled", is_override: true });
  assert.equal(deletes[0].rowId, "manual");
  assert.equal(trigger, "client_mutation");
});

test("editing a cross-midnight span removes only obsolete continuation rows", async () => {
  const deletes = [];
  const rows = [
    { $id: "first", user_id: "user_1", span_group: "span_1", span_part: 0 },
    { $id: "continuation", user_id: "user_1", span_group: "span_1", span_part: 1 }
  ];
  const tables = {
    listRows: async ({ queries }) => {
      const offsetQuery = queries.find((query) => query.includes('"offset"'));
      return { rows: offsetQuery && !offsetQuery.includes('0') ? [] : rows };
    },
    deleteRow: async (input) => { deletes.push(input); }
  };
  const service = new EqualPathService({ tables, users: {} });
  let trigger;
  service.detectForUser = async (_userId, value) => { trigger = value; };

  await service.pruneScheduleSpan({
    userId: "user_1",
    tableId: "work_commitments",
    spanGroup: "span_1",
    keepRowIds: ["first"]
  });

  assert.deepEqual(deletes.map((item) => item.rowId), ["continuation"]);
  assert.equal(trigger, "client_mutation");
});

test("weekly pattern updates report the single-day overrides they preserve", async () => {
  const rows = [
    { $id: "generated", pattern_id: "pattern_1", is_override: false },
    { $id: "changed", pattern_id: "pattern_1", is_override: true },
    { $id: "skipped", pattern_id: "pattern_1", is_override: true, status: "cancelled" }
  ];
  const tables = {
    listRows: async ({ queries }) => {
      const offsetQuery = queries.find((query) => query.includes('"offset"'));
      return { rows: offsetQuery && !offsetQuery.includes('0') ? [] : rows };
    }
  };
  const service = new EqualPathService({ tables, users: {} });

  const count = await service.countPatternOverrides({ $id: "pattern_1", kind: "work" });

  assert.equal(count, 2);
});
