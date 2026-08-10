# Phase 03 — known holes, carried forward deliberately

Things four adversarial rounds found that are **real, understood, and NOT fixed in this slice**,
each with the reason it was left and what would close it. This file exists so that "we did not
fix it" and "we did not notice it" stop looking identical from the outside.

A hole listed here is a decision. A hole not listed here is a defect.

**Nothing in this file blocks the rehearsal.** Each row says why.

## The bar this file exists under — owner decision, 2026-08-10

Four adversarial rounds against slice 06 returned **3, 9, 10 and 8 CRITICALs**, two surfaces each
round, with near-zero overlap between the surfaces every time. Several findings in rounds 2–4
were defects introduced *by the fix for* a previous round, twice inside the comment explaining
that fix. The rounds were not converging on a schedule anyone could plan around.

Shown that and asked to choose, the owner ruled: **from round 5 onward only a CRITICAL blocks
this slice.** HIGH and lesser findings are recorded here and carried forward, and this file
re-opens as a work item when the phase closes.

The reasoning, recorded because the rule is only as good as the line it draws: the rehearsal
exists to find out whether the machine works. A finding that means *a number is false*, *a guard
does not guard*, *work is lost*, *two live approvals exist for one send*, or *an operator
following the runbook reaches an unsafe state* stops the slice. A finding that means *a comment
overclaims*, *a parameter is unused*, or *a correct branch is untested* does not — it lands here
with its reason.

**H-04 is being closed rather than carried:** the owner approved the `weigh-tests.yml` run on
2026-08-10 and it was dispatched against this branch. When its measured table lands in
`tests/shard-timings.json`, delete that row.

---

## H-01 · A human cannot revoke an approval they have already given

**What.** `validate.mjs` binds a decision's idem to `sha256("decision.recorded|" + decides)`, so
one `approval.requested` can carry exactly one `decision.recorded`. Verified end to end: the
second decision on an approval is refused `DUP_IDEM`. An operator who approves a draft and then
changes their mind has no path to reject it.

**Why it looks fixed and is not.** Three places read decisions with a latest-decision-wins loop —
`approvalState` here, `approvedShaFor` in `sequencer.mjs`, and `clearedByInbox` in `guard.mjs` —
and two of them carry comments describing revocation ("a reject after an approve revokes it").
Those loops are correct in shape and unreachable in effect: they fold a set that can never hold
more than one element. The comments have been corrected; the behaviour has not, because it
cannot be without changing the spine's decision grammar.

**Why it is left.** Closing it is an ADR-level change to a company organ (the decision idem
binding is what stops a forged second decision overwriting a real one), not a leads-lane fix,
and inventing a revocation path inside a fix commit is precisely the move that produced three of
this slice's CRITICALs.

**What actually protects the rehearsal today.** The send-moment guard re-reads `lint_status` and
refuses on a `draft_sha` that moved after approval (ADR-0412), so an approved draft that is then
edited will not send. The gap is a *withdrawn* approval of an *unchanged* draft — for which the
operator's remedy is to not run `daily`, which in a five-recipient rehearsal they are standing
in front of anyway.

**What would close it.** An ADR adding a `decision.withdrawn` kind, or widening the decision idem
preimage to include the verdict. Either is Phase 05 work.

---

## H-02 · `arc-leads unlock` is the stale-lock remedy and is documented in one place

**What.** Every read-then-emit command now takes the send lock, and `process.exit` does not run a
`finally`, so the code releases explicitly before dying. If a process is killed with `SIGKILL`
between acquiring and releasing, the lock survives and `arc-leads unlock` is the only way out.

**Why it is left.** The lock is deliberately never auto-broken (a dead process may sit between
the provider ack and the receipt; stealing its lock is how one mail is sent twice, ADR-0411).
That is the correct trade.

**What actually protects the rehearsal.** The refusal names the holder and now names `unlock`
rather than `reconcile`, which was a loop.

---

## H-03 · `ingest-reply` fetches an inbound batch before it takes the lock

**What.** `inbound().fetch()` runs before `acquireLock`. With a real webhook source, a lock
refusal would discard a batch already consumed from the queue.

**Why it is left.** `inboundReal()` is an unbound refusal today — there is no source to consume
from, so the ordering cannot bite in Phase 03. Reordering it means holding the send lock across a
network call, which is its own defect and needs to be designed rather than swapped.

**What would close it.** Binding a real inbound source is its own slice; the lock ordering is
part of that slice, not this one.

---

## H-04 · 44 of 104 bats files have no `tests/shard-timings.json` entry

**What.** They ride `_default_weight: 16` against real costs several times that, so CI shards are
imbalanced. Growing any test file reshuffles the shards.

**Why it is left.** The measured values come only from the `weigh-tests.yml` 60-job Windows run,
which is the owner's call to spend. Guessing them would be worse than the default: a wrong
measured number looks authoritative.

**What would close it.** One `weigh-tests.yml` run.

---

## H-05 · `ci.yml` derives the declared-test count two ways

**What.** `_declared()` uses `^[[:blank:]]*@test[[:blank:]]`; the suite-size floor uses
`'^@test '`. They agree today. The floor itself is `911` against ~2159 actual, so a large
regression could pass it.

**Why it is left.** `.github/**` belongs to no lane and the `policy` lane is LIVE. Editing it
unilaterally mid-cycle is the collision `.claude/rules/lanes.md` records having happened twice.

**What would close it.** One coordinated edit, routed to the `policy` lane session.

---

## H-06 · `loadCredentials()` reads the box's real `.env.local` in any test that runs a CLI command from the repo root

**What.** `daily`, `preflight` and `notify` now read `.env.local` through `lib/env.mjs`. On a
developer machine that file exists; on CI it does not. So those commands emit blank-value
warnings locally and none on CI.

**Why it is left.** ENV-WINS-OVER-FILE means no test's own exported values can be overridden, so
this changes stderr noise rather than behaviour — and the alternative (an env var pointing the
loader elsewhere) would be a new door into the credential path, which is the shape being
defended against.

**What would close it.** A test-only root injection on `loadCredentials`, if a future test ever
needs to assert on that stderr.
