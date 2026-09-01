import test from "node:test";
import assert from "node:assert/strict";
import { EqualPathService } from "../functions/iteration1-core/src/service.js";

function serviceWith({ existing = null } = {}) {
  let written;
  const tables = {
    getRow: async ({ tableId }) => {
      if (tableId === "users") return { $id: "user_1", email: "u@example.com" };
      if (existing) return existing;
      throw Object.assign(new Error("not found"), { code: 404 });
    },
    upsertRow: async (input) => { written = input; return { $id: input.rowId, ...input.data }; }
  };
  return {
    service: new EqualPathService({ tables, users: {} }),
    written: () => written
  };
}

test("client mutations cannot forge user_id", async () => {
  const harness = serviceWith();
  await harness.service.saveUserRow({
    userId: "user_1",
    tableId: "support_network",
    rowId: "support_1",
    data: { user_id: "victim", display_name: "Grandma", relationship: "family" }
  });
  assert.equal(harness.written().data.user_id, "user_1");
  assert.equal(harness.written().data.display_name, "Grandma");
  assert.equal(harness.written().permissions.length, 1);
  assert.match(harness.written().permissions[0], /^read\(/);
});

test("client mutations cannot discover or overwrite another user's row", async () => {
  const harness = serviceWith({ existing: { $id: "support_1", user_id: "victim" } });
  await assert.rejects(harness.service.saveUserRow({
    userId: "user_1",
    tableId: "support_network",
    rowId: "support_1",
    data: { display_name: "Changed", relationship: "family" }
  }), (error) => error.status === 404);
});
