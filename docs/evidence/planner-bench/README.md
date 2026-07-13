# Planner bench

**The question:** does any of this scaffolding actually produce a better outcome than just asking
Claude to build the thing?

arc has two comparison docs (`docs/gsd-superpowers-vs-arc-comparison.md`, `docs/gstack-vs-arc-comparison.md`).
Both are honest, both are *paper* — they read the source and reason about it. Neither has run a
single line of code through the systems they compare. `docs/retro-log.md`, the file whose entire
purpose is to make kickoff quality compound, is **empty**. This bench exists to fix that: same goal,
five planners, one grader, real numbers.

## How it works

```
   goal.md ──verbatim──▶ ┌─ arc ─┐
                         ├─ raw ─┤   each in its own empty repo,
                         ├─ gsd ─┤   own fresh session, own native loop
                         ├ gstack┤
                         └─super─┘
                              │
                    evidence/ │ plan · transcript · git log · done-claims
                              ▼
              acceptance suite (black-box, identical for all five)
                              │
              metrics.json ───┼─── rubric.json (blind, arm names hidden)
                              ▼
                   composite = 50% auto + 50% judgement
                              ▼
                RESULTS.md  ──▶  LEDGER.md  ──▶  retro-log.md
                                (every run)      (only if seen twice)
```

The arms are graded by a suite they never see, written before they ran. No planner grades its own
homework, and no planner gets to define what "done" meant.

## Files

| Path | What |
|---|---|
| `PLANOFF-01/goal.md` | The shared goal. Frozen. Pasted verbatim into every arm. |
| `PLANOFF-01/protocol.md` | Fairness rules, per-arm procedure, evidence to capture, void conditions. |
| `PLANOFF-01/traps.md` | 🔒 The five planted traps. **Sealed until every arm has run.** |
| `PLANOFF-01/acceptance/` | The black-box grader (`acceptance.mjs`) + runner. Zero deps, Node ≥ 20. |
| `PLANOFF-01/scoring/` | `rubric.md` (weights + anchors + blinding) · `scorecard.template.md` · `metrics-collect.mjs` · `score.mjs` |
| `PLANOFF-01/runs/<arm>/` | Per-arm: `run.json`, `manual.json`, `rubric.json`, `metrics.json`, `scorecard.md`, `evidence/` |
| `PLANOFF-01/RESULTS.md` | Prediction (pre-registered), score table (generated), verdict (hand-written). |
| `LEDGER.md` | Append-only across all benches. **The accumulation.** |

## Running it

```bash
# once, per arm — see protocol.md for the full procedure
/arc-bench run arc                      # or drive it by hand

# after the arm is done and its evidence is captured
docs/evidence/planner-bench/PLANOFF-01/acceptance/run-acceptance.sh arc

# after ALL FIVE arms are done — unseal traps.md, score blind, then:
node docs/evidence/planner-bench/PLANOFF-01/scoring/metrics-collect.mjs arc   # ×5
node docs/evidence/planner-bench/PLANOFF-01/scoring/score.mjs                 # table + ledger

/arc-bench promote                      # only patterns seen in 2+ benches
```

## The rules that keep this honest

1. **The traps stay sealed** until the last arm finishes. Knowing them makes you prompt toward them.
2. **Scoring is blind.** You wrote arc; you will score it generously. Letters, not names.
3. **A margin under 5 points is noise, not a win.** `score.mjs` will say so in the table, out loud.
4. **A partial field is not a verdict.** Two arms do not crown a planner.
5. **arc losing is a successful bench.** The failure mode isn't "arc loses" — it's running a bench
   rigged so it can't. If `raw` wins, half of arc should be deleted, and that is worth knowing.
