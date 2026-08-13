# ADR 0805 — the idempotent multi-day roll lives in the job, because `close-day` is neither

**Status:** accepted
**Date:** 2026-08-12
**Product:** `scheduler`
**Reversibility:** two-way
**Revisit trigger:** `arc-event close-day` grows a `--roll` or `--since` mode in the hq lane — the job's loop then collapses to one call and this ADR is superseded.

## Context

SCH-I job #2 specifies `day-close-roll` at `daily@00:15` with `catchup: run`, which "seals the
most recent UNSEALED day(s)" and is described as "idempotent + multi-day so slept-through nights
are caught up (ADR-0029 day-close sha — **exact CLI verified at kickoff**)".

Verified. The CLI is `node .claude/scripts/hq/arc-event.mjs close-day [--date YYYY-MM-DD]`
(`arc-event.sh` is the thin entry). Its actual behaviour differs from the plan's assumption in
three ways, each of which would have produced a job that fails nightly:

1. **Not idempotent.** `closeDay` throws `DAY_CLOSED` when the day already has a `.closed`
   marker. A second run over an already-sealed day is an error, not a no-op.
2. **Refuses an empty day.** It throws `NO_DAY` when the day file does not exist. A quiet day
   with zero events — a weekend, a holiday — *cannot be closed at all*. A naive job would exit
   non-zero every such night and raise an incident for a machine that was simply idle.
3. **Single day only.** It closes exactly the one day given. There is no roll. After a
   three-day gap, one invocation seals one day and leaves two sealed-never.

Combined with ADR-0804 (no wake, seal lands at next wake), multi-day is not an edge case here —
it is the expected weekend path.

## Options considered

1. **Add `--roll` / `--since` to `arc-event close-day`** — pros: the capability lands where the
   day-close logic already lives, once, for every caller. Cons: `arc-event.mjs` is the spine's
   own emitter in the hq band; changing it is a cross-lane diff to the most safety-critical
   file in the repo, for one consumer, inside a 3-day appetite.
2. **The job walks the days and calls the CLI per day** — pros: zero change to spine code; the
   loop is ordinary logic in a script this lane owns; `listDays()` and `isDayClosed()` are
   already exported from `lib/spine-io.mjs`. Cons: a second place that knows what "unsealed"
   means.
3. **The job calls `close-day` once for yesterday and ignores failures** — pros: trivial.
   Cons: swallowing `DAY_CLOSED` and `NO_DAY` alongside real failures means a genuinely broken
   seal reports success. This is the vacuous-pass shape.

## Decision

**Option 2.** `day-close-roll` enumerates candidate days via `listDays()`, skips any with
`isDayClosed()` true, skips today (its events are not complete), and calls `close-day --date D`
for each remaining day oldest-first.

`DAY_CLOSED` and `NO_DAY` are classified as **benign and distinguishable** — each is counted and
reported in the receipt payload, never merged into a generic success and never merged into a
failure. Any other error is a real failure and raises `incident.raised` per SCH-E.

The reason that carried the most weight: option 3's failure mode is the one this repo has
shipped three times — a pass that proves the assertion held rather than that the code ran. A
seal that "succeeded" because the day was empty and a seal that succeeded because it sealed
must not produce the same receipt, so the job counts `sealed`, `already_sealed` and `empty`
separately and the fixture asserts on those counts rather than on exit 0.

**Evidence:** `.claude/scripts/hq/arc-event.mjs:273-309` (`closeDay`: `DAY_CLOSED` on
`isDayClosed`, `NO_DAY` on a missing day file, single `--date`, event `ts` pinned to
`<day>T23:59:59+05:30`, `withLock` held across the seal) and `:321,327-332` (the `close-day`
subcommand and its usage string); `.claude/scripts/hq/lib/spine-io.mjs:252` (`isDayClosed`),
`:346` (`writeCloseMarker`), `:350` (`listDays`). Read 2026-08-12.
**Confidence:** high
**Rejected because:** option 1 — a cross-lane diff to the spine emitter for one consumer, out of
appetite; option 3 — indistinguishable benign and real failures is the vacuous pass.

## Consequences

**Easier.** No spine code changes. A slept-through weekend seals three days in one run, in
order, and the receipt says how many of each class — so "nothing to do" and "did the work" are
different facts on the spine rather than the same exit code.

**Harder.** Two files now know what "unsealed" means: `spine-io.mjs` (which owns the marker) and
this job (which owns the walk). The job imports `isDayClosed` and `listDays` rather than
re-deriving them, so the knowledge is borrowed rather than copied — but the *ordering* rule
(oldest first, never today) lives only here and needs its own fixture.

**What we would revisit if this goes wrong.** If a second consumer ever needs the roll, option 1
becomes correct and this loop moves into the CLI rather than being duplicated — the trigger
above is written so that move is a supersede, not a rediscovery.
