# Phase 01 — live demo (policy cycle 2, POL-L): the guard, and the evidence age in the Policy room

Merged as `f1d72536` (PR #370). The merged tree is verified by `workflow_dispatch` run 37629185502 (see the done-log).

## The guard, in scratch sandboxes built from the main clone's scripts (`live-demo.txt`, ULIDs elided)

```
$ guard (one in-scope cell, no refusal ever)
no-writer  session:interactive/shell unknown refusal=-
policy-evidence guard: NOT CLEAN as-of 2026-10-07 -- 1 BELOW-BAR (1 no-writer, 0 clearable); approval <ULID>; run <ULID>
exit=3
$ guard again (same BELOW-BAR set)
... NOT CLEAN ... same set as the last guard run, no new approval; run <ULID>
exit=3
RUNS 2 APPROVALS 1 LAST partial
$ guard (nothing in scope)
policy-evidence guard: CLEAN as-of 2026-10-07 -- no in-scope cell (nothing above L0 to evidence); run <ULID>
exit=0
RUNS 1 APPROVALS 0 LAST ok
```

Invariant (c) holds in the running system: one BELOW-BAR cell keeps the guard NOT CLEAN on both runs, and the second
run raises no second approval for an unchanged set (ADR-0511). The CLEAN line says what it measured.

## The Policy room, opened and looked at (not described by an agent)

A second HQ was started from the main clone on separate ports (the owner's HQ on 5180 was not touched), the Policy
room opened with Playwright, and the full-page screenshot read back by eye:

- every in-scope shell/network L1 cell reads **`L1 · unknown`**: the real canonical spine has no typed refusal at L1,
  exactly the kickoff's predicted reading;
- L0 cells read `L0` alone (n/a draws nothing), and the read cells keep their old text, `L1 (ceiling L3)`;
- the room renders with no error state.

**The PNG is NOT committed.** The repo is public, and CLAUDE.md makes publishing product screenshots an owner
decision. It stays local, and this file is the record of what it showed.
