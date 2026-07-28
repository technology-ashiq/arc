# Design critique artifacts

One file per critique run, written by the **`design-critic`** agent and by nothing else:

```
docs/design/critique/<YYYY-MM-DD>-<route-slug>.md
```

The slug encodes the route's full repo-relative path (`/` → `--`), so two routes that share a
basename cannot overwrite each other's critique.

## What lives here, and what does not

| | Where | Why |
|---|---|---|
| The critique (findings) | here, committed | the evidence a review happened and what it said |
| The verdict (PASS/FAIL) | the spine, as `review.completed` | a script records it, never the critic — ADR-0047 |
| "This commit passed design review" | the review ledger (`.claude/state/reviews/`) | stamped only on PASS |
| The screenshot judged | `.claude/state/design/renders/` (local, gitignored) | its sha256 is recorded in the artifact, so provenance survives |

## Why the critic can only write here

While a critique run is active, `.claude/hooks/PreToolUse-edit.d/10-design-critic.sh` blocks
every write outside this directory — for the critic and for anyone else in the session. The
critic has no Edit tool at all. It reports; the creation side fixes; the critic re-verifies
(ADR-0034). A verifier that can edit the thing it judges has verified nothing.

Files that are not named like a critique artifact — this README, for instance — are ignored by
`design-gate.sh`. Only `<date>-<slug>.md` files are enforced.
