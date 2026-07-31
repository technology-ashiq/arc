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
`status: IDLE` also keeps the lane out of the eligible set, so a repo with one live cycle
still auto-resolves to it.

**Next:** `/arc-kickoff --lane design` when a new design cycle starts. Nothing is pending
here otherwise.

blocked-on: —
depends-on: —
