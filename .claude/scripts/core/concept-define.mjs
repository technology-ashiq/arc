#!/usr/bin/env node
// concept-define.mjs -- define a term: homed in a room and a station on its line, as a reviewed edit to the face's
// contract on a proposal branch (face v2 Phase 05 PR 5b, ADR-1343).
//
//   concept-define.mjs --term T --room R --station S [--why TEXT] (--dry-run | --expect D)
//
// The contract is frozen: a new word lands by a reviewed diff to it, never from a screen. So the branch carries the
// contract's concepts.map with the term added and what the contract derives (face-sections -- a new station is a new
// stop on its room's line), so main stays green on face-coverage when it merges. The room must be a BUILT room: a term
// homed in a planned one is "unhomed", a search result that opens nothing. The receipt is approval.requested (gate
// concept-define) for the owner's inbox.
//
//   --dry-run   the diffs against main and the digest last
//   --expect D  writes only if that digest still holds (PLAN_STALE otherwise)
//
// Exit: 0 done · 1 the branch IS written and its receipt is not (said so) · 2 refused, nothing written.

import { createHash } from "node:crypto";
import { existsSync, realpathSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { baseText, checkProposal, mainDirNames, openProposalsChanging, planProposal, proposalBranch, writeProposal, ProposalError } from "./proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal, emitReceipt, withExclusiveLock } from "./plan-expect.mjs";
import { isOneLine } from "./one-line.mjs";
import { deriveFromContract } from "./face-sections.mjs";
import { query, spineRoot } from "../hq/spine.mjs";
import { scrub } from "../hq/lib/face/reads.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const CONTRACT = "initiatives/face/contracts/expected-set.json";
const ROOM_COPY = "initiatives/face/contracts/room-copy.json";
const REGISTRY = "initiatives/face/contracts/rooms.generated.json";
const STATION_RE = /^[A-Za-z0-9][A-Za-z0-9 .-]{0,39}$/;
// ALLOW-LISTED, because the contract is published: a scrub-only test let "C://Users/x", a full-width @ address and a
// zero-width twin of "ULID" in (PR 5b round-1 shell attack). ASCII only, the punctuation the glossary's own terms use
// ("line / station", "Why? precedents", "50% tripwire", "face: section") -- and never a path's shape.
const TERM_RE = /^[A-Za-z0-9][A-Za-z0-9 ./()?%:&+-]{0,59}$/;
const PATH_SHAPE = /\/\/|\.\.|:(?! |$)|^[/~]/;
const WORDS = /^[A-Za-z0-9][A-Za-z0-9 ,.()'#%+&-]*$/;

class Stop extends Error {}
const out = [];
const say = (s) => out.push(s);
// SYNCHRONOUS, and a closed stderr is not a crash (the lane-status twin, PR 5b round 1).
const err = (s) => { try { writeSync(2, s); } catch { /* the words are lost; the exit code is not */ } };
function die(code, msg) { err(`concept-define: ${msg}\n`); process.exitCode = code; throw new Stop(); }
let written = false;

function parseArgs(argv) {
  const a = { term: "", room: "", station: "", why: "", expect: undefined, dryRun: false };
  const known = ["--term", "--room", "--station", "--why", "--expect"];
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
  // A term is the palette's search key: one line, no pipe or backtick (the glossary renders it in tables and code), no
  // padding, short. The contract is published, so the scrub is a second test.
  if (!isOneLine(a.term) || a.term !== a.term.trim() || !TERM_RE.test(a.term) || PATH_SHAPE.test(a.term))
    die(2, "--term is up to 60 ASCII letters, digits, spaces and . / ( ) ? % : & + - (no | or backtick), and never a path's shape");
  if (scrub(a.term, REPO) !== a.term) die(2, "--term names a machine path or an address, and the contract is published -- say it without one");
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(a.room)) die(2, `--room ${JSON.stringify(a.room)} is a room id (lowercase kebab)`);
  if (!STATION_RE.test(a.station) || a.station !== a.station.trim()) die(2, "--station is a stop on the room's line: letters, digits, spaces, . and -, up to 40 characters");
  // The why goes into the commit message, which the plan shows and a merge publishes: plain words.
  if (a.why && (!WORDS.test(a.why) || a.why !== a.why.trim() || Buffer.byteLength(a.why) > 300 || scrub(a.why, REPO) !== a.why))
    die(2, "--why is plain words (letters, digits, spaces and , . ( ) ' # % + & -), up to 300 bytes");
  return a;
}

/** Main's text of one file, or a refusal naming it. */
async function mainText(path) {
  const r = await baseText({ repo: REPO, path });
  if (r.text === null) die(2, `${path} is not on main`);
  return r;
}

/** JSON as the generator writes it: two-space, one trailing newline. */
const canonical = (value) => JSON.stringify(value, null, 2) + "\n";

/** The contract with the term homed: one structural change, over the canonical file. */
export function addConcept(text, term, room, station) {
  let c;
  try { c = JSON.parse(text); } catch { die(2, `${CONTRACT} on main is not JSON`); }
  if (canonical(c) !== text) die(2, `${CONTRACT} on main is not in the canonical form the generator writes -- regenerate it first`);
  const map = c.concepts && c.concepts.map;
  if (!map || typeof map !== "object" || Array.isArray(map)) die(2, "the contract has no concepts.map");
  // ONE term per word, whatever its case: the palette's fold is case-blind, so "ULID" and "ulid" would be one hit twice.
  // Blind to spacing too: "idem  key" beside "idem key" was a second hit that reads the same (PR 5b round-1 logic attack).
  const fold = (t) => t.toLowerCase().replace(/\s+/g, " ");
  const same = Object.keys(map).find((k) => fold(k) === fold(term));
  if (same !== undefined) die(2, `${JSON.stringify(same)} is already a term, homed in ${map[same] && map[same].room} -- a word is defined once`);
  const list = c.rooms && Array.isArray(c.rooms.list) ? c.rooms.list : [];
  const tpl = c.rooms && c.rooms.template && c.rooms.template.id;
  const row = list.find((r) => r && r.id === room);
  if (room !== tpl && !(row && row.status === "built"))
    die(2, row ? `${room} is a planned room -- a term homed there is unhomed, a search result that opens nothing` : `${room} is not a room in the contract`);
  // A station is a stop on the room's line: "kpi row" beside "KPI row" added a second stop that reads the same.
  const stop = Object.values(map).map((v) => v && v.room === room ? v.station : null).find((s) => typeof s === "string" && s !== station && fold(s) === fold(station));
  if (stop !== undefined) die(2, `${room} already has the stop ${JSON.stringify(stop)} -- use that spelling`);
  const value = { ...c, concepts: { ...c.concepts, map: { ...map, [term]: { room, station } } } };
  return { text: canonical(value), value };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  // THE TOOL'S OWN REPO, for the spine as for main (the lane-status twin). A relative ARC_SPINE_ROOT means the caller's.
  if (process.env.ARC_SPINE_ROOT) process.env.ARC_SPINE_ROOT = resolve(process.env.ARC_SPINE_ROOT);
  process.chdir(REPO);
  // The branch is named by a slug of the term: its letters and digits, lowercased, hyphen-joined.
  const slug = a.term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "term";
  const branch = proposalBranch("concept-define", slug);
  const [contract, copy, registry] = await Promise.all([mainText(CONTRACT), mainText(ROOM_COPY), mainText(REGISTRY)]);
  const base = contract.base;
  if ([copy, registry].some((r) => r.base !== base)) die(2, "main moved while its files were read -- run it again");
  const k = addConcept(contract.text, a.term, a.room, a.station);

  // EVERYTHING THE CONTRACT DERIVES rides on the branch too, from main's manifests (the add-agent rule, PR 4).
  let copyValue;
  try { copyValue = JSON.parse(copy.text); } catch { die(2, `${ROOM_COPY} on main is not JSON`); }
  const listed = await mainDirNames({ repo: REPO, dir: "products" });
  if (listed.base !== base) die(2, "main moved while its files were read -- run it again");
  const manifests = {};
  for (const name of listed.names.filter((n) => /^[a-z][a-z0-9-]{0,40}$/.test(n))) {
    const r = await baseText({ repo: REPO, path: `products/${name}/manifest.json` });
    if (r.base !== base) die(2, "main moved while its files were read -- run it again");
    if (r.text !== null) manifests[name] = r.text;
  }
  // MAIN'S DERIVED FILES MUST BE MAIN'S CONTRACT'S FIRST: a drift already on main rode along with "define a term in
  // today" and was approved under that sentence (PR 5b round-1 logic attack; the register's criteria twin, PR 5a).
  let mainContract;
  try { mainContract = JSON.parse(contract.text); } catch { die(2, `${CONTRACT} on main is not JSON`); }
  const onMain = deriveFromContract(mainContract, copyValue, manifests);
  const drifted = [...Object.keys(onMain.manifests).filter((n) => onMain.manifests[n] !== manifests[n]).map((n) => `products/${n}/manifest.json`), ...(registry.text === onMain.registryText ? [] : [REGISTRY])];
  if (drifted.length) die(2, `main's derived files already drift from its contract (${drifted.join(", ")}) -- regenerate them on main first, so this branch carries only the term`);
  const derived = deriveFromContract(k.value, copyValue, manifests);
  const files = [
    { path: CONTRACT, content: k.text },
    ...Object.keys(derived.manifests).filter((n) => derived.manifests[n] !== manifests[n]).map((n) => ({ path: `products/${n}/manifest.json`, content: derived.manifests[n] })),
    ...(registry.text === derived.registryText ? [] : [{ path: REGISTRY, content: derived.registryText }]),
  ];
  // ONE OPEN DEFINITION at a time: two branches each adding a term to the one contract conflict when both merge. Judged
  // by what a branch CHANGED and main does not hold yet -- "holds the contract" is true of every branch, so a merged
  // definition refused every later one (PR 5b round-1 shell attack).
  const openOf = () => openProposalsChanging({ repo: REPO, prefix: "feat/face-concept-define-", path: CONTRACT });
  const open = await openOf();
  if (open.length) die(2, `a definition is already open (${open.join(", ")}) -- merge or delete it first`);
  const allow = files.map((f) => f.path);
  const checked = await checkProposal({ repo: REPO, branch, paths: allow, allow, base });
  if (checked.base !== base) die(2, "main moved while the term was defined -- run it again");

  const what = `define "${a.term}": homed in ${a.room}, at ${a.station} (branch ${branch})`;
  if (Buffer.byteLength(what) > 512) die(2, "the request's sentence is past 512 bytes -- shorten the term");
  const approval = { what, gate: "concept-define", term: a.term, room: a.room, station: a.station, branch };
  const idem = createHash("sha256").update(`concept.define|${a.term}|${a.room}|${a.station}|${base}`).digest("hex");
  const emitFlags = ["--idem", idem, "--strict"];
  // ONE spine that exists, for the read, the lock and the emit (the lane-status twin).
  let root;
  try { root = spineRoot(); } catch (e) { die(2, `the spine cannot be found (${e && e.code ? e.code : "error"}) -- nothing was written`); }
  if (!existsSync(join(root, "events"))) die(2, "the spine has no events folder -- point ARC_SPINE_ROOT at a spine; nothing was written");
  const spineEnv = { ...process.env, ARC_SPINE_ROOT: root };
  const requested = async () => {
    const read = await query(root, { kind: "approval.requested", engine: "scan" });
    if ((read.unreadable && read.unreadable.length) || (read.torn && read.torn.length)) die(2, "the spine has a day it cannot read or a torn line, so an earlier request cannot be ruled out -- nothing was written");
    const already = read.events.map((r) => r.event).find((e) => e && e.idem === idem);
    if (already) die(2, `this definition is already requested on the spine (${already.id}) -- decide that one; nothing was written`);
  };
  await requested();
  const refused = spineRefusal(ARC_EVENT, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags });
  if (refused) die(2, `the request this raises would be refused by the spine, so nothing is written: ${refused}`);

  const message = `concepts: define "${a.term}" in ${a.room}, at ${a.station} (a proposal)\n\n${a.why ? `${a.why}\n\n` : ""}The face contract's concepts.map with the term homed, and what the contract derives (face-sections), so face-coverage stays green when this merges.\nWritten by the face's work door (ADR-1343).`;
  const planned = planDigest({ branch, base, files, message, approval, idem });
  if (a.dryRun) {
    const plan = await planProposal({ repo: REPO, branch, files, allow, base });
    say(`concept-define: would define "${a.term}" in ${a.room}, at ${a.station}`);
    say(`concept-define: ${files.length} files on a new branch ${branch} off main ${base.slice(0, 12)}, then approval.requested[concept-define]`);
    // The commit message is part of what merges: the plan shows it (the PR 4 round-3 rule).
    say("concept-define: the commit message:");
    for (const l of message.split("\n")) say(`  | ${l}`);
    say(plan.diff.replace(/\n$/, ""));
    say("concept-define: dry run -- no branch, no object, no receipt was written");
    say(expectLine(planned));
    return;
  }
  if (a.expect === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, read the diff, then run it again with the --expect it prints");
  const stale = staleReason(a.expect, planned);
  if (stale) die(2, stale);
  // ONE WRITER AT A TIME, the open check again inside: two definitions checked then written side by side both passed.
  const held = await withExclusiveLock(join(root, "locks"), "concept-define.lock", async () => {
    const again = await openOf();
    if (again.length) die(2, `a definition was opened while this one was planned (${again.join(", ")}) -- nothing was written`);
    await requested();
    const w = await writeProposal({ repo: REPO, branch, files, allow, base, message,
      beforeRef: () => { const no = spineRefusal(ARC_EVENT, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags }); if (no) die(2, `the spine would refuse the request, so no branch was written: ${no}`); } });
    written = true;
    say(`concept-define: wrote ${branch} at ${w.commit.slice(0, 12)} off main ${w.base.slice(0, 12)}`);
    const got = emitReceipt(ARC_EVENT, "approval.requested", approval, { cwd: REPO, env: spineEnv, flags: emitFlags, timeoutMs: 60_000 });
    if (got.state === "refused") die(1, `the branch ${branch} IS written, and its request was not raised -- ${got.why}`);
    if (got.state === "unknown") die(1, `the branch ${branch} IS written, and whether its request landed is unknown -- ${got.why}. Look in your inbox before applying again`);
    if (!got.id) die(1, `the branch ${branch} IS written, and its request landed without its id -- ${got.why}`);
    say(`receipt: approval.requested ${got.id}`);
  });
  if (held.busy) die(2, "another definition is being written right now -- nothing was written; plan again when it is done");
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (e instanceof Stop) { /* exitCode set */ }
    else if (!written && e instanceof ProposalError) { err(`concept-define: ${e.code} -- ${e.message}\n`); process.exitCode = 2; }
    else {
      const why = e instanceof Error ? e.message : String(e);
      err(written ? `concept-define: the branch IS written, and then this failed: ${why}\n` : `concept-define: nothing was written: ${why}\n`);
      process.exitCode = written ? 1 : 2;
    }
  }
  // A reader that closed its end loses these lines, never the outcome: the exit code is already set.
  if (out.length) { try { writeSync(1, out.join("\n") + "\n"); } catch { /* the lines are lost; the effect and its exit are not */ } }
}
