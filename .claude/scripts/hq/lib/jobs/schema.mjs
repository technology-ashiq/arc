/**
 * schema.mjs -- the closed v1 schema for `hq.jobs.yaml` and every rule `jobs-lint` enforces.
 *
 * SEPARATED FROM THE CLI ON PURPOSE. The CLI decides exit codes and prints; this module only
 * decides findings, takes its whole world by injection, and never touches process.exit. That
 * is what makes the hostile corpus able to drive it directly, and it is the shape POL-D's own
 * Phase-0 module used for the same reason: wiring it up must not require changing it.
 *
 * THE SELF-MODIFICATION BAN IS A CHECK ON THE GRANT, NOT A GREP OVER THE SOURCE.
 * SCH-B bans a job that can edit the schedule or the code, because that is a persistence
 * mechanism. The obvious implementation -- scan the job script for writes to `hq.jobs.yaml`
 * or `.claude/scripts/**` -- is a grep, and this repo has already watched a mutant module walk
 * straight past a grep-shaped guard (retro-log 2026-08-04: the propose-only check missed
 * `fs/promises`, `child_process` and async spawn). So the rule is enforced where it is
 * DECIDABLE: a job is refused if its `policy_kind` row GRANTS write to any root that contains
 * a banned path. Roots live in `hq.policy.yaml`, which no agent can write, and containment is
 * decided by the policy engine's own adversarially-proven resource guard rather than by a
 * second implementation here.
 *
 * The honest limit, stated rather than hidden: nothing at runtime stops a spawned Node process
 * from writing wherever the OS lets it. The policy engine enforces at the tool boundary, and a
 * script-job is not a tool call. What this rule guarantees is that no job is ever GRANTED the
 * capability -- which is the part a config file can actually decide.
 *
 * Zero dependencies, Node 18+.
 */

import { existsSync, lstatSync, realpathSync } from "node:fs";
import { join, resolve, sep, posix } from "node:path";
import { parseYamlSubset } from "../../../engine/yaml-subset.mjs";
import { buildResourceGuard, containsGuardedEntry, guardedEntryFor } from "../policy/resources.mjs";

export const SCHEMA_VERSION = 1;
export const JOB_NAME_RE = /^[a-z][a-z0-9-]*$/;
export const ENTRY_DIR = ".claude/scripts/hq/jobs";
export const JOB_TYPES = Object.freeze(["script", "process"]);
export const CATCHUP_VALUES = Object.freeze(["run", "skip"]);

/**
 * Paths a job may never be granted write access to. `hq.jobs.yaml` is the schedule and
 * `.claude/scripts/**` is the code -- a job that can edit either one can rewrite what runs
 * tomorrow, which is the definition of persistence rather than automation.
 *
 * Note this DELIBERATELY includes `.claude/scripts/hq/jobs/**`, where the job scripts
 * themselves live. A job that can rewrite its sibling job is no better than one that can
 * rewrite the schedule.
 */
export const BANNED_WRITE_PATHS = Object.freeze([
  "hq.jobs.yaml",
  ".claude/scripts/**",
]);

/**
 * Worst-case slot counts for a single calendar month, used by the ceiling check and `--bill`.
 * 31 for daily. 23 for weekdays: a 31-day month is four whole weeks (20 weekdays) plus three
 * spare days, and those three can all be weekdays. Deliberately the CEILING rather than an
 * average -- a budget check that passes on a typical month is not a budget check.
 */
export const SLOTS_PER_MONTH = Object.freeze({ daily: 31, weekdays: 23 });

/**
 * Value patterns that look like a live credential. Matched against every scalar in the file.
 * This one IS a heuristic and is labelled as such: it exists to catch the careless paste, not
 * a determined author, and it is never the only thing standing between a secret and a commit.
 */
const CREDENTIAL_PATTERNS = Object.freeze([
  { name: "an AWS-style access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "a GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "an OpenAI-style key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "a Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "a private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "a bearer token", re: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i },
  { name: "a long high-entropy secret assignment", re: /\b(?:secret|token|password|passwd|api[_-]?key)\b\s*[:=]\s*\S{12,}/i },
]);

const finding = (code, where, message) => ({ code, where, message });

/** Normalise any path to forward slashes, relative to the repo root, for stable comparison. */
function relPosix(root, p) {
  const abs = resolve(root, p);
  const rel = abs.slice(resolve(root).length).split(sep).join(posix.sep).replace(/^\/+/, "");
  return rel;
}

/**
 * Is `entry` really inside ENTRY_DIR? Resolved through symlinks, because a link inside the
 * allowed directory pointing anywhere on disk is exactly how an allowlist keyed on the written
 * string gets walked past. An unresolvable path is refused rather than skipped.
 */
export function entryWithinAllowedDir(root, entry) {
  const allowedAbs = resolve(root, ENTRY_DIR);
  let targetAbs = resolve(root, entry);
  try {
    if (existsSync(targetAbs)) targetAbs = realpathSync(targetAbs);
  } catch {
    return false;
  }
  let allowedReal = allowedAbs;
  try {
    if (existsSync(allowedAbs)) allowedReal = realpathSync(allowedAbs);
  } catch {
    return false;
  }
  return targetAbs === allowedReal || targetAbs.startsWith(allowedReal + sep);
}

/** Walk every scalar in a parsed doc, yielding [dottedPath, value]. */
function* scalars(node, path = "$") {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* scalars(node[i], `${path}[${i}]`);
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) yield* scalars(v, `${path}.${k}`);
    return;
  }
  yield [path, String(node)];
}

/**
 * The whole rule set. `ctx` carries the world: { root, policy, processNames, fileExists }.
 * Returns { findings, bill }. Zero findings means the file is legal; the CLI turns that into
 * an exit code, not this function.
 */
export function lintJobs(text, ctx = {}) {
  const root = ctx.root || process.cwd();
  const findings = [];
  const add = (code, where, message) => findings.push(finding(code, where, message));

  // ---------- 0. it must parse, under the SAME subset the engine uses (A5) ----------
  const parsed = parseYamlSubset(text);
  if (!parsed.ok) {
    add("parse", "hq.jobs.yaml", `does not parse under the frozen YAML subset (ADR-0200): ${parsed.error.what}`);
    return { findings, bill: null };
  }
  const doc = parsed.value;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    add("parse", "hq.jobs.yaml", "top level must be a mapping");
    return { findings, bill: null };
  }

  // ---------- 1. top-level shape ----------
  if (String(doc.version) !== String(SCHEMA_VERSION))
    add("version", "version", `must be ${SCHEMA_VERSION}, found ${JSON.stringify(doc.version ?? null)}`);

  const ceilingRaw = doc.monthly_ceiling_inr;
  const ceiling = Number(ceilingRaw);
  if (ceilingRaw === undefined || !Number.isInteger(ceiling) || ceiling < 0)
    add("ceiling", "monthly_ceiling_inr", `must be a non-negative integer, found ${JSON.stringify(ceilingRaw ?? null)}`);

  const defaults = doc.defaults ?? {};
  if (defaults.catchup !== undefined && !CATCHUP_VALUES.includes(String(defaults.catchup)))
    add("catchup", "defaults.catchup", `must be one of ${CATCHUP_VALUES.join(" | ")}`);

  const jobs = doc.jobs;
  if (!Array.isArray(jobs)) {
    add("jobs", "jobs", "must be a sequence of job mappings");
    return { findings, bill: null };
  }

  // ---------- 2. credential-looking values, anywhere in the file ----------
  for (const [where, value] of scalars(doc)) {
    for (const pat of CREDENTIAL_PATTERNS) {
      if (pat.re.test(value)) {
        add("credential", where, `value looks like ${pat.name} -- a schedule file is git-tracked and never holds a secret`);
        break;
      }
    }
  }

  // ---------- 3. per job ----------
  const seen = new Map();
  const guard = buildResourceGuard(BANNED_WRITE_PATHS, root);
  let worstCaseInr = 0;
  const billRows = [];

  jobs.forEach((job, i) => {
    const at = `jobs[${i}]`;
    if (!job || typeof job !== "object" || Array.isArray(job)) {
      add("job", at, "each job must be a mapping");
      return;
    }
    const name = job.name;
    const where = typeof name === "string" && name ? `job "${name}"` : at;

    // name
    if (typeof name !== "string" || !JOB_NAME_RE.test(name)) {
      add("name", at, `name must match ${JOB_NAME_RE} -- found ${JSON.stringify(name ?? null)}`);
    } else if (seen.has(name)) {
      add("duplicate", where, `name is already used by jobs[${seen.get(name)}] -- a duplicate name makes the idem key ambiguous`);
    } else {
      seen.set(name, i);
    }

    // type
    const type = String(job.type ?? "");
    if (!JOB_TYPES.includes(type))
      add("type", where, `type must be one of ${JOB_TYPES.join(" | ")} -- found ${JSON.stringify(job.type ?? null)}`);

    // cadence
    const cadenceText = job.cadence;
    const cadence = parseCadenceSafe(cadenceText);
    if (!cadence)
      add("cadence", where, `cadence must be daily@HH:MM or weekdays@HH:MM (IST, closed grammar) -- found ${JSON.stringify(cadenceText ?? null)}`);

    // enabled
    if (typeof job.enabled !== "boolean")
      add("enabled", where, `enabled must be a boolean -- found ${JSON.stringify(job.enabled ?? null)}`);

    // catchup
    if (job.catchup !== undefined && !CATCHUP_VALUES.includes(String(job.catchup)))
      add("catchup", where, `catchup must be one of ${CATCHUP_VALUES.join(" | ")}`);

    // entry
    const entry = job.entry;
    if (typeof entry !== "string" || !entry) {
      add("entry", where, "entry is required");
    } else if (type === "script") {
      if (!entryWithinAllowedDir(root, entry))
        add("entry-dir", where, `script entry must resolve inside ${ENTRY_DIR}/ -- ${entry} does not (symlinks are resolved; an unresolvable path is refused, never skipped)`);
      else if (ctx.fileExists ? !ctx.fileExists(entry) : !existsSync(resolve(root, entry)))
        add("entry-missing", where, `script entry ${entry} does not exist`);
    } else if (type === "process") {
      const known = ctx.processNames;
      if (Array.isArray(known) && !known.includes(entry))
        add("entry-missing", where, `no process named ${JSON.stringify(entry)} exists in processes/ -- the process set is a directory listing, not an invention`);
    }

    // budget
    const budget = job.budget;
    if (!budget || typeof budget !== "object" || Array.isArray(budget)) {
      add("budget", where, "budget is required and must be a mapping with at least `min`");
    } else {
      const min = Number(budget.min);
      if (budget.min === undefined || !Number.isFinite(min) || min <= 0)
        add("budget-min", where, "budget.min is mandatory for every job and must be a positive number of minutes");
      const hasInr = budget.inr !== undefined;
      if (type === "script" && hasInr)
        add("budget-inr-forbidden", where, "budget.inr is FORBIDDEN on a script-job -- a deterministic script spends no money, and a rupee budget on one is a claim the job cannot make");
      if (type === "process" && !hasInr)
        add("budget-inr-required", where, "budget.inr is mandatory for a process-job -- an unbudgeted LLM run is the runaway-spend case the ceiling exists to prevent");
      if (hasInr) {
        const inr = Number(budget.inr);
        if (!Number.isFinite(inr) || inr < 0) {
          add("budget-inr", where, "budget.inr must be a non-negative number");
        } else if (cadence) {
          const slots = SLOTS_PER_MONTH[cadence.kind];
          const monthly = inr * slots;
          worstCaseInr += monthly;
          billRows.push({ name: name ?? at, cadence: cadence.text, inr, slots, monthly });
        }
      }
    }

    // policy_kind -- must name a subject the LIVE policy file declares
    const kind = job.policy_kind;
    if (typeof kind !== "string" || !kind) {
      add("policy-kind", where, "policy_kind is mandatory -- deny-by-default means a job with no declared subject can do nothing");
    } else if (ctx.policy) {
      const kinds = ctx.policy.kinds || {};
      const row = Object.prototype.hasOwnProperty.call(kinds, kind) ? kinds[kind] : null;
      if (!row) {
        add("policy-kind", where, `policy_kind ${JSON.stringify(kind)} is absent from the live hq.policy.yaml subject set -- deny-by-default makes an absent kind read-only, so this job could never run. Known: ${Object.keys(kinds).join(", ") || "none"}`);
      } else {
        // spend is unschedulable, full stop -- a v1 ban ON TOP of policy's own money law
        const spendLevel = String(row?.spend?.level ?? "L0");
        if (spendLevel !== "L0")
          add("spend-kind", where, `policy_kind ${JSON.stringify(kind)} grants spend at ${spendLevel} -- money-touching jobs are unschedulable, banned here regardless of what policy would otherwise allow`);

        // self-modification, decided on the GRANT (see header)
        const roots = row?.write?.roots;
        if (Array.isArray(roots)) {
          for (const r of roots) {
            // The guard answers questions about CONCRETE paths, so a root is reduced to its
            // concrete prefix first. Handing it `.claude/state/hq/**` verbatim would resolve a
            // path whose last segment is literally `**`, which matches nothing and would make
            // every root look safe -- the check would pass by being asked the wrong question.
            const prefix = typeof r === "string" ? r.replace(/\/\*\*$/, "").replace(/\/+$/, "") : r;
            if (typeof prefix !== "string" || prefix === "") {
              add("self-mod", where, `policy_kind ${JSON.stringify(kind)} declares a write root ${JSON.stringify(r)} that names no directory -- an unresolvable root is refused, never skipped`);
              continue;
            }
            const hit = guardedEntryFor(prefix, guard) || containsGuardedEntry(prefix, guard);
            if (hit)
              add("self-mod", where, `policy_kind ${JSON.stringify(kind)} grants write to ${JSON.stringify(r)}, which reaches ${hit} -- a job that can edit the schedule or the code is a persistence mechanism, not automation`);
          }
        }
      }
    }
  });

  // ---------- 4. the ceiling ----------
  if (Number.isInteger(ceiling) && ceiling >= 0 && worstCaseInr > ceiling)
    add("ceiling-breach", "monthly_ceiling_inr", `worst-case month is INR ${worstCaseInr}, above the declared ceiling of ${ceiling} -- runaway spend is killed here, at commit time, before any run exists`);

  return { findings, bill: { rows: billRows, worstCaseInr, ceiling: Number.isInteger(ceiling) ? ceiling : null } };
}

/** Local wrapper so schema.mjs has no hard import cycle with cadence.mjs at module scope. */
function parseCadenceSafe(text) {
  if (typeof text !== "string") return null;
  const m = /^(daily|weekdays)@([0-9]{2}):([0-9]{2})$/.exec(text);
  if (!m) return null;
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { kind: m[1], hh, mm, text };
}
