# arc-council — retro (Phase 3)

> Scoped, self-contained (kept out of arc's root `docs/retro-log.md` for isolation). On merge to main,
> port the "Retro-log line" into root `docs/retro-log.md`.

## Friction findings

| # | Pattern (what bit us) | Prevention | Recurring? |
|---|---|---|---|
| F9 | The decision statement carried a **load-bearing ambiguous term** — "trains on users' documents" (shared-model *Regime A* vs per-tenant *Regime B*). Members graded **different products**: the AGAINST bench analyzed the worst reading, the FOR bench quietly re-specified the safe one, and they talked past each other. The verifier caught it (flagged the brief-framing bias), but intake should have disambiguated it first. | Strengthen the Chair's intake (command step 1) to **disambiguate a load-bearing ambiguous term before fan-out** — pick a reading, or state both and evaluate one. **Applied this retro** (command updated). | yes |

**Validated (no new finding):** F6 (Phase 2 lesson — a new subagent isn't registered until a turn boundary)
was **applied correctly** this phase: the 7 domain experts were built in one turn and dogfooded in the
*next* turn after they registered — zero "agent type not found" errors. The prevention works.

## Retro-log line (port to root `docs/retro-log.md` on merge)
```
2026-07-15 | arc-council | a load-bearing ambiguous term in the decision statement made members grade different products | Chair intake must disambiguate ambiguous terms (pick a reading or state both) before fan-out | council,intake,framing
```

## Applied this retro (deliverable refinement — my file, structure-safe)
- `.claude/commands/arc-council.md` step 1 (Intake) now disambiguates a load-bearing ambiguous term before
  the research fan-out. This is a change to the arc-council deliverable (not arc-core, not existing structure).

## Steps not applicable this retro
- **Scoreboard row:** skipped — Phase 3 is not the project's final phase (Phase 4 is).
- **Trial-gate promotion:** no `kickoff-lint` run this phase.
