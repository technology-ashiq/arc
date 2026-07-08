---
description: Review the current branch's diff with the code-reviewer subagent; findings archived to docs/reviews/.
argument-hint: [base-branch (default main)]
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git rev-parse:*), Task, Write
---

Run a code review on `git diff ${1:-main}...HEAD` (or the staged diff if the branch is clean).

1. **Invoke the `code-reviewer` subagent explicitly** — use the Task tool with
   `subagent_type: "code-reviewer"`. Do NOT use `general-purpose` agents and do NOT invent your
   own reviewers (adversarial hunter, test critic, etc.): the `code-reviewer` definition already
   carries the scanners (semgrep/opengrep, gitleaks, osv-scanner, knip) + the 4-pass OWASP method,
   and general-purpose agents have none of those tools. Pass it the diff scope and let it run in
   its isolated context; it returns only the summary. If no `code-reviewer` subagent is available
   in this project, STOP and tell me to sync the template
   (`sync-to-project.ps1 -Target <this project>`) — do not silently fall back to general-purpose.
2. Relay its findings verbatim in chat: scanner summary, Critical / Warning / Nit with
   `file:line` + fix, and the one-line verdict: ship / fix-first / needs-discussion.
3. **Archive the review** to `docs/reviews/YYYY-MM-DD-HHMM-<branch>.md` (create the folder
   if needed) containing: date, branch, reviewed commit (`git rev-parse --short HEAD`),
   the full findings, and the verdict. This is the committed audit trail.
4. If there are Criticals: offer to fix them now. After the fix is committed, append
   "Resolved in <commit-hash>" under the relevant finding in the same review file —
   findings and their resolutions live together.
