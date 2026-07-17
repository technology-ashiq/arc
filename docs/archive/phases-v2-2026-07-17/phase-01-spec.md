# Phase 01 — Credibility & hygiene

**Goal (one line):** every documented-but-unwired gap closed and enforcement on by default — arc stops preaching what it doesn't practice.
**Appetite:** 1 week.

## Exit criteria (Definition of Done)

- [ ] `settings.json` defaults flip: `coverageMode:"block"`, `docsGate:"block"`, `ARC_REQUIRED_REVIEWS` documented default `code,security` (ADR-0008 — block by default, warn is the opt-in downgrade)
- [ ] Strictness profiles exist (`starter` / `standard` / `strict`) — one settings key switches gate modes as a set, so block-by-default has a sanctioned escape hatch
- [ ] `/arc-review` auto-stamps the `code` ledger kind on verdict (closes the known usermanual §8 gap)
- [ ] Cross-platform sync: bash equivalent of `sync-to-project.ps1` (rsync/cp based), bats-tested; PowerShell script kept but no longer the only path
- [ ] Repo hygiene: `.writetest*`, `.wt` stray files removed; `agent-browser-integration.md` status updated from PROPOSED to SHIPPED; `.mcp.json` playwright-removal note resolved (keep-or-remove decided)
- [ ] usermanual + README + how-it-works updated to match new defaults (docs-drift gate must pass — dogfood)
- [ ] bats tests for profile switching and code-stamp wiring, green in CI
- [ ] Tracker updated

## Rabbit holes in this phase

- Rewriting sync as a full installer CLI → NO; plain bash script this phase, `create-arc` installer is Phase 8
- Tuning profile contents endlessly → starter=warn-all, standard=block core, strict=block all + required reviews; done

## Out of scope for this phase

- New tools (3–4) · gates.yaml (2) · plugin packaging (8)

## Your-setup / pending

- Decide your own default profile (recommend `standard`)
