# ADR 0213 — EXE-F: the money ceiling is the credential, and no cap is zero-overshoot

**Status:** accepted
**Date:** 2026-08-12
**Product:** `engine` — Cycle 7, executor v1
**Reversibility:** two-way
**Revisit trigger:** the provider changes its per-key limit from hard refusal to advisory alert, or the overshoot on a crossing request is observed to exceed the `max_tokens` bound this ADR relies on.

Decided under the owner's **Build-out Mandate (2026-08-09)**; provider chosen by the owner, 2026-08-12.

## Context

Every other engine driver can be metered because arc issues the call. An agent runtime cannot: it
decides its own number of model calls from inside a process arc does not observe, so there is no
in-flight point where arc could count spend and stop. The engine's own code already says why —
*"the money bound is enforced AFTER each attempt, because no driver reports spend in flight"*
(`.claude/scripts/engine/arc-run.mjs:435`). For an opaque contractor, "after each attempt" is after
the whole job.

So the ceiling has to live somewhere arc does not have to watch: **the credential**. This is POL-F's
own definition of spend seen from the driver side — metered consumption against a human-pre-approved
provider budget, where the cap itself is a recorded human decision.

## Options considered

1. **Meter in the shim** — impossible for an opaque runtime, and a metering claim that cannot be
   enforced is worse than none.
2. **Post-hoc accounting** — read the bill afterwards. Records spend, prevents nothing.
3. **A hard-capped provider credential** whose ceiling equals a human-pre-approved budget.

## Decision

**Option 3, via an OpenRouter per-key credit limit** (owner's call, 2026-08-12).

The key is provisioned with a **non-resetting** limit. Past the ceiling the provider returns
**HTTP 402** and refuses the request — a real error, not an email — which the shim maps to
`fail` / `reason: budget` with zero silent continuation. The key is revocable instantly through the
provisioning API, which is what makes ADR-0216's termination path work: **the credential is the
leash.**

OpenRouter specifically, over the equally-capable alternative, because arc already speaks it:
`.claude/scripts/engine/drivers/generic-api.mjs` is written against *"an OpenRouter/LiteLLM-shaped
chat completion"* and reads `ARC_LLM_ENDPOINT` / `ARC_LLM_API_KEY` / `ARC_LLM_MODEL`. Integration
cost is close to zero, and the same credential shape lights up a driver that already exists.

**No cap is zero-overshoot, and this ADR says so rather than implying otherwise.** No provider knows
a completion's cost until it finishes, so **the one request that crosses the line always completes**;
what a hard cap guarantees is that every request *after* the crossing is refused. The overshoot is
bounded by capping `max_tokens` per call in the process spec — by arc, not by the provider. Claiming
a literal zero-overshoot hard cap would be a claim no vendor can support, and recording it as one
would be an E3 violation.

**The ceiling figure is not set here and is not invented.** The owner named the mechanism, not the
number. ADR-0069 block (d) already set the precedent when it refused to invent a monthly-spend
threshold: *"a fabricated number in an append-only ADR is worse than an honest blank."* The figure is
an owner decision recorded **before the key is issued**, in Phase 07, and is tracked as an assumption
in `PLAN.md` with that trigger.

**Evidence:** [OpenRouter — API credit and rate limits](https://openrouter.ai/docs/api_reference/limits) ·
[OpenRouter — provisioning API keys](https://openrouter.ai/docs/features/provisioning-api-keys), both
fetched 2026-08-12. Anthropic and OpenAI were checked and are **not** viable as the primary boundary:
Anthropic's spend limits are per-workspace/per-org and Console-UI-only (its programmatic Spend Limits
API is Enterprise-only and scoped to a human member, not a service key — corroborated by an open
Anthropic feature request asking for exactly the missing endpoint); OpenAI's project limit is
monthly-auto-resetting with no documented one-shot option, which silently renews a human-approved
ceiling every 30 days. LiteLLM's self-hosted `max_budget` works but carries a documented 2026 trail of
budget-bypass and stale-spend-cache issues.
**Confidence:** high on the mechanism; medium on the exact exhaustion payload, which is asserted by a
fixture against the live provider rather than trusted from documentation.
**Rejected because:** Anthropic — no programmatic per-key cap. OpenAI — auto-resetting monthly cap is
a different and weaker risk shape than a recorded one-time human decision. LiteLLM — a money boundary
with a known bypass history would need its own adversarial cycle before it could be the only
boundary. Vercel AI Gateway — equally capable and genuinely close, rejected only because OpenRouter
needs no new integration.

## Consequences

**Easier.** The money question stops depending on arc's ability to watch a black box. Termination is
one API call. The same credential shape already has a driver.

**Harder.** Money now has an enforcement point arc does not own, so an OpenRouter outage is an arc
outage for this driver. The bounded overshoot means the true ceiling is *limit plus one request*, and
that sentence has to survive into anything that reports spend. And a capped key is a single shared
purse: if a second runtime is ever hired on the same key, the first one's spend can starve it —
v1 has one runtime, and that is the reason this stays simple.
