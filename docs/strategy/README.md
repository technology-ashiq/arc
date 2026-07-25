# docs/strategy/ — arc money-engine strategy pack

> Two layers, one folder. **This root = STRATEGY (the why):** vision, principles,
> architecture, decision history. **`plans/` = EXECUTION (the how/when):** kickoff-ready
> plans with paste-ready prompts. **Working a new initiative? Start at `plans/README.md`
> — always.** Root files are context and record; plans files are what you actually feed
> to `/arc-kickoff`.

## File map & status (updated 2026-07-25)

| File | Status | Role now |
|---|---|---|
| `plans/` (18 files) | **ACTIVE — the operational layer** | Kickoff-ready: 4 full PLANs + 13 BRIEFs + ordering/triggers in `plans/README.md` |
| `arc-CONSTITUTION-draft.md` | **ACTIVE · awaiting Ashiq's sign-off** | The DNA (3 eternal + 10 working articles). Adopt at Cycle-2 kickoff → moves to repo root as `CONSTITUTION.md` |
| `arc-master-execution-plan.md` (v1.2) | **ACTIVE — strategy source** | Roadmap, money milestones, operating rhythm, kill criteria, 14-decision log, coverage map. `plans/` operationalizes its §6 trigger table |
| `arc-company-org-blueprint.md` | **ACTIVE — org lens** (2026-07-25) | The company org-chart view: ~50 roles → modules with EXISTS/PLANNED/MISSING/HUMAN status, the shape rule (workflows, not standing agents), flagship grades, standing retro-agenda items. Source of `BRIEF-legal-pack` + growth/leads/ledger v1.1 notes |
| `arc-full-architecture.md` | ACTIVE — reference | The target picture: 16 modules / kernel–workflows–ventures, model-agnostic engine, evolve contract, data layer. Briefs assume its definitions |
| `arc-architecture-v2.1-verdicts.md` | Record — reference | Review round-1 adjudication (vocabulary, capability-lint law, policy capability-vector matrix — BRIEF-policy builds on it) |
| `arc-hq-blueprint.md` | Record — reference | HQ concept: autonomy ladder, learning-as-calibration, moat analysis. Absorbed into Cycle-2 plan + policy/evolve/dashboard/chat briefs |
| `arc-money-engine-plan.md` | Record — rationale | Original idea scoring (pain-mining 9 · leads-service 8.5 · SaaS factory 8 · video 6/8 · trading 2) and monetization logic. Sequencing superseded by the master plan |
| `arc-hq-mockup.html` | **ACTIVE — design spec** | The dashboard's visual target; `plans/BRIEF-dashboard.md` cites it as the spec |
| `arc-cycle2-receipt-spine-PLAN-v2.md` | **SUPERSEDED** | Replaced by `plans/PLAN-cycle2-receipt-spine-v2.1.md` (ADR-number collision fixed, regrounded post-Cycle-1). Kept for history — never feed this one to a kickoff |
| `README.md` (this file) | ACTIVE | You are here |

## Corrections that override older text in this folder

1. **InvoiceFly does not exist** (arc ADR-0022) — wherever an older doc names it, read
   "the venture chosen at Cycle-3 kickoff" (candidates: productize Opportunity-Scout ·
   venturemind · new from a hunt — see `plans/PLAN-cycle3-venture-launch.md`).
2. **Proposed ADR numbers 0021–0028 in older docs are stale** — real ADRs reached 0023 in
   Cycle 1. Plans now name decisions (SPINE-A…, ENG-A…, DIS-A…, V-A…) and assign numbers
   at kickoff from the next free slot.
3. Tests are **centralised in `tests/`** (ADR-0021) — older references to
   `products/*/tests/` are obsolete.

## Provenance

Produced 2026-07-18 → 2026-07-25 in Cowork planning sessions (Ashiq + Claude), grounded
against the repo before AND after the orchestrator initiative closed. Nothing in this
folder changes code or gates by itself; implementation always goes through
`/arc-kickoff` → review → explicit approval.
