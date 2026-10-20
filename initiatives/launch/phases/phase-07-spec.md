# Phase 07 — `domain` on a real venture: owner-attested zone check, gate 1, and the DNS chain

**Goal (one line):** `myfitfolio.com` crosses gate 1 on the owner's attestation of a zone he owns, and `dns`, `tls` and
`email-transactional` then verify live.
**Appetite:** 2 days. Phase 07 not done by day 6 → the scope-cut conversation (PLAN kill criteria).
**Depends on:** phase-06

## Exit criteria (Definition of Done)
- [ ] `products/launch/providers/domain/cloudflare-zone.mjs`: four functions, GET-only, `hosts[]` = `api.cloudflare.com`,
      `rdap.verisign.com`; DoH through `ctx.probe` (ADR-1766, amended)
- [ ] a `cloudflare-zone` row in `launch.providers.yaml` (`status: candidate` until the owner's vetting stamp)
- [ ] contract fixtures: active → verified; pending → `failed(zone:pending)`; nameserver mismatch →
      `failed(zone:ns-mismatch)`; RDAP unregistered / hold / expiring / no-expiry / unserved TLD each not ok; every request a
      GET; the verify evidence names the zone id, nameservers and RDAP facts (ADR-1766 amendment)
- [ ] `/arc-capability --vet` scout record for the row; live verify on `myfitfolio`; the owner's `decision.recorded`; digest pinned
- [ ] no manifest line needed (`products/launch/manifest.json` lists scripts + files, not provider adapters; checked 2026-10-20); `tree-manifest.txt` (untracked filtered)
      and `docs/wiki` regenerated in the same PR
- [ ] F4 (bug, `/arc-change` 2026-10-20, live receipt `01M5CGAXT2T3G8MS1FMXH7YQ6F`): `cloudflare-dns` verify passes an
      apex name, whose CNAME Cloudflare always flattens: when neither resolver returns a CNAME, every A/AAAA the name
      answers at a resolver is one the hosting target answers at that same resolver (A non-empty); still asked of the
      two public resolvers only, never Cloudflare's API (ADR-1709). Fixtures: grey-cloud apex verifies; proxied apex
      fails. `tls` and `email-transactional` checked for the same subdomain assumption: none in code
- [ ] gate 1 approved by the owner; `domain`, `dns`, `tls`, `email-transactional` verified on `myfitfolio` from the main clone
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bats tests/launch-contract.bats` (CI only, per job)
- **Expected failure first:** the new domain arm "cloudflare-zone verifies an active zone" fails before the adapter
  exists, with `REFUSED: domain has no vetted provider`.
- **Live demo scenario:** in the main clone after the merge: `apply --all --venture myfitfolio --venture-root ...` stops
  at `domain` with exit 5 (AWAITING); the owner stamps the gate-1 approval; the same command walks on through `dns`,
  `tls` and `email-transactional` and stops at the next owner act or refusal.
- **Real-system check:** Cloudflare dashboard zone `myfitfolio.com` shows `Active`; `dig NS myfitfolio.com` agrees with
  the receipt; Resend shows the domain `verified`.
- **Expected evidence:** `evidence/phase-07/`: scout record path, `decision.recorded` id, approval id, 4 receipt ids,
  walk transcript.

## Rabbit holes in this phase
- A Resend domain-cap error (A-10) or a token-scope miss (A-09) is an owner decision, never code.

## Out of scope for this phase
Domain purchase (`cloudflare-registrar` stays candidate); `arc-sandbox`'s `domain` re-proof (Cycle 3).

## Your-setup / pending
- Owner, day 1: confirm the Cloudflare token can read zone `myfitfolio.com` (A-09).
- Owner: vetting stamp for `cloudflare-zone`, and the gate-1 approval for `myfitfolio`.

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
