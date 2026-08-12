# Grep baseline — measured 2026-08-11, before any adapter existed

Phase 00, REQ-01 / ADR-0706. Method fixed in advance by `phases/phase-00-spec.md` §D2 so it
could not be chosen after seeing the result. Run on the owner box (Windows 11, Git Bash
`grep` 3.x), against the live corpus at commit `e8a186c`.

At this commit `.claude/scripts/memory/` **does not exist**. Nothing had been written that
could beat this number when it was taken.

## The pinned method, verbatim

Content words = query words minus the pinned stopword list (§D2). Pattern = those words joined
by `|`. Command, per query:

```
grep -rniE "<pattern>" docs/retro-log.md docs/trial-ledger.md docs/develop/learning-ledger.md docs/adr/
```

Grep has no ranking, so its order is file-then-line order. A row is a **hit** if an expected
id's source line is among the **first 3 matching lines**. Three runs per query, median
wall-clock. `total` is how many lines grep matched in all.

## Result: 1 of 12

| # | query | median | matched lines | top-3 hit | which id |
|---|---|---|---|---|---|
| G01 | which ADR closed the spine event kind vocabulary | 57ms | 1270 | no | — |
| G02 | duplicate receipts silently lost idem preimage | 57ms | 249 | **yes** | `retro:2026-07-28` dup-idem row |
| G03 | can two lanes emit in parallel worktree mode B | 58ms | 4371 | no | — |
| G04 | author wrote breaking inputs all caught fresh agent found holes | 54ms | 978 | no | — |
| G05 | exit 0 but receipts quarantined fire-and-forget | 53ms | 1659 | no | — |
| G06 | appetite sum warned zero slack inverted fire | 57ms | 541 | no | — |
| G07 | two sessions same ADR numbers collision century | 54ms | 1292 | no | — |
| G08 | markdown heading regex anchored line start prose mention | 58ms | 434 | no | — |
| G09 | apostrophe single-quoted shell embedded node broke | 58ms | 102 | no | — |
| G10 | when is a cycle officially closed which document | 53ms | 567 | no | — |
| G11 | test passed while executing nothing vacuous | 54ms | 484 | no | — |
| G12 | who approves a learning promotion fresh agent owner | 59ms | 404 | no | — |

**1 of 12.** The assumptions-ledger trigger fires at **>= 10 of 12**, so it does not fire and
the module's premise survives its own stop condition.

## Why 1 of 12 is NOT the bar the module has to beat

Reported here rather than left implicit, because a baseline a module trivially beats is a
flattering comparison by construction — which is the exact failure §D2 says this baseline
exists to prevent, and the same shape as the 2026-07-30 lesson that `PASS = zero VIOLATION`
cannot detect mediocrity.

An alternation of 6–10 common words matches 100–4400 lines. In file-then-line order the first
three are therefore almost always the top of `docs/retro-log.md`, whatever the query was. The
1/12 is largely an artifact of grep having no ranking at all, not a measurement of whether a
person with grep can find these lessons.

So a second, strictly harder control was run — **not** as a replacement (the pinned number
above is what the STOP trigger reads) but as the bar that actually means something:

**ORACLE grep** — for each query, the single *rarest* content word in the corpus, i.e. the most
distinctive term a searcher could possibly pick **if they already knew the recorder's
vocabulary**. Same top-3 rule.

| # | rarest word | its total matches | top-3 hit |
|---|---|---|---|
| G01 | `vocabulary` | 92 | no |
| G02 | `lost` | 19 | **yes** |
| G03 | `worktree` | 13 | no |
| G04 | `holes` | 17 | no |
| G05 | `fire-and-forget` | 8 | **yes** |
| G06 | `warned` | 7 | no |
| G07 | `century` | 8 | no |
| G08 | `mention` | 7 | **yes** |
| G09 | `apostrophe` | 2 | **yes** |
| G10 | `officially` | **0** | no |
| G11 | `executing` | 2 | **yes** |
| G12 | `approves` | 7 | no |

**ORACLE grep: 5 of 12** — and it is an oracle, so a real searcher scores at or below it.

**This 5/12 is the number Phase 2's comparison table must beat**, not the 1/12. Recorded now,
before the module exists, so it cannot be renegotiated later.

## What the misses say about the design

- **G10 is the cleanest evidence for ADR-0709.** The word `officially` appears **zero** times in
  the whole corpus. The searcher's word and the recorder's word simply differ; no amount of grep
  skill closes that, and no stemmer helps either. That is what the curated alias layer is for.
- **G01 fails at 92 matches for `vocabulary`.** The right answer exists and is findable — it is
  just 90 lines down. This is a *ranking* miss, not a *retrieval* miss, and it is precisely the
  gap bm25 is supposed to close.
- **G03 and G07 both name a real, single, correct document** (`adr:0056`, the ADR-numbering retro
  row) that grep buries. Both were asked for real during this lane's own kickoff and both were
  answered by a human reading the file.

## Reproducing

The measurement script is not committed — §D2 pins the method, and the command line above is
the method. Re-running it by hand reproduces the table; the stopword list in §D2 is verbatim and
is a gate input precisely because two different lists give two different answers.
