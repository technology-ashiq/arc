#!/usr/bin/env node
/**
 * arc-run.mjs -- run any canonical process on any driver, headless (REQ-04..07).
 *
 * HEADLESS ONLY. It never wraps an interactive session -- a PLAN non-negotiable, and the
 * reason the driver contract is a subprocess with a JSON document on stdout rather than
 * anything conversational.
 *
 * THE THREE THINGS THAT ARE EASY TO GET SUBTLY WRONG, AND HOW THEY ARE HANDLED:
 *
 * 1. ESCALATION NEVER CHANGES A TIER (ADR-0204, ADR-0069 block b1). The ladder is
 *    `retry once on the same tier` -> `emit an approval.requested PROPOSAL` -> `stop`.
 *    No component changes a model tier at run time, under any condition. The proposal is a
 *    RECEIPT, not an action: acting on it means a human editing engine/router.yaml in a
 *    reviewed diff. An unattended run that hits a contract failure therefore stops and
 *    waits, and that is the intended behaviour rather than a gap to close later with a flag.
 *
 * 2. A SCHEMA FAILURE NAMES THE LAYER IT BLAMES. Before any driver is accused, the process's
 *    own pinned eval fixture is validated against the process's own schema. Fixture fails ->
 *    the fault is the PROCESS and no driver is blamed. Fixture passes and the live run does
 *    not -> the fault is the DRIVER. Without this, Phase 03's dogfood week produces a pile of
 *    schema failures that cannot distinguish "this driver is weak" from "we shipped a broken
 *    schema" -- which is exactly the call the "cut to 2 drivers" kill criterion has to make.
 *
 * 3. AN ABSENT COST STAYS ABSENT. Never zero, never estimated, never interpolated from a
 *    similar run (ADR-0069 block b5). A driver that dies before writing its sidecar leaves
 *    no cost, and that is recorded as no cost.
 *
 * Usage:
 *   arc-run.mjs --process NAME [--driver NAME|auto] [--budget inr=N,min=M]
 *               [--input JSON|@FILE] [--root PATH] [--work-root PATH]
 *               [--trial-model ID] [--dry-run]
 *
 * `--root` is where ARC lives; `--work-root` is where the DRIVER works (ADR-0220). They default
 * to the same place. `--trial-model` names a model for this invocation only, under ADR-0069(g)
 * -- it writes no router row and changes no tier, and the receipt records `model_source: trial`
 * so it can never be read back as a routing decision.
 * Zero dependencies, Node 18+.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { parseYamlSubset } from "./yaml-subset.mjs";
import { validateData } from "./schema-subset.mjs";
import { scanSecrets } from "../hq/lib/redact.mjs";
import { MODEL_RE } from "../hq/lib/validate.mjs";

// The runtime identity grammar. Alphanumerics plus the punctuation `hermes@sha256:<digest>+cfg.<hash>`
// actually uses, 1-256 chars. Deliberately NOT reusing MODEL_RE: this field exists precisely because
// a runtime identity is NOT a model id (ADR-0221), and one regex serving both would re-create the
// conflation that quarantined the first hermes receipt.
//
// DECLARED HERE, AT THE TOP, AND THAT POSITION IS LOAD-BEARING. Written next to its only use in
// `seatFor()` it sat ~470 lines below `fail()`, which runs during TOP-LEVEL execution on the
// earliest exit path in this file (`--budget inr=0`, "stopped before invoking any driver"). That
// path calls fail -> emitRun -> seatFor -> this const, hits the temporal dead zone, the emit throws
// into its catch, and the run writes NO RECEIPT AT ALL while still exiting 1. CI caught it in one
// job; `engine-driver-contract.bats:104` is the only thing that noticed.
//
// This is the SAME defect this cycle already recorded and fixed once, re-introduced by a fix
// produced by an adversarial pass -- which is exactly the gap the tracker names: "fixes produced by
// an adversarial pass are themselves UNATTACKED CODE".
const RUNTIME_ID_RE = /^[A-Za-z0-9][A-Za-z0-9@:+._/-]{0,255}$/;
import { authorizeRun } from "../hq/lib/policy/run-gate.mjs";
import { boundaryRefusal } from "./data-boundary.mjs";
import { routerFaults } from "./router-row.mjs";

// `mock` is the replay driver (ADR-0902, bench lane): it reaches no provider and costs nothing,
// so bench's own suite runs offline and free. It is a real driver rather than an env fake
// precisely so it can be SELECTED here and NAMED on a receipt.
// `hermes` is the agent-runtime shim (ADR-0208/0219, engine Cycle 7). It is one more driver and
// not a special guest: same argv contract, same three-code exit map, same cost sidecar.
const DRIVERS = ["claude-code", "codex", "generic-api", "hermes", "mock"];

// Drivers that actually hand the model to a provider, verified in their source rather than
// assumed: claude-code pushes `--model` onto its CLI argv, generic-api puts it in the request
// body. `codex` reads pinnedModel() and then invokes `exec --json <prompt>` without it, and
// `mock` never reads it. A receipt that names a model the driver never sent is a fabrication,
// so --trial-model is refused for the two that cannot carry it.
const MODEL_CAPABLE = ["claude-code", "generic-api"];

// DECLARED AT THE TOP, ASSIGNED AFTER ROUTING, AND THAT SPLIT IS DELIBERATE.
//
// `emitRun` reads both, and `fail()` reaches `emitRun` from anywhere in top-level execution --
// including the `--budget inr=0` arm, which is the earliest exit in the file. Declaring them
// beside the routing block that computes them left them in the temporal dead zone for any exit
// path that moved above it, and this file has ALREADY shipped that exact defect once: a named
// constant declared next to its use made `--budget inr=0` die with
// "Cannot access EMIT_TIMEOUT_MS before initialization" and write no receipt at all. Safe
// defaults here mean a receipt emitted from any exit path is honest rather than absent.
let modelSource = "none";
let effectiveModel = null;

// The emitter's strict-mode spine-lock wait is 15s (arc-event.mjs STRICT_LOCK_TIMEOUT_MS); hook
// mode's was 2s. arc-run's kill budget MUST exceed the child's own timeout, or the parent SIGKILLs
// a HEALTHY child that is still legitimately waiting -- and because arc-event.sh runs node as a
// CHILD rather than exec-ing it, the grandchild survives the kill and seals the receipt AFTER
// arc-run has already reported it lost. Demonstrated against a held lock: arc-run exited saying
// "NOT recorded" at 10.4s and the receipt appeared 6s later. 10000 was safe before --strict and
// stopped being safe the moment it was added.
//
// IT LIVES AT THE TOP OF THE FILE, NOT NEXT TO ITS USE, AND THAT PLACEMENT IS LOAD-BEARING.
// `fail()` runs during top-level execution -- the `--budget inr=0` arm calls it at module line
// ~183 -- and reaches emitEvent from there. A `const` beside emitEvent sits in the temporal dead
// zone at that moment, so the earliest exit path in the file died with
// "Cannot access EMIT_TIMEOUT_MS before initialization" and wrote NO receipt at all. Function
// declarations hoist; their constants do not. Introducing a named constant is not a free
// refactor when the function can run before the module finishes.
const EMIT_TIMEOUT_MS = 20000;

// ---------- CLI ----------
const argv = process.argv.slice(2);
let processName = "";
let driverArg = "";
let budgetStr = "";
let inputArg = "";
let root = "";
let trialModel = "";
let workRootArg = "";
let dryRun = false;
const seen = new Set();
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--process") processName = argv[++i] ?? "";
  else if (a === "--driver") driverArg = argv[++i] ?? "";
  else if (a === "--budget") budgetStr = argv[++i] ?? "";
  else if (a === "--input") inputArg = argv[++i] ?? "";
  else if (a === "--root") root = argv[++i] ?? "";
  // THE SEAM (ADR-0220). Both are EXPLICIT and opt-in: a caller that passes neither gets
  // today's behaviour byte-for-byte, and nothing is ever inherited from the ambient
  // environment. That distinction is the whole decision -- reading ARC_DRIVER_MODEL off the
  // environment is the un-reviewed tier change ADR-0069 b1 forbids, which is why the clobber
  // below exists in the first place. A flag is a thing a caller wrote down on purpose.
  //
  // PRESENCE, NOT TRUTHINESS, AND NO LAST-WINS. Both were built the lazy way first and both
  // failed OPEN in the dangerous direction: `--work-root "$W"` with W unset silently aimed the
  // driver at the ARC REPO -- which is the precise accident this seam exists to prevent, since
  // commit-msg-draft carries `git.op: add:*` and `commit:*`. `--trial-model "$M"` with M unset
  // silently ran PRODUCTION ROUTING while the caller believed a trial ran. An empty value is an
  // operator error, exactly as `parseBudget` below says of a repeated budget key and as
  // `.claude/rules/lanes.md` says of a repeated `--lane`: silently picking one of two named
  // values is the never-guess failure, and silently substituting a default for an absent one is
  // the same failure wearing a friendlier face.
  else if (a === "--trial-model" || a === "--work-root") {
    const key = a.slice(2);
    if (seen.has(key)) { console.error(`arc-run: ${a} given twice -- that is an operator error, not a last-wins override`); process.exit(2); }
    seen.add(key);
    const v = argv[++i];
    if (v === undefined || v === "") { console.error(`arc-run: ${a} needs a value (an empty one is an operator error, not "unset")`); process.exit(2); }
    if (key === "trial-model") trialModel = v; else workRootArg = v;
  }
  else if (a === "--dry-run") dryRun = true;
  else { console.error(`arc-run: unknown option ${a}`); process.exit(2); }
}
if (!processName) { console.error("usage: arc-run.mjs --process NAME [--driver NAME|auto] [--budget inr=N,min=M] [--input JSON|@FILE] [--root PATH] [--work-root PATH] [--trial-model ID]"); process.exit(2); }

function gitToplevel() {
  try { return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ""; }
}
root = resolve(root || process.env.ARC_ROOT || gitToplevel() || ".");

// TWO ROOTS, BECAUSE ONE NAME WAS DOING TWO JOBS (ADR-0220).
//
//   root      WHERE ARC'S MACHINERY LIVES -- processes/, engine/router.yaml, the driver scripts,
//             arc-event.sh, the spine. Always the arc repo. Never redirected by the seam.
//   workRoot  WHERE THE DRIVER DOES ITS WORK -- handed down as ARC_ROOT and as the child's cwd.
//
// They were the same variable, so they could never differ, so a driver could only ever operate on
// the arc repo itself. `commit-msg-draft` holds `git.op: add:*` and `commit:*`: a real driver run
// against a benchmark fixture would have staged and committed INSIDE arc. Defaulting workRoot to
// root keeps every existing caller byte-identical -- this widens what is expressible, not what
// happens by default.
const workRoot = workRootArg ? resolve(workRootArg) : root;
if (workRootArg) {
  // Refuse before the driver starts. Each of these surfaced as an inscrutable "driver exited 1"
  // with an empty stderr -- a receipt blaming the DRIVER for the caller's flag, which is a false
  // claim in an append-only ledger.
  let st = null;
  try { st = statSync(workRoot); } catch { st = null; }
  if (!st) { console.error(`arc-run: --work-root ${JSON.stringify(workRootArg)} does not exist`); process.exit(2); }
  // `existsSync` alone passed a regular FILE, and spawnSync then failed ENOENT with res.error
  // discarded -- status 1, stderr empty, receipt `reason: driver`. No driver process ever started.
  if (!st.isDirectory()) { console.error(`arc-run: --work-root ${JSON.stringify(workRootArg)} is not a directory`); process.exit(2); }

  // THE CONTAINMENT CHECK, AND WITHOUT IT THE FLAG ISOLATES NOTHING.
  //
  // Moving `cwd` is not containment, because git does not care about cwd -- it walks UP until it
  // finds a repository. A work-root anywhere beneath the arc tree (a materialized fixture under
  // tests/, a scratch dir, a gitignored staging area -- all natural choices for a bench harness)
  // therefore leaves `git add` and `git commit` operating on ARC'S OWN INDEX. That is the exact
  // outcome this seam was justified by preventing, and the version of it that shipped an hour ago
  // did not prevent it.
  //
  // So: the work-root must be the TOPLEVEL of its own repository, and that repository must not be
  // arc's. Anything else is refused by name rather than discovered later in a commit log.
  // EVERY QUESTION HERE IS ASKED OF GIT, AND NONE OF IT COMPARES PATH STRINGS.
  //
  // The first version compared `realpathSync(workRoot)` against git's `--show-toplevel`, and that
  // is wrong on exactly one of the three CI legs: Windows hands a process an 8.3 SHORT path
  // (`C:/Users/RUNNER~1/...`) while git reports the long form (`C:\Users\runneradmin\...`), and
  // `realpathSync` does not expand short names. Same directory, two strings, so a perfectly valid
  // work-root was refused as "not the toplevel of its repository". Invisible on the box that wrote
  // it, because a hand-typed path is already long-form -- the recorded Windows-path-resolution
  // shape, verbatim.
  //
  // `--show-prefix` is git's own answer to "where am I relative to the toplevel": empty AT the
  // toplevel, non-empty in a subdirectory, and it fails outside a repo. It needs no normalisation
  // because it is not a path comparison at all. The one remaining comparison is git-output against
  // git-output, so both sides are spelled the same way by construction.
  const gitIn = (dir, ...args) => {
    try { return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
    catch { return null; }
  };
  const prefix = gitIn(workRoot, "rev-parse", "--show-prefix");
  if (prefix === null) {
    console.error(`arc-run: --work-root ${JSON.stringify(workRootArg)} is not inside a git repository`);
    console.error("         A driver holding git.op grants needs a repo to hold its work; a bare directory would send those operations nowhere useful.");
    process.exit(2);
  }
  const wTop = gitIn(workRoot, "rev-parse", "--show-toplevel");
  const aTop = gitIn(root, "rev-parse", "--show-toplevel");
  if (wTop !== null && aTop !== null && wTop === aTop) {
    console.error(`arc-run: --work-root ${JSON.stringify(workRootArg)} resolves to THIS repository (${aTop})`);
    console.error("         git walks UPWARD from cwd, so a work-root inside arc would commit into arc -- which is what --work-root exists to prevent.");
    console.error("         Materialize the fixture repo outside this tree and point --work-root at its own toplevel.");
    process.exit(2);
  }
  if (prefix !== "") {
    // A subdirectory of another repo is refused too: the driver would operate on that repo's index
    // from a partial view, which is a different surprise rather than a safer one.
    console.error(`arc-run: --work-root ${JSON.stringify(workRootArg)} is not the toplevel of its repository (that is ${wTop})`);
    process.exit(2);
  }
}

const fail = (reason, msg, extra = {}) => {
  console.error(`arc-run: ${msg}`);
  emitRun({ outcome: "fail", reason, ...extra });
  process.exit(1);
};

// ---------- the canonical process ----------
const canonPath = join(root, "processes", `${processName}.process.yaml`);
if (!existsSync(canonPath)) { console.error(`arc-run: no such process \`${processName}\` (looked in processes/)`); process.exit(1); }
const parsed = parseYamlSubset(readFileSync(canonPath, "utf8"));
if (!parsed.ok) { console.error(`arc-run: ${processName} does not parse: ${parsed.error.what}`); process.exit(1); }
const doc = parsed.value;

// ---------- job stubs are not runnable processes (scheduler ADR-0802) ----------
// A scheduled job needs a POLICY SUBJECT, and ADR-0504 closes that set to `session:interactive`
// or `process:NAME` where NAME is a real stem in this directory. So each job ships a stub here
// purely to exist as a subject -- and a stub that exists as a subject is also, by construction,
// nameable to `--process`. That is the confusion surface ADR-0802 opened, and this is the guard
// that closes it.
//
// Placed immediately after the parse and BEFORE routing on purpose: refusing after a driver has
// been selected would already have consulted the router, and refusing after the run would have
// spent money. `job_stub` is read from the parsed document rather than inferred from the name,
// so a job renamed tomorrow stays refused.
// Keyed on PRESENCE, never on `=== true`. The frozen subset parses `yes`, `on`, `True`, `TRUE`
// and `"true"` as STRINGS and `1` as a number, so an equality check let every one of those
// spellings walk past this guard and reach driver selection -- on a document whose own body
// says NOT AN ENGINE PROCESS. `job_stub: false` is the one spelling that means "compile me".
if (doc && Object.prototype.hasOwnProperty.call(doc, "job_stub") && doc.job_stub !== false) {
  console.error(`arc-run: \`${processName}\` is a scheduled-job stub, not a runnable process.`);
  console.error(`         It exists so the job has a policy subject (ADR-0802/ADR-0504). Its work lives in`);
  console.error(`         .claude/scripts/hq/jobs/ and is run by: node .claude/scripts/hq/arc-jobs.mjs run ${processName}`);
  process.exit(1);
}

// ---------- routing ----------
function loadRouter() {
  const p = join(root, "engine", "router.yaml");
  if (!existsSync(p)) return null;
  const r = parseYamlSubset(readFileSync(p, "utf8"));
  if (!r.ok) { console.error(`arc-run: engine/router.yaml does not parse: ${r.error.what}`); process.exit(1); }
  // AT LOAD, NOT AT DISPATCH (REQ-04, ADR-0216). A row that only fails when someone happens to
  // route through it sits wrong for as long as nobody uses it, and the first person to use it is
  // the one who discovers the hire was never bounded. Every fault is reported, not the first:
  // fixing a four-field row one refusal at a time is four round trips.
  const faults = routerFaults(r.value);
  if (faults.length) {
    console.error(`arc-run: engine/router.yaml has ${faults.length} row fault(s) and will not load:`);
    for (const f of faults) console.error(`arc-run:   ${f}`);
    process.exit(1);
  }
  return r.value;
}

let driver = driverArg || "claude-code";
let tier = null;
let fallbacks = [];
// `hosted:` says whether this class leaves the machine. It is read here, at routing, so the data
// boundary below can name it in a refusal (Phase 06 REQ-02 fixture 3). An unrouted run has no
// row and therefore no claim either way -- which is not the same fact as `hosted: local`, and is
// left as the empty string rather than defaulted to the reassuring value.
let hosted = "";
if (driverArg === "auto") {
  const router = loadRouter();
  if (!router) { console.error("arc-run: --driver auto needs engine/router.yaml, which does not exist"); process.exit(1); }
  const row = router.classes?.[processName];
  if (!row) {
    // Loud, and it names the file to edit. The fix is always "edit this file", never
    // "guess harder" -- a router that silently defaults is a router that routes by accident.
    console.error(`arc-run: no route for task class \`${processName}\`.`);
    console.error(`         Add a \`classes.${processName}\` row to engine/router.yaml (known: ${Object.keys(router.classes ?? {}).join(", ") || "none"}).`);
    process.exit(1);
  }
  driver = row.driver;
  tier = row.tier;
  hosted = typeof row.hosted === "string" ? row.hosted : "";
  fallbacks = Array.isArray(row.fallback) ? row.fallback : [];
}
if (!DRIVERS.includes(driver)) { console.error(`arc-run: unknown driver \`${driver}\` (known: ${DRIVERS.join(", ")})`); process.exit(1); }

// THE TIER MUST REACH THE DRIVER OR IT IS A LABEL. Without this the routed tier changed
// nothing: `high-judgment` and `balanced-workhorse` produced byte-identical invocations, the
// receipt asserted `model: tier:X` that nothing had applied, and the real model knob was a
// run-time env var -- an un-reviewed tier change of exactly the kind ADR-0069 b1 forbids.
// A driver with no router entry runs UNPINNED and the receipt says so, rather than quietly
// inheriting whatever the environment holds.
let pinnedModel = null;
if (tier) {
  const router = loadRouter();
  const raw = router?.models?.[tier]?.[driver] ?? null;
  // THE ROUTED PIN IS CHECKED AGAINST THE SEAT GRAMMAR, AND IT WAS THE ONE INPUT THAT NEVER WAS.
  // `--trial-model` is validated below, and a runtime-reported model is validated in `seatFor` --
  // but `router.models` was read straight onto the receipt. `router-row.mjs` iterates
  // `router.classes` and never looks at `router.models`, so a pin like `claude sonnet 4` (a space)
  // or a non-string YAML scalar reached `--model`, the emitter threw BAD_MODEL under `--strict`,
  // and the ENTIRE receipt for a successful run was lost at exit 0. Worse, that unvalidated value
  // WINS the precedence over the runtime-reported one that was validated.
  //
  // Refused loudly here rather than dropped: unlike a runtime's report, a router pin is a reviewed
  // production routing decision, so a malformed one is an operator error to fix in the file, not a
  // field to silently omit. The message names the file and the exact path to edit.
  if (raw !== null && raw !== undefined) {
    if (typeof raw !== "string" || !MODEL_RE.test(raw)) {
      console.error(`arc-run: engine/router.yaml models.${tier}.${driver} is ${JSON.stringify(raw)}, which is not a clean model id`);
      console.error("         The spine refuses it (MODEL_RE), so the run would complete and its receipt would be");
      console.error("         rejected -- a lost receipt on a successful run. Fix the row rather than the seat.");
      // Exit 2, matching the `--trial-model` arm forty lines below and every other operator-error
      // path in this file. Deliberately NOT 1: nothing has run, no receipt is owed, and 1 is what
      // this file uses once a run has been attempted.
      process.exit(2);
    }
    pinnedModel = raw;
  }
}

// ---------- the trial seam (ADR-0220) ----------
/**
 * WHERE THE MODEL CAME FROM IS RECORDED, NOT JUST WHICH MODEL IT WAS.
 *
 * `router` -- a reviewed engine/router.yaml row resolved a tier to a model. Production routing.
 * `trial`  -- this invocation named a model explicitly, under ADR-0069 block (g): a trial may use
 *             any candidate model from any provider WITHOUT amending the policy, provided it is
 *             isolated and receipted. It writes no router row, changes no tier, and cannot affect
 *             any run that did not ask for it.
 * `none`   -- nothing pinned it; the driver's own default applies and the receipt says so.
 *
 * The two are never silently merged. A receipt that read like a routed pin when a trial supplied
 * the model would assert a routing decision nothing applied -- the false-claim-in-an-append-only-
 * ledger failure this file already refuses at the tier label (see emitRun).
 */
modelSource = pinnedModel ? "router" : "none";
if (trialModel) {
  // THE GUARD KEYS ON `tier`, NOT ON `pinnedModel`. The TIER is the reviewed routing decision;
  // `pinnedModel` is a derived lookup that can be ABSENT while that decision exists -- which is
  // the documented state for codex and generic-api at every tier (engine/router.yaml). Keying on
  // the derived value let a trial silently serve a production-routed class the moment any class
  // routed to one of them. Validate the thing that was decided, not the thing it looked up.
  if (tier) {
    console.error(`arc-run: --trial-model ${JSON.stringify(trialModel)} conflicts with routed tier \`${tier}\`${pinnedModel ? ` (pin ${JSON.stringify(pinnedModel)})` : " (which resolves to no pin for this driver)"}`);
    console.error("         `--driver auto` consulted engine/router.yaml, and a trial may not silently override a reviewed routing decision.");
    console.error("         Name a driver explicitly (--driver NAME) to run the trial, or drop --trial-model to use the route.");
    process.exit(2);
  }
  if (!MODEL_RE.test(trialModel)) {
    // The spine's OWN regex, imported rather than copied. Rejecting here means the run never
    // starts, instead of spending a driver call and discovering at emit time that the receipt
    // cannot be written -- which under --strict would exit 0 with real money spent (succeed()).
    console.error(`arc-run: --trial-model ${JSON.stringify(trialModel)} is not a clean model id`);
    process.exit(2);
  }
  // A RECEIPT MAY NOT VOUCH FOR A MODEL THAT NEVER RAN.
  //
  // `mock` never reads the model at all and `codex` reads it but never passes it to the CLI
  // (`exec --json <prompt>`). Accepting --trial-model for either would stamp
  // `model: X, model_source: trial` on a run where the provider was handed nothing -- and for
  // `mock`, which reaches no provider whatsoever, a full replay sweep could produce a complete
  // model-comparison table of models that never ran, every row receipted as a trial. For the one
  // lane whose entire purpose is measuring models, that is worse than having no seam.
  //
  // ADR-0069 block (e) wants the exact model id of WHAT ANSWERED. arc-run can only honestly
  // record what it ASKED FOR, so it refuses to ask a driver that cannot carry the question.
  if (!MODEL_CAPABLE.includes(driver)) {
    console.error(`arc-run: driver \`${driver}\` cannot apply a model, so --trial-model would be recorded but never used`);
    console.error(`         Model-capable drivers: ${MODEL_CAPABLE.join(", ")}.`);
    console.error(`         \`mock\` replays recordings (its model identity IS the recording set -- point ARC_MOCK_DIR at the set you mean); \`codex\` invokes its CLI without a model argument.`);
    process.exit(2);
  }
  modelSource = "trial";
}
// The one value handed to the driver, whatever produced it. Drivers are untouched by this
// change: they still read ARC_DRIVER_MODEL and know nothing about routers, tiers or trials.
effectiveModel = trialModel || pinnedModel;

// ---------- budget ----------
const BUDGET_KEYS = ["inr", "min"];
function parseBudget(s) {
  const out = {};
  for (const part of String(s || "").split(",")) {
    if (!part.trim()) continue;
    const m = part.match(/^([a-z]+)=(\d+(?:\.\d+)?)$/);
    if (!m) { console.error(`arc-run: unparseable budget segment \`${part}\` (want inr=N or min=M)`); process.exit(2); }
    // An unknown key was silently accepted, so `--budget foo=99` ran unbounded with no
    // warning; and a repeated key was silent last-wins, which `.claude/rules/lanes.md`
    // calls an operator error rather than an override -- applied here to money.
    if (!BUDGET_KEYS.includes(m[1])) { console.error(`arc-run: unknown budget key \`${m[1]}\` (known: ${BUDGET_KEYS.join(", ")})`); process.exit(2); }
    if (m[1] in out) { console.error(`arc-run: budget key \`${m[1]}\` given twice — that is an operator error, not a last-wins override`); process.exit(2); }
    const v = Number(m[2]);
    if (!Number.isFinite(v) || v > 1e9) { console.error(`arc-run: budget ${m[1]}=${m[2]} is out of range`); process.exit(2); }
    out[m[1]] = v;
  }
  return out;
}
const budget = parseBudget(budgetStr);
// THE BUDGET IS A PROPERTY OF THE RUN, NOT OF AN ATTEMPT. Previously every fallback hop and
// the retry each received a fresh FULL budget, so a `min=6s` run could legitimately take 4x
// that (3 chain hops + 1 retry) while every individual attempt stayed "inside" its bound.
const runStartedAt = Date.now();
let inrSpent = 0;
let attemptsMade = 0;
const msRemaining = () => ("min" in budget ? Math.max(0, budget.min * 60_000 - (Date.now() - runStartedAt)) : undefined);
// A zero (or negative) bound is a HARD stop before any spend, not a no-op. REQ-05 is that a
// run which would exceed its budget is stopped and says so -- never silently continues.
for (const k of ["inr", "min"]) {
  if (k in budget && budget[k] <= 0) {
    fail("budget", `budget ${k}=${budget[k]} leaves nothing to spend — stopped before invoking any driver`, { driver });
  }
}

// ---------- input ----------
let input = {};
if (inputArg) {
  const raw = inputArg.startsWith("@") ? readFileSync(resolve(root, inputArg.slice(1)), "utf8") : inputArg;
  try { input = JSON.parse(raw); }
  catch (e) { console.error(`arc-run: --input is not JSON: ${e.message}`); process.exit(2); }
}

// ---------- fault attribution (ADR-0204) ----------
/**
 * Validate the process's OWN eval fixture against its OWN schema. This runs before any
 * driver is blamed, so "the schema is broken" and "the driver is weak" are distinguishable
 * rather than both landing as `fail/schema`.
 */
function processIsSelfConsistent() {
  const evals = Array.isArray(doc.evals) ? doc.evals : [];
  for (const rel of evals) {
    const p = resolve(root, rel);
    if (!existsSync(p)) return { ok: false, why: `eval fixture ${rel} is absent` };
    let fx;
    try { fx = JSON.parse(readFileSync(p, "utf8")); }
    catch (e) { return { ok: false, why: `eval fixture ${rel} is not JSON: ${e.message}` }; }
    if (!("expected" in fx)) return { ok: false, why: `eval fixture ${rel} has no \`expected\`` };
    const errs = validateData(doc.output, fx.expected);
    if (errs.length) return { ok: false, why: `eval fixture ${rel} does not satisfy this process's own schema: ${errs[0].path} ${errs[0].what}` };
  }
  return { ok: true };
}

// ---------- secret scrub (REQ-07) ----------
/**
 * Four artifact classes, not one: driver stdout, the driver transcript (stderr), the cost
 * sidecar, and the spine payload. Uses the SPINE'S OWN scanner, imported -- a second copy of
 * the deny-rules would be a copy that drifts from the rules the spine actually enforces.
 */
function scrub(label, text, parsed) {
  if (!text) return;
  let verdict;
  try {
    // Pass the REAL parsed object. Handing scanSecrets a synthetic `{ text }` wrapper meant
    // its structural layer only ever saw one key called "text" -- and that layer exists
    // precisely because no textual rule ever matched `{"password":"..."}`. A short or
    // space-bearing credential value evaded the only layer that was running.
    verdict = scanSecrets(String(text), parsed !== undefined ? parsed : { text: String(text) });
  }
  catch (e) { fail("secret-scan", `secret scan could not run over ${label}: ${e.message}`, { driver }); return; }
  if (verdict.hit) {
    fail("secret", `a secret matching rule \`${verdict.rule}\` appeared in ${label} — the artifact was NOT written and the run is stopped`, { driver, rule: verdict.rule });
  }
}

// ---------- spine ----------
/**
 * The spine's `cost` block is ALL-OR-NOTHING: null, or all four of tokens_in, tokens_out,
 * inr_estimate and source, with inr_estimate a real number (validate.mjs assertCost).
 *
 * That collides head-on with ADR-0069 block (b)(5): no driver returns a rupee figure, and
 * deriving one from a price table nobody maintains would be an estimate wearing a
 * measurement's clothes. Of the three ways out -- fabricate a number, write 0 (which claims
 * the run was free), or decline the block -- only the third is honest.
 *
 * So: a real money figure gets the full cost block. Otherwise `cost` is null and the token
 * counts ride in the PAYLOAD, where they are plainly token counts and are not pretending to
 * be a cost record. Nothing is invented, and nothing measured is thrown away.
 *
 * This is a genuine gap in the spine's schema rather than a shortcoming here, and it is
 * recorded as one: metric 1 of ADR-0069 block (c) ("cost per accepted output") stays
 * uncomputable until the spine can express tokens-without-money.
 */
/**
 * The MP-F seat, its provenance, and the runtime identity — computed in ONE place.
 *
 * It lives in a function because it did not, and that cost a defect an adversarial pass found
 * immediately: the fix went into `emitRun` and NOT into the escalation proposal three hundred
 * lines below, which builds its own `model`/`model_source` from `effectiveModel` alone. One run
 * then produced two receipts disagreeing about which model ran — and the proposal is, by its own
 * comment, "the one receipt a human reads before editing engine/router.yaml", so the disagreeing
 * copy was the one a router diff would have been justified by. Textbook twin-fix miss, both twins
 * in the same file.
 *
 * PRECEDENCE: a routed pin and a `--trial-model` override both beat a runtime-reported model. The
 * report only ever fills a seat that would otherwise be empty, so a driver can never rewrite what
 * routing decided (ADR-0069 b1) — and a runtime row carries no `models:` entry anyway (ADR-0217).
 *
 * `runtime` is a SEPARATE field and is length-bounded here: `cost.model` is held to 128 chars by
 * MODEL_RE while `cost.runtime` was checked only for truthiness, so a driver could push an
 * arbitrarily long string into the payload, cross MAX_EVENT_BYTES and cost the WHOLE receipt to
 * `OVERSIZE` — the same quarantine the model guard exists to prevent, one line below it.
 */
function seatFor(cost) {
  const reportedModel = cost && typeof cost.model === "string" && MODEL_RE.test(cost.model) ? cost.model : null;
  const rawRuntime = cost && typeof cost.runtime === "string" ? cost.runtime.trim() : "";
  return {
    seat: effectiveModel ?? reportedModel,
    seatSource: effectiveModel ? modelSource : (reportedModel ? "runtime" : modelSource),
    // AN ALLOWLIST, SPELLED. Two earlier attempts at this one line were both wrong in ways that
    // do not show in a diff. The first was `!/[ -]/` -- which reads as "no space and no hyphen"
    // and IS the range 0x20-0x2D, so it also rejected !"#$%&'()*+, . The second spelled a control
    // range using LITERAL 0x00 and 0x1f bytes, which made this whole file binary to git and
    // invisible to grep -- the seventh invisible-character defect this cycle, and the second one
    // to land inside the fix for the previous one.
    //
    // So: an explicit positive character set, every character visible, matching the only shape a
    // runtime identity has (`hermes@sha256:<hex>+cfg.<hex>`), bounded because `cost.model` is
    // bounded by MODEL_RE and this field was checked for truthiness alone -- long enough to cross
    // MAX_EVENT_BYTES and cost the whole receipt to OVERSIZE, one line below the guard that
    // exists to prevent exactly that.
    runtimeId: RUNTIME_ID_RE.test(rawRuntime) ? rawRuntime : null,
  };
}

function costArgs(cost) {
  if (!cost) return { flag: null, tokens: null };
  const tokens = {};
  if (Number.isFinite(cost.tokens_in)) tokens.in = cost.tokens_in;
  if (Number.isFinite(cost.tokens_out)) tokens.out = cost.tokens_out;
  if (cost.source) tokens.source = cost.source;
  const inr = Number.isFinite(cost.inr) ? cost.inr : undefined;
  if (inr === undefined) return { flag: null, tokens: Object.keys(tokens).length ? tokens : null };
  return {
    flag: JSON.stringify({
      tokens_in: Number.isFinite(cost.tokens_in) ? cost.tokens_in : 0,
      tokens_out: Number.isFinite(cost.tokens_out) ? cost.tokens_out : 0,
      inr_estimate: inr,
      source: cost.source || "measured",
    }),
    tokens: null,
  };
}

/**
 * THE ONE WAY THIS FILE EMITS. Every spine write in arc-run goes through here.
 *
 * Two defects are closed at this single choke point rather than at three call sites that
 * would drift (the REQ-06 confinement principle, applied to the emit path):
 *
 * 1. THE PAYLOAD IS A FILE, NEVER AN ARGV STRING. `--payload-file` is read with
 *    `readJsonFile` (arc-event.mjs:118) and takes precedence over `--payload`. Passing the
 *    JSON inline instead sends it through a bash argv hop, where a Windows path inside the
 *    payload comes back as `REJECT BAD_JSON -- invalid escape \U`. The consequence is not a
 *    lost field -- it is that the ONLY receipt the run can write is one reporting its own
 *    failure. Found by the bench lane on its own emit path, fixed there, and left standing
 *    here in all three places: the twin-fix shape this repo keeps re-learning.
 *
 * 2. `--strict` MAKES A REJECTED RECEIPT A FAILED EMIT. Without it the emitter runs in hook
 *    mode, where anything invalid is quarantined, a SKIP goes to stderr, and the exit code
 *    is ALWAYS 0 (arc-event.mjs:4-6). With it, the same input exits 2 and we find out.
 *    arc-run was one of only two lanes still missing this -- `hq/arc-jobs.mjs`,
 *    `hq/lib/policy/incident.mjs` and `hq/arc-inbox.mjs` all already pass it.
 *
 * Never throws, and that is a CONTRACT rather than a hope: `invoke`'s policy arm calls this
 * before `return { code: 77 }`, so an escape here would skip the fail-closed denial code and
 * turn a refusal into a stack trace. `mkdtempSync` therefore sits INSIDE the try -- it was
 * outside, where a bad TMPDIR inverted exactly that contract.
 */
function emitEvent(kind, payloadObj, extraArgs = []) {
  let dir = "";
  try {
    dir = mkdtempSync(join(tmpdir(), "arc-run-emit-"));
    const file = join(dir, "payload.json");
    writeFileSync(file, JSON.stringify(payloadObj), "utf8");
    const id = execFileSync("bash",
      [join(root, ".claude/scripts/hq/arc-event.sh"), "emit", kind,
        "--payload-file", file, "--strict", ...extraArgs],
      // ARC_MODEL IS BLANKED, AND THAT CLOSES THE LAST AMBIENT PATH TO THE MODEL SEAT.
      // `arc-event.mjs:208` reads `model: flags.model ?? (process.env.ARC_MODEL || null)`, and
      // this call previously inherited the whole environment -- so an ambient ARC_MODEL wrote an
      // arbitrary model onto an append-only receipt while `model_source` vouched that nothing had
      // pinned it. Blanking rather than deleting: the `|| null` on the emitter side turns "" into
      // an absent seat, which is the honest value when arc-run passed no --model.
      { encoding: "utf8", cwd: root, timeout: EMIT_TIMEOUT_MS, killSignal: "SIGKILL",
        env: { ...process.env, ARC_MODEL: "" } }).trim();
    return { ok: true, id, error: "" };
  } catch (e) {
    return { ok: false, id: "", error: String(e.message).split("\n")[0] };
  } finally {
    // A throw from `finally` REPLACES the return value above, so a Windows EBUSY/EPERM on a
    // transient handle would discard a receipt that was already sealed. `force` only swallows
    // ENOENT. A stale temp dir is never worth losing a sealed receipt over.
    if (dir) {
      try { rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); }
      catch { /* deliberately ignored -- see above */ }
    }
  }
}


function emitRun(payload) {
  const { cost, ...rest } = payload;
  const { flag, tokens } = costArgs(cost);
  const extra = ["--process", `${doc.name}@${doc.version}`,
    "--outcome", payload.outcome === "ok" ? "ok" : "fail"];
  if (flag) extra.push("--cost", flag);
  // The receipt records the model that was ACTUALLY used, never the tier label. A label
  // here asserted a routing decision nothing had applied -- a false claim in an append-only
  // ledger, which is worse than an absent one (ADR-0069 b5 / Constitution E3).
  //
  // `--model` is the MP-F seat and stays a CLEAN MODEL ID -- the thing that actually ran. It is
  // deliberately not prefixed with `trial:`: the seat answers "which model", and encoding a
  // second fact into it would make every reader parse a string to get either one, which is how
  // `tier:X` came to assert a routing decision nothing had applied. Where the value came from is
  // a separate question and gets a separate field, `model_source`, set in emitRun's caller.
  // A RUNTIME REPORTS THE MODEL IT USED, AND THAT IS A FOURTH SOURCE (ADR-0221). An agent
  // runtime picks its own model inside a process arc does not observe, so the seat looked
  // permanently unanswerable and every hermes receipt carried `unpinned`. It is answerable:
  // the runtime writes it into the usage report, the driver puts it in the cost sidecar, and
  // it arrives here as a MEASUREMENT rather than a claim.
  //
  // PRECEDENCE, AND IT ONLY EVER FILLS A HOLE: a routed pin and a trial override both win.
  // Overriding a pin with the driver's word would let a driver rewrite what routing decided,
  // which is the shape ADR-0069 b1 exists to forbid -- and a runtime row carries no `models:`
  // entry anyway (ADR-0217), so in production this branch runs exactly when nothing else can.
  //
  // `runtime` is a SEPARATE field, never folded into the seat: `hermes@sha256:...+cfg....` is
  // provenance, the seat is a model id, and one string carrying both is how `tier:X` came to
  // assert a routing decision nothing had applied.
  const { seat, seatSource, runtimeId } = seatFor(cost);

  if (seat) extra.push("--model", seat);
  else if (tier) extra.push("--model", "unpinned");

  // `model_source` is derived state and is stamped HERE, after ...rest, so it lands on EVERY
  // run.completed -- the failure paths through `fail()` as much as the success path. A provenance
  // field that only appears on green runs cannot answer "what was this model doing when it failed",
  // which for a bench comparison is the more interesting half.
  // `...rest` may carry a `model` the caller computed from `effectiveModel` alone, which is
  // stale the moment a runtime reports one. It is overwritten AFTER the spread, for the same
  // reason `model_source` is: derived state is stamped in one place or it disagrees with itself.
  const r = emitEvent("run.completed", {
    process: processName,
    ...rest,
    ...(tokens ? { tokens } : {}),
    ...(seat ? { model: seat } : {}),
    ...(runtimeId ? { runtime: runtimeId } : {}),
    model_source: seatSource,
  }, extra);
  if (!r.ok) {
    console.error(`arc-run: could not emit run.completed: ${r.error}`);
    console.error("         The run is NOT recorded. Under --strict the emitter rejects rather than quarantining.");
    return;
  }
  // Exit 0 from a fire-and-forget writer is not evidence that anything was written
  // (retro-log 2026-08-02: an emitter reported success while every receipt was quarantined).
  // LOOK in both places and say where it actually landed. --strict catches a REJECTED event;
  // this catches an ACCEPTED one that still did not reach today's log.
  //
  // ITS VERDICT IS DELIBERATELY NOT WIRED TO THE EXIT CODE YET, and that is the whole reason
  // this landed as two changes instead of one. An adversarial pass found `verifyLanded` carries
  // three independent defects -- it derives the day in UTC while the spine names its file from
  // an IST timestamp (wrong file for 22.9% of the clock), it re-derives the spine root by a
  // different rule than the emitter uses, and its quarantine scan interpolates into a `bash -c`
  // string. All three were survivable while this was a warning. None is survivable as a gate:
  // wiring them to the exit code turned every one into a red build on a correct run, which is
  // the "verifier that cries wolf" failure the comment below already warns about. The gate lands
  // once the verifier is trustworthy, in the PR that repairs it.
  verifyLanded(r.id);
}

/** Returns TRUE only if the receipt is provably in today's log. The boolean is the point:
 *  a verifier whose answer nobody reads is a verifier that cannot fail the run. */
function verifyLanded(id) {
  if (!id) {
    // An empty id means the emitter did NOT seal an event -- in hook mode it exits 0 and
    // quarantines, printing only to stderr. Returning quietly here is how "the receipt was
    // written" becomes an assumption; retro-log 2026-08-02 is exactly this failure.
    console.error("arc-run: WARN the emitter returned no event id — the receipt was NOT sealed (check events/_quarantine/)");
    return false;
  }
  // The emitter resolves ARC_SPINE_ROOT first (spine-io.mjs); hardcoding the repo path made
  // every isolated run print a false "NOT in events/" alarm while the receipt sat sealed and
  // correct elsewhere. A verifier that cries wolf on every green run is a verifier people mute.
  const spineRoot = process.env.ARC_SPINE_ROOT || join(root, ".claude/state/hq");
  const eventsDir = join(spineRoot, "events");
  const quarantine = join(eventsDir, "_quarantine");

  // NO DAY IS DERIVED HERE, AND THAT IS THE FIX RATHER THAN A SIMPLIFICATION.
  //
  // This asked `new Date().toISOString()` for the day -- UTC -- while the spine names its file
  // from an IST timestamp (`canonical.mjs` IST_OFFSET_MIN -> `spine-io.mjs` day = event.ts.slice(0,10)).
  // IST is never behind UTC, so from 18:30 UTC the two disagree by one day and this looked in a
  // file that does not exist yet. It cried wolf for 22.9% of every day.
  //
  // That was survivable while nobody read it. It stopped being survivable the moment the WARN
  // below reached a CONSUMER: `arc-bench.mjs:701` takes the LAST line of arc-run's stderr as the
  // failure reason (`.pop()`), so this false alarm displaced the real one and turned 20 bench-core
  // assertions red on main -- green at 17:14 UTC, red at 20:25 UTC, same commit.
  //
  // Re-deriving the day in a SECOND place is the defect; porting the IST arithmetic here would
  // keep two implementations that can drift, which is this repo's recorded "validate one read,
  // compare another" shape. So the question "did it land?" is answered by looking for the id in
  // the event log, whichever day file holds it -- which is what the question actually means, and
  // is immune to midnight, timezone and clock skew alike.
  const landedIn = (dir) => {
    let names = [];
    try { names = readdirSync(dir).filter((n) => n.endsWith(".jsonl")); } catch { return ""; }
    for (const n of names) {
      try { if (readFileSync(join(dir, n), "utf8").includes(id)) return n; } catch { /* unreadable file is not a match */ }
    }
    return "";
  };

  if (landedIn(eventsDir)) return true;

  // The quarantine scan was a `bash -c` STRING interpolating a path. `JSON.stringify` is not shell
  // quoting: it leaves `$` and backticks alone and bash expands both inside double quotes, so a
  // path component was executed rather than searched (a real `C:\$Recycle.Bin` shape). It is now
  // the same plain directory read as above -- no shell, nothing to quote, and one code path
  // instead of two that answer the same question differently.
  const q = landedIn(quarantine);
  console.error(`arc-run: WARN receipt ${id} is NOT in events/${q ? ` — it is QUARANTINED at ${join("_quarantine", q)}` : " and not in _quarantine/ either"}`);
  return false;
}

// ---------- the run ----------
/**
 * THE POLICY GATE (REQ-02, ADR-0500..0507). It sits at the top of `invoke` because that is the
 * single place a driver is ever started -- one call site, so there is no second path to find.
 *
 * FAIL-CLOSED: a policy check that THROWS blocks the run (ADR-0028's fail-safe precedent). The
 * catch below denies rather than proceeding, because "the check broke, so we ran it anyway" is
 * the whole failure class this build exists to remove.
 *
 * No policy logic lives here -- every decision is the shared library's (POL-D).
 */
let policyNotInForceAnnounced = false;
function policyGate(name) {
  try {
    const gate = authorizeRun({ processName, doc, root });
    if (!gate.inForce) {
      // LOUD, once per run. A disarmed guard must never be silent -- the same contract
      // PreToolUse.sh keeps when its dispatcher is missing.
      if (!policyNotInForceAnnounced) {
        policyNotInForceAnnounced = true;
        console.error(`arc-run: NOTICE ${gate.reason} — this run is unpoliced`);
      }
      return null;
    }
    if (gate.mayInvoke) return null;
    return { gate, reason: gate.denials.map((d) => d.reason).join("; ") };
  } catch (e) {
    return { gate: null, reason: `the policy check threw (${String(e.message).split("\n")[0]}) -- fail-closed` };
  }
}

function invoke(name) {
  const sh = join(root, ".claude/scripts/engine/drivers", `${name}.sh`);
  if (!existsSync(sh)) return { code: 1, stdout: "", stderr: `driver ${name} not installed at ${sh}`, cost: null };

  const blocked = policyGate(name);
  if (blocked) {
    // NO SIDE EFFECT: the driver process never starts, and the denial is a receipt.
    //
    // IT IS NOT YET A DEMOTION, and the comment that used to sit here said otherwise -- that the
    // cap "is recomputed on the NEXT authorization inside this same run, so a demotion lands
    // mid-run". The reducer would indeed fold one; nothing emits one. `buildDemotion` exists in
    // the policy library and has no caller.
    //
    // Wiring it HERE would also be theatre: this gate only ever denies at L0 (authorizeRun pushes
    // a denial exactly when effective === "L0"), and `buildDemotion` correctly returns null when
    // there is nothing left to take. A call that can never fire looks like the criterion is met.
    // The level a denial can actually cost is one taken at the ACTION boundary, where a pair
    // still holding L2/L3 is refused for a resource or invariant reason -- and putting spine
    // writes in the blocking PreToolUse path is a decision with real latency and failure-mode
    // consequences, not an implementation detail. Tracked as the open half of phase 02.
    const detail = `policy denied ${processName}: ${blocked.reason}`;
    console.error(`arc-run: ${detail}`);
    const inc = emitEvent("incident.raised",
      { what: detail, severity: "high", source: "arc-run policy gate" },
      ["--process", `${doc.name}@${doc.version}`, "--outcome", "fail"]);
    if (!inc.ok) {
      // A receipt we could not write is reported, never swallowed -- but it does not un-deny
      // the action. Quarantine is not enforcement success (ADR-0106/0032). The denial still
      // returns 77 below: an unrecorded denial is still a denial, and downgrading enforcement
      // because the paperwork failed would invert the fail-closed contract this gate exists for.
      console.error(`arc-run: WARN could not emit incident.raised: ${inc.error}`);
      console.error("         The DENIAL STANDS and is unaffected; only its receipt is missing.");
    } else {
      // The twin-fix, at the site built to prevent twin-fixes. This arm had the flags unified
      // with the other two and the POLICY left behind: `--strict` only catches a REJECTED
      // event, so a denial receipt that was ACCEPTED and then quarantined landed nowhere with
      // nothing anywhere reporting it -- silent, which is the one thing an enforcement receipt
      // must never be.
      verifyLanded(inc.id);
    }
    return { code: 77, stdout: "", stderr: detail, cost: null, policyDenied: true };
  }
  const tmp = mkdtempSync(join(tmpdir(), "arc-run-"));
  const costFile = join(tmp, "cost.json");
  const rem = msRemaining();
  // Math.floor: a float `min` produced a non-integer timeout and spawnSync threw a raw
  // RangeError before any scrub or receipt could run.
  const timeoutMs = rem === undefined ? undefined : Math.max(1, Math.floor(rem));
  const res = spawnSync("bash", [sh, "run", processName, JSON.stringify(input), budgetStr], {
    // cwd follows workRoot, not root: a driver that shells out to git must land in the repo it
    // was pointed at. The driver SCRIPT path is already absolute (resolved from root above), so
    // moving cwd cannot make arc-run fail to find its own machinery.
    encoding: "utf8", cwd: workRoot, timeout: timeoutMs,
    // arc-run defaulted to Node's 1 MiB while claude-code.mjs deliberately sets 64 MiB for
    // the CLI it wraps -- so a large but perfectly valid answer was truncated and then
    // blamed on the driver.
    maxBuffer: 64 * 1024 * 1024,
    killSignal: "SIGKILL",
    // ARC_ROOT STAYS ARC. The first version of this seam set it to workRoot, and that was wrong
    // in a way no test caught: `claude-code.mjs:25` and `codex.mjs:21` do
    // `join(process.env.ARC_ROOT, "processes", name + ".process.yaml")`, so repointing it made the
    // DRIVER read its process document -- the prompt body AND the `tools:` list that becomes
    // `--allowedTools` -- out of the target tree, while arc-run's job-stub guard, self-consistency
    // check and policy gate all judged arc's copy. A target tree could widen its own grant. It
    // also broke both real drivers outright, since a fixture repo has no processes/ directory.
    //
    // The conflation this seam exists to split lived in arc-run AND, on the same variable, one
    // layer down in the drivers. Splitting only the near copy moved the bug rather than fixing it.
    // So the workspace travels as `cwd` plus its own name, and ARC_ROOT keeps meaning exactly what
    // every driver already assumes it means.
    //
    // The two overwrites remain unconditional and that is still the point: both values are decided
    // by arc-run from explicit inputs, never inherited. ARC_LLM_MODEL is blanked for the same
    // reason -- engine/router.yaml names it verbatim as "the un-reviewed tier change ADR-0069
    // block (b)(1) forbids", and `generic-api.mjs:22` falls back to it, so leaving it in the
    // spread would have left b1 open through the one door the seam did not close.
    env: {
      ...process.env,
      ARC_DRIVER_COST_FILE: costFile,
      ARC_ROOT: root,
      ARC_WORK_ROOT: workRoot,
      ARC_DRIVER_MODEL: effectiveModel ?? "",
      ARC_LLM_MODEL: "",
      // The RUN's deadline, as an ABSOLUTE epoch millisecond, so a driver that must impose its
      // own timeout on a subprocess cannot accidentally start a fresh budget. `budgetStr` is
      // the ORIGINAL allowance and is passed unchanged for reporting; a driver reading `min`
      // from it and using it as a timeout would hand every driver in the fallback chain a full
      // budget again -- the defect this file already records at the timeout arm below. An
      // absolute instant has the time already burned subtracted, and cannot be un-subtracted.
      //
      // Absent (no `min` bound) means NO deadline, not a zero one: an unbounded run must not be
      // declined by a driver reading an empty string as 0.
      //
      // SET TO undefined, NOT OMITTED — the same reason ARC_LLM_MODEL above is blanked rather
      // than left out. `...process.env` is spread first, so a key that is only ever ADDED can
      // never clear one the caller already has, and a stale ARC_DRIVER_DEADLINE_EPOCH_MS in the
      // ambient environment made every UNBUDGETED run decline before any driver started,
      // reported as `budget`. Node drops an env key whose value is undefined, so this both sets
      // and clears.
      ARC_DRIVER_DEADLINE_EPOCH_MS: timeoutMs === undefined ? undefined : String(Date.now() + timeoutMs),
    },
  });
  let cost = null;
  if (existsSync(costFile)) {
    try { cost = JSON.parse(readFileSync(costFile, "utf8")); } catch { cost = null; }
  }
  rmSync(tmp, { recursive: true, force: true });
  const timedOut = res.error && res.error.code === "ETIMEDOUT";
  // ARC-RUN'S OWN CEILING IS NOT A DRIVER FAULT. Only ETIMEDOUT was ever inspected, so a
  // maxBuffer overflow -- which arrives as `status: null, signal: SIGKILL, error.code: ENOBUFS`
  // -- fell through `res.status ?? 1` to a plain 1 and was reported as `verdict: driver`. The
  // fallback chain then re-ran every remaining driver, spending real budget on each, and the
  // receipt said the driver had exited 1 while never mentioning the buffer. It is OUR limit that
  // stopped the run, and the receipt has to say so.
  const overflowed = res.error && res.error.code === "ENOBUFS";
  return {
    code: timedOut ? 124 : overflowed ? 125 : (res.status ?? 1),
    stdout: res.stdout ?? "", stderr: res.stderr ?? "", cost, timedOut, overflowed,
  };
}

function attempt(name) {
  attemptsMade += 1;
  const r = invoke(name);
  if (r.cost && Number.isFinite(r.cost.inr)) inrSpent += r.cost.inr;
  scrub(`the ${name} driver's stdout`, r.stdout);
  scrub(`the ${name} driver's transcript`, r.stderr);
  if (r.cost) scrub(`the ${name} driver's cost sidecar`, JSON.stringify(r.cost), r.cost);

  // A timeout is the BUDGET being spent, not the driver misbehaving. Classifying it as a
  // driver fault made budget exhaustion trigger the fallback chain -- which then spent the
  // budget again, per driver -- and made the receipt read `reason: driver`, so the promise
  // that an over-budget run "reports a budget outcome" was false.
  if (r.timedOut) return { ...r, verdict: "budget", why: `exceeded the ${budget.min}-minute budget for the RUN` };
  // Same reasoning one line down: our own output ceiling is arc-run's limit, not the driver's
  // misbehaviour, and falling back to another driver cannot help — the next one produces the
  // same volume and hits the same wall, having spent the budget to get there.
  if (r.overflowed) return { ...r, verdict: "harness", why: `the driver produced more output than arc-run's ${64 * 1024 * 1024}-byte ceiling` };
  if (r.code === 2) return { ...r, verdict: "budget", why: r.stderr.trim() || "driver declined for budget" };
  // POLICY BEFORE DRIVER, and for exactly the reason the budget arm above exists. A denial fell
  // through to `verdict: "driver"`, so ONE denial produced three high-severity incidents as the
  // fallback chain retried, and the append-only receipt claimed the driver had failed when no
  // driver had run at all. A false claim in a ledger is worse than an absent one (ADR-0069 b5 /
  // Constitution E3), and no other driver is going to be more permitted than the first.
  if (r.policyDenied) return { ...r, verdict: "policy", why: r.stderr.trim() || "denied by policy" };
  if (r.code !== 0) return { ...r, verdict: "driver", why: r.stderr.trim() || `driver exited ${r.code}` };

  let output;
  try { output = JSON.parse(r.stdout); }
  catch (e) { return { ...r, verdict: "schema", why: `driver stdout is not JSON: ${e.message}` }; }

  const errs = validateData(doc.output, output);
  if (errs.length) return { ...r, verdict: "schema", why: `${errs[0].path}: ${errs[0].what}`, output };
  return { ...r, verdict: "ok", output };
}

if (dryRun) {
  // --dry-run is the one surface whose entire job is "tell me what will happen", so it names the
  // two flags that change what happens. It was silent about both, which made it the worst place
  // to check a command before running it for real.
  console.log(`arc-run: would run \`${processName}\` on \`${driver}\`${tier ? ` (tier ${tier})` : ""}${fallbacks.length ? ` fallback ${fallbacks.join(" -> ")}` : ""}`);
  console.log(`         model ${effectiveModel ?? "unpinned"} (source: ${modelSource})`);
  console.log(`         driver workspace ${workRoot}${workRoot === root ? " (this repo -- no --work-root given)" : ""}`);
  process.exit(0);
}

// H2: the SEND path. All four scanned classes were on the RETURN path, so the one direction
// that actually exfiltrates -- arc to a third-party endpoint -- had no scan at all. A secret
// in --input (or in an @file that resolves outside the repo) was transmitted to the vendor
// and the run then reported success.
if (inputArg) scrub("--input (before anything is sent to a driver)", JSON.stringify(input), input);

// THE DATA BOUNDARY, refused HERE and not inside the driver (ADR-0219, Phase 06 REQ-02 fixtures
// 2 and 3). By the time a driver could refuse, the document has already been handed to it. This
// sits after the dry-run exit -- a dry run spawns nothing, so there is nothing to confine -- and
// before `attempt()`, which is the last line at which no driver process exists yet.
//
// Exit 5, its own code: arc-run already overloads 1 for "cannot proceed", and a boundary refusal
// indistinguishable from a parse error is a boundary no fixture can assert.
const refusal = boundaryRefusal({ input, processName, hosted });
if (refusal) {
  console.error(`arc-run: ${refusal.reason}`);
  for (const m of refusal.markers) console.error(`arc-run:   ${m.path} ${m.why}`);
  // The refusal is a receipt, not just an exit code -- a boundary that stops a run and leaves no
  // trace is indistinguishable from a run nobody attempted.
  emitRun({ outcome: "fail", reason: "policy", driver, attempts: 0 });
  process.exit(refusal.code);
}

const selfCheck = processIsSelfConsistent();
let a = attempt(driver);

// Driver-fault fallback: try the next driver in the chain. NOT for a schema fault -- falling
// back on a broken schema just fails three times instead of once, slower.
// C3: the money bound is enforced AFTER each attempt, because no driver reports spend in
// advance. Previously `inr` was read only by the <=0 pre-check and then handed to drivers
// that discard it -- so `inr=1` and `inr=100000` were the same run.
const overBudget = () => "inr" in budget && inrSpent > budget.inr;
if (overBudget()) {
  console.error(`arc-run: spent ${inrSpent} against an inr budget of ${budget.inr} — stopping, and NOT falling back`);
  emitRun({ outcome: "fail", reason: "budget", driver, attempts: attemptsMade, cost: a.cost ?? undefined });
  process.exit(1);
}

while (a.verdict === "driver" && !overBudget() && msRemaining() !== 0 && fallbacks.length) {
  const next = fallbacks.shift();
  console.error(`arc-run: ${driver} reported a driver fault (${a.why}); falling back to ${next}`);
  driver = next;
  // THE PIN IS PER-DRIVER, SO IT IS RECOMPUTED PER HOP. It was resolved once from the ORIGINAL
  // driver and never revisited, so a fallback was spawned with the previous driver's model --
  // a Claude id handed to the Codex driver -- and the receipt then asserted
  // `driver: codex, model: sonnet, model_source: router`. engine/router.yaml says in as many
  // words that codex and generic-api have no entry on purpose and "run unpinned and say so";
  // the provenance field turned that into an explicit claim of the opposite. Every scheduled job
  // takes this path (lib/jobs/delegate.mjs hardcodes --driver auto), so it is the common case
  // rather than an edge one.
  if (tier) {
    const router = loadRouter();
    pinnedModel = router?.models?.[tier]?.[driver] ?? null;
    effectiveModel = trialModel || pinnedModel;
    modelSource = pinnedModel ? "router" : "none";
  }
  a = attempt(driver);
}

// A policy denial is its own outcome and its own exit. It never reaches the fallback loop above
// (that loop only runs on `verdict === "driver"`), because no other driver is going to be more
// permitted than the first -- retrying would just raise the same incident again, which is what
// it did before this arm existed.
if (a.verdict === "policy") {
  console.error(`arc-run: ${a.why}`);
  emitRun({ outcome: "fail", reason: "policy", driver, attempts: attemptsMade, cost: a.cost ?? undefined });
  process.exit(1);
}

if (a.verdict === "budget") {
  console.error(`arc-run: ${a.why}`);
  emitRun({ outcome: "fail", reason: "budget", driver, cost: a.cost ?? undefined });
  process.exit(1);
}

if (a.verdict === "schema") {
  // ADR-0204's ladder, rung 1: retry ONCE on the same tier.
  console.error(`arc-run: output failed the contract (${a.why}); retrying once on the same tier`);
  const retry = attempt(driver);
  if (retry.verdict === "ok") {
    // Goes through the SAME path as a first-attempt success. Printing and emitting inline
    // here is how the payload scrub got skipped on one of the two success paths -- a secret
    // that only appears after JSON.parse (a \u-escaped key, invisible to a raw-text scan)
    // reached stdout with exit 0.
    succeed(retry);
  }
  // Rung 2: a PROPOSAL receipt, and then stop. No tier is changed here or anywhere.
  const faultHint = selfCheck.ok ? "driver" : "process";
  // THE SAME SEAT THE RECEIPT WILL CARRY, computed by the same function. This is the twin that was
  // missed once and then missed AGAIN: `seatFor()` was written specifically to close it, with a
  // comment saying so, and was still called from `emitRun` alone -- so the helper existed, the
  // comment claimed the fix, and this receipt went on disagreeing with the one three lines below.
  // A comment asserting what the code does not do, inside the fix for a comment asserting what the
  // code does not do.
  const proposalSeat = seatFor(retry.cost);
  const proposal = {
    what: `escalate \`${processName}\` to a stronger tier`,
    gate: "engine-escalation",
    process: processName,
    driver,
    tier: tier ?? "(unrouted)",
    // THE PROPOSAL CARRIES ITS OWN PROVENANCE. This is the one receipt a human reads before
    // editing engine/router.yaml, and without these two fields a failed --trial-model run read as
    // "escalate X to a stronger tier" with nothing saying a caller-named trial produced the
    // evidence. Acting on it would mean a reviewed router diff justified by a model the router
    // never selected -- a trial laundered into a production tier change through the very ladder
    // ADR-0204 built to stop exactly that.
    model: proposalSeat.seat ?? "unpinned",
    model_source: proposalSeat.seatSource,
    ...(proposalSeat.runtimeId ? { runtime: proposalSeat.runtimeId } : {}),
    fault_hint: faultHint,
    why: faultHint === "process"
      ? `the process is not self-consistent: ${selfCheck.why} — no driver is being blamed`
      : `retried once on the same tier and the output still failed the contract: ${retry.why}`,
  };
  // The identity flags were MISSING here while the other two call sites carried them, so a
  // rung-2 proposal was attributed to `arc-event@1.0.0` (the emitter's own fallback) instead of
  // the process it proposes escalating, and inherited the default `outcome: ok` for a run that
  // STOPPED. A receipt that misreports whose decision it is, is the append-only-ledger version
  // of the false claim this file refuses to make about models.
  const prop = emitEvent("approval.requested", proposal,
    ["--process", `${doc.name}@${doc.version}`, "--outcome", "fail"]);
  const id = prop.ok ? prop.id : "";
  if (!prop.ok) {
    // The ladder TERMINATES here either way (ADR-0204): a proposal that could not be written
    // must never fall through to an escalation, because the receipt IS the proposal.
    console.error(`arc-run: WARN could not emit the escalation proposal: ${prop.error}`);
  } else {
    verifyLanded(id);
  }

  console.error(`arc-run: STOPPED. A tier-change PROPOSAL was recorded${id ? ` as ${id}` : ""}; nothing was escalated.`);
  console.error("         Acting on it means editing engine/router.yaml in a reviewed diff citing ADR-0069.");
  emitRun({ outcome: "fail", reason: "schema", driver, attempts: 2, fault_hint: faultHint, proposal: id || undefined, cost: retry.cost ?? undefined });
  process.exit(1);
}

if (a.verdict !== "ok") {
  fail("driver", a.why, { driver, fault_hint: "driver", cost: a.cost ?? undefined });
}

succeed(a);

/** The ONE way a run succeeds. Scrub, then print, then emit -- in that order, once. */
function succeed(r) {
  const payload = JSON.stringify(r.output);
  scrub("the spine payload", payload, r.output);
  console.log(payload);
  emitRun({ outcome: "ok", driver, attempts: attemptsMade, cost: r.cost ?? undefined, fault_hint: "unknown", model: effectiveModel ?? "unpinned" });
  // STILL EXIT 0 ON AN UNRECORDED RECEIPT -- for now, and on purpose.
  //
  // Failing the run here is the obvious other half of "exit 0 is not evidence". It WAS written,
  // then attacked, then backed out rather than shipped, for two measured reasons:
  //
  // 1. `verifyLanded` is not yet trustworthy enough to fail a build on -- see emitRun above.
  //    A gate is only as good as the check behind it, and that check is currently wrong for
  //    22.9% of the clock.
  // 2. ADR-0219 publishes arc-run's exit table: `0` means "produced an accepted answer" and
  //    every enumerated cause of `1` is PRE-dispatch. Returning 1 on a good answer changes what
  //    a published code MEANS, which is an ADR amendment rather than a side effect of a bug
  //    fix. `arc-bench.mjs:699` is a live consumer that treats non-zero as failure: it never
  //    parses stdout and records `measuredInr: null`, so a run that spent real money would be
  //    logged as having spent none.
  //
  // Both are fixable; neither is fixable in a payload-encoding fix. The gate is owed and tracked.
  process.exit(0);
}
