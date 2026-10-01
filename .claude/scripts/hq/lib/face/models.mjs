// models.mjs -- the owner's chat models, kept on the door and never handed back (face v2 Phase 10, ADR-1350).
//
// WHY ON THE DOOR. ADR-1325 forbids a provider key in the browser, and the repo is public. So the face's settings
// panel sends a key ONCE, over the token-guarded local door, and the door writes it to a file outside every repo:
// `~/.arc-private/face/models.json` (ARC_FACE_MODELS_FILE overrides it, for tests). After that save no route returns
// the key -- `publicView` shows its last four characters, which is enough to tell two keys apart and useless to steal.
//
// WHY ONE SHAPE. Every model the owner named -- OpenRouter's free and paid models, OpenAI, Groq, DeepSeek, Anthropic's
// compatible endpoint, a local Ollama or LM Studio -- speaks an OpenAI-compatible chat completion. One record (name,
// base URL, model id, optional key) reaches all of them through the engine's generic-api driver, which already speaks
// that shape with plain fetch and no SDK.
//
// Every decision here is a pure function over a plain object, so `tests/face/talk.mjs` holds each one with node and
// no install; the file I/O is the two small functions at the bottom.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, realpathSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

export const SCHEMA = 1;
export const MAX_MODELS = 20;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,39}$/;
// A model id is what the provider names it: `meta-llama/llama-3.3-70b-instruct:free`, `gpt-4o-mini`, `llama3.2`.
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/;
// A key is opaque printable ASCII with no whitespace; anything else is a paste accident, refused rather than stored.
const KEY_RE = /^[\x21-\x7e]{8,400}$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** @typedef {{ name: string, baseUrl: string, model: string, key?: string }} ModelRecord */
/** @typedef {{ schema: number, active: string | null, models: ModelRecord[] }} Registry */

/** @returns {Registry} */
export function emptyRegistry() {
  return { schema: SCHEMA, active: null, models: [] };
}

/**
 * The base URL as the driver will use it, or the reason it is refused. https anywhere; plain http only to this machine,
 * because a key sent in clear over a network is a key given away. No credentials or query in the URL: a key belongs in
 * the key field, where it is redacted, never in a URL that is shown back.
 * @param {unknown} raw @returns {{ ok: true, url: string } | { ok: false, why: string }}
 */
export function checkBaseUrl(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 300) return { ok: false, why: "the base URL must be 1 to 300 characters" };
  let u;
  try { u = new URL(raw.trim()); } catch { return { ok: false, why: "the base URL does not parse as a URL" }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, why: "the base URL must be http or https" };
  if (u.protocol === "http:" && !LOCAL_HOSTS.has(u.hostname)) return { ok: false, why: "plain http is allowed to this machine only (localhost, 127.0.0.1, [::1]); use https for a remote provider" };
  if (u.username || u.password) return { ok: false, why: "the base URL carries a user or password; put a key in the key field instead" };
  if (u.search || u.hash) return { ok: false, why: "the base URL carries a query or fragment; give the base only, e.g. https://openrouter.ai/api/v1" };
  const path = u.pathname.replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  return { ok: true, url: `${u.protocol}//${u.host}${path}` };
}

/** The endpoint generic-api POSTs to. @param {string} baseUrl */
export function endpointOf(baseUrl) {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

/**
 * A new record checked field by field. The key is optional: a local model has none.
 * @param {unknown} input @returns {{ ok: true, record: ModelRecord } | { ok: false, why: string }}
 */
export function checkRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, why: "a model is { name, baseUrl, model, key? }" };
  const r = /** @type {Record<string, unknown>} */ (input);
  for (const k of Object.keys(r)) if (!["name", "baseUrl", "model", "key"].includes(k)) return { ok: false, why: `unknown field "${k}"` };
  if (typeof r.name !== "string" || !NAME_RE.test(r.name.trim())) return { ok: false, why: "the name is 1 to 40 letters, digits, spaces, dots, dashes or underscores, starting with a letter or digit" };
  const url = checkBaseUrl(r.baseUrl);
  if (!url.ok) return url;
  if (typeof r.model !== "string" || !MODEL_RE.test(r.model.trim())) return { ok: false, why: "the model id is the provider's name for it, e.g. gpt-4o-mini or llama3.2 (no spaces)" };
  /** @type {ModelRecord} */
  const record = { name: r.name.trim(), baseUrl: url.url, model: r.model.trim() };
  if (r.key !== undefined && r.key !== null && r.key !== "") {
    if (typeof r.key !== "string" || !KEY_RE.test(r.key.trim())) return { ok: false, why: "the key is 8 to 400 printable characters with no spaces" };
    record.key = r.key.trim();
  }
  return { ok: true, record };
}

/**
 * One change to the registry, as a pure step. `op` is add · activate · remove; nothing else exists, so no request can
 * read a key back or write a list in one go.
 * @param {Registry} reg @param {unknown} body
 * @returns {{ ok: true, reg: Registry } | { ok: false, why: string }}
 */
export function applyChange(reg, body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, why: "a change is { op, ... }" };
  const b = /** @type {Record<string, unknown>} */ (body);
  const same = (/** @type {string} */ a, /** @type {unknown} */ n) => typeof n === "string" && a.toLowerCase() === n.trim().toLowerCase();
  if (b.op === "add") {
    for (const k of Object.keys(b)) if (k !== "op" && k !== "model") return { ok: false, why: `add takes { op, model }, not "${k}"` };
    const c = checkRecord(b.model);
    if (!c.ok) return c;
    if (reg.models.some((m) => same(m.name, c.record.name))) return { ok: false, why: `a model named "${c.record.name}" already exists; remove it first or pick another name` };
    if (reg.models.length >= MAX_MODELS) return { ok: false, why: `at most ${MAX_MODELS} models` };
    const models = [...reg.models, c.record];
    // The first model added becomes active, so "add one and ask" works with no second step.
    return { ok: true, reg: { schema: SCHEMA, active: reg.active ?? c.record.name, models } };
  }
  if (b.op === "activate" || b.op === "remove") {
    for (const k of Object.keys(b)) if (k !== "op" && k !== "name") return { ok: false, why: `${b.op} takes { op, name }, not "${k}"` };
    const hit = reg.models.find((m) => same(m.name, b.name));
    if (!hit) return { ok: false, why: `no model is named ${JSON.stringify(b.name)}` };
    if (b.op === "activate") return { ok: true, reg: { ...reg, active: hit.name } };
    const models = reg.models.filter((m) => m !== hit);
    return { ok: true, reg: { schema: SCHEMA, active: reg.active === hit.name ? (models[0]?.name ?? null) : reg.active, models } };
  }
  return { ok: false, why: `op must be add, activate or remove, not ${JSON.stringify(b.op)}` };
}

/**
 * What any route may show: never a key, only whether one is set and its last four characters.
 * @param {Registry} reg
 */
export function publicView(reg) {
  return {
    schema: SCHEMA,
    active: reg.active,
    models: reg.models.map((m) => ({
      name: m.name,
      baseUrl: m.baseUrl,
      model: m.model,
      hasKey: typeof m.key === "string",
      keyTail: typeof m.key === "string" && m.key.length >= 8 ? m.key.slice(-4) : null,
    })),
  };
}

/** The active record, key included, for the door's own use only. @param {Registry} reg */
export function activeModel(reg) {
  return reg.models.find((m) => m.name === reg.active) ?? null;
}

/**
 * A stored file read back strictly: anything that is not a registry this module wrote is refused, never half-used.
 * @param {string} text @returns {{ ok: true, reg: Registry } | { ok: false, why: string }}
 */
export function parseRegistry(text) {
  let j;
  try { j = JSON.parse(text); } catch { return { ok: false, why: "the models file is not JSON" }; }
  if (!j || typeof j !== "object" || j.schema !== SCHEMA || !Array.isArray(j.models)) return { ok: false, why: "the models file is not a schema-1 registry" };
  /** @type {Registry} */
  let reg = emptyRegistry();
  for (const m of j.models) {
    const step = applyChange(reg, { op: "add", model: m });
    if (!step.ok) return { ok: false, why: `the models file holds a bad model: ${step.why}` };
    reg = step.reg;
  }
  if (j.active !== null && !reg.models.some((m) => m.name === j.active)) return { ok: false, why: "the models file names an active model it does not hold" };
  return { ok: true, reg: { ...reg, active: j.active } };
}

// ---------- the file ----------

/**
 * Where the registry lives. Refused inside the door's repo: a key written there is one `git add` from public.
 * @param {string} repo
 * @returns {{ ok: true, path: string } | { ok: false, why: string }}
 */
export function registryPath(repo) {
  const raw = process.env.ARC_FACE_MODELS_FILE;
  const path = resolve(raw && raw.length ? raw : join(homedir(), ".arc-private", "face", "models.json"));
  const real = (/** @type {string} */ p) => { try { return realpathSync(p); } catch { return resolve(p); } };
  // Compare the nearest existing ancestor, so a not-yet-created file under a symlinked repo path is still caught.
  let probe = path;
  while (!existsSync(probe) && dirname(probe) !== probe) probe = dirname(probe);
  const at = real(probe) + path.slice(probe.length);
  const root = real(repo);
  const inside = (a, b) => (process.platform === "win32" ? a.toLowerCase() : a).startsWith((process.platform === "win32" ? b.toLowerCase() : b) + sep);
  if (inside(at, root) || at === root) return { ok: false, why: "the models file may not live inside the repo (a key there is one git add from public)" };
  return { ok: true, path };
}

/** @param {string} repo @returns {{ ok: true, reg: Registry, path: string } | { ok: false, why: string }} */
export function loadRegistry(repo) {
  const p = registryPath(repo);
  if (!p.ok) return p;
  if (!existsSync(p.path)) return { ok: true, reg: emptyRegistry(), path: p.path };
  let text;
  // A directory, an unreadable file or a Windows lock is a named refusal, never a raw 500 (attack c50172d B5).
  try { text = readFileSync(p.path, "utf8"); } catch (e) { return { ok: false, why: `the models file could not be read (${/** @type {any} */ (e).code ?? "error"})` }; }
  const parsed = parseRegistry(text);
  return parsed.ok ? { ...parsed, path: p.path } : parsed;
}

/**
 * Write whole-file, via an exclusive temp file and a rename, owner-only where the OS has modes. Answers why it failed
 * rather than throwing, and leaves no temp file behind (attack c50172d B5).
 * @param {string} path @param {Registry} reg @returns {{ ok: true } | { ok: false, why: string }}
 */
export function saveRegistry(path, reg) {
  const tmp = `${path}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(tmp, JSON.stringify(reg, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    renameSync(tmp, path);
    return { ok: true };
  } catch (e) {
    try { unlinkSync(tmp); } catch { /* never written */ }
    return { ok: false, why: `the models file could not be written (${/** @type {any} */ (e).code ?? "error"})` };
  }
}
