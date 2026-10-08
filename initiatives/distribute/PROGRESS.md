# PROGRESS.md — distribute v1 "arc under verified harnesses"

status: LIVE
cycle: arc-distribute (Cycle 1, opened 2026-10-07)
phase: 02
appetite: 12d
burn: 3d
blocked-on: —
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/distribute/evidence/phase-NN/`.
ADR century 2000–2099; ADR-2000..2016 written at kickoff. The kickoff was APPROVED by the owner in chat on 2026-10-07 ("machi work start pannu … complete all phase"). The `kickoff.done` and `approval.requested` receipts are emitted from the main clone after the birth PR merges, because a worktree's spine refuses emits.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Birth PR + matrix + local lies resolved + claude-code golden + live OpenCode spike | 2d | ✅ |
| 01 | Gates to merge-time + the brain (day-4.5 kill) | 2.5d | ✅ |
| 02 | Source hygiene: frontmatter ADR, `targets:`, lint, compile identity | 1d | 🔨 |
| 03 | Install adapters ×4 + goldens + REQ-10 + sync re-pointed + REQ-03 real run (stop rule) | 3.5d | ⏳ |
| 04 | `bin/arc.mjs` + clean-machine proof on 3 legs + retro | 1.5d | ⏳ |

## Done-log

- **Kickoff 2026-10-07**: PLAN, 5 phase specs and ADR-2000..2016. Verification falsified four design-source premises:
  `.codex/`, `.agents/skills/` and `AGENTS.md` are gitignored local files, not repo state (ADR-2014); there are 3
  blocking hook events, not 2; `gh` is present and `main` is unprotected (404); and `arc-compile` reads processes only.
  Two decisions were added: protection must bind admins (ADR-2015), and new gates route through bats (ADR-2016).

- **Phase 00 closed 2026-10-07** (`/arc-phase-done 00`): no REQs close here (the walking skeleton every REQ reads). Birth PR #371 merged as `74aae21a`, CI 19/19 on run 37576214357 per job, head asserted (an earlier run's Windows shard 9 timed out with no log and went green on a `--failed` rerun). Receipts on the canonical spine: `kickoff.done` `01M4AJMX1N0ZYRN12H9KSJVF61`, the ruling `approval.requested` `01M4AJMXD7QKGB4G3P8DW08FJY` decided by the owner's `decision.recorded` `01M4AKYMN04722WM5QGJSDDW1R` (approve), and the spike's `note.logged` `01M4AQG22Y85433X9KC4BHJV8H` with `harness: opencode`; 0 `distribute@` records in `_quarantine/`. The spike ran 7 times: OpenCode 1.17.18 executed the hand-rendered `arc-resume` every time, but free models never reached its emit step (426 free-tier version gate, a retired Gemini model, quota exhaustion retried silently, a malformed tool-call token), so the receipt came from a minimal quarantined `arc-spike-receipt` command under `--pure` on OpenRouter DeepSeek. The receipt payload mislabels the command as `arc-resume`, which is stated in `evidence/phase-00/opencode-spike.txt`. Four OpenCode facts went into the matrix header. A-02 and A-03 hold. Attack: 2 boundary + 2 logic rounds, 15 defect classes fixed. Actual ~1d against a 2d appetite. Metrics: `amendments: 0` · `reopened: n` · `t-to-phase0: 0`.

- **Phase 01 closed 2026-10-09** (`/arc-phase-done 01 --lane distribute`): REQ-01, REQ-06 and REQ-09 validated. Built and merged as PR #380 (`afa6239d`), CI 19/19 on the PR head and on `main` dispatch 37636468223. The newest `main` dispatch, 37828894878 on `494e0f46`, is also green. On the merged tree, from the main clone: `gate-parity: 9 fragments, 7 rules, 22 rows, 0 gaps` (equal to the census), `--mutant-selftest` caught `99-mutant`, `brain-drift: 16 headings checked, 0 drift`, and `TODO` count 0 on both `AGENTS.md` and `CLAUDE.md`. The owner said "flip now" and `main` was protected from `protection.json`. Before the flip, all 19 contexts matched the newest PR run's check-runs, and `doctor --repo` printed 5 `ok` after it. **Day-4.5 kill checkpoint: YES.** Planted PR #395 read `BLOCKED` with 18/18 `selftest` jobs failing on `99-planted`, and was closed unmerged. `product-lint` caught it before `gate-parity` ran, and the owner accepted that. A direct `git push origin HEAD:main` from a fresh clone was refused with `GH006`. Evidence: `evidence/phase-01/kill-checkpoint.md`. A-04 and A-07 hold, and no assumption FIRED. Attack: 2 rounds × 2 surfaces, 52 findings, fixed-defects (v)–(ag). From now on, `enforce_admins` makes every session's merge wait for the 19 checks. Actual 2 calendar days against a 2.5d appetite, about 1d of that waiting on the flip. Metrics: `amendments: 0` · `reopened: n`.

**Appetite burn:** 3 of 10.5 planned days used (12-day cap, 1.5 d slack). Phase 01 took 2 calendar days against 2.5d, about 1d of it waiting on the protection flip. The kill line (50% = 6d with the tripwire phase not done) is not reached, and the tripwire phase (01) is now done.

## Now

**Current position:** Phase 01 CLOSED 2026-10-09. `main` is protected (19 required checks, `enforce_admins`, no force-push, no deletion), and the kill checkpoint answered YES. Phase 02 (source hygiene) is next and has not started. The receipts `phase.closed` 01 and the move-on `approval.requested` are emitted from the main clone after this close PR merges, because a worktree's spine refuses emits.
**Next step:** `/arc-develop start 02 --lane distribute` from a fresh worktree off `origin/main`. Scope 1 comes first: the frontmatter-key ADR (next free number in 2000–2099) with the key × target table, then `targets:`, `frontmatter-lint.mjs` with a mutant arm, `arc-compile --input commands|agents`, and the REQ-05 `[dirty]` check with 3 fixtures. Owner stamps still open: the Phase 00 move-on `01M4AY2VSMJ2H89V82X5EXEBTT` and the Phase 01 move-on (its id is printed when it is emitted).
