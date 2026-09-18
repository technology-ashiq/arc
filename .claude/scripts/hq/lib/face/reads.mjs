// reads.mjs -- the door's Phase 04 read routes (face v2 Phase 04, REQ-06; ADR-1301, ADR-1312, ADR-1324, ADR-1338).
//
// Phase 03 drew every panel the door could not fill as NOT SERVED, naming the route it needed; the union of
// those five lists is what this file serves, and nothing else (initiatives/face/evidence/phase-03/not-served-*.md).
// arc-dash.mjs keeps the ONE route table and the one serializer; this file holds the handlers it dispatches to.
//
// THE RULE EVERY HANDLER KEEPS: the door derives no truth of its own. Each file is parsed by the function the
// lint or lane that owns it already uses, IMPORTED, never re-implemented here (PLAN-face-v2 §11); each receipt
// is read through spine.mjs, the only public API (ADR-0030). What a handler adds is only the projection -- which
// fields of what the parser returned go on the wire -- and the provenance: the route names itself, the parser
// it imported, and the sha256 of every file it parsed (a directory it walks is named once, with a digest over the
// sha of every file in it), so a panel can say where its table came from.
//
// THE RULES THE PHASE 04 ATTACKERS WROTE INTO THIS FILE, each applied everywhere, not only where it was found:
//   - ONE READ. A file is read once and parsed from that text. Where the owning lane's parser can only take a path
//     (the bench's ceilings, the leads caps), it parses a private copy of those exact bytes; the kill panel, which
//     reads the criteria file on its own, is held to the parsed file's digest (SOURCE_CHANGING) -- a sha from one
//     version beside data from another was the lane's most repeated defect ("validate one read, serve another").
//   - CONTAINED. Every file and directory is resolved with realpath and must sit inside the repo, as the lane
//     route's phases already must (PHASES_OUTSIDE): a junction or symlink cannot make the door serve off the tree.
//   - A WRONG SHAPE IS REFUSED, NOT EMPTY. A file that parses into the wrong shape -- jobs as a mapping, a gates key
//     misspelt -- is SOURCE_INVALID. "Declares no jobs" is a sentence about the file; it must never be the door's
//     reading of a file it could not read.
//   - NO PATH, NO ADDRESS ON THE WIRE. Every refusal and every free-text field from a receipt passes `scrub`: the
//     repo's own path becomes repo-relative, any other absolute path and any email-shaped string is withheld. A lead
//     is keyed by its HMAC id only if that id matches the leads lane's own grammar.
//   - LAZY, AND NAMED. A lane module is imported per request; one that will not load refuses ITS route by name
//     (PARSER_UNAVAILABLE) with the loader's error CODE, never its message (which carries the account's path).
//   - A query key a route does not read is refused (BAD_ARGS), never ignored.
//   - Only plain JSON leaves a handler; a Set, a Map or a raw nested payload never does.
//   - Receipts the spine reader could not read are COUNTED on every log route (`unreadLines.torn`, `.skipped`), never
//     silently absent from a table. (The key is not "spine": a face lib file may not name a served room, even as a key.)
import { existsSync, readFileSync, readdirSync, statSync, realpathSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep, dirname } from "node:path";
import { execFile } from "node:child_process";

import { readAll } from "../../spine.mjs";
import { sha256Hex, formatIst, nowMs } from "../canonical.mjs";

/** A refusal this module raises; arc-dash maps its code to a status exactly as it maps its own. */
export class ReadError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(message); this.code = code; }
}

// ---------- what may never reach the wire ----------
// An address, including one whose domain is not ASCII (`alice@exämple.com`).
const EMAIL = /[^\s@<>"'`,;()]+@[^\s@<>"'`,;()]+\.[^\s@<>"'`,;()]+/gu;
// The START of an absolute path: a Windows drive, a UNC share, a backslash root, a file:// URL, a home shorthand, or a
// POSIX root that carries an account or a machine's layout. Repo-relative paths ("docs/adr/0001-x.md") are not matched.
// Each alternative is anchored so a URL is not a path: a drive letter may not follow a letter or digit (`https:/`), a
// root may not follow a host or a path segment (`example.com/home/`).
const ABS_START = /(?<![A-Za-z0-9])[A-Za-z]:[\\/]|(?<![A-Za-z0-9._~%:/\\-])\\\\|(?<![A-Za-z0-9._~%:/\\-])\\(?:Users|home|Documents and Settings)\\|file:\/\/|(?<![A-Za-z0-9._~%:/-])~[A-Za-z0-9._-]*\/|(?<![A-Za-z0-9._~%:/-])\/(?:home|Users|root|tmp|var|private|mnt|opt|etc|usr|Volumes|srv|media|run|snap)\//;

/**
 * A sentence made safe for the wire: the repo's own path becomes repo-relative, any other absolute path and any
 * email-shaped string is withheld. Applied to every refusal this file raises and every free-text receipt field it
 * serves (ADR-1312: no PII on the door).
 * @param {unknown} text @param {string} repo
 */
export function scrub(text, repo) {
  let s = typeof text === "string" ? text : String(text ?? "");
  if (repo) {
    for (const form of new Set([repo, repo.split(sep).join("/"), repo.split("/").join("\\")])) {
      if (!form) continue;
      const esc = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      s = s.replace(new RegExp(`${esc}[\\\\/]?`, "gi"), "");
    }
  }
  s = s.replace(EMAIL, "[address withheld]");
  // From the first absolute-path start to the END of the text: a path may hold spaces ("C:\Users\John Smith\...") and
  // stopping at the first one served the rest of it (Phase 04 re-attack). What follows a path in a receipt's free text
  // is withheld with it -- over-withholding a sentence tail is the recoverable direction.
  const at = s.search(ABS_START);
  return at < 0 ? s : `${s.slice(0, at)}[path withheld]`;
}

/** A receipt's envelope id, served only when it is a ULID. @param {unknown} v */
const idOf = (v) => (typeof v === "string" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(v) ? v : "");
/** A receipt's envelope ts, served only in the spine's IST shape. @param {unknown} v */
const tsOf = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?\+05:30$/.test(v) ? v : "");

/** @param {{ repo: string }} ctx @param {string} code @param {string} message */
const refusal = (ctx, code, message) => new ReadError(code, scrub(message, ctx.repo).slice(0, 500));

/**
 * A lane's fold threw on the RECEIPTS it was handed -- a payload missing the field it reads, a timestamp it cannot place.
 * Named, scrubbed, and never INTERNAL: the lane's own sentence is the reason, and one bad receipt is its problem to name.
 * @template T @param {{ repo: string }} ctx @param {string} lane @param {() => T} run
 * @returns {T}
 */
function laneFold(ctx, lane, run) {
  try { return run(); } catch (e) {
    if (e instanceof ReadError) throw e;
    throw refusal(ctx, "SOURCE_INVALID", `the ${lane} refused a receipt on the spine: ${String(/** @type {Error} */ (e).message).split("\n")[0]}`);
  }
}
/** The async twin of laneFold. @template T @param {{ repo: string }} ctx @param {string} lane @param {() => Promise<T>} run */
async function laneFoldAsync(ctx, lane, run) {
  try { return await run(); } catch (e) {
    if (e instanceof ReadError) throw e;
    throw refusal(ctx, "SOURCE_INVALID", `the ${lane} refused a receipt on the spine: ${String(/** @type {Error} */ (e).message).split("\n")[0]}`);
  }
}

/** A lane's parser threw on a file it owns: a named refusal carrying the parser's own sentence, scrubbed. */
const invalid = (ctx, rel, e) => refusal(ctx, "SOURCE_INVALID", `${rel} did not parse: ${String(e && /** @type {Error} */ (e).message).split("\n")[0]}`);

// ---------- lazy parser imports ----------
const loaded = new Map();
/**
 * One lane module, imported on first use and cached. A module that throws while loading refuses the route that
 * needed it and nothing else; the failure is cached too. Its error CODE is named, never its message: a loader's
 * message carries absolute paths.
 * @param {string} rel  path relative to this file
 */
async function lib(rel) {
  if (!loaded.has(rel)) loaded.set(rel, import(new URL(rel, import.meta.url).href).then((m) => ({ m }), (e) => ({ e })));
  const got = await loaded.get(rel);
  if (got.e) {
    // A POSITIVE whitelist: a negated letter range is locale-collation dependent (tests/portability.bats).
    const raw = String((got.e && (got.e.code || got.e.name)) || "Error");
    const code = /^[A-Za-z0-9_]{1,64}$/.test(raw) ? raw : "Error";
    throw new ReadError("PARSER_UNAVAILABLE", `the parser this route imports (${rel.replace(/^(\.\.\/)+/, "")}) did not load (${code})`);
  }
  return got.m;
}

// ---------- helpers ----------
/** Today, as an IST day -- the one clock every "today" and every tenure check on these routes reads. */
export const todayIst = () => formatIst(nowMs()).slice(0, 10);

/** A real calendar day: the shape AND a day that exists (2026-09-31 has the shape and is no day at all). */
export const isRealDay = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
  && Number.isFinite(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

/**
 * Refuse any query key this route does not read.
 * @param {URL} url @param {string[]} allowed
 */
function onlyQuery(url, allowed) {
  for (const k of new Set(url.searchParams.keys()))
    if (!allowed.includes(k)) throw new ReadError("BAD_ARGS", `${url.pathname} takes ${allowed.length ? allowed.join(", ") : "no query"}; "${k}" is not one of them`);
}

const fenceCache = new Map();
/** The repo's own realpath, the fence every source must sit inside. @param {{ repo: string }} ctx */
function fence(ctx) {
  if (!fenceCache.has(ctx.repo)) fenceCache.set(ctx.repo, realpathSync(ctx.repo));
  return fenceCache.get(ctx.repo);
}

/**
 * Where a repo-relative path really is, checked: it exists, it is the kind of entry asked for, and its realpath is
 * inside the repo. A junction or symlink resolving off the tree is SOURCE_OUTSIDE, the same refusal the lane route
 * gives a phases/ that does.
 * @param {{ repo: string }} ctx @param {string} rel @param {"file" | "dir"} kind
 * @returns {string} the absolute path, when it is readable
 */
function contained(ctx, rel, kind) {
  const p = join(ctx.repo, rel);
  if (!existsSync(p)) throw new ReadError("SOURCE_ABSENT", `${rel} is not on this tree, so there is nothing for this route to parse`);
  let real;
  try { real = realpathSync(p); } catch { throw new ReadError("SOURCE_ABSENT", `${rel} could not be resolved on this tree`); }
  const root = fence(ctx);
  if (real !== root && !real.startsWith(root + sep)) throw new ReadError("SOURCE_OUTSIDE", `${rel} resolves outside the repo -- refusing to serve content from off the tree`);
  const st = statSync(real);
  if (kind === "file" && !st.isFile()) throw new ReadError("SOURCE_INVALID", `${rel} is not a regular file`);
  if (kind === "dir" && !st.isDirectory()) throw new ReadError("SOURCE_INVALID", `${rel} is not a directory`);
  return real;
}

/**
 * One file on this tree, read ONCE: its repo-relative path, its text and its sha256.
 * @param {{ repo: string }} ctx @param {string} rel
 */
function fileAt(ctx, rel) {
  const text = readFileSync(contained(ctx, rel, "file"), "utf8");
  return { path: rel, text, sha256: sha256Hex(text) };
}

/**
 * The entries of a directory on this tree, contained like a file.
 * @param {{ repo: string }} ctx @param {string} rel
 */
function dirAt(ctx, rel) {
  return readdirSync(contained(ctx, rel, "dir"), { withFileTypes: true });
}

/**
 * Run a lane parser that reads a file BY PATH over a private copy of the EXACT bytes this route hashed: the file is read
 * once, written to a scratch directory laid out as the parser expects (`rel` under that root), parsed there, and the
 * copy removed. A before-and-after read missed a file that changed and changed back while the parser read it (Phase 04
 * re-attack: 242 answers carried an empty file's sha beside full caps); a copy cannot change under the parser.
 * @template T @param {{ repo: string }} ctx @param {string} rel @param {(root: string, path: string) => T} parse
 * @returns {{ f: { path: string, text: string, sha256: string }, value: T }}
 */
function readCopy(ctx, rel, parse) {
  const f = fileAt(ctx, rel);
  const root = mkdtempSync(join(tmpdir(), "arc-door-"));
  try {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, f.text);
    try { return { f, value: parse(root, path) }; } catch (e) {
      // The parser names the file it read -- the scratch copy. Its path is the door's, not the tree's, so it is cut
      // back to the tree's name before the message goes anywhere.
      if (e && typeof (/** @type {Error} */ (e).message) === "string") /** @type {Error} */ (e).message = /** @type {Error} */ (e).message.split(root).join("").split(root.split(sep).join("/")).join("");
      throw e;
    }
  } finally {
    try { rmSync(root, { recursive: true, force: true }); } catch { /* a scratch copy that will not delete is the OS's to clean */ }
  }
}

/**
 * The shape every route answers with: the route names itself (a client can refuse a body answering another),
 * the parser it imported, the files it parsed, and -- on a route that read the spine -- how many lines of it could
 * not be read.
 * @param {{ mode: string }} ctx @param {string} route @param {"file, not log" | "log" | "file and log"} badge
 * @param {string} parser @param {{ path: string, sha256: string }[]} sources @param {Record<string, unknown>} body
 * @param {{ torn: number, skipped: number } | null} [unread]
 */
function answer(ctx, route, badge, parser, sources, body, unread = null) {
  return {
    mode: ctx.mode, route, badge, parser,
    sources: sources.map((s) => ({ path: s.path, sha256: s.sha256 })),
    ...(unread ? { unreadLines: unread } : {}),
    ...body,
  };
}

/**
 * Every receipt on the spine, unwrapped, in append order -- the order every reducer here is defined over -- and the
 * count of what the reader could not hand over: torn lines, and envelopes that are not a receipt with a kind.
 * @param {{ root: string }} ctx
 */
async function spineRead(ctx) {
  const all = await readAll(ctx.root);
  const events = [];
  let skipped = 0;
  for (const w of all.events) {
    const e = w && w.event;
    // A receipt is an object with a kind AND a payload object: one without a payload reached the lanes' own folds, which
    // read its fields and threw (Phase 04 re-attack). It is skipped and counted, like a torn line.
    const payload = e && typeof e === "object" ? e.payload : undefined;
    if (e === null || typeof e !== "object" || Array.isArray(e) || typeof e.kind !== "string"
      || payload === null || typeof payload !== "object" || Array.isArray(payload)) { skipped += 1; continue; }
    events.push(e);
  }
  return { events, counts: { torn: Array.isArray(all.torn) ? all.torn.length : 0, skipped } };
}

/** @param {unknown} v @returns {string} */
const str = (v) => (typeof v === "string" ? v : "");
/** @param {unknown} v @returns {Record<string, unknown>} */
const obj = (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : {});
/** A number, or null -- never a nested value passed through. @param {unknown} v */
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
/** A free-text receipt field, as text the wire may carry. @param {{ repo: string }} ctx @param {unknown} v */
const text = (ctx, v) => (typeof v === "string" ? scrub(v, ctx.repo) : "");

// ---------- engine/router.yaml: /api/engine, /api/model-policy, /api/roster ----------
async function routerRead(ctx) {
  const { parseYamlSubset } = await lib("../../../engine/yaml-subset.mjs");
  const { routerFaults, isExpired, RUNTIME_DRIVERS } = await lib("../../../engine/router-row.mjs");
  const f = fileAt(ctx, "engine/router.yaml");
  const parsed = parseYamlSubset(f.text);
  if (!parsed.ok) throw invalid(ctx, f.path, { message: `${obj(parsed.error).what || "yaml-parse"} at line ${obj(parsed.error).line ?? "?"}` });
  const router = obj(parsed.value);
  // The shapes this route reads are REQUIRED, never defaulted to empty: a misspelt block is a refusal, not "no tiers".
  if (Object.keys(obj(router.classes)).length === 0) throw refusal(ctx, "SOURCE_INVALID", "engine/router.yaml has no `classes` mapping with a row in it -- the router the engine loads cannot be empty");
  if (!Array.isArray(router.tiers) || router.tiers.length === 0) throw refusal(ctx, "SOURCE_INVALID", "engine/router.yaml has no `tiers` list");
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
    faults: routerFaults(router).map((x) => scrub(x, ctx.repo)),
    tiers: router.tiers.map(String).map((tier) => ({
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
  // The bench's own reader lists the drivers; the directory is contained first, so a missing or off-tree drivers
  // folder is a named refusal rather than the reader's ENOENT and an absolute path.
  const driversRel = ".claude/scripts/engine/drivers";
  dirAt(ctx, driversRel);
  let drivers;
  try { drivers = knownDrivers(ctx.repo); } catch (e) { throw refusal(ctx, "SOURCE_INVALID", `${driversRel} could not be listed: ${String(/** @type {Error} */ (e).code || "error")}`); }
  let budgets = null;
  let budgetsRefused = "";
  const CEIL = "initiatives/bench/ceilings.json";
  if ("ARC_BENCH_CEILINGS" in process.env) {
    // The bench's test-only door: honoured by its reader, and so a door started with it would serve ANOTHER file's
    // caps under this tree's sha. Refused by name instead.
    budgetsRefused = "ARC_BENCH_CEILINGS is set in the door's environment, which points the bench's reader at another ceiling file -- the door serves only the tree's";
  } else if (!existsSync(join(ctx.repo, CEIL))) budgetsRefused = `${CEIL} is not on this tree`;
  else {
    try {
      const got = readCopy(ctx, CEIL, (root) => readCeilings(root));
      sources.push(got.f);
      const c = got.value;
      budgets = {
        as_of: str(c.as_of),
        run_cap_inr: num(c.run_cap_inr),
        process_cap_inr: num(c.process_cap_inr),
        k: num(c.k),
        rows: Object.entries(obj(c.worst_case_inr_per_invocation)).flatMap(([driver, models]) =>
          Object.entries(obj(models)).map(([model, inr]) => ({ driver, model, worst_case_inr: num(inr) }))),
      };
    } catch (e) {
      budgetsRefused = e instanceof ReadError ? e.message : scrub(`the bench's ceiling reader refused the file: ${String(/** @type {Error} */ (e).message).split("\n")[0]}`, ctx.repo);
    }
  }
  return answer(ctx, "/api/engine", "file, not log",
    "engine/yaml-subset.mjs#parseYamlSubset · engine/router-row.mjs#routerFaults,isExpired · engine/arc-bench.mjs#knownDrivers,readCeilings",
    sources, {
      today: r.today,
      drivers,
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
  const { events, counts } = await spineRead(ctx);
  const runs = events
    .filter((e) => e.kind === "run.completed" && RUNTIME_DRIVERS.has(str(obj(e.payload).driver)))
    .map((e) => {
      const p = obj(e.payload);
      return { id: idOf(e.id), ts: tsOf(e.ts), process: text(ctx, p.process), driver: text(ctx, p.driver), outcome: text(ctx, p.outcome) || text(ctx, e.outcome), reason: text(ctx, p.reason), duration_ms: num(p.duration_ms) };
    });
  return answer(ctx, "/api/roster", "file and log", "engine/yaml-subset.mjs#parseYamlSubset · engine/router-row.mjs#isExpired,RUNTIME_DRIVERS · spine.mjs#readAll", [r.f], {
    today: r.today,
    hires,
    runs,
  }, counts);
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
  try { policy = parsePolicyYaml(f.text); } catch (e) { throw invalid(ctx, f.path, e); }
  const kinds = obj(obj(policy).kinds);
  if (Object.keys(kinds).length === 0) throw refusal(ctx, "SOURCE_INVALID", "hq.policy.yaml has no `kinds` mapping with a subject in it");
  // The cap is folded from the transitions in SPINE APPEND ORDER (reduce.mjs's own rule), read through the reader.
  const { events, counts } = await spineRead(ctx);
  const transitions = events.filter((e) => e.kind === LEVEL_CHANGED || e.kind === DEMOTED);
  let subjects;
  try {
    subjects = Object.keys(kinds).map((subject) => {
      const v = resolveVector(subject, { policy, events: transitions });
      return {
        subject,
        e2: Array.isArray(obj(kinds[subject]).e2) ? obj(kinds[subject]).e2.map(String) : [],
        cells: CAPABILITIES.map((capability) => {
          const c = obj(v[capability]);
          return { capability, ceiling: str(c.ceiling), cap: str(c.cap), effective: str(c.effective) };
        }),
      };
    });
  } catch (e) { throw refusal(ctx, "SOURCE_INVALID", `the policy reducer refused a transition on the spine: ${String(/** @type {Error} */ (e).message).split("\n")[0]}`); }
  const levels = Object.entries(obj(obj(policy).levels)).map(([level, meaning]) => ({ level, meaning: String(meaning) }));
  // The ladder's rungs are REQUIRED: a misspelt `levels:` is a refusal, never "declares no level" (Phase 04 re-attack).
  if (levels.length === 0) throw refusal(ctx, "SOURCE_INVALID", "hq.policy.yaml has no `levels` mapping with a rung in it");
  return answer(ctx, "/api/policy", "file and log", "hq/lib/policy/yaml.mjs#parsePolicyYaml · hq/lib/policy/reduce.mjs#resolveVector", [f], {
    capabilities: [...CAPABILITIES],
    levels,
    subjects,
    transitions: transitions.length,
    ungrantable: Array.isArray(obj(policy).ungrantable_actions) ? obj(policy).ungrantable_actions.map(String) : [],
  }, counts);
}

// ---------- hq.jobs.yaml: /api/jobs ----------
/** GET /api/jobs -- each job's cadence, last run, next fire and overdue mark, by the brief's own jobs panel. */
export async function apiJobs(ctx, url) {
  onlyQuery(url, []);
  const { parseYamlSubset } = await lib("../../../engine/yaml-subset.mjs");
  const { loadPanelInputs, derivePanel, OVERDUE_SLOTS } = await lib("../jobs/panel.mjs");
  const f = fileAt(ctx, "hq.jobs.yaml");
  // ONE read: the schedule is parsed from the text above by the parser loadJobs uses -- loadJobs would read the file
  // a second time, and answers [] for a file it cannot read, which a table would draw as "no jobs".
  const parsed = parseYamlSubset(f.text);
  if (!parsed.ok) throw invalid(ctx, f.path, { message: `${obj(parsed.error).what || "yaml-parse"} at line ${obj(parsed.error).line ?? "?"}` });
  const jobs = obj(parsed.value).jobs;
  if (!Array.isArray(jobs)) throw refusal(ctx, "SOURCE_INVALID", "hq.jobs.yaml has no `jobs` list -- a schedule in another shape is not an empty schedule");
  const day = todayIst();
  const { events, observedFrom } = await laneFoldAsync(ctx, "jobs panel", () => loadPanelInputs(ctx.root, day));
  const rows = laneFold(ctx, "jobs panel", () => derivePanel({ day, jobs, events, observedFrom }));
  const { counts } = await spineRead(ctx);
  return answer(ctx, "/api/jobs", "file and log", "engine/yaml-subset.mjs#parseYamlSubset · hq/lib/jobs/panel.mjs#loadPanelInputs,derivePanel", [f], {
    day,
    observedFrom,
    overdueSlots: OVERDUE_SLOTS,
    jobs: rows.map((r) => ({
      name: str(r.name),
      enabled: r.enabled === true,
      cadence: str(r.cadence),
      lastRun: typeof r.lastRun === "string" ? r.lastRun : null,
      lastOutcome: typeof r.lastOutcome === "string" ? text(ctx, r.lastOutcome) : null,
      nextExpected: typeof r.nextExpected === "number" ? formatIst(r.nextExpected) : null,
      missed: num(r.missed),
      overdue: r.overdue === true,
      state: str(r.state),
    })),
  }, counts);
}

// ---------- evolve: /api/evolve ----------
const EVOLVE_KINDS = new Set(["experiment.opened", "experiment.assigned", "experiment.measured", "experiment.verdict", "experiment.closed", "promotion.proposed", "experiment.promoted", "experiment.rolled_back"]);

/** GET /api/evolve -- every experiment folded from its receipts, and every manifest's declared evolve section. */
export async function apiEvolve(ctx, url) {
  onlyQuery(url, []);
  const { admit, foldExperiments, classifyWindows, countPerArm } = await lib("../../../evolve/board.mjs");
  const { checkEvolveSection } = await lib("../../../core/evolve-manifest.mjs");
  const { events, counts } = await spineRead(ctx);
  // The evolve lane's OWN screen first, as its board does: a receipt that does not match the experiment grammar is
  // damage, counted and never folded -- `arms: "ab"` is not two arms, and `arms: 5` is not a list.
  const screened = admit(events.filter((e) => EVOLVE_KINDS.has(e.kind)));
  const folded = foldExperiments(screened.ok);
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
      split: num(x.split),
      ttl_days: num(x.ttl_days),
      opened: str(x.opened_ts),
      metrics,
      verdict: x.verdict ? { outcome: str(obj(x.verdict).outcome), ts: str(obj(x.verdict).ts) } : null,
      closed: x.closed ? { outcome: str(obj(x.closed).outcome), ts: str(obj(x.closed).ts) } : null,
      proposals: x.proposals.length,
      conflicts: x.conflicts.size,
      strayArms: [...x.strayArms].map(String),
    };
  });
  // The contracts: every product manifest that declares an `evolve` section, judged by the lint that owns it.
  const sources = [];
  const contracts = [];
  // products/ is arc's own tree and is not synced into a consumer install: no directory is no manifests, not a refusal.
  const products = existsSync(join(ctx.repo, "products")) ? dirAt(ctx, "products").filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
  let manifestsRead = 0;
  for (const name of products) {
    const rel = `products/${name}/manifest.json`;
    if (!existsSync(join(ctx.repo, rel))) continue;
    const f = fileAt(ctx, rel);
    manifestsRead += 1;
    let m;
    try { m = JSON.parse(f.text); } catch (e) { throw invalid(ctx, rel, e); }
    if (!Object.hasOwn(obj(m), "evolve")) continue;
    sources.push(f);
    const section = obj(obj(m).evolve);
    contracts.push({
      product: name,
      metrics: Array.isArray(section.metrics) ? section.metrics.map((x) => (typeof x === "string" ? x : str(obj(x).name))) : [],
      experiments: Array.isArray(section.experiments) ? section.experiments.length : 0,
      promote_via: str(section.promote_via) || (section.promote_via ? "declared, not a name" : ""),
      findings: checkEvolveSection(obj(m).evolve, `products/${name}`, { root: ctx.repo }).map((x) => scrub(x, ctx.repo)),
    });
  }
  return answer(ctx, "/api/evolve", "file and log", "evolve/board.mjs#admit,foldExperiments,classifyWindows,countPerArm · core/evolve-manifest.mjs#checkEvolveSection", sources, {
    experiments,
    damaged: screened.damaged,
    superseded: folded.superseded,
    contracts,
    manifestsRead,
  }, counts);
}

// ---------- docs/retro-log.md: /api/memory, /api/learn ----------
async function retroLessons(ctx) {
  const { parse } = await lib("../../../memory/adapters/retro-log.mjs");
  const f = fileAt(ctx, "docs/retro-log.md");
  let out;
  try { out = parse(f.text); } catch (e) { throw invalid(ctx, f.path, e); }
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
    // A REAL day inside the week: "2026-09-31" has the shape and sorts inside it, and is no day at all.
    thisWeek: lessons.filter((l) => isRealDay(l.date) && l.date >= weekAgo && l.date <= today),
    malformed,
  });
}

// ---------- bench receipts: /api/bench ----------
/** GET /api/bench -- every bench run's scored classes, as its run.completed receipt carries them. */
export async function apiBench(ctx, url) {
  onlyQuery(url, []);
  const { events, counts } = await spineRead(ctx);
  const runs = events
    .filter((e) => e.kind === "run.completed" && typeof obj(e.payload).scorecard_sha === "string")
    .map((e) => {
      const p = obj(e.payload);
      return {
        id: idOf(e.id), ts: tsOf(e.ts),
        subject: text(ctx, p.subject),
        model: text(ctx, p.model_applied),
        outcome: text(ctx, p.outcome),
        scorecard: /^[0-9a-f]{64}$/.test(str(p.scorecard_sha)) ? str(p.scorecard_sha) : "",
        classes: (Array.isArray(p.classes) ? p.classes : []).map((c) => {
          const k = obj(c);
          return { task_class: text(ctx, k.task_class), eligible: k.eligible === true, reason: text(ctx, k.reason), proposes: k.proposal !== undefined && k.proposal !== null && k.proposal !== false };
        }),
      };
    });
  return answer(ctx, "/api/bench", "log", "spine.mjs#readAll (arc-bench's run.completed payload)", [], { runs }, counts);
}

// ---------- council receipts: /api/council ----------
/** GET /api/council -- every verdict with its outcome, and the calibration the evolve lane measures from them. */
export async function apiCouncil(ctx, url) {
  onlyQuery(url, []);
  const { calibrate } = await lib("../../../evolve/calibrate.mjs");
  const { events: all, counts } = await spineRead(ctx);
  const events = all.filter((e) => e.kind === "council.verdict" || e.kind === "council.outcome");
  const outcomes = new Map();
  for (const e of events) if (e.kind === "council.outcome") outcomes.set(str(obj(e.payload).session_id), e);
  const verdicts = events.filter((e) => e.kind === "council.verdict").map((e) => {
    const p = obj(e.payload);
    const o = outcomes.get(str(p.session_id));
    return { id: idOf(e.id), ts: tsOf(e.ts), session: text(ctx, p.session_id), call: text(ctx, p.call), confidence: text(ctx, p.confidence), outcome: o ? text(ctx, obj(o.payload).outcome) : "", observed: o ? text(ctx, obj(o.payload).observed_at) : "" };
  });
  const c = calibrate(events);
  return answer(ctx, "/api/council", "log", "evolve/calibrate.mjs#calibrate · spine.mjs#readAll", [], {
    verdicts,
    calibration: {
      scored: num(c.scored), excluded: num(c.excluded), pending: num(c.pending), floor: num(c.floor), brier: num(c.brier), verdict: str(c.verdict),
      buckets: Object.entries(obj(c.buckets)).map(([bucket, b]) => ({ bucket, prob: num(obj(b).prob), n: num(obj(b).n), hits: num(obj(b).hits), hit_rate: num(obj(b).hit_rate) })),
    },
  }, counts);
}

// ---------- phase task files: /api/slices ----------
/** GET /api/slices -- every LIVE lane's current phase, its slices and its proven count, by develop's ledger parser. */
export async function apiSlices(ctx, url) {
  onlyQuery(url, []);
  const { parseLedger, progress, isProven } = await lib("../../../develop/ledger.mjs");
  const { laneHeader, validLaneName } = await lib("../../../core/lane-resolve.mjs");
  // A repo with no initiatives/ is root-mode (.claude/rules/lanes.md): it has no lanes, which is an answer, not a refusal.
  // A lane directory that is a LINK is kept in the list and checked, never filtered out: a junction is not a directory
  // to Dirent.isDirectory(), and filtering on it made an off-tree lane vanish from the table (Phase 04 re-attack).
  const names = existsSync(join(ctx.repo, "initiatives"))
    ? dirAt(ctx, "initiatives").filter((d) => (d.isDirectory() || d.isSymbolicLink()) && validLaneName(d.name)).map((d) => d.name).sort()
    : [];
  const sources = [];
  const lanes = [];
  /** @param {string} lane @param {string} phase @param {string} file @param {string} why */
  const absent = (lane, phase, file, why) => ({ lane, phase, file, present: false, why, proven: 0, total: 0, next: "", slices: [], errors: 0 });
  for (const lane of names) {
    try { contained(ctx, `initiatives/${lane}`, "dir"); } catch (e) {
      // A lane that resolves off the tree, or is not a directory, is NAMED in the table, not read and not dropped.
      lanes.push(absent(lane, "", "", e instanceof ReadError && e.code === "SOURCE_OUTSIDE" ? "its directory resolves outside the repo -- not read" : "its entry is not a lane directory -- not read"));
      continue;
    }
    const progressRel = `initiatives/${lane}/PROGRESS.md`;
    if (!existsSync(join(ctx.repo, progressRel))) continue;
    let header;
    try { header = obj(laneHeader(contained(ctx, progressRel, "file"))); } catch (e) { if (e instanceof ReadError && e.code === "SOURCE_OUTSIDE") throw e; continue; }
    if (str(header.status) !== "LIVE") continue;
    const phase = str(header.phase);
    if (!/^\d{1,3}$/.test(phase)) { lanes.push(absent(lane, phase, "", "its header names no phase number")); continue; }
    const rel = `initiatives/${lane}/phases/phase-${phase.padStart(2, "0")}-tasks.md`;
    if (!existsSync(join(ctx.repo, rel))) { lanes.push(absent(lane, phase, rel, "no task file for this phase")); continue; }
    let f;
    // One lane's unreadable task file is that lane's refusal, never the whole route's -- except a file off the tree,
    // which is refused outright, as the lane route refuses its phases.
    try { f = fileAt(ctx, rel); } catch (e) {
      if (e instanceof ReadError && e.code === "SOURCE_OUTSIDE") throw e;
      lanes.push(absent(lane, phase, rel, e instanceof ReadError ? e.message : "its task file could not be read")); continue;
    }
    sources.push(f);
    const led = parseLedger(f.text);
    const pr = progress(led.slices);
    lanes.push({
      lane, phase, file: rel, present: true, why: "",
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
/**
 * One answer from arc-profile.sh, the resolver the gates themselves use -- never a second copy of its precedence
 * (ARC_PROFILE, then settings, then standard) or its profile table. It runs in the door's environment and cwd.
 * @param {{ repo: string }} ctx @param {string[]} args
 * @returns {Promise<string>}
 */
function profileSays(ctx, args) {
  return new Promise((resolveP, rejectP) => {
    execFile("bash", [join(ctx.repo, ".claude", "scripts", "core", "arc-profile.sh"), ...args], { cwd: ctx.repo, timeout: 15_000, maxBuffer: 64 * 1024 },
      (err, stdout) => (err ? rejectP(err) : resolveP(String(stdout).trim())));
  });
}

/** GET /api/gates -- every gate's declared mode, tier and evidence, and the mode arc-profile.sh resolves it to. */
export async function apiGates(ctx, url) {
  onlyQuery(url, []);
  const { parseYamlSubset } = await lib("../../../engine/yaml-subset.mjs");
  const f = fileAt(ctx, "arc.gates.yaml");
  const parsed = parseYamlSubset(f.text);
  if (!parsed.ok) throw invalid(ctx, f.path, { message: `${obj(parsed.error).what || "yaml-parse"} at line ${obj(parsed.error).line ?? "?"}` });
  const list = obj(parsed.value).gates;
  if (!Array.isArray(list) || list.length === 0) throw refusal(ctx, "SOURCE_INVALID", "arc.gates.yaml has no `gates` list with a gate in it");
  const gates = list.map((g) => {
    const x = obj(g);
    return { name: str(x.name), mode: str(x.mode), tier: str(x.tier), runtime: str(x.runtime), evidence: str(x.evidence), check: str(x.check), resolved: "" };
  });
  let profile = "";
  let profileRefused = "";
  const RESOLVER = ".claude/scripts/core/arc-profile.sh";
  const PROFILE_NAME = /^[a-z][a-z0-9-]{0,31}$/;
  if ("ARC_SETTINGS" in process.env) {
    // The resolver's own override of its SOURCE: it would resolve from another settings file under this tree's name.
    // Refused by name, as every env override of a source is (Phase 04 re-attack).
    profileRefused = "ARC_SETTINGS is set in the door's environment, which points arc-profile.sh at another settings file -- the door resolves only the tree's";
  } else {
    try {
      contained(ctx, RESOLVER, "file");
      const said = await profileSays(ctx, ["name"]);
      if (!PROFILE_NAME.test(said)) profileRefused = "arc-profile.sh answered with something that is not a profile name, so no profile is claimed";
      else {
        profile = said;
        for (const g of gates) {
          if (g.mode !== "profile") continue;
          // Only a MODE is served: the resolver echoes a settings value it does not validate, and anything but `warn`
          // or `block` -- an address, a path, a line break -- is drawn unresolved, never passed through (re-attack).
          let mode = "";
          try { mode = await profileSays(ctx, ["mode", g.name]); } catch { mode = ""; }
          g.resolved = mode === "warn" || mode === "block" ? mode : "";
        }
      }
    } catch (e) {
      profileRefused = e instanceof ReadError ? e.message : `${RESOLVER} did not answer in the door's environment (${String(/** @type {NodeJS.ErrnoException} */ (e).code || "error")}), so no profile is claimed`;
    }
  }
  return answer(ctx, "/api/gates", "file, not log", "engine/yaml-subset.mjs#parseYamlSubset (as face-coverage reads arc.gates.yaml) · core/arc-profile.sh name|mode", [f], {
    gates,
    profile,
    // ARC_PROFILE is the resolver's documented first precedence; a profile it forced is served, and SAID to be forced.
    profileForced: profile !== "" && "ARC_PROFILE" in process.env,
    profileRefused,
    profileResolver: RESOLVER,
  });
}

// ---------- docs/adr: /api/adrs ----------
/** GET /api/adrs -- every ADR by number, century, title and status, by the memory lane's ADR adapter. */
export async function apiAdrs(ctx, url) {
  onlyQuery(url, []);
  const { parse } = await lib("../../../memory/adapters/adr.mjs");
  const entries = dirAt(ctx, "docs/adr");
  const files = entries.filter((d) => /^\d{4}-.+\.md$/.test(d.name)).map((d) => d.name).sort();
  let malformed = 0;
  const adrs = [];
  const shas = [];
  for (const name of files) {
    // Each file contained and checked as a file: a directory named like an ADR is refused by name, not an EISDIR.
    const f = fileAt(ctx, `docs/adr/${name}`);
    shas.push(`${name}:${f.sha256}`);
    const out = parse(f.text, `docs/adr/${name}`);
    malformed += out.exclusions.filter((e) => e.kind === "malformed").length;
    for (const r of out.records) {
      const x = obj(r.fields);
      const n = str(x.number);
      adrs.push({ number: n, century: /^\d{4}$/.test(n) ? `${n.slice(0, 2)}00` : "", slug: str(x.slug), title: str(x.title), status: str(x.status) });
    }
  }
  // A directory is named once, with a digest over the sha of every file in it in name order -- 286 file rows would be
  // the provenance of a table, not a line under it.
  return answer(ctx, "/api/adrs", "file, not log", "memory/adapters/adr.mjs#parse", [{ path: "docs/adr", sha256: sha256Hex(shas.join("\n")) }], { adrs, files: files.length, malformed });
}

// ---------- growth receipts: /api/growth ----------
/** GET /api/growth -- the published pieces at the head of each supersede chain, and the cluster approvals. */
export async function apiGrowth(ctx, url) {
  onlyQuery(url, []);
  const { assertChainIntegrity } = await lib("../../../growth/lib/cutover.mjs");
  const { events, counts } = await spineRead(ctx);
  const published = events.filter((e) => e.kind === "content.published");
  let heads;
  try { heads = assertChainIntegrity(published.map((e) => ({ ...obj(e.payload), id: e.id, supersedes: e.supersedes ?? null }))); }
  catch (e) { throw refusal(ctx, "SOURCE_INVALID", `the growth lane's chain check refused its own receipts: ${String(/** @type {Error} */ (e).message).split("\n")[0]}`); }
  const decided = new Map();
  for (const e of events) if (e.kind === "decision.recorded") decided.set(str(obj(e.payload).decides), str(obj(e.payload).verdict));
  const clusters = events.filter((e) => e.kind === "approval.requested" && str(obj(e.payload).gate) === "cluster").map((e) => ({
    id: idOf(e.id), ts: tsOf(e.ts), what: text(ctx, obj(e.payload).what) || text(ctx, obj(e.payload).cluster_id), verdict: ["approve", "reject"].includes(decided.get(str(e.id)) || "") ? decided.get(str(e.id)) : "open",
  }));
  const headIds = new Set((Array.isArray(heads) ? heads : []).map((h) => str(obj(h).id)));
  return answer(ctx, "/api/growth", "log", "growth/lib/cutover.mjs#assertChainIntegrity · spine.mjs#readAll", [], {
    published: published.filter((e) => headIds.has(e.id)).map((e) => {
      const p = obj(e.payload);
      return { id: idOf(e.id), ts: tsOf(e.ts), site: text(ctx, p.site), slug: text(ctx, p.slug), title: text(ctx, p.title), url: text(ctx, p.url), cluster: text(ctx, p.cluster_id), content_sha: /^[0-9a-f]{64}$/.test(str(p.content_sha)) ? str(p.content_sha) : "", pr: text(ctx, p.pr_ref) };
    }),
    superseded: published.length - headIds.size,
    clusters,
  }, counts);
}

// ---------- leads receipts: /api/leads ----------
const LEADS_KINDS = new Set(["outreach.sent", "outreach.replied", "lead.suppressed", "incident.raised"]);

/**
 * GET /api/leads -- the caps against today's sends, each lead's touches, and the suppressed -- keyed by the HMAC
 * lead_id the receipts carry, and ONLY an id matching the leads lane's own grammar: the store that could resolve one
 * to a contact is never opened, and an address written where an id belongs never reaches the wire.
 */
export async function apiLeads(ctx, url) {
  onlyQuery(url, []);
  const { deriveState, foldSends } = await lib("../../../leads/lib/guard.mjs");
  const { loadCaps, withinRollingWindow } = await lib("../../../leads/lib/caps.mjs");
  const { LEAD_ID_RE } = await lib("../validate-leads.mjs");
  const cfgRel = ".claude/config/leads.json";
  let caps;
  let sources = [];
  let capsFrom = "the leads lane's code defaults -- no config file on this tree";
  try {
    if (existsSync(join(ctx.repo, cfgRel))) {
      const got = readCopy(ctx, cfgRel, (_root, path) => loadCaps(path));
      caps = got.value;
      sources = [got.f];
      capsFrom = cfgRel;
    } else caps = loadCaps(join(ctx.repo, cfgRel));
  } catch (e) { if (e instanceof ReadError) throw e; throw invalid(ctx, cfgRel, e); }
  const { events: all, counts } = await spineRead(ctx);
  const events = all.filter((e) => LEADS_KINDS.has(e.kind));
  const state = laneFold(ctx, "leads lane's fold", () => deriveState(events, { campaign: null }));
  const now = formatIst(nowMs());
  const today = now.slice(0, 10);
  const sends = laneFold(ctx, "leads lane's fold", () => foldSends(events, { from: `${today}T00:00:00+05:30`, to: `${today}T23:59:59+05:30` }).counts);
  const window = Number(caps.rolling_window_days);
  const every = [...new Set([...state.touches.keys(), ...state.suppressed, ...state.replied])];
  const ids = every.filter((id) => typeof id === "string" && LEAD_ID_RE.test(id)).sort();
  const nowMsValue = Date.parse(now);
  const leads = ids.map((id) => {
    const ts = (state.touches.get(id) || []).map(String).sort();
    let inWindow = 0;
    let after = 0;
    let unreadable = 0;
    for (const t of ts) {
      const at = Date.parse(t);
      if (!Number.isFinite(at)) { unreadable += 1; continue; }
      // A touch stamped after the door's clock is what the guard refuses as clock skew; it is counted as that, never
      // quietly outside the window (guard.mjs, the defect that code fixed).
      if (at > nowMsValue) { after += 1; continue; }
      try { if (withinRollingWindow(t, now, window)) inWindow += 1; } catch { unreadable += 1; }
    }
    return { lead_id: id, touches: ts.length, inWindow, afterNow: after, unreadable, last: ts.length ? ts[ts.length - 1] : "", replied: state.replied.has(id), suppressed: state.suppressed.has(id) };
  });
  return answer(ctx, "/api/leads", "file and log", "leads/lib/guard.mjs#deriveState,foldSends · leads/lib/caps.mjs#loadCaps,withinRollingWindow · hq/lib/validate-leads.mjs#LEAD_ID_RE", sources, {
    today,
    caps: { per_ist_day: num(caps.per_ist_day), touches_per_lead: num(caps.touches_per_lead), rolling_window_days: num(caps.rolling_window_days) },
    capsFrom,
    sendsToday: { real: num(sends.real), rehearsal: num(sends.rehearsal), unmarked: num(sends.unmarked), unplaceable: num(sends.unplaceable) },
    leads,
    suppressed: leads.filter((l) => l.suppressed).map((l) => l.lead_id),
    idsWithheld: every.length - ids.length,
    bounces: num(state.bounces),
    complaints: num(state.complaints),
  }, counts);
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
  try { seals = parseE2(c.text); } catch (e) { throw invalid(ctx, c.path, e); }
  try { policy = parsePolicyYaml(p.text); } catch (e) { throw invalid(ctx, p.path, e); }
  const quoted = Array.isArray(obj(policy).ungrantable_actions) ? obj(policy).ungrantable_actions.map(String) : [];
  let quoteHolds = true;
  let quoteProblem = "";
  try { checkE2Quote(quoted, seals); } catch (e) { quoteHolds = false; quoteProblem = scrub(String(/** @type {Error} */ (e).message).split("\n")[0], ctx.repo); }
  const { events, counts } = await spineRead(ctx);
  const decided = new Map();
  for (const e of events) if (e.kind === "decision.recorded") decided.set(str(obj(e.payload).decides), { verdict: str(obj(e.payload).verdict), ts: tsOf(e.ts) });
  const gate = events.filter((e) => e.kind === "approval.requested" && str(obj(e.payload).subject) === "legal.publish").map((e) => {
    const x = obj(e.payload);
    const d = decided.get(str(e.id));
    const sha = str(x.sha) || str(x.sha256);
    return { id: idOf(e.id), ts: tsOf(e.ts), what: text(ctx, x.what) || text(ctx, x.venture) || text(ctx, e.venture), sha: /^[0-9a-f]{64}$/.test(sha) ? sha : "", state: d && ["approve", "reject"].includes(d.verdict) ? d.verdict : "open" };
  });
  return answer(ctx, "/api/legal", "file and log", "hq/lib/policy/constitution.mjs#parseE2,checkE2Quote · hq/lib/policy/yaml.mjs#parsePolicyYaml", [c, p], {
    // Each seal against the policy's quote AT ITS POSITION -- the element-for-element rule checkE2Quote enforces.
    seals: seals.map((s, i) => ({ seal: s, quoted: quoted[i] === s })),
    quoteHolds,
    quoteProblem,
    publishGate: gate,
  }, counts);
}

// ---------- ventures.yaml: /api/ventures ----------
/** GET /api/ventures -- the criteria file as the ledger parses it, and each venture's distance from its kill line. */
export async function apiVentures(ctx, url) {
  onlyQuery(url, []);
  const { parseVentures, KILL_CRITERIA, MAX_CRITERION_VALUE } = await lib("../ledger/ventures.mjs");
  const { deriveKillPanel } = await lib("../ledger/kill-panel.mjs");
  const f = fileAt(ctx, "ventures.yaml");
  let parsed;
  try { parsed = parseVentures(f.text); } catch (e) { throw invalid(ctx, f.path, e); }
  /** @type {Record<string, unknown>} */
  let kill = { present: false, receipted: false, path: "", asOf: "", ventures: [], refused: "" };
  if ("ARC_VENTURES_FILE" in process.env) {
    kill = { ...kill, refused: "ARC_VENTURES_FILE is set in the door's environment, which points the kill panel at another criteria file -- the door serves only the tree's" };
  } else {
    try {
      const panel = obj(await deriveKillPanel(ctx.root, {}));
      const at = str(panel.path);
      const inside = at !== "" && (() => { try { const real = realpathSync(at); const root = fence(ctx); return real === root || real.startsWith(root + sep); } catch { return false; } })();
      if (panel.present === true && !inside) {
        kill = { ...kill, refused: "the kill panel read a criteria file that is not this tree's ventures.yaml" };
      } else if (panel.present === true && typeof panel.digest === "string" && panel.digest !== parsed.digest) {
        // ONE version: the panel read the file on its own. A digest that differs from the text parsed above is a file
        // that changed between the two reads, and the two halves of this answer would be about different files.
        throw new ReadError("SOURCE_CHANGING", "ventures.yaml changed while it was being read -- ask again");
      } else {
        kill = {
          present: panel.present === true,
          receipted: panel.receipted === true,
          path: at === "" ? "" : relative(fence(ctx), realpathSync(at)).split(sep).join("/"),
          asOf: str(panel.asOf),
          refused: "",
          ventures: (Array.isArray(panel.ventures) ? panel.ventures : []).map((v) => {
            const x = obj(v);
            return {
              venture: str(x.venture),
              criteria: (Array.isArray(x.criteria) ? x.criteria : []).map((cr) => {
                const y = obj(cr);
                return { criterion: str(y.criterion), status: str(y.status), threshold: num(y.threshold), value: num(y.value), distance: num(y.distance), unit: str(y.unit), reason: text(ctx, y.reason) };
              }),
            };
          }),
        };
      }
    } catch (e) {
      if (e instanceof ReadError) throw e;
      kill = { ...kill, refused: scrub(`the ledger's kill panel refused (${str(/** @type {{ code?: unknown }} */ (e).code) || "error"}): ${String(/** @type {Error} */ (e).message).split("\n")[0]}`, ctx.repo) };
    }
  }
  return answer(ctx, "/api/ventures", "file and log", "hq/lib/ledger/ventures.mjs#parseVentures · hq/lib/ledger/kill-panel.mjs#deriveKillPanel", [f], {
    version: num(parsed.version),
    digest: str(parsed.digest),
    criteria: [...KILL_CRITERIA],
    ceiling: MAX_CRITERION_VALUE,
    ventures: Object.entries(obj(parsed.ventures)).map(([name, v]) => ({ name, kill: Object.entries(obj(obj(v).kill)).map(([criterion, value]) => ({ criterion, value: num(value) })) })),
    kill,
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
  try { registry = JSON.parse(reg.text); } catch (e) { throw invalid(ctx, reg.path, e); }
  try { lockDoc = JSON.parse(lock.text); } catch (e) { throw invalid(ctx, lock.path, e); }
  let judged;
  try { judged = judgeRegistry(registry, lockDoc, lock.path); } catch (e) { throw invalid(ctx, reg.path, e); }
  const rows = judged.rows.filter((r) => r !== null && typeof r === "object" && !Array.isArray(r)).map((r) => {
    const x = obj(r);
    const refs = obj(x.decision_refs);
    // Evidence as the lint accepts it: a list of paths, or one path written as a string -- never counted as zero files.
    const evidence = Array.isArray(x.evidence) ? x.evidence.filter((e) => typeof e === "string").map((e) => scrub(e, ctx.repo))
      : typeof x.evidence === "string" && x.evidence !== "" ? [scrub(x.evidence, ctx.repo)] : [];
    return {
      id: str(x.id), name: text(ctx, x.name), status: str(x.status), lane: str(x.lane),
      source: text(ctx, obj(x.source).name), classification: text(ctx, x.classification_ref),
      evidence,
      adopt: text(ctx, refs.adopt), retire: text(ctx, refs.retire), review_by: str(x.review_by),
    };
  });
  /** @type {Map<string, number>} */
  const byLane = new Map();
  for (const r of judged.adopted) { const lane = str(obj(r).lane) || "(no lane)"; byLane.set(lane, (byLane.get(lane) || 0) + 1); }
  return answer(ctx, "/api/absorb", "file, not log", "absorb/registry-ref.mjs#judgeRegistry,ADOPTED_CAP", [reg, lock], {
    cap: ADOPTED_CAP,
    techniques: rows,
    adoptedPerLane: [...byLane.entries()].sort().map(([lane, adopted]) => ({ lane, adopted })),
    warnings: judged.warnings.map((w) => scrub(w, ctx.repo)),
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
