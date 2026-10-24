# Phase 01 attack round 2 triage (`1bede0b`, 2026-10-24) — the last round (cap: two per PR)

Boundary 6 findings. Logic: see the line at the end.

**Fixed:** B2 (the full path is asked at any depth: PORTFOLIO.md, read by 4 bats files, is now code), B3 (`npm run ci`
= `test-changed.mjs --ci`, which runs ci-quality through git's bash).
**Debt:** B4 -> D9, B5 -> D10.

REJECTED: B1 tests read the working tree, not the commit — already-covered (CI tests the pushed commit; the pre-push now prints a WARN naming the count of modified tracked files, and a non-HEAD push is refused)
REJECTED: B6 node output lost on timeout — already-covered (stdout is written before the cap message, line 143)

## Round 2, second boundary pass (`b6fbcb0`, on the round-2 fixes; logic did not run again)

**Fixed:** B2 (`--stdin` with no ref lines tests nothing, never HEAD), B3 (a missing bats inside git's bash is named, not a wall of FAILED).
**Debt:** B5 -> D11, B6 -> D12.

REJECTED: B1 a merge-base with no common ancestor runs the core set — already-covered (the phase-01 spec mandates it: a failed fetch or merge-base runs the core set and prints why)
REJECTED: B4 an unreadable tests/ makes every doc code — already-covered (fail-closed by design: doubt runs the tests)

## Round 2 logic (`91b025a`, deepseek/deepseek-v4-flash-0731, reasoning ON)

Three earlier attempts: two RUN FAILED with no cause line, one `0 finding(s)` in 3 s with reasoning off -- a
non-read, not a pass (kept out of evidence). With reasoning on: 8 findings in 5m06s.

**Fixed:** L2 (a lane run whole must run >= its `.count`, the floor's claim), L3 (`# tests N` is read from the LAST
summary line). Also from the third boundary pass: B3 (the hook's fetch never prompts for credentials,
`GIT_TERMINAL_PROMPT=0`), B5 (the `--ci` floor spawn gets the scrubbed env too).

REJECTED: L1 test_helper.bash and _lib are shared but run only the core set — already-covered (the phase-01 spec maps them to core plus every node lane; every bats file loads test_helper, so "its tests" is the full suite, which never runs pre-push)
REJECTED: L4 the dirty-tree WARN does not fail — duplicate (r2 B1)
REJECTED: L5 a 2-segment dir a test reads is not caught — already-covered (READ_BY_TESTS carries those; a 2-segment check would make every docs/adr and initiatives/<lane> change code, which is REQ-02's whole failure)
REJECTED: L6 the extension rule is a denylist — duplicate (r2 B5, D10)
REJECTED: L7 the fetch-failure fallback drops the pushed lanes — duplicate (r2 B4, D9)
REJECTED: L8 the name grep misses indirect callers — duplicate (r1 L5)
REJECTED: boundary r2c B1 a failed mktemp kills the hook before branch-guard — non-actionable (the hook then exits non-zero and the push is refused: fail-closed)
REJECTED: boundary r2c B2 a second branch in one push is refused — already-covered (by design since r1 B1: this tree can only vouch for HEAD)
REJECTED: boundary r2c B4 bashPath falls back silently — already-covered (the next r2 fix names a missing bats in that bash)
REJECTED: boundary r2c B6 npm lint re-enters a PATH shell — duplicate (D12)
REJECTED: boundary r2c B7 a CR-terminated ref line — non-actionable (stdin is split on \r?\n)
