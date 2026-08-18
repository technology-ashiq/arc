#!/usr/bin/env node
// face-coverage -- REQ-01 / ADR-1311: the Coverage map is the v1 contract, and this
// validator holds it. Every born lane, every spine kind, every command, every agent in
// the TREE must have a home in initiatives/face/contracts/expected-set.json. A part of
// arc with no room is a FAIL, not a review comment -- "onnu vidama" as CI.
//
// FAIL-FROM-BIRTH (the named exception to the WARN-first trial rule): a coverage lint that
// only warns is a hope. Same posture as policy-lint / jobs-lint -- a validator over the
// tree, strict from day one.
//
// The MUTANT is the negative control: run this against a tree carrying a lane and a kind
// that the contract does not name, and it must FAIL naming BOTH. `--mutant-selftest`
// proves that in-process (a coverage gate that cannot fail closed proves nothing -- the
// exact vacuous-pass shape this repo has shipped before).
//
//   face-coverage.mjs [repo-root]
//   face-coverage.mjs --selftest        # assert the mutant FAILs and a clean tree passes
//
// Exit: 0 all covered | 1 a gap (named) | 2 the contract or the tree could not be read.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, "..", "..", "..");

// ---------- tree truths (derived, never copied -- ADR-0107) ----------
async function treeKinds(repo) {
  // The vocabulary is whatever validate.mjs says it is, imported, not re-listed. A copy
  // here would be exactly the stale-count defect the design source itself reproduced.
  // pathToFileURL: a bare Windows path (c:\...) is rejected by the ESM loader as an
  // unknown-scheme URL; import() needs a file:// URL on every OS.
  const mod = await import(pathToFileURL(join(repo, ".claude/scripts/hq/lib/validate.mjs")).href);
  return [...mod.KINDS];
}
function dirNames(p) {
  if (!existsSync(p)) return [];
  return readdirSync(p).filter((n) => { try { return statSync(join(p, n)).isDirectory(); } catch { return false; } });
}
function mdStems(p) {
  if (!existsSync(p)) return [];
  return readdirSync(p).filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3));
}

// ---------- the check (pure: tree facts + contract -> findings) ----------
export function coverageFindings({ kinds, lanes, commands, agents, contract }) {
  const findings = [];
  const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

  const kindMap = contract.kinds?.map || {};
  for (const k of kinds)
    if (!has(kindMap, k)) findings.push(`[kind] "${k}" is a live spine kind with no home in the contract (typed or generic)`);

  const laneMap = contract.lanes?.map || {};
  for (const l of lanes)
    if (!has(laneMap, l)) findings.push(`[lane] "${l}" is a born lane (initiatives/${l}/) with no room in the contract`);

  const cmdMap = contract.commands?.map || {};
  // commands carry a "(G)" suffix in the contract for generated ones; match on the stem.
  const stripTag = (k) => k.replace(/\s*\((?:G|legacy)\)$/, "").trim();
  const cmdKeys = new Set(Object.keys(cmdMap).map(stripTag));
  for (const c of commands)
    if (!cmdKeys.has(c)) findings.push(`[command] "/${c}" exists in .claude/commands/ with no Toolbelt/Review home in the contract`);

  const agentMap = contract.agents?.map || {};
  const agentKeys = new Set(Object.keys(agentMap).map((k) => k.replace(/\s*\(legacy\)$/, "").trim()));
  for (const a of agents)
    if (!agentKeys.has(a)) findings.push(`[agent] "${a}" exists in .claude/agents/ with no room in the contract`);

  // reverse direction is a WARN, not a FAIL: a contract entry naming a room that isn't in
  // the rooms list is a self-inconsistency worth flagging, but a lane/kind removed from the
  // tree leaving a stale contract row is the remover's cleanup, not this gate's block.
  const roomIds = new Set((contract.rooms?.list || []).map((r) => r.id));
  const warns = [];
  for (const [lane, room] of Object.entries(laneMap))
    if (!roomIds.has(room)) warns.push(`[stale] lane "${lane}" maps to room "${room}" which is not in the rooms list`);

  return { findings, warns };
}

function loadContract(repo) {
  const p = join(repo, "initiatives", "face", "contracts", "expected-set.json");
  if (!existsSync(p)) throw new Error(`expected-set.json not found at ${p} -- Phase 00 freezes it`);
  return JSON.parse(readFileSync(p, "utf8"));
}

async function gather(repo) {
  return {
    kinds: await treeKinds(repo),
    lanes: dirNames(join(repo, "initiatives")),
    commands: mdStems(join(repo, ".claude", "commands")),
    agents: mdStems(join(repo, ".claude", "agents")),
    contract: loadContract(repo),
  };
}

async function run(repo) {
  const data = await gather(repo);
  const { findings, warns } = coverageFindings(data);
  for (const w of warns) process.stderr.write(`WARN  ${w}\n`);
  if (findings.length) {
    for (const f of findings) process.stderr.write(`FAIL  ${f}\n`);
    process.stderr.write(`face-coverage: ${findings.length} coverage gap(s) -- every part of arc needs a home (ADR-1311)\n`);
    return 1;
  }
  process.stdout.write(`face-coverage: ${data.kinds.length} kinds, ${data.lanes.length} lanes, ${data.commands.length} commands, ${data.agents.length} agents -- all covered\n`);
  return 0;
}

// ---------- the mutant self-test (the negative control) ----------
async function selftest(repo) {
  const clean = await gather(repo);
  const { findings: cleanFindings } = coverageFindings(clean);
  const cleanOk = cleanFindings.length === 0;

  // mutate IN MEMORY: a lane and a kind the contract does not name.
  const mutant = {
    ...clean,
    lanes: [...clean.lanes, "ghostlane"],
    kinds: [...clean.kinds, "ghost.kind"],
  };
  const { findings: mutantFindings } = coverageFindings(mutant);
  const namedLane = mutantFindings.some((f) => f.includes("ghostlane"));
  const namedKind = mutantFindings.some((f) => f.includes("ghost.kind"));

  const lines = [
    `clean tree passes: ${cleanOk ? "PASS" : "FAIL (" + cleanFindings.length + " gaps: " + cleanFindings.slice(0,3).join("; ") + ")"}`,
    `mutant lane named:  ${namedLane ? "PASS" : "FAIL"}`,
    `mutant kind named:  ${namedKind ? "PASS" : "FAIL"}`,
  ];
  for (const l of lines) process.stdout.write(l + "\n");
  const ok = cleanOk && namedLane && namedKind;
  process.stdout.write(`face-coverage selftest: ${ok ? "PASS -- fails closed on the mutant, passes the real tree" : "FAIL"}\n`);
  return ok ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith("face-coverage.mjs")) {
  const argv = process.argv.slice(2);
  const repo = argv.find((a) => !a.startsWith("--")) || REPO_DEFAULT;
  const fn = argv.includes("--selftest") ? selftest : run;
  fn(repo)
    .then((code) => process.exit(code))
    .catch((err) => { process.stderr.write(`face-coverage: ERROR -- ${err.message}\n`); process.exit(2); });
}
