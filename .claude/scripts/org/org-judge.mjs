#!/usr/bin/env node
/**
 * org-judge.mjs -- a department head's verdict on a worker's handed-off artifact, onto the spine (org Cycle 20
 * Phase 01, REQ-03, ADR-1627; ORG-O ADR-1615).
 *
 *   org-judge.mjs --head ROLE --receipt ULID --verdict accept|rework --reason TEXT
 *                 [--team VENTURE] [--root DIR] [--spine-dir DIR] [--dry-run]
 *
 * The judging is the head agent's own run; this records its verdict, and only where ORG-O allows one: the receipt is a
 * `handoff.ready`, its role (attribution map, then payload.role -- placeAll, never a second reader) is a staffed
 * worker reporting to this head on a team whose `heads:` names the head for its department, that department has >= 2
 * such workers, the head is not judging itself, and this head has not already judged this receipt.
 *
 * Every failed condition is listed, not the first; a refusal writes nothing. Exit 0 emitted (or a clean dry run),
 * 1 refused, 2 operator error.
 */
import { readdirSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collect } from "./org-coverage.mjs";
import { loadOrg, readSpine } from "./org-review.mjs";
import { readTeam } from "./org-team.mjs";
import { placeAll } from "./lib/attribution.mjs";
import { isStaffed } from "./lib/card.mjs";
import { isOneLine } from "../core/one-line.mjs";
import { emitReceipt, spineRefusal } from "../core/plan-expect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const ID_RE = /^[a-z][a-z0-9-]{0,63}$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const VERDICTS = Object.freeze(["accept", "rework"]);
export const MAX_REASON_BYTES = 2000;

class Usage extends Error {}

export function parseArgs(argv) {
  const o = { head: null, receipt: null, verdict: null, reason: null, team: null, root: REPO, spineDir: null, dryRun: false };
  const given = new Set();
  const take = (flag, i) => {
    if (given.has(flag)) throw new Usage(`${flag} given twice -- an operator error, never last-wins`);
    given.add(flag);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Usage(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--head") o.head = take(a, i++);
    else if (a === "--receipt") o.receipt = take(a, i++);
    else if (a === "--verdict") o.verdict = take(a, i++);
    else if (a === "--reason") o.reason = take(a, i++);
    else if (a === "--team") o.team = take(a, i++);
    else if (a === "--root") o.root = take(a, i++);
    else if (a === "--spine-dir") o.spineDir = take(a, i++);
    else if (a === "--dry-run") { if (given.has(a)) throw new Usage("--dry-run given twice"); given.add(a); o.dryRun = true; }
    else throw new Usage(`unknown option ${a}`);
  }
  for (const k of ["head", "receipt", "verdict", "reason"]) if (o[k] === null) throw new Usage(`--${k} is required`);
  return o;
}

/** Every team manifest stem under org/teams/, sorted. */
function teamStems(root) {
  try { return readdirSync(join(root, "org", "teams")).filter((n) => n.endsWith(".team.yaml")).map((n) => n.slice(0, -10)).sort(); }
  catch { return []; }
}

/**
 * Decide. Pure over what it is handed: { o, cards: Map, events, placements, teams: [{stem, doc}] }.
 * @returns {{ refusals: string[], payload?: object }}
 */
export function judge({ o, cards, events, placements, teams }) {
  const r = [];
  if (!ID_RE.test(o.head)) r.push(`BAD_HEAD: --head ${JSON.stringify(o.head)} is not a role id`);
  if (!ULID_RE.test(o.receipt)) r.push(`BAD_RECEIPT: --receipt ${JSON.stringify(o.receipt)} is not a receipt id`);
  if (!VERDICTS.includes(o.verdict)) r.push(`BAD_VERDICT: --verdict must be exactly accept or rework, not ${JSON.stringify(o.verdict)}`);
  if (!isOneLine(o.reason) || !o.reason.trim()) r.push("BAD_REASON: --reason must be one non-empty line with no control or format characters");
  else if (Buffer.byteLength(o.reason, "utf8") > MAX_REASON_BYTES) r.push(`BAD_REASON: --reason is over ${MAX_REASON_BYTES} bytes`);

  const headCard = cards.get(o.head);
  if (ID_RE.test(o.head) && !headCard) r.push(`NO_HEAD: no role card has id "${o.head}"`);

  const ev = ULID_RE.test(o.receipt) ? events.find((e) => e.id === o.receipt) : null;
  if (ULID_RE.test(o.receipt) && !ev) r.push(`NO_RECEIPT: ${o.receipt} is not on the spine`);
  else if (ev && ev.kind !== "handoff.ready") r.push(`NOT_HANDOFF: ${o.receipt} is a ${ev.kind}, and a head judges only handoff.ready`);
  const worker = ev ? placements.get(ev.id)?.role ?? null : null;
  if (ev && ev.kind === "handoff.ready" && !worker) r.push(`UNPLACED: ${o.receipt} is placed on no role (attribution map, then payload.role)`);
  if (worker && worker === o.head) r.push(`SELF_JUDGE: ${o.head} cannot judge its own artifact`);

  // The team: named, or the one team on which this head heads this worker. Two candidates is ambiguous, never a pick.
  const fits = (doc) => {
    if (!doc || !headCard || !doc.heads || doc.heads[headCard.dept] !== o.head) return false;
    const onShift = new Set(Object.values(doc.on_shift || {}).flat());
    return worker ? onShift.has(worker) : true;
  };
  let team = null;
  if (o.team !== null) {
    team = teams.find((t) => t.stem === o.team) || null;
    if (!team) r.push(`NO_TEAM: org/teams/${o.team}.team.yaml does not exist or does not parse`);
  } else if (headCard) {
    const cands = teams.filter((t) => fits(t.doc));
    if (cands.length === 0) r.push(`NO_TEAM: no team manifest names ${o.head} under heads.${headCard.dept}${worker ? ` with ${worker} on shift` : ""}`);
    else if (cands.length > 1) r.push(`AMBIGUOUS_TEAM: ${cands.map((t) => t.stem).join(", ")} all fit -- name one with --team`);
    else team = cands[0];
  }
  if (team && headCard) {
    const doc = team.doc;
    if (!doc.heads || doc.heads[headCard.dept] !== o.head) r.push(`NOT_HEAD: team ${team.stem} does not name ${o.head} under heads.${headCard.dept}`);
    const onShift = new Set(Object.values(doc.on_shift || {}).flat());
    const workers = [...onShift].map((id) => cards.get(id)).filter((c) => c && c.reports_to === o.head && isStaffed(c));
    if (workers.length < 2) r.push(`ORG_O: ${o.head} heads ${workers.length} staffed worker(s) on team ${team.stem} -- a head needs >= 2 (ADR-1615)`);
    if (worker && !workers.some((c) => c.id === worker)) r.push(`NOT_WORKER: ${worker} is not a staffed worker reporting to ${o.head} on team ${team.stem}`);
  }
  // One verdict per artifact per head: a second is refused, never a silent overwrite.
  if (ULID_RE.test(o.receipt) && events.some((e) => e.kind === "review.completed" && e.payload?.role === o.head && e.payload?.subject_receipt === o.receipt))
    r.push(`ALREADY_JUDGED: ${o.head} already recorded a verdict on ${o.receipt}`);

  if (r.length) return { refusals: r };
  return { refusals: [], payload: { role: o.head, subject_role: worker, subject_receipt: o.receipt, verdict: o.verdict, reason: o.reason, team: team.stem } };
}

async function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { if (e instanceof Usage) { console.error(`org-judge: ${e.message}`); return 2; } throw e; }
  const root = o.root;
  const org = await loadOrg(root);
  if (org.findings && org.findings.length) {
    console.error(`org-judge: REFUSED -- the attribution map has ${org.findings.length} finding(s), so no receipt can be placed:`);
    for (const f of org.findings.slice(0, 5)) console.error(`  ${f}`);
    return 1;
  }
  let spineDir = o.spineDir;
  if (!spineDir) {
    try {
      const { spineRoot } = await import(pathToFileURL(join(root, ".claude", "scripts", "hq", "lib", "spine-io.mjs")).href);
      spineDir = spineRoot();
    } catch (e) {
      console.error(`org-judge: REFUSED -- no spine to read (${e && e.code ? e.code : "error"}); run from the main clone or pass --spine-dir`);
      return 1;
    }
  }
  const sp = await readSpine(root, spineDir);
  const { placements } = placeAll(sp.events, org.rules, org.roleIds);
  const w = await collect(root);
  const cards = new Map(w.cards.map((c) => [c.card?.id, c.card]).filter(([id]) => typeof id === "string"));
  const teams = teamStems(root).map((stem) => ({ stem, doc: readTeam(root, stem).doc || null }));
  const d = judge({ o, cards, events: sp.events, placements, teams });
  if (d.refusals.length) {
    console.log(`org-judge: REFUSED -- ${d.refusals.length} condition(s) failed, nothing emitted:`);
    for (const x of d.refusals) console.log(`  ${x}`);
    return 1;
  }
  const arcEvent = join(root, ".claude", "scripts", "hq", "arc-event.mjs");
  // The emit writes to the SAME spine the receipt, the placements and the one-verdict check were read from: a verdict
  // judged on one spine and landed on another passed its dedupe every time (attack bc27378 B1).
  const emitOpts = { cwd: root, env: { ...process.env, ARC_SPINE_ROOT: spineDir } };
  const refused = spineRefusal(arcEvent, "review.completed", d.payload, emitOpts);
  if (refused) { console.log(`org-judge: REFUSED -- the spine would refuse this verdict: ${refused}`); return 1; }
  if (o.dryRun) {
    console.log(`org-judge: would emit review.completed ${JSON.stringify(d.payload)}`);
    console.log("org-judge: dry run -- nothing emitted");
    return 0;
  }
  const r = emitReceipt(arcEvent, "review.completed", d.payload, emitOpts);
  if (r.state !== "landed") { console.log(`org-judge: NOT RECORDED (${r.state}) -- ${r.why}`); return 1; }
  console.log(`org-judge: review.completed ${r.id ?? "(id line lost)"} -- ${o.head} ${o.verdict}s ${d.payload.subject_role}'s ${o.receipt}`);
  return 0;
}

function isMainModule() {
  try {
    const invoked = process.argv[1];
    return !!invoked && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}
if (isMainModule()) process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });
if (isMainModule()) main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(`org-judge: ${e.stack || e}`); process.exitCode = 2; });
