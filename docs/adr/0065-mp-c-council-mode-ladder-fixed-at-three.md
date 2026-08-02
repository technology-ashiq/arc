# ADR 0065 — MP-C: the council mode ladder is fixed at three, and the human picks the word

**Status:** accepted
**Date:** 2026-08-02
**Product:** `company` — arc-wide (ADR-0053); produced by the `model-policy` lane
**Reversibility:** two-way
**Revisit trigger:** three consecutive real `standard` runs each end in "recommend deep"
(the envelope is too small), **or** the mode mix two weeks after launch shows `standard`
displacing `deep` on one-way-door questions (the ladder is cannibalising the honesty loop).

## Context

The council's cost knob is currently all-or-nothing. `/arc-council` runs the full panel
(~12+ agents: research, stances, domain experts, verifier, juror, rebuttal); prefixing
`quick` drops to 3 stance members with no research, no verifier, no Evidence Brief, and
writes nothing to disk. There is no middle. The gap was identified 2026-07-19 and is still
open: a question that needs its claims checked but does not need a full panel has no
setting, so it gets either an unverified take or the full price.

The risk in adding a middle tier is that it eats the top tier. `deep` runs are what produce
saved sessions, and saved sessions are what the calibration loop grades — so a `standard`
mode that quietly becomes the default would thin out exactly the data REQ-04 is trying to
start producing.

## Options considered

1. **Automatic complexity classifier** — a model reads the question and picks the mode.
   Pros: no human decision. Cons: an unaccountable model choosing its own budget is the
   auto-switching this policy forbids everywhere else (MP-A); a misclassified one-way door
   is exactly the expensive failure.
2. **`standard` with a soft envelope that can grow** — pros: adapts to the question. Cons:
   an envelope that can grow is not a fixed price, which was the entire point; it becomes
   `deep` with extra steps.
3. **Three fixed modes, human picks the word, `standard` auto-upgrades to `deep`** —
   pros: predictable. Cons: a silent upgrade means the human asked for a fixed price and
   got a variable one.
4. **Three fixed modes, human picks the word, an under-powered `standard` *recommends*
   `deep` and stops** — pros: the price stays the price; the human stays the router. Cons:
   one extra round trip when the recommendation fires.

## Decision

Option 4. The ladder is fixed at three and does not grow:

- **`quick`** — unverified take. No research, no verifier, writes nothing.
- **`standard`** — fixed envelope: ≤2 researchers + 3 stances + 1 verifier, max 6 seats and
  ≤7 model calls (the existing send-back-once-if-nothing-contested guard is the only extra
  call). No domain experts, no juror, no rebuttal round. Post-verifier `Contested` and
  `DISPUTED` IDs go straight to `## UNRESOLVED` and are never debated.
- **`deep`** — full panel plus juror. Stays the default; ADR-0002 is untouched.

**One-way-door decisions are always `deep`**, mandatorily. There is no automatic
classifier: the human picks the word. A `standard` run that cannot cover its question with
2 researchers says so and recommends `deep` — it never silently becomes `deep`.

## Consequences

Easier: a verified-but-bounded council answer has a price the owner can predict before
running it, which is the difference between a knob and a gamble. Harder: three modes are
three code paths in `arc-council.md` and three things `council-lint` must tolerate; and the
"recommend deep" exit is a real outcome the owner will sometimes pay for and get no verdict
from. `standard` is additive — it never weakens `deep`, and the juror contract
(ADR-0015..0018) is untouched. Both revisit triggers above are checked at retro.
