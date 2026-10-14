# ADR 2027 — The whole OpenCode session runs inside the command's fence, and a deploy needs a tracked target

**Status:** accepted
**Date:** 2026-10-14
**Product:** `distribute` (engine `adapters/opencode.mjs`, `opencode-session.mjs`; `.claude/commands/arc-ship.md`; closes Cycle 2 debt rows 22-24; amends ADR-2019, ADR-2021, ADR-2022)
**Reversibility:** two-way
**Why two-way:** rendered agent front-matter, one wrapper flag default and one command's `allowed-tools`; each reverts in one PR
**Revisit trigger:** a wrapped run's parent session again does something its command's fence denies, or OpenCode changes how a `primary` agent's `permission` block binds the top-level session.

## Context

Cycle 2's real run (`initiatives/distribute/evidence/phase-07/run.md`) found three holes, now debt rows 22-24:

- **22 — the fence binds only a subagent.** `adapters/opencode.mjs:73-92` renders each command's `allowed-tools` as a
  hidden `mode: subagent` agent `<stem>-fence` with `"*": deny`, and the command names it. The top-level session (the
  default agent) keeps its own bash and read tools. In P07 run 5 the subagent stopped at a denied step and the parent
  carried on: it ran `gh pr create --fill` and `npm run test` itself.
- **23 — a deploy CLI is granted whole, a deploy target is trusted untracked, and a Windows kill missed the child.**
  `arc-ship.md:3` allows `Bash(vercel:*)` and step 4 deploys when `vercel.json` or `.vercel/project.json` merely exists.
  Killed run 5b's child linked a new Vercel project in the session worktree, and run 5c deployed it to production.
  `killTree` (`opencode-session.mjs:237-242`) runs `taskkill /T /F /PID` and ignores the result. Nothing checked that the tree was gone.
- **24 — the redactor quarantined a `ship.done`.** The `connection-string-password` rule (`redact.mjs:85`) matched run
  5c's first emit. The stub keeps no payload, so the trigger was never seen.

## Options considered

1. **Leave the parent unfenced; rely on merge-time gates.** That held for REQ-03, but the lifecycle verbs and any future
   wrapped command would run through the same open parent.
2. **Fence the parent: render each fence agent `mode: all` (usable as primary), and have the wrapper launch the session
   with `--agent <command>-fence` by default, so the top-level session is the fence.**
3. **An OpenCode plugin that blocks tools.** Named out as tool-time parity (Cycle 2 rabbit hole 3).

## Decision

Option 2 for row 22, plus named fixes for rows 23 and 24.

- **22:** the fence agent renders `mode: all` (it stays `hidden: true`). `opencode-session.mjs` passes `--agent
  <command>-fence` when `--agent` is not given and the rendered fence file exists. An explicit `--agent` is unchanged.
  The fence file is read from the session's cwd before spawn; if it is missing, the wrapper exits 2 `NO-FENCE`, never
  runs unfenced. A live probe in P08 (cap $0.02) proves the top-level session is denied a tool outside the fence.
  ADR-2022's measurement (an `ask` hangs headless) still holds: fences keep `deny`, never `ask`.
- **23a:** `arc-ship.md` `allowed-tools` narrows `Bash(vercel:*)` to `Bash(vercel --prod)` and `Bash(vercel --prod --yes)`.
  `vercel link`, `vercel project` and every other subcommand are outside the fence.
- **23b:** step 4 counts a deploy target only when `git ls-files --error-unmatch vercel.json` or `… .vercel/project.json`
  succeeds. An untracked file prints `deploy: <file> exists but is not tracked by git — not a declared target` and takes the
  no-deploy branch. `allowed-tools` gains `Bash(git ls-files --error-unmatch:*)`.
- **23c:** `killTree` on win32 checks `taskkill`'s exit, then polls up to 5 s for every pid in the tree captured at spawn
  (and, on Windows, by `wmic`-free `powershell Get-CimInstance Win32_Process` parent walk) to be gone. A survivor is
  printed `kill: survivor pid=<n>`, and the run exits 7 `KILL-INCOMPLETE` instead of the cap or timeout code. A fixture
  whose fake spawns a detached grandchild pins it on the windows leg.
- **24:** P08 replays the quarantined emit against `redact.mjs` with the reconstructed payload (PR URL, deploy URL and
  summary from run 5c's transcript). If it matches, the payload shape is recorded and the fix goes to the redactor as a
  core change routed through `/arc-change` with a fixture (a plain `https://github.com/...` URL in a JSON payload is
  never SECRET). If it does not reproduce, the row closes `not-reproduced` with the replay committed as a regression
  fixture. The redactor is a shared rule and is never loosened without a fixture proving a credential still matches.

## Consequences

- A wrapped command can no longer do in its parent what its fence denies. A command with no `allowed-tools` (no fence)
  still runs under the default agent, and the transcript header says `fence: none`.
- `arc-ship` can no longer create the deploy target it then trusts. A consumer with an untracked `.vercel/` (the common
  state after `vercel link` before commit) gets a named skip, and that is listed in the CHANGELOG.
- The goldens and the self-render regenerate for `arc-ship` and every fence file (`mode: all`).

## Evidence

- `adapters/opencode.mjs:73-92`; `arc-ship.md:3,17`; `opencode-session.mjs:237-242`; `redact.mjs:85`; debt-ledger rows
  22-24; retro 2026-10-13 #1 ("a fence never grants a whole deploy CLI … a declared target check trusts only files git tracks").
- OpenCode agent `mode` values `primary | subagent | all` per OpenCode's agent docs; whether `permission` on a `mode: all`
  agent binds the top-level session under `run --agent` is **unverified** and is the P08 probe (assumption A-14).

**Confidence:** high on 23 and 24; medium on 22 until the probe runs.

## Amendment 1 — measured in P08 (2026-10-14)

- **22 holds (A-14 confirmed live).** With fences rendered `mode: all` and the wrapper launching `--agent arc-commit-fence`,
  the command ran in the top-level session with no `task` hop, and OpenCode denied that session's `ls -la` by the fence's
  rules (`evidence/phase-08/probe.md`, $0.0083).
- **23c is changed by measurement.** Verifying a kill after `taskkill` is not enough, because P07's survivor came from the
  *wrapper* being killed from outside, so no kill ran at all. Killing the wrapper on Windows takes only its direct
  children (libuv's job object), and a detached descendant survives with a dead parent, so a leader pid cannot lead to it.
  Decision: while the leader lives, the wrapper re-snapshots the tree every 3 s (`Get-CimInstance Win32_Process`) into
  `<transcript>.pid` as `{pid, cmd}` rows. A clean finish removes the file. Every run first reaps any `*.jsonl.pid` under
  its ledger: each recorded pid whose command line is unchanged is killed (pid reuse guard), and a survivor refuses the
  run `STALE-RUN`. POSIX kills the recorded leader's process group. A kill that leaves a survivor exits 7
  `KILL-INCOMPLETE`. Verified on this box before CI: a SIGKILLed wrapper's 3-process tree (cmd → fake → detached
  grandchild) was reaped by the next run, and the grandchild never wrote its marker.
- **24 reproduced, so the redactor is fixed** (`evidence/phase-08/redact-replay.md`): `"` is excluded from the
  `connection-string-password` user/password classes.
