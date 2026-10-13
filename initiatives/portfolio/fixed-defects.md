# Fixed defects -- portfolio lane (carried into every /arc-attack prompt)

Each row is a defect class already found and fixed somewhere in this lane. An attacker checks every
OTHER file in the diff for the same class: a fix is not applied until it has been attacked somewhere
it was never made.

| # | Class | First found | Check everywhere for |
|---|---|---|---|
| 1 | Markdown-contract parsing: case-sensitive key match, first-vs-last of a repeated key, `$` under `/m`, bold/heading variants slipping an exact regex | Cycle 4 risk 3, council v2/v3 | every header/table/ruling parser in the diff |
| 2 | Unquoted or word-split flag values (`--lane $X`) letting a value smuggle a flag | Cycle 4 Phase 00 | every argv parser (`--base`, `--lane`) |
| 3 | A gate reading its own output as input (a job's receipt resetting the clock it measures) | Cycle 5 kickoff attack, finding 1 | anything that both emits and reads the spine |
| 4 | Reading cwd's repo/spine instead of the linted repo's; a worktree reading its own empty `.claude/state` | Cycle 5 kickoff attack, finding 3 risk | every spine or repo-root resolution |
| 5 | A string-diff "is this new?" test that a typo or date amendment flips | Cycle 5 kickoff attack, finding 2 | every comparison of a header value against a base |
| 6 | A count that a rehearsal/fixture/simulated record satisfies | Cycle 5 kickoff attack, finding 4 | every threshold over spine receipts |
| 7 | Absence-only assertions (a crash satisfies them); non-ASCII `@test` titles silently dropped | retro 2026-07-30, testing.md | every new bats file |
