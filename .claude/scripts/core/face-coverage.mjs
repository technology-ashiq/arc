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

import { readFileSync, existsSync, readdirSync, statSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, "..", "..", "..");

/**
 * "Was this file RUN, or imported?" -- realpath on BOTH sides.
 *
 * The cheap `endsWith` form silently answers NO behind a symlink or a renamed copy: an
 * adversarial pass copied this gate to another filename, pointed it at a tree with three
 * real gaps, and got a silent exit 0. A gate that no-ops under a different spelling is
 * worse than no gate at all, because it reports success. Same fix as arc-event.mjs --
 * which I had already made THAT DAY and then wrote the weak form here: grep the pattern,
 * not the file.
 */
function isMainModule() {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

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
export function coverageFindings({ kinds, lanes, commands, agents, products, contract }) {
  const findings = [];
  const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

  // The room ids are the vocabulary everything else points at, so they are validated FIRST
  // and as VALUES, not as a count. An adversarial pass (2026-08-19) deleted a room's `id`,
  // duplicated one, and swapped a room for a filler with a duplicate id — the list length
  // stayed 32 through all three and every gate stayed green. A count pins key-count, never
  // truth.
  const roomRows = contract.rooms?.list || [];
  const ids = roomRows.map((r) => r && r.id);
  if (ids.some((i) => typeof i !== "string" || i === ""))
    findings.push(`[contract] rooms.list carries a row with a missing or non-string id`);
  if (new Set(ids).size !== ids.length)
    findings.push(`[contract] rooms.list has duplicate ids — ${ids.length} rows, ${new Set(ids).size} distinct`);
  const tplId = contract.rooms?.template?.id;
  const roomIds = new Set([...ids.filter((i) => typeof i === "string" && i), ...(tplId ? [tplId] : [])]);
  const rings = new Set(contract.rings || []);
  for (const r of roomRows)
    if (r && r.id && rings.size && !rings.has(r.ring))
      findings.push(`[contract] room "${r.id}" declares ring "${r.ring}", which is not one of (${[...rings].join(", ")})`);

  // A kind needs a home that EXISTS. Presence of the key proves only that someone typed it:
  // `{}`, `{homes: []}` and `{homes: ["ghost-room"]}` all satisfied the old check, and the
  // sanctioned regenerate then made the corruption permanent and green.
  // `*`-prefixed homes (e.g. `*decide-zones`) are legitimate non-room homes, by design.
  const kindMap = contract.kinds?.map || {};
  for (const k of kinds) {
    if (!has(kindMap, k)) { findings.push(`[kind] "${k}" is a live spine kind with no home in the contract (typed or generic)`); continue; }
    const homes = kindMap[k] && kindMap[k].homes;
    if (!Array.isArray(homes) || homes.length === 0) {
      findings.push(`[kind] "${k}" has an entry but no homes — an empty home is homelessness with a key`);
      continue;
    }
    for (const h of homes)
      if (typeof h !== "string" || (!h.startsWith("*") && !roomIds.has(h)))
        findings.push(`[kind] "${k}" is homed in "${h}", which is not a room in this contract`);
  }

  const laneMap = contract.lanes?.map || {};
  for (const l of lanes) {
    if (!has(laneMap, l)) { findings.push(`[lane] "${l}" is a born lane (initiatives/${l}/) with no room in the contract`); continue; }
    // A BORN lane pointing at a room that does not exist is a FAIL, not a WARN. The old code
    // warned for every entry alike, on the theory that a stale row is the remover's cleanup —
    // but it never asked whether the lane exists, so a live lane with a typo'd room sailed
    // through the gate whose single job is "every born lane has a room".
    const room = laneMap[l];
    if (typeof room !== "string" || !roomIds.has(room))
      findings.push(`[lane] born lane "${l}" maps to "${room}", which is not a room in this contract`);
  }

  // A product may carry a `face:` section ONLY if the contract maps it to a room. Otherwise
  // an invented section sits in a manifest that no gate reads: product-lint defers schema
  // validation to this gate, and this gate did not look at products at all — a delegation
  // that closed a circle around nothing.
  const productMap = contract.products?.map || {};
  for (const p of products || []) {
    const mapped = has(productMap, p.name);
    if (mapped && !roomIds.has(productMap[p.name]))
      findings.push(`[product] "${p.name}" maps to room "${productMap[p.name]}", which is not a room in this contract`);
    if (!mapped && p.hasFace)
      findings.push(`[product] "${p.name}" carries a face: section but the contract maps it to no room — a section nothing renders`);
  }

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

  // A contract row for a lane that is NO LONGER in the tree stays a WARN: that is the
  // remover's cleanup, not this gate's block. The live-lane case above is the FAIL.
  const warns = [];
  const born = new Set(lanes);
  for (const lane of Object.keys(laneMap))
    if (!born.has(lane)) warns.push(`[stale] contract maps lane "${lane}", which is not a born lane on this tree`);

  return { findings, warns };
}

function loadContract(repo) {
  const p = join(repo, "initiatives", "face", "contracts", "expected-set.json");
  if (!existsSync(p)) throw new Error(`expected-set.json not found at ${p} -- Phase 00 freezes it`);
  return JSON.parse(readFileSync(p, "utf8"));
}

function treeProducts(repo) {
  const dir = join(repo, "products");
  return dirNames(dir).map((name) => {
    const mpath = join(dir, name, "manifest.json");
    let hasFace = false;
    try { hasFace = Object.prototype.hasOwnProperty.call(JSON.parse(readFileSync(mpath, "utf8")), "face"); }
    catch { /* no manifest, or unreadable — product-lint owns that */ }
    return { name, hasFace };
  });
}

async function gather(repo) {
  return {
    kinds: await treeKinds(repo),
    lanes: dirNames(join(repo, "initiatives")),
    commands: mdStems(join(repo, ".claude", "commands")),
    agents: mdStems(join(repo, ".claude", "agents")),
    products: treeProducts(repo),
    contract: loadContract(repo),
  };
}

/** @param repoOrData a repo path, or a pre-gathered data object (the selftest's exit arm). */
async function run(repoOrData, quiet = false) {
  const data = typeof repoOrData === "string" ? await gather(repoOrData) : repoOrData;
  const { findings, warns } = coverageFindings(data);
  if (quiet) return findings.length ? 1 : 0;
  for (const w of warns) process.stderr.write(`WARN  ${w}\n`);
  if (findings.length) {
    for (const f of findings) process.stderr.write(`FAIL  ${f}\n`);
    process.stderr.write(`face-coverage: ${findings.length} coverage gap(s) -- every part of arc needs a home (ADR-1311)\n`);
    return 1;
  }
  process.stdout.write(`face-coverage: ${data.kinds.length} kinds, ${data.lanes.length} lanes, ${data.commands.length} commands, ${data.agents.length} agents, ${data.products.length} products -- all covered\n`);
  return 0;
}

// ---------- the mutant self-test (the negative control) ----------
async function selftest(repo) {
  const clean = await gather(repo);
  const { findings: cleanFindings } = coverageFindings(clean);
  const cleanOk = cleanFindings.length === 0;

  // A mutant that only ADDS a lane and a kind is half a control: an adversarial pass showed
  // seven implementation mutants surviving it, because deleting the command loop, the agent
  // loop or a whole tree-reader is invisible to a mutation applied AFTER gather(). So every
  // dimension gets an arm, and each names its own ghost.
  const arms = [
    ["lane", { ...clean, lanes: [...clean.lanes, "ghostlane"] }, "ghostlane"],
    ["kind", { ...clean, kinds: [...clean.kinds, "ghost.kind"] }, "ghost.kind"],
    ["command", { ...clean, commands: [...clean.commands, "ghost-command"] }, "ghost-command"],
    ["agent", { ...clean, agents: [...clean.agents, "ghost-agent"] }, "ghost-agent"],
    ["product", { ...clean, products: [...clean.products, { name: "ghostproduct", hasFace: true }] }, "ghostproduct"],
    // VALUE corruption, not just an absent key: the whole class the old control missed.
    ["kind homed nowhere", withKindHome(clean, []), "no homes"],
    ["kind homed in a ghost room", withKindHome(clean, ["ghost-room-xyz"]), "ghost-room-xyz"],
    ["born lane in a ghost room", withLaneRoom(clean, "ghost-room-xyz"), "ghost-room-xyz"],
  ];

  const lines = [`clean tree passes: ${cleanOk ? "PASS" : "FAIL (" + cleanFindings.length + " gaps: " + cleanFindings.slice(0, 3).join("; ") + ")"}`];
  let allArms = true;
  for (const [label, mutant, needle] of arms) {
    const { findings } = coverageFindings(mutant);
    const named = findings.some((f) => f.includes(needle));
    if (!named) allArms = false;
    lines.push(`mutant ${label.padEnd(24)} named: ${named ? "PASS" : "FAIL"}`);
  }

  // THE EXIT-CODE ARM. Everything above exercises the pure function; nothing proved that a
  // real gap makes the CLI exit non-zero, and two mutants that turned `return 1` into
  // `return 0` were invisible for exactly that reason.
  const exitOnGap = await run({ ...clean, lanes: [...clean.lanes, "ghostlane"] }, true);
  lines.push(`exit code on a real gap:      ${exitOnGap === 1 ? "PASS" : "FAIL (got " + exitOnGap + ")"}`);

  for (const l of lines) process.stdout.write(l + "\n");
  const ok = cleanOk && allArms && exitOnGap === 1;
  process.stdout.write(`face-coverage selftest: ${ok ? "PASS -- fails closed on every arm, passes the real tree" : "FAIL"}\n`);
  return ok ? 0 : 1;
}

/** Corrupt the FIRST live kind's homes to `homes`, leaving its key in place. */
function withKindHome(data, homes) {
  const contract = JSON.parse(JSON.stringify(data.contract));
  const k = data.kinds.find((x) => contract.kinds?.map?.[x]);
  if (k) contract.kinds.map[k] = { ...contract.kinds.map[k], homes };
  return { ...data, contract };
}
/** Point the FIRST born lane at a room id that does not exist. */
function withLaneRoom(data, room) {
  const contract = JSON.parse(JSON.stringify(data.contract));
  const l = data.lanes.find((x) => contract.lanes?.map?.[x]);
  if (l) contract.lanes.map[l] = room;
  return { ...data, contract };
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  const repo = argv.find((a) => !a.startsWith("--")) || REPO_DEFAULT;
  const fn = argv.includes("--selftest") ? selftest : run;
  fn(repo)
    .then((code) => process.exit(code))
    .catch((err) => { process.stderr.write(`face-coverage: ERROR -- ${err.message}\n`); process.exit(2); });
}
