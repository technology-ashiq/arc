# Phase 08 — the done-line Owed items, `arc-legal` vetting, and the money chain live in test mode

**Goal (one line):** Launch places keys, provisions backup and waits for builds by itself. `legal-pages` is checked on
served pages. `auth` through `refunds` verify live on `myfitfolio` in test mode.
**Appetite:** 4 days.
**Depends on:** phase-07

## Exit criteria (Definition of Done)
- [ ] REQ-16, REQ-17, REQ-18 and REQ-19 acceptance met (PLAN); `legal-pages` per ADR-1769, inside the scope ADR-1768 fixes
- [ ] `auth`, `authz`, `tenancy`, `plans`, `checkout-portal`, `payment-test`, `webhooks-ledger`, `refunds`, `database`,
      `orm`, `backend`, `environments`, `errors`, `dependency-scan`, `backup`, `restore-drill`, `migration-rollback`
      verified on `myfitfolio` from the main clone
- [ ] the wiring slots `arc-harnesses`, `passport`, `ledger-source` and `face-room` verified on `myfitfolio`; `face-room`
      needs `myfitfolio`'s expected-set row, a face-sections regeneration and a committed `rooms.generated.json` in the
      same PR; `ledger-source` follows `webhooks-ledger`'s first ingest; `teardown-plan` (`after: all`) is verified in
      Phase 10 as the last slot of `verify --all`
- [ ] every adapter whose bytes change here (`arc-legal` new; `secrets`, `backup`, `security-headers`) is re-applied live
      and re-vetted in this phase; 0 core rows `candidate` at the close
- [ ] `products/launch/manifest.json` lines for new files; `tree-manifest.txt` (untracked filtered) and `docs/wiki`
      regenerated in the same PR
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse, refined when the phase starts (via `/arc-change`): contract fixtures for the four Owed and legal arms on CI, then
live walk transcripts and receipt ids in `evidence/phase-08/`.

## Rabbit holes in this phase
- A-11 (Supabase project cap) and A-13 (Razorpay webhook) are owner decisions, not code.

## Out of scope for this phase
Gate 3 / `payment-live`; every `required` slot.

## Your-setup / pending
- Keys and the legal publish were moved to Phase 06 (probed there).
- Owner: one vetting stamp per new or changed adapter: `arc-legal`, `secrets`, `backup`, `security-headers`. A stamp not
  given by the close leaves that row `candidate` and its REQ unmet.
- Owner: the `passport` apply stamp.

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
