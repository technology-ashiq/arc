# ADR 0900 — the owner's build-out ruling fires bench, and the pull-trigger is superseded

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** a bench cycle closes with every task class still reading `NO PROPOSAL` and
no routing decision ever recorded — the ruling's premise (build now, use shortly) has then
failed, and the next cycle re-parks bench until ≥2 drivers carry real receipts.

## Context

`PLAN-bench.md` v1.0 gates this build behind a hard prereq — **≥2 drivers in REAL use with
`run.completed` receipts** — and deliberately excluded bench from the 2026-08-09 Build-out
Mandate: *"bench's gate is a PREREQ, not trigger-patience — a runner with no road benches
nothing."*

A kickoff-day census (2026-08-12, this session) found the prereq unmet and not close:

- **1 driver in real use**, not 2. Every `run.completed` on the machine carries
  `driver: claude-code`; `codex` is not installed and `generic-api` has no credentials.
  Engine's own evidence says so: `initiatives/engine/evidence/phase-03/real-runs.md:9-17` —
  *"That criterion is NOT MET, and it is not close… remains UNPROVEN."*
- **3 eval fixtures total**, one per task class, against a `MIN_FIXTURES = 5` per-class floor.
- **Zero assertions** exist in any fixture, so BEN-G's "quality = assertion pass-rate" has no
  substrate at all (see ADR-0905).

By Assumption 1's own falsification branch, that reading is *"the trigger never fired; bench
stays asleep (this is the gate working, not failing)."* The gate was reported to the owner in
full before any file was written.

## Options considered

1. **Stay asleep per Assumption 1** — honest and zero-waste, but leaves a planned capability
   unbuilt indefinitely while the owner's stated priority is completing arc.
2. **Build bench and its road in one cycle** — the road (assertion substrate, replay test
   driver, version verb) becomes bench's own Phase 0 work, at the cost of amending three
   no-gos that were written assuming the road existed.
3. **Kick off the road on the engine lane first, then bench** — correct sequencing, but two
   kickoffs and two cycles for one capability, and it re-introduces exactly the waiting the
   owner has ruled against.

## Decision

**Option 2.** On 2026-08-12 the owner ruled that arc is the sole priority, that ventures are
deprioritized, and that trigger-waiting has stopped: *"we cannot keep waiting for triggers,
everything must be implemented."*

Under **Constitution A8** a build starts when something pulls it, and a recorded owner decision
IS that pull — the same grammar `PLAN-executor.md` used to fire itself off the Build-out
Mandate. Every ADR in the 0900 century cites this one.

**How the ruling reaches the spine:** kickoff emits `kickoff.done` and an `approval.requested`
(gate `kickoff`). The ruling becomes a `decision.recorded` receipt when the owner answers that
request through `arc-inbox`, whose reason is schema-mandatory. Kickoff does **not** emit a
`decision.recorded` in the owner's name — a decision receipt written by the session that wanted
the decision is not a receipt.

**What this ADR does not do:** it does not pretend the prereq is met. The census stands as
recorded fact, and the consequences below are the price of building anyway, stated up front
rather than discovered at the close.

## Consequences

**Easier:** bench exists when the fleet arrives, instead of becoming a scramble the week a new
model ships. The road work (assertions, a replay driver, a version verb) is valuable to the
engine lane whether or not bench ever proposes a routing change.

**Harder:** bench ships with a narrow proving surface. Only `commit-msg-draft` is armed to the
fixture floor this cycle (ADR-0905), so `review-diff` and `kickoff-plan` read `NO PROPOSAL` by
design, not by defect. Anyone reading a bench report must be able to tell those two states
apart — which is why `NO PROPOSAL` always carries its reason.

**The recorded risk:** two lanes have already shipped a capability ahead of its trigger and
left it unexercised — evolve ("fixture-proven, unexercised", `PORTFOLIO.md`) and policy (4 new
spine kinds, 0 production emissions, `docs/retro-log.md` 2026-08-10). This cycle's answer to
that pattern is REQ-05: a real model benched end-to-end to a recorded human verdict
(ADR-0914), and a close that counts bench's PRODUCTION runs from the spine, not its fixture
count.
