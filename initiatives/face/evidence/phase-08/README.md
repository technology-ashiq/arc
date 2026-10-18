# Phase 08 evidence -- dogfood on the final surface

Verification plan row 0, the precondition. Both rows are quoted from `initiatives/face/PROGRESS.md` on 2026-10-14:

> | 07 | Reference room ... | 10.5d | ✅ **CLOSED 2026-09-30** — 5d of 10.5d (worked 09-26, -27, -28, -29, -30); REQ-12 validated. ...

> | 09 | Front door ... | 1.5d | ✅ **CLOSED 2026-10-01** — 1d of 1.5d (built 10-01); REQ-13 validated. ...

Phases 10-17, which the plan also runs before 08, are all closed. The last of them was 17, on 2026-10-13 (#414).

## What is here (all rows done 2026-10-18)

| File | Row | State |
|---|---|---|
| `attack-*.json` | -- | the attack rounds for the `arc-face.mjs` Git-Bash fix (d102d9c) and for the `--day` amendment (dfc952e r1, f8c1485 r2) |
| `trend.md` | 3 | **done:** the 2026-09-17 to 10-14 baseline, with the two days read beside it on 2026-10-18 |
| `day-1.txt`, `day-2.txt` | 1, 2 | **done:** 2026-10-15 MET, 2026-10-18 MET, both read from the main clone |
| `summary.txt` | 2 | **done:** `--days 2 --day 2026-10-15 --day 2026-10-18` reads REQ-10 MET, 13 decisions, exit 0 |

## The measure (amended 2026-10-14, PR #421)

At the end of each day, run from the main clone:

```bash
node .claude/scripts/core/face-dogfood.mjs --days 1 --day <YYYY-MM-DD>
```

It exits 0 only when that day meets three conditions:

- every `decision.recorded` that day has a face journal line;
- no journal line claims a receipt that is absent from the spine;
- at least one face op applied that day has, on the spine that same day, a receipt of the kind its own `face-ops.mjs` row names.

The count of decisions made outside the face across all history is printed beside the result, never hidden.
