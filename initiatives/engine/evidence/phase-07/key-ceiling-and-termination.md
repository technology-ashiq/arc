# Phase 07 — the ceiling figure, and termination proven rather than written

Two REQ-05 / REQ-04 exit criteria that the phase spec deliberately made blocking. Both are answered
here, and one of them is answered by a finding.

## 1. The ceiling figure: it is ZERO, and zero is a recorded decision

**The criterion:** *"the OpenRouter capped key has its non-resetting ceiling reviewed and set to the
figure the owner recorded... No figure is invented to unblock this step; if none is recorded, this
criterion blocks and says so."*

**The figure in force, read from the provider rather than from documentation, 2026-08-16:**

```
limit        : 0
limit_reset  : null
is_free_tier : true
```

`limit: 0` is not an absent ceiling. It is the **strongest** ceiling this design can carry, and it is
non-resetting (`limit_reset: null`) exactly as ADR-0213 requires. The owner recorded it by issuing an
unfunded key: the decision "this contractor may spend nothing" is a decision about money, made
before issuance, and it is the one the criterion asks for.

**It is enforced, not merely configured.** On the same key, on the same day:

| Request | Result |
|---|---|
| a **paid** model (`mistralai/mistral-nemo`) | **HTTP 403** — `Key limit exceeded (total limit)` |
| a **free** model (`liquid/lfm-2.5-2.6b:free`) | **HTTP 200**, a real completion |

So the zero-spend path is a **measurement**, not an assumption: the runtime can reach a hosted model
and cannot reach a paid one. `.env.example` carries the `ARC_HERMES_API_KEY` row with the mechanism,
the correction from 402 to 403, and the reason the zero-limit path is real. The key itself is never
printed or committed.

**What this does NOT settle, and it is the owner's to settle when it arises.** Raising the ceiling
above zero is a **new** decision requiring its own recorded figure — this evidence records that the
current figure is zero, not that zero is permanent. Cycle 7's three real dispatches are reachable at
zero spend because the free tier answers; the day a job needs a paid model, REQ-05's criterion
applies again to whatever number replaces this one.

**One standing hazard, recorded because it will bite silently.** OpenRouter lists roughly **16** free
slugs out of 413, and the set moves: two slugs that were free in this plan's own examples are already
gone. A process pinned to one free slug will break without notice, so the slug is pinned **with the
date it was verified** (`poolside/laguna-s-2.1:free`, verified 2026-08-18 — the only one of five
tried that returned the contracted JSON clean; two returned empty and the nemotrons leaked reasoning
into the answer, which is a schema failure wearing a good model's name).

## 2. Termination: the spec was false, twice, and is now a fixture

**The criterion:** *"Termination is specified and demonstrated, not just written: revoking the capped
key stops dispatch immediately, and disabling the row by reviewed diff stops it structurally."*

**Demonstrating it is what found the defect.** `engine/router.yaml`'s termination spec says step 2 is
to delete the row, and calls that *"the only form with no reachable remainder: no row, no route"*.
Measured 2026-08-23, with the row deleted and the driver named on the command line:

```
arc-run: would run `build-in-public-draft` on `hermes`
exit 0
```

No row. No `cap`, no `hosted`, no `judge`, no `review_by`. The dispatch proceeds.

**That comment had already been corrected once, for the same reason.** Its previous wording said to
point `driver:` at an uninstalled driver so the router would refuse to load; that was measured false
on 2026-08-17 — the router loads fine and `--driver hermes` still dispatched — and replaced with
"delete the row". **The replacement was never measured.** A false claim about a governance mechanism,
corrected by another false claim about the same mechanism, inside the same comment.

**The hole behind it is larger than termination.** `router-row.mjs` validates the four terms when the
router **loads**, for rows that route to a runtime. Naming the driver on the command line is a
different path and was ungoverned: `--driver hermes --process commit-msg-draft` ran the hire under a
row that grants it nothing, because that row names `claude-code` and so is not a runtime row at all.
`arc-bench.mjs` makes `--driver` **mandatory**, so the one lane that spends real money is the lane
that took the ungoverned path — the identical observation made about *tenure* on 2026-08-17
(`loadRouter()` ran only inside the `--driver auto` branch) and fixed for tenure alone.

**Closed by ADR-0225.** A driver in `RUNTIME_DRIVERS` dispatches only for a class whose row names it,
as `driver:` or in `fallback:`. Exit 2 — an operator error — never 5, which is the data boundary, so
a fixture can tell the two apart.

**Both arms are now demonstrated:**

| Termination step | Proof |
|---|---|
| 1 — revoke the credential | the provider refuses at the key: **HTTP 403 `Key limit exceeded`** on the live credential, measured, with the free-model 200 as the control that the key is otherwise live |
| 2 — delete the row | `tests/engine-router-row.bats`, *ADR-0225 TERMINATION*: with the row deleted, an explicit `--driver hermes` exits **2** naming the missing grant. The negative control proves the granted class still dispatches and that an in-house driver is untouched — without it, a rule that refuses every runtime dispatch would pass, and the cycle would have shipped a termination that works by breaking the hire |

**Why step 1 keeps its own justification.** With a fake container no credential is needed, so the row
deletion is what stops dispatch there; against the real provider the key is the money bound, and a
live key spends if anything else reaches the runtime. The two steps guard different things and the
order in the spec is right.

## The rule this evidence is really about

A termination step is a claim about behaviour. It sat in a comment for eleven days, was corrected
once into a different false claim, and neither version was ever run. Nothing in the repository could
have caught it, because the code enforced nothing — which is the expensive form of the false-comment
class. It is a fixture now.
