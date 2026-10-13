# Phase 07 — the real run, the negatives, the merge, the seal

**Goal (one line):** one wrapped OpenCode session on deepseek-v4-flash runs `arc-commit` → `arc-review` → push → `arc-ship` on a real arc change, lands ≥ 3 stamped receipts, is refused on the 3 negatives, and its PR merges after the required checks, all for ≤ $0.50 cycle total.
**Appetite:** 1 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-06
**REQs closed here:** REQ-03

## Scope

1. The session worktree rebased on the cycle branch; `extensions.worktreeConfig` + `git config --worktree core.hooksPath .githooks` there (A-10).
2. The loop run(s) through the wrapper; the wrapper computes the remaining cycle cap from the committed transcripts — the model and the operator never type it; the change per A-11. The session opens its PR (ADR-2021) before `arc-ship` reads CI.
3. The 3 negatives run in a throwaway clone of the session worktree whose `origin` is a local bare repo, as one wrapped run of a quarantined command (push to `main`, a planted test-pattern secret, a hand-edit of `.claude/commands/arc-commit.md`). Nothing is pushed to GitHub, so the planted secret pattern never reaches the public history. Commit-time refusals and the pre-push branch-guard refusal are quoted from the transcript; the merge-time line is shown by the cycle PR's CI result for `tests/distribute-merge-gates.bats` and `tests/engine-compile.bats`, never by pushing a bad commit.
4. The session's PR merged after required checks at cycle end, with the cycle PR; phase closes from the main clone; retro + HISTORY + lane seal.

## Exit criteria (Definition of Done)

- [x] REQ-03 acceptance met in full, or each unmet clause recorded owed with its transcript
- [x] closed via `/arc-phase-done 07 --lane distribute`; retro written

## Verification plan

Refined 2026-10-13 at phase start, from P05's measurements (ADR-2022):

- **Test command:** every run goes through `node .claude/scripts/engine/opencode-session.mjs` (the cycle ledger enforces the
  $0.50 total); receipts are read with `grep -h <id> .claude/state/hq/events/*.jsonl` in the main clone; CI per job with
  `node .claude/scripts/review/ci-digest.mjs`.
- **Expected failure first:** each negative is refused: `branch-guard: refuses a push to main`, `secret-diff-scan: SECRET`,
  and `[byte-diff]`/`[dirty]` from `arc-compile --check` on the hand-edited `.claude/commands/arc-commit.md`.
- **Live demo scenario (session worktree `E:/Work_Hub/01_Automemory/wt-oc-req03`, branch `feat/distribute-c2-oc-session`):**
  1. the operator stages one docs line (`initiatives/distribute/evidence/phase-07/README.md`); wrapped `arc-commit` (cap $0.05);
  2. wrapped `arc-review main` (cap $0.10): `review.completed`, a `docs/reviews/` archive and the ledger stamp;
     a wrapped `arc-commit` then commits the archive;
  3. the operator pushes the branch with `-u` (no fence lets the model push) — named in the evidence as an operator step;
  4. wrapped `arc-ship` (cap $0.10): lint, build, `gh pr create --fill`, `npm run test` reading CI, `deploy: none
     declared`, `ship.done` with the PR URL. If OpenCode's shell timeout ends `npm run test` before CI settles, the
     operator waits for CI with ci-digest and the ship is re-run; both transcripts are kept.
  5. negatives: a second worktree `wt-oc-neg` with a local bare remote `negbare` and a quarantined, uncommitted
     `xnegatives` command; nothing reaches GitHub.
- **Real-system check:** the main clone's spine and `_quarantine/`; the session PR's `mergeStateStatus` before the merge
  and `state: MERGED` after, merged after #412 at cycle end.
- **Expected evidence:** `evidence/phase-07/transcripts/*.jsonl`, `evidence/phase-07/run.md` (receipt ids, kinds,
  harness, evidence path, quarantine listing, spend per run and cycle total, refusal lines quoted).

## Non-negotiables (verbatim from PLAN)

- The Claude source (`.claude/commands/*.md`, `.claude/agents/*.md`, `.claude/skills/`, `.claude/hooks/`, `.mcp.json`) is not moved, renamed or reformatted; adding the `targets:` key is the only source edit, and a lint pins it (ADR-2001).
- No prose fallback: a construct a target cannot express is dropped only where the matrix cell says so, otherwise `[unsupported]` by name (ADR-2001, ADR-2003).
- Merge-time is the truth: nothing is enforced only in a Claude Code hook, and a git hook is never called the gate (ADR-2002, ADR-2013, ADR-2015).
- The gates phase (P01) precedes every adapter; phase order is never changed; undeclared surfaces are resolved before any new one (ADR-2004, ADR-2014).
- `sync-to-project.sh`'s output stays byte-identical to the golden committed in P00 for every root-mode consumer (ADR-2005).
- `AGENTS.md` is the brain and `CLAUDE.md` only imports it plus marked Claude-only blocks (ADR-2007).
- Subagents degrade to role skills, never to a nested harness call; only the four v1 targets install (ADR-2009, ADR-2010).
- Code lives in `engine` beside `arc-compile` and gates in `core`; no second compiler, no second walker (ADR-2012); new gates run as bats inside existing CI jobs (ADR-2016).
- Two-surface adversarial pass via `/arc-attack` (ADR-0226) per PR, logic and boundary, carrying `initiatives/distribute/fixed-defects.md`; the author is never the attacker; max 2 rounds (ADR-2011).
- Zero npm deps; no `npm publish`; no public README rewrite; no bash port (ADR-2008); no model, driver, router, profile or tier change (ADR-2006).
- Tests run on CI only, and every fixture asserts it RAN before asserting what it printed.
