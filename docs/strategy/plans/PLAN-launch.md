# PLAN (design source) — `launch` v1: the venture factory — one fixed process, every tool a pluggable slot

> **Trigger FIRED — owner ruling, 2026-10-03.** After a full-tree analysis showed the money chain
> (*discover → build venture → bill → distribute → measure → ledger*) with three of five links
> missing while every governance organ was complete, the owner chose the `launch` lane first:
> *"launch lane pudichuruku, oru lane iruntha easy ah ventures create pannalam"* — and set its two
> conditions in the same breath: **the process is fixed** (*"oru process ah fix pannalam… mail,
> domain, frontend, backend, auth, payment, security, logs, database, backup"*) and **every tool is
> dynamic** (*"ellame dynamic ah add pannalam, eponalum entha tool naalum use pannikalam, ovvoru tools
> kum suggest irukum ethu best nu"*). The ruling goes on the spine as a `decision.recorded` in Phase 0
> and every kickoff ADR cites it, the same pattern the Build-out Mandate and the org ruling set.
>
> **v1.1 — owner-brought external review, 2026-10-03 (same day).** Eight findings, each verified
> against the v1.0 text before adjudication. **All eight ACCEPTED, three with modification, none
> rejected.** The record is in §Review adjudication below; the load-bearing consequences are:
> the slot catalog is **85 slots** (not 48 — v1.0 carried a chat-era number into the file; the
> reviewer's literal count of 82/67-required was correct within two rows), slots now carry a
> **tier** (`core · required · optional`) and a machine-readable `depends_on`, `payment` is split
> into `payment-test` and `payment-live` so the phase order no longer contradicts its own
> dependency, the word *default* is gone from the catalog (**initial candidate**), the runner gets
> a **durable state model** with resume semantics, the registry schema gets a **trust boundary**
> (`hosts[]`, adapter digest pin, `sensitive_actions[]`), and **v1 is narrowed to the steel-thread
> proof** — 33 core slots, 15.5 d — with the remaining 35 required slots named as **launch Cycle 2**
> in this same file rather than dropped.
>
> **Owner ruling in the same round: no Nilluvai.** *"Nilluvai plan illa, athu venam — venumna
> future la pannikalam, ippo idea illa."* The dogfood venture is therefore a **rehearsal venture**,
> `arc-sandbox`, on a subdomain of a domain arc already owns — honesty class `rehearsal`, never
> `real` (the face's honesty-class law). This is stronger, not weaker: `launch` is proven as a
> machine, not as a favour to one venture, and the first real venture arrives through
> `PLAN-discover.md` as a `venture.yaml` when an idea exists.
>
> **Status: DRAFT v1.1 for owner review — NOT landed.** On landing, decisions **LAU-A…N, LAU-P…T
> lock**; **LAU-O stays open by design** and is decided at kickoff. This file then becomes the
> frozen decision record; the buildable cycle is cut from it into `initiatives/launch/PLAN.md` at
> kickoff. Attack findings mutate that file, never this one.
>
> **Honesty note.** No venture has been scaffolded by arc, so there is no setup-time or
> defect-rate baseline and none is invented. The falsifiable claims this plan makes are mechanical:
> **REQ-03** (the rehearsal venture goes subdomain → deploy → login → test-mode purchase with a
> receipt per slot), **REQ-08** (a second provider enters a slot through one registry row and one
> adapter file with **zero** changes to lane code — the "dynamic" claim, tested rather than
> asserted), and **REQ-06** (every slot's `verify` is a real probe, never a self-report). The first
> real `revenue.received` is **REQ-12** and is recorded **OPEN-at-first-venture** — the C2 REQ-07
> closure pattern: mechanism proven, live value pending. This lane makes the first ₹ *reachable*;
> it does not claim to make it arrive, and with no venture idea on the table it does not pretend
> one exists.
>
> **ADR band.** `launch` holds no band. Claim **1700–1799** — PORTFOLIO's "next lane to be born" row —
> at kickoff, **after sweeping sibling worktrees.** The board's own `org` row was born with the note
> that the `docs` row read "1500–1512" while `1514` existed on disk; a hand-kept band row is one file
> stale by the time anyone reads it. Sweep, never trust the row.

---

## Review adjudication — 2026-10-03, external review of v1.0 (verified, then ruled)

| # | Finding (reviewer) | Verified? | Ruling | Where it landed |
|---|---|---|---|---|
| 1 | Slot count: file says 48, tables hold 82; ~67 required for the stated profile, not 36 | **Yes** — script count of v1.0 tables: **84 rows, 67 marked R**. The 48 was carried from the chat sketch and never recounted — the exact stale-count class ADR-0107 exists for | **ACCEPT.** Canonical list = `launch.slots.yaml`; every count in this file is declared a *seed*, and `launch-coverage` derives the real numbers at P00. Tiers added so "required" splits into what v1 must prove (`core`) and what a launch must have (`required`) | §Slot catalog, LAU-Q, REQ-01 |
| 2 | Phase 02 (money) depends on Phase 03 (legal) via the payment row's "activation checklist green", while §Phases says "do not reorder" | **Yes** — the contradiction is in the text | **ACCEPT with modification.** Split `payment` → `payment-test` (no legal dependency; test mode) and `payment-live` (depends_on `legal-pages`, approval gate 3, **out of this cycle**). The order stands *because* the dependency is now correct, not by fiat | LAU-T, §Slot catalog §5, §DAG |
| 3 | `payment_model: none` has no rule — are money slots skipped or does the requirement vanish? | **Yes** — undefined | **ACCEPT.** `required_when:` on slot rows; `none` resolves the money group to `skipped (payment_model none)`, visible on the board; `ledger-source` stays (costs exist without revenue) | LAU-Q, §Slot catalog §5 |
| 4 | "Default" in the catalog contradicts LAU-C "no default"; an implementer reads a silent fallback | **Yes** | **ACCEPT.** Every "Default" → **"Initial candidate"**; LAU-C text names the word as forbidden in slot files and adapter code (`default-word` lint over the two YAMLs) | catalog headers, LAU-C |
| 5 | `depends_on` is promised but no DAG is shown; apply order lives in prose | **Yes** | **ACCEPT.** Steel-thread DAG drawn in-file; every slot row in `launch.slots.yaml` carries `depends_on[] · gate · approval · timeout · resume`; `launch-lint` checks acyclic + every edge resolves + no edge from `core` into `required` | §DAG, REQ-01, LAU-R |
| 6 | 19 d does not fit 82 slots; the day-3 checkpoint sits after a 4-day phase that already contains auth, DB, tenancy, deploy | **Yes** | **ACCEPT with modification.** v1 = **33 core slots, 15.5 d / 18 cap**; day-3 kill = *a page serves on the rehearsal subdomain from a git-triggered deploy* (9 slots), auth/db/tenancy close Phase 01 at day 5. The other 35 required slots are **launch Cycle 2**, sequenced here by dependency — the contracts must survive one real board before 35 more adapters are written against them. Not trigger-waiting: Cycle 2 has no pull condition, only an order | §REQs, §Phases, §Cycle 2 |
| 7 | `apply` reliability undefined: mid-run crash, resource created but receipt not written, concurrency, timeout, resume after a gate, missing secret | **Yes** | **ACCEPT.** Durable per-venture state file, a slot state machine, idempotency key `venture@slot@provider@attempt`, check-then-create in `scaffold()`, the spine's `withLock`, one apply at a time, per-slot timeout from the slots file, partial failure records provider resource ids for teardown | LAU-R, REQ-02 |
| 8 | Adapter trust boundary too thin: `hosts[]` referenced but absent from the schema; adapters can call any API and write any file; no digest pin, no least-privilege, no approval on sensitive actions | **Yes** — `hosts[]` was in `adapter-lint` prose and missing from the registry shape | **ACCEPT.** Registry schema gains `hosts[]`, `digest` (sha256 of the adapter at vet; drift → back to `candidate`), `credentials.scope`, `sensitive_actions[]` (each = an `approval.requested`); `adapter-lint` enforces hosts on every outbound call and a write-root allowlist | LAU-S, §Registry shape |
| — | Reviewer's proposed v1 proof goal: *login on the venture domain, git-triggered deploy, test purchase lands simulated in the ledger, backup restore proven* | — | **ACCEPT as the v1 goal sentence**, with the venture swapped for the rehearsal venture per the owner's ruling | §Goal |

Reviewer's recommendation not to land v1.0 as a frozen source: **followed** — v1.0 was never
written to the repo; this v1.1 is the first candidate for landing.

---

## Read this first — arc already has most of a venture's organs, scattered across nine lanes

Walk a SaaS venture's launch checklist and look for the arc equivalent. Most of it exists, each
piece built by a different lane for a different reason, and **nothing calls them in order**:

| A venture launch needs… | arc already has… | Where |
|---|---|---|
| Legal pages for payment activation | the seven-page activation set, hash-chain publish law, `payment_model: gateway\|mor\|none` | `products/legal`, ADR-1001, ADR-1011, PLAN-legal-pack |
| A warmed sending domain, DKIM/DMARC | `preflight.mjs` refusing on missing DMARC or `p=none`; 9/9 delivered, `dkim=pass` | leads lane, ADR-0415 |
| A content route + SEO baseline | the growth engine, `INDEXABLE` flag, sitemap checker, GSC ingest, per-site config | `products/growth`, PLAN-growth Appendix A, ADR-1115/1118 |
| Revenue landing on the books | `revenue.received` ingest behind a PII-free validator, `arc pnl`, month-close gate | `products/ledger`, `ledger-ingest.mjs`, ADR-1012..1018 |
| A venture passport + kill lines | `venture-register.mjs` (with `--dry-run`) → PORTFOLIO row + `ventures.yaml` behind an approved receipt | `.claude/scripts/hq/venture-register.mjs`, ADR-1008/1017 |
| A staffed team | org team manifests, `sync-to-project --team`, the ₹0 dispatcher | `products/org`, ADR-16xx |
| Uptime and support triage | the ops design (registry-as-config, one row per venture) | PLAN-ops — **lane not born** |
| A brand, tokens, a landing page that scores | the design lane's composer + critic, `tokens.css` | `products/design`, ADR-14xx |
| A permission registry for external tools | `design.sources.yaml` + its lint: owner-only birth, status vs availability separated | ADR-1408, `design-sources-lint.mjs` |
| Vetting a tool before it is load-bearing | `/arc-capability` scout (DEV-B/C), trial-ledger, absorb's two-speed model | `products/develop`, `products/absorb` |
| Picking between two tools on evidence | bench — fixture A/B, human verdict, `NO PROPOSAL` on a failed gate | `products/bench`, ADR-0900..0914 |
| Honesty classes for things that are not real | `real / simulated / rehearsal / drill / exploratory`, never co-rendered | PLAN-face (FACE honesty classes), `revenue.simulated` law |
| Approvals, receipts, the owner's keystroke | the spine, inbox, E2 human sovereignty, `withLock` | `products/hq`, `CONSTITUTION.md` |

**What does not exist anywhere in the tree** (grep for `scaffold`, `provider`, `slot`, `launch`,
`venture new` returns the register script and nothing else): the thing that says **"a venture is
this ordered list of capabilities, each with a proof of done; here is which tool fills each one
for this venture and why; run it, resume it, tear it down."** That missing binding is why LexOS was
built by hand outside arc and why the money side of the spine is empty after eleven weeks.

`launch` builds that binding and **nothing that already exists**. It calls legal, growth, leads,
ledger, org and design; it does not re-implement any of them (Constitution A5, the `uses:` law).

---

## Goal

One sentence: **`arc launch new <venture>` turns a `venture.yaml` profile into a running,
billing, observed, backed-up, receipted product on its own domain — through one fixed sequence of
capability slots, each filled by whichever vetted tool the registry recommends for that venture,
swappable later by one YAML row and one adapter file.**

**v1 proof (this cycle), in one sentence:** *on the rehearsal venture `arc-sandbox`, a login works
on its own subdomain from a git-triggered deploy, a test-mode purchase lands in the ledger as
`revenue.simulated`, a backup is restored and matches, and a second provider enters one slot by
row + adapter alone — each with a receipt.*

Two things are fixed and two things are free, and the plan's whole discipline is keeping them apart:

- **Fixed:** the slot list and each slot's *exit criteria*. A venture cannot skip a required
  slot; a slot cannot be declared done by assertion.
- **Free:** which tool fills a slot, when that choice is made, and how often it changes.

---

## Current state (verified 2026-10-03 against the live tree — re-verify at kickoff)

- **Spine:** 1525 events across 46 kinds. `revenue.received` 0 · `revenue.simulated` 0 ·
  `cost.incurred` 0 · `content.published` 4 · `lead.researched` 15. The ledger renders honest-empty.
- **Ventures:** `lexos` — private repo, paused, deployed surface still serving. **No venture idea is
  currently on the table** (owner, 2026-10-03). Nilluvai's org team manifest (org C18) stays as org's
  own artifact; it is not this lane's input.
- **Domains arc owns:** `automemory.ai` (growth site, warmed sending domain, DMARC `p=quarantine`).
  The rehearsal venture lives at a subdomain of it, so the `domain` slot is exercised through its
  **refusal path and dry-run**, never a purchase (no E2 money in a rehearsal).
- **Lanes this lane calls:** legal LIVE Phase 00 (seven-page set, renderer, lints) · growth LIVE
  Phase 06 (publish = PR, machine never merges) · leads LIVE Phase 03 (mail proven) · ledger IDLE
  (closed 7/8; ingest parsers over export files; **no live webhook adapter**) · org IDLE · ops
  **not born** · design LIVE Phase 02 · scheduler LIVE (Windows Task Scheduler, ₹0 script jobs).
- **Registry precedent:** `design.sources.yaml` + `design-sources-lint.mjs` — block-style YAML only
  (ADR-0200), `approved_by` linted against the owner, `status` (intent) vs `availability` (observed).
- **Register precedent:** `venture-register.mjs` — refuses `--slug arc`, has `--dry-run`, writes the
  passport on a branch, receipt required or the pnl panel prints UNRECEIPTED.
- **Face:** v2 Cycle 16 at Phase 08; room = four files (FV2-C); WORK door two-phase (FV2-I).
- **Nothing exists of:** slot contracts, a provider registry, adapters, `arc launch`, a runner state
  model, a Launch room, a re-verify job, a teardown plan.

---

## Success requirements — v1 (this cycle)

| REQ | Requirement | Falsifiable acceptance | Phase |
|---|---|---|---|
| REQ-01 | **Slot and provider contracts exist, with a DAG, and are enforced** | `launch.slots.yaml` (every slot: `tier · exit_criteria[] · verify · depends_on[] · gate · approval · timeout · resume · required_when · optional_for[]`) + `launch.providers.yaml` (schema in §Registry) + `launch-lint` **FAIL-FROM-BIRTH with `--mutant-selftest`**: row-without-adapter · adapter-without-row · unknown slot · `vetted` without a `decision.recorded` id · `approved_by` ≠ owner · flow-style YAML · **cycle in `depends_on`** · **edge from `core` into a non-core slot** · the word `default` in either file · adapter digest drift — each mutant fails closed. `launch-coverage` derives the counts this file only seeds | 00 |
| REQ-02 | **`arc launch` CLI — six verbs, durable, resumable** | `new <slug>` · `plan` · `apply <slot>` · `verify [slot\|--all]` · `status` · `teardown --plan`. State in `.claude/state/launch/<slug>.json`; slot state machine per LAU-R; `apply` re-run on a `verified` slot = no-op with the same receipt id; **kill -9 mid-apply then re-run resumes from the recorded resource ids** (fixture); two concurrent `apply` = second refuses on the lock; per-slot timeout honoured | 01 |
| REQ-03 | **Steel thread on the rehearsal venture** | `arc-sandbox` at `sandbox.automemory.ai`: dns → tls → repo (arc root-mode installed) → ci → environments → hosting → secrets → frontend shell → **prod deploy serves a page (day-3 kill)** → backend → database → orm → auth (login → session → logout) → authz (cross-tenant 403) → tenancy — one `run.completed process=launch@x.y` per slot, all `rehearsal`-classed. Gate 2 (first prod deploy) is **exercised for real** | 01 |
| REQ-04 | **The money chain reaches the ledger, honestly labelled** | `payment-test` (test mode) → `checkout-portal` → webhook → ledger PII-free validator → **`revenue.simulated`** (never `revenue.received`) · `refunds` nets through the ledger's link rule · `plans` entitlement blocks a gated route on downgrade · `arc pnl` shows the simulated line **labelled** · webhook replay = one event (idem). Gate 3 (`payment-live` keys) is **exercised** — the `approval.requested` is emitted and the refusal path proven — **never crossed** | 02 |
| REQ-05 | **Every core slot has one vetted provider with adapter + verify** | `launch-coverage`: core slots × vetted providers; any core slot at zero vetted = FAIL; the `arc-sandbox` board is 100% core `verified` or named ABSENT | 00–04 |
| REQ-06 | **Verify is a probe, never a self-report** | DNS from two public resolvers · TLS grade from the scanner · security headers from the live response · cross-tenant 403 · **a backup restored to scratch with matching row counts** · a thrown fixture error reaches the tracker · webhook round-trip. `verify-is-probe` lint: a verify that only reads local files fails | 01–03 |
| REQ-07 | **Recommendation v1 is derived, never typed** | `plan` prints per slot `recommended · why (fit-rule ids + status + last_verified) · alternatives · REFUSED (reason)`; override = `decision.recorded` the next `plan` cites; zero vetted → REFUSED and `apply` exits 2. Fit rules only (LAU-F v1) | 04 |
| REQ-08 | **A second provider enters by row + adapter only** | One core slot gains a second provider (candidate: `neon` for `database`, or `cloudflare-workers` for `hosting` — picked at kickoff for lowest cost) and reaches `vetted` with **a diff touching only `launch.providers.yaml` and `providers/<slot>/<name>.mjs`**, asserted by a CI check over the PR file list. Lane code changed = REQ-08 FAILS and the contract was wrong | 04 |
| REQ-09 | **Trust boundary is enforced, not described** | adapter digest pinned at vet; a one-byte adapter edit flips the row to `candidate` (fixture) · an outbound call to a host not in `hosts[]` is refused (fixture) · a write outside the venture repo root is refused (fixture) · each `sensitive_actions[]` entry emits `approval.requested` before running (fixture) | 00, 04 |
| REQ-10 | **arc wiring minimum + teardown plan** | `passport` via `venture-register --dry-run` for a rehearsal (the real run is a real venture's) · `ledger-source` registered · `face-room` present as `planned` or live under FV2-C · `teardown --plan` renders the ordered exit from the board (data export → notice → cancel → park → archive); `--plan` only | 04 |
| REQ-11 | **Drift is detected without anyone looking** | a ₹0 script-class `hq.jobs.yaml` job runs `verify --all` weekly per venture; a regression (cert, DMARC, backup > 8 d) surfaces as a brief `needs-you` line now and as ops' `incident.raised` once ops is born | 04 |
| REQ-12 | **Live value: first real ₹** | first `revenue.received` whose `venture` was scaffolded by `launch`. **OPEN-at-first-venture.** Recorded in the evidence bundle as not met, with the board that made it reachable | — |

**Appetite v1: 15.5 days effort, 18 cap**, Tier M+. The 50% tripwire is at the Phase 02 exit.

## Success requirements — launch Cycle 2 (named here, built next; not trigger-gated)

The 35 `required` slots and the capabilities below are **not dropped**: under the Build-out
Mandate they are built, and the honest ordering reason is that 33 core slots must survive one
real board before 35 more adapters are written against the same contracts. Cycle 2 opens the day
Cycle 1's retro closes.

| C2-REQ | Scope |
|---|---|
| C2-01 | All `required` slots adaptered + vetted: §1 brand-kit, email-inbox · §3 cache-ratelimit · §4 onboarding, account · §5 payment-live, pricing-page, invoices-gst, dunning · §6 consent-dpdp, app-security, privacy-ops, bot-abuse · §7 logs, uptime, product-analytics, web-analytics, performance, alerts-spine · §8 retention, schema-parity · §9 seo-baseline, content-route, landing-waitlist, lifecycle-email, support-inbox, launch-kit · §10 AI layer (five) · §11 team-manifest, ops-row, growth-config |
| C2-02 | Recommendation v2 — receipt weighting (LAU-F), behind its own trigger (≥2 vetted providers in a slot **and** ≥2 ventures with receipts) |
| C2-03 | Template #2: `content-site` derived view — proven by scaffolding arc's own site config through it (growth lane as client) |
| C2-04 | `teardown --apply` behind approval gates; `migrateFrom()` if a live venture asks (LAU-G trigger) |
| C2-05 | Face Launch room from `planned` to live; `apply` through the two-phase WORK door |

---

## Decisions (letters — real ADR numbers assigned at kickoff from the claimed century)

**LAU-A — A slot is a contract, a tool is a row.** Slots are defined once in `launch.slots.yaml` by
what must be *provably true at exit*; they never name a tool. Tools live only in
`launch.providers.yaml`. The lint refuses a slot definition that contains a provider id and a
provider row that redefines exit criteria.

**LAU-B — Owner-only registry birth.** `approved_by` on every provider row is linted against the
owner (ADR-1408 law). A machine that can add its own permitted tools has no permission model.
Scans and absorb may *propose* a row as `idea.captured`; a row exists only when the owner writes it.

**LAU-C — No default, ever. A slot with zero vetted providers REFUSES.** `apply` exits 2 and `plan`
prints `REFUSED — no vetted provider for <slot>`. Bench's "a missing ceiling is a refusal, never a
default" applied to tooling. **The word `default` is forbidden in both YAML files and in adapter
code** (`default-word` lint) — the catalog says *initial candidate*, because an implementer who
reads "default" writes a fallback.

**LAU-D — The adapter contract is four functions and no logic.** `scaffold(ctx)` ·
`envContract()` · `verify(ctx)` · `teardown(ctx)`. An adapter may write files **under the venture
repo root**, call hosts **in its row's `hosts[]`**, and read the venture profile. It may **not**
import from the venture's application code, hold business rules, or decide anything a slot's exit
criteria do not ask. `scaffold()` is **check-then-create**: it asks the provider whether the
resource exists before creating it, so a resumed run never doubles a resource (LAU-R).

**LAU-E — Provider lifecycle: `candidate → vetted → retired | blocked`.** `vetted` requires, in one
branch: a `/arc-capability` scout record (DEV-B/C), the slot's `verify` passing against the real
provider at least once, a `decision.recorded` whose id the row carries, and the adapter's `digest`
written. `blocked` requires a `reason`. `status` is the owner's intent; `last_verified` is observed
and runner-written — never collapsed.

**LAU-F — Recommendation is derived, never typed.** v1 = deterministic **fit rules** over the
venture profile × provider rows → ranked list with rule ids as the reason. v2 (Cycle 2, behind its
trigger) adds receipt weighting. A tie or an owner-named doubt goes to `/arc-council`. An owner
override is a `decision.recorded` the next `plan` cites.

**LAU-G — Swap for a new venture is instant; swap for a live venture is a migration.** The
registry decides what a *new* board gets. Changing a *running* venture's provider is a venture-side
`/arc-change` with its own ADR and a data plan. `migrateFrom()` is not in v1; its trigger is the
first live venture that asks.

**LAU-H — Zero new spine kinds.** Every slot run is `run.completed` with `process: launch@x.y.z`
and `payload.{slot, provider, outcome, honesty_class, attempt}`. Three human gates emit
`approval.requested` and stop until `decision.recorded`: **domain purchase**, **payment live
keys**, **first production deploy**. Provider picks are `decision.recorded`. The `hq.policy.yaml`
row for `process:launch` lands in the same change as the first emission (POL-I).

**LAU-I — Verify is a probe (the legal lane's production-probe law, applied to infrastructure).**
A slot is `verified` only when something outside the repo answered. For `backup`, the probe **is
the restore**: dump → restore to scratch → row counts equal → receipt. A backup never restored
renders `unverified`, not `done`.

**LAU-J — The venture profile is the only input.** `venture.yaml`: `slug · type · region ·
payment_model · tenancy · ai · compliance[] · honesty_class · brand`. Templates are **derived**
slot subsets per `type`; a template is a view over the catalog, never a second catalog. Optional
slots render as `skipped (optional for <type>)`, never hidden.

**LAU-K — The arc wiring block is a slot group like any other, and it runs last-but-one.** Passport
through `venture-register` (never a hand-written PORTFOLIO row; `--dry-run` for a rehearsal
venture), kill lines behind the receipt, team manifest, ops registry row, growth site config,
ledger source, face room. Each item leaves a receipt or a **named ABSENT** (ADR-1018).

**LAU-L — One walker.** `launch-coverage.mjs` imports its walkers from
`.claude/scripts/core/face-coverage.mjs` (DOC-A, ORG-J). Slots and providers are enumerated from
the two YAML files and the `providers/` tree; there is no third inventory.

**LAU-M — Secrets never touch the repo and launch never fetches a key.** `envContract()` returns key
names; `apply` prints them and **waits** for the owner to place them in the hosting env store
(E2). `.env.example` is generated from the union of contracts and linted against it; gitleaks runs
in the venture's CI from the first commit. A missing key is a REFUSED slot.

**LAU-N — A venture is born with its teardown plan.** `teardown --plan` is generated from the board
at `new` time and refreshed by every `apply`, including the **provider resource ids** each apply
recorded. v1 renders; it never applies.

**LAU-O — OPEN at kickoff: where adapters live.** (a) `products/launch/providers/<slot>/<name>.mjs`
inside arc; (b) a separate `arc-launch-providers` repo pinned by digest, so no provider SDK enters
the zero-dep OS repo. The kickoff session reads the dependency reality (is every initial candidate
reachable by `fetch` + its CLI?) and records an ADR. Until answered, the `zero-dep-leg` lint fails
any adapter that imports a package.

**LAU-P — Day-N re-verify is a ₹0 script-class scheduler job.** One `hq.jobs.yaml` row per venture,
weekly, `verify --all`, LLM-free, browser-free (OPS-G posture).

**LAU-Q — Slots carry a tier and a condition.** `tier: core | required | optional`. `core` = what
v1 must prove on the rehearsal venture (33). `required` = what a real venture must have before
`payment-live` (35, Cycle 2). `optional` = `optional_for[]` types (17). `required_when:` is a
predicate over the profile (`payment_model != none`, `ai == true`, `region == in`,
`tenancy == multi`); a slot whose predicate is false renders `skipped (<predicate>)`. **The lint
forbids a `depends_on` edge from a `core` slot to a non-core slot** — the steel thread may never
need Cycle 2 to close.

**LAU-R — The runner is durable and resumable.** State per venture in
`.claude/state/launch/<slug>.json` (instance-only, never synced, ADR-0022's reasoning). Slot states:
`pending → planned → awaiting-approval → applying → applied → verified`, with `failed(reason)` and
`skipped(predicate)` as terminals that `apply` may re-enter. Idempotency key
`venture@slot@provider@attempt`; `attempt` increments on each `apply` of a non-verified slot.
`apply` takes the spine's `withLock` on the venture — one apply at a time, a second refuses.
Each slot declares `timeout` (seconds) in the slots file; expiry = `failed(timeout)` with whatever
resource ids `scaffold()` reported so far, so `teardown --plan` can name them. A gate pauses in
`awaiting-approval`; the inbox decision resumes it. A missing env key is `failed(env:<KEY>)` and
never a prompt for the value.

**LAU-S — The adapter trust boundary is in the schema and enforced at run time.** Every row carries
`hosts[]` (the only hosts the adapter may call — `adapter-lint` wraps `fetch`), `digest` (sha256 of
the adapter file written at vet; a mismatch at load flips `status` to `candidate` and refuses to
run), `credentials.scope` (the least-privilege scope the vet confirmed; informational, named in the
approval text), and `sensitive_actions[]` (e.g. `purchase`, `dns-change-live`, `key-rotate`,
`delete`) — each emits `approval.requested` and pauses before the adapter proceeds. File writes are
confined to the venture repo root plus the state file; anything else is refused.

**LAU-T — `payment` is two slots.** `payment-test` (tier `core`, test mode, depends on
`checkout-portal` and `webhooks-ledger` only, emits `revenue.simulated`) and `payment-live` (tier
`required`, Cycle 2, `depends_on: [payment-test, legal-pages, invoices-gst, refunds]`, approval
gate 3). The v1.0 contradiction between phase order and the activation checklist is gone because
the dependency is now written where the machine reads it.

---

## The three layers

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3 — RECOMMENDATION (derived)                                                    │
│   fit rules × venture.yaml × provider rows  →  ranked, reasoned, refusable           │
│   v2: + receipts (incidents · spans · cost)  ·  tie → council  ·  override = receipt  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ LAYER 2 — PROVIDERS (dynamic)   launch.providers.yaml  +  providers/<slot>/<name>.mjs │
│   candidate → vetted → retired|blocked · owner-only · digest-pinned · hosts-confined   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ LAYER 1 — PROCESS (fixed)        launch.slots.yaml                                    │
│   11 groups · 85 slots · tier · exit criteria · verify · depends_on DAG · gates      │
└──────────────────────────────────────────────────────────────────────────────────────┘
     runner: .claude/state/launch/<slug>.json · withLock · idempotency key · resume
     arc launch  new · plan · apply <slot> · verify · status · teardown --plan
```

A change at Layer 2 or 3 never touches Layer 1. A change at Layer 1 (a new slot) is an ADR.

---

## The slot catalog — 11 groups, 85 slots (v1.1 seed; the slots file is the truth)

**Tier:** **C** = core (v1, this cycle) · **R** = required before `payment-live` (Cycle 2) ·
**O** = optional (`optional_for`). *Initial candidate* = the provider the kickoff session proposes
as the first `candidate` row for each slot; **nothing here is vetted by being listed**, and the
word *default* does not appear in this catalog on purpose (LAU-C).

Seed counts (derived at P00 by `launch-coverage`, which overrides this line): **85 slots · 33 C ·
35 R · 17 O**. For a `saas-b2b · in · gateway · multi · ai` profile, all 68 core+required slots apply and the optional ones render as `skipped` unless the owner opts in.

### 1 · Identity & presence
| Slot | Tier | Initial candidate | Alternatives | Exit proof (verify) | depends_on |
|---|---|---|---|---|---|
| `domain` | C | Cloudflare Registrar | Namecheap · Porkbun | registered, WHOIS privacy; **approval gate 1**. Rehearsal: refusal path + `--dry-run` only | — |
| `dns` | C | Cloudflare, grey cloud (ADR-1118 lesson) | Route 53 · Vercel DNS | resolves from `8.8.8.8` and `1.1.1.1` | domain |
| `tls` | C | hosting-managed | Let's Encrypt | scanner grade ≥ A; HSTS | dns, hosting |
| `email-transactional` | C | Resend | Postmark · SES · Brevo | SPF/DKIM/DMARC live, `p=quarantine`; probe `dkim=pass` (leads `preflight.mjs`) | dns |
| `email-inbox` | R | Google Workspace | Zoho · Fastmail | send + receive probe | dns |
| `email-outbound-domain` | O: saas-* | `mail.<domain>` warmed ≥14 d | — | warm-up log | email-transactional |
| `brand-kit` | R | design lane output | — | critic score ≥ 8 receipt | — |

### 2 · Code & delivery
| Slot | Tier | Initial candidate | Alternatives | Exit proof | depends_on |
|---|---|---|---|---|---|
| `repo` | C | GitHub private · protection · CODEOWNERS · arc root-mode | GitLab | `/arc` green inside the venture | — |
| `ci` | C | GitHub Actions: arc-scan · tests · typecheck · lint · build | — | required checks on, 3 legs green | repo |
| `environments` | C | dev · preview · prod | — | preview URL per PR | hosting |
| `hosting` | C | Vercel | Cloudflare Workers · Railway · Fly | git-triggered deploy with `githubDeployment: 1` | repo |
| `secrets` | C | hosting env store + generated `.env.example` + gitleaks | Doppler · 1Password CLI | contract lint; no key in git; owner places keys | hosting, ci |
| `feature-flags` | O: saas-* | env-driven flags | PostHog · Unleash | one flag toggles one route | frontend |
| `release` | C | `/arc-ship` + CHANGELOG + semver | — | tag → deploy receipt | ci, hosting |

### 3 · Application stack
| Slot | Tier | Initial candidate | Alternatives | Exit proof | depends_on |
|---|---|---|---|---|---|
| `frontend` | C | Next.js App Router · Tailwind v4 · shadcn | Remix · SvelteKit · Astro | Lighthouse ≥ 90 ×4 | repo |
| `backend` | C | Next route handlers + server actions | Hono · NestJS | zod contract; `/health` | frontend |
| `database` | C | Supabase Postgres · RLS · migrations | Neon · PlanetScale · Turso | up/down fixture; **RLS denies unless a policy grants** | secrets |
| `orm` | C | Drizzle | Prisma · Kysely | typed schema generated | database |
| `storage` | O | Supabase Storage | R2 · S3 | signed-URL probe | database |
| `jobs` | O | Inngest | Trigger.dev · pg-boss · QStash | retry + dead-letter | backend |
| `cache-ratelimit` | R | Upstash Redis | Vercel KV | a 429 observed | backend |
| `search` | O | Postgres FTS | Typesense · Meilisearch | — | database |
| `realtime` | O | Supabase Realtime | Pusher · Ably | — | database |
| `document-gen` | O: saas-* | react-pdf / Playwright PDF | — | PDF renders | backend |
| `i18n-locale` | O | next-intl · ₹/IST for `region: in` | — | — | frontend |

### 4 · Users
| Slot | Tier | Initial candidate | Alternatives | Exit proof | depends_on |
|---|---|---|---|---|---|
| `auth` | C | Supabase Auth — magic link + Google | Clerk · Better Auth · Auth0 | login → session → logout | database, email-transactional |
| `authz` | C | roles + RLS policies | CASL · Permit | **cross-tenant 403** | auth |
| `tenancy` | C (`tenancy == multi`) | org/workspace + invite | — | invite → join → scoped | authz |
| `onboarding` | R | first-run checklist, empty states | — | `activated` event | tenancy |
| `account` | R | profile · org · billing · API keys · delete | — | delete = purge probe | tenancy |
| `sessions` | O | list + revoke | — | — | auth |

### 5 · Money (`required_when: payment_model != none`, except `ledger-source` in §11)
| Slot | Tier | Initial candidate | Alternatives | Exit proof | depends_on |
|---|---|---|---|---|---|
| `plans` | C | `plans.yaml` → entitlement gates | metered | downgrade blocks a gated route | authz |
| `checkout-portal` | C | provider-hosted checkout + portal | — | portal probe (test mode) | plans, payment-test |
| `payment-test` | C | **Razorpay** (`in · gateway`) / **Dodo** (`global · mor`) by profile | Creem · Paddle · Lemon Squeezy | **test-mode purchase + refund e2e** | secrets, backend |
| `webhooks-ledger` | C | provider webhook → ledger PII validator → `revenue.simulated` / `revenue.received` | — | round-trip receipt; replay = one event | payment-test |
| `refunds` | C | code path + ledger link rule (+ legal page in C2) | — | refund nets in `arc pnl` | webhooks-ledger |
| `payment-live` | R | same provider, live keys | — | **approval gate 3**; activation checklist green | payment-test, legal-pages, invoices-gst, refunds |
| `pricing-page` | R | generated from `plans.yaml`, INR + USD | — | one price, one tier at launch | plans |
| `invoices-gst` | R (`region == in`) | GST PDF — GSTIN · HSN/SAC · place of supply | Zoho Books | validates against fixture | webhooks-ledger |
| `dunning` | R | retry schedule + emails | — | fixture | payment-live |
| `trials-coupons` | O | 14-day trial · coupons | — | — | plans |
| `usage-metering` | O (`ai == true`) | per-tenant usage → `cost.incurred` | — | over-limit soft block | llm-gateway |

### 6 · Trust, legal, security
| Slot | Tier | Initial candidate | Alternatives | Exit proof | depends_on |
|---|---|---|---|---|---|
| `legal-pages` | C | legal lane's seven-page set (facts for the rehearsal venture are **fixture facts**, rendered `rehearsal`) | — | `legal.publish` receipt or **ABSENT: legal renderer not ready** | frontend |
| `security-headers` | C | CSP · HSTS · X-Frame · Referrer · Permissions-Policy | — | headers read live, grade A | hosting |
| `dependency-scan` | C | arc-scan + Dependabot | Snyk | CI gate | ci |
| `consent-dpdp` | R (`region == in`) | banner · consent log · grievance page | Cookiebot | consent row written | frontend |
| `app-security` | R | CSRF · zod · rate limit · SSRF guard · upload checks | — | OWASP fixture set | backend |
| `privacy-ops` | R | export · delete · PII tags | — | export + delete probe | account |
| `bot-abuse` | R | Turnstile | hCaptcha | — | auth |
| `audit-log` | O: saas-b2b | per-org action log | — | — | tenancy |
| `mfa` | O | TOTP | — | — | auth |

### 7 · Observability
| Slot | Tier | Initial candidate | Alternatives | Exit proof | depends_on |
|---|---|---|---|---|---|
| `errors` | C | Sentry (client + server, release tags) | GlitchTip · Highlight | fixture error → issue | hosting |
| `logs` | R | Axiom via hosting drain | Betterstack · Grafana Cloud | one request id end to end | hosting |
| `uptime` | R | ops sweep (₹0) + `/arc-canary` | Betterstack | drill incident | hosting |
| `product-analytics` | R | PostHog → `metric.observed` | Mixpanel · Amplitude | funnel visit→signup→pay visible | frontend |
| `web-analytics` | R | PostHog web | Plausible · Umami | pageview reaches sink | frontend |
| `performance` | R | Speed Insights + Lighthouse CI | — | budget gate | ci |
| `alerts-spine` | R | webhook → `incident.raised` / brief line | — | test alert in brief | errors |
| `session-replay` | O | PostHog replay, consent-gated | — | — | consent-dpdp |

### 8 · Data safety
| Slot | Tier | Initial candidate | Alternatives | Exit proof | depends_on |
|---|---|---|---|---|---|
| `backup` | C | provider PITR **+** nightly `pg_dump` to R2 (separate account) | — | dump + checksum | database |
| `restore-drill` | C | restore to scratch, row counts compare | — | **restore receipt** (LAU-I) | backup |
| `migration-rollback` | C | down migrations in CI | — | fixture | orm, ci |
| `retention` | R | per-table policy + purge job | — | purge probe | database |
| `schema-parity` | R | prod schema == migrations | — | zero drift | orm |

### 9 · Growth & support
| Slot | Tier | Initial candidate | Alternatives | Exit proof | depends_on |
|---|---|---|---|---|---|
| `seo-baseline` | R | sitemap · robots · canonical · OG · JSON-LD · `INDEXABLE` | — | GSC verified, sitemap submitted | frontend, dns |
| `content-route` | R | `/blog` MDX + growth per-site config | — | first `content.published` | seo-baseline |
| `landing-waitlist` | R | waitlist → launch flip | — | lead in private store (LEA law) | frontend |
| `lifecycle-email` | R | welcome · drip · trial-end · win-back | Loops · Customer.io | `email.sent` receipts | email-transactional |
| `support-inbox` | R | `support@` → ops drafts (L1) | Plain · Crisp | ticket → draft receipt | email-inbox |
| `launch-kit` | R | PH/HN/LinkedIn drafts + `PLAN-cycle3` Week-3 checklist | — | checklist rendered, owner-approved | brand-kit |
| `changelog-status` | O | `/changelog` MDX · status page | — | — | frontend |
| `feedback` | O | widget → `idea.captured` | Canny | — | frontend |

### 10 · AI layer (`required_when: ai == true`)
| Slot | Tier | Initial candidate | Alternatives | Exit proof | depends_on |
|---|---|---|---|---|---|
| `llm-gateway` | R | OmniRoute → model-policy tiers | OpenRouter · Vercel AI Gateway | key swap = model swap | secrets |
| `prompt-evals` | R | Langfuse | Braintrust | trace per request | llm-gateway |
| `ai-cost-metering` | R | tokens → `cost.incurred` | — | `arc pnl` shows AI cost | llm-gateway, ledger-source |
| `guardrails` | R | validation · PII redaction · injection containment | — | hostile fixture set | llm-gateway |
| `eval-gate` | R | golden set in CI; regression blocks deploy | — | planted regression blocks | ci, prompt-evals |
| `document-ingest` | O | PDF/XLSX parsing | Unstructured · LlamaParse | fixture parse | storage |

### 11 · arc wiring (LAU-K)
| Slot | Tier | What | Exit proof | depends_on |
|---|---|---|---|---|
| `passport` | C | `venture-register` → PORTFOLIO + `ventures.yaml` (rehearsal: `--dry-run`) | approved receipt / dry-run output | — |
| `ledger-source` | C | webhook + cost feeds registered with ledger | first ingest receipt | webhooks-ledger |
| `face-room` | C | venture in the Launch room (`planned` allowed in v1) | `face-coverage` green | — |
| `teardown-plan` | C | `teardown --plan` rendered | plan file + receipt | (all applied slots) |
| `team-manifest` | R | org `team.yaml` | `org.team` digest valid | passport |
| `ops-row` | R | ops registry row | row **or ABSENT: ops not born** | passport |
| `growth-config` | R | growth per-site config | `mine` reads the site | content-route |

---

## The steel-thread DAG (the 33 core slots; full 85-slot graph lives in `launch.slots.yaml` at P00)

```
domain ─► dns ─┬─► tls (also ◄─ hosting)
               └─► email-transactional ─► auth
repo ─┬─► ci ─┬─► dependency-scan
      │       ├─► migration-rollback (◄─ orm)
      │       └─► secrets (◄─ hosting)
      ├─► hosting ─┬─► environments
      │            ├─► release (◄─ ci)
      │            ├─► security-headers
      │            └─► errors
      └─► frontend ─┬─► backend ─► database (◄─ secrets) ─► orm
                    │                 │
                    │                 ├─► backup ─► restore-drill
                    │                 └─► auth ─► authz ─► tenancy ─► plans ─► checkout-portal
                    └─► legal-pages                        payment-test ─┘      │
                                                                ▼              │
                                                         webhooks-ledger ◄──────┘
                                                                ▼
                                                             refunds ─► ledger-source
passport ─► (board) · face-room · teardown-plan ◄── every applied slot

Day-3 kill set (9): dns · tls · repo · ci · hosting · environments · secrets · frontend · release
   → "a page serves on sandbox.automemory.ai from a git-triggered deploy"
Approval gates on this graph: gate 2 at the first prod deploy (release) · gate 1 and gate 3
   exercised through their refusal paths (rehearsal buys nothing, goes live with nothing)
```

Lint rules over the graph: acyclic · every edge resolves · no `core` → non-core edge · every
`sensitive_actions[]` entry sits on a slot that declares `approval: true`.

---

## The venture profile — `venture.yaml`

```yaml
# venture.yaml — the only input `arc launch` reads (LAU-J). Block style only (ADR-0200).
slug: arc-sandbox
type: saas-b2b            # saas-b2b | saas-b2c | api-product | content-site
region: in                # in | global
payment_model: gateway    # gateway | mor | none   (legal lane's ADR-1011 vocabulary)
tenancy: multi            # single | multi
ai: false                 # the rehearsal venture has no AI layer; §10 is Cycle 2
honesty_class: rehearsal  # real | rehearsal — stamped on every receipt this venture emits
compliance:
  - dpdp
  - gst
brand:
  name: arc sandbox
  domain: sandbox.automemory.ai   # subdomain of an owned domain; no purchase gate
```

A **real** venture's profile arrives from `PLAN-discover.md`'s verdict (or the owner's hand) with
`honesty_class: real`; nothing else in the process changes.

---

## The provider registry — `launch.providers.yaml` (shape, with the LAU-S trust fields)

```yaml
# launch.providers.yaml — which tool may fill which slot, for which ventures, under what status.
# OWNER-ONLY BIRTH (LAU-B). status = intent · last_verified = observed, runner-written (ADR-1408).
providers:
  - id: razorpay
    slot: payment-test                 # one row per slot; payment-live is its own row
    status: candidate                  # candidate | vetted | retired | blocked
    fits:
      - saas-b2b
      - saas-b2c
    region: in
    payment_model: gateway
    cost_model: "per-transaction % — read the current rate at vet"
    env_keys:
      - RAZORPAY_KEY_ID
      - RAZORPAY_KEY_SECRET
      - RAZORPAY_WEBHOOK_SECRET
    hosts:                             # LAU-S: the only hosts the adapter may call
      - api.razorpay.com
    credentials:
      scope: "test-mode keys; webhook secret; no payout or settlement scope"
    sensitive_actions: []              # payment-live's row lists: [enable-live-keys]
    adapter: providers/payment-test/razorpay.mjs
    digest: null                       # sha256 of the adapter, written at vet; drift → candidate
    approved_by: ashiq
    vetted_by: null                    # decision.recorded id once vetted (LAU-E)
    last_verified: null
  - id: stripe
    slot: payment-test
    status: blocked
    reason: "India new-account onboarding assumed closed (master plan §5) — re-verify before unblocking"
    approved_by: ashiq
```

## The adapter contract — `providers/<slot>/<name>.mjs` (LAU-D, LAU-R, LAU-S)

```js
export const id = "razorpay";
export const slot = "payment-test";
export async function scaffold(ctx)   { /* check-then-create; return { files, resources: [{kind,id}], notes } */ }
export function envContract()         { return ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"]; }
export async function verify(ctx)     { /* a probe: test purchase → webhook → ledger validator → {ok, evidence}|{ok:false, reason} */ }
export async function teardown(ctx)   { /* ordered exit steps for the plan, naming ctx.resources; v1 renders only */ }
```

`ctx` carries the profile, the board, the repo root, the slot's recorded `resources[]` (for
resume), a `fetch` **wrapped to the row's `hosts[]`**, a file writer **confined to the repo root**,
and a receipt emitter. Nothing else.

## How a tool is added later — three steps, no lane re-open

1. **Row** in `launch.providers.yaml` as `candidate`, with `hosts[]` and `sensitive_actions[]`
   (owner writes it — LAU-B).
2. **Adapter** file with the four functions. `launch-lint` fails until both exist.
3. **Vet:** `/arc-capability` scout → `arc launch verify <slot> --provider <id>` passes on a real
   board → `decision.recorded` → row flips to `vetted`, `digest` and `vetted_by` written.

**How a slot is added later:** a row in `launch.slots.yaml` (with tier, exit criteria, verify,
depends_on, gate, timeout, resume) **plus an ADR** plus at least one provider row — or the lint
fails `slot-without-provider`.

---

## How a venture is born — the owner makes the picks and signs the gates

```
venture.yaml ──► arc launch new ──► board (85 slots → tier/predicate resolved → state file)
      │
      ▼
arc launch plan ──► per slot: recommended · why · alternatives · REFUSED
      │                               (picks accepted or overridden → decision.recorded)
      ▼
arc launch apply <slot> … in DAG order; each: lock → check-then-create → receipt → state
      ⏸ gate 1 domain purchase (real venture only)      ⏸ gate 2 first prod deploy
      ⏸ gate 3 payment-live keys (Cycle 2 / real venture only)
      ✖ failed(reason) → fix → apply again resumes from recorded resources
      │
      ▼
arc launch verify --all ──► board 100% verified | skipped(predicate) | ABSENT(reason)
      │
      ▼
arc launch teardown --plan  (refreshed on every apply; the kill line points here)
```

Price, launch date and customer-facing copy belong to the venture's own root-mode `/arc-kickoff`
and to E2 — `launch` scaffolds the pricing page from `plans.yaml`, it never sets the number.

---

## Phases — v1 (risk-ordered; appetites are ceilings)

| # | Phase | Appetite | Exit |
|---|---|---|---|
| 00 | **Contracts + registry + lint + runner state** — `launch.slots.yaml` (85 rows, tiers, predicates, full DAG), `launch.providers.yaml` schema with LAU-S fields, `venture.yaml` schema, adapter contract + `adapter-lint` (imports, hosts, write-root), `launch-lint` FAIL-FROM-BIRTH with `--mutant-selftest` (10 mutants incl. cycle, core→non-core edge, `default` word, digest drift), `launch-coverage` via face-coverage walkers, runner state model + `withLock` + idempotency key (fixtures: kill-mid-apply resume, concurrent refuse, timeout), `products/launch` manifest, LAU-O answered, `/arc-change` for the policy row | 2.5 d | REQ-01, REQ-02 (state fixtures), REQ-09 (lint half) |
| 01 | **Steel thread on `arc-sandbox`** — CLI six verbs; adapters + vet for dns · tls · repo · ci · hosting · environments · secrets · frontend · release → **day-3 kill: a page serves on the subdomain from a git-triggered deploy**; then backend · database · orm · auth · authz · tenancy · email-transactional; gate 2 exercised for real; `domain` through refusal + dry-run | 5 d | REQ-03; login on the prod URL; receipt per slot, all `rehearsal` |
| 02 | **Money, test mode** — plans · payment-test (Razorpay test) · checkout-portal · webhooks-ledger (`revenue.simulated` through the ledger validator) · refunds · ledger-source; gate 3 **exercised, not crossed** | 3 d | REQ-04; `arc pnl` labelled simulated line; **50% tripwire** |
| 03 | **Trust + data minimum** — legal-pages (legal lane renderer with fixture facts, or ABSENT) · security-headers · dependency-scan · errors · backup · **restore-drill** · migration-rollback | 2 d | REQ-06 probes green; restore receipt |
| 04 | **Recommendation v1 + REQ-08 + trust runtime + wiring + drift + teardown** — fit-rule engine and `plan` reasons; override receipt; **second provider by row + adapter only** with the CI file-list check; digest-drift / hosts / write-root / sensitive-action fixtures live; passport dry-run · face-room (`planned`) · `teardown --plan`; weekly `verify --all` job | 2 d | REQ-05, 07, 08, 09, 10, 11 |
| 05 | **Close** — `verify --all` 100% on `arc-sandbox`; wiki regenerated; two-surface adversarial pass (author ≠ attacker); evidence bundle; REQ-12 recorded OPEN; Cycle 2 kickoff prompt confirmed against what P00–P04 learned; `/arc-retro` | 1 d | cycle closed |

**Total 15.5 d / cap 18 d.** Cut order if the tripwire fires at the Phase 02 exit: `refunds`
→ Cycle 2 · `errors` → Cycle 2 · `migration-rollback` → Cycle 2 · REQ-08's second provider →
Cycle 2 (its CI contract still ships) · `face-room` stays `planned`. **Never cut:** the restore
drill, the three gate paths, the runner state fixtures, `verify-is-probe`, the `default-word` lint.

**Day-3 kill question (Phase 01):** *does `sandbox.automemory.ai` serve a page from a
git-triggered deploy, with nine `run.completed` receipts and a state file that resumes?* If not,
STOP and record the finding — the slot contract is wrong before auth or money is written on it.

## Phases — launch Cycle 2 (sketch; cut properly at its own kickoff from this file)

| # | Phase | Scope | Est. |
|---|---|---|---|
| C2-00 | Users + money-live | onboarding · account · pricing-page · invoices-gst · dunning · **payment-live** (gate 3 crossed only by a real venture) | 3 d |
| C2-01 | Trust + observability | consent-dpdp · app-security · privacy-ops · bot-abuse · logs · uptime · product-analytics · web-analytics · performance · alerts-spine · retention · schema-parity · cache-ratelimit | 3.5 d |
| C2-02 | Growth + support | brand-kit · email-inbox · seo-baseline · content-route · landing-waitlist · lifecycle-email · support-inbox · launch-kit · team-manifest · ops-row · growth-config · `content-site` template proven on arc's own site | 3.5 d |
| C2-03 | AI layer | llm-gateway · prompt-evals · ai-cost-metering · guardrails · eval-gate | 2.5 d |
| C2-04 | Recommendation v2 + room | receipt weighting behind its trigger · Launch room live through the WORK door · `teardown --apply` behind gates | 2.5 d |

Cycle 2 estimate ~15 d; re-estimated at its kickoff with Cycle 1's measured per-slot cost.

---

## No-gos (v1)

- **No default provider anywhere** — not in code, not in the slots file, not in a template, not
  as a word (LAU-C).
- **No business logic in adapters** (LAU-D); no `migrateFrom()` (LAU-G).
- **No real money, no real domain purchase, no live payment keys.** The rehearsal venture buys
  nothing and goes live with nothing; gates 1 and 3 are exercised through refusal paths.
- **No `honesty_class: real` receipt from `arc-sandbox`** — every one is `rehearsal`; the face
  never co-renders them with real (FACE honesty law); `arc pnl` labels the simulated line.
- **No new spine kinds** (LAU-H).
- **No hand-written PORTFOLIO row**; passport only through `venture-register`.
- **No price setting, no launch date, no customer-facing copy published.**
- **No scanning the market for tools on a schedule** (absorb two-speed ruling).
- **No merging** — every publish is a PR; the machine never merges (A6).
- **No rebuilding** legal pages, content engine, mail preflight, ledger validators, team
  manifests or the register. Call them.
- **No Cycle 2 slot in Cycle 1** — the `core` → non-core edge lint is the enforcement.

---

## Rabbit holes (named detours)

1. **"Just one small default for the database."** Refuse. One vetted provider per slot is the
   honest v1 state and is enough.
2. **A universal adapter SDK.** Four functions and a `ctx`. Abstractions over provider APIs beyond
   that are the 12-way split rejected at solo scale.
3. **Terraform / Pulumi for everything.** Fine *inside* an adapter that needs it; a lane-wide IaC
   layer is a second product. Out.
4. **A workflow engine for the runner.** A state file, a lock, an idempotency key and a DAG walk
   are the whole runner. Temporal-class machinery is the rabbit hole the spine already avoided.
5. **Perfecting recommendation before the second provider exists.** Fit rules only; v2 has a
   trigger.
6. **Building ops inside launch** because ops is unborn. Record ABSENT; ops is born by its own
   kickoff.
7. **A GUI wizard first.** CLI is the contract (ADR-0024); the room renders the board and exposes
   `apply` through the two-phase door in Cycle 2.
8. **Inventing a venture to make the dogfood feel real.** The owner said there is no idea; a
   rehearsal venture that says so is the honest fixture. A fake venture with a fake price is
   `revenue.simulated` dressed as a business.

---

## Assumptions ledger (cap 8 — each with a falsification trigger)

| # | Assumption | If false… | Trigger / check |
|---|---|---|---|
| 1 | Every core initial candidate is reachable by `fetch` + its CLI without an SDK in the OS repo | LAU-O flips to (b) | kickoff dependency read; `zero-dep-leg` lint |
| 2 | Razorpay test mode completes a purchase and fires webhooks **before** activation pages are live | `payment-test` gains `depends_on: legal-pages` by ADR and Phase 03 moves ahead of 02 | read test-mode docs at kickoff; probe on day 1 of Phase 02 |
| 3 | Supabase PITR is available on the plan the rehearsal venture runs on | `backup` = nightly dump only; PITR = alternative row | plan tier at vet |
| 4 | The legal renderer accepts fixture facts for a rehearsal venture without lane changes | `legal-pages` = ABSENT in v1 with the reason; Cycle 2 carries it | legal PROGRESS at kickoff |
| 5 | A subdomain of `automemory.ai` can host the rehearsal without disturbing the growth site's DNS/robots | use a second owned domain or buy a ₹-cheap `.in` under gate 1 for real | growth lane DNS read at kickoff |
| 6 | A second provider for REQ-08 can be vetted in ≤0.5 d | REQ-08 ships the CI contract + a fixture provider; the real one is Cycle 2 | Phase 04 clock |
| 7 | The face v2 room contract is stable through Cycle 16 Phase 08 | Launch room stays `planned` | face PROGRESS at kickoff |
| 8 | 85 slots is the right grain; no slot is really two | the slots file splits it by ADR; the count is derived, never a target | Phase 01 steel thread |

---

## Pre-mortem — top 7, seeded from this repo's own history

| # | Failure | Guard |
|---|---|---|
| 1 | **Verify reads the config it just wrote and calls it done** — the C7 evidence that asserted a directory that never existed | LAU-I; `verify-is-probe` lint; every probe names the external thing that answered |
| 2 | **A default sneaks in as "temporary"** | LAU-C refusal tested by mutant; `default-word` lint; no-go #1 |
| 3 | **Business logic lands in an adapter** | `adapter-lint`; REQ-08 falsifies the swap with a real second provider |
| 4 | **The board says 100% and the venture does not serve** — the true-assertion-outlives-conclusion class (bench's green pin) | day-3 kill is a URL in a browser; `verify --all` is the exit, `status` is a view |
| 5 | **A crashed apply leaves a provider resource nobody knows about** | LAU-R: `scaffold()` reports `resources[]` *before* returning; state written per resource; `teardown --plan` names them |
| 6 | **Secrets in the repo on the first scaffold commit** | gitleaks in the venture CI from commit one; `.env.example` lint; LAU-M |
| 7 | **A stale count in the design source** — this file's own v1.0 said 48 slots with 84 in its tables; the README said six products with 17 | counts derived by `launch-coverage`; every number in this file is labelled a seed; sweep sibling worktrees for the band |

---

## External evidence (as of 2026-10-03; every row re-checked at kickoff and at vet)

- **Razorpay** activation set: seven pages per the legal lane's ADR-1001. Test mode exists;
  pre-activation webhook behaviour is assumption #2.
- **Stripe India** new-account status: assumed closed in July (master plan §5); **unverified
  since** — row is `blocked` with that reason.
- **Dodo Payments / Creem / Paddle** as MoR for a solo Indian seller: the master plan's shortlist;
  fees and payout terms **not re-verified here** — the vet reads them.
- **Vercel ↔ GitHub** git-triggered deploy: proven by growth 2026-08-14 (`githubDeployment: 1`).
- **Cloudflare proxy vs managed `robots.txt`**: growth's un-proxy lesson (2026-08-17) → grey cloud.
- **DMARC `p=quarantine`** live on `automemory.ai` (leads Phase 03 gate); the rehearsal subdomain
  inherits the org domain's policy unless a subdomain policy is set — check at `email-transactional`.
- **PostHog** covers product + web analytics; slots stay separate because a venture may split them.
- **Supabase PITR** is plan-dependent (assumption #3).

---

## Gates at kickoff (checked in-file before the prompt is pasted)

1. **Owner ruling receipts** — the 2026-10-03 "pannu" and the same-day "no Nilluvai / rehearsal
   venture" ruling go on the spine as `decision.recorded` in Phase 0; every kickoff ADR cites them.
2. **WIP acknowledged** — face, growth, leads, legal, design, bench, scheduler are LIVE; A9 is
   informational (ADR-0052). Say the number.
3. **Century claim** — sweep sibling worktrees and remote branches for ADR ≥ 1700, then claim.
4. **Rehearsal domain read** — `automemory.ai` DNS and robots state from the growth lane;
   subdomain feasibility (assumption #5).
5. **Legal lane state read** — renderer available for fixture facts or not (assumption #4).
6. **LAU-O answered** from the dependency read (assumption #1).
7. **Face room contract read** — FV2-C / FV2-I; Launch room `planned` or live (assumption #7).
8. **`hq.policy.yaml` row** for `process:launch` drafted for the first emission's change.
9. **`PLAN-cycle3-venture-launch.md` read** — Week-1/2 content folds into §5 and §9 slots; Week-3 is
   `launch-kit`'s checklist. **Not archived by this drop**; fold decided at the Cycle 2 retro.
10. **Review adjudication acknowledged** — the eight rulings above are part of the design source;
    the kickoff PLAN cites them where a REQ or decision changed because of one.

---

## Relationship to other plans

- **`PLAN-cycle3-venture-launch.md`** — the one-venture launch runbook. `launch` is the machine
  that runs it; the runbook stays as `launch-kit`'s Week-3 checklist. **NOT superseded.**
- **`PLAN-discover.md`** — upstream: with no venture idea on the table, discover is how a
  `venture.yaml` with `honesty_class: real` arrives. Not a prerequisite for v1.
- **`PLAN-legal-pack.md` · `PLAN-growth.md` · `PLAN-leads.md` · `PLAN-ledger.md` · `PLAN-org.md` ·
  `PLAN-ops.md` · `PLAN-design-v2.md`** — called, never re-implemented. A hook they do not expose
  (a live payment webhook into the ledger validator, for one) is filed through `/arc-change` on
  *that* lane and consumed here.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (after the gates above clear)

> Read `docs/strategy/plans/PLAN-launch.md` end to end — including §Review adjudication — before
> doing anything, then run
> `/arc-kickoff "the venture factory: one fixed process of capability slots with exit proofs and a
> DAG, every tool a pluggable vetted provider chosen by derived recommendation, a durable resumable
> runner, and a rehearsal venture scaffolded subdomain-to-test-purchase with a receipt per slot"
> --lane launch`.
>
> Write PLAN.md and PROGRESS.md, then **stop and wait for my approval before any code.**
>
> These are locked and must appear in the PLAN you write:
>
> 1. **LAU-A** — slots are contracts in `launch.slots.yaml` (tier, exit criteria, verify,
>    depends_on, gate, approval, timeout, resume, required_when, optional_for); tools are rows in
>    `launch.providers.yaml`. A slot never names a tool; a row never redefines exit criteria.
> 2. **LAU-B / LAU-C** — rows are owner-only (`approved_by` linted); zero vetted providers =
>    **REFUSED** (`plan` prints it, `apply` exits 2); the word `default` fails the lint in both
>    YAML files and in adapter code.
> 3. **LAU-D / LAU-S** — adapters are four functions (`scaffold · envContract · verify · teardown`)
>    with no business logic; `scaffold()` is check-then-create and reports `resources[]`;
>    `adapter-lint` enforces the import boundary, the row's `hosts[]` on every outbound call, and
>    the repo-root write confinement; the adapter `digest` is pinned at vet and drift flips the row
>    to `candidate`; every `sensitive_actions[]` entry emits `approval.requested` first.
> 4. **LAU-E** — `candidate → vetted → retired|blocked`; `vetted` needs a `/arc-capability` scout
>    record, one passing verify against the real provider, a `decision.recorded` id and the digest.
> 5. **LAU-F** — recommendation is fit rules × `venture.yaml` × rows, printed with rule ids;
>    receipt weighting is Cycle 2 behind its trigger; tie → council; override = `decision.recorded`.
> 6. **LAU-H** — zero new spine kinds; `run.completed process=launch@x.y.z` per slot with
>    `honesty_class` in the payload; three `approval.requested` gates (domain purchase · payment-live
>    keys · first prod deploy); the `hq.policy.yaml` row lands with the first emission.
> 7. **LAU-I** — verify is a probe something outside the repo answered; `backup` is verified only by
>    a restore with matching row counts; `verify-is-probe` lint.
> 8. **LAU-Q** — tiers `core | required | optional`; `required_when` predicates; **no `depends_on`
>    edge from a core slot to a non-core slot** (lint); the DAG is acyclic and every edge resolves.
> 9. **LAU-R** — durable state in `.claude/state/launch/<slug>.json`; the slot state machine as
>    written; idempotency key `venture@slot@provider@attempt`; `withLock` per venture; per-slot
>    timeout; fixtures for kill-mid-apply resume, concurrent refusal and timeout **in Phase 00**.
> 10. **LAU-T** — `payment-test` (core, test mode, `revenue.simulated`) and `payment-live`
>     (required, Cycle 2, depends on legal-pages / invoices-gst / refunds, gate 3). Gate 3 is
>     exercised through its refusal path this cycle and never crossed.
> 11. **LAU-J / LAU-K / LAU-M / LAU-N** — `venture.yaml` is the only input and carries
>     `honesty_class`; the wiring block runs last-but-one with receipt-or-named-ABSENT; secrets are
>     never fetched and never in the repo; `teardown --plan` is born with the venture and names
>     recorded resources.
> 12. **LAU-O** is yours to answer from the dependency read, recorded as an ADR; until then the
>     `zero-dep-leg` lint fails any adapter that imports a package.
> 13. **REQ-08** is the falsifier of "dynamic": a second provider reaches `vetted` with a diff that
>     touches only its row and its adapter file, asserted by CI over the PR file list.
> 14. The dogfood venture is the **rehearsal venture `arc-sandbox`** at `sandbox.automemory.ai`,
>     `honesty_class: rehearsal`, `ai: false`, no purchase, no live keys. **There is no Nilluvai in
>     this lane** — the owner ruled it out on 2026-10-03; a real venture arrives later through
>     `PLAN-discover.md` or the owner's hand.
> 15. Phase order is contracts+lint+runner → steel thread → money-test → trust+data minimum →
>     recommendation+REQ-08+trust-runtime+wiring+drift+teardown → close. Do not reorder. The day-3
>     kill question is: *does the subdomain serve a page from a git-triggered deploy with nine
>     receipts and a resumable state file?*
> 16. **REQ-12** (first real `revenue.received`) is recorded OPEN-at-first-venture in PLAN.md's
>     acceptance table from day one. Cycle 2's scope (§Success requirements — Cycle 2) is named in
>     PLAN.md as the next cycle, not as this one's stretch.
> 17. Claim ADR century **1700** from `PORTFOLIO.md`, **after sweeping sibling worktrees and remote
>     branches**.
>
> Appetite: 15.5 days effort, 18 cap. Phase 02 exit is the 50% tripwire; the cut order is in the
> design source §Phases.
