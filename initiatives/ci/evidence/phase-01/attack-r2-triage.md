# Phase 01 attack round 2 triage (`1bede0b`, 2026-10-24) — the last round (cap: two per PR)

Boundary 6 findings. Logic: see the line at the end.

**Fixed:** B2 (the full path is asked at any depth: PORTFOLIO.md, read by 4 bats files, is now code), B3 (`npm run ci`
= `test-changed.mjs --ci`, which runs ci-quality through git's bash).
**Debt:** B4 -> D9, B5 -> D10.

REJECTED: B1 tests read the working tree, not the commit — already-covered (CI tests the pushed commit; the pre-push now prints a WARN naming the count of modified tracked files, and a non-HEAD push is refused)
REJECTED: B6 node output lost on timeout — already-covered (stdout is written before the cap message, line 143)
