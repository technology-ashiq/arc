// guard.mjs — the send-moment guard chain (ADR-0403) and the single-writer lock.
//
// THE property: approval authorizes an ATTEMPT, never a send. A human approves a draft at
// 09:00, the lead unsubscribes at 09:30, the send fires at 10:00 — and it must not go. So
// every check re-runs at the moment of send, against state derived fresh from receipts.
//
// Chain order is load-bearing and is asserted by fixture:
//
//   campaign-state (HOLD|FROZEN) -> unresolved-intent -> ALREADY-SENT -> suppression
//     -> reply-stop -> touch-cap (rolling 7d) -> daily-cap (IST) -> send-window -> draft_sha
//
// The first two steps were added at kickoff by the attack panel. ADR-0403 defined HOLD/FROZEN
// and ADR-0411 defined unresolved intents, but NEITHER was in the chain — so every breaker
// fixture asserted that a receipt had been emitted rather than that a send had stopped. A
// breaker that pauses nothing is the domain-burn failure with a receipt attached.
//
// There is no mutable counter anywhere in this file, and that is deliberate: a cap you can
// reset is not a cap. Every number here is folded from receipts on each call.

import { existsSync, writeFileSync, readFileSync, unlinkSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { istDay, inSendWindow, withinRollingWindow, loadCaps, assertNoCapOverrides } from "./caps.mjs";
import { unresolvedIntents } from "./journal.mjs";

export class GuardRefusal extends Error {
  constructor(step, message) { super(message); this.name = "GuardRefusal"; this.step = step; }
}

// ---------- single-writer lock ----------
//
// Counts are derived per send, so two `arc-leads` processes would each read 20-headroom and
// both submit. ADR-0056 forbids concurrent emitters by POLICY; this is the mechanism.
//
// A lock held by a DEAD pid is refused, never auto-broken. That process may be sitting in the
// ack-to-receipt window, and stealing its lock is exactly how a duplicate send happens.
export function acquireLock(store) {
  const p = join(store.dir, ".send.lock");
  let fd;
  try {
    fd = openSync(p, "wx");
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    let holder = "(unreadable)";
    try { holder = readFileSync(p, "utf8").trim(); } catch { /* fall through with the placeholder */ }
    throw new GuardRefusal(
      "lock",
      `another arc-leads process holds the send lock: ${holder}. Refusing.\n` +
        `If that process is dead, run \`arc-leads reconcile\` — the lock is NEVER auto-broken, ` +
        `because a dead process may sit between the provider ack and the receipt, and stealing ` +
        `its lock is how the same mail gets sent twice (ADR-0411).`
    );
  }
  const token = `pid=${process.pid} started=${new Date().toISOString()}`;
  writeFileSync(fd, token + "\n");
  closeSync(fd);

  // The release VERIFIES IT STILL OWNS the lock before unlinking. It used to unlink by path
  // with no check at all, so any stale closure could destroy a different process's lock --
  // latent today (one call site, inside a finally) but one signal handler away from live.
  return () => {
    try {
      if (readFileSync(p, "utf8").trim() !== token) return; // someone else holds it now
      unlinkSync(p);
    } catch { /* already gone, or unreadable -- either way not ours to remove */ }
  };
}

// Is the recorded holder still running? `kill(pid, 0)` tests existence without signalling.
export function lockHolder(store) {
  const p = join(store.dir, ".send.lock");
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, "utf8").trim();
  const m = /^pid=(\d+)/.exec(raw);
  // A 0-byte lock is a real state: a crash between openSync and writeFileSync. The refusal
  // used to print "holds the send lock: ." with no pid, so the operator could not even check
  // whether the holder was alive.
  if (!m) return { raw, pid: null, alive: null };
  const pid = Number(m[1]);
  let alive;
  try { process.kill(pid, 0); alive = true; }
  catch (e) { alive = e.code === "EPERM"; }   // EPERM: it exists and is not ours
  return { raw, pid, alive };
}

// Clearing a stale lock is a HUMAN action with a liveness check, never an automatic one.
//
// The lock was correct in the safe direction -- never auto-broken -- and had NO EXIT. There is
// no signal handler anywhere in this tree, so SIGKILL, Ctrl-C, an OOM kill or power loss all
// skip the `finally`, and nothing documented even named the file. Every future send was then
// refused forever.
//
// This refuses outright while the holder is alive, because auto-clearing is exactly how the
// lock gets stolen from a process sitting in the ack-to-receipt window. And it tells the
// operator to reconcile afterwards: a dead holder may have left an in-flight intent.
export function clearStaleLock(store) {
  const h = lockHolder(store);
  if (!h) return { cleared: false, why: "no send lock is held" };
  if (h.alive) return { cleared: false, why: `the holder is STILL RUNNING (${h.raw}) — refusing. Wait for it, or stop that process first.` };
  const p = join(store.dir, ".send.lock");
  try { unlinkSync(p); } catch (e) { if (e.code !== "ENOENT") throw e; }
  return {
    cleared: true,
    why: `cleared a lock held by a dead process (${h.raw || "0-byte lock file"}). Run \`arc-leads reconcile\` NOW — that process may have left an in-flight intent, and until it is reconciled the spine does not know whether its mail went out.`,
  };
}

// ---------- derived state ----------
//
// Everything below is a fold. `events` comes from the reader; nothing is cached.
export function deriveState(events, { campaign }) {
  const suppressed = new Set();
  const replied = new Set();
  const touches = new Map();   // lead_id -> [submitted_at]
  const perDay = new Map();    // ist day -> count
  let bounces = 0, complaints = 0;

  for (const e of events) {
    const p = e.payload || {};
    if (e.kind === "lead.suppressed") suppressed.add(p.lead_id);
    else if (e.kind === "outreach.replied") {
      replied.add(p.lead_id);
      if (p.triage_class === "bounce") bounces++;
      if (p.triage_class === "unsubscribe") suppressed.add(p.lead_id);
    } else if (e.kind === "outreach.sent") {
      if (!touches.has(p.lead_id)) touches.set(p.lead_id, []);
      touches.get(p.lead_id).push(p.submitted_at);
      // Bucketed by the intent's submitted_at, NOT by the spine emit time: a recovery receipt
      // written at 00:10 would otherwise move a 23:55 send onto the next IST day and free a
      // slot on both.
      const d = istDay(p.submitted_at);
      perDay.set(d, (perDay.get(d) || 0) + 1);
    } else if (
      // Scoped and TYPED. The first version stringified the entire payload of every
      // incident.raised on the spine and regexed it, so an incident from another lane whose
      // text merely mentioned "no complaints so far" froze every leads campaign -- and the
      // clearance hole above then un-froze it with an unrelated approval.
      e.kind === "incident.raised" && p.module === "leads" && p.campaign === campaign && p.kind === "spam-complaint"
    ) complaints++;
  }
  return { suppressed, replied, touches, perDay, bounces, complaints, campaign };
}

// Sample-size-honest breakers (ADR-0403). At n=25 one bounce is 4%, so a bare percentage
// floor freezes on noise — HOLD is the honest small-n response, FREEZE the evidenced one.
export function breakerState(state, lifetimeSends) {
  if (state.complaints > 0) return { level: "FROZEN", why: "a spam complaint was recorded" };
  if (state.bounces >= 2) return { level: "FROZEN", why: `${state.bounces} bounces in this campaign` };
  if (lifetimeSends >= 50 && state.bounces / lifetimeSends >= 0.03)
    return { level: "FROZEN", why: `bounce rate ${(100 * state.bounces / lifetimeSends).toFixed(1)}% at ${lifetimeSends} lifetime sends` };
  if (state.bounces === 1) return { level: "HOLD", why: "the first bounce — sends pause until a human reviews the cause" };
  return { level: "OK", why: null };
}

// A campaign's HOLD/FROZEN clearance is a DECISION on the spine, never a file and never a
// flag. `--force`, a raised config value and an env override are all refused by construction:
// there is no code path that clears this other than an inbox approval.
// A clearance must name the INCIDENT it clears, and it must be an approval of a leads
// clearance request. The first version matched a free-text regex over every
// `decision.recorded` on the whole spine, which was wrong in five separate ways, each
// confirmed by an adversarial pass:
//
//   * ANY approve decision counted -- one emitted by evolve or develop cleared a leads FREEZE
//   * the match was unanchored, so "raise the bounce thres|HOLD|" cleared a HOLD, and
//     "auto|pilot|" matched campaign "pilot" (D2, an unanchored match on a legitimate variant)
//   * a decision whose text said HOLD IT cleared the hold
//   * the clearance was PERMANENT -- one approval pre-cleared every future breaker forever
//   * `campaign` was interpolated RAW into a RegExp: campaign "a|b" made any reason
//     containing "b" a clearance, and campaign "(" threw a bare SyntaxError out of the guard
//
// The fix removes the regex entirely. A clearance is now a typed pairing on the spine:
// an `approval.requested` with gate `leads-breaker` naming {campaign, level, incident_id},
// approved by a `decision.recorded` that DECIDES it. Structure, not prose.
export function clearedByInbox(events, campaign, level, incidentId) {
  const requests = events.filter(
    (e) => e.kind === "approval.requested" &&
      e.payload?.gate === "leads-breaker" &&
      e.payload?.campaign === campaign &&
      e.payload?.level === level &&
      // Bound to the SPECIFIC incident, so a clearance cannot pre-authorise a future breaker.
      e.payload?.incident_id === incidentId
  );
  for (const req of requests) {
    // Latest decision wins, so a reject after an approve revokes it (see approvedShaFor).
    const decisions = events.filter((e) => e.kind === "decision.recorded" && e.payload?.decides === req.id && req.id);
    const last = decisions[decisions.length - 1];
    if (last && last.payload?.verdict === "approve") return true;
  }
  return false;
}

// The identity of the CURRENT breaker state: what fired, and on the evidence of how many
// bounces/complaints. A clearance is bound to this, so resolving one HOLD does not silently
// authorise the next one.
export function incidentIdFor(campaign, breaker, state) {
  return `${campaign}:${breaker.level}:b${state.bounces}:c${state.complaints}`;
}

// ---------- the chain ----------
export function guardSend({ events, store, draft, now, config }) {
  assertNoCapOverrides();
  const caps = loadCaps(config);
  const { campaign, lead_id, touch_n, draft_sha, approved_sha } = draft;
  const state = deriveState(events, { campaign });
  const lifetime = [...state.perDay.values()].reduce((a, b) => a + b, 0);

  // 1. campaign state
  const breaker = breakerState(state, lifetime);
  const incidentId = incidentIdFor(campaign, breaker, state);
  if (breaker.level !== "OK" && !clearedByInbox(events, campaign, breaker.level, incidentId))
    throw new GuardRefusal("campaign-state", `campaign "${campaign}" is ${breaker.level}: ${breaker.why}. Clear it with an approved leads-breaker request naming incident "${incidentId}" — no flag, config value, env var or free-text approval does (ADR-0403).`);

  // 2. unresolved intent — conservative until reconciled. Blunt on purpose: at <=20 sends/day
  //    refusing everything until a crash is reconciled costs a command, and the alternative
  //    is a duplicate to a real human.
  const pending = unresolvedIntents(store);
  if (pending.length)
    throw new GuardRefusal("unresolved-intent", `${pending.length} unresolved send intent(s) in the journal. No send is attempted anywhere until \`arc-leads reconcile\` has run (ADR-0411).`);

  // 3. ALREADY SENT. Found by walking the send path end to end rather than by reading it: a
  //    second run of the daily command re-entered the whole chain for a draft that had already
  //    been sent, because the touch cap counts touches (1 of 2 used) and nothing asked the
  //    narrower question "has THIS touch already gone out?".
  //
  //    The receipt idem stopped the duplicate RECEIPT, so the spine stayed honest -- but only
  //    after the provider had already been asked to submit again. On the fake that is
  //    invisible (it is idempotent by key); on a real provider it is a second submit, and the
  //    only thing standing between it and a duplicate email is the provider honouring the
  //    idempotency key. Depending on that is exactly what ADR-0411 says not to do.
  // Compared as NUMBERS. `touch_n` reaches here from a store JSON file that nothing
  // re-validates, and the idem formula interpolates it -- so 1 and "1" produce the SAME idem
  // while `===` says they are different touches. Two derivations of one value that disagree
  // (D5): the guard let a second submit through, and the reconciler voided an intent whose
  // receipt was sitting on the spine.
  const tn = Number(touch_n);
  if (!Number.isSafeInteger(tn) || tn < 1)
    throw new GuardRefusal("bad-touch", `touch_n ${JSON.stringify(touch_n)} is not a positive integer`);
  const alreadySent = events.some(
    (e) => e.kind === "outreach.sent" &&
      e.payload?.campaign === campaign &&
      e.payload?.lead_id === lead_id &&
      Number(e.payload?.touch_n) === tn
  );
  if (alreadySent)
    throw new GuardRefusal("already-sent", `touch ${touch_n} to this lead in "${campaign}" already has an outreach.sent receipt — refusing before the provider is asked, rather than relying on it to deduplicate.`);

  // 4. suppression — checked across EVERY key version, so a rotation cannot un-suppress
  //    someone who asked to be forgotten (ADR-0400's keyring).
  if (state.suppressed.has(lead_id))
    throw new GuardRefusal("suppression", `lead is on the suppression ledger — unsubscribed, bounced, or manually suppressed. This survives across campaigns and dossier deletion.`);

  // 5. reply-stop. This is the TOCTOU case: a reply recorded AFTER approval permanently
  //    blocks the send that approval authorized.
  if (state.replied.has(lead_id))
    throw new GuardRefusal("reply-stop", `lead has already replied — the sequence stops itself. Approval authorized an attempt, not a send (ADR-0403).`);

  // 6. rolling touch cap — rolling, not a calendar week: a calendar week lets two touches
  //    land Sunday and Monday and calls it two weeks.
  const prior = (state.touches.get(lead_id) || []).filter((t) => withinRollingWindow(t, now, caps.rolling_window_days));
  // A touch recorded AFTER `now` means the clock moved backwards, not that the touch does not
  // count. Treating it as outside the window emptied the touch cap under any backward skew.
  const future = (state.touches.get(lead_id) || []).filter((t) => Date.parse(t) > Date.parse(now));
  if (future.length)
    throw new GuardRefusal("clock-skew", `${future.length} touch(es) for this lead are stamped AFTER the current send time (${now}) — refusing rather than counting them as outside the rolling window.`);
  if (prior.length >= caps.touches_per_lead)
    throw new GuardRefusal("touch-cap", `lead already had ${prior.length} touch(es) in the rolling ${caps.rolling_window_days}-day window; the cap is ${caps.touches_per_lead}.`);

  // 7. daily cap — SUBMITTED sends only; attempts the provider refused do not count.
  //    Effective count includes unresolved intents, but step 2 already refused those.
  const day = istDay(now);
  const today = state.perDay.get(day) || 0;
  if (today >= caps.per_ist_day)
    throw new GuardRefusal("daily-cap", `${today} send(s) already submitted on IST day ${day}; the cap is ${caps.per_ist_day}. Raising it in config is refused above the hard ceiling (ADR-0403).`);

  // 8. send window
  if (!inSendWindow(now, caps.send_window_ist))
    throw new GuardRefusal("send-window", `${now} is outside the IST send window (${caps.send_window_ist.start}-${caps.send_window_ist.end}, weekdays).`);

  // 9. draft sha — approval binds the EXACT content. Edited-after-approval is refused
  //    (ADR-0412, evolve's candidate_sha discipline applied to outreach).
  if (!approved_sha || draft_sha !== approved_sha)
    throw new GuardRefusal("draft-sha", `the draft changed after approval (approved ${String(approved_sha).slice(0, 12)}, current ${String(draft_sha).slice(0, 12)}). Approval binds exact content (ADR-0412).`);

  return { ok: true, day, submittedToday: today, priorTouches: prior.length, breaker: breaker.level };
}
