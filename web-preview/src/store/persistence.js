// The whole state lives in this browser tab's localStorage and nowhere else.
// Every read and write is guarded: private windows, cleared site data and
// storage-blocking settings all throw, and none of them should break the app.

import { STORAGE_KEY, STATE_VERSION, emptyState } from "./schema.js";

export function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== STATE_VERSION) return null;
    return { ...emptyState(), ...parsed };
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
