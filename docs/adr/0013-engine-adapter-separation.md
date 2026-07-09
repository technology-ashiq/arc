# ADR 0013 — Engine/adapter separation: principle now, physical restructure at Phase 8

**Status:** proposed · 2026-07-10

## Context
arc is two products in one repo: an AI-agnostic **engine** (gate-runner, arc-scan/SARIF,
baselines, ledgers, evidence/passports, bats, CI — bash/yaml/git, ~80–90% of the moat) and a
Claude Code–specific **driver** (slash commands, subagents, hooks wiring, prompt templates).
Multi-tool support (Cursor, Codex, Gemini…) means porting only the driver. Fork: restructure
into `engine/` + `adapters/<tool>/` now, or defer?

## Options considered
1. **Physical restructure now** — pros: clean layout early; cons: repo-wide path churn mid-cycle
   (hooks, CI, bats all reference current paths), violates the "no distribution work before
   Phase 8" no-go, and it's an adapter pattern with ONE adapter — the boundary would be guessed,
   not derived. Rule of three: extract the abstraction when the second concrete case exists.
2. **Principle now, restructure at Phase 8** — pros: zero churn, boundary gets drawn when the
   second adapter's real requirements are known, ecosystem standards (AGENTS.md) mature meanwhile;
   cons: discipline is advisory until the split — mitigated by a reviewable writing rule.

## Decision
Option 2. Standing writing rule, effective immediately for all new/changed code:
**engine code (`.claude/scripts/`, `arc.gates.yaml`, CI workflows, evidence/passport schemas)
must not assume Claude** — no Claude-specific env/paths/prompt refs; anything prompt- or
harness-shaped lives only in `commands/`, `agents/`, `hooks/` wiring, `rules/`, `skills/`.
code-reviewer checks this on touched files. Physical `engine/` + `adapters/` split, AGENTS.md
mirror, and any second-harness adapter are Phase 8 exit criteria (Superpowers-style packaging,
not a GSD-style converter — solo-maintainer budget).

## Consequences
+ Phase 8 split becomes `git mv` + path updates — design debt paid continuously, not in one lump.
+ Phases 09–12 outputs (confidence.json, passport.json, findings ledger) are born AI-agnostic.
+ Adapter boundary will be drawn from evidence (a real second harness), not speculation.
− Until Phase 8, separation is convention-enforced (review), not structure-enforced.
− A second-harness user before Phase 8 gets engine-only (git hooks + CI); driver UX stays
  Claude Code–only until then — accepted.
