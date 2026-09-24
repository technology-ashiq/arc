#!/usr/bin/env node
// engine-room.mjs -- the Engine room shows driver, model and health, and no key (face v2 Phase 06; ADR-1325).
//
//   1. HEALTH: the room is folded over a fixture spine page of run.completed receipts, and its driver-health rows must
//      name each driver, its run count, how its last run ended, and the model it ran on.
//   2. NO KEY: the no-key check is clean on the fixture, and a provider key planted in ANY read the room holds -- the
//      engine route, the spine page, the lane card, the router file -- FAILs it, naming the read and never the key.
//   3. ONE SET OF SHAPES: face/src/lib/keys.mjs and the spine's redactor (.claude/scripts/hq/lib/redact.mjs) must both
//      catch every sample below; a shape one learns and the other does not is a failure here.
//
// VACUOUS-PASS GUARD: the fold is proven to have read the fixture page before its rows are judged, and the last line
// is "RAN: <n> checks".

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LIB = join(REPO, "face", "src", "lib");
const u = (p) => pathToFileURL(p).href;

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const reg = await import(u(join(LIB, "registry.mjs")));
const keys = await import(u(join(LIB, "keys.mjs")));
const redact = await import(u(join(REPO, ".claude", "scripts", "hq", "lib", "redact.mjs")));
const dir = join(REPO, "face", "src", "modules", "kernel", "engine-room");
const manifest = (await import(u(join(dir, "module.mjs")))).default;
const { fold } = await import(u(join(dir, "fold.mjs")));
const registry = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
const room = registry.rooms.find((r) => r.id === "engine-room");
check("fixture: the served registry has the engine room, homing run.completed (vacuous-pass guard)",
  room !== undefined && JSON.stringify(room.holds || {}).includes("run.completed"), JSON.stringify(room && room.holds));
const ctx = { room, rooms: registry.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: registry.inventories, laneMap: undefined, picks: {}, manifest };
const ok = (data) => ({ state: "ok", data });

const run = (id, ts, driver, model, outcome, process) => ({ day: ts.slice(0, 10), seq: 1, event: { id, ts, kind: "run.completed", outcome, actor: "arc-run", venture: "", payload: { process, driver, model, duration_ms: 1200 } } });
const page = {
  count: 3, more: false, next: null, torn: 0, unreadableDays: 0,
  events: [
    run("01K00000000000000000000001", "2026-09-20T10:00:00+05:30", "claude-code", "claude-sonnet-5", "ok", "review-diff@1.0.0"),
    run("01K00000000000000000000002", "2026-09-21T10:00:00+05:30", "claude-code", "claude-sonnet-5", "fail", "attack-diff@1.0.0"),
    run("01K00000000000000000000003", "2026-09-22T10:00:00+05:30", "generic-api", "openrouter/qwen/qwen3.8-27b:free", "ok", "attack-diff@1.0.0"),
  ],
};
const engine = { route: "/api/engine", classes: [{ name: "review-diff", tier: "balanced-workhorse", driver: "claude-code", fallback: [], cap: "", hosted: "", judge: "", review_by: "", expired: false }], drivers: ["claude-code", "generic-api", "mock"], faults: [], budgets: null, budgetsRefused: "no ceiling file" };

/** Fold once to learn the reads, then again with each answered; `plant` edits one route's body first. */
function foldWith(plant = {}) {
  const first = fold({}, ctx);
  const payloads = Object.create(null);
  const answered = [];
  for (const r of reg.plannedReads(first, manifest).reads) {
    const body = r.route === "/api/spine" ? page : r.route === "/api/engine" ? engine : undefined;
    const planted = Object.hasOwn(plant, r.route) ? plant[r.route](body ?? {}) : body;
    if (planted !== undefined) { payloads[r.key] = ok(planted); answered.push(r.route); }
  }
  return { f: fold(payloads, ctx), answered };
}

// ---- 1. health ----
{
  const { f, answered } = foldWith();
  check("the fold read the fixture spine page and the engine route (vacuous-pass guard)", answered.includes("/api/spine") && answered.includes("/api/engine") && f.trail.isDrawn === true, JSON.stringify({ answered, drawn: f.trail.isDrawn }));
  const byName = Object.fromEntries(f.health.map((r) => [r.name, r]));
  check("HEALTH: one row per driver that ran", f.hasHealth && f.health.length === 2 && byName["claude-code"] && byName["generic-api"], JSON.stringify(f.health.map((r) => r.name)));
  check("HEALTH: a driver's row counts its runs", /^2 runs/.test(byName["claude-code"].runs) && /^1 run/.test(byName["generic-api"].runs), JSON.stringify([byName["claude-code"].runs, byName["generic-api"].runs]));
  check("HEALTH: the row says how the driver's LAST run ended (the newest, not the first on the page)", byName["claude-code"].last === "last fail" && byName["generic-api"].last === "last ok", JSON.stringify([byName["claude-code"].last, byName["generic-api"].last]));
  check("HEALTH: the row names the model the driver ran on", /model claude-sonnet-5/.test(byName["claude-code"].detail) && /model openrouter\/qwen/.test(byName["generic-api"].detail), JSON.stringify([byName["claude-code"].detail, byName["generic-api"].detail]));
  check("NO KEY: the clean fixture has no key in any read", f.hasKeyLeak === false && f.keyLeaks.length === 0 && f.keyLeakText === "", JSON.stringify(f.keyLeaks));
  const empty = foldWith({ "/api/spine": () => ({ ...page, count: 0, events: [] }) }).f;
  check("HEALTH: a page with no runs is said as that, never as no driver", empty.showHealthEmpty === true && empty.health.length === 0);
}

// ---- 2. no key, planted in every read the room holds ----
{
  const planted = "sk-ant-api03-" + "Z".repeat(48);
  const cases = [
    ["/api/engine", (b) => ({ ...b, classes: [{ ...b.classes[0], judge: planted }] })],
    ["/api/spine", (b) => ({ ...b, events: [...b.events.slice(0, 2), { ...b.events[2], event: { ...b.events[2].event, payload: { ...b.events[2].event.payload, note: `key ${planted}` } } }] })],
    ["/api/engine", (b) => ({ ...b, faults: [`router line 3: ${"AKIA" + "Q".repeat(16)}`] })],
    ["/api/engine", (b) => ({ ...b, drivers: [...b.drivers, { [planted]: true }] })],
  ];
  const reads = reg.plannedReads(fold({}, ctx), manifest).reads.map((r) => r.route);
  for (const other of ["/api/lane/:id", "/api/file/:id"]) if (reads.includes(other)) cases.push([other, () => ({ lane: "engine", note: planted })]);
  check("fixture: the planted cases reach every route the room reads that can carry text (vacuous-pass guard)", ["/api/engine", "/api/spine"].every((r) => cases.some(([c]) => c === r)), JSON.stringify(reads));
  for (const [route, edit] of cases) {
    const { f } = foldWith({ [route]: edit });
    check(`NO KEY: a key planted in ${route} FAILs the check, naming the read and never the key`,
      f.hasKeyLeak === true && f.keyLeaks.some((l) => l.includes(route.replace(":id", ""))) && !f.keyLeakText.includes(planted) && !f.keyLeakText.includes("QQQQ"),
      JSON.stringify(f.keyLeaks));
  }
}

// ---- 3. one set of shapes ----
{
  const samples = {
    "anthropic-key": "sk-ant-api03-" + "a".repeat(40),
    "openai-key": "sk-proj-" + "b".repeat(40),
    "github-token": "ghp_" + "c".repeat(36),
    "github-fine-grained-pat": "github_pat_" + "d".repeat(30),
    "aws-access-key-id": "AKIA" + "E".repeat(16),
    "google-api-key": "AIza" + "f".repeat(35),
    "stripe-key": "sk_live_" + "g".repeat(24),
    "slack-token": "xoxb-" + "h".repeat(20),
    "private-key-block": "-----BEGIN RSA PRIVATE KEY-----",
  };
  check("every face key rule has a sample, and every sample a face rule", keys.KEY_RULES.length === Object.keys(samples).length && keys.KEY_RULES.every((r) => Object.hasOwn(samples, r.name)));
  for (const [name, sample] of Object.entries(samples)) {
    const face = keys.keyShapes({ v: sample }).includes(name);
    const spineRule = redact.DENY_RULES.find((r) => r.name === name);
    check(`ONE SET: ${name} is caught by the face AND by the spine's redactor`, face && spineRule !== undefined && spineRule.re.test(sample), `face=${face} spine=${spineRule ? spineRule.re.test(sample) : "no rule"}`);
  }
}

console.log(`RAN: ${ran} checks`);
process.exitCode = failed === 0 && ran >= 20 ? 0 : 1;
