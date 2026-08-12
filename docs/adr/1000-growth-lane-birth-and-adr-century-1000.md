# ADR 1000 — growth is born as a lane and claims ADR century 1000–1099

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** one-way
**Revisit trigger:** a second lane is found to have written ADRs inside 1000–1099 on any branch
or worktree — then the collision is resolved in one place, by the band table, before either
lane's numbers merge.

## Context

`/arc-kickoff` is the only surface that may create a lane (ADR-0054, `.claude/rules/lanes.md`),
and it assigns the next free ADR century at that moment. GRO-H in the design source says growth
claims "the NEXT FREE century at kickoff (0600s as of this writing — never hardcode)".

0600s is no longer free. Verified today: `0600` absorb · `0700` memory · `0800` scheduler
(claimed on a local-only branch, invisible to anyone checking remotes) · `0900` bench (claimed
this morning). `PORTFOLIO.md:52` says `1000–1099 | next lane to be born`.

That row has now been stale three separate times — `PORTFOLIO.md:19` records bench finding it
stale this morning, and calls it "the third occurrence of that pattern". A band table and
`wip-line` each see one worktree alone. So the board's claim was not trusted: **every one of
the 14 worktrees plus the main clone was scanned directly for any ADR numbered ≥1000. Zero
found.** The band is genuinely free, and the check that established it is the one the previous
three collisions lacked.

The `venture` field on every spine event must also be pinned now, because it enters no idem
preimage and is therefore unfixable-by-correction later without a supersedes chain.

## Options considered

1. **Claim 1000–1099, verified by direct scan of every worktree.** Con: the scan is manual.
2. **Claim 1000–1099 on the board row's authority alone.** Con: that row has been wrong three
   times out of the last four lane births; it is a derived view, not the truth (ADR-0051).
3. **Wait for scheduler's branch to merge so the picture settles.** Con: scheduler is local-only
   and unmerged; waiting makes this lane's numbering depend on another lane's merge schedule.

## Decision

**Option 1.** growth claims **1000–1099** and never numbers outside it. The lane lives at
`initiatives/growth/` with `products/growth` as its manifest. Company organs — ADRs, HISTORY,
retro-log, trial-ledger, `tests/**`, `.github/**` — stay at the repo root and belong to no lane
(ADR-0053).

**`venture: "arc"`** on every event this lane emits. The first client is arc's own public site,
not a customer venture (design source, "Changes vs BRIEF" #2); `arc` satisfies `VENTURE_RE`
(`^[a-z0-9][a-z0-9-]{0,63}$`, `validate.mjs:80`). Appendix-A venture activation later swaps
this per site — it is a config value, never a code change.

**Evidence:** `PORTFOLIO.md:40–52` (band table) · `PORTFOLIO.md:19` (bench's stale-row finding,
2026-08-12) · direct scan of `arc-absorb, arc-bench, arc-develop, arc-engine, arc-evlove,
arc-executor, arc-growth, arc-leads, arc-leads-2, arc-ledger, arc-memory, arc-model, arc-policy,
arc-scheduler` + `E:/Work_Hub/01_Automemory/arc` — max ADR found anywhere is `0914`.
**Confidence:** high — the claim rests on a scan, not on a table.
**Rejected because:** option 2 trusts the exact artifact that failed three times; option 3 makes
this lane's identity depend on an unmerged branch nobody else can see.

## Consequences

Easier: `kickoff-lint`'s `[adr-dup]` check now has a band to enforce, and a growth ADR number is
unambiguous. Harder: this ADR is written from a worktree, so like scheduler's it is invisible to
anyone checking `origin` alone until it merges — the band table row must be updated in the same
change that lands this lane, or the fourth occurrence is already in motion.
