# Phase 01 evidence — Self-host + link history + board v1

Cycle 4 · arc-portfolio. First **lane-scoped** bundle (ADR-0055): evidence lives under
`initiatives/<lane>/evidence/` from now on, while `docs/evidence/**` stays frozen as the
sole canonical copy of pre-portfolio history — nothing was moved to create this path.

| Artifact | What it proves |
|---|---|
| `rollback-rehearsal.txt` | The move was rehearsed **before** it was performed, from `1e33ae8` — the exact parent of the move commit, so the rehearsal was not against a stale HEAD. Move applied and committed in a disposable worktree → lane-mode proven → `git revert` executed → root-mode restored and diffed against the pre-move baseline byte-for-byte → `git diff 1e33ae8..HEAD` empty → root-golden 7/7 → zero emitters → worktree removed. Includes the dry-run transcript the real run repeated verbatim. |
| `live-demo.txt` | The Verification plan run against this repo post-move: canonical output order (lane echo → board → `## Now`), the SessionStart hook reading the lane tracker instead of the root stub, pointer stubs, frozen paths untouched (asked of git, not the filesystem), and every path the design index names resolving. |
| `test-output.log` | The CI proof. There is no local test log by design — from 2026-07-31 CI is the only test authority, because a local pass proves one leg and these claims are about three. |
| `manifest.json` | sha256 of every file here, keyed to the commit CI verified. |

**The headline result.** Assumption A5 fired on 2026-07-31 for locale collation and left its
original subject — `git mv` casing — untested; Phase 01's physical move rested on exactly
that untested half. The casing fixture now **executed** on ubuntu, macOS and windows-git-bash
(two case-folding filesystems and one case-sensitive), with `declared == executed` on every
leg. Before this run that claim was an assertion; it is now a recorded result.

**Not in this bundle:** no scan verdict, SARIF or coverage summary — this phase ships shell
and markdown, runs no scanners of its own, and `arc-evidence.sh` degrades rather than
inventing artifacts that were never produced.
