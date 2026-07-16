# Advocate (POINT-IDs A1–A5)

## STANCE
FOR — Migrate now: this is decomposition of an *existing, already-understood* monolith — the pattern behind nearly every cited microservices success — not the high-risk greenfield gamble the evidence warns against.

## KEY POINTS
- A1 [Med] The startup already runs a monolith, so its domain/bounded-context boundaries were discovered through real production usage, not guessed — the precedent "MonolithFirst" credits for nearly all cited successes, while greenfield-microservices teams struggled. — Evidence: F2.
- A2 [Low] Microservices help even at small scale under checkable triggers — components with different scaling profiles, hard independent-deployability across separate teams, regulatory isolation, or different runtimes. If the monolith exhibits any, the "too small" objection doesn't apply. — Evidence: F7.
- A3 [Low] No authoritative headcount floor for readiness — the field frames it around deployment-automation, monitoring maturity, and team autonomy, not a number. A 10-person team isn't disqualified by size alone. — Evidence: F9.
- A4 [Low] Two-pizza heuristic supports a *scoped* migration matched to ownership (~1–3 services for ≤15 eng), not the extremes that fail — Segment's ~100+ sprawl shows over-fragmentation; a disciplined 1–3-service split is a more defensible bet. — Evidence: F3 vs F1.
- A5 [Low] The "distributed monolith" failure (splitting on technical layers not bounded contexts) is a design-execution risk, not an inherent veto — avoidable by splitting along the bounded contexts the monolith already proved out. — Evidence: F4.

## STRONGEST ARGUMENT
The decision is to migrate *an existing monolith*, not go greenfield — F2 says the monolith-first, decompose-later path is what nearly all cited successes followed. With F7's scale-independent triggers, the startup needs one applicable trigger + a scoped bounded-context split (F3, F4), which this evidence base treats as defensible.

## BIGGEST UNCERTAINTY
Every fact is Low confidence (offline, untriangulated), and the brief gives no company-specific fact confirming the startup meets an F7 trigger or the F9 maturity bar; it could instead match F8's red-flag profile — I can't tell from the brief which side it sits on.

## IF I'M WRONG
If the startup is pre-PMF with shifting boundaries, the 10 engineers remain one team across the services (no autonomy gained), and CI/CD or observability isn't mature — F8's hurt-conditions are met, F11's headcount drain is unaffordable, and F10's modular monolith captures most of the benefit. That flips me against migrating now.
