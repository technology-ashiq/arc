# Phase 07 REQ-05 — the class budget, DERIVED from receipts

2026-08-17. Three real dispatches through the pinned container, from the **main clone** so the
receipts could land, at a deliberately generous wall-clock (`--budget min=20`).

## The runs

| duration | outcome | receipt |
|---|---|---|
| 248,463 ms (4m 08s) | fail / schema | `01M07QZ8Q7WM9WS6VMSCJH56S2` |
| 318,803 ms (5m 19s) | fail / schema | `01M07R90WG1XKHQF7R0WC08MSK` |
| 342,029 ms (5m 42s) | fail / schema | `01M07QQK8FFK1J2ZDWHJK4AEC4` |

**The outcomes are failures and the measurement is still valid.** REQ-05 asks how long a dispatch
TAKES, not whether it succeeds; a run that produced a wrong answer produced it over a real
wall-clock. The failure itself belongs to REQ-07 and is recorded there.

## The derivation

```
slowest observed                : 342,029 ms
x1.5 for the ladder's one retry :  513,044 ms
DERIVED BUDGET                  : min=9
```

`.claude/scripts/engine/calibrate-budget.mjs` reads the spine and prints this, so the number can be
**re-derived** rather than trusted. A derivation nobody can re-run is a number somebody wrote down,
which is the guess the criterion forbids the moment the receipts move.

**The MAXIMUM, not the mean.** A mean declines the slow half of a distribution whose slow half is
the interesting half — this runtime's own measurements span 32s warm to 400s cold, which is not a
shape a mean describes. The **1.5x** is ADR-0204's ladder: one same-tier retry is permitted, and a
budget that fits exactly one attempt turns every retry into a budget decline.

## What the tool refused to do, which is the point

- **It named the receipt it could not use.** `01M07FX9ZAY3EHCQFKVVKA2RT7` — the first certification
  dispatch — carries **no** `duration_ms`, because it predates the field. Counted and named rather
  than dropped: a silently-shortened sample is how a measured table starts lying.
- **It refused at two runs.** Run twice and it prints the arithmetic, calls it *arithmetic and not a
  calibration*, and exits 1. The number only becomes a baseline at the floor.
- **It excludes refusals that never spawned a driver.** A tenure or boundary refusal carries a real
  duration — correctly, arc-run observed that time — but folding a 2 ms refusal into a sample of
  300-second dispatches drags the arithmetic toward a number no dispatch will ever meet. Verified
  separately: 5 tenure refusals in, 0 runs derived from, all five named.

## Where the number lives, and where it does not

**`engine/router.yaml` rows carry no budget field**, so `min=9` is not a router edit. It is the
recorded baseline a caller passes as `--budget min=9`, and it lives here and in the tracker.

**It is 4.5x the `min=2` the Phase 05 spec's demo scenario reached for.** That gap is the entire
reason the criterion says *derived from receipts*: `min=2` was a plausible number written before any
receipt existed, and it would have declined every real dispatch measured above.

## Honest limits

- Measured against **local `ollama`** on this box. A hosted model through the capped key will have a
  different distribution, and this baseline does not claim to cover it. Re-derive after Phase 08's
  runs — the tool takes `--driver`, so the two populations stay separate.
- Three runs is the floor, not a distribution. It bounds the slowest thing seen; it does not
  characterise the tail.
