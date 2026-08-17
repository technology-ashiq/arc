# Phase 06 — a real dispatch through the pinned container, 2026-08-17

Run after the adversarial fix round, against the real runtime, to answer two questions at once:
does the driver still work end to end after ~600 lines of change, and does the ladder fire on the
real path rather than only against the fake-docker seam.

## The invocation

```
arc-run --process commit-msg-draft --driver hermes --budget min=12
  ARC_HERMES_IMAGE  nousresearch/hermes-agent@sha256:16788311e2fa…
  ARC_HERMES_DATA   a seeded template carrying config.yaml with _config_version: 12
  ARC_HERMES_EGRESS engine/egress-allowlist.txt
```

Egress deliberately **unconfined** for this run: the model is local `ollama` reached through
`host.docker.internal`, and the `--internal` network has no route to the host by construction. A
confined dispatch has to point at a hosted model through the proxy, which is the OpenRouter path
and needs the capped key. Recorded rather than glossed — this is why the confined arm and the
model-answer arm cannot be proven by the same run today.

## What it proved

**The driver survived the fix round on the real path.** The container started, ran, produced
output and exited on its own. Every one of the day's changes — the mandatory private-copy, the
symlink refusal, the network validation, the rebuilt config preimage, the scaled teardown grace,
the realpath main guard, the CDPATH-safe wrapper — was in this invocation.

**FIXTURE 9's ladder fired on the real runtime, not against a fixture:**

```
arc-run: output failed the contract ($.commits: required property is absent); retrying once on the same tier
arc-run: STOPPED. A tier-change PROPOSAL was recorded; nothing was escalated.
         Acting on it means editing engine/router.yaml in a reviewed diff citing ADR-0069.
```

Schema failure → **one** same-tier retry → an `approval.requested` proposal, and **nothing
escalated itself**. That is ADR-0204's ladder and ADR-0069 b1's prohibition, working, on the real
path. The suite proves the same shape against the seam; this proves the seam was not the thing
being tested.

**The answer was wrong again, and that is now a two-for-two record on this model.** An 8B local
model does not produce a real arc process's schema. This is the third independent measurement of
that (2026-08-16 round 1: 1 of 5; round 2 after the config fix: 0 of 1; today: 0 of 1), and it is
the reason `runtime-answer-reliability.md` says Phase 08 must dispatch against a hosted model.

## THE FINDING: a certification run CANNOT be made from a worktree

Both receipts were **refused**, by design, and the refusal is the useful part:

```
arc-event: REJECT WORKTREE_SPINE -- refusing to use the spine inside a linked git worktree.
  .claude/state/ is gitignored, so this worktree has its OWN spine and an event written here
  is valid, real, and invisible to every reader -- including arc-inbox, which folds its OPEN
  set over the spine and would print "no open approvals" while an approval sat here.
  The canonical spine is in the main clone: E:/Work_Hub/01_Automemory/arc
```

`arc-run` then said the honest thing rather than the convenient one:

```
arc-run: could not emit run.completed: ... The run is NOT recorded.
         Under --strict the emitter rejects rather than quarantining.
```

**This reorders Phase 06's close and nothing in the plan said so.** REQ-02 requires the twelve
fixtures green *"against the real runtime, human-started, once, and the run receipts attached as
the certification evidence bundle"*, and REQ-07 requires `run.completed` receipts *"confirmed
present in `.claude/state/hq/events/` and absent from `_quarantine/`"*. Neither is satisfiable from
this worktree at any effort. The certification run and Phase 08's three real runs must be executed
from the **main clone**, which means **after this branch merges**, not before.

Written down because the alternative is discovering it at the close, with the appetite spent — and
because `--strict` is exactly what turned an invisible quarantine into a loud refusal. Without the
`--strict` work PR #184 landed, this run would have reported success while writing its receipt into
a spine no reader can see.

## Owed, and now sequenced rather than open

1. The certification run itself, from the main clone, with receipts.
2. **The scrubbed transcript per dispatch is still not STORED.** `arc-run` scrubs the driver's
   transcript, and this run confirms the driver's own lines do not reach arc-run's stderr — so
   nothing writes them to `initiatives/engine/evidence/phase-06/`. REQ-03's storage half is
   unbuilt, separately from its scan half, which is proven.
3. The confined-egress arm of a real dispatch, which needs the hosted-model path and therefore the
   capped key.
