# Skeptic (POINT-IDs S1–S6)

## STANCE
AGAINST — At 10 engineers, migrating now trades a large share of total product capacity for infrastructure that produces zero customer value, on unstable domain boundaries, repeating a failure a larger company already walked back.

## KEY POINTS
- S1 [High] Headcount math makes the split structurally unaffordable — a ≤15-eng org can independently own only ~1–3 services (Conway's Law mismatch), and splitting into per-service teams + a platform/DevOps function carves 2–3 of 10 engineers off product = a 20–30% capacity tax before a feature ships. — Evidence: F3 + F11.
- S2 [High] The full distributed-systems ops tax lands on the same 10 people who own the product — orchestration, service discovery/mesh, tracing + centralized logging, database-per-service (Saga/eventual consistency), per-service CI/CD, brokers, resilience patterns. None optional once split; no platform team at this size to absorb it. — Evidence: F5.
- S3 [High] Direct precedent of this exact failure — Segment moved monolith → ~100+ microservices → back to a monolith, citing operational overhead outweighing isolation at their size. A better-resourced company hit the wall; a 10-person startup is more exposed. — Evidence: F1.
- S4 [Med-High] Domain boundaries almost certainly aren't stable enough to split correctly yet — greenfield/early splits struggle (boundaries hard before the system exists), and pre-PMF shifting boundaries risk F4's distributed monolith. — Evidence: F2 + F8.
- S5 [Med] The brief's own conditions for microservices to help are not shown to apply — F7's triggers (different scaling profiles, hard independent-deployability, regulatory isolation, different runtimes) — nothing in the brief establishes any hold here, and absence argues against acting "now." — Evidence: F7.
- S6 [Med] A strictly cheaper alternative captures most of the claimed benefit — a modular monolith (one deployable, enforced internal boundaries) preserves most maintainability without F5's tax, explicitly advocated for small teams. — Evidence: F10.

## STRONGEST ARGUMENT
F3 + F5 + F11 is decisive on its own: at 10 people, microservices structurally reallocate a large fraction of the whole eng org from customer work onto infrastructure that ships nothing to users — at the stage where survival depends on iteration speed toward PMF. F1 shows it isn't hypothetical.

## BIGGEST UNCERTAINTY
Every fact is Low confidence (offline, untriangulated), and I have no info on this specific startup: if an F7 trigger genuinely applies here (a real regulatory boundary, a component with order-of-magnitude different scaling, already-autonomous teams blocked by the shared deploy) and is just absent from the brief, my case weakens.

## IF I'M WRONG
Concrete confirmation a F7 trigger applies — a specific component with materially different scaling needs, a real compliance isolation boundary, or already-autonomous teams blocked by the monolith deploy — plus evidence of existing deployment-automation + monitoring maturity (F9), would flip the cost/benefit toward reconsidering "now."
