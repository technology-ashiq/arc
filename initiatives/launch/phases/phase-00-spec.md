# Phase 00 — Contracts, registry, lints and the durable runner on fakes

**Goal (one line):** the slot catalog, the provider registry and the venture profile exist as linted contracts, and a durable runner drives a fixture adapter from profile to receipt, surviving a kill, a concurrent apply and a timeout.
**Appetite:** 2.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** none
**REQs closed here:** REQ-01, REQ-02

## Scope

- `products/launch/manifest.json`; `products/launch/launch.slots.yaml` — all 85 seed slots with `tier · exit_criteria[] · depends_on[] · required_when · optional_for[]` (the full DAG, so the core → non-core edge lint bites); the 33 core rows also carry `verify · gate · approval · timeout · resume`; non-core rows carry `verify: deferred-c2`, rejected on a core row; `products/launch/launch.providers.yaml` with the LAU-S schema and one `candidate` row per core slot (the catalog's initial candidates), every row `approved_by: ashiq`; `products/launch/ventures/arc-sandbox.venture.yaml` (ADR-1710: the only input; the profile from the design source, `honesty_class: rehearsal`, `ai: false`).
- `.claude/scripts/launch/lib/` — `catalog.mjs` (load + resolve tiers/predicates), `registry.mjs`, `dag.mjs` (toposort, cycle and edge checks), `state.mjs` (temp + rename writes, slot state machine, receipt key `venture@slot@provider@attempt`, stable resource tag `venture@slot@provider`), `ctx.mjs` (wrapped `fetch` to `hosts[]` honouring an `AbortSignal`, writer confined to the venture root, emitter), `registry.mjs` (digest = sha256 after CRLF→LF), `runner.mjs` (`withLock` per venture via `lockName`, dead-pid takeover printed, per-slot timeout aborts the adapter, resume from recorded `resources[]` and tags).
- `.claude/scripts/launch/launch-lint.mjs` with `--mutant-selftest` (13 mutants incl. `verify-is-probe`, REQ-01) and `adapter-lint` arms (import boundary, `zero-dep-leg`, `default-word`); `launch-coverage.mjs` importing face-coverage walkers (ADR-1712).
- `.claude/scripts/launch/arc-launch.mjs` skeleton (ADR-1723) exposing `new` and `apply` against a fixture provider (the full six verbs are Phase 01).
- Fixture adapter `tests/launch/fixtures/providers/probe/fake.mjs` + in-memory fake provider; `tests/launch-lint.bats`, `tests/launch-runner.bats` (REQ-02 a–g), `tests/launch-trust.bats` (the four trust fixtures REQ-09 later re-runs on real adapters, plus the CRLF-digest fixture), each asserting RAN first.
- Birth rows (commands in C10): `expected-set.json` plans row `PLAN-launch` (+ `face-sections` regen, fixes main's face-coverage red); sync golden; PORTFOLIO lane row + band 1700 claim; wiki regen; `initiatives/launch/fixed-defects.md` started. Before the first push: `git fetch`, scan origin branches, open PRs and sibling worktrees for `docs/adr/17*` and a 1700 band claim; ADR-1700..1724 and the band row go in the lane's FIRST commit; a collision STOPs and is routed to the other lane, never renumbered silently.
- Spine: the two 2026-10-03 owner rulings recorded as `decision.recorded` from the main clone after merge (worktrees cannot emit).

## Exit criteria (Definition of Done)

- [ ] `launch-lint` passes on the real files and `launch-lint --mutant-selftest` reports 13/13 mutants failed closed, each having RAN
- [ ] `launch-coverage` prints derived counts (slots by tier, core slots with candidate rows)
- [ ] REQ-02 fixtures (a)–(g) and the trust fixtures green on CI per-JOB
- [ ] Phase 00 merged to main (Phase 01 real runs emit from the main clone; worktrees cannot emit)
- [ ] contract tests green against fakes (fixture adapter end to end: new → apply → receipt → state)
- [ ] birth rows in; face-coverage, face-sections `--check`, sync golden, wiki `--check` green on CI
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** CI bats shards running `tests/launch-lint.bats` and `tests/launch-runner.bats` (never on this box); read per-JOB with `node .claude/scripts/review/ci-digest.mjs`.
- **Expected failure first:** both bats files land before the code they test in the same branch's first commit, so their first CI read is red (all three bats files: `launch-lint`, `launch-runner`, `launch-trust`) with `launch-lint.mjs: No such file` / `runner.mjs` import failure; the second push turns them green.
- **Live demo scenario:** the two commands in C8b → board printed with core/required/optional counts; the `apply` leaves the state file at `verified` with one receipt id; re-run → exit 0, same receipt id.
- **Real-system check:** n/a — fakes only phase.
- **Expected evidence:** CI per-JOB digest at the PR head SHA; `initiatives/launch/evidence/phase-00/` with the demo transcript and the mutant-selftest output.

## Rabbit holes in this phase

- Writing a YAML parser: use `parseYamlSubset`; if it cannot express a field, change the field shape, not the parser.
- Modelling all 85 slots' verify bodies now: Phase 00 writes the contract fields; probes arrive with each slot's phase.

## Out of scope for this phase

- Any real provider call
- the other four CLI verbs
- recommendation

## Your-setup / pending

- none — fakes only.

## Phase 00 contracts (inline — the executor needs no other file)

Source of every row below: `docs/strategy/plans/PLAN-launch.md` §The slot catalog (groups 1–11). Where this
section and the design source differ, this section wins for Phase 00 and the difference is an ADR.

### C1 · Slot ids by tier (85 = 33 core · 35 required · 17 optional — `launch-coverage` derives, this list seeds)

**Core (33)** — `id · group · depends_on · initial candidate provider id · gate`:

| id | group | depends_on | initial candidate | gate |
|---|---|---|---|---|
| domain | identity | — | cloudflare-registrar | gate-1 (`approval: true`, sensitive `purchase`) |
| dns | identity | domain | cloudflare-dns | none |
| repo | delivery | — | github | none |
| ci | delivery | repo | github-actions | none |
| hosting | delivery | repo | vercel | none |
| environments | delivery | hosting | vercel-environments | none |
| tls | identity | dns, hosting | vercel-managed-tls | none |
| secrets | delivery | hosting, ci | vercel-env-store | none |
| release | delivery | ci, hosting | arc-ship-release | gate-2 (`approval: true`, sensitive `deploy-prod-first`) |
| frontend | stack | repo | nextjs-shell | none |
| backend | stack | frontend | next-route-handlers | none |
| database | stack | secrets | supabase | none |
| orm | stack | database | drizzle | none |
| email-transactional | identity | dns | resend | none |
| auth | users | database, email-transactional | supabase-auth | none |
| authz | users | auth | rls-roles | none |
| tenancy | users | authz | org-invite | none (`required_when: tenancy == multi`) |
| plans | money | authz | plans-yaml | none (`required_when: payment_model != none`) |
| payment-test | money | secrets, backend | razorpay (fits `in · gateway`); second candidate row dodo (`global · mor`) | none (same predicate) |
| checkout-portal | money | plans, payment-test | razorpay-checkout | none (same predicate) |
| webhooks-ledger | money | payment-test | razorpay-webhook | none (same predicate) |
| refunds | money | webhooks-ledger | razorpay-refunds | none (same predicate) |
| legal-pages | trust | frontend | arc-legal | none |
| security-headers | trust | hosting | next-headers | none |
| dependency-scan | trust | ci | arc-scan-dependabot | none |
| errors | observability | hosting | sentry | none |
| backup | data | database | pg-dump | none |
| restore-drill | data | backup | pg-restore-scratch | none |
| migration-rollback | data | orm, ci | drizzle-down | none |
| passport | wiring | — | venture-register | none |
| ledger-source | wiring | webhooks-ledger | ledger-source | none |
| face-room | wiring | — | face-planned | none |
| teardown-plan | wiring | — (`after: all`) | teardown-render | none |

Day-3 kill set (9): dns · repo · ci · hosting · environments · tls · secrets · frontend · release.

**Required (35)** — `depends_on` copied verbatim from the design source's catalog column: email-inbox · brand-kit ·
cache-ratelimit · onboarding · account · payment-live (`depends_on: payment-test, legal-pages, invoices-gst, refunds`;
gate-3, `approval: true`, sensitive `enable-live-keys`) · pricing-page · invoices-gst (`required_when: region == in`) ·
dunning · consent-dpdp (`region == in`) · app-security · privacy-ops · bot-abuse · logs · uptime · product-analytics ·
web-analytics · performance · alerts-spine · retention · schema-parity · seo-baseline · content-route ·
landing-waitlist · lifecycle-email · support-inbox · launch-kit · llm-gateway · prompt-evals · ai-cost-metering ·
guardrails · eval-gate (the five AI rows: `required_when: ai == true`) · team-manifest · ops-row · growth-config.

**Optional (17):** email-outbound-domain · feature-flags · storage · jobs · search · realtime · document-gen ·
i18n-locale · sessions · trials-coupons · usage-metering · audit-log · mfa · session-replay · changelog-status ·
feedback · document-ingest.

Required and optional rows get one `candidate` provider row each only in Cycle 2; Phase 00 seeds provider rows for
the 33 core slots (34 rows: payment-test has two). The `slot-without-provider` lint applies to core rows only in
Cycle 1 and is stated so in the lint's output.

### C1b · How the 85 rows are filled (the executor copies; it never invents)

The executor reads `docs/strategy/plans/PLAN-launch.md` §The slot catalog — it is in this repo and is the frozen
source — and copies each table row mechanically: **group** = the `### N · <name>` heading the row sits under
(`identity · delivery · stack · users · money · trust · observability · data · growth · ai · wiring`) · **tier** = the
Tier cell (`C`→core, `R`→required, `O`→optional) · **exit_criteria** = the Exit-proof cell as one list item ·
**depends_on** = the depends_on cell, comma-split, `—` → no key · **required_when** = the predicate in the Tier cell
or the group heading (`tenancy == multi`, `payment_model != none` for group 5 except `ledger-source`, `region == in`,
`ai == true`), else `always` · **optional_for** = `O: saas-*` → `saas-b2b, saas-b2c`; `O: saas-b2b` → `saas-b2b`; bare
`O` → `any`. Core rows add **verify** = `{slot}-probe` · **timeout** = 300, except `hosting · release · database ·
backup · restore-drill` = 900 · **resume** = `resources` · **gate/approval** from C1. Non-core rows carry
`verify: deferred-c2` and no gate fields. `teardown-plan`'s `after: all` is exempt from the edge lints by name. Where
a design-source cell is blank, the row says `exit_criteria: [owner to state at C2 kickoff]`-style text as ONE list
item reading `stated at Cycle 2 kickoff` — never invented content.

### C2 · Slot row schema (block YAML, ADR-0200; keys absent = empty)

```yaml
slots:
  - id: dns
    group: identity
    tier: core                 # core | required | optional
    exit_criteria:
      - resolves from 8.8.8.8 and 1.1.1.1 to the hosting target
    verify: doh-two-resolvers  # a probe id named by the adapter; non-core rows: deferred-c2 (rejected on core)
    depends_on:
      - domain
    gate: none                 # none | gate-1 | gate-2 | gate-3
    approval: false            # true on every gated slot and on any slot whose providers list sensitive_actions
    timeout: 120               # seconds
    resume: resources          # resources (re-enter with recorded resources[]) | rerun | manual
    required_when: always      # predicate, grammar below
```

Optional rows carry `optional_for:` (a list of venture types, or the single item `any`). `teardown-plan` carries
`after: all` instead of edges. **Predicate grammar:** `always` | `FIELD == VALUE` | `FIELD != VALUE`, clauses joined by
` and `; FIELD ∈ `type · region · payment_model · tenancy · ai`; an unknown FIELD or VALUE is a lint FAIL. A false
predicate renders `skipped(<predicate text>)`.

### C3 · Provider row schema (LAU-S)

Required on every row: `id · slot · status · hosts · adapter · approved_by`. Optional: `fits` (list of types) ·
`region` (`in | global | any`) · `payment_model` (`gateway | mor | none | any`) · `cost_model` · `env_keys` (list) ·
`credentials:` → `scope:` · `sensitive_actions` (list) · `digest` (`null` or sha256 hex) · `vetted_by` (`null` or a
`decision.recorded` id) · `scout` (`null` or a path to the `/arc-capability` record) · `last_verified` (`null` or ISO
date, runner-written) · `reason` (required when `status: blocked`). `adapter` is relative to `products/launch/`.
`status: vetted` without `vetted_by`, `digest` and `scout` = FAIL. `approved_by` must equal the owner id `ashiq`
(the constant `design-sources-lint.mjs` uses).

### C3b · Adapters in Phase 00, path convention, hosts

**Phase 00 writes no real adapter.** A provider row's `adapter` path follows `providers/{slot}/{id}.mjs`; the
`row-without-adapter` rule FAILs a row whose status is `vetted` and whose file is missing, and REPORTS (not fails) a
`candidate` row whose file is not yet written as `candidate-unbuilt` — the count `launch-coverage` prints. Real
adapter files arrive with their slot's phase, each passing `zero-dep-leg`, `default-word` and `verify-is-probe`.
`hosts` for the 34 seed rows: cloudflare-registrar, cloudflare-dns → `api.cloudflare.com` · github, github-actions →
`api.github.com` · vercel, vercel-environments, vercel-env-store, vercel-managed-tls, arc-ship-release →
`api.vercel.com` · supabase, supabase-auth → `api.supabase.com` · resend → `api.resend.com` · razorpay,
razorpay-checkout, razorpay-webhook, razorpay-refunds → `api.razorpay.com` · dodo → `live.dodopayments.com` · sentry →
`sentry.io` · pg-dump, pg-restore-scratch → `pooler.supabase.com` · every repo-local provider (nextjs-shell,
next-route-handlers, drizzle, drizzle-down, rls-roles, org-invite, plans-yaml, next-headers, arc-legal,
arc-scan-dependabot, venture-register, ledger-source, face-planned, teardown-render) → the venture's own domain
`sandbox.automemory.ai` (its verify probes the live site). A row with an empty `hosts` is a lint FAIL.
**`verify-is-probe` rule (static):** an adapter's `verify` function body must call `ctx.fetch` or `ctx.probe`; a
`verify` whose only calls are `readFile*`/`existsSync`/`ctx.resources` FAILs.

### C4 · Adapter and ctx API

```js
export const id = "cloudflare-dns";
export const slot = "dns";
export async function scaffold(ctx)  // → { files: [relPath], resources: [{ kind, id, tag }], notes: [string] }
export function envContract()        // → ["CLOUDFLARE_API_TOKEN"]
export async function verify(ctx)    // → { ok: true, answerer: "dns.google", evidence: {...} } | { ok: false, reason }
export async function teardown(ctx)  // → { steps: [{ order, action, resource }] }   (rendered only in v1)
```

`ctx` = `{ profile, board, slot, provider, root, resources, tag, attempt, signal, env, fetch, write, report, emit }`:
`root` = the venture repo root; `resources` = what state recorded for this slot; `tag` = `venture@slot@provider`;
`signal` = an `AbortSignal` fired at the slot timeout; `env` holds only the keys `envContract()` names (missing →
the runner fails the slot `failed(env:KEY)` before calling the adapter); `fetch(url, init)` throws `HOST_REFUSED`
for a host not in the row's `hosts` and passes `signal`; `write(relPath, text)` throws `WRITE_REFUSED` for a path
resolving outside `root`; `report(resource)` persists one resource to state immediately (closes the crash window);
`emit(kind, payload)` goes to the spine (C7). Every refusal is an `Error` with `.code` ∈ `HOST_REFUSED ·
WRITE_REFUSED · ENV_MISSING · ABORTED · DIGEST_DRIFT · APPROVAL_PENDING`.

### C5 · `products/launch/ventures/arc-sandbox.venture.yaml`

```yaml
slug: arc-sandbox
type: saas-b2b
region: in
payment_model: gateway
tenancy: multi
ai: false
honesty_class: rehearsal
compliance:
  - dpdp
  - gst
brand:
  name: arc sandbox
  domain: sandbox.automemory.ai
```

### C6 · State file `.claude/state/launch/{slug}.json`

```json
{ "schema": 1, "venture": "arc-sandbox", "honesty_class": "rehearsal", "generation": 7,
  "slots": { "dns": { "state": "verified", "provider": "cloudflare-dns", "attempt": 1,
    "resources": [{ "kind": "dns-record", "id": "rec_1", "tag": "arc-sandbox@dns@cloudflare-dns" }],
    "receipt": "01K…", "reason": null, "updated": "2026-10-03T00:00:00Z" } } }
```

States: `pending · planned · awaiting-approval · applying · applied · verified · failed · skipped · absent`.
Transitions: `pending→planned` (`plan`) · `planned→awaiting-approval` (gated slot) · `awaiting-approval→applying` (a
`decision.recorded` approving it) · `planned→applying` · `applying→applied` (scaffold ok) · `applied→verified`
(verify ok) · `applying|applied→failed(reason)` with reason ∈ `timeout · env:KEY · tool:NAME · refused:CODE ·
error:MESSAGE` · `failed→applying` (re-run, `attempt + 1`) · `verified→verified` (no-op, same receipt). `skipped`
and `absent` carry a reason and are re-evaluated by `plan`. **Generations:** write `{slug}.json.tmp`, copy the current
file to `{slug}.json.prev`, rename tmp over current, `generation + 1`; a parse error on load falls back to `.prev`
and prints that it did. **Lock:** `withLock(stateDir, fn, { lockName: ".{slug}.lock", timeoutMs: 500 })` from
`.claude/scripts/hq/lib/spine-io.mjs` — its existing pid check takes over a dead holder's lock; a live holder makes
the second `apply` exit 3 naming the pid.

### C7 · Emitter

Real runs: `node .claude/scripts/hq/arc-event.mjs emit run.completed --process launch@0.1.0 --venture {slug} --payload
'{"slot","provider","outcome","honesty_class","attempt","key"}'` where `key` = `venture@slot@provider@attempt`;
gates emit `approval.requested`; picks and owner rulings emit `decision.recorded` (payload shape read from
`.claude/scripts/hq/lib/validate.mjs` at implementation). Tests set `ARC_SPINE_ROOT` to a temp dir (`spineRoot()`
honours it and refuses an empty value), so fixture receipts never touch a real spine; "zero new events" is a count
of that temp spine before and after.

### C8 · CLI (Phase 00 subset) and fixture wiring

`arc-launch.mjs new --venture {slug}` and `arc-launch.mjs apply {slot} --venture {slug} [--provider id]`, each
accepting `--catalog P · --registry P · --providers-dir D · --ventures-dir D · --state-dir D · --venture-root D`.
Defaults: `products/launch/launch.slots.yaml`, `products/launch/launch.providers.yaml`, `products/launch/providers`,
`products/launch/ventures`, `.claude/state/launch`; `--venture-root` has NO default — absent → exit 2 naming it
(launch never guesses where a venture's repo lives). Fixtures: `tests/launch/fixtures/catalog.yaml` (one core slot
`probe`, plus slots the DAG mutants need), `tests/launch/fixtures/registry.yaml` (row `fake` → adapter
`tests/launch/fixtures/providers/probe/fake.mjs`), passed by flag. Fixture adapters live outside the default
providers dir, so `launch-lint` on the real files never sees them; the lint's adapter arms are exercised on the
fixtures by passing `--providers-dir`. The kill fixtures spawn the CLI as a child process and kill it (a real
process kill, not a thrown error) at a marker line the fake adapter prints.

### C8b · Runner behaviour the fixtures pin

The fake provider is **file-backed** (`{state-dir}/fake-provider.json`) so a killed child's creates survive.
`apply` on a `pending` slot plans it implicitly, then refuses with exit 4 naming every unmet `depends_on` slot that is
not `verified`/`skipped`/`absent`. A gated slot moves to `awaiting-approval`, emits `approval.requested`, and exits 5
(`APPROVAL_PENDING`); a later `apply` finds the approving `decision.recorded` by the `approval.requested` id stored in
state, or exits 5 again. Exit codes: 0 done/no-op · 1 slot failed (state names the reason) · 2 refused (REFUSED, bad
flags, missing `--venture-root`) · 3 lock held by a live pid · 4 unmet dependencies · 5 awaiting approval. A digest
mismatch is reported and refused at load **in memory only** — the runner never writes the owner's registry YAML; the
row reads as `candidate` until the owner re-vets. The Phase 00 live demo: `arc-launch.mjs new --venture arc-sandbox
--venture-root {scratch} --state-dir {scratch}/state`, then `apply probe --venture arc-sandbox --catalog
tests/launch/fixtures/catalog.yaml --registry tests/launch/fixtures/registry.yaml --providers-dir
tests/launch/fixtures/providers --venture-root {scratch} --state-dir {scratch}/state --provider fake`.

### C9 · Mutant mechanics

`launch-lint --mutant-selftest` copies the real catalog, registry and one fixture adapter into `os.tmpdir()`, applies
one named edit per mutant, runs the lint on the copy, and prints `RAN mutant {name}` then `REFUSED {rule}`; it ends
with `13/13 mutants refused` and exits 0 only then. `tests/launch-lint.bats` asserts each RAN line, each REFUSED
line and the final count.

### C10 · Birth rows and their commands

- `initiatives/face/contracts/expected-set.json`: plans `"PLAN-launch": "strategy"` · adr band `"1700": "lane"` ·
  lanes `"launch": "lane"` → `node .claude/scripts/core/face-sections.mjs`, then `--check`, then
  `node .claude/scripts/core/face-coverage.mjs` (all three already green on the kickoff commit).
- `products/launch/manifest.json`: org's shape (`name: launch · version: 0.1.0 · requires: core, engine, hq ·
  scripts: every .claude/scripts/launch file · files: products/launch data files`), face block copied from org's
  and adjusted until `face-sections --check` passes.
- Sync golden (only if a synced path changes): `T=$(mktemp -d) && bash sync-to-project.sh "$T" >/dev/null && (cd "$T" && find . -type f -not -path './.git/*' -not -path './.claude/arc-registry.json' | LC_ALL=C sort | while IFS= read -r f; do printf '%s	%s
' "${f#./}" "$(tr -d '' < "$f" | sha256sum | cut -d' ' -f1)"; done) > tests/fixtures/sync-golden/tree-manifest.txt` — the same walk as `_arc_tree_manifest` in `tests/test_helper.bash:560`; a new synced file also needs its `products/launch/manifest.json` line or product-lint stops every job.
- `PORTFOLIO.md`: the lane row `| launch | LIVE | arc-launch (Cycle 1, opened 2026-10-03) | 00 | 18d / 0d | — | … |`
  and the band row `| 1700–1799 | launch — claimed at birth, 2026-10-03 (1700–1724 taken); … |`.
- Wiki: `node .claude/scripts/docs/wiki-build.mjs`, then `--check`.
- `hq.policy.yaml` `process:launch` is NOT a Phase 00 row: `policy-lint` refuses a `process:` key with no
  `processes/launch*.process.yaml`, and the lock says the row lands with the first emission. It lands in Phase 01
  with the first real `run.completed`, together with whatever process file `policy-lint` requires.

### C11 · Test inventory

`tests/launch-lint.bats` (REQ-01 + mutants) · `tests/launch-runner.bats` (REQ-02 a–g) · `tests/launch-trust.bats`
(four trust fixtures + CRLF digest) · helpers in `tests/launch/*.mjs`. CI's shard script picks up every
`tests/*.bats`; the first commit carries all three red (the scripts they call do not exist yet).

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
