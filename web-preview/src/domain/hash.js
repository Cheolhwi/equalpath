// The backend derives deterministic conflict keys with node:crypto's SHA-256.
// Browsers have no synchronous digest, and these keys are only ever used to
// de-duplicate and to order candidates inside one local run, so a pure FNV-1a
// hash over four seeds gives the same determinism with no async boundary.

const OFFSETS = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];

function fnv1a(input, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// 32 hexadecimal characters, deterministic for a given string.
export function deterministicHash(input) {
  const value = String(input);
  return OFFSETS.map((seed) => fnv1a(value, seed).toString(16).padStart(8, "0")).join("");
}

let counter = 0;

// Identifiers for user-created rows. Stable within a session and unique across
// reloads because the timestamp is part of the seed.
export function createId(prefix) {
  counter += 1;
  return `${prefix}_${deterministicHash(`${prefix}|${Date.now()}|${counter}|${Math.random()}`).slice(0, 20)}`;
}
