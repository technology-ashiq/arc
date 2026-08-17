# Phase 06 · fixture 10 — the exhausted capped key: **mechanism PASSES, the asserted code was WRONG**

REQ-02 fixture 10 / REQ-05: *"an exhausted key produces `fail` / `reason: budget` with zero silent
continuation and the provider's real **HTTP 402** asserted, never a mocked one."*

Run against the live credential on 2026-08-16, ceiling `limit: 0`, `limit_reset: null`.

## What the provider actually returns

| Request | Result |
|---|---|
| a **paid** model (`mistralai/mistral-nemo`) | **HTTP 403** — `"Key limit exceeded (total limit)"` |
| a **free** model (`liquid/lfm-2.5-2.6b:free`) | **HTTP 200**, a real completion |

**The cap works.** Spend is refused at the credential, exactly as ADR-0213 designed — *"the
credential is the leash"*. Nothing was mocked; this is the provider's own refusal on the real key.

**The code is 403, not 402, and the spec says 402 in three places.** OpenRouter distinguishes two
refusals that this plan conflated into one:

- **402** — *"Your account or API key has insufficient credits"* — the ACCOUNT is out of money.
- **403** — *"Key limit exceeded (total limit)"* — the **per-key `limit`** is spent.

ADR-0213 chose the per-key limit deliberately (*"an OpenRouter per-key credit limit"*), so **403 is
the code this design produces** and 402 is the code a different design would produce. A fixture
asserting 402 would fail against a working cap, and a cap that stopped working would be
indistinguishable from a spec that was simply wrong.

This is the ADR-0219 shape repeating: an exit contract described from documentation rather than
measured, with fixtures written against the description. It surfaced the same way ADR-0219's did —
by running it.

**Correction, then:** fixture 10 asserts **HTTP 403** with the message class *"Key limit exceeded"*,
and REQ-05's wording moves from *"the provider's real HTTP 402"* to *"the provider's real refusal
code for a per-key limit — 403 — asserted, never mocked"*. ADR-0213 carries an amendment recording
that the mechanism it chose does not produce the code it named.

## The free-tier half of the settled path HOLDS

PROGRESS records the settled path as *"free models plus an UNFUNDED key"*. Measured: a `:free` model
returns **HTTP 200** on this key. So Phases 06–08 can reach a hosted model at **zero spend**, and the
zero-spend claim is a measurement rather than an assumption.

**With a caveat worth having in writing:** OpenRouter currently lists **16** `:free` models out of
413, and two slugs that were free in the plan's own examples are gone — `anthropic/claude-3.5-sonnet`
answers *"No endpoints found"*, and `meta-llama/llama-3.2-3b-instruct:free` answers *"This model is
unavailable for free. The paid version is available now"*. The free tier is a moving surface, so a
process pinned to one free slug will break without notice. Phase 08 should pin the slug **and**
record the date it was verified.

## What this does NOT establish

- **The shim's mapping is untested.** REQ-05 also requires that this refusal becomes
  `fail` / `reason: budget` with **zero silent continuation** through `arc-run`. Nothing here went
  through the shim — the runtime holds its own credential and arc never issues this call. That arm
  is owed and is not counted by this file.
- **No `run.completed` receipt was produced by this probe**, because no run happened. This is a
  provider-behaviour measurement, not a dispatch.
- **The key identifier is deliberately not recorded here.** The 403 body carries a key-management
  URL containing a key hash; the code and the message class are the evidence, the identifier is not.
