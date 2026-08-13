# Phase 01 evidence — CI, and proving the red is not ours

## The scheduler tests are green

Run **31622464864** at `81e2392`. Every test this lane owns passed, asserted BY NAME out of the
run log rather than by the absence of a red tick:

```
ok  arc-jobs: a double fire at the same slot is prevented, not merely noticed
ok  arc-jobs: a run leaves a receipt carrying the slot it claims
ok  arc-jobs: a scheduled fire is distinguishable from an attended one by actor
ok  arc-jobs: refuses to run anything from an illegal schedule
ok  brief: a healthy schedule adds NOTHING to the brief
ok  brief: an overdue job appears in needs-you, derived from silence
ok  catchup: runs what is due and is idempotent on a second call
ok  delegate: a scheduled process-job carries the same argv a manual run would
ok  jobs-lint CLI: exits 2 on an illegal schedule and names the rule
ok  jobs-lint: bill charges a daily job for 31 slots and a weekdays job for 23
    ... 79 in total across jobs-lint, jobs-run, jobs-contract and jobs-panel
```

## The run is still RED, and the red is repo-wide

Three `arc-scan` tests fail:

- `normalize: resolves rule-level severity (semgrep eval => error)`
- `e2e: freeze a finding -> rescan PASSES; a novel finding still BLOCKS`
- `arc-scan: starter profile downgrades block to advisory (exit 0)`

All three share ONE root. The log shows the scan **running** and finding nothing:

```
# arc-scan: semgrep: scanned 1 file(s) via opengrep
# (in test file tests/arc-scan.bats, line 66)
#   `[[ "$output" == *"error"* ]]' failed
```

opengrep is installed and executing; it has stopped flagging the planted `eval()`. `normalize`
fails directly, and the two e2e tests fail downstream because they need a finding to exist before
they can baseline it.

## How that was PROVEN rather than assumed

`main` was green three runs earlier, which is exactly the evidence that would make "not ours" a
comfortable story rather than a fact. So the two alternatives were tested first:

1. **Shard reshuffle.** This lane added four test files, and a growing suite redistributes shards
   — a documented way to expose a test that only ever passed by shard luck. Ruled out: **ubuntu
   is unsharded** and fails on all three Node versions. There is no shard for it to move between.
2. **Something in this branch.** Ruled out by inspection: this lane has not touched arc-scan,
   semgrep, opengrep, any scanner config, or `.github/`.

Then the decisive one. A `workflow_dispatch` control run on **unchanged `main`**:

| Run | Tree | arc-scan failures |
|---|---|---|
| **31622490938** | `main` at `6792091`, untouched | **3** |
| 31622464864 | this branch at `81e2392` | **1** |

Same code on main that was green hours earlier now fails the same tests. The branch under
development fails FEWER of them than main does.

## What this does and does not license

It does **not** license closing a phase on a red run in general. Phase 01 closes because the
tests it owns are green on CI and were checked individually — the phase's own Definition of Done,
met.

It does **not** clear the final merge. That still needs a green run, so this lane is blocked on
somebody fixing arc-scan before it can merge, and that is recorded rather than worked around.

## The defect underneath, worth routing

`tests/arc-scan.bats` guards on `_arc_need_semgrep` — "is a scanner installed" — and then depends
on that scanner's **ruleset still matching a specific pattern**. Those are different claims, and
the second is far more fragile: the scanner can be present, current and working while its rules
move. The same shape as `e2e: freeze a finding`, which guards on semgrep and then needs *gitleaks*
to detect a planted token (that one produced a separate flake in this cycle on 2026-08-12).

A test whose subject is "the pipeline normalises severity correctly" should feed the normaliser a
FIXTURE finding, not a live scan of a file it hopes a third-party ruleset still objects to.
