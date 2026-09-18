#!/usr/bin/env node
// phase04-folds.mjs -- what Phase 04's served panels ANSWER, and what the door's read routes REFUSE (face v2 Phase 04,
// REQ-06).
//
// module-frame folds every module with nothing loaded and holds the served and residue lists equal to the folds; dash-doors
// drives each route over HTTP against a fixture spine. Neither could see what a fold draws from a body the door did not
// happen to send, and the Phase 04 decision attacker built 21 mutants of these decisions of which 20 survived: an empty
// table for a body with no list, unreadable rows dropped silently, real and simulated summed on one day, cost totalled
// across currencies, the overdue flag ignored, the ceiling drawn as the effective level, every seal drawn as quoted, a
// Definition of Done blind to the slices its parser refused. The boundary attacker added eleven more at the door. Each
// check below names one of those decisions and FAILS when it is removed.
//
// VACUOUS-PASS GUARD: the first checks prove the modules and the fixture loaded; the last line is
// "RAN: <n> checks, <f> failed", and the suite FAILs below its own floor.
import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LIB = join(REPO, "face", "src", "lib");
const MODULES = join(REPO, "face", "src", "modules");
const u = (p) => pathToFileURL(p).href;

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const reg = await import(u(join(LIB, "registry.mjs")));
const sv = await import(u(join(LIB, "served.mjs")));
const reads = await import(u(join(REPO, ".claude/scripts/hq/lib/face/reads.mjs")));
const pnl = await import(u(join(REPO, ".claude/scripts/hq/lib/ledger/pnl.mjs")));
const spine = await import(u(join(REPO, ".claude/scripts/hq/spine.mjs")));
const canonical = await import(u(join(REPO, ".claude/scripts/hq/lib/canonical.mjs")));
const { escapeDeep } = await import(u(join(REPO, ".claude/scripts/hq/arc-dash.mjs")));
check("served.mjs, reads.mjs, pnl.mjs and the door's serializer loaded (vacuous-pass guard)",
  ["servedRead", "servedTable", "projected", "refusedPart", "gateModes"].every((k) => typeof sv[k] === "function")
  && typeof reads.apiJobs === "function" && typeof reads.scrub === "function" && typeof pnl.deriveDaily === "function" && typeof escapeDeep === "function",
  Object.keys(sv).join(","));

const registry = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
const exemptions = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "module-exemptions.json"), "utf8")).exemptions || [];
const ok = (data) => ({ state: "ok", data });

/** Fold a module once to learn its reads, then again with each read answered by `answer(read)`. */
const foldWith = async (ring, id, answer) => {
  const dir = join(MODULES, ring, id);
  const manifest = (await import(u(join(dir, "module.mjs")))).default;
  const { fold } = await import(u(join(dir, "fold.mjs")));
  const ex = exemptions.find((e) => e.id === id);
  const room = registry.rooms.find((r) => r.id === id) || { id, ring, name: ex ? ex.name : id, sentence: ex ? ex.sentence : "", lede: ex ? (ex.lede ?? "") : "", holds: {} };
  const ctx = { room, rooms: registry.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: registry.inventories, laneMap: undefined, picks: {}, manifest };
  const first = fold({}, ctx);
  const payloads = Object.create(null);
  for (const r of reg.plannedReads(first, manifest).reads) { const a = answer(r); if (a !== undefined) payloads[r.key] = a; }
  return fold(payloads, ctx);
};
/** Answer ONE route with a body; every other read stays loading. */
const only = (route, data, query = null) => (r) => (r.route === route && (query === null || JSON.stringify(r.query || {}) === JSON.stringify(query)) ? ok(data) : undefined);

// ── served.mjs: the one way a fold reads a Phase 04 route ─────────────────────────────────────────────────────────────
{
  const manifest = { id: "x", ring: "kernel", routes: ["/api/jobs"], asOf: false };
  const ctx = { manifest };
  const read = (data) => { const reads = []; const key = reg.readKey({ route: "/api/jobs" }); return sv.servedRead({ [key]: ok(data) }, ctx, reads, "/api/jobs"); };
  const spec = { panel: "P", route: "/api/jobs", columns: ["a"], listKey: "rows", empty: "none", row: (e) => (sv.field(e, "k") === "" ? null : { key: sv.field(e, "k"), cells: [sv.field(e, "k")] }) };
  const noRoute = read({ rows: [] });
  check("SERVED: a body naming no route is BAD_BODY, never a table", noRoute.isRefused === true && noRoute.refusal.code === "BAD_BODY" && noRoute.isRead === false, JSON.stringify(noRoute.refusal));
  const other = read({ route: "/api/policy", rows: [] });
  check("SERVED: a body naming another route is WRONG_ROUTE", other.isRefused === true && other.refusal.code === "WRONG_ROUTE", JSON.stringify(other.refusal));
  const noList = sv.servedTable(read({ route: "/api/jobs" }), spec);
  check("SERVED: a body with no list where the rows live is BAD_BODY -- never an empty table", noList.isRefused === true && noList.refusal.code === "BAD_BODY" && noList.isDrawn === false && noList.showEmpty === false, JSON.stringify(noList));
  const mixed = sv.servedTable(read({ route: "/api/jobs", rows: [{ k: "a" }, null, 5, { k: "" }, { k: "a" }, "s"] }), spec);
  check("SERVED: unreadable, blank and repeated entries are COUNTED in the note, and never drawn",
    mixed.isDrawn === true && mixed.rows.length === 1 && /5 entries the door sent could not be read/.test(mixed.note), JSON.stringify({ rows: mixed.rows, note: mixed.note }));
  const empty = sv.servedTable(read({ route: "/api/jobs", rows: [] }), spec);
  check("SERVED: an empty list is drawn EMPTY with its sentence, not refused", empty.isDrawn === true && empty.showEmpty === true && empty.rows.length === 0 && empty.empty === "none");
  const partRefused = sv.refusedPart(read({ route: "/api/jobs", rows: [] }), "PART_CODE", "the part");
  check("SERVED: refusedPart refuses the part by name", partRefused.isRefused === true && partRefused.isRead === false && partRefused.refusal.code === "PART_CODE");
  const loading = sv.projected({ isReading: true, isRefused: false, refusal: { code: "", human: "" }, isRead: false, body: {}, source: "" }, "rows", () => [{ k: "x" }]);
  check("SERVED: a projection never turns a read in flight into data", loading.isRead === false && loading.isReading === true && !("rows" in loading.body));
  const refusedByManifest = sv.servedRead({}, { manifest: { routes: [] } }, [], "/api/jobs");
  check("SERVED: a route the manifest does not declare is READ_REFUSED by the host's own rule", refusedByManifest.isRefused === true && refusedByManifest.refusal.code === "READ_REFUSED");
  const torn = read({ route: "/api/jobs", rows: [], parser: "p", sources: [], spine: { torn: 2, skipped: 1 } });
  check("SERVED: a log route's unread spine lines are named under the table", /3 spine lines the reader could not read/.test(torn.source), torn.source);
  const gates = sv.gateModes({ isReading: false, isRefused: false, refusal: { code: "", human: "" }, isRead: true, source: "", body: {
    route: "/api/gates", profile: "standard", profileRefused: "", profileResolver: "arc-profile.sh",
    gates: [{ name: "scan", mode: "profile", tier: "hook", evidence: "e1", resolved: "block" }, { name: "reviews", mode: "block", tier: "hook", evidence: "e2", resolved: "" }, { name: "docs", mode: "profile", tier: "ci", evidence: "e3", resolved: "" }],
  } }, "Gates");
  check("SERVED: the gates table's columns are gate, mode, tier, evidence -- in that order",
    JSON.stringify(gates.columns) === JSON.stringify(["gate", "mode", "tier", "evidence"]) && JSON.stringify(gates.rows[1].cells) === JSON.stringify(["reviews", "block", "hook", "e2"]), JSON.stringify(gates.rows[1]));
  check("SERVED: a profile gate shows the mode the resolver gave it, and one it could not resolve says so -- never a guess",
    gates.rows[0].cells[1] === "block (by the profile)" && gates.rows[2].cells[1] === "profile -- not resolved" && /standard/.test(gates.note), JSON.stringify(gates.rows.map((r) => r.cells[1])));
}

// ── the folds, each over a body shaped to kill one mutant ────────────────────────────────────────────────────────────
{
  // money: BOTH substances and TWO currencies and an unmeasurable line on ONE day -- where a sum would hide.
  const series = Array.from({ length: 14 }, (_, i) => ({
    day: `2026-09-${String(5 + i).padStart(2, "0")}`,
    realMinor: i === 13 ? 250000 : 0, realRows: i === 13 ? 1 : 0,
    simulatedMinor: i === 13 ? 99900 : 0, simulatedRows: i === 13 ? 1 : 0,
    costLines: i === 13 ? [{ currency: "INR", lines: 2 }, { currency: "USD", lines: 1 }] : [],
    unmeasuredCostLines: i === 13 ? 1 : 0,
  }));
  const body = { route: "/api/pnl", by: "day", badge: "log", parser: "p", sources: [], series };
  const f = await foldWith("money", "money", only("/api/pnl", body, { by: "day" }));
  check("MONEY DAY: the real cell holds the real amount alone -- never real + simulated", f.chart.rows[13].cells[1] === "₹2,500.00 · 1 receipt", f.chart.rows[13].cells[1]);
  check("MONEY DAY: the simulated cell holds the simulated amount alone, labelled", f.chartSim.rows[13].cells[1] === "₹999.00 simulated · 1 receipt", f.chartSim.rows[13].cells[1]);
  check("MONEY DAY: cost lines counted per currency and never totalled, the unmeasurable one counted on its day",
    f.chartCost.rows[13].cells[1] === "2 in INR · 1 in USD · 1 with no readable amount", f.chartCost.rows[13].cells[1]);
  const month = await foldWith("money", "money", only("/api/pnl", { route: "/api/pnl", model: {} }, { by: "day" }));
  check("MONEY DAY: a /api/pnl body that is not the day series is WRONG_SERIES, never fourteen days", month.chart.isRefused === true && month.chart.refusal.code === "WRONG_SERIES", JSON.stringify(month.chart.refusal));

  // scheduler: the overdue FLAG decides, not the state string; a disabled job says so.
  const jobs = { route: "/api/jobs", overdueSlots: 2, observedFrom: "2026-09-01", jobs: [
    { name: "a", enabled: true, cadence: "daily@06:00", nextExpected: "2026-09-19T06:00:00+05:30", missed: 5, overdue: true, state: "enabled", lastRun: "2026-09-10T06:00:00+05:30" },
    { name: "b", enabled: false, cadence: "daily@07:00", nextExpected: null, missed: 0, overdue: false, state: "disabled", lastRun: null },
  ] };
  const sch = await foldWith("kernel", "scheduler", only("/api/jobs", jobs));
  check("SCHEDULER: a job whose overdue flag is set reads overdue, whatever its state string says", sch.heartbeat.rows[0].cells[1] === "overdue" && sch.heartbeat.rows[0].cells[2] === "5", JSON.stringify(sch.heartbeat.rows[0]));
  check("SCHEDULER: a disabled job is drawn disabled, not enabled", sch.nextFire.rows[1].cells[3] === "disabled" && sch.nextFire.rows[1].cells[2] === "—" && sch.heartbeat.rows[1].cells[3] === "never on this spine", JSON.stringify(sch.nextFire.rows[1]));

  // policy: the EFFECTIVE level leads; the ceiling appears only beside a lower effective level.
  const pol = await foldWith("kernel", "policy", only("/api/policy", { route: "/api/policy", capabilities: ["read", "write"], transitions: 0,
    levels: [{ level: "L0", meaning: "denied" }, { level: "L1", meaning: "propose" }, { level: "L2", meaning: "bounded" }, { level: "L3", meaning: "unbounded" }],
    subjects: [{ subject: "process:x", e2: [], cells: [{ capability: "read", ceiling: "L3", cap: "L1", effective: "L1" }, { capability: "write", ceiling: "L1", cap: "L1", effective: "L1" }] }] }));
  check("POLICY: a cell draws the effective level, with the ceiling beside it only where the cap holds it lower",
    JSON.stringify(pol.subjects.rows[0].cells) === JSON.stringify(["process:x", "L1 (ceiling L3)", "L1"]), JSON.stringify(pol.subjects.rows[0].cells));
  check("POLICY: the ladder counts the pairs on each rung by their effective level", pol.ladder.rows.find((r) => r.key === "L1").cells[2] === "2" && pol.ladder.rows.find((r) => r.key === "L3").cells[2] === "0");

  // legal: one seal the policy does not quote is drawn as drifted, and the check says it fails.
  const leg = await foldWith("money", "legal", only("/api/legal", { route: "/api/legal", quoteHolds: false, quoteProblem: "ungrantable_actions[1] drifted", publishGate: [],
    seals: [{ seal: "moving money", quoted: true }, { seal: "killing a venture", quoted: false }] }));
  check("LEGAL: a seal the policy file does not quote is drawn as drifted, never as quoted", leg.seals.rows[1].cells[1] === "NO -- the quote drifted" && leg.seals.rows[0].cells[1] === "yes, element for element");
  check("LEGAL: a quote that does not hold says the policy lane's check FAILS", /FAILS: ungrantable_actions\[1\] drifted/.test(leg.seals.note), leg.seals.note);

  // council: a scored verdict carries its outcome; an unscored one says so.
  const cou = await foldWith("factory", "council-chamber", only("/api/council", { route: "/api/council", calibration: { scored: 1, excluded: 0, pending: 1, floor: 20, brier: null, verdict: "", buckets: [] },
    verdicts: [{ id: "01K00000000000000000000001", ts: "t", session: "c-1", call: "proceed", confidence: "High", outcome: "happened", observed: "2026-07-20T09:00:00+05:30" }, { id: "01K00000000000000000000002", ts: "t", session: "c-2", call: "hold", confidence: "Low", outcome: "", observed: "" }] }));
  check("COUNCIL: a scored verdict shows its outcome and its day; an unscored one reads not scored yet",
    cou.ledger.rows[0].cells[3] === "happened · 2026-07-20" && cou.ledger.rows[1].cells[3] === "not scored yet", JSON.stringify(cou.ledger.rows.map((r) => r.cells[3])));

  // develop: the Definition of Done is blind to nothing -- a refused heading, a missing task file.
  const dev = await foldWith("factory", "develop", only("/api/slices", { route: "/api/slices", lanes: [
    { lane: "alpha", phase: "02", file: "initiatives/alpha/phases/phase-02-tasks.md", present: true, why: "", proven: 2, total: 2, next: "", errors: 1, slices: [] },
    { lane: "beta", phase: "03", file: "initiatives/beta/phases/phase-03-tasks.md", present: true, why: "", proven: 3, total: 3, next: "", errors: 0, slices: [] },
    { lane: "gamma", phase: "01", file: "", present: false, why: "no task file for this phase", proven: 0, total: 0, next: "", errors: 0, slices: [] },
  ] }));
  const dodOf = (lane) => dev.dod.rows.find((r) => r.key === lane).cells;
  check("DEVELOP: a task file with a heading the parser refused does NOT prove its close", /1 slice heading the parser refused/.test(dodOf("alpha")[2]) && dodOf("alpha")[1] === "2 of 2 (+1 unread)", JSON.stringify(dodOf("alpha")));
  check("DEVELOP: every slice proven, with nothing refused, reads proven", dodOf("beta")[2] === "none -- every slice proven");
  check("DEVELOP: a lane with no task file says why, and claims no count", dodOf("gamma")[1] === "—" && dodOf("gamma")[3] === "no task file for this phase", JSON.stringify(dodOf("gamma")));

  // absorb: the lint's warnings are carried; a body without the list is the verdict UNREAD, never clean.
  const tech = [{ id: "T-01", name: "n", status: "adopted", lane: "absorb", source: "s", classification: "r.md", evidence: ["a.md", "b.md"], adopt: "initiatives/x/decision.md", retire: "", review_by: "" }];
  const abWarn = await foldWith("kernel", "absorb", only("/api/absorb", { route: "/api/absorb", cap: 12, techniques: tech, adoptedPerLane: [{ lane: "absorb", adopted: 1 }], warnings: ["WARN  [cap] lane at the cap"] }));
  check("ABSORB: the lint's warnings are drawn, never a clean note", /warns 1 time: WARN {2}\[cap\] lane at the cap/.test(abWarn.registry.note), abWarn.registry.note);
  check("ABSORB: evidence counted as the lint accepts it, and a decision named by a path shown whole", /2 evidence files/.test(abWarn.registry.rows[0].cells[3]) && /decided initiatives\/x\/decision\.md/.test(abWarn.registry.rows[0].cells[3]), abWarn.registry.rows[0].cells[3]);
  const abNone = await foldWith("kernel", "absorb", only("/api/absorb", { route: "/api/absorb", cap: 12, techniques: tech, adoptedPerLane: [] }));
  check("ABSORB: a body with no warnings list reads the lint's verdict UNREAD", /verdict is unread/.test(abNone.registry.note), abNone.registry.note);

  // leads: suppressed outranks replied; a touch after the door's clock is the guard's refusal, said.
  const L = (c) => `lead_hmac_v1_${c.repeat(32)}`;
  const leads = await foldWith("money", "leads", only("/api/leads", { route: "/api/leads", today: "2026-09-18", capsFrom: ".claude/config/leads.json",
    caps: { per_ist_day: 20, touches_per_lead: 2, rolling_window_days: 7 }, sendsToday: { real: 0, rehearsal: 0, unmarked: 0, unplaceable: 1 }, idsWithheld: 1, bounces: 0, complaints: 0,
    suppressed: [L("a")],
    leads: [
      { lead_id: L("a"), touches: 1, inWindow: 1, afterNow: 0, unreadable: 0, last: "2026-09-17T10:00:00+05:30", replied: true, suppressed: true },
      { lead_id: L("b"), touches: 1, inWindow: 1, afterNow: 0, unreadable: 0, last: "2026-09-17T10:00:00+05:30", replied: true, suppressed: false },
      { lead_id: L("c"), touches: 3, inWindow: 0, afterNow: 3, unreadable: 0, last: "2026-09-20T10:00:00+05:30", replied: false, suppressed: false },
    ] }));
  const stands = leads.byLead.rows.map((r) => r.cells[1]);
  check("LEADS: suppressed outranks replied, replied outranks sent", stands[0] === "suppressed" && stands[1] === "replied", JSON.stringify(stands));
  check("LEADS: touches stamped after the door's clock are the guard's clock-skew refusal, never a quiet zero", /refused by the guard: 3 touches stamped after the door's clock/.test(stands[2]), stands[2]);
  check("LEADS: withheld ids and unplaceable sends are named, never silent", /1 receipt id that are not an HMAC lead id withheld/.test(leads.byLead.note) && /1 send with no placeable time/.test(leads.caps.note), `${leads.byLead.note} || ${leads.caps.note}`);

  // evolve: units set aside and damaged receipts are said, so a thin count is never the whole measurement.
  const evo = await foldWith("kernel", "evolve", only("/api/evolve", { route: "/api/evolve", superseded: 0, damaged: 2, manifestsRead: 1, contracts: [],
    experiments: [{ id: "x-1", module: "m", surface: "s", arms: ["+a", "+b"], split: 50, ttl_days: 14, opened: "t", verdict: null, closed: null, proposals: 0, conflicts: 1, strayArms: ["+zz"],
      metrics: [{ metric: "m", windows: 1, complete: 1, arms: [{ arm: "+a", units: 1, observations: 1 }, { arm: "+b", units: 0, observations: 0 }] }] }] }));
  check("EVOLVE: a conflicting unit and a stray arm are said on the row", /1 unit measured under an arm it was not assigned, set aside/.test(evo.experiments.rows[0].cells[2]) && /undeclared arm \+zz/.test(evo.experiments.rows[0].cells[2]), evo.experiments.rows[0].cells[2]);
  check("EVOLVE: receipts the lane's own screen refused are counted under the table", /2 experiment receipts the evolve lane's own screen refused/.test(evo.experiments.note), evo.experiments.note);

  // KPIs count what the table DREW, never the raw list: a body with no list is "—", not 0.
  const mpNone = await foldWith("kernel", "model-policy", only("/api/model-policy", { route: "/api/model-policy", today: "2026-09-18", faults: [] }));
  const mpHalf = await foldWith("kernel", "model-policy", only("/api/model-policy", { route: "/api/model-policy", today: "2026-09-18", faults: [], classes: [],
    tiers: [{ tier: "cheap-scan", models: [] }, null, 7, { tier: "" }] }));
  const kpi = (f, key) => (f.kpis.find((k) => k.key === key) || { v: "?" }).v;
  check("KPI: a body with no tiers list shows no tier count, never 0", kpi(mpNone, "tiers") === "—" && mpNone.tiers.isRefused === true, kpi(mpNone, "tiers"));
  check("KPI: the tier count is the rows the table drew, not the raw list's length", kpi(mpHalf, "tiers") === "1" && mpHalf.tiers.rows.length === 1, kpi(mpHalf, "tiers"));
  const exNone = await foldWith("factory", "executor", only("/api/roster", { route: "/api/roster", today: "2026-09-18" }));
  check("KPI: the executor's contractors and runs read — when the roster sent no lists", kpi(exNone, "contractors") === "—" && kpi(exNone, "runs") === "—", `${kpi(exNone, "contractors")} ${kpi(exNone, "runs")}`);
  const lrNone = await foldWith("company", "learn", only("/api/learn", { route: "/api/learn", today: "2026-09-18", weekFrom: "2026-09-12" }));
  check("KPI: the playbook's rule count reads — when the body sent no rules", kpi(lrNone, "rules") === "—" && lrNone.rules.isRefused === true, kpi(lrNone, "rules"));
}

// ── deriveDaily: the money brain's day series, on the fixture's own day ──────────────────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), "face-p04-"));
const SPINE = join(tmp, "spine");
const gen = JSON.parse(execFileSync(process.execPath, [join(REPO, "tests/fixtures/face/gen-spine.mjs"), "--out", SPINE, "--count", "60", "--days", "2", "--seed", "p04-folds", "--phase04", "1"], { stdio: ["ignore", "pipe", "inherit"] }).toString());
check("fixture loaded with its Phase 04 block (vacuous-pass guard)", gen.phase04 === 24 && gen.events === 84, JSON.stringify({ events: gen.events, phase04: gen.phase04 }));
{
  const day = "2026-07-20";
  const real = await pnl.deriveDaily(SPINE, { mode: "real", days: 14, today: day });
  const sim = await pnl.deriveDaily(SPINE, { mode: "simulated", days: 14, today: day });
  const r = real.days[13];
  const s = sim.days[13];
  check("DAILY: fourteen days ending the day asked for", real.days.length === 14 && r.day === day && real.days[0].day === "2026-07-07", JSON.stringify(real.days.map((d) => d.day).slice(0, 2)));
  check("DAILY: the real receipt lands on its day, the simulated one on its own series", r.cashInInr === 250000 && r.rows === 1 && s.cashInInr === 99900 && s.rows >= 1, JSON.stringify({ r, s }));
  check("DAILY: cost lines are counted per currency and the unmeasurable one on its day -- none summed",
    JSON.stringify(r.costLines) === JSON.stringify([{ currency: "INR", lines: 1 }, { currency: "USD", lines: 1 }]) && r.unmeasuredCostLines === 1, JSON.stringify(r));
  // The day agrees with the month: the same derivePnl rows, bucketed by day rather than by month.
  const month = await pnl.derivePnl(SPINE, { mode: "real", month: "2026-07" });
  const onDay = month.ventures.flatMap((v) => v.rows).filter((row) => row.ts.slice(0, 10) === day).reduce((n, row) => n + row.amountInr, 0);
  check("DAILY: the day's cash-in equals the month model's rows recorded that day", onDay === r.cashInInr && onDay > 0, `${onDay} vs ${r.cashInInr}`);
  let threw = null;
  try { await pnl.deriveDaily(SPINE, { mode: "real", days: 14, today: "2026-09-31" }); } catch (e) { threw = e; }
  check("DAILY: a day that is not a day (2026-09-31) is refused, never rolled into October", threw !== null && /today must be a YYYY-MM-DD day/.test(String(threw.message)), String(threw && threw.message));
}

// ── the door's boundary, on a hostile scratch tree ────────────────────────────────────────────────────────────────────
{
  const T = join(tmp, "tree");
  const put = (rel, text) => { mkdirSync(dirname(join(T, rel)), { recursive: true }); writeFileSync(join(T, rel), text); };
  const copy = (rel) => { mkdirSync(dirname(join(T, rel)), { recursive: true }); copyFileSync(join(REPO, rel), join(T, rel)); };
  const ctx = { mode: "sim", root: SPINE, repo: T };
  const url = (p) => new URL(`http://127.0.0.1${p}`);
  const refused = async (fn, path) => { try { await fn(ctx, url(path)); return null; } catch (e) { return e; } };

  put("hq.jobs.yaml", "version: 1\njobs:\n  a: 1\n");
  let e = await refused(reads.apiJobs, "/api/jobs");
  check("DOOR: a schedule whose jobs are a mapping is SOURCE_INVALID, never \"no jobs\"", e && e.code === "SOURCE_INVALID", String(e && e.message));
  put("arc.gates.yaml", "gate:\n  - name: scan\n    mode: block\n");
  e = await refused(reads.apiGates, "/api/gates");
  check("DOOR: a gates file whose list key is misspelt is SOURCE_INVALID, never 0 gates", e && e.code === "SOURCE_INVALID", String(e && e.message));
  put("engine/router.yaml", "classes:\n  a:\n    tier: t\n    driver: d\n");
  e = await refused(reads.apiModelPolicy, "/api/model-policy");
  check("DOOR: a router with no tiers list is SOURCE_INVALID, never 0 tiers", e && e.code === "SOURCE_INVALID" && /tiers/.test(e.message), String(e && e.message));

  copy("engine/router.yaml");
  e = await refused(reads.apiEngine, "/api/engine");
  check("DOOR: a tree with no drivers directory is a named SOURCE_ABSENT, not a 500 with a path", e && e.code === "SOURCE_ABSENT" && !/[A-Za-z]:[\\/]/.test(e.message), String(e && e.message));

  put(".claude/scripts/engine/drivers/mock.sh", "#!/usr/bin/env bash\n");
  copy("initiatives/bench/ceilings.json");
  process.env.ARC_BENCH_CEILINGS = join(REPO, "initiatives/bench/ceilings.json");
  const eng = await reads.apiEngine(ctx, url("/api/engine"));
  delete process.env.ARC_BENCH_CEILINGS;
  check("DOOR: ARC_BENCH_CEILINGS set in the door's env refuses the budgets by name -- another file's caps never ride this tree's sha",
    eng.budgets === null && /ARC_BENCH_CEILINGS is set/.test(eng.budgetsRefused) && eng.sources.every((s) => s.path !== "initiatives/bench/ceilings.json"), eng.budgetsRefused);

  put("docs/adr", "not a directory");
  e = await refused(reads.apiAdrs, "/api/adrs");
  check("DOOR: docs/adr as a FILE is SOURCE_INVALID, not a 500", e && e.code === "SOURCE_INVALID", String(e && e.message));

  // Containment: a junction (Windows) or symlink (elsewhere) that points off the tree.
  const OUT = join(tmp, "outside");
  mkdirSync(join(OUT, "adr"), { recursive: true });
  writeFileSync(join(OUT, "adr", "0001-off-tree.md"), "# ADR 0001 -- OFF-TREE\n\n**Status:** accepted\n");
  const T2 = join(tmp, "tree2");
  mkdirSync(join(T2, "docs"), { recursive: true });
  let linked = false;
  try { symlinkSync(join(OUT, "adr"), join(T2, "docs", "adr"), process.platform === "win32" ? "junction" : "dir"); linked = true; } catch { linked = false; }
  check("positive control: the off-tree link was created", linked === true);
  let off = null;
  try { await reads.apiAdrs({ ...ctx, repo: T2 }, url("/api/adrs")); } catch (x) { off = x; }
  check("DOOR: a directory that resolves off the tree is SOURCE_OUTSIDE -- no off-tree ADR is served", off && off.code === "SOURCE_OUTSIDE", String(off && off.message));

  // PII: an address where a lead id belongs, a path in a run's reason.
  const T3 = join(tmp, "tree3");
  mkdirSync(join(T3, "engine"), { recursive: true });
  copyFileSync(join(REPO, "engine/router.yaml"), join(T3, "engine/router.yaml"));
  const S3 = join(tmp, "spine3", "events");
  mkdirSync(S3, { recursive: true });
  const line = (i, kind, payload) => {
    const ev = { actor: "p04", cost: null, evidence: null, id: canonical.newUlid(Date.parse("2026-07-20T04:00:00Z") + i * 1000, `p04pii${i}`), idem: canonical.sha256Hex(`p04pii${i}`), kind, model: null, outcome: "ok", payload, process: "p04@1", run_id: "r-p04", supersedes: null, ts: `2026-07-20T09:3${i}:00+05:30`, v: 1, venture: "arc" };
    ev.sha = canonical.eventSha(ev);
    return canonical.canonicalize(ev);
  };
  const BS = String.fromCharCode(92);
  writeFileSync(join(S3, "2026-07-20.jsonl"), [
    line(0, "outreach.sent", { lead_id: "alice@example.com", campaign: "c", submitted_at: "2026-07-20T09:30:00+05:30", rehearsal: true }),
    line(1, "outreach.sent", { lead_id: `lead_hmac_v1_${"d".repeat(32)}`, campaign: "c", submitted_at: "2026-07-20T09:31:00+05:30", rehearsal: true }),
    line(2, "run.completed", { process: "build-in-public-draft", driver: "hermes", outcome: "failed", reason: `see C:${BS}Users${BS}bob${BS}secret.txt and bob@example.com`, duration_ms: 5 }),
  ].join("\n") + "\nnull\n");
  const ctx3 = { mode: "sim", root: join(tmp, "spine3"), repo: T3 };
  const ld = await reads.apiLeads(ctx3, url("/api/leads"));
  check("DOOR: a lead_id that is not an HMAC id never reaches the wire, and is counted as withheld",
    ld.leads.length === 1 && ld.leads[0].lead_id === `lead_hmac_v1_${"d".repeat(32)}` && ld.idsWithheld === 1 && !JSON.stringify(ld).includes("@"), JSON.stringify(ld.leads));
  const ro = await reads.apiRoster(ctx3, url("/api/roster"));
  check("DOOR: a path and an address in a run's reason are withheld", ro.runs.length === 1 && !/bob/.test(ro.runs[0].reason) && /\[path withheld\]/.test(ro.runs[0].reason) && /\[address withheld\]/.test(ro.runs[0].reason), ro.runs[0] && ro.runs[0].reason);
  check("DOOR: a null line on the spine is torn -- counted, never a 500", ro.spine && ro.spine.torn === 1, JSON.stringify(ro.spine));
  const all3 = await spine.readAll(join(tmp, "spine3"));
  check("SPINE: the reader counts a non-object line as torn and hands over only objects", all3.torn.length === 1 && all3.events.every((w) => w.event && typeof w.event === "object"), JSON.stringify(all3.torn));

  // The ventures kill panel reads the criteria file of the repo the door runs in; a tree that is not that repo gets a
  // named refusal for the kill half, never another repo's kill lines under this tree's sha.
  mkdirSync(join(T3, "x"), { recursive: true });
  copyFileSync(join(REPO, "ventures.yaml"), join(T3, "ventures.yaml"));
  const ven = await reads.apiVentures(ctx3, url("/api/ventures"));
  // Whatever repo the test runs in -- this one (the panel reads ITS ventures.yaml, off this tree: refused by name) or
  // none (no panel at all) -- no kill line from another tree is drawn under this tree's criteria file.
  check("DOOR: a kill panel over another tree's criteria file is never drawn here", ven.kill.present === false && Array.isArray(ven.kill.ventures) && ven.kill.ventures.length === 0
    && (ven.kill.refused === "" || /not this tree/.test(String(ven.kill.refused))), JSON.stringify(ven.kill));
}

// ── what never reaches the wire, and the serializer's own limits ─────────────────────────────────────────────────────
{
  const repo = REPO;
  const BS = String.fromCharCode(92);
  check("SCRUB: the repo's own path becomes repo-relative", reads.scrub(`in ${join(repo, "docs", "x.md")}`, repo).replace(BS, "/") === "in docs/x.md", reads.scrub(`in ${join(repo, "docs", "x.md")}`, repo));
  check("SCRUB: another absolute path and an address are withheld; a URL is kept",
    reads.scrub(`C:${BS}Users${BS}bob /home/bob/x mail bob@example.com https://example.com/home/x`, repo) === "[path withheld] [path withheld] mail [address withheld] https://example.com/home/x",
    reads.scrub(`C:${BS}Users${BS}bob /home/bob/x mail bob@example.com https://example.com/home/x`, repo));
  check("DAY: a date with the shape and no day behind it is not a day", reads.isRealDay("2026-09-31") === false && reads.isRealDay("2026-09-99") === false && reads.isRealDay("2026-02-28") === true);
  let deep = {};
  const top = deep;
  for (let i = 0; i < 400; i++) { deep.n = {}; deep = deep.n; }
  let threw = null, out = null;
  try { out = JSON.stringify(escapeDeep(top)); } catch (x) { threw = x; }
  check("SERIALIZER: a payload nested past the cap is served as a sentence, never a stack overflow", threw === null && out !== null && out.includes("not served"), String(threw && threw.message));
  const proto = escapeDeep(JSON.parse('{"__proto__":{"a":1},"b":2}'));
  check("SERIALIZER: a key named __proto__ is kept as a key, never assigned as the prototype", Object.keys(proto).includes("__proto__") && JSON.stringify(proto).includes("__proto__"), JSON.stringify(proto));
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 55 ? 0 : 1;
