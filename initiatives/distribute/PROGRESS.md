# PROGRESS.md — distribute v1 "arc under verified harnesses"

status: LIVE
cycle: arc-distribute (Cycle 1, opened 2026-10-07)
phase: 01
appetite: 12d
burn: 2d
blocked-on: owner — REQ-09 branch-protection flip on main (Phase 01 close)
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/distribute/evidence/phase-NN/`.
ADR century 2000–2099; ADR-2000..2016 written at kickoff. The kickoff was APPROVED by the owner in chat on 2026-10-07 ("machi work start pannu … complete all phase"). The `kickoff.done` and `approval.requested` receipts are emitted from the main clone after the birth PR merges, because a worktree's spine refuses emits.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Birth PR + matrix + local lies resolved + claude-code golden + live OpenCode spike | 2d | ✅ |
| 01 | Gates to merge-time + the brain (day-4.5 kill) | 2.5d | 🔨 built + merged, close blocked on owner |
| 02 | Source hygiene: frontmatter ADR, `targets:`, lint, compile identity | 1d | ⏳ |
| 03 | Install adapters ×4 + goldens + REQ-10 + sync re-pointed + REQ-03 real run (stop rule) | 3.5d | ⏳ |
| 04 | `bin/arc.mjs` + clean-machine proof on 3 legs + retro | 1.5d | ⏳ |

## Done-log

- **Kickoff 2026-10-07**: PLAN, 5 phase specs and ADR-2000..2016. Verification falsified four design-source premises:
  `.codex/`, `.agents/skills/` and `AGENTS.md` are gitignored local files, not repo state (ADR-2014); there are 3
  blocking hook events, not 2; `gh` is present and `main` is unprotected (404); and `arc-compile` reads processes only.
  Two decisions were added: protection must bind admins (ADR-2015), and new gates route through bats (ADR-2016).

- **Phase 00 closed 2026-10-07** (`/arc-phase-done 00`): no REQs close here (the walking skeleton every REQ reads). Birth PR #371 merged as `74aae21a`, CI 19/19 on run 37576214357 per job, head asserted (an earlier run's Windows shard 9 timed out with no log and went green on a `--failed` rerun). Receipts on the canonical spine: `kickoff.done` `01M4AJMX1N0ZYRN12H9KSJVF61`, the ruling `approval.requested` `01M4AJMXD7QKGB4G3P8DW08FJY` decided by the owner's `decision.recorded` `01M4AKYMN04722WM5QGJSDDW1R` (approve), and the spike's `note.logged` `01M4AQG22Y85433X9KC4BHJV8H` with `harness: opencode`; 0 `distribute@` records in `_quarantine/`. The spike ran 7 times: OpenCode 1.17.18 executed the hand-rendered `arc-resume` every time, but free models never reached its emit step (426 free-tier version gate, a retired Gemini model, quota exhaustion retried silently, a malformed tool-call token), so the receipt came from a minimal quarantined `arc-spike-receipt` command under `--pure` on OpenRouter DeepSeek. The receipt payload mislabels the command as `arc-resume`, which is stated in `evidence/phase-00/opencode-spike.txt`. Four OpenCode facts went into the matrix header. A-02 and A-03 hold. Attack: 2 boundary + 2 logic rounds, 15 defect classes fixed. Actual ~1d against a 2d appetite. Metrics: `amendments: 0` · `reopened: n` · `t-to-phase0: 0`.

**Appetite burn:** 1 of 10.5 planned days used (12-day cap, 1.5 d slack). Phase 00 closed at half its appetite.

## Now

**Current position:** Phase 01 is BUILT and MERGED as PR #380 (`afa6239d`). CI went 19/19 on the PR head, and a `main` dispatch (run 37636468223) went 19/19 green. On main: `engine/enforcement.yaml` (22 rows), `gate-parity.mjs` (9 fragments, 7 rules, 0 gaps; the mutant selftest catches a planted fragment), `secret-diff-scan.sh` (the merge-time secret gate, which never existed before), `branch-guard.sh` + `.githooks/`, `arc-doctor.mjs --repo`, and `AGENTS.md` as the brain with `brain-drift.mjs`. Attack: 2 rounds on each of the 2 surfaces, 52 findings, fixed-defects (v)–(ag). The main clone has `core.hooksPath .githooks` set, and was probed: a commit on `main` is refused by branch-guard. **Phase 01 is NOT closed.** REQ-09 needs `main` protected, and the day-4.5 kill checkpoint needs that protection to read.
**Next step:** the owner answers ONE line: "flip now" (the session runs `gh api -X PUT repos/technology-ashiq/arc/branches/main/protection --input initiatives/distribute/evidence/phase-01/protection.json`), "I'll flip", or "no" (A-07 fires, the merge-time column goes advisory, and the cycle STOPs at the kill checkpoint). After the flip: `node .claude/scripts/engine/arc-doctor.mjs --repo` must print 5 `ok`. Then open a throwaway PR `feat/distribute-p01-planted` adding `.claude/hooks/PreToolUse.d/99-planted.sh` with no row. It must read `mergeStateStatus: BLOCKED` with a failed `selftest` whose log names `99-planted`. Close it unmerged, refuse a direct `git push origin HEAD:main` from a clean clone, write `evidence/phase-01/`, and run `/arc-phase-done 01 --lane distribute` from the main clone. Owner stamp still open: the Phase 00 move-on `approval.requested` `01M4AY2VSMJ2H89V82X5EXEBTT`.
