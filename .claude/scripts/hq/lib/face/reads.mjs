// reads.mjs -- the door's Phase 04 read routes (face v2 Phase 04, REQ-06; ADR-1301, ADR-1312, ADR-1324).
//
// Phase 03 drew every panel the door could not fill as NOT SERVED, naming the route it needed; the union of
// those five lists is what this file serves, and nothing else (initiatives/face/evidence/phase-03/not-served-*.md).
// arc-dash.mjs keeps the ONE route table and the one serializer; this file holds the handlers it dispatches to.
//
// THE RULE EVERY HANDLER KEEPS: the door derives no truth of its own. Each file is parsed by the function the
// lint or lane that owns it already uses, IMPORTED, never re-implemented here (PLAN-face-v2 §11); each receipt
// is read through spine.mjs, the only public API (ADR-0030). What a handler adds is only the projection -- which
// fields of what the parser returned go on the wire -- and the provenance: the route names itself, the parser
// it imported, and the sha256 of every file it parsed, so a panel can say where its table came from.
//
// THREE MORE RULES, each paid for elsewhere in this repo:
//   - A lane module is loaded LAZILY, per request. Eleven lanes' modules sit behind these routes; a static
//     import of any one that fails to load on some Node leg would take down the door that carries the owner's
//     decisions. A module that will not load refuses ITS route by name (PARSER_UNAVAILABLE), nothing else.
//   - A query key a route does not take is REFUSED (BAD_ARGS), never ignored: /api/pnl answers 200 to any
//     query it does not read, so a client asking for a mode the door does not serve gets the default and
//     cannot tell. Every route here names the keys it reads.
//   - Only plain JSON leaves a handler. The serializer escapes plain objects and arrays; a Set or a Map
//     arrives as {} -- a well-formed empty answer to a question the parser did answer.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep, isAbsolute } from "node:path";

import { readAll } from "../../spine.mjs";
import { sha256Hex, formatIst, nowMs } from "../canonical.mjs";

/** A refusal this module raises; arc-dash maps its code to a status exactly as it maps its own. */
export class ReadError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(message); this.code = code; }
}

// ---------- lazy parser imports ----------
const loaded = new Map();
/**
 * One lane module, imported on first use and cached. A module that throws while loading refuses the route
 * that needed it and nothing else; the failure is cached too, so a broken module is not re-imported per request.
 * @param {string} rel  path relative to this file
 */
async function lib(rel) {
  if (!loaded.has(rel)) loaded.set(rel, import(new URL(rel, import.meta.url).href).then((m) => ({ m }), (e) => ({ e })));
  const got = await loaded.get(rel);
  if (got.e) throw new ReadError("PARSER_UNAVAILABLE", `the parser this route imports (${rel.replace(/^(\.\.\/)+/, "")}) did not load: ${String(got.e && got.e.message).split("\n")[0].slice(0, 300)}`);
  return got.m;
}

// ---------- helpers ----------
/** Today, as an IST day -- the one clock every "today" and every tenure check on these routes reads. */
export const todayIst = () => formatIst(nowMs()).slice(0, 10);

/**
 * Refuse any query key this route does not read.
 * @param {URL} url @param {string[]} allowed
 */
function onlyQuery(url, allowed) {
  for (const k of new Set(url.searchParams.keys()))
    if (!allowed.includes(k)) throw new ReadError("BAD_ARGS", `${url.pathname} takes ${allowed.length ? allowed.join(", ") : "no query"}; "${k}" is not one of them`);
}

/**
 * One file on this tree, read once: its repo-relative path, its text and its sha256.
 * @param {{ repo: string }} ctx @param {string} rel
 */
function fileAt(ctx, rel) {
  const p = join(ctx.repo, rel);
  if (!existsSync(p) || !statSync(p).isFile()) throw new ReadError("SOURCE_ABSENT", `${rel} is not on this tree, so there is nothing for this route to parse`);
  const text = readFileSync(p, "utf8");
  return { path: rel, text, sha256: sha256Hex(text) };
}

/**
 * The shape every route answers with: the route names itself (a client can refuse a body answering another),
 * the parser it imported, and the files it parsed.
 * @param {{ mode: string }} ctx @param {string} route @param {"file, not log" | "log" | "file and log"} badge
 * @param {string} parser @param {{ path: string, sha256: string }[]} sources @param {Record<string, unknown>} body
 */
function answer(ctx, route, badge, parser, sources, body) {
  return { mode: ctx.mode, route, badge, parser, sources: sources.map((s) => ({ path: s.path, sha256: s.sha256 })), ...body };
}

/**
 * Every receipt on the spine, unwrapped, in append order -- the order every reducer here is defined over.
 * @param {{ root: string }} ctx
 */
async function spineEvents(ctx) {
  return (await readAll(ctx.root)).events.map((e) => e.event);
}

/** @param {unknown} v @returns {string} */
const str = (v) => (typeof v === "string" ? v : "");
/** @param {unknown} v @returns {Record<string, unknown>} */
const obj = (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : {});

/**
 * A lane's parser threw on the file it owns: a named refusal carrying the parser's own sentence, never a 500.
 * @param {string} rel @param {unknown} e
 */
const invalid = (rel, e) => new ReadError("SOURCE_INVALID", `${rel} did not parse: ${String(e && /** @type {Error} */ (e).message).split("\n")[0].slice(0, 400)}`);

// ---------- engine/router.yaml: /api/engine, /api/model-policy, /api/roster ----------
async function routerRead(ctx) {
  const { parseYamlSubset } = await lib("../../../engine/yaml-subset.mjs");
  const { routerFaults, isExpired, RUNTIME_DRIVERS } = await lib("../../../engine/router-row.mjs");
  const f = fileAt(ctx, "engine/router.yaml");
  const parsed = parseYamlSubset(f.text);
  if (!parsed.ok) throw invalid(f.path, { message: `${obj(parsed.error).what || "yaml-parse"} at line ${obj(parsed.error).line ?? "?"}` });
  const router = obj(parsed.value);
  const today = todayIst();
  /** @param {string} name @param {unknown} rowRaw */
  const row = (name, rowRaw) => {
    const r = obj(rowRaw);
    const fallback = Array.isArray(r.fallback) ? r.fallback.map(String) : [];
    const chain = [str(r.driver), ...fallback];
    return {
      name,
      tier: str(r.tier),
      driver: str(r.driver),
      fallback,
      runtime: chain.some((d) => RUNTIME_DRIVERS.has(d)),
      cap: str(r.cap),
      hosted: str(r.hosted),
      judge: str(r.judge),
      review_by: str(r.review_by),
      expired: isExpired(r, today),
    };
  };
  const classes = Object.entries(obj(router.classes)).map(([name, r]) => row(name, r));
  const models = obj(router.models);
  return {
    f,
    today,
    faults: routerFaults(router),
    tiers: (Array.isArray(router.tiers) ? router.tiers.map(String) : []).map((tier) => ({
      tier,
      models: Object.entries(obj(models[tier])).map(([driver, model]) => ({ driver, model: String(model) })),
    })),
    classes,
    fallbackRow: Object.hasOwn(router, "default") ? row("default", router.default) : null,
  };
}

/** GET /api/engine -- the drivers on disk, the router row for every task class, and each capped budget. */
export async function apiEngine(ctx, url) {
  onlyQuery(url, []);
  const r = await routerRead(ctx);
  const { knownDrivers, readCeilings } = await lib("../../../engine/arc-bench.mjs");
  const sources = [r.f];
  let budgets = null;
  let budgetsRefused = "";
  const ceilings = join(ctx.repo, "initiatives", "bench", "ceilings.json");
  if (!existsSync(ceilings)) budgetsRefused = "initiatives/bench/ceilings.json is not on this tree";
  else {
    sources.push(fileAt(ctx, "initiatives/bench/ceilings.json"));
    try {
      const c = readCeilings(ctx.repo);
      budgets = {
        as_of: str(c.as_of),
        run_cap_inr: c.run_cap_inr,
        process_cap_inr: c.process_cap_inr,
        k: c.k,
        rows: Object.entries(obj(c.worst_case_inr_per_invocation)).flatMap(([driver, models]) =>
          Object.entries(obj(models)).map(([model, inr]) => ({ driver, model, worst_case_inr: inr }))),
      };
    } catch (e) { budgetsRefused = `the bench's ceiling reader refused the file: ${String(/** @type {Error} */ (e).message).split("\n")[0]}`; }
  }
  return answer(ctx, "/api/engine", "file, not log",
    "engine/yaml-subset.mjs#parseYamlSubset · engine/router-row.mjs#routerFaults,isExpired · engine/arc-bench.mjs#knownDrivers,readCeilings",
    sources, {
      today: r.today,
      drivers: knownDrivers(ctx.repo),
      classes: r.fallbackRow ? [...r.classes, r.fallbackRow] : r.classes,
      faults: r.faults,
      budgets,
      budgetsRefused,
    });
}

/** GET /api/model-policy -- each tier and the model implementing it, and every process class's route and terms. */
export async function apiModelPolicy(ctx, url) {
  onlyQuery(url, []);
  const r = await routerRead(ctx);
  return answer(ctx, "/api/model-policy", "file, not log",
    "engine/yaml-subset.mjs#parseYamlSubset · engine/router-row.mjs#routerFaults,isExpired", [r.f], {
      today: r.today,
      tiers: r.tiers,
      classes: r.fallbackRow ? [...r.classes, r.fallbackRow] : r.classes,
      faults: r.faults,
    });
}

/** GET /api/roster -- the contractors router.yaml hires (a runtime row, or one carrying tenure terms) and their runs. */
export async function apiRoster(ctx, url) {
  onlyQuery(url, []);
  const r = await routerRead(ctx);
  const { RUNTIME_DRIVERS } = await lib("../../../engine/router-row.mjs");
  const hires = r.classes.filter((c) => c.runtime || c.cap !== "" || c.judge !== "" || c.review_by !== "");
  const runs = (await spineEvents(ctx))
    .filter((e) => e.kind === "run.completed" && RUNTIME_DRIVERS.has(str(obj(e.payload).driver)))
    .map((e) => {
      const p = obj(e.payload);
      return { id: e.id, ts: e.ts, process: str(p.process), driver: str(p.driver), outcome: str(p.outcome) || str(e.outcome), reason: str(p.reason), duration_ms: typeof p.duration_ms === "number" ? p.duration_ms : null };
    });
  return answer(ctx, "/api/roster", "file and log", "engine/yaml-subset.mjs#parseYamlSubset · engine/router-row.mjs#isExpired,RUNTIME_DRIVERS · spine.mjs#readAll", [r.f], {
    today: r.today,
    hires,
    runs,
  });
}

// ---------- hq.policy.yaml: /api/policy ----------
/** GET /api/policy -- one row per subject with every capability pair's ceiling, cap and effective level. */
export async function apiPolicy(ctx, url) {
  onlyQuery(url, []);
  const { parsePolicyYaml } = await lib("../policy/yaml.mjs");
  const { resolveVector, LEVEL_CHANGED, DEMOTED } = await lib("../policy/reduce.mjs");
  const { CAPABILITIES } = await lib("../policy/model.mjs");
  const f = fileAt(ctx, "hq.policy.yaml");
  let policy;
  try { policy = parsePolicyYaml(f.text); } catch (e) { throw invalid(f.path, e); }
  // The cap is folded from the transitions in SPINE APPEND ORDER (reduce.mjs's own rule), read through the reader.
  const transitions = (await spineEvents(ctx)).filter((e) => e.kind === LEVEL_CHANGED || e.kind === DEMOTED);
  const kinds = obj(obj(policy).kinds);
  let subjects;
  try {
    subjects = Object.keys(kinds).map((subject) => {
      const v = resolveVector(subject, { policy, events: transitions });
      return {
        subject,
        e2: Array.isArray(obj(kinds[subject]).e2) ? obj(kinds[subject]).e2.map(String) : [],
        cells: CAPABILITIES.map((capability) => ({ capability, ...obj(v[capability]) })),
      };
    });
  } catch (e) { throw new ReadError("SOURCE_INVALID", `the policy reducer refused a transition on the spine: ${String(/** @type {Error} */ (e).message).split("\n")[0]}`); }
  const levels = Object.entries(obj(obj(policy).levels)).map(([level, meaning]) => ({ level, meaning: String(meaning) }));
  return answer(ctx, "/api/policy", "file and log", "hq/lib/policy/yaml.mjs#parsePolicyYaml · hq/lib/policy/reduce.mjs#resolveVector", [f], {
    capabilities: [...CAPABILITIES],
    levels,
    subjects,
    transitions: transitions.length,
    ungrantable: Array.isArray(obj(policy).ungrantable_actions) ? obj(policy).ungrantable_actions.map(String) : [],
  });
}

// ---------- hq.jobs.yaml: /api/jobs ----------
/** GET /api/jobs -- each job's cadence, last run, next fire and overdue mark, by the brief's own jobs panel. */
export async function apiJobs(ctx, url) {
  onlyQuery(url, []);
  const { parseYamlSubset } = await lib("../../../engine/yaml-subset.mjs");
  const { loadJobs, loadPanelInputs, derivePanel, OVERDUE_SLOTS } = await lib("../jobs/panel.mjs");
  const f = fileAt(ctx, "hq.jobs.yaml");
  // loadJobs answers [] for a file that does not parse -- right for the brief, which must render, and a lie for
  // a table that would then read "no jobs". The same parser is asked first, so a broken file is refused by name.
  const parsed = parseYamlSubset(f.text);
  if (!parsed.ok) throw invalid(f.path, { message: `${obj(parsed.error).what || "yaml-parse"} at line ${obj(parsed.error).line ?? "?"}` });
  const day = todayIst();
  const { events, observedFrom } = await loadPanelInputs(ctx.root, day);
  const rows = derivePanel({ day, jobs: loadJobs(ctx.repo), events, observedFrom });
  return answer(ctx, "/api/jobs", "file and log", "hq/lib/jobs/panel.mjs#loadJobs,loadPanelInputs,derivePanel", [f], {
    day,
    observedFrom,
    overdueSlots: OVERDUE_SLOTS,
    jobs: rows.map((r) => ({
      name: r.name,
      enabled: r.enabled,
      cadence: r.cadence,
      lastRun: r.lastRun,
      lastOutcome: r.lastOutcome,
      nextExpected: typeof r.nextExpected === "number" ? formatIst(r.nextExpected) : null,
      missed: r.missed,
      overdue: r.overdue,
      state: r.state,
    })),
  });
}

// ---------- evolve: /api/evolve ----------
const EVOLVE_KINDS = new Set(["experiment.opened", "experiment.assigned", "experiment.measured", "experiment.verdict", "experiment.closed", "promotion.proposed", "experiment.promoted", "experiment.rolled_back"]);

/** GET /api/evolve -- every experiment folded from its receipts, and every manifest's declared evolve section. */
export async function apiEvolve(ctx, url) {
  onlyQuery(url, []);
  const { foldExperiments, classifyWindows, countPerArm } = await lib("../../../evolve/board.mjs");
  const { checkEvolveSection } = await lib("../../../core/evolve-manifest.mjs");
  const events = (await spineEvents(ctx)).filter((e) => EVOLVE_KINDS.has(e.kind));
  const folded = foldExperiments(events);
  const experiments = [...folded.experiments.values()].map((x) => {
    const windows = classifyWindows(x);
    const metrics = [...new Set(windows.map((w) => w.metric))].sort().map((metric) => ({
      metric,
      windows: windows.filter((w) => w.metric === metric).length,
      complete: windows.filter((w) => w.metric === metric && !w.missing).length,
      arms: Object.entries(countPerArm(x, windows, metric)).map(([arm, n]) => ({ arm, units: n.units, observations: n.observations })),
    }));
    return {
      id: str(x.experiment_id),
      module: str(x.module),
      surface: str(x.surface),
      arms: x.arms.map(String),
      split: x.split ?? null,
      ttl_days: x.ttl_days ?? null,
      opened: str(x.opened_ts),
      metrics,
      verdict: x.verdict ? { outcome: str(obj(x.verdict).outcome), ts: str(obj(x.verdict).ts) } : null,
      closed: x.closed ? { reason: str(obj(x.closed).reason), ts: str(obj(x.closed).ts) } : null,
      proposals: x.proposals.length,
      conflicts: x.conflicts.size,
      strayArms: [...x.strayArms].map(String),
    };
  });
  // The contracts: every product manifest that declares an `evolve` section, judged by the lint that owns it.
  const sources = [];
  const contracts = [];
  const productsDir = join(ctx.repo, "products");
  const products = existsSync(productsDir) ? readdirSync(productsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
  for (const name of products) {
    const rel = `products/${name}/manifest.json`;
    if (!existsSync(join(ctx.repo, rel))) continue;
    const f = fileAt(ctx, rel);
    let m;
    try { m = JSON.parse(f.text); } catch (e) { throw invalid(rel, e); }
    if (!Object.hasOwn(obj(m), "evolve")) continue;
    sources.push(f);
    const section = obj(obj(m).evolve);
    contracts.push({
      product: name,
      metrics: Array.isArray(section.metrics) ? section.metrics.map((x) => (typeof x === "string" ? x : str(obj(x).name))) : [],
      experiments: Array.isArray(section.experiments) ? section.experiments.length : 0,
      promote_via: str(section.promote_via) || (section.promote_via ? JSON.stringify(section.promote_via) : ""),
      findings: checkEvolveSection(obj(m).evolve, `products/${name}`, { root: ctx.repo }),
    });
  }
  return answer(ctx, "/api/evolve", "file and log", "evolve/board.mjs#foldExperiments,classifyWindows,countPerArm · core/evolve-manifest.mjs#checkEvolveSection", sources, {
    experiments,
    superseded: folded.superseded,
    contracts,
    manifestsRead: products.length,
  });
}

// ---------- products/absorb/registry.json: /api/absorb ----------
/** GET /api/absorb -- every technique in the registry, and the adopted count per lane against the cap, by absorb's own lint. */
export async function apiAbsorb(ctx, url) {
  onlyQuery(url, []);
  const { judgeRegistry, ADOPTED_CAP } = await lib("../../../absorb/registry-ref.mjs");
  const reg = fileAt(ctx, "products/absorb/registry.json");
  const lock = fileAt(ctx, ".claude/scripts/develop/capability-lock.json");
  let registry, lockDoc;
  try { registry = JSON.parse(reg.text); } catch (e) { throw invalid(reg.path, e); }
  try { lockDoc = JSON.parse(lock.text); } catch (e) { throw invalid(lock.path, e); }
  let judged;
  try { judged = judgeRegistry(registry, lockDoc, lock.path); } catch (e) { throw invalid(reg.path, e); }
  const rows = judged.rows.filter((r) => r !== null && typeof r === "object" && !Array.isArray(r)).map((r) => {
    const x = obj(r);
    const refs = obj(x.decision_refs);
    return {
      id: str(x.id), name: str(x.name), status: str(x.status), lane: str(x.lane),
      source: str(obj(x.source).name), classification: str(x.classification_ref),
      evidence: Array.isArray(x.evidence) ? x.evidence.length : 0,
      adopt: str(refs.adopt), retire: str(refs.retire), review_by: str(x.review_by),
    };
  });
  /** @type {Map<string, number>} */
  const byLane = new Map();
  for (const r of judged.adopted) { const lane = str(obj(r).lane) || "(no lane)"; byLane.set(lane, (byLane.get(lane) || 0) + 1); }
  return answer(ctx, "/api/absorb", "file, not log", "absorb/registry-ref.mjs#judgeRegistry,ADOPTED_CAP", [reg, lock], {
    cap: ADOPTED_CAP,
    techniques: rows,
    adoptedPerLane: [...byLane.entries()].sort().map(([lane, adopted]) => ({ lane, adopted })),
    warnings: judged.warnings,
  });
}

// ---------- docs/retro-log.md: /api/memory, /api/learn ----------
async function retroLessons(ctx) {
  const { parse } = await lib("../../../memory/adapters/retro-log.mjs");
  const f = fileAt(ctx, "docs/retro-log.md");
  let out;
  try { out = parse(f.text); } catch (e) { throw invalid(f.path, e); }
  const lessons = out.records.map((r) => {
    const x = obj(r.fields);
    return { id: str(r.id), date: str(x.date), project: str(x.project), pattern: str(x.pattern), prevention: str(x.prevention), tags: Array.isArray(r.tags) ? r.tags.map(String) : [] };
  });
  return { f, lessons, malformed: out.exclusions.filter((e) => e.kind === "malformed").length };
}

/** GET /api/memory -- every lesson the retro log records, by the memory lane's own adapter. */
export async function apiMemory(ctx, url) {
  onlyQuery(url, []);
  const { f, lessons, malformed } = await retroLessons(ctx);
  return answer(ctx, "/api/memory", "file, not log", "memory/adapters/retro-log.mjs#parse", [f], { lessons, malformed });
}

/** GET /api/learn -- the playbook's rules from the retro log, and the ones dated this week. */
export async function apiLearn(ctx, url) {
  onlyQuery(url, []);
  const { f, lessons, malformed } = await retroLessons(ctx);
  const today = todayIst();
  const weekAgo = formatIst(Date.parse(`${today}T00:00:00+05:30`) - 6 * 24 * 60 * 60 * 1000).slice(0, 10);
  return answer(ctx, "/api/learn", "file, not log", "memory/adapters/retro-log.mjs#parse", [f], {
    today,
    weekFrom: weekAgo,
    rules: lessons,
    thisWeek: lessons.filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.date) && l.date >= weekAgo && l.date <= today),
    malformed,
  });
}

// ---------- bench receipts: /api/bench ----------
/** GET /api/bench -- every bench run's scored classes, as its run.completed receipt carries them. */
export async function apiBench(ctx, url) {
  onlyQuery(url, []);
  const runs = (await spineEvents(ctx))
    .filter((e) => e.kind === "run.completed" && typeof obj(e.payload).scorecard_sha === "string")
    .map((e) => {
      const p = obj(e.payload);
      return {
        id: e.id, ts: e.ts,
        subject: typeof p.subject === "string" ? p.subject : JSON.stringify(p.subject ?? ""),
        model: str(p.model_applied),
        outcome: str(p.outcome),
        scorecard: str(p.scorecard_sha),
        classes: (Array.isArray(p.classes) ? p.classes : []).map((c) => {
          const k = obj(c);
          return { task_class: str(k.task_class), eligible: k.eligible === true, reason: str(k.reason), proposal: k.proposal ? JSON.stringify(k.proposal) : "" };
        }),
      };
    });
  return answer(ctx, "/api/bench", "log", "spine.mjs#readAll (arc-bench's run.completed payload)", [], { runs });
}

// ---------- council receipts: /api/council ----------
/** GET /api/council -- every verdict with its outcome, and the calibration the evolve lane measures from them. */
export async function apiCouncil(ctx, url) {
  onlyQuery(url, []);
  const { calibrate } = await lib("../../../evolve/calibrate.mjs");
  const events = (await spineEvents(ctx)).filter((e) => e.kind === "council.verdict" || e.kind === "council.outcome");
  const outcomes = new Map();
  for (const e of events) if (e.kind === "council.outcome") outcomes.set(str(obj(e.payload).session_id), e);
  const verdicts = events.filter((e) => e.kind === "council.verdict").map((e) => {
    const p = obj(e.payload);
    const o = outcomes.get(str(p.session_id));
    return { id: e.id, ts: e.ts, session: str(p.session_id), call: str(p.call), confidence: str(p.confidence), outcome: o ? str(obj(o.payload).outcome) : "", observed: o ? str(obj(o.payload).observed_at) : "" };
  });
  const c = calibrate(events);
  return answer(ctx, "/api/council", "log", "evolve/calibrate.mjs#calibrate · spine.mjs#readAll", [], {
    verdicts,
    calibration: {
      scored: c.scored, excluded: c.excluded, pending: c.pending, floor: c.floor, brier: c.brier ?? null, verdict: str(c.verdict),
      buckets: Object.entries(obj(c.buckets)).map(([bucket, b]) => ({ bucket, prob: obj(b).prob, n: obj(b).n, hits: obj(b).hits, hit_rate: obj(b).hit_rate ?? null })),
    },
  });
}

// ---------- phase task files: /api/slices ----------
/** GET /api/slices -- every LIVE lane's current phase, its slices and its proven count, by develop's ledger parser. */
export async function apiSlices(ctx, url) {
  onlyQuery(url, []);
  const { parseLedger, progress, isProven } = await lib("../../../develop/ledger.mjs");
  const { laneHeader, validLaneName } = await lib("../../../core/lane-resolve.mjs");
  const dir = join(ctx.repo, "initiatives");
  const names = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && validLaneName(d.name)).map((d) => d.name).sort() : [];
  const sources = [];
  const lanes = [];
  for (const lane of names) {
    const progressPath = join(dir, lane, "PROGRESS.md");
    if (!existsSync(progressPath)) continue;
    const header = obj(laneHeader(progressPath));
    if (str(header.status) !== "LIVE") continue;
    const phase = str(header.phase);
    if (!/^\d{1,3}$/.test(phase)) { lanes.push({ lane, phase, file: "", present: false, proven: 0, total: 0, next: "", slices: [], errors: 0 }); continue; }
    const rel = `initiatives/${lane}/phases/phase-${phase.padStart(2, "0")}-tasks.md`;
    if (!existsSync(join(ctx.repo, rel))) { lanes.push({ lane, phase, file: rel, present: false, proven: 0, total: 0, next: "", slices: [], errors: 0 }); continue; }
    const f = fileAt(ctx, rel);
    sources.push(f);
    const led = parseLedger(f.text);
    const pr = progress(led.slices);
    lanes.push({
      lane, phase, file: rel, present: true,
      proven: pr.proven, total: pr.total, next: pr.next ? str(pr.next.id) : "",
      errors: led.errors.length,
      slices: led.slices.map((s) => {
        const x = obj(s.fields);
        return { id: str(s.id), title: str(x.title), tier: str(x.tier), proof: str(x.proof), commit: str(x.commit), proven: isProven(s) };
      }),
    });
  }
  return answer(ctx, "/api/slices", "file, not log", "develop/ledger.mjs#parseLedger,progress,isProven · core/lane-resolve.mjs#laneHeader", sources, { lanes });
}

// ---------- arc.gates.yaml: /api/gates ----------
/** GET /api/gates -- every gate's declared mode, tier and evidence, and the strictness profile the set runs under. */
export async function apiGates(ctx, url) {
  onlyQuery(url, []);
  const { parseYamlSubset } = await lib("../../../engine/yaml-subset.mjs");
  const f = fileAt(ctx, "arc.gates.yaml");
  const parsed = parseYamlSubset(f.text);
  if (!parsed.ok) throw invalid(f.path, { message: `${obj(parsed.error).what || "yaml-parse"} at line ${obj(parsed.error).line ?? "?"}` });
  const gates = (Array.isArray(obj(parsed.value).gates) ? obj(parsed.value).gates : []).map((g) => {
    const x = obj(g);
    return { name: str(x.name), mode: str(x.mode), tier: str(x.tier), runtime: str(x.runtime), evidence: str(x.evidence), check: str(x.check) };
  });
  // The profile's NAME only, read from where arc-profile.sh reads it. Resolving a `mode: profile` gate to its
  // effective mode is that script's job (env override, per-gate key, fallback) and is not repeated here.
  let profile = "";
  const settings = join(ctx.repo, ".claude", "settings.json");
  if (existsSync(settings)) {
    try { profile = str(obj(obj(JSON.parse(readFileSync(settings, "utf8"))).arc).profile); } catch { profile = ""; }
  }
  return answer(ctx, "/api/gates", "file, not log", "engine/yaml-subset.mjs#parseYamlSubset (as face-coverage reads arc.gates.yaml)", [f], {
    gates,
    profile,
    profileResolver: ".claude/scripts/core/arc-profile.sh",
  });
}

// ---------- docs/adr: /api/adrs ----------
/** GET /api/adrs -- every ADR by number, century, title and status, by the memory lane's ADR adapter. */
export async function apiAdrs(ctx, url) {
  onlyQuery(url, []);
  const { parse } = await lib("../../../memory/adapters/adr.mjs");
  const dir = join(ctx.repo, "docs", "adr");
  const files = existsSync(dir) ? readdirSync(dir).filter((n) => /^\d{4}-.+\.md$/.test(n)).sort() : [];
  let malformed = 0;
  const adrs = [];
  for (const name of files) {
    const text = readFileSync(join(dir, name), "utf8");
    const out = parse(text, `docs/adr/${name}`);
    malformed += out.exclusions.filter((e) => e.kind === "malformed").length;
    for (const r of out.records) {
      const x = obj(r.fields);
      const n = str(x.number);
      adrs.push({ number: n, century: /^\d{4}$/.test(n) ? `${n.slice(0, 2)}00` : "", slug: str(x.slug), title: str(x.title), status: str(x.status) });
    }
  }
  return answer(ctx, "/api/adrs", "file, not log", "memory/adapters/adr.mjs#parse", [], { adrs, files: files.length, malformed });
}

// ---------- growth receipts: /api/growth ----------
/** GET /api/growth -- the published pieces at the head of each supersede chain, and the cluster approvals. */
export async function apiGrowth(ctx, url) {
  onlyQuery(url, []);
  const { assertChainIntegrity } = await lib("../../../growth/lib/cutover.mjs");
  const events = await spineEvents(ctx);
  const published = events.filter((e) => e.kind === "content.published");
  let heads;
  try { heads = assertChainIntegrity(published.map((e) => ({ ...obj(e.payload), id: e.id, supersedes: e.supersedes ?? null }))); }
  catch (e) { throw new ReadError("SOURCE_INVALID", `the growth lane's chain check refused its own receipts: ${String(/** @type {Error} */ (e).message).split("\n")[0]}`); }
  const decided = new Map();
  for (const e of events) if (e.kind === "decision.recorded") decided.set(str(obj(e.payload).decides), str(obj(e.payload).verdict));
  const clusters = events.filter((e) => e.kind === "approval.requested" && str(obj(e.payload).gate) === "cluster").map((e) => ({
    id: e.id, ts: e.ts, what: str(obj(e.payload).what) || str(obj(e.payload).cluster_id), verdict: decided.get(e.id) || "open",
  }));
  const headIds = new Set((Array.isArray(heads) ? heads : []).map((h) => str(obj(h).id)));
  return answer(ctx, "/api/growth", "log", "growth/lib/cutover.mjs#assertChainIntegrity · spine.mjs#readAll", [], {
    published: published.filter((e) => headIds.has(e.id)).map((e) => {
      const p = obj(e.payload);
      return { id: e.id, ts: e.ts, site: str(p.site), slug: str(p.slug), title: str(p.title), url: str(p.url), cluster: str(p.cluster_id), content_sha: str(p.content_sha), pr: str(p.pr_ref) };
    }),
    superseded: published.length - headIds.size,
    clusters,
  });
}

// ---------- leads receipts: /api/leads ----------
const LEADS_KINDS = new Set(["outreach.sent", "outreach.replied", "lead.suppressed", "incident.raised"]);

/**
 * GET /api/leads -- the caps against today's sends, each lead's touches in the rolling window, and the suppressed.
 * Keyed by the HMAC lead_id the receipts carry, never a contact: the store that could resolve one is never opened.
 */
export async function apiLeads(ctx, url) {
  onlyQuery(url, []);
  const { deriveState, foldSends } = await lib("../../../leads/lib/guard.mjs");
  const { loadCaps, withinRollingWindow } = await lib("../../../leads/lib/caps.mjs");
  const cfgRel = ".claude/config/leads.json";
  const sources = existsSync(join(ctx.repo, cfgRel)) ? [fileAt(ctx, cfgRel)] : [];
  let caps;
  try { caps = loadCaps(join(ctx.repo, cfgRel)); } catch (e) { throw invalid(cfgRel, e); }
  const events = (await spineEvents(ctx)).filter((e) => LEADS_KINDS.has(e.kind));
  const state = deriveState(events, { campaign: null });
  const now = formatIst(nowMs());
  const today = now.slice(0, 10);
  const sends = foldSends(events, { from: `${today}T00:00:00+05:30`, to: `${today}T23:59:59+05:30` }).counts;
  const window = Number(caps.rolling_window_days);
  const ids = [...new Set([...state.touches.keys(), ...state.suppressed, ...state.replied])].filter((id) => typeof id === "string").sort();
  const leads = ids.map((id) => {
    const ts = (state.touches.get(id) || []).map(String).sort();
    let inWindow = 0;
    for (const t of ts) { try { if (withinRollingWindow(t, now, window)) inWindow += 1; } catch { /* an unplaceable touch is not counted into the window */ } }
    return { lead_id: id, touches: ts.length, inWindow, last: ts.length ? ts[ts.length - 1] : "", replied: state.replied.has(id), suppressed: state.suppressed.has(id) };
  });
  return answer(ctx, "/api/leads", "file and log", "leads/lib/guard.mjs#deriveState,foldSends · leads/lib/caps.mjs#loadCaps,withinRollingWindow", sources, {
    today,
    caps: { per_ist_day: caps.per_ist_day, touches_per_lead: caps.touches_per_lead, rolling_window_days: caps.rolling_window_days },
    sendsToday: { real: sends.real, rehearsal: sends.rehearsal, unmarked: sends.unmarked },
    leads,
    suppressed: leads.filter((l) => l.suppressed).map((l) => l.lead_id),
    bounces: state.bounces,
    complaints: state.complaints,
  });
}

// ---------- the legal lane: /api/legal ----------
/** GET /api/legal -- the seals as the constitution states them, each against the policy's own quote, and the publish gate. */
export async function apiLegal(ctx, url) {
  onlyQuery(url, []);
  const { parseE2, checkE2Quote } = await lib("../policy/constitution.mjs");
  const { parsePolicyYaml } = await lib("../policy/yaml.mjs");
  const c = fileAt(ctx, "CONSTITUTION.md");
  const p = fileAt(ctx, "hq.policy.yaml");
  let seals, policy;
  try { seals = parseE2(c.text); } catch (e) { throw invalid(c.path, e); }
  try { policy = parsePolicyYaml(p.text); } catch (e) { throw invalid(p.path, e); }
  const quoted = Array.isArray(obj(policy).ungrantable_actions) ? obj(policy).ungrantable_actions.map(String) : [];
  let quoteHolds = true;
  let quoteProblem = "";
  try { checkE2Quote(quoted, seals); } catch (e) { quoteHolds = false; quoteProblem = String(/** @type {Error} */ (e).message).split("\n")[0]; }
  const events = await spineEvents(ctx);
  const decided = new Map();
  for (const e of events) if (e.kind === "decision.recorded") decided.set(str(obj(e.payload).decides), { verdict: str(obj(e.payload).verdict), ts: e.ts });
  const gate = events.filter((e) => e.kind === "approval.requested" && str(obj(e.payload).subject) === "legal.publish").map((e) => {
    const x = obj(e.payload);
    const d = decided.get(e.id);
    return { id: e.id, ts: e.ts, what: str(x.what) || str(x.venture) || str(e.venture), sha: str(x.sha) || str(x.sha256), state: d ? d.verdict : "open" };
  });
  return answer(ctx, "/api/legal", "file and log", "hq/lib/policy/constitution.mjs#parseE2,checkE2Quote · hq/lib/policy/yaml.mjs#parsePolicyYaml", [c, p], {
    seals: seals.map((s) => ({ seal: s, quoted: quoted.includes(s) })),
    quoteHolds,
    quoteProblem,
    publishGate: gate,
  });
}

// ---------- ventures.yaml: /api/ventures ----------
/** @param {string} repo @param {unknown} p */
function repoRelative(repo, p) {
  const s = str(p);
  if (s === "") return "";
  if (!isAbsolute(s)) return s.split(sep).join("/");
  const r = relative(repo, s);
  // A path outside the tree is named by its file alone: an absolute path carries the OS account name.
  return r.startsWith("..") || isAbsolute(r) ? s.split(/[\\/]/).pop() || "" : r.split(sep).join("/");
}

/** GET /api/ventures -- the criteria file as the ledger parses it, and each venture's distance from its kill line. */
export async function apiVentures(ctx, url) {
  onlyQuery(url, []);
  const { parseVentures, KILL_CRITERIA, MAX_CRITERION_VALUE } = await lib("../ledger/ventures.mjs");
  const { deriveKillPanel } = await lib("../ledger/kill-panel.mjs");
  const f = fileAt(ctx, "ventures.yaml");
  let parsed;
  try { parsed = parseVentures(f.text); } catch (e) { throw invalid(f.path, e); }
  const panel = obj(await deriveKillPanel(ctx.root, {}));
  return answer(ctx, "/api/ventures", "file and log", "hq/lib/ledger/ventures.mjs#parseVentures · hq/lib/ledger/kill-panel.mjs#deriveKillPanel", [f], {
    version: parsed.version,
    digest: str(parsed.digest),
    criteria: [...KILL_CRITERIA],
    ceiling: MAX_CRITERION_VALUE,
    ventures: Object.entries(obj(parsed.ventures)).map(([name, v]) => ({ name, kill: Object.entries(obj(obj(v).kill)).map(([criterion, value]) => ({ criterion, value })) })),
    kill: {
      present: panel.present === true,
      receipted: panel.receipted === true,
      path: repoRelative(ctx.repo, panel.path),
      asOf: str(panel.asOf),
      ventures: (Array.isArray(panel.ventures) ? panel.ventures : []).map((v) => {
        const x = obj(v);
        return {
          venture: str(x.venture),
          criteria: (Array.isArray(x.criteria) ? x.criteria : []).map((cr) => {
            const y = obj(cr);
            return { criterion: str(y.criterion), status: str(y.status), threshold: y.threshold ?? null, value: y.value ?? null, distance: y.distance ?? null, unit: str(y.unit), reason: str(y.reason) };
          }),
        };
      }),
    },
  });
}

/** The Phase 04 routes, each with its handler: arc-dash's table names every one explicitly. */
export const PHASE04_HANDLERS = Object.freeze({
  "/api/engine": apiEngine,
  "/api/model-policy": apiModelPolicy,
  "/api/policy": apiPolicy,
  "/api/jobs": apiJobs,
  "/api/evolve": apiEvolve,
  "/api/memory": apiMemory,
  "/api/bench": apiBench,
  "/api/roster": apiRoster,
  "/api/council": apiCouncil,
  "/api/slices": apiSlices,
  "/api/gates": apiGates,
  "/api/learn": apiLearn,
  "/api/adrs": apiAdrs,
  "/api/growth": apiGrowth,
  "/api/leads": apiLeads,
  "/api/legal": apiLegal,
  "/api/ventures": apiVentures,
  "/api/absorb": apiAbsorb,
});
