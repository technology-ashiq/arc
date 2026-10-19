# Phase 10 — the done line: `myfitfolio`'s core board green from main, and the close

**Goal (one line):** `verify --all --venture myfitfolio` exits 0 on merged `main` with all 34 core slots verified, and
Cycle 2 closes.
**Appetite:** 1 day.
**Depends on:** phase-09

## Exit criteria (Definition of Done)
- [ ] REQ-20 acceptance met (PLAN); Cycle 1's REQ-12 recorded as answered; ADR-1768's revisit trigger recorded as fired, so Cycle 3 can open
- [ ] `/arc-retro` run; PORTFOLIO row rewritten in the same commit as the lane header flip
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse: one `verify --all` run from the main clone, with the board, receipt ids and `launch-coverage` output in
`evidence/phase-10/`.

## Rabbit holes in this phase
- Re-running paid live probes to make the evidence prettier. One run is the evidence.

## Out of scope for this phase
Everything in PLAN's Next cycle.

## Your-setup / pending
- Owner: phase-close stamp.

## Non-negotiables (verbatim from PLAN)

- A slot never names a tool and a provider row never redefines exit criteria (ADR-1701).
- No default provider anywhere: zero vetted providers is REFUSED, `apply` exits 2, and the word `default` fails the lint in both YAML files and in adapter code (ADR-1703).
- Provider rows are owner-only: `approved_by` is linted against the owner (ADR-1702); `vetted` needs a scout record, one real passing verify, a `decision.recorded` id and the digest (ADR-1705).
- Adapters are four functions with no business logic; `scaffold()` is check-then-create and reports `resources[]`; they import no package (ADR-1704, ADR-1715).
- `ctx.fetch` refuses hosts outside `hosts[]`, `ctx.write` refuses paths outside the venture root, digest drift flips the row to `candidate`, and every `sensitive_actions[]` entry emits `approval.requested` first (ADR-1719).
- `@venture` resolves only to the venture's own `brand.domain` and fails closed: unresolved or colliding is HOST_REFUSED, never an empty allow-list that passes (ADR-1765).
- Verify is a probe something outside the repo answered; `backup` is verified only by a restore with matching row counts (ADR-1709).
- Zero new spine kinds; every slot run is `run.completed process=launch@x.y.z` with `honesty_class` in the payload (ADR-1708).
- Every `arc-sandbox` receipt is `rehearsal`; only `myfitfolio` emits `real` receipts; a gate is crossed only by the owner's approval, and a walk never answers one (ADR-1700, ADR-1767).
- Secrets never enter any repo and launch never fetches a key; a missing key is `failed(env:{KEY})` (ADR-1713, ADR-1724).
- No `depends_on` edge from a core slot to a non-core slot; the DAG is acyclic and every edge resolves (ADR-1717).
- Tests run on CI only, never on this box; every fixture asserts it RAN before asserting what it printed.
