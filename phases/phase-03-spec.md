# Phase 03 — Security pipeline

**Goal (one line):** the security gate runs on real industry verifiers — SCA, verified secrets, deep SAST, live DAST, and a stack-specific RLS harness nobody else has.
**Appetite:** 1.5 weeks.

## Exit criteria (Definition of Done)

- [ ] **Trivy adapter** (SCA: dependencies + lockfile), SARIF-merged, baseline-aware
- [ ] **trufflehog adapter** (verified-secrets mode) alongside gitleaks
- [ ] **CodeQL adapter** — optional tier (ADR-0004): detects availability, SKIPPED otherwise; CI-tier only
- [ ] **RLS test harness**: generated SQL assertions per table ("anon cannot SELECT/INSERT/UPDATE x") runnable against local Supabase; wired as a gate check; `security-sensitive.md` rule updated to require it
- [ ] **ZAP baseline scan**: docker, CI-tier, runs against preview deploy URL, findings → SARIF merge
- [ ] `security-auditor` agent updated: consumes `arc-scan` merged results as Pass 0 evidence instead of re-running tools ad hoc
- [ ] `/arc-toolcheck` covers all new tools with Quick-fix lines
- [ ] Live demo: repo with vulnerable dep + leaked (test) credential + missing RLS policy → 3 distinct blocks with correct fingerprints
- [ ] bats + CI green both platforms (ZAP job linux-only, by design)
- [ ] Tracker updated

## Rabbit holes in this phase

- ZAP on Windows local → forbidden (PLAN rabbit hole); CI-tier docker only
- CodeQL query authoring → use standard security suites only this cycle
- RLS harness generality → v1 targets Supabase/Postgres only; other DBs out

## Out of scope for this phase

- SonarQube (no-go this cycle) · Nuclei templates (next cycle) · Socket.dev (optional, next cycle) · LLM red-teaming tools (only if target app has LLM features — not arc's)

## Your-setup / pending

- Docker Desktop running (CI handles ZAP regardless)
- Local Supabase instance for RLS harness demo (`supabase start`)
