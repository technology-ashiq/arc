# Phase 09 real-system check — a genuine version-1 consumer, outdated then upgrade

2026-10-14. No Cycle 1 consumer lives on this box (arc-sandbox was a clean-machine proof on GitHub), so one was made the
way a real one was: the arc CLI as it stood at `4741c770` (a detached worktree, `E:/Work_Hub/01_Automemory/wt-arc-old`)
ran `node bin/arc.mjs init --target codex --dir E:/Work_Hub/01_Automemory/wt-v1-consumer`, which wrote 455 files and a
**version-1** `.arc-install.json` (`target: codex`, `source: 4741c770`, 454 managed files). The project was committed, then
an owner file `.codex/venture.md` was planted beside the managed ones. Then this branch's CLI ran, at `e08d759f`:

```
$ node bin/arc.mjs outdated --dir <v1 consumer>     # exit 1
installed untagged@4741c770 · arc untagged@e08d759f · 11 commits behind
changelog [Unreleased]
... (14 changelog entries listed)
$ node bin/arc.mjs upgrade --dir <v1 consumer>      # exit 0
upgrade: untagged@4741c770 -> untagged@e08d759f: 21 written, 438 unchanged, 0 removed, 0 backed up; record rewritten as version 2
RAN arc-upgrade
$ node bin/arc.mjs outdated --dir <v1 consumer>
up to date: installed untagged@e08d759f · arc untagged@e08d759f
```

`git status` in the consumer after the upgrade: 20 changed files under `.claude/scripts`, 1 under `.agents/skills`, the
record, and the untracked `.codex/venture.md`, whose content (`venture note`) is unchanged. Nothing else moved.
Both ends read `untagged` because no tag exists yet; `v0.2.0` is cut at the seal (ADR-2025).
