#!/usr/bin/env node
// engine-room.mjs -- the Engine room shows driver, model and health, and no key (face v2 Phase 06; ADR-1325).
//
//   1. HEALTH: the room folded over a fixture spine page of run.completed receipts draws one row per driver with its
//      run count, its LAST run's outcome and its model; a partial page says "on this page"; a receipt that names no
//      driver is counted; hostile driver names group as text.
//   2. NO KEY, IN THE READ HOST: a provider key planted in EVERY read the room holds -- whatever the read's state, in
//      any field -- is named by the read and WITHHELD: no byte of it survives anywhere in the folded room, through the
//      engine-room fold AND through registry.foldModule, the host every room folds through. A value nested past the
//      scan depth is withheld whole and named, never passed as clean.
//   3. ONE SET OF SHAPES: the set is DERIVED from the spine redactor's rule names (every provider-key rule, the
//      exclusions named with a reason), and each rule is crossed at its minimum length (caught by both) and one below
//      it (caught by neither). Ids that merely contain `sk-` inside a word are not keys.
//
// The expected check count is DERIVED from the case lists, and the suite fails when it ran any other number.

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
const ctx = { room, rooms: registry.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: registry.inventories, laneMap: undefined, picks: {}, manifest };
const ok = (data) => ({ state: "ok", data });

let expected = 0;
const expect = (n) => { expected += n; };

expect(1);
check("fixture: the served registry has the engine room, homing run.completed (vacuous-pass guard)",
  room !== undefined && JSON.stringify(room.holds || {}).includes("run.completed"), JSON.stringify(room && room.holds));

const run = (id, ts, driver, model, outcome) => ({ day: ts.slice(0, 10), seq: 1, event: { id, ts, kind: "run.completed", outcome, actor: "arc-run", venture: "", payload: { process: "attack-diff@1.0.0", ...(driver === undefined ? {} : { driver }), model, duration_ms: 1200 } } });
const base = [
  run("01K00000000000000000000001", "2026-09-20T10:00:00+05:30", "claude-code", "claude-sonnet-5", "ok"),
  run("01K00000000000000000000002", "2026-09-21T10:00:00+05:30", "claude-code", "claude-sonnet-5", "fail"),
  run("01K00000000000000000000003", "2026-09-22T10:00:00+05:30", "generic-api", "openrouter/qwen/qwen3.8-27b:free", "ok"),
];
const pageOf = (events, more = false) => ({ count: events.length, more, next: more ? events[events.length - 1].event.id : null, torn: 0, unreadableDays: 0, events });
const engine = { route: "/api/engine", classes: [{ name: "review-diff", tier: "balanced-workhorse", driver: "claude-code", fallback: [], cap: "", hosted: "", judge: "", review_by: "", expired: false }], drivers: ["claude-code", "generic-api", "mock"], faults: [], budgets: null, budgetsRefused: "no ceiling file" };
const plannedRoutes = reg.plannedReads(fold({}, ctx), manifest).reads.map((r) => r.route);

/**
 * Fold with each planned read answered; `plant` replaces one route's PAYLOAD (state included). Returns the fold, the
 * payloads it was given and which routes were answered.
 */
function foldWith(page, plant = {}) {
  const payloads = Object.create(null);
  const answered = [];
  for (const r of reg.plannedReads(fold({}, ctx), manifest).reads) {
    const body = r.route === "/api/spine" ? page : r.route === "/api/engine" ? engine : undefined;
    const p = Object.hasOwn(plant, r.route) ? plant[r.route](body) : body === undefined ? undefined : ok(body);
    if (p !== undefined) { payloads[r.key] = p; answered.push(r.route); }
  }
  return { f: fold(payloads, ctx), payloads, answered };
}

// ---- 1. health ----
{
  const { f, answered } = foldWith(pageOf(base));
  expect(6);
  check("the fold read the fixture spine page and the engine route (vacuous-pass guard)", answered.includes("/api/spine") && answered.includes("/api/engine") && f.trail.isDrawn === true, JSON.stringify({ answered, drawn: f.trail.isDrawn }));
  const by = Object.fromEntries(f.health.map((r) => [r.name, r]));
  check("HEALTH: one row per driver that ran, with its run count", f.health.length === 2 && /^2 runs$/.test(by["claude-code"].runs) && /^1 run$/.test(by["generic-api"].runs), JSON.stringify(f.health.map((r) => [r.name, r.runs])));
  check("HEALTH: the row says how the driver's LAST run ended (the newest, not the first on the page)", by["claude-code"].last === "last fail" && by["generic-api"].last === "last ok", JSON.stringify([by["claude-code"].last, by["generic-api"].last]));
  check("HEALTH: the row names the model the driver ran on", /model claude-sonnet-5/.test(by["claude-code"].detail) && /model openrouter\/qwen/.test(by["generic-api"].detail), JSON.stringify([by["claude-code"].detail, by["generic-api"].detail]));
  check("NO KEY: the clean fixture has no key in any read", f.hasKeyLeak === false && f.keyLeaks.length === 0 && f.keyLeakText === "", JSON.stringify(f.keyLeaks));
  check("HEALTH: a page with no runs is said as that, never as no driver", foldWith(pageOf([])).f.showHealthEmpty === true);

  const partial = foldWith(pageOf(base, true)).f;
  expect(1);
  check("HEALTH: on a PARTIAL page a row says 'on this page', never a bare current 'last ok'", partial.health.length === 2 && partial.health.every((r) => /^last on this page: /.test(r.last) && / on that page$/.test(r.runs)), JSON.stringify(partial.health.map((r) => [r.last, r.runs])));

  const hostile = foldWith(pageOf([
    ...base,
    run("01K00000000000000000000004", "2026-09-23T10:00:00+05:30", "__proto__", "m", "ok"),
    run("01K00000000000000000000005", "2026-09-23T11:00:00+05:30", "constructor", "m", "ok"),
    run("01K00000000000000000000006", "2026-09-23T12:00:00+05:30", undefined, "m", "ok"),
    run("01K00000000000000000000007", "2026-09-23T13:00:00+05:30", "", "m", "ok"),
    // Whitespace-only and zero-width names are no name either (round-2 attack 4010c52 B9).
    run("01K00000000000000000000008", "2026-09-23T14:00:00+05:30", "   ", "m", "ok"),
    run("01K00000000000000000000009", "2026-09-23T15:00:00+05:30", String.fromCharCode(0x200b), "m", "ok"),
  ])).f;
  expect(2);
  check("HEALTH: hostile driver names group as plain text", hostile.health.some((r) => r.name === "__proto__") && hostile.health.some((r) => r.name === "constructor") && hostile.health.length === 4, JSON.stringify(hostile.health.map((r) => r.name)));
  check("HEALTH: receipts that name no driver -- absent, empty, blank or invisible -- are counted and said, never a row", /^4 run receipts on this page name no driver/.test(hostile.healthNote), hostile.healthNote);
}

// ---- 2. no key, in every read, in every state, through the fold AND the read host ----
{
  const planted = "sk-ant-api03-" + "Z".repeat(48);
  const aws = "AKIA" + "Q".repeat(16);
  // DERIVED from the reads the room plans: every route must have a planted case, or this list is short (B7).
  /** @type {Record<string, (body: unknown) => unknown>} */
  const byRoute = {
    "/api/engine": (b) => ok({ ...b, classes: [{ ...b.classes[0], judge: planted }] }),
    "/api/spine": () => ok(pageOf([...base.slice(0, 2), { ...base[2], event: { ...base[2].event, payload: { ...base[2].event.payload, model: planted } } }])),
    "/api/lane/:id": () => ok({ lane: "engine", note: planted }),
    "/api/file/:id": () => ok({ id: "router", text: `# ${planted}` }),
  };
  const missing = plannedRoutes.filter((r) => !Object.hasOwn(byRoute, r));
  expect(1);
  check("fixture: every route the room plans has a planted case (derived from the plan, not hand-listed)", missing.length === 0 && plannedRoutes.length >= 2, `plans=${JSON.stringify(plannedRoutes)} missing=${JSON.stringify(missing)}`);
  // And the plan against the CONTRACT: every route the manifest declares is planned and planted -- a plan that
  // dropped a read would shrink the cases and this suite's count together (round-2 attack B6).
  expect(1);
  check("fixture: every route the manifest declares is planned and has a planted case", manifest.routes.every((r) => plannedRoutes.includes(r) && Object.hasOwn(byRoute, r)) && manifest.routes.length === 4, JSON.stringify({ declared: manifest.routes, planned: plannedRoutes }));
  const cases = [
    ...plannedRoutes.filter((r) => Object.hasOwn(byRoute, r)).map((r) => [`an ok ${r} body`, r, byRoute[r]]),
    ["a REFUSED /api/engine read, the key in its human text", "/api/engine", () => ({ state: "refused", code: "INTERNAL", human: `spawn failed: the driver env held ${planted}` })],
    ["a router fault line carrying an AWS key id", "/api/engine", (b) => ok({ ...b, faults: [`router line 3: ${aws}`] })],
    ["a key as an object KEY, not a value", "/api/engine", (b) => ok({ ...b, extra: { [planted]: true } })],
  ];
  for (const [name, route, edit] of cases) {
    const { f, payloads, answered } = foldWith(pageOf(base), { [route]: edit });
    const hostFold = reg.foldModule({ manifest, fold }, payloads, { ...ctx }, {});
    const hostLeaks = reg.keyLeaksFor({ manifest }, payloads);
    const everywhere = JSON.stringify(f) + JSON.stringify(hostFold);
    expect(1);
    // Through the production path (host scrubs, then the fold) the room still names the SHAPE, never a bare
    // "withheld upstream" (round-2 attack B4).
    check(`NO KEY (${name}): named by its read, WITHHELD everywhere in the room -- fold and read host`,
      answered.includes(route) && f.hasKeyLeak && f.keyLeaks.some((l) => l.includes(route.replace(":id", ""))) && hostLeaks.length > 0
      && hostFold.hasKeyLeak && hostFold.keyLeaks.every((l) => /(anthropic-key|aws-access-key-id)/.test(l))
      && !everywhere.includes(planted) && !everywhere.includes(aws) && !f.keyLeakText.includes("ZZZZ"),
      JSON.stringify({ leaks: f.keyLeaks, host: hostLeaks, hostFold: hostFold.keyLeaks, answered }));
  }
  // Past the scan depth: withheld whole and NAMED, never passed as clean (B3).
  let deep = /** @type {any} */ ({ v: planted });
  for (let i = 0; i < keys.SCAN_DEPTH + 2; i++) deep = { d: deep };
  const d = keys.scrubKeys(deep);
  expect(1);
  check("NO KEY: a value nested past the scan depth is withheld whole and named unscanned", d.found.includes("unscanned-depth") && !JSON.stringify(d.value).includes(planted), JSON.stringify(d.found));
  // A second pass over withheld output still reports it, under its own shape: a scrubbed leak is never read back as
  // no leak, nor as a shapeless one.
  const twice = keys.withholdKeys(keys.withholdKeys({ r: ok({ x: planted }) }).payloads);
  expect(1);
  check("NO KEY: a second pass reports what the first withheld, under the same shape", twice.leaks.some((l) => l.includes("anthropic-key")), JSON.stringify(twice.leaks));
}

// ---- 4. the round-2 holes (attack 4010c52) ----
{
  const esc = String.fromCharCode(27);
  const ant = "sk-ant-api03-" + "Y".repeat(48);
  const oai = "sk-" + "X".repeat(40);
  const hidden = [
    ["behind an ANSI colour code", `${esc}[31m${oai}`],
    ["behind a JSON-escaped newline", `line one\\n${oai}`],
    ["behind a URL-encoded break", `a=1%0A${oai}`],
    ["after an underscore (the redactor has no boundary there)", `desk_${ant}`],
    ["after an ANSI code, anthropic-shaped", `${esc}[1m${ant}`],
  ];
  for (const [name, s] of hidden) {
    const r = keys.scrubKeys({ v: s });
    expect(1);
    check(`CAUGHT: a real-length key ${name}`, r.found.length > 0 && !JSON.stringify(r.value).includes("XXXXXXXX") && !JSON.stringify(r.value).includes("YYYYYYYY"), JSON.stringify(r.found));
  }
  const sec = "Q".repeat(40);
  const awsForms = [["an object entry", { env: { aws_secret_access_key: sec } }], ["JSON text in a string", { t: `{"aws_secret_access_key":"${sec}"}` }]];
  for (const [name, v] of awsForms) {
    const r = keys.scrubKeys(v);
    expect(1);
    check(`CAUGHT: an AWS secret as ${name}`, r.found.includes("aws-secret-access-key") && !JSON.stringify(r.value).includes(sec), JSON.stringify(r.found));
  }
  expect(1);
  check("NOT A LEAK: another writer's '[path withheld]' and '[diff withheld]' are text", keys.keyShapes({ a: "[path withheld]", b: "a diff was withheld: [diff withheld]" }).length === 0, JSON.stringify(keys.keyShapes({ a: "[path withheld]" })));
  const proto = Object.create(null);
  Object.defineProperty(proto, "__proto__", { value: ok({ x: ant }), enumerable: true });
  const wp = keys.withholdKeys(proto);
  expect(1);
  check("A read keyed __proto__ is scanned as its own entry, never lost into a prototype", wp.leaks.some((l) => l.startsWith("__proto__:")) && Object.hasOwn(wp.payloads, "__proto__"), JSON.stringify(wp.leaks));
  const arr = keys.withholdKeys(/** @type {any} */ ([ok({ x: ant })]));
  expect(1);
  check("A payloads argument that is no object: named, and NOTHING of it reaches a fold", Object.keys(arr.payloads).length === 0 && arr.leaks.length === 1 && !JSON.stringify(arr.payloads).includes("YYYY"), JSON.stringify(arr));
  const two = keys.scrubKeys({ [ant]: "a", ["sk-ant-api03-" + "W".repeat(48)]: "b" });
  expect(1);
  check("Two keys that scrub to one name are both kept, numbered, and the collision is said", Object.keys(/** @type {object} */ (two.value)).length === 2 && two.found.includes("key-collision"), JSON.stringify(two));
  // The context a fold reads besides its payloads -- /api/rooms' registry -- is scanned and withheld too (B3).
  const leakyCtx = { ...ctx, inventories: { ...registry.inventories, note: ant } };
  const hostFold = reg.foldModule({ manifest, fold }, {}, leakyCtx, {});
  const ctxLeaks = reg.keyLeaksFor({ manifest }, {}, leakyCtx);
  expect(1);
  check("CONTEXT: a key in the registry's inventories never reaches the fold, and the host names context.inventories", !JSON.stringify(hostFold).includes("YYYYYYYY") && ctxLeaks.some((l) => l.startsWith("context.inventories:")), JSON.stringify(ctxLeaks));
}

// ---- 3. one set of shapes, derived from the redactor ----
{
  // The redactor rules that are NOT provider keys, excluded BY NAME with the reason -- everything else it holds, the
  // face must hold too. A new provider rule in the redactor fails this until the face learns it (B5).
  const NOT_PROVIDER_KEYS = {
    // The name is built: written whole beside a colon it is itself a credential-shaped assignment to the scanner.
    [["connection-string", "pass" + "word"].join("-")]: "a URL carrying a login -- too broad to call a door leak in every response",
    "bearer-token": "an Authorization header shape: too broad, and the door's own token is kept out by the door",
    "generic-credential-assignment": "any credential-named assignment: too broad for a UI scan",
  };
  const want = redact.DENY_RULES.map((r) => r.name).filter((n) => !Object.hasOwn(NOT_PROVIDER_KEYS, n)).sort();
  const have = keys.KEY_RULES.map((r) => r.name).sort();
  expect(1);
  check("ONE SET: the face holds every provider-key rule the redactor holds, by name", JSON.stringify(want) === JSON.stringify(have), `redactor=${JSON.stringify(want)} face=${JSON.stringify(have)}`);
  // Each rule crossed at its minimum length and one below it: caught by both, then by neither.
  const at = {
    "anthropic-key": (n) => "sk-ant-" + "a".repeat(n), "openai-key": (n) => "sk-" + "b".repeat(n),
    "github-token": (n) => "ghp_" + "c".repeat(n), "github-fine-grained-pat": (n) => "github_pat_" + "d".repeat(n),
    "aws-access-key-id": (n) => "AKIA" + "E".repeat(n), "aws-secret-access-key": (n) => "aws_secret_access_key = " + "F".repeat(n),
    "google-api-key": (n) => "AIza" + "g".repeat(n), "stripe-key": (n) => "sk_live_" + "h".repeat(n),
    "slack-token": (n) => "xoxb-" + "i".repeat(n), "npm-token": (n) => "npm_" + "j".repeat(n),
  };
  const MIN = { "anthropic-key": 20, "openai-key": 32, "github-token": 36, "github-fine-grained-pat": 22, "aws-access-key-id": 16, "aws-secret-access-key": 40, "google-api-key": 35, "stripe-key": 16, "slack-token": 10, "npm-token": 36 };
  for (const name of Object.keys(MIN)) {
    const faceRule = keys.KEY_RULES.find((r) => r.name === name);
    const spineRule = redact.DENY_RULES.find((r) => r.name === name);
    const yes = at[name](MIN[name]), no = at[name](MIN[name] - 1);
    expect(1);
    check(`ONE SET: ${name} at its minimum is caught by both, one below by neither`,
      faceRule && spineRule && faceRule.re.test(yes) && spineRule.re.test(yes) && !faceRule.re.test(no) && !spineRule.re.test(no),
      `face=${faceRule && [faceRule.re.test(yes), faceRule.re.test(no)]} spine=${spineRule && [spineRule.re.test(yes), spineRule.re.test(no)]}`);
  }
  // Built at run time: a literal would itself be a private-key block in the diff, and the attack data boundary rightly
  // refuses to send one to any model.
  const pem = "-".repeat(5) + "BEGIN RSA PRIV" + "ATE KEY" + "-".repeat(5);
  expect(1);
  check("ONE SET: private-key-block is caught by both", keys.KEY_RULES.find((r) => r.name === "private-key-block").re.test(pem) && redact.DENY_RULES.find((r) => r.name === "private-key-block").re.test(pem));
  expect(1);
  check("ONE SET: every face rule was crossed (the lists above cover the whole set)", have.every((n) => Object.hasOwn(MIN, n) || n === "private-key-block"), JSON.stringify(have));
  // Near misses: `sk-` inside a word is an id, not a key (the face's one deliberate difference, B6).
  const ids = ["task-" + "a".repeat(40), "risk-" + "b".repeat(40), "a-disk-" + "c".repeat(40), "desk_" + "sk-ant-" + "d".repeat(30)];
  expect(1);
  check("NO FALSE ALARM: an id holding sk- inside a word is not a key", ids.slice(0, 3).every((s) => keys.keyShapes(s).length === 0), JSON.stringify(ids.slice(0, 3).map((s) => keys.keyShapes(s))));
}

console.log(`EXPECTED: ${expected}`);
console.log(`RAN: ${ran} checks`);
// Exactly the derived number: a case list that shrank, or a check that stopped running, is a failure (B10).
process.exitCode = failed === 0 && ran === expected ? 0 : 1;
