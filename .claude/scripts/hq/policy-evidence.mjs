#!/usr/bin/env node
// policy-evidence -- is each configured policy level an EVIDENCED one? (POL-L, ADR-0509..0511)
//
//   policy-evidence.mjs report [--as-of YYYY-MM-DD] [--json]   every cell, its evidence and its state
//   policy-evidence.mjs check  [--as-of YYYY-MM-DD]            exit 0 clean · 3 BELOW-BAR · 2 refused/usage
//
// BELOW-BAR is a class that fails for INSUFFICIENCY (ADR-0049's lesson): a pair at effective L1+ on
// spend/publish/deploy/network/shell whose refusal path has no fresh typed receipt. It never changes a level and
// never denies an action -- promotion stays a human `policy.level.changed` (ADR-0508). It is a reported state.
//
// The as-of day is resolved ONCE, here, from IST today when not given. The fold never reads a clock.
import { foldEvidence, istDay, isCalendarDay } from "./lib/policy-evidence/fold.mjs";
import { loadEvidenceInputs } from "./lib/policy-evidence/load.mjs";
import { formatIst, nowMs } from "./lib/canonical.mjs";

const USAGE = "usage: policy-evidence.mjs report [--as-of YYYY-MM-DD] [--json] | check [--as-of YYYY-MM-DD]";
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
  if (args.cmd !== "report" && args.cmd !== "check") return fail(2, `unknown subcommand ${JSON.stringify(args.cmd)}\n${USAGE}`);
  if (args.json && args.cmd !== "report") return fail(2, `--json belongs to report\n${USAGE}`);

  let inputs;
  try { inputs = loadEvidenceInputs(); } catch (e) {
    return fail(2, `the policy or spine could not be read: ${String(e && e.message).split("\n")[0]}`);
  }
  if (!inputs) return fail(2, "no hq.policy.yaml at the governing root -- there is no configured level to evidence");

  const asOf = args.asOf ?? istDay(formatIst(nowMs()));
  let r;
  try { r = foldEvidence({ policy: inputs.policy, transitions: inputs.transitions, events: inputs.events, asOf }); }
  catch (e) { return fail(2, `the evidence fold refused: ${String(e && e.message).split("\n")[0]}`); }

  if (args.cmd === "report" && args.json) {
    process.stdout.write(JSON.stringify({ ...r, rejected_lines: inputs.rejected, day_files: inputs.dayFiles, events_dir: inputs.eventsDir }, null, 2) + "\n");
    return;
  }
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

main(process.argv.slice(2));
