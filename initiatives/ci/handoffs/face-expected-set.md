# Handoff -- face: expected-set rows for ci Phase 01 (ci ADR-2201, ADR-2204)

**Status:** APPROVED 2026-10-24 (go-ahead below). ci's workflow adds and
deletes do not start until it is recorded here.

**Why ci edits a face file:** face's contract fails a PR whose workflows and rows disagree. A face-only PR
would add rows for files that do not exist yet, and ci's PR would be red until those rows exist; neither could
go green first (ci attack B2). So the edit lands on ci's branch, in ci's PR, with face's approval.

## Paste into a face session

```
/arc-change --lane face ci lane Phase 01 replaces three workflows. Approve that the ci branch
(feat/ci-p01-local-first) edits initiatives/face/contracts/expected-set.json in its own PR:
add "workflow:weekly": "review-ship" and "workflow:release": "review-ship"; drop
"workflow:measure-windows-cost", "workflow:shard-calibrate" and "workflow:weigh-tests"; then
node .claude/scripts/core/face-sections.mjs and commit rooms.generated.json. No face code changes.
Record the go-ahead (date + approval id) in initiatives/ci/handoffs/face-expected-set.md.
```

## Go-ahead

- **APPROVED 2026-10-24** by the owner in a face session (`/arc-change --lane face`, session
  `9d77e294-c6c7-4b4b-974e-911053c604cc`; recorded in face `PROGRESS.md` `## Now`). No spine receipt: a worktree
  cannot emit one, and no gate reads this line.
- Scope is exactly the edit above: add `workflow:weekly` and `workflow:release` (both `review-ship`), drop
  `workflow:measure-windows-cost`, `workflow:shard-calibrate` and `workflow:weigh-tests`, run `face-sections.mjs`,
  and commit `rooms.generated.json`. No face code changes.
- `feat/ci-p01-local-first` merged as #463 before this was recorded, so the approval covers whichever ci Phase 01 PR
  deletes the three workflows. The rows must land in that same PR.
