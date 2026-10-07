# Phase 01 — live demo

The verification plan's six scenarios, run for real on 2026-08-07 against a throwaway root that
owns its own policy **and** its own spine (`policyRoot()` pins the governing root to the module's
own location, so a copied tree is governed by its own copied policy).

**Every spine fact below is read back off `events/*.jsonl`**, never taken from an emitter's return
value. An emitter exiting 0 while every receipt it wrote was quarantined is how this repo has
reported success for something that never landed — twice.

Scenario 1 exists to keep scenario 2 honest. Without it, "the driver did not run" is equally
satisfied by a runner that refuses everything, by a broken fixture, and by a deleted gate.

## Transcript

```

----- 1. PERMITTED: a process declaring fs.write, against a policy that grants it
{}
driver marker present? YES

----- 2. DENIED: the same process, against a policy that denies write. NO SIDE EFFECT.
arc-run: policy denied demo: process:demo/write is denied by policy (ceiling L0, cap L1)
arc-run: policy denied demo: process:demo/write is denied by policy (ceiling L0, cap L1)
arc-run exit was non-zero: the driver marker is present? NO-as-required
incident.raised on the spine: 1

----- 3. INTERACTIVE OVERREACH: session write raised to L2, then a write outside the roots
  sealed 01KZDGJH47WYEZ8QKX5B0EJ0ZS  -> session:interactive/write effective L2
BLOCKED by policy: Write needs write -- /etc/nope.txt is outside the declared write roots
policy: session:interactive/write demoted L2 -> L1, citing 01KZDGJHFWGFBVJJ8S5SC692SK
hook exit=2  (2 = blocked)

-----    receipts read back OFF THE SPINE
  run.completed 01KZDGJFTK028M5TVANYDS1S8A
  incident.raised 01KZDGJGCX4ER6NJYMMMWHWZX0
  run.completed 01KZDGJGM33WXM7KHMDHXN5DVW
  policy.level.changed 01KZDGJH47WYEZ8QKX5B0EJ0ZS
  incident.raised 01KZDGJHFWGFBVJJ8S5SC692SK
  policy.demoted 01KZDGJHQ95Q3CS6CTFCXSBNG8  write L2 -> L1  cites 01KZDGJHFWGFBVJJ8S5SC692SK
  quarantined: 0

----- 4. THE NEXT AUTHORIZATION SEES IT -- no restart
BLOCKED by policy: Write needs write, which is at L1 (propose) for session:interactive. L1 means prepare and record, never perform -- raising it is a human decision citing trial-ledger evidence (session:interactive/write is at L1 -- prepare and record it, never execute it)
hook exit=2  (2 = now only a proposal; it EXECUTED before the bite)

----- 5. MONEY: cap 100 minor units, reserve 80, then a second reserve
  declared cap: 100 INR daily
  reserve 80  -> ALLOWED (remaining after: 20)
  sealed 01KZDGJK68XFFXA39QXQJK6TCZ
  reserve 80 again -> BLOCKED: 80 exceeds the remaining daily budget: cap 100, settled 0, open reservations 80, remaining 20
  ledger DERIVED from the chain: settled 0, open 80, committed 80

----- 6. CRASH BETWEEN RESERVE AND CALL -- the reservation stays open and surfaces as stuck
  open reservations with no settlement and no release: 1
    01KZDGJK68XFFXA39QXQJK6TCZ  80 INR  key=demo-key-1
  nothing auto-released it, nothing auto-retried it -- it is a human's to resolve.
```

## What each scenario proves

| # | Criterion | Evidence in the transcript |
|---|---|---|
| 1 | The gate permits what policy grants | `driver marker present? YES` — the positive control |
| 2 | A denied action has **no side effect** and emits `incident.raised` | marker `NO-as-required`, `incident.raised on the spine: 1` |
| 3 | An overreach at execute authority costs a level | `demoted L2 -> L1, citing <ULID>`, and the demotion read back off the spine **citing that same incident id** |
| 4 | The next authorization sees the lower level, **without a restart** | the identical in-root write that executed before scenario 3 now returns `L1 (propose)` |
| 5 | The money guard is derived, never stored | `reserve 80 -> ALLOWED`, the second `BLOCKED` with `cap 100, settled 0, open reservations 80, remaining 20`, and the ledger recomputed from the chain |
| 6 | A crash between reserve and provider call leaves the reservation open | `open reservations with no settlement and no release: 1` — never auto-released, never auto-retried |

`quarantined: 0` on the spine read-back: every receipt in this transcript is sealed, not
quarantined.

## The fixture bug this demo found

The first run of scenario 1 **denied**. `process:demo` is not in the shipped policy, and an
absent kind is read-only by deny-by-default — correct behaviour, wrong fixture. A "permitted"
control that is actually denied proves nothing at all, and had it gone unnoticed the whole demo
would have read as six passing scenarios while the positive control was inert. The demo kind is
now minted from `process:kickoff-plan`, which carries a real write grant, and the fixture asserts
its own transform before using it.
