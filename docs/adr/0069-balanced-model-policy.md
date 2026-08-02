# ADR 0069 — the Balanced Model Policy

**Status:** accepted
**Date:** 2026-08-02
**Product:** `company` — arc-wide (ADR-0053); produced by the `model-policy` lane, Cycle 5
**Reversibility:** two-way
**Revisit trigger:** the engine cycle fires (see block **d**) and finds it must decide a
"which model where" question this policy does not already answer — that gap is the signal
to amend, and the engine kickoff records which block was missing.

**Decision record:** this policy is the operative document. The reasoning behind each rule
lives in its own ADR and is not restated here: [MP-A](0063-mp-a-policy-outranks-implementation.md) ·
[MP-B](0064-mp-b-seat-tier-principle-creative-seats-earn-their-tier.md) ·
[MP-C](0065-mp-c-council-mode-ladder-fixed-at-three.md) ·
[MP-D](0066-mp-d-session-001-retrofit-executes-council-v2-adr-0010.md) ·
[MP-E](0067-mp-e-attacker-reject-log-is-a-trace-not-a-process.md) ·
[MP-F](0068-mp-f-model-fingerprint-forward-only-never-estimated.md).

## Context

arc runs 27 agents, each with a `model:` line in its frontmatter, and nothing anywhere
recorded why any seat sits on the tier it sits on. That is taste encoded in configuration:
unfalsifiable, unauditable, and impossible to hand to a future router. The engine cycle
will build `router.yaml` when its trigger fires; without a policy it would have to invent
one under deadline as a side-quest, which is how a routing table becomes an accident.

This ADR is the policy the engine inherits. It defines tiers, states what must never
happen, names the metrics that would tell us the policy is wrong, and says when the engine
cycle starts. It deliberately does **not** instrument anything — defining a metric and
wiring it are different cycles (see Non-negotiables).

**Supersedes in scope:** council [ADR-0006](../council/kickoff/docs/adr/0006-per-agent-model-tiers.md)
(per-agent model tiers, 2026-07-15) for the council seats. That ADR's own revisit trigger —
"sonnet members produce weak reasoning the verifier can't rescue, or an opus verifier proves
unnecessary" — is hereby answered rather than left open: neither condition has been
observed, so its allocation stands, and it is now a consequence of block **a** rather than a
standalone decision. Nothing else in ADR-0006 changes.

---

## (a) Tier definitions and the seat map

Tiers are **provider-neutral** by construction (Constitution A7 — models are parts, not
identities). A tier is a description of the *work*, never of a vendor's product name.

| Tier | The work it describes |
|---|---|
| **cheap-scan** | Mechanical enumeration and retrieval. Reads a lot, decides nothing. A wrong answer is visibly wrong and cheap to redo. |
| **balanced-workhorse** | Bounded, structured production: research, drafting, critique against a given standard, tool-driving. Judgment inside a frame someone else set. |
| **high-judgment** | Grades other work, gates a decision, or makes a call that is expensive to reverse. The seat where being under-powered is invisible until it is costly. |
| **independent-family-verifier** | Checks work produced by a *different model family*, specifically to break same-model correlation. The tier exists because agreement between two instances of one model is not evidence. |

**Implementation v1 (claude, 2026-08-02).** This mapping is an implementation of the tiers
above, not the tiers themselves. Swapping it must not require rewriting this block:

| Tier | v1 model |
|---|---|
| cheap-scan | `haiku` |
| balanced-workhorse | `sonnet` |
| high-judgment | `opus` |
| independent-family-verifier | *no default — see below* |

### Seat map

Derive the live census with this **query**, never by trusting the counts below — a number
nobody recomputes is a number that starts lying (retro 2026-07-22):

```bash
grep -r '^model:' .claude/agents/ | sort
```

At 2026-08-02 that query returns **27 seats: 1 haiku · 22 sonnet · 4 opus.**

| Seat class | Tier | Seats | Why this tier |
|---|---|---|---|
| Survey / scan | cheap-scan | `codebase-surveyor` | Enumerates a tree and summarises. Its errors surface immediately in the next step, so cheap and fast beats careful. |
| Council stances, research, domain experts | balanced-workhorse | `council-advocate` `council-skeptic` `council-neutral` `council-researcher` `council-strategist` `council-risk-analyst` `council-marketer` `council-policy-analyst` `council-engineer` `council-designer` `council-life-counselor` | Each produces a bounded argument inside a frame the Chair set. The honesty backstop is the verifier, not the member. |
| Planning + review production | balanced-workhorse | `plan-attacker` `plan-simulator` `question-planner` `product-challenger` `researcher` `log-analyzer` `qa-tester` `design-reviewer` | Structured production against an explicit contract; output is consumed by a gate or a human, never final on its own. |
| Creative | balanced-workhorse **(untested)** | `ui-composer` `design-jury` `design-critic` | **Undecided, not decided.** MP-B says a creative seat earns its tier by receipted A/B; only `ui-composer` is being tested (Cycle 5 Phase 2). The other two inherit "workhorse, untested" and that is recorded honestly rather than presented as a conclusion. |
| Judgment / gate | high-judgment | `code-reviewer` `council-verifier` `design-director` `security-auditor` | Each grades or gates: a missed defect, an unrescued weak argument, a converged design panel, an unfound vulnerability. All four fail *silently* when under-powered, which is exactly the condition worth paying for. |
| Independent verification | independent-family-verifier | **none currently occupied** | The optional cross-model juror (**council-v3** ADR-0015..0018, `docs/council/kickoff-v3/docs/adr/`) is the only candidate and stays env-gated and optional. The tier is defined now so the engine inherits it; leaving it empty is a fact, not an omission. |

---

## (b) The never-do list

These are prohibitions, not preferences. Each one exists because its absence has a known
failure mode.

1. **No auto-switching.** No system component may change its own or another seat's model
   tier at runtime. Every production tier change is a reviewed diff citing this policy. The
   two carve-outs in blocks **f** and **g** are human-approved and are not exceptions to
   this rule — they are its named boundaries.
2. **No LLM-judge as the sole metric.** A model's grade of another model's output may
   inform a decision, never settle one alone. Deterministic checks and human eyes are what
   promote a judgement to a fact (ADR-0048 — agents judge, scripts measure).
3. **No silent tier changes.** A frontmatter `model:` edit that arrives without citing this
   policy is a defect regardless of whether the new tier is better.
4. **Same-model consensus is not independent truth.** N instances of one model agreeing is
   one opinion sampled N times. Where independence is the point — verification, juries,
   adversarial passes — either use a different family or state plainly that the check is
   correlated.
5. **Absent data is never estimated.** Recorded, estimated and fabricated are three
   different things and only the first may enter a receipt or a comparison (MP-F, and
   Constitution E3).

---

## (c) The five metrics

Defined here with a formula and a **named** data source. **None is instrumented, and wiring
them is explicitly out of scope** — that is engine work (see Non-negotiables). Naming the
source is what makes each definition falsifiable rather than decorative; where a source
does not yet exist in a queryable form, this block says so.

| # | Metric | Formula | Data source (named, not wired) |
|---|---|---|---|
| 1 | **Cost per accepted output** | model spend attributable to a work item ÷ outputs accepted at their gate without rework | statusline cost (visible-only, per session) joined to spine `phase.closed` / `review.completed` receipts. **Per-item attribution does not exist today**: `cost.incurred` is a defined kind with no emitter, and the only live cost surface is per-session. Not computable until the engine provides it. |
| 2 | **Retry rate** | invocations of a seat re-run against the same input ÷ total invocations of that seat | agent invocation records; today reconstructable only by hand from session transcripts. |
| 3 | **Escalation rate** | work items that moved to a stronger tier before acceptance ÷ total work items | MP-F fingerprints (block **e**) compared across an item's arms. Note Cycle 5's REQ-03 is a *paired* A/B — two arms on one pinned item, run side by side — which is not an escalation; it produces fingerprints, not escalation-rate data. |
| 4 | **Review escape rate** | defects found *after* a gate passed ÷ total defects found | `docs/reviews/` findings and `docs/retro-log.md` entries dated after the passing gate. |
| 5 | **Council Brier score** | mean squared error of the **bucketed `CONFIDENCE:` probability** against the **terminal `## OUTCOME`'s `RESULT:`** (HIT=1, MISS=0), using the categorical buckets of council-v2 ADR-0009 | `docs/council/sessions/*.md` — the `CONFIDENCE:` line and the last `## OUTCOME` section, as read by `council-calibrate.mjs`. It does **not** read the intake `PREDICTION` line; `UNRESOLVED` and `DECISION: WAIT` are excluded from scoring, not counted as misses. Currently **zero graded sessions** (`scored: 0 · pending: 1`); Cycle 5 Phase 1 either produces the first or records an honest `UNRESOLVED` — REQ-04's honesty fork makes both passing outcomes, so this ADR does not predict which. |

A metric with no data is reported as having no data. An empty scoreboard is an honest
scoreboard; a filled one built from estimates is a lie with decimal points.

---

## (d) When the engine cycle starts

The engine cycle (`docs/strategy/plans/PLAN-engine-process-layer.md`: router, drivers,
budgets, escalation) is **pull, not push** — it starts when one of these fires, and not
before (Constitution A8):

| Trigger | Where it is checked |
|---|---|
| **Public-release prep begins** | The moment any lane's `PLAN.md` names public release or external users in its Goal. Checked at `/arc-kickoff`, by the person writing that goal. |
| **A provider event** | A price change, deprecation, new tier, or a sustained availability problem affecting a tier in block **a**. Checked when the provider announces it — **there is no automated watch**, and pretending otherwise would be a control that does not exist. |

**On monthly AI spend: no threshold is set.** The design source asked for this trigger to be
restated "as numbers (monthly AI spend > ₹N)". No such figure exists anywhere in this repo,
and it is an owner risk-tolerance choice rather than a derivable fact, so **inventing one
was refused** — a fabricated number in an append-only ADR is worse than an honest blank,
because the engine cycle would read it as ground truth. This is tracked as assumption
**A-04** in `initiatives/model-policy/PLAN.md`, whose falsification trigger is: monthly AI
spend becomes something the owner notices before either event trigger above fires. If that
happens, this block gets an amending ADR carrying the number.

**North-star for the handover:** the engine kickoff should need **zero** new "which model
where" forks — it copies its **tier definitions and seat map** (block **a**), its
**prohibitions** (block **b**) and its **receipt schema** (block **e**) from this ADR
instead of deciding them.

**What this policy deliberately does NOT define: the escalation ladder.** Automatic
escalation is a standing no-go, and block **b**(1) forbids any component changing a tier at
runtime — so an escalation *default* cannot be stated here without contradicting the
prohibition next to it. The engine owns that design, and it inherits a constraint rather
than a default: whatever ladder it builds, the tier change at the end of it is a reviewed
diff, not an automatic one. **Known conflict, flagged not resolved:**
`PLAN-engine-process-layer.md`'s current ENG-E row drafts `retry-once-same → one-tier-up →
flag human`, and that middle step is auto-switching as block **b**(1) defines it. That row
is queued for the engine cycle to reconcile — this policy does not edit a sleeping plan.

---

## (e) The model-fingerprint block

Every experiment arm, calibration-relevant run, and policy exception records:

- provider
- exact model id
- agent role
- agent-file / prompt commit SHA
- input / brief SHA
- timestamp
- wall-clock duration
- effort setting **if visible**
- statusline cost **if visible**

Two rules carry the weight, both from MP-F:

1. **Forward-only.** Fingerprints are never backfilled onto historic runs. The pre-policy
   past stays unfingerprinted and is described as such.
2. **An unavailable field stays absent.** Never estimated, never inferred, never
   interpolated from a similar run.

The block rides existing spine event payloads. The closed event-kind vocabulary
([ADR-0026](0026-spine-c-closed-event-kind-vocabulary-v1.md), 18 kinds) is **not** extended
for it, and no collector script is built — MP-F is a discipline, and building tooling for it
is engine work.

---

## (f) Emergency fallback clause

On a provider outage, a security incident, or a severe model regression, a temporary tier
or provider swap is permitted when **all four** hold:

1. a human explicitly approves it,
2. it carries an **expiry**,
3. its receipt records the **reason**, and
4. a follow-up ADR lands within **48 hours**.

This is not auto-switching: a human approves, and the swap has an end date written before
it starts. An expired fallback that is still in place is a defect, not a state.

---

## (g) Exploratory-trial freedom clause

A trial may use **any** candidate model, from any provider, without amending this policy —
provided it is isolated and receipted: a branch or worktree, plus an MP-F fingerprint
(block **e**).

Only **production** tier changes require a policy amendment. This clause exists because the
alternative is dishonesty: a policy that forbids trying a model is a policy that gets
bypassed quietly, and a bypassed rule teaches that rules are bypassable. Exploration is how
block **a** gets corrected — MP-B makes a receipted A/B the *only* way a creative seat earns
its tier.

---

## Non-negotiables

Each cites the Constitution article it enforces:

- **Evidence over assertion (A1).** A tier claim without a receipted comparison is an
  opinion. Gates promote WARN→FAIL only on trial-ledger evidence.
- **Boring before clever (A2).** Fingerprints are fields in files. No collector, no
  daemon, no schema. Cleverness must name the boring alternative it beat.
- **Reversible or it doesn't run (A4).** No auto-switching; every production change is a
  reviewed diff; the emergency carve-out carries an expiry.
- **Measured or it didn't improve (A6).** Block **c** exists so that "the policy is working"
  is a falsifiable claim. Nothing changes silently — prompts included.
- **Everything is replaceable (A7).** Tiers are provider-neutral; the claude mapping is
  labelled "implementation v1" precisely so it can be replaced without touching the policy.
- **Appetite over estimate (A9).** This policy defines metrics and stops. Instrumenting
  them is a different cycle with its own cap.

## Consequences

**Easier.** The engine cycle inherits a policy instead of inventing one. "Which tier does
this seat get?" has an answer that does not depend on who is asking. A creative seat's
tier becomes a falsifiable question rather than a matter of taste, and the untested ones
are labelled untested rather than passed off as decided.

**Harder.** Every production `model:` change now owes a citation, which is friction on a
one-line edit. The independent-family-verifier tier is defined but unoccupied, so the
policy currently names a capability arc does not have — deliberately, because the engine
should inherit the slot rather than discover the need. And MP-F is a discipline with no
enforcement: nothing fails when a fingerprint is skipped, so it will be skipped exactly
when someone is in a hurry.

**What we'd revisit if this goes wrong.** If the citation requirement catches zero real
mistakes over two cycles while blocking legitimate changes, it is ceremony and MP-A's own
revisit trigger demotes it to a convention. If block **c**'s metrics stay uncomputable
because per-item attribution never arrives, the metric set is wrong for arc's actual
instrument and gets cut to the ones its receipts can really support.
