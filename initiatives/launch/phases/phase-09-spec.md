# Phase 09 — Debt: the rows a first real venture trips

**Goal (one line):** Close the debt rows whose triggers are "the first real run" before the done-line verify reads them.
The lane has 45 open rows, and kickoff's debt budget is 20% of the appetite (3 of 15 days).
**Appetite:** 3 days.
**Depends on:** phase-08

## Exit criteria (Definition of Done)
- [x] debt #D22 — `orm` verify outlasting its CI poll answers `PENDING(ci)`, never `failed`
- [x] debt #D29 — a slot-timeout DOMException is reported as a timeout, never as a coded adapter error
- [x] debt #D30 — plans/authz/tenancy record the deployment id they probed beside main's head
- [x] debt #D32 — closed citing Phase 06's `@venture` PR (0 code here)
- [x] debt #D33 — webhooks-ledger confirms every real stored payment against Razorpay `GET /v1/payments/{id}` (status, amount, currency). The `org_plans` half is split to D53: it needs checkout's order notes from a REAL payment, whose shape is unknown until myfitfolio's first test purchase
- [x] debt #D40 — closed citing D42 (the logic surface already ran from the main clone; 0 code)
- [ ] a fix that can live in `lib/` does; every adapter whose bytes change is re-applied live on `myfitfolio` and
      re-vetted here, and Phase 10 opens only with 0 `candidate` core rows
- [ ] each closed row marked closed in `debt-ledger.md` with its PR; every fix attacked somewhere it was not made
      (`fixed-defects.md` carried to `/arc-attack`)
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse, refined when the phase starts (via `/arc-change`): one fixture per row on CI, asserting RAN first.

## Rabbit holes in this phase
- Closing rows whose trigger did not fire on `myfitfolio` (D1, D3, D12, D14, D17, D23, D25, D28). They stay open.

## Out of scope for this phase
Every row not named above.

## Your-setup / pending
- Owner: one re-vet stamp per adapter whose bytes this phase changes (for example `orm`, `plans`, `authz`, `tenancy`,
  `webhooks-ledger`).

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
