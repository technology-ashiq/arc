# Phase 08 — Distribution (NEXT CYCLE — placeholder spec)

**Goal (one line):** arc leaves bus-factor-1 — installable, documented in English, with a pre-registered public benchmark backing the "measured" claim.
**Appetite:** next cycle, own kickoff — this spec is a parking lot, not a commitment.

## Exit criteria (Definition of Done) — draft

- [ ] Claude Code **plugin packaging** (marketplace format) + `create-arc` one-command installer (replaces bash/PS sync scripts)
- [ ] English docs site: 10-min quickstart, gate-engine reference, ratchet guide; Tanglish usermanual stays as-is internally
- [ ] Example repo: seeded project showing a full Golden Loop cycle with evidence bundles committed
- [ ] **Public pre-registered benchmark**: "identical tasks, arc gates vs no gates — escaped defect rate", methodology published BEFORE results (gstack changelog discipline)
- [ ] Opt-in telemetry: which gate catches which finding class (privacy: fingerprints only, no code)
- [ ] Eval scorecard published per release (Phase 6 output, now ≥30-bug threshold met)
- [ ] **Engine/adapter split executed** (ADR-0013): `engine/` (gates, scan, ledgers, evidence, CI — zero Claude assumptions) + `adapters/claude/` (commands, agents, hooks wiring); split is `git mv` + path updates because the writing rule held since ADR-0013
- [ ] **AGENTS.md mirror** of CLAUDE.md project rules (cross-harness instruction standard — Codex/Cursor/Gemini readable); Claude Code stays the full-experience driver
- [ ] Engine-only quickstart documented: git hooks + CI enforcement with NO AI harness (proves AI-agnostic claim)

## Rabbit holes

- Marketing site before the benchmark exists → benchmark first, site after
- Telemetry scope creep → fingerprint counts only, nothing else, ever
- GSD-style per-runtime converter → refused (ADR-0013); Superpowers-style packaging (shared prose + per-harness manifest) only. A second-harness *driver* port waits for demand evidence

## Out of scope

- Team mode / multi-user sync (evaluate after first external users exist)
- SonarQube adapter (revisit on user demand)

## Your-setup / pending

- Public GitHub repo decision (license: MIT like gstack, or source-available — needs an ADR)
