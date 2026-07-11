# PLAN.md — <PRODUCT NAME>

> Filled by `/arc-kickoff`. Every section below is load-bearing — if one is empty, the plan
> isn't done. Formats used: Shape Up pitch fields · ADRs · C4-concept Mermaid · Klein pre-mortem.

## Goal
One sentence: who it's for + what it does + why they'd pay.

## Success requirements
<!-- HARD CAP: 10 ACTIVE rows (small builds: 5). Each REQ must be: user-centric (an
     outcome someone experiences, not a task), atomic (ONE outcome — "and" is a smell),
     and testable (acceptance can fail: a number, a demo step, or a check). Vague
     acceptance words (fast/easy/robust/seamless…) without a verifiable token fail
     kickoff-lint. Every REQ maps to exactly ONE phase; every phase (except 0) must
     serve ≥1 active/validated REQ.
     Status lifecycle: kickoff creates rows as `active` · /arc-phase-done flips the
     closed phase's REQs to `validated` · /arc-change scope-cuts mark `dropped` — rows
     are NEVER deleted, a dropped row IS the scope-cut history. Lint enforces all this. -->

| REQ | User outcome | Measurable acceptance | Phase | Status |
|---|---|---|---|---|
| REQ-01 | | | | active |

## Appetite
Total time budget (e.g. "3 weeks part-time"). This is a **constraint, not an estimate**:
if it's blown, we cut scope or kill a phase — never silently extend. No story points anywhere.

**Kill criteria:** at 50% appetite burnt, if Phase <N> isn't done → mandatory scope-cut
conversation. At 100% → cut or kill, never extend silently. (PROGRESS.md tracks the burn.)

## Architecture (C4 concepts, Mermaid flowchart)
<!-- Use C4 *vocabulary* (person / system / container) but plain `flowchart TB` + subgraphs.
     Do NOT use Mermaid's experimental C4Context syntax. Renders natively on GitHub. -->
```mermaid
flowchart TB
  user([User])
  subgraph app [System: <name>]
    web[Container: Next.js app]
    api[Container: API routes]
    db[(Container: Supabase Postgres)]
  end
  stripe[External: Stripe]
  user --> web --> api --> db
  api --> stripe
```

## Key decisions (ADR index)
Every fork we resolved, one ADR each in `docs/adr/NNNN-title.md`:

| # | Decision | Status |
|---|---|---|
| 0001 | e.g. Supabase over Neon+Lucia | accepted |

## Non-negotiables
The quality bars that never get cut (e.g. RLS on every table, tests per feature, no `any`).

## No-gos (explicitly out of scope)
What we are NOT building this cycle — the scope-creep firewall. Be specific.

## Rabbit holes
Known time-bombs spotted up front, and the decided detour around each
(e.g. "OAuth providers → email-only for v1").

## Assumptions ledger
<!-- HARD CAP: 7. Rule: no falsification trigger → not an assumption, it's filler —
     entry rejected. Unresolved kickoff questions land here (with triggers), then we
     proceed: a falsifiable plan beats a perfect one. -->

| Assumption | How we'd know it's wrong (trigger) | Phase that tests it |
|---|---|---|

## External dependencies
<!-- Real external APIs/services only — not every import. Feeds Phase 0: the contract
     test suite must pass against the FAKE in Phase 0, and against the REAL impl before
     the dep's phase closes. This is the fake-drift firewall. -->

| Dep | Interface | Fake impl | Real impl | Contract test |
|---|---|---|---|---|

## Pre-mortem (Klein)
*It's 6 months later. The project shipped and failed.* The top 5 most likely causes,
each with: mitigation now / accepted risk (explicitly chosen).
<!-- Seed from docs/retro-log.md first: any past pattern matching this project type MUST
     appear as a row. History beats imagination. -->

## Current state
<!-- BROWNFIELD ONLY (delete section for greenfield): what exists, what must not be
     touched, key entry points. From the preflight codebase survey (Graphify → grep). -->

| # | Failure cause | Mitigation or accepted |
|---|---|---|

## Phases (risk-ordered)
Phase 0 is ALWAYS a steel thread / walking skeleton: end-to-end through every
integration on fakes, deployed. 