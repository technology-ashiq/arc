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

## File map & status (updated 2026-08-09 — PLAN-executor + PLAN-scheduler promoted under the owner's Build-out Mandate)

| File | Status | Role now |
|---|---|---|
| `plans/` (24 files) | **ACTIVE — the operational layer** | Kickoff-ready: 14 full PLANs + 9 BRIEFs + ordering/triggers in `plans/README.md` |
| `../../CONSTITUTION.md` | **LAW · adopted v1.0 on 2026-08-06** | The DNA (3 eternal + 10 working articles). At the repo root and in the core manifest, per its own Enforcement clause 1. Receipt: `01KZ9V0QXNNMB3ZH18MSH8DKH3`, pinning sha256 `233a6496…6ee6` — edit the file and that hash stops matching. Tier E is unamendable; a Tier-A amendment is a fresh `constitution.adopted` superseding this one |
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
| ~~`plans/BRIEF-absorb.md`~~ | **MOVED → `docs/archive/`** (2026-08-06) | Superseded by `plans/PLAN-absorb.md`; kept in archive for history — never feed the brief to a kickoff (the review rounds hardened the plan past the brief: the fourth load-bearing trigger arm + two-speed operating model, the sealed-blind owner-judge mechanics, the ABS-C allowlist candidate, the ≥2-cycles threshold assumption, and the stale-0400-century correction exist only in the plan) |
| ~~`plans/BRIEF-executor.md`~~ | **MOVED → `docs/archive/`** (2026-08-09) | Superseded by `plans/PLAN-executor.md`; kept in archive for history — never feed the brief to a kickoff (the review rounds hardened the plan well past the brief: the FIRED Build-out-Mandate trigger, the capability-gap verdict arm, the 12-fixture real-runtime Isolation Certification Suite, credential-capped budgets with calibration receipts, context-pack batch/angle/feedback semantics, `review_by:` tenure + the termination spec, the EXE-K freedom clause and the unlock ladder exist only in the plan) |
| ~~`plans/BRIEF-scheduler.md`~~ | **MOVED → `docs/archive/`** (2026-08-09) | Superseded by `plans/PLAN-scheduler.md`; kept in archive for history — never feed the brief to a kickoff (the review rounds hardened the plan well past the brief: the two-type job taxonomy, the ceiling lint, idem=job@slot, the zero-retry reconciliation with ADR-0203/0204, the deterministic jobs panel and the fire-drill REQ exist only in the plan; the brief's kickoff prompt is pre-portfolio/bare-token — the plan's is lane-native) |
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

14. **2026-08-06:** `plans/PLAN-absorb.md` added (absorb v1 — the technique refinery:
    read-only, injection-aware study of a named external source → deterministic
    extraction report [ABSORB technique / INTEGRATE infra / ROUTE model / SKIP
    data-moat] → arc-native rebuild from the ABS-C allowlist → A/B on ≥3 fixtures in
    the PLANOFF format → propose-only adopt/retire via the inbox + a ≤12-per-lane
    registry with displacement; decisions ABS-A..F locked over Cowork review rounds,
    ABS-G [century · code home · registry seed · first target] open at kickoff; ADR
    numbers at kickoff from the claimed century — the brief's "0400" note is stale,
    leads claimed the 0400s at birth). **The trigger gains a FOURTH arm — the
    two-speed model (owner-settled 2026-08-06): Speed 1 = install-and-use (manual
    owner installs under the existing DEV-B/C vet + `capability-lock.json` law —
    market velocity, zero build cost); Speed 2 = absorb the proven winners (technique
    portions rebuilt on the allowlist; service portions stay installed per the
    INTEGRATE verdict). Speed 1 is Speed 2's evidence supply: an installed capability
    with receipted use across ≥2 cycles — or named by a lane brief/retro — fires the
    trigger; the lock row + REQ-05's per-slice use receipts ARE the detection
    machinery. No radar, no scheduled scanning; ADR-0110 unchanged
    (`/arc-capability` installs nothing — install stays a manual owner action).**
    REQ-05 lands the PLAN-develop §7.1 team-leader addendum in absorb's own cycle
    (EVO-H0 client's-cycle precedent); ABS-D owner-judge receipt grammar is defined
    once here — bench inherits it at its own kickoff. Kickoff gates in-file: live
    slot free (A9) · venture-clock ruling (ADR-0071) resolved · receipted trigger
    evidence. `BRIEF-absorb.md` superseded → moved to `docs/archive/`.

15. **2026-08-09:** `plans/PLAN-executor.md` added (executor v1 — agent-runtime drivers,
    Hermes-Agent/OpenClaw-class, as ENG-D engine-lane drivers; v2.0 build-out edition,
    landed owner-instructed from a Cowork session). **Trigger converted to FIRED — the
    owner's Build-out Mandate (2026-08-09): arc is the sole priority, ventures
    deprioritized, no trigger-waiting; the mandate is recorded as `decision.recorded` in
    Phase 0 and cited by the kickoff ADRs (A8's letter kept). Honesty note: no friction
    receipt exists and none is invented — REQ-07 runs its capability-gap verdict arm
    (per-draft accept/reject receipts), not a fabricated performance baseline.** Core
    hardening beyond the brief: isolation **certified against the REAL runtime** (12
    fixtures incl. memory-plant + pinned-config egress audit; mock-green = regression,
    never certification — the Mode B lesson) · money enforced **at the credential**
    (capped key = POL-F's pre-approved provider budget) with wall-clock budgets
    calibrated from receipts, never guessed · the router delta adds `review_by:` tenure
    (2 weeks, owner-ruled; load-time enforced — expiry refuses dispatch and emits one
    idempotent rejustify-or-retire proposal) + a termination spec (key revoke = instant
    leash) · the hire itself flows `approval.requested` → `decision.recorded`, and the
    `hq.policy.yaml` row lands in the same change (POL-I birth-rule) · context packs
    (human-approved `external-ok`; batch 1-pack→N-dispatches; angle freedom;
    feedback-via-pack — the contractor learns from the briefing while its persistent
    memory stays OFF) · the **EXE-K freedom clause** (the ADR-0049 lesson made law for
    contractors: constrain boundaries, verify outcomes, never prescribe the runtime's
    internal method; review = accept/reject + reason, never line-edits) · the **unlock
    ladder** (probation → batch cadence → sampling at ≥10 accepted/0 incidents → POL-G
    L2 eligibility → scheduler-era unattended runs; every rung a receipted human
    decision, no time-decay). Decisions EXE-A…K named as letters; real ADR numbers at
    kickoff from the engine lane's century band. Six owner rulings recorded in-file
    (appetite FULL 1.5w · landing · `review_by:` 2w · messaging re-scope · trigger
    cultivation · rung-2 threshold; two superseded same-day by the mandate, marked as
    such). Cross-plan: the L1-drafts ceiling is POL-G seen from the driver side — now
    enforced in code (policy C9 merged 2026-08-08, PR #130) · executor's drafts,
    verdict receipts and scrubbed transcripts are the un-manufactured evidence base for
    growth, bench and absorb's future cycles. `BRIEF-executor.md` superseded → moved to
    `docs/archive/`.

16. **2026-08-09:** `plans/PLAN-scheduler.md` added (scheduler v1 — "the heartbeat":
    `hq.jobs.yaml` in git + one wrapper + the OS's own scheduler, arc stays daemon-free;
    v1.0, landed owner-instructed from a Cowork session; decisions SCH-A…L locked over
    four review rounds 2026-08-03 → 2026-08-09; ADR numbers at kickoff from the century
    claimed per `PORTFOLIO.md`). **Trigger converted to FIRED under the owner's Build-out
    Mandate (2026-08-09 — same receipt as correction #15, cited by the kickoff ADRs;
    honesty note in-file: no manual-start-pain receipt existed and none is invented — the
    proving week's actor-query metric starts the honest baseline). The policy-engine
    prerequisite is unchanged — and now MET (policy C9 merged `677b67e` / PR #130,
    2026-08-08): unattended registration still VERIFIES enforcement fixtures green at its
    Phase-2 gate, fail-closed, never assumed; attended phases carry POL-D shared-library
    authorization from Phase 0.** Core beyond the brief: two job types (script-jobs ₹0 ·
    process-jobs via `arc-run`, mock-proven until the first live one) · GH-Actions
    excluded for spine-receipted jobs (ADR-0025 instance spine) · ZERO scheduler-layer
    retries (ADR-0203/0204 own the ladder — the brief's "one retry" already lives inside
    `arc-run`) · monthly-ceiling static lint (worst-case month priced at commit time,
    `jobs-lint --bill`) · idem = job@slot (double-fires collapse via the existing
    dup-idem quarantine, surfaced per ADR-0032) · missed-run detection as a DETERMINISTIC
    reader derivation in the brief (needs-you on >2× cadence; wall-clock banned to
    preserve replay goldens; disabled ≠ overdue) · staircase phases (attended heartbeat
    P0–P1 first, cron registration P2, proving week P3 with a fire-drill that removes an
    OS task while the yaml still promises it) · per-job `withLock` reuse ·
    self-modification / spend-kind / credential bans in jobs-lint. v1 jobs:
    brief-materialize · day-close-roll (seals D−1 at 00:15, `catchup: run`) ·
    lexos-canary candidate. `BRIEF-scheduler.md` superseded → moved to `docs/archive/`.

## Provenance

Produced 2026-07-18 → 2026-07-26 in Cowork planning sessions (Ashiq + Claude), grounded
against the repo before AND after the orchestrator initiative closed. Nothing in this
folder changes code or gates by itself; implementation always goes through
`/arc-kickoff` → review → explicit approval.
