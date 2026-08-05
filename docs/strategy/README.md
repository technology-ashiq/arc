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

## File map & status (updated 2026-08-04 — PLAN-policy promoted; earlier same day: absorb + executor briefs)

| File | Status | Role now |
|---|---|---|
| `plans/` (24 files) | **ACTIVE — the operational layer** | Kickoff-ready: 11 full PLANs + 12 BRIEFs + ordering/triggers in `plans/README.md` |
| `../../CONSTITUTION.md` | **ACTIVE · awaiting Ashiq's sign-off** | The DNA (3 eternal + 10 working articles). Now at repo root and in the core manifest, per its own Enforcement clause 1 — the move happened BEFORE adoption on purpose, because the path is pinned inside the `constitution.adopted` receipt and cannot be corrected afterwards. Adoption is now only the version bump + status line + the event |
| `arc-master-execution-plan.md` (v1.2) | **ACTIVE — strategy source** | Roadmap, money milestones, operating rhythm, kill criteria, 14-decision log, coverage map. `plans/` operationalizes its §6 trigger table |
| `arc-company-org-blueprint.md` | **ACTIVE — org lens** (2026-07-25) | The company org-chart view: ~50 roles → modules with EXISTS/PLANNED/MISSING/HUMAN status, the shape rule, flagship grades, standing retro-agenda items. Source of `BRIEF-legal-pack` + growth/leads/ledger v1.1 notes |
| `arc-full-architecture.md` | ACTIVE — reference | The target picture: 16 modules / kernel–workflows–ventures, model-agnostic engine, evolve contract, data layer. Briefs assume its definitions |
| `arc-hq-mockup.html` | **ACTIVE — design spec** | The dashboard's visual target; `plans/BRIEF-dashboard.md` cites it as the spec |
| `records/arc-architecture-v2.1-verdicts.md` | Record | Review round-1 adjudication (vocabulary, capability-lint law, policy capability-vector matrix — `plans/PLAN-policy.md` builds on it) |
| `records/arc-hq-blueprint.md` | Record | HQ concept: autonomy ladder, learning-as-calibration, moat analysis. Absorbed into Cycle-2 plan + policy/evolve/dashboard/chat briefs |
| `records/arc-money-engine-plan.md` | Record | Original idea scoring (pain-mining 9 · leads-service 8.5 · SaaS factory 8 · video 6/8 · trading 2) and monetization logic. Sequencing superseded by the master plan |
| ~~`arc-cycle2-receipt-spine-PLAN-v2.md`~~ | **MOVED → `docs/archive/`** | Superseded by `plans/PLAN-cycle2-receipt-spine-v2.1.md`; kept in archive for history — never feed the v2 to a kickoff |
| ~~`plans/BRIEF-evolve.md`~~ | **MOVED → `docs/archive/`** (2026-08-02) | Superseded by `plans/PLAN-evolve.md`; kept in archive for history — never feed the brief to a kickoff (its auto-revert rule was owner-overturned; the plan is the design source) |
| ~~`plans/BRIEF-leads.md`~~ | **MOVED → `docs/archive/`** (2026-08-03) | Superseded by `plans/PLAN-leads.md`; kept in archive for history — never feed the brief to a kickoff (three review rounds hardened the plan well past the brief: PII/store/HMAC/journal rules exist only in the plan) |
| ~~`plans/BRIEF-policy.md`~~ | **MOVED → `docs/archive/`** (2026-08-04) | Superseded by `plans/PLAN-policy.md`; kept in archive for history — never feed the brief to a kickoff (three review rounds hardened the plan well past the brief: the two-key authority state machine, spend-under-E2 definition, typed event profiles and the hook feasibility gate exist only in the plan) |
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
6. **2026-07-28:** `plans/PLAN-develop.md` added (arc-develop "The Developer" — the
   execution harness owning the build loop between plan approval and `/arc-phase-done`;
   decisions DEV-A…K locked over 4 review rounds, ADR numbers at kickoff; post-v1 growth
   gated by its Feature Admission Rule). Slotted 1.6 in the plans ordering: after
   Cycle-2 close, alongside arc-design; serves every subsequent build incl. Cycle 3.
7. **2026-07-29:** `plans/PLAN-portfolio.md` added (arc-portfolio "The Conductor" —
   multi-lane workspaces: `initiatives/<product>/` work diaries per product + root
   `PORTFOLIO.md` board + a lane resolver for the existing commands, so multiple products
   plan/build in parallel with zero philosophy change; root-mode stays the permanent
   consumer contract; decisions PORT-A…J locked over 6 review rounds, ADR numbers at
   kickoff). Slotted **1.55**: after the arc-design cycle closes, BEFORE the develop
   kickoff — develop is then born as the first native lane. After its migration phase,
   the "one live plan = root PLAN.md" rule in older docs reads as "one live plan PER
   LANE; `PORTFOLIO.md` is the what's-live index" (docs flip in its Phase 3).
8. **2026-08-02:** `plans/PLAN-model-policy.md` added (Balanced Model Policy — pre-engine
   model discipline; decisions MP-A…F locked over one external review round, 5 amendments
   merged — freeze log in the file header; ADR numbers at kickoff). Slotted **1.57**:
   after the arc-portfolio cycle (C4) closes, before the develop kickoff. It is the
   policy layer `plans/PLAN-engine-process-layer.md` and `plans/BRIEF-bench.md` later
   inherit — both keep their own pull-triggers, unchanged.
9. **2026-08-02 (post-C4):** `plans/PLAN-develop.md` lane-amended in place — kickoff
   prompt is now lane-native (`/arc-kickoff --lane develop`, the first native lane per
   the plans queue), a lanes.md surface-contract block added, tracker artifacts marked
   lane-relative, debt ledger lane-scoped, learning ledger + eval fixtures pinned as
   root company organs (ADR-0053/0055). Decision record DEV-A…K unchanged.
10. **2026-08-02:** `plans/PLAN-evolve.md` added (evolve v1 — the self-improvement
    engine: `metric.observed` scoreboards from the spine, bounded champion/challenger
    experiments, ONE pinned fixed-horizon verdict test [newcombe-wilson-difference-v1,
    config-hashed α + effect_floor], SHA-bound promotion lineage end-to-end, and
    **propose-only in BOTH directions — the old brief's auto-revert was owner-overturned;
    every merge incl. rollback is human-only**; decisions EVO-A…H1 locked over 4
    owner-review rounds, ADR numbers at kickoff). Keeps its pull slot (trigger: 4+ weeks
    of real `metric.observed` receipts). **Cross-plan obligation: EVO-H0 (the
    `metric.observed` vocabulary ADR + validator + ingestion) lands in the FIRST
    CLIENT's cycle — growth's future plan inherits it; without EVO-H0 the trigger is
    technically impossible (closed KINDS, ADR-0026).** `BRIEF-evolve.md` superseded →
    moved to `docs/archive/`.
11. **2026-08-03:** `plans/PLAN-leads.md` added (leads v1 — the outbound engine:
    ICP → 25 evidence-dossiered leads, personalization lint with a BELOW-BAR class +
    cross-draft similarity guard, hard caps + suppression ledger enforced in code with
    send-moment re-checks, crash-safe two-phase send journal with SPINE-FIRST recovery,
    provider idempotency keys, L1 inbox approval SHA-bound to the exact draft, one real
    campaign ≥25 sends/≥3 days; decisions LEA-A…M locked over 3 same-day owner-review
    rounds — 27 rulings recorded in the file; ADR numbers at kickoff from the lane's
    century band). Keeps its pull slot (trigger: a real, named offer needs outbound —
    NOT fired at freeze; LexOS is pre-billing). **Hard rules that override any older
    outbound text: lead PII never enters the repo (private store outside the tree +
    keyed `lead_hmac_v1` ids — the repo goes public later) · every send human-approved
    until the trial ledger earns more · no background scheduler (sequence advancement
    is a human-started daily command; the scheduler module stays policy-engine-gated).
    Cross-plan note on correction #10: EVO-H0 is pinned to the FIRST client's cycle —
    if leads kicks off before growth, PLAN-leads' LEA-I ruling may take that obligation
    (deviation to be recorded at that kickoff).** `BRIEF-leads.md` superseded → moved
    to `docs/archive/`.
12. **2026-08-04:** `plans/BRIEF-absorb.md` + `plans/BRIEF-executor.md` added (drafted
    in a Cowork session, owner-approved; both **sleeping on pull-triggers**). **absorb**
    = the technique refinery: study external agents/tools **read-only** → extraction
    report (ABSORB technique / INTEGRATE infra / ROUTE model / SKIP data-moat matrix) →
    arc-native rebuild from an allowlist → A/B in the `evidence/planner-bench/` PLANOFF
    format → propose-only adopt/retire + a ≤12-entries-per-lane toolbox registry. NEW
    lane; claims the next free ADR century per `PORTFOLIO.md`; its cycle also lands the
    PLAN-develop §7.1 team-leader addendum (its REQ-5 — EVO-H0 "client's cycle"
    precedent) and the owner-judge receipt grammar (ABS-D) that bench later inherits.
    **executor** = agent-runtime drivers (Hermes-Agent/OpenClaw-class) as ENG-D
    engine-lane drivers — L1-drafts action cap, own-credentials isolation with the
    exit-5 data boundary, `run.completed` fingerprints, and the `engine/router.yaml`
    delta (`cap:`/`judge:`/`hosted:` fields on runtime rows) as its REQ-4 in ONE
    reviewed diff; kickoff's **first act** = a one-paragraph ADR-0069 amendment (the
    router header's own rule for routing questions the policy doesn't yet answer).
    Decisions ABS-A…F / EXE-A…E named as letters; real ADR numbers at kickoff from the
    owning lane's century band. Recommended order: absorb first — its A/B evidence is
    the receipt that fires executor's trigger.
13. **2026-08-04:** `plans/PLAN-policy.md` added (policy engine — enforced capability
    vectors: per action-kind vectors [8 capabilities × L0–L3] under a **two-key
    authority model** — YAML ceiling + event-earned cap folded from the spine by one
    fixture-pinned reducer; L1 birth however high the ceiling; demotion bites from the
    EFFECTIVE level (cap-above-ceiling can never absorb it); promotion human-only via
    `approval.requested` [strict `policy.promotion` profile] → `decision.recorded` →
    `policy.level.changed`, no auto-recovery; deny-by-default, fail-closed at the only
    entry points — `arc-run` wrapper + PreToolUse hooks, with a P0 hook-interception
    feasibility matrix where an unprovable tool class = static deny or L0/L1; `spend` =
    pre-approved provider budgets only, reserve→settle/release under the spine lock,
    Mode A only, E2 money never above L1; vocabulary +4 kinds stated against live
    `KINDS.length` [31 at draft — ADR-0107 derived-count rule]; decisions POL-A…J
    locked over 3 owner-review rounds, POL-K [lane/century/code home] left open by
    design for kickoff). Keeps its pull slot; **trigger reworded**: ≥3 kinds at ≥L2 OR
    the first scheduler/headless job **APPROVED** — the brief's "scheduler lands" arm
    was unreachable (scheduler hard-prereqs policy). **Hard kickoff gate inside: the
    Constitution must be ADOPTED first** — `constitution.adopted` is not in today's
    vocabulary, so adoption = micro vocab ADR + sign-off + event. Cross-plan: the
    scheduler stays policy-gated (unchanged) · executor's "L1-drafts cap until the
    policy engine wakes" is POL-G's driver-eligibility contract from the other side ·
    `arc-full-architecture.md`'s "policy L0–L4" is superseded by L0–L3 (recorded in the
    kickoff ADR). `BRIEF-policy.md` superseded → moved to `docs/archive/`.

## Provenance

Produced 2026-07-18 → 2026-07-26 in Cowork planning sessions (Ashiq + Claude), grounded
against the repo before AND after the orchestrator initiative closed. Nothing in this
folder changes code or gates by itself; implementation always goes through
`/arc-kickoff` → review → explicit approval.
