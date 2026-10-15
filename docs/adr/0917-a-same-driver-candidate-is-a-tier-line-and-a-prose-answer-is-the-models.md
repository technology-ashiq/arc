# ADR 0917 — a same-driver candidate is a tier line, money is compared like for like, and a prose answer is the model's

**Status:** accepted
**Date:** 2026-10-15
**Product:** `bench` (touches the `engine` claude-code driver by exception, recorded here)
**Reversibility:** two-way
**Revisit trigger:** the router gains a per-class model field, a driver reports a rupee figure, or arc
gains a maintained exchange rate.

## Context

The first clean champion run, `champion-sonnet4` (2026-10-15, from the main clone, after #426), held
containment. HEAD, the branch, every local ref and the config were all unchanged. Sonnet scored 84 of 84
assertions on 14 of 15 attempts. But reading the code the candidate run would go through showed that this
pair could never reach the owner's verdict, for three independent reasons:

1. **A prose answer counted as a harness fault.** On one attempt sonnet answered `Commit successful...` in
   prose. The claude-code driver threw on the non-JSON result without declaring a failure class, so arc-run
   receipted `failure_class: unknown`, `reason: driver`. Bench copied `driver` as the verdict, and gate 1
   (completeness) refuses a champion with any attempt whose verdict is not `schema`. generic-api has
   declared exactly this case `model-invalid` since ADR-0228; claude-code was the twin left behind.
2. **A same-driver candidate had no diff.** ADR-0914's candidate is a second model under the incumbent's
   driver (`claude-code/haiku` against `claude-code/sonnet`). `buildRouterDiff` only rewrites the `driver:`
   line, so it returned "the router already routes commit-msg-draft to claude-code". No diff meant no
   `approval.requested`, which meant no verdict.
3. **claude-code's money was invisible.** Engine Cycle 9 puts the session's spend on `run.completed` as
   `payload.spend` (integer USD cents) with `spend_basis: harness-reported`. Bench read only the receipt's
   rupee cost block, which is null for this driver. The cost axis therefore read ABSENT on both sides and
   never decided anything, even though the receipts carried 82 cents for the champion.

## Decision

1. **The claude-code driver declares a non-JSON answer `model-invalid`**, the same line generic-api has had
   since ADR-0228. An envelope that will not parse stays undeclared, because that is the CLI and not the
   model. The driver version moves to `claude-code@1.5.0`.
2. **Bench reads a `model-invalid` receipt as a schema failure** (`verdict: schema`, `schema: false`). The
   model answered and broke the contract. That is a scoreable outcome, and gate 1 already admits it. An
   undeclared failure stays unscoreable, exactly as before.
3. **A same-driver candidate is proposed as a tier line.** The model comes from the class's `tier:` through
   `models:` (ADR-0069). When the candidate's driver equals the row's, the diff rewrites `tier:` to the one
   tier that pins `<driver>: <model>`. It refuses when no tier pins it, because a new `models:` row is a
   reviewed policy change and not a bench diff. It also refuses when two tiers pin it, because choosing
   between them would be bench deciding a tier. The model used is the one the candidate APPLIED, never the
   one it requested. Bench still has no write path to the router.
4. **Money is read from the receipt's spend and compared like for like.** Each attempt's
   `{amount, currency, basis}` is re-checked with the same `isSpend` shape arc-run wrote. A class's spend is
   a sum only when every attempt reported one, in one currency, on one basis. Otherwise it is ABSENT, with
   the reason in `spend_gap`. Gate 5 compares spend only when no rupee cost block exists on either side and
   both sides share a currency and a basis. A harness's notional list price and a provider's invoice are
   different facts even in the same currency (ADR-0230), and converting currencies needs a rate nobody
   maintains (ADR-0069 b5).

## Consequences

- The champion run has to be repeated. Its captured attempt still says `verdict: driver`, and replay never
  re-derives a verdict (ADR-0913). That costs about 82 notional cents again.
- A haiku proposal reads `tier: balanced-workhorse` → `tier: cheap-scan`. That is a production tier change,
  which ADR-0069 says must be a reviewed diff. The proposal is that review artifact, and the owner's
  `arc-inbox` verdict is the review.
- The budget remainder still reconciles in rupees only. A USD spend does not refund a rupee reservation, so
  a claude-code run stays bounded by its hand-authored ceilings. That is conservative, and it is unchanged.
- The drift guard's cost-delta classification still reads only the rupee figure, so a claude-code drift
  check reports `unknown-mixed` on money. This is recorded as debt rather than widened here.

## Alternatives rejected

- **Re-run the champion until sonnet never answers in prose.** That would fix nothing: an unscoreable
  attempt is a coin flip on every future run, and gate 5 would still never see money.
- **Convert USD to INR at a fixed rate.** That is an estimate wearing a measurement's clothes (ADR-0069 b5).
- **Map `model-invalid` to `schema` in arc-run.** That would change the engine's receipts and its
  contract-retry ladder for every caller. Bench's reading is local to bench and reversible.
