# Phase 02 — Gate engine v1: manifest, baseline, suppression, evidence

**Goal (one line):** gates become declarative data (`arc.gates.yaml`) with the three noise defenses built in (ADR-0002 — baseline + triage + suppression ship before any tool expansion), and phase-close produces a committed evidence bundle — the moat becomes a product.
**Appetite:** 2 weeks. This is the highest-risk phase after 0: if noise defense fails here, everything after is dead (pre-mortem #1).

## Exit criteria (Definition of Done)

- [ ] `arc.gates.yaml` schema: per gate = `check` (command) + `mode` (block/warn/off) + `evidence` (artifact path) + `tier` (hook/ci) + `runtime` (chain); hooks read it via a generic gate-runner — zero hardcoded gate logic left in `PreToolUse.sh`
- [ ] **Per-adapter runtime fallback chain** (from `/arc-change` 2026-07-09): each adapter resolves its tool via `native → docker → SKIPPED` — try native binary, else the pinned docker image (ADR-0006 amendment), else degrade to `SKIPPED` (never silent). This is also the permanent fix for the semgrep-on-Windows gap (`native → opengrep → docker`). bats: each rung of the chain exercised (native present, native-absent+docker present, both absent → SKIPPED)
- [ ] **gitleaks finding path fidelity** (promoted carry-forward from Phase 00 done-log): gitleaks finding URIs are **repo-relative**, not the staging temp dir — baseline fingerprints (below) depend on stable, correct paths, so path fidelity is a hard prerequisite, not cosmetic. bats: a staged-scope scan yields a repo-relative `uri` for a planted secret
- [ ] **Baseline**: `arc-scan --baseline` freezes existing findings to `.claude/state/scan-baseline.jsonl` (one fingerprint per line, sorted, append-only); only NEW findings block
- [ ] **LLM triage v1**: triage agent filters merged SARIF — drops <8/10-confidence findings with reason logged; can only downgrade, never invent blocking findings (PLAN rabbit hole #6)
- [ ] **Suppression ledger**: `docs/suppressions.md` — suppressing a finding requires an entry (fingerprint + justification + date); gate-runner cross-checks, unjustified suppression = block
- [ ] **Evidence bundles**: `/arc-phase-done` writes `docs/evidence/phase-NN/` — test output hash, coverage/mutation JSON, scan verdict, review stamps, deploy probe — and commits it; phase cannot close without the bundle
- [ ] Local hook tier measured <30s on this repo (time budget in CI test)
- [ ] bats coverage for: yaml parsing, baseline diff, suppression check, bundle assembly — green on all three platforms
- [ ] **macOS support** (from `/arc-change` 2026-07-09, ADR-0007 amendment): CI matrix adds `macos-latest` and goes green; portability audit confirms no `mapfile`/`readarray`, no associative arrays (`declare -A`), and no GNU-only util flags in any hook/script/adapter (bash-3.2-safe). Any offender rewritten to a portable form
- [ ] Live demo: introduce a new semgrep finding → blocked; baseline finding → passes; suppress with justification → passes; suppress without → blocked
- [ ] Tracker updated

## Rabbit holes in this phase

- Full yaml schema language (conditions, DAGs) → v1 is a flat list; orchestration is Phase 7
- Triage prompt tuning marathon → ship with the security-auditor zero-noise rule verbatim, tune in Phase 6 with eval data

## Out of scope for this phase

- New tools (3–4) · per-phase ratchet profiles (5) · eval scoring of triage (6)

## Your-setup / pending

- None (all local)
