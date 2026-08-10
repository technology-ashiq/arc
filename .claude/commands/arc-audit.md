---
description: Deep security audit (OWASP + STRIDE) via the security-auditor subagent -- the DEEP pass beyond /arc-review's Pass-1 security. High/critical findings open tracked issues; archives + stamps the ledger.
argument-hint: "[scope-or-paths] (default: diff since main)"
allowed-tools: Task, Bash(git diff:*), Bash(git log:*), Bash(git rev-parse:*), Bash(bash .claude/scripts/core/review-ledger.sh:*), Write
---

Run a deep security audit. Scope: **$ARGUMENTS** (default: `git diff main...HEAD`).

1. **Invoke the `security-auditor` subagent explicitly** -- Task tool, `subagent_type: "security-auditor"`. It runs OWASP Top 10 + a STRIDE trust-boundary threat model with a concrete exploit scenario per finding. Do NOT fall back to general-purpose; if it is missing, STOP and tell me to sync the template.

## One owner per job
This does NOT replace `/arc-review`. The `code-reviewer` agent still runs the scanners (semgrep/gitleaks/osv-scanner) + Pass-1 OWASP on **every** review. `/arc-audit` is the DEEP threat-model pass for security-sensitive diffs (auth, payments, data access) or on demand -- no duplication. The `security-auditor` starts from **Pass 0** = arc-scan's committed tool evidence (`arc-scan-summary.sh`), so it never re-runs the scanners; it spends its budget on the logic/threat-model gap the tools can't see.

## Verify each finding BEFORE you emit it
**Follow `docs/playbooks/finding-verification.md`.**
**It is a requirement of this command, not a suggestion.**
Every finding carries `claim` + `cite` (`path:line`) + `quote` (the verbatim text at
that citation). A finding whose motivating line you cannot quote goes to `## Appendix -- unverified`
in the same report -- never into the main report, never into a tracked issue, never with a severity.
If the appendix is non-empty, say how many entries it holds in the report's first paragraph.

**Raising a severity or asserting confidence to make an unquotable finding look verified defeats
this and is worse than the finding it protects.** The gate is on the quote, not on your certainty.
This matters more here than anywhere else in arc: step 2 below turns a HIGH into a tracked issue
someone spends a day on, so an unverified HIGH is not noise -- it is a day of somebody's work.

Read the playbook for why the appendix is mandatory rather than polite: a gate that suppresses
unquotable findings converts false positives into false negatives the moment a true finding is
genuinely hard to quote, and a defect living in the *absence* of a line is exactly that case.

## The arc twist -- findings can't be forgotten
1. Archive the full report to `docs/security/YYYY-MM-DD-audit.md`.
2. Every **HIGH or CRITICAL** finding -> open a tracked issue and route it through `/arc-fix-issue`. A high-sev finding is never left as just a note. **Verified only** -- an appendix entry is not eligible, by the section above.
3. Refresh the risks section of `PROGRESS.md`.
4. Stamp the ledger **only if zero CRITICAL findings remain open**:
   ```bash
   bash .claude/scripts/core/review-ledger.sh stamp security
   ```
