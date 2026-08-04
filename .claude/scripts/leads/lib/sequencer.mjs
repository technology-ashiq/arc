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
import { loadConfig } from "./preflight.mjs";

// Every send carries List-Unsubscribe (ADR-0402, a non-negotiable). The local part is a
// constant; the DOMAIN comes from config, so the header always points at the domain the mail
// was actually sent from. Assembled rather than written as a literal: this file is inside the
// PII tripwire's scan scope and an email-shaped literal here is a violation by construction.
const UNSUB_LOCAL = "unsubscribe";
export function unsubscribeHeader(configPath) {
  const cfg = loadConfig(configPath);
  const domain = String(cfg.sending_domain || "").trim();
  if (!domain) throw new Error("no sending_domain configured — every send must carry a working List-Unsubscribe (ADR-0402)");
  return `<mailto:${UNSUB_LOCAL}@${domain}>`;
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
export async function sendOne({ store, events, draftRef, now, emitReceipt, config }) {
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
      events, store, now, config,
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

  const idemKey = idemKeyFor({ campaign: draft.campaign, lead_id: draft.lead_id, touch_n: draft.touch_n });
  const intent = {
    idempotency_key: idemKey,
    lead_hmac: draft.lead_id,
    campaign: draft.campaign,
    touch_n: draft.touch_n,
    draft_sha: approval.approvedSha,
    submitted_at: now,
    store_fingerprint: assertCampaignStore(store, draft.campaign).store_fingerprint,
  };

  // BEFORE the submit. If the process dies after this line and before the receipt, the
  // reconciler finds the intent and resolves it against the provider rather than resending.
  writeIntent(store, intent);

  let ack;
  try {
    ack = await provider().submit({
      idem_key: idemKey,
      to: draft.lead_id,          // the fake never sees a real address; the real impl resolves it from the store
      subject: draft.subject || "",
      body: draft.body,
      // Built from the configured sending domain, never hardcoded. The PII tripwire caught the
      // hardcoded version -- correctly, since this file is not a fixture path and any
      // email-shaped literal here is exactly what the gate exists to stop. It also has to be
      // config-derived to be RIGHT: the unsubscribe address must live on the domain the mail
      // is sent from, or the header points somewhere that cannot honour it.
      headers: { "List-Unsubscribe": unsubscribeHeader(config) },
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
  });
  resolveIntent(store, idemKey);
  return { draftRef, ok: true, provider_message_id: ack.provider_message_id };
}

// The daily command. Reconcile, then walk the approved drafts in order, stopping the moment a
// cap refuses -- continuing past a daily-cap refusal would just produce N identical refusals.
export async function runDaily({ store, readEvents, drafts, now, emitReceipt, config }) {
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
      const r = await sendOne({ store, events: readEvents(), draftRef: d, now, emitReceipt, config });
      results.push(r);
      if (!r.ok && (r.step === "daily-cap" || r.step === "campaign-state" || r.step === "unresolved-intent")) break;
    }
    return { reconcile: pre, results, halted: null };
  } finally {
    release();
  }
}
