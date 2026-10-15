# Phase 03 — the real event, evidence

Two real runs on 2026-10-15, both started from the MAIN clone on `main` at `9cc0f48f` (PR #433,
ADR-0917), so every receipt below reached the canonical spine. Champion `claude-code/sonnet` (the
router's incumbent for `commit-msg-draft`, tier `balanced-workhorse`), candidate
`claude-code/haiku` (ADR-0914: a second model id under the proven driver).

| | Champion `champion-sonnet5/` | Candidate `candidate-haiku/` |
|---|---|---|
| command | `arc-bench.mjs --driver claude-code --model sonnet --budget inr=180,min=95` | `... --model haiku --budget inr=90,min=95 --propose --champion .../champion-sonnet5` |
| exit | 0 | 0 |
| `commit-msg-draft` assertions | 90/90 = 100% | 90/90 = 100% |
| schema | 15/15 | 15/15 |
| K per fixture | `[6/6 6/6 6/6]` on all five | `[6/6 6/6 6/6]` on all five |
| spend (`payload.spend`, USD minor, harness-reported) | 83 | 15 |
| tokens | 7230 | 16967 |
| latency p95 | 160109 ms | 53701 ms |
| `checkout_unchanged` / `router_unchanged` | true / true | true / true |
| invocation violations | none | none |
| `run.completed` | `01M4YZFY785H9433R0QEVQMHFD` | `01M4Z0ABRVJ8V06S67FNFH1F31` |

The spend is the harness's notional list price, not an invoice (ADR-0917 c); `cost_inr` is null
because no rupee cost block exists for `claude-code`, and gate 5 compared the two USD figures like
for like.

## The chain, read back off the spine (`.claude/state/hq/events/2026-10-15.jsonl`)

```
01M4YZFY785H9433R0QEVQMHFD  run.completed       10:40:23  bench@0.1.0  model sonnet
01M4Z0AAPCQETTQX1S3C2JJXF4  approval.requested  10:54:48  gate router-merge  "route commit-msg-draft to claude-code/haiku"
01M4Z0ABRVJ8V06S67FNFH1F31  run.completed       10:54:49  bench@0.1.0  model haiku  proposal.approval = 01M4Z0AA...
```

Production count at this close: `cat .claude/state/hq/events/*.jsonl | grep -c '"process":"bench@0.1.0"'`
read in the main clone = **6** (2 on 2026-10-14, 4 on 2026-10-15). At the 2026-08-13 close it read 0.

## The proposal (`candidate-haiku/proposal/`)

`commit-msg-draft: PROPOSE claude-code/haiku (decided on cost)`. The router diff rewrites ONE line,
the class's tier, because the candidate shares the champion's driver (ADR-0917 b):

```diff
   commit-msg-draft:
-    tier: balanced-workhorse
+    tier: cheap-scan
     driver: claude-code
```

Both sides pinned to router SHA `ec88a286...faa52`. Contract delta 0.0pp, quality delta 0.0pp, cost
delta -68 USD minor, latency p95 delta -106408 ms (a tiebreak only, ADR-0906). Every other class:
`NO PROPOSAL - evidence insufficient (n of 5 fixtures)`, gate `coverage`.

**The verdict is the owner's** — `cd E:/Work_Hub/01_Automemory/arc && node
.claude/scripts/hq/arc-inbox.mjs approve|reject 01M4Z0AAPCQETTQX1S3C2JJXF4 --reason "..."`.
Both outcomes are success; no agent may press it. An approval is not a router change: the diff
lands as its own reviewed PR citing ADR-0069, because a tier change is a production change.

## The candidate was REACHED

Each of the 15 candidate attempts left its own `run.completed` from `arc-run`, for example:
`model: haiku`, `tokens {in: 10, out: 1274, source: measured}`, `spend {amount: 1, currency: USD,
provider_amount: "0.00407417"}`, `spend_basis: harness-reported`. A non-zero measured token count
and a provider amount are the proof the model was called, not only that the run completed. The
receipt carries the CLI's model selector `haiku`, not the dated id the CLI resolved it to (debt
row 20).

**REQ-05 preflight**, recorded before the run in ADR-0914 Amendment 2 and the spec's 2026-10-14
CHANGE: haiku is new to `commit-msg-draft` (the class has only ever routed to sonnet), reachable
through the existing `claude-code` driver, and access verified by the receipts above.

## Containment held, and two sibling sessions wrote to the shared `.git` meanwhile

HEAD, branch and refs were snapshotted before each run and compared after it. HEAD and branch were
unchanged both times, and bench's own fingerprint reported `checkout_unchanged: true`. The ref and
config diffs that DID appear were other sessions, not the benched model:

- during the champion: `feat/portfolio-c5-owed-done` (local, remote-tracking and its config section)
  — the portfolio session's worktree `wt-portfolio-owed`, PR #434, commit `b8b67487` at 10:30;
- during the candidate: about 30 `distribute` branches deleted locally and on GitHub, and the
  `arc-distribute-3` worktree removed — that lane's post-seal cleanup.

Neither touched the main clone's checkout, so ADR-0916's tripwire rightly stayed quiet (debt row 12
records why sibling writes outside this branch's own section are not a stop). No capture mentions
either lane.

## What the run measured: Assumption #1 FIRED

PLAN's assumptions ledger, row 1: *"Phase 3's real event returns identical assertion pass-rates for
both models on all 5 fixtures → the fixtures measure nothing."* That is exactly what happened: 90/90
on both sides, `[6/6 6/6 6/6]` on every fixture. The fixtures still discriminate good output from
bad (the drift probe's `"changed some stuff."` scores 3/6), but they did not separate two models,
so this proposal rests on cost alone. Per PLAN Phase 4's rule, the follow-up strengthens the OWNING
process's evals (`commit-msg-draft`), not bench.

## Superseded runs (kept out of git)

`champion-sonnet2` and `champion-sonnet3` are VOID (the CLI ran inside arc, ADR-0916).
`champion-sonnet4` held containment but scored a prose answer as a driver fault (ADR-0917 a); it is
superseded by `champion-sonnet5`, whose capture carries the fix.
