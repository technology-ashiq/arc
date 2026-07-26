# docs/strategy/ — arc money-engine strategy pack

> Three layers, one folder tree. **This root = ACTIVE STRATEGY (the why):** vision,
> principles, the calendar. **`plans/` = EXECUTION QUEUE (the how/when):** kickoff-ready
> plans with paste-ready prompts. **`records/` = RATIONALE HISTORY (the why-we-decided):**
> closed analysis kept for reference, read only when a brief cites it. Superseded drafts
> leave this folder entirely → `docs/archive/`.
> **Working a new initiative? Start at `plans/README.md` — always.**

## Placement rule (for every future strategy doc)

Still steering decisions → **root** · feeds `/arc-kickoff` → **`plans/`** · rationale
that no longer changes but briefs cite → **`records/`** · superseded/dead → **`docs/archive/`**.

## File map & status (updated 2026-07-26, arc-design plan added)

| File | Status | Role now |
|---|---|---|
| `plans/` (19 files) | **ACTIVE — the operational layer** | Kickoff-ready: 5 full PLANs + 13 BRIEFs + ordering/triggers in `plans/README.md` |
| `arc-CONSTITUTION-draft.md` | **ACTIVE · awaiting Ashiq's sign-off** | The DNA (3 eternal + 10 working articles). On adoption (Phase-04 retro, first `constitution.adopted` event) the file moves to repo root as `CONSTITUTION.md` |
| `arc-master-execution-plan.md` (v1.2) | **ACTIVE — strategy source** | Roadmap, money milestones, operating rhythm, kill criteria, 14-decision log, coverage map. `plans/` operationalizes its §6 trigger table |
| `arc-company-org-blueprint.md` | **ACTIVE — org lens** (2026-07-25) | The company org-chart view: ~50 roles → modules with EXISTS/PLANNED/MISSING/HUMAN status, the shape rule, flagship grades, standing retro-agenda items. Source of `BRIEF-legal-pack` + growth/leads/ledger v1.1 notes |
| `arc-full-architecture.md` | ACTIVE — reference | The target picture: 16 modules / kernel–workflows–ventures, model-agnostic engine, evolve contract, data layer. Briefs assume its definitions |
| `arc-hq-mockup.html` | **ACTIVE — design spec** | The dashboard's visual target; `plans/BRIEF-dashboard.md` cites it as the spec |
| `records/arc-architecture-v2.1-verdicts.md` | Record | Review round-1 adjudication (vocabulary, capability-lint law, policy capability-vector matrix — `BRIEF-policy` builds on it) |
| `records/arc-hq-blueprint.md` | Record | HQ concept: autonomy ladder, learning-as-calibration, moat analysis. Absorbed into Cycle-2 plan + policy/evolve/dashboard/chat briefs |
| `records/arc-money-engine-plan.md` | Record | Original idea scoring (pain-mining 9 · leads-service 8.5 · SaaS factory 8 · video 6/8 · trading 2) and monetization logic. Sequencing superseded by the master plan |
| ~~`arc-cycle2-receipt-spine-PLAN-v2.md`~~ | **MOVED → `docs/archive/`** | Superseded by `plans/PLAN-cycle2-receipt-spine-v2.1.md`; kept in archive for history — never feed the v2 to a kickoff |
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
4. **2026-07-25 reorg:** `records/` created (3 rationale docs moved in, relative links
   updated in org-blueprint + master plan + PLAN-v2.1); the superseded Cycle-2 v2 draft
   moved to `docs/archive/`. Frozen docs in `archive/`/`evidence/` may still cite the old
   root paths — this table is the authority.
5. **2026-07-26:** `plans/PLAN-design.md` added (arc-design "The Designer" — design
   capability module; decisions DES-A…H locked, ADR numbers at kickoff). Slotted 1.5 in
   the plans ordering: after Cycle-2 close, before/alongside Cycle-3 (it serves Cycle-3's
   UI phases).

## Provenance

Produced 2026-07-18 → 2026-07-26 in Cowork planning sessions (Ashiq + Claude), grounded
against the repo before AND after the orchestrator initiative closed. Nothing in this
folder changes code or gates by itself; implementation always goes through
`/arc-kickoff` → review → explicit approval.
