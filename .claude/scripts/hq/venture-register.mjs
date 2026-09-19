#!/usr/bin/env node
// venture-register.mjs -- register a venture: its kill lines written before its first launch, on a proposal branch
// (face v2 Phase 05 PR 5, ADR-1342).
//
//   venture-register.mjs --slug S --days-without-revenue N --traffic-floor M --repository TEXT [--why TEXT]
//                        (--dry-run | --expect D)
//
// "venture.registered makes a candidate, and its kill line is written before its first launch." There is no such kind:
// a venture exists where ventures.yaml gives it kill lines (ADR-1008), PORTFOLIO.md gives it a passport row (the two
// sets stay identical, ADR-0059), and the face's contract seats it in the ventures room. So the branch carries those
// three changes, each computed from main's own bytes, plus what the contract derives (face-sections), so main stays
// green when it merges -- through the one proposal writer, the owner's tree untouched. Then the ONE receipt the ledger
// already has for a criteria change: approval.requested under the ledger.criteria profile (ADR-1017), carrying the
// digest the new ventures.yaml parses to, with its welded idem. Approved and merged, the kill panel renders the new
// venture; merged and not approved, the panel refuses (UNRECEIPTED) -- the mechanism working.
//
//   --dry-run   the diffs against main, the approval judged by the spine, and the digest last
//   --expect D  writes only if that digest still holds (PLAN_STALE otherwise)
//
// Exit: 0 done · 1 the branch IS written and its receipt is not (said so) · 2 refused, nothing written.

import { createHash } from "node:crypto";
import { realpathSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { baseText, checkProposal, mainDirNames, planProposal, proposalBranch, writeProposal, ProposalError } from "../core/proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal, emitReceipt } from "../core/plan-expect.mjs";
import { isOneLine } from "../core/one-line.mjs";
import { deriveFromContract } from "../core/face-sections.mjs";
import { parseVentures, MAX_CRITERION_VALUE } from "./lib/ledger/ventures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const VENTURES = "ventures.yaml";
const PORTFOLIO = "PORTFOLIO.md";
const CONTRACT = "initiatives/face/contracts/expected-set.json";
const ROOM_COPY = "initiatives/face/contracts/room-copy.json";
const REGISTRY = "initiatives/face/contracts/rooms.generated.json";
const SLUG_RE = /^[a-z][a-z0-9-]{1,40}$/;
const PASSPORT_HEAD = "| venture | repository | current status | next |";

class Stop extends Error {}
const out = [];
const say = (s) => out.push(s);
function die(code, msg) { process.stderr.write(`venture-register: ${msg}\n`); process.exitCode = code; throw new Stop(); }
let written = false;

function parseArgs(argv) {
  const a = { slug: "", "days-without-revenue": "", "traffic-floor": "", repository: "", why: "", expect: undefined, dryRun: false };
  const known = ["--slug", "--days-without-revenue", "--traffic-floor", "--repository", "--why", "--expect"];
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
  if (!SLUG_RE.test(a.slug)) die(2, `--slug ${JSON.stringify(a.slug)} is a venture slug (lowercase kebab, 2-41 characters)`);
  // "arc" is the factory's own overhead venture: never attributed to a product, never registered as one.
  if (a.slug === "arc") die(2, "--slug arc is the factory's overhead, never a venture");
  for (const k of ["days-without-revenue", "traffic-floor"]) {
    if (!/^[1-9][0-9]{0,6}$/.test(a[k]) || Number(a[k]) > MAX_CRITERION_VALUE) die(2, `--${k} is a whole number from 1 to ${MAX_CRITERION_VALUE}`);
    a[k] = Number(a[k]);
  }
  // A table cell: one line, no pipe (it would split the row), and short.
  if (!a.repository || !isOneLine(a.repository) || a.repository.includes("|") || Buffer.byteLength(a.repository) > 120)
    die(2, "--repository is one line of text, up to 120 bytes, with no | and no control or invisible characters");
  if (a.why && (!isOneLine(a.why) || Buffer.byteLength(a.why) > 300)) die(2, "--why is one line of text, up to 300 bytes, with no control or invisible characters");
  return a;
}

/** Main's text of one file, or a refusal naming it. */
async function mainText(path) {
  const r = await baseText({ repo: REPO, path });
  if (r.text === null) die(2, `${path} is not on main`);
  return r;
}

/** A text file main holds as plain LF lines, or a refusal: an edit here is one insertion, never a reformat. */
function plainLf(path, text) {
  if (text.startsWith("﻿") || text.includes("\r") || !text.endsWith("\n")) die(2, `${path} on main is not plain LF lines with a final newline -- fix it before registering a venture`);
  return text;
}

/**
 * ventures.yaml with the venture's block appended, PROVEN by the ledger's own parser: the new text must parse to exactly
 * main's ventures plus this one, with these values. A file whose last top-level key is not `ventures:` would misplace
 * the block, and the parse-back refuses it rather than trusting where the text landed.
 */
export function addToVentures(text, slug, days, floor) {
  plainLf(VENTURES, text);
  let before;
  try { before = parseVentures(text); } catch (e) { die(2, `${VENTURES} on main does not parse (${e && e.code ? e.code : "error"}) -- fix it first`); }
  if (Object.hasOwn(before.ventures, slug)) die(2, `${slug} is already in ${VENTURES} -- a venture is registered once`);
  const next = `${text}  ${slug}:\n    kill:\n      days_without_revenue: ${days}\n      traffic_floor_monthly: ${floor}\n`;
  let after;
  try { after = parseVentures(next); } catch (e) { die(2, `${VENTURES} with the new block does not parse (${e && e.code ? e.code : "error"}) -- its last top-level key must be ventures:`); }
  const want = [...Object.keys(before.ventures), slug].sort();
  const got = Object.keys(after.ventures).sort();
  const kept = Object.keys(before.ventures).every((v) => JSON.stringify(before.ventures[v]) === JSON.stringify(after.ventures[v]));
  const mine = after.ventures[slug];
  if (JSON.stringify(want) !== JSON.stringify(got) || !kept || !mine || mine.kill.days_without_revenue !== days || mine.kill.traffic_floor_monthly !== floor)
    die(2, `${VENTURES} with the new block does not read back as main's ventures plus ${slug} -- not written`);
  return { text: next, before, after };
}

/** The passport table's venture names, and where a new row goes (after its last row). */
function passports(text) {
  const lines = text.split("\n");
  const head = lines.indexOf(PASSPORT_HEAD);
  if (head < 0 || !/^\|(---\|){4}$/.test(lines[head + 1] || "")) die(2, `${PORTFOLIO} on main has no "Venture passports" table (${PASSPORT_HEAD}) -- fix it first`);
  let end = head + 2;
  const names = [];
  while (end < lines.length && lines[end].startsWith("|")) {
    const cell = lines[end].split("|")[1];
    names.push((cell || "").trim());
    end++;
  }
  return { lines, end, names };
}

/** PORTFOLIO.md with the venture's passport row after the table's last row. */
export function addToPortfolio(text, slug, repository) {
  plainLf(PORTFOLIO, text);
  const t = passports(text);
  if (t.names.includes(slug)) die(2, `${slug} already has a passport row in ${PORTFOLIO}`);
  const lines = [...t.lines];
  lines.splice(t.end, 0, `| ${slug} | ${repository} | candidate -- registered, not launched | — |`);
  return { text: lines.join("\n"), names: t.names };
}

/** JSON as the generator writes it: two-space, one trailing newline. */
const canonical = (value) => JSON.stringify(value, null, 2) + "\n";

/** The contract with the venture seated in the ventures room: one structural change, over the canonical file. */
export function addToContract(text, slug) {
  let c;
  try { c = JSON.parse(text); } catch { die(2, `${CONTRACT} on main is not JSON`); }
  if (canonical(c) !== text) die(2, `${CONTRACT} on main is not in the canonical form the generator writes -- regenerate it first`);
  const map = c.ventures && c.ventures.map;
  if (!map || typeof map !== "object" || Array.isArray(map)) die(2, "the contract has no ventures.map");
  if (Object.hasOwn(map, slug)) die(2, `${slug} already has a room in the contract's ventures.map`);
  const value = { ...c, ventures: { ...c.ventures, map: { ...map, [slug]: "ventures" } } };
  return { text: canonical(value), value, names: Object.keys(map) };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const branch = proposalBranch("ventures-register", a.slug);
  const [ventures, portfolio, contract, copy, registry] = await Promise.all([mainText(VENTURES), mainText(PORTFOLIO), mainText(CONTRACT), mainText(ROOM_COPY), mainText(REGISTRY)]);
  const base = ventures.base;
  if ([portfolio, contract, copy, registry].some((r) => r.base !== base)) die(2, "main moved while its files were read -- run it again");

  const v = addToVentures(ventures.text, a.slug, a["days-without-revenue"], a["traffic-floor"]);
  const p = addToPortfolio(portfolio.text, a.slug, a.repository);
  const k = addToContract(contract.text, a.slug);
  // THE THREE SETS AGREE ON MAIN before one venture joins all three: a passport row with no kill line, or a kill line
  // with no passport, is the assumption-ledger trigger ventures.yaml names -- not a state to build on.
  const setOf = (xs) => JSON.stringify([...new Set(xs)].sort());
  if (setOf(Object.keys(v.before.ventures)) !== setOf(p.names) || setOf(p.names) !== setOf(k.names))
    die(2, `the ventures on main disagree (ventures.yaml: ${Object.keys(v.before.ventures).join(", ")}; passports: ${p.names.join(", ")}; the contract: ${k.names.join(", ")}) -- make them one set before registering another`);

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
  const derived = deriveFromContract(k.value, copyValue, manifests);
  const files = [
    { path: VENTURES, content: v.text },
    { path: PORTFOLIO, content: p.text },
    { path: CONTRACT, content: k.text },
    ...Object.keys(derived.manifests).filter((n) => derived.manifests[n] !== manifests[n]).map((n) => ({ path: `products/${n}/manifest.json`, content: derived.manifests[n] })),
    ...(registry.text === derived.registryText ? [] : [{ path: REGISTRY, content: derived.registryText }]),
  ];
  const allow = files.map((f) => f.path);
  const checked = await checkProposal({ repo: REPO, branch, paths: allow, allow, base });
  if (checked.base !== base) die(2, "main moved while the venture was registered -- run it again");

  // The receipt is the ledger's own criteria request (ADR-1017): the profile's three keys, the digest the NEW file
  // parses to, and its welded idem. The branch is named in `what`, the one free field.
  const digest = v.after.digest;
  const what = `register ${a.slug}: kill at ${a["days-without-revenue"]} days without revenue or under ${a["traffic-floor"]} visits a month (branch ${branch})`;
  if (Buffer.byteLength(what) > 512) die(2, "the request's sentence is past the 512 bytes the ledger.criteria profile takes -- shorten the slug");
  const approval = { subject: "ledger.criteria", digest, what };
  const idem = createHash("sha256").update(`ledger.criteria|${digest}`).digest("hex");
  const emitFlags = ["--idem", idem];
  const refused = spineRefusal(ARC_EVENT, "approval.requested", approval, { cwd: REPO, flags: emitFlags });
  if (refused) die(2, `the criteria request this raises would be refused by the spine, so nothing is written: ${refused}`);
  const message = `ventures: register ${a.slug} as a candidate (a proposal, ADR-1008)\n\n${a.why ? `${a.why}\n\n` : ""}Its kill lines in ventures.yaml, its passport row in PORTFOLIO.md, its room in the face's contract, and what the contract derives (face-sections), so main stays green when this merges. The criteria digest ${digest} is requested for approval in the same step.\nWritten by the face's work door (ADR-1342).`;
  const planned = planDigest({ branch, base, files, message, approval, idem });
  if (a.dryRun) {
    const plan = await planProposal({ repo: REPO, branch, files, allow, base });
    say(`venture-register: would ${what}`);
    say(`venture-register: ${files.length} files on a new branch ${branch} off main ${base.slice(0, 12)}, then approval.requested[ledger.criteria] for digest ${digest}`);
    say(plan.diff.replace(/\n$/, ""));
    say("venture-register: dry run -- no branch, no object, no receipt was written");
    say(expectLine(planned));
    return;
  }
  if (a.expect === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, read the diff, then run it again with the --expect it prints");
  const stale = staleReason(a.expect, planned);
  if (stale) die(2, stale);
  const w = await writeProposal({ repo: REPO, branch, files, allow, base, message,
    beforeRef: () => { const no = spineRefusal(ARC_EVENT, "approval.requested", approval, { cwd: REPO, flags: emitFlags }); if (no) die(2, `the spine would refuse the criteria request, so no branch was written: ${no}`); } });
  written = true;
  say(`venture-register: wrote ${branch} at ${w.commit.slice(0, 12)} off main ${w.base.slice(0, 12)}`);
  // Three outcomes, never two: an unknown one was read as "not raised" (PR 3b round-4 attacks). The welded idem makes a
  // second raise of the same digest a duplicate the emitter refuses, never a second question.
  const got = emitReceipt(ARC_EVENT, "approval.requested", approval, { cwd: REPO, flags: emitFlags, timeoutMs: 60_000 });
  if (got.state === "refused") die(1, `the branch ${branch} IS written, and its criteria request was not raised -- ${got.why}`);
  if (got.state === "unknown") die(1, `the branch ${branch} IS written, and whether its criteria request landed is unknown -- ${got.why}. Look in your inbox before applying again`);
  if (!got.id) die(1, `the branch ${branch} IS written, and its criteria request landed without its id -- ${got.why}`);
  say(`receipt: approval.requested ${got.id}`);
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (e instanceof Stop) { /* exitCode set */ }
    else if (!written && e instanceof ProposalError) { process.stderr.write(`venture-register: ${e.code} -- ${e.message}\n`); process.exitCode = 2; }
    else {
      const why = e instanceof Error ? e.message : String(e);
      process.stderr.write(written ? `venture-register: the branch IS written, and then this failed: ${why}\n` : `venture-register: nothing was written: ${why}\n`);
      process.exitCode = written ? 1 : 2;
    }
  }
  // A reader that closed its end loses these lines, never the outcome: the exit code is already set.
  if (out.length) { try { writeSync(1, out.join("\n") + "\n"); } catch { /* the lines are lost; the effect and its exit are not */ } }
}
