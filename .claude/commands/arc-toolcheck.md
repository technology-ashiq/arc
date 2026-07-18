---
description: Full toolchain health report — every tool's status (ready / missing / stale) rendered as the project's smart-table artifact, with the exact fix for anything not ready, then offers to install/repair what's broken.
argument-hint: [--fix to run the fixes straight after the report]
allowed-tools: Bash(bash .claude/scripts/core/toolchain-health.sh:*), Bash(git status), Bash(node --version), Bash(npm --version), Bash(npx --version), Read, Write, Artifact
---

Report the full toolchain status for this project and help fix whatever isn't ready.

1. Run the checker — it is the single source of truth for the status DATA:
   `bash .claude/scripts/core/toolchain-health.sh`
   The SessionStart hook runs the same script `--brief`, so this is the detailed view of
   what that heads-up summarized. Do NOT re-sort, drop, or invent rows — the script's
   statuses are relayed faithfully; only the presentation changes in step 2.

2. **ALWAYS present the result as the smart-table artifact — this is the project's standard
   toolcheck format.** Never reply with the raw Markdown table; the artifact IS the report.
   - Load the format template: `.claude/templates/toolchain-health-artifact.html`.
     Regenerate ONLY (a) the `rows` data array in the marked `ROWS DATA` block, (b) the
     "last checked" timestamp in the `.eyebrow` line, (c) the "You do these" card, and
     (d) the "Optional extras" block — all from the fresh script output. Everything else
     (palette, type, layout, interactions) stays byte-identical; that consistency IS the format.
   - Rows support an optional `caveat` field (HTML string) for session-observed
     discrepancies the script can't see — e.g. an MCP registered in config but currently
     disconnected. Use it; don't silently change the script's status.
   - Write the filled file to the session scratchpad, then publish with the Artifact tool
     (favicon `🛠️` — keep it stable across runs).
   - **One stable URL per project:** if `.claude/state/toolcheck-artifact-url` exists, pass
     its contents as `url` so the SAME artifact updates in place. Otherwise publish fresh
     and save the returned URL into that file. (`.claude/state/` is gitignored — the URL is
     tied to the owner's claude.ai account, so machine-local is correct.)
   - Reply in chat with the artifact link + the one-line counts summary
     (`N ready · N need action · N optional`).

3. If everything is Ready (no 🔴/🟡), say so in one line with the link and stop — don't
   invent work.

4. Otherwise, briefly call out what needs attention — 🔴/🟡 rows first (recommended), then ⚪
   (optional). For each, say in a few words what it arms
   (e.g. "gitleaks → the code-reviewer's secret-scanning pass"). The artifact's table and
   copy-to-clipboard command chips already carry the fixes, so point at it instead of
   repeating each line.

5. Then offer to fix them. If I approve (or if `$1` is `--fix`):
   - Run the commands from the script's **Quick fix** set one at a time, showing output;
     **stop at the first failure** and report it rather than pressing on.
   - The **You do these** list is the hand-over set — never fake those: `/graphify .` (needs a
     Claude Code session + my go-ahead) and anything needing an account/API key or `.env.local` value.
   - After the installs, **re-run the checker and republish the artifact** (same URL) so the
     table shows what flipped to Ready.

6. Never edit `.env.local` values yourself and never print secrets — only report which KEYS
   are missing (the script already does this safely, by name only).

To extend this check as we add tools: add one `R_OK`/`R_MISS`/`R_OPT` line to `emit_all()`
in `.claude/scripts/core/toolchain-health.sh`. It then self-reports here, in the session-start
brief, and in the artifact — with its own fix command. Grow the toolchain one line at a time.
