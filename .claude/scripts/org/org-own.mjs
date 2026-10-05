#!/usr/bin/env node
/**
 * org-own.mjs -- hire-to-own: a hired seat becomes an own agent in one reviewable branch (org Cycle 20 Phase 03,
 * REQ-05, ADR-1629; ADR-1614 seat origins).
 *
 *   org-own.mjs --role ROLE --name AGENT --description TEXT --tools LIST --room ROOM --product P [--why TEXT]
 *               (--dry-run | --expect DIGEST)
 *
 * One proposal branch off main holds everything agent-scaffold plans for the new agent (planScaffold: the agent file,
 * its product-manifest line, its golden line, its room in the face contract and what that derives) AND the role card
 * rewritten -- origin: own, hire: null, the new agent first in binds.agents, one history line naming the hire it
 * replaced -- then one approval.requested. The tier is the card's binds.tier, never typed. The old hire's router row is
 * left alone: retiring a hire is a tier-shaped change ADR-0069 b1 puts in a reviewed diff of its own.
 *
 * Exit 0 planned or written · 1 the branch IS written and its receipt is not (said so) · 2 refused, nothing written.
 */
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";
import { checkScaffoldArgs, planScaffold, ScaffoldStop } from "../engine/agent-scaffold.mjs";
import { baseText, mainDirNames, planProposal, writeProposal, ProposalError } from "../core/proposal-branch.mjs";
import { expectLine, staleReason, spineRefusal, emitReceipt } from "../core/plan-expect.mjs";
import { isOneLine } from "../core/one-line.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ROLE_RE = /^[a-z][a-z0-9-]{0,63}$/;
const FLAGS = ["--role", "--name", "--description", "--tools", "--room", "--product", "--why", "--expect"];

class Stop extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const stop = (code, msg) => { throw new Stop(code, msg); };

export function parseArgs(argv) {
  const a = { role: "", name: "", description: "", tools: "", room: "", product: "", why: "", tier: "", expect: undefined, dryRun: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--dry-run") { if (a.dryRun) stop(2, "--dry-run given twice"); a.dryRun = true; continue; }
    if (t === "--tier") stop(2, "--tier is not taken: the tier is the role card's binds.tier");
    if (!FLAGS.includes(t)) stop(2, `unknown argument ${JSON.stringify(t)} -- known: ${FLAGS.join(" ")} --dry-run`);
    if (seen.has(t)) stop(2, `${t} given twice -- an operator error, never last-wins`);
    seen.add(t);
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("-")) stop(2, `${t} needs a value`);
    a[t.slice(2)] = v;
    i++;
  }
  if (a.dryRun && a.expect !== undefined) stop(2, "--dry-run plans and --expect applies; give one");
  if (!a.dryRun && a.expect === undefined) stop(2, "an apply is bound to a plan: run it with --dry-run first, then again with the --expect it prints");
  if (!ROLE_RE.test(a.role)) stop(2, `--role ${JSON.stringify(a.role)} is not a role id`);
  for (const k of ["room", "product"]) if (!a[k]) stop(2, `--${k} is required (the scaffold places the agent in a room and a product)`);
  if (a.why && !isOneLine(a.why)) stop(2, "--why is one line of text, with no control or invisible characters");
  return a;
}

/** Splice one YAML list entry in after `header` (a `key:` or `key: []` line at `indent`). */
function addListEntry(lines, header, indent, entry, { first = false } = {}) {
  const pad = " ".repeat(indent);
  const i = lines.findIndex((l) => l === `${pad}${header}:` || l === `${pad}${header}: []`);
  if (i < 0) stop(2, `the role card has no \`${header}:\` line at indent ${indent}`);
  const item = `${pad}  - ${entry}`;
  if (lines[i].endsWith("[]")) { lines.splice(i, 1, `${pad}${header}:`, item); return; }
  let j = i + 1;
  while (j < lines.length && lines[j].startsWith(`${pad}  - `)) j++;
  if (j === i + 1) stop(2, `the role card's ${header} is in a shape this splice does not understand`);
  lines.splice(first ? i + 1 : j, 0, item);
}

const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * The card turned own, by text splice (comments, order and every other field kept), then proven by a re-parse: the
 * only differences from the original are origin, hire, binds.agents and history.
 * @returns {{ text: string, replaced: string }}
 */
export function ownCard(raw, name, today) {
  const text = String(raw).replace(/^[\uFEFF]/, "").split("\r\n").join("\n");
  const before = parseYamlSubset(text);
  if (!before.ok || !before.value) stop(2, "the role card on main does not parse");
  const c = before.value;
  const problems = [];
  if (c.origin !== "hired") problems.push(`NOT_HIRED: the card's origin is ${JSON.stringify(c.origin)}, and only a hired seat is rewritten to own`);
  if (!c.hire || typeof c.hire !== "object") problems.push("NO_HIRE: the card names no hire to replace");
  if (!c.binds || typeof c.binds.tier !== "string" || !c.binds.tier) problems.push("NO_TIER: the card has no binds.tier, and the tier is never typed");
  if (c.binds && Array.isArray(c.binds.agents) && c.binds.agents.includes(name)) problems.push(`ALREADY_BOUND: the card already binds ${name}`);
  if (!Array.isArray(c.history)) problems.push("NO_HISTORY: the card has no history list");
  if (problems.length) stop(2, `REFUSED -- ${problems.length} condition(s) failed, nothing written:\n  ${problems.join("\n  ")}`);
  const replaced = `${c.hire.runtime ?? "?"}:${c.hire.source ?? "?"}`;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const o = lines.findIndex((l) => /^origin:\s/.test(l));
  lines[o] = "origin: 'own'";
  const h = lines.findIndex((l) => /^hire:/.test(l));
  let end = h + 1;
  while (end < lines.length && /^\s/.test(lines[end])) end++;
  lines.splice(h, end - h, "hire: null");
  addListEntry(lines, "agents", 2, quote(name), { first: true });
  addListEntry(lines, "history", 0, quote(`${today} hire-to-own: the hired seat ${replaced} replaced by the own agent ${name} (org-own, ADR-1629)`));
  const out = lines.join("\n");
  const after = parseYamlSubset(out);
  const want = JSON.parse(JSON.stringify(c));
  want.origin = "own";
  want.hire = null;
  want.binds.agents = [name, ...(Array.isArray(c.binds.agents) ? c.binds.agents : [])];
  want.history = [...c.history, `${today} hire-to-own: the hired seat ${replaced} replaced by the own agent ${name} (org-own, ADR-1629)`];
  if (!after.ok || JSON.stringify(after.value) !== JSON.stringify(want)) stop(2, "rewriting the card changed something else -- refusing");
  return { text: out, replaced, tier: c.binds.tier };
}

async function main(argv) {
  const a = parseArgs(argv);
  const depts = await mainDirNames({ repo: REPO, dir: "org/roles" });
  let cardPath = null, cardText = null;
  for (const d of depts.names) {
    const r = await baseText({ repo: REPO, path: `org/roles/${d}/${a.role}.role.yaml` });
    if (r.base !== depts.base) stop(2, "main moved while its files were read -- run it again");
    if (r.text !== null) { cardPath = `org/roles/${d}/${a.role}.role.yaml`; cardText = r.text; break; }
  }
  if (!cardPath) stop(2, `NO_ROLE: no role card ${a.role} on main`);
  const today = new Date().toISOString().slice(0, 10);
  const owned = ownCard(cardText, a.name, today);
  const s = checkScaffoldArgs({ ...a, tier: owned.tier });
  const what = `turn the hired seat of ${a.role} into the own agent "${a.name}" (${owned.tier}), replacing ${owned.replaced}`;
  const plan = await planScaffold(s, {
    repo: REPO, extra: [{ path: cardPath, content: owned.text }], branchOp: "org-own", whatOverride: what,
    gate: "hire-to-own", adr: "ADR-1629", approvalExtra: { role: a.role, card_file: cardPath },
  });
  if (plan.base !== depts.base) stop(2, "main moved while the rewrite was planned -- run it again");
  const arcEvent = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
  if (a.dryRun) {
    const p = await planProposal({ repo: REPO, branch: plan.branch, files: plan.files, allow: plan.allow, base: plan.base });
    process.stdout.write([`org-own: would ${what}`, `org-own: ${plan.files.length} files on a new branch ${plan.branch} off main ${plan.base.slice(0, 12)}, then approval.requested`,
      p.diff.replace(/\n$/, ""), "org-own: dry run -- no branch, no object, no receipt was written", expectLine(plan.digest)].join("\n") + "\n");
    return 0;
  }
  const stale = staleReason(a.expect, plan.digest);
  if (stale) stop(2, stale);
  const w = await writeProposal({ repo: REPO, branch: plan.branch, files: plan.files, allow: plan.allow, base: plan.base, message: plan.message,
    beforeRef: (commit) => { const no = spineRefusal(arcEvent, "approval.requested", plan.approval(commit), { cwd: REPO }); if (no) stop(2, `the spine would refuse this approval with its real commit, so no branch was written: ${no}`); } });
  process.stdout.write(`org-own: wrote ${plan.branch} at ${w.commit.slice(0, 12)} off main ${w.base.slice(0, 12)}\n`);
  const got = emitReceipt(arcEvent, "approval.requested", plan.approval(w.commit), { cwd: REPO, timeoutMs: 60_000 });
  if (got.state !== "landed") stop(1, `the branch ${plan.branch} IS written, and its approval ${got.state === "refused" ? "was not raised" : "may not have landed"} -- ${got.why}`);
  if (!got.id) stop(1, `the branch ${plan.branch} IS written, and its approval landed without its id -- ${got.why}`);
  process.stdout.write(`receipt: approval.requested ${got.id}\n`);
  return 0;
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}
if (isMainModule()) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => {
    if (e instanceof Stop || e instanceof ScaffoldStop) { process.stderr.write(`org-own: ${e.message}\n`); process.exitCode = e.code; return; }
    if (e instanceof ProposalError) { process.stderr.write(`org-own: ${e.code} -- ${e.message}\n`); process.exitCode = 2; return; }
    process.stderr.write(`org-own: ${e && e.stack ? e.stack : e}\n`);
    process.exitCode = 2;
  });
}
