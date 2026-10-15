# REQ-19 seal run: the radar runs once over the owner's registry, from the main clone

**Answer: YES** (2026-10-15). This is REQ-19's "at seal, from the main clone, the radar runs once over the owner's
registry and one `metric.observed` is found in `events/` with `_quarantine/` listed" clause.

## Preconditions

- The ceiling change landed: the owner ran `owner-apply-radar-policy.mjs` and committed it. It merged as PR #429
  (`77840115`) together with the two fixes CI asked for: the process and job face rooms (`engine-room`, `scheduler`,
  mirroring `launch-watch`), and `jobs-panel.bats` giving the radar a private state dir and an empty registry, since
  `catchup` runs every committed job for real. CI was 19/19 on head `63f4b8cd` (run 38624395624; the one red on
  attempt 1 was a `bench.run-model` CDP timeout on Windows shard 1, green on the rerun).
- The first real consumer: a fresh trial git project, initialised by `node bin/arc.mjs init --dir <trial project>`
  from the main clone. It wrote 671 files, every harness, under one v2 manifest, set `core.hooksPath`, and printed
  `registry: registered <trial project>`. `arc outdated --all` then read `1 project(s)`. The registry is
  `~/.arc-private/consumers.json`; its path never enters the repo.

## Run

From the main clone `E:/Work_Hub/01_Automemory/arc` on `main`, with no `ARC_RADAR_FORCE`:

```
$ node .claude/scripts/hq/jobs/distribute-radar.mjs
<trial project> · behind: untagged@dddfd0c9 · arc untagged@ccf18f8e · 1 commits behind
outdated --all: 1 project(s) · 1 behind · 0 up to date · 0 unmeasurable · 0 missing
distribute-radar: metric.observed 01M4Y4B7XPWXSFVC7NRFSYP62C · 1 of 1 behind · 0 unmeasurable · 0 missing
exit=0
```

(The consumer's path is replaced by `<trial project>` here, because the repo is public.) The trial project was
installed at `dddfd0c9` and the main clone stood at `ccf18f8e`, one commit later, so `1 behind` is the truth.

## Checks

- **The receipt is on the spine:** `01M4Y4B7XPWXSFVC7NRFSYP62C` is in `.claude/state/hq/events/2026-10-15.jsonl`.
  It has `kind: metric.observed`, `outcome: ok`, and payload `{module: distribute, surface: consumers, metric: behind,
  value: 1, unit_count: 1, source_id: radar-2026-10-15, window_start: 2026-10-08T02:45:55+05:30, window_end:
  2026-10-15T02:45:50+05:30}`.
- **No path in the payload:** a grep of the record for the trial project's name and for the drive path finds 0 matches.
- **`_quarantine/` listed:** it holds `2026-10-09.jsonl`, `2026-10-13.jsonl` and `2026-10-14.jsonl`. None of them
  holds the ULID.
- **It never wrote to a consumer:** `find` over the trial project (excluding `.git`) for files newer than the run's
  start finds 0.
- **The week stamp:** `.claude/state/distribute/.radar-last` = `2026-10-15`.

## Next fire

The job is `daily@07:45` with `catchup: skip`, and it acts once every 7 days. The daily fires from 2026-10-16 to
2026-10-21 print `not due (last acted 2026-10-15, every 7 days)`. **The next acting fire is 2026-10-22 07:45 IST.**
