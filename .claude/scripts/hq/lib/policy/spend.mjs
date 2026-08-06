/**
 * The money guard (REQ-06, POL-F). Mode A only in v1 (ADR-0056).
 *
 * RESERVATION STATE IS DERIVED FROM THE EVENT CHAIN, NEVER STORED. A status field on an
 * append-only receipt is a field that learns to lie: the receipt says `open` forever while the
 * world moved on, and the two disagree with no way to tell which is right. So a reservation's
 * state is a fold -- `spend.reserved` opens it, `cost.incurred` settles it, `spend.released`
 * cancels it -- and the ledger is recomputed every time it is asked.
 *
 * THE ORDER IS THE PROPERTY: reserve, THEN call the provider. Never the other way round, and
 * never both at once. A provider call that happens before a successful reservation is money
 * spent outside the cap, and no amount of after-the-fact bookkeeping recovers it.
 *
 * ON CRASHES, and this is where the honest answer is uncomfortable. The chain cannot tell
 * whether a dead process's provider call succeeded, because the only evidence would have been
 * the receipt it died before writing. So:
 *   - crash BEFORE the provider call -> the reservation is open, nothing was spent, and a
 *     restart retries under the SAME idempotency key.
 *   - crash AFTER the provider call, before settlement -> the reservation stays open FOREVER.
 *     It is never auto-released and never auto-retried. It surfaces as stuck, for a human.
 * Auto-releasing it would free budget that may already be gone; auto-retrying it would risk
 * paying twice. The no-auto-recovery rule (A4) applies to money exactly as it applies to trust,
 * and for the same reason: the machine cannot know, so it must not guess.
 */

import { CAPABILITIES } from "./model.mjs";
import { resolveEffectivePolicy, grantFor } from "./reduce.mjs";

export const RESERVED = "spend.reserved";
export const RELEASED = "spend.released";
export const SETTLED = "cost.incurred";

/** Reservations are per (action kind, window). v1 has one window: daily. */
export function reservationLedger(events, actionKind) {
  const open = new Map();   // reservation id -> { amount, currency, idempotency_key }
  const settled = [];
  const released = [];

  for (const e of events || []) {
    if (!e || typeof e !== "object") continue;
    const p = e.payload;
    if (!p || typeof p !== "object") continue;

    if (e.kind === RESERVED && p.action_kind === actionKind) {
      if (!Number.isInteger(p.amount) || p.amount < 0) continue; // a malformed reserve holds nothing
      open.set(e.id, { amount: p.amount, currency: p.currency, idempotency_key: p.idempotency_key });
      continue;
    }
    // A settlement or a release CLOSES the reservation it names. Both carry reservation_ref;
    // an event naming a reservation nobody opened is ignored rather than trusted -- it cannot
    // free budget that was never held.
    if (e.kind === SETTLED && p.reservation_ref && open.has(p.reservation_ref)) {
      settled.push({ ref: p.reservation_ref, amount: p.amount ?? open.get(p.reservation_ref).amount });
      open.delete(p.reservation_ref);
      continue;
    }
    if (e.kind === RELEASED && p.reservation_ref && open.has(p.reservation_ref)) {
      released.push({ ref: p.reservation_ref, reason: p.reason });
      open.delete(p.reservation_ref);
    }
  }

  const settledTotal = settled.reduce((a, r) => a + (Number.isInteger(r.amount) ? r.amount : 0), 0);
  const openTotal = [...open.values()].reduce((a, r) => a + r.amount, 0);
  return { open, settled, released, settledTotal, openTotal, committed: settledTotal + openTotal };
}

/** The declared daily cap for a kind, or null when spend is not granted at all. */
export function spendCap(policy, kind) {
  const grant = grantFor(policy, kind, "spend");
  if (!grant || !grant.cap || typeof grant.cap !== "object") return null;
  const { amount, currency, window } = grant.cap;
  if (!Number.isInteger(amount) || amount < 0) return null;
  return { amount, currency, window: window || "daily" };
}

/**
 * May this kind reserve `amount` right now?
 *
 * Returns a decision, never a mutation -- the caller emits the receipt under the spine lock,
 * because the check and the write must be one atomic step and only the caller holds the lock.
 * Splitting them here would make this function look safe while the race lived at the call site.
 */
export function checkReservation({ kind, amount, currency }, { policy, events } = {}) {
  const deny = (reason) => ({ ok: false, reason });

  if (!Number.isInteger(amount)) return deny(`amount ${JSON.stringify(amount)} must be an integer in minor units`);
  if (amount <= 0) return deny("amount must be positive -- a zero or negative reservation is not a spend");

  const effective = resolveEffectivePolicy(kind, "spend", { policy, events }).effective;
  // v1: spend never executes. POL-F bans real-money movement above L1, so the guard is
  // exercised and proven while every actual call stays a proposal until a later cycle lifts it.
  if (effective === "L0") return deny(`${kind}/spend is denied by policy`);

  const cap = spendCap(policy, kind);
  if (!cap) return deny(`${kind} has no declared spend cap -- a bound that does not exist admits nothing`);
  if (currency !== cap.currency)
    return deny(`currency ${JSON.stringify(currency)} does not match the declared cap currency ${JSON.stringify(cap.currency)} -- never converted, because a rate is a guess`);

  const ledger = reservationLedger(events, kind);
  const remaining = cap.amount - ledger.committed;
  if (amount > remaining)
    return deny(`${amount} exceeds the remaining ${cap.window} budget: cap ${cap.amount}, ` +
      `settled ${ledger.settledTotal}, open reservations ${ledger.openTotal}, remaining ${remaining}`);

  return { ok: true, remaining, after: remaining - amount, cap, ledger, effective };
}

/**
 * The whole flow, with the provider call injected. `emit` must append under the spine lock and
 * return the sealed event id; `providerCall` must be idempotent under `idempotencyKey`.
 *
 * Nothing here retries, and nothing here releases on failure without knowing the provider never
 * charged -- `providerCall` says so by returning `{ attempted: false }`.
 */
export async function reserveAndSpend(
  { kind, amount, currency, idempotencyKey },
  { policy, events, emit, providerCall }
) {
  const check = checkReservation({ kind, amount, currency }, { policy, events });
  if (!check.ok) return { ok: false, stage: "reserve", reason: check.reason };

  // 1. RESERVE FIRST. The receipt is sealed before any provider is told anything exists.
  const reservationId = await emit(RESERVED, {
    action_kind: kind, amount, currency, correlation: idempotencyKey,
    idempotency_key: idempotencyKey, policy_hash: (policy && policy.__hash) || "0", window: "daily",
  });
  if (!reservationId) return { ok: false, stage: "reserve", reason: "the reservation receipt was not sealed -- no provider call is made" };

  // 2. Only now may the provider be called.
  let result;
  try {
    result = await providerCall({ amount, currency, idempotencyKey });
  } catch (e) {
    // The call THREW. Whether it charged is unknowable from here, so the reservation stays
    // open and a human decides. Releasing it would free budget that may already be spent.
    return {
      ok: false, stage: "provider", reservationId, stuck: true,
      reason: `the provider call failed after the reservation was sealed (${String(e.message).split("\n")[0]}). ` +
        `Reservation ${reservationId} stays OPEN and is never auto-released or auto-retried.`,
    };
  }

  if (result && result.attempted === false) {
    // The provider is certain it never charged -- the only case where releasing is safe.
    await emit(RELEASED, { correlation: idempotencyKey, policy_hash: (policy && policy.__hash) || "0", reason: result.reason || "provider declined before charging", reservation_ref: reservationId });
    return { ok: false, stage: "provider", reservationId, released: true, reason: result.reason || "provider declined before charging" };
  }

  // 3. Settle.
  await emit(SETTLED, {
    amount: result && Number.isInteger(result.amount) ? result.amount : amount,
    currency, provider_ref: result && result.providerRef, reservation_ref: reservationId,
  });
  return { ok: true, stage: "settled", reservationId, amount };
}

/** Reservations still open, for `arc brief` and for a human to decide about. */
export function stuckReservations(events, kind) {
  const { open } = reservationLedger(events, kind);
  return [...open.entries()].map(([id, r]) => ({ id, ...r }));
}

export const SPEND_CAPABILITY = CAPABILITIES.includes("spend");
