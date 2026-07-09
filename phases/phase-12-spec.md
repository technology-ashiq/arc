# Phase 12 — Policy pack v1 (OWASP ASVS)

<!-- Next cycle. Depends on: Phase 10 (passport `control_refs`). ADR-0012. -->

**Goal (one line):** `arc enable asvs` overlays required gates + thresholds and annotates passports with ASVS control IDs, producing an auditor-readable per-control evidence table — evidence mapping, never a compliance claim.
**Appetite:** 1.5 weeks.

## Exit criteria (Definition of Done)

- [ ] Pack format: `.claude/policy-packs/<pack>.yaml` — required gates, minimum thresholds (profile overlay, ratchet rules apply), gate→control-ID map, framework version pin
- [ ] `asvs.yaml` v1: mapping for the gates arc already runs (SAST, secrets, SCA, mutation, review ledger) to ASVS chapters — unmapped controls listed as `not-covered`, never omitted
- [ ] Enabling a pack populates passport `control_refs` + adds per-control evidence table to the bundle report
- [ ] Wording guard: report template says "evidence contributing to <framework> control <ID>"; bats test asserts banned strings ("compliant", "compliance achieved") never appear in pack output
- [ ] Pack thresholds below the active profile → ratchet violation, blocked (Phase 5 rule)
- [ ] Live demo: enable asvs → close a phase → passport shows control refs + report shows evidence table with covered/not-covered split
- [ ] bats + 3-OS CI green; tracker updated

## Rabbit holes in this phase

- Full ASVS coverage completionism → map what gates actually evidence; `not-covered` is an honest, acceptable answer
- PCI/SOC2 scope creep → SOC2 CC-series is the designated next pack, separate phase; PCI/ISO only ever as evidence contribution

## Out of scope for this phase

- SOC2/PCI/ISO packs · pack marketplace/distribution (Phase 8 material) · any "certification" language

## Your-setup / pending

- None
