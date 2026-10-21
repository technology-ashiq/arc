# Phase 01 heights -- Overview at 1366x768, before and after the Records tab (REQ-02, ADR-1365)

Measured by `heights.cjs` (this folder) against this worktree's face on a read-only copy of the owner's canonical spine
(`--spine` copy, sim door), 2026-10-21. Bound: each room's Overview <= 3,000 px.

## Org's chart, measured before its lists moved

Header 403 px + org chart 1,557 px = 1,960 px. The chart alone is under 3,000 px, so org's bound stands as written (no `/arc-change`).

## Before (main @ 3fda79d)

| room | page height (px) | tallest panels (px) |
|---|---|---|
| ventures | 11420 | The rosterventures.yaml's kill panel joi 11180 · the factory · venture: arc52 lines 7441 · lexos 895 · arc-sandbox 755 · myfitfolio 755 |
| money | 10975 | real revenuerevenue.received 10735 · cost.incurred — overhead (venture: arc)5 7422 · Fourteen daysone axis, three substances  992 · What this route does not servea gap the  749 · simulated revenuerevenue.simulated 503 |
| story | 8427 | The chaptersone entry per closed cycle,  8187 · The chaptersone entry per closed cycle,  7955 · Every initiativethe logbook's glance tab 5060 · Milestoneswhat the company set out to re 415 · Where the story is writtendocs/HISTORY.m 146 |
| org | 8282 | The org chartowner → CEO → departments → 8042 · The rolesevery role card by department · 4291 · Scorecardseach staffed seat from its own 3626 · The org chartowner → CEO → departments → 1557 · The rosterevery lane on the board · each 1307 |

## After (this branch)

| room | page height (px) | moved to Records |
|---|---|---|
| ventures | 1816 | ventures roster (was one card each), overhead cost lines |
| money | 2931 | kill lines, product + overhead cost lines, route gaps; columns rebalanced |
| story | 1227 | every chapter but the newest, every initiative |
| org | 2895 | lane roster, ADR bands, roles, scorecards, venture teams |
