# Evidence Brief — "Should a 10-person B2B SaaS startup migrate its monolith to microservices now?"

Research mode: model-knowledge

Neutral shared facts (renumbered; every fact is a model prior at Low confidence — this is an offline run, so nothing is triangulated). Source FACT PACKs: factpack-R1.md, factpack-R2.md.

- [Low] F1 — Segment publicly moved monolith → ~100+ microservices → back to a monolith, citing operational overhead (on-call, cross-service debugging, boilerplate) outweighing isolation benefits at their size/stage.
- [Low] F2 — "MonolithFirst" (Fowler ~2015): nearly all cited microservices successes began as a monolith decomposed later; greenfield-microservices teams struggled more (domain boundaries hard before the system exists).
- [Low] F3 — Two-pizza-team heuristic (~5–10 people) implies a ≤15-eng org can independently own only ~1–3 services; more services than ownable teams is a cited mismatch (Conway's Law: boundaries track teams).
- [Low] F4 — "Distributed monolith" anti-pattern: splitting on technical layers not business bounded-contexts gives microservices' network/ops cost without independent deployability.
- [Low] F5 — Ops costs a monolith avoids: container orchestration, service discovery/API gateway/mesh, distributed tracing + centralized logging, database-per-service (loses cross-service ACID → Saga/eventual consistency), per-service CI/CD, brokers, resilience patterns (circuit breakers/retries/bulkheads).
- [Low] F6 — Netflix/Amazon/Uber scaled microservices only after hundreds–thousands of engineers and specific monolith limits ("you are not Netflix").
- [Low] F7 — Microservices argued to HELP even at small scale when: materially different scaling profiles per component, hard independent-deployability across genuinely separate teams, regulatory isolation, or different runtimes needed.
- [Low] F8 — Microservices argued to HURT at small scale when: pre-PMF with shifting domain boundaries, one team working across "separate" services (no autonomy gain), or immature observability/CI-CD/infra.
- [Low] F9 — No authoritative headcount threshold; readiness (Newman) is framed around deployment-automation + monitoring maturity + team autonomy, not a number.
- [Low] F10 — "Majestic/modular monolith" (DHH): one deployable with enforced internal module boundaries preserves most maintainability benefit without the distributed-systems ops cost — advocated for small teams.
- [Low] F11 — With 10 engineers, splitting into per-service teams AND standing up a platform/DevOps function reduces headcount available for product/feature work vs one deployable.
