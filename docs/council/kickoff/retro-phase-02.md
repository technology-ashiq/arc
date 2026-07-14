# arc-council — retro (Phase 2)

> Scoped, self-contained (kept out of arc's root `docs/retro-log.md` for isolation). On merge to main,
> port the "Retro-log lines" into root `docs/retro-log.md` so future `/arc-kickoff` seeds its pre-mortem.

## Friction findings

| # | Pattern (what bit us) | Prevention | Recurring? |
|---|---|---|---|
| F6 | A newly-created `council-*` agent is NOT a registered `subagent_type` until a turn boundary — create-and-same-turn-spawn fails with "agent type not found". Bit us at the start of the Phase 2 dogfood. | After writing a new subagent, let a turn boundary pass before spawning it. **Critical for Phase 3** (adds 7 new agents): create them, then dogfood in a *later* turn. | yes |
| F7 | An `Edit` on `council-lint.mjs` failed because `old_string` carried an en-dash (`–`) and a guessed indentation (6 vs 4 spaces). | When `Edit` mismatches on a line with unicode / tricky whitespace, re-`Read` the exact line and match a smaller unique substring that avoids the ambiguous characters. | minor |
| F8 | The Chair's brief-assembly compressed a researcher's correct fact (actix-web 4.14.0) into a wrong one ("Actix pre-1.0"), which all 3 members then inherited. | Keep brief facts faithful to the researcher's stated specifics; don't over-compress version/number claims. **Mitigation already worked** — the verifier caught it, validating the "verifier flags brief-bias" design. | yes (mitigated) |

## Retro-log lines (port to root `docs/retro-log.md` on merge)
```
2026-07-15 | arc-council | a newly-created subagent isn't a registered subagent_type until a turn boundary; same-turn create-and-spawn fails | create new agents in one turn, spawn/dogfood them in a later turn | agents,tooling,build
2026-07-15 | arc-council | Chair over-compressed a researcher fact into an error the whole panel inherited | keep brief facts faithful to researcher specifics; the verifier is the backstop | council,research,verify
```

## Deferred arc-core upgrade (route via /arc-change on arc, off this branch)
- Fold F6 into the build-playbook / CLAUDE.md: "when a build adds subagents, create them, then spawn/dogfood
  them in a *later* turn — the agent registry refreshes at turn boundaries." Add to the existing deferred
  arc-core task chip (task_27cb6e63).

## Steps not applicable this retro
- **Scoreboard row:** skipped — Phase 2 is not the project's final phase.
- **Trial-gate promotion:** no `kickoff-lint` run this phase (no new PLAN), so nothing to log.
