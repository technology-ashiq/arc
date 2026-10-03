# Phase 05 — Close

**Goal (one line):** the arc-sandbox board closes complete, REQ-12 is recorded OPEN-at-first-venture, and Cycle 2's kickoff prompt is confirmed.
**Appetite:** 1 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-04
**REQs closed here:** REQ-05, REQ-12

## Scope

- `verify --all` on arc-sandbox; wiki regenerated; two-surface `/arc-attack`; evidence bundle; REQ-12 OPEN record; Cycle 2 kickoff prompt checked against what P00–P04 learned; `/arc-retro`.

## Exit criteria (Definition of Done)

- [ ] REQ-05 and REQ-12 acceptance met
- [ ] cycle closed via `/arc-phase-done 05`

## Verification plan

- Coarse: `verify --all` exit 0 transcript + coverage output in the evidence bundle.

## Rabbit holes in this phase

- Starting Cycle 2 work before the retro closes.

## Out of scope for this phase

- any Cycle 2 slot

## Your-setup / pending

- none

## Non-negotiables (verbatim from PLAN)

- A slot never names a tool and a provider row never redefines exit criteria (ADR-1701).
- No default provider anywhere: zero vetted providers is REFUSED, `apply` exits 2, and the word `default` fails the lint in both YAML files and in adapter code (ADR-1703).
- Provider rows are owner-only: `approved_by` is linted against the owner (ADR-1702); `vetted` needs a scout record, one real passing verify, a `decision.recorded` id and the digest (ADR-1705).
- Adapters are four functions with no business logic; `scaffold()` is check-then-create and reports `resources[]`; they import no package (ADR-1704, ADR-1715).
- `ctx.fetch` refuses hosts outside `hosts[]`, `ctx.write` refuses paths outside the venture root, digest drift flips the row to `candidate`, and every `sensitive_actions[]` entry emits `approval.requested` first (ADR-1719).
- Verify is a probe something outside the repo answered; `backup` is verified only by a restore with matching row counts (ADR-1709).
- Zero new spine kinds; every slot run is `run.completed process=launch@x.y.z` with `honesty_class` in the payload; the `process:launch` policy row lands with the first emission (ADR-1708).
- Every `arc-sandbox` receipt is `rehearsal`; gates 1 and 3 are exercised through their refusal paths and never crossed (ADR-1700, ADR-1720).
- Secrets never enter any repo and launch never fetches a key; a missing key is `failed(env:{KEY})` (ADR-1713, ADR-1724).
- No `depends_on` edge from a core slot to a non-core slot; the DAG is acyclic and every edge resolves (ADR-1717).
- Runner state is durable and locked per venture; the kill-mid-apply, concurrent-refusal and timeout fixtures ship in Phase 00 (ADR-1718).
- Tests run on CI only, never on this box; every fixture asserts it RAN before asserting what it printed.
