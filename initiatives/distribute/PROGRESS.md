# PROGRESS.md — distribute v1 "arc under verified harnesses"

status: LIVE
cycle: arc-distribute (Cycle 1, opened 2026-10-07)
phase: 00
appetite: 12d
burn: 0d
blocked-on: —
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/distribute/evidence/phase-NN/`.
ADR century 2000–2099; ADR-2000..2016 written at kickoff. The kickoff was APPROVED by the owner in chat on 2026-10-07 ("machi work start pannu … complete all phase"). The `kickoff.done` and `approval.requested` receipts are emitted from the main clone after the birth PR merges, because a worktree's spine refuses emits.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Birth PR + matrix + local lies resolved + claude-code golden + live OpenCode spike | 2d | ⏳ next |
| 01 | Gates to merge-time + the brain (day-4.5 kill) | 2.5d | ⏳ |
| 02 | Source hygiene: frontmatter ADR, `targets:`, lint, compile identity | 1d | ⏳ |
| 03 | Install adapters ×4 + goldens + REQ-10 + sync re-pointed + REQ-03 real run (stop rule) | 3.5d | ⏳ |
| 04 | `bin/arc.mjs` + clean-machine proof on 3 legs + retro | 1.5d | ⏳ |

## Done-log

- **Kickoff 2026-10-07**: PLAN, 5 phase specs and ADR-2000..2016. Verification falsified four design-source premises:
  `.codex/`, `.agents/skills/` and `AGENTS.md` are gitignored local files, not repo state (ADR-2014); there are 3
  blocking hook events, not 2; `gh` is present and `main` is unprotected (404); and `arc-compile` reads processes only.
  Two decisions were added: protection must bind admins (ADR-2015), and new gates route through bats (ADR-2016).

**Appetite burn:** 0 of 10.5 planned days used (12-day cap, 1.5 d slack).

## Now

**Current position:** Phase 00 in build on `feat/distribute-birth`. The main clone's local `.codex/`, `.agents/` and `AGENTS.md` are moved to `~/.arc-private/distribute/local-2026-07-11/`, and 0 of 8 command skills are faithful. Birth rows written: band, lane row, matrix, face rows, `.gitignore`, wiki. The red-first test is committed alone ahead of them.
**Next step:** `/arc-attack` on the local commit → one push → CI per job (waits on face PR #361 for the PLAN-distribute room) → merge → ruling + spike from the main clone.
