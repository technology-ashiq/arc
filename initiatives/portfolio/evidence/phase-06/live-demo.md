# Phase 06 live demo -- the lane-stale job

## Against the REAL canonical spine (dry run, 2026-10-14 ~05:00 IST)

`ARC_SPINE_ROOT=<main clone>/.claude/state/hq node .claude/scripts/hq/jobs/lane-stale.mjs --dry-run`
from this branch's worktree (the job is not on `main` yet, so it cannot run from the main clone until
the merge; `--dry-run` writes neither the state file nor a receipt):

```
bench      stale=true   last=never
face       stale=false  last=2026-10-13T12:11:24+05:30  01M4SZX52NJQXWFHJ2NM1NYGF9
growth     stale=true   last=never
launch     stale=false  last=2026-10-04T01:10:55+05:30  01M41MH9JG9VEN5G085T56CNHH
leads      stale=true   last=never
portfolio  stale=false  last=2026-10-14T04:28:49+05:30  01M4VQTVA4BXAAP06A3FC5H1S8
```

bench, growth and leads are LIVE and **no receipt has ever named them** (`payload.lane`), which is
what the board could not say. launch is ten days from its last lane receipt and turns stale on
2026-10-19 if nothing names it.

**Owed after the merge, from the main clone:** one real run (not dry) -- `lane-stale.json` lists
bench, growth, leads; three `incident.raised class: lane-stale` land in `events/`, none in
`_quarantine/`; `arc-brief` prints each by line; the production `incident.raised` count before and
after recorded here. Then the owner's apply line schedules it daily.

## In a scratch repo with a fixture spine (clock pinned, 2026-10-14T00:00Z)

Run 1: `lane-stale: 3 LIVE lane(s), 3 stale: face, growth, leads -- raised 3 new, 0 already raised`
Run 2: `lane-stale: 3 LIVE lane(s), 3 stale: face, growth, leads -- raised 0 new, 3 already raised`
`events/` held the two day files and **no `_quarantine/`**. The brief:

```
needs-you (1..)
  incident.raised  lane-stale  face  LIVE, no lane receipt since ever
  incident.raised  lane-stale  growth  LIVE, no lane receipt since 2026-08-26
  incident.raised  lane-stale  leads  LIVE, no lane receipt since ever
```

**Two defects the demo found, fixed before commit:**
1. The first build leaned on the emitter's `DUP_IDEM` to stay once-per-episode. It worked, and filed
   a quarantine line per silent lane per day. The job now reads its own episodes off the spine and
   never sends the duplicate (`fixed-defects.md` (r)).
2. The brief printed a bare `incident.raised` -- a needs-you line that does not say which lane. The
   brief now names the lane for `class: lane-stale` only, so no other incident line or golden moves
   (`fixed-defects.md` (s)).

## Owner apply (scratch copy of the tree)

`owner-apply-lane-stale.mjs` run 1 wrote the policy subject, the job row and the stub; run 2 printed
three `unchanged` lines; `jobs-lint: clean`; `kickoff-lint` birth rule `16 process(es) -- 0 ungoverned`.

## board-lint --strict on the real board

Exit 0. With `| portfolio | LIVE · stale: true |` typed into the row: `FAIL [board-stale-hand-written]
PORTFOLIO.md:37: cell live · stale: true` and exit 1 (the first build missed this shape -- it only
matched a cell that BEGINS with `stale`; widened to a `stale` token followed by `:` or `=` anywhere).
