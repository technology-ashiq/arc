#!/usr/bin/env node
// arc-inbox -- approvals are receipts too (REQ-06).
//
// SPINE-G (ADR-0030): this is a reader-only consumer. The OPEN set is recomputed on every run
// by folding decision.recorded onto approval.requested THROUGH the spine reader -- no approval
// state is stored anywhere but the spine, so a wiped derived index (REQ-04) rebuilds to the
// same inbox. Decisions are WRITTEN only through arc-event, the one writer; this file never
// opens events/*.jsonl or state.db, which is what REQ-09's grep-lint checks.
//
// Usage:
//   arc-inbox inbox [--all]               # OPEN approvals; --all lists every request with its state (ADR-1355)
//   arc-inbox approve <ULID> --reason R   # record decision.recorded verdict=approve
//   arc-inbox reject  <ULID> --reason R   # record decision.recorded verdict=reject
//   arc-inbox owner-key init              # once, at a terminal: make + seal the owner key (ADR-1514 amendment 2)
//
// approve on a `narrative-accept` request is signed: it needs a terminal, asks for the owner passphrase, and the
// decision carries `sigs` (one Ed25519 signature per page). Every other gate approves exactly as before.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SpineError, ULID_RE, sha256Hex } from "./lib/canonical.mjs";
import { spineRoot } from "./lib/spine-io.mjs";
import { isPromotionRequest } from "./lib/validate-policy.mjs";
import { isAbJudgement } from "./lib/validate-absorb.mjs";
import { isCriteriaChange } from "./lib/validate-ledger.mjs";
import { venturesPath } from "./lib/ledger/kill-panel.mjs";
import { parseVentures } from "./lib/ledger/ventures.mjs";
import { existsSync, readFileSync } from "node:fs";
import { query } from "./spine.mjs";
import { initOwnerKey, ownerKeyDir, ownerPubPath, pageListing, readPassphraseTty, signAccept, stdioIsTty } from "./lib/owner-key.mjs";
import { ACCEPT_GATE } from "./lib/owner-sig.mjs";
import { foldApprovals, decideRefusal } from "./lib/approval-fold.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_EVENT = join(HERE, "arc-event.mjs");

// The idem of a decision is keyed on the approval it DECIDES, never on its reason. arc-event
// folds the reason into its derived idem (arc-event.mjs), so a different-reason second
// decision, a concurrent double-decide, or a replay after the derived index was wiped would
// otherwise slip through as a distinct event. This stable key makes any second decision on the
// same approval collide as DUP_IDEM -- the backstop behind the read-check below.
const decisionIdem = (approvalId) => sha256Hex(`decision.recorded|${approvalId}`);

/**
 * THE as-of day cut, in ONE place.
 *
 * `asof` (YYYY-MM-DD) means "as the spine stood at the END of that day". This lived twice
 * -- once here, once in arc-dash's `cutAsof` -- byte-identical and therefore fine, right up
 * until one of them changed. That is the twin shape this repo keeps paying for (grep the
 * pattern, not the file), and an adversarial pass named it before it could bite: had one
 * side become `<`, `/api/spine?asof=X` and `/api/inbox?asof=X` would have disagreed at the
 * day boundary, each defended by its own green test.
 */
export function cutToDay(events, asof) {
  return asof === null || asof === undefined ? events : events.filter((e) => e.day <= asof);
}

// Exported for the L2 decision door (face lane, ADR-1302): /api/decide calls THIS decide
// and the inbox fold comes from THIS loadApprovals -- one implementation, byte-parity by
// construction. Extraction found mechanical at kickoff re-verification 2026-08-19.
export async function loadApprovals(root, { asof = null } = {}) {
  // Two reads through the ONLY public API, across all days, in append order.
  // asof (YYYY-MM-DD): fold as the spine stood at the END of that day -- BOTH sides of
  // the fold cut at the same boundary, or a later decision would close an approval that
  // was still open on the day being replayed (the Tape's honesty, ADR-1305).
  const cut = (events) => cutToDay(events, asof);
  // SCAN, never "auto": auto prefers derived/state.db once arc-replay has built one, and nothing else updates it, so
  // an approval raised a second ago was missing here and `decide` answered UNKNOWN_APPROVAL for it (face v2 Phase 05
  // round-2 logic attack). The inbox is where an approval is acted on; it reads the log, not a copy of it.
  const requested = cut((await query(root, { kind: "approval.requested", engine: "scan" })).events);
  const decided = cut((await query(root, { kind: "decision.recorded", engine: "scan" })).events);
  const decidedIds = new Set(decided.map((e) => e.event.payload && e.event.payload.decides));
  return { requested, decidedIds, decided };
}

/**
 * Re-derive a bound request's plan, DRY-RUN, and say whether its digest moved (face v2 Phase 16, ADR-1355 (a)). The
 * plan is the work door's REGISTERED one for `bound.op`, built from `bound.input` by the door's own validator and run by
 * the door's own runner -- never a command the payload spells -- and only an op whose plan prints a digest
 * (`expect: true`) can be bound. A plan that refuses, times out or prints no digest is a failure CLASS (REQ-19's
 * unknown), never "same". Every plan here is a --dry-run: the re-derive writes nothing.
 * @param {Record<string, unknown>} bound
 * @returns {Promise<"same" | "moved" | { failure: string }>}
 */
export async function planStateOf(bound) {
  const OPS = await import("./face-ops.mjs");
  const DOOR = await import("./lib/face/work-door.mjs");
  const op = OPS.OPS.find((o) => o.id === bound.op);
  if (!op) return { failure: "UNKNOWN_OP" };
  if (op.expect !== true) return { failure: "NOT_BOUND_OP" };
  let values;
  try { values = OPS.validateInput(op, bound.input); } catch (e) { return { failure: e && e.code ? String(e.code) : "BAD_INPUT" }; }
  let res;
  try { res = await DOOR.runTool({ repo: join(HERE, "..", "..", "..") }, op.plan(values), { timeoutMs: REDERIVE_TIMEOUT_MS }); }
  catch (e) { return { failure: e && e.code ? String(e.code) : "TOOL_FAILED" }; }
  if (res.timedOut) return { failure: "PLAN_TIMEOUT" };
  if (res.exit !== 0) return { failure: "PLAN_REFUSED" };
  let digest;
  try { digest = OPS.expectFrom(op, res.stdout); } catch (e) { return { failure: e && e.code ? String(e.code) : "NO_EXPECT" }; }
  return digest === bound.expect ? "same" : "moved";
}
const REDERIVE_TIMEOUT_MS = 120_000;

/**
 * Every request with its folded state -- the ONE fold the CLI, the decide path and the door's /api/inbox read.
 * @param {string} root @param {{ asof?: string | null, rederive?: boolean, decidedPlans?: boolean }} [o]
 *   rederive: re-derive bound plans. An as-of read passes false: a plan is re-derived against today's world, never the
 *   replayed day, so a bound request then reads UNKNOWN(NOT_REDERIVED) -- never OPEN.
 */
export async function inboxFold(root, { asof = null, rederive = true, decidedPlans = false } = {}) {
  const { requested, decided } = await loadApprovals(root, { asof });
  return foldApprovals(requested, decided, { planState: rederive ? planStateOf : undefined, decidedPlans });
}

/** The inbox line's description and gate, with the profile fallbacks. @param {Record<string, unknown>} p */
export function whatGate(p) {
  const what = typeof p.what === "string" ? p.what : (typeof p.subject === "string" ? p.subject : "");
  const gate = typeof p.gate === "string" ? p.gate : (typeof p.subject === "string" ? p.subject.split(".")[0] : "?");
  return { what, gate };
}

async function listInbox(root, all = false) {
  const folded = await inboxFold(root, { decidedPlans: all });
  // OPEN only by default; --all lists every request, each ending in its state (ADR-1355).
  const shown = folded.filter((f) => all || f.state === "OPEN");
  if (!shown.length) {
    const held = folded.filter((f) => f.state !== "OPEN" && f.state !== "DECIDED" && f.state !== "RESOLVED").length;
    process.stderr.write(held > 0 ? `inbox: no open approvals (${held} waiting, stale, duplicate or unknown -- --all lists them)\n` : "inbox: no open approvals\n");
    return 0;
  }
  for (const f of shown) {
    const e = f.row;
    const p = e.event.payload || {};
    // `what` falls back to `subject` so a PROFILE payload does not render as a blank line the owner
    // cannot read. absorb's ab-judgement profile is closed to its validated fields (ADR-0603) and
    // deliberately has no free-text `what`; without this fallback its inbox row printed as `(?)` with
    // no description at all, which is a request the owner cannot weigh -- and an approval nobody can
    // read is a rubber stamp with extra steps.
    const { what, gate } = whatGate(p);
    process.stdout.write(`${e.event.id}  ${what}  (${gate})  ${e.event.venture}  [${f.label}]\n`);
    // A PROMOTION is the one approval whose sentence is not enough to decide on. Which pair,
    // how far, and on what evidence are all validated fields (ADR-0508's promotion profile), so
    // putting them on the screen where the decision is made costs nothing and is the difference
    // between weighing a request and rubber-stamping it. A4: trust is re-earned, never argued
    // back -- a request with no citation in front of the human is a nudge wearing a receipt.
    if (isPromotionRequest(e.event))
      process.stdout.write(
        `    policy  ${p.action_kind}/${p.capability}  ${p.from_level} -> ${p.to_level}` +
        `  evidence ${p.trial_ledger_ref}\n`);
    // Same reasoning for absorb's blind A/B (ADR-0603): the owner is picking between two labels that
    // deliberately tell him NOTHING about which is which, so the fixtures and the evidence path are
    // the only things he can actually weigh. Putting them where the decision is made is the
    // difference between a judgement and a coin flip -- and the labels are printed so he knows which
    // words are the legal answers.
    if (isAbJudgement(e.event))
      process.stdout.write(
        `    absorb  candidate ${p.candidate}  pick one of: ${(p.labels || []).join(" | ")}\n` +
        `            ${(p.fixtures || []).length} fixtures: ${(p.fixtures || []).join(", ")}\n` +
        `            evidence ${p.evidence_path}  (sealed; the mapping is revealed only after you decide)\n`);
    // A KILL-LINE CHANGE is the third approval whose sentence is not enough to decide on, and it
    // was the one left without a branch here. An adversarial pass moved a 90-day line to 1000000
    // days and dropped a traffic floor to 1, under the sentence "whitespace only: align the kill
    // block indentation, no threshold touched" -- and the entire decision surface was that
    // sentence. `what` is validated for length and control characters only; nothing binds it to
    // the digest it rides on. ADR-1008 exists because the author and the approver are the same
    // person, and a control that records only THAT a decision was made, while guaranteeing nothing
    // about WHAT was decided, is worse than the rubber stamp its revisit trigger warns about: it
    // is a deceived stamp carrying the owner's signature.
    if (isCriteriaChange(e.event)) process.stdout.write(criteriaDetail(p.digest));
  }
  return 0;
}

// The numbers themselves, read from the file on disk, plus whether the digest being approved IS
// that file. Both halves matter: the thresholds are what the human is actually deciding about, and
// the match line is what stops a stale approval for some other document being waved through.
function criteriaDetail(digest) {
  const head = `    ledger  criteria digest ${digest}\n`;
  let path = null;
  try {
    path = venturesPath();
    if (path === null || !existsSync(path))
      return head + "            no ventures.yaml resolvable from here -- the thresholds cannot be shown, so DO NOT approve this blind\n";
    const parsed = parseVentures(readFileSync(path, "utf8"));
    const out = [head, `            ${path}\n`];
    if (parsed.digest !== digest)
      out.push(`            THIS DIGEST IS NOT THE FILE ON DISK (disk is ${parsed.digest}) -- approving this does NOT honor what you are about to read\n`);
    else
      out.push("            this digest IS the file on disk, and these are the lines it arms:\n");
    for (const name of Object.keys(parsed.ventures).sort()) {
      const kill = parsed.ventures[name].kill;
      const shown = Object.keys(kill).sort().map((k) => `${k}=${kill[k]}`).join("  ");
      out.push(`              ${name}  ${shown}\n`);
    }
    return out.join("");
  } catch (err) {
    // Never let an unreadable criteria file take the whole inbox down: the other approvals waiting
    // in it are unrelated, and an inbox that refuses to list is an inbox nobody can act on.
    return head + `            ventures.yaml could not be read (${err && err.code ? err.code : "ERROR"}): ${err && err.message ? err.message : err}\n`;
  }
}

/**
 * @param {string} root the spine @param {string} verdict approve | reject @param {string} id @param {string} reason
 * @param {{ keyDir?: string, readPassphrase?: (prompt: string) => Promise<string>, isTty?: (() => boolean) | boolean }} [signer]
 *   the owner key, terminal and prompt for a narrative-accept approve. Production passes nothing: the key is at the fixed
 *   ~/.arc-private/owner path and the prompt is the real terminal. Only a caller's own code can inject (no env, no flag).
 */
export async function decide(root, verdict, id, reason, signer = {}) {
  if (typeof id !== "string" || !ULID_RE.test(id))
    throw new SpineError("BAD_ARGS", `<id> ${JSON.stringify(id)} is not a ULID`);
  if (typeof reason !== "string" || reason.length === 0)
    throw new SpineError("BAD_ARGS", `${verdict} needs a non-empty --reason`);

  const { requested, decidedIds } = await loadApprovals(root);
  const approval = requested.find((e) => e.event.id === id);
  if (!approval) {
    // Name the mistake: an id that exists but is the wrong kind is a caller error worth a
    // distinct message, not a silent "unknown".
    const any = (await query(root, { engine: "scan" })).events.find((e) => e.event.id === id);
    if (any) throw new SpineError("WRONG_KIND", `${id} is a ${any.event.kind}, not an approval.requested`);
    throw new SpineError("UNKNOWN_APPROVAL", `${id} is not an approval on this spine`);
  }
  if (decidedIds.has(id))
    throw new SpineError("ALREADY_DECIDED", `${id} already has a decision -- decisions are final (supersede on a new day if truly needed)`);
  // ADR-1355: a request carrying a binding is decided only in a state that allows it -- a waiting child, a rejected
  // parent's child, a moved plan, an unevaluable binding and a key already decided are refused, ZERO events written.
  const p0 = approval.event.payload || {};
  if ("bound_to" in p0 || "depends_on" in p0 || "decision_key" in p0) {
    const f = (await inboxFold(root)).find((x) => x.id === id);
    const no = f ? decideRefusal(f, verdict === "approve" ? "approve" : "reject") : { code: "UNKNOWN_APPROVAL", why: "the fold does not hold it" };
    if (no !== null) throw new SpineError(no.code, `${id}: ${no.why}`);
  }

  // ADR-1514 amendment 2: approving a narrative-accept request is AUTHENTICATED. It is signed, page by page, with the owner
  // key, which only a passphrase typed at a terminal unseals. A reject needs no signature, and every other gate is untouched.
  const ap = approval.event.payload || {};
  /** @type {Record<string, string> | null} */ let sigs = null;
  if (verdict === "approve" && ap.gate === ACCEPT_GATE) {
    // Only validated entries are drawn raw; the request is an agent's text and this is the screen the passphrase is typed at.
    process.stderr.write(pageListing(id, ap.pages));
    const s = await signAccept({ approval: id, pages: ap.pages, keyDir: signer.keyDir ?? ownerKeyDir(), readPassphrase: signer.readPassphrase ?? readPassphraseTty, isTty: signer.isTty ?? stdioIsTty, reason });
    if (!s.sigs) throw new SpineError("SIGN_REFUSED", s.why);
    sigs = s.sigs;
  }
  const payload = JSON.stringify(sigs ? { decides: id, reason, verdict, sigs } : { decides: id, reason, verdict });
  // The one writer, strict. A malformed decision (assertDecision) or a decision lost to a
  // concurrent decider -- which lands as DUP_IDEM on the shared key above -- exits non-zero,
  // and we surface it rather than pretend the decision was recorded.
  try {
    execFileSync(process.execPath, [
      ARC_EVENT, "emit", "decision.recorded",
      "--payload", payload,
      "--idem", decisionIdem(id),
      "--venture", approval.event.venture,
      "--process", "arc-inbox@1.0.0",
      "--strict",
    ], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString().trim() : "";
    throw new SpineError("DECISION_REFUSED", stderr || `arc-event refused the decision (exit ${e.status})`);
  }
  process.stderr.write(`inbox: ${verdict} recorded for ${id}\n`);
  return 0;
}

/**
 * Why the owner's public key must not be written into this checkout, or "": it is a change to a committed trust anchor, so it
 * belongs on a feature branch, never on main or master (attack r1 B11). One line; a git that cannot answer is no objection.
 * @param {string} repo the checkout that would hold .claude/owner-key.pub
 */
export function ownerKeyRepoProblem(repo) {
  const DROP = new Set(["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_CEILING_DIRECTORIES"]);
  /** @type {NodeJS.ProcessEnv} */ const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!DROP.has(k.toUpperCase())) env[k] = v;
  let branch = "";
  try { branch = execFileSync("git", ["-C", repo, "branch", "--show-current"], { encoding: "utf8", env, timeout: 30000, stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; }
  return branch === "main" || branch === "master" ? `this checkout (${repo}) is on ${branch}; the public key is a committed trust anchor, so run owner-key init from a feat/* branch checkout` : "";
}

function parse(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const name = a.slice(2);
      if (name === "all") { flags.all = true; continue; }
      if (name !== "reason") throw new SpineError("BAD_ARGS", `unknown flag --${name}`);
      const next = argv[i + 1];
      if (next === undefined) throw new SpineError("BAD_ARGS", `flag --${name} needs a value`);
      flags[name] = next; i++; continue;
    }
    positional.push(a);
  }
  return { positional, flags };
}

async function main(argv) {
  const { positional, flags } = parse(argv);
  const command = positional[0] || "inbox";
  if (command === "owner-key") {
    if (positional[1] !== "init" || positional.length !== 2) throw new SpineError("BAD_ARGS", "usage: arc-inbox owner-key init");
    // A mode that ignores what it was given answers a question nobody asked (attack r1 B11): owner-key init takes no flag at all.
    const given = Object.keys(flags);
    if (given.length) throw new SpineError("BAD_ARGS", `owner-key init takes no flag (got --${given[0]}); usage: arc-inbox owner-key init`);
    const repo = join(HERE, "..", "..", "..");
    process.stdout.write(`owner-key: the public key will be written to ${ownerPubPath(repo)}\n`);
    // Only where a real terminal exists: without one, init refuses for that reason, first and alone.
    const wrong = stdioIsTty() ? ownerKeyRepoProblem(repo) : "";
    if (wrong) { process.stderr.write(`owner-key: refused -- ${wrong}\n`); return 1; }
    const r = await initOwnerKey({ keyDir: ownerKeyDir(), pubPath: ownerPubPath(repo), readPassphrase: readPassphraseTty, isTty: stdioIsTty });
    if (!r.ok) { process.stderr.write(`owner-key: refused -- ${r.why}\n`); return 1; }
    process.stdout.write(`owner key made. fingerprint ${r.fingerprint}\nprivate key (sealed by your passphrase): ${r.keyPath}\npublic key: ${ownerPubPath(repo)} -- commit that file; it is what CI checks every accepted page against\n`);
    return 0;
  }
  const root = spineRoot();
  if (command === "inbox") return listInbox(root, flags.all === true);
  if (flags.all === true) throw new SpineError("BAD_ARGS", "--all belongs with inbox");
  if (command === "approve" || command === "reject")
    return decide(root, command, positional[1], flags.reason);
  throw new SpineError("BAD_ARGS", `unknown command ${JSON.stringify(command)} (inbox | approve <id> --reason R | reject <id> --reason R | owner-key init)`);
}

// Only run the CLI when invoked directly -- importers (arc-dash, ADR-1302) get the
// library, not a side effect. Same guard style as spine.mjs. Before this guard existed,
// importing this file EXECUTED the inbox and exited the importer's process.
if (process.argv[1] && process.argv[1].endsWith("arc-inbox.mjs")) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      const code = err instanceof SpineError ? err.code : "INTERNAL";
      process.stderr.write(`arc-inbox: ERROR ${code} -- ${err.message}\n`);
      process.exit(2);
    });
}
