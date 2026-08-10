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

**Forward it to the subagent, in the Task prompt, or nothing is enforced.** The findings are written
by `security-auditor`, not by you, and its own definition mandates `Severity / Location / Exploit
scenario / Fix` and has never heard of these fields -- `.claude/agents/**` is off the ADR-0602
allowlist, so this file is the only place the requirement can be added. Your Task prompt MUST carry:
the playbook's path, the three fields, and the two re-routings in the next paragraph. You also have
no `Read` tool (see `allowed-tools` above), so **you cannot resolve a citation yourself** -- the
subagent resolves it or it is unresolved.

**Two of `security-auditor`'s own rules are DELETIONS, and here they become appendix routings.** It is
told to drop a finding it cannot write an exploit scenario for, and to report only at `>= 8/10`
confidence. Under this command both are `## Appendix -- unverified` entries with a provisional
severity, never drops. Say so in the Task prompt in those words.

Every finding carries `claim` + `cite` (repo-root-relative `path:line` or `path:from-to`, resolved
against the **working tree at HEAD**, never diff line numbers) + `quote` (the verbatim text there),
**one `cite`+`quote` per asserted clause** -- a claim about a relationship between two locations needs
both quoted or it is unverified. A **missing control is quotable by anchor**: cite the line where the
control must appear (the handler, the route, the table definition), which keeps the entire
absent-control class reportable instead of burying it.

A finding you cannot anchor at all goes to `## Appendix -- unverified` -- a top-level `##` section,
**last in the report, never nested inside a severity group** -- with a provisional severity and one
line on what was missing. It never becomes a tracked issue. **Always state the appendix count in the
report's first paragraph, including `Appendix -- unverified: 0 entries`**, and say how many entries it
holds; a conditional count is invisible in the one case that matters, because a report with three
findings quietly dropped looks exactly like a clean one.

**Raising a severity or asserting confidence to make an unquotable finding look verified defeats
this and is worse than the finding it protects.** The gate is on the quote, not on your certainty.
This matters more here than anywhere else in arc: step 2 below turns a HIGH into a tracked issue
someone spends a day on, so an unverified HIGH is not noise -- it is a day of somebody's work.

Read the playbook for why the appendix needs a provisional severity rather than none: a severity-less
appendix entry is not a CRITICAL, so an unquotable critical defect would satisfy step 4's "zero
CRITICAL" and stamp the ledger green -- the rule making the review worse than no rule on the one path
that gates shipping.

## The arc twist -- findings can't be forgotten
1. Archive the full report to `docs/security/YYYY-MM-DD-audit.md`.
2. Every **HIGH or CRITICAL** finding -> open a tracked issue and route it through `/arc-fix-issue`. A high-sev finding is never left as just a note. **Verified only** -- an appendix entry is not eligible, by the section above.
3. Refresh the risks section of `PROGRESS.md`.
4. Stamp the ledger **only if zero CRITICAL findings remain open in EITHER section** -- the main
   report *and* `## Appendix -- unverified`, read by provisional severity. An unquotable critical
   defect is still a critical defect; a gate that only counts the section it can quote is a gate that
   rewards not quoting. `review-ledger.sh stamp` takes no evidence at all -- it records `passed` for
   HEAD, and `require security` then reads green for the ship gate -- so this condition is the whole
   check, and nothing downstream will catch it if you skip it.
   ```bash
   bash .claude/scripts/core/review-ledger.sh stamp security
   ```
