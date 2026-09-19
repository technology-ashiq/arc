#!/usr/bin/env node
// propose.mjs -- the engine's routing proposals (face v2 Phase 05 kernel ring, ADR-1340).
//
//   propose.mjs driver --class C --to DRIVER [--why TEXT] [--dry-run | --expect D]   route a class to another driver
//   propose.mjs tier   --class C --to TIER   [--why TEXT] [--dry-run | --expect D]   move a class to another tier (ADR-0069)
//
// engine/router.yaml is hand-edited, forever in v1: "nothing writes to this file at run time, and every change is a
// reviewed diff citing ADR-0069". This tool never writes it. It edits ONE line of the class's block in main's copy of
// the file, re-runs the router's own loader (routerFaults) over the proposed text, has the spine judge the approval it
// would raise, and then:
//
//   --dry-run   prints the diff against main and writes nothing -- no object, no ref, no receipt. Its LAST line is
//               {"expect":"<digest>"}: the digest of the branch, the base and the bytes an apply would write
//   --expect D  commits that one-line change to a NEW branch feat/face-engine-<driver|tier>-<to>-<class> by git plumbing
//               (core/proposal-branch.mjs: no checkout, the owner's tree untouched) -- only if what it would write is
//               still D, and main has not moved since the file was read -- then raises approval.requested naming the
//               branch, and prints `receipt: approval.requested <ULID>`. A human merges it, or does not.
//   (neither)   refused: an apply is bound to a plan, by hand as by the door
//
// Exit: 0 done · 1 the branch IS written and its receipt is not (said so, never retried silently) · 2 refused, nothing
// written.

import { readdirSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "./yaml-subset.mjs";
import { routerFaults } from "./router-row.mjs";
import { planProposal, writeProposal, baseText, ProposalError } from "../core/proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal } from "../core/plan-expect.mjs";
import { isOneLine } from "../core/one-line.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ROUTER = "engine/router.yaml";
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const SLUG_RE = /^[a-z][a-z0-9-]{0,40}$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function die(code, msg) { process.stderr.write(`propose: ${msg}\n`); process.exitCode = code; throw new Stop(); }
class Stop extends Error {}

// Set once writeProposal has returned: from then on a failure is "the branch IS written", never "refused" (exit 1, not
// 2). A cleanup that threw after the write used to exit 1 with a raw stack and no "wrote" line (PR 3a shell attack).
let written = false;

function parseArgs(argv) {
  const [verb, ...rest] = argv;
  if (verb !== "driver" && verb !== "tier") die(2, "usage: propose.mjs driver|tier --class C --to X [--why TEXT] [--dry-run | --expect D]");
  const out = { verb, class: "", to: "", why: "", expect: undefined, dryRun: false };
  const seen = new Set();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--dry-run") { if (out.dryRun) die(2, "--dry-run given twice"); out.dryRun = true; continue; }
    if (a.startsWith("--dry-run=")) die(2, `--dry-run takes no value; write it bare, not ${a}`);
    if (!["--class", "--to", "--why", "--expect"].includes(a)) die(2, `unknown argument ${JSON.stringify(a)} -- known: --class --to --why --expect --dry-run`);
    if (seen.has(a)) die(2, `${a} given twice; pick one`);
    seen.add(a);
    const v = rest[i + 1];
    if (v === undefined || v === "" || v.startsWith("-")) die(2, `${a} needs a value`);
    out[a.slice(2)] = v;
    i++;
  }
  if (out.dryRun && out.expect !== undefined) die(2, "--dry-run plans and --expect applies; give one");
  if (!SLUG_RE.test(out.class)) die(2, `--class ${JSON.stringify(out.class)} is not a task class name`);
  if (!SLUG_RE.test(out.to)) die(2, `--to ${JSON.stringify(out.to)} is not a ${verb} name`);
  if (out.why && !isOneLine(out.why)) die(2, "--why is one line of text, with no control or text-direction characters");
  return out;
}

/** The drivers this tree ships, read the way bench reads them: one .sh per driver. */
function knownDrivers() {
  try { return readdirSync(join(REPO, ".claude", "scripts", "engine", "drivers")).filter((f) => f.endsWith(".sh")).map((f) => f.slice(0, -3)).sort(); }
  catch { return []; }
}

/**
 * The router text with ONE line of one class's block changed, and the value it replaced. Refuses a class the router
 * does not have, a block with no such line, and a change to the value it already holds.
 * @param {string} text @param {string} cls @param {"driver" | "tier"} field @param {string} to
 */
export function editRouter(text, cls, field, to) {
  const lines = text.split("\n");
  const top = lines.findIndex((l) => l === "classes:");
  if (top < 0) die(2, `${ROUTER} on main has no \`classes:\` block`);
  const at = lines.findIndex((l, i) => i > top && l === `  ${cls}:`);
  if (at < 0) die(2, `${ROUTER} on main has no \`classes.${cls}\` row -- there is nothing to re-route`);
  let idx = -1;
  for (let i = at + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === "" || /^\s*#/.test(l)) continue;
    if (!/^ {4}/.test(l)) break;
    if (new RegExp(`^ {4}${field}:`).test(l)) { idx = i; break; }
  }
  if (idx < 0) die(2, `\`classes.${cls}\` declares no ${field} line`);
  const from = lines[idx].replace(new RegExp(`^ {4}${field}:\\s*`), "").replace(/\s+#.*$/, "").trim();
  if (from === to) die(2, `the router already has ${cls} on ${field} ${to} -- the proposal would change nothing`);
  lines[idx] = `    ${field}: ${to}`;
  return { text: lines.join("\n"), from };
}

/**
 * The proposal branch. The class goes LAST: a class ending in "sk" (face-ask) followed by "-" made "sk-" inside the
 * branch name, the spine's secret scanner read it plus the neighbouring strings as an API key, and every face-ask
 * proposal wrote its branch and then had its approval refused (PR 3a logic attack).
 * @param {"driver" | "tier"} verb @param {string} cls @param {string} to
 */
export function branchFor(verb, cls, to) {
  return `feat/face-engine-${verb}-${to}-${cls}`.slice(0, 90).replace(/-+$/, "");
}

/** The approval a written proposal raises. One builder, for the dry run and the real emit alike. */
export function approvalPayload({ verb, cls, from, to, why, branch, base, commit }) {
  const what = verb === "driver" ? `route ${cls} from ${from} to ${to}` : `move ${cls} from the ${from} tier to ${to}`;
  return {
    what, gate: verb === "driver" ? "router-merge" : "model-policy",
    adr: "ADR-0069", class: cls, field: verb, from, to,
    branch, base, commit,
    ...(why ? { why } : {}),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { base, text } = await baseText({ repo: REPO, path: ROUTER });
  if (text === null) die(2, `main has no ${ROUTER}`);
  const parsed = parseYamlSubset(text);
  if (!parsed.ok) die(2, `${ROUTER} on main does not parse: ${parsed.error.what}`);
  const router = parsed.value;
  if (args.verb === "driver" && !knownDrivers().includes(args.to))
    die(2, `\`${args.to}\` is not a driver this tree ships (known: ${knownDrivers().join(", ")})`);
  if (args.verb === "tier" && !(Array.isArray(router.tiers) && router.tiers.includes(args.to)))
    die(2, `\`${args.to}\` is not a tier ADR-0069 names (the router's tiers: ${(router.tiers || []).join(", ")})`);

  const { text: proposed, from } = editRouter(text, args.class, args.verb, args.to);
  // The router's OWN loader, over the proposed file: a proposal arc-run would refuse to load is refused here, in the
  // router's words -- routing a class to the agent runtime without its terms is the case this catches.
  const reparsed = parseYamlSubset(proposed);
  if (!reparsed.ok) die(2, `the proposed ${ROUTER} would not parse: ${reparsed.error.what}`);
  const faults = routerFaults(reparsed.value);
  if (faults.length) die(2, `the proposed ${ROUTER} would not load (${faults.length} fault(s)): ${faults[0]}`);

  const branch = branchFor(args.verb, args.class, args.to);
  const files = [{ path: ROUTER, content: proposed }];
  const approval = (commit) => approvalPayload({ verb: args.verb, cls: args.class, from, to: args.to, why: args.why, branch, base, commit });
  // The approval is judged with a placeholder commit of the real one's shape, in the plan AND before the write.
  const refused = spineRefusal(ARC_EVENT, "approval.requested", approval("0".repeat(base.length)));
  if (refused) die(2, `the approval this proposal raises would be refused by the spine, so nothing is written: ${refused}`);
  const { what } = approval("");
  const message = `engine: ${what} (a proposal, ADR-0069${args.verb === "driver" ? "" : " tier change"})\n\n${args.why ? `${args.why}\n\n` : ""}Written by the face's work door (ADR-1340). Nothing routes differently until a human merges this branch.`;
  // The digest covers EVERYTHING the apply writes: the branch, its base, the bytes, the commit message and the approval
  // (with a placeholder commit). It covered the first three only, and an apply with another --why wrote a reason the
  // owner never read into both the commit and the inbox (PR 3a round-2 logic attack).
  const digest = planDigest({ branch, base, files, message, approval: approval("0".repeat(base.length)) });

  if (args.dryRun) {
    const plan = await planProposal({ repo: REPO, branch, files, allow: [ROUTER], base });
    process.stdout.write(`propose: would ${what}\n`);
    process.stdout.write(`propose: a new branch ${branch} off main ${plan.base.slice(0, 12)}, then approval.requested to your inbox\n`);
    process.stdout.write(plan.diff.endsWith("\n") ? plan.diff : plan.diff + "\n");
    process.stdout.write("propose: dry run -- no branch, no object, no receipt was written\n");
    process.stdout.write(expectLine(digest) + "\n");
    return;
  }
  // An apply is ALWAYS bound to a plan. The unbound hand-run mode wrote whatever main held at that moment, and a row that
  // lost its expect flag fell into it silently (PR 3a round-2 logic attack); arc-evolve has had the same default.
  if (args.expect === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, read the diff, then run it again with the --expect it prints");
  const stale = staleReason(args.expect, digest);
  if (stale) die(2, stale);
  const w = await writeProposal({ repo: REPO, branch, files, allow: [ROUTER], message, base });
  written = true;
  process.stdout.write(`propose: wrote ${branch} at ${w.commit.slice(0, 12)} off main ${w.base.slice(0, 12)}\n`);
  process.stdout.write(w.diff.endsWith("\n") ? w.diff : w.diff + "\n");
  const r = spawnSync(process.execPath, [ARC_EVENT, "emit", "approval.requested", "--payload", JSON.stringify(approval(w.commit)), "--strict"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const id = String(r.stdout || "").trim();
  if (r.status !== 0 || !ULID_RE.test(id))
    die(1, `the branch ${branch} IS written, and its approval was not raised -- ${String(r.stderr || "").trim().split("\n").filter(Boolean)[0] || `the emitter exited ${r.status}`}`);
  process.stdout.write(`receipt: approval.requested ${id}\n`);
}

// Run only as the CLI: importing this file for editRouter must not parse the importer's argv. Both sides realpathed --
// argv[1] beside import.meta.url silently no-ops behind a symlink (the node main-guard rule).
function isMainModule() {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (e instanceof Stop) { /* exitCode already set */ }
    else if (!written && e instanceof ProposalError) { process.stderr.write(`propose: ${e.code} -- ${e.message}\n`); process.exitCode = 2; }
    else {
      const why = e instanceof Error ? e.message : String(e);
      process.stderr.write(written ? `propose: the branch IS written, and then this failed: ${why}\n` : `propose: nothing was written: ${why}\n`);
      process.exitCode = written ? 1 : 2;
    }
  }
}
