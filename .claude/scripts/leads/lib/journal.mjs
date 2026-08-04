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
  // try/unlink/catch, not existsSync-then-unlink. The check-then-act version had a TOCTOU
  // window that the adjacent lock release (twenty lines away, in guard.mjs) already avoided
  // by doing exactly this -- the same operation with two different race disciplines, D6.
  try { unlinkSync(p); } catch (e) { if (e.code !== "ENOENT") throw e; }
}

export function unresolvedIntents(store) {
  const d = journalDir(store);
  // SORTED. readdir order differs across the three legs, and this list drives both the
  // reconcile order and (via listDrafts) which leads get the last cap slots -- that must be a
  // property, not an artifact of the filesystem.
  return readdirSync(d)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      try {
        const parsed = JSON.parse(readFileSync(join(d, f), "utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          return { corrupt: true, file: f, why: "not a JSON object" };
        return parsed;
      } catch (e) {
        // NOT a throw. This used to raise out of the function -- and reconcile calls it as its
        // FIRST statement, so one torn file made the documented recovery impossible while the
        // guard refused every send forever, with manual file surgery as the only exit.
        //
        // A corrupt entry still COUNTS as unresolved, so the guard keeps refusing (absent
        // would mean "safe to send", which is the direction that sends a duplicate). It is
        // returned as data so reconcile can name it and still heal the healthy ones.
        return { corrupt: true, file: f, why: e.message };
      }
    });
}

// The reconciler. `emitReceipt` and `lookup` are injected so the whole thing is testable
// against the fake with injectable crash points.
export async function reconcile(store, { events, lookup, emitReceipt }) {
  const outcome = { resolvedFromSpine: 0, emittedLate: 0, voided: 0, providerCalls: 0 };

  for (const intent of unresolvedIntents(store)) {
    if (intent.corrupt) {
      // Reported, never silently skipped and never deleted: it may describe a real in-flight
      // send. The operator is told exactly which file and why.
      outcome.corrupt = (outcome.corrupt || 0) + 1;
      outcome.errors = outcome.errors || [];
      outcome.errors.push(`${intent.file}: ${intent.why} — inspect it by hand; it may describe a send that actually happened`);
      continue;
    }
    // STEP 1+2 -- the spine first, ALWAYS. If the receipt is already there, this intent is
    // simply stale bookkeeping: resolve it and make no provider call and no emit. Doing the
    // provider lookup first here is what would re-emit into a dup-idem error.
    const already = events.some(
      (e) => e.kind === "outreach.sent" &&
        e.payload?.campaign === intent.campaign &&
        e.payload?.lead_id === intent.lead_hmac &&
        Number(e.payload?.touch_n) === Number(intent.touch_n)
    );
    if (already) {
      resolveIntent(store, intent.idempotency_key);
      outcome.resolvedFromSpine++;
      continue;
    }

    // STEP 3 -- only now does the provider get asked anything.
    outcome.providerCalls++;
    const found = await lookup(intent.idempotency_key);

    // An INDETERMINATE lookup is not a "no". `null`, `undefined`, `{}`, a thrown error, a
    // string -- every one of these used to fall through to the void branch, which deletes the
    // intent and writes no receipt. The spine then has no record of a send the provider may
    // have accepted, so the next run cannot fire `already-sent` and submits the SAME mail
    // again. Provider lookups are eventually consistent: a 404 on a just-accepted message is
    // the normal case, not the exotic one.
    const determinate = found !== null && typeof found === "object" && typeof found.found === "boolean";
    if (!determinate) {
      outcome.indeterminate = (outcome.indeterminate || 0) + 1;
      continue; // intent STAYS unresolved; the guard keeps refusing until a human looks
    }

    if (found.found) {
      if (typeof found.provider_message_id !== "string" || !found.provider_message_id) {
        outcome.indeterminate = (outcome.indeterminate || 0) + 1;
        continue; // "accepted" with no id is not something to write a receipt from
      }
      // STEP 4 -- exactly one missing receipt, same preimage the validator re-derives.
      try {
        await emitReceipt({
          lead_id: intent.lead_hmac,
          campaign: intent.campaign,
          touch_n: Number(intent.touch_n),
          idem_key: intent.idempotency_key,
          provider_message_id: found.provider_message_id,
          submitted_at: intent.submitted_at,
          draft_sha: intent.draft_sha,
        });
      } catch (e) {
        // Do NOT resolve the intent. An emit failure after a confirmed ack used to throw out
        // of reconcile with the intent still unresolved, wedging every future send AND every
        // future reconcile with no way out. Recording it as a failure lets the run report and
        // continue; the intent stays unresolved, which is the safe direction.
        outcome.emitFailed = (outcome.emitFailed || 0) + 1;
        outcome.errors = outcome.errors || [];
        outcome.errors.push(`${intent.idempotency_key}: ${e.message}`);
        continue;
      }
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
