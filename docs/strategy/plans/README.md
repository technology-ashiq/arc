# docs/strategy/plans/ — the kickoff-ready plan pack

> Written 2026-07-22, grounded against the repo AFTER the orchestrator initiative closed.
> **Every future initiative has a file here with a paste-ready kickoff prompt at the
> bottom.** No more "vera session-la proper idea varala" — open Claude Code in the right
> repo, state the lane, paste the prompt from the plan, review what it writes, approve.
> That's the whole ritual.

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
| 1.5 | **arc-design · "The Designer"** | `PLAN-design.md` | **After Cycle-2 close** — owner-scheduled next kickoff (2026-07-26); serves every UI-bearing build incl. Cycle 3 |
| 1.55 | **arc-portfolio · "The Conductor"** | `PLAN-portfolio.md` | **After the arc-design cycle closes, BEFORE the develop kickoff** — owner-approved (2026-07-29); multi-lane workspaces (`initiatives/<product>/` + `PORTFOLIO.md` + lane resolver) so products plan/build in parallel; develop is then born as the first native lane |
| 1.57 | **Balanced Model Policy · pre-engine model discipline** | `PLAN-model-policy.md` | **After the arc-portfolio cycle (C4) closes + retro, BEFORE the develop kickoff** — owner-approved (2026-08-02); the policy ADR (decisions MP-A…F: provider-neutral seat tiers, model-fingerprint discipline, emergency fallback + exploratory-trial carve-outs) + council `standard` fixed envelope + paired composer A/B + calibration unblock + attacker reject trace. The policy layer the engine (#3) and `BRIEF-bench.md` later inherit — zero engine code |
| 1.6 | **arc-develop · "The Developer"** | `PLAN-develop.md` | **After Cycle-2 close** — owner-scheduled (2026-07-28); the execution harness owning the build loop (plan-approval → phase-done) for every subsequent build incl. Cycle 3. **Kickoff runs AFTER arc-portfolio (1.55) — develop = first native lane** |
| 2 | **Cycle 3 · First Money ([VENTURE] launch)** | `PLAN-cycle3-venture-launch.md` | After Cycle 2 · needs the venture decision (candidates + 10-min test inside) |
| 3 | Model-agnostic foundation (engine + processes) | `PLAN-engine-process-layer.md` | Pull: public-prep / 2nd runtime need |
| 4 | discover v1 | `PLAN-discover.md` | Pull: next venture needed |
| — | growth v1 | `BRIEF-growth.md` | Pull: live venture needs traffic |
| — | leads v1 | `PLAN-leads.md` | Pull: an offer needs outbound — **full plan ready, SLEEPING** (owner-approved 2026-08-03; decisions LEA-A…M locked over 3 same-day review rounds, 27 rulings in-file). Pre-kickoff gate inside: named offer · dedicated sending domain warmed ≥14d (calendar-gated — start weeks before kickoff) · ICP v0 · calendar link · capability scout · EVO-H0/LEA-I ruling. Hard lines: L1 every send, caps/suppression in code, PII never in the repo (private store + keyed HMAC ids), no background scheduler. **If leads fires before growth, its LEA-I ruling may take the EVO-H0 obligation — check at kickoff** |
| — | ops v1 | `BRIEF-ops.md` | Pull: ≥2 live ventures / support volume |
| — | legal pack | `BRIEF-legal-pack.md` | Pull: first venture reaches launch prep (policies before real payments) |
| — | ledger module | `BRIEF-ledger.md` | Pull: ≥2 revenue sources |
| — | evolve v1 | `PLAN-evolve.md` | Pull: 4+ weeks of real `metric.observed` receipts on the spine — **full plan ready, SLEEPING** (owner-approved 2026-08-02; decisions EVO-A…H1 locked over 4 review rounds). Pre-kickoff gate inside: the metric vocabulary + feed (EVO-H0) land in the FIRST CLIENT's cycle (growth inherits that obligation); rollback is propose-only BOTH directions — deviation from the old brief, on the record in the file |
| — | memory v1 | `BRIEF-memory.md` | Pull: recall pain (>2 min to find a lesson) |
| — | bench runner | `BRIEF-bench.md` | Pull: drivers disagree / new model |
| — | dashboard | `BRIEF-dashboard.md` | Pull: brief overflows / ≥3 earning ventures |
| — | chat (HQ MCP) | `BRIEF-chat-mcp.md` | Pull: dashboard live + conversational demand |
| — | policy engine | `PLAN-policy.md` | Pull: ≥3 action kinds at ≥L2 OR the first scheduler/headless job is **APPROVED** — **required before scheduler** · **full plan ready, SLEEPING** (owner-approved 2026-08-04; decisions POL-A…J locked over 3 review rounds; POL-K — lane/century/code home — open by design, decided at kickoff). Pre-kickoff gate inside: **Constitution ADOPTED** (`constitution.adopted` is not in today's vocabulary — micro vocab ADR + sign-off + event first; verify else STOP). Core: two-key authority (YAML ceiling + event-earned cap, L1 birth, demotion bites from the effective level), deny-by-default, fail-closed at `arc-run` + hooks (P0 hook feasibility matrix — unprovable class = static deny or L0/L1), `spend` = pre-approved provider budgets only (E2 money never above L1, Mode A only), vocab +4 kinds on live `KINDS.length`, P4 red-team 2d untouchable |
| — | scheduler | `BRIEF-scheduler.md` | Pull: first L3 process · policy engine is a hard prereq |
| — | absorb v1 · the technique refinery | `BRIEF-absorb.md` | Pull: a task class arc runs demonstrably **loses** to an external agent's approach (receipted A/B / PLANOFF evidence) — or a develop Capability Proposal returns "technique, not artifact" (added 2026-08-04). NEW lane at kickoff — claims the next free ADR century per `PORTFOLIO.md`. Its cycle also lands the PLAN-develop team-leader addendum (REQ-5) and the owner-judge receipt grammar (ABS-D) that bench later inherits |
| — | executor · agent-runtime driver | `BRIEF-executor.md` | Pull: a **receipted need** for a capability no current driver has (Capability Proposal / absorb INTEGRATE verdict / pilot evidence) — added 2026-08-04. Engine-lane work under the live ENG-D contract (prereq "engine v1 shipped" MET — C6 closed 2026-08-03); kickoff's first act = one-paragraph ADR-0069 amendment; router.yaml delta is its REQ-4. L1-drafts cap until the policy engine wakes |
| — | trader sandbox | `BRIEF-trader.md` | Pull: monthly revenue + Ashiq's written opening — **last** |

**Full PLANs** (the 11 `PLAN-*.md` files) are kickoff-grade: REQ tables (or locked
decision records), appetites, ADR-ready decisions, phases, pre-mortems. **BRIEFs** are
deliberately lighter — real REQs and locked non-negotiables, but current-state gets
filled at their kickoff (writing 400-line plans for far-future modules today would be
stale slop by the time their triggers fire; the brief + the kickoff process produce the
full plan when it's actually needed).

**Org-chart lens over this pack** — which department each module is, what exists vs
what's missing, and why roles ≠ standing agents: `../arc-company-org-blueprint.md`
(added 2026-07-25 with `BRIEF-legal-pack.md` + v1.1 scope notes in growth/leads/ledger).

## How to start ANY initiative (the 5-step ritual)

1. Check its **trigger** fired (the table above). No trigger → it doesn't get built
   (Constitution A8, earn before build).
2. Open Claude Code **in the right repo** (arc for modules; the venture repo for Cycle 3).
3. **State the lane.** In arc the work lives in a lane — one product's workspace at
   `initiatives/<lane>/` — and `--lane <name>` is the only way to name one. No command
   ever guesses. A lane is born **only** by `/arc-kickoff --lane <name>`; every other
   command handed a lane it does not know stops, lists the lanes that exist, and creates
   nothing. No `initiatives/` directory at all — LexOS, venturemind, any consumer repo —
   means root-mode: `PLAN.md`, `PROGRESS.md` and `phases/` sit at the repo root exactly as
   before, and there is no lane to state (ADR-0054). Resolution order and the lane-name
   grammar: `../../../.claude/rules/lanes.md`.
4. Paste the **KICKOFF PROMPT** from the bottom of its plan/brief file.
5. Review the PLAN.md + phase specs it writes → approve → build starts. Phase closes only
   via /arc-phase-done; cycle closes with /arc-retro.

## Standing rules (apply to every kickoff from this pack)

- Constitution (`../../../CONSTITUTION.md`) outranks everything here — adopt it at
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
