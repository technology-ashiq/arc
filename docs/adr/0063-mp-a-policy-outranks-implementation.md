# ADR 0063 — MP-A: the model policy outranks the implementation, with two human-approved carve-outs

**Status:** accepted
**Date:** 2026-08-02
**Product:** `company` — arc-wide (ADR-0053); produced by the `model-policy` lane
**Reversibility:** two-way
**Revisit trigger:** the citation requirement catches zero real mistakes across two full
cycles **and** has blocked or delayed ≥2 legitimate tier changes — at that point it is
ceremony, not control, and gets demoted to a convention.

## Context

arc's model usage is currently taste encoded in agent frontmatter: 27 agents each declare a
`model:` line, and nothing anywhere records *why* a seat sits on the tier it sits on. The
engine cycle will later build `router.yaml`, which needs a policy to encode. Two orders are
possible: the router decides and the policy documents what the router does, or the policy
decides and the router implements it. Whichever lands first becomes the default.

The complication is that a rigid "policy first, always" rule has two failure modes that
would make it either ignored or dangerous: it would forbid cheap experimentation (you
cannot learn which tier a seat needs without trying another tier), and it would leave arc
frozen on a broken or unavailable provider during an incident.

## Options considered

1. **Implementation-first** — the router/frontmatter is the truth, policy documents it.
   Pros: zero friction, nothing to keep in sync. Cons: reproduces exactly today's problem
   at larger scale; the engine kickoff would have to invent the policy anyway, under
   deadline, as a side-quest.
2. **Policy-first, absolute** — every model change requires a policy amendment first.
   Pros: maximally disciplined. Cons: forbids the exploratory A/B that REQ-03 depends on,
   and turns a provider outage into a governance problem. Predictably gets bypassed, and a
   rule that gets bypassed teaches that rules get bypassed.
3. **Policy-first with two named, human-approved carve-outs** — production tier changes
   cite or amend the policy; exploration and emergencies have written escape hatches with
   receipts and expiry. Pros: keeps the discipline where it is load-bearing (production)
   and removes it where it would only cause lying. Cons: two extra clauses to honour.

## Decision

Option 3. The engine's future `router.yaml` and every future frontmatter `model:` change
must cite or amend the policy ADR. Two carve-outs are part of this same decision, not
exceptions to it:

1. **Exploratory freedom.** A trial may use ANY candidate model in an isolated, receipted
   experiment (branch or worktree, plus an MP-F fingerprint). Only **production** tier
   changes require a policy amendment.
2. **Emergency fallback.** On provider outage, security incident, or severe model
   regression, a temporary tier or provider swap is allowed when a human explicitly
   approves it, it carries an expiry, its receipt records the reason, and a follow-up ADR
   lands within 48 hours.

Neither carve-out is auto-switching, which stays forbidden everywhere (Constitution A4 —
reversible or it doesn't run; A7 — models are parts, not identities).

## Consequences

Easier: the engine kickoff inherits a routing policy instead of deciding one under
deadline, which is this cycle's whole north-star. Experiments stop being policy violations,
so they get recorded instead of hidden. Harder: two clauses now have to be honoured rather
than one rule, and the emergency carve-out's 48-hour follow-up is a real obligation that
nothing currently asserts — if it is missed twice, the carve-out is the problem, not the
person. Revisit if the citation requirement becomes ceremony (trigger above).
