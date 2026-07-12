---
description: Kick off a new build per docs/build-playbook.md — evidence-based plan, ADRs, risk-ordered phases, tracker, lint-gated.
argument-hint: [one-line project goal]
---

Kick off the build for: $ARGUMENTS

> **Router:** extending an EXISTING build (new feature, tweak, mid-build idea)? Use
> `/arc-change` instead — kickoff is only for a new build or a major new milestone.

Follow `docs/build-playbook.md` (§9) using the proven templates in `docs/templates/`.
**Timebox: this entire kickoff = one session.** Time up → unresolved questions become
Assumptions-ledger entries (with triggers) and we proceed — a falsifiable plan beats a
perfect one. In order:

0. **Preflight.** If `PLAN.md` or `PROGRESS.md` already has real content: STOP and ask —
   new initiative or revise the existing one? New initiative: archive first to
   `docs/archive/PLAN-<YYYY-MM-DD>.md` (and `PROGRESS-<YYYY-MM-DD>.md`). Never
   overwrite silently. If the repo already contains product code (brownfield): survey it
   first (Graphify knowledge graph → fallback grep) and fill PLAN's `## Current state`
   before any planning. Greenfield: delete that section.
1. **Set the appetite first.** Ask my total time budget (Shape Up style) — a constraint,
   not an estimate. Write the kill criteria under it (50% burnt tripwire).
2. **(2a) Premise check & forks.** New product / startup-risk build (someone must choose
   to adopt or pay)? Then ONE block first, not an interview: who needs this now · their
   status quo (the real competitor) · why they'd switch · narrowest wedge that proves
   demand. Strong answers sharpen Goal/no-gos; weak answers become Assumptions-ledger
   entries with triggers. Internal tool / existing-system work: skip, say so explicitly.
   Then **clarify only at still-open forks — max 5 questions** (e.g. target user, core
   success, hard constraint; brownfield/greenfield and deadline are usually already
   resolved by Steps 0–1 — don't re-ask them). Recommend a default for each.
   **(2b) Research gate** — spawn the researcher agent ONLY for: version-sensitive or
   non-obvious external API/library/security claims · costly-to-reverse architecture ·
   unknown domains. A well-known stable API with an established integration pattern does
   NOT qualify by domain label alone (payments/auth/data included). Everything else:
   decide without research. Findings land in the ADR (Evidence / Confidence /
   Rejected-because), never a separate file.
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
   If the file is absent or has no pattern rows: record "no history to seed" in the
   pre-mortem and proceed. Then: "it's 6 months later and this failed — why?" Top 5
   causes, each mitigated now or accepted explicitly. If a cause invalidates the plan, fix the plan first.
6. **Define phases risk-first.** Phase 0 = steel thread / walking skeleton: the thinnest
   deployable end-to-end slice (input → core flow → output → deployed). Contract tests
   green against fakes apply only where an external dependency exists — a dep-free build
   still ships a Phase-0 slice, it just has nothing to fake. No real APIs in Phase 0.
   Each phase gets its own appetite and a spec from `docs/templates/phase-spec-template.md` → `phases/phase-NN-spec.md` (zero-padded),
   **including its Verification plan — detailed for Phase 0–1 only, one coarse line for
   later phases** (refined when the phase starts, via `/arc-change`).
7. **Create `PROGRESS.md`**: phase table (capability | appetite | status), done-log,
   appetite-burn line (X of Y days used), and a `## Now` section ("current position →
   next step").
8. **Self-check gate:** run `node .claude/scripts/kickoff-lint.mjs`. Fix and rerun until
   it passes. The script's verdict is the gate — prose assurances don't count.
9. **STOP.** Show me PLAN.md + the phase list and wait for explicit confirmation before
   any product code.
