# PROGRESS.md — design (no live cycle)

status: IDLE
cycle: arc-design (Cycle 3, closed 2026-07-30)
phase: — (no live cycle)
appetite: —
burn: —
blocked-on: —
depends-on: —

## Now

**Position:** no cycle is running in this lane. Cycle 3 · arc-design closed 2026-07-30;
its whole past is reachable from [`HISTORY-INDEX.md`](HISTORY-INDEX.md), which links to the
frozen records rather than copying them (ADR-0058).

**Why this file exists at all:** the board is a VIEW whose values derive from each lane's
machine header and nothing else (ADR-0051) — a `design` row on `PORTFOLIO.md` with no
header to derive from would be a hand-written second truth, exactly what that ADR forbids.
That is the whole reason, and [ADR-0062](../../docs/adr/0062-port-i-amendment-a-board-row-needs-a-machine-header.md)
ratifies it: a lane on the board carries a machine header even with no live cycle.

This file is **not** what keeps the lane out of the eligible set — an earlier version of
this note claimed it was, and that was wrong. `lane-resolve.sh` counts every validly-named
directory under `initiatives/` as a known lane whether or not it holds a `PROGRESS.md`, and
eligibility comes only from `status: LIVE` or `BLOCKED`; deleting this file would keep
`design` ineligible just as well. It is load-bearing for the board, not the resolver.

**Next:** `/arc-kickoff --lane design` when a new design cycle starts. Nothing is pending
here otherwise.

blocked-on: —
depends-on: —
