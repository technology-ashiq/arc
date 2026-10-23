# Handoff -- face: expected-set rows for ci Phase 01 (ci ADR-2201, ADR-2204)

**Status:** FILED 2026-10-24 -- waiting on face's go-ahead (record it below). ci's workflow adds and
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

- (pending)
