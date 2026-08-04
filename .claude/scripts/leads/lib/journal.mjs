// journal.mjs — the two-phase send journal and the SPINE-FIRST reconciler (ADR-0411).
//
// The gap this closes: the provider accepts the mail, then the process dies BEFORE
// `outreach.sent` lands. Receipts now undercount. A blind restart either resends (a duplicate
// to a real human) or oversends past the cap, because ADR-0403 derives every count from
// receipts and a missing receipt is a missing cap slot.
//
// The subtler gap, and the reason the ordering below is spine-FIRST: the INVERSE window. The
// receipt lands and the process dies before the intent is marked resolved. A provider-first
// reconcile would then re-emit and collide with its own idem, turning a recoverable state
// into an error.
//
// Recovery order, and it is not negotiable:
//
//   1. derive the send idem and check the SPINE
//   2. receipt exists  -> resolve the intent. NO provider call, NO emit.
//   3. no receipt      -> provider lookup by idempotency key
//   4. found-accepted  -> emit exactly one missing receipt (same idem preimage)
//   5. not-found       -> void the intent
//
// Step 1 always re-deriving from the spine is what makes the recovery ITSELF idempotent: a
// crash DURING recovery re-runs safely. That property is a consequence of the ordering, not
// an extra mechanism -- which is precisely why the ordering is what it is.
//
// The journal lives in the private store, never on the spine: the spine is confirmed truth,
// and operational scratch state must not ride it.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { leadsIdem } from "../../hq/lib/validate-leads.mjs";

export class JournalError extends Error {
  constructor(code, message) { super(message); this.name = "JournalError"; this.code = code; }
}

const dir = (store) => join(store.dir, "journal");

export function journalDir(store) {
  const d = dir(store);
  mkdirSync(d, { recursive: true });
  return d;
}

// The deterministic provider idempotency key. Same preimage family as the receipt idem, so a
// journal intent and the receipt it becomes are provably about the same send.
export const idemKeyFor = ({ campaign, lead_id, touch_n }) =>
  leadsIdem("outreach.sent", { campaign, lead_id, touch_n, idem_key: "", provider_message_id: "", submitted_at: "", draft_sha: "" });

export function writeIntent(store, intent) {
  for (const k of ["idempotency_key", "lead_hmac", "campaign", "touch_n", "draft_sha", "submitted_at", "store_fingerprint"])
    if (intent[k] === undefined || intent[k] === null || intent[k] === "")
      throw new JournalError("BAD_INTENT", `journal intent is missing "${k}" — an intent that cannot identify its send cannot be reconciled`);
  const p = join(journalDir(store), `${intent.idempotency_key}.json`);
  // Written before the submit, never after. The whole design rests on the intent existing on
  // disk before the provider is told anything.
  writeFileSync(p, JSON.stringify({ ...intent, resolved: false }, null, 2) + "\n");
  return p;
}

export function resolveIntent(store, idempotencyKey) {
  const p = join(journalDir(store), `${idempotencyKey}.json`);
  if (existsSync(p)) unlinkSync(p);
}

export function unresolvedIntents(store) {
  const d = journalDir(store);
  return readdirSync(d)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try { return JSON.parse(readFileSync(join(d, f), "utf8")); }
      catch { throw new JournalError("BAD_INTENT", `journal file ${f} is unreadable — refusing to treat a corrupt intent as absent, because absent means "safe to send"`); }
    })
    .filter((i) => !i.resolved);
}

// The reconciler. `emitReceipt` and `lookup` are injected so the whole thing is testable
// against the fake with injectable crash points.
export async function reconcile(store, { events, lookup, emitReceipt }) {
  const outcome = { resolvedFromSpine: 0, emittedLate: 0, voided: 0, providerCalls: 0 };

  for (const intent of unresolvedIntents(store)) {
    // STEP 1+2 -- the spine first, ALWAYS. If the receipt is already there, this intent is
    // simply stale bookkeeping: resolve it and make no provider call and no emit. Doing the
    // provider lookup first here is what would re-emit into a dup-idem error.
    const already = events.some(
      (e) => e.kind === "outreach.sent" &&
        e.payload?.campaign === intent.campaign &&
        e.payload?.lead_id === intent.lead_hmac &&
        e.payload?.touch_n === intent.touch_n
    );
    if (already) {
      resolveIntent(store, intent.idempotency_key);
      outcome.resolvedFromSpine++;
      continue;
    }

    // STEP 3 -- only now does the provider get asked anything.
    outcome.providerCalls++;
    const found = await lookup(intent.idempotency_key);

    if (found && found.found) {
      // STEP 4 -- exactly one missing receipt, same preimage the validator re-derives.
      await emitReceipt({
        lead_id: intent.lead_hmac,
        campaign: intent.campaign,
        touch_n: intent.touch_n,
        idem_key: intent.idempotency_key,
        provider_message_id: found.provider_message_id,
        submitted_at: intent.submitted_at,
        draft_sha: intent.draft_sha,
      });
      outcome.emittedLate++;
    } else {
      // STEP 5 -- the provider never accepted it. The cap slot is released, and no receipt
      // is written for a send that did not happen.
      outcome.voided++;
    }
    resolveIntent(store, intent.idempotency_key);
  }
  return outcome;
}
