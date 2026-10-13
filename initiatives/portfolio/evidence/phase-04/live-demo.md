# Phase 04 live demo -- the kernel freeze against the REAL canonical spine

Run 2026-10-14 from the linked worktree `arc-portfolio` (branch `feat/portfolio-cycle-5`), with
`ARC_SPINE_ROOT` unset, so the gate resolved the main clone's spine through `git --git-common-dir`.
The two lane headers were edited in the working tree only for the demo and restored byte-for-byte
from a copy afterwards (`git status` showed only the gate's own files).

Real ruling: `01M4VP8AMYJPMT1MZNQRB0FYY6` (approval.requested, gate owner-ruling), approved by
`decision.recorded` `01M4VPVKGNX9DMNWFEEZ57ZGJX`. Real `revenue.received` count on the spine: 0
(the gate prints `now 0`), so no receipt -- real or rehearsal -- can have lifted it.

| Lane | Header set to | Result |
|---|---|---|
| portfolio | Cycle 5 (this branch, vs origin/main Cycle 4) | no freeze line, `all checks passed` (exempt by name) |
| memory | `status: LIVE`, Cycle 99 | `FAIL  [kernel-freeze] lane memory is frozen by owner ruling 01M4VP8AMYJPMT1MZNQRB0FYY6 -- lifts when revenue.received >= 1 (now 0), a decision rejects it, or a later owner-ruling supersedes it` |
| distribute | `status: LIVE`, Cycle 3 | no freeze line (exempt as `distribute Cycle 3`) |
| distribute | `status: LIVE`, Cycle 4 | `FAIL  [kernel-freeze] lane distribute is frozen by owner ruling 01M4VP8AMYJPMT1MZNQRB0FYY6 (exempt only for Cycle 3; this is cycle 4) -- ...` |

Assumption A3 (the real ruling text parses under the three item shapes): **held** -- the real
`what` parsed; `engine (metered runs only)` and `distribute Cycle 3` both read as their shapes.
