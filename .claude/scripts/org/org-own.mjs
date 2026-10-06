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
 *   org-own.mjs --assign --role ROLE --seat agent|vacant [--agents a,b] [--why TEXT] (--dry-run | --expect DIGEST)
 *
 * The face's seat edit (face Phase 13, ADR-1352): one own card's seat, binds.agents and binds.tier set on a proposal
 * branch off main, with the chart re-rendered beside it, then one approval.requested (gate org-seat). The tier is
 * derived from the agents' own files, never typed. What org-coverage fails is refused before any file or event.
 *
 * Exit 0 planned or written · 1 the branch IS written and its receipt is not (said so) · 2 refused, nothing written.
 */
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";
import { checkScaffoldArgs, planScaffold, ScaffoldStop } from "../engine/agent-scaffold.mjs";
import { baseText, checkProposal, mainDirNames, openProposalsChanging, planProposal, proposalBranch, proposalLocks, withGitReader, writeProposal, ProposalError } from "../core/proposal-branch.mjs";
import { expectLine, planDigest, staleReason, spineRefusal, emitReceipt, withExclusiveLock } from "../core/plan-expect.mjs";
import { isOneLine } from "../core/one-line.mjs";
import { query, spineRoot } from "../hq/spine.mjs";
import { chartModel, renderChart } from "./org-catalog.mjs";
import { MODEL_RE } from "./lib/card.mjs";

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

// ---------- --assign: who sits a seat, set from the face (ADR-1352) ----------

const ASSIGN_FLAGS = ["--role", "--seat", "--agents", "--why", "--expect"];
// Only the two seats whose binds are agents alone: a script, skill, process, human or partial seat carries binds of
// other kinds or an e2, and those stay hand-edited cards (ADR-1352 §B).
const ASSIGN_SEATS = Object.freeze(["agent", "vacant"]);
const AGENT_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_AGENTS = 24;
const MODEL_TIER = Object.freeze({ haiku: "cheap-scan", sonnet: "balanced-workhorse", opus: "high-judgment" });

/** `--assign --role R --seat agent|vacant [--agents a,b] [--why TEXT] (--dry-run | --expect D)`; argv[0] is `--assign`. */
export function parseAssignArgs(argv) {
  const a = { role: "", seat: "", agents: undefined, why: "", expect: undefined, dryRun: false };
  const seen = new Set();
  for (let i = 1; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--dry-run") { if (a.dryRun) stop(2, "--dry-run given twice"); a.dryRun = true; continue; }
    if (t === "--tier") stop(2, "--tier is not taken: a seat's tier is derived from the agents it binds (ADR-0069, ADR-1352)");
    if (!ASSIGN_FLAGS.includes(t)) stop(2, `unknown argument ${JSON.stringify(t)} -- known with --assign: ${ASSIGN_FLAGS.join(" ")} --dry-run`);
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
  if (!ASSIGN_SEATS.includes(a.seat)) stop(2, `--seat ${JSON.stringify(a.seat)} -- only ${ASSIGN_SEATS.join(" or ")} is set here; any other seat is a hand edit of its card`);
  if (a.why && !isOneLine(a.why)) stop(2, "--why is one line of text, with no control or invisible characters");
  if (a.seat === "vacant") {
    if (a.agents !== undefined) stop(2, "SEAT_BINDS_DISAGREE: a vacant seat binds no agent -- drop --agents");
    a.agents = [];
    return a;
  }
  if (a.agents === undefined) stop(2, "SEAT_BINDS_DISAGREE: an agent seat binds at least one agent -- give --agents a,b");
  const list = a.agents.split(",");
  for (const n of list) if (!AGENT_RE.test(n)) stop(2, `--agents: ${JSON.stringify(n)} is not an agent name (lowercase letters, digits and -, comma-separated, no spaces)`);
  if (new Set(list).size !== list.length) stop(2, "--agents names an agent twice");
  if (list.length > MAX_AGENTS) stop(2, `--agents names ${list.length} agents; a seat binds at most ${MAX_AGENTS}`);
  for (const n of list) if (MODEL_RE.test(n)) stop(2, `--agents: "${n}" reads as a model name, and a card that binds one fails org-coverage (MODEL_RE)`);
  a.agents = list;
  return a;
}

/**
 * The tier a set of agents sits on, from each agent file's own `model:` exactly as org-catalog derives it (unpinned or
 * unknown -> balanced-workhorse). A seat runs on one tier, so agents on two tiers are refused by name, never averaged.
 * @param {Map<string, string>} texts agent name -> its file on main
 */
export function tierOfAgents(agents, texts) {
  if (!agents.length) return null;
  const per = agents.map((n) => {
    const text = texts.get(n);
    if (typeof text !== "string") stop(2, `NO_AGENT: "${n}" has no file in .claude/agents/ on main`);
    const fm = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
    const m = fm && fm[1].match(/^model:\s*([A-Za-z0-9._-]+)\s*$/m);
    return [n, (m && MODEL_TIER[m[1].toLowerCase()]) || "balanced-workhorse"];
  });
  const tiers = [...new Set(per.map(([, t]) => t))];
  if (tiers.length > 1) stop(2, `TIER_MIXED: a seat runs on one tier, and these agents sit on ${tiers.length} (${per.map(([n, t]) => `${n}=${t}`).join(", ")}) -- bind agents of one tier, or change the tier by hand under ADR-0069`);
  return tiers[0];
}

/** Replace the list under `  <key>:` inside binds with `items` (block form, or `[]` when empty). */
function setBindsList(lines, from, key, items) {
  let i = from + 1;
  while (i < lines.length && /^\s/.test(lines[i]) && !lines[i].startsWith(`  ${key}:`)) i++;
  if (i >= lines.length || !lines[i].startsWith(`  ${key}:`)) stop(2, `the role card's binds has no \`${key}:\` line`);
  if (lines[i] !== `  ${key}:` && lines[i] !== `  ${key}: []`) stop(2, `the role card's binds.${key} is in a shape this splice does not understand`);
  let j = i + 1;
  if (lines[i] === `  ${key}:`) {
    while (j < lines.length && lines[j].startsWith("    - ")) j++;
    if (j === i + 1) stop(2, `the role card's binds.${key} is in a shape this splice does not understand`);
  }
  lines.splice(i, j - i, ...(items.length ? [`  ${key}:`, ...items.map((x) => `    - ${quote(x)}`)] : [`  ${key}: []`]));
}

/**
 * One card's seat and binds set, by text splice, then proven by a re-parse: the ONLY differences from the original are
 * seat, binds.agents and binds.tier -- every comment, order and other field is the card's own (ADR-1352: role cards are
 * edited by hand). Refuses what org-coverage would fail on this card, before anything is written.
 * @returns {{ text: string, was: { seat: string, agents: string[], tier: string | null } }}
 */
export function assignCard(raw, { seat, agents, tier }) {
  // The card keeps its own bytes: a BOM and a CRLF card come back as they were, only the three values changed
  // (attack a0bc939 B1 -- a Windows-edited card rewritten whole to LF is every line changed, not three).
  const src = String(raw);
  const bom = src.startsWith("\uFEFF") ? "\uFEFF" : "";
  const body = bom ? src.slice(1) : src;
  const crlf = body.includes("\r\n");
  if (crlf && /(^|[^\r])\n/.test(body)) stop(2, "MIXED_EOL: the role card mixes CRLF and LF line endings -- fix it by hand first");
  const text = crlf ? body.split("\r\n").join("\n") : body;
  const before = parseYamlSubset(text);
  if (!before.ok || !before.value || typeof before.value !== "object") stop(2, "the role card on main does not parse");
  const c = before.value;
  const b = c.binds && typeof c.binds === "object" && !Array.isArray(c.binds) ? c.binds : null;
  const problems = [];
  if (c.origin !== "own") problems.push(`NOT_OWN: the card's origin is ${JSON.stringify(c.origin)} -- a hired seat changes through hire-to-own, never here`);
  if (!ASSIGN_SEATS.includes(c.seat)) problems.push(`SEAT_BY_HAND: the card's seat is ${JSON.stringify(c.seat)}; only an agent or a vacant seat is set here`);
  if (!b || !Array.isArray(b.agents)) problems.push("NO_BINDS: the card has no binds.agents list");
  if (seat === "vacant" && b) {
    const other = [["skills", b.skills], ["scripts", b.scripts]].filter(([, v]) => Array.isArray(v) && v.length).map(([k]) => k);
    if (typeof b.process === "string" && b.process) other.push("process");
    if (other.length) problems.push(`SEAT_BINDS_DISAGREE: a vacant seat binds nothing, and this card still binds ${other.join(", ")} -- a hand edit`);
  }
  if (seat === "vacant" && c.legitimacy !== undefined && c.legitimacy !== null) problems.push(`LEGITIMISED: the seat is legitimised (${JSON.stringify(c.legitimacy)}), and a vacant seat cannot be -- vacating it is a hand edit`);
  if (seat === "agent" && !agents.length) problems.push("SEAT_BINDS_DISAGREE: an agent seat binds at least one agent");
  if (problems.length) stop(2, `REFUSED -- ${problems.length} condition(s) failed, nothing written:\n  ${problems.join("\n  ")}`);
  const was = { seat: c.seat, agents: [...b.agents], tier: b.tier ?? null };
  if (was.seat === seat && JSON.stringify(was.agents) === JSON.stringify(agents) && was.tier === tier) stop(2, `NOTHING_TO_CHANGE: ${c.id} already sits ${seat}${agents.length ? ` with ${agents.join(", ")}` : ""} on ${tier ?? "no tier"}`);
  const lines = text.split("\n");
  const s = lines.findIndex((l) => /^seat:\s/.test(l));
  const bi = lines.findIndex((l) => /^binds:\s*$/.test(l));
  if (s < 0 || bi < 0) stop(2, "the role card has no top-level `seat:` or `binds:` line");
  lines[s] = `seat: ${quote(seat)}`;
  setBindsList(lines, bi, "agents", agents);
  let t = bi + 1;
  while (t < lines.length && /^\s/.test(lines[t]) && !/^  tier:/.test(lines[t])) t++;
  if (t >= lines.length || !/^  tier:/.test(lines[t])) stop(2, "the role card's binds has no `tier:` line");
  lines[t] = `  tier: ${tier === null ? "null" : quote(tier)}`;
  const out = lines.join("\n");
  const after = parseYamlSubset(out);
  const want = JSON.parse(JSON.stringify(c));
  want.seat = seat;
  want.binds.agents = agents;
  want.binds.tier = tier;
  if (!after.ok || JSON.stringify(after.value) !== JSON.stringify(want)) stop(2, "rewriting the card changed something else -- refusing");
  return { text: bom + (crlf ? out.split("\n").join("\r\n") : out), was };
}

const decode = (buf, what) => {
  try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf); } catch { stop(2, `${what} on main is not UTF-8 -- refusing to rewrite it`); }
};

/**
 * Everything the assign reads, from ONE main commit by plumbing (never the owner's checkout): every role card, the
 * agent files, the chart. One base for every read -- "validate one read, compare another" is the lane's fixed defect.
 */
async function readMainWorld() {
  const listed = await mainDirNames({ repo: REPO, dir: "org/roles" });
  const base = listed.base;
  return withGitReader(REPO, async (read) => {
    const ls = async (dir) => (await read(["ls-tree", "-r", "-z", "--name-only", base, "--", `${dir}/`])).out.split("\u0000").filter(Boolean);
    const show = async (path) => decode((await read(["show", `${base}:${path}`])).buf, path);
    const cards = [];
    for (const p of (await ls("org/roles")).filter((x) => /^org\/roles\/[^/]+\/[^/]+\.role\.yaml$/.test(x)).sort()) {
      const [, , dept, file] = p.split("/");
      const text = await show(p);
      const parsed = parseYamlSubset(text.replace(/^[\uFEFF]/, "").split("\r\n").join("\n"));
      if (!parsed.ok || !parsed.value || typeof parsed.value !== "object") stop(2, `${p} on main does not parse, so the chart cannot be rendered -- fix it first`);
      cards.push({ path: p, dept, stem: file.slice(0, -".role.yaml".length), text, card: parsed.value });
    }
    const agents = new Set((await ls(".claude/agents")).filter((x) => /^\.claude\/agents\/[^/]+\.md$/.test(x)).map((x) => x.slice(".claude/agents/".length, -3)));
    return { base, cards, agents, chartMd: await show("org/CHART.md"), chartJson: await show("org/chart.json") };
  });
}

let written = false;

/** Whether a local branch ref exists -- git's own answer; a failure to look is an error, never "no". */
const branchExists = (branch) => withGitReader(REPO, async (read) => (await read(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { ok: [0, 1] })).status === 0);

async function assignMain(argv) {
  const a = parseAssignArgs(argv);
  // THE TOOL'S OWN REPO, for the spine as for main (lane-status's PR 5b round-1 shell attack).
  if (process.env.ARC_SPINE_ROOT) process.env.ARC_SPINE_ROOT = resolve(process.env.ARC_SPINE_ROOT);
  process.chdir(REPO);
  const w = await readMainWorld();
  // A card is found by its id AND its file stem, across every department: two cards for one id fail org-coverage.
  const hits = w.cards.filter((x) => x.card.id === a.role || x.stem === a.role);
  if (!hits.length) stop(2, `NO_ROLE: no role card ${a.role} on main`);
  if (hits.length > 1) stop(2, `DUPLICATE_ID: ${a.role} is held by ${hits.map((x) => x.path).join(" and ")} -- org-coverage fails that; fix it by hand first`);
  const hit = hits[0];
  if (hit.card.id !== hit.stem) stop(2, `${hit.path}: its id ${JSON.stringify(hit.card.id)} differs from its file stem -- org-coverage fails that; fix it by hand first`);
  for (const n of a.agents) if (!w.agents.has(n)) stop(2, `NO_AGENT: "${n}" has no file in .claude/agents/ on main -- org-coverage fails a card that binds it`);
  const texts = new Map();
  for (const n of a.agents) texts.set(n, await withGitReader(REPO, async (read) => decode((await read(["show", `${w.base}:.claude/agents/${n}.md`])).buf, `.claude/agents/${n}.md`)));
  const tier = tierOfAgents(a.agents, texts);
  const set = assignCard(hit.text, { seat: a.seat, agents: a.agents, tier });
  // An agent this seat lets go must still sit somewhere: org-coverage fails an agent no role binds (REQ-01).
  const elsewhere = new Set(w.cards.filter((x) => x !== hit).flatMap((x) => (x.card.binds && Array.isArray(x.card.binds.agents) ? x.card.binds.agents : [])));
  const orphans = set.was.agents.filter((n) => !a.agents.includes(n) && !elsewhere.has(n));
  if (orphans.length) stop(2, `ORPHAN_AGENT: ${orphans.join(", ")} would sit in no role -- org-coverage fails that (REQ-01); seat them elsewhere first`);
  // The chart is rendered from the cards and CI's --chart --check fails a stale one: it moves on the same branch.
  const newCard = parseYamlSubset(set.text.replace(/^\uFEFF/, "").split("\r\n").join("\n")).value;
  const model = chartModel({ cards: w.cards.map((x) => ({ card: x === hit ? newCard : x.card })) });
  const files = [{ path: hit.path, content: set.text }];
  const md = renderChart(model), json = JSON.stringify(model, null, 2) + "\n";
  if (md !== w.chartMd) files.push({ path: "org/CHART.md", content: md });
  if (json !== w.chartJson) files.push({ path: "org/chart.json", content: json });
  const allow = files.map((f) => f.path);
  const branch = proposalBranch("org-seat", a.role);
  // ONE OPEN SEAT PROPOSAL: every one rewrites the shared chart, so two merged in turn conflict there (the board twin).
  // Every org writer's proposal, not only this mode's: hire-to-own rewrites a card too (attack a0bc939 B3).
  const ORG_PREFIXES = ["feat/face-org-seat-", "feat/face-org-own-"];
  const openOf = async () => [...new Set((await Promise.all(ORG_PREFIXES.flatMap((prefix) => ["org/chart.json", hit.path].map((path) => openProposalsChanging({ repo: REPO, prefix, path }))))).flat())].sort();
  const open = await openOf();
  if (open.length) stop(2, `a seat proposal is already open (${open.join(", ")}), and it holds the chart this one would rewrite -- merge or delete it first`);
  const checked = await checkProposal({ repo: REPO, branch, paths: allow, allow, base: w.base });
  if (checked.base !== w.base) stop(2, "main moved while the seat was set -- run it again");

  const from = `${set.was.seat}${set.was.agents.length ? ` (${set.was.agents.join(", ")})` : ""}`;
  const to = `${a.seat}${a.agents.length ? ` (${a.agents.join(", ")})` : ""}`;
  const tierMove = set.was.tier === tier ? `tier ${tier ?? "none"}` : `tier ${set.was.tier ?? "none"} -> ${tier ?? "none"} (derived from the agents, ADR-0069)`;
  const what = `role ${a.role}: seat ${from} -> ${to}; ${tierMove} (branch ${branch})`;
  if (Buffer.byteLength(what) > 512) stop(2, "the request's sentence is past 512 bytes -- bind fewer agents");
  const approval = { what, gate: "org-seat", adr: "ADR-1352", role: a.role, card_file: hit.path, seat: a.seat, agents: a.agents, tier, branch };
  const idem = createHash("sha256").update(`org.seat|${a.role}|${a.seat}|${a.agents.join(",")}|${w.base}`).digest("hex");
  const emitFlags = ["--idem", idem, "--strict"];
  let root;
  try { root = spineRoot(); } catch (e) { stop(2, `the spine cannot be found (${e && e.code ? e.code : "error"}) -- nothing was written`); }
  if (!existsSync(join(root, "events"))) stop(2, "the spine has no events folder -- point ARC_SPINE_ROOT at a spine; nothing was written");
  const spineEnv = { ...process.env, ARC_SPINE_ROOT: root };
  const arcEvent = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
  const requested = async () => {
    const read = await query(root, { engine: "scan" });
    if ((read.unreadable && read.unreadable.length) || (read.torn && read.torn.length)) stop(2, "the spine has a day it cannot read or a torn line, so an earlier request cannot be ruled out -- nothing was written");
    const evs = read.events.map((r) => r.event);
    const already = evs.find((e) => e && e.idem === idem);
    if (already) stop(2, `this seat change of ${a.role} is already requested on the spine (${already.id}) -- decide that one; nothing was written`);
    const decided = new Set(evs.filter((e) => e && e.kind === "decision.recorded" && e.payload && typeof e.payload.decides === "string").map((e) => e.payload.decides));
    const undecided = evs.find((e) => e && e.kind === "approval.requested" && e.payload && e.payload.gate === "org-seat" && e.payload.role === a.role && !decided.has(e.id));
    if (undecided) stop(2, `a seat change of ${a.role} is already in your inbox undecided (${undecided.id}) -- decide that one; nothing was written`);
  };
  await requested();
  const refused = spineRefusal(arcEvent, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags });
  if (refused) stop(2, `the request this raises would be refused by the spine, so nothing is written: ${refused}`);

  const message = `org: ${a.role} seat ${from} -> ${to} (a proposal, ADR-1352)\n\n${a.why ? `${a.why}\n\n` : ""}Only seat, binds.agents and binds.tier of the card change (${tierMove}); the chart is re-rendered from the cards so org-chart stays green when this merges.\nWritten by the face's work door (ADR-1352).`;
  const planned = planDigest({ branch, base: w.base, files, message, approval, idem });
  if (a.dryRun) {
    const p = await planProposal({ repo: REPO, branch, files, allow, base: w.base });
    const lines = [`org-own: would set ${what}`, `org-own: ${files.length} files on a new branch ${branch} off main ${w.base.slice(0, 12)}, then approval.requested[org-seat]`, "org-own: the commit message:", ...message.split("\n").map((l) => `  | ${l}`),
      p.diff.replace(/\n$/, ""), "org-own: dry run -- no branch, no object, no receipt was written", expectLine(planned)];
    process.stdout.write(lines.join("\n") + "\n");
    return 0;
  }
  const stale = staleReason(a.expect, planned);
  if (stale) stop(2, stale);
  let locks;
  try { locks = await proposalLocks({ repo: REPO }); } catch (e) { stop(2, `the lock directory cannot be found (${e && e.code ? e.code : "error"}) -- nothing was written`); }
  const held = await withExclusiveLock(locks, "org-seat.lock", async () => {
    const again = await openOf();
    if (again.length) stop(2, `a seat proposal was opened while this one was planned (${again.join(", ")}) -- nothing was written`);
    await requested();
    let wr;
    try {
      wr = await writeProposal({ repo: REPO, branch, files, allow, base: w.base, message,
        beforeRef: () => { const no = spineRefusal(arcEvent, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags }); if (no) stop(2, `the spine would refuse the request, so no branch was written: ${no}`); } });
    } catch (e) {
      // A throw after update-ref still left a branch (attack a0bc939 B2): ask the ref, then say so.
      if (await branchExists(branch)) { written = true; stop(1, `the branch ${branch} IS written, and then this failed: ${e && e.message ? e.message : e}`); }
      throw e;
    }
    written = true;
    process.stdout.write(`org-own: wrote ${branch} at ${wr.commit.slice(0, 12)} off main ${wr.base.slice(0, 12)}\n`);
    const got = emitReceipt(arcEvent, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags, timeoutMs: 60_000 });
    if (got.state === "refused") stop(1, `the branch ${branch} IS written, and its request was not raised -- ${got.why}`);
    if (got.state === "unknown") stop(1, `the branch ${branch} IS written, and whether its request landed is unknown -- ${got.why}. Look in your inbox before applying again`);
    if (!got.id) stop(1, `the branch ${branch} IS written, and its request landed without its id -- ${got.why}`);
    process.stdout.write(`receipt: approval.requested ${got.id}\n`);
  });
  if (held.busy) stop(2, "another seat is being written right now -- nothing was written; plan again when it is done");
  return 0;
}

async function main(argv) {
  if (argv[0] === "--assign") return assignMain(argv);
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
    if (!written && e instanceof ProposalError) { process.stderr.write(`org-own: ${e.code} -- ${e.message}\n`); process.exitCode = 2; return; }
    // After a branch is written, a failure is never "nothing was written" (lane-status's exit rule).
    process.stderr.write(written ? `org-own: the branch IS written, and then this failed: ${e && e.message ? e.message : e}\n` : `org-own: ${e && e.stack ? e.stack : e}\n`);
    process.exitCode = written ? 1 : 2;
  });
}
