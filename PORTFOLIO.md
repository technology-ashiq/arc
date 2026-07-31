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
| portfolio | LIVE | arc-portfolio | 01 — Self-host + link history + board v1 | 3d / 1.4d | — | close phase 01 in lane-mode |
| design | IDLE | arc-design (closed 2026-07-30) | — | — / — | — | `/arc-kickoff --lane design` when a new cycle starts |

## Venture passports

> Ventures are revenue apps in their **own repos**, each running its own root-mode arc
> install (ADR-0059 / PORT-J). A venture never gets a lane, never gets tracker state here,
> and never appears in the table above — a passport row is the whole of its presence.

| venture | repository | current status | next |
|---|---|---|---|
| lexos | private, separate repo | in build outside arc | — |

<!--
Deliberately absent: a `develop` row. The source pack (§4) illustrates the v1 board with
`develop QUEUED`, and the same section rules that every initiatives row must resolve to an
`initiatives/<lane>/` directory while empty lanes are never pre-scaffolded — a lane is born
only at /arc-kickoff. Those two cannot both hold for a lane that does not exist yet, so v1
ships the reading that breaks no rule and the contradiction is the owner's to settle
(route via /arc-change before Phase 02 writes the lint that would flag it).
-->
