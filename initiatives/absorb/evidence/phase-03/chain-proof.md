# Phase 03 — the receipt chain, and what is fixture-proven vs live-exercised

**CI green 19/19** on run `31310632368`. 26 tests in `tests/absorb-judgement.bats`.

## The distinction this file exists to hold

**Fixture-proven** and **live-exercised** are different claims, and Phase 03 closes with one of each.

| property | fixture-proven | live-exercised |
|---|---|---|
| the payload profile refuses malformed judgements at the SPINE | YES — 6 refusal cases through the real emitter with `--strict` | YES — 6 refusals + 1 accept verified by hand against the real spine |
| a near-miss subject is refused rather than exempted | YES | YES |
| the mapping is sealed by hash and absent from the bundle | YES | YES — the committed `PHASE03-CHAIN` bundle carries only `commitment.txt` |
| `verify` FAILS on a mapping edited after sealing | YES — and its negative control is the whole point | YES |
| `reveal` refuses without a real decision that names a pick | YES — 4 refusal fixtures | YES — verified against every bypass the adversarial pass found |
| the full chain seal → emit → approve → reveal | YES — the happy-path fixture builds a REAL decision on an isolated spine | **NO — see below** |

## The one row left open, and it is the owner's

**REQ-06's live demo requires a real owner judgement on the real spine, and it has not happened.**
Approval `01KZJXBNKT6PEYC87TW5D53QTP` is queued and open: candidate T-01, labels **quartz | fathom**,
3 fixtures of the unspecified-input defect class, commitment sealed in
`initiatives/absorb/evidence/planoff/PHASE03-CHAIN`.

**REQ-06 therefore stays `active`, not `validated`.** The mechanism is proven; the judgement is not
made. Flipping it would be asserting a receipt that does not exist, in the phase whose entire subject
is that a judgement must be a receipt rather than a memory. **The phase closes by the owner's
explicit decision (2026-08-09) with this row open** — the leads Phase 04 precedent, where closing
with a row open was likewise the owner's call and not the lane's.

**REQ-05 and REQ-07 are validated.** REQ-05's four parts all landed: the `PLAN-develop` §7.1a
addendum, its freeze-log line, the `technique` verdict that `capability-scout.md` never had, and
`docs/templates/toolbox-template.md`. REQ-07 is fixture-proven in both directions — no code path
writes `adopted` or `retired`, proven by an assignment-shaped guard **plus its own negative control**
asserting the guard fires on a commented assignment, which is how the first version was defeated.

## What the adversarial pass cost and bought

22 findings, 6 HIGH, **three falsifying claimed properties outright**:

- the commitment preimage was **not injective** — in-band `\n` and `=` delimiters over unvalidated
  values, so a mapping edited after sealing hashed the same and `verify` said **OK**
- a `--correlation` traversal wrote the plaintext mapping **and its nonce into a git-tracked path**
- the blinding test **survived blinding being deleted** — a mutant showing the owner raw variant
  names passed both assertions, because the test used a denylist too

Then two named blockers, fixed after: `--decision` accepted any non-empty string, so the ordering
property was a self-declaration; and ADR-0603 Amendment 1's `pick=` prefix was enforced **nowhere** —
I wrote that sentence into the amendment and did not implement it.

**Three of my own earlier tests were stale afterwards, and one was a test FOR the defect** — it
handed `reveal` a hardcoded ULID that exists on no spine and passed, which *was* the defect. Deleted
rather than patched.
