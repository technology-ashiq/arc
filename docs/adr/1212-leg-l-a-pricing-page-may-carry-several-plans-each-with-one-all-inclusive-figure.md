# ADR 1012 — LEG-L: a pricing page may carry SEVERAL plans, each with one all-inclusive figure

**Status:** accepted
**Date:** 2026-08-13
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** a venture needs per-plan terms that differ in kind rather than in price — a
different refund window, a different tax posture, a different cancellation route. Parallel arrays
cannot express that, and the schema is then reopened for a real plan record.

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1200). This AMENDS the locked LEG-H (ADR-1208) in one clause, recorded separately so the
amendment is visible rather than edited into a frozen decision.

ADR-1208 says *"the pricing page shows one all-inclusive INR figure with tax treatment stated."*
Phase 1 met the first venture that cannot satisfy it: LexOS sells two plans, ₹2,999 and ₹5,999 per
month (its own `PLAN.md`), and it is REQ-08's target. A locked decision that the flagship render
cannot satisfy is a decision that has to move or a venture that has to be dropped.

There is a second constraint, and it is the interesting one. The bounded YAML subset (ADR-1202)
refuses a **sequence of mappings** — `SEQUENCE_OF_MAPS` is a named parse error — so the obvious
shape, a list of `{name, amount}` records, cannot be written in a facts file at all.

## Options considered

1. **Keep one figure; a tiered venture is out of v1.** Faithful to the frozen text, and it drops
   the only real venture this cycle has.
2. **Extend the YAML subset to allow a sequence of mappings.** The natural data shape, at the cost
   of widening the parser — the one component two adversarial attackers are pointed at right now,
   and the component whose whole design argument is that it accepts as little as possible.
3. **Parallel arrays with an enforced length equality.** `plan_names[]` and `plan_amounts_inr[]`,
   refused unless they are the same length and both non-empty. Zero parser change.

## Decision

**Option 3.** The pricing page carries one row per plan, and **each row shows one all-inclusive INR
figure with its tax treatment stated** — which is ADR-1208's principle applied per plan rather than
abandoned. The no-tax-math law is untouched: the page prints the figure and says whether tax is
included, and a CA owns everything else.

New facts fields: `pricing.plan_names[]` (FREE-TEXT, <= 40 each), `pricing.plan_amounts_inr[]`
(INT, 0..10000000), `pricing.period` (ENUM `month` / `year` / `one-time`).

**The length equality is a schema FAIL, not a render-time surprise.** Two arrays that have drifted
apart would silently pair the wrong price with the wrong plan name — a false money statement, which
is pre-mortem row 1, arriving through the shape of the data rather than through a branch.

**Evidence:** LexOS `PLAN.md` line 6 (the two plan prices) and the `SEQUENCE_OF_MAPS` error in
`.claude/scripts/legal/lib/yaml.mjs`, both read this session.
**Confidence:** high
**Rejected because:** Option 1 — drops the cycle's only real venture to preserve a sentence.
Option 2 — widens the parser's accepted grammar for a formatting convenience, in the exact
component whose safety argument is that it accepts very little.

## Consequences

Easier: a tiered venture renders truthfully, and the parser is untouched.

Harder: parallel arrays are an ugly shape and everyone who reads the schema will want to fix them.
The length check is what makes them safe, so it is a hard failure and it is fixture-pinned. If a
future venture needs per-plan TERMS rather than per-plan prices, the revisit trigger above fires and
this shape is the wrong one — that is a real limit, written down now rather than discovered later.
