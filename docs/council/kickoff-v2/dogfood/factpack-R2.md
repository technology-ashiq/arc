# FACT PACK — R2 (operational cost / preconditions of a migration) — model-knowledge, all Low

- [Low] Microservices typically need container orchestration (Kubernetes/ECS/Nomad); a monolith can run on a single VM / small cluster / PaaS with a far simpler target.
- [Low] Microservices add layers a monolith doesn't need: service discovery, API gateway/ingress, often a service mesh (Istio/Linkerd) for inter-service traffic, retries, mTLS.
- [Low] Discrete infra components (DBs, queues, caches, deploy targets) scale roughly with service count → more to provision, patch, secure.
- [Low] Each service tends to get its own build/test/deploy pipeline + independent release cadence vs a monolith's single pipeline.
- [Low] Running/testing the whole system locally gets harder (run many services, or contract/stub testing e.g. Pact).
- [Low] Cross-service API changes need an explicit versioning/compatibility strategy to avoid deploy-time breakage.
- [Low] IaC + secrets management grow linearly-or-faster with service count.
- [Low] Distributed tracing (OpenTelemetry/Jaeger) + centralized log aggregation become necessary since logs/requests span many processes — not needed the same way inside one monolith process.
- [Low] Each service needs its own health checks, SLOs, dashboards, alerts → larger monitoring surface.
- [Low] "Database-per-service" removes single-DB ACID transactions; consistency needs Saga/eventual-consistency/compensating transactions (2-phase commit generally avoided).
- [Low] Event-driven integration via brokers (Kafka/RabbitMQ) replaces in-process calls / shared-DB queries.
- [Low] Distributed systems add partial failures, timeouts/partitions, cascading failures ("Fallacies of Distributed Computing"); need circuit breakers, retries w/ backoff, bulkheads — work a single-process monolith doesn't require.
- [Low] Sustainable on-call (per SRE practice) needs enough engineers per rotation to keep burden low; more services with a small pool → more frequent on-call per person.
- [Low] Microservices imply "you build it you run it" end-to-end ownership; Team Topologies cites a need for a dedicated platform team to absorb shared infra when running many services.
- [Low] Fowler's "MicroservicePremium": microservices carry an inherent complexity/ops "premium" worthwhile only once complexity exceeds what a monolith handles comfortably.
- [Low] With 10 engineers, splitting into per-service teams AND standing up a platform/DevOps function reduces headcount for product/feature work vs one deployable.
- [Low] No standardized headcount threshold exists; readiness (Newman's "Building Microservices") is framed around deployment-automation + monitoring maturity + team autonomy, not a fixed number.

WHAT I COULDN'T VERIFY: offline run, all model priors; numeric thresholds imprecise; named-company specifics unconfirmed; no empirical study of cost-delta/success-rate at ~10-person orgs; whether 2026 tooling lowered the ops floor not assessable offline.
