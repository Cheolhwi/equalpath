import test from "node:test";
import assert from "node:assert/strict";
import { deleteOwnedAccount } from "../functions/delete-account/src/main.js";

test("account deletion withdraws outstanding requests before erasing rows and Auth", async () => {
  const calls = [];
  const tables = {
    listRows: async ({ tableId }) => ({
      rows: tableId === "confirmation_requests"
        ? [{ $id: "request_1", status: "sent" }, { $id: "request_2", status: "confirmed" }]
        : []
    }),
    updateRow: async (input) => { calls.push(["update", input.tableId, input.rowId, input.data.status]); },
    deleteRows: async (input) => { calls.push(["deleteRows", input.tableId]); },
    deleteRow: async (input) => { calls.push(["deleteRow", input.tableId]); }
  };
  const users = { delete: async () => { calls.push(["deleteAuth"]); } };

  await deleteOwnedAccount({ tables, users, userId: "user_1", now: () => new Date("2026-08-28T00:00:00Z") });
  const withdrawal = calls.findIndex((call) => call[0] === "update" && call[2] === "request_1" && call[3] === "withdrawn");
  const requestErase = calls.findIndex((call) => call[0] === "deleteRows" && call[1] === "confirmation_requests");
  assert.ok(withdrawal >= 0 && withdrawal < requestErase);
  assert.deepEqual(calls.at(-1), ["deleteAuth"]);
});
