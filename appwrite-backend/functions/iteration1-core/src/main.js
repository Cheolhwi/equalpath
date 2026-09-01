import { createServices, verifyAuthenticatedUser } from "./appwrite.js";
import { TABLES } from "./config.js";
import { EqualPathService } from "./service.js";

function header(req, name) {
  return req.headers?.[name] ?? req.headers?.[name.toLowerCase()] ?? req.headers?.[name.toUpperCase()];
}

function jsonBody(req) {
  if (req.bodyJson && typeof req.bodyJson === "object") return req.bodyJson;
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function eventName(req) {
  return header(req, "x-appwrite-event") ?? process.env.APPWRITE_FUNCTION_EVENT ?? "";
}

function eventTable(event) {
  const match = event.match(/tables\.([^.]+)\.rows/);
  return match?.[1];
}

function isGeneratedOccurrence(row) {
  return Boolean(row?.pattern_id) && row?.is_override !== true;
}

export default async ({ req, res, log, error }) => {
  const event = eventName(req);
  const body = jsonBody(req);

  try {
    const service = new EqualPathService({ ...createServices(req), log, error });
    if (event === "users.*.create" || /^users\.[^.]+\.create$/.test(event)) {
      const profile = await service.profileForAuthUser(body);
      return res.json({ ok: true, action: "profile_sync", profile_id: profile.$id });
    }

    if (event.includes("schedule_patterns.rows.")) {
      if (event.endsWith(".delete")) await service.removeGeneratedForPattern(body);
      else await service.materialisePattern(body);
      if (body.user_id) await service.detectForUser(body.user_id, "pattern_event");
      return res.json({ ok: true, action: "pattern_refresh" });
    }

    const tableId = eventTable(event);
    if ([TABLES.work, TABLES.care].includes(tableId)) {
      if (isGeneratedOccurrence(body)) {
        return res.json({ ok: true, action: "generated_occurrence_ignored" });
      }
      if (body.user_id) await service.detectForUser(body.user_id, "commitment_event");
      return res.json({ ok: true, action: "commitment_refresh" });
    }

    if (tableId === TABLES.children) {
      if (body.user_id) await service.detectForUser(body.user_id, "child_event");
      return res.json({ ok: true, action: "child_refresh" });
    }

    if (event.includes("schedule") || header(req, "x-appwrite-trigger") === "schedule") {
      const results = await service.scheduledRun();
      return res.json({ ok: true, action: "scheduled_run", results });
    }

    const userId = header(req, "x-appwrite-user-id");
    await verifyAuthenticatedUser(userId, header(req, "x-appwrite-user-jwt"));
    const action = body.action ?? "initial_sweep";
    if (action === "save_row") {
      const row = await service.saveUserRow({
        userId,
        tableId: body.table_id,
        rowId: body.row_id,
        data: body.data
      });
      const preservedOverrides = body.table_id === TABLES.patterns
        ? await service.countPatternOverrides(row)
        : 0;
      return res.json({ ok: true, action, table_id: body.table_id, row_id: row.$id, preserved_overrides: preservedOverrides });
    }
    if (action === "delete_row") {
      const result = await service.deleteUserRow({ userId, tableId: body.table_id, rowId: body.row_id });
      return res.json({ ok: true, action, table_id: body.table_id, row_id: body.row_id, preserved_overrides: result.preservedOverrides });
    }
    if (action === "prune_schedule_span") {
      await service.pruneScheduleSpan({
        userId,
        tableId: body.table_id,
        spanGroup: body.span_group,
        keepRowIds: body.keep_row_ids
      });
      return res.json({ ok: true, action, table_id: body.table_id, span_group: body.span_group });
    }
    if (action === "update_profile") {
      const profile = await service.updateProfile(userId, body.data);
      return res.json({ ok: true, action, profile_id: profile.$id });
    }
    if (!["initial_sweep", "refresh"].includes(action)) return res.json({ ok: false, error: "unsupported_action" }, 400);
    const materialised = await service.materialiseUser(userId);
    const sweep = await service.detectForUser(userId, action);
    return res.json({ ok: true, action, materialised_patterns: materialised, sweep });
  } catch (caught) {
    error(caught?.stack ?? String(caught));
    const status = Number.isInteger(caught?.status) ? caught.status : 500;
    return res.json({ ok: false, error: status === 500 ? "backend_operation_failed" : caught.message }, status);
  }
};
