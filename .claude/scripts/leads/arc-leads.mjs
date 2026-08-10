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
import { lintCandidates, normKey } from "./lib/research-lint.mjs";
import { source, verifier, ProviderError, PROVIDER_EXIT } from "./lib/deps.mjs";
import { preflight, PREFLIGHT_REFUSED, loadConfig, seedSmokeFinding } from "./lib/preflight.mjs";
import { ingestReply, readReplyFile, readStdin, IngestRefusal } from "./lib/ingest.mjs";
import { inbound } from "./lib/deps.mjs";
// `assertTs` is the house timestamp grammar, imported rather than re-spelled — the same
// validator the payload stamps went through, so a window bound and the receipts it is compared
// against can never be judged by two different grammars (D5).
import { leadsIdem, assertTs } from "../hq/lib/validate-leads.mjs";
import { readAllEvents, dayFileCount, quarantineCount, idemKeys } from "./lib/spine-read.mjs";
import { initCampaign, assertCampaignStore, CAMPAIGN_NAME_RE, writeDraft, readDraft, listDrafts, currentSha, approvalPayload, DraftError } from "./lib/drafts.mjs";
import { lintDraft, lintCampaign, VERDICT } from "./lib/personalization.mjs";
import { runDaily, approvedShaFor, unsubscribeHeader } from "./lib/sequencer.mjs";
import { reconcile, unresolvedIntents } from "./lib/journal.mjs";
import { provider, usingFakes } from "./lib/deps.mjs";
import { GuardRefusal, acquireLock, lockHolder, clearStaleLock, sendCounts, foldSends, campaignNames, canonicalLeadId, normalizeTouchN } from "./lib/guard.mjs";
import { loadEnvLocal, EnvError, ENV_LOCAL } from "./lib/env.mjs";
import { sendNotification, MailRefusal, MAIL_EXIT, assertEnvLocalNames, loadAllowlist } from "./lib/mail.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");

const die = (code, msg) => { console.error(`arc-leads: ${msg}`); process.exit(code); };

// ONE campaign-name grammar, for every door a campaign name can enter through.
//
// `research` validated the name it read out of the ICP file and `draft` validated nothing at
// all: it took the name from argv and handed it straight to `assertCampaignStore`, which asks
// the filesystem whether that campaign directory exists. On Windows and on macOS that answer is
// case-insensitive, so `draft Walk` opened the `walk` campaign and wrote into it under a name
// the idem preimage treats as different — two approvals for one touch, from one keystroke.
//
// The grammar is not cosmetic: `|` is the idem delimiter, so a campaign name that could contain
// one could forge the boundary between fields in another lead's preimage.
function assertCampaignName(campaign, where) {
  if (!CAMPAIGN_NAME_RE.test(String(campaign ?? "")))
    die(2, `${where} must match [a-z0-9-]{1,64} (got ${JSON.stringify(campaign)}) — "|" is the idem delimiter, and an uppercase variant is a different campaign to the spine and the same directory to the filesystem`);
  return String(campaign);
}

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
    return { duplicate: false, stdout: execFileSync("bash", [sh, ...args], { encoding: "utf8" }) };
  } catch (e) {
    const stderr = String(e.stderr || "");
    // A SWALLOWED DUPLICATE IS REPORTED, NOT ERASED. This used to return `""`, indistinguishable
    // from a successful emit that printed nothing, so every caller counted a refusal as a new
    // receipt — the run said "5 new receipts" for a spine that had gained none. Worse, the
    // emitter quarantines BEFORE it writes REJECT, so the swallow leaves a record behind that
    // makes `report` refuse outright: the one number this phase exists to produce, disabled by
    // an outcome the caller was told was fine. Callers now learn that it happened and can say so.
    if (allowDuplicate && DUP_IDEM_RE.test(stderr)) return { duplicate: true, stdout: "" };
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
  assertCampaignName(campaign, `ICP "campaign"`);

  let store;
  try { store = openStore({ repoRoot: REPO_ROOT }); }
  catch (e) { die(5, e.message); }

  let candidates;
  try { candidates = await source().search(icp); }
  catch (e) { die(e instanceof ProviderError ? PROVIDER_EXIT : 2, e.message); }

  // Verify every address BEFORE linting, so `held` is decided by the verifier rather than by
  // whichever branch happened to run first.
  const verdicts = new Map();
  // KEYED WITH THE FUNCTION THAT READS IT. `lintCandidates` looks these up through
  // `normKey` (NFC + trim + lowercase); this built them with a bare `toLowerCase()`, so any
  // address carrying padding or a non-NFC character missed the lookup and came back
  // `undefined` — which `lintCandidates` reads as HELD. A verified lead reported as held is
  // indistinguishable from a real hold, and it silently drops a person out of the five.
  for (const c of candidates) verdicts.set(normKey(c.email), await verifier().verify(c.email));

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
  // ...and the first version of that guard was wrong in all three of the ways below, so the
  // comment above describes the intent and this one describes what it takes to hold it.
  //
  // 1. THE SNAPSHOT WAS NEVER GROWN. `onSpine` was read once before the loop and never added
  //    to, so two rows for one lead INSIDE one corpus — a duplicate row, or the same address in
  //    a different case, both ordinary scraper output — passed the check twice and the second
  //    emit was refused. D6 inside its own commit: the draft half of that same commit grows its
  //    map for exactly this reason and says so.
  // 2. THE SKIP AND THE REFUSAL READ DIFFERENT FILES. The skip folded `events/*.jsonl`; the
  //    emitter refuses from `derived/idem.index`. One fact, two derivations (D5), and they
  //    disagree precisely when a day file has been restored or archived: the index still holds
  //    the key, the fold no longer sees it, so the skip says emit and the emitter says refused —
  //    forever. Those receipts were permanently unrecordable. Both are read now, and the
  //    DISAGREEMENT is named rather than resolved by preferring one.
  // 3. SWALLOWING THE EXCEPTION DID NOT UNDO THE QUARANTINE. `arc-event` quarantines and then
  //    writes REJECT, so every tolerated DUP_IDEM left a record and `report` refuses while any
  //    record exists. The backstop therefore disabled the phase's one number while reporting
  //    success. The remedy is to stop PRODUCING them: the read and the emits are one critical
  //    section under the same lock `daily` and `notify` take, which is what makes the check and
  //    the act atomic against another arc-leads process. That lock existed and this branch was
  //    the one that never took it — the same D6, three commands apart.
  const release = acquireLock(store);
  let emitted = 0, alreadyOnSpine = 0;
  const changedUnderOneIdem = [], orphanedIdem = [], racedDuplicate = [], emitFailed = [];
  // Which idems THIS run put on the spine, and which distinct people the corpus actually
  // described. Both exist because `accepted.length` is a count of ROWS and every number this
  // command prints is about PEOPLE.
  const emittedThisRun = new Set();
  const distinctLeads = new Map();
  try {
    const priorEvents = readAllEvents({ allowMissing: true });
    // Keyed by idem so a skip can compare the PAYLOAD, not merely observe that the key exists.
    const byIdem = new Map();
    for (const e of priorEvents) if (e && e.idem) byIdem.set(e.idem, e);
    const indexed = idemKeys();

    for (const a of accepted) {
      const id = leadId(store, a.email);
      // LAST WRITE WINS, exactly as the dossier file does four lines below, so this map always
      // describes the store rather than a parallel opinion of it.
      distinctLeads.set(id, a);
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
      const idem = leadsIdem("lead.researched", receipt);

      // SAME KEY IS NOT SAME RECEIPT. The preimage is `campaign|lead_id|below_bar|fingerprint`
      // and deliberately excludes `email_status`, so a lead that was `verified` last run and is
      // `held` this run collides on one idem — and the old skip treated that as "already
      // recorded" and moved on, leaving the spine asserting `verified` about a lead the verifier
      // has since rejected. A skip that cannot tell "identical" from "merely colliding" is not a
      // skip, it is a silent overwrite in the direction of the stale value.
      const prior = byIdem.get(idem);
      if (prior) {
        const diff = payloadDiff(prior.payload, receipt);
        // WHOSE receipt it collided with decides what the operator should DO, and the first
        // version said the same thing either way. If this run emitted it a few rows ago, the
        // "prior" is a sibling row in the same corpus and nothing was on the spine before now —
        // so telling the operator to write a correction receipt sends them to fix the spine when
        // what needs fixing is their input file. Worse, the dossier on disk has already been
        // overwritten by the losing row, so store and spine now disagree about that lead.
        if (diff.length) changedUnderOneIdem.push({ id, diff, sameRun: emittedThisRun.has(idem) });
        else alreadyOnSpine++;
        continue;
      }

      // ON THE INDEX BUT NOT IN ANY DAY FILE. The emitter will refuse this key and quarantine the
      // attempt, every time, forever; emitting it is choosing to create the record that disables
      // `report`. Naming it is the only honest move — this is a spine that needs `arc-replay`,
      // not a receipt that needs retrying.
      if (indexed.has(idem)) { orphanedIdem.push(id); continue; }

      // PER-LEAD FAILURE ISOLATION. The tolerance was pinned to DUP_IDEM alone, so every OTHER
      // refusal — an unknown payload key, a closed day, a lock timeout — threw out of the loop
      // and restored the exact pre-fix behaviour: earlier dossiers rewritten, later leads never
      // reached, and the command's exit code the only clue. Research is safely re-runnable (the
      // dossier write is idempotent and the receipt is keyed), so one bad lead now costs that
      // lead and nothing else, and the run still ends non-zero with every failure named.
      let res;
      try {
        res = emit("lead.researched", receipt, { allowDuplicate: true });
      } catch (e) {
        emitFailed.push({ id, message: e.message });
        continue;
      }
      if (res.duplicate) { racedDuplicate.push(id); continue; }
      emitted++;
      emittedThisRun.add(idem);
      // GROWN, so the next row for this same lead in this same corpus is caught by the branch
      // above instead of by the emitter. The stored shape mirrors a real event closely enough for
      // the payload comparison, and it is only ever read back inside this loop.
      byIdem.set(idem, { idem, payload: receipt });
      indexed.add(idem);
    }
  } finally {
    release();
  }

  // Rejected candidates keep a record too: the 25 must be a filtered set with an audit trail,
  // not a survivor list. A rejection without a reason is invalid and refuses here.
  const rejPath = join(store.dir, "rejected.jsonl");
  const lines = rejected.map((r) => {
    if (!r.exclusion_reason) die(2, `internal: a rejection for "${r.firm}" carries no exclusion_reason`);
    return JSON.stringify(r);
  });
  writeFileSync(rejPath, lines.length ? lines.join("\n") + "\n" : "");

  // EVERY NUMBER HERE IS OVER PEOPLE, NOT OVER ROWS, and it used to be over rows. A corpus
  // holding one firm twice — its own site and a directory, which is ordinary scraper output —
  // wrote ONE dossier file and reported `dossiers: 2`, and counted that person twice toward the
  // "25 leads" gate REQ-05 measures. The receipts line was already honest, which is why the lie
  // survived: the two lines disagreed and only one of them was read.
  // A PARTITION, so the four numbers sum to the people they describe. They used to overlap:
  // a lead that was both `held` and `below_bar` was counted twice, and a VERIFIED below-bar
  // lead appeared only under BELOW-BAR — so an operator reading "3 PASS · 1 HELD · 1 BELOW-BAR"
  // could not tell whether that was five people or four. Each person lands in exactly one bucket,
  // held first because an address the verifier could not confirm can never be sent to at all.
  const people = [...distinctLeads.values()];
  const held = people.filter((a) => a.email_status === "held").length;
  const below = people.filter((a) => a.email_status !== "held" && a.below_bar).length;
  const pass = people.filter((a) => a.email_status === "verified" && !a.below_bar).length;
  const other = people.length - held - below - pass;
  // `other` is printed only when it is non-zero, and it exists because a partition that silently
  // drops a bucket is the same lie as an overlapping one: an accepted lead whose email_status is
  // neither `verified` nor `held` belongs to nobody, and would simply vanish from this line.
  console.log(`arc-leads research: ${pass} PASS · ${held} HELD · ${below} BELOW-BAR${other ? ` · ${other} UNCLASSIFIED` : ""} · ${rejected.length} REJECTED`);
  console.log(`  dossiers: ${people.length} in ${dossierDir}`);
  if (people.length !== accepted.length)
    console.log(`  NOTE: ${accepted.length} accepted row(s) collapsed to ${people.length} distinct lead(s) — a duplicated row is still one person, and every count above is over people`);
  // COUNTED AND PRINTED, because a silent skip and a silent emit look identical to an operator
  // asking "did that run do anything" -- which is the exact question a re-run exists to ask.
  console.log(`  receipts: ${emitted} new · ${alreadyOnSpine} already on the spine`);
  for (const r of rejected) console.log(`  REJECTED ${r.firm}: ${r.exclusion_reason}`);

  // THE ANOMALIES ARE NOT FOLDED INTO THE COUNTS ABOVE. `emitted` used to include every
  // swallowed duplicate, so a run that added nothing to the spine reported five new receipts —
  // and the operator's next question ("did that run do anything?") had been answered wrong by
  // the one line written to answer it. Each of these is a different thing being wrong, so each
  // is named separately and none of them is a number beside the healthy ones.
  const anomalies = [];
  // TWO REMEDIES, BECAUSE THEY ARE TWO DIFFERENT PROBLEMS — and the flag that distinguishes
  // them was added to the push above, asserted in a test, and never read here. The result was a
  // red suite and, worse, an operator sent to write a spine correction receipt for a defect
  // that lives in the file on their disk. A half-shipped fix is the class this lane keeps
  // paying for; this is it in three lines.
  for (const { id, diff, sameRun } of changedUnderOneIdem)
    anomalies.push(sameRun
      ? `lead ${id}: this corpus holds TWO rows for one person that disagree on ${diff.join(", ")} — the idem preimage does not cover ${diff.join("/")}, so they collide, and the dossier on disk has already been overwritten by whichever row came last. Nothing was emitted for the second one. Dedupe the corpus and run again; the spine is fine`
      : `lead ${id}: a receipt with this exact idem is already on the spine from an earlier run but its payload differs (${diff.join(", ")}) — the idem preimage does not cover ${diff.join("/")}, so the spine still asserts the OLD value. Nothing was emitted; this needs a correction receipt, not a re-run`);
  for (const id of orphanedIdem)
    anomalies.push(`lead ${id}: its idem is in derived/idem.index but in no day file — the emitter will refuse it and quarantine every attempt. The index is derived state; rebuild it with arc-replay rather than retrying this command`);
  for (const id of racedDuplicate)
    anomalies.push(`lead ${id}: another writer took this idem between the read and the emit. The receipt IS on the spine, but the refusal left a quarantine record, and \`report\` refuses while any record exists — clear the quarantine before asking for the mixing report`);
  for (const { id, message } of emitFailed)
    anomalies.push(`lead ${id}: the emitter refused its receipt — ${message}`);

  if (anomalies.length) {
    console.error("");
    for (const a of anomalies) console.error(`arc-leads: ANOMALY — ${a}`);
    // EXIT NON-ZERO. Every one of these leaves the spine unable to answer the question this
    // phase exists to ask, and an exit 0 beside a printed warning is how the previous version
    // of this command disabled the mixing report without anybody noticing for a day.
    die(2, `${anomalies.length} receipt(s) did not reach the spine cleanly — the dossiers are written and the run is re-runnable, but the counts above do not describe a healthy spine.`);
  }
}

// A SHALLOW, ORDER-INDEPENDENT COMPARISON OF TWO RECEIPT PAYLOADS, returning the field names
// that differ. Receipt payloads are flat records of scalars by construction (the emitter's own
// header is the reason), so this deliberately does not recurse: a deep comparison here would be
// a second, richer notion of "same receipt" than the one the validator enforces, and the point
// of the function is to have exactly one.
function payloadDiff(a, b) {
  const left = a && typeof a === "object" ? a : {};
  const right = b && typeof b === "object" ? b : {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const diff = [];
  // JSON-compared, not `!==`, so `1` and `"1"` are reported as the difference they are rather
  // than passing as equal-ish — the same trap `normalizeTouchN` exists for one file away.
  for (const k of [...keys].sort())
    if (JSON.stringify(left[k]) !== JSON.stringify(right[k])) diff.push(k);
  return diff;
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
  // BEFORE `assertCampaignStore`, which asks a case-insensitive filesystem and therefore
  // answers yes to a name the spine considers different.
  assertCampaignName(campaign, "the <campaign> argument");
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
  // A DRAFT ON DISK IS HALF A RECORD, AND THE OTHER HALF IS ON THE SPINE.
  //
  // The seed above read only the store, and `writeDraft` (disk) runs before `emit` (spine) with
  // nothing between them that can roll back. Any interruption in that window — Ctrl-C, the 8s
  // spine-lock timeout, a full disk, an emitter refusal of any kind — left a draft file with no
  // approval receipt. The next run then found that file, called it a duplicate, and printed
  // `edit that draft` about a draft that had never been announced to anybody: 0 queued, 1
  // duplicate refused, exit 0, reading exactly like a healthy re-run. The touch was
  // unqueueable permanently and silently, which is strictly worse than the noisy recoverable
  // second approval the duplicate rule was added to prevent.
  //
  // So the two halves are read together, and a draft with no receipt is not a duplicate — it is
  // an unfinished write, and finishing it is what a re-run is for. Rollback would not do: a
  // process killed between the two writes never runs its own rollback, and this recovery has to
  // work for the case where nothing of ours got to run at all.
  // AND A REJECTED APPROVAL IS NOT A LIVE ONE. The rule is one LIVE approval per touch, and
  // reading it as one approval EVER made a rejection terminal: the human said no in the inbox,
  // the draft stayed on disk, `draft` called it a duplicate forever, and the only way to put a
  // revised version in front of them was a different `touch_n` — which is a second live approval
  // for what is physically the same touch, i.e. the exact state this rule exists to forbid. A
  // rule whose only escape hatch is the thing it forbids is not being enforced, it is being
  // routed around.
  // UNDER THE LOCK, like every other read-then-emit critical section in this file. `research`,
  // `reconcile`, `runDaily` and `deliverNotification` all take it; `draft` — which guards the
  // same one-live-approval invariant across the same read-then-emit window — did not, so two
  // concurrent runs both read the store and the spine, both missed, and both emitted. The
  // adjacent branch that never got the guard, one function away from the fix that cites it (D6).
  const releaseDraft = acquireLock(store);
  // `die` calls `process.exit`, and `process.exit` does NOT run a `finally` block. So every
  // refusal inside this critical section would leave `.send.lock` on disk naming a pid that had
  // exited cleanly, and the next run would refuse with "another arc-leads process holds the send
  // lock" — a lock the operator is explicitly told is NEVER auto-broken. The release verifies it
  // still owns the lock before unlinking, so calling it here and again in `finally` is safe.
  const dieUnlocked = (code, msg) => { try { releaseDraft(); } catch { /* already released */ } die(code, msg); };
  try {
  const priorEvents = readAllEvents({ allowMissing: true });
  const priorDrafts = listDrafts(store, campaign);

  // CAN THIS FOLD SEE THE WHOLE SPINE? The resume path below turns "I found no approval for
  // this draft" into "emit one", and that inference is only valid if the absence is real.
  // `approvalState` reads day files; `cmdResearch` reads day files AND `derived/idem.index`
  // precisely because a restored or archived day leaves the index holding keys the fold can no
  // longer see. On such a spine every already-announced draft looks unannounced, and the resume
  // re-emits — and an `approval.requested` idem is millisecond-salted, so the emitter cannot
  // deduplicate it. Two live approvals for one touch, from the branch added to prevent exactly
  // that. Same D5 as `cmdResearch`, in the sibling command, one round later.
  //
  // The resume is the only inference that depends on completeness, so only the resume is
  // withheld. A first-time draft on a spine with archived days is still ordinary work.
  const foldedIdems = new Set(priorEvents.map((e) => e && e.idem).filter(Boolean));
  let unfoldable = 0;
  for (const k of idemKeys()) if (!foldedIdems.has(k)) unfoldable++;

  // AND THE MIRROR CASE: A LIVE APPROVAL WHOSE DRAFT FILE IS GONE.
  //
  // The paragraph above says a draft on disk is half a record — and then the first version of
  // this block read that half and asked the spine only about drafts it had already found on
  // disk. An `approval.requested` naming a draft_ref with no file was therefore invisible, so
  // the same input queued a SECOND live approval for that touch: two undecided items in the
  // inbox on gate `leads-send`, both rendering, `approvedShaFor` honouring whichever the human
  // clicks, and "which approval authorised this mail?" with no answer — the precise ADR-0407
  // state this whole block exists to forbid, reached at exit 0 with no warning.
  //
  // It is not an exotic trigger. The store lives outside the repo with no git safety net and
  // `store init` says so: a restore from a backup taken before the draft was written, a partial
  // copy between machines, or a tidy-up of `drafts/` produces it.
  //
  // It REFUSES rather than repairing, because the repair is not this command's to invent: the
  // send path cannot read that draft either, so the state is broken for the approval that
  // already exists, not merely for the one being asked for.
  const onDisk = new Set(priorDrafts.map((d) => d.draft_ref));
  const dangling = [...new Set(
    priorEvents
      .filter((e) => e && e.kind === "approval.requested" && e.payload &&
        e.payload.gate === "leads-send" && e.payload.campaign === campaign &&
        !onDisk.has(e.payload.draft_ref))
      .map((e) => e.payload.draft_ref)
  )].filter((ref) => approvalState(priorEvents, ref) === "live");
  if (dangling.length)
    dieUnlocked(2, `${dangling.length} live approval(s) in "${campaign}" name a draft this store does not hold (${dangling.join(", ")}) — refusing, because queueing anything now would put a second live approval in the inbox for a touch that already has one, and the send path cannot read the first one either. Restore the store, or reject those approvals in the inbox, then run this again.`);

  const seenTouch = new Map();
  const unannounced = new Map();
  const rejectedTouch = new Map();
  for (const prior of priorDrafts) {
    let key;
    try { key = touchKey(store, prior.lead_id, prior.touch_n); }
    catch (e) { dieUnlocked(2, `the stored draft ${prior.draft_ref} carries an unusable touch_n: ${e.message}`); }
    const state = approvalState(priorEvents, prior.draft_ref);
    // A LIVE approval wins over anything else recorded for the same touch, whatever order
    // `listDrafts` happened to return the files in. After a reject-then-revise there are two
    // drafts for one touch and only one of them is live; picking by iteration order would make
    // the answer depend on a directory listing.
    if (state === "live") { seenTouch.set(key, prior.draft_ref); rejectedTouch.delete(key); unannounced.delete(key); continue; }
    if (seenTouch.has(key)) continue;
    // REJECTED IS KEPT AS A LIST, not as one overwritten slot. Two rejected drafts on one touch
    // are ordinary (reject, revise, reject again) and `readdirSync` order decided which one the
    // body comparison ran against — so re-submitting the body of the EARLIER rejected draft was
    // silently accepted and announced again. Every rejected body for the touch is compared.
    if (state === "rejected") { const l = rejectedTouch.get(key) || []; l.push(prior); rejectedTouch.set(key, l); }
    else unannounced.set(key, prior);
  }

  let written = 0, blocked = 0, duplicate = 0, resumed = 0, stale = 0, rejectedSame = 0;
  const halfWritten = [];
  linted.forEach((d, i) => {
    if (scored[i].verdict === VERDICT.FAIL) {
      blocked++;
      console.log(`  FAIL  ${d.lead_id}: ${d.fails.join(" | ")}`);
      return;
    }
    // An unusable `touch_n` costs THIS draft and not the run: it arrives from an input file a
    // human wrote, and killing the batch on one bad row is the same all-or-nothing failure the
    // rest of this function is being rescued from.
    let key;
    try { key = touchKey(store, d.lead_id, d.touch_n); }
    catch (e) { blocked++; console.log(`  FAIL  ${d.lead_id}: ${e.message}`); return; }

    if (seenTouch.has(key)) {
      duplicate++;
      console.log(`  DUP   ${d.lead_id}: touch ${d.touch_n} already has draft ${seenTouch.get(key)} in "${campaign}" — edit that draft, or use the next touch_n. No second approval was requested.`);
      return;
    }

    // A revision after a rejection writes a NEW draft below, with its own ref and its own
    // draft_sha, so the rejected one stays on the spine as the record of a decision that was
    // actually taken. The one thing refused is re-asking the identical question: the same body
    // produces the same approval payload, the same idem, and a DUP_IDEM whose quarantine record
    // then disables `report` — so it is refused HERE, with the reason, rather than at the
    // emitter, where the reason is lost.
    // EVERY rejected body for this touch, not whichever one the directory listing returned
    // last. Refs are random hex, so "the last one" was an arbitrary choice that let the body of
    // an earlier rejected draft through as though it were a revision.
    const rejectedHere = rejectedTouch.get(key) || [];
    const sameAsRejected = unannounced.has(key)
      ? null
      : rejectedHere.find((r) => readDraft(store, r.draft_ref).body === d.body);
    if (sameAsRejected) {
      rejectedSame++;
      console.log(`  NO    ${d.lead_id}: touch ${d.touch_n} was REJECTED as draft ${sameAsRejected.draft_ref} and this input carries the same body. Change it and re-run — a revised body is announced as a new approval; an unchanged one just asks the same question again.`);
      return;
    }

    const orphan = unannounced.get(key);
    if (orphan && unfoldable > 0) {
      // "No approval found" is not "no approval exists" on a spine this fold cannot fully read.
      stale++;
      console.log(`  UNSURE ${orphan.draft_ref} ${d.lead_id}: touch ${d.touch_n} has a draft with no approval in the days this fold can read, but ${unfoldable} idem(s) in derived/idem.index belong to events it cannot see — so "never announced" cannot be told from "announced on a day that is no longer here". Nothing was emitted. Rebuild with arc-replay, or restore the archived day, then run this again.`);
      return;
    }
    if (orphan) {
      // Announce the draft that EXISTS rather than minting a second one. But only if it still
      // says what this input says: re-emitting an approval for a body the operator has since
      // changed would bind the L1 decision to text nobody is looking at, and the approval binds
      // `draft_sha` precisely so that cannot happen quietly.
      const existing = readDraft(store, orphan.draft_ref);
      if (existing.body !== d.body) {
        stale++;
        console.log(`  STALE ${orphan.draft_ref} ${d.lead_id}: touch ${d.touch_n} has a draft on disk from an interrupted run, and its body differs from this input. Nothing was announced. Review it (\`arc-leads review ${orphan.draft_ref}\`) and either keep it or remove it — this command will not announce a body you have since edited.`);
        return;
      }
      try { emit("approval.requested", approvalPayload(orphan)); }
      catch (e) { halfWritten.push({ ref: orphan.draft_ref, lead: d.lead_id, message: e.message }); return; }
      seenTouch.set(key, orphan.draft_ref);
      unannounced.delete(key);
      resumed++;
      console.log(`  RESUME ${orphan.draft_ref} ${d.lead_id}: touch ${d.touch_n} was written but never announced by an earlier run; its approval is in the inbox now.`);
      return;
    }

    const warns = scored[i].warns;
    const rec = writeDraft(store, {
      campaign, lead_id: d.lead_id, touch_n: d.touch_n, body: d.body, cites: d.cites,
      lintStatus: scored[i].verdict === VERDICT.PASS ? "PASS" : `BELOW-BAR: ${warns.join(" | ")}`,
    });
    // The window this whole block exists for is HERE, between the two writes. It is now
    // survivable rather than eliminated — the next run recognises what it left behind — and the
    // failure is named at the moment it happens instead of being discovered a day later as a
    // refusal about a draft nobody remembers writing.
    try { emit("approval.requested", approvalPayload(rec)); }
    catch (e) {
      halfWritten.push({ ref: rec.draft_ref, lead: d.lead_id, message: e.message });
      console.log(`  HALF  ${rec.draft_ref} ${d.lead_id}: the draft is written but its approval was refused — re-run this command to finish it.`);
      return;
    }
    seenTouch.set(key, rec.draft_ref);
    written++;
    console.log(`  ${scored[i].verdict === VERDICT.PASS ? "PASS " : "WARN "} ${rec.draft_ref} ${d.lead_id}${warns.length ? " — " + warns.join(" | ") : ""}`);
  });
  // EVERY OUTCOME IS IN THE SUMMARY LINE. A resumed draft used to be counted as a duplicate and
  // a half-written one as nothing at all, so the line under-reported the work in one direction
  // and over-reported the health of the store in the other.
  // AND IT MEANS IT. The first version of this line said "every outcome" and then folded `NO`
  // into the FAIL count — reporting a touch the human REJECTED as a draft the lint blocked,
  // which are opposite facts about who decided — and omitted `HALF` entirely, so the one
  // outcome that leaves work unfinished appeared in no total at all.
  console.log(`arc-leads draft: ${written} queued for approval, ${resumed} resumed from an interrupted run, ${blocked} FAIL blocked before the inbox, ${duplicate} duplicate touch(es) refused, ${rejectedSame} unchanged after a rejection, ${stale} stale draft(s) left alone, ${halfWritten.length} half-written`);
  if (halfWritten.length) {
    for (const h of halfWritten)
      console.error(`arc-leads: HALF-WRITTEN — ${h.ref} (${h.lead}) has a draft on disk and no approval receipt: ${h.message}`);
    dieUnlocked(2, `${halfWritten.length} draft(s) were written without an approval receipt. Re-running this command finishes them; nothing is lost, and nothing was double-announced.`);
  }
  } finally {
    releaseDraft();
  }
}

// THE (lead, touch) IDENTITY, resolved the same way the send-moment guard resolves it.
//
// Two things were wrong with interpolating the raw fields. `touch_n` arrives from a
// hand-written JSON file and was never parsed, so ` 1`, `1.0`, `+1`, `1e0` and `01` were five
// distinct keys for one touch — five live approvals for one send, from the rule that exists to
// guarantee there is exactly one. And `lead_id` is one version of a keyed HMAC: after a key
// rotation the same human carries a different id, so yesterday's approval stopped matching
// today's draft and the same person got two. `guard.mjs` had already fixed both, in three
// adjacent branches, and this was the fourth (D6). It calls that code rather than repeating it.
// IS THERE A LIVE APPROVAL FOR THIS DRAFT? "live" means undecided OR approved; only a trailing
// `reject` retires one.
//
// It reads the same two kinds `approvedShaFor` reads and applies the same latest-decision-wins
// rule, and it deliberately treats an UNDECIDED request as live — that is the whole difference
// between the two questions. `approvedShaFor` asks "may this send?", where undecided must mean
// no; this asks "is the human already holding this question?", where undecided must mean yes.
// Reversing either one is a real failure: the first sends what nobody approved, the second puts
// the same decision in the inbox twice.
//
// `events` arrives sorted by ULID, i.e. in time order, from `readAllEvents` — the same property
// the sequencer's fold depends on for its own last-decision-wins.
function approvalState(events, draftRef) {
  const requests = events.filter(
    (e) => e && e.kind === "approval.requested" &&
      // `id` MUST be present, for the reason `approvedShaFor` gives: without it a request with
      // no id and a decision with no `decides` pair on undefined === undefined, and a decision
      // about something else entirely gets read as this draft's.
      typeof e.id === "string" && e.id.length > 0 &&
      e.payload?.gate === "leads-send" &&
      e.payload?.draft_ref === draftRef
  );
  if (!requests.length) return "none";
  for (const req of requests) {
    const decisions = events.filter(
      (e) => e && e.kind === "decision.recorded" &&
        typeof e.payload?.decides === "string" && e.payload.decides === req.id
    );
    const last = decisions[decisions.length - 1];
    if (!last || last.payload.verdict !== "reject") return "live";
  }
  return "rejected";
}

function touchKey(store, leadId, touchN) {
  // `canonicalLeadId` is shared with the meeting-draft ref rather than repeated here: two
  // functions choosing "the canonical member of a keyring" independently is one fact derived
  // two ways, and this lane has paid for that shape more than any other.
  return `${canonicalLeadId(store, leadId)}|${normalizeTouchN(touchN)}`;
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
  // Same reason as `cmdDraft`: `process.exit` does not run a `finally`, so a refusal inside the
  // section left `.send.lock` behind naming a dead pid — and the documented remedy for a stale
  // lock is this very command, so the operator was told to run the thing that had just wedged
  // them. This branch acquired the lock in the previous slice and never got the release-before-
  // die that goes with it: the guard applied in one branch and omitted in the adjacent one, one
  // more time.
  const dieUnlocked = (code, msg) => { try { release(); } catch { /* already released */ } die(code, msg); };
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
  if (left.length) dieUnlocked(3, `${left.length} intent(s) still unresolved — no send will be attempted`);
  } finally { release(); }
}

// The human-started daily command. No cron, no daemon, no background anything (ADR-0403).
// THE ONE PLACE `.env.local` ENTERS A RUN, and the reason there is no shell sourcing anywhere
// in this lane's documentation.
//
// The outreach provider reads `RESEND_API_KEY` and `ARC_LEADS_OUTREACH_FROM` straight off
// `process.env`, and nothing on the send path ever read the file they live in — so the runbook
// told the operator to `set -a; . ./.env.local; set +a` first. That is a SECOND parser of arc's
// one credential home, and it disagrees with `env.mjs` in both directions: bash expands an
// unquoted `$`, executes an unquoted space, and strips an inline `#`, so a key truncated at a
// comment still looks set and fails at the vendor at the moment mail goes out. It also does not
// exist in PowerShell, which is this box's primary shell and which the runbook never named.
//
// The Phase 04 comment on this read said every other subcommand should keep exactly the
// environment it had, "so a credential file cannot change the behaviour of a send". That intent
// is intact and is now enforced by the thing that actually enforces it: `assertEnvLocalNames`
// refuses the file outright if it so much as NAMES the fake switch, the clock, the store path,
// the vendor host or the fixture dir. Supplying a credential is not changing behaviour — the
// send still needs an approval, a guard pass, a cap, and an allowlisted recipient.
//
// Precedence is unchanged (ENV-WINS-OVER-FILE), so a test or a CI leg that exports a value is
// never overridden by a file, and on a machine with no `.env.local` this is a no-op.
function loadCredentials() {
  const envInfo = loadEnvLocal({ root: REPO_ROOT });
  if (envInfo.present && envInfo.skipped.length)
    console.error(`arc-leads: warning — ${ENV_LOCAL} line(s) ${envInfo.skipped.join(", ")} are not NAME=value and were skipped`);
  if (envInfo.present && envInfo.blank.length)
    console.error(`arc-leads: warning — ${ENV_LOCAL} declares ${envInfo.blank.join(", ")} with an empty value, which counts as unset`);
  // The list and the refusal live in `lib/mail.mjs`, beside the rules they protect, so they can
  // be tested without writing a `.env.local` into a real repository root.
  assertEnvLocalNames(envInfo.names || [], ENV_LOCAL);
  return envInfo;
}

async function cmdDaily(campaign) {
  if (!campaign) die(2, "usage: arc-leads daily <campaign>");
  // BEFORE the store opens and long before the provider is asked, so a poisoned credential file
  // refuses the run rather than being discovered three frames into a send.
  try { loadCredentials(); }
  catch (e) { die(e instanceof EnvError ? 5 : (MAIL_EXIT[e.kind] ?? 3), e.kind ? `[${e.kind}] ${e.message}` : e.message); }
  // THE SAME GRAMMAR `research` AND `draft` HOLD THE NAME TO, applied at the third door. It was
  // applied at two of the three: `assertCampaignStore` asks a case-insensitive filesystem, so
  // `daily Walk` resolved `walk.json` and was accepted — and then `listDrafts(store,"Walk")`
  // matches `r.campaign === "Walk"` exactly, finds nothing, and prints "no approved drafts —
  // nothing to send" at exit 0 for a campaign with approvals waiting. Verified on this box.
  // Masked today only by the unrelated `unsubscribeHeader` refusal, i.e. it goes live the day
  // Phase 03's sending domain lands, which is the day it does the most damage. D6/D1.
  assertCampaignName(campaign, "the <campaign> argument");
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
  // THE OUTREACH PATH NAMES ITS TRANSPORT TOO. The notification path was given this line and
  // this one was not — the same guard at one door and omitted at the adjacent one (D6) that the
  // notification comment itself is about, committed in the same change that wrote the comment.
  // And this is the door that matters: `daily` is the command the whole Phase 03 runbook exists
  // to get the operator to. Its only signal was the `fake-` prefix buried inside
  // `provider_message_id`, which is a fact read a second way off a string (D5) on the one line
  // an operator uses to decide whether five real people received mail.
  if (usingFakes()) {
    console.log(`arc-leads daily: NOT SENT — ARC_LEADS_FAKE=1, so this ran on the fake provider and nothing left this machine. ${sent} would have been submitted, ${out.results.length - sent} refused.`);
    return;
  }
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

  // THE FIFTH READ-THEN-EMIT SECTION, AND THE LAST ONE STILL UNLOCKED. `research`, `draft`,
  // `reconcile`, `runDaily` and `deliverNotification` all take this lock; `ingest-reply` reads
  // the spine, decides what is already there, and emits — the same window, guarding the same
  // invariants — and took nothing. Two runs on one reply (the `--inbound` hook firing while the
  // operator runs `--file`, or two manual runs) both saw an empty `announced` set and both
  // emitted, putting TWO undecided `leads-meeting` approvals in the inbox for one meeting. The
  // emitter cannot deduplicate them: `arc-event` salts a non-leads idem with the millisecond.
  //
  // A reply arriving while `daily` holds the lock now refuses loudly and is re-ingestible,
  // which is strictly better than the alternative — the receipt that gets lost to a race here
  // is the one that stops contacting somebody who asked not to be contacted.
  const release = acquireLock(store);
  const dieUnlocked = (code, msg) => { try { release(); } catch { /* already released */ } die(code, msg); };
  try {
  let ok = 0, refused = 0;
  const raced = [];
  for (const inp of inputs) {
    try {
      // The spine is re-read per reply. An unsubscribe ingested two replies ago changes what
      // the next one derives, and a snapshot taken before the loop would not know it.
      const r = await ingestReply({
        store, bytes: inp.bytes, events: readAllEvents({ allowMissing: true }),
        // The index keys are read HERE, by the layer that owns the spine root, and handed in.
        // `ingestReply` reaching for them itself made a module test depend on whatever
        // ARC_SPINE_ROOT pointed at, which for a suite with no setup() is this repo.
        spineIdems: idemKeys(),
        now, emit: emitFn, config: cfg, sourceLabel: inp.label,
      });
      ok++;
      // A RACED RECEIPT IS COUNTED, not decorated. Everything else in `extra` is a note about a
      // healthy outcome; this one means the emitter refused and quarantined, and `report`
      // refuses while any quarantine record exists — so it has to move the exit code, exactly
      // as the same case does in `research`. Printing it beside "N ingested, 0 refused" and
      // exiting 0 is how the phase's one number gets disabled without anybody noticing.
      if (r.receipt_raced) raced.push(r.reply_ref);
      const extra = [
        r.fresh ? null : "already ingested",
        r.receipt_raced ? "RACED — the emitter quarantined a duplicate; clear it before `report`" : null,
        r.receipt_duplicate ? "reply receipt already on the spine" : null,
        // Named separately from the reply receipt: printing one line for two different receipts
        // meant a re-ingested unsubscribe and a first-time suppression read identically.
        r.suppressed_duplicate ? "suppression already on the spine" : null,
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
  console.log(`arc-leads ingest-reply: ${ok} ingested, ${refused} refused${raced.length ? `, ${raced.length} raced` : ""}`);
  if (raced.length)
    console.error(`arc-leads: ${raced.length} receipt(s) lost a race to another writer (${raced.join(", ")}) — the receipts ARE on the spine, but each refusal left a quarantine record and \`report\` refuses while any record exists. Clear the quarantine before asking for the mixing report.`);
  // `dieUnlocked`, not `process.exit`: exiting here skips the `finally` and leaves `.send.lock`
  // naming a pid that has gone, which the operator is told is never auto-broken.
  if (refused || raced.length) dieUnlocked(3, `${refused} refused, ${raced.length} raced — see the lines above`);
  } finally {
    release();
  }
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
  // PREFLIGHT AND THE SEND MUST RESOLVE THE SAME WORLD. `cmdDaily` reads `.env.local`; this did
  // not, so with the rehearsal allowlist in that file the two disagreed about whether ADR-0416
  // rehearsal mode was locked: preflight reported `count: 0` and printed a third
  // `REFUSED rehearsal-mode … DECLARED but incomplete` row while `daily` resolved `count: 5`
  // and was perfectly happy. A gate that answers "can I send yet" from a narrower environment
  // than the send uses is worse than no gate — the runbook told the operator that two REFUSED
  // rows were expected and to read them and continue, which pre-authorises ignoring a third one
  // that is a genuine refusal in every other circumstance. D5/D6.
  //
  // AND IT DIES ON A POISONED FILE, exactly as `daily` does. The first version caught the
  // refusal and carried on, reasoning that preflight's job is to report rather than to exit —
  // which is wrong here for a mechanical reason: `loadEnvLocal` APPLIES the file's values into
  // the environment BEFORE `assertEnvLocalNames` inspects the names, and `usingFakes()`,
  // `dns()` and `provider()` are all resolved lazily afterwards. So "refuse and continue" ran
  // the live-DNS gate on whatever fakes the credential file had just installed, and with a
  // fixture directory plus a `LEADS_CONFIG` seed path `arc-leads preflight: PASS` was reachable
  // from a file alone — REQ-00 and REQ-07 both bypassed, the operator seeing one stderr line
  // they would read as a warning. A guard that hard-fails at one door and is downgraded to a
  // note at the adjacent one is not a guard.
  try { loadCredentials(); }
  catch (e) { die(e instanceof EnvError ? 5 : (MAIL_EXIT[e.kind] ?? 3), e.kind ? `[${e.kind}] ${e.message}` : e.message); }
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
  loadCredentials();

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
    //
    // THE SUCCESS LINE NAMES THE TRANSPORT, and that is the second half of the F1 fix. Closing
    // the `.env.local` door in `env.mjs` stops a credential FILE from switching this path to the
    // fake; it does nothing about `ARC_LEADS_FAKE=1` exported in the shell, which reaches the
    // identical end state — `mail sent … EXIT=0` from a run that delivered nothing. A guard
    // applied at one door and omitted at the adjacent one is D6, this lane's most repeated
    // defect, and the rule is that a fix is not applied until it has been attacked somewhere it
    // was never made. So the remedy is not a second guard, it is that no fake run may ever print
    // the sentence a real delivery prints.
    //
    // `usingFakes()` is the SAME predicate `mailer()` selected the transport with — not a second
    // derivation of it, and not the `fake-` prefix parsed back off the returned id, which would
    // be one fact read two ways (D5) on the one line that has to be trustworthy.
    console.log(
      usingFakes()
        ? `arc-leads: NOT SENT — ARC_LEADS_FAKE=1, so this ran on the fake mailer and nothing left this machine. id=${res.id} idem=${res.idem_key}`
        : `arc-leads: mail sent id=${res.id} idem=${res.idem_key}`,
    );
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
