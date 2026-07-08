---
description: Deep security audit (OWASP + STRIDE) via the security-auditor subagent -- the DEEP pass beyond /arc-review's Pass-1 security. High/critical findings open tracked issues; archives + stamps the ledger.
argument-hint: "[scope-or-paths] (default: diff since main)"
allowed-tools: Task, Bash(git diff:*), Bash(git log:*), Bash(git rev-parse:*), Bash(bash .claude/scripts/review-ledger.sh:*), Write
---

Run a deep security audit. Scope: **$ARGUMENTS** (default: `git diff main...HEAD`).

1. **Invoke the `security-auditor` subagent explicitly** -- Task tool, `subagent_type: "security-auditor"`. It runs OWASP Top 10 + a STRIDE trust-boundary threat model with a concrete exploit scenario per finding. Do NOT fall back to general-purpose; if it is missing, STOP and tell me to sync the template.

## One owner per job
This does NOT replace `/arc-review`. The `code-reviewer` agent still runs the scanners (semgrep/gitleaks/osv-scanner) + Pass-1 OWASP on **every** review. `/arc-audit` is the DEEP threat-model pass for security-sensitive diffs (auth, payments, data access) or on demand -- no duplication.

## The arc twist -- findings can't be forgotten
1. Archive the full report to `docs/security/YYYY-MM-DD-audit.md`.
2. Every **HIGH or CRITICAL** finding -> open a tracked issue and route it through `/arc-fix-issue`. A high-sev finding is never left as just a note.
3. Refresh the risks section of `PROGRESS.md`.
4. Stamp the ledger **only if zero CRITICAL findings remain open**:
   ```bash
   bash .claude/scripts/review-ledger.sh stamp security
   ```
