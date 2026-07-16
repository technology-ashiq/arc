# arc-council — Should a 10-person B2B SaaS startup migrate its monolith to microservices now? (2026-07-16)

> Phase-2 dogfood: a real four-hop run (3 stance members → verifier → bounded rebuttal → re-grade),
> model-knowledge (offline) mode. Member outputs + researcher FACT PACKs were handed to the verifier as
> verbatim files (F8). Kept under the kickoff tracker, NOT in docs/council/sessions/ (dogfood evidence,
> not a real user decision — so it never enters the live calibration log).

## VERIFIER RATINGS
- A1: Plausible — "boundaries discovered, not guessed" mechanism holds but only conditionally (needs unproven production history)
- A2: Plausible — faithful conditional restatement of F7; Low-confidence and non-operative (no trigger shown to hold)
- A3: Supported — restates F9 (no authoritative headcount floor; readiness = maturity + autonomy), echoed by N4
- A4: Weak — neither F3 (a capacity ceiling) nor F1 (a cautionary tale) supports "a scoped 1–3-service split is a defensible bet"
- A5: Plausible — F4 backs "distributed monolith is an avoidable execution risk", but its stable-boundaries premise is contested
- S1: Plausible — headcount-draw direction grounded in F11+F5, but the "20–30% tax" figure is S1's own arithmetic
- S2: Supported — F5 + the whole R2 FACT PACK corroborate the ops-cost enumeration
- S3: Plausible — faithful to F1 but a single uncorroborated Low prior; 100+-service precedent maps imperfectly onto a scoped split
- S4: Plausible — pre-PMF distributed-monolith risk well-grounded in F2+F8 but an unproven empirical inference
- S5: Plausible — verifiably no F7 trigger shown, but "absence → don't act now" is an inference
- S6: Supported — faithful to F10 (modular monolith, most maintainability without the distributed tax), echoed by N5
- N1: Supported — F2 (decompose later) + F1; "base rate favors deferral, not never"
- N2: Supported — valid F3+F4+F11 fork: broader split → distributed monolith, or platform function → headcount drain
- N3: Supported — F5 cost is upfront/fixed while F7/F8 payoff is conditional; the strongest structural point
- N4: Supported — F9 verbatim; consensus with A3
- N5: Supported — F10 modular monolith + preserves the peel-off-later option; consensus with S6
- N6: Supported — faithful to F6 (Netflix/Amazon/Uber scaled only at hundreds–thousands of eng); non-load-bearing

## FIRST-PASS RATINGS
- A1: Contested — load-bearing "boundaries discovered not guessed" has no company fact; F2 leans A1, F8 the opposite; collides with S4
- A2: Plausible — conditional restatement of F7, single-sourced, non-operative
- A3: Supported — restates F9, corroborated in R2 and echoed by N4
- A4: Weak — cited facts (F3 ceiling, F1 cautionary) don't carry "scoped split is a defensible bet"
- A5: Plausible — F4 backs the "avoidable execution risk" read; stable-boundaries premise contested
- S1: Plausible — F11+F5 ground the direction; the figure and [High] tag are S1's own
- S2: Supported — F5 + R2 corroborate the ops-cost list
- S3: Plausible — faithful to F1 but single Low prior
- S4: Contested — "almost certainly unstable" asserted from F8 with no company fact; A1 asserts the opposite; evidence can't settle it
- S5: Plausible — no F7 trigger shown, but "absence → don't act" is inference
- S6: Supported — faithful to F10, echoed by N5
- N1: Supported — F2 + F1
- N2: Supported — F3+F4+F11 fork
- N3: Supported — F5-vs-F7/F8 asymmetry
- N4: Supported — F9 verbatim
- N5: Supported — F10 + option value
- N6: Supported — F6, non-load-bearing

## REBUTTAL LOG
- A1: Contested → Plausible — advocate conceded A1 is conditional on unproven production history; no longer a direct contest, just unproven
- S4: Contested → Plausible — skeptic withdrew "almost certainly"; the pre-PMF risk is real but an unproven empirical inference, not a settled fact

## UNRESOLVED
- [A1] vs [S4]: whether this startup's domain boundaries are stable enough to split — and whether any F7 trigger actually applies — is empirically unknown from the brief; the debate's genuine residual, and it drives the whole decision.

## VERDICT
PREDICTION: NO / Medium (recorded at intake, before research + verifier) → RESULT: CONDITIONAL / Medium — the evidence sharpened a flat NO into "NO unless a specific trigger applies", and the advocate's strongest pro-point (A1) was downgraded to conditional under rebuttal.
DECISION: CONDITIONAL
CONFIDENCE: Medium
Research mode: model-knowledge
Roster: advocate, skeptic, neutral (+ verifier + one bounded rebuttal round)

KEY REASONS:
- [N3] the distributed-systems ops cost is real, upfront, and roughly fixed, while the payoff is conditional — the decisive cost/benefit asymmetry at 10 people
- [N2] the team-size/ownership mismatch (~1–3 ownable services) means a broader split becomes a distributed monolith or a headcount-draining platform function
- [S6] a modular monolith is a strictly cheaper middle path — most of the maintainability benefit without the distributed tax, and it preserves the option to peel off a service later
- [N1] the base rate favors deferral, not "never": monolith-first, decompose-later is the documented success pattern

DISSENT (strongest surviving opposing point):
- [A2] microservices genuinely help even at small scale IF a specific trigger applies — a component with materially different scaling needs, a hard regulatory-isolation boundary, or a genuinely separate team blocked by the shared deploy — so a scoped migration is defensible where such a trigger is confirmed

CHEAPEST TEST TO DE-RISK:
- Before migrating, name ONE concrete trigger that actually applies (divergent per-component scaling, a real regulatory-isolation boundary, or an autonomous team blocked by the shared deploy) AND confirm the team already has deployment-automation + monitoring maturity; absent that, keep a modular monolith and revisit when a trigger appears.

Review-by: 2027-01-16
Resolution: HIT if the team either stayed on a modular monolith without scaling/deploy-contention pain, or migrated only after a named trigger appeared; MISS if it migrated now with no trigger and hit the predicted ops-tax / velocity drop.
