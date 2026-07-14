# scoring/rubric.md — PLANOFF-02

Weights sum to **100**. **Artifact honesty is a multiplier, not a weighted line** (F8). Every
sub-signal is defined at the **handoff boundary**, not the single-context finish line.

> Deliberate departure from 01's forced 50/50 AUTO/BLIND split: the blind (operator-judgement) half
> is shrunk to two small lines (D3 ledger, D7 operator-load = 16 pts) because R6/F6 showed the
> arm-identifying artifacts defeat blinding. Most weight is machine-read AUTO to cut operator-prior
> contamination. This is stated openly so the shift cannot be read as tuning.

## Dimensions

| # | Dimension | Type | Weight |
|---|-----------|------|--------|
| D1 | Handoff continuation success — **blind stranger** | AUTO | 22 |
| D2 | Same-family cold continuation — **native toolchain, hooks live** | AUTO | 12 |
| D3 | State-transfer re-derivation ledger — **outcome-only** | BLIND | 8 |
| D4 | Phase-1 regression under handoff | AUTO | 12 |
| D5 | Unspecified-defect resilience | AUTO | 20 |
| D6 | Token / cost efficiency | AUTO | 18 |
| D7 | Operator load across the boundary | BLIND | 8 |
| — | **Artifact-honesty penalty multiplier** `M ∈ [0,1]` on (D1+D2+D3) | — | ×, not + |

**Transfer cluster D1+D2+D3 = 42 (~40% cap, F2). Discriminating cluster D5+D6 = 38 (≥30%, F2/F7).**

### D1 — Handoff continuation success, blind stranger (AUTO, 22)
Mapped from the blind raw stranger's Phase-2 acceptance pass rate. **0** = can't boot/orient the
repo, or ships Phase-2 with Phase-1 now RED. **11** = partial Phase-2 (some probes green) with one
corrupted invariant. **22** = full Phase-2 green AND Phase-1 still 15/15. A planner earns the full
22 only if its committed artifacts carry a **memoryless outsider** to a working extension.
**Disclosure (F10):** this probe measures *artifact legibility to a memoryless reader*, NOT any
arm's runtime enforcement — arc's ship-blocking hooks do not fire here.

### D2 — Same-family cold continuation, native toolchain live (AUTO, 12)
The same-system fresh agent resumes with its **full real toolchain and hooks firing**
(`/arc-resume` with PreToolUse ship-blocks live, etc.). Scored on **outcome parity only** (F3):
Phase-2 green + Phase-1 still 15/15. **Invoking a resume ceremony that did not change the boundary
outcome earns zero.** raw's path is defined identically as *a fresh raw agent reads the repo* — no
credit or penalty for owning/not-owning a resume command. Reported as its own number beside D1.

### D3 — Re-derivation ledger, outcome-only (BLIND, 8)
Sealed Phase-1 fact checklist (tombstone model, expiry boundary+status, uniqueness-as-DB-
constraint, IP-keyed window, email seam, schema/migration location, auth-shim inertness). Per fact:
**R** = correct on **first use** from **any** committed source (clean code, commit message, typed
schema, README, or plan — **all equal**); **D** = correct only after visible backtracking/trial-and-
error in the transcript; **W** = wrong (proceeded on a false assumption a committed artifact would
have prevented). **8** = all critical facts R, zero W. **4** = mostly D, none catastrophic. **0** =
any critical fact W. Computed **primarily from AUTO first-action-correctness signals** (F6), not
live operator judgement. There is **no half-credit for prose over code** (F1).

### D4 — Phase-1 regression under handoff (AUTO, 12)
Phase-1 acceptance (A1–A15) re-run on the **post-Phase-2** build. **0** = dropped >2 checks.
**6** = dropped 1–2. **12** = still 15/15. Isolates "shipped the feature by breaking the app".

### D5 — Unspecified-defect resilience (AUTO, 20)
Out-of-suite probes (H6 UTC buckets, H7 malformed params → 400, H8 real-Postgres race, percent-
escape 500, cross-team PII leak, stack-trace/secret leak) on **both** the frozen build and the
post-Phase-2 build. **0** = latent defect at freeze AND worsened in Phase 2. **10** = defect present
but not worsened. **20** = no latent defect at freeze, **OR the arm's own review/test loop caught
and fixed it before freeze.** Explicit credit to post-build review — the only 01 process that caught
a real defect. Raised to 20 because this is one of the two signals that actually discriminated in 01.

### D6 — Token / cost efficiency (AUTO, 18)
Named, published, weighted (F7). `cost_usd` + tokens captured **per continuation**. Scored on rank:
lowest total cost-to-equal-outcome = 18, scaling down. **Equal outcome + lower cost yields a
strictly higher composite** — so the bench can reproduce 01's finding that raw won on half the
tokens. Unread artifacts still count their token cost against the arm here.

### D7 — Operator load across the boundary (BLIND, 8)
Interventions beyond `continue` needed to get the continuation moving. **0** = babysat. **4** =
nudged at the seams. **8** = paste the prompt and get out of the way.

### Artifact-honesty multiplier M (F8) — a liability, never a reward
`M ∈ [0,1]` applied to the **transfer cluster (D1+D2+D3)**. **M=1.0** = every committed claim
matches the frozen code (or there are few/no docs and the code is correct — same ceiling). **M<1**
= a committed doc **contradicts the code and misled the stranger into a wrong action** (e.g. NOTES
say "tombstone", code hard-deletes). You **cannot** raise M by writing more true prose; you can only
**lower** it by writing false prose. A lean-but-correct arm is never penalized here.

## Composite
`COMPOSITE = M × (D1+D2+D3) + D4 + D5 + D6 + D7`, max 100. Reported next to the raw D1 vs D2
split so runtime-enforcement value (D2) is visible separately from artifact-legibility value (D1).

## Blinding rule (F6)
Before any BLIND dimension is scored, every arm's frozen repo and continuation output are
**neutralized**: repacked into an identically named directory (`submission/`), all planning docs
renamed to `NOTES-1.md`/`NOTES-2.md`, arm-identifying headers/paths stripped. The blind judge sees
only the neutralized tree + the continuation transcript; the letter→arm map is applied **after**
scoring. Anyone who can identify an arm may not score its BLIND lines.

## The fairness hinge
"Committed artifact" is **medium-agnostic**: legible source, a clear commit message, a typed schema,
or a README count exactly as much as a `PLAN.md`. Every scored question is *"was the fact in the
repo and did the outsider get it right,"* never *"was there a planning document."* If the blind
stranger reaches Phase-2 green from raw's code + README + git history with nothing re-derived wrong,
**raw scores at the ceiling on transfer (M=1) and wins outright on D6.** An arm outscores raw only
if its extra artifacts *demonstrably* lifted the stranger's outcome or cut re-derivation. A plan
that made no difference at the boundary yields a tie — which is the honest result.
