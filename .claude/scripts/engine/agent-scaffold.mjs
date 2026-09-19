#!/usr/bin/env node
// agent-scaffold.mjs -- add an agent to the roster, on a proposal branch (face v2 Phase 05 factory ring, ADR-1341 §4).
//
//   agent-scaffold.mjs --name N --description TEXT --tools "Read, Grep" --tier TIER --room ROOM --product P
//                      [--why TEXT] [--dry-run | --expect D]
//
// "An agent joins the roster with its tier declared at birth; the tier forces the ADR-0069 citation." The model is
// the tier's v1 implementation, read from engine/router.yaml's own `models` table -- never typed. The agent file alone
// would leave main's CI red on the branch, so the branch carries the four changes one agent needs, each computed from
// main's own bytes:
//   .claude/agents/<name>.md                       the frontmatter (name, description, tools, model) and a body stub
//   products/<product>/manifest.json               the file listed in the product's "agents" (product-lint)
//   tests/fixtures/sync-golden/tree-manifest.txt   its line in the bare-install golden: sha256 of the bytes, CR
//                                                  stripped, in LC_ALL=C order (the sync byte-identity gate)
//   initiatives/face/contracts/expected-set.json   its room in the contract's agents.map (face-coverage)
// through the one proposal writer -- no checkout, the owner's tree untouched -- then approval.requested (gate
// agent-roster, ADR-0069) names the branch. A human merges it, or does not.
//
//   --dry-run   the four diffs against main, the approval judged by the spine, and the digest last
//   --expect D  writes only if that digest still holds (PLAN_STALE otherwise)
//   (neither)   refused: an apply is bound to a plan
//
// Exit: 0 done · 1 the branch IS written and its receipt is not (said so) · 2 refused, nothing written.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "./yaml-subset.mjs";
import { baseText, checkProposal, planProposal, proposalBranch, writeProposal, ProposalError } from "../core/proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal } from "../core/plan-expect.mjs";
import { isOneLine } from "../core/one-line.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const GOLDEN = "tests/fixtures/sync-golden/tree-manifest.txt";
const CONTRACT = "initiatives/face/contracts/expected-set.json";
const ROUTER = "engine/router.yaml";
/** The tools an agent may be granted here, as Claude Code names them. */
export const AGENT_TOOLS = Object.freeze(["Read", "Grep", "Glob", "Write", "Edit", "Bash", "WebSearch", "WebFetch", "NotebookEdit"]);
const NAME_RE = /^[a-z][a-z0-9-]{1,40}[a-z0-9]$/;
const PRODUCT_RE = /^[a-z][a-z0-9-]{0,40}$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

class Stop extends Error {}
const out = [];
const say = (s) => out.push(s);
function die(code, msg) { process.stderr.write(`agent-scaffold: ${msg}\n`); process.exitCode = code; throw new Stop(); }
let written = false;

function parseArgs(argv) {
  const a = { name: "", description: "", tools: "", tier: "", room: "", product: "", why: "", expect: undefined, dryRun: false };
  const known = ["--name", "--description", "--tools", "--tier", "--room", "--product", "--why", "--expect"];
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--dry-run") { if (a.dryRun) die(2, "--dry-run given twice"); a.dryRun = true; continue; }
    if (t.startsWith("--dry-run=")) die(2, `--dry-run takes no value; write it bare, not ${t}`);
    if (!known.includes(t)) die(2, `unknown argument ${JSON.stringify(t)} -- known: ${known.join(" ")} --dry-run`);
    if (seen.has(t)) die(2, `${t} given twice; pick one`);
    seen.add(t);
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("-")) die(2, `${t} needs a value`);
    a[t.slice(2)] = v;
    i++;
  }
  if (a.dryRun && a.expect !== undefined) die(2, "--dry-run plans and --expect applies; give one");
  if (!NAME_RE.test(a.name)) die(2, `--name ${JSON.stringify(a.name)} is an agent name (lowercase kebab, 3-42 characters)`);
  // A plain YAML scalar, one line: no ": " or " #" inside, and no leading character YAML reads as syntax.
  if (!a.description || !isOneLine(a.description) || Buffer.byteLength(a.description) > 300 || /: | #|^[-?:,[\]{}#&*!|>'"%@`]/.test(a.description))
    die(2, "--description is one line of plain text, up to 300 bytes, with no \": \" or \" #\" in it and no leading YAML syntax character");
  const tools = a.tools.split(",").map((s) => s.trim()).filter(Boolean);
  if (tools.length === 0 || tools.some((x) => !AGENT_TOOLS.includes(x)) || new Set(tools).size !== tools.length)
    die(2, `--tools is a comma list of distinct tools from ${AGENT_TOOLS.join(", ")}`);
  a.tools = tools.join(", ");
  if (!PRODUCT_RE.test(a.product)) die(2, `--product ${JSON.stringify(a.product)} is not a product name`);
  if (a.why && !isOneLine(a.why)) die(2, "--why is one line of text, with no control or invisible characters");
  return a;
}

/** Main's text of one file, or a refusal naming it. */
async function mainText(path) {
  const r = await baseText({ repo: REPO, path });
  if (r.text === null) die(2, `${path} is not on main`);
  return r;
}

/** The array literal `"key": [ ... ]` in a manifest's text: its bounds and indentation. */
function arraySpan(text, key) {
  const open = text.indexOf(`"${key}": [`);
  if (open < 0) return null;
  const start = text.indexOf("[", open);
  const end = text.indexOf("]", start);
  if (end < 0) return null;
  return { start, end };
}

/** The manifest with one path appended to its "agents" array, formatted as its neighbours are. */
export function addToManifest(text, path) {
  const span = arraySpan(text, "agents");
  if (!span) die(2, "the product's manifest has no \"agents\" array -- it ships no agents");
  const inner = text.slice(span.start + 1, span.end);
  const lineStart = text.lastIndexOf("\n", span.start) + 1;
  const outer = /^\s*/.exec(text.slice(lineStart))[0];
  const itemIndent = `${outer}  `;
  const items = inner.trim();
  const next = items === ""
    ? `[\n${itemIndent}${JSON.stringify(path)}\n${outer}]`
    : `[${inner.replace(/\s*$/, "")},\n${itemIndent}${JSON.stringify(path)}\n${outer}]`;
  const result = text.slice(0, span.start) + next + text.slice(span.end + 1);
  const before = JSON.parse(text);
  const after = JSON.parse(result);
  if (JSON.stringify({ ...after, agents: before.agents }) !== JSON.stringify(before) || JSON.stringify(after.agents) !== JSON.stringify([...(before.agents || []), path]))
    die(2, "adding the agent would change the manifest beyond its agents list -- refused");
  return result;
}

/** The golden with the agent's line inserted in LC_ALL=C (byte) order. */
export function addToGolden(text, path, content) {
  const sha = createHash("sha256").update(content.replace(/\r/g, "")).digest("hex");
  const lines = text.split("\n").filter((l) => l !== "");
  if (lines.some((l) => l.split("\t")[0] === path)) die(2, `${path} is already in the sync golden`);
  const line = `${path}\t${sha}`;
  const cmp = (x, y) => { const bx = Buffer.from(x), by = Buffer.from(y); return Buffer.compare(bx, by); };
  let at = lines.findIndex((l) => cmp(l.split("\t")[0], path) > 0);
  if (at < 0) at = lines.length;
  lines.splice(at, 0, line);
  return `${lines.join("\n")}\n`;
}

/** The contract with the agent's room added to agents.map, and the census in its $comment moved by one. */
export function addToContract(text, name, room) {
  const agentsAt = text.indexOf("\"agents\": {");
  const mapAt = agentsAt < 0 ? -1 : text.indexOf("\"map\": {", agentsAt);
  if (mapAt < 0) die(2, "the contract has no agents.map");
  const close = text.indexOf("}", mapAt);
  const body = text.slice(text.indexOf("{", mapAt) + 1, close);
  const lastLine = body.replace(/\s*$/, "");
  const indent = (/\n(\s*)"/.exec(body) || [, "      "])[1];
  const lineStart = text.lastIndexOf("\n", close) + 1;
  const closeIndent = /^\s*/.exec(text.slice(lineStart))[0];
  let result = `${text.slice(0, text.indexOf("{", mapAt) + 1)}${lastLine},\n${indent}${JSON.stringify(name)}: ${JSON.stringify(room)}\n${closeIndent}${text.slice(close)}`;
  // The census the comment states, kept true.
  result = result.replace(/("agents": \{\s*"\$comment": ")(\d+)(;)/, (_, p, n, s) => `${p}${Number(n) + 1}${s}`);
  const before = JSON.parse(text);
  const after = JSON.parse(result);
  if (after.agents.map[name] !== room || Object.keys(after.agents.map).length !== Object.keys(before.agents.map).length + 1)
    die(2, "adding the agent's room would change the contract beyond agents.map -- refused");
  return result;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const agentPath = `.claude/agents/${a.name}.md`;
  const manifestPath = `products/${a.product}/manifest.json`;
  const branch = proposalBranch("agents-add", a.name);
  const existing = await baseText({ repo: REPO, path: agentPath });
  if (existing.text !== null) die(2, `${agentPath} is already on main -- an agent is added once`);
  const [router, contract, golden, manifest] = await Promise.all([mainText(ROUTER), mainText(CONTRACT), mainText(GOLDEN), mainText(manifestPath)]);
  const base = existing.base;
  if ([router, contract, golden, manifest].some((r) => r.base !== base)) die(2, "main moved while its files were read -- run it again");

  // The tier is law (ADR-0069) and the model is its v1 implementation: read from the router's own models table.
  const parsed = parseYamlSubset(router.text);
  const tiers = parsed.ok && Array.isArray(parsed.value.tiers) ? parsed.value.tiers : [];
  if (!tiers.includes(a.tier)) die(2, `--tier ${JSON.stringify(a.tier)} is not a tier ADR-0069 names (the router's tiers: ${tiers.join(", ")})`);
  const model = parsed.value.models && parsed.value.models[a.tier] && parsed.value.models[a.tier]["claude-code"];
  if (typeof model !== "string" || !/^[a-z][a-z0-9.-]*$/.test(model)) die(2, `the router maps no claude-code model to the ${a.tier} tier -- an agent there has no implementation yet`);
  const map = JSON.parse(contract.text).agents.map;
  if (Object.hasOwn(map, a.name)) die(2, `${a.name} already has a room in the contract's agents.map`);
  const rooms = [...new Set(Object.values(map))].sort();
  if (!rooms.includes(a.room)) die(2, `--room ${JSON.stringify(a.room)} is not a room that hosts agents (${rooms.join(", ")})`);

  const body = [
    "---",
    `name: ${a.name}`,
    `description: ${a.description}`,
    `tools: ${a.tools}`,
    `model: ${model}`,
    "---",
    "",
    `# ${a.name}`,
    "",
    a.description,
    "",
    `Tier: ${a.tier} (ADR-0069). The model above is that tier's implementation today; changing the tier later is a`,
    "reviewed diff that cites ADR-0069.",
    "",
    "Scaffolded by the face's work door (ADR-1341 §4). Write this agent's method here before anything invokes it.",
    "",
  ].join("\n");
  const files = [
    { path: agentPath, content: body },
    { path: manifestPath, content: addToManifest(manifest.text, agentPath) },
    { path: GOLDEN, content: addToGolden(golden.text, agentPath, body) },
    { path: CONTRACT, content: addToContract(contract.text, a.name, a.room) },
  ];
  const allow = files.map((f) => f.path);
  const checked = await checkProposal({ repo: REPO, branch, paths: allow, allow, base });
  if (checked.base !== base) die(2, "main moved while the agent was scaffolded -- run it again");
  // The name is followed by a comma: the scanner also reads each string with its spaces removed, and a name like
  // task-runner followed by words is a key to it (PR 3b logic attack, the pin twin).
  const what = `add the agent ${a.name}, to the ${a.room} room at the ${a.tier} tier (${model} today)`;
  const approval = (commit) => ({ what, gate: "agent-roster", adr: "ADR-0069", agent: a.name, tier: a.tier, model, room: a.room, product: a.product, branch, base, commit, ...(a.why ? { why: a.why } : {}) });
  const refused = spineRefusal(ARC_EVENT, "approval.requested", approval("0".repeat(base.length)), { cwd: REPO });
  if (refused) die(2, `the approval this agent raises would be refused by the spine, so nothing is written: ${refused}`);
  const message = `agents: ${what} (a proposal, ADR-0069)\n\n${a.why ? `${a.why}\n\n` : ""}The agent file, its product-manifest line, its sync-golden line and its room in the contract, so main stays green when this merges.\nWritten by the face's work door (ADR-1341).`;
  const digest = planDigest({ branch, base, files, message, approval: approval("0".repeat(base.length)) });
  if (a.dryRun) {
    const plan = await planProposal({ repo: REPO, branch, files, allow, base });
    say(`agent-scaffold: would ${what}`);
    say(`agent-scaffold: four files on a new branch ${branch} off main ${base.slice(0, 12)}, then approval.requested to your inbox`);
    say(plan.diff.replace(/\n$/, ""));
    say("agent-scaffold: dry run -- no branch, no object, no receipt was written");
    say(expectLine(digest));
    return;
  }
  if (a.expect === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, read the diff, then run it again with the --expect it prints");
  const stale = staleReason(a.expect, digest);
  if (stale) die(2, stale);
  // The REAL approval, its commit included, is judged before the branch exists (writeProposal beforeRef; PR 3b attacks).
  const w = await writeProposal({ repo: REPO, branch, files, allow, base, message,
    beforeRef: (commit) => { const no = spineRefusal(ARC_EVENT, "approval.requested", approval(commit), { cwd: REPO }); if (no) die(2, `the spine would refuse this approval with its real commit, so no branch was written: ${no}`); } });
  written = true;
  say(`agent-scaffold: wrote ${branch} at ${w.commit.slice(0, 12)} off main ${w.base.slice(0, 12)}`);
  const r = spawnSync(process.execPath, [ARC_EVENT, "emit", "approval.requested", "--payload", JSON.stringify(approval(w.commit)), "--strict"], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const id = String(r.stdout || "").trim();
  if (r.status !== 0 || !ULID_RE.test(id))
    die(1, `the branch ${branch} IS written, and its approval was not raised -- ${String(r.stderr || "").trim().split(/\r?\n/).filter(Boolean)[0] || `the emitter exited ${r.status}`}`);
  say(`receipt: approval.requested ${id}`);
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (e instanceof Stop) { /* exitCode set */ }
    else if (!written && e instanceof ProposalError) { process.stderr.write(`agent-scaffold: ${e.code} -- ${e.message}\n`); process.exitCode = 2; }
    else {
      const why = e instanceof Error ? e.message : String(e);
      process.stderr.write(written ? `agent-scaffold: the branch IS written, and then this failed: ${why}\n` : `agent-scaffold: nothing was written: ${why}\n`);
      process.exitCode = written ? 1 : 2;
    }
  }
  // A reader that closed its end loses these lines, never the outcome: the exit code is already set (PR 3b, arc-event twin).
  if (out.length) { try { writeSync(1, out.join("\n") + "\n"); } catch { /* the lines are lost; the effect and its exit are not */ } }
}
