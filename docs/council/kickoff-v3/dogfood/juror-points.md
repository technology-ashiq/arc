# Juror points — Should a 10-person B2B SaaS startup migrate its monolith to microservices now?
# Anchor set from the v2 dogfood (docs/council/kickoff-v2/dogfood/): first-pass Weak/Contested + rebuttal-log ids.

DECISION: Should a 10-person B2B SaaS startup migrate its monolith to microservices now?

## POINT A1
FIRST-PASS: Contested
FINAL: Plausible
TEXT: The startup already runs a monolith, so its domain/bounded-context boundaries were discovered through real production usage, not guessed — the precedent "MonolithFirst" credits for nearly all cited microservices successes, while greenfield-microservices teams struggled. (F2)
REBUTTAL: Advocate partially conceded — MonolithFirst's cited successes extracted services from YEARS of production-proven monoliths; A1 implicitly assumed "the monolith has run long enough to reveal stable boundaries", which needs its own evidence (deployment age, module churn) absent from the brief. A1 stands only conditionally.

## POINT A4
FIRST-PASS: Weak
FINAL: Weak
TEXT: The two-pizza heuristic supports a SCOPED migration matched to ownership (~1–3 services for ≤15 eng), not the extremes that fail — Segment's ~100+ sprawl shows over-fragmentation; a disciplined 1–3-service split is a more defensible bet. (F3 vs F1)
REBUTTAL: (not rebutted — rated Weak first-pass: F3 gives only a capacity ceiling, not desirability, and F1's stated cause was general ops overhead, not over-fragmentation, so the cited facts don't carry the conclusion)

## POINT S4
FIRST-PASS: Contested
FINAL: Plausible
TEXT: Domain boundaries almost certainly aren't stable enough to split correctly yet — greenfield/early splits struggle (boundaries are hard to know before the system exists), and pre-PMF shifting boundaries risk the "distributed monolith" failure. (F2 + F8)
REBUTTAL: Skeptic partially conceded — an existing monolith gives real usage data, but boundaries stabilize only after sustained load ("has a monolith" ≠ "has stable boundaries"); withdrew "almost certainly", risk stays real but is an unproven empirical inference.
