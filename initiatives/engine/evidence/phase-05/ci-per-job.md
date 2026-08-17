# Phase 05 evidence — CI, read per JOB

The DoD says *"tests added & green **on CI, read per-JOB**, with the run's head SHA confirmed equal
to local HEAD"*. The watcher's exit code is not the evidence; the per-job conclusions are.

## The closing run

```
run       31966976814
head SHA  50a01486b329ab76f2b9baa3e0aef1b2a99c056b
overall   success
jobs      19 of 19 success, 0 failure, 0 skipped, 0 cancelled
created   2026-08-16T19:14:18Z
```

Per job:

| conclusion | job |
|---|---|
| success | ci-tier |
| success | selftest (ubuntu-latest, 18) |
| success | selftest (ubuntu-latest, 20) |
| success | selftest (ubuntu-latest, 22) |
| success | selftest (macos-latest, 20, shard 1/3) |
| success | selftest (macos-latest, 20, shard 2/3) |
| success | selftest (macos-latest, 20, shard 3/3) |
| success | selftest (windows-latest, 20, shard 1/12) |
| success | selftest (windows-latest, 20, shard 2/12) |
| success | selftest (windows-latest, 20, shard 3/12) |
| success | selftest (windows-latest, 20, shard 4/12) |
| success | selftest (windows-latest, 20, shard 5/12) |
| success | selftest (windows-latest, 20, shard 6/12) |
| success | selftest (windows-latest, 20, shard 7/12) |
| success | selftest (windows-latest, 20, shard 8/12) |
| success | selftest (windows-latest, 20, shard 9/12) |
| success | selftest (windows-latest, 20, shard 10/12) |
| success | selftest (windows-latest, 20, shard 11/12) |
| success | selftest (windows-latest, 20, shard 12/12) |

**Three OS legs**, and the count matters as much as the colour: a suite that fails to *gather* reports
its declared count against an executed count of 1 and takes its whole shard with it. Every engine
`.bats` file in this cycle carries a self-count test for that reason.

## Head SHA confirmed equal to local HEAD

```
local  HEAD        50a0148
run    31966976814 head 50a01486b329ab76f2b9baa3e0aef1b2a99c056b
```

Equal. This is checked rather than assumed because a green run against a stale SHA is the shape that
let this repo report a phase built while CI was red — twice.

## Earlier runs bearing on this phase

- **PR #184 merged as `9bd1443`, recorded 19/19 green** — the emit-path track: all three inline
  `--payload` call sites in `arc-run.mjs` now route through one `emitEvent` helper passing
  `--payload-file` and `--strict`.
- **PR #172 merged as `e324745`** — phases 04–05 complete, 06–07 partial.
- **Run `31941207679` at `d1014b5`, 19/19 per-JOB, zero skipped** — the Phase 04 close.

The pre-merge run IDs for #184 and #172 sit outside the API window this bundle was assembled from,
and are recorded in `PROGRESS.md` § Done log rather than re-derived here. The standing evidence for
Phase 05's code is the closing run above, which carries all of it.

## A recorded flake, not re-run away

`engine-driver-contract.bats` — *"REQ-04: a process whose own fixture fails its own schema is blamed,
not the driver"*. Observed 2026-08-13 on **byte-identical trees**: PASS in run `31744731535`
(21:14 UTC), FAIL in `31745770809` (21:28 UTC), PASS on rerun. It fails at the
`"fault_hint":"process"` grep, meaning the escalation receipt did not land. The test `mktemp -d`s a
directory, copies the whole `.claude/scripts` tree into it and runs `arc-run` against the copy, so it
is I/O-heavy and load-sensitive by construction.

Whether Cycle 7 widened its window is **UNKNOWN and is not assumed either way** — `--strict` raised
the emitter's spine-lock wait 2s → 15s and `EMIT_TIMEOUT_MS` 10s → 20s, both of which change the
timing of the emit this test depends on. Written down because a flake that is only ever re-run until
green is indistinguishable from a bug nobody caught.
