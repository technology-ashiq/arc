# Phase 00 — Steel thread: arc-scan skeleton + CI on arc itself

**Goal (one line):** the riskiest spine — diff-scope → 2 real adapters → SARIF merge → triage stub → ledger stamp — runs end-to-end on both platforms, and arc's own repo gets red/green CI.
**Appetite:** 1 week — blown appetite = cut the second adapter, never extend.

## Exit criteria (Definition of Done)

- [ ] `arc-scan` runs `semgrep` + `gitleaks` on a diff scope, each via an adapter file; missing tool → `SKIPPED` line, exit 0
- [ ] Both outputs normalize to minimal SARIF (ruleId, level, message, location, fingerprint) and merge into one `scan-result.sarif`
- [ ] Triage stub consumes the merge and emits verdict JSON (pass/block + finding count) — no LLM yet, pure threshold (any `error`-level = block)
- [ ] Verdict stamps the existing review ledger (`review-ledger.sh stamp scan`)
- [ ] bats-core suite covers: adapter degrade, SARIF merge, verdict logic, ledger stamp — all green
- [ ] GitHub Actions workflow runs bats on ubuntu-latest AND windows-latest (Git Bash) — green on both
- [ ] `VERSION` (0.2.0) + `CHANGELOG.md` exist; CI has a version-gate check
- [ ] Live demo: seeded repo with 1 planted secret + 1 planted injection → scan blocks; clean repo → passes
- [ ] Tracker updated (PROGRESS.md row ✅ + done-log)

## Rabbit holes in this phase

- SARIF full-spec fidelity → minimal field set only (PLAN rabbit hole #1)
- Perfecting adapter API before 2 real adapters exist → build 2, then extract the interface

## Out of scope for this phase

- LLM triage (Phase 2) · baseline mechanism (Phase 2) · any new tools beyond semgrep/gitleaks (Phases 3–4) · gates.yaml (Phase 2)

## Your-setup / pending

- GitHub repo for arc must have Actions enabled
- semgrep + gitleaks installed locally (`/arc-toolcheck --fix` covers both)
