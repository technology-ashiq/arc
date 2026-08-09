#!/usr/bin/env node
// arc-leads — the outbound engine's CLI (Cycle 8, ADR-0400..0413).
//
// Phase 00 subcommands only: `store init`, `research`, `preflight`, `state`.
// Sending, caps, suppression and the reply path arrive in Phases 01-02; the real campaign is
// Phase 03 and is BLOCKED on business physics no code produces (ADR-0413).
//
// Exit codes are stable and distinct, because a caller that cannot tell "refused" from
// "crashed" retries the wrong one:
//   0 ok · 2 usage/validation · 3 refused by a gate · 4 provider transport · 5 store error

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initStore, openStore, leadId, leadIdsAllVersions, fingerprint, StoreError, storePath, STORE_FILE_MODE, STORE_DIR_MODE } from "./lib/store.mjs";
import { lintCandidates } from "./lib/research-lint.mjs";
import { source, verifier, ProviderError, PROVIDER_EXIT } from "./lib/deps.mjs";
import { preflight, PREFLIGHT_REFUSED, loadConfig, seedSmokeFinding } from "./lib/preflight.mjs";
import { ingestReply, readReplyFile, readStdin, IngestRefusal } from "./lib/ingest.mjs";
import { inbound } from "./lib/deps.mjs";
// `assertTs` is the house timestamp grammar, imported rather than re-spelled — the same
// validator the payload stamps went through, so a window bound and the receipts it is compared
// against can never be judged by two different grammars (D5).
import { leadsIdem, assertTs } from "../hq/lib/validate-leads.mjs";
import { readAllEvents, dayFileCount, quarantineCount } from "./lib/spine-read.mjs";
import { initCampaign, assertCampaignStore, writeDraft, readDraft, listDrafts, currentSha, approvalPayload, DraftError } from "./lib/drafts.mjs";
import { lintDraft, lintCampaign, VERDICT } from "./lib/personalization.mjs";
import { runDaily, approvedShaFor, unsubscribeHeader } from "./lib/sequencer.mjs";
import { reconcile, unresolvedIntents } from "./lib/journal.mjs";
import { provider } from "./lib/deps.mjs";
import { GuardRefusal, acquireLock, lockHolder, clearStaleLock, sendCounts, foldSends, campaignNames } from "./lib/guard.mjs";
import { loadEnvLocal, EnvError, ENV_LOCAL } from "./lib/env.mjs";
import { sendNotification, MailRefusal, MAIL_EXIT, assertEnvLocalNames, loadAllowlist } from "./lib/mail.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");

const die = (code, msg) => { console.error(`arc-leads: ${msg}`); process.exit(code); };

// ---------- emit ----------
//
// The ONE leads emitter (C15). Every leads receipt is constructed here from a literal shape,
// so "no PII in a payload" is a property of one function rather than a habit spread over the
// codebase. --idem is never passed: the emitter derives it for leads kinds and refuses a
// supplied one (anti-preclaim, ADR-0400).
// `allowDuplicate` is the RACE backstop, not the primary defence. ingest.mjs already skips an
// emit whose idem is on the spine, deterministically, from the fold it was handed; this covers
// the window where two processes both pass that check. Losing that race has to be boring:
// DUP_IDEM means the receipt is already recorded, which is the outcome the caller wanted.
//
// Matched on the `arc-event: REJECT <CODE>` prefix, which is the emitter's machine-readable
// line, not on the prose after it. arc-event has no distinct exit code per code -- strict mode
// is 2 for everything -- so the code is the only signal there is, and pinning the prefix rather
// than the sentence is what keeps this from being a test-on-a-message-template in production.
const DUP_IDEM_RE = /(^|\n)arc-event: REJECT DUP_IDEM\b/;

function emit(kind, payload, { evidence = null, allowDuplicate = false } = {}) {
  const sh = join(REPO_ROOT, ".claude/scripts/hq/arc-event.sh");
  // --payload-file, NOT --payload. The payload used to travel in the argv of TWO processes
  // (bash, then node), readable by any local process listing -- and on a non-zero exit Node
  // builds `Command failed: bash ... --payload {...}` into err.message, which the catch below
  // printed to stderr, i.e. into scrollback and CI logs. ADR-0412 says no PII through argv;
  // today's payloads carry only HMACs and enums, but this is the one emitter every Phase 01-02
  // receipt will route through, so the door is closed before it matters.
  // RANDOM name, EXCLUSIVE create. The name was pid plus millisecond-of-day -- zero random
  // bits -- and the write had no `wx`, so on the POSIX legs (where os.tmpdir() is /tmp, mode
  // 1777) a local process that pre-created the path kept its own 0666 permissions and read
  // every receipt payload we wrote through it, or redirected the write through a symlink.
  // Five sibling writes added in this same phase all use `wx`; this was the adjacent branch
  // that missed it, and initStore's comment already spells out why it matters.
  const tmp = join(tmpdir(), `arc-leads-${process.pid}-${randomBytes(12).toString("hex")}.json`);
  writeFileSync(tmp, JSON.stringify(payload), { mode: STORE_FILE_MODE, flag: "wx" });
  try {
    const args = ["emit", kind, "--payload-file", tmp, "--actor", "arc-leads", "--strict"];
    if (evidence) args.push("--evidence", evidence);
    return execFileSync("bash", [sh, ...args], { encoding: "utf8" });
  } catch (e) {
    const stderr = String(e.stderr || "");
    if (allowDuplicate && DUP_IDEM_RE.test(stderr)) return "";
    // Re-raise WITHOUT the child command line: err.message embeds the whole invocation.
    throw new Error(`arc-event refused a ${kind} receipt (exit ${e.status}). stderr: ${stderr.trim()}`);
  } finally {
    try { rmSync(tmp, { force: true }); } catch { /* best effort */ }
  }
}

// ---------- store init ----------
function cmdStoreInit() {
  try {
    const { dir, storeId, version } = initStore({ repoRoot: REPO_ROOT });
    console.log(`arc-leads: store initialised at ${dir}`);
    console.log(`  store_id: ${storeId}`);
    console.log(`  secret:   secret.v${version} (mode 0600)`);
    console.log("");
    console.log("BACK THIS UP. Outside the repo there is no git safety net, and losing the");
    console.log("secret breaks suppression matching permanently: a person who unsubscribed");
    console.log("would resurface in a future research list and be contacted again (ADR-0410).");
  } catch (e) {
    die(e instanceof StoreError ? 5 : 2, e.message);
  }
}

// ---------- research ----------
async function cmdResearch(icpPath) {
  if (!icpPath) die(2, "usage: arc-leads research <icp-file>");
  if (!existsSync(icpPath)) die(2, `ICP file not found: ${icpPath}`);
  const icp = JSON.parse(readFileSync(icpPath, "utf8"));
  const campaign = icp.campaign;
  if (!/^[a-z0-9-]{1,64}$/.test(String(campaign || "")))
    die(2, `ICP "campaign" must match [a-z0-9-]{1,64} (got ${JSON.stringify(campaign)}) — "|" is the idem delimiter`);

  let store;
  try { store = openStore({ repoRoot: REPO_ROOT }); }
  catch (e) { die(5, e.message); }

  let candidates;
  try { candidates = await source().search(icp); }
  catch (e) { die(e instanceof ProviderError ? PROVIDER_EXIT : 2, e.message); }

  // Verify every address BEFORE linting, so `held` is decided by the verifier rather than by
  // whichever branch happened to run first.
  const verdicts = new Map();
  for (const c of candidates) verdicts.set(String(c.email).toLowerCase(), await verifier().verify(c.email));

  const { accepted, rejected, corpusWarning } = lintCandidates(candidates, verdicts);
  if (corpusWarning) console.error(`arc-leads: WARNING — ${corpusWarning}`);

  const dossierDir = join(store.dir, "dossiers");
  // 0700 / 0600, from the store's own constants. These two writes are the ones store.mjs
  // names in its comment as having forgotten them -- and they still had.
  mkdirSync(dossierDir, { recursive: true, mode: STORE_DIR_MODE });
  const fp = fingerprint(store);

  // THE RE-RUN IS THE ORDINARY CASE, and it used to be fatal. `lead.researched`'s idem preimage
  // is `campaign|lead_id|below_bar|store_fingerprint` (validate-leads.mjs) and is deliberately
  // stable across runs -- so re-running research, or adding a sixth lead to five already on the
  // spine, made the emitter refuse the first duplicate as DUP_IDEM. That refusal arrives as a
  // THROWN error out of `emit`, which killed the loop at exit 2 with the earlier dossiers
  // rewritten and the later ones never reached: the receipt layer was idempotent and the
  // command was not.
  //
  // The second-order damage was worse than the crash. The emitter quarantines every refusal
  // BEFORE it exits (spine-io `quarantine`), and `report` refuses outright while ANY quarantine
  // record exists -- so one re-run of research silently disabled the ADR-0416 mixing report,
  // the single number this phase exists to produce, until a human cleared the spine by hand.
  //
  // `emit`'s own header already describes the remedy and names the module that has it:
  // ingest.mjs skips an emit whose idem is on the spine, deterministically, from the fold it
  // was handed, and keeps `allowDuplicate` as the RACE backstop for two processes that both
  // pass that check. The guard was written in one branch and never in this one -- D6, this
  // lane's most repeated defect. Both halves are here now.
  const onSpine = new Set(readAllEvents({ allowMissing: true }).map((e) => e && e.idem).filter(Boolean));
  let emitted = 0, alreadyOnSpine = 0;

  for (const a of accepted) {
    const id = leadId(store, a.email);
    // The dossier holds the PII. It lives in the store, outside the repo, and nothing here
    // ever reaches a receipt.
    writeFileSync(join(dossierDir, `${id}.json`), JSON.stringify({
      lead_id: id, name: a.name, email: a.email, firm: a.firm, firm_domain: a.firm_domain,
      geography: a.geography, provenance: a.provenance, source_urls: a.source_urls,
      facts: a.facts, citable_facts: a.citable_facts,
      email_status: a.email_status, below_bar: a.below_bar, below_bar_reason: a.below_bar_reason,
      campaign, store_id: store.storeId,
    }, null, 2) + "\n");

    const receipt = {
      lead_id: id, campaign, provenance: a.provenance, geography: a.geography,
      email_status: a.email_status, fact_count: a.fact_count,
      store_id: store.storeId, store_fingerprint: fp,
      ...(a.below_bar ? { below_bar: true } : {}),
    };
    // The idem is computed from the SAME payload object that would be emitted, not from a
    // re-spelling of its fields: a preimage assembled twice is free to disagree with itself on
    // exactly the receipt that matters (D5), and this one already grew `below_bar` once.
    if (onSpine.has(leadsIdem("lead.researched", receipt))) { alreadyOnSpine++; continue; }
    emit("lead.researched", receipt, { allowDuplicate: true });
    emitted++;
  }

  // Rejected candidates keep a record too: the 25 must be a filtered set with an audit trail,
  // not a survivor list. A rejection without a reason is invalid and refuses here.
  const rejPath = join(store.dir, "rejected.jsonl");
  const lines = rejected.map((r) => {
    if (!r.exclusion_reason) die(2, `internal: a rejection for "${r.firm}" carries no exclusion_reason`);
    return JSON.stringify(r);
  });
  writeFileSync(rejPath, lines.length ? lines.join("\n") + "\n" : "");

  const pass = accepted.filter((a) => !a.below_bar && a.email_status === "verified").length;
  const held = accepted.filter((a) => a.email_status === "held").length;
  const below = accepted.filter((a) => a.below_bar).length;
  console.log(`arc-leads research: ${pass} PASS · ${held} HELD · ${below} BELOW-BAR · ${rejected.length} REJECTED`);
  console.log(`  dossiers: ${accepted.length} in ${dossierDir}`);
  // COUNTED AND PRINTED, because a silent skip and a silent emit look identical to an operator
  // asking "did that run do anything" -- which is the exact question a re-run exists to ask.
  console.log(`  receipts: ${emitted} new · ${alreadyOnSpine} already on the spine`);
  for (const r of rejected) console.log(`  REJECTED ${r.firm}: ${r.exclusion_reason}`);
}

// ---------- campaign / draft / review / send (Phase 01) ----------
//
// The IST wall-clock stamp every cap buckets by. ARC_LEADS_NOW exists so a fixture can place
// a send at 23:59 or 00:01 without waiting for midnight -- the same shape as the spine's own
// test-only clock door, and it is never set in production.
function nowIst() {
  const p = (n) => String(n).padStart(2, "0");
  const real = new Date(Date.now() + 5.5 * 3600 * 1000);
  const fmt = (d) =>
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+05:30`;

  // Validated at startup (see the top-level guard); this only reads it.
  const override = process.env.ARC_LEADS_NOW;
  if (!override) return fmt(real);
  return override;
}
function cmdCampaignInit(name) {
  const store = openStore({ repoRoot: REPO_ROOT });
  const rec = initCampaign(store, name, { createdAt: nowIst() });
  console.log(`arc-leads: campaign "${rec.campaign}" bound to store ${rec.store_id}/${rec.store_fingerprint}`);
}

// Drafts are LINTED before they are written, and a FAIL never reaches the inbox. That is the
// deterministic half of ADR-0404: a draft citing a fact absent from the dossier cannot be
// approved, because it is never offered for approval.
function cmdDraft(campaign, file) {
  if (!campaign || !file) die(2, "usage: arc-leads draft <campaign> <drafts.json>");
  const store = openStore({ repoRoot: REPO_ROOT });
  assertCampaignStore(store, campaign);
  const incoming = JSON.parse(readFileSync(file, "utf8"));

  const linted = incoming.map((d) => {
    const dossierPath = join(store.dir, "dossiers", `${d.lead_id}.json`);
    if (!existsSync(dossierPath)) die(2, `no dossier for ${d.lead_id} — research it before drafting to it`);
    return { ...d, ...lintDraft(d, JSON.parse(readFileSync(dossierPath, "utf8"))) };
  });

  // Campaign-scope similarity runs over the whole batch: per-draft checks are structurally
  // blind to template-blast, which is a property of the SET rather than of any member.
  const scored = lintCampaign(
    linted.map((d, i) => ({ ref: String(i), body: d.body, verdict: d.verdict, warns: d.warns }))
  );

  // ONE APPROVAL PER (campaign, lead, touch), enforced HERE rather than left to the send moment.
  //
  // Re-running `draft` on the same file wrote a second draft record and emitted a second
  // approval.requested for the identical lead and touch, and nothing anywhere refused it. The
  // mail itself is safe -- the guard's `already-sent` row refuses the second attempt before the
  // provider is asked -- so this is not a double-send bug, and that is precisely why it survived
  // every existing fixture: the safety property everyone tests for still holds.
  //
  // What breaks is the human decision this whole phase is built on. Two inbox items for one send
  // means the owner approves the same touch twice and "which approval authorised this mail?"
  // stops having an answer, which is the L1 record ADR-0407 exists to keep. And a five-lead run
  // then reports five sent and five refused, so the phase's own evidence bundle reads as though
  // half the journeys failed.
  //
  // Revising a draft is EDITING the one that exists: `review` prints BODY EDITED SINCE WRITE and
  // the guard refuses on a draft_sha that moved after approval (ADR-0412). A second record for
  // the same touch was never the way to revise one.
  //
  // The map is seeded from the store and then grown as this batch writes, so two entries for one
  // lead and touch INSIDE a single file are caught by the same rule -- a check against on-disk
  // state alone would pass the whole batch on a first run.
  const seenTouch = new Map();
  for (const prior of listDrafts(store, campaign))
    seenTouch.set(`${prior.lead_id}|${prior.touch_n}`, prior.draft_ref);

  let written = 0, blocked = 0, duplicate = 0;
  linted.forEach((d, i) => {
    if (scored[i].verdict === VERDICT.FAIL) {
      blocked++;
      console.log(`  FAIL  ${d.lead_id}: ${d.fails.join(" | ")}`);
      return;
    }
    const touchKey = `${d.lead_id}|${d.touch_n}`;
    if (seenTouch.has(touchKey)) {
      duplicate++;
      console.log(`  DUP   ${d.lead_id}: touch ${d.touch_n} already has draft ${seenTouch.get(touchKey)} in "${campaign}" — edit that draft, or use the next touch_n. No second approval was requested.`);
      return;
    }
    const warns = scored[i].warns;
    const rec = writeDraft(store, {
      campaign, lead_id: d.lead_id, touch_n: d.touch_n, body: d.body, cites: d.cites,
      lintStatus: scored[i].verdict === VERDICT.PASS ? "PASS" : `BELOW-BAR: ${warns.join(" | ")}`,
    });
    emit("approval.requested", approvalPayload(rec));
    seenTouch.set(touchKey, rec.draft_ref);
    written++;
    console.log(`  ${scored[i].verdict === VERDICT.PASS ? "PASS " : "WARN "} ${rec.draft_ref} ${d.lead_id}${warns.length ? " — " + warns.join(" | ") : ""}`);
  });
  console.log(`arc-leads draft: ${written} queued for approval, ${blocked} FAIL blocked before the inbox, ${duplicate} duplicate touch(es) refused`);
}

// The local render. The spine carries an opaque ref; the human reads the body HERE, beside the
// dossier evidence, so the cited facts can be checked against their sources.
function cmdReview(ref) {
  if (!ref) die(2, "usage: arc-leads review <draft_ref>");
  const store = openStore({ repoRoot: REPO_ROOT });
  const d = readDraft(store, ref);
  const dossierPath = join(store.dir, "dossiers", `${d.lead_id}.json`);
  const dossier = existsSync(dossierPath) ? JSON.parse(readFileSync(dossierPath, "utf8")) : null;
  console.log(`draft_ref : ${d.draft_ref}`);
  console.log(`campaign  : ${d.campaign}  touch ${d.touch_n}`);
  console.log(`lint      : ${d.lint_status}`);
  const cur = currentSha(store, ref);
  console.log(`draft_sha : ${d.draft_sha}${cur === d.draft_sha ? "" : "   *** BODY EDITED SINCE WRITE: " + cur + " ***"}`);
  if (dossier) {
    console.log(`lead      : ${dossier.name} <${dossier.email}>  ${dossier.firm}`);
    console.log("evidence  :");
    for (const f of dossier.citable_facts || [])
      console.log(`  - ${f.text}\n      ${f.evidence_url}\n      why: ${f.relevance}`);
  }
  console.log("--- draft body ---");
  console.log(d.body);
}

async function cmdReconcile() {
  const store = openStore({ repoRoot: REPO_ROOT });
  // TAKES THE LOCK. It did not, and that was the sharpest hole in Phase 01: reconcile both
  // EMITS receipts and DELETES intent files, so running it while a daily run sat in the
  // ack-to-receipt window voided that run's live intent. The mail had left, the receipt was
  // never written, the intent was gone -- and the next run re-authorised the identical send.
  //
  // The trigger was the documented remedy: the lock refusal tells the operator to run
  // reconcile, i.e. to run the unlocked writer against the exact window the same message says
  // must not be disturbed. Guarded in one branch (runDaily reconciles inside the lock) and
  // unguarded in the adjacent one -- D6.
  const release = acquireLock(store);
  try {
  const out = await reconcile(store, {
    events: readAllEvents({ allowMissing: true }),
    lookup: (k) => provider().lookupByMessageId(k),
    emitReceipt: async (p) => emit("outreach.sent", p),
  });
  console.log(`arc-leads reconcile: ${out.resolvedFromSpine} resolved from the spine (no provider call) · ${out.emittedLate} late receipt(s) · ${out.voided} voided · ${out.providerCalls} provider call(s)`);
  // The per-intent failures, PRINTED. reconcile collects them so one bad intent cannot stop it
  // healing the healthy ones -- but nothing printed them, so the operator saw only "N intent(s)
  // still unresolved" and had no idea which intent, why, or what to do about it. An intent that
  // predates ADR-0416 wedges every send in the campaign and names its own remedy; a remedy in
  // an object nobody prints is not a remedy.
  for (const err of out.errors || []) console.error(`  ! ${err}`);
  const left = unresolvedIntents(store);
  if (left.length) die(3, `${left.length} intent(s) still unresolved — no send will be attempted`);
  } finally { release(); }
}

// The human-started daily command. No cron, no daemon, no background anything (ADR-0403).
async function cmdDaily(campaign) {
  if (!campaign) die(2, "usage: arc-leads daily <campaign>");
  const store = openStore({ repoRoot: REPO_ROOT });
  assertCampaignStore(store, campaign);

  // Refuse HERE, with a sentence that says what to do, rather than throwing out of the submit
  // call three frames down. Without a sending domain there is no valid List-Unsubscribe
  // address, and a send without a working unsubscribe is a non-negotiable violation
  // (ADR-0402) — not merely a missing config value.
  try { unsubscribeHeader(); }
  catch (e) { die(3, `${e.message}. Phase 03 gate row 2 is the dedicated warmed domain, and it is not evidenced (ADR-0413).`); }

  const readEvents = () => readAllEvents({ allowMissing: true });
  const approved = listDrafts(store, campaign)
    .filter((d) => approvedShaFor(readEvents(), d.draft_ref))
    .map((d) => d.draft_ref);
  if (!approved.length) { console.log("arc-leads daily: no approved drafts — nothing to send"); return; }

  const out = await runDaily({
    store, readEvents, drafts: approved, now: nowIst(),
    emitReceipt: async (p) => emit("outreach.sent", p),
  });
  if (out.halted) die(3, out.halted);
  for (const r of out.results)
    console.log(r.ok ? `  SENT    ${r.draftRef} (${r.provider_message_id})` : `  REFUSED ${r.draftRef} [${r.step}] ${r.why}`);
  const sent = out.results.filter((r) => r.ok).length;
  console.log(`arc-leads daily: ${sent} sent, ${out.results.length - sent} refused`);
}

// ---------- ingest-reply (Phase 02) ----------
//
// Two doors, both handing over BYTES: `--file <path outside the repo>` and `--stdin`. There is
// deliberately no third door that takes the reply as an argument. argv is world-readable in a
// process listing, lands in shell history, and is embedded verbatim into Node's
// `Command failed: ...` message on a non-zero exit — three separate ways for a lead's own
// words to end up somewhere permanent (ADR-0412).
async function cmdIngestReply(argv) {
  // Parsed as a LOOP, not by scanning for flags independently. The first version tested
  // `argv.find(a => !a.startsWith("--"))` for a stray positional and ran that test over the
  // whole array -- so `--file <path>` refused itself, the path being the very positional the
  // check was looking for. A flag and its value are one unit and only a loop that consumes
  // both knows that; two independent scans over one array is D5 in miniature.
  let filePath = null, useStdin = false, useInbound = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) die(2, "--file needs a path");
      if (filePath !== null) die(2, "--file given twice — which file is authoritative is exactly the ambiguity this refuses rather than resolving");
      filePath = v;
    } else if (a === "--stdin") useStdin = true;
    else if (a === "--inbound") useInbound = true;
    else if (a.startsWith("--")) die(2, `unknown flag ${a}`);
    // A bare positional is almost always pasted reply content, and the pointer must name the fix.
    else die(2, `ingest-reply takes no positional argument (got ${a.length} bytes of one). Reply content never travels in argv — it is readable in a process listing and lands in shell history. Use \`--file <path outside the repo>\` or pipe it to \`--stdin\`.`);
  }
  const chosen = [filePath !== null, useStdin, useInbound].filter(Boolean).length;
  if (chosen !== 1)
    die(2, "usage: arc-leads ingest-reply (--file <path> | --stdin | --inbound) — exactly one source");

  const store = openStore({ repoRoot: REPO_ROOT });
  const cfg = loadConfig();
  const now = nowIst();
  const emitFn = async (kind, payload) => emit(kind, payload, { allowDuplicate: true });

  let inputs;
  if (filePath !== null) {
    inputs = [{ bytes: readReplyFile(REPO_ROOT, filePath), label: filePath }];
  } else if (useStdin) {
    // A TTY means nobody piped anything, and reading it waits for a human who is not typing a
    // mail message. Under a same-day SLA, silence is the worst possible failure mode.
    if (process.stdin.isTTY)
      die(2, "--stdin has no pipe attached (stdin is a terminal). Pipe the reply in, or use `--file <path outside the repo>`.");
    const bytes = await readStdin(process.stdin);
    inputs = [{ bytes, label: "(stdin)" }];
  } else {
    const batch = await inbound().fetch();
    inputs = batch.map((b) => ({ bytes: b.bytes, label: b.source }));
    if (!inputs.length) { console.log("arc-leads ingest-reply: the inbound source returned nothing"); return; }
  }

  let ok = 0, refused = 0;
  for (const inp of inputs) {
    try {
      // The spine is re-read per reply. An unsubscribe ingested two replies ago changes what
      // the next one derives, and a snapshot taken before the loop would not know it.
      const r = await ingestReply({
        store, bytes: inp.bytes, events: readAllEvents({ allowMissing: true }),
        now, emit: emitFn, config: cfg, sourceLabel: inp.label,
      });
      ok++;
      const extra = [
        r.fresh ? null : "already ingested",
        r.receipt_duplicate ? "receipt already on the spine" : null,
        r.suppressed ? "SUPPRESSED" : null,
        r.meeting_ref ? (r.meeting_created ? `meeting draft ${r.meeting_ref}` : `meeting draft ${r.meeting_ref} (already drafted)`) : null,
        r.matched === "default" ? "UNCLASSIFIED -> later, review manually" : null,
      ].filter(Boolean);
      console.log(`  ${r.triage_class.toUpperCase().padEnd(11)} ${r.reply_ref}${extra.length ? "  [" + extra.join(" · ") + "]" : ""}`);
    } catch (e) {
      // EVERY reply gets its chance. A batch that halts on reply 3 never ingests replies 4..N,
      // and a reply we fail to ingest is a sequence we fail to stop — the one most likely to
      // be sitting behind the failure is the unsubscribe. So an unexpected error is reported
      // loudly against ITS reply and the loop continues; the non-zero exit at the end is what
      // makes the run fail. Halting would trade a visible failure for a silent one.
      refused++;
      if (e instanceof IngestRefusal) console.error(`  REFUSED [${e.step}] ${e.message}`);
      else console.error(`  FAILED  [internal] ${inp.label}: ${e.message}`);
    }
  }
  console.log(`arc-leads ingest-reply: ${ok} ingested, ${refused} refused`);
  if (refused) process.exit(3);
}

function cmdUnlock() {
  const store = openStore({ repoRoot: REPO_ROOT });
  const h = lockHolder(store);
  if (!h) { console.log("arc-leads: no send lock is held"); return; }
  console.log(`arc-leads: lock holder ${h.raw || "(0-byte lock file)"} — alive: ${h.alive}`);
  const out = clearStaleLock(store);
  if (!out.cleared) die(3, out.why);
  console.log(`arc-leads: ${out.why}`);
}

// ---------- preflight ----------
async function cmdPreflight() {
  const res = await preflight({ warmupApproved: process.env.LEADS_WARMUP_APPROVED === "1" });
  // REQ-07 is a SEPARATE requirement with its own gate, composed here rather than folded into
  // preflight() — a gate that fails for reasons outside the question it asks has two jobs.
  // Reported on the same run because an operator asking "can I send yet" wants both answers,
  // and both must be able to say no.
  const seed = seedSmokeFinding(loadConfig().seed_evidence_path);
  for (const f of [...res.findings, seed]) console.log(`  ${f.ok ? "ok  " : "REFUSED"} ${f.rule}: ${f.detail}`);
  if (!res.ok || !seed.ok) {
    console.error("arc-leads preflight: REFUSED — no send may happen until every clause passes live (REQ-00) and the seed-inbox smoke is dated and fresh (REQ-07)");
    process.exit(PREFLIGHT_REFUSED);
  }
  console.log("arc-leads preflight: PASS");
}

// ---------- state ----------
//
// A PURE FOLD over the spine. No cache, no file written, nothing under
// .claude/state/hq/derived/. REQ-03 forbids a mutable counter, so there is nothing to wipe --
// which is why the replay fixture asserts determinism, order-independence and
// fold-completeness rather than "wipe and replay", a test that would delete nothing and
// assert nothing.
function cmdState(json) {
  // Asked BEFORE the fold, because `allowMissing` cannot tell an empty answer from an empty
  // spine and this surface publishes the mixing guard's own numbers. See `dayFileCount`.
  const census = dayFileCount();
  const events = readAllEvents({ allowMissing: true });
  const leads = new Map();
  // A Map, never a plain object. `(campaigns[p.campaign] ||= {...}).submitted += 1` on a receipt
  // whose campaign was the string `__proto__` resolved `campaigns.__proto__` to Object.prototype
  // — truthy, so `||=` never assigned — and wrote `submitted = NaN` onto the prototype of every
  // object in the process, while the campaign itself disappeared from `Object.keys` and from the
  // printed report. Reproduced: `campaign keys: []` beside `sends.total: 1`.
  const replied = new Map();
  const touch = (id) => leads.get(id) || leads.set(id, { last_touch_at: null, lead_id: id, suppressed: false, touches: 0 }).get(id);

  for (const e of events) {
    const p = e.payload || {};
    if (e.kind === "lead.researched") touch(p.lead_id);
    else if (e.kind === "outreach.sent") {
      const l = touch(p.lead_id);
      l.touches += 1;
      if (!l.last_touch_at || p.submitted_at > l.last_touch_at) l.last_touch_at = p.submitted_at;
    } else if (e.kind === "outreach.replied") {
      touch(p.lead_id);
      if (typeof p.campaign === "string") replied.set(p.campaign, (replied.get(p.campaign) || 0) + 1);
    } else if (e.kind === "lead.suppressed") touch(p.lead_id).suppressed = true;
  }

  // `submitted` is DERIVED from the same fold, not counted a second time. Row 8 of the
  // carried-forward table: this function folded `outreach.sent` twice over one event list — once
  // by hand into `campaigns[k].submitted`, once through `sendCounts` — and the two were free to
  // disagree. They did, the moment a receipt carried no string campaign.
  const names = campaignNames(events, ["outreach.sent", "outreach.replied"]);
  const campaigns = Object.create(null);
  for (const k of names) {
    const sends = sendCounts(events, { campaign: k });
    campaigns[k] = { replied: replied.get(k) || 0, submitted: sends.total, sends };
  }

  const out = {
    // ADR-0416's mixing guard, reported as a COUNT rather than left to a reader to grep for.
    // `real` is the number that carries the claim, and an unmarked receipt is counted as real
    // (see sendCounts) precisely so that a zero there means something.
    //
    // AND IT IS NOT PUBLISHED WHEN NOTHING WAS READ. `report` refuses an unreadable spine while
    // this surface printed `{0,0,0,0}` at exit 0 over the very same reader — the unguarded
    // configuration publishing the safety number. `state` may not refuse (it answers "what does
    // this install know about", and a fresh install legitimately knows nothing), so it says so
    // in the field instead of answering zero.
    sends: census.days === 0 ? null : sendCounts(events),
    sends_unavailable: census.days === 0 ? `${census.why} — no count is published, because zero receipts read is not zero sends` : null,
    // Counted, never folded: a quarantined line is an input the emitter REFUSED, so a clean set
    // of counts beside a non-empty quarantine is a claim made over receipts nobody has read.
    quarantined: quarantineCount().records,
    campaigns: Object.fromEntries(names.map((k) => [k, campaigns[k]])),
    leads: [...leads.values()].sort((a, b) => (a.lead_id < b.lead_id ? -1 : a.lead_id > b.lead_id ? 1 : 0)),
  };
  if (json) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  return out;
}

// ---------- report (Phase 03 slice 05) — the mixing guard's report (ADR-0416) ----------
//
// ADR-0416 lets the outreach path bind the product domain in rehearsal mode, and the single
// claim that has to survive that is: over the rehearsal window, no REAL cold send happened.
// `sendCounts` has produced that number since slice 04 — and nothing a person could run ever
// asked it with a window. The adversarial pass wrote that down exactly: the counter's own
// header states the claim, and "the header's claim has no report behind it yet". A claim
// carried only by a function with no caller is a claim nobody can check. This is the caller.
//
// THE ANSWER IS A NUMBER and this command only prints it. An assertion shaped "the output does
// not contain the word real" passes for a mutant that renames the field, and passes for a
// crash; a count does neither. The spec forbids the word-absence form in as many words.
//
// ONE READER, ONE FOLD. Events come from `readAllEvents` and the classification from
// `sendCounts` — the same reader and the same function `state --json` uses, deliberately not a
// second pass over the same receipts. A send one surface counts is a send the other counts,
// and two derivations of one number is this lane's most repeated defect (D5), so the fixture
// asserts the two agree over one spine rather than trusting the arrangement to hold.
//
// THERE IS NO VERDICT LINE AND NO PASS/FAIL EXIT, and that is a decision rather than an
// omission. A verdict would be a SECOND derivation of the same claim, free to drift from the
// number printed beside it; an exit code carries one bit where the answer has three axes
// (rehearsal, real, and how much of real is merely unmarked). The exit code says whether the
// report could be produced. The count says what happened.
function cmdReport(argv) {
  // The same consume-a-flag-and-its-value LOOP as `cmdMail`, for the same reason: independent
  // scans let one flag's value shadow another's, and a loop is what makes an unknown flag, a
  // duplicate and a bare positional refusable rather than silently dropped. A dropped
  // `--from` here does not misfile a mail — it silently widens the window the claim is about.
  const got = { "--campaign": null, "--from": null, "--to": null };
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    let name = a, inline = null;
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq > 2) { name = a.slice(0, eq); inline = a.slice(eq + 1); }

    if (name === "--json") {
      if (inline !== null) die(2, "--json takes no value");
      json = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(got, name)) {
      if (got[name] !== null) die(2, `${name} given twice — which one bounds the report is exactly the ambiguity this refuses rather than resolving`);
      if (inline !== null) { got[name] = inline; continue; }
      const v = argv[i + 1];
      if (v === undefined || String(v).startsWith("--"))
        die(2, `${name} needs a value — write \`${name}=<value>\` if the value itself begins with two dashes`);
      got[name] = v;
      i++;
      continue;
    }
    if (a.startsWith("--")) die(2, `unknown flag ${a}`);
    die(2, "report takes no positional argument — every value belongs to a named flag");
  }
  const campaign = got["--campaign"], from = got["--from"], to = got["--to"];

  // The bounds are validated HERE, before anything is counted. `sendCounts` validates them too
  // and that repetition is deliberate: it keeps the counter self-defending for every other
  // caller, while this call is what puts the operator's own spelling into the refusal and what
  // makes the ORDER comparison below safe to run on strings at all.
  if (from !== null) assertTs("report", "--from", from);
  if (to !== null) assertTs("report", "--to", to);
  // AN INVERTED WINDOW MATCHES NO RECEIPT, so every count under it is zero — a confident wrong
  // answer in the unsafe direction, which is the same failure an unplaceable bound produces and
  // it refuses for the same reason. Lexicographic order IS chronological order for these
  // stamps: the validator above pins one spelling per instant.
  if (from !== null && to !== null && from > to)
    die(2, `--from ${from} is after --to ${to} — an inverted window matches no receipt at all, so it would answer "0 real sends" to a question it never actually asked. Refusing rather than returning that zero.`);

  // NO `allowMissing` HERE, and that is the one place this reader is called differently from
  // `state`. `state` answers "what does this install know about", so a fresh install with no
  // spine yet is a legitimate empty answer. This command answers "did a real send happen in
  // that window", and an absent or mistyped `ARC_SPINE_ROOT` folding to zero events would
  // produce the most reassuring possible number from having read nothing at all — the same
  // unreadable-counted-as-empty failure `spine-read.mjs` opens its header with, arriving at the
  // one claim ADR-0416 exists to make. A spine the reporter cannot read is a refusal.
  const events = readAllEvents();

  // A QUARANTINED RECEIPT IS A SEND NOBODY HAS READ. The emitter quarantines-and-exits-0, so one
  // unknown payload key on a REAL send left `events/_quarantine/` holding the receipt, this
  // reader never opening that directory, and the report answering `real: 0` at exit 0.
  // Reproduced end to end. That is precisely "a zero that means I could not look", so it refuses
  // rather than reporting a count beside it — a count over an incomplete set is not a smaller
  // truth, it is the wrong answer to the question ADR-0416 exists to ask.
  const quarantined = quarantineCount();
  if (quarantined.records > 0)
    die(2, `${quarantined.records} receipt(s) sit in the spine quarantine (${quarantined.files.join(", ")}) — refusing to report, because the emitter accepts a send and quarantines its receipt at exit 0, so any of them could be a real send this count cannot see. Resolve the quarantine, then ask again.`);

  // A CAMPAIGN NAME OFF ARGV IS NOT A CAMPAIGN. `sendCounts` matches that axis exactly and says
  // why: answering a name that does not exist with a silent zero is the CALLER's contract to
  // keep, and `state --json` keeps it by only ever asking about names it folded out of the
  // spine itself. This command takes the name from a human's shell, where "Pilot", "pilot " and
  // a finger-slip are each one keystroke away — and every one of them would answer `real: 0`,
  // which reads exactly like the answer the operator was hoping to see.
  //
  // So the name is resolved against the very receipts being counted. A campaign that carries no
  // `outreach.sent` receipt at all refuses too, and that is the stronger answer rather than a
  // weaker one: "no receipt on the spine carries that name" is what the reporter actually
  // knows, and it tells a quiet campaign from a typo, which a zero cannot.
  if (campaign !== null) {
    // The same string-filtered set `state --json` keys its campaign map off, from one function.
    const known = campaignNames(events);
    if (!known.includes(campaign))
      die(2, `no outreach.sent receipt on the spine carries campaign ${JSON.stringify(campaign)} — refusing rather than reporting zero real sends for a name that may simply be misspelled. Campaign(s) with receipts: ${known.length ? known.join(", ") : "(none)"}`);
  }

  const { counted, counts: sends } = foldSends(events, { campaign, from, to });

  // A CORRECTION RECLASSIFIES A SEND; THE FOLD DOES NOT KNOW THAT. `supersedes` was ignored
  // entirely, so a correction moving a send rehearsal<->real left the superseded original in the
  // count beside its replacement: ONE physical send in two classes, which is the non-negotiable
  // this whole command exists to hold. Honouring it properly is a fold-shaped change (a
  // supersedes chain, resolved before classification) and it is not being invented inside a fix
  // commit — so the reporter refuses and names the receipt instead of quietly double-counting.
  const countedIds = new Set(counted.map((e) => e.id));
  const corrections = events.filter((e) => typeof e.supersedes === "string" && countedIds.has(e.supersedes));
  if (corrections.length)
    die(2, `${corrections.length} event(s) on the spine supersede an outreach.sent inside this window (${corrections.map((e) => `${e.id} supersedes ${e.supersedes}`).join("; ")}) — refusing, because this fold does not resolve supersedes and would count the superseded original AND its correction, putting one physical send in two classes.`);

  const out = { campaign, window: { from, to }, sends };
  if (json) {
    // Keyed `sends`, identically to `state --json`, so the two can be compared field for field
    // by anything that reads both — including the fixture that asserts they never disagree.
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    return out;
  }
  console.log(`arc-leads report: campaign ${campaign ?? "(all)"} · window ${from ?? "(open)"} .. ${to ?? "(open)"}`);
  // One label, one number, one line, in the same order as the JSON — so the human surface and
  // the machine surface can be compared field for field by a fixture, and a print path that
  // showed a different number from the one derived would be a visible disagreement rather than
  // a thing nobody thought to check.
  console.log(`  rehearsal  ${sends.rehearsal}`);
  console.log(`  real       ${sends.real}`);
  // Named on its own line AND counted inside `real`. An unmarked receipt predates the ADR-0416
  // mark, and "we cannot show this was a rehearsal" is not "it was a rehearsal" — so it counts
  // as real, which is what keeps a zero there worth claiming. It is still named, because an
  // operator reading a non-zero real count needs to know whether that is a cold send or a
  // receipt of unknown vintage.
  console.log(`  unmarked   ${sends.unmarked}   (inside the real count, never a rehearsal: receipts predating the ADR-0416 mark)`);
  // The window's own honesty axis. An unplaceable receipt is counted in EVERY window because it
  // must not escape the count by being unreadable — which means a window's counts silently
  // include receipts that window could not place, and there was no field that said so.
  console.log(`  unplaceable ${sends.unplaceable}  (counted in every window: submitted_at is not the pinned YYYY-MM-DDTHH:MM:SS+05:30 spelling, so no bound can place it)`);
  console.log(`  total      ${sends.total}`);
  return out;
}

// ---------- notification mail (Phase 04, ADR-0415) ----------
//
// This is NOT the outreach path. It carries owner-directed mail only — deploy and canary
// failures, waiting approvals, the daily brief — so that arc can reach a human who is not
// sitting at a terminal. `lib/mail.mjs` holds the allowlist and quota rules; this function
// only parses flags and hands over.
// ONE delivery path, shared by `mail` (a human composing) and `notify` (a trigger firing).
// Two copies of this would be two places for the env guard, the lock and the recipient rule to
// drift apart, and the ones that drift are always the ones nobody looks at again.
async function deliverNotification({ to, subject, text, kind }) {
  // `.env.local` is read HERE rather than at startup, deliberately. Every other subcommand
  // keeps exactly the environment it had before this phase existed, so a credential file
  // cannot change the behaviour of a send, a reconcile or a cap check merely by being present.
  const envInfo = loadEnvLocal({ root: REPO_ROOT });
  if (envInfo.present && envInfo.skipped.length)
    console.error(`arc-leads: warning — ${ENV_LOCAL} line(s) ${envInfo.skipped.join(", ")} are not NAME=value and were skipped`);
  if (envInfo.present && envInfo.blank.length)
    console.error(`arc-leads: warning — ${ENV_LOCAL} declares ${envInfo.blank.join(", ")} with an empty value, which counts as unset`);
  // The list and the refusal live in `lib/mail.mjs`, beside the rules they protect, so they can
  // be tested without writing a `.env.local` into a real repository root.
  assertEnvLocalNames(envInfo.names || [], ENV_LOCAL);

  // `--to` is OPTIONAL when the owner allowlist holds exactly one address, and that is not a
  // convenience. This path exists to reach ONE person whose address is already declared in
  // `.env.local`; making every caller repeat it in argv puts the address in `ps`, in shell
  // history and verbatim in CI logs — the three exposures this module refuses everywhere else.
  // With more than one allowed address there is a real choice to make, so it refuses to guess.
  let recipient = to;
  if (!recipient) {
    let list;
    try { list = [...loadAllowlist(process.env)]; }
    catch (e) { die(MAIL_EXIT[e.kind] ?? 3, `[${e.kind}] ${e.message}`); }
    if (list.length !== 1)
      die(2, `--to was omitted and ARC_LEADS_MAIL_ALLOWLIST holds ${list.length} addresses — it is only inferred when there is exactly one, because picking one of several recipients is a choice and not a default`);
    recipient = list[0];
  }

  const store = openStore({ repoRoot: REPO_ROOT });
  // The cap is a check-then-act across a read, a network call and an append, so without
  // exclusion two notifications firing together (a canary hook and a phase-close hook) both
  // read 99 and both send. `cmdReconcile` already takes this lock; the guard was applied in one
  // branch and omitted in the adjacent one, which is this lane's most repeated defect (D6).
  const release = acquireLock(store);
  try {
    const res = await sendNotification(
      { to: recipient, subject, text, kind },
      { storeDir: store.dir, nowTs: nowIst() },
    );
    // The recipient is NOT printed. The operator typed it or declared it and already knows it;
    // this line is what ends up in a CI log, and the address has no business being there.
    console.log(`arc-leads: mail sent id=${res.id} idem=${res.idem_key}`);
    return res;
  } finally {
    release();
  }
}

async function cmdMail(argv) {
  // Parsed as a LOOP that consumes a flag and its value together, the same shape as
  // `cmdIngestReply`. Scanning for each flag independently with `indexOf` is D5 in miniature:
  // `--text --to` makes the scan for `--to` match the argv element that IS another flag's
  // value, so the real recipient is shadowed. A loop also makes an unknown flag, a duplicate,
  // and a bare positional refusable rather than silently dropped — `--body "..."` used to be
  // accepted, ignored, and delivered as an empty mail with exit 0.
  const got = { "--to": null, "--subject": null, "--text": null, "--text-file": null, "--kind": null };
  let useStdin = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // `--name=value` is accepted as well as `--name value`, and it is the ONLY way to pass a
    // value that legitimately begins with two dashes. The separated form keeps its guard: a
    // flag must never silently consume the NEXT FLAG as its value, because `--to --subject x`
    // would otherwise send to a recipient literally named "--subject". An end-of-options `--`
    // marker was tried instead and is worse — it makes every later token positional, so the
    // guard it was meant to relax simply disappeared.
    let name = a, inline = null;
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq > 2) { name = a.slice(0, eq); inline = a.slice(eq + 1); }

    if (name === "--stdin") { useStdin = true; continue; }
    if (Object.prototype.hasOwnProperty.call(got, name)) {
      if (got[name] !== null) die(2, `${name} given twice — which one is authoritative is exactly the ambiguity this refuses rather than resolving`);
      if (inline !== null) { got[name] = inline; continue; }
      const v = argv[i + 1];
      if (v === undefined || String(v).startsWith("--"))
        die(2, `${name} needs a value — write \`${name}=<value>\` if the value itself begins with two dashes`);
      got[name] = v;
      i++;
      continue;
    }
    if (a.startsWith("--")) die(2, `unknown flag ${a}`);
    die(2, `mail takes no positional argument (got ${a.length} bytes of one) — every value belongs to a named flag`);
  }
  const to = got["--to"], subject = got["--subject"], text = got["--text"], textFile = got["--text-file"], kind = got["--kind"];
  if (!subject)
    die(2, "usage: arc-leads mail [--to <address>] --subject <subject> [--text <body> | --text-file <path> | --stdin] [--kind <kind>] (any flag also takes --name=value)");

  // Three doors for the BODY, and the two that keep it out of argv are the documented ones.
  // A notification body is a canary tail or a failure detail, and argv is readable in a process
  // listing, lands in shell history, and is captured verbatim by CI job logs — the same three
  // exposures `cmdIngestReply` refuses argv-borne content over (ADR-0412). `--text` stays for
  // one-line bodies because forcing a file for "deploy failed" would be theatre.
  const bodySources = [text !== null, textFile !== null, useStdin].filter(Boolean).length;
  if (bodySources > 1)
    die(2, "give the body ONE way: --text, --text-file <path>, or --stdin");
  let body = text ?? "";
  if (textFile !== null) body = readFileSync(textFile, "utf8");
  if (useStdin) {
    if (process.stdin.isTTY)
      die(2, "--stdin has no pipe attached (stdin is a terminal). Pipe the body in, or use `--text-file <path>`.");
    body = await readStdin(process.stdin);
  }

  await deliverNotification({ to, subject, text: body, kind: kind ?? "notify" });
}

// ---------- the three triggers (Phase 04 DoD) ----------
//
// A trigger differs from `mail` in exactly one way that matters: it composes its own message
// from state, so nobody has to remember what a good alert says at the moment something is on
// fire. Everything else -- the allowlist, the quota, the lock, the log -- is the same path.
//
// `approvals` sends NOTHING when nothing is waiting, and that is the design, not an omission.
// A channel that mails "0 waiting" every day is a channel the owner learns to ignore, and an
// ignored alert channel is indistinguishable from no alert channel at all -- which is the exact
// failure ADR-0415 exists to prevent.
async function cmdNotify(argv) {
  const trigger = argv[0];
  const rest = argv.slice(1);
  const flag = (name) => {
    const i = rest.indexOf(name);
    if (i === -1) return null;
    const v = rest[i + 1];
    if (v === undefined || String(v).startsWith("--")) die(2, `${name} needs a value`);
    return v;
  };
  const useStdin = rest.includes("--stdin");

  if (trigger === "canary") {
    // The failure DETAIL arrives as bytes, never as an argument: a canary tail is exactly the
    // kind of content that ends up quoted into a process listing and a CI log (ADR-0412).
    const file = flag("--text-file");
    if (!file && !useStdin)
      die(2, "usage: arc-leads notify canary (--text-file <path> | --stdin) [--what <one line>] — the failure detail arrives as bytes, never in argv");
    if (file && useStdin) die(2, "give the detail ONE way: --text-file <path> or --stdin");
    let detail;
    if (file) {
      // Named, not re-thrown. A raw `ENOENT: no such file or directory` out of an alert path is
      // telling the operator about node at the moment they need to be told about the outage.
      try { detail = readFileSync(file, "utf8"); }
      catch (e) { die(2, `the failure detail file could not be read (${e.code || e.message}) — the alert was NOT sent`); }
    } else {
      if (process.stdin.isTTY) die(2, "--stdin has no pipe attached (stdin is a terminal)");
      detail = await readStdin(process.stdin);
    }
    if (!String(detail).trim())
      die(2, "the failure detail is empty — refusing to send an alert that says nothing, which is worse than no alert");
    const what = flag("--what") || "a deploy or canary check failed";
    await deliverNotification({
      subject: `arc ALERT: ${what}`,
      text: `${what}\n\nat ${nowIst()}\n\n---- detail ----\n${detail}`,
      kind: "canary",
    });
    return;
  }

  if (trigger === "approvals") {
    // Pending = an approval.requested with no decision.recorded citing its ULID. The pairing is
    // the spine's own (`decision.decides` is the approval ULID), so this counts what the inbox
    // shows rather than inventing a second definition of "waiting" (D5).
    const events = readAllEvents({ allowMissing: true });
    const decided = new Set();
    const requested = [];
    for (const e of events) {
      if (e.kind === "decision.recorded" && e.payload && e.payload.decides) decided.add(e.payload.decides);
      else if (e.kind === "approval.requested") requested.push(e);
    }
    const waiting = requested.filter((e) => !decided.has(e.id || e.ulid));
    if (waiting.length === 0) {
      console.log("arc-leads notify approvals: nothing waiting — no mail sent (a channel that reports zero every day is a channel nobody reads)");
      return;
    }
    const oldest = waiting.map((e) => e.ts || "").filter(Boolean).sort()[0] || "unknown";
    await deliverNotification({
      subject: `arc: ${waiting.length} approval item(s) waiting`,
      text: `${waiting.length} item(s) are waiting for your decision.\n\nOldest since: ${oldest}\n\nRun \`arc-leads review <draft_ref>\` to see one, or open the approval inbox.\n\nNothing sends without you (L1, ADR-0407).`,
      kind: "approvals",
    });
    return;
  }

  if (trigger === "brief") {
    // The brief already renders itself to stdout, so this mails THE BRIEF rather than a second
    // rendering of the same day that could disagree with it.
    let brief;
    try {
      brief = execFileSync(process.execPath, [join(REPO_ROOT, ".claude/scripts/hq/arc-brief.mjs")], { encoding: "utf8" });
    } catch (e) {
      die(3, `the brief could not be rendered (${e.status ?? e.code ?? e.message}) — refusing to mail a brief that failed to build, because an empty brief reads as a quiet day`);
    }
    if (!String(brief).trim())
      die(3, "the brief rendered empty — refusing to send, because an empty brief is indistinguishable from a quiet day");
    await deliverNotification({
      subject: `arc daily brief — ${nowIst().slice(0, 10)}`,
      text: brief,
      kind: "brief",
    });
    return;
  }

  die(2, "usage: arc-leads notify (canary --text-file <p>|--stdin [--what <line>] | approvals | brief)");
}

// ---------- main ----------
// ARC_LEADS_NOW buckets the daily cap, so it is a cap override and is validated HERE --
// before any subcommand, before any store or config is touched. It lived inside cmdDaily and
// therefore fired only if every earlier check happened to pass, which made both its guarantee
// and its test dependent on unrelated ordering.
if (process.env.ARC_LEADS_NOW) {
  if (process.env.ARC_LEADS_FAKE !== "1")
    die(2, "ARC_LEADS_NOW is a test-only clock door and is refused without ARC_LEADS_FAKE=1 — it buckets the daily cap, so honouring it against a real provider would be a cap override (ADR-0403).");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/.test(process.env.ARC_LEADS_NOW))
    die(2, `ARC_LEADS_NOW ${JSON.stringify(process.env.ARC_LEADS_NOW)} must be YYYY-MM-DDTHH:MM:SS+05:30`);
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "store" && rest[0] === "init") cmdStoreInit();
  else if (cmd === "campaign" && rest[0] === "init") cmdCampaignInit(rest[1]);
  else if (cmd === "research") await cmdResearch(rest[0]);
  else if (cmd === "draft") cmdDraft(rest[0], rest[1]);
  else if (cmd === "review") cmdReview(rest[0]);
  else if (cmd === "ingest-reply") await cmdIngestReply(rest);
  else if (cmd === "reconcile") await cmdReconcile();
  else if (cmd === "unlock") cmdUnlock();
  else if (cmd === "daily") await cmdDaily(rest[0]);
  else if (cmd === "preflight") await cmdPreflight();
  else if (cmd === "mail") await cmdMail(rest);
  else if (cmd === "notify") await cmdNotify(rest);
  else if (cmd === "state") cmdState(rest.includes("--json"));
  else if (cmd === "report") cmdReport(rest);
  else {
    console.error("arc-leads: usage:");
    console.error("  store init                      mint the private store and its HMAC secret");
    console.error("  campaign init <name>            bind a campaign to this store");
    console.error("  research ICP.json               ICP in, dossiers + receipts out");
    console.error("  draft <campaign> <drafts.json>  lint, then queue for approval (FAIL never reaches the inbox)");
    console.error("  review <draft_ref>              render the draft LOCALLY, beside its evidence");
    console.error("  daily <campaign>                the human-started send run — nothing runs in the background");
    console.error("  ingest-reply --file <p>|--stdin|--inbound   a reply in: triage, receipt, suppression or calendar draft, same run");
    console.error("  reconcile                       spine-first recovery of unresolved intents");
    console.error("  unlock                          clear a send lock whose holder is DEAD (refuses if alive)");
    console.error("  mail [--to <a>] --subject <s> [--text <b>|--text-file <p>|--stdin]   arc -> owner notification only; allowlist-locked (ADR-0415)");
    console.error("  notify canary --stdin | notify approvals | notify brief   the three triggers; approvals is SILENT when nothing waits");
    console.error("  report [--campaign <c>] [--from <ts>] [--to <ts>] [--json]   the ADR-0416 mixing count over a window: rehearsal vs real, as numbers");
    console.error("  preflight | state --json");
    console.error("  The real campaign is Phase 03 and is BLOCKED on business physics (ADR-0413).");
    process.exit(2);
  }
} catch (e) {
  if (e instanceof StoreError) die(5, e.message);
  if (e instanceof DraftError) die(2, e.message);
  if (e instanceof GuardRefusal) die(3, `[${e.step}] ${e.message}`);
  if (e instanceof IngestRefusal) die(e.step === "usage" ? 2 : 3, `[${e.step}] ${e.message}`);
  if (e instanceof ProviderError) die(PROVIDER_EXIT, `${e.kind}: ${e.message}`);
  if (e instanceof EnvError) die(2, e.message);
  // The map is imported from `mail.mjs`, beside the throws, rather than re-derived here as a
  // chain of ternaries. The distinction it carries: `sent-unlogged` means the mail IS in the
  // inbox and only the bookkeeping failed, so a caller must NOT retry, while every other kind
  // means nothing was delivered. An unknown kind falls to 3 rather than 0 — a refusal nobody
  // mapped is still a refusal.
  if (e instanceof MailRefusal) die(MAIL_EXIT[e.kind] ?? 3, `[${e.kind}] ${e.message}`);
  die(2, e.message);
}
