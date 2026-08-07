/**
 * The money guard (REQ-06, POL-F). Mode A only in v1 (ADR-0056).
 *
 * RESERVATION STATE IS DERIVED FROM THE EVENT CHAIN, NEVER STORED. A status field on an
 * append-only receipt is a field that learns to lie: it says `open` forever while the world
 * moved on, and the two disagree with no way to tell which is right. So state is a fold --
 * `spend.reserved` opens, `cost.incurred` settles, `spend.released` cancels -- recomputed every
 * time it is asked.
 *
 * THE ORDER IS THE PROPERTY: reserve, THEN call the provider. And the reserve must be ATOMIC.
 * The first version checked the cap and emitted in two steps with an `await` between them, so
 * three concurrent calls all passed the check and charged 240 against a cap of 100 -- and two
 * SEQUENTIAL calls charged 160, because nothing re-read the chain. An adversarial pass measured
 * both. The DoD asked for `withLock` and the module had never imported it. It does now: take
 * the lock, RE-READ the chain inside it, check, append, release. Everything the caller passes
 * before that is advisory.
 *
 * A MALFORMED MONEY EVENT IS REFUSED, NEVER SKIPPED. Skipping always fails permissive: a
 * settlement whose amount was a float used to coerce to 0 and hand back budget that had already
 * been spent; a negative amount manufactured budget outright. `reduce.mjs` learned this same
 * lesson for transitions, and money is the surface where it costs real money.
 *
 * ON CRASHES, the honest answer. The chain cannot tell whether a dead process's provider call
 * succeeded -- the only evidence would have been the receipt it died before writing. A crash
 * after the call therefore leaves the reservation OPEN FOREVER: never auto-released, never
 * auto-retried, surfaced as stuck for a human. Auto-releasing frees budget that may be gone;
 * auto-retrying risks paying twice. A4's no-auto-recovery rule applies to money for the reason
 * it applies to trust -- the machine cannot know, so it must not guess.
 *
 * WHAT THIS MODULE DELEGATES, said out loud: a provider that returns `attempted: false` after
 * actually charging gets its reservation released and no cost recorded. There is nothing this
 * code can do about that, and pretending otherwise would be the dishonest part. Such releases
 * are marked `provider_attested_no_charge` so an auditor can tell them from a policy release.
 */

import { createHash } from "node:crypto";
import { grantFor, resolveEffectivePolicy } from "./reduce.mjs";
import { policyHash } from "./encode.mjs";

export const RESERVED = "spend.reserved";
export const RELEASED = "spend.released";
export const SETTLED = "cost.incurred";

const CURRENCY_RE = /^[A-Z]{3}$/;
/** A single spend may not exceed this, whatever a cap says -- the magnitude guard revenue has. */
export const MAX_SPEND_MINOR_UNITS = 100_000_000_000;

export class SpendError extends Error {
  constructor(message) { super(message); this.name = "SpendError"; this.code = "BAD_SPEND_CHAIN"; }
}

/** The UTC-day key an event belongs to. The `daily` window is a real filter, not a label. */
const dayOf = (ts) => (typeof ts === "string" && ts.length >= 10 ? ts.slice(0, 10) : null);

/**
 * Fold the chain for one (action kind, day). Refuses what it cannot read rather than skipping it.
 *
 * `window` is applied here. It was named in four places and implemented in none, so three days
 * of settled spend folded into today and a "daily" cap never reset.
 */
export function reservationLedger(events, actionKind, { day = null } = {}) {
  const open = new Map();
  const settled = [];
  const released = [];
  const unreconciled = []; // money events that name no reservation we hold -- surfaced, never dropped

  const inWindow = (e) => day === null || dayOf(e.ts) === day;

  for (const e of events || []) {
    if (!e || typeof e !== "object") continue;
    const p = e.payload;
    if (!p || typeof p !== "object") continue;

    if (e.kind === RESERVED && p.action_kind === actionKind) {
      if (!inWindow(e)) continue;
      if (typeof e.id !== "string" || e.id === "")
        throw new SpendError(`a ${RESERVED} carries no id -- it cannot be settled or released, so it cannot be held`);
      if (open.has(e.id))
        throw new SpendError(`two ${RESERVED} events share the id ${e.id} -- one would silently absorb the other`);
      if (!Number.isInteger(p.amount) || p.amount <= 0)
        throw new SpendError(`${RESERVED} ${e.id} has amount ${JSON.stringify(p.amount)}; a reservation that holds nothing is not a reservation`);
      if (!CURRENCY_RE.test(p.currency || ""))
        throw new SpendError(`${RESERVED} ${e.id} has currency ${JSON.stringify(p.currency)}, which is not ISO-4217`);
      open.set(e.id, { amount: p.amount, currency: p.currency, idempotency_key: p.idempotency_key, ts: e.ts });
      continue;
    }

    if (e.kind === SETTLED && p.reservation_ref) {
      const held = open.get(p.reservation_ref);
      if (!held) { unreconciled.push({ id: e.id, kind: e.kind, ref: p.reservation_ref }); continue; }
      // The amount that MOVED. Unusable means we hold the full reservation rather than zero:
      // coercing to 0 handed back budget that had already been spent.
      let amount = p.amount;
      if (amount === undefined || amount === null) amount = held.amount;
      if (!Number.isInteger(amount) || amount < 0)
        throw new SpendError(`${SETTLED} for ${p.reservation_ref} has amount ${JSON.stringify(p.amount)}; a settlement that cannot be read must not be treated as zero`);
      if (p.currency !== undefined && p.currency !== held.currency)
        throw new SpendError(`${SETTLED} for ${p.reservation_ref} is in ${p.currency} but the reservation is in ${held.currency} -- never converted, because a rate is a guess`);
      settled.push({ ref: p.reservation_ref, amount, ts: e.ts });
      open.delete(p.reservation_ref);
      continue;
    }

    if (e.kind === RELEASED && p.reservation_ref) {
      if (!open.has(p.reservation_ref)) { unreconciled.push({ id: e.id, kind: e.kind, ref: p.reservation_ref }); continue; }
      released.push({ ref: p.reservation_ref, reason: p.reason, released_on: p.released_on });
      open.delete(p.reservation_ref);
    }
  }

  const settledTotal = settled.reduce((a, r) => a + r.amount, 0);
  const openTotal = [...open.values()].reduce((a, r) => a + r.amount, 0);
  return { open, settled, released, unreconciled, settledTotal, openTotal, committed: settledTotal + openTotal };
}

/** The declared cap for a kind, or null when spend is not usably granted. */
export function spendCap(policy, kind) {
  const grant = grantFor(policy, kind, "spend");
  if (!grant || !grant.cap || typeof grant.cap !== "object") return null;
  const { amount, currency, window } = grant.cap;
  if (!Number.isInteger(amount) || amount < 0) return null;
  if (!CURRENCY_RE.test(currency || "")) return null;
  if (window !== "daily") return null; // v1 has one window, and an unknown one must not pass as it
  return { amount, currency, window };
}

/**
 * May this kind reserve `amount` right now? A DECISION, never a mutation -- the caller emits
 * inside the lock, because the check and the append must be one critical section.
 * `reserveAndSpend` below is the only thing that should call this directly.
 */
export function checkReservation({ kind, amount, currency, day = null }, { policy, events } = {}) {
  const deny = (reason) => ({ ok: false, reason });

  if (!Number.isInteger(amount)) return deny(`amount ${JSON.stringify(amount)} must be an integer in minor units`);
  if (amount <= 0) return deny("amount must be positive -- a zero or negative reservation is not a spend");
  if (amount > MAX_SPEND_MINOR_UNITS) return deny(`amount ${amount} exceeds the absolute magnitude ceiling ${MAX_SPEND_MINOR_UNITS}`);
  if (!CURRENCY_RE.test(currency || "")) return deny(`currency ${JSON.stringify(currency)} is not ISO-4217`);

  // DENIES AT L0 ONLY, and that is deliberate rather than an oversight -- a Phase 04 attacker
  // reported the opposite and the fix it implies would delete the module.
  //
  // The observation is real: authorizeAction, asked about the same pair at the same level,
  // answers `propose` where this returns ok. But authorizeAction ALSO denies spend above L1
  // outright (authorize.mjs:211, POL-F: no real-money movement above L1 in v1, regardless of the
  // declared cap). So spend can never reach a level that executes, and requiring one here would
  // make checkReservation unreachable by construction -- a money guard that cannot be called is
  // not a stricter money guard.
  //
  // The two modules are answering DIFFERENT questions. authorizeAction answers "may this action
  // be performed", and for spend in v1 the answer is always no. This answers "would this amount
  // fit inside the declared cap", which is exactly what an L1 propose has to know in order to
  // prepare and record a spend it will never perform. The check is the preparation.
  //
  // What is genuinely owed sits one layer up, in reserveAndSpend: that function calls a PROVIDER,
  // which is real-money movement, and it inherits this L0-only test rather than asking whether
  // the level executes. Recorded in PROGRESS as owed, not patched here, because moving it is a
  // POL-F decision about what L1 may do with money and not a build-session judgement call.
  const effective = resolveEffectivePolicy(kind, "spend", { policy, events }).effective;
  if (effective === "L0") return deny(`${kind}/spend is denied by policy`);

  const cap = spendCap(policy, kind);
  if (!cap) return deny(`${kind} has no usable declared spend cap -- a bound that does not exist admits nothing`);
  if (currency !== cap.currency)
    return deny(`currency ${currency} does not match the declared cap currency ${cap.currency} -- never converted, because a rate is a guess`);

  let ledger;
  try {
    ledger = reservationLedger(events, kind, { day });
  } catch (e) {
    // An unreadable chain is not an empty chain. Denying is the only safe reading.
    return deny(`the spend chain could not be read, so no reservation is possible: ${e.message}`);
  }

  const remaining = cap.amount - ledger.committed;
  if (amount > remaining)
    return deny(`${amount} exceeds the remaining ${cap.window} budget: cap ${cap.amount}, ` +
      `settled ${ledger.settledTotal}, open reservations ${ledger.openTotal}, remaining ${remaining}`);

  return { ok: true, remaining, after: remaining - amount, cap, ledger, effective };
}

/** sha256 of an idempotency key, for a stable correlation without echoing a secret-ish token. */
const keyRef = (k) => createHash("sha256").update(String(k), "utf8").digest("hex").slice(0, 16);

/**
 * The whole flow.
 *
 *   withLock(fn)   MUST serialise against every other spend writer and run `fn` to completion
 *                  before releasing. The spine's own `withLock` satisfies this.
 *   readEvents()   MUST return the CURRENT chain. Called INSIDE the lock, so the check sees
 *                  what the last writer wrote -- this is what the two-step version got wrong.
 *   emit(k, p)     MUST return the sealed event id, and MUST return falsy if the event did not
 *                  land. A quarantined receipt that returns an id is indistinguishable from a
 *                  sealed one, and the caller would then call a provider against a reservation
 *                  the chain does not have.
 *   providerCall   MUST be idempotent under `idempotencyKey`.
 */
export async function reserveAndSpend(
  { kind, amount, currency, idempotencyKey, day = null },
  { policy, readEvents, emit, providerCall, withLock }
) {
  if (typeof idempotencyKey !== "string" || idempotencyKey.trim() === "")
    return { ok: false, stage: "reserve", reason: "an idempotency key is required -- the whole retry story rests on it" };
  if (typeof providerCall !== "function")
    return { ok: false, stage: "reserve", reason: "no providerCall was supplied" };
  if (typeof readEvents !== "function" || typeof emit !== "function" || typeof withLock !== "function")
    return { ok: false, stage: "reserve", reason: "reserveAndSpend needs withLock, readEvents and emit -- the reserve step is a critical section, not two statements" };

  const hash = (() => { try { return policyHash(policy); } catch { return null; } })();
  if (!hash)
    return { ok: false, stage: "reserve", reason: "the policy hash could not be computed, so no money receipt can say which law authorised it" };

  // ---- the critical section: re-read, check, append. Nothing else belongs in here. ----
  const reservation = await withLock(async () => {
    const events = await readEvents();

    // Idempotency: a key that already has an open or settled reservation does not open a second.
    let ledger;
    try { ledger = reservationLedger(events, kind, { day }); }
    catch (e) { return { ok: false, reason: `the spend chain could not be read: ${e.message}` }; }
    for (const [id, r] of ledger.open)
      if (r.idempotency_key === idempotencyKey) return { ok: false, reason: `idempotency key already has open reservation ${id}`, existing: id };

    const check = checkReservation({ kind, amount, currency, day }, { policy, events });
    if (!check.ok) return { ok: false, reason: check.reason };

    const id = await emit(RESERVED, {
      action_kind: kind, amount, currency, correlation: keyRef(idempotencyKey),
      idempotency_key: idempotencyKey, policy_hash: hash, window: "daily",
    });
    if (!id) return { ok: false, reason: "the reservation receipt was not sealed -- no provider call is made" };

    // THE LOCK IS TAKEN ON TRUST, so verify the OUTCOME rather than the mechanism.
    //
    // `withLock` arrives by injection and is only type-checked. A caller supplying
    // `async (fn) => fn()` gets no mutual exclusion whatsoever, and nothing here could tell --
    // this module's header says the concurrency defect was closed because "the DoD asked for
    // withLock and the module had never imported it. It does now." It does not import it; it
    // accepts it. A Phase 04 attacker passed a pass-through and charged 3 x 5000 against a cap
    // of 10000, reproducing the exact defect the header calls closed. The existing test passes
    // because the TEST supplies a real lock -- it proves the parameter is used, never that it
    // excludes.
    //
    // A module with no I/O cannot prove another function serialises. What it CAN do is re-read
    // after appending and check the result: if the chain now commits more than the cap allows,
    // someone else was inside this section with us. Release what we just wrote and refuse, so a
    // broken lock costs a failed reservation instead of an overspend.
    let after = null;
    try { after = reservationLedger(await readEvents(), kind, { day }); } catch { after = null; }
    if (after && after.committed > check.cap.amount) {
      const rid = await emit(RELEASED, {
        correlation: keyRef(idempotencyKey), policy_hash: hash,
        reason: `concurrent writer detected: after sealing ${id} the chain commits ${after.committed} ` +
          `against a cap of ${check.cap.amount}, so the supplied lock did not serialise`,
        released_on: "policy", reservation_ref: id,
      });
      return {
        ok: false, stuck: !rid,
        reason: `the reservation was sealed and then found to breach the cap -- committed ${after.committed} ` +
          `against ${check.cap.amount}. The supplied withLock did not exclude another writer. ` +
          (rid ? `Reservation ${id} was released.` : `The release receipt did NOT seal, so ${id} still holds budget and needs a human.`),
      };
    }
    return { ok: true, id };
  });

  if (!reservation.ok) return { ok: false, stage: "reserve", reason: reservation.reason, existing: reservation.existing };
  const reservationId = reservation.id;

  // ---- outside the lock: the provider call, then settlement ----
  let result;
  try {
    result = await providerCall({ amount, currency, idempotencyKey });
  } catch (e) {
    return {
      ok: false, stage: "provider", reservationId, stuck: true,
      reason: `the provider call failed after the reservation was sealed (${String(e.message).split("\n")[0]}). ` +
        `Reservation ${reservationId} stays OPEN and is never auto-released or auto-retried.`,
    };
  }

  if (result && result.attempted === false) {
    const rid = await emit(RELEASED, {
      correlation: keyRef(idempotencyKey), policy_hash: hash,
      reason: result.reason || "provider declined before charging",
      released_on: "provider_attested_no_charge", reservation_ref: reservationId,
    });
    if (!rid)
      return { ok: false, stage: "release", reservationId, stuck: true,
        reason: `the provider attested no charge, but the release receipt was NOT sealed -- ${reservationId} still holds budget and needs a human` };
    return { ok: false, stage: "provider", reservationId, released: true, reason: result.reason || "provider declined before charging" };
  }

  const moved = result && Number.isInteger(result.amount) ? result.amount : amount;
  const sid = await emit(SETTLED, {
    amount: moved, currency, provider_ref: (result && result.providerRef) || null, reservation_ref: reservationId,
  });
  if (!sid)
    return { ok: false, stage: "settle", reservationId, stuck: true, amount: moved,
      reason: `the provider charged ${moved} but the settlement receipt was NOT sealed -- ${reservationId} is open against money that moved` };

  if (moved > amount)
    return { ok: false, stage: "settle", reservationId, amount: moved, overCap: true,
      reason: `the provider charged ${moved} against a reservation of ${amount} -- settled, because the money moved, but this is outside the authorised amount and is an incident` };

  return { ok: true, stage: "settled", reservationId, amount: moved };
}

/**
 * Reservations still open, for `arc brief` and for the human whose decision this is. Rows carry
 * `ts` because the question a human actually asks is how OLD it is, and a per-kind-only view
 * hid money on kinds nobody thought to ask about.
 */
export function stuckReservations(events, kind = null) {
  const kinds = kind ? [kind] : [...new Set((events || [])
    .filter((e) => e && e.kind === RESERVED && e.payload && typeof e.payload.action_kind === "string")
    .map((e) => e.payload.action_kind))];
  const out = [];
  for (const k of kinds) {
    let ledger;
    try { ledger = reservationLedger(events, k); }
    catch (e) { out.push({ kind: k, unreadable: true, reason: e.message }); continue; }
    for (const [id, r] of ledger.open) out.push({ kind: k, id, ...r });
    for (const u of ledger.unreconciled) out.push({ kind: k, unreconciled: true, ...u });
  }
  return out;
}
