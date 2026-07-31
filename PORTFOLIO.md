# PORTFOLIO.md — the company board

> **A view, never the truth (ADR-0051).** Every value below is derived from a lane's
> `initiatives/<lane>/PROGRESS.md` machine header — nothing is copied from prose and
> nothing originates here. On any mismatch the lane files win and the board lint says so.
> Truth hierarchy: `PROGRESS.md` = where the work is · `PLAN.md` = what the cycle is ·
> this file = index + priority · `docs/HISTORY.md` = the immutable company log.
>
> Row order **is** the priority order. There is no priority column, no owner, no ETA and
> no health field: a number nobody recomputes is a number that starts lying.

Updated: 2026-07-31

## Active initiatives

| lane | status | cycle | position | appetite/burn | blocked-on / depends-on | next |
|---|---|---|---|---|---|---|
| portfolio | LIVE | arc-portfolio | 02 — Parallel-safety floor | 3d / 1.9d | — | refine phase 02's coarse verification plan via `/arc-change` |
| design | IDLE | arc-design (closed 2026-07-30) | — | — / — | — | `/arc-kickoff --lane design` when a new cycle starts |

## Venture passports

> Ventures are revenue apps in their **own repos**, each running its own root-mode arc
> install (ADR-0059 / PORT-J). A venture never gets a lane, never gets tracker state here,
> and never appears in the table above — a passport row is the whole of its presence.

| venture | repository | current status | next |
|---|---|---|---|
| lexos | private, separate repo | in build outside arc | — |

<!--
No `develop` row, and this is now a settled rule rather than an open question:
ADR-0061 — the board indexes BORN lanes only. A row exists iff `initiatives/<lane>/` does,
with a readable machine header to derive its values from. `QUEUED` stays in the vocabulary
as a state a born lane holds when it is scheduled next; it is never a way to announce a
lane that does not exist yet. "What comes after this cycle" is PLAN.md's question, not the
board's. develop gets its row at `/arc-kickoff --lane develop`, in that same commit.
-->
