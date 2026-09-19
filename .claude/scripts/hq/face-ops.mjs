#!/usr/bin/env node
// face-ops -- the WORK door's op registry (face v2 Phase 05; ADR-1319 · ADR-1326 · ADR-1334 · ADR-1339).
//
// ONE table, and the only place an op is spelled. Each row names the script a hand-run calls and the exact argv
// for its plan and its apply. The door (lib/face/work-door.mjs) validates the owner's fields against the row, runs
// the plan argv, and on apply runs the apply argv. It computes no payload, knows no business rule and keeps no
// state but the plan it is holding -- that is ADR-1326's "no second brain", and the per-op no-second-path fixture
// (tests/face/work-door.mjs) is what makes it a measured property rather than a sentence.
//
// Two shapes of apply:
//   a function   -> the apply argv, built from the SAME validated fields the plan used (an emit whose dry run was
//                   the plan, or a tool whose plan mode is a flag it takes)
//   "emit-plan"  -> the plan's tool printed, as its LAST stdout line, the exact arc-event argv that seals its
//                   receipt: {"emit":["emit","<kind>",...]}. The door runs that argv and nothing else, after
//                   checking it emits THIS row's kind through a closed set of flags. The tool decides the payload,
//                   the idem and the outcome; the door never builds one (arc-pnl --close has always printed its
//                   seal line for a human to run -- this is the same line, run by the owner's click).
//
// `retires` names the Phase 03 verb-pending card an op makes live (module + verb, as evidence/phase-03 lists it). The
// card leaves its fold in the same change, and tests/face/module-frame.mjs holds evidence/phase-05/verbs-pending.md to
// Phase 03's cards minus exactly these -- a card cannot vanish without an op that retires it.
//
// Fields are strings, always: a pattern is anchored whole, a select names its options, an int is digits in a
// range. The field spelled here is the one the kit renders -- there is no second copy in the face (a module's
// ops.mjs names op ids and nothing else, and face-coverage holds the two lists equal both ways).
//
// Usage:
//   face-ops.mjs --list    the registry as JSON: ids, rooms, fields, receipt kinds, the hand-run commands. This is
//                          what face-coverage's op half and the route-enumeration fixture read.
//
// Exit: 0 printed | 2 bad arguments.

import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";
import { parsePolicyYaml } from "./lib/policy/yaml.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The flags an emit plan may carry. `--payload-file` and `--event-file` are absent on purpose: a plan names bytes, never a path the door would then read. */
export const EMIT_PLAN_FLAGS = Object.freeze(["--payload", "--idem", "--strict", "--outcome", "--venture", "--process", "--run-id", "--supersedes"]);

/** A bench driver is a file the engine lane ships; the list is read, never written down (common.mjs is the shared library, not a driver). */
function benchDrivers() {
  try {
    return readdirSync(join(HERE, "..", "engine", "drivers"))
      .filter((f) => f.endsWith(".mjs") && f !== "common.mjs")
      .map((f) => f.slice(0, -4))
      .sort();
  } catch { return []; }
}

// One line of text: no control character at all (C0, DEL, C1 -- which covers CR, LF, NUL, ESC and tab) and none of the
// Unicode line breaks. The first cut refused only CR, LF and NUL, and an ESC sequence reached the spine verbatim
// (face v2 Phase 05 logic attack; the twin of Phase 03's "no terminal control in a sentence"). Nor the bidi embedding,
// override and isolate controls: `safe <U+202E>txt.exe` planned, and on the plan card it reads in an order the bytes do
// not have -- the owner approves one string and the receipt carries another (round-2 logic attack).
// And none of the other INVISIBLE format characters (\p{Cf}: soft hyphen, zero-width space, the bidi marks, word joiner,
// BOM, the tag block, the interlinear annotations) or a lone surrogate: each renders as nothing, or as text nobody
// wrote, and a lone surrogate becomes U+FFFD in the tool's argv (PR 2 logic attack). ZWNJ and ZWJ stay: they join emoji
// and the letters of several scripts, and render as nothing but the join they make.
const ONE_LINE_BAD_SRC = "[\\p{Cc}\\p{Cs}\\u2028\\u2029]|(?![\\u200C\\u200D])\\p{Cf}";
const ONE_LINE = `(?:(?!${ONE_LINE_BAD_SRC})[\\s\\S])+`;
const ONE_LINE_BAD = new RegExp(ONE_LINE_BAD_SRC, "u");
const CHAR_NAMES = Object.freeze({ 0x09: "a tab", 0x0a: "a line break", 0x0d: "a carriage return", 0x1b: "an escape", 0x00: "a NUL", 0x2028: "a line separator", 0x2029: "a paragraph separator" });
const BIDI = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/u;

/** The first character a one-line field refuses, named: the owner cannot fix a character the refusal does not show. */
function refusedChar(raw) {
  const m = ONE_LINE_BAD.exec(raw);
  if (!m) return "";
  const cp = /** @type {number} */ (m[0].codePointAt(0));
  const hex = `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
  if (CHAR_NAMES[cp]) return `${hex} (${CHAR_NAMES[cp]})`;
  if (BIDI.test(m[0])) return `${hex} (a text-direction control)`;
  if (/\p{Cs}/u.test(m[0])) return `${hex} (a lone surrogate)`;
  if (/\p{Cf}/u.test(m[0])) return `${hex} (an invisible format character)`;
  return `${hex} (a control character)`;
}

/**
 * An emit whose dry run IS the plan. The apply is the same argv without `--dry-run`, so the two cannot drift: they
 * are one list, and the flag is the only difference.
 * @param {string} kind @param {(v: Record<string, string>) => unknown} payload
 */
function emitOp(kind, payload) {
  const argv = (v) => ["emit", kind, "--payload", JSON.stringify(payload(v)), "--strict"];
  return {
    plan: (v) => ({ script: "hq/arc-event.mjs", args: [...argv(v), "--dry-run"] }),
    apply: (v) => ({ script: "hq/arc-event.mjs", args: argv(v) }),
  };
}

/** The jobs hq.jobs.yaml declares, read from the schedule the scheduler itself reads -- never a second list. */
function scheduledJobs() {
  try {
    const parsed = parseYamlSubset(readFileSync(join(HERE, "..", "..", "..", "hq.jobs.yaml"), "utf8"));
    const jobs = parsed.ok && parsed.value && Array.isArray(parsed.value.jobs) ? parsed.value.jobs : [];
    return jobs.map((j) => (j && typeof j.name === "string" ? j.name : "")).filter((n) => /^[a-z][a-z0-9-]*$/.test(n)).sort();
  } catch { return []; }
}

/** The router's classes and tiers, read from engine/router.yaml the way the router's loader reads it. */
function routerFacts() {
  try {
    const parsed = parseYamlSubset(readFileSync(join(HERE, "..", "..", "..", "engine", "router.yaml"), "utf8"));
    const r = parsed.ok && parsed.value ? parsed.value : {};
    const classes = r.classes && typeof r.classes === "object" ? Object.keys(r.classes).filter((c) => /^[a-z][a-z0-9-]{0,40}$/.test(c)).sort() : [];
    const tiers = Array.isArray(r.tiers) ? r.tiers.filter((t) => typeof t === "string" && /^[a-z][a-z0-9-]{0,40}$/.test(t)) : [];
    return { classes, tiers };
  } catch { return { classes: [], tiers: [] }; }
}
/** The drivers engine/propose.mjs accepts: one .sh per driver, as bench reads them. */
function routeDrivers() {
  try { return readdirSync(join(HERE, "..", "engine", "drivers")).filter((f) => f.endsWith(".sh")).map((f) => f.slice(0, -3)).sort(); }
  catch { return []; }
}
const ROUTER = routerFacts();
/** The action kinds hq.policy.yaml declares -- a promotion names one of them, or it names nothing. */
function policyKinds() {
  try {
    const pol = parsePolicyYaml(readFileSync(join(HERE, "..", "..", "..", "hq.policy.yaml"), "utf8"));
    return pol && pol.kinds ? Object.keys(pol.kinds).filter((k) => /^(session|process):[a-z][a-z0-9-]{0,63}$/.test(k)).sort() : [];
  } catch { return []; }
}
/** The optional one-line reason every proposal carries onto its branch and into the inbox. */
const WHY = Object.freeze({ name: "why", label: "Why", placeholder: "one line -- the evidence you are acting on", type: "text", max: 400, pattern: ONE_LINE, required: false });
/** A proposal's argv: the same for plan and apply, but for --dry-run. */
const proposeArgs = (verb, v) => [verb, "--class", v.class, "--to", v.to, ...(v.why ? ["--why", v.why] : [])];

export const OPS = Object.freeze([
  Object.freeze({
    id: "today.capture-idea",
    room: "today",
    lane: "hq",
    label: "Capture an idea",
    hint: "One line. It lands on the spine as idea.captured, and nowhere else.",
    receipt: Object.freeze({ kind: "idea.captured" }),
    binding: "v0.7 `capture idea` -> idea.captured, written by arc-event (the kind v0.7 named is one arc has)",
    humanRun: false, spends: false, touchesFiles: false,
    fields: Object.freeze([
      Object.freeze({ name: "text", label: "The idea", placeholder: "one line -- what you noticed", type: "text", max: 300, pattern: ONE_LINE, required: true }),
    ]),
    ...emitOp("idea.captured", (v) => ({ text: v.text })),
  }),
  Object.freeze({
    id: "develop.checkpoint",
    room: "develop",
    lane: "develop",
    label: "Checkpoint the lane",
    hint: "The develop harness reads what changed against the lane's risk globs; the receipt records that it was read.",
    receipt: Object.freeze({ kind: "note.logged" }),
    binding: "v0.7 `checkpoint` -> note.logged, written by develop.mjs checkpoint --receipt (ADR-1339: a note that a read happened, not a state change)",
    humanRun: false, spends: false, touchesFiles: false,
    fields: Object.freeze([
      Object.freeze({ name: "lane", label: "Lane", placeholder: "face", type: "text", max: 64, pattern: "[a-z][a-z0-9-]*", required: true }),
    ]),
    plan: (v) => ({ script: "develop/develop.mjs", args: ["checkpoint", "--lane", v.lane] }),
    apply: (v) => ({ script: "develop/develop.mjs", args: ["checkpoint", "--lane", v.lane, "--receipt"] }),
  }),
  Object.freeze({
    id: "money.criteria",
    room: "money",
    lane: "ledger",
    label: "Request a criteria change",
    hint: "ventures.yaml's kill lines move only with an approved receipt (ADR-1008). This raises the request; you approve it in the inbox.",
    receipt: Object.freeze({ kind: "approval.requested" }),
    binding: "v0.7 `criteria` -> approval.requested under the ledger.criteria profile (ADR-1017), sealed by the line arc-pnl --criteria-request prints",
    retires: Object.freeze({ module: "money", verb: "Set a venture's kill criteria" }),
    humanRun: false, spends: false, touchesFiles: false,
    fields: Object.freeze([
      Object.freeze({ name: "what", label: "What changed in ventures.yaml, and why", placeholder: "moved the MRR kill line to 90 days", type: "text", max: 512, pattern: ONE_LINE, required: true }),
    ]),
    plan: (v) => ({ script: "hq/arc-pnl.mjs", args: ["--criteria-request", v.what] }),
    apply: "emit-plan",
  }),
  Object.freeze({
    id: "money.close-month",
    room: "money",
    lane: "ledger",
    label: "Close a month",
    hint: "The close reconciles every rail against the totals you give. It is human-run by law: it applies only on your click.",
    receipt: Object.freeze({ kind: "month.closed" }),
    binding: "v0.7 `close month` -> month.closed, sealed by the line arc-pnl --close prints (it never emits on its own)",
    retires: Object.freeze({ module: "money", verb: "Close the month" }),
    humanRun: true, spends: false, touchesFiles: false,
    fields: Object.freeze([
      Object.freeze({ name: "month", label: "Month", placeholder: "YYYY-MM", type: "text", max: 7, pattern: "\\d{4}-(0[1-9]|1[0-2])", required: true }),
      // Optional: a month no rail touched reconciles against nothing, and the close says so itself. When a rail DID
      // move money, arc-pnl refuses the close without its total -- that refusal is the gate, not this form.
      Object.freeze({ name: "totals", label: "Provider totals", placeholder: "razorpay:INR=0 -- one per rail, space-separated", type: "text", max: 400, pattern: "[a-z][a-z0-9-]*:[A-Z]{3}=[0-9]{1,15}( [a-z][a-z0-9-]*:[A-Z]{3}=[0-9]{1,15}){0,7}", required: false }),
    ]),
    plan: (v) => ({ script: "hq/arc-pnl.mjs", args: ["--close", v.month, ...(v.totals ? v.totals.split(" ").flatMap((t) => ["--reconcile-total", t]) : []), "--emit-plan"] }),
    apply: "emit-plan",
  }),
  Object.freeze({
    id: "growth.publish",
    room: "growth",
    lane: "growth",
    label: "Seal a publication",
    hint: "After a human merged the article's PR, this records that it is live. The machine never merges (E2).",
    receipt: Object.freeze({ kind: "content.published" }),
    binding: "v0.7 `publish` -> content.published, sealed by the line arc-growth seal prints (the review pack stays arc-growth publish)",
    retires: Object.freeze({ module: "growth", verb: "Merge and publish" }),
    humanRun: true, spends: false, touchesFiles: false,
    fields: Object.freeze([
      Object.freeze({ name: "slug", label: "Slug", placeholder: "the-author-cannot-be-the-attacker", type: "text", max: 120, pattern: "[a-z0-9]([a-z0-9-]*[a-z0-9])?", required: true }),
      Object.freeze({ name: "article", label: "The merged .mdx", placeholder: "the article file in the site repo's merged tree", type: "text", max: 400, pattern: `(?![\\\\/]{2})${ONE_LINE}\\.mdx`, required: true }),
      Object.freeze({ name: "cluster", label: "Cluster", placeholder: "c-001", type: "text", max: 12, pattern: "c-[0-9]{3,9}", required: true }),
      Object.freeze({ name: "title", label: "Title", placeholder: "the title as published", type: "text", max: 300, pattern: ONE_LINE, required: true }),
      Object.freeze({ name: "pr", label: "Merged PR", placeholder: "2", type: "text", max: 10, pattern: "[1-9][0-9]{0,9}", required: true }),
    ]),
    plan: (v) => ({ script: "growth/arc-growth.mjs", args: ["seal", v.slug, "--article", v.article, "--cluster-id", v.cluster, "--title", v.title, "--pr", v.pr] }),
    apply: "emit-plan",
  }),
  Object.freeze({
    id: "bench.run-model",
    room: "bench",
    lane: "bench",
    label: "Bench a model",
    hint: "Runs the bench against a driver and model under the ceilings you set. The plan invokes nothing; the run spends.",
    receipt: Object.freeze({ kind: "run.completed", process: "bench@0.1.0" }),
    binding: "v0.7 `paste model -> run` -> run.completed from arc-bench (process bench@0.1.0); the propose step is the kernel ring's",
    humanRun: true, spends: true, touchesFiles: false,
    fields: Object.freeze([
      Object.freeze({ name: "driver", label: "Driver", placeholder: "", type: "select", options: Object.freeze(benchDrivers()), required: true }),
      Object.freeze({ name: "model", label: "Model", placeholder: "the model id the driver takes", type: "text", max: 128, pattern: "[A-Za-z0-9][A-Za-z0-9._:/-]*", required: true }),
      // At least 1: a ceiling of 0 stops every attempt before it invokes anything (arc-run's own rule), so a run under it
      // measures nothing -- even on the mock driver, which spends 0 but still needs room to be called.
      Object.freeze({ name: "inr", label: "Spend ceiling, rupees", placeholder: "50", type: "int", min: 1, max: 50000, required: true }),
      Object.freeze({ name: "minutes", label: "Time ceiling, minutes", placeholder: "20", type: "int", min: 1, max: 600, required: true }),
    ]),
    plan: (v) => ({ script: "engine/arc-bench.mjs", args: ["--driver", v.driver, "--model", v.model, "--budget", `inr=${v.inr},min=${v.minutes}`, "--dry-run"] }),
    apply: (v) => ({ script: "engine/arc-bench.mjs", args: ["--driver", v.driver, "--model", v.model, "--budget", `inr=${v.inr},min=${v.minutes}`] }),
    // The one form of this op a sim door may run: the mock driver replays recorded bytes and spends nothing.
    simSafe: (v) => v.driver === "mock",
    estimate: (v) => (v.driver === "mock"
      ? "₹0 -- the mock driver replays recorded bytes and reaches no provider"
      : `at most ₹${v.inr} and ${v.minutes} min -- the --budget ceiling arc-bench enforces`),
  }),
  Object.freeze({
    id: "scheduler.register-job",
    room: "scheduler",
    lane: "scheduler",
    label: "Register a job with the machine's scheduler",
    hint: "The moment arc stops being attended (SCH-G): the plan runs every check a registration makes -- the schedule's legality, the job enabled, the policy gate -- and hands nothing to the OS. It applies only on your click.",
    receipt: Object.freeze({ kind: "note.logged" }),
    binding: "v0.7 `register job` -> note.logged, written by arc-jobs register <job> --receipt after the OS read the task back (ADR-1339, ADR-1340)",
    humanRun: true, spends: false, touchesFiles: false, touchesOs: true,
    fields: Object.freeze([
      Object.freeze({ name: "job", label: "Job", placeholder: "", type: "select", options: Object.freeze(scheduledJobs()), required: true }),
    ]),
    plan: (v) => ({ script: "hq/arc-jobs.mjs", args: ["register", v.job, "--dry-run"] }),
    apply: (v) => ({ script: "hq/arc-jobs.mjs", args: ["register", v.job, "--receipt"] }),
  }),
  Object.freeze({
    id: "engine-room.driver-switch",
    room: "engine-room",
    lane: "engine",
    label: "Propose a driver switch",
    hint: "Routes one task class to another driver as a PROPOSAL: a one-line router diff on a new feat/face-* branch, and an approval in your inbox. Nothing routes differently until a human merges it.",
    receipt: Object.freeze({ kind: "approval.requested" }),
    binding: "v0.7 `driver switch` -> approval.requested (gate router-merge) naming the proposal branch engine/propose.mjs driver wrote (ADR-1340)",
    humanRun: true, spends: false, touchesFiles: true,
    fields: Object.freeze([
      Object.freeze({ name: "class", label: "Task class", placeholder: "", type: "select", options: Object.freeze(ROUTER.classes), required: true }),
      Object.freeze({ name: "to", label: "Driver", placeholder: "", type: "select", options: Object.freeze(routeDrivers()), required: true }),
      WHY,
    ]),
    plan: (v) => ({ script: "engine/propose.mjs", args: [...proposeArgs("driver", v), "--dry-run"] }),
    apply: (v) => ({ script: "engine/propose.mjs", args: proposeArgs("driver", v) }),
  }),
  Object.freeze({
    id: "model-policy.tier-proposal",
    room: "model-policy",
    lane: "engine",
    label: "Propose a tier change",
    hint: "A tier is law (ADR-0069): the change is a one-line router diff on a new feat/face-* branch, raised to your inbox. The class keeps its tier until a human merges it.",
    receipt: Object.freeze({ kind: "approval.requested" }),
    binding: "v0.7 `tier proposal` -> approval.requested (gate model-policy) naming the proposal branch engine/propose.mjs tier wrote (ADR-1340)",
    retires: Object.freeze({ module: "model-policy", verb: "Propose a tier change" }),
    humanRun: true, spends: false, touchesFiles: true,
    fields: Object.freeze([
      Object.freeze({ name: "class", label: "Task class", placeholder: "", type: "select", options: Object.freeze(ROUTER.classes), required: true }),
      Object.freeze({ name: "to", label: "Tier", placeholder: "", type: "select", options: Object.freeze(ROUTER.tiers), required: true }),
      WHY,
    ]),
    plan: (v) => ({ script: "engine/propose.mjs", args: [...proposeArgs("tier", v), "--dry-run"] }),
    apply: (v) => ({ script: "engine/propose.mjs", args: proposeArgs("tier", v) }),
  }),
  Object.freeze({
    id: "policy.cap-proposal",
    room: "policy",
    lane: "policy",
    label: "Propose a capability promotion",
    hint: "Asks for one (kind, capability) pair to climb a level within its ceiling, citing trial-ledger evidence. It moves only on your stamp in the inbox. Raising a ceiling is a reviewed edit to hq.policy.yaml, which nothing in the face writes.",
    receipt: Object.freeze({ kind: "approval.requested" }),
    binding: "v0.7 `cap proposal` -> approval.requested under the policy.promotion profile (POL-C), sealed by the line policy-promote.mjs prints (ADR-1340)",
    humanRun: false, spends: false, touchesFiles: false,
    fields: Object.freeze([
      Object.freeze({ name: "kind", label: "Action kind", placeholder: "", type: "select", options: Object.freeze(policyKinds()), required: true }),
      Object.freeze({ name: "capability", label: "Capability", placeholder: "", type: "select", options: Object.freeze(["read", "write", "shell", "network", "message", "publish", "deploy", "spend"]), required: true }),
      Object.freeze({ name: "to", label: "To level", placeholder: "", type: "select", options: Object.freeze(["L1", "L2", "L3"]), required: true }),
      Object.freeze({ name: "evidence", label: "Trial-ledger evidence", placeholder: "docs/trial-ledger.md#the-row-you-cite", type: "text", max: 300, pattern: ONE_LINE, required: true }),
      Object.freeze({ name: "what", label: "In a sentence", placeholder: "optional -- the request says it for you", type: "text", max: 300, pattern: ONE_LINE, required: false }),
    ]),
    plan: (v) => ({ script: "hq/policy-promote.mjs", args: ["--kind", v.kind, "--capability", v.capability, "--to", v.to, "--evidence", v.evidence, ...(v.what ? ["--what", v.what] : [])] }),
    apply: "emit-plan",
  }),
  Object.freeze({
    id: "evolve.open-experiment",
    room: "evolve",
    lane: "evolve",
    label: "Open an experiment",
    hint: "One declared surface, sealed at its bytes as they stand now (base_sha), two arms and a split. The module must declare an evolve section; the concurrency cap is two per module.",
    receipt: Object.freeze({ kind: "experiment.opened" }),
    binding: "v0.7 `open experiment` -> experiment.opened, sealed by the line arc-evolve open prints (ADR-1340)",
    retires: Object.freeze({ module: "evolve", verb: "Open an experiment" }),
    humanRun: false, spends: false, touchesFiles: false,
    fields: Object.freeze([
      Object.freeze({ name: "experiment", label: "Experiment id", placeholder: "x-hero-copy-2", type: "text", max: 64, pattern: "x-[A-Za-z0-9][A-Za-z0-9._-]{0,62}", required: true }),
      Object.freeze({ name: "module", label: "Module", placeholder: "the product whose manifest declares the surface", type: "text", max: 64, pattern: "[a-z][a-z-]*", required: true }),
      Object.freeze({ name: "surface", label: "Surface", placeholder: "hero-copy", type: "text", max: 64, pattern: "[a-z0-9][a-z0-9-]{0,63}", required: true }),
      Object.freeze({ name: "target", label: "Surface file", placeholder: "the surface_file the manifest declares", type: "text", max: 300, pattern: "[A-Za-z0-9._()\\[\\]-]+(/[A-Za-z0-9._()\\[\\]-]+)*", required: true }),
      Object.freeze({ name: "arms", label: "Arms", placeholder: "+champion,+challenger", type: "text", max: 200, pattern: "\\+[a-z0-9][a-z0-9-]{0,31}(,\\+[a-z0-9][a-z0-9-]{0,31}){1,7}", required: true }),
      Object.freeze({ name: "split", label: "Split", placeholder: "optional -- the manifest's split", type: "text", max: 40, pattern: "[0-9]{1,2}(,[0-9]{1,2}){1,7}", required: false }),
      Object.freeze({ name: "ttl", label: "TTL, days", placeholder: "28", type: "int", min: 1, max: 365, required: false }),
    ]),
    plan: (v) => ({ script: "evolve/arc-evolve.mjs", args: ["open", "--experiment", v.experiment, "--module", v.module, "--surface", v.surface, "--target", v.target, "--arms", v.arms, ...(v.split ? ["--split", v.split] : []), ...(v.ttl ? ["--ttl", v.ttl] : [])] }),
    apply: "emit-plan",
  }),
  Object.freeze({
    id: "evolve.measure",
    room: "evolve",
    lane: "evolve",
    label: "Record a measurement",
    hint: "One unit's value for one metric over one window. The arm and cohort come from the experiment's own assignment, never from this form; a drifted surface refuses.",
    receipt: Object.freeze({ kind: "experiment.measured" }),
    binding: "v0.7 `measure` -> experiment.measured, sealed by the line arc-evolve measure prints (ADR-1340)",
    humanRun: false, spends: false, touchesFiles: false,
    fields: Object.freeze([
      Object.freeze({ name: "experiment", label: "Experiment id", placeholder: "x-hero-copy-2", type: "text", max: 64, pattern: "x-[A-Za-z0-9][A-Za-z0-9._-]{0,62}", required: true }),
      Object.freeze({ name: "unit", label: "Unit id", placeholder: "an opaque id, never an address", type: "text", max: 64, pattern: "[A-Za-z0-9][A-Za-z0-9._-]{0,63}", required: true }),
      Object.freeze({ name: "metric", label: "Metric", placeholder: "signup_conversion", type: "text", max: 64, pattern: "[a-z][a-z0-9_]{0,63}", required: true }),
      Object.freeze({ name: "value", label: "Value", placeholder: "1", type: "text", max: 32, pattern: "-?[0-9]+(\\.[0-9]+)?", required: true }),
      Object.freeze({ name: "count", label: "Observations", placeholder: "1", type: "int", min: 0, max: 100000000, required: true }),
      Object.freeze({ name: "window", label: "Window", placeholder: "2026-09-01..2026-09-07", type: "text", max: 22, pattern: "\\d{4}-\\d{2}-\\d{2}\\.\\.\\d{4}-\\d{2}-\\d{2}", required: true }),
      Object.freeze({ name: "source", label: "Source id", placeholder: "where the number came from, as an opaque id", type: "text", max: 64, pattern: "[A-Za-z0-9][A-Za-z0-9._-]{0,63}", required: true }),
    ]),
    plan: (v) => ({ script: "evolve/arc-evolve.mjs", args: ["measure", "--experiment", v.experiment, "--unit", v.unit, "--metric", v.metric, "--value", v.value, "--count", v.count, "--window", v.window, "--source", v.source] }),
    apply: "emit-plan",
  }),
  Object.freeze({
    id: "evolve.conclude",
    room: "evolve",
    lane: "evolve",
    label: "Conclude an experiment",
    hint: "Computes the one verdict the test allows, once, from the receipts: the verdict cohort, complete windows, both arms at their floor. A no-verdict is shown with its reasons and writes nothing.",
    receipt: Object.freeze({ kind: "experiment.verdict" }),
    binding: "v0.7 `conclude` -> experiment.verdict, sealed by the line arc-evolve conclude prints (ADR-1340)",
    humanRun: false, spends: false, touchesFiles: false,
    fields: Object.freeze([Object.freeze({ name: "experiment", label: "Experiment id", placeholder: "x-hero-copy-2", type: "text", max: 64, pattern: "x-[A-Za-z0-9][A-Za-z0-9._-]{0,62}", required: true })]),
    plan: (v) => ({ script: "evolve/arc-evolve.mjs", args: ["conclude", "--experiment", v.experiment] }),
    apply: "emit-plan",
  }),
]);

export class OpError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(message); this.code = code; }
}

/** @param {string} id */
export function opById(id) {
  return OPS.find((o) => o.id === id) || null;
}

/**
 * The owner's fields, checked against the row. Strings only, every key known, every required key present, each
 * value inside its pattern, options or range. Returns the values the plan and apply builders see -- nothing else.
 * @param {typeof OPS[number]} op @param {unknown} input
 * @returns {Record<string, string>}
 */
export function validateInput(op, input) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw new OpError("BAD_INPUT", `${op.id} takes an object of fields (${op.fields.map((f) => f.name).join(", ")})`);
  const known = new Set(op.fields.map((f) => f.name));
  for (const k of Object.keys(input))
    if (!known.has(k)) throw new OpError("BAD_INPUT", `${op.id} has no field "${k}" -- its fields are ${[...known].join(", ")}`);
  /** @type {Record<string, string>} */
  const out = {};
  for (const f of op.fields) {
    const raw = Object.hasOwn(input, f.name) ? /** @type {Record<string, unknown>} */ (input)[f.name] : undefined;
    if (raw === undefined || raw === "") {
      if (f.required) throw new OpError("BAD_INPUT", `${f.label} is required`);
      continue;
    }
    if (typeof raw !== "string") throw new OpError("BAD_INPUT", `${f.label} must be text`);
    if (f.type === "select") {
      if (!f.options.includes(raw)) throw new OpError("BAD_INPUT", `${f.label} must be one of ${f.options.join(", ")}`);
    } else if (f.type === "int") {
      if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new OpError("BAD_INPUT", `${f.label} must be a whole number`);
      const n = Number(raw);
      if (n < f.min || n > f.max) throw new OpError("BAD_INPUT", `${f.label} must be between ${f.min} and ${f.max}`);
    } else {
      // Bytes, not characters: a field bound is a size on the wire and in the receipt.
      // The refusal says the size in both units: 110 Tamil letters are 330 bytes, and "longer than 300 bytes" read as
      // a lie to an owner who typed 110 characters (round-2 logic attack). The face shows the same count as they type.
      const bytes = Buffer.byteLength(raw, "utf8");
      if (bytes > f.max) throw new OpError("BAD_INPUT", `${f.label} is ${bytes} bytes (${[...raw].length} characters); the cap is ${f.max} bytes -- an English letter is 1 byte, a Tamil letter 3, an emoji 4`);
      if (raw !== raw.trim()) throw new OpError("BAD_INPUT", `${f.label} starts or ends with whitespace`);
      // A value that opens with a dash can be read as a FLAG by the tool it is handed to (`--title --pr` would make
      // the title swallow the next flag in some parsers). Refused for every text field, whatever its pattern says.
      if (raw.startsWith("-")) throw new OpError("BAD_INPUT", `${f.label} may not start with "-" -- a tool could read it as a flag`);
      if (f.pattern === ONE_LINE && refusedChar(raw)) throw new OpError("BAD_INPUT", `${f.label} is one line of text, and it holds ${refusedChar(raw)}`);
      if (!new RegExp(`^(?:${f.pattern})$`, "u").test(raw)) throw new OpError("BAD_INPUT", `${f.label} is not in the shape this op takes (${f.placeholder || f.pattern})`);
    }
    out[f.name] = raw;
  }
  return out;
}

/**
 * The emit argv a plan printed, checked before anything runs it: an `emit` of THIS row's kind, through the closed
 * flag set, every flag given once with a value (`--strict` takes none). Anything else is the tool and the registry
 * disagreeing, and the door refuses rather than guess which one is right.
 * @param {typeof OPS[number]} op @param {string} stdout
 * @returns {string[]}
 */
export function emitPlanFrom(op, stdout) {
  const lines = String(stdout).split(/\r?\n/).filter((l) => l.trim() !== "");
  const last = lines.length ? lines[lines.length - 1] : "";
  let parsed;
  try { parsed = JSON.parse(last); } catch { throw new OpError("NO_EMIT_PLAN", `${op.id}: the plan's last line is not the emit plan its tool prints`); }
  const argv = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed.emit : undefined;
  if (!Array.isArray(argv) || !argv.every((a) => typeof a === "string"))
    throw new OpError("NO_EMIT_PLAN", `${op.id}: the plan's last line carries no emit argv`);
  if (argv[0] !== "emit" || argv[1] !== op.receipt.kind)
    throw new OpError("EMIT_PLAN_MISMATCH", `${op.id} seals ${op.receipt.kind}; its tool planned "${argv.slice(0, 2).join(" ")}"`);
  const seen = new Set();
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!EMIT_PLAN_FLAGS.includes(a)) throw new OpError("EMIT_PLAN_MISMATCH", `${op.id}: the emit plan carries "${a}", which is not a flag a plan may set`);
    if (seen.has(a)) throw new OpError("EMIT_PLAN_MISMATCH", `${op.id}: the emit plan gives ${a} twice`);
    seen.add(a);
    if (a === "--strict") continue;
    const v = argv[i + 1];
    // A value is text that is not a flag: empty, or opening with "--", is refused even where arc-event would read it as
    // a value -- the plan would be relying on one parser's leniency (face v2 Phase 05 logic attack).
    if (v === undefined || v === "" || v.startsWith("--")) throw new OpError("EMIT_PLAN_MISMATCH", `${op.id}: the emit plan's ${a} has no value`);
    i++;
  }
  if (!seen.has("--strict")) throw new OpError("EMIT_PLAN_MISMATCH", `${op.id}: the emit plan is not --strict, so a refusal would exit 0`);
  return argv;
}

/**
 * The command line a person would type, for the plan card. Quoted for a POSIX shell; it is shown, never run --
 * the door runs the argv list, with no shell between it and the tool.
 * @param {{ script: string, args: string[] }} cmd
 */
export function commandLine(cmd) {
  const q = (s) => (/^[A-Za-z0-9_./:=,@-]+$/.test(s) ? s : `'${s.split("'").join("'\\''")}'`);
  return ["node", `.claude/scripts/${cmd.script}`, ...cmd.args].map(q).join(" ");
}

/** The registry as data: what --list prints and what the face reads through GET /api/ops. @param {readonly any[]} [registry] */
export function registryView(registry = OPS) {
  return registry.map((o) => ({
    id: o.id, room: o.room, lane: o.lane, label: o.label, hint: o.hint,
    receipt: o.receipt, binding: o.binding, retires: o.retires || null,
    humanRun: o.humanRun, spends: o.spends, touchesFiles: o.touchesFiles, touchesOs: o.touchesOs === true,
    fields: o.fields,
    apply: typeof o.apply === "function" ? "argv" : o.apply,
  }));
}

function isMainModule() {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  // exitCode, never process.exit(): the loop drains and stdout is flushed on every OS (the Windows teardown race in
  // fixed-defects.md).
  if (argv.length !== 1 || argv[0] !== "--list") {
    process.stderr.write("usage: face-ops.mjs --list\n");
    process.exitCode = 2;
  } else {
    process.stdout.write(JSON.stringify(registryView(), null, 2) + "\n");
  }
}
