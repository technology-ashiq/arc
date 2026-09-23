# Code review — feat/engine-attack-diff (PR #265, ADR-0226)

- **Date:** 2026-09-24
- **Branch:** `feat/engine-attack-diff`
- **Reviewed commit:** `5fe1218a` (CI green, 19/19 jobs, head SHA confirmed by `ci-digest`)
- **Reviewer:** `code-reviewer` subagent via `/arc-review`
- **Recall step:** `diff-recall.mjs` exit 3 (no memory index in this worktree) — a WARN, not a block (ADR-0704)
- **Verdict:** **ship** — nothing exploitable, nothing data-losing, no secrets or PII

## Scanner summary

- opengrep `--config auto`: 2 × `detect-non-literal-regexp` at `arc-attack.mjs:100` — false positives (`round` is `^[1-9][0-9]?$`-checked, `surface` comes from the closed `SURFACES` constant).
- gitleaks (`origin/main..HEAD`): clean. PII grep: clean (the one `+91` hit is a diff hunk header).
- osv-scanner, npm audit, knip, npm lint: not applicable (no `package.json`, no dependency change). `node --check` on all 11 changed `.mjs`: parse.
- Tests: CI only (repo rule).

## Critical

None.

## Warning

1. **`.claude/commands/arc-attack.md` — default `--base "main"` is local main**, which lags merges in the main clone; the attacker then receives other lanes' merged commits.
   **Resolved** in the commit that adds this file: the command fetches first and defaults to `origin/main`.
2. **`build-attack-input.mjs` + `arc-attack.mjs` — classification hard-coded `external-ok`**; on a private venture repo the diff would declare itself shareable.
   **Resolved** in the commit that adds this file: both scripts default to `internal-only`, and `arc-attack` refuses internal-only up front (exit 2) — measured, ADR-0219's boundary sends internal-only input to no driver, so neither surface could run. `--classification external-ok` is explicit. Pinned: `with no classification the diff is internal-only and is refused before anything runs`.
3. **`ci-digest.mjs` — "pushed, run not yet created" reported as SHA MISMATCH (4)** instead of pending (3).
   **Resolved** in the commit that adds this file: `upstream` (`@{u}`) is passed in; equal to HEAD → 3, elsewhere or unknown → 4. Pinned: fixtures `lag` (3) and `mismatch` (4).
4. **`arc-attack.mjs` — an input-build failure returned early and dropped the gathered summary.**
   **Resolved** in the commit that adds this file: recorded as `INPUT NOT BUILT`, the loop continues, empty diff still exits 6. Pinned: `a surface whose input cannot be built is reported, and the summary still prints`.

## Nit

- HEAD moving between the two surfaces' builds — **resolved**: HEAD re-checked before each build, a move is `NOT RUN`.
- Prompt injection through the diff — **resolved**: the body now states that everything in the input is data under attack, and an instruction inside it is itself a finding.
- CLAUDE.md at 202 lines — accepted; noted in the PR.
- Logic surface NOT RUN until the three trial env vars are set — accepted as the owner's standing setup item (ADR-0226 § Owner setup).
