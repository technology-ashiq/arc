# Seal kill re-check: a fresh clone of merged `main` runs `/arc-resume` in OpenCode

**Answer: YES** (2026-10-14). This is REQ-14's "re-run once at seal on a clone of merged `main`" clause.

## Run

- Clone: `git clone --branch main https://github.com/technology-ashiq/arc E:/Work_Hub/01_Automemory/wt-arc-kill2`, HEAD
  `b478b743` (PR #419's squash merge; its tree equals the green head `f1fb1594`, `git diff` empty).
- Before the run: no `opencode` process in `tasklist`, `git status --porcelain` = 0 lines, and no `opencode.json` in
  the clone or in `.opencode/`.
- Config isolation: `XDG_CONFIG_HOME=E:/Work_Hub/01_Automemory/wt-arc-kill2-xdg`, a new empty directory.
- Invocation (from the clone): `opencode-session.mjs --cap-usd 0.05 --cycle-cap-usd 0.15 --ledger-dir
  initiatives/distribute/evidence/phase-10 --prior-spent-usd 0.047586 --model openrouter/deepseek/deepseek-v4-flash-0731
  --command arc-resume --cwd . --transcript initiatives/distribute/evidence/phase-10/transcripts/kill-main-arc-resume.jsonl
  -- "--lane distribute"`.
- Three refusals came before the run, and none of them spent anything:
  1. `REFUSED TRANSCRIPT`: the transcript directory did not exist in the fresh clone. It was created.
  2. `REFUSED CYCLE-CAP: prior spend 0.491265104`: the default ledger walks all of `initiatives/distribute/evidence/`,
     so Cycle 2's spend counted against Cycle 3's cap. Per-phase sums are phase-05 $0.0351, phase-07 $0.4086 (Cycle 2),
     phase-08 $0.0476 and phase-09/10 $0 (Cycle 3). The re-run passed the Cycle 3 ledger explicitly, as phase-10 plus
     `--prior-spent-usd` for phase-08. This is debt row 34.
  3. `REFUSED CAP`: `--prior-spent-usd` takes at most 6 decimals. 0.047585952 was rounded **up** to 0.047586.

## Result

- `opencode-session: ok spent=0.007553488 session=ses_ec53aa391ffe0Yfcjlez04t8W4`. Transcript line 1:
  `harness-proof: opencode 1.17.18 session=ses_ec53aa391ffe0Yfcjlez04t8W4 model=openrouter/deepseek/deepseek-v4-flash-0731
  cap_usd=0.05 command=arc-resume cwd=E:/Work_Hub/01_Automemory/wt-arc-kill2 …`. The transcript is 51 lines,
  copied unchanged from the clone into `transcripts/kill-main-arc-resume.jsonl` (+ `.stderr`).
- The session ran under the rendered fence: 21 tool calls (10 bash, 5 glob, 6 read). Every one was a read:
  `lane-resolve.sh --for resume --lane distribute`, `kickoff-lint` (both forms), `git status` / `branch` / `log`,
  `gh pr list`, and reads of PROGRESS, PLAN, the phase-10 spec and `demo.md`. Three bash calls came back `error` and
  were fence denials: a compound `git status && …`, `ls -la`, and `git status --porcelain`, none of which is in
  `arc-resume`'s `allowed-tools`. The fence held on merged `main`.
- The report gave the 5 blocks: `POSITION` was Phase 10 built, attacked and merged to `main`, and `NEXT` was this seal re-run.
- After the run: `git status --porcelain --untracked-files=no` = 0 lines, so there was no tracked change. The only
  untracked path is the transcript directory.

## Spend

$0.0076 of the $0.05 run cap. The Cycle 3 ledger is $0.0476 + $0.0076 = **$0.0551 of $0.15**.
