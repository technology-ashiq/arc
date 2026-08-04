# Phase 01 handoff — leads Cycle 8, Sequencer

**Closed:** 2026-08-04 · **Appetite:** 2.0d · **Burn:** 2.0d · **PR:** #111 (draft)

## What was built

The send path, wired and guarded. `campaign init` · `draft` (linted before it is written) ·
`review` (local render beside the dossier evidence) · `daily` (the human-started run) ·
`reconcile` · `unlock`.

| Capability | Where |
|---|---|
| Caps: ceilings AND floors, IST-day bucketing, rolling touch window | `lib/caps.mjs` |
| The 9-step send-moment guard chain + the single-writer lock | `lib/guard.mjs` |
| Two-phase intent + SPINE-FIRST reconciler | `lib/journal.mjs` |
| FAIL / BELOW-BAR / PASS + cross-draft similarity | `lib/personalization.mjs` |
| Two-plane review boundary, campaign store-binding | `lib/drafts.mjs` |
| Send ordering, approval pairing, the daily run | `lib/sequencer.mjs` |

## The number that matters

**Two mandatory adversarial surfaces. 28 confirmed holes. CI was green throughout, and the
two agents shared almost no findings.**

**Surface 1 — decision logic (18).** The breaker clearance was a free-text regex over EVERY
`decision.recorded` on the spine, wrong five ways at once: any approve from any lane cleared
a leads FREEZE; unanchored, so "raise the bounce thresHOLD" cleared a HOLD; a decision saying
HOLD IT cleared the hold; a clearance was permanent and pre-cleared every future breaker; and
`campaign` reached a RegExp raw, so `a|b` made any reason containing `b` a clearance and `(`
threw a bare SyntaxError out of the guard. Replaced with a typed, incident-bound pairing.

Also: `ARC_LEADS_NOW` was a cap override refused by nothing (tomorrow sent 20 more on the
same real day; yesterday emptied the rolling touch window); `touch_n` as `"1"` vs `1` defeated
both the already-sent guard and the reconciler while the idem treated them as identical;
`rolling_window_days: 0` removed the touch cap; `send_window_ist` had no ceiling, so one edit
bought 24/7/365 outbound; an indeterminate provider lookup was treated as "not sent" and
voided the intent, deleting the only trace of a possible send; an emit failure after a
confirmed ack wedged reconcile forever; an approval missing an id paired with a decision
missing a `decides` on `undefined === undefined`; and `reject` was read nowhere, so a human
who caught a mistake could not stop the send.

**Surface 2 — shell / OS / process (10).** `arc-leads reconcile` took NO LOCK while both
emitting receipts and deleting intent files, so running it during a live send voided that
send's intent: the mail had left, no receipt existed, and the next run re-authorised the
identical send. **The trigger was the documented remedy** — the lock refusal tells the
operator to run reconcile. Also: the `resolved` field was an off-switch nothing ever set, so
one hand edit disarmed the crash breaker; config resolved against `process.cwd()`, so a
lowered cap evaporated when run from elsewhere and a planted config won; the temp file in
`emit()` had a predictable name and no `O_EXCL`.

## Mutation analysis — the harder finding

**7 of 12 mutant guards passed the first suite**, including one that deletes the entire
unresolved-intent breaker. The cause was structural: that suite imported only `guard.mjs` and
`caps.mjs`, so every mutant in `sequencer.mjs` and `journal.mjs` passed untouched.

`tests/leads-adversarial.bats` (26) covers those modules. `tests/leads-ordering.bats` (9)
covers the ordering itself — the property `sequencer.mjs` calls "not rearrangeable" and
asserted nowhere — by observing the order operations ACTUALLY happen in through an
instrumented provider and emitter.

## Errors I made, found by the passes rather than by me

1. **I described removing the bidirectional `includes` in a commit message and did not remove
   it.** Fabrication-by-appending stayed BELOW-BAR for another commit.
2. **The clock-door test asserted a message the command never reached** — it died at
   `openStore`, four checks earlier. D4, in the file written to pin D4.
3. **The daemon grep matched its own documentation** — every comment saying "no daemon, ever"
   was a hit, so the test failed for describing the rule it enforces.
4. **A vacuous pass in the ordering probe**: the first run lacked `ARC_LEADS_FAKE=1`, so the
   real provider refused at submit and the before-submit assertion passed for the wrong reason.
5. **A truncated sync-golden** committed from an interrupted regen (46 entries short).
6. One commit message lost a phrase to shell backtick substitution (`` `arc-leads unlock` ``
   became empty). Cosmetic; the code is unaffected. Not force-pushed, because another session
   may be on this branch.

## Definition of Done

- [x] Caps in code, config-valued, ceilings AND floors, ask-to-exceed refused
- [x] Suppression matched across every keyring version
- [x] No mutable counter file, no daemon, no autonomy path — all grep-provable
- [x] Single-writer lock, ownership-checked release, and a documented exit for a dead holder
- [x] 9-step guard chain with campaign-state, unresolved-intent and already-sent first
- [x] Spine-first reconciler that survives a torn journal entry
- [x] FAIL hard-gates at draft time AND is re-read at the send moment
- [x] Approval binds `draft_sha`, recomputed from disk; reject revokes
- [x] **Both adversarial surfaces run, all 28 holes closed and pinned**
- [x] 68 tests across four files, each asserting bats REGISTERED what it declared
- [x] CI green on every leg

## What this does NOT prove

Every provider fixture still encodes a guess at a vendor nobody has chosen (ADR-0413). The
fake is the only oracle and was written from the same guess. **Nothing here has sent an
email.** The committed config carries an empty `sending_domain`, and `daily` refuses on it
with a sentence naming the Phase-03 gate row.

## Carried forward

The defect list is now D1–D6 and every Phase-02 attacker prompt must carry it. Of 28 holes,
the recurring shapes were D5 (two derivations of one value that disagree) and D6 (a guard
applied in one branch and omitted in the adjacent one) — between them roughly half.
