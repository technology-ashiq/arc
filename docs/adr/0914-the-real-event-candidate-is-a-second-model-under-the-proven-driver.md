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

## Amendment 1 (2026-10-13): the revisit trigger fired — both sides move to `generic-api`

**The trigger above fired.** `ARC_LLM_*` is provisioned: `generic-api` reaches OpenRouter through
the owner's stored `OPENROUTER_API_KEY` (ADR-1351) and has carried real `/arc-attack` runs since
2026-09-27 (ADR-0226 Amendment 3). Option 1 is no longer hostage to an ops dependency.

**Decision, owner-confirmed 2026-10-13:** the real event runs BOTH sides on `generic-api`, with an
owner cap of **$0.50 for the whole event**:

- champion `deepseek/deepseek-v4-flash-0731`, candidate `anthropic/claude-haiku-5.5`
- `ARC_LLM_REASONING=off` on both runs, so the request settings are identical and the quality axis
  stays comparable (a reasoning model given a diff spent its whole budget thinking, ADR-0226 Am. 3)
- ceilings ₹1 per invocation for each pair → 15 + 15 = **₹30 hard bound (≈ $0.34)**, under the cap

Why not keep `sonnet` as champion: its ceiling alone is ₹180, more than three times the cap. And a
mixed `claude-code`/`generic-api` pair would differ on `driver version`, which `comparability()`
reports as a quality difference. One driver on both sides keeps model id as the only variable.

**What it now proves, and still does not:** a second model FAMILY through a second DRIVER, which
the original decision explicitly could not. It still does not prove a process runs identically
across drivers. Both sides share one driver, so that comparison is not in this event.

**What it costs:** `generic-api` reports tokens and `source: measured` but no rupee figure (no
price table is maintained, ADR-0069 b5). The proposal's cost axis therefore compares TOKENS, and
the ₹30 is a reservation bound, never a reported spend. The provider-side guarantee is the
OpenRouter key's own limit.

## Amendment 2 (2026-10-14): back to `claude-code`, because `generic-api` cannot pose the class

Amendment 1 reached the provider and measured nothing. `commit-msg-draft` is agentic: it stages
and commits in the fixture repo and returns the commit's `sha`. `generic-api` is a chat completion
with no tools, and the repo state never enters its prompt. The champion run (receipt
`01M4VPYVEFDDTQTY9QMP38T3BY`) scored 16.7%, with every answer `{"commits": []}`. That was the model
correctly reporting that it had committed nothing. Spend was about $0.001.

**Decision (owner, 2026-10-14):** the real event returns to the original pair on `claude-code`,
champion `sonnet` and candidate `haiku`, under the ceilings already in `ceilings.json` (₹270 bound).
It runs after ADR-0915, which fixes the two faults the first `claude-code` attempt exposed: the
contract was never shown, and the owner's setup was loaded. The `generic-api` ceiling rows stay.
They are bounds for a non-agentic class, and a row nobody uses refuses nothing.
