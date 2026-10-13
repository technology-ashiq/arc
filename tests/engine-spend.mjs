// Metered runs (ADR-0229, ADR-0230, engine Cycle 9): a provider's figure becomes money in one place, rides the
// receipt, and becomes exactly one cost.incurred per metered run.
//
// Sections, each runnable alone (`node tests/engine-spend.mjs <section>`):
//   unit   the pure money functions: spendOf's corpus (decimal strings, never `x * 100`), sumSpend's one rounding,
//          isSpend's shape check, spendBasis, and unbookedRuns.
//   run    the REAL arc-run in a copied tree: `mock` and `generic-api` against a local server whose answer carries (or
//          omits) `usage.cost`; the spine is read back from `events/`, and every money row is traced to its receipt.
//
// Every run asserts it RAN (a spawned child, a started server, a receipt on the spine) before asserting what it printed.
import { spawn, spawnSync } from "node:child_process";
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

const C = await import(pathToFileURL(join(REPO, ".claude/scripts/engine/drivers/common.mjs")).href);
const T = await import(pathToFileURL(join(REPO, ".claude/scripts/engine/spend-trace.mjs")).href);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const usd = (amount, provider_amount) => ({ amount, currency: "USD", provider_amount });

// =====================================================================================================================
// unit -- the pure money functions
// =====================================================================================================================
if (want("unit")) {
  // spendOf: every row is [value, expected]. The float trap rows (0.07, 0.29, 1.15) are the ones `Math.ceil(x * 100)`
  // gets wrong; they are the reason this is decimal-string arithmetic.
  const CORPUS = [
    [0.07, usd(7, "0.07")],
    [0.29, usd(29, "0.29")],
    [1.15, usd(115, "1.15")],
    [0.0700001, usd(8, "0.0700001")],
    [0.000183, usd(1, "0.000183")],
    [1e-7, usd(1, "0.0000001")],
    [1.5e-7, usd(1, "0.00000015")],
    [12.345, usd(1235, "12.345")],
    [0, usd(0, "0")],
    [-0, usd(0, "0")],
    [3, usd(300, "3")],
  ];
  for (const [v, exp] of CORPUS) check(`U: spendOf(${String(v)}) is ${exp.amount} cents, provider_amount ${exp.provider_amount}`, same(C.spendOf(v, "USD"), exp), JSON.stringify(C.spendOf(v, "USD")));
  // Absent is never zero: each of these is NO figure.
  const ABSENT = [undefined, null, "0.01", "", -0.01, -1, NaN, Infinity, -Infinity, 1e21, true, {}, [0.01]];
  for (const v of ABSENT) check(`U: spendOf(${JSON.stringify(v) ?? String(v)}) is no figure, never 0`, C.spendOf(v, "USD") === null);
  check("U: spendOf refuses a currency outside INR and USD (no exponent pinned)", C.spendOf(0.07, "EUR") === null && C.spendOf(0.07, "usd") === null && C.spendOf(0.07, undefined) === null);
  check("U: spendOf in INR rounds up to the paisa", same(C.spendOf(2.501, "INR"), { amount: 251, currency: "INR", provider_amount: "2.501" }));

  // sumSpend: ONE rounding per run, never a sum of per-attempt ceilings.
  check("U: sumSpend of 0.004 + 0.004 is 1 cent with provider_amount 0.008 (ceil once, not 1 + 1)",
    same(C.sumSpend([C.spendOf(0.004, "USD"), C.spendOf(0.004, "USD")]), usd(1, "0.008")));
  check("U: sumSpend of 0.07 + 0.0000001 is 8 cents, exactly 0.0700001",
    same(C.sumSpend([C.spendOf(0.07, "USD"), C.spendOf(1e-7, "USD")]), usd(8, "0.0700001")));
  check("U: sumSpend of nothing, or of no real spend, is null (absent, not 0)",
    C.sumSpend([]) === null && C.sumSpend([null, undefined, { amount: 1 }]) === null && C.sumSpend("x") === null);
  let mixed = "";
  try { C.sumSpend([C.spendOf(0.07, "USD"), C.spendOf(1, "INR")]); } catch (e) { mixed = e.message; }
  check("U: sumSpend refuses to add two currencies (no rate on the spine)", /cannot be added without a rate/.test(mixed), mixed);

  // isSpend: a shape check, and the amount must BE the provider figure rounded up.
  check("U: isSpend accepts what spendOf returns", C.isSpend(C.spendOf(0.000183, "USD")) && C.isSpend(C.spendOf(0, "INR")));
  check("U: isSpend refuses an amount that disagrees with its provider_amount (the twin)", !C.isSpend(usd(8, "0.07")) && !C.isSpend(usd(0, "0.000183")));
  check("U: isSpend refuses a float amount, a negative, a non-plain decimal and an unknown currency",
    !C.isSpend(usd(7.5, "0.075")) && !C.isSpend(usd(-1, "0")) && !C.isSpend(usd(7, "7e-2")) && !C.isSpend(usd(7, "0.070"))
    && !C.isSpend({ amount: 7, currency: "EUR", provider_amount: "0.07" }) && !C.isSpend(null) && !C.isSpend([usd(7, "0.07")]));

  check("U: spendBasis names whose figure it is, and an unnamed driver claims none",
    C.spendBasis("claude-code") === "harness-reported" && C.spendBasis("generic-api") === "provider-reported"
    && C.spendBasis("mock") === "recorded" && C.spendBasis("codex") === "unstated" && C.spendBasis("__proto__") === "unstated");

  // unbookedRuns: the reverse trace.
  const run = (id, spend, extra = {}) => ({ id, kind: "run.completed", payload: { spend, ...extra } });
  const money = (ref, currency) => ({ id: `m-${ref}`, kind: "cost.incurred", payload: { run_ref: ref, currency, amount: 1 } });
  const s1 = C.spendOf(0.000183, "USD");
  check("U: unbookedRuns is empty when every spent run has its money row", T.unbookedRuns([run("A", s1), money("A", "USD")]).length === 0);
  check("U: unbookedRuns names a spent run with no money row", same(T.unbookedRuns([run("A", s1)]), [{ id: "A", currency: "USD", amount: 1 }]));
  check("U: unbookedRuns ignores an unmetered run and a money row in another currency does not book it",
    T.unbookedRuns([run("B", null, { spend_absence: "driver-unmetered" })]).length === 0
    && T.unbookedRuns([run("A", s1), money("A", "INR")]).length === 1);
  check("U: unbookedRuns owes each currency of a mixed run its own row",
    T.unbookedRuns([run("C", null, { spend_by_currency: [s1, C.spendOf(1, "INR")] }), money("C", "USD")]).length === 1);
}

// =====================================================================================================================
// run -- the real arc-run in a copied tree
// =====================================================================================================================
const needTree = want("run");
const tmp = mkdtempSync(join(tmpdir(), "engine-spend-"));
const root = join(tmp, "root");
const rec = join(tmp, "rec");
let spineN = 0;
const VALID = JSON.parse(readFileSync(join(REPO, "tests/fixtures/bench/mock-replay/commit-msg-draft/default.json"), "utf8"));
delete VALID.__cost;

if (needTree) {
  mkdirSync(join(root, "processes"), { recursive: true });
  mkdirSync(join(root, "engine"), { recursive: true });
  mkdirSync(join(root, "tests/fixtures/engine/evals"), { recursive: true });
  cpSync(join(REPO, ".claude/scripts"), join(root, ".claude/scripts"), { recursive: true });
  cpSync(join(REPO, "processes/commit-msg-draft.process.yaml"), join(root, "processes/commit-msg-draft.process.yaml"));
  cpSync(join(REPO, "tests/fixtures/engine/evals/commit-msg-draft"), join(root, "tests/fixtures/engine/evals/commit-msg-draft"), { recursive: true });
  mkdirSync(join(rec, "commit-msg-draft"), { recursive: true });
  const put = (id, doc) => writeFileSync(join(rec, "commit-msg-draft", `${id}.json`), JSON.stringify(doc));
  put("valid", VALID);
  put("transport-spent", { __failure: { class: "transport", message: "connect ECONNRESET mid-answer (replayed)" }, __cost: { spend: { value: 0.004, currency: "USD" }, source: "measured" } });
  put("transport-inr", { __failure: { class: "transport", message: "connect ECONNRESET (replayed)" }, __cost: { inr: 50, source: "measured" } });
  put("string-spend", { ...VALID, __cost: { spend: { value: "0.01", currency: "USD" }, source: "measured" } });
  check("fixture: the copied tree carries arc-run, the emitter, both drivers, spend-trace and the process (vacuous-pass guard)",
    ["engine/arc-run.mjs", "hq/arc-event.sh", "engine/drivers/mock.sh", "engine/drivers/generic-api.sh", "engine/spend-trace.mjs"].every((p) => existsSync(join(root, ".claude/scripts", p)))
    && existsSync(join(root, "processes/commit-msg-draft.process.yaml")) && readdirSync(join(rec, "commit-msg-draft")).length === 4);
}

const writeRouter = (chain) => {
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
    "    driver: mock",
    ...(chain.length ? ["    fallback:", ...chain.map((d) => `      - ${d}`)] : ["    fallback: []"]),
    "    max_attempts: 3",
    "    max_wall_ms: 3600000",
    "    max_cost: 100000",
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

// The endpoint. `cost` is the figure its usage carries (undefined = the field is omitted); `sse` streams the answer
// with the usage on the last chunk, the shape OpenRouter sends.
const server = { hits: 0, cost: undefined, sse: false, lastBody: null };
let srv = null;
const startServer = () => new Promise((ok) => {
  srv = createServer((req, res) => {
    let b = "";
    req.on("data", (c) => { b += c; });
    req.on("end", () => {
      server.hits++;
      try { server.lastBody = JSON.parse(b); } catch { server.lastBody = null; }
      const usage = { prompt_tokens: 3, completion_tokens: 4, ...(server.cost !== undefined ? { cost: server.cost } : {}) };
      const content = JSON.stringify(VALID);
      if (server.sse) {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(`data: ${JSON.stringify({ model: "openai/test-model", choices: [{ delta: { content } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [], usage })}\n\n`);
        res.end("data: [DONE]\n\n");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ model: "openai/test-model", choices: [{ message: { role: "assistant", content } }], usage }));
    });
  });
  srv.listen(0, "127.0.0.1", () => ok(srv.address().port));
});

const readSpine = (dir) => {
  const ev = [];
  const d = join(dir, "events");
  if (existsSync(d)) for (const f of readdirSync(d)) {
    if (!f.endsWith(".jsonl")) continue;
    for (const l of readFileSync(join(d, f), "utf8").split("\n")) { if (l.trim()) { try { ev.push(JSON.parse(l)); } catch { /* not a record */ } } }
  }
  const q = join(d, "_quarantine");
  return { ev, quarantined: existsSync(q) ? readdirSync(q).length : 0 };
};

/** One arc-run through the copied tree. `o.spine` reuses a spine so two runs land side by side. */
const arcRun = (o) => new Promise((ok) => {
  const spine = o.spine ?? join(tmp, `spine-${++spineN}`);
  mkdirSync(spine, { recursive: true });
  const before = server.hits;
  const args = [join(root, ".claude/scripts/engine/arc-run.mjs"), "--process", "commit-msg-draft", "--driver", o.driver ?? "auto", "--root", root];
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ARC_SPINE_ROOT: spine, ARC_MOCK_DIR: rec, ARC_MOCK_FIXTURE: o.fixture ?? "valid", ARC_DRIVER_FAKE: "", ARC_RUN_STREAM: "",
      ARC_LLM_ENDPOINT: `http://127.0.0.1:${o.port}/v1/chat/completions`, ARC_LLM_API_KEY: "test-key-not-a-secret", ARC_LLM_MODEL: "openai/test-model",
      ARC_LLM_TIMEOUT_MS: "20000", ARC_LLM_KEY_NAME: "", ARC_VENTURE: "" },
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
    const money = ev.filter((e) => e.kind === "cost.incurred");
    const last = runs.length ? runs[runs.length - 1] : null;
    ok({ code, out, err, spine, ev, hits: server.hits - before, run: last, receipt: last ? last.payload : null, runs: runs.length, money, quarantined });
  });
  child.on("error", (e) => { clearTimeout(guard); ok({ code: null, out, err: err + String(e), spine, ev: [], hits: 0, run: null, receipt: null, runs: 0, money: [], quarantined: 0 }); });
});
const tail = (r) => r.err.slice(-400);

try {
  const port = needTree ? await startServer() : 0;

  if (want("run")) {
    // R1 -- the steel thread: generic-api's provider figure becomes the receipt's spend and ONE money row.
    writeRouter([]);
    server.cost = 0.000183; server.sse = false;
    const r1 = await arcRun({ port, driver: "generic-api" });
    check("fixture: arc-run spawned, reached the endpoint once and its receipt landed, not quarantined (vacuous-pass guard)",
      r1.code === 0 && r1.hits === 1 && r1.runs === 1 && r1.quarantined === 0, `code=${r1.code} hits=${r1.hits} runs=${r1.runs} q=${r1.quarantined} ${tail(r1)}`);
    check("R: generic-api asked the provider for its usage figure (usage.include)", server.lastBody?.usage?.include === true, JSON.stringify(server.lastBody?.usage));
    check("R: run.completed carries spend 1 cent USD with the exact provider_amount, basis provider-reported",
      same(r1.receipt?.spend, usd(1, "0.000183")) && r1.receipt?.spend_basis === "provider-reported" && r1.receipt?.spend_absence === undefined, JSON.stringify(r1.receipt?.spend));
    check("R: the hop carries the same spend the receipt sums", same(r1.receipt?.hops?.[0]?.spend, usd(1, "0.000183")), JSON.stringify(r1.receipt?.hops));
    const m1 = r1.money[0]?.payload ?? {};
    check("R: exactly ONE cost.incurred, landed, naming its run.completed by run_ref", r1.money.length === 1 && m1.run_ref === r1.run?.id, `money=${r1.money.length} ref=${m1.run_ref} id=${r1.run?.id}`);
    check("R: the money row is 1 USD cent, measured, provider-reported, overhead venture arc, process and driver named",
      m1.amount === 1 && m1.currency === "USD" && m1.provider_amount === "0.000183" && m1.source === "measured" && m1.basis === "provider-reported"
      && m1.venture === "arc" && r1.money[0]?.venture === "arc" && m1.process === "commit-msg-draft" && m1.driver === "generic-api", JSON.stringify(r1.money[0]));
    check("R: the money row carries no reservation_ref and a label naming its basis in at most 64 printable characters",
      !("reservation_ref" in m1) && typeof m1.label === "string" && m1.label.length <= 64 && /provider-reported/.test(m1.label) && /^[\x20-\x7e]+$/.test(m1.label), JSON.stringify(m1.label));

    // A-13: the policy lane's reservation fold does not read an engine money row as a settlement.
    const SP = await import(pathToFileURL(join(REPO, ".claude/scripts/hq/lib/policy/spend.mjs")).href);
    const withRow = SP.reservationLedger(r1.ev, "anything");
    const without = SP.reservationLedger(r1.ev.filter((e) => e.kind !== "cost.incurred"), "anything");
    check("R: policy/spend.mjs folds the engine money row as nothing (A-13): same ledger with and without it",
      r1.money.length === 1 && same(withRow, without), JSON.stringify(withRow));

    // The Money room's own fold shows it.
    const prevSpine = process.env.ARC_SPINE_ROOT;
    process.env.ARC_SPINE_ROOT = r1.spine;
    let costs = null, cerr = "";
    try { const CO = await import(pathToFileURL(join(REPO, ".claude/scripts/hq/lib/ledger/costs.mjs")).href); costs = await CO.deriveCosts(root, {}); } catch (e) { cerr = e.message; }
    if (prevSpine === undefined) delete process.env.ARC_SPINE_ROOT; else process.env.ARC_SPINE_ROOT = prevSpine;
    const totals = costs?.overhead?.measured?.totals ?? [];
    check("R: costs.mjs (the Money room fold) shows a USD measured overhead line of 1 cent", totals.length === 1 && totals[0].currency === "USD" && totals[0].amount === 1, cerr || JSON.stringify(costs?.overhead?.measured));

    check("R: spend-trace over that spine books every spent run", T.unbookedRuns(r1.ev).length === 0);
    check("R: ... and names the run once its money row is removed (the reverse trace can fail)",
      same(T.unbookedRuns(r1.ev.filter((e) => e.kind !== "cost.incurred")), [{ id: r1.run?.id, currency: "USD", amount: 1 }]));

    // R2 -- the same run with the figure omitted: a named absence and zero money rows (R1 is its positive control).
    server.cost = undefined;
    const r2 = await arcRun({ port, driver: "generic-api" });
    check("R: a provider that gives no figure leaves spend null, spend_absence not-reported, and ZERO money rows (control above: 1)",
      r2.code === 0 && r2.runs === 1 && r2.receipt?.spend === null && r2.receipt?.spend_absence === "not-reported" && r2.money.length === 0, `${JSON.stringify(r2.receipt?.spend)} ${r2.receipt?.spend_absence} money=${r2.money.length} ${tail(r2)}`);

    // R3 -- a driver that never reads a figure is driver-unmetered.
    const r3 = await arcRun({ port, driver: "mock", fixture: "valid" });
    check("R: a driver that reads no figure leaves spend_absence driver-unmetered and zero money rows",
      r3.code === 0 && r3.runs === 1 && r3.receipt?.spend === null && r3.receipt?.spend_absence === "driver-unmetered" && r3.money.length === 0, `${r3.receipt?.spend_absence} ${tail(r3)}`);

    // R4 -- an unreadable figure is never 0.
    const r4 = await arcRun({ port, driver: "mock", fixture: "string-spend" });
    check("R: a string figure is refused aloud, recorded as not-reported, and writes no money row",
      r4.code === 0 && r4.runs === 1 && r4.receipt?.spend === null && r4.receipt?.spend_absence === "not-reported" && r4.money.length === 0 && /refusing a provider spend/.test(r4.err), `${r4.receipt?.spend_absence} ${tail(r4)}`);

    // R5 -- two attempts: the sum is exact and rounded ONCE.
    writeRouter(["generic-api"]);
    server.cost = 0.004; server.sse = true;
    const r5 = await arcRun({ port, fixture: "transport-spent" });
    check("R: a spent transport failure hops to generic-api (SSE, usage on the last chunk) and the run succeeds there",
      r5.code === 0 && r5.hits === 1 && r5.receipt?.hops?.length === 2, `code=${r5.code} hits=${r5.hits} ${tail(r5)}`);
    check("R: 0.004 + 0.004 is ONE cent on the receipt and on the money row, provider_amount 0.008, never 2",
      same(r5.receipt?.spend, usd(1, "0.008")) && r5.money.length === 1 && r5.money[0].payload.amount === 1 && r5.money[0].payload.provider_amount === "0.008",
      `${JSON.stringify(r5.receipt?.spend)} ${JSON.stringify(r5.money.map((m) => m.payload.amount))}`);
    check("R: the two hops each keep their own figure and the basis names both drivers",
      r5.receipt?.hops?.[0]?.spend?.provider_amount === "0.004" && r5.receipt?.hops?.[1]?.spend?.provider_amount === "0.004"
      && r5.receipt?.spend_basis === "provider-reported+recorded" && r5.money[0]?.payload?.driver === "mock+generic-api", `${r5.receipt?.spend_basis} ${r5.money[0]?.payload?.driver}`);

    // R6 -- two identical-looking runs on ONE spine both book; a re-emit for one of them is refused.
    writeRouter([]);
    server.cost = 0.000183; server.sse = false;
    const shared = join(tmp, "spine-shared");
    const a = await arcRun({ port, driver: "generic-api", spine: shared });
    const b = await arcRun({ port, driver: "generic-api", spine: shared });
    check("R: two identical runs on one spine write TWO money rows, none quarantined",
      a.code === 0 && b.code === 0 && b.runs === 2 && b.money.length === 2 && b.quarantined === 0
      && new Set(b.money.map((m) => m.payload.run_ref)).size === 2, `runs=${b.runs} money=${b.money.length} q=${b.quarantined}`);
    const again = join(tmp, "again.json");
    const first = b.money[0];
    writeFileSync(again, JSON.stringify(first.payload));
    const { sha256Hex } = await import(pathToFileURL(join(REPO, ".claude/scripts/hq/lib/canonical.mjs")).href);
    const re = spawnSync("bash", [join(root, ".claude/scripts/hq/arc-event.sh"), "emit", "cost.incurred", "--payload-file", again, "--strict",
      "--venture", "arc", "--idem", sha256Hex(`cost.incurred|${first.payload.run_ref}|USD`)],
    { encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: shared }, windowsHide: true });
    const afterRe = readSpine(shared).ev.filter((e) => e.kind === "cost.incurred").length;
    check("R: re-emitting a run's money row with its derived idem is refused, never a second row",
      re.status !== 0 && /DUP_IDEM/.test(`${re.stdout}${re.stderr}`) && afterRe === 2, `status=${re.status} rows=${afterRe} ${String(re.stderr).slice(-300)}`);

    // R7 -- two currencies in one run: never added, one money row each.
    writeRouter(["generic-api"]);
    const r7 = await arcRun({ port, fixture: "transport-inr" });
    const cur7 = r7.money.map((m) => m.payload.currency).sort();
    check("R: an INR attempt and a USD attempt are never added: spend null, both listed, one money row per currency",
      r7.code === 0 && r7.receipt?.spend === null && Array.isArray(r7.receipt?.spend_by_currency) && r7.receipt.spend_by_currency.length === 2
      && same(cur7, ["INR", "USD"]) && r7.money.every((m) => m.payload.run_ref === r7.run?.id) && r7.quarantined === 0,
      `${JSON.stringify(r7.receipt?.spend_by_currency)} ${JSON.stringify(cur7)} ${tail(r7)}`);
    check("R: the INR row is the recorded 50 paise and spend-trace books both", r7.money.find((m) => m.payload.currency === "INR")?.payload?.amount === 50 && T.unbookedRuns(r7.ev).length === 0);
  }
} finally {
  if (srv) srv.close();
  try { rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* a held handle on Windows */ }
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
