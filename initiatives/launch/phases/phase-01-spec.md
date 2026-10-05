# Phase 01 — Steel thread on arc-sandbox

**Goal (one line):** `sandbox.automemory.ai` serves a page from a git-triggered deploy (day-3 kill), then a login works there, with one rehearsal receipt per slot.
**Appetite:** 5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-00
**REQs closed here:** REQ-03
**Cut-order checkpoint:** day 7.5 of burn — Phase 01 not closed → scope-cut conversation.

## Scope

- CLI six verbs complete: `new · plan · apply {slot} · verify [slot|--all] · status · teardown --plan`.
- Adapters + vet (scout record, one real verify, `decision.recorded`, digest) for repo (github) · ci (github-actions) · environments · hosting (vercel) · dns (cloudflare, after hosting -- ADR-1725) · tls (hosting-managed) · secrets · release (gate 2) · frontend (next shell, after release -- ADR-1730) — **day-3 kill** — then backend · database (supabase) · orm (drizzle) · email-transactional (resend) · auth (supabase-auth) · authz · tenancy.
- Gate 2 (first prod deploy) emitted and decided for real; `domain` ends at its refusal path + `--dry-run`.

## Exit criteria (Definition of Done)

- [ ] day-3 kill answered YES with the curl transcript, nine receipts and a resumed state file — or STOP recorded
- [ ] login → session → logout on the prod URL; cross-tenant 403; invite → join → scoped
- [ ] one `run.completed process=launch@0.1.0` per slot, all `honesty_class: rehearsal`, emitted from the main clone
- [ ] every Phase 01 adapter has a recorded real response (redacted) replayed through its real code path on CI
- [ ] contract tests for every Phase 01 adapter green on CI against fakes; real verify receipts recorded
- [ ] tracker updated

## Verification plan

- **Test command:** CI bats `tests/launch-contract.bats` (adapters vs fakes) and `tests/launch-cli.bats` (six verbs).
- **Expected failure first:** `launch-cli.bats` asserts `plan` prints `REFUSED — no vetted provider for dns` before any row is vetted; it fails first because `plan` does not exist yet.
- **Live demo scenario:** `arc-launch.mjs apply dns … release` in DAG order, then `curl -sI https://sandbox.automemory.ai` → `HTTP/2 200`; then sign in with a magic link, see the session, sign out.
- **Real-system check:** Cloudflare record, Vercel deployment whose trigger is the git push, GitHub repo `technology-ashiq/arc-sandbox` private (ADR-1722), Supabase project.
- **Expected evidence:** `initiatives/launch/evidence/phase-01/` with curl transcripts, receipt ids, state file copy. Before commit a bats-asserted redaction pass (RAN first) fails on token shapes, magic-link or session URLs, Supabase project refs, Cloudflare zone/account ids; transcripts keep hostnames and status lines only. Evidence naming a private resource beyond what ADR-1722 makes public needs the owner's OK before the push (the arc repo is public).

## Rabbit holes in this phase

- Proxying through Cloudflare's orange cloud: grey cloud (growth's 2026-08-17 lesson).
- Building app features in the frontend shell: a page and a login, nothing more.

## Out of scope for this phase

- money slots
- trust/data slots
- a second provider

## Your-setup / pending

- ONE owner message at Phase 01 start (ADR-1724): `CLOUDFLARE_API_TOKEN` (DNS edit, zone automemory.ai) · a re-issued `VERCEL_TOKEN` (the current one is invalid) · the Vercel GitHub App installed on technology-ashiq with access to `arc-sandbox`, and the GitHub login connected to the Vercel account (both one-time browser steps; no API does them) (absent → hosting `failed(env:VERCEL_GITHUB_APP)`, never a CLI deploy, which would void the day-3 kill) · `SUPABASE_ACCESS_TOKEN` · `RESEND_API_KEY` · GitHub token via `gh auth token`. Absent → `failed(env:{KEY})`.
- Gate 2: the owner stamps `node .claude/scripts/hq/arc-inbox.mjs approve {ULID} --reason ...` from the main clone before the first prod deploy.
- All real apply/verify runs execute from the MAIN clone on merged Phase 00 code; `.claude/state/launch/` lives there.

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
