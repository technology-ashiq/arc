# ADR 0064 — MP-B: seat-tier principle — judgment seats get the strongest tier, creative seats earn theirs by receipted A/B

**Status:** accepted
**Date:** 2026-08-02
**Product:** `company` — arc-wide (ADR-0053); produced by the `model-policy` lane
**Reversibility:** two-way
**Revisit trigger:** a receipted A/B shows a creative seat's tier makes a material,
owner-visible difference in the opposite direction from the one this principle predicts —
i.e. frugality on a judgment seat costs nothing, or premium on a creative seat is
decisively better across more than one brief.

## Context

The live census is 1 cheap-scan seat (`codebase-surveyor`, haiku), 22 workhorse seats
(sonnet — including every creative and research seat), and 4 high-judgment seats
(`code-reviewer`, `council-verifier`, `design-director`, `security-auditor`, opus). That
distribution was never derived from a principle; it accumulated. Council ADR-0006
(`docs/council/kickoff/docs/adr/0006-per-agent-model-tiers.md`) reasoned about the council
seats only, and its own revisit trigger is still open.

The unexamined case is the creative seat. ADR-0049 established that the design pipeline's
constraints — not its model tier — caused variant convergence, and restored composer
freedom. But `ui-composer` still runs the workhorse tier while both seats that *judge* its
output (`design-director`, and the reviewing seats) run the high-judgment tier. Nobody has
tested whether that asymmetry is correct or merely inherited.

## Options considered

1. **Uniform premium tier everywhere** — pros: no seat is ever under-powered. Cons: pays
   the premium 27 times to fix an asymmetry that may not exist; unmeasurable.
2. **Frugal by default, upgrade on complaint** — pros: cheapest. Cons: "complaint" is a
   taste signal, which is exactly the thing this cycle exists to replace; a creative seat's
   under-performance is invisible precisely because nobody sees the better version.
3. **Tier by seat function, with creative seats decided empirically** — judgment and
   irreversibility seats get the strongest tier by principle; mechanical and scan seats get
   the cheapest by principle; creative seats are decided by a receipted A/B rather than by
   default frugality. Pros: puts a principle where a principle is defensible and evidence
   where it is not. Cons: an A/B costs real time (REQ-03 is 1.25 of this cycle's 3 days).

## Decision

Option 3. Seats whose output is a judgment, or whose mistakes are expensive to reverse, get
the strongest tier. Mechanical and scan seats get the cheapest. **Creative seats earn their
tier through a receipted A/B, not through default frugality** — the default is "unknown",
not "cheap". REQ-03's paired composer experiment is the first application of this rule and
its result is binding for the composer seat either way.

## Consequences

Easier: "which tier does this seat get" has an answer that does not depend on who is
asking, and the answer for a creative seat is falsifiable. Harder: the principle creates an
obligation — an untested creative seat is now explicitly *undecided* rather than
comfortably default, and each A/B costs a phase. Only one seat gets tested this cycle;
every other creative seat inherits "workhorse, untested" and that status is recorded
honestly rather than presented as a decision. Revisit per the trigger above.
