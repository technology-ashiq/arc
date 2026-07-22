# docs/strategy/plans/ — the kickoff-ready plan pack

> Written 2026-07-22, grounded against the repo AFTER the orchestrator initiative closed.
> **Every future initiative has a file here with a paste-ready kickoff prompt at the
> bottom.** No more "vera session-la proper idea varala" — open Claude Code in the right
> repo, paste the prompt from the plan, review what it writes, approve. That's the whole
> ritual.

## Ground truth this pack is built on (verified 2026-07-22)

- Orchestrator initiative **CLOSED** (6/6 phases, ~22% burn, 271/271 bats, 22 commands).
- ADRs run through **0023** — plans here name decisions (SPINE-A…, ENG-A…) and assign
  real numbers at kickoff from the next free slot.
- Tests are **centralised in `tests/`** (ADR-0021) — no `products/*/tests/`.
- Scripts live per product: `.claude/scripts/{core,council,plan,review}/`.
- **InvoiceFly does not exist** (ADR-0022). Real consumers: venturemind (upgrade path),
  Opportunity-Scout (fresh path). Anywhere an older strategy doc says "InvoiceFly",
  read "the venture chosen at Cycle-3 kickoff".
- 8 kickoff-lint substance gates are WARN-first in TRIAL (`docs/trial-ledger.md`) —
  no plan here promotes them.
- v2 world-best initiative stays parked at ~13% (ADR-0017).

## The order (from arc-master-execution-plan.md, operationalized)

| # | Initiative | File | Status / trigger |
|---|---|---|---|
| 1 | **Cycle 2 · Receipt Spine** | `PLAN-cycle2-receipt-spine-v2.1.md` | **READY NOW** — this is the next kickoff |
| 2 | **Cycle 3 · First Money ([VENTURE] launch)** | `PLAN-cycle3-venture-launch.md` | After Cycle 2 · needs the venture decision (candidates + 10-min test inside) |
| 3 | Model-agnostic foundation (engine + processes) | `PLAN-engine-process-layer.md` | Pull: public-prep / 2nd runtime need |
| 4 | discover v1 | `PLAN-discover.md` | Pull: next venture needed |
| — | growth v1 | `BRIEF-growth.md` | Pull: live venture needs traffic |
| — | leads v1 | `BRIEF-leads.md` | Pull: an offer needs outbound |
| — | ops v1 | `BRIEF-ops.md` | Pull: ≥2 live ventures / support volume |
| — | ledger module | `BRIEF-ledger.md` | Pull: ≥2 revenue sources |
| — | evolve v1 | `BRIEF-evolve.md` | Pull: 4+ weeks of real metrics |
| — | memory v1 | `BRIEF-memory.md` | Pull: recall pain (>2 min to find a lesson) |
| — | bench runner | `BRIEF-bench.md` | Pull: drivers disagree / new model |
| — | dashboard | `BRIEF-dashboard.md` | Pull: brief overflows / ≥3 earning ventures |
| — | chat (HQ MCP) | `BRIEF-chat-mcp.md` | Pull: dashboard live + conversational demand |
| — | policy engine | `BRIEF-policy.md` | Pull: ≥3 kinds at L2 — **required before scheduler** |
| — | scheduler | `BRIEF-scheduler.md` | Pull: first L3 process · policy engine is a hard prereq |
| — | trader sandbox | `BRIEF-trader.md` | Pull: monthly revenue + Ashiq's written opening — **last** |

**Full PLANs** (top 4) are kickoff-grade: REQ tables, appetites, ADR-ready decisions,
phases, pre-mortems. **BRIEFs** are deliberately lighter — real REQs and locked
non-negotiables, but current-state gets filled at their kickoff (writing 400-line plans
for far-future modules today would be stale slop by the time their triggers fire; the
brief + the kickoff process produce the full plan when it's actually needed).

## How to start ANY initiative (the 4-step ritual)

1. Check its **trigger** fired (the table above). No trigger → it doesn't get built
   (Constitution A8, earn before build).
2. Open Claude Code **in the right repo** (arc for modules; the venture repo for Cycle 3).
3. Paste the **KICKOFF PROMPT** from the bottom of its plan/brief file.
4. Review the PLAN.md + phase specs it writes → approve → build starts. Phase closes only
   via /arc-phase-done; cycle closes with /arc-retro.

## Standing rules (apply to every kickoff from this pack)

- Constitution (`../arc-CONSTITUTION-draft.md`) outranks everything here — adopt it at
  Cycle-2 kickoff if not already law.
- Venture track outweighs OS track on any tie (kill criteria in the master plan §10).
- New parser-class code always gets the adversarial pass before FAIL promotion.
- All new lint starts WARN in TRIAL. Evidence bundle per phase-done. Never delete — attic
  stays deferred per ADR-0023.
- Spine discipline everywhere: emit via the standard emitter, read via the reader only,
  events for approvals/decisions/revenue (real vs simulated never mixed).

## Immediate next action (as of 2026-07-22)

**Kick off Cycle 2.** Open Claude Code in arc, paste the prompt at the bottom of
`PLAN-cycle2-receipt-spine-v2.1.md`. The venture decision (Cycle 3's slot) can wait until
Cycle-2 Phase 3 — but the 10-minute test in `PLAN-cycle3-venture-launch.md` is worth
running any evening.
