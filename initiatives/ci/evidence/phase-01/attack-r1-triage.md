# Phase 01 attack round 1 triage (`306d3d3`, 2026-10-24)

Boundary (claude-code) 12 findings; logic (`deepseek/deepseek-v4-flash-0731`, direct OpenRouter, 3rd attempt -- the
first two ended RUN FAILED with no cause line and an unchanged input) 15 findings.

**Fixed:** B1 (hook reads stdin once, feeds branch-guard and test-changed), B2/L1 (no mapped file -> core set; a node
run reporting 0 tests fails), B3 (GIT_* scrubbed from the test env), B4 (nullglob + lane-name grammar in ci-quality),
B5/L6 (git's bash on Windows), B7 (stdin read only with `--stdin`), B8 (`npm run lint` moved into ci-quality, so a
paperwork PR still runs gate-parity/brain-drift/arc-compile), B9 (fixtures and _lib never a test lane), B11 (code
extensions are code anywhere), L3/L10 (paperwork also asks the tests' own text), L4 (longest known lane prefix),
L7 (a changed test file runs itself).
**Debt:** B6 -> D6, B10 -> D7, L14 -> D8.

REJECTED: B12 engines >=24 changes the consumer contract — already-covered (PLAN phase-01 spec sets engines.node >=24: CI proves 24 only, a lower floor would be untested)
REJECTED: L2 a newline in a --files path — non-actionable (--files is one path per line by contract; the diff path uses -z)
REJECTED: L5 the shared-script name grep misses indirect callers — already-covered (a `shortcut:` comment names it; CI runs the whole suite)
REJECTED: L8 a failed changes job leaves code empty — non-actionable (the attacker's own fix is "no change": test requires changes=success)
REJECTED: L9 ci-quality uses bash and node — non-actionable (the attacker found no defect)
REJECTED: L11 test-changed header — non-actionable (no defect named)
REJECTED: L12 the cap when a step overruns — non-actionable (the attacker's fix is "none"; ETIMEDOUT is handled)
REJECTED: L13 pre-push ordering — non-actionable (no defect named)
REJECTED: L15 run loop — non-actionable (no defect named)
