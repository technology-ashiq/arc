# org -- migrated from bats to node:test (ci Phase 02, the template lane)

| field | value |
|---|---|
| lane | org |
| harness · model | Claude Code · claude-opus-5-5 (Phase 02 is Opus's, PLAN-ci D.5) |
| run | 2026-10-24, one session, by hand -- the worked example tests/MIGRATING.md points at |
| old | 11 files `tests/org-*.bats`, 73 `@test` |
| new | 12 files `tests/org/*.test.mjs`, 73 `test(` (.count = 73) |
| dropped | none |
| timing | see "§11 kill line" below |

Names are unchanged, so every row maps a name to itself. Three one-fixture bats files (`org-dup-keys`, `org-own`,
`org-skill-import`) became one file, `fixture-run.test.mjs`. The bats helpers `org_scratch`, `team_tree` became
`tests/org/scratch.mjs`; `judge_tree` stays inside `judge.test.mjs`, its only user.

Behaviour notes, none of them a loosened assertion:
- `org-judge: run through a symlinked path` was SKIPPED on Git Bash (its `ln -s` copies). node makes a real link
  on every OS, a junction on Windows, so the case now runs on all three legs.
- bats `[[ "$output" == *A*"B"* ]]` globs became `assert.match(output, /A[\s\S]*B/)`: the same ordered-substring claim.
- `sed -i 's/X/Y/'` mutations became `mutate(file, sed(/X/, "Y"))`, which also asserts the file changed.

| old @test | new test | file | note |
|---|---|---|---|
| org-card: every test in this file is registered (none dropped by name) | org-card: every test in this file is registered (none dropped by name) | card.test.mjs | from org-card.bats |
| org-card: the worked example validates and is staffed | org-card: the worked example validates and is staffed | card.test.mjs | from org-card.bats |
| org-card: a model string as the tier fails, naming the model | org-card: a model string as the tier fails, naming the model | card.test.mjs | from org-card.bats |
| org-card: an unknown key fails, naming it | org-card: an unknown key fails, naming it | card.test.mjs | from org-card.bats |
| org-card: a hired seat cannot be legitimised by genesis | org-card: a hired seat cannot be legitimised by genesis | card.test.mjs | from org-card.bats |
| org-card: a third origin state is refused | org-card: a third origin state is refused | card.test.mjs | from org-card.bats |
| org-card: a KPI over a kind the spine does not have fails | org-card: a KPI over a kind the spine does not have fails | card.test.mjs | from org-card.bats |
| org-card: the emitter round-trips through the yaml subset | org-card: the emitter round-trips through the yaml subset | card.test.mjs | from org-card.bats |
| org-card: the emitter refuses a list item the subset would misread as a mapping | org-card: the emitter refuses a list item the subset would misread as a mapping | card.test.mjs | from org-card.bats |
| org-chart: every test in this file is registered (none dropped by name) | org-chart: every test in this file is registered (none dropped by name) | chart.test.mjs | from org-chart.bats |
| org-chart: the committed chart is exactly what the cards render | org-chart: the committed chart is exactly what the cards render | chart.test.mjs | from org-chart.bats |
| org-chart: every vacant card has a VACANT banner and the counts are the cards' own | org-chart: every vacant card has a VACANT banner and the counts are the cards' own | chart.test.mjs | from org-chart.bats |
| org-chart: a hand edit to the chart is caught by --check | org-chart: a hand edit to the chart is caught by --check | chart.test.mjs | from org-chart.bats |
| org-chart: the digest ignores formatting and moves on any value change | org-chart: the digest ignores formatting and moves on any value change | chart.test.mjs | from org-chart.bats |
| org-chart: modes are exclusive and unknown flags refused, exit 2 | org-chart: modes are exclusive and unknown flags refused, exit 2 | chart.test.mjs | from org-chart.bats |
| org-coverage: every test in this file is registered (none dropped by name) | org-coverage: every test in this file is registered (none dropped by name) | coverage.test.mjs | from org-coverage.bats |
| org-coverage: the real tree is covered, with counts derived from the tree | org-coverage: the real tree is covered, with counts derived from the tree | coverage.test.mjs | from org-coverage.bats |
| org-coverage: the mutant self-test runs every arm and each fails closed | org-coverage: the mutant self-test runs every arm and each fails closed | coverage.test.mjs | from org-coverage.bats |
| org-coverage: an orphan agent fails end to end, named | org-coverage: an orphan agent fails end to end, named | coverage.test.mjs | from org-coverage.bats |
| org-coverage: an E2 role moved to an agent seat fails, naming role and action | org-coverage: an E2 role moved to an agent seat fails, naming role and action | coverage.test.mjs | from org-coverage.bats |
| org-coverage: a role binding a script that does not exist fails, named | org-coverage: a role binding a script that does not exist fails, named | coverage.test.mjs | from org-coverage.bats |
| org-coverage: an unknown flag is refused by name, exit 2 | org-coverage: an unknown flag is refused by name, exit 2 | coverage.test.mjs | from org-coverage.bats |
| org-dispatch: every test in this file is registered (none dropped by name) | org-dispatch: every test in this file is registered (none dropped by name) | dispatch.test.mjs | from org-dispatch.bats |
| org-dispatch: an ungoverned team gets no proposals at all | org-dispatch: an ungoverned team gets no proposals at all | dispatch.test.mjs | from org-dispatch.bats |
| org-dispatch: a governed team gets a proposal with full goal ancestry for each unmet criterion | org-dispatch: a governed team gets a proposal with full goal ancestry for each unmet criterion | dispatch.test.mjs | from org-dispatch.bats |
| org-dispatch: a vacant owner is a counted demand, and the third demand proposes a hire | org-dispatch: a vacant owner is a counted demand, and the third demand proposes a hire | dispatch.test.mjs | from org-dispatch.bats |
| org-dispatch: a full queue proposes nothing more that day (REQ-10) | org-dispatch: a full queue proposes nothing more that day (REQ-10) | dispatch.test.mjs | from org-dispatch.bats |
| org-dispatch: a seat over its budget line gets one budget-cap request and no work (ADR-1616) | org-dispatch: a seat over its budget line gets one budget-cap request and no work (ADR-1616) | dispatch.test.mjs | from org-dispatch.bats |
| org-dispatch: every criterion met proposes the stage change, and only proposes it | org-dispatch: every criterion met proposes the stage change, and only proposes it | dispatch.test.mjs | from org-dispatch.bats |
| org-dispatch: an open proposal for the same role and criterion is never raised twice | org-dispatch: an open proposal for the same role and criterion is never raised twice | dispatch.test.mjs | from org-dispatch.bats |
| org-dispatch: usage -- one of --venture or --all, flags never twice, unknown refused | org-dispatch: usage -- one of --venture or --all, flags never twice, unknown refused | dispatch.test.mjs | from org-dispatch.bats |
| dup-keys: face-sections and face-coverage fail by name on each contract file holding a key twice | dup-keys: face-sections and face-coverage fail by name on each contract file holding a key twice | fixture-run.test.mjs | from org-dup-keys.bats |
| org-judge: every test in this file is registered (none dropped by name) | org-judge: every test in this file is registered (none dropped by name) | judge.test.mjs | from org-judge.bats |
| org-judge: the decision fixture runs every check clean | org-judge: the decision fixture runs every check clean | judge.test.mjs | from org-judge.bats |
| org-judge: a head's verdict lands once, judges the worker, and the audit still agrees | org-judge: a head's verdict lands once, judges the worker, and the audit still agrees | judge.test.mjs | from org-judge.bats |
| org-judge: refusals name every failed condition and write nothing | org-judge: refusals name every failed condition and write nothing | judge.test.mjs | from org-judge.bats |
| org-judge: a dry run prints the payload and emits nothing | org-judge: a dry run prints the payload and emits nothing | judge.test.mjs | from org-judge.bats |
| org-judge: run through a symlinked path, the CLI still runs (main guard realpaths both sides) | org-judge: run through a symlinked path, the CLI still runs (main guard realpaths both sides) | judge.test.mjs | from org-judge.bats |
| org-own: the card rewrite and the command run every check clean | org-own: the card rewrite and the command run every check clean | fixture-own.test.mjs | from org-own.bats |
| org-own --assign: who sits a role, set on a branch with every refusal before any write (face Phase 13, ADR-1352) | org-own --assign: who sits a role, set on a branch with every refusal before any write (face Phase 13, ADR-1352) | fixture-run.test.mjs | from org-own.bats |
| org-review: every test in this file is registered (none dropped by name) | org-review: every test in this file is registered (none dropped by name) | review.test.mjs | from org-review.bats |
| org-review: a role's runs are derived from its placed receipts | org-review: a role's runs are derived from its placed receipts | review.test.mjs | from org-review.bats |
| org-review: a role with no placed receipt prints no evidence, never a zero or a percent | org-review: a role with no placed receipt prints no evidence, never a zero or a percent | review.test.mjs | from org-review.bats |
| org-review: a decision is placed on the role that raised the approval it decides | org-review: a decision is placed on the role that raised the approval it decides | review.test.mjs | from org-review.bats |
| org-review: payload.role outranks the map, and the disagreement is printed | org-review: payload.role outranks the map, and the disagreement is printed | review.test.mjs | from org-review.bats |
| org-review: unattributed receipts are counted, not guessed | org-review: unattributed receipts are counted, not guessed | review.test.mjs | from org-review.bats |
| org-review: --audit recomputes every number independently and finds no difference | org-review: --audit recomputes every number independently and finds no difference | review.test.mjs | from org-review.bats |
| org-review: the checkpoint proceeds on receipts placed by source-naming rules | org-review: the checkpoint proceeds on receipts placed by source-naming rules | review.test.mjs | from org-review.bats |
| org-review: the checkpoint STOPS on heartbeats and kind-only receipts (negative control) | org-review: the checkpoint STOPS on heartbeats and kind-only receipts (negative control) | review.test.mjs | from org-review.bats |
| org-review: a map rule naming a role that is not a card stops scoring | org-review: a map rule naming a role that is not a card stops scoring | review.test.mjs | from org-review.bats |
| org-review: a map saved with a BOM and CRLF scores exactly as the plain map (logic attack L4) | org-review: a map saved with a BOM and CRLF scores exactly as the plain map (logic attack L4) | review.test.mjs | from org-review.bats |
| org-review: modes are exclusive, flags are never given twice, unknown flags refused | org-review: modes are exclusive, flags are never given twice, unknown flags refused | review.test.mjs | from org-review.bats |
| org-review: verdicts are derived, and heartbeat evidence never promotes (ADR-1607) | org-review: verdicts are derived, and heartbeat evidence never promotes (ADR-1607) | review.test.mjs | from org-review.bats |
| role-seat: the resolver fixture runs every check clean | role-seat: the resolver fixture runs every check clean | role-seat.test.mjs | from org-role-seat.bats |
| role-seat: lint passes the real processes, which now name their roles | role-seat: lint passes the real processes, which now name their roles | role-seat.test.mjs | from org-role-seat.bats |
| role-seat: lint FAILs a role with no card, and a card that binds another process | role-seat: lint FAILs a role with no card, and a card that binds another process | role-seat.test.mjs | from org-role-seat.bats |
| role-seat: a default run receipts the role and keeps the prompt unseated | role-seat: a default run receipts the role and keeps the prompt unseated | role-seat.test.mjs | from org-role-seat.bats |
| role-seat: --trial-seat puts the agent in front of the process, receipts trial, and leaves the card alone | role-seat: --trial-seat puts the agent in front of the process, receipts trial, and leaves the card alone | role-seat.test.mjs | from org-role-seat.bats |
| role-seat: --trial-seat refuses twice, empty, unknown, and on a process with no role -- exit 2, no receipt | role-seat: --trial-seat refuses twice, empty, unknown, and on a process with no role -- exit 2, no receipt | role-seat.test.mjs | from org-role-seat.bats |
| role-seat: --dry-run names the seat and why | role-seat: --dry-run names the seat and why | role-seat.test.mjs | from org-role-seat.bats |
| role-seat: a role process that emits a closed-payload kind still completes, role fields on run.completed only | role-seat: a role process that emits a closed-payload kind still completes, role fields on run.completed only | role-seat.test.mjs | from org-role-seat.bats |
| skill-import: the vet, the source and the command run every check clean | skill-import: the vet, the source and the command run every check clean | fixture-skill-import.test.mjs | from org-skill-import.bats |
| org-team: every test in this file is registered (none dropped by name) | org-team: every test in this file is registered (none dropped by name) | team.test.mjs | from org-team.bats |
| org-team: --init proposes a valid discover team with E2 seats held by the owner, and never overwrites | org-team: --init proposes a valid discover team with E2 seats held by the owner, and never overwrites | team.test.mjs | from org-team.bats |
| org-team: --init refuses a venture that is not registered | org-team: --init refuses a venture that is not registered | team.test.mjs | from org-team.bats |
| org-team: an unapproved team is an UNRECEIPTED TEAM CHANGE (REQ-06) | org-team: an unapproved team is an UNRECEIPTED TEAM CHANGE (REQ-06) | team.test.mjs | from org-team.bats |
| org-team: an approved digest governs, a comment keeps it, a value change breaks it | org-team: an approved digest governs, a comment keeps it, a value change breaks it | team.test.mjs | from org-team.bats |
| org-team: the gate refuses an E2 role on shift that the owner does not hold | org-team: the gate refuses an E2 role on shift that the owner does not hold | team.test.mjs | from org-team.bats |
| org-team: a queue cap above 7 is refused (REQ-10) | org-team: a queue cap above 7 is refused (REQ-10) | team.test.mjs | from org-team.bats |
| org-team: sync --team installs byte-for-byte what --products <the team closure> installs (REQ-07) | org-team: sync --team installs byte-for-byte what --products <the team closure> installs (REQ-07) | team-sync.test.mjs | from org-team.bats |
| org-team: --team and --products are exclusive, and an unknown team fails the sync | org-team: --team and --products are exclusive, and an unknown team fails the sync | team.test.mjs | from org-team.bats |
| org-hire: a seat is staffed only by an approved org.role interview naming it (REQ-11) | org-hire: a seat is staffed only by an approved org.role interview naming it (REQ-11) | team.test.mjs | from org-team.bats |
| org-hire: a request decided twice refuses the hire stamp by name (logic attack L5) | org-hire: a request decided twice refuses the hire stamp by name (logic attack L5) | team.test.mjs | from org-team.bats |

## §11 kill line -- measured on the owner's box, 2026-10-24

| suite | how | wall time | tests |
|---|---|---|---|
| bats | `bats tests/org-<f>.bats`, the 11 files one at a time, foreground | 678 s | 73 ok |
| node:test | `node --test --test-reporter=tap "tests/org/*.test.mjs"` (files in parallel, the runner's default) | 222 s | 73 pass |

**Ratio 3.05x -- below the 5x line.** Per PLAN-ci §11 that stops Phase D (the fan-out) until the owner re-plans.
Where the time goes: both suites spend it in the same place, spawning arc's own scripts (org-team --init per
scratch tree, sync-to-project twice, arc-run); the runner swap removes bash/bats start-up, not that work. A
faster lane needs fewer spawns per test (import the pure functions, as PLAN-ci C says), which is a test redesign,
not a translation.

### Pilot re-time (2026-10-24, `/arc-change`, phase-02 spec)

Per-file timing showed the 222 s was not the runner: 7 of 9 files took 2-11 s, and two files held four slow
cases in series (`fixture-run` 196 s: skill-import 75, own 39, dup-keys 31; `team` 97 s: the sync case 83).
node:test runs one file's tests in series and files in parallel, so the slow cases moved to their own files
(`fixture-own`, `fixture-skill-import`, `team-sync`), assertions and names unchanged. No function-style rewrite.

| suite | wall time | tests |
|---|---|---|
| node:test, 12 files | 145 s, then 117 s | 73 pass |

**Ratio 4.7x-5.8x -- on the 5x line, not clearly past it.** The floor is now the single slowest case (sync, ~83 s:
two full installs); going lower needs that case redesigned, not the runner.
