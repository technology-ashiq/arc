// keys.mjs -- the owner's named keys, set once in the face and read by arc's tools (face v2 Phase 12, ADR-1351).
//
// WHY. Each key lived somewhere different -- a user environment variable set by `setx` (which a running shell cannot
// see), or a chat paste -- so every session asked the owner again. Now he sets any `NAME : value` once, on the
// Settings page, and the door writes it to a file outside every repo: `~/.arc-private/keys/keys.json` (ARC_KEYS_FILE
// overrides it, for tests, and may not point inside the repo). After that save no route returns a value.
//
// WHO READS IT. `resolveKey(name)`: the process environment first, then this store. A set environment variable is never
// overridden, so every setup that works today keeps working; the store only fills in what the environment lacks.
//
// Every decision here is a pure function over a plain object, held by `tests/face/keys.mjs` with node and no install;
// the file I/O is the functions at the bottom, shaped like the models registry's.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, realpathSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

export const SCHEMA = 1;
export const MAX_KEYS = 50;
// Environment-variable shaped, so a tool looks a key up by the name it already uses (OPENROUTER_API_KEY).
export const KEY_NAME_RE = /^[A-Z][A-Z0-9_]{1,63}$/;
// A value is opaque printable ASCII with no whitespace; anything else is a paste accident, refused rather than stored.
const VALUE_RE = /^[\x21-\x7e]{8,4000}$/;

/** @typedef {{ name: string, value: string }} KeyRecord */
/** @typedef {{ schema: number, keys: KeyRecord[] }} KeyStore */

/** @returns {KeyStore} */
export function emptyStore() {
  return { schema: SCHEMA, keys: [] };
}

/** @param {unknown} name @returns {string | null} the name as stored, or null when it is not one */
function cleanName(name) {
  return typeof name === "string" && KEY_NAME_RE.test(name.trim()) ? name.trim() : null;
}

/**
 * One change to the store, as a pure step: add · replace · remove. Nothing else exists, so no request can read a value
 * back or write the list in one go.
 * @param {KeyStore} store @param {unknown} body
 * @returns {{ ok: true, store: KeyStore } | { ok: false, why: string }}
 */
export function applyKeyChange(store, body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, why: "a change is { op, name, value? }" };
  const b = /** @type {Record<string, unknown>} */ (body);
  const want = b.op === "remove" ? ["op", "name"] : ["op", "name", "value"];
  for (const k of Object.keys(b)) if (!want.includes(k)) return { ok: false, why: `${String(b.op)} takes { ${want.join(", ")} }, not "${k}"` };
  if (!["add", "replace", "remove"].includes(/** @type {string} */ (b.op))) return { ok: false, why: `op must be add, replace or remove, not ${JSON.stringify(b.op)}` };
  const name = cleanName(b.name);
  if (!name) return { ok: false, why: "a key name is 2 to 64 capital letters, digits or underscores, starting with a letter (like OPENROUTER_API_KEY)" };
  // Names are matched without case, so OPENROUTER_API_KEY and openrouter_api_key are never two keys.
  const hit = store.keys.find((k) => k.name.toLowerCase() === name.toLowerCase());
  if (b.op === "remove") {
    if (!hit) return { ok: false, why: `no key is named ${name}` };
    return { ok: true, store: { schema: SCHEMA, keys: store.keys.filter((k) => k !== hit) } };
  }
  if (typeof b.value !== "string" || !VALUE_RE.test(b.value.trim())) return { ok: false, why: "a value is 8 to 4000 printable characters with no spaces" };
  const value = b.value.trim();
  if (b.op === "add") {
    if (hit) return { ok: false, why: `a key named ${hit.name} already exists; replace its value instead` };
    if (store.keys.length >= MAX_KEYS) return { ok: false, why: `at most ${MAX_KEYS} keys` };
    return { ok: true, store: { schema: SCHEMA, keys: [...store.keys, { name, value }] } };
  }
  if (!hit) return { ok: false, why: `no key is named ${name}; add it first` };
  return { ok: true, store: { schema: SCHEMA, keys: store.keys.map((k) => (k === hit ? { name: hit.name, value } : k)) } };
}

/**
 * What any route may show: never a value, only that one is set and, for a value of 20 or more characters, its last
 * four (four characters of a short value are too much of it).
 * @param {KeyStore} store
 */
export function publicKeys(store) {
  return {
    schema: SCHEMA,
    keys: store.keys.map((k) => ({ name: k.name, hasValue: true, tail: k.value.length >= 20 ? k.value.slice(-4) : null })),
  };
}

/**
 * The stored text read back, every record checked again: a hand-edited file with a bad row is refused whole, never
 * half-loaded.
 * @param {string} text @returns {{ ok: true, store: KeyStore } | { ok: false, why: string }}
 */
export function parseStore(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, why: "the keys file is not JSON" }; }
  if (!raw || typeof raw !== "object" || raw.schema !== SCHEMA || !Array.isArray(raw.keys)) return { ok: false, why: "the keys file is not schema 1" };
  let store = emptyStore();
  for (const k of raw.keys) {
    const step = applyKeyChange(store, { op: "add", name: k?.name, value: k?.value });
    if (!step.ok) return { ok: false, why: `the keys file holds a bad row (${step.why})` };
    store = step.store;
  }
  return { ok: true, store };
}

/**
 * The value for a name: the process environment's when set, the store's otherwise, else null. The environment always
 * wins, so a tool that works today is never redirected by a stored key it did not ask for.
 * @param {string} name @param {{ env?: Record<string, string | undefined>, store?: KeyStore | null }} [from]
 * @returns {string | null}
 */
export function resolveKey(name, from = {}) {
  const env = from.env ?? process.env;
  const n = cleanName(name);
  if (!n) return null;
  const fromEnv = env[n];
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
  let store = from.store;
  if (store === undefined) {
    const got = loadStore(null);
    store = got.ok ? got.store : null;
  }
  const hit = store ? store.keys.find((k) => k.name.toLowerCase() === n.toLowerCase()) : undefined;
  return hit ? hit.value : null;
}

// ---------- the file ----------

/**
 * Where the store lives: `~/.arc-private/keys/keys.json`, or ARC_KEYS_FILE -- never inside the repo, where a value is
 * one `git add` from public. `repo` null skips that check (a tool reading, not the door writing).
 * @param {string | null} repo @returns {{ ok: true, path: string } | { ok: false, why: string }}
 */
export function storePath(repo) {
  const raw = process.env.ARC_KEYS_FILE;
  const path = resolve(raw && raw.length ? raw : join(homedir(), ".arc-private", "keys", "keys.json"));
  if (repo === null) return { ok: true, path };
  const real = (/** @type {string} */ p) => { try { return realpathSync(p); } catch { return resolve(p); } };
  // Compare the nearest existing ancestor, so a not-yet-created file under a symlinked repo path is still caught.
  let probe = path;
  while (!existsSync(probe) && dirname(probe) !== probe) probe = dirname(probe);
  const at = real(probe) + path.slice(probe.length);
  const root = real(repo);
  const fold = (/** @type {string} */ s) => (process.platform === "win32" ? s.toLowerCase() : s);
  if (fold(at) === fold(root) || fold(at).startsWith(fold(root) + sep)) return { ok: false, why: "the keys file may not live inside the repo (a value there is one git add from public)" };
  return { ok: true, path };
}

/** @param {string | null} repo */
export function loadStore(repo) {
  const p = storePath(repo);
  if (!p.ok) return p;
  if (!existsSync(p.path)) return { ok: true, store: emptyStore(), path: p.path };
  let text;
  try { text = readFileSync(p.path, "utf8"); } catch (e) { return { ok: false, why: `the keys file could not be read (${/** @type {any} */ (e).code ?? "error"})` }; }
  const parsed = parseStore(text);
  return parsed.ok ? { ...parsed, path: p.path } : parsed;
}

/**
 * Write whole-file, via an exclusive temp file and a rename, owner-only where the OS has modes. Answers why it failed
 * rather than throwing, and leaves no temp file behind.
 * @param {string} path @param {KeyStore} store @returns {{ ok: true } | { ok: false, why: string }}
 */
export function saveStore(path, store) {
  const tmp = `${path}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(tmp, JSON.stringify(store, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    renameSync(tmp, path);
    return { ok: true };
  } catch (e) {
    try { unlinkSync(tmp); } catch { /* never written */ }
    return { ok: false, why: `the keys file could not be written (${/** @type {any} */ (e).code ?? "error"})` };
  }
}
