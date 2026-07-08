---
description: Kick off a new build per docs/build-playbook.md — evidence-based plan, ADRs, risk-ordered phases, tracker.
argument-hint: [one-line project goal]
---

Kick off the build for: $ARGUMENTS

Follow `docs/build-playbook.md` (§9) using the proven templates in `docs/templates/`. In order:

1. **Set the appetite first.** Ask my total time budget (Shape Up style) — a constraint,
   not an estimate. Everything else must fit it.
2. **Clarify only at real forks** (stack, datastore, infra, budget). For each fork:
   recommend a default; if a fork is genuinely uncertain or high-stakes, **spawn the
   researcher agent** to triangulate current evidence (it uses Context7 + web) before I
   decide. Never decide load-bearing forks on stale memory.
3. **Record each resolved fork as an ADR** — `docs/adr/NNNN-title.md` per
   `docs/templates/adr-template.md` (options considered + consequences, one decision per file).
4. **Write `PLAN.md`** from `docs/templates/PLAN-template.md` — every section filled:
   goal, appetite, architecture as a C4-concept Mermaid `flowchart` (never the
   experimental C4 syntax), ADR index, non-negotiables, **no-gos**, **rabbit holes**.
5. **Pre-mortem instead of a vague critique** (Klein): "it's 6 months later and this
   failed — why?" Top 5 causes, each mitigated now or accepted explicitly. Put the table
   in PLAN.md. If a cause invalidates the plan, fix the plan before proceeding.
6. **Define phases risk-first.** Phase 0 = steel thread / walking skeleton: end-to-end
   through every integration on fakes, deployed. Each phase gets its own appetite and a
   spec from `docs/templates/phase-spec-template.md` → `phases/phase-NN-spec.md`
   (zero-padded).
7. **Create `PROGRESS.md`**: phase table (capability | appetite | status), done-log, and
   a `## Now` section ("current position → next step").
8. **STOP.** Show me PLAN.md + the phase list and wait for explicit confirmation before
   any product code.
