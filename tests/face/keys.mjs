#!/usr/bin/env node
// tests/face/keys.mjs -- the owner's keys (face v2 Phase 12, REQ-16, ADR-1351).
//
// A: the store's pure decisions (add · replace · remove, the name grammar, the public view, the file read back).
// R: resolveKey -- the environment first, the store second -- with a mutant that prefers the store.
// F: the file -- outside the repo only, written whole and read back.
// D: the door -- GET /api/keys and POST /api/keys/set never return a value; a planted value is in no body and nowhere
//    in the repo tree.
// G: the generic-api driver reads its key through resolveKey: with ARC_LLM_API_KEY unset and ARC_LLM_KEY_NAME naming a
//    stored key, the fake provider receives exactly that value as the bearer.
// No real provider is ever called; every check runs under node with no install.

import { spawn, spawnSync, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { startFakeLlm } from "./fake-llm.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const K = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "keys.mjs")).href);
/** A port nothing holds right now, from a listen(0) probe. */
const freePort = () => new Promise((res, rej) => { const srv = createServer(); srv.once("error", rej); srv.listen(0, "127.0.0.1", () => { const p = srv.address().port; srv.close(() => res(p)); }); });
// Built from parts, so the literal never sits in this file for the repo-tree search to find.
const PLANTED = ["planted", "keys", "VALUE", randomBytes(6).toString("hex"), "z9y8"].join("-");
const OTHER = ["second", "keys", "VALUE", randomBytes(6).toString("hex"), "q4r5"].join("-");

/**
 * arc-run started WITHOUT blocking this process: the fake provider answers from this event loop, and spawnSync froze it
 * so every attempt timed out with no request recorded (CI 37342372413, section G n=0). Resolves on exit or after 90 s.
 * @param {string[]} args @param {Record<string, string | undefined>} env
 */
const runAsync = (args, env) => new Promise((res) => {
  const c = spawn(process.execPath, args, { cwd: REPO, env, stdio: ["ignore", "ignore", "ignore"] });
  const t = setTimeout(() => { c.kill(); res(null); }, 90_000);
  c.on("exit", (code) => { clearTimeout(t); res(code); });
  c.on("error", () => { clearTimeout(t); res(null); });
});

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};

// ── A: the store's decisions ──
check("A: keys.mjs loaded its decisions (vacuous-pass guard)",
  ["applyKeyChange", "publicKeys", "parseStore", "resolveKey", "explainKey", "storePath", "loadStore", "saveStore", "emptyStore"].every((k) => typeof K[k] === "function"));
let s = K.applyKeyChange(K.emptyStore(), { op: "add", name: "OPENROUTER_API_KEY", value: PLANTED });
check("A: add stores a key", s.ok && s.store.keys.length === 1 && s.store.keys[0].name === "OPENROUTER_API_KEY" && s.store.keys[0].value === PLANTED, JSON.stringify(s.ok ? s.store.keys.map((k) => k.name) : s.why));
const one = s.store;
s = K.applyKeyChange(one, { op: "replace", name: "OPENROUTER_API_KEY", value: OTHER });
check("A: replace changes the value and keeps the name", s.ok && s.store.keys.length === 1 && s.store.keys[0].value === OTHER);
s = K.applyKeyChange(one, { op: "remove", name: "OPENROUTER_API_KEY" });
check("A: remove deletes the key", s.ok && s.store.keys.length === 0);
const refusals = [
  [{ op: "add", name: "OPENROUTER_API_KEY", value: OTHER }, /already exists/],
  [{ op: "replace", name: "NOT_THERE", value: OTHER }, /add it first/],
  [{ op: "remove", name: "NOT_THERE" }, /no key is named/],
  [{ op: "add", name: "lower_case", value: OTHER }, /capital letters/],
  [{ op: "add", name: "1STARTS_WITH_DIGIT", value: OTHER }, /capital letters/],
  [{ op: "add", name: "SHORT_VALUE", value: "abc" }, /8 to 4000/],
  [{ op: "add", name: "SPACED_VALUE", value: "has a space in it" }, /8 to 4000/],
  [{ op: "add", name: "EXTRA_FIELD", value: OTHER, note: "x" }, /not "note"/],
  [{ op: "remove", name: "OPENROUTER_API_KEY", value: OTHER }, /not "value"/],
  [{ op: "read", name: "OPENROUTER_API_KEY" }, /op must be/],
];
const verdicts = refusals.map(([b, re]) => { const r = K.applyKeyChange(one, b); return !r.ok && re.test(r.why); });
check(`A: each malformed change is refused for its own reason (${refusals.length} of ${refusals.length})`, verdicts.every(Boolean), JSON.stringify(verdicts));
let full = K.emptyStore();
for (let i = 0; i < K.MAX_KEYS; i++) full = K.applyKeyChange(full, { op: "add", name: `KEY_${i}`, value: OTHER }).store;
check(`A: at most ${K.MAX_KEYS} keys`, full.keys.length === K.MAX_KEYS && !K.applyKeyChange(full, { op: "add", name: "ONE_MORE", value: OTHER }).ok);

const view = K.publicKeys(one);
check("A: the public view carries no value -- a name, hasValue and the last four characters only",
  !JSON.stringify(view).includes(PLANTED) && view.keys[0].hasValue === true && view.keys[0].tail === PLANTED.slice(-4) && !("value" in view.keys[0]));
check("A: a value under 20 characters shows no tail at all", K.publicKeys(K.applyKeyChange(K.emptyStore(), { op: "add", name: "SHORT_ONE", value: "abcdefgh12" }).store).keys[0].tail === null);
// MUTANT CONTROL: a view that echoes the record. The same assertion must FAIL it.
check("A: MUTANT CONTROL -- a view that echoes the record FAILs the same check", JSON.stringify({ ...view, keys: one.keys }).includes(PLANTED));
const back = K.parseStore(JSON.stringify(one));
check("A: the stored file reads back to the same store", back.ok && JSON.stringify(back.store) === JSON.stringify(one));
check("A: a file with one bad row is refused whole, never half-loaded",
  !K.parseStore(JSON.stringify({ schema: 1, keys: [...one.keys, { name: "bad name", value: OTHER }] })).ok && !K.parseStore("not json").ok && !K.parseStore(JSON.stringify({ schema: 2, keys: [] })).ok);

// ── R: resolveKey ──
check("R: the environment wins when it is set", K.resolveKey("OPENROUTER_API_KEY", { env: { OPENROUTER_API_KEY: "from-env-123" }, store: one }) === "from-env-123");
check("R: the store fills in when the environment lacks the name", K.resolveKey("OPENROUTER_API_KEY", { env: {}, store: one }) === PLANTED);
check("R: an empty environment value is unset, and an unknown name is null",
  K.resolveKey("OPENROUTER_API_KEY", { env: { OPENROUTER_API_KEY: "" }, store: one }) === PLANTED && K.resolveKey("NOT_THERE", { env: {}, store: one }) === null && K.resolveKey("bad name", { env: { "bad name": "x" }, store: one }) === null);
// MUTANT CONTROL: a resolver that prefers the store. The same order check must FAIL it.
const storeFirst = (name, from) => from.store.keys.find((k) => k.name === name)?.value ?? from.env[name] ?? null;
check("R: MUTANT CONTROL -- a store-first resolver FAILs the environment-wins check", storeFirst("OPENROUTER_API_KEY", { env: { OPENROUTER_API_KEY: "from-env-123" }, store: one }) !== "from-env-123");

// ── F: the file ──
const sandbox = mkdtempSync(join(tmpdir(), "face-keys-"));
const keysFile = join(sandbox, "private", "keys.json");
const prev = process.env.ARC_KEYS_FILE;
try {
  process.env.ARC_KEYS_FILE = join(REPO, "initiatives", "face", "keys.json");
  const inside = K.storePath(REPO);
  check("F: a keys file inside the repo is refused", !inside.ok && /inside the repo/.test(inside.why), JSON.stringify(inside));
  process.env.ARC_KEYS_FILE = keysFile;
  const at = K.storePath(REPO);
  const saved = at.ok ? K.saveStore(at.path, one) : at;
  const loaded = K.loadStore(REPO);
  check("F: saved outside the repo and read back whole, with no temp file left", at.ok && saved.ok && loaded.ok && loaded.store.keys[0].value === PLANTED && fs.readdirSync(dirname(keysFile)).length === 1,
    JSON.stringify({ at: at.ok, saved: saved.ok, loaded: loaded.ok, files: existsSync(dirname(keysFile)) ? fs.readdirSync(dirname(keysFile)) : [] }));
  check("F: resolveKey with no store given reads the file", K.resolveKey("OPENROUTER_API_KEY", { env: {} }) === PLANTED);
  // A store that cannot be read is named, never read as "not set" (attack 13c0c77 B2); an empty file is an empty store (B7).
  writeFileSync(keysFile, "{ torn");
  const torn = K.explainKey("OPENROUTER_API_KEY", { env: {} });
  writeFileSync(keysFile, "");
  const empty = K.loadStore(REPO);
  check("F: a torn keys file is named by explainKey, and an empty file reads as an empty store",
    torn.value === null && /not JSON/.test(String(torn.why)) && empty.ok && empty.store.keys.length === 0, JSON.stringify({ torn, empty: empty.ok }));
  process.env.ARC_KEYS_FILE = "relative/keys.json";
  const rel = K.storePath(null);
  check("F: a relative ARC_KEYS_FILE is refused by name, for the door and for a tool alike (attack 13c0c77 B5)", !rel.ok && /absolute/.test(rel.why) && !K.storePath(REPO).ok, JSON.stringify(rel));
} finally {
  if (prev === undefined) delete process.env.ARC_KEYS_FILE; else process.env.ARC_KEYS_FILE = prev;
}

// ── D: the door ──
const PORT = await freePort();
const LLM_PORT = await freePort();
const TOKEN = `keys-${randomBytes(8).toString("hex")}`;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const doorFile = join(sandbox, "door", "keys.json");
const spineDir = join(sandbox, "spine");
execFileSync(process.execPath, [join(REPO, "tests/fixtures/face/gen-spine.mjs"), "--out", spineDir, "--count", "20", "--days", "1", "--seed", "keys-1"], { stdio: ["ignore", "ignore", "inherit"] });
const dash = spawn(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--spine", spineDir, "--port", String(PORT)],
  { env: { ...process.env, ARC_DASH_TOKEN: TOKEN, ARC_DASH_JOURNAL_DIR: join(sandbox, "journal"), ARC_KEYS_FILE: doorFile, ARC_FACE_MODELS_FILE: join(sandbox, "door", "models.json") }, stdio: ["ignore", "ignore", "pipe"] });
let stderr = "";
dash.stderr.on("data", (d) => { stderr += d; });
let spawnError = null;
dash.on("error", (e) => { spawnError = e; });
const H = { Authorization: `Bearer ${TOKEN}` };
const bodies = [];
const j = async (path, opts = {}) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, opts);
  const text = await r.text();
  bodies.push(text);
  let body; try { body = JSON.parse(text); } catch { body = {}; }
  return { status: r.status, body };
};
const post = (path, body) => j(path, { method: "POST", headers: { ...H, Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
/** @type {{ close: () => Promise<void>, requests: any[] } | null} */
let llm = null;
let up = false;
for (let i = 0; i < 50 && !up && !spawnError; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { up = (await j("/api/health", { headers: H })).status === 200; } catch { /* not yet */ }
}
try {
  check("D: the door came up (vacuous-pass guard)", up && !spawnError, String(spawnError ?? stderr.slice(0, 300)));
  let r = await j("/api/keys", { headers: H });
  check("D: GET /api/keys before any save -- an empty list, no file written", r.status === 200 && Array.isArray(r.body.keys) && r.body.keys.length === 0 && !existsSync(doorFile), JSON.stringify(r.body).slice(0, 200));
  r = await j("/api/keys");
  check("D: GET /api/keys without the token is refused", r.status === 401);
  r = await post("/api/keys/set", { op: "add", name: "OPENROUTER_API_KEY", value: PLANTED });
  check("D: add through the door -- the answer names the key and its tail, never the value",
    r.status === 200 && r.body.keys?.[0]?.name === "OPENROUTER_API_KEY" && r.body.keys[0].tail === PLANTED.slice(-4) && !JSON.stringify(r.body).includes(PLANTED), JSON.stringify(r.body).slice(0, 200));
  check("D: the file outside the repo holds the value (the tools can read it)", existsSync(doorFile) && readFileSync(doorFile, "utf8").includes(PLANTED));
  r = await post("/api/keys/set", { op: "add", name: "OPENROUTER_API_KEY", value: OTHER });
  const r2 = await post("/api/keys/set", { op: "add", name: "lower", value: OTHER });
  check("D: a duplicate name and a bad name are refused (400 BAD_KEY), the file unchanged",
    r.status === 400 && r.body.error === "BAD_KEY" && r2.status === 400 && r2.body.error === "BAD_KEY" && readFileSync(doorFile, "utf8").includes(PLANTED) && !readFileSync(doorFile, "utf8").includes(OTHER));
  r = await post("/api/keys/set", { op: "replace", name: "OPENROUTER_API_KEY", value: OTHER });
  check("D: replace through the door -- the new tail, and the value in no answer", r.status === 200 && r.body.keys?.[0]?.tail === OTHER.slice(-4) && !JSON.stringify(r.body).includes(OTHER));
  r = await post("/api/keys/set", { op: "replace", name: "OPENROUTER_API_KEY", value: PLANTED });
  check("D: replaced back for the driver check below", r.status === 200 && r.body.keys?.[0]?.tail === PLANTED.slice(-4));

  // ── G: the generic-api driver reads its key through resolveKey ──
  llm = await startFakeLlm({ port: LLM_PORT, citeId: "01J0000000000000000000000A" });
  const runEnv = { ...process.env, ARC_LLM_ENDPOINT: `http://127.0.0.1:${LLM_PORT}/v1/chat/completions`, ARC_KEYS_FILE: doorFile, ARC_LLM_KEY_NAME: "OPENROUTER_API_KEY", ARC_SPINE_ROOT: spineDir, ARC_LLM_TIMEOUT_MS: "20000" };
  delete runEnv.ARC_LLM_API_KEY;
  delete runEnv.OPENROUTER_API_KEY;
  const before = llm.requests.length;
  await runAsync([join(REPO, ".claude/scripts/engine/arc-run.mjs"), "--process", "face-ask", "--driver", "generic-api", "--owner-model", "fake/owner-model:free", "--input", JSON.stringify({ q: "What is 2 + 2?", state: "MODE: sim (keys test)" })],
    runEnv);
  const sent = llm.requests[before];
  check("G: with ARC_LLM_API_KEY unset, the driver sent the stored key named by ARC_LLM_KEY_NAME", llm.requests.length > before && sent?.bearer === PLANTED,
    JSON.stringify({ n: llm.requests.length - before, bearerTail: sent?.bearer ? String(sent.bearer).slice(-4) : null }));
  const envWins = { ...runEnv, OPENROUTER_API_KEY: "from-the-environment-777" };
  const before2 = llm.requests.length;
  await runAsync([join(REPO, ".claude/scripts/engine/arc-run.mjs"), "--process", "face-ask", "--driver", "generic-api", "--owner-model", "fake/owner-model:free", "--input", JSON.stringify({ q: "What is 2 + 2?", state: "MODE: sim (keys test)" })],
    envWins);
  check("G: a set environment variable of that name still wins over the store", llm.requests[before2]?.bearer === "from-the-environment-777", JSON.stringify({ n: llm.requests.length - before2 }));

  r = await post("/api/keys/set", { op: "remove", name: "OPENROUTER_API_KEY" });
  check("D: remove through the door -- the list is empty and the value is gone from the file", r.status === 200 && r.body.keys?.length === 0 && !readFileSync(doorFile, "utf8").includes(PLANTED));

  check("D: the planted values appear in NO door response (every body this suite read)", bodies.length >= 8 && bodies.every((b) => !b.includes(PLANTED) && !b.includes(OTHER)), `bodies=${bodies.length}`);
  // And nowhere in the repo tree, tracked or not -- with a needle planted in the tree as the negative control.
  const grep = (needle) => spawnSync("git", ["grep", "-l", "--untracked", "--no-exclude-standard", "-F", needle], { cwd: REPO, encoding: "utf8" });
  const g0 = grep(PLANTED);
  check("D: the planted value is nowhere in the repo tree (git grep exits 1: searched, no match)", g0.status === 1, `status=${g0.status} ${String(g0.stdout).slice(0, 200)}`);
  const needle = ["keys", "control", randomBytes(6).toString("hex")].join("-");
  const probe = join(REPO, `.keys-control-${process.pid}.tmp`);
  let g1 = null;
  try { writeFileSync(probe, needle); g1 = grep(needle); } finally { try { rmSync(probe, { force: true }); } catch { /* best effort */ } }
  check("D: MUTANT CONTROL -- the same search finds a needle planted in the tree (exit 0)", g1 && g1.status === 0 && String(g1.stdout).includes(".keys-control-"), `status=${g1 && g1.status}`);
} finally {
  dash.kill();
  if (llm) await llm.close();
  try { rmSync(sandbox, { recursive: true, force: true }); } catch { /* a held handle on Windows; the sandbox is temp */ }
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
// Exact, not a floor: a check deleted from this file is a short run, never a clean one.
const EXPECTED = 34;
if (ran !== EXPECTED) console.log(`FAIL the suite ran ${ran} checks, it declares ${EXPECTED}`);
process.exit(failed === 0 && ran === EXPECTED ? 0 : 1);
