#!/usr/bin/env node
/**
 * org-review.mjs -- every staffed seat scored from its own receipts (org Phase 01, REQ-05; ADR-1604).
 *
 *   --role R | --all        the scorecard: runs (ok/fail), accepts, rejects, incidents, cost, handoffs.
 *                           A role no receipt is placed on prints `no evidence` -- never 0% or 100%.
 *   --audit                 recompute every number by a second, independent counting pass over a
 *                           fresh read of the spine, and diff it; any difference exits 1.
 *   --checkpoint            the day-3 kill checkpoint: seated roles holding >= 1 run.completed or
 *                           decision verdict placed by a rule that names its source. < 3 exits 1.
 *   --kinds-table           for each kind the scorecard reads, whether its validator accepts an extra
 *                           payload.role -- tested on that kind's own live receipts (A-01).
 *   --spine-dir DIR         read this spine (read-only; this tool never emits). Default: the repo's.
 *   --since YYYY-MM-DD · --json · --root DIR
 *
 * Reads only. The map is `org/attribution.yaml`; a receipt it cannot place is counted unattributed.
 */
import { readFileSync, statSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";
import { collect } from "./org-coverage.mjs";
import { isStaffed } from "./lib/card.mjs";
import { validateMap, placeAll, scorecard, measuredRoles, namesSource } from "./lib/attribution.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
export const SCORED_KINDS = Object.freeze(["run.completed", "approval.requested", "decision.recorded", "incident.raised",
  "cost.incurred", "handoff.ready", "review.completed", "slice.done", "content.published", "outreach.sent", "lead.researched", "phase.closed", "kickoff.done"]);

// statSync, not lstat: a root reached through a symlink or junction is a directory to every caller (B8).
function isDir(p) { try { return statSync(p).isDirectory(); } catch { return false; } }

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

/** Load the map and the cards, validated. Returns { map, rules, cards, roleIds, findings }. */
export async function loadOrg(root) {
  const w = await collect(root);
  const cards = w.cards.map((c) => c.card).filter((c) => c && typeof c.id === "string");
  const roleIds = new Set(cards.map((c) => c.id));
  let text = null;
  // BOM dropped and CRLF folded, as every other org reader does: a map saved by Notepad is not a different map (logic attack L4).
  try { text = readFileSync(join(root, "org", "attribution.yaml"), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n"); } catch { /* reported below */ }
  if (text === null) return { findings: ["org/attribution.yaml is missing -- nothing can be placed"], cards, roleIds, rules: [] };
  const r = parseYamlSubset(text);
  if (!r.ok) return { findings: [`org/attribution.yaml: ${r.error.message}`], cards, roleIds, rules: [] };
  const findings = validateMap(r.value, roleIds, w.kinds);
  const digest = createHash("sha256").update(canonical(r.value)).digest("hex");
  return { findings, cards, roleIds, rules: r.value.rules, mapDigest: digest, kinds: w.kinds };
}

/** Read the spine through the ONE reader hq already ships (hq/spine.mjs scanAll), imported from the tree. */
export async function readSpine(root, spineDir) {
  const { scanAll } = await import(pathToFileURL(join(root, ".claude", "scripts", "hq", "spine.mjs")).href);
  const { events, torn, unreadable } = scanAll(spineDir);
  return { events: events.map((x) => x.event), torn, unreadable };
}

/** The --audit counter: deliberately NOT scorecard(). One loop, one tally per role, compared field by field. */
function independentTally(events, placements) {
  const t = new Map();
  const get = (r) => { if (!t.has(r)) t.set(r, { receipts: 0, runs: 0, runs_ok: 0, runs_fail: 0, accepts: 0, rejects: 0, incidents: 0, handoffs: 0, cost_receipts: 0 }); return t.get(r); };
  for (const e of events) {
    const p = placements.get(e.id);
    if (!p) continue;
    const x = get(p.role);
    x.receipts += 1;
    switch (e.kind) {
      case "run.completed": x.runs += 1; if (e.outcome === "ok") x.runs_ok += 1; if (e.outcome === "fail") x.runs_fail += 1; break;
      case "decision.recorded": if (e.payload?.verdict === "approve") x.accepts += 1; if (e.payload?.verdict === "reject") x.rejects += 1; break;
      case "incident.raised": x.incidents += 1; break;
      case "handoff.ready": x.handoffs += 1; break;
      case "cost.incurred": x.cost_receipts += 1; break;
      default: break;
    }
  }
  return t;
}

async function kindsTable(root, events) {
  const { validateEvent } = await import(pathToFileURL(join(root, ".claude", "scripts", "hq", "lib", "validate.mjs")).href);
  const rows = [];
  for (const kind of SCORED_KINDS) {
    const sample = events.find((e) => e.kind === kind);
    if (!sample) { rows.push({ kind, accepts_role: "untested", why: "no live receipt of this kind" }); continue; }
    // The control first: a sample the validator already refuses says nothing about payload.role,
    // and reading its refusal as "no" would blame the one field we added for someone else's fault.
    try { validateEvent(JSON.parse(JSON.stringify(sample))); }
    catch (e) { rows.push({ kind, accepts_role: "untested", why: `the live sample itself does not validate (${String(e.message || e).split("\n")[0].slice(0, 80)})` }); continue; }
    const probe = JSON.parse(JSON.stringify(sample));
    probe.payload = { ...(probe.payload || {}), role: "probe-role" };
    let ok = true, why = "";
    try { validateEvent(probe); } catch (e) { ok = false; why = String(e.message || e).split("\n")[0].slice(0, 120); }
    rows.push({ kind, accepts_role: ok ? "yes" : "no (map-only)", why });
  }
  return rows;
}

/**
 * ORG-G (ADR-1607): one verdict per STAFFED seat, derived from its scorecard -- a proposal, never an
 * action; nothing auto-renews and nothing auto-fires (A4's incident demotion already exists and is
 * not re-implemented here). Thresholds are small and stated so the owner can argue with them:
 *   no evidence                          -> keep   (nothing to judge; say so)
 *   any incident                         -> retrain
 *   >= 3 runs and 0 ok                   -> retire (seat back to vacant, agent to attic, A10)
 *   >= 3 runs and ok rate < 50%, or >= 3 decisions with rejects > accepts -> retrain
 *   >= 3 runs, ok rate >= 80%, accepts >= rejects, >= 3 SOURCED receipts -> promote (cite trial-ledger)
 *   otherwise                            -> keep
 * A seat whose review_by is still ahead is reported "not due" beside its verdict.
 */
export function verdictFor(s) {
  if (!s.evidence) return { verdict: "keep", why: "no evidence yet -- nothing to judge" };
  if (s.incidents > 0) return { verdict: "retrain", why: `${s.incidents} incident(s)` };
  const rate = s.runs ? s.runs_ok / s.runs : null;
  if (s.runs >= 3 && s.runs_ok === 0) return { verdict: "retire", why: `${s.runs} runs, none ok` };
  if ((s.runs >= 3 && rate < 0.5) || (s.accepts + s.rejects >= 3 && s.rejects > s.accepts))
    return { verdict: "retrain", why: `ok ${s.runs_ok}/${s.runs}, accepts ${s.accepts} vs rejects ${s.rejects}` };
  // Promotion needs work a role DID, not a clock that ran: heartbeat and kind-only receipts are unsourced.
  if (s.runs >= 3 && rate >= 0.8 && s.accepts >= s.rejects && s.sourced >= 3) return { verdict: "promote", why: `ok ${s.runs_ok}/${s.runs}, ${s.sourced} sourced receipt(s)` };
  if (s.runs >= 3 && rate >= 0.8 && s.sourced < 3) return { verdict: "keep", why: `ok ${s.runs_ok}/${s.runs} but ${s.sourced} sourced -- heartbeat evidence never promotes` };
  return { verdict: "keep", why: `ok ${s.runs_ok}/${s.runs}, accepts ${s.accepts}, rejects ${s.rejects}` };
}

function parseArgs(argv) {
  const o = { root: REPO, spineDir: null, role: null, all: false, audit: false, checkpoint: false, kinds: false, verdicts: false, json: false, since: null };
  // A flag given twice is an operator error, never last-wins (lanes.md; attack c7eddd6 B4).
  const given = new Set();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { if (given.has(argv[i])) throw new Error(`${argv[i]} given twice`); given.add(argv[i]); }
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`); return v; };
    if (a === "--role") o.role = val();
    else if (a === "--all") o.all = true;
    else if (a === "--audit") o.audit = true;
    else if (a === "--checkpoint") o.checkpoint = true;
    else if (a === "--kinds-table") o.kinds = true;
    else if (a === "--verdicts") o.verdicts = true;
    else if (a === "--json") o.json = true;
    else if (a === "--since") { o.since = val(); if (!/^\d{4}-\d{2}-\d{2}$/.test(o.since)) throw new Error("--since must be YYYY-MM-DD"); }
    else if (a === "--spine-dir") o.spineDir = val();
    else if (a === "--root") o.root = val();
    else throw new Error(`unknown flag ${JSON.stringify(a)} -- known flags are --role --all --audit --checkpoint --kinds-table --verdicts --json --since --spine-dir --root`);
  }
  const modes = [!!o.role, o.all, o.audit, o.checkpoint, o.kinds, o.verdicts].filter(Boolean).length;
  if (modes !== 1) throw new Error("exactly one of --role R, --all, --audit, --checkpoint, --kinds-table, --verdicts is required");
  return o;
}

async function defaultSpineDir(root) {
  const { spineRoot } = await import(pathToFileURL(join(root, ".claude", "scripts", "hq", "lib", "spine-io.mjs")).href);
  return spineRoot(); // refuses a linked worktree by design; pass --spine-dir to read the main clone's
}

const fmt = (s) => !s.evidence ? "no evidence" :
  `receipts ${s.receipts} (${s.sourced} sourced) · runs ${s.runs} (${s.runs_ok} ok, ${s.runs_fail} fail) · accepts ${s.accepts} · rejects ${s.rejects} · incidents ${s.incidents} · handoffs ${s.handoffs} · cost ${s.cost_minor === null ? "no evidence" : `${s.cost_minor} minor (${s.cost_receipts} receipt(s))`}`;

async function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`org-review: ${e.message}`); return 2; }
  if (!isDir(o.root)) { console.error(`org-review: no such directory: ${o.root}`); return 2; }
  const org = await loadOrg(o.root);
  if (org.findings.length) { for (const f of org.findings) console.log(`FAIL ${f}`); console.log(`org-review: the attribution map has ${org.findings.length} finding(s) -- nothing scored`); return 1; }
  let spineDir;
  try { spineDir = o.spineDir ?? await defaultSpineDir(o.root); } catch (e) { console.error(`org-review: ${e.message || e}`); return 2; }
  if (!isDir(spineDir)) { console.error(`org-review: no spine at ${spineDir}`); return 2; }
  const sp = await readSpine(o.root, spineDir);
  if (sp.torn.length || sp.unreadable.length) console.log(`WARN spine damage: ${sp.torn.length} torn line(s), ${sp.unreadable.length} unreadable day(s) -- reported, not scored`);
  const { placements, unattributed, conflicts } = placeAll(sp.events, org.rules, org.roleIds);
  for (const c of conflicts) console.log(`CONFLICT ${c}`);
  const byId = new Map(org.cards.map((c) => [c.id, c]));

  if (o.verdicts) {
    const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    const staffed = org.cards.filter(isStaffed);
    const tally = { keep: 0, promote: 0, retrain: 0, retire: 0 };
    for (const c of staffed) {
      const v = verdictFor(scorecard(c.id, sp.events, placements));
      tally[v.verdict]++;
      const due = typeof c.review_by === "string" && c.review_by <= today ? "due" : `not due (review_by ${c.review_by})`;
      // `id:` -- the colon ends the word run: arc-run's secret scan strips whitespace, and
      // "risk-analyst KEEP no evidence..." then reads as an OpenAI key (fixed-defects).
      console.log(`${`${c.id}:`.padEnd(25)} ${v.verdict.toUpperCase().padEnd(8)} ${v.why} -- ${due}`);
    }
    console.log(`org-review: ${staffed.length} staffed seat(s) -- keep ${tally.keep} · promote ${tally.promote} · retrain ${tally.retrain} · retire ${tally.retire}. Proposals only: the owner decides each (ADR-1607).`);
    return 0;
  }

  if (o.kinds) {
    const rows = await kindsTable(o.root, sp.events);
    if (o.json) console.log(JSON.stringify(rows, null, 2));
    else for (const r of rows) console.log(`${r.kind.padEnd(20)} payload.role: ${r.accepts_role}${r.why ? `  -- ${r.why}` : ""}`);
    return 0;
  }

  if (o.checkpoint) {
    const seated = new Set(org.cards.filter((c) => c.seat !== "vacant").map((c) => c.id));
    const hits = measuredRoles(sp.events, placements, seated);
    const sourcedRules = org.rules.filter(namesSource).length;
    console.log(`checkpoint: map digest ${org.mapDigest} (${org.rules.length} rules, ${sourcedRules} name their source)`);
    for (const [role, ids] of [...hits].sort((a, b) => b[1].length - a[1].length))
      console.log(`  ${role}: ${ids.length} receipt(s) -- ${ids.slice(0, 3).join(", ")}${ids.length > 3 ? ", ..." : ""}`);
    const n = hits.size;
    console.log(`checkpoint: ${n} seated role(s) measured from ${sp.events.length} receipts -- ${n >= 3 ? "PROCEED (>= 3)" : "STOP (< 3): the premise that roles can be measured is unproven"}`);
    return n >= 3 ? 0 : 1;
  }

  if (o.audit) {
    const again = await readSpine(o.root, spineDir); // a fresh read, not the same array
    const p2 = placeAll(again.events, org.rules, org.roleIds).placements;
    const tally = independentTally(again.events, p2);
    let diffs = 0;
    for (const c of org.cards) {
      const s = scorecard(c.id, sp.events, placements);
      const t = tally.get(c.id);
      if (!s.evidence && !t) continue;
      if (!s.evidence || !t) { diffs++; console.log(`DIFF ${c.id}: scorecard says ${s.evidence ? "evidence" : "no evidence"}, tally says ${t ? "evidence" : "none"}`); continue; }
      for (const k of Object.keys(t)) if (s[k] !== t[k]) { diffs++; console.log(`DIFF ${c.id}.${k}: scorecard ${s[k]} vs tally ${t[k]}`); }
    }
    console.log(`audit: ${org.cards.length} roles recomputed from ${again.events.length} receipts -- ${diffs} difference(s)`);
    return diffs ? 1 : 0;
  }

  const targets = o.role ? [o.role] : org.cards.map((c) => c.id);
  if (o.role && !byId.has(o.role)) { console.error(`org-review: no role "${o.role}"`); return 2; }
  const cards = targets.map((id) => ({ card: byId.get(id), s: scorecard(id, sp.events, placements, { since: o.since }) }));
  if (o.json) console.log(JSON.stringify({ unattributed, total: sp.events.length, roles: cards.map((x) => ({ ...x.s, seat: x.card.seat, staffed: isStaffed(x.card) })) }, null, 2));
  else {
    for (const { card, s } of cards) console.log(`${card.id.padEnd(24)} ${card.seat.padEnd(8)} ${fmt(s)}`);
    console.log(`org-review: ${cards.filter((x) => x.s.evidence).length} of ${cards.length} role(s) with evidence · unattributed ${unattributed} of ${sp.events.length} receipt(s)`);
  }
  return 0;
}

function isMainModule() {
  try {
    const invoked = process.argv[1];
    return !!invoked && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}
if (isMainModule()) process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });
if (isMainModule()) main().then((c) => { process.exitCode = c; }, (e) => { console.error(`org-review: ${e.stack || e}`); process.exitCode = 2; });
