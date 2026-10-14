# Phase 07 — Enforcement rows, wiki, docs, retro and seal

**Goal (one line):** every new gate is named in `engine/enforcement.yaml`, the board grammar is proven unchanged, the wiki is regenerated, and the cycle is retro'd and sealed (REQ-09).
**Appetite:** 0.2 days
**Depends on:** phase-05, phase-06

## Non-negotiables (verbatim from PLAN)
- ADR-0051: no value on the board is typed by hand; `stale` is derived by the job and never written into PORTFOLIO.md (ADR-0079).
- Lock 4: PORTFOLIO.md's columns and row grammar do not change; no health score, no owner column, no ETA.
- The freeze's exempt lanes are read from the ruling's payload, never hardcoded; an unreadable ruling refuses, never exempts (ADR-0077).
- `hq.jobs.yaml` and `hq.policy.yaml` are written only by the owner-apply script the owner runs (ADR-1750); the job never runs ungoverned.
- The spine is read only through `.claude/scripts/hq/spine.mjs`; zero new event kinds.
- Lock 5: two-surface `/arc-attack` (logic + boundary, ADR-0226) per gate PR, carrying `initiatives/portfolio/fixed-defects.md`; the author is never the attacker; one round per PR.
- Tests run on CI only; every fixture asserts it RAN before asserting what it printed.
- feat/* branch; push freely; merge once, after every phase is complete (owner, 2026-10-14).

## Exit criteria (Definition of Done)
- [ ] enforcement rows for `[kernel-freeze]`, `[debt-budget]`, `board-stale-hand-written`; `gate-parity.mjs` green
- [ ] PORTFOLIO.md table headers byte-identical to `4741c770`; WARN registry still nine
- [ ] wiki regenerated, `--check` green; retro + HISTORY entry; lane header + board row closed in the same commit
- [ ] CI green per-JOB on the final head; single merge after all phases

## Verification plan
Coarse: `gate-parity`, `wiki-build --check`, `board-lint` and `kickoff-lint` on the real tree, all via CI. Refined at phase start.

## Out of scope for this phase
New gates.
