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

`_quarantine/`: no file for 2026-10-13 (latest entries are 2026-08-18, 08-19, 10-01, 10-07, 10-09), so no receipt
from this cycle was rejected.

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
  `.env.example`). Cleanup: the local `.vercel/` and the `.gitignore` line were removed; the Vercel project deletion
  is the owner's (`vercel project rm wt-oc-req03`). REQ-03's `ship.done` exists, but its url is that deploy, not
  PR #416.
