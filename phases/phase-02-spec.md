# Phase 02 — Gate engine v1: manifest, baseline, suppression, evidence

**Goal (one line):** gates become declarative data (`arc.gates.yaml`) with the three noise defenses built in, and phase-close produces a committed evidence bundle — the moat becomes a product.
**Appetite:** 2 weeks. This is the highest-risk phase after 0: if noise defense fails here, everything after is dead (pre-mortem #1).

## Exit criteria (Definition of Done)

- [ ] `arc.gates.yaml` schema: per gate = `check` (command) + `mode` (block/warn/off) + `evidence` (artifact path) + `tier` (hook/ci); hooks read it via a generic gate-runner — zero hardcoded gate logic left in `PreToolUse.sh`
- [ ] **Baseline**: `arc-scan --baseline` freezes existing findings to `.claude/state/scan-baseline.jsonl` (one fingerprint per line, sorted, append-only); only NEW findings block
- [ ] **LLM triage v1**: triage agent filters merged SARIF — drops <8/10-confidence findings with reason logged; can only downgrade, never invent blocking findings (PLAN rabbit hole #6)
- [ ] **Suppression ledger**: `docs/suppressions.md` — suppressing a finding requires an entry (fingerprint + justification + date); gate-runner cross-checks, unjustified suppression = block
- [ ] **Evidence bundles**: `/arc-phase-done` writes `docs/evidence/phase-NN/` — test output hash, coverage/mutation JSON, scan verdict, review stamps, deploy probe — and commits it; phase cannot close without the bundle
- [ ] Local hook tier measured <30s on this repo (time budget in CI test)
- [ ] bats coverage for: yaml parsing, baseline diff, suppression check, bundle assembly — green both platforms
- [ ] Live demo: introduce a new semgrep finding → blocked; baseline finding → passes; suppress with justification → passes; suppress without → blocked
- [ ] Tracker updated

## Rabbit holes in this phase

- Full yaml schema language (conditions, DAGs) → v1 is a flat list; orchestration is Phase 7
- Triage prompt tuning marathon → ship with the security-auditor zero-noise rule verbatim, tune in Phase 6 with eval data

## Out of scope for this phase

- New tools (3–4) · per-phase ratchet profiles (5) · eval scoring of triage (6)

## Your-setup / pending

- None (all local)
