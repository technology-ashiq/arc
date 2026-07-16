# FACT PACK — R1 (small-team monolith→microservices outcomes) — model-knowledge, all Low

- [Low] Segment publicly moved monolith → ~100+ microservices → back to a monolith ("Goodbye Microservices"), citing operational overhead (on-call, cross-service debugging, duplicated boilerplate) outweighing isolation benefits at their size/stage. (model prior; exact figures approximate)
- [Low] "MonolithFirst" (Fowler/ThoughtWorks ~2015): nearly all cited microservices successes began as a monolith later decomposed; greenfield-microservices teams struggled more because domain boundaries are hard to get right before the system exists.
- [Low] Aphorism (attrib. Simon Brown): "if you can't build a well-structured monolith, what makes you think microservices is the answer" — microservices amplify poor modularity rather than fix it.
- [Low] Amazon "two-pizza team" (~5–10 people) heuristic → a ≤15-eng org can independently own only ~1–3 services; decomposing into more services than ownable teams is a cited mismatch.
- [Low] "Distributed monolith" anti-pattern: splitting on technical layers (API/logic/data) not business bounded-contexts yields the network/operational cost of microservices without independent deployability.
- [Low] Conway's Law → service boundaries track team boundaries; with few engineers there are few natural boundaries, so imposed service splits are more likely arbitrary/shifting.
- [Low] Netflix/Amazon/Uber adopted/scaled microservices only after hundreds–thousands of engineers and specific monolith scaling limits — "you are not Netflix" caution.
- [Low] Basecamp/37signals (DHH) advocate the "majestic/modular monolith" for small teams: one deployable with enforced internal module boundaries, most maintainability benefit without distributed-systems cost.
- [Low] Conditions microservices are argued to HELP even small: materially different scaling profiles per component, hard independent-deployability across genuinely separate teams, regulatory isolation, different runtimes.
- [Low] Conditions microservices are argued to HURT at small scale: pre-PMF with shifting domain boundaries, one team working across "separate" services (no autonomy gain), immature observability/CI-CD/infra.
- [Low] Various surveys/talks report a substantial share of microservices adopters hit significant operational/complexity challenges post-adoption; exact percentages not reliably recalled offline.

WHAT I COULDN'T VERIFY: no live sources this run (offline); no ≥2-source triangulation; Segment specifics approximate; survey statistics unconfirmed; no B2B-SaaS-vertical-specific data.
