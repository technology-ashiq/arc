---
description: Browser QA loop -- qa-tester finds bugs, you fix each with an atomic commit + a REQUIRED regression test, then re-verify. Archives to docs/qa/ and stamps the review ledger.
argument-hint: "[url-or-flow] [--report-only]"
allowed-tools: Task, Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(npm run test:*), Bash(npm run e2e), Bash(bash .claude/scripts/core/review-ledger.sh:*), Bash(bash .claude/scripts/hq/arc-event.sh:*), Read, Edit, Write
---

Run a QA pass on: **$ARGUMENTS** (default: the current phase's exit-criteria flows).

1. **Invoke the `qa-tester` subagent explicitly** -- Task tool, `subagent_type: "qa-tester"`. It drives the app in a real browser via the Playwright MCP and returns pass/fail evidence per flow. Do NOT fall back to general-purpose; if `qa-tester` is missing, STOP and tell me to sync the template (`sync-to-project.ps1 -Target <this project>`).
2. For every **BUG** it reports (not BLOCKED), fix it on the main thread:
   - one bug = one **atomic commit**, `fix(qa): ...` (never push).
   - each fix **MUST** ship a **regression test** that fails before / passes after. No test -> not fixed. Non-negotiable (this is what makes arc's QA beat a report-only pass).
3. Re-invoke `qa-tester` on the fixed flows to confirm green.

`--report-only` -> stop after step 1: pure bug report, no code changes, no stamp.

## Always finish by
- Archiving to `docs/qa/YYYY-MM-DD-<phase>.md`: flows tested, bugs, fixes + commit SHAs, regression tests added, screenshot refs.
- Updating `PROGRESS.md` `## Now` with the outcome.
- Stamping the ledger (skip in `--report-only`):
  ```bash
  bash .claude/scripts/core/review-ledger.sh stamp qa
  ```
- Leaving the receipt (spine) — hook-mode, never blocks the flow:
  ```bash
  bash .claude/scripts/hq/arc-event.sh emit qa.completed --payload '{"phase":"<phase>","bugs":"<n>","fixed":"<n>"}'
  ```
