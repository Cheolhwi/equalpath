import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const configPath = resolve(root, "appwrite.config.json");
const config = readJson(configPath);
const tablePath = resolve(root, config.includes.tables);
const functionPath = resolve(root, config.includes.functions);
const databasePath = resolve(root, config.includes.tablesDB);
const tables = readJson(tablePath);
const functions = readJson(functionPath);
const databases = readJson(databasePath);

assert.equal(databases.length, 1, "Exactly one TablesDB database is expected");
assert.equal(databases[0].$id, "equalpath");
assert.equal(tables.length, 15, "The EqualPath schema should contain 15 tables");
assert.equal(new Set(tables.map((table) => table.$id)).size, tables.length, "Table IDs must be unique");
assert.ok(tables.some((table) => table.$id === "sweeps"), "sweeps table is required");
assert.ok(tables.some((table) => table.$id === "conflicts"), "conflicts table is required");
assert.ok(!tables.some((table) => table.$id === "device_tokens"), "Device-local notifications do not need a token table");

const publicTables = new Set(["childcare_providers", "district_population", "strategy_library"]);
const functionOnlyTables = new Set(["children", "schedule_patterns", "work_commitments", "care_commitments", "support_network", "plan_feedback"]);
for (const table of tables) {
  const keys = table.columns.map((column) => column.key);
  assert.equal(new Set(keys).size, keys.length, `${table.$id} column keys must be unique`);
  if (!publicTables.has(table.$id)) assert.equal(table.rowSecurity, true, `${table.$id} needs row security`);
  if (keys.includes("user_id")) {
    assert.ok(table.indexes.some((index) => index.columns.includes("user_id")), `${table.$id} needs a user_id index`);
  }
  if (functionOnlyTables.has(table.$id)) {
    assert.deepEqual(table.$permissions, [], `${table.$id} mutations must go through the authenticated Function`);
  }
}

assert.deepEqual(new Set(functions.map((fn) => fn.$id)), new Set(["iteration1-core", "delete-account"]));
for (const fn of functions) {
  assert.equal(fn.runtime, "node-22");
  assert.ok(fn.execute.includes("users"), `${fn.$id} must require an authenticated user for direct execution`);
  assert.ok(fn.scopes.includes("rows.read") && fn.scopes.includes("rows.write"), `${fn.$id} needs row scopes`);
  const sourcePath = resolve(dirname(functionPath), fn.path);
  assert.ok(existsSync(resolve(sourcePath, fn.entrypoint)), `${fn.$id} entrypoint does not exist`);
  assert.ok(existsSync(resolve(sourcePath, "package.json")), `${fn.$id} package.json does not exist`);
}

const core = functions.find((fn) => fn.$id === "iteration1-core");
assert.ok(core.events.includes("users.*.create"));
assert.equal(core.schedule, "0 * * * *");
assert.ok(!core.scopes.includes("messages.write"), "Device-local notifications must not grant Messaging write access");

if (config.projectId.includes("<") || config.endpoint.includes("<")) {
  console.warn("Configuration is structurally valid; replace projectId and endpoint placeholders before deployment.");
}
console.log(`Validated ${tables.length} tables, ${tables.reduce((sum, table) => sum + table.columns.length, 0)} columns, ${tables.reduce((sum, table) => sum + table.indexes.length, 0)} indexes, and ${functions.length} functions.`);
