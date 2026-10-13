# Phase 07 — the REQ-03 run (OpenCode 1.17.18, openrouter/deepseek/deepseek-v4-flash-0731)

Every run went through `node .claude/scripts/engine/opencode-session.mjs` with the cycle cap $0.50. Session worktree
`E:/Work_Hub/01_Automemory/wt-oc-req03`, branch `feat/distribute-c2-oc-session`; spine = the main clone's
`.claude/state/hq/events/2026-10-13.jsonl`. Transcripts: `transcripts/*.jsonl`, one per run, with their `.stderr`.

## Receipts with `harness: opencode` (read from the main clone's spine)

| id | kind | payload |
|---|---|---|
| `01M4S4V92YACPXF1V08XXWR04B` | `commit.done` | sha `cfddacdc` — "docs: correct Cycle 1 PROGRESS owner items in archive" (P05 smoke) |
| `01M4S6HH84D37WHHT3M9R49VZF` | `commit.done` | sha `dda92dfb` — "docs(distribute): add Phase 07 evidence README -- REQ-03 run" (run 1) |
| `01M4T02GA2EX26CEF8W1WZBK9C` | `review.completed` | archive `docs/reviews/2026-10-13-0448-feat-distribute-c2-oc-session.md` (run 2c) |
| `01M4T09AKR4B01A0FH6KFHF2PX` | `commit.done` | sha `6405eef1` — the review archive (run 3) |
| `01M4TFXJ3SBRKA9JXCJRH9QP4P` | `ship.done` | url `wt-oc-req03.vercel.app` — run 5c; a deploy, not the PR (see Findings) |

Each receipt's `evidence` names a committed transcript whose line 1 carries `opencode 1.17.18 session=ses_…`
(checked on `origin/main` at the close: `smoke-arc-commit-4`, `1-arc-commit`, `2c-arc-review`, `3-arc-commit`,
`5c-arc-ship`).

`_quarantine/2026-10-13.jsonl` holds **1 stub, 0 receipts**: `{"code":"SECRET","stub_only":true}` at 16:50:50, run 5c's
first `ship.done` emit, which the redactor's `connection-string-password` rule refused (the stub keeps no payload, so the
matched text is not recoverable; the run's text reports the URL scheme as the trigger). The same run re-emitted
scheme-less and `01M4TFXJ3SBRKA9JXCJRH9QP4P` landed 25 s later. No receipt of the run was lost; the refusal is the
redactor's, recorded as debt row 24. Earlier 10-13 runs left no quarantine file.

## Runs and spend

| run | command | outcome | measured spend |
|---|---|---|---|
| 1 | `arc-commit` | ok, `dda92dfb` | $0.00405 |
| 2, 2b | `arc-review` | killed by Claude Code under host memory pressure; header-only transcripts, charged at cap by the ledger | $0 measured |
| 2c | `arc-review` | ok, `review.completed` + archive | $0.01452 |
| 3 | `arc-commit` | ok, `6405eef1` | $0.00285 |
| 4 | negatives | killed (memory pressure), charged at cap | $0 measured |
| 4b | negatives | ok, all three refused | $0.00627 |
| 5 | `arc-ship` | TIMEOUT at 2700 s: created PR #416, ran `npm run test` 4x while CI was pending | $0.0265 |
| 5b | `arc-ship` | wrapper killed (memory pressure) before the first event, header-only, charged at its $0.10 cap; the OpenCode child outlived the kill (see Findings) | $0 measured |
| 5c | `arc-ship` | ok (run by the owner, `!` prefix): lint, build no-op, `vercel --prod` to a Vercel project 5b had linked, `ship.done` | $0.00436 |

Cycle ledger (P05 + P07): $0.3393 before 5b, ~$0.439 after 5b's cap charge, ~$0.444 after 5c, against $0.50. Real money spent is
the measured column; the gap is the ledger's conservative cap charge for runs it could not read.

## Negatives (run 4b, worktree `wt-oc-neg`, local bare remote; nothing reached GitHub, the bare remote holds 0 refs)

```
branch-guard: refuses a push to main (HEAD) -- open a PR instead
secret-diff-scan: SECRET in the added lines -- gitleaks findings (redacted)
[byte-diff] .claude\commands\arc-commit.md — differs at byte 1293 (rendered 1293 bytes, on disk 1304)
```

## Operator steps (named, not the model's)

1. Staged the one docs line for run 1.
2. Merged `feat/distribute-c2-req03` into the session branch, and pushed it with `-u` (no fence lets the model push).
3. Refreshed the session worktree's `.opencode/{agents,commands,skills}` from
   `tests/fixtures/distribute/goldens/opencode/` after run 5 showed a stale render (plain `npm run build`).

## Findings

- **Stale render:** run 5's `arc-ship` ran the render from before the `--if-present` fix; the session worktree is not
  re-rendered by a merge. Fixed by the operator refresh above.
- **Unfenced parent (debt-ledger row 22):** in 1.17.18 a deny fence binds only the hidden `NAME-fence` subagent; the
  parent session keeps bash, and in run 5 it ran `gh pr create` and `npm run test` itself. REQ-03's refusals are git
  hooks and merge-time gates, so the result stands; the fence gap is a next-cycle item.
- **Model-made deploy target (debt-ledger row 23):** the session worktree gained `.vercel/project.json` (and a
  `.vercel` line in `.gitignore`) at 14:50, while only the killed run 5b was live: the wrapper's kill did not reach the
  OpenCode child, which ran `vercel` and created a new project `wt-oc-req03` in the owner's Vercel team. Run 5c then
  read that file as a declared target and deployed to production (`dpl_FANMbv3WqNUUQYoAK2E4x3MvLA1C`, READY). Two
  holes: the `Bash(vercel:*)` fence lets the model create the very target the "declared target" check trusts, and a
  wrapper kill on Windows can leave the OpenCode tree alive. No secret was in the tree (no `.env*` but
  `.env.example`). Cleanup: the local `.vercel/` and the `.gitignore` line were removed; the owner deleted the Vercel
  project (`vercel project rm wt-oc-req03`, 2026-10-13: absent from `vercel project ls`, the URL answers 404). REQ-03's `ship.done` exists, but its url is that deploy, not
  PR #416.

## The session's PR, merged after required checks

PR #416 (`feat/distribute-c2-oc-session`, opened by `gh pr create --fill` inside OpenCode run 5) merged 2026-10-13 as
`7598708a` after #412 (`eb8065ec`). Its head `01534267` (the operator's merge of main, which resolved three conflicts the
squash of #412 left: PROGRESS and debt-ledger took main's side, the Cycle 1 archive kept OpenCode's correction line) went
19/19 on run 38421631372 after one `--failed` rerun of Windows shard 1 (`face-browser` test 5, a file neither PR
touches). It landed three OpenCode-made files on main: the review archive
`docs/reviews/2026-10-13-0448-feat-distribute-c2-oc-session.md`, the Cycle 1 archive correction and this folder's README.
