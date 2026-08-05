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
import { leadsIdem } from "../hq/lib/validate-leads.mjs";
import { readAllEvents } from "./lib/spine-read.mjs";
import { initCampaign, assertCampaignStore, writeDraft, readDraft, listDrafts, currentSha, approvalPayload, DraftError } from "./lib/drafts.mjs";
import { lintDraft, lintCampaign, VERDICT } from "./lib/personalization.mjs";
import { runDaily, approvedShaFor, unsubscribeHeader } from "./lib/sequencer.mjs";
import { reconcile, unresolvedIntents } from "./lib/journal.mjs";
import { provider } from "./lib/deps.mjs";
import { GuardRefusal, acquireLock, lockHolder, clearStaleLock } from "./lib/guard.mjs";

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

    emit("lead.researched", {
      lead_id: id, campaign, provenance: a.provenance, geography: a.geography,
      email_status: a.email_status, fact_count: a.fact_count,
      store_id: store.storeId, store_fingerprint: fp,
      ...(a.below_bar ? { below_bar: true } : {}),
    });
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

  let written = 0, blocked = 0;
  linted.forEach((d, i) => {
    if (scored[i].verdict === VERDICT.FAIL) {
      blocked++;
      console.log(`  FAIL  ${d.lead_id}: ${d.fails.join(" | ")}`);
      return;
    }
    const warns = scored[i].warns;
    const rec = writeDraft(store, {
      campaign, lead_id: d.lead_id, touch_n: d.touch_n, body: d.body, cites: d.cites,
      lintStatus: scored[i].verdict === VERDICT.PASS ? "PASS" : `BELOW-BAR: ${warns.join(" | ")}`,
    });
    emit("approval.requested", approvalPayload(rec));
    written++;
    console.log(`  ${scored[i].verdict === VERDICT.PASS ? "PASS " : "WARN "} ${rec.draft_ref} ${d.lead_id}${warns.length ? " — " + warns.join(" | ") : ""}`);
  });
  console.log(`arc-leads draft: ${written} queued for approval, ${blocked} FAIL blocked before the inbox`);
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
        store, bytes: inp.bytes, repoRoot: REPO_ROOT, events: readAllEvents({ allowMissing: true }),
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
  const events = readAllEvents({ allowMissing: true });
  const leads = new Map();
  const campaigns = {};
  const touch = (id) => leads.get(id) || leads.set(id, { last_touch_at: null, lead_id: id, suppressed: false, touches: 0 }).get(id);

  for (const e of events) {
    const p = e.payload || {};
    if (e.kind === "lead.researched") touch(p.lead_id);
    else if (e.kind === "outreach.sent") {
      const l = touch(p.lead_id);
      l.touches += 1;
      if (!l.last_touch_at || p.submitted_at > l.last_touch_at) l.last_touch_at = p.submitted_at;
      (campaigns[p.campaign] ||= { replied: 0, submitted: 0 }).submitted += 1;
    } else if (e.kind === "outreach.replied") {
      touch(p.lead_id);
      (campaigns[p.campaign] ||= { replied: 0, submitted: 0 }).replied += 1;
    } else if (e.kind === "lead.suppressed") touch(p.lead_id).suppressed = true;
  }

  const out = {
    campaigns: Object.fromEntries(Object.keys(campaigns).sort().map((k) => [k, campaigns[k]])),
    leads: [...leads.values()].sort((a, b) => (a.lead_id < b.lead_id ? -1 : a.lead_id > b.lead_id ? 1 : 0)),
  };
  if (json) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  return out;
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
  else if (cmd === "state") cmdState(rest.includes("--json"));
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
  die(2, e.message);
}
