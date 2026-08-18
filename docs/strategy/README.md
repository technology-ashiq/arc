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

## File map & status (updated 2026-08-18 — PLAN-face promoted from BRIEF-dashboard under the owner's Build-out Mandate; 2026-08-12 — PLAN-bench promoted from its brief; 2026-08-10 wave: PLAN-executor + PLAN-scheduler + PLAN-ledger + PLAN-growth + PLAN-memory + PLAN-legal-pack + PLAN-ops + PLAN-trader promoted under the owner's Build-out Mandate)

| File | Status | Role now |
|---|---|---|
| `plans/` (24 files) | **ACTIVE — the operational layer** | Kickoff-ready: 22 full PLANs + 1 BRIEF (chat-mcp) + ordering/triggers in `plans/README.md` |
| `../../CONSTITUTION.md` | **LAW · adopted v1.0 on 2026-08-06** | The DNA (3 eternal + 10 working articles). At the repo root and in the core manifest, per its own Enforcement clause 1. Receipt: `01KZ9V0QXNNMB3ZH18MSH8DKH3`, pinning sha256 `233a6496…6ee6` — edit the file and that hash stops matching. Tier E is unamendable; a Tier-A amendment is a fresh `constitution.adopted` superseding this one |
| `arc-master-execution-plan.md` (v1.2) | **ACTIVE — strategy source** | Roadmap, money milestones, operating rhythm, kill criteria, 14-decision log, coverage map. `plans/` operationalizes its §6 trigger table |
| `arc-company-org-blueprint.md` | **ACTIVE — org lens** (2026-07-25) | The company org-chart view: ~50 roles → modules with EXISTS/PLANNED/MISSING/HUMAN status, the shape rule, flagship grades, standing retro-agenda items. Source of `BRIEF-legal-pack` + growth/leads/ledger v1.1 notes |
| `arc-full-architecture.md` | ACTIVE — reference | The target picture: 16 modules / kernel–workflows–ventures, model-agnostic engine, evolve contract, data layer. Briefs assume its definitions |
| `arc-hq-mockup.html` | Reference — concept list only (status changed 2026-08-18) | Panels/ideology the 2026-07 HQ concept listed (feed · pipeline · portfolio kill-distance · inbox · autonomy ladder · learning); **superseded as the design spec by `plans/PLAN-face.md`** — the visual answer comes from the design lane's three-thesis blind exploration (FACE-I), never from this mock. Kept in place because the master plan and archived briefs link it |
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
| ~~`plans/BRIEF-ledger.md`~~ | **MOVED → `docs/archive/`** (2026-08-09) | Superseded by `plans/PLAN-ledger.md`; kept in archive for history — never feed the brief to a kickoff (the review rounds hardened the plan well past the brief: the PII-free payload contract with validator-first ordering, gross/fees/tax/net money semantics, FX-at-ingest replay determinism, the blocking both-direction reconciliation gate, natural-key duplicate detection, goalpost receipts on `ventures.yaml`, the measured/declared/allocated cost trichotomy and the `month.closed` micro vocab ADR exist only in the plan; the brief's kickoff prompt is pre-lane — the plan's is lane-native) |
| ~~`plans/BRIEF-growth.md`~~ | **MOVED → `docs/archive/`** (2026-08-09) | Superseded by `plans/PLAN-growth.md`; kept in archive for history — never feed the brief to a kickoff (the review rounds hardened the plan well past the brief: the FIRED Build-out-Mandate trigger with the arc-site-first client, the two-human-gate cap, the negative-only lint constitution, the POV floor + exemplar anchoring, the sha-equality "unedited" definition, the versioned title-template files with hash(slug) assignment, the EVO-H0 FEED requirement against the already-landed ADR-0408 vocabulary, and the flipped cut order exist only in the plan; the brief's kickoff prompt is pre-lane — the plan's is lane-native) |
| ~~`plans/BRIEF-memory.md`~~ | **MOVED → `docs/archive/`** (2026-08-09) | Superseded by `plans/PLAN-memory.md`; kept in archive for history — never feed the brief to a kickoff (the review rounds hardened the plan well past the brief: index-in-place replaced the brief's migration reading, the additive-hook law, the node:sqlite preflight with a pure-JS fallback decision, canonical citation ids, the alias layer, the measured embeddings floor and the write-time conflict check exist only in the plan; the brief's kickoff prompt is pre-lane — the plan's is lane-native) |
| ~~`plans/BRIEF-legal-pack.md`~~ | **MOVED → `docs/archive/`** (2026-08-10) | Superseded by `plans/PLAN-legal-pack.md`; kept in archive for history — never feed the brief to a kickoff (the review rounds hardened the plan well past the brief: six pages not three [the Razorpay activation superset], the `payment_model: gateway\|mor` + GST branches correcting the brief's MoR-only premise, the DPDP Rule-3 notice + fiduciary/processor two-layer clause, the value/trace/completeness lint trio, the hash-chain publish law with static-MDX routes, the production-probe checklist and the scenario-fixture completeness law exist only in the plan; the brief's kickoff prompt is pre-lane — the plan's is lane-native) |
| ~~`plans/BRIEF-ops.md`~~ | **MOVED → `docs/archive/`** (2026-08-10) | Superseded by `plans/PLAN-ops.md`; kept in archive for history — never feed the brief to a kickoff (the review rounds hardened the plan well past the brief: the FIRED Build-out-Mandate trigger with the OPEN live-value REQ-05 row, the OPS-G fold-derived idem formula, the flood-control meta-incident, drill mode with real-vs-drill separation, the heartbeat + deterministic staleness line, the leads private-store PII law for tickets, injection containment with template-locked drafts, policy-enforced L1 (POL-G) + POL-I rows, canary→spine unification resolving the brief's reader-only-vs-canary-history contradiction, the ADR-0408 `metric.observed` conformance with the no-evolve-clock honesty boundary, and the scheduler-job alignment exist only in the plan; the brief's kickoff prompt is pre-lane — the plan's is lane-native) |
| ~~`plans/BRIEF-trader.md`~~ | **MOVED → `docs/archive/`** (2026-08-10) | Superseded by `plans/PLAN-trader.md`; kept in archive for history — never feed the brief to a kickoff (the review rounds hardened the plan well past the brief: the two-zone playground/verdict-lab law, the pre-registration + attempt-family + null-monkey + regime honesty battery with the no-WIN verdict vocabulary, the spine-receipt 72h cooldown replacing wall-clock, the ANTI-CASE cooling protocol, the fifth lock condition [compliance review], the no-broker-creds credential inventory, the divergence-as-north-metric paper run and the graceful-degradation slotting exist only in the plan; the brief's kickoff prompt is pre-lane — the plan's is lane-native) |
| ~~`plans/BRIEF-bench.md`~~ | **MOVED → `docs/archive/`** (2026-08-12) | Superseded by `plans/PLAN-bench.md`; kept in archive for history — never feed the brief to a kickoff (two review rounds hardened the plan well past the brief: replay-determinism + the provenance tuple replaced the impossible same-config-same-scores claim, gates-first selection with the NO-PROPOSAL null result [a 70/20/10 composite rejected on the record], K-group admission-controlled budgets, the partial-run proposal bar, split quality/cost comparability with classified cost deltas, enumerated baseline re-pin causes, per-task-class MIN_FIXTURES, the zero-new-kinds spine mapping, the driver-explicit CLI and the REQ-05 preflight exist only in the plan; the brief's kickoff prompt is pre-lane — the plan's is lane-native) |
| ~~`plans/BRIEF-dashboard.md`~~ | **MOVED → `docs/archive/`** (2026-08-18) | Superseded by `plans/PLAN-face.md`; kept in archive for history — never feed the brief to a kickoff (the plan hardened well past the brief: the mandate-converted trigger with the REQ-10 live-value milestone, the three-layer contract [zero-dep L2 read door + decision door · L3 face in its own repo], the stamp/chip/seal affordance law with stamps only on `approval.requested`, the MAP and TAPE signatures, the 32-room coverage contract with the room birth-rule + `face-coverage` lint, the honesty classes, the governed engine-process brain, and the design-lane blind exploration exist only in the plan; the brief's kickoff prompt is pre-lane — the plan's is lane-native) |
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

17. **2026-08-09:** `plans/PLAN-ledger.md` added (ledger v1 — "the money brain":
    per-venture P&L truth derived reader-only from spine receipts; v1.0, landed
    owner-approved from a Cowork session; decisions LED-A…K locked over four review
    rounds 2026-08-03 → 2026-08-09; ADR numbers at kickoff from the century claimed per
    `PORTFOLIO.md` — NEW lane). **Trigger converted to FIRED under the owner's Build-out
    Mandate (2026-08-09 — same receipt as correction #15, cited by the kickoff ADRs;
    honesty note in-file: the live spine's money side is zero events and none are
    invented — real views render honest-empty until the first real ₹, fixtures +
    `revenue.simulated` carry the proof, and the old pull-trigger "≥2 revenue sources"
    survives only as the live-value milestone; closure = C2 REQ-07 pattern, mechanism
    proven / live value pending).** Core beyond the brief: **PII-free revenue payloads**
    (LED-C — the PLAN-leads PII law applied to money: what the immutable spine never
    receives it never has to erase; validator ships BEFORE the first real ingest,
    ordering-critical) · money semantics gross/fees/tax/net with GST kept out of MRR
    (LED-C/H) · FX-at-ingest — conversion facts are receipts, replay is
    offline-deterministic (LED-D) · **reconciliation as a BLOCKING both-direction
    month-close gate** (missed AND duplicate suspects; LED-F), with `month.closed`
    added by micro vocab ADR against live `KINDS.length` (LED-E, ADR-0107 rule), IST
    boundaries, and post-close corrections booking into the recording month — a frozen
    month never restates · cost trichotomy measured/declared/allocated never mixed —
    subscription AI plans are declared fixed costs (per-run apportionment of a flat fee
    is fake precision), `venture: arc` = Overhead, unattributed (LED-G — C2's cut
    REQ-08 revived, org-blueprint role #49) · natural-key duplicate detection in the
    derived layer (LED-K — C2's content-idem contract untouched) · `ventures.yaml` as
    a root organ whose edits require a `decision.recorded` — goalposts move only on
    the record (LED-I) · `arc pnl` CLI-first, the brief's `/arc-pnl` retired (LED-J) ·
    `hq.policy.yaml` rows for the close/ingest action kinds land in the same change
    (POL-I; policy C9 merged 2026-08-08). Cross-plan: the per-venture "₹ returned per
    AI-₹" ratio is a future `metric.observed` candidate named when EVO-H0's vocabulary
    lands (correction #10) — nothing ships here. `BRIEF-ledger.md` superseded → moved
    to `docs/archive/`.

18. **2026-08-09:** `plans/PLAN-growth.md` added (growth v1 — the content engine +
    evolve's first feed: evidence-mined keywords → a human-approved topical cluster
    (1 pillar + ≥5 spokes + 2–3 BOFU pages) → exemplar-anchored articles with an
    original-POV floor → git-PR publishing where the machine never merges (A6) →
    `content.published` receipts carrying title-template tags → a weekly GSC ingest as
    `metric.observed`; v1.0, landed owner-approved 2026-08-09; decisions GRO-A…L locked
    over 3 review rounds 2026-08-03 → 2026-08-09; ADR numbers at kickoff from the
    century claimed per `PORTFOLIO.md` — NEW lane). **Trigger converted to FIRED under
    the owner's Build-out Mandate (2026-08-09 — same receipt as correction #15, cited
    by the kickoff ADRs; honesty note in-file: no live-venture "needs traffic" receipt
    exists and none is invented — the arc public site is the first client, built via
    the pre-kickoff gate; the brief's venture trigger survives as Appendix A per-site
    activation, where the BCI Rule-36 guardrail arms for legal-ICP content).** Core
    beyond the brief: **REQ-05 = the EVO-H0 FEED** — correction #10's cross-plan
    obligation now lands in two halves: the `metric.observed` vocabulary + validator
    became law in LEADS' cycle (ADR-0408, the LEA-I contingency of correction #11);
    growth VERIFIES that validator against PLAN-evolve REQ-00's frozen spec (deviations
    flagged back, never absorbed) and ships the feed itself — `arc growth ingest`
    (manual weekly GSC CSV), slug↔URL join from `content.published`, ISO weeks with the
    ≥3-day GSC-lag rule, window COMPLETE only on strict idempotent emission (MISSING
    never zero), corrections via `supersedes` — **whose 4 complete consecutive weeks
    are the trigger that wakes the already-built evolve module (C7, fixture-proven,
    unexercised)** · exactly TWO human gates (GRO-J — keyword/cluster approval +
    ≤5-min per-article review packs bundling preview-deploy URL + lint + citation
    reports; a third human gate requires an ADR) · lint constitution NEGATIVE-ONLY
    (GRO-G — slop/citation lints catch bad patterns, never prescribe style; adversarial
    pass before any FAIL promotion) · POV floor + exemplar anchoring (compliance-shaped
    slop is still slop — every article carries ≥1 original practitioner insight,
    human-checked) · title A/B as two VERSIONED template files with deterministic
    `hash(slug)` assignment and payload-level tags (evolve seals `base_sha` later; no
    optimization logic in growth) · **unedited := approved draft_sha == published
    content_sha**, L2 evidence = 20 such approvals (GRO-E) · GEO baked into the
    template (Article+FAQPage JSON-LD, `llms.txt`, author entity, disclaimer, sitemap +
    IndexNow) · cut order FLIPPED vs the brief (lifecycle = cut #1, subscriber base ≈
    0; video = cut #2; a state-picked stretch slot at P4 close) · REQ-00 vocab ADR =
    `content.published` (+`email.sent` only if the lifecycle slot opens) with
    `hq.policy.yaml` rows for the new action kinds in the same change (POL-I; policy
    C9 merged 2026-08-08). `BRIEF-growth.md` superseded → moved to `docs/archive/`.

19. **2026-08-09:** `plans/PLAN-memory.md` added (memory v1 — playbooks + recall: the
    company's long-term memory as an INDEX over the organs that already exist; v1.1,
    landed owner-approved from a Cowork session; decisions MEM-A…K locked over two
    review rounds 2026-08-03 → 2026-08-09, MEM-L [century · thresholds · K/token
    budget · process-file names · golden-floor values] open at kickoff; ADR numbers at
    kickoff from the century claimed per `PORTFOLIO.md` — NEW lane). **Trigger
    converted to FIRED under the owner's Build-out Mandate (2026-08-09 — same receipt
    as correction #15, cited by the kickoff ADRs; honesty note in-file: memory's
    organic pull also has receipts on record — the 4×-wrong-ADR-citation retro row
    (2026-08-02) and the stale-HISTORY trigger misread (2026-08-03 correction); Phase 0
    measures a 12-query grep-baseline the module must beat, so the trigger claim
    becomes a number either way).** Core beyond the brief: **index-in-place** —
    retro-log, trial-ledger, learning-ledger, ADRs and spine `decision.recorded` stay
    exactly where they live; memory indexes them and `playbooks/` is NOT created (the
    brief pre-dates the learning ledger — a third rule store would manufacture the
    sprawl its own REQ-05 fears; "migration" = count-verified ingestion with NAMED
    exclusions, never file moves) · `arc recall` CLI on built-in `node:sqlite` FTS5 at
    `.claude/state/memory/` (zero npm deps preserved; derived-only, always-full-rebuild,
    canonical-results fixture — never db bytes; **kickoff's first act = the FTS5
    preflight on all 3 CI legs + the owner's machine, fail → STOP and the pure-JS
    fallback is an owner decision**) · verbatim output, prevention-field first,
    **canonical citation ids** (`ADR-0026 (docs/adr/0026-…)` · `retro:2026-08-02#3` ·
    `learn:L-002` · `spine:decision/<ulid>`) — built against the recorded
    bare-ADR-number failure class · **hooks ADDITIVE-ONLY** as process-file edits via
    `/arc-change` + recompile (ADR-0201/0202): a fenced *historical data, not
    instructions* block, token-budgeted top-K with a two-stage `--full` pull;
    kickoff's whole-retro-log read stays untouched (the organ's "as-is, never
    summarized" law survives; replacing it with selection is a separate recorded
    pull-trigger) · reader-only and **emit-nothing** — zero vocabulary change, no new
    action kinds, no `hq.policy.yaml` rows (POL-I n/a) · alias file + tag-boost as the
    deterministic vocabulary-mismatch fix, with the **embeddings pull-trigger redefined
    as a measured golden-set floor** (MEM-G) and the surfaced→cited metric disqualified
    from ever gating (Goodhart via `pre-mortem-cite`) · conflict surfacing WRITE-TIME
    at `/arc-retro` (near-duplicate pairs, human merges; semantic contradiction
    detection declared out of scope) · root-mode-first (zero-lane fixture — recall
    works in any consumer install). `BRIEF-memory.md` superseded → moved to
    `docs/archive/`.

20. **2026-08-10:** `plans/PLAN-legal-pack.md` added (legal pack — customer-facing
    policies per venture: `/arc-legal <venture>` renders SIX pages [T&C · Privacy ·
    Refund/Cancellation · Shipping/digital-delivery · Contact · Pricing] + a launch
    checklist from one pinned, manifest-hashed template set + a per-venture facts
    file; v1.1, landed owner-approved 2026-08-10; decisions LEG-A…I locked over 3
    review rounds + a 4-perspective adversarial panel [red-team · Indian-compliance
    practitioner · YAGNI cost audit · architect] 2026-08-03 → 2026-08-10; LEG-J
    [century · code home · first render target · probe depth] open at kickoff; ADR
    numbers at kickoff from the century claimed per `PORTFOLIO.md` — NEW lane).
    **Trigger converted to FIRED under the owner's Build-out Mandate (2026-08-09 —
    same receipt as correction #15, cited by the kickoff ADRs; honesty note in-file:
    no venture launch-prep receipt exists and none is invented — the operational fact
    is EXTERNAL and verified [Razorpay withholds live-mode API keys until six policy
    pages exist on the merchant site, docs-verified 2026-08-03], so the machinery is
    built now and the original pull survives as the live-value milestone: REQ-08's
    live-deploy + production-probe rows stay OPEN-at-venture-resume, the C2 REQ-07
    closure pattern).** Core beyond the brief: **the brief's MoR-only premise is
    CORRECTED on the record** — `payment_model: gateway|mor` is a required enum
    selecting whole clause branches (gateway = operator-as-merchant + GST-posture
    wording; a MoR clause surviving a gateway render = lint FAIL) with a
    `gst_registered` branch beside it · **six pages, not three** (the Razorpay
    activation superset) · DPDP-shaped privacy: Rule-3 notice contents + unified
    grievance block (DPDP ≤90d / e-commerce 48h-ack/1-month / IT-rules windows,
    strictest printed) + s.5(3) language-request line + the fiduciary/processor
    two-layer clause ("your clients' data": on-instruction processing, no-AI-training,
    sub-processors, export+deletion — the highest-stakes clause for a legal-data
    venture, absent from the brief's pre-mortem) · three lints value/trace/completeness
    (facts VALUES are hostile input — typed tiers, HTML-escape, compliance-claim
    denylist on rendered output; provenance alone cannot pass an empty page; a pinned
    ≥8-scenario set [refund-day-N±1, GST-invoice request, deletion request…] each maps
    to its answering clause ID) — all WARN-first with adversarial passes before any
    FAIL promotion · **hash-chain publish law**: `decision.recorded` binds
    (facts_sha, output_shas, template_set_sha), publish refuses mismatch (TOCTOU),
    effective_date ≥ decision time + monotonic per page, `--verify` drift command +
    venture-side CI hash guard, policy routes = static checked-in MDX only · template
    set governed as an asset (edits approval-gated, per-venture `pins.yaml`,
    `--bump-templates` re-approval; original drafting only, no copied policies) ·
    human gate L1 PERMANENT, zero new event kinds (`legal.publish` payload profile,
    POL-E/ABS-D precedent; `legal.updated` promotion trigger named) · lawyer-review
    triple tripwire (₹25k MRR via ledger when live OR ~Q1-2027 calendar before DPDP
    full enforcement 2027-05 OR a design-partner advocate review). Render targets:
    LexOS real facts in P3 (venture stays paused — pages+receipts commit to its tree,
    live deploy at venture-resume) + the arc public site when `PLAN-growth.md` builds
    it. Appetite 5d hard cap (4d + 1d slack; the 08-03 cost audit priced template
    AUTHORING at 1.5–2d — research banked in-file). `BRIEF-legal-pack.md` superseded
    → moved to `docs/archive/`.

21. **2026-08-10:** `plans/PLAN-ops.md` added (ops v1 — the keep-it-running engine:
    registry-driven health sweeps over every registered surface with incidents as
    first-class receipts [raise → optional-ack → resolve, cross-day open-incident fold
    in the daily brief], L1 support triage with drafted-never-sent replies, and a
    weekly per-venture health report rendered from the spine reader alone; v1.1
    build-out edition, landed owner-instructed 2026-08-10; decisions OPS-A…M locked
    over two review rounds 2026-08-03 → 2026-08-10, re-grounded against the repo at
    landing; ADR numbers at kickoff from the century claimed per `PORTFOLIO.md` — NEW
    lane). **Trigger converted to FIRED under the owner's Build-out Mandate
    (2026-08-09 — same receipt as correction #15, cited by the kickoff ADRs; honesty
    note in-file: no ≥2-live-ventures / support-volume receipt exists and none is
    invented — one venture [lexos, paused, deployed URL still serving], tickets ~0;
    the original pull survives as the live-value milestone: REQ-05's "≥2 LIVE
    ventures" row stays OPEN-at-venture-2, the C2 REQ-07 pattern, with drill mode
    carrying the proof).** Core beyond the brief: **the OPS-G idem formula** —
    `sha256("ops.incident|venture|check|signature|first_seen_day")` with
    `first_seen_day` fold-derived so an open failure streak never duplicates and a
    post-resolve recurrence is always a NEW incident (the C2 dup-idem class, closed in
    both directions by fixture) · flood control (>N failures in one run → ONE
    "sweep environment suspect" meta-incident, never N raises) · sweep LLM-free +
    browser-free with retry-before-raise — always-on cost ₹0, LLM only on inbound
    tickets (cheap-scan classify / workhorse drafts, ADR-0069) · **+2 incident kinds
    (`incident.acknowledged`/`incident.resolved`) by micro vocab ADR against live
    `KINDS.length`** (ADR-0107 rule; shapes in `validate-ops.mjs`, the lane-module
    pattern) with `hq.policy.yaml` rows in the same change (POL-I; policy C9 merged
    2026-08-08) and resolve-idem bound to the raise ULID (assertDecision template) ·
    canary→spine unification (A5) resolving the brief's reader-only-vs-canary-history
    contradiction · **ticket PII under the PLAN-leads private-store law — third
    application** (leads → ledger LED-C → ops): bodies + drafts outside the tree,
    spine carries keyed ids + classes + hashes only · injection containment (closed
    enums with `other` + surfaced unclassified-rate, zero tool access, template-locked
    drafts with provenance, money-action deny-list; .eml parser + classifier I/O =
    parser-class, adversarial pass mandatory) · drafts L1 **policy-enforced** (POL-G),
    promotion only via trial-ledger evidence + human decision · drill mode (real vs
    drill never mixed — the `revenue.simulated` discipline applied to incidents; an
    ignored drill is a human-loop finding) · heartbeat + deterministic "guardian
    asleep" staleness (quiet and asleep never render the same) · severity tiers +
    printed alert budget + precision ledger (alert quality is a REQ, not a hope) ·
    uptime as `metric.observed` **conforming to the live ADR-0408 validator with an
    explicit no-evolve-clock honesty boundary** (growth's GSC feed owns that trigger;
    ops is a second honest stream) · no pushes/pages — the daily brief IS the pager ·
    sweep shaped as a script-class ₹0 `hq.jobs.yaml` job with the `lexos-canary`
    job-candidate reconciliation rule (whichever of ops/scheduler runs second merges
    them into one registration). Appetite 6 build-days + a 7-calendar-day validation
    window; designated cuts = the metric stream, then the sentiment axis.
    `BRIEF-ops.md` superseded → moved to `docs/archive/`.

22. **2026-08-10:** `plans/PLAN-trader.md` added (trader sandbox — "The Lab": the permanently-special,
    fully isolated paper-trading research module; v1.1, landed owner-approved 2026-08-10; decisions TRD-A…M
    locked over 3 review rounds 2026-08-03 → 2026-08-10; ADR numbers at kickoff from the century claimed per
    `PORTFOLIO.md` — NEW lane). **Trigger converted under the owner's Build-out Mandate (2026-08-09 — same
    receipt as correction #15, cited by the kickoff ADRs; A8's letter kept; honesty note in-file: the income
    score stays 2/10 and no revenue receipt exists or is invented — the brief's revenue-gate leg is void under
    the mandate, the written-opening leg's spirit survives as the kickoff approval itself, and the module's
    stated value is answered research questions + autonomy-calibration evidence, never income).** Core beyond
    the brief: **the two-zone law** (unregistered PLAYGROUND — instant, unlimited, every output watermarked
    EXPLORATORY-NOT-EVIDENCE — vs the registered VERDICT LAB, the only place verdict vocabulary exists:
    "automate the honesty, never bureaucratize the curiosity") · **the honesty battery** (sha-pinned
    pre-registration + replay-derived attempt-family disclosure with a monthly registration budget · seeded
    null-monkey percentile · buy-and-hold + cash baselines · ≥2-regime coverage tag · min-trade floor ·
    training-window report lint; verdicts limited to LOSES / INDISTINGUISHABLE-FROM-LUCK / SURVIVES-SO-FAR —
    "WINS" does not exist in the module) · deterministic backtester (snapshot-sha + spec-sha + cost-config-sha
    → byte-identical reports incl. the monkey distribution; pessimistic India cost table from receipted charge
    sheets; no-lookahead execution convention) · the 30-trading-day paper run with receipt-derived day count
    and **backtest-vs-paper divergence as its north metric** (simulator honesty before strategy performance) ·
    **THE LOCK hardened 4 → 5 conditions** (handwritten `trader.policy.yaml` edit · **spine-receipt 72h
    cooldown — wall-clock never consulted** · hard caps with auto-L0 · `decision.recorded` citing the evidence
    report · compliance review recorded) + the auto-generated ANTI-CASE report whose citation is mandatory —
    v1 ships with **no real-order code path and no broker credentials** (creds-inventory check in CI), red-team
    ≥1 day; real-money unlock remains outside every plan (E2, Constitution LAW) · prediction ledger at
    paper-entry (council calibration data, non-blocking) · question-driven cycles + autopsy playbook + a
    terminal CONTINUE/DORMANT state · own instance + own event stream (HQ merges read-only), **zero company
    kinds added** (any company-side metric conforms to the live ADR-0408 validator and is explicitly NOT
    evolve's trigger feed — the ops honesty boundary). Recommended slot: LAST — after the ledger + scheduler
    lanes ship (policy C9 already live); the in-file graceful-degradation table makes any earlier slot safe.
    `BRIEF-trader.md` superseded → moved to `docs/archive/`.

23. **2026-08-12:** `plans/PLAN-bench.md` added (bench runner — "the model market": deterministic
    model comparison over the processes' own eval packs, emitting propose-only router diffs with the
    evidence inline; v1.0, landed owner-approved 2026-08-12; decisions BEN-A…H locked over two review
    rounds 2026-08-02 and re-grounded 2026-08-12; ADR numbers at kickoff from the century claimed per
    `PORTFOLIO.md` — NEW lane). **Trigger NOT mandate-converted, on the record:** bench's gate is a
    PREREQ (≥2 drivers in REAL use — the fleet arrives via `plans/PLAN-executor.md` on the engine
    lane), not trigger-patience; a runner with no road benches nothing. Engine C6 already shipped the
    bench handshake (task-class-tagged, revisioned fixtures · driver `--version` · MP-F `run.completed`
    payloads · the eligible-cost rule), so bench's kickoff inherits its fuel with zero
    re-instrumentation. Core beyond the brief: replay-determinism + the provenance tuple (fixture/input
    SHAs · eval revision · process + driver versions · exact model id · request settings · router SHA ·
    pricing snapshot) replacing the impossible same-config-same-scores claim, live K-run variance
    reported as variance · gates-first selection with the `NO PROPOSAL` null result (a 70/20/10
    weighted composite REJECTED on the record — units don't mix; the evidence table is the interface) ·
    one candidate driver+model pair per run, driver-explicit CLI · per-task-class verdicts with the
    MIN_FIXTURES=5 floor · K-group admission-controlled budget (reserve before start) · a partial run
    never proposes · three-tier champion drift guard on split quality/cost comparability axes with
    enumerated baseline re-pin causes · zero new spine kinds. Inherits MP-F (ADR-0069) and absorb's
    ABS-D owner-judge grammar. `plans/BRIEF-bench.md` superseded → moved to `docs/archive/`.

24. **2026-08-18:** `plans/PLAN-face.md` added (arc face v1 — "the working HQ": one surface
    that IS arc operating — every product, lane, pipeline, gate, receipt kind and concept,
    built and planned, as live views over the ONE spine + the sanctioned tracker files;
    v1.0, landed owner-instructed 2026-08-18 from a Cowork session after a full-tree sweep
    and a fresh adversarial review; decisions FACE-A…P named as letters; ADR numbers at
    kickoff from the century claimed per `PORTFOLIO.md` — NEW lane `face`). **Trigger
    converted under the owner's Build-out Mandate (2026-08-09 — same receipt as correction
    #15, cited by the kickoff ADRs; A8's letter kept; honesty note in-file: the brief's pull
    [brief overflows one screen / ≥3 earning ventures] never organically fired — `arc-brief`
    auto-collapses at 40 lines and 0 ventures earn — and no receipt is invented; the pull
    survives as REQ-10's live-value milestone: ≥5 real days with every owner decision going
    through the face).** Core beyond the brief: **three layers** — L1 truth (spine reader +
    the lints' own parsers, a spine-health reader added to `spine.mjs` via `/arc-change`) ·
    L2 `arc dash` zero-dep server in arc (ONE read door with cursor polling + an allow-listed
    `/api/file/:id`, ONE decision door = the `arc-inbox` function with a byte-parity fixture,
    `/api/ask` → `arc-run`; localhost + token, no daemon) · L3 the face app in its own repo
    `arc-face` so the OS repo stays zero-dep (FACE-A, owner may flip) · **stamps only on
    `approval.requested`** (approve/reject + mandatory reason = the only write; other needs-you
    kinds are cards with the resolving CLI as a copyable chip; forever-human actions are seals
    quoting E2/ADR — three affordance classes, lint-enforced) · **MAP** (every pipeline a
    transit line from manifest `face:` sections + a planned-rooms registry for unborn lanes;
    human gates = stamp stations; Inbox = the interchange; unexercised lines dashed, planned
    dotted) · **TAPE** (day-close ruler; as-of replay of every spine-derived view; file-borne
    panels badged "file, not log") · **32 rooms on one 6-zone template** + the room
    birth-rule (`face:` manifest section, `product-lint` `KNOWN_FIELDS`, `face-coverage` lint
    FAIL from birth; Appendices A–D map all 46 kinds / 26 commands / 30 agents / lints to
    rooms) · honesty classes real / simulated / rehearsal / drill / exploratory never
    co-rendered or summed; `not instrumented` / ABSENT / MISSING first-class · **Ask arc =
    engine process `face-ask`** (router row + `hq.policy.yaml` row per POL-I, budget,
    `run.completed`; zero write tools) · art direction decided by the design lane's
    three-thesis blind exploration with a reference fourth item (FACE-I) — Claude Design
    only after the pick, as taste canvas + design-system home synced FROM the repo behind a
    DES-G `/arc-change`; `arc-hq-mockup.html` demoted to a concept list. Tier L = 27 working
    days in three banked blocks + 5 real dogfood days; REQ-01..10 one phase each. Cross-plan:
    `BRIEF-chat-mcp.md` (the one remaining brief) names this lane's L2 as its prerequisite —
    same read door + decision door exposed as MCP tools; the July `arcface` prototype is NOT
    reused (owner ruling 2026-08-18). `BRIEF-dashboard.md` superseded → moved to
    `docs/archive/`.

## Provenance

Produced 2026-07-18 → 2026-07-26 in Cowork planning sessions (Ashiq + Claude), grounded
against the repo before AND after the orchestrator initiative closed. Nothing in this
folder changes code or gates by itself; implementation always goes through
`/arc-kickoff` → review → explicit approval.
