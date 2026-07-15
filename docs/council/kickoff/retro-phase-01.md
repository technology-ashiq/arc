# arc-council — retro (Phases 0–1)

> Scoped, self-contained retro for the arc-council build. Kept here (not arc's root `docs/retro-log.md`)
> to stay isolated. **On merge to main:** port the three recurring-pattern lines under "Retro-log lines"
> into root `docs/retro-log.md` so future `/arc-kickoff` runs seed their pre-mortem from them.

## Friction findings

| # | Pattern (what bit us) | Prevention | Recurring? |
|---|---|---|---|
| F1 | Scoped tracker put under a `build/` dir was silently gitignored (`.gitignore` `build/` glob) → had to rename to `kickoff/` + fix PLAN paths | `git check-ignore <path>` before committing a new tracked dir; avoid `build/dist/out/tmp` names for tracked folders | yes |
| F2 | Literal `<angle-bracket>` tokens (`<question>`, `<q>`, `<slug>`) in PLAN prose false-failed kickoff-lint's `hasContent` placeholder detector (2 false FAILs) | no literal `<x>` in required PLAN sections — use backticks or `"…"` | yes |
| F3 | End-of-phase `/arc-retro` was skipped until the user prompted it | run `/arc-retro` at each phase close, not only at project end | yes |

**Already captured in memory (no further action):**
- F4 — used Tamil-script words despite the romanized-Tanglish preference → `user-communication-tanglish` updated (Latin script only).
- F5 — commit discipline (only my files, no auto-push) + auto-commit-per-phase cadence → `arc-git-push-deny-gh-ok` updated.

## Retro-log lines (port to root `docs/retro-log.md` on merge)
```
2026-07-15 | arc-council | scoped kickoff tracker under a build/ dir was silently gitignored | git check-ignore before committing a new tracked dir; avoid build/dist/out/tmp names | scope,git,kickoff,tooling
2026-07-15 | arc-council | literal <angle-bracket> placeholders in PLAN prose false-failed kickoff-lint hasContent | no literal <x> in required PLAN sections (backticks or "…") | kickoff,lint,plan
2026-07-15 | arc-council | end-of-phase /arc-retro skipped until user prompted | run /arc-retro at each phase close, not only project end | process,retro
```

## Deferred arc-core upgrades (do NOT mix into the arc-council branch)
Route each via a separate `/arc-change` on arc itself, later — they touch arc's own files:
- **F2 fix:** tighten `hasContent()` in `.claude/scripts/kickoff-lint.mjs` so backtick-wrapped/inline-code `<...>` isn't read as an unfilled placeholder (needs a `tests/kickoff-lint.bats` fixture).
- **F3 reminder:** add a line to `CLAUDE.md` build-process rules — "close a phase, then run `/arc-retro <n>` before the next phase."
- **Trial-ledger:** log the 8 substance-gate clean runs from the arc-council PLAN (`9cbeb1d`) into `docs/trial-ledger.md`. Nothing promotable yet (this is ~run #1; promotion needs ≥3 clean runs + a bats fixture).

## Steps not applicable this retro
- **Scoreboard row:** skipped — Phase 1 is not the project's final phase (scoreboard is project-retro only).
- **Trial-gate promotion:** none promotable (see above).
