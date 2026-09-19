// wire.mjs -- evolve's open, measure and conclude, wired to the spine (face v2 Phase 05 kernel ring, ADR-1340).
//
// The library has had these for a whole cycle -- assign(), sealBroken(), decide(), configHash(), metricHash() -- and
// nothing connected them to receipts: an experiment could only be opened by hand-typing an arc-event line, and never
// measured or concluded at all. Each function here turns the spine's receipts plus a module's evolve section into the
// ONE payload its receipt carries, or a refusal that says why. Pure: the events, the modules and the target's current
// digest are handed in; arc-evolve.mjs does the reading, and arc-event judges and writes (the CLI prints the emit).
//
//   planOpen     experiment.opened    base_sha = the target's sha256 as it stands; the surface must be one the module
//                                     declares; the concurrency cap (ADR-0310) counts the module's open experiments
//   planMeasure  experiment.measured  arm and cohort from assign(); an experiment.assigned for the unit is the
//                                     authority; closed, verdicted or drifted experiments refuse
//   planConclude experiment.verdict   decide() over the VERDICT cohort, from the spine, compute-once; a no-verdict is
//                                     refused with decide's reasons and writes nothing
//
// Every refusal is an EvolveRefusal with a code. None of these functions writes, spawns or reads a file.

import { admit, foldExperiments, classifyWindows } from "./board.mjs";
import { assign, concurrencyRefusal, sealBroken } from "./assign.mjs";
import { decide, configHash, metricHash } from "./verdict.mjs";

export class EvolveRefusal extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(message); this.code = code; }
}
const no = (code, message) => { throw new EvolveRefusal(code, message); };

const DEFAULT_TTL_DAYS = 28;   // ADR-0310
const CONCURRENCY_CAP = 2;     // ADR-0310
const ALPHA = 0.05;            // ADR-0310; the only alpha verdict.mjs pins
const EXPERIMENT_ID_RE = /^x-[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
const ARM_RE = /^\+[a-z0-9][a-z0-9-]{0,31}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The receipts the board would admit: a malformed experiment receipt folds into nothing, here as there. */
const admitted = (world) => admit(Array.isArray(world.events) ? world.events : []).ok;

/** The receipts of one experiment, in append order. @param {any[]} events @param {string} id */
const ofExperiment = (events, id) => events.filter((e) => e && e.payload && e.payload.experiment_id === id);

/** The module an experiment belongs to, with its declared evolve section, or a refusal naming the gap. */
function moduleFor(modules, name) {
  const m = modules.find((x) => x && x.name === name);
  if (!m) no("NO_EVOLVE_SECTION", `module ${JSON.stringify(name)} declares no valid evolve section on this tree (ADR-0301) -- it has no metrics and no floor, so an experiment on it could never conclude`);
  return m;
}

/**
 * @param {{ events: any[], modules: any[], digestOf: (path: string) => string | null }} world
 * @param {{ experiment: string, module: string, surface: string, target: string, arms: string, split?: string, ttl?: string }} a
 */
export function planOpen(world, a) {
  if (!EXPERIMENT_ID_RE.test(a.experiment || "")) no("BAD_ARGS", `--experiment ${JSON.stringify(a.experiment)} is not an experiment id (x-<token>)`);
  if (!SLUG_RE.test(a.surface || "")) no("BAD_ARGS", `--surface ${JSON.stringify(a.surface)} is not a slug`);
  const m = moduleFor(world.modules, a.module);
  const exp = (m.experiments || []).find((e) => e && e.surface_file === a.target);
  if (!exp) no("NOT_A_SURFACE", `${a.target} is not a surface module ${m.name} declares (it declares: ${(m.experiments || []).map((e) => e.surface_file).join(", ") || "none"})`);
  const arms = String(a.arms || "").split(",");
  if (arms.length < 2 || !arms.every((x) => ARM_RE.test(x))) no("BAD_ARGS", `--arms is two or more +slug arm tags, comma-separated (got ${JSON.stringify(a.arms)})`);
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

/** The opened experiment, folded, with its declared arm ORDER (the fold sorts arms; assign walks the declared order). */
function openedExperiment(events, id) {
  if (!EXPERIMENT_ID_RE.test(id || "")) no("BAD_ARGS", `--experiment ${JSON.stringify(id)} is not an experiment id (x-<token>)`);
  const mine = ofExperiment(events, id);
  const opened = mine.find((e) => e.kind === "experiment.opened");
  if (!opened) no("NOT_OPEN", `${id} was never opened on this spine`);
  const { experiments } = foldExperiments(events);
  const x = experiments.get(id);
  if (x.closed) no("CLOSED", `${id} is closed (${x.closed.outcome}) -- nothing more is measured or concluded on it`);
  return { x, opened: opened.payload };
}

/**
 * @param {{ events: any[], modules: any[], digestOf: (path: string) => string | null }} world
 * @param {{ experiment: string, unit: string, metric: string, value: string, count: string, window: string, source: string }} a
 */
export function planMeasure(world, a) {
  const { x, opened } = openedExperiment(admitted(world), a.experiment);
  if (x.verdict) no("VERDICTED", `${a.experiment} already has its verdict -- fixed horizon: nothing measured after it counts`);
  const m = moduleFor(world.modules, opened.module);
  if (!(m.metrics || []).some((mm) => mm && mm.name === a.metric)) no("NOT_A_METRIC", `${a.metric} is not a metric module ${m.name} declares (${(m.metrics || []).map((mm) => mm.name).join(", ")})`);
  // The seal: measurements taken against bytes that moved cannot be attributed to either side of the move.
  const broken = sealBroken(opened.base_sha, world.digestOf(opened.target_path) || "");
  if (broken) no("CANONICAL_DRIFT", `${broken} -- kill this experiment; its measurements no longer describe one surface`);
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(a.value || "")) no("BAD_ARGS", `--value ${JSON.stringify(a.value)} is a plain decimal number`);
  if (!/^[0-9]{1,9}$/.test(a.count || "")) no("BAD_ARGS", `--count ${JSON.stringify(a.count)} is a whole number of observations`);
  const w = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(a.window || "");
  if (!w || !DAY_RE.test(w[1]) || !DAY_RE.test(w[2])) no("BAD_ARGS", `--window is FROM..TO as two YYYY-MM-DD days (got ${JSON.stringify(a.window)})`);
  const given = assign(a.experiment, a.unit, opened.arms, opened.split);
  const recorded = x.assigned.get(a.unit);
  if (recorded && recorded !== given.arm) no("ASSIGNMENT_CONFLICT", `${a.unit} is recorded in ${recorded}, and assign() puts it in ${given.arm} -- the recorded assignment is the authority, and a measurement against the other arm would count it twice`);
  const arm = recorded || given.arm;
  return {
    kind: "experiment.measured",
    payload: { experiment_id: a.experiment, unit_id: a.unit, arm, cohort: given.cohort, metric: a.metric, value: Number(a.value), unit_count: Number(a.count), window_start: w[1], window_end: w[2], source_id: a.source },
    lines: [`measure ${a.unit} in ${arm} (${given.cohort} cohort): ${a.metric} = ${a.value} over ${a.count} observation(s), ${w[1]}..${w[2]}`],
  };
}

/**
 * @param {{ events: any[], modules: any[], digestOf: (path: string) => string | null }} world
 * @param {{ experiment: string }} a
 */
export function planConclude(world, a) {
  const { x, opened } = openedExperiment(admitted(world), a.experiment);
  const m = moduleFor(world.modules, opened.module);
  const primaries = (m.metrics || []).filter((mm) => mm && mm.role === "primary");
  if (primaries.length !== 1) no("NO_PRIMARY", `module ${m.name} declares ${primaries.length} primary metrics; a verdict is on exactly one`);
  const primary = primaries[0].name;
  const arms = [...opened.arms];
  const floor = m.evals && Number.isSafeInteger(m.evals.per_arm_floor) ? m.evals.per_arm_floor : null;
  const effectFloor = m.evals && typeof m.evals.effect_floor === "number" ? m.evals.effect_floor : 0;
  const mde = 0;
  // A guardrail is judged against a threshold, and the evolve section declares none (ADR-0301): every declared
  // guardrail is unresolved until one exists, and decide refuses unresolved rather than scoring "no breach" (ADR-1340).
  const guardrailDefs = (m.metrics || []).filter((mm) => mm && mm.role === "guardrail").map((mm) => ({ name: mm.name, threshold: null, direction: mm.direction ?? null }));
  const guardrails = guardrailDefs.map((g) => ({ name: g.name, status: "unresolved" }));

  const windows = classifyWindows(x).filter((w) => w.metric === primary);
  // Matched on the LABELS classifyWindows hands back (metric, "start..end"), never on its internal key: that key joins the
  // two with a NUL, and a key rebuilt here with a space matched nothing, so every unit read as outside a complete window.
  const complete = new Set(windows.filter((w) => !w.missing).map((w) => `${w.metric}|${w.window}`));
  const missingWindows = windows.filter((w) => w.missing).length;

  // Per arm, per unit: the VERDICT cohort's primary-metric value in complete windows. One trial per unit (ADR-0306 v1):
  // a unit succeeded when its value is 1. Any other value is a metric family v1 does not score -- refused, never rounded.
  /** @type {Map<string, Map<string, number>>} */
  const perArm = new Map(arms.map((arm) => [arm, new Map()]));
  const contributions = [];
  for (const e of ofExperiment(admitted(world), a.experiment)) {
    if (e.kind !== "experiment.measured") continue;
    const p = e.payload;
    if (p.metric !== primary || p.cohort !== "verdict") continue;
    if (!complete.has(`${p.metric}|${p.window_start}..${p.window_end}`)) continue;
    const arm = x.assigned.get(p.unit_id) || p.arm;
    if (!perArm.has(arm) || x.conflicts.has(p.unit_id)) continue;
    if (p.value !== 0 && p.value !== 1)
      no("NOT_BINARY", `${p.unit_id} reports ${primary} = ${p.value}; v1 scores integer successes over one trial per unit (ADR-0306), so a value other than 0 or 1 is a metric family this test does not score -- ADR-0306's revisit trigger`);
    const cur = perArm.get(arm).get(p.unit_id);
    perArm.get(arm).set(p.unit_id, cur === undefined ? p.value : Math.max(cur, p.value));
    contributions.push({ arm, unit_id: p.unit_id, metric: p.metric, window_start: p.window_start, window_end: p.window_end, unit_count: p.unit_count, successes: p.value });
  }
  const counts = {};
  for (const [arm, units] of perArm) counts[arm] = { units: units.size, successes: [...units.values()].filter((v) => v === 1).length };
  const r = decide({
    arms, counts, floor, alpha: ALPHA, effectFloor, mde, guardrails,
    cohortViolations: x.conflicts.size + x.strayArms.size, missingWindows, computedBefore: !!x.verdict,
  });
  if (r.outcome !== "verdict" || !r.stats)
    no("NO_VERDICT", `no verdict for ${a.experiment}: ${r.reasons.join("; ")}`);
  const nPerArm = Object.fromEntries(arms.map((arm) => [arm, counts[arm].units]));
  return {
    kind: "experiment.verdict",
    payload: {
      experiment_id: a.experiment, outcome: "verdict", bound: r.stats.lower, delta: r.stats.d, n_per_arm: nPerArm,
      config_hash: configHash({ alpha: ALPHA, effectFloor, floor, mde, arms, split: opened.split, guardrails: guardrailDefs }),
      metric_hash: metricHash(contributions),
    },
    lines: [`conclude ${a.experiment}: ${arms[1]} vs ${arms[0]}, delta ${r.stats.d}, lower bound ${r.stats.lower} (floor ${floor} per arm; n ${arms.map((arm) => counts[arm].units).join("/")})`],
  };
}
