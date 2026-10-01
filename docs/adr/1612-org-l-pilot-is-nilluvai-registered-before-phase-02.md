# ADR 1612 — ORG-L: the pilot venture is Nilluvai, registered through `venture-register` before Phase 02, or the cycle pauses after Phase 01

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** one-way
**Revisit trigger:** Nilluvai is not in `ventures.yaml` with an approved `ledger.criteria` receipt when Phase 01 closes -> the cycle pauses; no substitute pilot.

## Context
Locked in the design source `docs/strategy/plans/PLAN-org.md` (ORG-L). Verified at kickoff: **Nilluvai is not registered** — `ventures.yaml` holds only `lexos` (paused, outside arc). `venture-register.mjs:73` refuses `--slug arc` ("the factory's overhead, never a venture"). Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Nilluvai** — the owner's chosen next venture.
2. **arc as pilot** — refused by the code.
3. **LexOS** — paused and outside arc.

## Decision
Nilluvai, registered by the owner through `venture-register` + its approval (kill lines and passport are his). Phases 00–01 do not need it and bank a complete catalog and a working scorecard over arc's own lanes either way.

## Consequences
Easier: REQ-08 is measured on a real venture. Harder: the cycle's second half depends on an owner action outside code.

## Amendment 1 (2026-10-01): the pilot is deferred to the first registered venture

**Fired by:** the Kill-criteria pilot gate. Nilluvai was not registered when Phase 01 was built.

**Owner ruling (in session, 2026-10-01):** org is arc's own company structure. A venture uses it when
that venture starts. A venture is not started early only to prove the org layer. The cycle does not
pause. It closes without the pilot.

**What moves out of Cycle 18:** REQ-08 (dropped, acceptance carried verbatim), A-06, the Phase 02
lines "Nilluvai team manifest approved" and "one seat staffed through a real hire branch + interview",
and the Phase 03 five heartbeat-days. They run when the first real venture (Nilluvai or another) is
registered through `venture-register` and its `ledger.criteria` is approved.

**What stays:** every mechanism (team manifest + `org.team` digest gate, `sync --team`, hire stamp,
dispatcher, review verdicts). Their REQs (06, 07, 10, 11) are proven on fixture teams and mutants on
CI. arc is still never the pilot (`venture-register.mjs:73`).

**Cost of the change:** nothing in this cycle proves that the dispatcher proposes work the owner
wants. That claim stays unproven until the first venture runs it. It is not reported as met.
