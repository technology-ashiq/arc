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
 * DECIDABLE: a job is refused if its `policy_kind` row GRANTS write to any root that reaches a
 * banned path. Roots live in `hq.policy.yaml`, which no agent can write, and containment is
 * decided by the policy engine's own adversarially-proven resource guard rather than by a
 * second implementation here.
 *
 * The honest limit, stated rather than hidden: nothing at runtime stops a spawned Node process
 * from writing wherever the OS lets it. The policy engine enforces at the tool boundary, and a
 * script-job is not a tool call. What this rule guarantees is that no job is ever GRANTED the
 * capability.
 *
 * "CANNOT CHECK" IS A REFUSAL, NEVER A PASS. Three rules in here depend on injected world --
 * the policy object, the process-name set, the filesystem. Each one refuses when its input is
 * unavailable. That is deny-by-default applied to the validator itself, and every one of the
 * three was a live hole found by the Phase-0 adversarial pass: an absent policy skipped every
 * policy rule, a null process set skipped the process-entry check, and a wildcard write root
 * skipped the self-modification ban -- each returning a clean, confident exit 0.
 *
 * Zero dependencies, Node 18+.
 */

import { existsSync, lstatSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parseYamlSubset } from "../../../engine/yaml-subset.mjs";
import { parseCadence } from "./cadence.mjs";
import {
  buildResourceGuard,
  containsGuardedEntry,
  guardedEntryFor,
  hasShortName,
  hasTrailingDotOrSpace,
} from "../policy/resources.mjs";

export const SCHEMA_VERSION = 1;
export const JOB_NAME_RE = /^[a-z][a-z0-9-]*$/;
export const ENTRY_DIR = ".claude/scripts/hq/jobs";
export const JOB_TYPES = Object.freeze(["script", "process"]);
export const CATCHUP_VALUES = Object.freeze(["run", "skip"]);

/**
 * The CLOSED key sets. A schema is only closed if it names what it admits: without this an
 * `catch_up:` typo silently disarms the one guarantee that matters most on this machine
 * (`catchup: run` on `day-close-roll`, which is what makes a slept-through night catch up
 * rather than vanish -- ADR-0804), with a clean lint and no diff signal. An ignored key is a
 * setting its author believes is in force.
 */
export const TOP_KEYS = Object.freeze(["version", "monthly_ceiling_inr", "defaults", "jobs"]);
export const JOB_KEYS = Object.freeze([
  "name", "type", "entry", "budget", "policy_kind", "cadence", "enabled", "catchup",
]);
export const BUDGET_KEYS = Object.freeze(["min", "inr"]);
export const DEFAULTS_KEYS = Object.freeze(["catchup"]);

/**
 * Paths a job may never be granted write access to.
 *
 * `hq.jobs.yaml` is the schedule and `.claude/scripts/**` is the code -- a job that can edit
 * either can rewrite what runs tomorrow, which is persistence rather than automation. This
 * deliberately includes `.claude/scripts/hq/jobs/**` where the job scripts live: a job that can
 * rewrite its sibling is no better than one that can rewrite the schedule.
 *
 * `tests/**` and `processes/**` were added by the adversarial pass. `tests/**` holds the hostile
 * corpus that PROVES the schedule safe, so a job that can write there can delete its own proof.
 * `processes/**` is the subject set (ADR-0504), so a job that can write there can mint itself a
 * new valid policy subject.
 */
export const BANNED_WRITE_PATHS = Object.freeze([
  "hq.jobs.yaml",
  ".claude/scripts/**",
  "tests/**",
  "processes/**",
]);

/**
 * Worst-case slot counts for a single calendar month, used by the ceiling check and `--bill`.
 * 31 for daily. 23 for weekdays: a 31-day month is four whole weeks (20 weekdays) plus three
 * spare days, and those three can all be weekdays. Deliberately the CEILING rather than an
 * average -- a budget check that passes on a typical month is not a budget check.
 */
export const SLOTS_PER_MONTH = Object.freeze({ daily: 31, weekdays: 23 });

/**
 * Value patterns that look like a live credential. This one IS a heuristic and is labelled as
 * such: it catches the careless paste, not a determined author, and it is never the only thing
 * between a secret and a commit.
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

/**
 * Is `entry` really inside ENTRY_DIR? Resolved through symlinks, because a link inside the
 * allowed directory pointing anywhere on disk is exactly how an allowlist keyed on the written
 * string gets walked past. An unresolvable path is refused rather than skipped.
 *
 * The win32 aliases are rejected UNGATED, matching `resources.mjs`: a guard whose verdict
 * depends on which runner it happens to be on is the cross-leg disagreement this lane has
 * already shipped twice. `hq.policy.yaml` once went 6660 bytes to 14 through a trailing dot
 * while the guard reported the target clear.
 */
export function entryWithinAllowedDir(root, entry) {
  if (typeof entry !== "string" || entry === "") return false;
  if (hasShortName(entry) || hasTrailingDotOrSpace(entry)) return false;
  if (/[\0\n\r]/.test(entry)) return false;

  const allowedAbs = resolve(root, ENTRY_DIR);
  let allowedReal;
  try { allowedReal = realpathSync.native(allowedAbs); } catch { return false; }

  // Resolve through the DEEPEST EXISTING ancestor rather than only when the leaf exists. The
  // first version realpathed nothing at all when the target was absent and fell back to a
  // lexical string decision -- so a junction inside the allowed directory pointing outside it
  // was refused when its target existed and ACCEPTED the moment it did not, and only the
  // separate existence check happened to catch that. "Unresolvable is refused, never skipped"
  // was in the comment before it was in the code.
  const targetAbs = resolve(root, entry);
  let head = targetAbs;
  const tail = [];
  for (;;) {
    if (existsSync(head)) break;
    const parent = dirname(head);
    if (parent === head) return false; // walked to the filesystem root finding nothing real
    tail.unshift(basename(head));
    head = parent;
  }
  let headReal;
  try { headReal = realpathSync.native(head); } catch { return false; }
  const targetReal = tail.length ? join(headReal, ...tail) : headReal;

  // `relative` + an explicit `..`/absolute rejection, the same shape `withinRoots` uses, rather
  // than a `startsWith` on a raw string. Because both sides went through realpath.native, the
  // comparison is against the canonical on-disk casing, so the verdict follows the FILE rather
  // than how the path happened to be typed.
  const rel = relative(allowedReal, targetReal);
  if (rel === "") return true;
  return !rel.startsWith("..") && !isAbsolute(rel);
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

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * The whole rule set. `ctx` carries the world: { root, policy, processNames }.
 * Returns { findings, bill }. Zero findings means the file is legal; the CLI turns that into
 * an exit code, not this function. `bill` is null when the file could not be read far enough
 * to compute one -- a caller must not print a measured zero for a file it never parsed.
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
  if (!isPlainObject(doc)) {
    add("parse", "hq.jobs.yaml", "top level must be a mapping");
    return { findings, bill: null };
  }

  // The validator refuses to validate half a world (see header).
  if (!ctx.policy)
    add("policy-unavailable", "hq.jobs.yaml", "no policy was supplied, so no policy_kind can be verified -- unverifiable is a refusal, not a pass");

  // ---------- 1. top-level shape, closed ----------
  for (const k of Object.keys(doc))
    if (!TOP_KEYS.includes(k))
      add("unknown-key", k, `${k} is not a key of the closed v1 schema (known: ${TOP_KEYS.join(", ")}) -- an ignored key is a setting its author believes is in force`);

  if (doc.version !== SCHEMA_VERSION)
    add("version", "version", `must be the integer ${SCHEMA_VERSION}, found ${JSON.stringify(doc.version ?? null)}`);

  const ceilingRaw = doc.monthly_ceiling_inr;
  const ceilingOk = typeof ceilingRaw === "number" && Number.isInteger(ceilingRaw) && ceilingRaw >= 0;
  if (!ceilingOk)
    add("ceiling", "monthly_ceiling_inr", `must be a non-negative integer literal, found ${JSON.stringify(ceilingRaw ?? null)}`);

  if (doc.defaults !== undefined) {
    if (!isPlainObject(doc.defaults)) {
      add("defaults", "defaults", `must be a mapping, found ${JSON.stringify(doc.defaults)} -- a scalar here silently skips every default`);
    } else {
      for (const k of Object.keys(doc.defaults))
        if (!DEFAULTS_KEYS.includes(k))
          add("unknown-key", `defaults.${k}`, `${k} is not a key of defaults (known: ${DEFAULTS_KEYS.join(", ")})`);
      if (doc.defaults.catchup !== undefined && !CATCHUP_VALUES.includes(String(doc.defaults.catchup)))
        add("catchup", "defaults.catchup", `must be one of ${CATCHUP_VALUES.join(" | ")}`);
    }
  }

  const jobs = doc.jobs;
  if (!Array.isArray(jobs)) {
    add("jobs", "jobs", "must be a sequence of job mappings");
    return { findings, bill: null };
  }

  // ---------- 2. credential-looking values ----------
  // Probed as `key: value`, because in YAML the field NAME is the key and the value handed to a
  // regex is the bare secret -- so the flagship "secret assignment" pattern could never fire on
  // real YAML. And the raw text is scanned too: a comment never reaches the parsed doc and a
  // committed comment leaks exactly as much as a committed value.
  for (const [where, value] of scalars(doc)) {
    const key = where.slice(where.lastIndexOf(".") + 1).replace(/\[\d+\]$/, "");
    const probe = `${key}: ${value}`;
    for (const pat of CREDENTIAL_PATTERNS) {
      if (pat.re.test(probe)) {
        add("credential", where, `looks like ${pat.name} -- a schedule file is git-tracked and never holds a secret`);
        break;
      }
    }
  }
  for (const pat of CREDENTIAL_PATTERNS) {
    if (pat.re.test(text) && !findings.some((f) => f.code === "credential")) {
      add("credential", "hq.jobs.yaml", `the file text contains ${pat.name} -- including in a comment, which is committed exactly like a value`);
      break;
    }
  }

  // ---------- 3. per job ----------
  const seen = new Map();
  const guard = buildResourceGuard(BANNED_WRITE_PATHS, root);
  let worstCaseInr = 0;
  const billRows = [];

  jobs.forEach((job, i) => {
    const at = `jobs[${i}]`;
    if (!isPlainObject(job)) {
      add("job", at, "each job must be a mapping");
      return;
    }
    const name = job.name;
    const where = typeof name === "string" && name ? `job "${name}"` : at;

    for (const k of Object.keys(job))
      if (!JOB_KEYS.includes(k))
        add("unknown-key", `${where}.${k}`, `${k} is not a key of the closed v1 job schema (known: ${JOB_KEYS.join(", ")}) -- an ignored key is a setting its author believes is in force`);

    // name
    if (typeof name !== "string" || !JOB_NAME_RE.test(name)) {
      add("name", at, `name must match ${JOB_NAME_RE} -- found ${JSON.stringify(name ?? null)}`);
    } else if (seen.has(name)) {
      add("duplicate", where, `name is already used by jobs[${seen.get(name)}] -- a duplicate name makes the idem key ambiguous`);
    } else {
      seen.set(name, i);
    }

    const type = String(job.type ?? "");
    if (!JOB_TYPES.includes(type))
      add("type", where, `type must be one of ${JOB_TYPES.join(" | ")} -- found ${JSON.stringify(job.type ?? null)}`);

    const cadence = parseCadence(job.cadence);
    if (!cadence)
      add("cadence", where, `cadence must be daily@HH:MM or weekdays@HH:MM (IST, closed grammar) -- found ${JSON.stringify(job.cadence ?? null)}`);

    if (typeof job.enabled !== "boolean")
      add("enabled", where, `enabled must be a boolean -- found ${JSON.stringify(job.enabled ?? null)}`);

    if (job.catchup !== undefined && !CATCHUP_VALUES.includes(String(job.catchup)))
      add("catchup", where, `catchup must be one of ${CATCHUP_VALUES.join(" | ")}`);

    // entry -- it must be a runnable script, not merely a path that exists somewhere legal
    const entry = job.entry;
    if (typeof entry !== "string" || !entry) {
      add("entry", where, "entry is required");
    } else if (type === "script") {
      if (!entryWithinAllowedDir(root, entry)) {
        add("entry-dir", where, `script entry must resolve inside ${ENTRY_DIR}/ -- ${entry} does not (symlinks resolved; 8.3 short names and trailing dot/space refused; an unresolvable path is refused, never skipped)`);
      } else {
        let st = null;
        try { st = lstatSync(realpathSync.native(resolve(root, entry))); } catch { st = null; }
        if (!st) add("entry-missing", where, `script entry ${entry} does not exist`);
        else if (!st.isFile()) add("entry-not-a-file", where, `script entry ${entry} is a ${st.isDirectory() ? "directory" : "special file"}, not a regular file -- and node runs a directory by resolving its index.js, so this is executable without ever having been reviewed as a script`);
        else if (!entry.endsWith(".mjs")) add("entry-not-a-script", where, `script entry ${entry} must be a .mjs module`);
        else if (st.nlink > 1) add("entry-hardlink", where, `script entry ${entry} has ${st.nlink} names on disk -- a hardlink gives this script a second name outside the reviewed directory, and realpath cannot see it because both names are equally real`);
      }
    } else if (type === "process") {
      const known = ctx.processNames;
      if (!Array.isArray(known))
        add("entry-unverifiable", where, "the processes/ subject set could not be read, so no process entry can be verified -- deny-by-default makes this a refusal, never a skip");
      else if (!known.includes(entry))
        add("entry-missing", where, `no process named ${JSON.stringify(entry)} exists in processes/ -- the process set is a directory listing, not an invention`);
    }

    // budget -- NUMBER LITERALS, never coercions. `inr: null` used to satisfy "inr is mandatory"
    // and then bill zero, because Number(null) === 0: an unbudgeted LLM job walked through the
    // ceiling check the pre-mortem calls the mitigation for runaway spend.
    const budget = job.budget;
    if (!isPlainObject(budget)) {
      add("budget", where, "budget is required and must be a mapping with at least `min`");
    } else {
      for (const k of Object.keys(budget))
        if (!BUDGET_KEYS.includes(k))
          add("unknown-key", `${where}.budget.${k}`, `${k} is not a key of budget (known: ${BUDGET_KEYS.join(", ")})`);

      if (typeof budget.min !== "number" || !Number.isFinite(budget.min) || budget.min <= 0)
        add("budget-min", where, `budget.min is mandatory for every job and must be a positive NUMBER of minutes -- found ${JSON.stringify(budget.min ?? null)} (null, [] and true are not budgets)`);

      const hasInr = budget.inr !== undefined;
      if (type === "script" && hasInr)
        add("budget-inr-forbidden", where, "budget.inr is FORBIDDEN on a script-job -- a deterministic script spends no money, and a rupee budget on one is a claim the job cannot make");
      if (type === "process" && !hasInr)
        add("budget-inr-required", where, "budget.inr is mandatory for a process-job -- an unbudgeted LLM run is the runaway-spend case the ceiling exists to prevent");
      if (hasInr) {
        if (typeof budget.inr !== "number" || !Number.isFinite(budget.inr) || budget.inr < 0) {
          add("budget-inr", where, `budget.inr must be a non-negative NUMBER literal -- found ${JSON.stringify(budget.inr)}`);
        } else if (cadence) {
          const slots = SLOTS_PER_MONTH[cadence.kind];
          const monthly = budget.inr * slots;
          worstCaseInr += monthly;
          billRows.push({ name: name ?? at, cadence: cadence.text, inr: budget.inr, slots, monthly });
        }
      }
    }

    // policy_kind -- it must be THIS job's own subject, not merely a subject that exists.
    // Membership alone let a job wear `session:interactive`, whose live grant includes write to
    // `tests/**` -- the hostile corpus that proves the schedule safe.
    const kind = job.policy_kind;
    if (typeof kind !== "string" || !kind) {
      add("policy-kind", where, "policy_kind is mandatory -- deny-by-default means a job with no declared subject can do nothing");
    } else if (typeof name === "string" && name && kind !== `process:${name}`) {
      add("policy-kind", where, `policy_kind must be exactly "process:${name}" (ADR-0802) -- found ${JSON.stringify(kind)}. A job wearing the interactive session subject, or a sibling job subject, runs unattended under a grant nobody scoped to it`);
    } else if (ctx.policy) {
      const kinds = ctx.policy.kinds || {};
      const row = Object.prototype.hasOwnProperty.call(kinds, kind) ? kinds[kind] : null;
      if (!row) {
        add("policy-kind", where, `policy_kind ${JSON.stringify(kind)} is absent from the live hq.policy.yaml subject set -- deny-by-default makes an absent kind read-only, so this job could never run. Known: ${Object.keys(kinds).join(", ") || "none"}`);
      } else {
        const spendLevel = String(row?.spend?.level ?? "L0");
        if (spendLevel !== "L0")
          add("spend-kind", where, `policy_kind ${JSON.stringify(kind)} grants spend at ${spendLevel} -- money-touching jobs are unschedulable, banned here regardless of what policy would otherwise allow`);

        const roots = row?.write?.roots;
        const writeLevel = String(row?.write?.level ?? "L0");
        // A grant this check cannot READ is refused, not skipped. `roots: "**"` (a string, not a
        // sequence) failed the Array.isArray test and skipped the entire self-modification ban.
        if (roots !== undefined && !Array.isArray(roots)) {
          add("self-mod", where, `policy_kind ${JSON.stringify(kind)} declares write.roots as ${JSON.stringify(roots)} rather than a sequence -- a grant this check cannot read is refused, never skipped`);
        } else if (roots === undefined && (writeLevel === "L2" || writeLevel === "L3")) {
          add("self-mod", where, `policy_kind ${JSON.stringify(kind)} grants write at ${writeLevel} with no declared roots -- an unbounded write grant reaches the schedule and the code`);
        }
        if (Array.isArray(roots)) {
          for (const r of roots) {
            // The guard answers questions about CONCRETE paths. Handing it a root verbatim
            // resolves a path whose last segment is literally `**`, which exists nowhere and
            // matches nothing -- the check would pass by being asked the wrong question.
            //
            // A prefix that still contains a wildcard after stripping is REFUSED rather than
            // probed. `roots: ["**"]` is the maximum grant in the policy engine (withinRoots
            // returns true for every path) and it survived the first version of this check,
            // because only a TRAILING `/**` was stripped and a bare `**` matched neither branch.
            const raw = typeof r === "string" ? r : "";
            const prefix = raw.replace(/\/\*\*$/, "").replace(/\/+$/, "");
            if (prefix === "" || prefix.includes("*")) {
              add("self-mod", where, `policy_kind ${JSON.stringify(kind)} declares a write root ${JSON.stringify(r)} that resolves to no concrete directory -- a wildcard root reaches the schedule and the code, and an unresolvable root is refused, never skipped`);
              continue;
            }
            const hit = guardedEntryFor(prefix, guard) || containsGuardedEntry(prefix, guard);
            if (hit)
              add("self-mod", where, `policy_kind ${JSON.stringify(kind)} grants write to ${JSON.stringify(r)}, which reaches ${hit} -- a job that can edit the schedule, the code, its own tests or the subject set is a persistence mechanism, not automation`);
          }
        }
      }
    }
  });

  // ---------- 4. the ceiling ----------
  if (ceilingOk && worstCaseInr > ceilingRaw)
    add("ceiling-breach", "monthly_ceiling_inr", `worst-case month is INR ${worstCaseInr}, above the declared ceiling of ${ceilingRaw} -- runaway spend is killed here, at commit time, before any run exists`);

  return { findings, bill: { rows: billRows, worstCaseInr, ceiling: ceilingOk ? ceilingRaw : null } };
}
