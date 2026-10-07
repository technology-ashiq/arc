// Governed fallback (ADR-0228, engine Cycle 8): the failure classifier, the hop decision and the chain terms.
//
// Sections, each runnable alone (`node tests/engine-failure-class.mjs <section>`):
//   unit   the pure module: the six classes, classifyAttempt, familyOf, nextHop, termsCheck, chainTermFaults, and the
//          real router carrying its terms.
//   inv    invariants (a)(b)(d) and (c) through the REAL arc-run, in a copied tree: `mock` is the first driver and
//          `generic-api` against a local server is the second, so the server's hit count IS the second driver's
//          invocation count -- read from the thing that would have been reached, never from an absence of output.
//   mut    five mutants of failure-class.mjs swapped into the copied tree, each turning a NAMED invariant red.
//   drv    the real drivers' declarations: generic-api per HTTP status, claude-code and codex with no CLI installed.
//
// Every run asserts it RAN (a spawned child, a started server, a receipt on the spine) before asserting what it printed.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const SECTION = process.argv[2] || "all";
let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};
const want = (s) => SECTION === "all" || SECTION === s;

const FC = await import(pathToFileURL(join(REPO, ".claude/scripts/engine/failure-class.mjs")).href);
const { routerFaults } = await import(pathToFileURL(join(REPO, ".claude/scripts/engine/router-row.mjs")).href);
const { parseYamlSubset } = await import(pathToFileURL(join(REPO, ".claude/scripts/engine/yaml-subset.mjs")).href);

// =====================================================================================================================
// unit -- the pure module
// =====================================================================================================================
if (want("unit")) {
  check("U: the class set is exactly the six ADR-0228 names",
    JSON.stringify([...FC.FAILURE_CLASSES]) === JSON.stringify(["transport", "provider-unavailable", "model-invalid", "policy-refusal", "budget", "unknown"]));

  const cl = (o) => FC.classifyAttempt({ code: 1, ...o }).cls;
  check("U: the run's timeout is budget even when the driver declared transport", cl({ timedOut: true, code: 124, declared: "transport" }) === "budget");
  check("U: arc-run's output ceiling is budget", cl({ overflowed: true, code: 125 }) === "budget");
  check("U: a policy denial is policy-refusal", cl({ policyDenied: true, code: 77 }) === "policy-refusal");
  check("U: a driver that is not installed is provider-unavailable", cl({ notInstalled: true }) === "provider-unavailable");
  check("U: exit 2 is budget whatever the sidecar declares", cl({ code: 2, declared: "transport" }) === "budget");
  check("U: exit 1 takes the declared class", cl({ declared: "transport" }) === "transport" && cl({ declared: "provider-unavailable" }) === "provider-unavailable");
  check("U: exit 1 with no declaration is unknown", cl({}) === "unknown");
  const bogus = FC.classifyAttempt({ code: 1, declared: "teleport" });
  check("U: a declaration outside the set is unknown, and says so", bogus.cls === "unknown" && /outside/.test(String(bogus.warn)));
  check("U: exit 0 with a contract fault is model-invalid whatever the sidecar declares", cl({ code: 0, contractFault: true, declared: "transport" }) === "model-invalid");
  check("U: exit 0 with a clean answer has no class whatever the sidecar declares", FC.classifyAttempt({ code: 0, declared: "transport" }).cls === null);

  check("U: refusal reasons map to a class on a receipt that reached no driver",
    FC.classForReason("budget") === "budget" && FC.classForReason("tenure") === "policy-refusal" && FC.classForReason("boundary") === "policy-refusal" && FC.classForReason("whatever") === "unknown");

  check("U: families -- fixed drivers, a gateway by its model's vendor, unknown otherwise",
    FC.familyOf("claude-code", null) === "anthropic" && FC.familyOf("codex", null) === "openai" && FC.familyOf("mock", null) === "mock"
    && FC.familyOf("generic-api", "openai/gpt-x") === "openai" && FC.familyOf("generic-api", "anthropic/claude-y") === "anthropic"
    && FC.familyOf("generic-api", "bare-model") === "unknown" && FC.familyOf("generic-api", null) === "unknown" && FC.familyOf("nope", "a/b") === "unknown");

  const fam = (d) => ({ mock: "mock", "generic-api": "openai", codex: "openai", "claude-code": "anthropic" })[d] ?? "unknown";
  const ctx = (o = {}) => ({ elapsedMs: 0, runRemainingMs: undefined, familyOf: fam, ...o });
  const hop = (cls, extra = {}) => ({ driver: "mock", class: cls, ms: 10, ...extra });
  const nh = (remaining, hops, c = ctx(), terms = {}) => FC.nextHop({ remaining, terms }, hops, c);

  check("U: transport hops to the next entry", (() => { const d = nh(["generic-api"], [hop("transport")]); return d.hop && d.to === "generic-api" && d.index === 0; })());
  check("U: provider-unavailable hops", nh(["generic-api"], [hop("provider-unavailable")]).hop === true);
  for (const c of ["budget", "policy-refusal", "unknown"]) {
    const d = nh(["generic-api"], [hop(c)]);
    check(`U: ${c} never hops, and not because of a term`, d.hop === false && d.byTerms === false);
  }
  check("U: an unrecognised recorded class is read as unknown and does not hop", nh(["generic-api"], [hop("teleport")]).hop === false);
  check("U: model-invalid skips a same-family entry and hops across families",
    (() => { const d = nh(["mock", "generic-api"], [hop("model-invalid")]); return d.hop && d.to === "generic-api" && d.index === 1; })());
  check("U: model-invalid with only same-family entries does not hop (rung 1 decides)",
    (() => { const d = nh(["mock"], [hop("model-invalid")]); return d.hop === false && d.noFamily === true && d.byTerms === false; })());
  check("U: model-invalid falls back at most once per run",
    nh(["generic-api"], [hop("model-invalid"), { driver: "codex", class: "model-invalid" }]).hop === false);
  check("U: model-invalid from a family arc cannot name does not hop", nh(["generic-api"], [{ driver: "who", class: "model-invalid" }]).hop === false);
  check("U: an exhausted chain stops", nh([], [hop("transport")]).hop === false);
  check("U: under MIN_HOP_MS left on the run is a budget stop; at it, the hop happens",
    nh(["generic-api"], [hop("transport")], ctx({ runRemainingMs: FC.MIN_HOP_MS - 1 })).byTerms === true
    && nh(["generic-api"], [hop("transport")], ctx({ runRemainingMs: FC.MIN_HOP_MS })).hop === true);
  check("U: max_attempts refuses the attempt past it",
    nh(["generic-api"], [hop("transport")], ctx(), { max_attempts: 1 }).byTerms === true && nh(["generic-api"], [hop("transport")], ctx(), { max_attempts: 2 }).hop === true);
  check("U: max_wall_ms needs MIN_HOP_MS of the term left, and caps the hop's timeout at what is left",
    nh(["generic-api"], [hop("transport")], ctx({ elapsedMs: 6000 }), { max_wall_ms: 10000 }).byTerms === true
    && nh(["generic-api"], [hop("transport")], ctx({ elapsedMs: 4000, runRemainingMs: 9000 }), { max_wall_ms: 10000 }).timeoutMs === 6000);
  check("U: max_cost -- an answering attempt with no spend is unproven (F3)", /unproven/.test(String(nh(["generic-api"], [hop("model-invalid")], ctx(), { max_cost: 100 }).why)));
  check("U: max_cost -- an answer-less attempt's absent spend counts as 0 (F3)", nh(["generic-api"], [hop("transport")], ctx(), { max_cost: 100 }).hop === true);
  check("U: max_cost -- measured spend at the cap refuses, under it hops",
    nh(["generic-api"], [hop("model-invalid", { cost: { inr: 500 } })], ctx(), { max_cost: 100 }).byTerms === true
    && nh(["generic-api"], [hop("model-invalid", { cost: { inr: 50 } })], ctx(), { max_cost: 100 }).hop === true);
  check("U: max_cost unmetered skips the money check", nh(["generic-api"], [hop("model-invalid")], ctx(), { max_cost: "unmetered" }).hop === true);
  check("U: termsCheck binds a same-tier retry the same way", FC.termsCheck({ max_attempts: 1 }, [hop("model-invalid")], ctx()).ok === false);
  check("U: (B2) a declaration from a driver that does not declare is ignored and read as unknown",
    FC.classifyAttempt({ code: 1, declared: "transport", driver: "hermes" }).cls === "unknown" && FC.classifyAttempt({ code: 1, declared: "transport", driver: "generic-api" }).cls === "transport");
  check("U: (B5) a present but unreadable spend is unproven even on an answer-less attempt",
    nh(["generic-api"], [hop("transport", { cost: { inr_invalid: true } })], ctx(), { max_cost: 100 }).byTerms === true);
  {
    // (B3) the driver side writes only a class-shaped name; anything else leaves no declaration at all.
    const { writeFailureClass } = await import(pathToFileURL(join(REPO, ".claude/scripts/engine/drivers/common.mjs")).href);
    const side = join(mkdtempSync(join(tmpdir(), "fc-sidecar-")), "cost.json");
    const held = process.env.ARC_DRIVER_COST_FILE;
    process.env.ARC_DRIVER_COST_FILE = side;
    const errW = process.stderr.write.bind(process.stderr);
    process.stderr.write = () => true;
    try {
      writeFailureClass("x".repeat(100000));
      const wroteHuge = existsSync(side);
      writeFailureClass("transport");
      const good = JSON.parse(readFileSync(side, "utf8")).failure_class === "transport";
      check("U: (B3) writeFailureClass refuses a value that is not a short lowercase name, and writes a real one", !wroteHuge && good);
    } finally {
      process.stderr.write = errW;
      if (held === undefined) delete process.env.ARC_DRIVER_COST_FILE; else process.env.ARC_DRIVER_COST_FILE = held;
    }
  }

  // Replay determinism (invariant c): the same recorded hops give the same decision, and the input is not mutated.
  const rec = [hop("transport"), { driver: "generic-api", class: "provider-unavailable", ms: 5 }];
  const frozen = JSON.stringify(rec);
  const once = JSON.stringify(nh(["codex", "claude-code"], rec, ctx({ elapsedMs: 50, runRemainingMs: 60000 }), { max_attempts: 5, max_wall_ms: 90000 }));
  const twice = JSON.stringify(nh(["codex", "claude-code"], rec, ctx({ elapsedMs: 50, runRemainingMs: 60000 }), { max_attempts: 5, max_wall_ms: 90000 }));
  check("U: (c) nextHop over the same recorded hops is identical twice and mutates nothing", once === twice && JSON.stringify(rec) === frozen && once.includes("\"hop\":true"));

  const T = (o) => FC.chainTermFaults("classes.x", { driver: "mock", fallback: [], max_attempts: 2, max_wall_ms: 1000, max_cost: 100, ...o });
  check("U: a sound metered row has no term fault", T({}).length === 0);
  check("U: a sound unmetered row has no term fault", T({ driver: "claude-code", max_cost: "unmetered" }).length === 0);
  for (const [k, v, label] of [["max_attempts", undefined, "absent"], ["max_attempts", null, "null"], ["max_attempts", "", "empty"], ["max_attempts", 1.5, "fraction"],
    ["max_attempts", -1, "negative"], ["max_attempts", 0, "zero"], ["max_wall_ms", 0, "zero"], ["max_wall_ms", "soon", "a word"],
    ["max_cost", undefined, "absent"], ["max_cost", null, "null"], ["max_cost", "", "empty"], ["max_cost", -1, "negative"], ["max_cost", 2.5, "fraction"]]) {
    const row = { driver: "mock", fallback: [], max_attempts: 2, max_wall_ms: 1000, max_cost: 100 };
    if (v === undefined) delete row[k]; else row[k] = v;
    const f = FC.chainTermFaults("classes.x", row);
    check(`U: ${k} ${label} is a load fault naming it`, f.length >= 1 && f.some((x) => x.includes(`\`${k}\``)), JSON.stringify(f));
  }
  check("U: unmetered on a chain holding a metering driver is a fault", T({ max_cost: "unmetered" }).some((x) => /reports spend/.test(x)));
  check("U: a paise cap on a chain with no metering driver is a fault", T({ driver: "claude-code", fallback: ["codex"] }).some((x) => /unmetered/.test(x)));

  const real = parseYamlSubset(readFileSync(join(REPO, "engine", "router.yaml"), "utf8"));
  const rows = real.ok ? [...Object.entries(real.value.classes), ["default", real.value.default]] : [];
  check("U: (e) the real router loads with zero faults", real.ok && routerFaults(real.value).length === 0, real.ok ? JSON.stringify(routerFaults(real.value)) : "parse");
  check("U: (e) every real row with a chain is unmetered exactly when its chain holds no metering driver",
    rows.length > 3 && rows.every(([, r]) => {
      const chain = [r.driver, ...(r.fallback || [])];
      return (r.max_cost === "unmetered") === !chain.some((d) => FC.METERING_DRIVERS.has(d));
    }));
  check("U: every real row allows at least one attempt per chain entry plus ADR-0204's retry",
    rows.every(([, r]) => Number.isInteger(r.max_attempts) && r.max_attempts >= 2 + (r.fallback || []).length));

  // ONE OWNER (PLAN pre-mortem 1): arc-run asks nextHop and keeps no hop rule of its own.
  const src = readFileSync(join(REPO, ".claude/scripts/engine/arc-run.mjs"), "utf8");
  check("U: arc-run's loop asks nextHop exactly once and keeps no hop rule of its own",
    (src.match(/nextHop\(/g) || []).length === 1 && !/fallbacks\.shift\(/.test(src) && !/while \(a\.verdict === "driver"/.test(src));
}

// =====================================================================================================================
// the copied tree, shared by inv, mut and drv
// =====================================================================================================================
const needTree = want("inv") || want("mut") || want("drv");
const tmp = mkdtempSync(join(tmpdir(), "engine-failure-class-"));
const root = join(tmp, "root");
const rec = join(tmp, "rec");
let spineN = 0;
const VALID = JSON.parse(readFileSync(join(REPO, "tests/fixtures/bench/mock-replay/commit-msg-draft/default.json"), "utf8"));
delete VALID.__cost;
const BAD = { not: "the contract" };

if (needTree) {
  mkdirSync(join(root, "processes"), { recursive: true });
  mkdirSync(join(root, "engine"), { recursive: true });
  mkdirSync(join(root, "tests/fixtures/engine/evals"), { recursive: true });
  cpSync(join(REPO, ".claude/scripts"), join(root, ".claude/scripts"), { recursive: true });
  cpSync(join(REPO, "processes/commit-msg-draft.process.yaml"), join(root, "processes/commit-msg-draft.process.yaml"));
  cpSync(join(REPO, "tests/fixtures/engine/evals/commit-msg-draft"), join(root, "tests/fixtures/engine/evals/commit-msg-draft"), { recursive: true });
  // No hq.policy.yaml: the gate is not in force in this root, so it neither grants nor refuses -- what is measured
  // here is the classifier, not the policy engine.
  mkdirSync(join(rec, "commit-msg-draft"), { recursive: true });
  const put = (id, doc) => writeFileSync(join(rec, "commit-msg-draft", `${id}.json`), JSON.stringify(doc));
  put("valid", VALID);
  put("transport", { __failure: { class: "transport", message: "connect ECONNREFUSED (replayed)" } });
  put("policy", { __failure: { class: "policy-refusal", message: "the provider refused (replayed)" }, __cost: { inr: 1, source: "measured" } });
  put("undeclared", { __failure: { class: null, message: "it broke (replayed)" } });
  put("teleport", { __failure: { class: "teleport", message: "a typo (replayed)" } });
  put("bad-cost1", { ...BAD, __cost: { inr: 1, source: "measured" } });
  put("bad-cost500", { ...BAD, __cost: { inr: 500, source: "measured" } });
  put("bad-nocost", BAD);
  put("ok-declares", { ...VALID, __failure: { class: "transport", exit: 0 } });
  put("exit2-declares", { __failure: { class: "transport", exit: 2, message: "declined (replayed)" }, __cost: { inr: 1, source: "measured" } });
  check("fixture: the copied tree carries arc-run, the emitter, both drivers and the process (vacuous-pass guard)",
    ["engine/arc-run.mjs", "hq/arc-event.sh", "engine/drivers/mock.sh", "engine/drivers/generic-api.sh", "engine/failure-class.mjs"].every((p) => existsSync(join(root, ".claude/scripts", p)))
    && existsSync(join(root, "processes/commit-msg-draft.process.yaml")) && readdirSync(join(rec, "commit-msg-draft")).length === 10);
}

/** @param {{ driver?: string, chain?: string[], maxAttempts?: number, maxCost?: number | string }} o */
const writeRouter = (o = {}) => {
  const driver = o.driver ?? "mock";
  const chain = o.chain ?? ["generic-api"];
  writeFileSync(join(root, "engine/router.yaml"), [
    "version: 1",
    "tiers:",
    "  - balanced-workhorse",
    "models:",
    "  balanced-workhorse:",
    "    generic-api: openai/test-model",
    "classes:",
    "  commit-msg-draft:",
    "    tier: balanced-workhorse",
    `    driver: ${driver}`,
    ...(chain.length ? ["    fallback:", ...chain.map((d) => `      - ${d}`)] : ["    fallback: []"]),
    `    max_attempts: ${o.maxAttempts ?? 3}`,
    "    max_wall_ms: 3600000",
    `    max_cost: ${o.maxCost ?? 100000}`,
    "default:",
    "  tier: balanced-workhorse",
    "  driver: claude-code",
    "  fallback: []",
    "  max_attempts: 2",
    "  max_wall_ms: 3600000",
    "  max_cost: unmetered",
    "",
  ].join("\n"));
};

// The second driver's endpoint. `mode` decides its answer; `hits` is the invocation count.
const server = { hits: 0, mode: "valid", status: 200, body: "" };
let srv = null;
const startServer = () => new Promise((ok) => {
  srv = createServer((req, res) => {
    let b = "";
    req.on("data", (c) => { b += c; });
    req.on("end", () => {
      server.hits++;
      if (server.mode === "status") { res.writeHead(server.status, { "content-type": "application/json" }); res.end(server.body); return; }
      if (server.mode === "hang") return;
      const content = server.mode === "valid" ? JSON.stringify(VALID) : server.mode === "badschema" ? JSON.stringify(BAD) : "this is not json at all";
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ model: "openai/test-model", choices: [{ message: { role: "assistant", content } }], usage: { prompt_tokens: 3, completion_tokens: 4 } }));
    });
  });
  srv.listen(0, "127.0.0.1", () => ok(srv.address().port));
});

const readSpine = (dir) => {
  const ev = [];
  const d = join(dir, "events");
  if (existsSync(d)) for (const f of readdirSync(d)) for (const l of readFileSync(join(d, f), "utf8").split("\n")) { if (l.trim()) { try { ev.push(JSON.parse(l)); } catch { /* not a record */ } } }
  const q = join(dir, "_quarantine");
  return { ev, quarantined: existsSync(q) ? readdirSync(q).length : 0 };
};

/** One arc-run through the copied tree. */
const arcRun = (o) => new Promise((ok) => {
  const spine = join(tmp, `spine-${++spineN}`);
  mkdirSync(spine, { recursive: true });
  const before = server.hits;
  const args = [join(root, ".claude/scripts/engine/arc-run.mjs"), "--process", "commit-msg-draft", "--driver", o.driver ?? "auto", "--root", root,
    ...(o.budget ? ["--budget", o.budget] : [])];
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ARC_SPINE_ROOT: spine, ARC_MOCK_DIR: rec, ARC_MOCK_FIXTURE: o.fixture ?? "valid", ARC_DRIVER_FAKE: "", ARC_RUN_STREAM: o.stream ? "1" : "",
      ARC_LLM_ENDPOINT: `http://127.0.0.1:${o.port}/v1/chat/completions`, ARC_LLM_API_KEY: "test-key-not-a-secret", ARC_LLM_MODEL: "",
      ARC_LLM_TIMEOUT_MS: o.timeoutMs ?? "20000", ARC_LLM_KEY_NAME: "", ...(o.env || {}) },
    windowsHide: true,
  });
  let out = "", err = "";
  child.stdout.on("data", (c) => { out += c; });
  child.stderr.on("data", (c) => { err += c; });
  const guard = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* gone */ } }, 120_000);
  child.on("close", (code) => {
    clearTimeout(guard);
    const { ev, quarantined } = readSpine(spine);
    const runs = ev.filter((e) => e.kind === "run.completed");
    const props = ev.filter((e) => e.kind === "approval.requested");
    ok({ code, out, err, hits: server.hits - before, receipt: runs.length ? runs[runs.length - 1].payload : null, runs: runs.length, proposal: props.length ? props[props.length - 1].payload : null, quarantined });
  });
  child.on("error", (e) => { clearTimeout(guard); ok({ code: null, out, err: err + String(e), hits: 0, receipt: null, runs: 0, proposal: null, quarantined: 0 }); });
});
const hopsOf = (r) => (r.receipt && Array.isArray(r.receipt.hops) ? r.receipt.hops : []);
const landed = (r) => r.runs === 1 && r.quarantined === 0;

// The named scenarios: each one is used by an invariant AND by the mutant that must turn it red.
const SCEN = {
  transport: { router: {}, fixture: "transport", mode: "valid" },
  policy: { router: {}, fixture: "policy", mode: "valid" },
  undeclared: { router: {}, fixture: "undeclared", mode: "valid" },
  crossFamily: { router: {}, fixture: "bad-cost1", mode: "badschema" },
  sameFamily: { router: { chain: ["mock"] }, fixture: "bad-cost1", mode: "valid" },
  exit2: { router: {}, fixture: "exit2-declares", mode: "valid" },
  exit0: { router: {}, fixture: "ok-declares", mode: "valid" },
};
const runScen = async (port, s, extra = {}) => { writeRouter(s.router); server.mode = s.mode; return arcRun({ port, fixture: s.fixture, ...extra }); };

try {
  const port = needTree ? await startServer() : 0;

  // ===================================================================================================================
  // inv -- the invariants through the real arc-run
  // ===================================================================================================================
  if (want("inv")) {
    const t = await runScen(port, SCEN.transport);
    check("fixture: arc-run spawned and its receipt landed, not quarantined (vacuous-pass guard)", t.code !== null && landed(t), `code=${t.code} runs=${t.runs} q=${t.quarantined} ${t.err.slice(-400)}`);
    check("(a) a transport failure reaches the second driver (count 1) and the run succeeds there", t.code === 0 && t.hits === 1, `code=${t.code} hits=${t.hits} ${t.err.slice(-300)}`);
    const th = hopsOf(t);
    check("(a) the receipt records both hops, the first transport, both on the routed tier",
      th.length === 2 && th[0].driver === "mock" && th[0].class === "transport" && th[1].driver === "generic-api" && th[1].class === null
      && th.every((h) => h.tier === "balanced-workhorse") && t.receipt.failure_class === undefined, JSON.stringify(th));

    const p = await runScen(port, SCEN.policy);
    check("(b) a policy-refusal never reaches the second driver (count 0)", landed(p) && p.code === 1 && p.hits === 0, `code=${p.code} hits=${p.hits}`);
    check("(b) ... and the receipt says policy-refusal on one hop", p.receipt && p.receipt.failure_class === "policy-refusal" && hopsOf(p).length === 1, JSON.stringify(p.receipt));

    const u = await runScen(port, SCEN.undeclared);
    check("(d) an undeclared failure is unknown and does not fall back (count 0)", landed(u) && u.code === 1 && u.hits === 0 && u.receipt.failure_class === "unknown", `hits=${u.hits} ${JSON.stringify(u.receipt)}`);
    writeRouter({}); server.mode = "valid";
    const tp = await arcRun({ port, fixture: "teleport" });
    check("(d) a declaration outside the set is unknown, said aloud, and does not fall back", tp.code === 1 && tp.hits === 0 && tp.receipt?.failure_class === "unknown" && /outside/.test(tp.err), `hits=${tp.hits} ${tp.err.slice(-300)}`);

    const cf = await runScen(port, SCEN.crossFamily);
    check("(a) a contract fault hops across families exactly once (count 1) and stops", landed(cf) && cf.code === 1 && cf.hits === 1, `code=${cf.code} hits=${cf.hits} ${cf.err.slice(-300)}`);
    check("(a) ... two attempts, never three, both model-invalid, and the proposal names the hop",
      cf.receipt?.attempts === 2 && cf.receipt?.reason === "schema" && cf.receipt?.failure_class === "model-invalid"
      && hopsOf(cf).length === 2 && hopsOf(cf).every((h) => h.class === "model-invalid")
      && cf.proposal && cf.proposal.attempts === 2 && /hopped to generic-api/.test(String(cf.proposal.why)), JSON.stringify([cf.receipt, cf.proposal]));

    const sf = await runScen(port, SCEN.sameFamily);
    check("(F1) with no other family in the chain, ADR-0204's retry stays: two attempts, no hop",
      sf.code === 1 && sf.hits === 0 && sf.receipt?.attempts === 2 && !/falling back/.test(sf.err) && /retried once on the same tier/.test(String(sf.proposal?.why)), `${sf.err.slice(-300)} ${JSON.stringify(sf.proposal)}`);

    const x2 = await runScen(port, SCEN.exit2);
    check("(ADR-0228 item 4) exit 2 is budget whatever the sidecar declares: no hop", x2.code === 1 && x2.hits === 0 && x2.receipt?.reason === "budget" && x2.receipt?.failure_class === "budget", JSON.stringify(x2.receipt));
    const x0 = await runScen(port, SCEN.exit0);
    check("(ADR-0228 item 4) exit 0 decides the class whatever the sidecar declares: success, class null",
      x0.code === 0 && x0.hits === 0 && hopsOf(x0).length === 1 && hopsOf(x0)[0].class === null, JSON.stringify(x0.receipt));

    // The deadline pair (PLAN pre-mortem 2): too little of the run left is budget; plenty left, the hop happens.
    writeRouter({}); server.mode = "valid";
    const dl = await arcRun({ port, fixture: "transport", budget: "min=0.05" });
    check("(deadline) transport with under MIN_HOP_MS of the run left does not hop and reads budget", dl.code === 1 && dl.hits === 0 && dl.receipt?.reason === "budget", `${dl.err.slice(-300)} ${JSON.stringify(dl.receipt)}`);
    const dlOk = await arcRun({ port, fixture: "transport", budget: "min=2" });
    check("(deadline control) the same failure with the run's budget mostly left does hop", dlOk.code === 0 && dlOk.hits === 1, `${dlOk.err.slice(-300)}`);

    // (c) chain terms refuse before spend.
    writeRouter({ maxAttempts: 1 }); server.mode = "valid";
    const ma = await arcRun({ port, fixture: "transport" });
    check("(c) max_attempts 1 refuses the hop before the second driver starts (count 0), receipted as budget",
      ma.code === 1 && ma.hits === 0 && ma.receipt?.reason === "budget" && ma.receipt?.failure_class === "budget" && /allows 1 attempt/.test(ma.err), `${ma.err.slice(-300)} ${JSON.stringify(ma.receipt)}`);
    writeRouter({ maxCost: 100 }); server.mode = "valid";
    const mc = await arcRun({ port, fixture: "bad-cost500" });
    check("(c) measured spend at max_cost refuses the cross-family hop (count 0)", mc.code === 1 && mc.hits === 0 && mc.receipt?.reason === "budget" && /paise spent/.test(mc.err), mc.err.slice(-300));
    writeRouter({ maxCost: 100000 }); server.mode = "valid";
    const mcOk = await arcRun({ port, fixture: "bad-cost500" });
    check("(c control) the same spend under a higher max_cost hops (count 1)", mcOk.code === 0 && mcOk.hits === 1, mcOk.err.slice(-300));
    const un = await arcRun({ port, fixture: "bad-nocost" });
    check("(c, F3) an answering attempt with no measured spend is unproven: no hop under a paise cap", un.code === 1 && un.hits === 0 && /unproven/.test(un.err), un.err.slice(-300));

    // A missing term fails the router LOAD, before routing.
    writeFileSync(join(root, "engine/router.yaml"), "version: 1\ntiers:\n  - balanced-workhorse\nclasses:\n  commit-msg-draft:\n    tier: balanced-workhorse\n    driver: mock\n    fallback: []\n    max_attempts: 2\n    max_wall_ms: 1000\n");
    const lf = await arcRun({ port, fixture: "valid", env: {} });
    check("(load) a row without max_cost does not load, and the refusal names the term", lf.code !== 0 && /will not load/.test(lf.err + lf.out) && /max_cost/.test(lf.err + lf.out) && lf.hits === 0, (lf.err + lf.out).slice(-300));
  }

  // ===================================================================================================================
  // mut -- each mutant turns a NAMED invariant red
  // ===================================================================================================================
  if (want("mut")) {
    const modPath = join(root, ".claude/scripts/engine/failure-class.mjs");
    const original = readFileSync(modPath, "utf8");
    const MUTANTS = [
      { name: "m1 everything hops", from: `if (!HOPPABLE.has(cls) && cls !== "model-invalid") {`, to: "if (false) {",
        scen: "policy", red: (r) => r.hits !== 0, says: "a policy-refusal reached the second driver" },
      { name: "m2 budget hops", from: `const HOPPABLE = new Set(["transport", "provider-unavailable"]);`, to: `const HOPPABLE = new Set(["transport", "provider-unavailable", "budget"]);`,
        scen: "exit2", red: (r) => r.hits !== 0, says: "a budget failure reached the second driver" },
      { name: "m3 transport stops", from: `const HOPPABLE = new Set(["transport", "provider-unavailable"]);`, to: `const HOPPABLE = new Set(["provider-unavailable"]);`,
        scen: "transport", red: (r) => r.hits === 0, says: "a transport failure never reached the second driver" },
      { name: "m4 model-invalid hops within one family", from: `return f !== "unknown" && from !== "unknown" && f !== from;`, to: `return f !== "unknown";`,
        scen: "sameFamily", red: (r) => /falling back/.test(r.err), says: "a contract fault hopped to the same family" },
      { name: "m5 a declaration overrides the observed class", from: "export function classifyAttempt(o) {\n", to: "export function classifyAttempt(o) {\n  if (o.declared !== undefined && o.declared !== null) return readDeclared(o.declared);\n",
        scen: "exit2", red: (r) => r.hits !== 0, says: "exit 2 with a transport declaration hopped" },
    ];
    try {
      for (const m of MUTANTS) {
        const mutated = original.replace(m.from, m.to);
        writeFileSync(modPath, mutated);
        check(`mutant ${m.name}: the mutation applied (vacuous-pass guard)`, mutated !== original && readFileSync(modPath, "utf8") === mutated);
        const r = await runScen(port, SCEN[m.scen]);
        check(`mutant ${m.name}: turns the ${m.scen} invariant red (${m.says})`, r.code !== null && m.red(r), `code=${r.code} hits=${r.hits} ${r.err.slice(-200)}`);
        writeFileSync(modPath, original);
      }
      const m5b = original.replace(MUTANTS[4].from, MUTANTS[4].to);
      writeFileSync(modPath, m5b);
      const r0 = await runScen(port, SCEN.exit0);
      check("mutant m5 also turns the exit-0 invariant red (a success recorded with a failure class)", hopsOf(r0)[0]?.class === "transport", JSON.stringify(hopsOf(r0)));
    } finally {
      writeFileSync(modPath, original);
    }
    // And the unmutated tree is green on the same scenarios, so the reds above are the mutants and nothing else.
    const g = await runScen(port, SCEN.policy);
    check("mutant control: the restored module is green on the policy scenario again", g.code === 1 && g.hits === 0);
  }

  // ===================================================================================================================
  // drv -- the real drivers' declarations
  // ===================================================================================================================
  if (want("drv")) {
    // generic-api first, mock second: the receipt's hop record is the count (exit 0 is only reachable through mock).
    const gen = async (status, body) => {
      writeRouter({ driver: "generic-api", chain: ["mock"] });
      server.mode = "status"; server.status = status; server.body = body;
      return arcRun({ port, fixture: "valid", timeoutMs: "5000" });
    };
    const hopped = (r) => r.code === 0 && hopsOf(r).length === 2 && hopsOf(r)[1].driver === "mock";
    const cases = [
      [503, "{}", "provider-unavailable", true],
      [429, JSON.stringify({ error: { message: "rate limited, slow down" } }), "provider-unavailable", true],
      [429, JSON.stringify({ error: { message: "You exceeded your current quota" } }), "budget", false],
      [402, JSON.stringify({ error: "payment required" }), "budget", false],
      [403, JSON.stringify({ error: { message: "Key limit exceeded (total limit)" } }), "budget", false],
      [500, "{}", "transport", true],
      [429, JSON.stringify({ error: { message: "rate limited -- see https://example.com/docs/billing-and-limits" } }), "provider-unavailable", true],
      [401, JSON.stringify({ error: "bad key" }), "unknown", false],
    ];
    for (const [status, body, cls, hops] of cases) {
      const r = await gen(status, body);
      const first = hopsOf(r)[0];
      check(`D: generic-api HTTP ${status}${/quota|Key limit/.test(body) ? " (money)" : ""} declares ${cls} and ${hops ? "hops" : "does not hop"}`,
        r.code !== null && first?.driver === "generic-api" && first?.class === cls && hopped(r) === hops, `code=${r.code} ${JSON.stringify(hopsOf(r))} ${r.err.slice(-200)}`);
    }
    writeRouter({ driver: "generic-api", chain: ["mock"] });
    server.mode = "notjson";
    const nj = await arcRun({ port, fixture: "valid" });
    check("D: generic-api with a 200 whose answer is not JSON declares model-invalid", hopsOf(nj)[0]?.class === "model-invalid", JSON.stringify(hopsOf(nj)));
    // (B1) The RUN's deadline, not the per-attempt cap, ends the ladder: a hanging endpoint, a 60 s attempt cap and a
    // ~9 s run budget. The driver aborts on the run's clock and must declare budget, never transport.
    writeRouter({ driver: "generic-api", chain: ["mock"] });
    server.mode = "hang";
    const dlg = await arcRun({ port, fixture: "valid", timeoutMs: "60000", budget: "min=0.15" });
    check("D: generic-api ended by the run's deadline declares budget and does not hop", hopsOf(dlg)[0]?.class === "budget" && !hopped(dlg) && dlg.receipt?.reason === "budget", `${JSON.stringify(hopsOf(dlg))} ${dlg.err.slice(-200)}`);
    srv.closeAllConnections?.();
    // A closed port: connect refused is transport.
    const dead = createServer();
    const deadPort = await new Promise((ok) => dead.listen(0, "127.0.0.1", () => ok(dead.address().port)));
    await new Promise((ok) => dead.close(ok));
    writeRouter({ driver: "generic-api", chain: ["mock"] });
    const cr = await arcRun({ port: deadPort, fixture: "valid", timeoutMs: "5000" });
    check("D: generic-api against a closed port declares transport and hops", hopsOf(cr)[0]?.class === "transport" && hopped(cr), `${JSON.stringify(hopsOf(cr))} ${cr.err.slice(-200)}`);

    // The CLI drivers: a missing binary is the one structural failure they can name.
    const missing = join(tmp, "no-such-cli-here");
    writeRouter({});
    for (const [driver, envKey, stream] of [["claude-code", "ARC_CLAUDE_CLI", false], ["claude-code", "ARC_CLAUDE_CLI", true], ["codex", "ARC_CODEX_CLI", false]]) {
      const r = await arcRun({ port, driver, stream, env: { [envKey]: missing } });
      check(`D: ${driver}${stream ? " (stream)" : ""} with no CLI installed declares provider-unavailable`,
        r.code === 1 && r.receipt?.failure_class === "provider-unavailable" && hopsOf(r)[0]?.class === "provider-unavailable", `${JSON.stringify(r.receipt)} ${r.err.slice(-200)}`);
    }
  }
} finally {
  if (srv) { srv.closeAllConnections?.(); srv.close(); }
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
