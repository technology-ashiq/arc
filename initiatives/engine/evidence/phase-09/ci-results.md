# Phase 09 + 10 -- CI, read per job

Run **37609810462** at **`f3c00fb0815a`** (the PR #375 head, equal to local HEAD when read).
**19/19 jobs success**, read per job with `ci-digest`. One job (`selftest (ubuntu-latest, 20)`) was red on its first
attempt in the face lane's `face-browser` front-door `org-who` check (light mood only; dark passed in the same job), and
green on a rerun of that job alone. The branch touches no face or org file; the previous run's red on another leg was a
different face check (`page-errors=1`, ubuntu 22). Recorded as a face flake, not engine debt.

The previous run, 37578422845 at `176ec541`, found three real defects in this cycle's own tests (not in the product):
the one-owner check matched a comment, the F1/m4 checks matched the round-1 stop line, and the profile hop fixture used
an undeclared CLI failure that ADR-0228 correctly never hops on. Fixed in `1d3fbd48`.

## The cycle's suite on the ubuntu 22 leg (4320 of 4320 ok)

```
ok 1463 failure-class unit: the six classes, the classifier, families, nextHop, terms and the real router
ok 1464 failure-class invariants a b c d hold through the real arc-run
ok 1465 failure-class mutants: each of five mutants turns a named invariant red
ok 1466 failure-class drivers: generic-api per HTTP status, and the CLI drivers with no CLI installed
ok 1467 failure-class suite registers all of its tests
ok 1422 REQ-05 fixture 10: a budget decline STOPS -- the fallback chain is never walked
ok 1423 REQ-05 fixture 10 NEGATIVE CONTROL: a DRIVER fault on the same class DOES walk the chain
ok 1600 profile: claude-code runs the tier pin first, and the generic-api hop runs the class profile
ok 1662 router-row: the REAL engine/router.yaml loads clean
ok 1663 router-row: arc-run refuses to LOAD a router with a faulty row, not to dispatch
ok 1670 router-row: a fallback INTO the agent runtime carries the four terms too
```

Section counts asserted exactly by `tests/engine-failure-class.bats`: unit 58, inv 20, mut 13, drv 15.

## What this does NOT claim

- No real provider was called. Every invariant ran on `drivers/mock` and a local HTTP server; the real gateway's
  statuses are fixtured, not measured. A-08's live half is a production observation, not a test.
- `claude-code` and `codex` declare only a CLI that cannot start. Every other CLI failure is `unknown` and does not
  hop -- so `commit-msg-draft` and `review-diff` lose their fallback for those failures, by design (ADR-0228 item 2).
- `max_cost` binds nothing live: every production row is `unmetered`, because no production driver reports `inr`.
- `max_wall_ms` is 3600000 on every row -- a ceiling, not yet calibrated from `hops[].ms`.
