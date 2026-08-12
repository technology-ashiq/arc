# ADR 0211 — EXE-D: the credential is capped and in env, and runtime memory is proven off

**Status:** accepted
**Date:** 2026-08-12
**Product:** `engine` — Cycle 7, executor v1
**Reversibility:** two-way
**Revisit trigger:** the memory-plant fixture starts failing after a runtime update — persistent memory has been re-enabled by a default change, and the "proven off" claim needs re-earning rather than re-asserting.

Decided under the owner's **Build-out Mandate (2026-08-09)**.

## Context

Two things the runtime must not have: arc's secrets, and a memory of its own.

**Credentials.** The runtime gets its own capped key, never arc's. It must live in the environment,
never in the repository and never inside a runtime skill file — skill files are exactly the surface
ClawHavoc compromised, and a key written there is a key published. This repository's env contract is
`.env.example`, and that file currently has a real gap: it documents `ARC_LEADS_*` in detail and
carries **zero `ARC_LLM_*` rows**, so the existing `generic-api` driver's entire credential contract
(`ARC_LLM_ENDPOINT`, `ARC_LLM_API_KEY`, `ARC_LLM_MODEL`, `ARC_LLM_TIMEOUT_MS`) is undocumented.

**Memory.** A contractor that remembers between jobs accumulates state arc cannot see, cannot
receipt, and cannot revoke. That breaks the receipts law: the record of what the system knows would
live in the contractor's head rather than on the spine.

But a contractor that cannot improve is a worse contractor, and the design lane already paid for the
lesson that constraining a creative seat's process is net-negative (ADR-0049).

## Options considered

1. **Runtime memory on** — the contractor improves across jobs; arc loses the ability to say what it
   knows or to reset it.
2. **Memory off, and that is the end of it** — auditable, and the contractor never learns.
3. **Memory off, feedback rides the next context pack** — state lives in arc's receipts, and the
   contractor still improves.

## Decision

**Option 3.** Runtime persistent memory is **OFF** for arc tasks, and **proven off by a fixture, not
assumed**: a unique marker planted in run N, probed for in run N+1, and asserted unrecallable
(certification fixture #8). A configuration flag that says memory is disabled is a claim; the
memory-plant fixture is the evidence.

The contractor still improves, from the briefing rather than from its own head: accepted past drafts
and one-line rejection reasons ride the **next context pack** (ADR-0214). Both are external-ok by
nature — they were written to be published — so feeding them back crosses no boundary. State lives
in arc receipts, where it can be read, superseded and revoked.

The capped key lives in env under its own row, added to `.env.example` in the same change. **That
change also adds the four missing `ARC_LLM_*` rows**, because a cycle that documents a new credential
while leaving the existing one undocumented has fixed the smaller half of the problem.

**Key issuance and rotation stay a human act in v1.** No key-vending automation — issuing capped keys
is vendor-API archaeology with real money attached, and it is a named rabbit hole.

**Confidence:** high.

## Consequences

**Easier.** Revoking the key is a complete off-switch, because there is no second place the runtime
kept anything. Feedback is reviewable before it reaches the contractor, which a memory would not be.

**Harder.** Every dispatch pays the cost of re-briefing, so packs grow as feedback accumulates and
someone must decide when a rejection reason has stopped being useful. And "memory off" is only as
true as the last time the fixture ran — a runtime update can re-enable it by default, which is this
ADR's revisit trigger.
