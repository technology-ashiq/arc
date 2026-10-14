# debt-ledger.md -- portfolio LOW leftovers and accepted findings

One row per finding not fixed in its PR. A row closes when its disposition cell is led by `fixed`,
`closed`, `paid`, `resolved` or `done` (ADR-0078's reading).

| # | Source | Finding | Disposition | Reopen when |
|---|---|---|---|---|
| 1 | attack e143177 r2 boundary B4 (low) | `BASE_REF_RE` admits `..`, `^`, `~`, `@{}` forms; `main@{upstream}` resolves to a ref the caller may not mean | accepted: every admitted form is a ref git itself resolves, and none is an option; the leading-dash hole is closed | a `--base` value is seen resolving to an unintended commit |
| 2 | attack e143177 r2 boundary B5 (low) | `trackerRel` can return `../x` for a tracker outside the linted root | accepted: `laneRes.tracker` comes from the resolver, which builds `initiatives/<valid-name>` and never a path outside the root | the resolver ever returns a tracker from user input |
| 3 | attack e143177 r2 boundary B6 (low) | a moved or deleted main clone makes the first `git worktree list` entry a dead path, so the freeze WARNs and is skipped | accepted: the WARN names the path it looked at, so the skip is visible | a kickoff runs from a worktree whose main clone moved |
| 4 | attack 148c6aa r2 boundary B5 (medium) | the owner apply appends in the file's majority EOL; a mixed-EOL `hq.jobs.yaml` stays mixed | accepted: both files are LF on `main`, and `.gitattributes` normalises on commit | a mixed-EOL file is seen on the owner's box |
| 5 | attack 148c6aa r2 boundary B8 (medium) | `/api/board` reads the state beside the spine root while the job writes beside its own checkout; with `ARC_SPINE_ROOT` or `ARC_PORTFOLIO_STATE_DIR` pointed elsewhere they disagree | accepted: in the live main clone both are `.claude/state/`; the doors are test-only | the dash serves a fixture spine with a live state dir |
| 6 | attack 148c6aa r2 low (L9, B7, B9, B10) | BOM on a base PROGRESS, header-row counter on a pipe-less line, others | accepted: no reachable input on this tree | any of them seen in a real run |
