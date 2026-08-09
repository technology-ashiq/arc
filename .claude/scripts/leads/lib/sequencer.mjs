// sequencer.mjs — the send path. Human-started, never a daemon (ADR-0403).
//
// There is no scheduler here and there must never be one: the module order puts background
// execution behind the policy-engine gate, and a v1 daemon would jump that queue. Sequence
// advancement is a command a person runs.
//
// The ordering below is the safety property, and it is not rearrangeable:
//
//   reconcile FIRST      -- an unresolved intent from a previous crash blocks everything, so
//                           resolving them is the only thing allowed to happen before a guard
//   lock                 -- one writer, for the whole derive -> guard -> submit -> emit window
//   guard at SEND MOMENT -- not at approval time; a reply that landed after approval must win
//   journal BEFORE submit-- the crash window between ack and receipt is the whole reason
//   emit AFTER ack       -- a receipt is confirmed truth, never an intention
//
// Every count the guard reads is folded from receipts on each call. No counter file exists,
// which is what makes "the cap cannot be raised by editing something" true rather than hoped.

import { guardSend, GuardRefusal, acquireLock } from "./guard.mjs";
import { writeIntent, resolveIntent, reconcile, idemKeyFor, unresolvedIntents } from "./journal.mjs";
import { assertCampaignStore, readDraft, currentSha } from "./drafts.mjs";
import { provider } from "./deps.mjs";
import { loadConfig, effectiveSendingDomain, configuredProductDomains, domainConflict } from "./preflight.mjs";

// Every send carries List-Unsubscribe (ADR-0402, a non-negotiable). The local part is a
// constant; the DOMAIN comes from config, so the header always points at the domain the mail
// was actually sent from. Assembled rather than written as a literal: this file is inside the
// PII tripwire's scan scope and an email-shaped literal here is a violation by construction.
const UNSUB_LOCAL = "unsubscribe";
// The domain comes from the SAME resolver preflight gates on (ADR-0416 rehearsal mode
// substitutes rehearsal_domain for sending_domain). Reading cfg.sending_domain directly here
// was the bug shape this lane has already paid for once: two readers deriving one fact by two
// paths, so a rehearsal would have been gated on automemory.ai and then unsubscribed at a
// domain that is empty or belongs to a different campaign entirely.
export function unsubscribeHeader(configPath, env = process.env) {
  const cfg = loadConfig(configPath);
  const eff = effectiveSendingDomain(cfg, env);
  // A DECLARED-but-incomplete rehearsal must not degrade into "no sending domain" here. It is
  // its own refusal with its own sentence, because the operator who set ARC_LEADS_REHEARSAL=1
  // needs to be told which of the three signals is missing, not told the domain is unset.
  if (eff.blocked) throw new Error(`ADR-0416 rehearsal mode is declared but incomplete: ${eff.blocked}`);
  // This is the chokepoint the SEND path actually runs (cmdDaily calls it before the loop;
  // cmdPreflight is a different subcommand a send never enters). So the ADR-0402 refusal is
  // asserted here too rather than only inside preflight() -- that split is what let one env
  // var bind the product domain into every List-Unsubscribe while preflight refused correctly
  // somewhere nobody was asking.
  const { list } = configuredProductDomains(cfg);
  const conflict = eff.rehearsal ? null : domainConflict(eff.domain, list);
  if (conflict) throw new Error(`${conflict} (ADR-0402) — cold outbound never sends from the product domain, and rehearsal mode is not declared`);
  if (!eff.domain) throw new Error("no sending_domain configured — every send must carry a working List-Unsubscribe (ADR-0402)");
  return `<mailto:${UNSUB_LOCAL}@${eff.domain}>`;
}

// An approval is a PAIR on the spine: an `approval.requested` carrying the draft_ref and the
// draft_sha, and a `decision.recorded` whose `decides` is that approval's ULID. Reading only
// one of them is how a system ends up sending a draft nobody approved, or refusing one that
// was approved -- so both are required and the sha comes from the APPROVAL, not the draft.
export function approvedShaFor(events, draftRef) {
  const requests = events.filter(
    (e) => e.kind === "approval.requested" &&
      // `id` MUST be present. Without this, an approval missing an id and a decision missing a
      // `decides` paired on undefined === undefined -- so a decision approving something else
      // entirely authorised this draft. Confirmed.
      typeof e.id === "string" && e.id.length > 0 &&
      e.payload?.gate === "leads-send" &&
      e.payload?.draft_ref === draftRef
  );
  for (const req of requests) {
    // LATEST decision wins, and a reject revokes. The first version took the first `approve`
    // and never looked further, so a human who caught a mistake and rejected in the inbox
    // could not stop the send -- `reject` was read nowhere in the send path.
    const decisions = events.filter(
      (e) => e.kind === "decision.recorded" && typeof e.payload?.decides === "string" && e.payload.decides === req.id
    );
    const last = decisions[decisions.length - 1];
    if (last && last.payload.verdict === "approve")
      return { approvedSha: req.payload.draft_sha, approvalId: req.id, decisionId: last.id };
  }
  return null;
}

// One send. Returns a result object rather than throwing on a refusal, because a refusal is a
// NORMAL outcome of a daily run (a lead replied, the cap is reached) and the caller reports
// every one of them rather than stopping at the first.
export async function sendOne({ store, events, draftRef, now, emitReceipt, config, env = process.env }) {
  const draft = readDraft(store, draftRef);
  assertCampaignStore(store, draft.campaign);

  // The FAIL class is re-read HERE, at the send moment. It used to be enforced by a single
  // `if` in the CLI draft command, and nothing in the send path ever looked at `lint_status`
  // again -- so a draft record written or edited by any other route sent regardless of it.
  // A gate that exists in one caller is not a property of the system.
  if (typeof draft.lint_status !== "string" || /^FAIL/.test(draft.lint_status))
    return { draftRef, ok: false, step: "lint", why: `draft lint status ${JSON.stringify(draft.lint_status)} — a FAIL-class draft never sends (ADR-0404)` };

  const approval = approvedShaFor(events, draftRef);
  if (!approval) return { draftRef, ok: false, step: "approval", why: "no approved decision on the spine for this draft — L1 means every send is individually approved (ADR-0407)" };

  try {
    guardSend({
      events, store, now, config, env,
      draft: {
        campaign: draft.campaign,
        lead_id: draft.lead_id,
        touch_n: draft.touch_n,
        draft_sha: currentSha(store, draftRef),   // recomputed from disk, NOT the stored field
        approved_sha: approval.approvedSha,
      },
    });
  } catch (e) {
    if (e instanceof GuardRefusal) return { draftRef, ok: false, step: e.step, why: e.message };
    throw e;
  }

  // The rehearsal mark is DERIVED from the binding and never passed in. ADR-0416's rabbit-hole
  // row says it plainly: the mode is a property of the run and of its receipts, never a flag a
  // caller can forget — and a parameter someone forgets defaults to permissive, while an
  // environment declaration that is missing simply is not a rehearsal.
  //
  // Resolved through `effectiveSendingDomain`, the SAME resolver unsubscribeHeader gates on,
  // so the domain the mail actually leaves from and the mark on its receipt cannot disagree.
  // Two readers deriving one fact by two paths is the bug shape this lane has already paid
  // for. The guard has already refused a declared-but-incomplete rehearsal by the time we get
  // here, so `blocked` is not reachable with a rehearsal declared; `rehearsal` is false for
  // every undeclared run, which is what a real cold send will be in Phase 05.
  //
  // Returned as a REFUSAL rather than thrown, because that is this function's contract: a
  // refusal is a normal outcome of a daily run and the caller reports every one of them.
  // `loadCaps` tolerates a config file that is not there and `loadConfig` does not, so without
  // this an unreadable config raised past runDaily instead of stopping one draft — and it
  // would have stopped it for the right reason, since a send whose mode cannot be determined
  // must not go at all.
  let eff;
  try { eff = effectiveSendingDomain(loadConfig(config), env); }
  catch (e) {
    return { draftRef, ok: false, step: "config", why: `the leads config could not be read (${e.message}) — refusing rather than sending without knowing whether this is a rehearsal (ADR-0416)` };
  }
  // BLOCKED and NOT-A-REHEARSAL are different facts and the mark collapses them onto one value.
  // `effectiveSendingDomain` returns `blocked` WITHOUT throwing and leaves `rehearsal` false, so
  // reading only `.rehearsal` marks a blocked rehearsal `false` — a receipt asserting a send was
  // real cold outbound when the operator declared a rehearsal and got the config wrong. That the
  // guard refuses this state first, and unsubscribeHeader after it, is not a reason to omit the
  // check: a mark that is only correct because a different function throws first is the D6 shape
  // this lane has recorded repeatedly. Refused rather than thrown, per this function's contract.
  if (eff.blocked)
    return { draftRef, ok: false, step: "rehearsal-mode", why: `ADR-0416 rehearsal mode is DECLARED but incomplete, so no mark can be derived and the send is refused rather than recorded as a real cold send: ${eff.blocked}` };
  const rehearsal = eff.rehearsal === true;

  const idemKey = idemKeyFor({ campaign: draft.campaign, lead_id: draft.lead_id, touch_n: draft.touch_n });
  const intent = {
    idempotency_key: idemKey,
    lead_hmac: draft.lead_id,
    campaign: draft.campaign,
    touch_n: draft.touch_n,
    draft_sha: approval.approvedSha,
    submitted_at: now,
    store_fingerprint: assertCampaignStore(store, draft.campaign).store_fingerprint,
    // Journalled BEFORE the submit, so a crash cannot lose which mode the send was made in.
    // A reconcile that had to guess would be guessing about mail that has already left.
    rehearsal,
  };

  // BEFORE the submit. If the process dies after this line and before the receipt, the
  // reconciler finds the intent and resolves it against the provider rather than resending.
  writeIntent(store, intent);

  let ack;
  try {
    ack = await provider().submit({
      idem_key: idemKey,
      // The keyed id, never an address. The fake never sees a real one at all; the real impl
      // resolves it from the ADR-0410 store at the last possible moment, which is what keeps
      // every module between the guard and the socket free of raw addresses.
      to: draft.lead_id,
      subject: draft.subject || "",
      body: draft.body,
      // Built from the configured sending domain, never hardcoded. The PII tripwire caught the
      // hardcoded version -- correctly, since this file is not a fixture path and any
      // email-shaped literal here is exactly what the gate exists to stop. It also has to be
      // config-derived to be RIGHT: the unsubscribe address must live on the domain the mail
      // is sent from, or the header points somewhere that cannot honour it.
      // The SAME `env` the guard and the mark were resolved from. Letting this one default to
      // process.env while the mark came from a passed-in env is two readers deriving one fact
      // by two paths -- the exact defect class this module's own header names, and it showed
      // up the moment the mark was wired: the receipt said rehearsal while the header resolver
      // said there is no sending domain at all.
      headers: { "List-Unsubscribe": unsubscribeHeader(config, env) },
    });
  } catch (e) {
    // The provider refused or the transport failed. The intent STAYS unresolved on purpose:
    // we do not know whether it was accepted, and guessing is how a duplicate happens. The
    // next run reconciles it before attempting anything.
    return { draftRef, ok: false, step: "provider", why: `submit failed (${e.kind || "error"}): ${e.message}. The intent is left unresolved; run \`arc-leads reconcile\`.` };
  }

  await emitReceipt({
    lead_id: draft.lead_id,
    campaign: draft.campaign,
    touch_n: draft.touch_n,
    idem_key: idemKey,
    provider_message_id: ack.provider_message_id,
    submitted_at: now,
    draft_sha: approval.approvedSha,
    rehearsal,
  });
  resolveIntent(store, idemKey);
  return { draftRef, ok: true, provider_message_id: ack.provider_message_id };
}

// The daily command. Reconcile, then walk the approved drafts in order, stopping the moment a
// cap refuses -- continuing past a daily-cap refusal would just produce N identical refusals.
export async function runDaily({ store, readEvents, drafts, now, emitReceipt, config, env = process.env }) {
  const release = acquireLock(store);
  try {
    const pre = await reconcile(store, {
      events: readEvents(),
      lookup: (k) => provider().lookupByMessageId(k),
      emitReceipt,
    });

    const still = unresolvedIntents(store);
    if (still.length)
      return { reconcile: pre, results: [], halted: `${still.length} intent(s) still unresolved after reconciliation — refusing every send until they clear (ADR-0411)` };

    const results = [];
    for (const d of drafts) {
      // Re-read the spine per send. A receipt emitted two lines ago changes the cap count, and
      // a stale snapshot is how the 21st send of the day goes out looking legal.
      const r = await sendOne({ store, events: readEvents(), draftRef: d, now, emitReceipt, config, env });
      results.push(r);
      if (!r.ok && (r.step === "daily-cap" || r.step === "campaign-state" || r.step === "unresolved-intent")) break;
    }
    return { reconcile: pre, results, halted: null };
  } finally {
    release();
  }
}
