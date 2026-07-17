# Phase 07 — Adversarial orchestration (cuttable)

**Goal (one line):** gates run in parallel, a saboteur agent actively attacks each phase before it closes, and cross-model quorum turns disagreement into signal.
**Appetite:** 2 weeks. **Explicitly cuttable** — deleting this phase does not weaken Phases 0–6.

## Exit criteria (Definition of Done)

- [ ] **Parallel gate execution**: review/audit/qa/design run as concurrent subagents from one command (`/arc-gate-all`), merge referee combines verdicts into a single ledger transaction
- [ ] **Saboteur agent** (`.claude/agents/saboteur.md`): before `/arc-phase-done`, red-teams the phase deliverable — edge inputs, race conditions, authz bypass attempts against the running app (agent-browser + curl); any successful break = phase blocked with reproduction steps
- [ ] Saboteur findings feed the Phase 6 corpus automatically (attack that worked = permanent eval case)
- [ ] **Cross-model quorum v1**: `/arc-second-opinion` extended — Claude + Codex verdicts recorded per finding category into stats (`.claude/state/quorum-stats.jsonl`); persistent disagreement categories surfaced in retro
- [ ] Saboteur respects freeze/destructive guards (it attacks the app, never the repo — PreToolUse hooks still bind it)
- [ ] Live demo: seeded race-condition bug survives review but saboteur catches it → phase blocked
- [ ] bats for referee merge logic + CI green
- [ ] Tracker updated

## Rabbit holes in this phase

- Gemini as third quorum model → two models this cycle; third is config, not code, later
- Saboteur autonomy creep → read+attack only, no code edits, hard tool whitelist

## Out of scope for this phase

- Accuracy-weighted quorum voting (needs Phase 6 data over time — next cycle) · saboteur for iOS/native (never — no-go territory)

## Your-setup / pending

- Codex CLI installed + authenticated (already used by `/arc-second-opinion`)
