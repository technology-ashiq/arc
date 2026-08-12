# CI receipt — phase 02

`.claude/rules/testing.md`: tests are green **on CI, never on the dev box**, and the per-JOB
conclusions are read rather than the watcher's exit code — `gh run watch --exit-status` has
returned 0 on a run whose conclusion was `failure`.

## The run this phase closes on

```
run    31575423877
head   1245cb2cee31bdf914725a968283a121ed9516b1
OVERALL success
jobs   {"success":19}
```

## EXECUTED, not inferred from the absence of a failure

Counted from the TAP lines per leg. A suite that never ran is indistinguishable from a suite
that passed, so the count is read per leg rather than assumed from a green job.

```
memory-recall.bats EXECUTED on 5 leg(s): (ubuntu-latest, 20)=33  (ubuntu-latest, 18)=33  (ubuntu-latest, 22)=33  (macos-latest, 20, shard 3/3)=33  (windows-latest, 20, shard 10/12)=33
memory-conflict.bats EXECUTED on 5 leg(s): (ubuntu-latest, 20)=11  (ubuntu-latest, 18)=11  (ubuntu-latest, 22)=11  (windows-latest, 20, shard 1/12)=11  (macos-latest, 20, shard 3/3)=11
memory-golden.bats EXECUTED on 7 leg(s): (ubuntu-latest, 20)=23  (ubuntu-latest, 18)=23  (macos-latest, 20, shard 2/3)=23  (windows-latest, 20, shard 12/12)=2  (ubuntu-latest, 22)=23  (windows-latest, 20, shard 5/12)=19  (windows-latest, 20, shard 8/12)=2
memory-hook.bats EXECUTED on 5 leg(s): (ubuntu-latest, 20)=11  (ubuntu-latest, 18)=11  (macos-latest, 20, shard 1/3)=11  (ubuntu-latest, 22)=11  (windows-latest, 20, shard 1/12)=11
not-ok lines across EVERY leg: 0
```

`memory-golden` reads 23 on the unsharded ubuntu legs because 4 `spine-equivalence` tests share
the `equivalence:` prefix; the file's own 19 are visible alone on windows shard 5/12.

## The reds this phase earned, and what each one was

| Run | Head | Jobs red | What it caught |
|---|---|---|---|
| 31532192801 | — | 5 | `spine-reader-lint` flagged `lib/observe.mjs` for its own `.jsonl` literal; GNU-only `sed -i` on the macOS leg |
| 31534784040 | — | 4 | a test pinning the prose "sqlite arrives in Phase 2", made false by the cut |
| 31535746198 | `8ed7c18` | 5 | the memory-hook fixture appended a 4th retro row to a tree pinning 3 — REQ-08's stated acceptance criterion had never run |
| 31538024823 | `667ec1c` | 7 | a clobbered golden manifest row, wrong dropped-token arithmetic, two colliding ULIDs, an invalid probe under my own grammar |
| 31571898345 | `b7ade04` | 6 | an old assertion indexing `mismatches[0]`; my own new assertion satisfiable by an empty query |
| 31572692753 | `39b6e96` | 5 | a BACKTICK inside a double-quoted shell string — bash ran `checkTieBreak` as a command |
| **31573674899** | `95ed6e1` | **0** | first green after the 21 fixes |
| **31574476402** | `5a0e6e0` | **0** | green after the shard reweight |
| **31575423877** | `1245cb2` | **0** | branch tip — the run this phase closes on |
