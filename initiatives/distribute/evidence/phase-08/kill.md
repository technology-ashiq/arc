# Phase 08 kill checkpoint — a fresh clone of arc opened in OpenCode lists and runs `/arc-resume`

**Answer: YES** (2026-10-14). The cycle continues to P09.

## Run

- Clone: `git clone --branch feat/distribute-c3 https://github.com/technology-ashiq/arc E:/Work_Hub/01_Automemory/wt-arc-kill`, HEAD `161a384d`.
- Before the run: no `opencode` process in `tasklist`; `git status --porcelain` = 0 lines; no `opencode.json` in the clone or in `.opencode/`; the sha1 of `.opencode/commands/arc-resume.md` in the clone (`6e561e48…`) equals the committed file's.
- Config isolation: `XDG_CONFIG_HOME=E:/Work_Hub/01_Automemory/wt-arc-kill-xdg`, an empty directory, so no global agent, command or plugin was loaded. The owner's real global config holds only `plugin` and `mcp` keys, with no commands and no agents. The wrapper passes `--pure` regardless.
- Invocation (from the clone): `opencode-session.mjs --cap-usd 0.05 --cycle-cap-usd 0.15 --model openrouter/deepseek/deepseek-v4-flash-0731 --command arc-resume --cwd . --transcript initiatives/distribute/evidence/phase-08/transcripts/kill-arc-resume.jsonl -- "--lane distribute"`.
- First attempt, refused before spend: `REFUSED EVIDENCE` because the transcript was in a different repository from the session cwd (ADR-2020's rule). The transcript was then written inside the clone, and it is copied here unchanged.

## Result

- `opencode-session: ok spent=0.039280368 session=ses_ec87c7cf8ffe8Yo6bbbdYRloFu`. Transcript line 1: `harness-proof: opencode 1.17.18 session=ses_ec87c7cf8ffe8Yo6bbbdYRloFu model=openrouter/deepseek/deepseek-v4-flash-0731 cap_usd=0.05 command=arc-resume …`.
- The rendered command resolved from the clone's `.opencode/commands/arc-resume.md`. Its `agent: arc-resume-fence` ran as a `task` tool (completed). The subagent ran `lane-resolve.sh --for resume`, `kickoff-lint` and the git reads, and returned arc-resume's 5-block report: `POSITION` phase 08, `HEALTH` lint pass, `SCOREBOARD` 13 validated / 6 active, `RISKS`, `NEXT`. It even read its own header-only transcript as the pending kill run.
- After the run: `git status --porcelain --untracked-files=no` = 0 lines (no tracked change); the only untracked path is the transcript directory itself. OpenCode wrote its own first-run state under `wt-arc-kill-xdg/opencode/` (`.gitignore`, `node_modules`, `opencode.jsonc`, `package.json`, lock), which is outside the clone.
- The parent session made exactly one tool call (the fenced `task`). Debt row 22's parent-unfenced hole did not show here, and it is still built in this phase (ADR-2027).
- The subagent reported `gh` unauthenticated, because `XDG_CONFIG_HOME` also hides gh's config. That is expected under isolation and does not count against the checkpoint.

## Spend

$0.0393 of the $0.05 run cap; cycle ledger $0.0393 of $0.15.
