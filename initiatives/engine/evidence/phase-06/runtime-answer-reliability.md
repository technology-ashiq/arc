# Phase 06 → Phase 08 — can the runtime actually do the job?

REQ-07 is this cycle's central claim: *"the process runs through the runtime **≥3 times** on arc's
own build-out journey"*, and that clause is named **uncuttable**. So whether the runtime can satisfy
a real process schema at all is a Phase 08 blocker measured here, not discovered there.

## Round 1 — five runs, five different shapes of wrong

One pinned prompt, `llama3.1:8b` via the container, 2026-08-16:

| run | what came back |
|---|---|
| 1 | the correct JSON |
| 2 | *"Example Domain" is the title of the page* — it browsed |
| 3 | `write_file` denied, reported as the answer |
| 4 | `write_file` denied again |
| 5 | a bash syntax error, wrapped in JSON |

**The parser was never the problem.** `drivers/hermes` extracted exactly what the runtime produced,
every time. The answer was wrong, not the reading of it.

## The cause was ours, and it was invisible until arc-run forwarded the transcript

```
[config-migrate] WARNING: This config predates version 12 (~2 years old) and can no longer be
auto-migrated. Back up /opt/data/config.yaml and run `hermes setup` to regenerate, or manually
set _config_version: 12 after reviewing the changelog.
```

`config.yaml` was hand-written from Phase 04's evidence with **no `_config_version`**, so the
runtime treated it as ~2 years stale and could not migrate it. The erratic behaviour above is what a
runtime does when its configuration did not take.

**That line was on the container's stderr the whole time, and arc threw it away** — the transcript
was discarded on every successful run until this same session forwarded it. The isolation fix and
this diagnosis are the same fix: a trail you do not keep is a trail nobody reads.

With `_config_version` set, the runtime **auto-migrated to version 33** and expanded the file with
its own defaults. The warning is gone.

## Round 2 — clean config, and the honest result is still a fail

`arc-run --process commit-msg-draft --driver hermes --budget min=10`, real container:

- **exit 1**, `reason: driver`
- `arc-run: output failed the contract ($.commits: required property is absent); retrying once`
- then ADR-0204's ladder: one same-tier retry, then a proposal receipt. Working exactly as designed.
- **wall-clock: 599 seconds** for the pair.

So the runtime now runs cleanly and **an 8B local model does not produce the shape a real arc
process requires**, at roughly five minutes an attempt.

## What this means for Phase 08, stated before it is planned rather than after it overruns

1. **The three real runs should NOT be dispatched against local `ollama`.** Two attempts cost ten
   minutes and produced nothing schema-valid. Three runs plus retries on this path is most of a day
   for an unknown chance of a usable draft.
2. **OpenRouter's free tier is the better target, and it is already proven reachable** on the
   unfunded capped key (HTTP 200, `evidence/phase-06/fixture-10-capped-key.md`). Better models,
   faster, and still **zero spend**. The pinned slug must carry the date it was verified — 16 of 413
   models are `:free` today and two the plan itself named are already gone.
3. **`commit-msg-draft` was the wrong probe and that is not the runtime's fault.** It wants git
   context the container does not have, so the model had nothing to draft from. Phase 08's own
   process (`build-in-public-draft`) supplies its material through the context pack, which is a
   fairer test — but this measurement says to build that process against a hosted model from the
   start.
4. **REQ-05's class budgets have their first real data point:** ~300s per attempt on this path, and
   the ladder doubles it. A budget written before these receipts existed would have been a guess.

## What is NOT concluded here

- **Not that the runtime cannot do the job.** It was measured on one stale-configured local 8B model
  against a process needing context it was never given. That is three confounds, and each is
  removable.
- **Not that a hosted free model will succeed.** That is the next measurement, and it belongs to
  Phase 08 rather than to a session that happened to be nearby.
