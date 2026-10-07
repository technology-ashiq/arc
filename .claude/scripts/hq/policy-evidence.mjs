#!/usr/bin/env node
// policy-evidence -- is each configured policy level an EVIDENCED one? (POL-L, ADR-0509..0511)
//
//   policy-evidence.mjs report [--as-of YYYY-MM-DD] [--json]   every cell, its evidence and its state
//   policy-evidence.mjs check  [--as-of YYYY-MM-DD]            exit 0 clean · 3 BELOW-BAR · 2 refused/usage
//   policy-evidence.mjs guard  [--as-of YYYY-MM-DD]            the monthly guard (ADR-0511): receipts, exit 0 / 3 / 1
//
// BELOW-BAR is a class that fails for INSUFFICIENCY (ADR-0049's lesson): a pair at effective L1+ on
// spend/publish/deploy/network/shell whose refusal path has no fresh typed receipt. It never changes a level and
// never denies an action -- promotion stays a human `policy.level.changed` (ADR-0508). It is a reported state.
//
// The as-of day is resolved ONCE, here, from IST today when not given. The fold never reads a clock.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { foldEvidence, istDay, isCalendarDay, GUARD_PROCESS } from "./lib/policy-evidence/fold.mjs";
import { loadEvidenceInputs, readDayFile } from "./lib/policy-evidence/load.mjs";
import { formatIst, nowMs, sha256Hex } from "./lib/canonical.mjs";

const USAGE = "usage: policy-evidence.mjs report [--as-of YYYY-MM-DD] [--json] | check [--as-of YYYY-MM-DD] | guard [--as-of YYYY-MM-DD]";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(code, msg) {
  process.stderr.write(`policy-evidence: ${msg}\n`);
  process.exitCode = code;
}

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const out = { cmd, asOf: null, json: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") out.json = true;
    else if (a === "--as-of") {
      if (out.asOf !== null) return { error: "--as-of given twice" };
      const v = rest[++i];
      if (typeof v !== "string" || !DAY_RE.test(v) || !isCalendarDay(v)) return { error: `--as-of needs a real YYYY-MM-DD day, got ${JSON.stringify(v)}` };
      out.asOf = v;
    } else return { error: `unknown argument ${JSON.stringify(a)}` };
  }
  return out;
}

const cellLine = (c) => {
  const age = c.evidence_age_days === null ? "" : ` age ${c.evidence_age_days}d`;
  const n = c.n === null ? " N=none" : ` N=${c.n}`;
  const flag = c.below_bar ? "BELOW-BAR" : (c.state === "n/a" ? "n/a" : "PASS");
  return `${flag.padEnd(9)} ${c.subject}/${c.capability} ${c.effective} ${c.state}${c.reason && c.reason !== c.state ? ` (${c.reason})` : ""}${age}${n}` +
    ` refusal=${c.last_refusal || "-"} success=${c.last_success || "-"} audit=${c.last_audit || "-"}`;
};

function main(argv) {
  // Attached once, before ANY branch writes: a closed pipe must never turn a verdict into exit 1 (attack r1 B5, r2 B7).
  process.stdout.on("error", () => {});
  const args = parseArgs(argv);
  if (args.error) return fail(2, `${args.error}\n${USAGE}`);
  if (args.cmd !== "report" && args.cmd !== "check" && args.cmd !== "guard") return fail(2, `unknown subcommand ${JSON.stringify(args.cmd)}\n${USAGE}`);
  if (args.json && args.cmd !== "report") return fail(2, `--json belongs to report\n${USAGE}`);

  let inputs;
  try { inputs = loadEvidenceInputs(); } catch (e) {
    return fail(2, `the policy or spine could not be read: ${String(e && e.message).split("\n")[0]}`);
  }
  if (!inputs) return fail(2, "no hq.policy.yaml at the governing root -- there is no configured level to evidence");

  const today = istDay(formatIst(nowMs()));
  const asOf = args.asOf ?? today;
  let r;
  try { r = foldEvidence({ policy: inputs.policy, transitions: inputs.transitions, events: inputs.events, asOf }); }
  catch (e) { return fail(2, `the evidence fold refused: ${String(e && e.message).split("\n")[0]}`); }

  if (args.cmd === "report" && args.json) {
    process.stdout.write(JSON.stringify({ ...r, rejected_lines: inputs.rejected, day_files: inputs.dayFiles, events_dir: inputs.eventsDir }, null, 2) + "\n");
    return;
  }
  // ANY explicit --as-of is an override, even one naming today: the operator chose the clock (attack p01 r2 L7).
  if (args.cmd === "guard") return guard(inputs, r, args.asOf !== null);
  // The verdict is set BEFORE any output: a reader that closes the pipe early must not turn exit 3 into exit 1.
  if (args.cmd === "check" && r.below_bar > 0) process.exitCode = 3;
  const shown = args.cmd === "check" ? r.cells.filter((c) => c.below_bar) : r.cells;
  for (const c of shown) process.stdout.write(cellLine(c) + "\n");
  // The positive marker: printed only when the fold ran to the end, so an assertion of absence above never stands
  // alone (.claude/rules/testing.md, the vacuous pass).
  process.stdout.write(`policy-evidence: as-of ${r.as_of} -- ${r.subjects} subjects, ${r.cells.length} cells, ` +
    `${r.in_scope} in scope, ${r.below_bar} BELOW-BAR, ${inputs.rejected} spine line(s) rejected, ` +
    `${inputs.dayFiles} day file(s) read from ${inputs.eventsDir}\n`);
}

/**
 * The policy evidence guard (ADR-0511, REQ-04): ADR-0910's rule, policy's own instance. Monthly, owner-started, from
 * the main clone (loadEvidenceInputs already refused any other spine).
 *
 *   clean      <=> zero BELOW-BAR cells, computed from the FULL cell list -- invariant (c). Emits ONLY run.completed.
 *   not clean  -> run.completed outcome partial, and ONE approval.requested listing every BELOW-BAR cell split into
 *                 no-writer / clearable -- raised only when that set differs from the previous guard run's, because a
 *                 monthly copy of an unanswerable approval teaches the owner to ignore the inbox. Still not clean.
 *
 * Its run.completed is every cell's `last_audit`. Exit 0 clean · 3 not clean · 1 a receipt could not be sealed.
 */
const GUARD_PROCESS_ID = `${GUARD_PROCESS}@1.0.0`;
const HEX64 = /^[0-9a-f]{64}$/;

function guard(inputs, r, overridden) {
  const all = r.cells;
  const below = all.filter((c) => c.below_bar);
  const clean = all.every((c) => !c.below_bar);
  const label = (c) => `${c.subject}/${c.capability} ${c.state}${c.reason && c.reason !== c.state ? ` (${c.reason})` : ""}` +
    ` refusal=${c.qualifying_refusal || c.last_refusal || "-"}`;
  const noWriter = below.filter((c) => c.state === "unknown").map(label);
  const clearable = below.filter((c) => c.state !== "unknown").map(label);
  const digest = sha256Hex(JSON.stringify(below.map((c) => [c.subject, c.capability, c.state, c.reason]).sort()));

  // The previous verdict is read only from SEALED receipts of THIS guard with a well-formed digest (attack p01 B3), from
  // its run.completed OR its approval -- so an approval that sealed before a failed run.completed still dedupes the
  // retry (p01 B4). A run judged against a back-dated or future --as-of is marked and only ever dedupes against its own
  // kind: it can neither suppress a real approval nor pose as a real audit (p01 B5).
  let previousDigest = null;
  for (const e of inputs.events) {
    if (e.process !== GUARD_PROCESS_ID || !e.payload || !HEX64.test(String(e.payload.digest))) continue;
    if (Boolean(e.payload.as_of_overridden) !== overridden) continue;
    const isRun = e.kind === "run.completed" && (e.outcome === "ok" || e.outcome === "partial");
    const isApproval = e.kind === "approval.requested" && e.payload.gate === "policy-evidence";
    if (isRun || isApproval) previousDigest = e.payload.digest;
  }

  if (!clean) process.exitCode = 3;
  let approval = null;
  // An overridden run never raises an approval: the inbox is the owner's needs-you surface, and a back-dated or test
  // run must not put an unanswerable item there (attack p01 r2 B2). It still seals its marked run.completed.
  if (!clean && !overridden && digest !== previousDigest) {
    approval = emit(inputs, "approval.requested", {
      what: `${below.length} policy cell(s) are BELOW-BAR: their refusal path has no fresh evidence`,
      gate: "policy-evidence", as_of: r.as_of, as_of_overridden: overridden, digest, no_writer: noWriter, clearable,
    }, "fail");
    if (!approval) return;
  }
  const run = emit(inputs, "run.completed", {
    as_of: r.as_of, as_of_overridden: overridden, in_scope: r.in_scope, below_bar: below.length, digest, approval,
  }, clean ? "ok" : "partial");
  if (!run) return;
  for (const l of [...noWriter.map((x) => `no-writer  ${x}`), ...clearable.map((x) => `clearable  ${x}`)]) process.stdout.write(l + "\n");
  process.stdout.write(clean
    ? `policy-evidence guard: CLEAN as-of ${r.as_of} -- ` +
      (r.in_scope === 0 ? "no in-scope cell (nothing above L0 to evidence)" : `${r.in_scope} in-scope cell(s), all fresh`) +
      `${overridden ? " [--as-of override: not an audit]" : ""}; run ${run}\n`
    : `policy-evidence guard: NOT CLEAN as-of ${r.as_of} -- ${below.length} BELOW-BAR (${noWriter.length} no-writer, ` +
      `${clearable.length} clearable); ${approval ? `approval ${approval}` : "same set as the last guard run, no new approval"}; run ${run}\n`);
}

/**
 * Seal one receipt through the one writer, INTO THE SPINE THAT WAS READ (attack p01 L2/B2): the spine selector is pinned
 * to the governing root's spine rather than inherited, and the returned id is read back from that spine's day file.
 * On failure, say so -- with the emitter's own stderr -- and exit 1: a guard receipt that vanished is no guard run.
 */
function emit(inputs, kind, payload, outcome) {
  let dir = "";
  try {
    dir = mkdtempSync(join(tmpdir(), "policy-evidence-"));
    const file = join(dir, "payload.json");
    writeFileSync(file, JSON.stringify(payload), "utf8");
    const id = execFileSync("bash", [join(inputs.root, ".claude", "scripts", "hq", "arc-event.sh"), "emit", kind, "--payload-file", file,
      "--strict", "--process", GUARD_PROCESS_ID, "--outcome", outcome],
    { encoding: "utf8", cwd: inputs.root, timeout: 60000, stdio: ["ignore", "pipe", "pipe"],
      // Both selectors pinned to the tree that was read (attack p01 r2 L9/B1): a receipt sealed under another root's
      // rules or into another spine is the writer/reader twin this lane keeps closing.
      env: { ...process.env, ARC_MODEL: "", ARC_ROOT: inputs.root, ARC_SPINE_ROOT: dirname(inputs.eventsDir) } }).trim().split("\n").pop().trim();
    const day = istDay(formatIst(nowMs()));
    const text = readDayFile(join(inputs.eventsDir, `${day}.jsonl`)) || "";
    // The read-back finds THE event -- this id, this kind, this guard -- not a string that happens to contain the id.
    const landed = text.split("\n").some((l) => {
      if (!l.includes(id)) return false;
      try { const e = JSON.parse(l); return e.id === id && e.kind === kind && e.process === GUARD_PROCESS_ID; } catch { return false; }
    });
    if (!id || !landed) { fail(1, `${kind} ${id || "(no id)"} is not in ${inputs.eventsDir} -- the receipt did not land where it was read from`); return null; }
    return id;
  } catch (e) {
    const err = String((e && e.stderr) || "").trim().split("\n").pop() || String(e && e.message).split("\n")[0];
    // The one environment fault worth naming: from PowerShell, a bare `bash` is WSL's, which cannot see this tree.
    const hint = process.platform === "win32" ? " (start the guard from Git Bash: PowerShell PATH sends `bash` to WSL)" : "";
    fail(1, `could not seal ${kind}: ${err}${hint}`);
    return null;
  } finally {
    if (dir) try { rmSync(dir, { recursive: true, force: true }); } catch { /* a stale temp dir never costs a receipt */ }
  }
}

main(process.argv.slice(2));
