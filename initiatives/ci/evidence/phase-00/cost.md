# Phase 00 cost (REQ-03, merged into REQ-01)

First green PR run: 40035076217 (PR #461, ubuntu, public repo: 0 billed min). Baseline 39736016311 is the old matrix. Billed = ceil(seconds/60) x1 on ubuntu, as if private.

| job | seconds | billed min |
|---|---|---|
| changes | 11 | 1 |
| ci-tier | 51 | 1 |
| bats (3) | 549 | 10 |
| face | 18 | 1 |
| bats (1) | 565 | 10 |
| quality | 13 | 1 |
| security | 16 | 1 |
| bats (2) | 427 | 8 |
| node-test | 12 | 1 |
| bats (0) | 456 | 8 |
| test | 10 | 1 |
| **total** | 2128 | 43 |

Baseline 39736016311: 414 billed min (sum of ceil per job, before OS multipliers).

Post-flip column: not measured. The repo is still public (`gh api repos/technology-ashiq/arc --jq .visibility` = public, 2026-10-25), so §5 step 5 (owner flips private) has not happened; on a public repo every minute is free.
