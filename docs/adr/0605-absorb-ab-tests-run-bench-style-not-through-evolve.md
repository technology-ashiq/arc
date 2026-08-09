# ADR 0605 — ABS-F: absorb's A/Bs run bench-style in v1, and flipping that needs an evolve-side ruling

**Status:** accepted
**Date:** 2026-08-09
**Product:** `absorb`
**Reversibility:** two-way
**Revisit trigger:** evolve's first client seat is spent or reassigned by an evolve-side decision,
**or** a second absorb A/B needs a comparison that the PLANOFF layout genuinely cannot express.

## Context

Every adoption absorb proposes must carry evidence, and there are two machines in the building that
could produce it. evolve's experiment machinery is the purpose-built one — and it is
fixture-proven but **unexercised** (Cycle 7 closed 2026-08-04 on that exact note). EVO-G names
**growth** as evolve's first client.

The temptation is obvious: absorb needs experiments, evolve has experiments, wire them together.
The cost is not obvious, which is why it is written down: absorb would spend evolve's first-client
slot on OS-side work, and the first exercise of an unexercised machine is where its real defects
surface. Growth would then inherit a machine already shaped around absorb's needs.

The alternative already exists and is proven in use: `docs/evidence/planner-bench/` carries
PLANOFF-01 and PLANOFF-02 with a protocol / scoring / RESULTS layout and an append-only ledger.

## Options considered

1. **Route absorb's A/Bs through evolve's experiment machinery.** Pros: purpose-built; one
   experiment path company-wide. Cons: spends EVO-G's first-client seat on OS work; couples a new
   lane to an unexercised machine; makes absorb's cycle depend on evolve's defects.
2. **Run bench-style: owner-judged, PLANOFF layout, under `docs/evidence/absorb/`.** Pros: the
   layout exists and has been used twice; zero new machinery; absorb's evidence is legible to
   anyone who has read a PLANOFF. Cons: two evidence paths in the company until bench wakes.
3. **Invent absorb's own scoring engine.** Rejected as the plan's own named rabbit hole — that is
   bench's territory, and building it here would be the third experiment machine.

## Decision

**absorb's A/Bs run bench-style in v1**: owner-judged under the ABS-D grammar (ADR-0603), results
in **PLANOFF layout** (protocol / scoring / RESULTS) under `docs/evidence/absorb/`, with a ledger
line per run. Old-way versus absorbed-way on **≥3 representative fixtures** of the target class.
The results table travels **with** the adoption proposal — a proposal without its table is
lint-invalid.

evolve's experiment machinery is **not** used, and EVO-G's first-client seat stays with growth.
**Flipping this requires an evolve-side ruling** — never an absorb-side convenience, and never a
decision made because wiring it up looked easy on the day.

## Consequences

**Easier.** absorb ships without depending on an unexercised machine, and its evidence is in a
format the repo already reads. evolve's first real client stays the one it was designed around.

**Harder.** Two evidence paths coexist until bench wakes, and absorb's A/Bs are owner-judged rather
than machine-scored — so they cost owner minutes, which the assumptions ledger tracks as a live
bet with a stated trigger. If that bet fails, absorb's evidence throughput is capped by the
owner's attention, and the answer is bench, not a shortcut here.
