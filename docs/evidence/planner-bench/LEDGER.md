# Planner bench — outcome ledger

> **Append-only. One row per arm-run.** Written by `scoring/score.mjs`; never hand-reorder.
> This is the file that turns opinions about planners into a record. `docs/gsd-superpowers-vs-arc-comparison.md`
> and `docs/gstack-vs-arc-comparison.md` are *paper* comparisons — read-the-source verdicts with zero
> outcome data behind them. This file is the outcome data. When the two disagree, this file wins.
>
> **Promotion rule:** a pattern that appears in **two or more** rows may be promoted to
> `docs/retro-log.md` as ONE line (`YYYY-MM-DD | project | pattern | prevention`), where
> `/arc-kickoff` will read it as a pre-mortem seed. One-off findings stay here and are never
> promoted — that's the whole reason retro-log stays short enough to be read.

| date | bench | arm | goal | composite | acceptance | traps | one-sentence finding |
|---|---|---|---|---:|---:|---:|---|
| 2026-07-12 | PLANOFF-01 | arc | snip (URL shortener) | 94.5 | 100% | 10/10 | Only arm that ordered phases by what could kill the build; commit log is that plan executed verbatim, zero fix commits — but no better outcome than the arm that planned nothing. |
| 2026-07-12 | PLANOFF-01 | gsd | snip (URL shortener) | 94 | 100% | 10/10 | Heaviest ceremony (18-decision locked spec + a plan-check that found 14 gaps in its own plan) bought perfect trap recall and zero rework — and no better outcome. |
| 2026-07-12 | PLANOFF-01 | gstack | snip (URL shortener) | 90.8 | 100% | 10/10 | Its post-build review pass found the only real defect anyone caught (malformed percent-escape -> 500) — a defect no plan predicted and no acceptance test probed. |
| 2026-07-12 | PLANOFF-01 | superpowers | snip (URL shortener) | 88.8 | 100% | 10/10 | TDD-first task plan and the only other arm to survive the malformed-escape probe; ordered by feature not risk, and left no state file behind. |
| 2026-07-12 | PLANOFF-01 | raw | snip (URL shortener) | 59.5 | 100% | 5/10 | Wrote zero planning documents, shipped in 4 commits and 14 files, and passed the identical acceptance suite — the control condition, and the result that hurts. |
