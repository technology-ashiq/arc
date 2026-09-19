// wire.mjs -- evolve's open, measure and conclude, wired to the spine (face v2 Phase 05 kernel ring, ADR-1340).
//
// The library has had these for a whole cycle -- assign(), sealBroken(), decide(), configHash(), metricHash() -- and
// nothing connected them to receipts: an experiment could only be opened by hand-typing an arc-event line, and never
// measured or concluded at all. Each function here turns the spine's receipts plus a module's evolve section into the
// ONE payload its receipt carries, or a refusal that says why. Pure: the events, the modules, the target's current
// digest and the clock are handed in; arc-evolve.mjs does the reading, and arc-event judges and writes.
//
//   planOpen     experiment.opened    base_sha = the target's sha256 as it stands; the surface must be one the module
//                                     declares; two arms (decide computes one difference); the concurrency cap
//                                     (ADR-0310) counts the module's open experiments
//   planMeasure  experiment.measured  arm and cohort from assign(); a recorded experiment.assigned must agree with it;
//                                     closed, verdicted, expired, drifted or redeclared experiments refuse
//   planConclude experiment.verdict   decide() over the VERDICT cohort, counted from the receipts the fold KEEPS (after
//                                     supersedes), each unit re-placed by assign(), direction-adjusted, at the
//                                     module's own alpha; compute-once: a test computed at floor that did not clear
//                                     is recorded as outcome no-verdict; one not yet computable is refused
//
// Every refusal is an EvolveRefusal with a code. None of these functions writes, spawns or reads a file. Every one of
// them is re-run at apply (arc-evolve --expect, core/plan-expect.mjs), so a check here holds when the receipt is
// written, not only when it was planned.

import { admit, foldExperiments } from "./board.mjs";
import { assign, concurrencyRefusal, sealBroken, ttlExpired } from "./assign.mjs";
import { decide, configHash, metricHash, zFor } from "./verdict.mjs";

export class EvolveRefusal extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(message); this.code = code; }
}
const no = (code, message) => { throw new EvolveRefusal(code, message); };

const DEFAULT_TTL_DAYS = 28;   // ADR-0310
const CONCURRENCY_CAP = 2;     // ADR-0310
const EXPERIMENT_ID_RE = /^x-[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
const ARM_RE = /^\+[a-z0-9][a-z0-9-]{0,31}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIRECTIONS = new Set(["higher-is-better", "lower-is-better"]);

/** The receipts the board would admit: a malformed experiment receipt folds into nothing, here as there. */
const admitted = (world) => admit(Array.isArray(world.events) ? world.events : []).ok;

/** The receipts of one experiment, in append order. @param {any[]} events @param {string} id */
const ofExperiment = (events, id) => events.filter((e) => e && e.payload && e.payload.experiment_id === id);

/** The clock a plan judges TTL by: the caller's, else now. */
const nowOf = (world) => (Number.isFinite(world.now) ? world.now : Date.now());

/** The module an experiment belongs to, with its declared evolve section, or a refusal naming the gap. */
function moduleFor(modules, name) {
  const m = modules.find((x) => x && x.name === name);
  if (!m) no("NO_EVOLVE_SECTION", `module ${JSON.stringify(name)} declares no valid evolve section on this tree (ADR-0301) -- it has no metrics and no floor, so an experiment on it could never conclude`);
  return m;
}

/**
 * @param {{ events: any[], modules: any[], digestOf: (path: string) => string | null, now?: number }} world
 * @param {{ experiment: string, module: string, surface: string, target: string, arms: string, split?: string, ttl?: string }} a
 */
export function planOpen(world, a) {
  if (!EXPERIMENT_ID_RE.test(a.experiment || "")) no("BAD_ARGS", `--experiment ${JSON.stringify(a.experiment)} is not an experiment id (x-<token>)`);
  if (!SLUG_RE.test(a.surface || "")) no("BAD_ARGS", `--surface ${JSON.stringify(a.surface)} is not a slug`);
  const m = moduleFor(world.modules, a.module);
  const exp = (m.experiments || []).find((e) => e && e.surface_file === a.target);
  if (!exp) no("NOT_A_SURFACE", `${a.target} is not a surface module ${m.name} declares (it declares: ${(m.experiments || []).map((e) => e.surface_file).join(", ") || "none"})`);
  const arms = String(a.arms || "").split(",");
  if (!arms.every((x) => ARM_RE.test(x))) no("BAD_ARGS", `--arms is +slug arm tags, comma-separated (got ${JSON.stringify(a.arms)})`);
  // Exactly two: decide() computes ONE difference, champion against challenger. A third arm could never conclude, and
  // it would hold one of the module's two concurrency slots until its TTL ran out (PR 3a logic attack).
  if (arms.length !== 2) no("NOT_TWO_ARMS", `an experiment has exactly two arms, champion then challenger -- the pinned test compares one pair (ADR-0306); got ${arms.length}`);
  const split = a.split !== undefined ? String(a.split).split(",").map((s) => (/^[0-9]{1,2}$/.test(s) ? Number(s) : NaN)) : [...exp.split];
  if (split.length !== arms.length || split.some((s) => !Number.isSafeInteger(s)) || split.reduce((x, y) => x + y, 0) !== 100)
    no("BAD_ARGS", `the split (${split.join(",")}) must give each of the ${arms.length} arms an integer share summing to 100`);
  const ttl = a.ttl !== undefined ? (/^[0-9]{1,3}$/.test(a.ttl) ? Number(a.ttl) : NaN) : DEFAULT_TTL_DAYS;
  if (!Number.isSafeInteger(ttl) || ttl < 1) no("BAD_ARGS", `--ttl ${JSON.stringify(a.ttl)} is a whole number of days (TTL is mandatory; ADR-0310's default is ${DEFAULT_TTL_DAYS})`);
  if (ofExperiment(admitted(world), a.experiment).some((e) => e.kind === "experiment.opened"))
    no("ALREADY_OPEN", `${a.experiment} is already opened on this spine -- an experiment is opened once`);
  const { experiments } = foldExperiments(admitted(world));
  const open = [...experiments.values()].filter((x) => x.module === m.name && x.opened_ts && !x.closed).map((x) => x.experiment_id);
  const cap = concurrencyRefusal(open, CONCURRENCY_CAP);
  if (cap) no("CONCURRENCY_CAP", cap);
  const baseSha = world.digestOf(a.target);
  if (!baseSha) no("NO_TARGET", `${a.target} is not a readable file on this tree -- base_sha seals the bytes the experiment opens against`);
  return {
    kind: "experiment.opened",
    payload: { experiment_id: a.experiment, module: m.name, surface: a.surface, target_path: a.target, base_sha: baseSha, split, ttl_days: ttl, arms },
    lines: [`open ${a.experiment} on ${m.name}/${a.surface} (${a.target}), arms ${arms.join(" vs ")} at ${split.join(":")}, ttl ${ttl}d, sealed at ${baseSha.slice(0, 12)}`],
  };
}

/**
 * The opened experiment, folded from the receipts the fold KEEPS, with its declared arm ORDER (the fold sorts arms;
 * assign walks the declared order). Refuses what nothing more may be measured or concluded on: closed, expired, arms
 * redeclared, surface drifted.
 */
function liveExperiment(world, id) {
  if (!EXPERIMENT_ID_RE.test(id || "")) no("BAD_ARGS", `--experiment ${JSON.stringify(id)} is not an experiment id (x-<token>)`);
  const events = admitted(world);
  const opened = ofExperiment(events, id).find((e) => e.kind === "experiment.opened");
  if (!opened) no("NOT_OPEN", `${id} was never opened on this spine`);
  const { experiments, kept } = foldExperiments(events);
  const x = experiments.get(id);
  if (x.closed) no("CLOSED", `${id} is closed (${x.closed.outcome}) -- nothing more is measured or concluded on it`);
  // An experiment is opened ONCE. Two opens with different arms leave the champion ambiguous -- conclude named it by
  // apply order (PR 3a logic attack) -- and two with the same arms leave the surface or the seal ambiguous. Compared in
  // DECLARED order: the fold's arm set is sorted, and a swap into sorted order read as no change at all.
  // Counted over EVERY admitted open, a superseded one included: an open corrected by `--supersedes` kept governing
  // measure and conclude (the fold keeps the correction, this read the original), and an identical re-open restarted
  // the TTL clock (PR 3a round-2 logic attack). An open is not corrected; a new experiment is opened instead.
  const opens = ofExperiment(events, id).filter((e) => e.kind === "experiment.opened");
  if (x.armsRedeclared || opens.some((e) => e.payload.arms.join(",") !== opens[0].payload.arms.join(",")))
    no("ARMS_REDECLARED", `${id} was opened more than once with different arms -- which arm is the champion is ambiguous, so nothing more is measured or concluded on it`);
  if (opens.length > 1) no("OPENED_TWICE", `${id} was opened ${opens.length} times (a correction to an open counts) -- which declaration governs is ambiguous, so nothing more is measured or concluded on it; open a new experiment instead`);
  // TTL (ADR-0310): expiry archives as no-verdict. It was checked nowhere, and an experiment 90 days into a 7-day TTL
  // still measured and concluded (PR 3a logic attack). Timed from the one open's own receipt.
  let expired;
  try { expired = ttlExpired(opened.ts, opened.payload.ttl_days, nowOf(world)); }
  catch (e) { no("TTL_UNREADABLE", `${id}'s TTL cannot be evaluated (${e instanceof Error ? e.message : e}) -- refused rather than read as live`); }
  if (expired) no("EXPIRED", `${id} was opened ${opened.ts} with a ${opened.payload.ttl_days}-day TTL, which has run out -- it archives as no-verdict, and nothing more is measured or concluded on it (ADR-0310)`);
  // The seal: measurements taken against bytes that moved cannot be attributed to either side of the move -- and a
  // verdict over them would promote a surface nobody measured.
  const broken = sealBroken(opened.payload.base_sha, world.digestOf(opened.payload.target_path) || "");
  if (broken) no("CANONICAL_DRIFT", `${broken} -- kill this experiment; its measurements no longer describe one surface`);
  return { x, opened: opened.payload, kept };
}

/** The assignments the kept receipts record for one experiment: unit -> { arm, cohort }, the last one kept. */
function recordedAssignments(kept, id) {
  const out = new Map();
  for (const e of kept) if (e.kind === "experiment.assigned" && e.payload.experiment_id === id) out.set(e.payload.unit_id, { arm: e.payload.arm, cohort: e.payload.cohort });
  return out;
}

/**
 * @param {{ events: any[], modules: any[], digestOf: (path: string) => string | null, now?: number }} world
 * @param {{ experiment: string, unit: string, metric: string, value: string, count: string, window: string, source: string }} a
 */
export function planMeasure(world, a) {
  const { x, opened, kept } = liveExperiment(world, a.experiment);
  if (x.verdict) no("VERDICTED", `${a.experiment} already has its verdict -- fixed horizon: nothing measured after it counts`);
  const m = moduleFor(world.modules, opened.module);
  if (!(m.metrics || []).some((mm) => mm && mm.name === a.metric)) no("NOT_A_METRIC", `${a.metric} is not a metric module ${m.name} declares (${(m.metrics || []).map((mm) => mm.name).join(", ")})`);
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(a.value || "")) no("BAD_ARGS", `--value ${JSON.stringify(a.value)} is a plain decimal number`);
  // At least one observation: a value over none is not a measurement, and one with --value 1 counted as a success
  // in conclude while the board said the arm had nothing (PR 3a logic attack).
  if (!/^[1-9][0-9]{0,8}$/.test(a.count || "")) no("BAD_ARGS", `--count ${JSON.stringify(a.count)} is a whole number of observations, at least 1`);
  const w = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(a.window || "");
  if (!w || !DAY_RE.test(w[1]) || !DAY_RE.test(w[2])) no("BAD_ARGS", `--window is FROM..TO as two YYYY-MM-DD days (got ${JSON.stringify(a.window)})`);
  const given = assign(a.experiment, a.unit, opened.arms, opened.split);
  // A recorded assignment must agree with assign() on BOTH arm and cohort. The first cut compared the arm alone, and
  // wrote assign()'s cohort over a receipt that recorded the other one (PR 3a logic attack).
  const rec = recordedAssignments(kept, a.experiment).get(a.unit);
  if (rec && (rec.arm !== given.arm || rec.cohort !== given.cohort))
    no("ASSIGNMENT_CONFLICT", `${a.unit} is recorded in (${rec.arm}, ${rec.cohort}) and assign() places it in (${given.arm}, ${given.cohort}) -- a unit has one assignment, and a measurement against either would be counted against the other`);
  return {
    kind: "experiment.measured",
    payload: { experiment_id: a.experiment, unit_id: a.unit, arm: given.arm, cohort: given.cohort, metric: a.metric, value: Number(a.value), unit_count: Number(a.count), window_start: w[1], window_end: w[2], source_id: a.source },
    lines: [`measure ${a.unit} in ${given.arm} (${given.cohort} cohort): ${a.metric} = ${a.value} over ${a.count} observation(s), ${w[1]}..${w[2]}`],
  };
}

/**
 * @param {{ events: any[], modules: any[], digestOf: (path: string) => string | null, now?: number }} world
 * @param {{ experiment: string }} a
 */
export function planConclude(world, a) {
  const { x, opened, kept } = liveExperiment(world, a.experiment);
  if (x.verdict) no("VERDICTED", `${a.experiment} already has its verdict -- fixed horizon: a verdict is computed once`);
  const m = moduleFor(world.modules, opened.module);
  const primaries = (m.metrics || []).filter((mm) => mm && mm.role === "primary");
  if (primaries.length !== 1) no("NO_PRIMARY", `module ${m.name} declares ${primaries.length} primary metrics; a verdict is on exactly one`);
  const primary = primaries[0].name;
  // ADR-0306: the improvement is direction-adjusted. The first cut ignored direction, and a lower-is-better metric
  // named the WORSE arm the winner (PR 3a logic attack).
  const direction = primaries[0].direction;
  if (!DIRECTIONS.has(direction)) no("BAD_DIRECTION", `${primary} declares direction ${JSON.stringify(direction)}; a verdict needs higher-is-better or lower-is-better`);
  const arms = [...opened.arms];
  if (arms.length !== 2) no("NOT_TWO_ARMS", `${a.experiment} was opened with ${arms.length} arms; the pinned test compares exactly two (ADR-0306)`);
  // The module's OWN alpha, refused when the pinned test has no quantile for it. The first cut used 0.05 whatever the
  // manifest said, and called a verdict at 0.05 on data that had none at the declared 0.01 (PR 3a logic attack).
  const alpha = m.evals ? m.evals.alpha : undefined;
  try { zFor(alpha); }
  catch { no("ALPHA_UNPINNED", `module ${m.name} declares alpha ${JSON.stringify(alpha)}, and the pinned test has a quantile for 0.05 only (ADR-0306) -- a verdict at another alpha would be a different test, so none is computed`); }
  const floor = m.evals && Number.isSafeInteger(m.evals.per_arm_floor) ? m.evals.per_arm_floor : null;
  const effectFloor = m.evals && typeof m.evals.effect_floor === "number" ? m.evals.effect_floor : 0;
  const mde = 0;
  // A guardrail is judged against a threshold, and the evolve section declares none (ADR-0301): every declared
  // guardrail is unresolved until one exists, and decide refuses unresolved rather than scoring "no breach" (ADR-1340).
  const guardrailDefs = (m.metrics || []).filter((mm) => mm && mm.role === "guardrail").map((mm) => ({ name: mm.name, threshold: null, direction: mm.direction ?? null }));
  const guardrails = guardrailDefs.map((g) => ({ name: g.name, status: "unresolved" }));

  // Every unit is re-placed by assign(), the function that placed it; a recorded experiment.assigned must agree. A
  // receipt's own arm and cohort are CLAIMS, checked against that. The first cut trusted them: a champion unit also
  // emitted as challenger counted in both arms, and generation-cohort units that wrote "verdict" were scored (PR 3a).
  /** @type {Map<string, string>} */
  const violations = new Map();
  const recorded = recordedAssignments(kept, a.experiment);
  // window -> arm -> unit -> { values, count }, over the VERDICT cohort's primary metric, receipts the fold KEEPS.
  const cells = new Map();
  for (const e of kept) {
    if (e.kind !== "experiment.measured") continue;
    const p = e.payload;
    if (p.experiment_id !== a.experiment || p.metric !== primary) continue;
    const given = assign(a.experiment, p.unit_id, arms, opened.split);
    const rec = recorded.get(p.unit_id);
    if (rec && (rec.arm !== given.arm || rec.cohort !== given.cohort)) { violations.set(p.unit_id, `its recorded assignment (${rec.arm}, ${rec.cohort}) is not the one assign() gives (${given.arm}, ${given.cohort})`); continue; }
    if (p.arm !== given.arm || p.cohort !== given.cohort) { violations.set(p.unit_id, `a receipt measures it in (${p.arm}, ${p.cohort}), and it is assigned to (${given.arm}, ${given.cohort})`); continue; }
    if (given.cohort !== "verdict") continue;
    // A receipt that observed nothing is not a trial (the board's own rule, countUnits).
    if (!(Number.isSafeInteger(p.unit_count) && p.unit_count > 0)) continue;
    if (p.value !== 0 && p.value !== 1)
      no("NOT_BINARY", `${p.unit_id} reports ${primary} = ${p.value}; v1 scores integer successes over one trial per unit (ADR-0306), so a value other than 0 or 1 is a metric family this test does not score -- ADR-0306's revisit trigger`);
    const wk = `${p.window_start}..${p.window_end}`;
    if (!cells.has(wk)) cells.set(wk, new Map(arms.map((arm) => [arm, new Map()])));
    const byUnit = cells.get(wk).get(given.arm);
    if (!byUnit.has(p.unit_id)) byUnit.set(p.unit_id, { values: new Set(), count: 0 });
    const c = byUnit.get(p.unit_id);
    c.values.add(p.value);
    c.count = Math.max(c.count, p.unit_count);
  }
  if (violations.size) {
    const [unit, why] = [...violations][0];
    no("COHORT_VIOLATION", `${violations.size} unit(s) are measured against an assignment they do not have -- ${unit}: ${why}. Supersede those receipts; nothing is concluded around them`);
  }
  // A unit is ONE trial in a window. Two receipts that say 0 and 1 for it are two stories, and the first cut took the
  // larger (PR 3a logic attack).
  for (const [wk, byArm] of cells) for (const byUnit of byArm.values()) for (const [unit, c] of byUnit)
    if (c.values.size > 1) no("CONFLICTING_VALUES", `${unit} reports both 0 and 1 for ${primary} in ${wk} -- supersede the wrong receipt; a unit is one trial`);

  // COMPLETE windows, judged on the verdict cohort alone: every arm has a verdict unit in it. The board's windows mix
  // the cohorts, and one generation unit "completed" a window the verdict cohort had measured for one arm only (PR 3a).
  const complete = [...cells].filter(([, byArm]) => arms.every((arm) => byArm.get(arm).size > 0));
  const missingWindows = cells.size - complete.length;
  // One trial per unit (ADR-0306 v1): the unit's event occurred when a complete window reports 1 for it.
  /** @type {Map<string, Map<string, number>>} */
  const occurred = new Map(arms.map((arm) => [arm, new Map()]));
  const contributions = [];
  for (const [wk, byArm] of complete) {
    const [ws, we] = wk.split("..");
    for (const arm of arms) for (const [unit, c] of byArm.get(arm)) {
      const v = [...c.values][0];
      const cur = occurred.get(arm).get(unit);
      occurred.get(arm).set(unit, cur === undefined ? v : Math.max(cur, v));
      contributions.push({ arm, unit_id: unit, metric: primary, window_start: ws, window_end: we, unit_count: c.count, successes: v });
    }
  }
  // Direction-adjusted: higher-is-better counts the units whose event occurred, lower-is-better the units whose event
  // did NOT. Either way d is how much BETTER the challenger is, and a worse challenger can never read as a winner.
  const counts = {};
  for (const arm of arms) {
    const units = occurred.get(arm);
    const ones = [...units.values()].filter((v) => v === 1).length;
    counts[arm] = { units: units.size, successes: direction === "higher-is-better" ? ones : units.size - ones };
  }
  const r = decide({
    arms, counts, floor, alpha, effectFloor, mde, guardrails,
    cohortViolations: violations.size, missingWindows, computedBefore: !!x.verdict,
  });
  // FIXED HORIZON, BOTH WAYS. A test that was COMPUTED -- both arms at floor, every window complete, no violation, no
  // guardrail left to judge -- and did not clear is a result, and it is recorded: an `experiment.verdict` with outcome
  // no-verdict and its stats. The first cut wrote nothing for it, so conclude could be run again as the data grew until
  // it won (3/10 v 6/10 no, 3/12 v 8/12 yes: PR 3a round-2 logic attack), which is the peeking ADR-0306's compute-once
  // forbids. A test that could NOT be computed yet (below floor, a window MISSING, a violation) writes nothing: its
  // horizon has not been reached.
  const computed = !!r.stats && violations.size === 0 && missingWindows === 0 && guardrails.length === 0 && !x.verdict;
  if (r.outcome !== "verdict" && !computed)
    no("NO_VERDICT", `no verdict for ${a.experiment}: ${r.reasons.join("; ")}`);
  const nPerArm = Object.fromEntries(arms.map((arm) => [arm, counts[arm].units]));
  const outcome = r.outcome === "verdict" ? "verdict" : "no-verdict";
  const head = outcome === "verdict"
    ? `conclude ${a.experiment}: ${arms[1]} vs ${arms[0]} on ${primary} (${direction}), improvement ${r.stats.d}, lower bound ${r.stats.lower}`
    : `conclude ${a.experiment}: NO VERDICT, and it is final -- the test was computed at floor and did not clear (${r.reasons.join("; ")}); fixed horizon, so it is recorded and never re-run`;
  return {
    kind: "experiment.verdict",
    payload: {
      experiment_id: a.experiment, outcome, bound: r.stats.lower, delta: r.stats.d, n_per_arm: nPerArm,
      config_hash: configHash({ alpha, effectFloor, floor, mde, arms, split: opened.split, guardrails: guardrailDefs, metric: primary, direction }),
      metric_hash: metricHash(contributions),
    },
    lines: [`${head} at alpha ${alpha} (floor ${floor} per arm; n ${arms.map((arm) => counts[arm].units).join("/")})`],
  };
}

