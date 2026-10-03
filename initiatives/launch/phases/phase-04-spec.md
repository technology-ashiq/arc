# Phase 04 — Recommendation, REQ-08, trust runtime, wiring, drift, teardown

**Goal (one line):** `plan` derives each pick with rule ids, neon enters `database` by row + adapter only, the trust boundary refuses at run time, and the venture is wired, watched and has its exit plan.
**Appetite:** 2 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-03
**REQs closed here:** REQ-08, REQ-09, REQ-10

## Scope

- fit-rule engine + `plan` reasons + override receipt (ADR-1706); neon row (ADR-1721) + adapter in its own PR with the file-list bats check; digest-drift / hosts / write-root / sensitive-action fixtures; wiring block last-but-one (ADR-1711): passport dry-run · ledger-source · face-room `planned` · `teardown --plan` naming recorded resource ids (ADR-1714); weekly `verify --all` job row (ADR-1716).

## Exit criteria (Definition of Done)

- [ ] REQ-08, REQ-09, REQ-10 acceptance met
- [ ] tracker updated

## Verification plan

- Coarse: fixtures on CI for REQ-09; REQ-08's PR file list asserted by bats; real neon vet on the box. Refined at phase start.

## Rabbit holes in this phase

- Receipt weighting: Cycle 2.

## Out of scope for this phase

- recommendation v2
- teardown --apply
- `migrateFrom()` (ADR-1707)

## Your-setup / pending

- Owner places `NEON_API_KEY` for the neon vet.

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
