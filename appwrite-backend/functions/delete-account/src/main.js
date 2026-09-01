import { Account, Client, Query, TablesDB, Users } from "node-appwrite";

const DATABASE_ID = process.env.EQUALPATH_DATABASE_ID ?? "equalpath";
const OWNED_TABLES = [
  "confirmation_requests",
  "plan_feedback",
  "plan_segments",
  "plans",
  "conflicts",
  "sweeps",
  "care_commitments",
  "work_commitments",
  "schedule_patterns",
  "support_network",
  "children"
];

export function runtimeApiKey(req, env = process.env) {
  return header(req, "x-appwrite-key")
    ?? env.APPWRITE_FUNCTION_API_KEY
    ?? env.APPWRITE_API_KEY;
}

function services(req, env = process.env) {
  const endpoint = env.APPWRITE_FUNCTION_API_ENDPOINT ?? env.APPWRITE_ENDPOINT;
  const projectId = env.APPWRITE_FUNCTION_PROJECT_ID ?? env.APPWRITE_PROJECT_ID;
  const apiKey = runtimeApiKey(req, env);
  if (!endpoint || !projectId || !apiKey) throw new Error("Appwrite Function credentials are missing");
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return { tables: new TablesDB(client), users: new Users(client) };
}

async function verifyCaller(req, env = process.env) {
  const userId = header(req, "x-appwrite-user-id");
  const jwt = header(req, "x-appwrite-user-jwt");
  const endpoint = env.APPWRITE_FUNCTION_API_ENDPOINT ?? env.APPWRITE_ENDPOINT;
  const projectId = env.APPWRITE_FUNCTION_PROJECT_ID ?? env.APPWRITE_PROJECT_ID;
  if (!userId || !jwt || !endpoint || !projectId) {
    throw Object.assign(new Error("authentication_required"), { status: 401 });
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
  const account = new Account(client);
  const user = await account.get();
  if (user.$id !== userId) throw Object.assign(new Error("authentication_mismatch"), { status: 401 });
  return userId;
}

function header(req, name) {
  return req.headers?.[name] ?? req.headers?.[name.toLowerCase()] ?? req.headers?.[name.toUpperCase()];
}

function jsonBody(req) {
  if (req.bodyJson && typeof req.bodyJson === "object") return req.bodyJson;
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

async function listOwned(tables, tableId, userId) {
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const result = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [Query.equal("user_id", userId), Query.limit(100), Query.offset(offset)],
      total: false,
      ttl: 0
    });
    rows.push(...result.rows);
    if (result.rows.length < 100) return rows;
  }
}

export async function deleteOwnedAccount({ tables, users, userId, now = () => new Date() }) {
  // Requests are made non-actionable before any source data or identity is removed.
  const requests = await listOwned(tables, "confirmation_requests", userId);
  for (const request of requests) {
    if (!["withdrawn", "declined", "confirmed", "expired"].includes(request.status)) {
      await tables.updateRow({
        databaseId: DATABASE_ID,
        tableId: "confirmation_requests",
        rowId: request.$id,
        data: { status: "withdrawn", responded_at: now().toISOString() }
      });
    }
  }
  if (requests.length > 0) {
    await tables.deleteRows({
      databaseId: DATABASE_ID,
      tableId: "confirmation_requests",
      queries: [Query.equal("user_id", userId)]
    });
  }

  for (const tableId of OWNED_TABLES.filter((id) => id !== "confirmation_requests")) {
    await tables.deleteRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [Query.equal("user_id", userId)]
    });
  }

  // The profile row uses the Appwrite Auth user ID as its row ID.
  try {
    await tables.deleteRow({ databaseId: DATABASE_ID, tableId: "users", rowId: userId });
  } catch (error) {
    if (error?.code !== 404) throw error;
  }
  await users.delete({ userId });
}

export default async ({ req, res, error }) => {
  try {
    const userId = await verifyCaller(req);
    if (jsonBody(req).confirm !== "DELETE") {
      return res.json({ ok: false, error: "confirmation_required" }, 400);
    }
    await deleteOwnedAccount({ ...services(req), userId });
    return res.json({ ok: true, deleted: true });
  } catch (caught) {
    error(caught?.stack ?? String(caught));
    const status = Number.isInteger(caught?.status) ? caught.status : 500;
    return res.json({ ok: false, error: status === 500 ? "account_deletion_failed" : caught.message }, status);
  }
};
