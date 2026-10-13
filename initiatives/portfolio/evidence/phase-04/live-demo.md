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

## Attack round 1 (arc-attack @ 2df81d4) -- logic deepseek-v4-flash, boundary claude-code

Logic 10 (2 high, 4 medium, 4 low), boundary 7 (2 high, 3 medium, 2 low). Fixed: B1, B2, B3, B4, B5,
B6, L3, L4 (L7 is B1), each pinned in `tests/portfolio-kernel-freeze.bats` (round-1 cases) and added to
`fixed-defects.md` (h)-(m). Rejected (ADR-0067):

```
REJECTED: L1 same Cycle N with amended prose reads as the same cycle -- already-covered
REJECTED: L5 "(Cycle 2 extra)" folds to the same identity -- already-covered
REJECTED: L2 "launch, and growth" yields an empty item -- unsupported
REJECTED: L6 nested parentheses in a note fail closed -- non-actionable
REJECTED: L8 unreadable PROGRESS treated as not-live -- non-actionable
REJECTED: L9 a revenue receipt with no markers counts as real -- already-covered
REJECTED: L10 torn spine lines are skipped -- out-of-appetite
REJECTED: B7 ARC_SPINE_ROOT resolved against cwd -- duplicate
```
(L1/L5: ADR-0076 defines identity as the `Cycle N` token on purpose, kickoff attack finding 2. L2: `,? and `
is replaced before splitting, pinned by the grammar-variants case. L6: failing closed is the ruling
grammar's safe direction. L9: ADR-0077 counts real money as the default. B7 mirrors `spine-io.mjs`.)
