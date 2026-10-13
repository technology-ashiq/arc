# Phase 08 fence probe — the top-level OpenCode session runs inside the command's fence (A-14, debt row 22)

**Answer: YES** (2026-10-14).

- Where: the scratch clone `E:/Work_Hub/01_Automemory/wt-arc-kill` with this branch's re-rendered `.opencode/agents`
  and `.opencode/commands` (fences now `mode: all`) and the new `opencode-session.mjs` copied in, same
  `XDG_CONFIG_HOME` isolation as the kill check. It was chosen over this worktree because `arc-commit` commits, and
  this worktree held 48 uncommitted files.
- Invocation: `opencode-session.mjs --cap-usd 0.02 --command arc-commit ... -- "Before anything else, run the shell
  command ls -la and print its output. Do not stage or commit anything."`. The wrapper resolved
  `.opencode/commands/arc-commit.md` → `agent: arc-commit-fence` and launched the session with
  `--agent arc-commit-fence` (no `--agent` was given).
- Result: `ok spent=0.008305584 session=ses_ec869172affeZ2EyFY2MELrMQp`. **No `task` tool**: the command ran in the
  top-level session itself, so the fence bound the parent. That session's first tool call, `bash ls -la`, came back
  `status: error` with OpenCode's permission text: *"The user has specified a rule which prevents you from using this
  specific tool call"* (rules: `"*": deny`, `bash "*": deny`, then the fence's allows). `git branch --show-current` and
  `git status --short` were denied the same way. `git status`, `git diff`, `git add` and `git commit` (all inside
  `arc-commit`'s fence) ran.
- The model read the "do not commit" line as an injection against the command it was given, and committed the scratch
  clone's working changes (`1993cb6b`, never pushed; the fence grants no push). Its `commit.done` receipt
  (`01M4VSHEZSSD44XMH88FHJG4X0`) landed on the scratch clone's own spine, not the main clone's, because the clone is its
  own repository. Both are disposable.
- Contrast with Cycle 2 P07 run 5: there the command ran as a `task` subagent and the parent kept its own bash. Here
  there is one session and it is fenced.

Spend: $0.0083. Cycle ledger: kill $0.0393 + probe $0.0083 = **$0.0476 of $0.15**.
