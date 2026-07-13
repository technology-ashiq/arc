# PLANOFF-01 — protocol

> The point of this file is that the result survives the accusation *"you rigged it for arc."*
> Every rule here exists to remove a way the bench could flatter the home team.

## The five arms

| Arm id | System under test | Setup |
|---|---|---|
| `arc` | `/arc-kickoff` → Golden Loop | Full arc mold synced into the repo (CLAUDE.md, hooks, commands, agents) |
| `raw` | Vanilla Claude Code | **No** CLAUDE.md, **no** hooks, **no** commands, **no** agents, **no** plugins. Empty `.claude/`. Control group. |
| `gsd` | `open-gsd/gsd-core` | Installed per its own npm installer; run its native loop (`/gsd-spec-phase` → … → `/gsd-ship`) |
| `gstack` | `garrytan/gstack` | Installed globally per its README; run its native loop (`spec` → `autoplan` → build → `review` → `ship`) |
| `superpowers` | `obra/superpowers` | Plugin installed; run its native loop (`brainstorming` → `writing-plans` → `subagent-driven-development` → `verification-before-completion`) |

Each arm gets its **own empty git repo**: `planoff-01-<arm>`. Never reuse a repo. Never let an arm
see another arm's code, plan, or transcript.

## Fairness rules — all of them are load-bearing

1. **Same model, same settings, same week.** Record the model string in `run.json`. If the model
   changes mid-bench, every completed arm is void.
2. **Fresh session per arm.** No memory carry-over, no `/resume`. Clear or scope the memory dir.
3. **Verbatim prompt.** Paste `goal.md` between the PROMPT markers. Nothing else.
4. **Randomised arm order.** Roll a die, write the order into `RESULTS.md` *before* starting.
   You learn the task by running it — running `arc` last would hand it your accumulated knowledge.
   (Equally: running it first would hand it your ignorance. Randomise, then stop arguing with it.)
5. **Fixed nudge only.** If an arm stalls or asks to continue, you may say exactly: `continue`.
   Any other steer is an intervention — log it in `evidence/interventions.md`; each one costs the
   arm 5 points on `cognitive load`.
6. **Hard cap: 90 minutes wall-clock OR 60 assistant turns, whichever comes first.** At the cap you
   stop, whatever state it's in, and grade what exists. A planner that produces a beautiful plan and
   no working app has lost — that is the finding, not an unfairness.
7. **Don't fix its bugs.** Not even the trivial ones. Not even to "let the acceptance suite run."
   If the app won't boot, acceptance = 0% and you write down why.
8. **Seal the traps.** Do not open `traps.md` until the last arm has finished. If you know the traps
   you will unconsciously prompt toward them.
9. **Blind scoring.** Rubric scoring happens after all arms finish, from `evidence/` alone, with the
   arm name replaced by a letter (see `scoring/rubric.md` § Blinding). Auto-metrics can be collected
   un-blinded — they're machine-read.
10. **Everything is evidence or it didn't happen.** No score may be justified by a memory of the
    session. If it isn't in `runs/<arm>/evidence/`, it doesn't count.

## Per-arm run procedure

```
1.  mkdir planoff-01-<arm> && cd planoff-01-<arm> && git init
2.  Install ONLY that arm's system. Verify no other planner's files are present.
3.  Start Postgres (docker: postgres:16, empty db `snip`). Same image for every arm.
4.  Start the clock. Paste the prompt verbatim.
5.  Drive the arm through ITS OWN native loop. Do not import arc's habits into gsd's run.
6.  Stop at: the arm says it's done, OR the hard cap.
7.  Capture evidence (below), then run the acceptance suite. Never the other way round —
    the arm must never see the suite.
```

## Evidence to capture — `runs/<arm>/evidence/`

| File | What |
|---|---|
| `plan.md` | The arm's plan **as first written**, before any code. This is the artefact the whole bench is about — capture it even if the arm never wrote one to disk (then note: *plan existed only in chat*, which is itself a finding). |
| `transcript.md` | Full session transcript. |
| `git-log.txt` | `git log --stat --date=iso` from the arm's repo. |
| `done-claims.md` | Every point at which the arm asserted the work was done/complete/passing, with a timestamp and what was actually true at that moment. |
| `questions.md` | Clarifying questions the arm asked (empty file if none). |
| `interventions.md` | Every operator input that was not the verbatim prompt or `continue`. |
| `acceptance.txt` | Raw stdout of the acceptance suite. |
| `scanners.txt` | `semgrep`, `gitleaks`, `osv-scanner` output against the arm's repo. |
| `run.json` | Machine facts: model, start/end time, turns, tokens in/out, cost, arm, repo path. |

`run.json` shape:

```json
{
  "arm": "arc",
  "bench": "PLANOFF-01",
  "model": "claude-opus-4-8",
  "started_at": "2026-07-13T09:00:00Z",
  "ended_at":   "2026-07-13T10:12:00Z",
  "turns": 41,
  "tokens_in": 812000,
  "tokens_out": 96000,
  "cost_usd": 14.20,
  "repo_path": "E:/Work_Hub/planoff-01-arc",
  "stopped_by": "arm-declared-done | hard-cap",
  "interventions": 0
}
```

## Postgres — identical for every arm

```bash
docker run --rm -d --name planoff-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=planoff -e POSTGRES_DB=snip postgres:16
```

Recreate the container between arms so no arm inherits another's schema.

## Void conditions

The run is void (re-run it) if: the model changed mid-bench · you intervened with real help ·
the arm saw the acceptance suite or `traps.md` · Postgres carried state across arms ·
you scored un-blinded.
