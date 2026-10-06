# ADR 1735 — ci on a plan without private-repo protection records its required half ABSENT

**Status:** accepted
**Date:** 2026-10-07
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the owner moves `technology-ashiq` to a GitHub plan that protects private branches, or a venture
whose ci must block merges (a team repo, a paid customer's code)

## Context

ADR-1726 set what happens when GitHub refuses branch protection on a private repo: the `ci` adapter refuses with
`PLAN_LIMIT`, and the owner picks either a paid plan or an ADR that records the required half `ABSENT(plan: private-repo
protection)`. The first real `ci` apply on `arc-sandbox` (2026-10-07, receipt `01M49BGYPTNE9NJGEWW2HVZE83`) answered
`PLAN_LIMIT`. The owner chose the ADR on 2026-10-07.

## Options considered

1. **A paid GitHub plan** (USD 4/month) — full protection, and money spent on a rehearsal venture with no team to
   block.
2. **Make the repo public** — free protection. It reverses ADR-1722 and publishes the sandbox source.
3. **Record the required half ABSENT, by an owner ruling the venture declares** — free. `ci` still has to prove the
   workflow green on three operating systems for main's current head. Nothing stops a red merge into `main`.

## Decision

Option 3. `venture.yaml` may carry `ci_protection: absent-plan`. Leaving it out, or writing `required`, means required; any other value
refuses `BAD_RULING` before any call. The ruling takes effect only when GitHub itself answers the protection call
with its plan limit:

- `scaffold` commits the workflow as before. On a protection call that answers `PLAN_LIMIT` it reports
  `protection-absent <owner/name>@main` in place of protection and returns done. Without the ruling it still refuses
  `PLAN_LIMIT`.
- `verify` reads protection first. A plan-limit answer under the ruling is recorded as
  `required: ABSENT(plan: private-repo protection)` in the evidence, and the three-leg green check on main's head still
  decides ok.
- When protection IS available (the plan changed, or the repo is public), the ruling changes nothing. `scaffold`
  protects as usual, and `verify` on an unprotected main is not ok. A ruling never skips protection GitHub would grant.

`arc-sandbox.venture.yaml` declares `ci_protection: absent-plan`.

## Consequences

- REQ-03's `ci` step on `arc-sandbox` closes on three green legs, with the missing required checks named in the
  receipt's evidence rather than hidden.
- A red commit can land on `arc-sandbox`'s `main` without anything stopping it. `release` and `frontend` read main's
  head, so a broken head still shows up in their verify (a failed build, a page that is not 200).
- `protection-absent` is a record, not a resource: teardown has nothing to undo for it.
- The ruling is per venture. A venture with paying users leaves it out and gets `PLAN_LIMIT` until the plan allows
  protection.
