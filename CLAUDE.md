# arc — CLAUDE.md

@AGENTS.md

<!-- Everything every harness obeys is in AGENTS.md, imported above. Only Claude-Code-specific lines go
     below, inside the claude-only block; brain-drift.mjs fails anything else here (ADR-2007). -->

<!-- claude-only -->
## Claude Code only

- Code review ALWAYS runs through the `code-reviewer` agent (Task `subagent_type: code-reviewer`),
  never ad-hoc `general-purpose` reviewers — that agent is where the scanners + review method live.
- Tool-time guards are the `.claude/hooks/<Event>.d/` fragments (PreToolUse, PreToolUse-edit, PreToolUse-read
  block). They are the first line, never the gate: `engine/enforcement.yaml` names each one's commit-time
  and merge-time twin, or says why it has none (ADR-2002).
- An owner-action for deny-floor files is ONE line: `cd <absolute checkout path>` + apply + verify +
  `git add/commit/push` of exactly those files. The auto-mode classifier refuses the agent the commit
  (and `git checkout --`) of them as well as the edit; policy C2 spent three owner rounds learning it.
<!-- /claude-only -->
