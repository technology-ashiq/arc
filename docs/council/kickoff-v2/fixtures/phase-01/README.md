# phase-01 fixtures — calibration loop

## `sessions/` — the 3-session scoring set (ADR-0009 buckets: High=0.85, Med=0.65, Low=0.5)

| Session | CONFIDENCE (prob) | RESULT | outcome | Brier term |
|---|---|---|---|---|
| `001-adopt-tool.md` | High (0.85) | HIT | 1 | (0.85−1)² = 0.0225 |
| `002-hire-contractor.md` | High (0.85) | MISS | 0 | (0.85−0)² = 0.7225 |
| `003-pricing-change.md` | Medium (0.65) | HIT | 1 | (0.65−1)² = 0.1225 |

Brier = (0.0225 + 0.7225 + 0.1225) / 3 = 0.8675 / 3 = **0.2892**. High bucket: 1 of 2 hit (0.50) —
the overconfidence the calibration loop exists to surface. `node .claude/scripts/council-calibrate.mjs
docs/council/kickoff-v2/fixtures/phase-01/sessions` must print exactly:

```
arc-council calibration — docs/council/kickoff-v2/fixtures/phase-01/sessions
scored: 3 · pending: 0 · excluded (WAIT/UNRESOLVED): 0 · skipped: 0

bucket   prob   n   hits   hit-rate
High    0.85  2   1     0.50
Medium  0.65  1   1     1.00
Low     0.50  0   0     —

Brier score (lower is better): 0.2892
```

## `bad-sessions/` — the ambiguous-outcome red fixture

`001-ambiguous-outcome.md` records `RESULT: partially right` (free text). `council-calibrate.mjs` on
this directory must **exit 1** naming the malformed outcome — a recorded-but-ungradeable outcome is a
data error, never silently scored. (A session with NO `## OUTCOME` is *pending*, skipped with a WARN;
this one has an OUTCOME with an unparseable RESULT, which is different.)

## `verdict-lint/` — validate-if-present checks in `council-lint --verdict`

Deep verdicts gain `Review-by:`/`Resolution:` lines and (after review) a `## OUTCOME`. The lint
accepts them and enforces their format; pre-v2 sessions carry none and stay valid.

| Fixture | Targets | Red-first | Expected |
|---|---|---|---|
| `good-calibrated.md` | a full valid verdict + ISO Review-by + Resolution + `RESULT: HIT` | 0 | 0 |
| `bad-reviewby-format.md` | `Review-by: August 2026` (not ISO YYYY-MM-DD) | 0 | 1 |
| `bad-outcome-result.md` | `## OUTCOME` with `RESULT: maybe` (not HIT/MISS/UNRESOLVED) | 0 | 1 |
| `bad-date-impossible.md` | `Review-by: 2026-13-45` (ISO shape but not a real calendar date) | 0 | 1 |
| `bad-reviewby-no-resolution.md` | a `Review-by:` with no `Resolution:` — a scheduled verdict with nothing to grade against | 0 | 1 |

## Hardening fixtures (from the Phase-1 adversarial pass)

An adversarial workflow attacked `council-calibrate.mjs` + the new lint checks + the review protocol
and found 16 issues, all fixed before close. Two dirs pin the load-bearing ones:

- **`sessions-multi/`** — a session whose review went `UNRESOLVED` (with a fresh `Review-by:`) and was
  later resolved `HIT`, both appended (append-only, ADR-0012). Calibrate must read the **LAST**
  `## OUTCOME`, so it scores as HIT (`node council-calibrate.mjs sessions-multi` → High 1/1, Brier
  0.0225). The pre-fix first-match code read the stale `UNRESOLVED` and dropped it from scoring.
- **`sessions-pending/`** — a session with a past `Review-by:` and NO outcome yet. `--overdue` must
  list it, while `--overdue sessions/` (all three already resolved) must list **none** — overdue is
  "what still needs an outcome", so a closed HIT/MISS session never resurfaces (the review loop
  terminates). `sessions-multi/` (closed HIT) is likewise never overdue.

Other fixes proven by `scratchpad` probes: lowercase `CONFIDENCE: medium` scores instead of crashing
the whole scoreboard; a subdirectory named `*.md` no longer EISDIR-crashes; `--today` with no value
or an impossible date exits 1; a non-ISO `Review-by:` is surfaced as a WARN in `--overdue`, never
silently dropped.
