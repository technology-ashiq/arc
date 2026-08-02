# ADR 0070 — the composer seat stays balanced-workhorse: the paired A/B returned no owner-visible gain

**Status:** accepted
**Date:** 2026-08-02
**Product:** `company` — arc-wide (ADR-0053); produced by the `model-policy` lane, Cycle 5, REQ-03
**Reversibility:** two-way
**Revisit trigger:** a brief that gives composers **materially more room than this one did** —
a looser or absent content fixture, a thesis that does not pre-decide the structure, or a
domain the composer has to reason about rather than lay out — and the owner is dissatisfied
with the output *on craft grounds rather than on constraint grounds*. That is the untested
case: this experiment ran with a 78-line canonical fixture and a fully-specified thesis, so it
measured execution inside tight rails, not judgment in open ground. Re-run the same paired
design there before changing the tier.

## Context

MP-B ([ADR-0064](0064-mp-b-seat-tier-principle-creative-seats-earn-their-tier.md)) fixed the
rule that a **creative seat earns its tier through a receipted A/B, not through default
frugality** — the default for an untested creative seat is "unknown", not "cheap". REQ-03 is
that rule's first application, and `ui-composer` is the seat: it ran on the balanced-workhorse
tier while `design-director`, which judges its output, ran on high-judgment. Nobody had tested
whether that asymmetry was correct or merely inherited.

## The experiment

Paired, same-commit, single-variable. Every fairness condition was asserted **before** either
arm ran, not checked afterwards:

| Control | How it was held |
|---|---|
| Commit | Both arms scaffolded at `e46bbda`; `base-revision.txt` compared. |
| Assignment | `design-director` ran **once**, into arm S only. |
| Thesis + content fixture | Copied byte-for-byte into arm O; **SHA-256 equality asserted per variant** before any composer started (`18986dd2…`, `c1fc653c…`, `c7545095…`). |
| Prompt | Identical text per variant across arms. The **only** intended difference was the model tier, applied as a per-invocation override — `.claude/agents/ui-composer.md` frontmatter was never edited. |
| Renderer | One command, both arms. Recipe identical on all six: `viewport-fixed;full-page;media-light;animations-off;font-true;aa-on;settle-paint`. |
| Typography | `PIN_FONT=0` → `font-true`. The Arial pin that deleted typography from a whole cycle's judgement (retro-log 2026-07-30) was off. |

Six pages, labels shuffled to interleave both arm and variant, key sealed until both rankings
were submitted.

## Results

**Owner's blind ranking:** `item-2 > item-5 > item-6 > item-3 > item-4 > item-1`
→ arm pattern **S O S O S O**. Sonnet mean rank 3.00, opus 4.00.

| Thesis | workhorse | high-judgment | winner |
|---|---|---|---|
| variant-a | **#1** | #2 | workhorse |
| variant-c | **#3** | #4 | workhorse |
| variant-b | **#5** | #6 | workhorse |

**The owner ranked workhorse above high-judgment in all three same-thesis pairs, 3–0, blind.**

**Jury's blind ranking** (independent, no cross-talk): `item-5 > item-4 > item-1 > item-2 >
item-3 > item-6` → arm pattern **O S O S O S**. Opus 2–1 by pair; opus mean 3.00, sonnet 4.00.

**The two rankings disagree, and both alternate perfectly.** Neither arm dominates on either
reading. That is exactly the interleaving that assumption **A-01** — "the workhorse composer
seat is a live quality bottleneck" — named as its own death condition. **A-01 is dead.**

**Recorded wall-clock** (MP-F): arm S ≈ 80.5 min total / 26.8 mean; arm O ≈ 58.0 min / 19.3
mean. High-judgment was **not slower** — the single slowest run in the set was a workhorse one
(45.4 min on variant-a).

**Recorded cost: absent, and deliberately not estimated.** arc has no per-item cost
attribution — `cost.incurred` is a defined event kind with no emitter, and the statusline
reports per-session totals only (ADR-0069 block c). So the owner was asked to accept a **time**
delta and was told plainly that the **rupee delta is unmeasured**. Presenting an estimate as a
recorded figure would violate MP-F and Truth-Law E3, and would have corrupted the one decision
this phase exists to inform.

## Options considered

1. **Move `ui-composer` to high-judgment.** Rejected: the pre-registered formula requires a
   *material, owner-visible* quality gain, and the owner's own blind ordering shows the
   opposite. Adopting it here would mean the formula was decoration.
2. **Call it inconclusive and re-run wider.** Rejected as this cycle's answer: it is
   `BRIEF-bench.md`'s territory, and REQ-03's appetite is one paired experiment, not a study.
   The revisit trigger above carries the genuinely untested case forward.
3. **Keep balanced-workhorse.** Chosen.

## Decision

**`ui-composer` stays on the balanced-workhorse tier.** The high-judgment tier is not adopted
for the composer seat.

The formula was fixed in writing **before** any output was seen, and it says: *"keep
high-judgment only if the blind ordering shows a material, owner-visible quality gain AND the
owner explicitly accepts the recorded cost/time delta — 'slightly better' alone reverts."* The
ordering showed no gain at all. The owner was shown the unsealed result, told that his own
blind ranking had gone 3–0 against the premium tier, offered an explicit override with a
recorded reason, and **chose to follow the formula.**

## Honest deviations from the specified design

- **No owner PREDICTION was pre-registered.** REQ-03 requires it and it did not happen — the
  ranking was submitted directly. The ranking itself was still genuinely blind (the key was
  sealed and unread), so the *ordering* stands; but the prediction-vs-result comparison REQ-03
  wanted does not exist for this run and is not reconstructable after the fact.
- **No reference screen; six items, not seven.** The reference is an external screenshot of a
  shipped product and none was available. Fabricating one was refused, and the historic
  `lexos-case-workspace-v2` is barred from being an arm. **Consequence, stated so nobody claims
  otherwise later: this run establishes a comparison between arms, NOT an absolute quality
  bar.** Ranking N candidates always yields a winner and never a bar (retro-log 2026-07-30).
- **`design-jury` was overridden by prompt to rank six items** with `reference-position: unset`;
  its agent file is contracted for exactly four and was **not edited** (the 3-variant tooling is
  a no-go). Logged as a documented deviation.

## Consequences

**Easier.** The composer seat now has an evidence-backed tier instead of an inherited one, and
the money stays where it was. MP-B's rule survived its first real test *including the case where
the test contradicts the intuition that motivated it* — which is the only way a rule like that
means anything.

**Harder.** The two blind rankings disagree, so this is a **weak** result, not a strong one: it
rules out a *large, obvious* gain and cannot rule out a small one. The cost side of the formula
was unmeasurable, so "cheaper" is an assumption resting on public list prices rather than on
anything arc recorded. And the experiment tested execution inside very tight rails — the revisit
trigger above exists because the interesting case is the loose one, and it remains untested.

**What stays true regardless:** exploratory trials need no permission (ADR-0069 block **g**) —
any model, any time, isolated and fingerprinted. Only a **production** tier change needs a
reviewed diff citing the policy. This decision closes a question; it does not close the door.
