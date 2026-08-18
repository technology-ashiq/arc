# ADR 1305 — FACE-F: the Tape — as-of is a replay of the log, deterministic and read-only

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a sanctioned history source for file-borne truths appears (e.g. git
log through an owned parser) → the Tape may extend to files **by ADR, never before**
(assumptions ledger row 7). If the Phase 03 cursor fixture measures ≥1 s p95 @10k, the
Tape is cut to an as-of day picker (block B tripwire).

## Context

Replay wipes state and re-renders byte-identical — arc's replay determinism (E1) made
visible. Time can therefore be a first-class axis: scrub the company to any past day and
every spine-derived view re-renders honestly. File-borne truths (board, machine headers,
router, policy, jobs, council sessions) have **no** usable history — pretending otherwise
is pre-mortem row 6.

## Options considered

1. **As-of = replay of the log ≤ day; files always current + badged** — pros: honest by
   construction; testable (replay-identical fixture). Cons: two temporal regimes on one
   screen, needs the badge to be unmissable.
2. **Snapshot store for as-of file views** — cons: a second truth with its own history;
   exactly what ADR-1301 forbids.

## Decision

Option 1. The tape ruler is always present: ticks = days, a seal mark at every
`day.closed` (with `file_sha`), heavy seal at `month.closed`, flags for dated obligations
parsed from sanctioned files (council `Review-by:`, router/registry `review_by`, proving
weeks, feed clocks, guard checks, tripwires, kill lines at 50 % of appetite per live
lane). Drag the playhead back → the whole face is as-of that day for spine-derived views;
file-borne panels show the current file with a visible **"file, not log"** badge. Press
play → the day replays at 10×. Nothing about the tape can write. The replay-identical
fixture (`rm state.db && replay` → same JSON) is the acceptance.

## Consequences

Easier: "what happened yesterday" is a scrub, not a session; demos are honest. Harder:
every spine-derived view must be a pure function of (log, as-of) — no view-local caches
(pre-mortem row 2).
