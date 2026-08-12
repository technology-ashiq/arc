# ADR 0212 — EXE-E: an agent runtime occupies the model seat (amending ADR-0069 blocks a and b)

**Status:** accepted
**Date:** 2026-08-12
**Product:** `company` — arc-wide (ADR-0053); produced by the `engine` lane, Cycle 7
**Reversibility:** two-way
**Revisit trigger:** a runtime is proposed for a seat that grades or gates other work — the L1-drafts ceiling was written for a producer, and a judging runtime is a different question this amendment does not answer.

Decided under the owner's **Build-out Mandate (2026-08-09)**. **This is the cycle's first act: it
merges before any routing row exists.** A `router.yaml` row for a runtime is meaningless until the
policy it implements says what a runtime is.

## Context

[ADR-0069](0069-balanced-model-policy.md) — the Balanced Model Policy — carries its own revisit
trigger: *"the engine cycle fires (see block d) and finds it must decide a 'which model where'
question this policy does not already answer — that gap is the signal to amend, and the engine
kickoff records which block was missing."*

This kickoff found that gap, and **records the missing blocks as (a) and (b)**, discharging that
obligation here rather than leaving it implied:

- **Block (a)** defines tiers and a seat map over *agents with a `model:` line*. An agent runtime has
  no `model:` line. It chooses its own model, its own reasoning depth and its own number of steps,
  from inside a process arc cannot see. Block (a) has no row for it, so a runtime dispatched today
  would occupy no seat and carry no tier — invisible to the policy that exists to make model choice
  auditable.
- **Block (b)** prohibits runtime tier changes, but its subject is a *component changing a seat's
  tier*. A runtime changing its **own** internal model mid-task is not a component changing a seat —
  it is the contractor doing its job, and EXE-K (ADR-0218) says arc must not forbid it. Block (b)
  needs to say which of those two things it means.

Without this amendment, model policy has a blind spot the size of the contractor's whole brain.

Separately noted, and **not** amended here: block (d)'s trigger list does not contain "a second
runtime is genuinely needed". The previous engine cycle recorded its block-(d) trigger as *unstated
and never inferred* and closed that assumption as escalated rather than resolved. This cycle does not
inherit that ambiguity, because it does not need block (d) at all: the **Build-out Mandate is the
recorded decision that fired it**, and a recorded owner decision is its own authority (Constitution
A8). Block (d) governs when the *engine* cycle starts, and the engine shipped in C6.

## Options considered

1. **Give the runtime a tier from block (a)'s existing four.** Wrong shape — a tier describes the
   *work*, and the runtime performs work at a depth it selects itself, so any tier arc assigns is a
   label nothing applies.
2. **Leave runtimes outside the policy.** Honest about the opacity, and it means the most autonomous
   thing arc dispatches is the one thing model policy says nothing about.
3. **The runtime occupies the model seat itself.**

## Decision

**Option 3.** The amendment text, one paragraph, extending blocks (a) and (b):

> **Amendment to ADR-0069 (blocks a/b extension — agent-runtime drivers).** An agent runtime (an
> external autonomous agent system invoked as an engine driver) is a **driver class**. From this
> policy's viewpoint **the runtime occupies the model seat**: MP-F's fingerprint records runtime name
> + version + pinned config hash in place of provider/model id, and absent cost or effort fields stay
> absent per b(5). The runtime's choice of its own internal model is **not** a tier change under
> b(1) — b(1) binds arc's components, never the contractor's method (ADR-0218) — but the runtime
> **row** in `router.yaml` is a production routing decision and every change to it is a reviewed diff
> citing this policy. Runtime-executed processes carry a hard action ceiling of **L1-drafts** (draft
> and read-only outputs; publishing and every L2+ action remain human), enforced by the policy
> engine: the kinds are born at L1 (POL-C) and the driver holds no L2+ eligibility until it passes
> POL-G's fixtures — neither is granted by this amendment. The ceiling is encoded as a mandatory
> `cap:` field on every runtime row; a row missing `cap:`, `hosted:`, `judge:` or `review_by:` fails
> the router load. Unpinned runtimes are recorded as unpinned and refused by pin-required classes.
> Nothing here changes seat-to-tier mappings, prohibitions b(1)–b(5), or the escalation constraint.

Two deliberate departures from the design source's Appendix D base text, both recorded rather than
silently applied:

1. **`data:` is dropped from the mandatory field list.** Appendix D lists `cap:`, `data:`, `hosted:`
   and `review_by:` as though `cap:` and `data:` already existed. Neither exists — `engine/router.yaml`
   today carries only `version:`, `models:`, `tiers:`, `classes:` and `default:`. And `data:` is not
   needed: the data classification lives on the **context pack** (ADR-0214), not on the routing row.
   The refusal that fixture #3 describes is *internal-only pack meets a `hosted: cloud` row*, which
   needs `hosted:` on the row and a classification on the pack — never a `data:` field on both.
   `judge:` takes its place in the mandatory four, matching REQ-04.
2. **The b(1) sentence is new.** Appendix D was silent on whether a runtime picking its own model
   violates the no-auto-switching prohibition. Left silent, the strictest reading forbids the hire
   outright and the loosest reading lets a runtime row rewrite itself. Both are wrong, so the
   boundary is drawn explicitly.

**Confidence:** high — this discharges ADR-0069's own revisit trigger on the terms that trigger set.

## Consequences

**Easier.** A runtime dispatch produces a fingerprint that says exactly what ran. "Which model where"
has an answer for the one dispatch class that previously had none, and the answer does not require
arc to see inside the contractor.

**Harder.** The model seat now holds two different kinds of thing — a model id for a normal driver, a
runtime-plus-config-hash for this one — so anything reading that field must handle both. And the
honest limit of the fingerprint is that it records *which contractor*, never *which model the
contractor used*; that information does not exist outside the runtime, and per b(5) it stays absent
rather than being estimated.
