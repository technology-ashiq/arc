# ADR 0914 — the real-event candidate is a second model under the proven driver (REQ-05)

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** a second driver becomes genuinely reachable (codex installed, or
`ARC_LLM_*` provisioned) — the next real event uses it, because a cross-driver subject is the
stronger proof.

## Context

REQ-05 requires one real model benched end-to-end to a recorded human MERGE or REJECT. Its
preflight requires the candidate to be genuinely new to arc, reachable through an **existing**
engine driver, with credentials verified.

Verified 2026-08-12: **only `claude-code` is reachable.** `codex` is not installed;
`generic-api` has no `ARC_LLM_ENDPOINT` / `ARC_LLM_API_KEY` / `ARC_LLM_MODEL`. Only
`claude-code` has ever produced a real `run.completed`, and `engine/router.yaml` pins concrete
models for that driver alone.

## Options considered

1. **Provision `generic-api` credentials** — the strongest proof, exercising a second driver
   AND a second model family, and it makes Phase 2 hostage to an ops dependency outside the
   lane's control.
2. **A second model id already reachable under `claude-code`** — no new credentials, and
   BEN-B's own rule already makes a different model id a distinct bench subject.
3. **Accept the cycle may close with no real event** — the "fixture-proven, unexercised"
   outcome ADR-0900 exists to avoid.

## Decision

**Option 2, owner-confirmed 2026-08-12.** The candidate is a model id reachable through the
`claude-code` driver that is **not** the current champion for the class being benched — with
`commit-msg-draft` the armed class (ADR-0905), whose champion is `balanced-workhorse →
sonnet` (`engine/router.yaml`).

This is a legitimate real event, not a rehearsal: real money, a real provider call, a real
scorecard, and a real human verdict through `arc-inbox --reason`. BEN-B's subject rule is
satisfied because the model id genuinely differs.

**Both outcomes are success.** A REJECT recorded with a reason is evidence-backed routing; the
requirement is a recorded decision, never adoption.

**What this deliberately does NOT prove**, stated so the close cannot overclaim: it does not
prove a process runs identically across **model families** or across **drivers**. That claim
has been UNPROVEN since engine C6 (`initiatives/engine/evidence/phase-03/real-runs.md:16-17`)
and this cycle does not close it. The retro says so plainly rather than letting a single-driver
result read as a fleet result.

## Consequences

**Easier:** Phase 2 can close on evidence the lane controls, with no external dependency.

**Harder:** the proof is narrower than the plan's north-star implies, and the runbook must not
describe bench as fleet-proven.

**The trap this closes:** `docs/retro-log.md` 2026-08-03 (arc-engine) — *"a green suite on an
uninstalled dependency is proof the test is not reaching it."* REQ-05's preflight therefore
**asserts the candidate model was actually reached** — a receipt with a real model id and a
non-zero token count — before any verdict is recorded, because "the run completed" and "the
candidate was called" are different facts.
