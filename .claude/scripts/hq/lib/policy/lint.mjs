/**
 * lintPolicy -- the validator that makes hq.policy.yaml law (POL-B).
 *
 * It FAILS FROM BIRTH: exit 2 on any violation, no WARN-first period, no TRIAL entry. That is
 * the spine strict-mode precedent, and it applies because a policy file that parses when it
 * should not is a grant nobody authorised. Every other new lint in this cycle starts WARN-first;
 * this one never does.
 *
 * It returns ALL violations rather than the first, because a policy author fixing one error at a
 * time against a file with six is how a lint stops being used.
 */

import {
  ARGV0_CLASSES, BOUND_KEY, CAPABILITIES, LEVELS, TOP_LEVEL_KEYS,
  PROCESS_PREFIX, SESSION_KIND, isLevel, rank,
} from "./model.mjs";
import { parsePolicyYaml } from "./yaml.mjs";
import { verifyConstitution } from "./constitution.mjs";

const PUBLISHING_CLAUSE = "publishing under Ashiq's name";
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function lintPolicy(text, opts = {}) {
  const v = [];
  const add = (msg) => v.push(msg);

  let doc;
  try {
    doc = parsePolicyYaml(text);
  } catch (e) {
    return [`parse: ${e.message}`];
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["parse: the document is not a mapping"];

  for (const key of Object.keys(doc))
    if (!TOP_LEVEL_KEYS.includes(key))
      add(`unknown top-level key ${JSON.stringify(key)} -- the set is closed to ${TOP_LEVEL_KEYS.join(", ")}`);
  for (const key of TOP_LEVEL_KEYS)
    if (!(key in doc)) add(`missing top-level key ${JSON.stringify(key)}`);

  if (doc.version !== 1) add(`version must be 1, got ${JSON.stringify(doc.version)}`);

  // ---- levels: the canonical table lives in the file itself (POL-A) ----
  const levels = doc.levels || {};
  for (const L of LEVELS)
    if (typeof levels[L] !== "string" || levels[L].trim() === "")
      add(`levels.${L} must carry its meaning as a non-empty string -- the table lives here, not in a doc that describes it`);
  for (const key of Object.keys(levels))
    if (!LEVELS.includes(key))
      add(`levels.${key} is not a level -- the enum is closed to ${LEVELS.join("|")}; L4 is a parse error (supersedes arc-full-architecture.md:61,217)`);

  // ---- constitution pin + E2 quote (ADR-0506), in that order ----
  const c = doc.constitution || {};
  if (typeof c.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(c.sha256))
    add("constitution.sha256 must be lowercase sha256 hex of the adopted CONSTITUTION.md");
  if (typeof c.version !== "string") add("constitution.version must be a string");
  if (typeof c.receipt !== "string") add("constitution.receipt must be the constitution.adopted ULID");

  // ungrantable_actions is shape-checked INDEPENDENTLY of the E2 comparison. Without this, the
  // fallback below let the file validate its own quote: `[]` and a bare string both passed
  // whenever CONSTITUTION.md was unavailable.
  if (!Array.isArray(doc.ungrantable_actions) || doc.ungrantable_actions.length !== 5)
    add(`ungrantable_actions must be a list of exactly the five constitutional E2 items`);
  else
    for (const a of doc.ungrantable_actions)
      if (typeof a !== "string" || a.trim() === "")
        add(`ungrantable_actions entry ${JSON.stringify(a)} must be a non-empty string`);

  let e2Items = null;
  if (!opts.constitutionBuffer) {
    // A VIOLATION, not a warning. Both E2 checks are on the plan's never-cut list, and a lint
    // that prints "is law" with them skipped is the poster document it exists to prevent.
    add(`CONSTITUTION.md was not readable -- the E2 checks are on the never-cut list, so a policy ` +
        `file cannot be declared law without them`);
  } else if (typeof c.sha256 === "string") {
    try {
      e2Items = verifyConstitution(opts.constitutionBuffer, c.sha256, doc.ungrantable_actions);
    } catch (e) {
      add(`E2: ${e.message}`);
    }
  }
  const knownE2 = e2Items || (Array.isArray(doc.ungrantable_actions) ? doc.ungrantable_actions : []);

  // ---- un-grantable resources ----
  const resources = doc.ungrantable_resources;
  if (!Array.isArray(resources) || resources.length === 0)
    add("ungrantable_resources must be a non-empty list -- at minimum the settings, the hook dir and this file");
  else
    for (const r of resources)
      if (typeof r !== "string" || r === "") add(`ungrantable_resources entry ${JSON.stringify(r)} must be a non-empty string`);

  // ---- targets ----
  const targets = doc.targets || {};
  for (const key of ["message", "publish", "deploy"])
    if (!Array.isArray(targets[key])) add(`targets.${key} must be a list (it may be empty)`);
  for (const key of Object.keys(targets))
    if (!["message", "publish", "deploy"].includes(key)) add(`targets.${key} is not a target-bearing capability`);

  // ---- argv0_classes (ADR-0507) ----
  const classes = doc.argv0_classes || {};
  for (const [program, entry] of Object.entries(classes)) {
    if (!entry || typeof entry !== "object") { add(`argv0_classes.${program} must be a mapping`); continue; }
    if (!ARGV0_CLASSES.includes(entry.class))
      add(`argv0_classes.${program}.class ${JSON.stringify(entry.class)} is not one of ${ARGV0_CLASSES.join("|")}`);
    if (!Array.isArray(entry.reproduces)) { add(`argv0_classes.${program}.reproduces must be a list`); continue; }
    for (const cap of entry.reproduces) {
      if (cap === "shell")
        add(`argv0_classes.${program}.reproduces lists "shell" -- forbidden, because a program in an ` +
            `argv0_allow is already exercising shell, and naming it makes effective(shell) self-referential (ADR-0507)`);
      else if (cap !== "*" && !CAPABILITIES.includes(cap))
        add(`argv0_classes.${program}.reproduces has unknown capability ${JSON.stringify(cap)}`);
    }
  }

  // ---- kinds ----
  const kinds = doc.kinds;
  if (kinds != null && (typeof kinds !== "object" || Array.isArray(kinds))) add("kinds must be a mapping");
  const processNames = opts.processNames || null;

  for (const [kind, entry] of Object.entries(kinds || {})) {
    const where = `kinds[${JSON.stringify(kind)}]`;
    if (kind !== SESSION_KIND) {
      if (!kind.startsWith(PROCESS_PREFIX))
        add(`${where}: an action kind is ${PROCESS_PREFIX}NAME or ${SESSION_KIND} (ADR-0504)`);
      else if (processNames && !processNames.includes(kind.slice(PROCESS_PREFIX.length)))
        add(`${where}: no process named ${JSON.stringify(kind.slice(PROCESS_PREFIX.length))} exists -- the subject set is a directory listing, not an invention`);
    }
    if (!entry || typeof entry !== "object") { add(`${where} must be a mapping`); continue; }

    // e2: mandatory, blanket scope (ADR-0506).
    const e2 = entry.e2;
    if (!Array.isArray(e2)) {
      add(`${where}.e2 is missing or not a list -- it is mandatory, because silence is not consent`);
    } else {
      for (const item of e2)
        if (!knownE2.includes(item))
          add(`${where}.e2 names ${JSON.stringify(item)}, which is not one of the five constitutional E2 actions`);
    }
    const e2NonEmpty = Array.isArray(e2) && e2.length > 0;

    for (const [capability, grant] of Object.entries(entry)) {
      if (capability === "e2") continue;
      if (!CAPABILITIES.includes(capability)) {
        add(`${where}.${capability} is not one of the eight capabilities -- the set is closed`);
        continue;
      }
      if (!grant || typeof grant !== "object") { add(`${where}.${capability} must be a mapping`); continue; }
      const level = grant.level;
      if (!isLevel(level)) {
        add(`${where}.${capability}.level ${JSON.stringify(level)} is not one of ${LEVELS.join("|")} -- L4 is a parse error`);
        continue;
      }
      const above1 = rank(level) > rank("L1");

      if (e2NonEmpty && above1)
        add(`${where}.${capability} is ${level} but the kind declares E2 actions ${JSON.stringify(e2)} -- ` +
            `a non-empty e2 caps EVERY capability at L1 (blanket, not per-item)`);

      if (capability === "spend" && above1)
        add(`${where}.spend is ${level} -- spend above L1 is an error unconditionally: moving money is E2`);

      // publish/deploy above L1 is reachable only with `e2: []` (rule 2 is blanket), and nothing
      // can verify an empty list is true -- ADR-0506 names this as the model's one unverified
      // human declaration. The earlier guard here could never fire, and a dead guard reads like
      // a real one. It is replaced with an advisory line the reviewer actually sees.
      if ((capability === "publish" || capability === "deploy") && above1 && Array.isArray(e2) && e2.length === 0)
        add(`REQUIRES-SIGNOFF ${where}.${capability} is ${level} with e2: [] -- nothing verifies ` +
            `that this kind does not publish under Ashiq's name. Say so explicitly in the PR ` +
            `description or drop the level (ADR-0506)`);

      // A bound is what separates L2 from L3.
      const key = BOUND_KEY[capability];
      if (level === "L2" && key) {
        const bound = grant[key];
        if (bound == null)
          add(`${where}.${capability} is L2 with no ${key} -- a bound is what makes L2 different from L3`);
        else if (Array.isArray(bound) && bound.length === 0)
          add(`${where}.${capability} is L2 with an empty ${key} -- bounded execution whose bound admits nothing is L0 wearing L2's label`);
      }

      if (capability === "write") checkRoots(grant.roots, where, resources, add);
      if (capability === "network") checkDomains(grant.domains, where, add);
      if (capability === "shell") {
        checkArgv0(grant.argv0_allow, where, classes, add);
        // A shell grant whose DERIVED level is L0 is the same contradiction as an empty bound:
        // it claims L2 and can never be L2. Left silent it creates standing pressure to quietly
        // drop the interpreter from the allowlist, which is how the ADR-0507 cap gets removed
        // by someone trying to make their process work.
        if (above1) {
          const derived = derivedShellCeiling(entry, grant.argv0_allow, classes);
          if (rank(derived) < rank(level))
            add(`${where}.shell declares ${level} but ADR-0507 derives ${derived} from its ` +
                `allowlist (its programs reproduce a capability granted no higher) -- ` +
                `contradictory grant: raise the other capabilities or lower this one`);
        }
      }
      if (capability === "spend") checkSpendCap(grant.cap, where, add);
      if (["message", "publish", "deploy"].includes(capability) && grant.targets != null)
        for (const t of grant.targets)
          if (!(targets[capability] || []).includes(t))
            add(`${where}.${capability} names target ${JSON.stringify(t)}, absent from the top-level targets.${capability} enum`);
    }
  }

  return v;
}

/** The ceiling ADR-0507's derivation allows for a shell grant, from declared levels alone. */
function derivedShellCeiling(entry, argv0Allow, classes) {
  const reproduced = new Set();
  for (const p of argv0Allow || []) {
    const cls = Object.prototype.hasOwnProperty.call(classes, p) ? classes[p] : null;
    const list = cls && Array.isArray(cls.reproduces) ? cls.reproduces : ["*"]; // unknown = everything
    for (const cap of list) {
      if (cap === "*") CAPABILITIES.filter((x) => x !== "shell").forEach((x) => reproduced.add(x));
      else if (cap !== "shell") reproduced.add(cap);
    }
  }
  let out = "L3";
  for (const cap of reproduced) {
    const g = entry[cap];
    const lvl = g && typeof g === "object" && isLevel(g.level) ? g.level : "L0";
    if (rank(lvl) < rank(out)) out = lvl;
  }
  return out;
}

function checkRoots(roots, where, resources, add) {
  if (roots == null) return;
  if (!Array.isArray(roots)) { add(`${where}.write.roots must be a list`); return; }
  for (const r of roots) {
    if (typeof r !== "string" || r === "") { add(`${where}.write.roots entry must be a non-empty string`); continue; }
    if (r.includes("\\")) add(`${where}.write.roots ${JSON.stringify(r)} contains a backslash -- POSIX-relative only`);
    if (r.startsWith("/") || /^[A-Za-z]:/.test(r) || r.startsWith("~")) add(`${where}.write.roots ${JSON.stringify(r)} is absolute`);
    if (r.split("/").some((s) => s === ".." || s === ".")) add(`${where}.write.roots ${JSON.stringify(r)} contains a traversal segment`);
    // Contradictory grant: a root that swallows an un-grantable resource. The runtime identity
    // check would still catch the individual write, but a file that SAYS it grants this is a
    // file people reason from, and it would be lying.
    for (const res of resources || []) {
      if (typeof res !== "string") continue;
      const target = res.endsWith("/**") ? res.slice(0, -3) : res;
      const prefix = r.endsWith("/**") ? r.slice(0, -3) : null;
      if (
        r === "**" ||
        r === target ||
        (prefix !== null && (target === prefix || target.startsWith(prefix + "/"))) ||
        // The reverse containment too: a root of `.claude/hooks` sits INSIDE the guarded
        // `.claude/hooks/**`, and the one-directional check missed it entirely.
        (prefix !== null && res.endsWith("/**") && prefix.startsWith(target + "/")) ||
        (prefix !== null && prefix === target)
      )
        add(`${where}.write.roots ${JSON.stringify(r)} swallows or lands inside the un-grantable resource ${JSON.stringify(res)} -- contradictory grant`);
    }
  }
}

function checkDomains(domains, where, add) {
  if (domains == null) return;
  if (!Array.isArray(domains)) { add(`${where}.network.domains must be a list`); return; }
  for (const d of domains) {
    if (typeof d !== "string" || d === "") { add(`${where}.network.domains entry must be a non-empty string`); continue; }
    if (d.includes("*")) add(`${where}.network.domains ${JSON.stringify(d)} is a wildcard -- exact hostnames only`);
    else if (IPV4.test(d) || d.includes(":")) add(`${where}.network.domains ${JSON.stringify(d)} is an IP literal -- exact hostnames only`);
    else if (/%[0-9a-f]{2}/i.test(d) || /^0x/i.test(d)) add(`${where}.network.domains ${JSON.stringify(d)} is an encoded form`);
    else if (d !== d.toLowerCase()) add(`${where}.network.domains ${JSON.stringify(d)} must be lowercase`);
    else if (!HOSTNAME.test(d)) add(`${where}.network.domains ${JSON.stringify(d)} is not a plain hostname`);
  }
}

function checkArgv0(allow, where, classes, add) {
  if (allow == null) return;
  if (!Array.isArray(allow)) { add(`${where}.shell.argv0_allow must be a list`); return; }
  for (const p of allow) {
    if (typeof p !== "string" || p === "") { add(`${where}.shell.argv0_allow entry must be a non-empty string`); continue; }
    if (!Object.prototype.hasOwnProperty.call(classes, p))
      add(`${where}.shell.argv0_allow names ${JSON.stringify(p)}, absent from argv0_classes -- an unclassified ` +
          `program is an error, never an implicit narrow (ADR-0507)`);
  }
}

function checkSpendCap(cap, where, add) {
  if (cap == null) return;
  if (typeof cap !== "object" || Array.isArray(cap)) { add(`${where}.spend.cap must be a mapping`); return; }
  if (!Number.isInteger(cap.amount)) add(`${where}.spend.cap.amount must be an integer in minor units, got ${JSON.stringify(cap.amount)}`);
  else if (cap.amount < 0) add(`${where}.spend.cap.amount must not be negative`);
  else if (!Number.isSafeInteger(cap.amount)) add(`${where}.spend.cap.amount overflows a safe integer`);
  if (typeof cap.currency !== "string" || !/^[A-Z]{3}$/.test(cap.currency))
    add(`${where}.spend.cap.currency must be ISO-4217 uppercase, got ${JSON.stringify(cap.currency)}`);
  if (cap.window !== "daily") add(`${where}.spend.cap.window must be "daily" in v1, got ${JSON.stringify(cap.window)}`);
}
