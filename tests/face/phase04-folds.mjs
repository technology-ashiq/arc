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
import { execFileSync, spawnSync } from "node:child_process";
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
const { escapeDeep, ROUTES } = await import(u(join(REPO, ".claude/scripts/hq/arc-dash.mjs")));
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
  const torn = read({ route: "/api/jobs", rows: [], parser: "p", sources: [], unreadLines: { torn: 2, skipped: 1 } });
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
  check("LEADS: withheld ids and unplaceable sends are named, never silent", /1 receipt id that are not an HMAC lead id withheld/.test(leads.byLead.note) && /1 of today's sends has no placeable time/.test(leads.caps.note), `${leads.byLead.note} || ${leads.caps.note}`);
  // The lane counts an unplaceable send IN every window (guard.mjs foldSends); a note that set it beside today's
  // figures told the owner the opposite of the cap's arithmetic (Phase 04 re-attack).
  check("LEADS: an unplaceable send is said to be IN today's figures, as the lane counts it -- never beside them", /counts it in every window, today's included/.test(leads.caps.note), leads.caps.note);

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
check("fixture loaded with its Phase 04 block (vacuous-pass guard)", gen.phase04 === 25 && gen.events === 85, JSON.stringify({ events: gen.events, phase04: gen.phase04 }));
{
  const day = "2026-07-20";
  const real = await pnl.deriveDaily(SPINE, { mode: "real", days: 14, today: day });
  const sim = await pnl.deriveDaily(SPINE, { mode: "simulated", days: 14, today: day });
  const r = real.days[13];
  const s = sim.days[13];
  check("DAILY: fourteen days ending the day asked for", real.days.length === 14 && r.day === day && real.days[0].day === "2026-07-07", JSON.stringify(real.days.map((d) => d.day).slice(0, 2)));
  check("DAILY: the real receipt lands on its day, the simulated one on its own series", r.rows === 2 && s.cashInInr === 99900 && s.rows >= 1, JSON.stringify({ r, s }));
  check("DAILY: a refund nets on its own day, as the month model nets it -- 2,500.00 less 500.00", r.cashInInr === 200000, JSON.stringify(r));
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
    line(2, "run.completed", { process: "build-in-public-draft", driver: "hermes", outcome: "failed", reason: `write to bob@example.com, then see C:${BS}Users${BS}bob${BS}secret.txt`, duration_ms: 5 }),
  ].join("\n") + "\nnull\n");
  const ctx3 = { mode: "sim", root: join(tmp, "spine3"), repo: T3 };
  const ld = await reads.apiLeads(ctx3, url("/api/leads"));
  check("DOOR: a lead_id that is not an HMAC id never reaches the wire, and is counted as withheld",
    ld.leads.length === 1 && ld.leads[0].lead_id === `lead_hmac_v1_${"d".repeat(32)}` && ld.idsWithheld === 1 && !JSON.stringify(ld).includes("@"), JSON.stringify(ld.leads));
  const ro = await reads.apiRoster(ctx3, url("/api/roster"));
  check("DOOR: a path and an address in a run's reason are withheld", ro.runs.length === 1 && !/bob/.test(ro.runs[0].reason) && /\[path withheld\]/.test(ro.runs[0].reason) && /\[address withheld\]/.test(ro.runs[0].reason), ro.runs[0] && ro.runs[0].reason);
  check("DOOR: a null line on the spine is torn -- counted, never a 500", ro.unreadLines && ro.unreadLines.torn === 1, JSON.stringify(ro.unreadLines));
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
  check("SCRUB: an address is withheld and a URL is kept -- a URL's path is not a machine's path",
    reads.scrub("mail bob@example.com at https://example.com/home/x", repo) === "mail [address withheld] at https://example.com/home/x",
    reads.scrub("mail bob@example.com at https://example.com/home/x", repo));
  // From the first absolute-path start to the END: a path may hold spaces, and stopping at the first one served the
  // rest of it (Phase 04 re-attack). Each shape a path starts with is withheld with everything after it.
  const scrubbed = [
    [`open C:${BS}Users${BS}John Smith${BS}notes.txt now`, "open [path withheld]"],
    ["see /home/bob/x then", "see [path withheld]"],
    ["at file:///C:/Users/bob/x", "at [path withheld]"],
    [`on ${BS}${BS}server${BS}share${BS}x`, "on [path withheld]"],
    ["in ~bob/notes", "in [path withheld]"],
  ].map(([input, want]) => [reads.scrub(input, repo), want]);
  check("SCRUB: a path with a space, a POSIX home, a file URL, a UNC share and a home shorthand are each withheld to the end",
    scrubbed.every(([got, want]) => got === want), JSON.stringify(scrubbed));
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

// ── the re-attack (round 2): each surviving mutant and each boundary hole, pinned where it was fixed ─────────────────
{
  const url = (p) => new URL(`http://127.0.0.1${p}`);
  const at = (iso) => String(Date.parse(iso));
  /** A spine holding exactly these receipts, one IST day. `over` replaces envelope fields before the sha is taken. */
  const spineOf = (name, specs) => {
    const dir = join(tmp, name, "events");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "2026-07-20.jsonl"), specs.map(([kind, payload, over], i) => {
      const e = { actor: "p04r2", cost: null, evidence: null, id: canonical.newUlid(Date.parse("2026-07-20T04:00:00Z") + i * 1000, `p04r2-${name}-${i}`), idem: canonical.sha256Hex(`p04r2-${name}-${i}`), kind, model: null, outcome: "ok", payload, process: "p04@1", run_id: "r-p04r2", supersedes: null, ts: `2026-07-20T09:${String(10 + i).padStart(2, "0")}:00+05:30`, v: 1, venture: "arc", ...(over || {}) };
      e.sha = canonical.eventSha(e);
      return canonical.canonicalize(e);
    }).join("\n") + "\n");
    return join(tmp, name);
  };
  /** A scratch tree holding exactly these files. */
  const treeOf = (name, files) => {
    const T = join(tmp, name);
    mkdirSync(T, { recursive: true });
    for (const [rel, body] of Object.entries(files)) { mkdirSync(dirname(join(T, rel)), { recursive: true }); writeFileSync(join(T, rel), body); }
    return T;
  };
  /** Run with these env vars set (a value of undefined unsets one), and restore them after. */
  const withEnv = async (vars, fn) => {
    const before = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
    const put = (k, v) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };
    for (const [k, v] of Object.entries(vars)) put(k, v);
    try { return await fn(); } finally { for (const [k, v] of Object.entries(before)) put(k, v); }
  };
  const caught = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

  // evolve: the lane's own admit() screen runs before the fold -- the mutant that folded without it survived round 1.
  const opened = { experiment_id: "x-fixture", module: "fixture", surface: "fixture-surface", target_path: "docs/fixture.md", base_sha: "0".repeat(64), split: 50, ttl_days: 14, arms: ["+a", "+b"] };
  const evoSpine = spineOf("r2-evolve", [["experiment.opened", opened], ["experiment.opened", { ...opened, experiment_id: "x-damaged", arms: "ab" }]]);
  const evoDoor = await reads.apiEvolve({ mode: "sim", root: evoSpine, repo: treeOf("r2-evolve-tree", {}) }, url("/api/evolve"));
  check("EVOLVE DOOR: a receipt the lane's own screen refuses is counted damaged and never folded -- arms \"ab\" is not two arms",
    evoDoor.damaged === 1 && evoDoor.experiments.length === 1 && evoDoor.experiments[0].id === "x-fixture", JSON.stringify({ damaged: evoDoor.damaged, ids: evoDoor.experiments.map((x) => x.id) }));

  // leads: the door's clock decides what is after now -- the same touch before and after it.
  const lead = `lead_hmac_v1_${"e".repeat(32)}`;
  const leadCtx = { mode: "sim", root: spineOf("r2-leads", [["outreach.sent", { lead_id: lead, campaign: "c", submitted_at: "2026-07-20T09:30:00+05:30", rehearsal: true }]]), repo: treeOf("r2-leads-tree", {}) };
  const early = await withEnv({ ARC_SPINE_NOW: at("2026-07-20T08:00:00+05:30") }, () => reads.apiLeads(leadCtx, url("/api/leads")));
  const later = await withEnv({ ARC_SPINE_NOW: at("2026-07-21T12:00:00+05:30") }, () => reads.apiLeads(leadCtx, url("/api/leads")));
  check("LEADS DOOR: a touch stamped after the door's clock is counted as that -- never in the window, never dropped",
    early.leads.length === 1 && early.leads[0].afterNow === 1 && early.leads[0].inWindow === 0 && later.leads[0].afterNow === 0 && later.leads[0].inWindow === 1, JSON.stringify([early.leads[0], later.leads[0]]));

  // learn: this week holds REAL days -- "2026-09-31" parses as a row, sorts inside the week, and is no day at all.
  const retro = ["# Retro log", "", "2026-09-31 | fixture | a row dated a day that does not exist | one | t", "2026-09-30 | fixture | a row dated a real day this week | two | t", "not a row at all | x", ""].join("\n");
  const learnDoor = await withEnv({ ARC_SPINE_NOW: at("2026-10-02T12:00:00+05:30") }, () => reads.apiLearn({ mode: "sim", root: SPINE, repo: treeOf("r2-learn", { "docs/retro-log.md": retro }) }, url("/api/learn")));
  check("LEARN DOOR: a row dated 2026-09-31 is a rule and never this week's; the malformed row is counted",
    learnDoor.today === "2026-10-02" && learnDoor.rules.length === 2 && learnDoor.thisWeek.length === 1 && learnDoor.thisWeek[0].date === "2026-09-30" && learnDoor.malformed === 1,
    JSON.stringify({ today: learnDoor.today, rules: learnDoor.rules.length, week: learnDoor.thisWeek.map((l) => l.date), malformed: learnDoor.malformed }));

  // legal: the quote is element for element -- two seals swapped are two drifted seals, not a quote that holds.
  const policyText = readFileSync(join(REPO, "hq.policy.yaml"), "utf8");
  const swapped = policyText.replace("\"moving money\"", "\"__seal__\"").replace("\"killing a venture\"", "\"moving money\"").replace("\"__seal__\"", "\"killing a venture\"");
  const legalDoor = await reads.apiLegal({ mode: "sim", root: SPINE, repo: treeOf("r2-legal", { "CONSTITUTION.md": readFileSync(join(REPO, "CONSTITUTION.md"), "utf8"), "hq.policy.yaml": swapped }) }, url("/api/legal"));
  check("LEGAL DOOR: two seals quoted in the wrong order are two drifted seals, and the quote does not hold",
    swapped !== policyText && legalDoor.quoteHolds === false && legalDoor.seals[0].quoted === false && legalDoor.seals[1].quoted === false && legalDoor.seals[2].quoted === true, JSON.stringify(legalDoor.seals));

  // policy: the parser accepts a misspelt key, so the door's own check is the only thing between it and an empty ladder.
  const noLevels = policyText.replace(/^levels:/m, "level_names:");
  const polErr = await caught(() => reads.apiPolicy({ mode: "sim", root: SPINE, repo: treeOf("r2-policy", { "hq.policy.yaml": noLevels }) }, url("/api/policy")));
  check("POLICY DOOR: a policy file whose levels key is misspelt is SOURCE_INVALID, never a ladder with no rung",
    noLevels !== policyText && polErr !== null && polErr.code === "SOURCE_INVALID" && /levels/.test(polErr.message), String(polErr && polErr.message));

  // gates: the resolver's answer is a MODE or nothing; a name that is not a name claims no profile; env overrides are named.
  const gatesYaml = "gates:\n  - name: scan\n    mode: profile\n    tier: hook\n    evidence: e1\n";
  const stub = (nameOut, modeOut) => `#!/usr/bin/env bash\nif [ "$1" = name ]; then printf '%s\\n' '${nameOut}'; else printf '%s\\n' '${modeOut}'; fi\n`;
  const gateTree = (name, nameOut, modeOut) => treeOf(name, { "arc.gates.yaml": gatesYaml, ".claude/scripts/core/arc-profile.sh": stub(nameOut, modeOut) });
  const gatesOf = (repo, env) => withEnv({ ARC_SETTINGS: undefined, ARC_PROFILE: undefined, ...env }, () => reads.apiGates({ mode: "sim", root: SPINE, repo }, url("/api/gates")));
  const okTree = gateTree("r2-gates-ok", "standard", "block");
  const gOk = await gatesOf(okTree, {});
  check("GATES DOOR (positive control): a resolver answering block resolves the gate to block, under the profile it named",
    gOk.profile === "standard" && gOk.gates[0].resolved === "block" && gOk.profileForced === false, JSON.stringify({ profile: gOk.profile, resolved: gOk.gates[0].resolved, refused: gOk.profileRefused }));
  const gJunk = await gatesOf(gateTree("r2-gates-junk", "standard", "bob@example.com"), {});
  check("GATES DOOR: a resolver echoing anything but warn or block leaves the gate unresolved -- an address never reaches the wire",
    gJunk.profile === "standard" && gJunk.gates[0].resolved === "" && !JSON.stringify(gJunk).includes("@"), JSON.stringify({ resolved: gJunk.gates[0].resolved }));
  const gName = await gatesOf(gateTree("r2-gates-name", "x y; z", "block"), {});
  check("GATES DOOR: a profile name that is not a name claims no profile, and resolves no gate",
    gName.profile === "" && /not a profile name/.test(gName.profileRefused) && gName.gates[0].resolved === "", JSON.stringify({ profile: gName.profile, refused: gName.profileRefused }));
  const gSettings = await gatesOf(okTree, { ARC_SETTINGS: join(tmp, "elsewhere-settings.json") });
  check("GATES DOOR: ARC_SETTINGS in the door's env is refused by name -- another settings file never resolves this tree's gates",
    gSettings.profile === "" && /ARC_SETTINGS is set/.test(gSettings.profileRefused) && gSettings.gates[0].resolved === "", gSettings.profileRefused);
  const gForced = await gatesOf(okTree, { ARC_PROFILE: "standard" });
  check("GATES DOOR: a profile ARC_PROFILE forced is served AND said to be forced", gForced.profile === "standard" && gForced.profileForced === true, JSON.stringify({ profile: gForced.profile, forced: gForced.profileForced }));

  // slices: a lane directory that is a junction or symlink off the tree is named, never read and never dropped.
  const sliceTree = treeOf("r2-slices", { "initiatives/.keep": "" });
  const offLane = join(tmp, "r2-outside-lane");
  mkdirSync(join(offLane, "phases"), { recursive: true });
  writeFileSync(join(offLane, "PROGRESS.md"), "status: LIVE\n");
  let laneLinked = false;
  try { symlinkSync(offLane, join(sliceTree, "initiatives", "offlane"), process.platform === "win32" ? "junction" : "dir"); laneLinked = true; } catch { laneLinked = false; }
  const slices = await reads.apiSlices({ mode: "sim", root: SPINE, repo: sliceTree }, url("/api/slices"));
  const offRow = slices.lanes.find((l) => l.lane === "offlane");
  check("SLICES DOOR: a lane whose directory resolves off the tree is NAMED in the table, not read and not dropped",
    laneLinked === true && offRow !== undefined && offRow.present === false && /resolves outside the repo/.test(offRow.why), JSON.stringify(slices.lanes));

  // council: a receipt with no payload object is skipped and counted; an envelope id that is not a ULID is served empty.
  const councilDoor = await reads.apiCouncil({ mode: "sim", root: spineOf("r2-council", [
    ["council.verdict", { session_id: "c-ok", question_hash: "a".repeat(64), call: "proceed", confidence: "High" }],
    ["council.verdict", null],
    ["council.verdict", { session_id: "c-badid", question_hash: "b".repeat(64), call: "hold", confidence: "Low" }, { id: "not-a-ulid" }],
  ]), repo: treeOf("r2-council-tree", {}) }, url("/api/council"));
  const verdictOf = (s) => councilDoor.verdicts.find((v) => v.session === s) || { id: "?" };
  check("COUNCIL DOOR: a receipt with no payload object is skipped and counted, never read into a 500",
    councilDoor.unreadLines && councilDoor.unreadLines.skipped === 1 && councilDoor.verdicts.length === 2, JSON.stringify({ unread: councilDoor.unreadLines, n: councilDoor.verdicts.length }));
  check("COUNCIL DOOR: an envelope id that is not a ULID is served empty, and a ULID is served whole",
    verdictOf("c-badid").id === "" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(verdictOf("c-ok").id), JSON.stringify(councilDoor.verdicts.map((v) => v.id)));

  // pnl, through the door's own route table: two reads for two substances, and a kill panel with no machine path.
  const pnlRoute = ROUTES.find((r) => r.method === "GET" && r.path === "/api/pnl");
  const doorCtx = { mode: "sim", root: SPINE, repo: REPO };
  const dayBody = await withEnv({ ARC_SPINE_NOW: at("2026-07-20T12:00:00+05:30") }, () => pnlRoute.handler(doorCtx, url("/api/pnl?by=day")));
  const d13 = dayBody.series[13];
  check("PNL DOOR: the day's real and simulated cells come from two reads -- 2,000.00 real after its refund, 999.00 simulated",
    d13.day === "2026-07-20" && d13.realMinor === 200000 && d13.realRows === 2 && d13.simulatedMinor === 99900 && d13.simulatedRows >= 1, JSON.stringify(d13));
  const repoOnWire = JSON.stringify(REPO).slice(1, -1);
  const month = await pnlRoute.handler(doorCtx, url("/api/pnl?month=2026-07"));
  const killPath = month.kill && typeof month.kill.path === "string" ? month.kill.path : null;
  check("PNL DOOR: the month model's kill panel is repo-relative, or withheld by name -- never the machine's absolute path",
    ((killPath !== null && !/^([A-Za-z]:|[\\/])/.test(killPath)) || (month.kill === null && month.killRefused !== "")) && !JSON.stringify(month).includes(repoOnWire), JSON.stringify(month.kill && month.kill.path));
  const monthEnv = await withEnv({ ARC_VENTURES_FILE: join(tmp, "elsewhere-ventures.yaml") }, () => pnlRoute.handler(doorCtx, url("/api/pnl?month=2026-07")));
  check("PNL DOOR: ARC_VENTURES_FILE in the door's env withholds the kill panel by name", monthEnv.kill === null && /ARC_VENTURES_FILE is set/.test(monthEnv.killRefused), JSON.stringify({ kill: monthEnv.kill, refused: monthEnv.killRefused }));

  // The folds that draw what the round-2 door now sends.
  const boardRefused = await foldWith("command", "board", only("/api/ventures", { route: "/api/ventures", criteria: [], kill: { present: false, receipted: false, path: "", asOf: "", ventures: [], refused: "the kill panel read a criteria file that is not this tree's ventures.yaml" } }));
  check("BOARD: a kill panel the door withheld is drawn as that refusal -- never as \"ventures.yaml is not on this tree\"",
    boardRefused.ventures.isRefused === true && boardRefused.ventures.refusal.code === "KILL_REFUSED" && /not this tree/.test(boardRefused.ventures.refusal.human), JSON.stringify(boardRefused.ventures.refusal));
  const boardArmed = await foldWith("command", "board", only("/api/ventures", { route: "/api/ventures", criteria: [], kill: { present: true, receipted: true, path: "ventures.yaml", asOf: "2026-09-18", refused: "", ventures: [{ venture: "lexos", criteria: [
    { criterion: "days_without_revenue", threshold: 90, status: "unevaluable", distance: null, reason: "no revenue receipt yet", unit: "days" },
    { criterion: "traffic_floor_monthly", threshold: 100, status: "ok", distance: 20, unit: "visits" },
  ] }] } }));
  check("BOARD: a distance nobody could measure says why, and a measured one carries its unit",
    boardArmed.ventures.rows.length === 2 && boardArmed.ventures.rows[0].cells[3] === "no revenue receipt yet" && boardArmed.ventures.rows[1].cells[3] === "20 visits", JSON.stringify(boardArmed.ventures.rows.map((r) => r.cells[3])));
  const daySeries = Array.from({ length: 14 }, (_, i) => ({ day: `2026-09-${String(5 + i).padStart(2, "0")}`, realMinor: 0, realRows: 0, simulatedMinor: 0, simulatedRows: 0, costLines: [], unmeasuredCostLines: 0 }));
  const moneyPlaced = await foldWith("money", "money", only("/api/pnl", { route: "/api/pnl", by: "day", series: daySeries, unplaceable: { real: 1, simulated: 0, costLines: 2 } }, { by: "day" }));
  check("MONEY DAY: receipts and cost lines with no readable day are counted under their own series, never a silent gap",
    /1 receipt with a time that names no real day is counted in the month/.test(moneyPlaced.chart.note) && /2 cost lines with a time that names no real day are counted/.test(moneyPlaced.chartCost.note) && !/names no real day/.test(moneyPlaced.chartSim.note),
    JSON.stringify([moneyPlaced.chart.note, moneyPlaced.chartSim.note, moneyPlaced.chartCost.note]));
  const learnMal = await foldWith("company", "learn", only("/api/learn", { route: "/api/learn", today: "2026-09-18", weekFrom: "2026-09-12", rules: [{ id: "r1", date: "2026-09-18", pattern: "p", prevention: "v" }], thisWeek: [], malformed: 2 }));
  check("LEARN: rows the adapter refused are counted beside the rules, so a short table is never read as a short log", /2 rows the adapter refused as malformed/.test(learnMal.rules.note), learnMal.rules.note);
  const todayMal = await foldWith("command", "today", only("/api/learn", { route: "/api/learn", today: "2026-09-18", weekFrom: "2026-09-12", rules: [], thisWeek: [], malformed: 1 }));
  check("TODAY: the week's lessons say a malformed row may be missing from them", /1 retro-log row the adapter refused as malformed/.test(todayMal.learned.note), todayMal.learned.note);

  // ── round 3: the verification pair's findings, and the mutants the round-2 suite let through ─────────────────────
  const BS = String.fromCharCode(92);
  const junction = (target, link) => { try { symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir"); return true; } catch { return false; } };
  const inDir = async (dir, fn) => { const was = process.cwd(); process.chdir(dir); try { return await fn(); } finally { process.chdir(was); } };
  const wire = (p) => JSON.stringify(p).slice(1, -1);
  const manifestFor = (route) => ({ id: "x", ring: "kernel", routes: [route], asOf: false });
  const sourceOf = (route, body) => sv.servedRead({ [reg.readKey({ route })]: ok(body) }, { manifest: manifestFor(route) }, [], route).source;

  // scrub: the drive spellings a Windows machine writes, and the case it writes them in.
  const scrub3 = [
    ["/c/Users/bob/x", "[path withheld]"], ["/cygdrive/c/Users/bob", "[path withheld]"],
    [`see ${BS}users${BS}bob${BS}x`, "see [path withheld]"], [`failedC:${BS}Users${BS}bob`, "failed[path withheld]"],
    ["https://example.com/c/x", "https://example.com/c/x"], ["a/c/d", "a/c/d"],
  ].map(([input, want]) => [reads.scrub(input, REPO), want]);
  check("SCRUB: a Git Bash drive, a Cygwin drive, a lowercase users root and a drive glued to a word are withheld; a URL and a relative path are kept",
    scrub3.every(([got, want]) => got === want), JSON.stringify(scrub3));

  // tsOf: the shape AND a real day; the envelope a route serves goes through it.
  check("TS: a ts on a day that does not exist is served empty, and a real one whole",
    reads.tsOf("2026-02-31T10:00:00+05:30") === "" && reads.tsOf("2026-07-20T09:10:00+05:30") === "2026-07-20T09:10:00+05:30" && reads.tsOf("2026-07-20 09:10") === "" && reads.idOf("not-a-ulid") === "");
  const rosterBadTs = await reads.apiRoster({ mode: "sim", root: spineOf("r3-roster", [["run.completed", { process: "p", driver: "hermes", outcome: "ok", duration_ms: 1 }, { ts: "2026-02-31T10:00:00+05:30" }]]), repo: (() => { const T = treeOf("r3-roster-tree", {}); mkdirSync(join(T, "engine"), { recursive: true }); copyFileSync(join(REPO, "engine/router.yaml"), join(T, "engine/router.yaml")); return T; })() }, url("/api/roster"));
  check("ROSTER DOOR: a run stamped 2026-02-31 is served with an empty ts, never the day that is not", rosterBadTs.runs.length === 1 && rosterBadTs.runs[0].ts === "", JSON.stringify(rosterBadTs.runs));

  // leads: `last` is a time or nothing -- the lane's day check reads ten characters, the rest must not ride through.
  const leakLead = `lead_hmac_v1_${"f".repeat(32)}`;
  const leadsLeak = await reads.apiLeads({ mode: "sim", root: spineOf("r3-leads", [["outreach.sent", { lead_id: leakLead, campaign: "c", submitted_at: `2026-07-21 sent to alice@example.com from C:${BS}Users${BS}bob${BS}leads`, rehearsal: true }]]), repo: treeOf("r3-leads-tree", {}) }, url("/api/leads"));
  check("LEADS DOOR: a submitted_at carrying an address and a path is never served as the last touch",
    leadsLeak.leads.length === 1 && leadsLeak.leads[0].last === "" && !JSON.stringify(leadsLeak).includes("@") && !JSON.stringify(leadsLeak).includes("bob"), JSON.stringify(leadsLeak.leads));

  // evolve: a junctioned product is read when it lands on the tree, and named when it does not.
  const evoTree = treeOf("r3-evolve-tree", { "real-products/inner/manifest.json": JSON.stringify({ name: "inner", evolve: { metrics: ["m"], experiments: [], promote_via: "pr" } }) });
  mkdirSync(join(evoTree, "products"), { recursive: true });
  const offProduct = treeOf("r3-outside-product", { "manifest.json": JSON.stringify({ name: "off", evolve: { metrics: ["leak"], experiments: [], promote_via: "pr" } }) });
  const evoLinked = junction(join(evoTree, "real-products", "inner"), join(evoTree, "products", "inlink")) && junction(offProduct, join(evoTree, "products", "offlink"));
  const evoLinks = await reads.apiEvolve({ mode: "sim", root: evoSpine, repo: evoTree }, url("/api/evolve"));
  const inlink = evoLinks.contracts.find((c) => c.product === "inlink");
  const offlink = evoLinks.contracts.find((c) => c.product === "offlink");
  check("EVOLVE DOOR: a junctioned product on the tree is read, and one off the tree is named, never read and never dropped",
    evoLinked && inlink !== undefined && inlink.metrics.join(",") === "m" && offlink !== undefined && /resolves outside the repo/.test(offlink.findings.join(" ")) && !JSON.stringify(evoLinks).includes("leak"), JSON.stringify(evoLinks.contracts));

  // slices: a PROGRESS.md that is not a file is named like any other unreadable lane entry.
  const progressDir = await reads.apiSlices({ mode: "sim", root: SPINE, repo: treeOf("r3-slices", { "initiatives/lanex/PROGRESS.md/.keep": "" }) }, url("/api/slices"));
  const lanex = progressDir.lanes.find((l) => l.lane === "lanex");
  check("SLICES DOOR: a lane whose PROGRESS.md is not a file is named, never silently left out", lanex !== undefined && /PROGRESS.md is not a readable file/.test(lanex.why), JSON.stringify(progressDir.lanes));

  // gates: git's location variables never reach the resolver.
  const gitStub = "#!/usr/bin/env bash\nif [ -n \"$GIT_DIR\" ]; then echo strict; else echo standard; fi\n";
  const gitTree = treeOf("r3-gates-git", { "arc.gates.yaml": gatesYaml, ".claude/scripts/core/arc-profile.sh": gitStub });
  const stubSaysUnderGit = spawnSync("bash", [join(gitTree, ".claude/scripts/core/arc-profile.sh"), "name"], { env: { ...process.env, GIT_DIR: join(tmp, "elsewhere.git") } }).stdout.toString().trim();
  const gGit = await gatesOf(gitTree, { GIT_DIR: join(tmp, "elsewhere.git"), GIT_WORK_TREE: join(tmp, "elsewhere") });
  check("GATES DOOR: GIT_DIR in the door's env never reaches arc-profile.sh -- the stub that reads it answers as if it were unset",
    stubSaysUnderGit === "strict" && gGit.profile === "standard", JSON.stringify({ stubSaysUnderGit, profile: gGit.profile, refused: gGit.profileRefused }));

  // the clock: a forced one is in the body and under the table.
  check("CLOCK: a body built on a forced clock says so, and one built on the machine's does not",
    learnDoor.clockForced === true && !("clockForced" in evoDoor) && /clock is forced \(ARC_SPINE_NOW\)/.test(sourceOf("/api/learn", learnDoor)), sourceOf("/api/learn", learnDoor));
  const bootEmpty = spawnSync(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--spine", SPINE, "--port", "8499"], { env: { ...process.env, ARC_SPINE_NOW: "not-a-clock" }, timeout: 20_000 });
  check("CLOCK: a door booted with an unreadable ARC_SPINE_NOW refuses to start by name -- never a door whose every read hangs",
    bootEmpty.status === 1 && /ARC_SPINE_NOW/.test(String(bootEmpty.stderr)), `status=${bootEmpty.status} ${String(bootEmpty.stderr).slice(0, 200)}`);

  // the reader: a day file it cannot open is counted, beside the lines it could not read.
  const unreadRoot = spineOf("r3-unread", [["council.verdict", { session_id: "c-u", question_hash: "c".repeat(64), call: "proceed", confidence: "High" }]]);
  mkdirSync(join(unreadRoot, "events", "2026-07-21.jsonl"), { recursive: true });
  const unreadAll = await spine.readAll(unreadRoot, "scan");
  const unreadCouncil = await reads.apiCouncil({ mode: "sim", root: unreadRoot, repo: treeOf("r3-unread-tree", {}) }, url("/api/council"));
  check("SPINE: a day file the reader cannot open is reported, and the door counts it under the table",
    unreadAll.events.length === 1 && Array.isArray(unreadAll.unreadable) && unreadAll.unreadable.length === 1 && unreadAll.unreadable[0].day === "2026-07-21"
    && unreadCouncil.unreadLines.days === 1 && /1 spine day file the reader could not open/.test(sourceOf("/api/council", unreadCouncil)), JSON.stringify({ unreadable: unreadAll.unreadable, lines: unreadCouncil.unreadLines }));

  // pnl: a kill panel that refuses withholds the PANEL, keeps the P&L, and names no machine path.
  const pnlTree = treeOf("r3-pnl-tree", { ".claude/.keep": "", ".git/.keep": "" });
  mkdirSync(join(pnlTree, "ventures.yaml"), { recursive: true });
  const pnlNoVentures = await inDir(pnlTree, () => pnlRoute.handler({ mode: "sim", root: SPINE, repo: pnlTree }, url("/api/pnl?month=2026-07")));
  check("PNL DOOR: a directory where ventures.yaml belongs withholds the kill panel by name and keeps the P&L -- no 500, no path",
    pnlNoVentures.kill === null && /NO_VENTURES/.test(pnlNoVentures.killRefused) && pnlNoVentures.model !== undefined && !JSON.stringify(pnlNoVentures).includes(wire(pnlTree)), String(pnlNoVentures.killRefused));

  // ventures: the panel and the parse must be ONE version -- two different files is SOURCE_CHANGING, never two halves.
  const venturesText = readFileSync(join(REPO, "ventures.yaml"), "utf8");
  const venturesMoved = venturesText.replace(/(days_without_revenue:\s*)(\d+)/, (m, a, n) => `${a}${Number(n) + 1}`);
  const changingTree = treeOf("r3-changing", { "ventures.yaml": venturesMoved, "repo/.claude/.keep": "", "repo/.git/.keep": "", "repo/ventures.yaml": venturesText });
  const changing = await inDir(join(changingTree, "repo"), () => caught(() => withEnv({ ARC_VENTURES_FILE: undefined }, () => reads.apiVentures({ mode: "sim", root: SPINE, repo: changingTree }, url("/api/ventures")))));
  check("VENTURES DOOR: a kill panel read from a different criteria file than the one parsed is SOURCE_CHANGING, never two halves of two files",
    venturesMoved !== venturesText && changing !== null && changing.code === "SOURCE_CHANGING", String(changing && changing.message));

  // the router: a file with tiers and no classes is refused, like the one with classes and no tiers.
  const noClasses = await caught(() => reads.apiModelPolicy({ mode: "sim", root: SPINE, repo: treeOf("r3-router", { "engine/router.yaml": "tiers:\n  - cheap-scan\n" }) }, url("/api/model-policy")));
  check("ROUTER DOOR: a router with no classes mapping is SOURCE_INVALID, never 0 routes", noClasses !== null && noClasses.code === "SOURCE_INVALID" && /classes/.test(noClasses.message), String(noClasses && noClasses.message));

  // the day series: a ts on a day that does not exist is unplaceable, and a cost line is counted ONCE at the door.
  const payment = (id, amount) => ({ amount, currency: "INR", venture: "lexos", provider: "fixture", provider_payment_id: id });
  const ghostDay = spineOf("r3-ghost", [
    ["revenue.received", payment("pay_ghost_real_1", 100000), { ts: "2026-06-30T10:00:00+05:30", venture: "lexos" }],
    ["revenue.received", payment("pay_ghost_real_2", 250000), { ts: "2026-06-31T10:00:00+05:30", venture: "lexos" }],
    ["cost.incurred", { amount: 700, currency: "INR", source: "measured", label: "ghost api" }, { ts: "2026-06-31T11:00:00+05:30" }],
  ]);
  const ghost = await pnl.deriveDaily(ghostDay, { mode: "real", days: 14, today: "2026-07-05" });
  const ghostSum = ghost.days.reduce((n, d) => n + d.cashInInr, 0);
  check("DAILY: a receipt on 2026-06-31 is unplaceable -- counted, never a silent gap in fourteen days",
    ghostSum === 100000 && ghost.unplaceableRows === 1 && ghost.unplaceableCostLines === 1, JSON.stringify({ ghostSum, rows: ghost.unplaceableRows, costs: ghost.unplaceableCostLines }));
  const ghostDoor = await withEnv({ ARC_SPINE_NOW: at("2026-07-05T12:00:00+05:30") }, () => pnlRoute.handler({ mode: "sim", root: ghostDay, repo: REPO }, url("/api/pnl?by=day")));
  check("PNL DOOR: one unplaceable cost line is ONE at the door, not one per substance; the revenue rows are per substance",
    ghostDoor.unplaceable.costLines === 1 && ghostDoor.unplaceable.real === 1 && ghostDoor.unplaceable.simulated === 0 && ghostDoor.clockForced === true, JSON.stringify(ghostDoor.unplaceable));
  let daysThrew = 0;
  for (const days of [0, 63]) { try { await pnl.deriveDaily(ghostDay, { mode: "real", days, today: "2026-07-05" }); } catch (e) { if (e instanceof RangeError) daysThrew += 1; } }
  const sixtyTwo = await pnl.deriveDaily(ghostDay, { mode: "real", days: 62, today: "2026-07-05" });
  check("DAILY: a window of 0 or 63 days is refused, and 62 is served", daysThrew === 2 && sixtyTwo.days.length === 62, `threw=${daysThrew}`);

  // the door's older routes: an allow-listed file, a lane and a board row that resolve off the tree.
  const outsideRoot = treeOf("r3-outside", { "docs/retro-log.md": "# off-tree retro\n", "evil/PROGRESS.md": "status: LIVE\n", "evil/PLAN.md": "# off\n" });
  const oldTree = treeOf("r3-old-tree", { "PORTFOLIO.md": "| lane | status |\n|---|---|\n| evil | LIVE |\n" });
  mkdirSync(join(oldTree, "initiatives"), { recursive: true });
  const oldLinked = junction(join(outsideRoot, "docs"), join(oldTree, "docs")) && junction(join(outsideRoot, "evil"), join(oldTree, "initiatives", "evil"));
  const oldCtx = { mode: "sim", root: SPINE, repo: oldTree };
  const fileRoute = ROUTES.find((r) => r.method === "GET" && r.prefix === "/api/file/");
  const laneRoute = ROUTES.find((r) => r.method === "GET" && r.prefix === "/api/lane/");
  const boardRoute = ROUTES.find((r) => r.method === "GET" && r.path === "/api/board");
  const fileOff = await caught(() => fileRoute.handler(oldCtx, url("/api/file/retro-log"), "retro-log"));
  const laneOff = await caught(() => laneRoute.handler(oldCtx, url("/api/lane/evil"), "evil"));
  const boardOff = await boardRoute.handler(oldCtx, url("/api/board"));
  check("FILE DOOR: an allow-listed id whose path resolves off the tree is SOURCE_OUTSIDE, never another tree's bytes", oldLinked && fileOff !== null && fileOff.code === "SOURCE_OUTSIDE", String(fileOff && fileOff.message));
  check("LANE DOOR: a lane whose directory resolves off the tree is SOURCE_OUTSIDE, never its PROGRESS.md", laneOff !== null && laneOff.code === "SOURCE_OUTSIDE", String(laneOff && laneOff.message));
  check("BOARD DOOR: a board row whose lane resolves off the tree is named in `outside` and never drawn as a lane",
    boardOff.lanes.every((l) => l.lane !== "evil") && Array.isArray(boardOff.outside) && boardOff.outside.includes("evil"), JSON.stringify({ lanes: boardOff.lanes.map((l) => l.lane), outside: boardOff.outside }));

  // ── the folds: the decision attacker's holes, and the round-2 mutants that survived ──────────────────────────────
  const U = (n) => `01K${String(n).padStart(23, "0")}`;
  const kpi = (f, key) => (f.kpis.find((k) => k.key === key) || { v: "?" }).v;
  const evoClosed = await foldWith("kernel", "evolve", only("/api/evolve", { route: "/api/evolve", superseded: 2, damaged: 0, manifestsRead: 0, contracts: [],
    experiments: [{ id: "x-closed", module: "m", surface: "s", arms: ["+a", "+b"], split: 50, ttl_days: 14, opened: "t", verdict: { outcome: "no-verdict", ts: "t" }, closed: { outcome: "killed", ts: "t" }, proposals: 0, conflicts: 0, strayArms: [], metrics: [] }] }));
  check("EVOLVE: a closed experiment reads closed with its outcome, whatever verdict came before -- as the lane's board renders it", evoClosed.experiments.rows[0].cells[3] === "closed killed", evoClosed.experiments.rows[0].cells[3]);
  check("EVOLVE: superseded receipts are counted under the table", /2 superseded receipts set aside/.test(evoClosed.experiments.note), evoClosed.experiments.note);
  const mpFaults = await foldWith("kernel", "model-policy", only("/api/model-policy", { route: "/api/model-policy", today: "2026-09-18", faults: ["classes.x.fallback must be a list"], tiers: [{ tier: "cheap-scan", models: [] }],
    classes: [{ name: "x", tier: "cheap-scan", driver: "claude-code", fallback: [], cap: "", judge: "", review_by: "", expired: false }] }));
  check("MODEL POLICY: the router loader's faults are drawn under the process routes, as the engine room draws them", /router loader reports 1 fault: classes\.x\.fallback must be a list/.test(mpFaults.routesTable.note), mpFaults.routesTable.note);
  const councilCal = (calibration) => foldWith("factory", "council-chamber", only("/api/council", { route: "/api/council", verdicts: [], calibration: { buckets: [], ...calibration } }));
  const couExcluded = await councilCal({ scored: 0, excluded: 1, pending: 0, floor: 20, brier: null, verdict: "" });
  const couBrier = await councilCal({ scored: 25, excluded: 0, pending: 0, floor: 20, brier: 0.18, verdict: "calibrated" });
  check("COUNCIL: an excluded outcome is counted in the note, never a verdict that vanished", /1 excluded -- an outcome the lane does not score/.test(couExcluded.calibration.note), couExcluded.calibration.note);
  check("COUNCIL: above the floor the note is the Brier figure over the scored calls", couBrier.calibration.note === "Brier 0.18 over 25 scored calls · calibrated", couBrier.calibration.note);
  const schAsked = await foldWith("kernel", "scheduler", only("/api/jobs", { route: "/api/jobs", overdueSlots: 2, observedFrom: "2026-09-01", jobs: [
    { name: "off-job", enabled: false, cadence: "daily@06:00", nextExpected: null, missed: 0, overdue: false, state: "disabled", lastRun: null },
    { name: "junk", enabled: true, cadence: "whenever", nextExpected: null, missed: 0, overdue: false, state: "unreadable-cadence", lastRun: null },
    { name: "live", enabled: true, cadence: "daily@07:00", nextExpected: null, missed: 0, overdue: false, state: "enabled", lastRun: null },
  ] }));
  check("SCHEDULER: a job the lane never judges reads —, never 0 missed; a judged one reads its count",
    schAsked.heartbeat.rows[0].cells[2] === "—" && schAsked.heartbeat.rows[1].cells[2] === "—" && schAsked.heartbeat.rows[2].cells[2] === "0", JSON.stringify(schAsked.heartbeat.rows.map((r) => r.cells[2])));
  const boardFuture = await foldWith("command", "board", only("/api/ventures", { route: "/api/ventures", criteria: [], kill: { present: true, receipted: true, path: "ventures.yaml", asOf: "2026-07-20", refused: "", absentCount: 2, futureRevenue: [{ venture: "lexos", count: 1 }],
    ventures: [{ venture: "lexos", criteria: [{ criterion: "days_without_revenue", threshold: 90, status: "ok", distance: 42, unit: "days", reason: "" }] }] } }));
  check("BOARD: revenue the panel set aside and criteria it could not evaluate are said beside the distances",
    /1 revenue receipt for lexos dated after the panel's clock, excluded from every distance/.test(boardFuture.ventures.note) && /2 criteria the panel could not evaluate/.test(boardFuture.ventures.note), boardFuture.ventures.note);
  const boardUnarmed = await foldWith("command", "board", only("/api/ventures", { route: "/api/ventures", criteria: [], kill: { present: true, receipted: false, path: "ventures.yaml", asOf: "", refused: "", ventures: [] } }));
  check("BOARD: an unreceipted criteria file says no line is armed, and claims no evaluation",
    boardUnarmed.ventures.showEmpty === true && /pinned by no receipt/.test(boardUnarmed.ventures.empty) && !/evaluated on/.test(boardUnarmed.ventures.note), JSON.stringify({ empty: boardUnarmed.ventures.empty, note: boardUnarmed.ventures.note }));
  const killRefusedView = (await import(u(join(LIB, "money.mjs")))).readKill({ kill: null, killRefused: "the kill panel read a criteria file that is not this tree's ventures.yaml" });
  check("MONEY: a kill panel the door withheld reads KILL_REFUSED with the door's reason, never KILL_NOT_SERVED",
    killRefusedView.refusal !== null && killRefusedView.refusal.code === "KILL_REFUSED" && /not this tree/.test(killRefusedView.refusal.human), JSON.stringify(killRefusedView.refusal));

  const lrMixed = await foldWith("company", "learn", only("/api/learn", { route: "/api/learn", today: "2026-09-18", weekFrom: "2026-09-12", rules: [{ id: "r1", date: "2026-09-18", pattern: "p", prevention: "v" }, null, { id: "" }, 5], thisWeek: [], malformed: 0 }));
  check("KPI: the playbook's rule count is the rules with an id, never the raw list", kpi(lrMixed, "rules") === "1", kpi(lrMixed, "rules"));
  const exMixed = await foldWith("factory", "executor", only("/api/roster", { route: "/api/roster", today: "2026-09-18",
    hires: [{ name: "draft", driver: "hermes", cap: "c", hosted: "h", judge: "j", review_by: "2026-12-01", expired: false }, null],
    runs: [{ id: U(1), ts: "2026-09-18T09:00:00+05:30", process: "p", driver: "hermes", outcome: "ok", duration_ms: 5 }, 7] }));
  check("KPI: the executor's contractors and runs count the rows drawn, never the raw lists", kpi(exMixed, "contractors") === "1" && kpi(exMixed, "runs") === "1", `${kpi(exMixed, "contractors")} ${kpi(exMixed, "runs")}`);
  const engBody = { route: "/api/engine", classes: [{ name: "x", tier: "t", driver: "claude-code", fallback: [], cap: "", hosted: "", judge: "", review_by: "", expired: false }], faults: ["x fault"], budgets: null, budgetsRefused: "ARC_BENCH_CEILINGS is set in the door's environment" };
  const engRoom = await foldWith("kernel", "engine-room", only("/api/engine", engBody));
  check("ENGINE ROOM: budgets the door refused are drawn as that refusal, never as an empty table",
    engRoom.budgets.isRefused === true && engRoom.budgets.refusal.code === "BUDGETS_UNREAD" && /ARC_BENCH_CEILINGS/.test(engRoom.budgets.refusal.human), JSON.stringify(engRoom.budgets.refusal));
  check("ENGINE ROOM: the router loader's faults are drawn under the drivers", /router loader reports 1 fault: x fault/.test(engRoom.drivers.note), engRoom.drivers.note);
  const memMixed = await foldWith("kernel", "memory", only("/api/memory", { route: "/api/memory", lessons: [{ id: "l1", date: "2026-09-18", project: "p", pattern: "a", prevention: "b" }, null, { id: "" }], malformed: 2 }));
  check("MEMORY: the lesson count is the rows with an id, and the malformed rows are counted beside it",
    /the newest 1 of 1/.test(memMixed.lessons.note) && /2 rows the adapter refused as malformed/.test(memMixed.lessons.note), memMixed.lessons.note);
  const strat = await foldWith("company", "strategy", only("/api/adrs", { route: "/api/adrs", files: 1, malformed: 1, adrs: [{ number: "0001", century: "0000", title: "ADR 0001 -- x", status: "accepted" }] }));
  check("STRATEGY: headers the ADR adapter flagged are counted under the record", /1 header the adapter flagged/.test(strat.adrs.note), strat.adrs.note);
  const growthSup = await foldWith("money", "growth", only("/api/growth", { route: "/api/growth", superseded: 2, clusters: [], published: [{ id: U(2), site: "s", slug: "a", title: "t", pr: "p#1", content_sha: "a".repeat(64), stage: "published" }] }));
  check("GROWTH: publications a correction superseded are counted under the pipeline", /2 earlier publications superseded by a correction/.test(growthSup.pipeline.note), growthSup.pipeline.note);
  const todayPol = await foldWith("command", "today", only("/api/policy", { route: "/api/policy", capabilities: ["read"], transitions: 0, levels: [{ level: "L1", meaning: "m" }],
    subjects: [{ subject: "process:x", e2: [], cells: [{ capability: "read", ceiling: "L3", cap: "L1", effective: "L1" }] }] }));
  check("TODAY: the policy panel draws the effective level, never the ceiling", todayPol.policy.rows[0].cells[1] === "L1", JSON.stringify(todayPol.policy.rows[0]));
  const devEmpty = await foldWith("factory", "develop", only("/api/slices", { route: "/api/slices", lanes: [{ lane: "empty", phase: "01", file: "initiatives/empty/phases/phase-01-tasks.md", present: true, why: "", proven: 0, total: 0, next: "", errors: 0, slices: [] }] }));
  check("DEVELOP: an empty task file reads no slice, never every slice proven", devEmpty.dod.rows[0].cells[2] === "no slice", JSON.stringify(devEmpty.dod.rows[0]));
  const leadsCase = await foldWith("money", "leads", only("/api/leads", { route: "/api/leads", today: "2026-09-18", capsFrom: "x", sendsToday: { real: 0, rehearsal: 0, unmarked: 0, unplaceable: 0 }, idsWithheld: 0, bounces: 0, complaints: 0, suppressed: [],
    leads: [{ lead_id: `lead_hmac_v1_${"9".repeat(32)}`, touches: 2, inWindow: 0, afterNow: 0, unreadable: 2, last: "", replied: false, suppressed: false }] }));
  check("LEADS: touches with no readable time are the guard's refusal, said -- never a quiet sent", /refused by the guard: 2 touches with no readable time/.test(leadsCase.byLead.rows[0].cells[1]), leadsCase.byLead.rows[0].cells[1]);
  check("LEADS: a body with no caps is BAD_BODY for the caps table, never a table of blanks", leadsCase.caps.isRefused === true && leadsCase.caps.refusal.code === "BAD_BODY", JSON.stringify(leadsCase.caps.refusal));
  const legalGate = await foldWith("money", "legal", only("/api/legal", { route: "/api/legal", quoteHolds: true, quoteProblem: "", seals: [], publishGate: [{ id: U(3), ts: "2026-09-18T09:00:00+05:30", what: "terms page", sha: "", state: "open" }] }));
  check("LEGAL: an open publish gate reads waiting on you, never approved", legalGate.publishGate.rows[0].cells[2] === "waiting on you", JSON.stringify(legalGate.publishGate.rows[0]));
  const reviewGates = await foldWith("factory", "review-ship", only("/api/gates", { route: "/api/gates", gates: [{ name: "scan", mode: "block", tier: "hook", evidence: "e" }], profile: "standard", profileRefused: "", profileResolver: ".claude/scripts/core/arc-profile.sh" }));
  check("REVIEW-SHIP: the gate table says its time budgets are not drawn, and why", /time budget is written as a comment in arc\.gates\.yaml/.test(reviewGates.gateModes.note), reviewGates.gateModes.note);
  const forcedModes = sv.gateModes({ isReading: false, isRefused: false, refusal: { code: "", human: "" }, isRead: true, source: "", body: { route: "/api/gates", profile: "standard", profileForced: true, profileRefused: "", profileResolver: "arc-profile.sh", gates: [{ name: "scan", mode: "block", tier: "hook", evidence: "e" }] } }, "P");
  check("GATES: a profile ARC_PROFILE forced is said to be forced", /forced there by ARC_PROFILE/.test(forcedModes.note), forcedModes.note);

  // The spine room never says "every line parsed" over a day file nobody opened; the board says how many rows it left.
  const spineLib = await import(u(join(LIB, "spine.mjs")));
  const tornOf = (spineBlock) => spineLib.tornView(spineLib.readSpineHealth({ mode: "sim", now: "2026-09-18T09:00:00+05:30", spine: spineBlock }));
  const unopened = tornOf({ torn: [], unreadableDays: 1 });
  const clean = tornOf({ torn: [], unreadableDays: 0 });
  check("SPINE ROOM: a day file the reader could not open is never 'every line parsed'; a spine with none is clean",
    unopened.state === "torn" && /1 day file of the spine could not be opened/.test(unopened.sentence) && !/Every line of the log parsed/.test(unopened.sentence) && clean.state === "clean", JSON.stringify([unopened, clean.state]));
  const boardOutside = await foldWith("command", "board", only("/api/board", { mode: "sim", badge: "file, not log", updated: "2026-09-18", lanes: [], outside: ["evil"] }));
  const lanesTile = boardOutside.kpis.find((k) => k.key === "lanes") || { sub: "" };
  check("BOARD: rows whose lane resolves off the tree are counted on the lanes tile, by name", /1 row off the tree, not read: evil/.test(lanesTile.sub), lanesTile.sub);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 130 ? 0 : 1;
