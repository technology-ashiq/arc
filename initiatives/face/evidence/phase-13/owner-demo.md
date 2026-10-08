# Phase 13 live demo — the owner reads the Org room

**Date:** read before 2026-10-08 · **Where:** the MAIN clone (`E:/Work_Hub/01_Automemory/arc`), started with
`node .claude/scripts/hq/arc-face.mjs` from Git Bash. On that day `main` held #361 (`d61bf260`: the binds in
the Org room and the `org.seat-assign` op).

**What the owner was asked to do:** open HQ → Org, read who sits each role (a staffed role's agents, and a
vacant role's "no one sits this role"), then plan one seat change with `org.seat-assign`. Planning is a
`--dry-run` and writes nothing.

**What the owner said (in session, verbatim):**

> org seats pathen ok now

(Tanglish: "I saw the org seats; ok, now [go on].")

**What his words cover, and what they do not:** his words cover the Org room naming who sits each seat. They
do not say whether he planned a seat change. No seat change was applied: no `feat/face-org-seat-*` branch exists
and no `approval.requested{gate: org-seat}` was emitted. The plan and the apply are held on CI on every leg
(PR #361, run 37553735013, 19/19). These cover the dry-run diff with the derived tier, one card changed on a new
branch with every other byte identical, the three refusals each leaving no branch, file or event, and the browser
smoke in dark and in light. So this phase is ticked narrower than the Verification plan's Live row, and the done
log says so.
