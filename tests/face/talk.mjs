#!/usr/bin/env node
// talk.mjs -- face v2 Phase 10 (REQ-14, ADR-1350): the face talks.
//
//   A  the owner's model registry, as pure decisions (.claude/scripts/hq/lib/face/models.mjs): add, switch, remove,
//      a bad URL refused, a duplicate name refused, a key never in the public view.
//   B  the door: GET /api/models and POST /api/models/set on a live door with the registry in a sandbox; a planted key
//      appears in no response and nowhere in the repo tree. A MUTANT view that echoes the key is the negative control.
//   C  Ask on the owner's model, through the real arc-run and generic-api against tests/face/fake-llm.mjs: a general
//      question comes back labelled general with no citations; an arc answer citing a receipt on the spine is verified;
//      one citing an id off the spine is unverified; the provider got the owner's key and model id; the run is receipted.
//   D  with no model added, a question the reader cannot reach says how to add one -- never a blank, never an error.
//
// Every section first asserts it RAN (the module loaded, the door came up) before asserting what it printed.

import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { startFakeLlm, GHOST_ID, scriptedAnswer, questionOf } from "./fake-llm.mjs";
import { judgeModelAnswer, GENERAL_LABEL, ARC_LABEL, UNVERIFIED_LABEL } from "../../.claude/scripts/hq/arc-dash.mjs";
import { unescapeDoorText } from "../../face/src/lib/door.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const MODELS = join(REPO, ".claude", "scripts", "hq", "lib", "face", "models.mjs");
const PORT = 8461;
const LLM_PORT = 8462;
const TOKEN = "talk-token";
const ORIGIN = `http://127.0.0.1:${PORT}`;
// Built from parts so the literal never sits in this file whole: the repo-tree check below must find it nowhere.
const PLANTED = ["sk", "or", "v1", "PLANTEDtalkKEY", "9f3a"].join("-");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};

// ── A: the registry's decisions ──
const m = await import(pathToFileURL(MODELS).href);
check("A: models.mjs loaded its decisions (vacuous-pass guard)",
  ["applyChange", "publicView", "checkBaseUrl", "parseRegistry", "registryPath", "activeModel", "endpointOf"].every((k) => typeof m[k] === "function"));

const add = (reg, model) => m.applyChange(reg, { op: "add", model });
let reg = m.emptyRegistry();
let s = add(reg, { name: "OpenRouter free", baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct:free", key: PLANTED });
check("A: add -- the first model is stored and becomes active", s.ok && s.reg.models.length === 1 && s.reg.active === "OpenRouter free", JSON.stringify(s.ok ? s.reg.active : s.why));
reg = s.reg;
s = add(reg, { name: "Local", baseUrl: "http://localhost:11434/v1/", model: "llama3.2" });
check("A: add -- a local model with no key; the active model does not move", s.ok && s.reg.models.length === 2 && s.reg.active === "OpenRouter free" && s.reg.models[1].baseUrl === "http://localhost:11434/v1" && !("key" in s.reg.models[1]));
reg = s.reg;
s = m.applyChange(reg, { op: "activate", name: "local" });
check("A: switch -- activate by name, case-insensitive", s.ok && s.reg.active === "Local");
const switched = s.ok ? s.reg : reg;
s = m.applyChange(switched, { op: "remove", name: "Local" });
check("A: remove the active model -- the next one becomes active", s.ok && s.reg.models.length === 1 && s.reg.active === "OpenRouter free");
s = m.applyChange(m.emptyRegistry(), { op: "remove", name: "x" });
check("A: remove an unknown name is refused", !s.ok && /no model is named/.test(s.why));
s = add(reg, { name: "openrouter FREE", baseUrl: "https://x.example/v1", model: "a" });
check("A: a duplicate name (any case) is refused", !s.ok && /already exists/.test(s.why), s.ok ? "accepted" : s.why);
const badUrls = [
  ["http://api.example.com/v1", /plain http/],
  ["ftp://x/v1", /http or https/],
  ["https://user:pw@x.example/v1", /user or password/],
  ["https://x.example/v1?key=abc", /query or fragment/],
  ["not a url", /does not parse/],
  ["", /1 to 300/],
];
const urlVerdicts = badUrls.map(([u, re]) => { const r = add(reg, { name: `bad${badUrls.findIndex((b) => b[0] === u)}`, baseUrl: u, model: "a" }); return !r.ok && re.test(r.why); });
check("A: a bad base URL is refused, each for its own reason (6 of 6)", urlVerdicts.every(Boolean), JSON.stringify(urlVerdicts));
s = add(reg, { name: "trailing", baseUrl: "https://openrouter.ai/api/v1/chat/completions", model: "a" });
check("A: a pasted full endpoint is reduced to its base, and endpointOf rebuilds it once",
  s.ok && s.reg.models[1].baseUrl === "https://openrouter.ai/api/v1" && m.endpointOf(s.reg.models[1].baseUrl) === "https://openrouter.ai/api/v1/chat/completions");
const badFields = [
  { op: "add", model: { name: "x", baseUrl: "https://a.b/v1", model: "a", extra: 1 } },
  { op: "add", model: { name: " ", baseUrl: "https://a.b/v1", model: "a" } },
  { op: "add", model: { name: "x", baseUrl: "https://a.b/v1", model: "has space" } },
  { op: "add", model: { name: "x", baseUrl: "https://a.b/v1", model: "a", key: "has space" } },
  { op: "add", model: { name: "x", baseUrl: "https://a.b/v1", model: "a" }, key: "smuggled" },
  { op: "read", name: "OpenRouter free" },
  { op: "activate", name: "OpenRouter free", key: "x" },
];
check("A: a malformed change is refused (7 of 7), and no op reads a record back", badFields.every((b) => !m.applyChange(reg, b).ok));

const view = m.publicView(reg);
check("A: the public view carries no key -- hasKey and the last four characters only",
  !JSON.stringify(view).includes(PLANTED) && view.models[0].hasKey === true && view.models[0].keyTail === PLANTED.slice(-4) && !("key" in view.models[0]));
// MUTANT CONTROL: a view that leaks the record whole. The same assertion must FAIL it, or the check above proved nothing.
const leaky = { ...view, models: reg.models };
check("A: MUTANT CONTROL -- a view that echoes the record FAILs the same check", JSON.stringify(leaky).includes(PLANTED));
const round = m.parseRegistry(JSON.stringify(reg));
check("A: the stored file reads back to the same registry", round.ok && JSON.stringify(round.reg) === JSON.stringify(reg));
const tampered = m.parseRegistry(JSON.stringify({ ...reg, active: "ghost" }));
check("A: a stored file naming an active model it does not hold is refused", !tampered.ok);
const prevEnv = process.env.ARC_FACE_MODELS_FILE;
process.env.ARC_FACE_MODELS_FILE = join(REPO, "initiatives", "face", "models.json");
const inRepo = m.registryPath(REPO);
if (prevEnv === undefined) delete process.env.ARC_FACE_MODELS_FILE; else process.env.ARC_FACE_MODELS_FILE = prevEnv;
check("A: a models file inside the repo is refused (a key there is one git add from public)", !inRepo.ok && /inside the repo/.test(inRepo.why));

// ── C0: the door's judge of a model reply, held directly ──
const ids = new Set(["01J0000000000000000000000A"]);
const jg = judgeModelAnswer(JSON.stringify({ lane: "general", answer: "x", citations: ["01J0000000000000000000000A"] }), "", ids);
check("C0: a general reply is labelled general and its citations are DROPPED, whatever the model sent", jg.label === GENERAL_LABEL && jg.citations.length === 0 && jg.verified === false);
const ja = judgeModelAnswer(JSON.stringify({ lane: "arc", answer: "x", citations: ["01J0000000000000000000000A"] }), "arc-run: receipt run.completed 01J0000000000000000000000B\n", ids);
check("C0: an arc reply whose every citation is on the record is verified, and the receipt line is read", ja.verified === true && ja.label === ARC_LABEL && ja.receipt === "01J0000000000000000000000B");
const ju = judgeModelAnswer(JSON.stringify({ lane: "arc", answer: "x", citations: ["01J0000000000000000000000A", "01ZZZZZZZZZZZZZZZZZZZZZZZZ", "not-an-id"] }), "", ids);
check("C0: one citation off the record makes the whole arc answer unverified, each bad id named", ju.verified === false && ju.label === UNVERIFIED_LABEL && ju.unresolved.length === 2);
const jn = judgeModelAnswer(JSON.stringify({ lane: "arc", answer: "x", citations: [] }), "", ids);
check("C0: an arc reply that cites nothing is never shown as verified", jn.verified === false && jn.label !== ARC_LABEL && jn.label.startsWith(ARC_LABEL));
// MUTANT CONTROL: a judge that trusts the model's own lane-and-citation claim would pass the ghost id. Show that the
// ghost really is absent from the ids, so the unverified verdict above is the check working, not an empty set.
check("C0: MUTANT CONTROL -- the ghost id is well-formed, so only the record lookup can reject it", /^[0-9A-HJKMNP-TV-Z]{26}$/.test(GHOST_ID) && !ids.has(GHOST_ID));
const bad = ["", "not json", JSON.stringify({ lane: "other", answer: "x", citations: [] }), JSON.stringify({ lane: "arc", answer: "", citations: [] }), JSON.stringify({ lane: "arc", answer: "x" })];
check("C0: a reply that is not the face-ask contract is refused, never shown (5 of 5)", bad.every((b) => { try { judgeModelAnswer(b, "", ids); return false; } catch (e) { return e.code === "ASK_FAILED"; } }));
check("C0: the fake reads the question out of the generic-api prompt and scripts each lane",
  questionOf("body\n---\nINPUT (JSON):\n" + JSON.stringify({ q: "Which gate?" }) + "\n") === "Which gate?" && scriptedAnswer("which gate", "X").citations[0] === "X" && scriptedAnswer("boiling", "X").lane === "general");

// ── B: the door ──
const sandbox = mkdtempSync(join(tmpdir(), "face-talk-"));
const modelsFile = join(sandbox, "private", "models.json");
const spineDir = join(sandbox, "spine");
const gen = JSON.parse(execFileSync(process.execPath, [join(REPO, "tests/fixtures/face/gen-spine.mjs"), "--out", spineDir, "--count", "200", "--days", "3", "--seed", "talk-1"], { stdio: ["ignore", "pipe", "inherit"] }).toString());
const CITE = gen.openApproval;
const llm = await startFakeLlm({ port: LLM_PORT, citeId: CITE });
const dash = spawn(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--spine", spineDir, "--port", String(PORT)],
  { env: { ...process.env, ARC_DASH_TOKEN: TOKEN, ARC_DASH_JOURNAL_DIR: join(sandbox, "journal"), ARC_FACE_MODELS_FILE: modelsFile }, stdio: ["ignore", "ignore", "pipe"] });
let stderr = "";
dash.stderr.on("data", (d) => { stderr += d; });
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

let up = false;
for (let i = 0; i < 50 && !up; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { up = (await j("/api/health", { headers: H })).status === 200; } catch { /* not yet */ }
}
try {
  check("B: the door came up (vacuous-pass guard)", up, stderr.slice(0, 300));
  check("C: the fixture spine names an open approval to cite (vacuous-pass guard)", typeof CITE === "string" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(CITE), String(CITE));
  // ── D: no model added yet ──
  let d = await post("/api/ask", { q: "What is the boiling point of water at sea level?" });
  check("D: no model added -- the reader answers and the door says a model is needed (200, never an error page)",
    d.status === 200 && d.body.needsModel === true && typeof d.body.answer === "string" && d.body.answer.length > 0 && String(d.body.source).startsWith("deterministic"), JSON.stringify(d.body).slice(0, 300));
  check("D: and the provider was never called", llm.requests.length === 0, `requests=${llm.requests.length}`);
  let r = await j("/api/models", { headers: H });
  check("B: GET /api/models before any save -- an empty registry, no file written", r.status === 200 && Array.isArray(r.body.models) && r.body.models.length === 0 && r.body.active === null && !existsSync(modelsFile), JSON.stringify(r.body));
  r = await j("/api/models");
  check("B: GET /api/models without the token is refused", r.status === 401);
  r = await j("/api/models/set", { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ op: "add", model: { name: "x", baseUrl: "https://a.b/v1", model: "a" } }) });
  check("B: a models write with no Origin is refused (a mutating route)", r.status === 403 && r.body.error === "NO_ORIGIN", JSON.stringify(r.body));
  r = await post("/api/models/set", { op: "add", model: { name: "OpenRouter free", baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct:free", key: PLANTED } });
  check("B: add over the door -- saved, active, and the answer shows the key's tail only",
    r.status === 200 && r.body.active === "OpenRouter free" && r.body.models[0].hasKey === true && r.body.models[0].keyTail === PLANTED.slice(-4), JSON.stringify(r.body));
  check("B: the registry file holds the key (the door can use it)", existsSync(modelsFile) && readFileSync(modelsFile, "utf8").includes(PLANTED));
  r = await post("/api/models/set", { op: "add", model: { name: "x", baseUrl: "http://api.example.com/v1", model: "a" } });
  check("B: a refused change answers 400 BAD_MODEL with the reason", r.status === 400 && r.body.error === "BAD_MODEL" && /plain http/.test(r.body.message || ""), JSON.stringify(r.body));
  r = await j("/api/models", { headers: H });
  check("B: GET after the save shows the model, not the key", r.status === 200 && r.body.models.length === 1 && r.body.models[0].keyTail === PLANTED.slice(-4));

  // ── C: Ask on the owner's model ──
  r = await post("/api/models/set", { op: "add", model: { name: "Fake", baseUrl: `http://127.0.0.1:${LLM_PORT}/v1`, model: "fake/owner-model:free", key: PLANTED } });
  r = r.status === 200 ? await post("/api/models/set", { op: "activate", name: "Fake" }) : r;
  check("C: the fake provider is added and active", r.status === 200 && r.body.active === "Fake", JSON.stringify(r.body).slice(0, 300));
  const ask = async (q) => { const x = await post("/api/ask", { q }); return { ...x, label: unescapeDoorText(String(x.body.label ?? "")) }; };
  const g = await ask("What is the boiling point of water at sea level?");
  check("C: a general question -- answered by the model, labelled general, no citations",
    g.status === 200 && g.body.source === "model" && g.body.lane === "general" && g.label === GENERAL_LABEL && Array.isArray(g.body.citations) && g.body.citations.length === 0 && /100/.test(String(g.body.answer)),
    JSON.stringify(g.body).slice(0, 400));
  check("C: the answer names the owner's model, not a default", g.body.model && g.body.model.name === "Fake" && g.body.model.id === "fake/owner-model:free", JSON.stringify(g.body.model));
  check("C: the run is receipted -- the answer carries the run.completed id", typeof g.body.receipt === "string" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(g.body.receipt), String(g.body.receipt));
  const sent = llm.requests[0] ?? {};
  check("C: the provider got the owner's key as the bearer and the owner's model id, at /v1/chat/completions",
    llm.requests.length === 1 && sent.bearer === PLANTED && sent.model === "fake/owner-model:free" && sent.path === "/v1/chat/completions" && sent.q === "What is the boiling point of water at sea level?",
    JSON.stringify({ n: llm.requests.length, path: sent.path, model: sent.model, q: sent.q, bearerOk: sent.bearer === PLANTED }));
  const a = await ask("Which gate is the oldest approval in the queue for?");
  check("C: an arc answer citing a receipt on the spine is verified and labelled from arc's record",
    a.status === 200 && a.body.lane === "arc" && a.body.verified === true && a.label === ARC_LABEL && a.body.citations.length === 1 && a.body.citations[0] === CITE && a.body.unresolved.length === 0,
    JSON.stringify(a.body).slice(0, 400));
  const u = await ask("Who wrote the oldest approval request?");
  check("C: an arc answer citing an id that is not on the spine is UNVERIFIED, and names the id",
    u.status === 200 && u.body.lane === "arc" && u.body.verified === false && u.label === UNVERIFIED_LABEL && u.body.unresolved.length === 1 && u.body.unresolved[0] === GHOST_ID,
    JSON.stringify(u.body).slice(0, 400));
  const det = await post("/api/ask", { q: "status" });
  check("C: deterministic first -- a question the reader reaches never calls the model", det.status === 200 && String(det.body.source).startsWith("deterministic") && llm.requests.length === 3, `requests=${llm.requests.length}`);
  const act = await post("/api/ask", { q: "approve the oldest one" });
  check("C: an action request is still refused by the reader, never handed to a model", act.status === 200 && /I read; I do not act/.test(unescapeDoorText(String(act.body.answer))) && llm.requests.length === 3);
  check("B: the planted key appears in NO door response (every body this suite read)", bodies.length >= 7 && bodies.every((b) => !b.includes(PLANTED)), `bodies=${bodies.length}`);
  let grepHit = "";
  try { grepHit = execFileSync("git", ["grep", "-l", "--untracked", "-F", PLANTED], { cwd: REPO, stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch { grepHit = ""; }
  check("B: the planted key is nowhere in the repo tree (tracked or untracked)", grepHit.trim() === "", grepHit.trim());
} finally {
  dash.kill();
  await llm.close();
  try { rmSync(sandbox, { recursive: true, force: true }); } catch { /* a held handle on Windows; the sandbox is temp */ }
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran >= 44 ? 0 : 1);
