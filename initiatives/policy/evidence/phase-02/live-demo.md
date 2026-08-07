# Phase 02 — live demo

The refined verification plan's five scenarios, run for real on 2026-08-07 in a throwaway root
that owns its own policy and its own spine.

**Every receipt below is read back off `events/*.jsonl`.** That clause was in the kickoff
one-liner from day one — *"read back from the spine directory rather than from emitter return
values"* — and no test written before this close obeyed it. Which is exactly why nobody noticed
that **none of the four kinds could be emitted at all**: `arc-event` had no idem branch for them,
so it derived a value `validateEvent` then rejected, and every policy receipt was quarantined.

## Transcript

```

----- 1. THE FOUR ADR-0508 KINDS, through the sanctioned emitter
  spend.reserved       01KZDGXK0QWK3VNDEM94FRFVR8
  spend.released       01KZDGXKA2D75H5TY876D01VEH
  policy.demoted       01KZDGXKJ8VNGCDVA51J2ZYZ82
  sealed: 3   quarantined: 0

----- 2. THE PROMOTION CHAIN, end to end, decided through arc-inbox
  approval.requested  01KZDGXM2W0RYXW2FT5K4H24QB  L1 -> L2
inbox: approve recorded for 01KZDGXM2W0RYXW2FT5K4H24QB
  decision.recorded   01KZDGXM8TQM2WRN96JPZ0CJT8  verdict=approve  (through arc-inbox)
  policy.level.changed 01KZDGXMGEH4KYXF7KDH7E149C  cites decision 01KZDGXM8TQM2WRN96JPZ0CJT8
  reducer folds 2 transition(s) OFF THE SPINE -> ceiling L2, cap L2, effective L2

----- 3. A SECOND, UNDECIDED PROMOTION, rendered by the inbox
  01KZDGXMRWN2PSGG4DJ4QKA18J  raise session network to execute  (policy)  arc
      policy  session:interactive/network  L1 -> L2  evidence docs/trial-ledger.md#net

----- 4. THE DAY, rendered by arc brief
  brief 2026-08-07
  
  needs-you (3)
    policy.demoted  session:interactive/network  L1 -> L0
    approval.requested
    approval.requested
  
  money (2)
    spend.reserved  INR 0.40  arc
    spend.released  released_on=provider_attested_no_charge  arc
  
  progress (2)
    decision.recorded
    policy.level.changed  session:interactive/write  L1 -> L2

----- 5. LAYER 2 -- the static deny floor, and the cross-check against layer 1
  permissions.deny entries: 24
    Bash(git push --force:*)
    Bash(git push -f:*)
    Bash(git push origin main:*)
    Bash(git push origin master:*)
    Bash(git reset --hard:*)
    Bash(rm -rf:*)
    ... and 18 more
  cross-check: tests/policy-hook.bats :: LAYER 2 never contradicts LAYER 1
```

## What each scenario proves

| # | Criterion | Evidence |
|---|---|---|
| 1 | The vocabulary extension is **writable**, not just declared | three ULIDs, `sealed: 3`, `quarantined: 0` |
| 2 | The promotion chain runs end to end **through `arc-inbox`** | `approval.requested` → `decision.recorded` (verdict=approve) → `policy.level.changed` citing that decision, then the reducer folding 2 transitions **off the spine** to `effective L2` |
| 3 | A pending promotion renders with the evidence a human needs | the inbox line plus `policy session:interactive/network L1 -> L2 evidence docs/trial-ledger.md#net` |
| 4 | `arc brief` renders the authority receipts in their groups | `policy.demoted` under needs-you with the pair and direction; both spend kinds under money, one showing `released_on`; `policy.level.changed` under progress |
| 5 | Layer 2 exists and is cross-checked against layer 1 | 24 `permissions.deny` entries; `tests/policy-hook.bats :: LAYER 2 never contradicts LAYER 1` |

## Three fixture bugs this demo found, before it was believed

Written down because each one would have produced a **passing** demo that proved nothing:

1. **The inbox rendered "no open approvals".** Scenario 2 approves its own request, so by the
   time scenario 3 ran there was nothing pending. An empty inbox is not a demonstration that the
   inbox renders promotions. Fixed by emitting a second, undecided request.
2. **The brief was asked for an empty date.** The day was computed by a subshell that failed
   silently, so `--date ""` was passed and `arc-brief` refused. The day now comes from the file
   the spine actually wrote — the spine is IST-based, and a UTC `date` can ask for a day that
   does not exist yet.
3. **The settings read used a Git Bash path node cannot resolve** (`/c/Users/...` → node looked
   for `C:\c\Users\...`). The same class as the run this repo has hit before, where a probe
   passed on a stack trace.
