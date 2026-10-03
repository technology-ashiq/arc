# Logic attack, round 1 -- triage (2026-10-01)

Input: the org code diff only (`.claude/scripts/org/**` + `tests/org*`, 22 files, 178 KB) against `origin/main` at
`c4b6f73`, with the lane's 42 fixed-defect patterns. Model: `deepseek/deepseek-v4-flash-0731` through the owner's
local OmniRoute proxy, `ARC_LLM_REASONING=off`. The first attempt ran out its 900 s cap; the second answered.
The run receipt was not emitted: a worktree cannot write the spine, by design.

This is the first logic result the lane has ever had. Every earlier attempt ended at about 300 s because the
generic-api driver did not stream, and Node's fetch stops waiting for response headers at 300 s. That engine bug
is fixed in the same commit (see PROGRESS `## Now`).

| id | as filed | verdict | action |
|---|---|---|---|
| L1 | critical | REAL, downgraded to MEDIUM | `teamApproval` read the latest approve among several decisions. A real spine cannot hold two decisions on one request (validate.mjs binds a decision's idem to the request it decides), but `--spine-dir` reads any directory. Fixed: two or more decisions on one request fail closed, named. Pinned: `team-spine.mjs twice` + org-team.bats. |
| L2 | high | REJECTED, by design | Vacancy demand counts on the ROLE, and a card is company-wide (ADR-1602: a vacancy fills on three demands for it). Demand from two ventures is still demand for the one role. |
| L3 | high | REJECTED, by design | A criterion counts a spine KIND for the venture (org/stages.yaml header, ADR-1606). `role` names the seat that owns the work, and it does not filter which receipts count. |
| L4 | medium | REAL | org-review read `org/attribution.yaml` without dropping a BOM or folding CRLF, which every other org reader does. Fixed and pinned: org-review.bats writes a BOM+CRLF map and scores it the same as the plain map. The parser is confirmed to refuse the raw BOM text, so the test fails if the fix is removed. |
| L5 | high | REAL, downgraded to MEDIUM | The same two-decision hole in the hire stamp (`org-catalog --hire`) and in `org-coverage --spine-dir`. Fixed in both: fail closed, named. Pinned: `interview-spine.mjs twice` + two org-team.bats checks. |
| L6 | low | DEBT | The scheduler wrapper's 110 s ceiling vs many teams under `--all --emit`. One team fits (B6). Debt row 4. |
