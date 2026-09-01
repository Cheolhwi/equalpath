import {
  Account,
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
  Users
} from "node-appwrite";
import { DATABASE_ID } from "./config.js";

export { ID, Permission, Query, Role };

export function runtimeApiKey(req, env = process.env) {
  return req?.headers?.["x-appwrite-key"]
    ?? req?.headers?.["X-Appwrite-Key"]
    ?? env.APPWRITE_FUNCTION_API_KEY
    ?? env.APPWRITE_API_KEY;
}

export function createServices(req, env = process.env) {
  const endpoint = env.APPWRITE_FUNCTION_API_ENDPOINT ?? env.APPWRITE_ENDPOINT;
  const projectId = env.APPWRITE_FUNCTION_PROJECT_ID ?? env.APPWRITE_PROJECT_ID;
  const apiKey = runtimeApiKey(req, env);
  if (!endpoint || !projectId || !apiKey) {
    throw new Error("Appwrite Function endpoint, project ID, or dynamic API key is missing");
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return {
    tables: new TablesDB(client),
    users: new Users(client)
  };
}

export async function verifyAuthenticatedUser(userId, jwt, env = process.env) {
  if (!userId || !jwt) throw Object.assign(new Error("authentication_required"), { status: 401 });
  const endpoint = env.APPWRITE_FUNCTION_API_ENDPOINT ?? env.APPWRITE_ENDPOINT;
  const projectId = env.APPWRITE_FUNCTION_PROJECT_ID ?? env.APPWRITE_PROJECT_ID;
  if (!endpoint || !projectId) throw new Error("Appwrite Function endpoint or project ID is missing");
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
  const account = new Account(client);
  const user = await account.get();
  if (user.$id !== userId) throw Object.assign(new Error("authentication_mismatch"), { status: 401 });
  return user;
}

export function ownerPermissions(userId, mode = "full") {
  const role = Role.user(userId);
  const permissions = [Permission.read(role)];
  if (mode === "full") {
    permissions.push(Permission.update(role), Permission.delete(role));
  }
  return permissions;
}

export async function listAllRows(tables, tableId, queries = []) {
  const rows = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const page = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [...queries, Query.limit(pageSize), Query.offset(offset)],
      total: false,
      ttl: 0
    });
    rows.push(...page.rows);
    if (page.rows.length < pageSize) return rows;
  }
}

export async function getRowOrNull(tables, tableId, rowId) {
  try {
    return await tables.getRow({ databaseId: DATABASE_ID, tableId, rowId });
  } catch (error) {
    if (error?.code === 404) return null;
    throw error;
  }
}
