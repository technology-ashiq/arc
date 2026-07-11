---
description: Kick off a new build per docs/build-playbook.md — evidence-based plan, ADRs, risk-ordered phases, tracker, lint-gated.
argument-hint: [one-line project goal]
---

Kick off the build for: $ARGUMENTS

Follow `docs/build-playbook.md` (§9) using the proven templates in `docs/templates/`.
**Timebox: this entire kickoff = one session.** Time up → unresolved questions become
Assumptions-ledger entries (with triggers) and we proceed — a falsifiable plan beats a
perfect one. In order:

0. **Preflight.** If `PLAN.md` or `PROGRESS.md` already has real content: STOP and ask —
   new initiative (archive the old plan first) or revise the existing one? Never
   overwrite silently. If the repo already contains product code (brownfield): survey it
   first (Graphify knowledge graph → fallback grep) and fill PLAN's `## Current state`
   before any planning. Greenfield: delete that section.
1. **Set the appetite first.** Ask my total time budget (Shape Up style) — a constraint,
   not an estimate. Write the kill criteria under it (50% burnt tripwire).
2. **Premise check** — new product / startup-risk build (someone must choose to adopt or
   pay)? Then ONE block first, not an interview: who needs this now · their status quo
   (the real competitor) · why they'd switch · narrowest wedge that proves demand.
   Strong answers sharpen Goal/no-gos; weak answers become Assumptions-ledger entries
   with triggers. Internal tool / existing-system work: skip, say so explicitly.
   Then **clarify only at real forks — max 5 questions:** target user, core success,
   hard constraint, brownfield/greenfield, deadline. Recommend a default for each.
   **Research gate** — spawn the researcher agent ONLY for: current external API/library/
   version/security claims · costly-to-reverse architecture · payment/auth/data/privacy/
   compliance · unknown domains. Everything else: decide without research. Findings land
   in the ADR (Evidence / Confidence / Rejected-because), never a separate file.
3. **Record each resolved fork as an ADR** — `docs/adr/NNNN-title.md` per
   `docs/templates/adr-template.md` (options + consequences, one decision per file).
4. **Write `PLAN.md`** from `docs/templates/PLAN-template.md` — every section filled:
   goal, **success requirements (REQ table, cap 10, each → exactly one phase)**,
   appetite + kill criteria, architecture as a C4-concept Mermaid `flowchart` (never the
   experimental C4 syntax), ADR index, non-negotiables, **no-gos**, **rabbit holes**,
   **assumptions ledger (cap 7 — no falsification trigger, no entry)**, **external
   dependencies (interface + fake + real + contract test per dep)**.
5. **Pre-mortem, seeded from history** (Klein): first read `docs/retro-log.md` — any
   past pattern matching this project type MUST appear as a row (read, don't summarize).
   Then: "it's 6 months later and this failed — why?" Top 5 causes, each mitigated now
   or accepted explicitly. If a cause invalidates the plan, fix the plan first.
6. **Define phases risk-first.** Phase 0 = steel thread / walking skeleton: fake input →
   core flow → output → deployed, contract tests green against fakes. No real APIs
   required in Phase 0. Each phase gets its own appetite and a spec from
   `docs/templates/phase-spec-template.md` → `phases/phase-NN-spec.md` (zero-padded),
   **including its Verification plan — detailed for Phase 0–1 only, one coarse line for
   later phases** (refined when the phase starts, via `/arc-change`).
7. **Create `PROGRESS.md`**: phase table (capability | appetite | status), done-log,
   appetite-burn line (X of Y days used), and a `## Now` section ("current position →
   next step").
8. **Self-check gate:** run `node .claude/scripts/kickoff-lint.mjs`. Fix and rerun until
   it passes. The script's verdict is the gate — prose assurances don't count.
9. **STOP.** Show me PLAN.md + the phase list and wait for explicit confirmation before
   any product code.
