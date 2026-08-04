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
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initStore, openStore, leadId, fingerprint, StoreError, storePath, STORE_FILE_MODE } from "./lib/store.mjs";
import { lintCandidates } from "./lib/research-lint.mjs";
import { source, verifier, ProviderError, PROVIDER_EXIT } from "./lib/deps.mjs";
import { preflight, PREFLIGHT_REFUSED } from "./lib/preflight.mjs";
import { leadsIdem } from "../hq/lib/validate-leads.mjs";
import { readAllEvents } from "./lib/spine-read.mjs";
import { initCampaign, assertCampaignStore, writeDraft, readDraft, listDrafts, currentSha, approvalPayload, DraftError } from "./lib/drafts.mjs";
import { lintDraft, lintCampaign, VERDICT } from "./lib/personalization.mjs";
import { runDaily, approvedShaFor, unsubscribeHeader } from "./lib/sequencer.mjs";
import { reconcile, unresolvedIntents } from "./lib/journal.mjs";
import { provider } from "./lib/deps.mjs";
import { GuardRefusal, acquireLock } from "./lib/guard.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");

const die = (code, msg) => { console.error(`arc-leads: ${msg}`); process.exit(code); };

// ---------- emit ----------
//
// The ONE leads emitter (C15). Every leads receipt is constructed here from a literal shape,
// so "no PII in a payload" is a property of one function rather than a habit spread over the
// codebase. --idem is never passed: the emitter derives it for leads kinds and refuses a
// supplied one (anti-preclaim, ADR-0400).
function emit(kind, payload, { evidence = null } = {}) {
  const sh = join(REPO_ROOT, ".claude/scripts/hq/arc-event.sh");
  // --payload-file, NOT --payload. The payload used to travel in the argv of TWO processes
  // (bash, then node), readable by any local process listing -- and on a non-zero exit Node
  // builds `Command failed: bash ... --payload {...}` into err.message, which the catch below
  // printed to stderr, i.e. into scrollback and CI logs. ADR-0412 says no PII through argv;
  // today's payloads carry only HMACs and enums, but this is the one emitter every Phase 01-02
  // receipt will route through, so the door is closed before it matters.
  const tmp = join(tmpdir(), `arc-leads-${process.pid}-${Math.abs(Date.now() % 1e9)}.json`);
  writeFileSync(tmp, JSON.stringify(payload), { mode: STORE_FILE_MODE });
  try {
    const args = ["emit", kind, "--payload-file", tmp, "--actor", "arc-leads", "--strict"];
    if (evidence) args.push("--evidence", evidence);
    return execFileSync("bash", [sh, ...args], { encoding: "utf8" });
  } catch (e) {
    // Re-raise WITHOUT the child command line: err.message embeds the whole invocation.
    throw new Error(`arc-event refused a ${kind} receipt (exit ${e.status}). stderr: ${String(e.stderr || "").trim()}`);
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
  mkdirSync(dossierDir, { recursive: true });
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

// ---------- preflight ----------
async function cmdPreflight() {
  const res = await preflight({ warmupApproved: process.env.LEADS_WARMUP_APPROVED === "1" });
  for (const f of res.findings) console.log(`  ${f.ok ? "ok  " : "REFUSED"} ${f.rule}: ${f.detail}`);
  if (!res.ok) {
    console.error("arc-leads preflight: REFUSED — no send may happen until every clause passes live (REQ-00)");
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
  else if (cmd === "reconcile") await cmdReconcile();
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
    console.error("  reconcile                       spine-first recovery of unresolved intents");
    console.error("  preflight | state --json");
    console.error("  The real campaign is Phase 03 and is BLOCKED on business physics (ADR-0413).");
    process.exit(2);
  }
} catch (e) {
  if (e instanceof StoreError) die(5, e.message);
  if (e instanceof DraftError) die(2, e.message);
  if (e instanceof GuardRefusal) die(3, `[${e.step}] ${e.message}`);
  if (e instanceof ProviderError) die(PROVIDER_EXIT, `${e.kind}: ${e.message}`);
  die(2, e.message);
}
