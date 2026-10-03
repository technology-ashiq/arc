# Phase 02 — Money, test mode

**Goal (one line):** a test-mode purchase on arc-sandbox reaches the ledger as exactly one `revenue.simulated`, a refund nets it, and gate 3 refuses.
**Appetite:** 3 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-01
**REQs closed here:** REQ-04

## Scope

- plans · payment-test (razorpay test) · checkout-portal · webhooks-ledger · refunds · ledger-source; gate 3 exercised through its refusal path.
- Razorpay refuses localhost/tunnel webhook URLs, so the webhook lands on the deployed venture (`/api/webhooks/razorpay`, `X-Razorpay-Signature` = HMAC-SHA256 of the raw body, de-duplicated on `x-razorpay-event-id`) and is stored there; arc's `verify` pulls the stored event (and confirms it against the Razorpay payments API), and the simulated path imports `lib/ledger/normalize.mjs` + the razorpay parser and emits `revenue.simulated` from the main clone; a `ledger-ingest.mjs --dry-run` over the same payment is proven to plan 0 `revenue.received`.

## Exit criteria (Definition of Done)

- [ ] REQ-04 acceptance met with receipts
- [ ] replay of the same webhook adds zero events
- [ ] `arc pnl` shows the simulated line labelled
- [ ] 50% tripwire checked against burn
- [ ] tracker updated

## Verification plan

- Coarse: contract arm for razorpay vs a signed-webhook fake on CI; real test-mode purchase on the box with receipts. Refined at phase start.

## Rabbit holes in this phase

- A live webhook endpoint into the ledger is ledger's hook: file it through `/arc-change` on ledger if ingest cannot take it, consume it here.

## Out of scope for this phase

- payment-live
- invoices-gst
- pricing page

## Your-setup / pending

- Owner places Razorpay test keys `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`.

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
