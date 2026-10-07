# PLAN (design source) — Policy Engine: enforced capability vectors

> **Freeze log:** BRIEF-policy.md (2026-07-22) analysed 2026-08-03 → three owner
> suggestion rounds adjudicated in chat (POL v0.2 → v0.3 → v0.4, owner approved each
> round) → **v1.0 2026-08-04, full plan draft — decisions POL-A..J locked; POL-K
> deliberately open until kickoff; real ADR numbers assigned at kickoff from this lane's
> century.** Drafted in chat 2026-08-04 over three owner-review rounds; landed in the
> tree the same day, **uncommitted — the owner branches/commits/PRs.** This drop also
> moved `BRIEF-policy.md` to `docs/archive/` (evolve/leads precedent) and updated both
> READMEs (plans ordering row + strategy file map/corrections).
>
> **v1.1 amendment 2026-10-07 — POL-L (evidenced levels), routed through `/arc-change
> --lane policy`.** Adds REQ-09, decision POL-L, Phase 5 and the cycle-2 kickoff prompt.
> v1.0's text is unchanged; everything POL-L adds is marked **v1.1**. Not a live phase spec:
> it builds only at `/arc-kickoff --lane policy` (cycle 2 of this lane — Cycle 9, phases
> 00–04, closed 2026-08-10).
>
> **Scope honesty:** this cycle delivers **runtime authority enforcement** — what an
> action may DO. It is NOT the scheduler (`BRIEF-scheduler.md` sleeps behind this as a
> hard dependent), NOT tool supply-chain vetting (`/arc-capability`, ADR-0110), and NOT
> model policy (C5, ADR-0063..0071 — which BRAIN a seat uses; this is what the HANDS may
> touch). Roadmap: **this policy cycle → scheduler → real L2/L3 operation.**
>
> **Trigger (pull):** ≥3 action kinds operating at ≥L2, **OR** the first
> scheduler/headless autonomous job is **APPROVED** (reworded from the brief's "lands" —
> a scheduler may not land before policy, by its own prerequisite).
> **Prerequisites:** spine (live since C2, closed vocabulary) · approval inbox (live) ·
> trial-ledger promotion culture (live) · `arc-run` headless runner (live since the
> engine cycle) · **constitution ADOPTED** — ✅ done 2026-08-06, v1.0, receipt
> `01KZ9V0QXNNMB3ZH18MSH8DKH3`. **Do not start while another lane holds the live slot** (A9).
>
> **Relationship to existing plans:** the engine's `arc-run` and the interactive hooks
> are the enforcement points this plan arms; the scheduler inherits enforcement for free
> ("budget + policy enforced identically to manual runs" is its REQ-3); the executor
> brief's "L1-drafts cap until the policy engine wakes" is POL-G's driver-eligibility
> contract seen from the other side. Zero scheduler code here.

## Goal

One sentence: autonomy stops being human discipline — `hq.policy.yaml` becomes
machine-enforced law: per action-kind capability vectors (read/write/shell/network/
message/publish/deploy/spend × L0–L3) under a two-key authority model (human-declared
ceiling + event-earned cap), deny-by-default, enforced **fail-closed** at the only
execution entry points (the `arc-run` wrapper headless, PreToolUse hooks interactive),
with promotions human-approved on trial-ledger evidence and demotions automatic on
incident — so the first unattended run is policed by code before that run exists.

## Current state (verified 2026-08-04 — re-verify at kickoff)

- Spine vocabulary is **31 kinds live** (`node` import of
  `.claude/scripts/hq/lib/validate.mjs` → `KINDS.length=31`): 22 (ADR-0107) + 8
  experiment kinds (ADR-0309) + `council.outcome` (ADR-0310). All counts below are
  stated as *live length + N* — hardcoded totals go stale (ADR-0107's own lesson).
- ~~`constitution.adopted` is **not in the vocabulary** and the Constitution is **still
  DRAFT**~~ — **RESOLVED 2026-08-06, ahead of kickoff.** The predicted two steps both ran:
  ADR-0073 added the kind (vocabulary 39 → 40, ADR-0026 extension) and the Constitution was
  adopted at v1.0, receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3`, pinning sha256 `233a6496…6ee6`. The
  hard kickoff gate this bullet describes is now OPEN. Three self-contradictions in the text
  were fixed first (#114): the amendment path named a kind that never existed, violations
  named another, and the file was not at the repo root its own Enforcement clause claims.
  **The other bullets in this section are still dated 2026-08-04 and drifted — see the
  kickoff re-verification before relying on any count here.**
- Constitution **E2 verbatim is five items**: moving money · killing a venture ·
  changing prices · unlocking real-money trading · publishing under Ashiq's name. The
  brief's "refunds" is not E2 text — it is subsumed under "moving money" (POL-B).
- `cost.incurred` payload is **not money-typed today** — the paise-integer +
  `^[A-Z]{3}$` currency rule applies only to `REVENUE_KINDS` (revenue.*). Those
  validators exist and are reused by the settlement profile (POL-F). First-party
  closed-shape asserts are an existing validator pattern (`assertDecision`).
- `promotion.proposed` **exists but is evolve's experiment-scoped kind** (ADR-0309) —
  policy never reuses it.
- Interactive PreToolUse hooks cover **only `Bash` and `Edit|Write`**
  (`.claude/settings.json` matchers). A static deny surface already exists
  (`permissions.deny`: git push -f, rm -rf, .env reads) — POL-H's fallback generalizes
  it. Whether PreToolUse can intercept every tool class is a **runtime property** — it
  cannot be grepped into certainty, hence REQ-01's feasibility matrix.
- **L0–L4 vs L0–L3 mismatch is real**: `arc-full-architecture.md:61,217` says L0–L4;
  the brief and org-blueprint (newer) say L0–L3. Same architecture doc: "Every automated
  capability starts WARN/L1 and climbs" — source of POL-C's L1-birth rule.
- `arc-run` is live (engine cycle) with a **thin permission surface** — its adversarial
  pass forged an `allowed-tools:` grant via frontmatter injection, and
  `permissions: declared` with only `ask.human` meant unrestricted. This plan is the
  hardening layer those findings call for.
- The 0300 ADR century is **owned by evolve** (ADR-0300..0311). This lane claims the
  next free century at birth.
- **Mode B is NOT certified** (concurrent emitters forbidden, ADR-0056); the spine
  `withLock` had a live duplicate-writer bug fixed in #89 — both feed REQ-06's fixtures.
- **No live cap-bearing module exists** (`PLAN-leads.md` is full-plan-ready but its
  trigger has not fired — its caps/suppression ledger will be the first real migration
  candidate). Today's cap inventory ≈ engine budgets, `router.yaml`, process
  `permissions:` blocks, council mode envelopes — so REQ-07 is birth-rule-first,
  migration-conditional.

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase | Status |
|---|---|---|---|---|
| REQ-01 | The policy file is law with a parser that cannot be talked past | `hq.policy.yaml` schema + `policy-lint` merged: closed capability set (8) × closed level enum (**L0–L3; L4 is a parse error**, supersession of arc-full-architecture recorded); canonical L0–L3 semantics table (POL-A); E2 five-item un-grantable list quoted **verbatim from the adopted constitution**, any E2 entry above L1 fails the file; deny-by-default (absent kind = read-only) asserted by fixture; **state-machine reducer** (`resolveEffectivePolicy`, POL-C) spec'd with its own fixture set incl. the cap-above-ceiling demotion case; **hostile corpus green**: unknown kind/capability, duplicate keys, contradictory grants, negative/overflow/decimal money, wildcard/IP-literal/encoded/private-net domains, shell injection, path traversal, symlink escape, unicode lookalikes, E2-at-L2/L3, invalid promotion evidence, forged promotion payloads — every one exits 2; **hook-interception feasibility matrix** delivered: per side-effect tool class, a fixture proving intercept+block, or an assigned fail-closed fallback (static deny / L0–L1 cap). Lint is a validator: FAIL from birth (spine strict-mode precedent, not a WARN-first case) | 0 | active |
| REQ-02 | A headless run cannot act outside its vector | Policy check integrated in `arc-run` **before any driver invocation**; effective authority = process-declared ∩ policy grant ∩ driver-safe set; denied action produces **no side effect**, emits `incident.raised`, and the same run's next authorization sees the demoted effective level (cap recomputed mid-run). **Capability fixture matrix**: denied write → file byte-identical; denied shell → process never starts; denied network → fake server logs zero requests; denied message → fake provider has zero send records; denied publish/deploy → fake publisher has zero releases; denied spend → zero provider calls. Bypass fixtures: direct driver invocation, nested shell, env injection, alternate driver path — all blocked | 1 | active |
| REQ-03 | Deny-by-default is proven, not promised | An action kind absent from the file can read and do nothing else — fixture per capability class; an empty policy file yields a fully read-only system, fixture-proven | 1 | active |
| REQ-04 | Authority changes are receipts with a deterministic state machine | Vocab ADR merged: **+4 kinds** on live `KINDS.length` (`policy.level.changed` · `policy.demoted` · `spend.reserved` · `spend.released`), unknown-kind hostile fixture re-run (ADR-0106 rule); **promotion chain live end-to-end**: `approval.requested` with the strict `subject: "policy.promotion"` profile (action_kind, from_level, to_level, trial_ledger_ref, policy_hash, correlation — unknown keys rejected, `assertDecision`-style) → human `decision.recorded` via inbox → `policy.level.changed` referencing the decision, validator rejecting an approved level above the ceiling at decision time; **automatic demotion**: incident → `policy.demoted` with cap = max(L0, effective-at-incident − 1) in the same run — fixture includes the cap-above-ceiling bite case; reducer replay fixture: same event stream → same effective level, always | 2 | active |
| REQ-05 | An interactive session obeys the same law | PreToolUse policy fragments for every class the feasibility matrix proved, all calling the shared library (zero duplicated policy logic); every class the matrix could NOT prove is fail-closed (static `permissions.deny` entry or surface capped L0–L1) — **"hook later" is never a state**; interactive bypass fixture cannot write, shell, network, message, publish, deploy, or spend outside policy; brief/inbox render pending promotions and incidents | 2 | active |
| REQ-06 | A second run cannot double-spend the day's cap | Money flow proven: read settled + active reservations from spine → atomic `spend.reserved` under spine `withLock` → provider call with idempotency key → `cost.incurred` (settlement profile: reservation_ref, integer minor-unit amount, ISO-4217 currency, provider idempotency ref — strict when reservation_ref present, legacy shape untouched, forward-only) or `spend.released`; **reservation state derived from the event chain, never stored**; fixtures: under-cap allowed, exact-boundary behaviour pinned, over-cap blocked, sequential second run blocked, lock-level concurrent attempt blocked, restart/replay identical; **no provider call before reservation success** — fixture; v1 autonomous spend valid in Mode A only | 1 | active |
| REQ-07 | One source of cap truth, honestly | Cap inventory recorded (engine budgets, router, process permissions, council envelopes — whatever exists at kickoff); **birth-rule wired**: a module born after policy lands with its policy row in the same change (kickoff-lint check, WARN-first as advisory lint); migration executed **only against a real cap-bearing module** — parity claimed only from that module's own fixtures; if no such module exists, REQ-07 closes as inventory + birth-rule with migration explicitly deferred, never faked (E3) | 3 | active |
| REQ-08 | The engine survives a real attack, with receipts | Two full days of fresh-agent adversarial passes over: wrapper bypass via direct driver, denied command embedded in allowed shell, symlink/path escape from write roots, domain allowlist bypass (redirect, DNS-rebind, IP-encode, subdomain, proxy), concurrent double-spend race, demotion-fails-open, cap-above-ceiling no-op attempt, fake/missing trial-ledger evidence, forged promotion payload, stale cached policy vs file, hook fail-open, quarantined-event-reported-as-success; **every discovered hole lands as a permanent regression fixture**; "no findings" without demonstrated attack paths does not pass | 4 | active |
| REQ-09 (v1.1) | A configured level is never mistaken for an evidenced one | **Evidence fold** over the canonical spine yields, per (action kind × capability) pair at its effective level, `last_success` · `last_refusal` · `last_audit` (each a receipt ULID or absent) and `evidence_age_days`, from **existing kinds only** (zero new spine kinds), with the as-of day injected and never read from the clock. A **BELOW-BAR** class (ADR-0049 pattern: it fails for insufficiency, not for a violation) flags every pair at effective ≥ L1 on spend/publish/deploy/network/shell whose `last_refusal` is absent, `unknown` or older than that pair's N. N is declared in `hq.policy.yaml` next to the level. A policy evidence guard (ADR-0910's cadence and clean-run rule) reports clean **only** with zero BELOW-BAR cells, and otherwise raises one `approval.requested`. The face Policy room renders evidence age per cell, and `unknown` where no kind can carry the evidence. POL-L invariants (a)(b)(c) are each fixture-pinned and each goes red against a mutant | 5 | proposed — cycle 2 |

## Appetite

**7 days hard cap.** **Tier:** M. Planned allocation is **6d, leaving ~1d slack** —
portfolio C4 ran 112% on a 100%-allocated plan and the appetite-sum gate's first
confirmed firing says never do that again. Slack is never taken from Phase 4.
**Dogfood:** 7 calendar days with real policy in force for whatever runs exist —
separate from build appetite, feeds the retro, not burn.
**Kill criteria:** REQ-01 exit not reached by end of day 2 → STOP, retro the schema
scope. Phase 4 finds a bypass class the P1/P2 architecture cannot close (the enforcement
point is not actually the sole entry) → STOP — do not ship a policy engine that polices
politely. A blown cap is cut or killed, never extended (A9).

## Decisions to ADR at kickoff

| ID | Decision |
|---|---|
| POL-A | `hq.policy.yaml` is the repo-versioned, human-declared **ceiling** and the canonical home of the L0–L3 level semantics (A5 — one source of truth). **L0–L3 is a closed enum; L4 is a parse error**; the ADR records the supersession of arc-full-architecture's L0–L4. Changing a ceiling is a repo edit (reviewed diff), never an agent action. |
| POL-B | **Deny-by-default**: a kind absent from the file is read-only; no wildcard grants; unknown fields are hard errors. The un-grantable list is **Constitution E2's five items verbatim** (from the adopted text); "refunds" is recorded as an **interpretation** under "moving money" — subsumption, not verbatim, not silent. Entries stricter than E2 are allowed as explicit policy **extensions**, one decision record each (the constitution is the floor; policy may be stricter; neither direction is an amendment). `policy-lint` FAILs from birth — it is a validator (spine strict-mode exit-2 precedent), not an advisory lint. |
| POL-C | **Two-key authority state machine.** Per action kind: (1) YAML **ceiling** — declared maximum; (2) **event cap** — derived by ONE fixture-pinned reducer folding the kind's transition events in spine order. Initial cap (no events) = **min(ceiling, L1)** — every kind is born at L1; higher levels are always event-earned ("starts WARN/L1 and climbs" + trial-ledger culture). `policy.demoted` (machine-derived, incident-ref mandatory) sets cap = **max(L0, effective-at-incident − 1)** — demotion bites from the EFFECTIVE level so a cap above a lower ceiling can never absorb it into a no-op. `policy.level.changed` (human, decision-ref + trial-ledger citation mandatory) sets cap = approved level; approving above the current ceiling is a validation error. **Effective = min(ceiling, cap)** at every authorization. **No auto-recovery, no time-decay** — only a human `policy.level.changed` raises the cap (A4: trust is re-earned, never argued back). Named edge, resolved simple (A2): a lowered-then-restored ceiling makes an old higher cap reachable again — both acts are human; where re-earning is wanted, record a level change down with the ceiling cut; v1 keeps `min()` pure. |
| POL-D | **One shared zero-dep policy library** (`lintPolicy` / `resolveEffectivePolicy` / `authorizeAction` / `raiseIncidentAndDemote` / `reserveSpend`) used by BOTH the `arc-run` wrapper and the PreToolUse hooks. Process `permissions:` blocks **declare ≤ policy grants** — a process may request less, never more; a cross-check lint enforces it. Two interpretations of policy = guaranteed drift; there is exactly one. |
| POL-E | **Event kinds.** Reuse `approval.requested` (with the strict `policy.promotion` payload profile — `assertDecision`-style first-party closed shape) and `cost.incurred` (settlement profile, POL-F). Never touch evolve's `promotion.proposed` (experiment-scoped, ADR-0309). Add exactly four: `policy.level.changed`, `policy.demoted` (two kinds because two truth sources — human-decided vs machine-derived — per the revenue.received/simulated precedent), `spend.reserved`, `spend.released`. Vocabulary = live `KINDS.length` + 4, derived-count assertion, unknown-kind hostile fixture re-run. Every policy event: closed typed payload, idem-bound (ADR-0304 pattern), policy file hash (forward-only, never estimated — ADR-0068 spirit), run correlation. |
| POL-F | **Spend under E2.** `spend` = metered consumption against a **human-pre-approved provider budget** — the cap itself is a recorded human decision. Creating a payee, changing a price, issuing a refund, real purchases and ad-bids are E2 territory: never above L1, entirely out of v1 (the scheduler brief's spend-ban and the trader passport's "hand-written policy change" line agree). Flow: read settled + active reservations from the spine → atomic `spend.reserved` under `withLock` → provider call with idempotency key → `cost.incurred` (settlement profile) or `spend.released`. Reservation state is **derived from the event chain** (settled / released / open) — a stored status field on an append-only receipt is a field that learns to lie. Mode A only in v1 (ADR-0056). |
| POL-G | **Driver L2-eligibility is a contract property**: a driver must prove tool-level enforcement (a fixture result, not a judgement — the Mode B lesson) before any of its processes may hold an L2/L3 effective level; otherwise its processes cap at L0/L1 regardless of policy. |
| POL-H | **Interactive coverage with a feasibility gate.** P0 delivers a hook-interception feasibility matrix — per side-effect tool class, a fixture proving PreToolUse can intercept AND block. A class that cannot be proven goes **fail-closed**: a static `permissions.deny` entry (generalizing the existing ad-hoc deny list) or the surface stays L0/L1 (POL-G applied to the interactive surface). "Hook later" is never an accepted state — unproven = denied. |
| POL-I | **Birth-rule over migration.** New modules are born WITH their policy row (same change, advisory lint). Migration of existing caps executes only against a REAL cap-bearing module; "zero behavior change" is claimed only from that module's own fixtures — a parity proof against a mockup is an E3 violation. Retired cap paths are **attic'd, never deleted** (A10, ADR-0023). |
| POL-J | **Scope boundary**: `/arc-capability` (ADR-0110) vets what may ENTER the toolchain (supply-chain provenance); the policy engine governs what a RUN may DO (runtime authority). Neither absorbs the other; the words "capability vetting" and "capability vector" are kept distinct in every doc this cycle touches. |
| POL-K | **OPEN — decided at kickoff, recorded in the kickoff ADR set:** lane name · ADR century (next free at birth) · code home (`products/policy` vs inside `hq` — the architecture doc places the policy engine in hq; the separate-product lean is on record as opinion only, for dependency cleanliness: engine consumes the policy library). |
| POL-L (v1.1) | **A configured level is not an evidenced level.** Per pair, a deterministic fold over existing spine kinds derives when its capability last succeeded, was last refused correctly, and was last audited. An effective ≥ L1 pair on spend/publish/deploy/network/shell with no fresh refusal is **BELOW-BAR**, because an unexercised refusal path is unproven. Zero new spine kinds. Levels are never changed by evidence in either direction: promotion stays a human `policy.level.changed` citing evidence (ADR-0508), and nothing auto-demotes on stale evidence. Full text: § v1.1 below. |

## Non-negotiables

- **Fail-closed everywhere**: a crashed policy check blocks (ADR-0028 fail-safe
  precedent); an event that lands in quarantine is never reported as enforcement success
  (ADR-0106/0032 lesson); a hook that errors denies (E3, A1).
- **Enforcement lives in code paths agents cannot bypass** — the `arc-run` wrapper and
  registered hooks; never prompts, never convention (brief's own law, kept).
- Deny-by-default, no wildcards, missing kind = read-only (POL-B).
- E2 items never above L1, quoted verbatim from adopted law (E2, A5).
- **No auto-promotion, no auto-recovery, no time-decay** — every raise is a human
  decision with trial-ledger citation (A4, A1).
- Money: Mode A only; no provider call before a successful reservation; no real-money
  movement above L1; spend-capable kinds excluded from any future scheduling in v1.
- Counts derived, never hardcoded (ADR-0107); profiles and hashes forward-only, never
  backfilled or estimated (ADR-0068 spirit).
- Every phase close leaves its receipt on the spine; all new advisory lints start
  WARN-first in TRIAL — `policy-lint` itself is a validator and FAILs from birth.
- Constitution articles this plan upholds, for kickoff-lint: E1, E2, E3, A1, A2, A4,
  A5, A8, A9, A10.

## No-gos (this cycle)

Scheduler/cron of any kind (own brief, hard-depends on this) · RBAC or multi-user
ambitions · network policy beyond domain allowlists (no proxy, no egress rewriting) ·
ad-bid or purchase autonomy · touching evolve's experiment kinds or `/arc-capability` ·
new spine kinds beyond POL-E's four (+the constitution.adopted micro-ADR if not already
done) · backfilling profiles onto historic events · a policy dashboard (brief/inbox
rendering only) · re-tiering any model seat (C5's territory).

## Rabbit holes (named detours)

- **Perfect resource grammar** — v1 grammars only for capabilities with live consumers
  (write roots, shell allowlist, network domains, spend caps); message/publish/deploy
  get schema slots and minimal enums. Full grammars for consumer-less capabilities is
  stale slop on arrival.
- **Trust scoring / karma systems** — the state machine is min(), one-level bites, and
  human raises. Anything smoother is a v2 debate, and A4 probably says no then too.
- **Egress proxy engineering** — v1 network enforcement is an allowlist decision at
  `authorizeAction` plus red-team fixtures; building a forward proxy is its own cycle.
- **Hook framework generalization** — fragments call the shared library; refactoring
  the hook dispatch system itself is out (touching hooks beyond adding fragments = no-go
  inherited from C5).
- **Migration completionism** — REQ-07 is inventory + birth-rule; hunting every implicit
  cap in every script is not this cycle.

## Assumptions ledger

| Assumption | How we'd know it's wrong (trigger) | Phase that tests it |
|---|---|---|
| PreToolUse can intercept and block most side-effect tool classes | Feasibility matrix shows a majority of classes unprovable → interactive surface goes mostly static-deny and scope tilts headless-first; recorded in the P0 exit note | 0 |
| Spine `withLock` is a sufficient single-writer boundary for reservations in Mode A | REQ-08's race fixtures break a reservation invariant → autonomous spend drops to L1 until a certified mechanism exists (a fixture result, like Mode B) | 4 |
| One-level demotion is the right bite size | Dogfood shows repeat incidents at the same level on the same kind → retro material; money kinds may need a two-level bite or straight-to-L0, by ADR note | dogfood |
| The 8-capability set covers real actions at this scale | An action fits no capability honestly during P1/P2 wiring → extend the closed set via the same ADR mechanism, never shoehorn | 1–2 |

## Pre-mortem (top 5 — seeded from history first)

| # | Failure cause | Mitigation or accepted |
|---|---|---|
| 1 | Enforcement fails open silently (precedent: `develop.started` quarantined with exit 0 — found only by listing the spine dir) | Fail-closed is a REQ, not a preference: crash = block, quarantine ≠ success, hook error = deny; REQ-08 attacks exactly this |
| 2 | A bypass path exists around the wrapper (precedent: engine adversarial forged `allowed-tools:`, `permissions: declared` meant unrestricted) | Sole-entry-point architecture + POL-G driver contract + POL-H feasibility gate + two untouchable red-team days; kill criterion if unclosable |
| 3 | The policy file drifts from reality into a poster (precedent: constitution DRAFT for weeks; blueprint states stale) | Birth-rule makes the file the birthplace of caps; effective level derives from events so the file rarely needs edits; REQ-07 inventory pins what exists |
| 4 | Demotion that doesn't demote (found in design review: cap-above-ceiling no-op) | POL-C bites from effective level; the exact scenario is a pinned fixture AND a named red-team case |
| 5 | Double-spend via race (precedent: `withLock` duplicate-writer bug live while a certification was green) | Reservation-before-call under the lock, Mode A only, sequential + lock-level race fixtures, restart/replay fixture; assumption ledger row if fixtures break |

## External dependencies

None. Zero-dep Node throughout (A2); providers, servers and publishers are committed
fakes (ADR-0104 pattern) — v1 needs no real external spend to prove enforcement.

## Phases (risk-ordered)

| Phase | Capability | Appetite |
|---|---|---|
| 0 | **Steel thread = the law and its parser.** Schema + canonical L0–L3 table + `policy-lint` + state-machine reducer spec & fixtures + hostile corpus green + hook feasibility matrix with per-class verdicts (REQ-01) | 1d |
| 1 | Headless enforcement: `arc-run` integration, capability fixture matrix, deny-by-default proof, money guard core (reservation flow + double-spend fixtures) (REQ-02, REQ-03, REQ-06) | 1.25d |
| 2 | Receipts + interactive: vocab ADR (+4), promotion chain end-to-end via inbox, automatic demotion, hook fragments per feasibility matrix, brief/inbox rendering (REQ-04, REQ-05) | 1.25d |
| 3 | Birth-rule wiring + cap inventory + conditional migration, honestly scoped (REQ-07) | 0.5d |
| 4 | **Adversarial security pass — two full days, untouchable.** Fresh agents, the red-team list, every hole a permanent regression fixture (REQ-08) | 2d |
| 5 (v1.1, cycle 2) | **Evidenced levels (POL-L).** Evidence fold + BELOW-BAR class + per-pair N + the policy evidence guard + face per-cell evidence age, plus the receipts the fold needs where the policy lane owns the adapter. A two-agent adversarial pass (logic + boundary) attacks the fold, the gate and the tests that protect invariants (a)(b)(c) (REQ-09) | ~3d, set at kickoff |

**North-star:** when the scheduler kickoff eventually fires, its plan checks "policy
engine live" as a verified prerequisite and adds **zero** new permission machinery — the
first unattended run in arc's history is block-capable on its first day, and every
authority change before and after it is a receipt on the spine.

---

## v1.1 — POL-L: evidenced levels (amendment 2026-10-07, builds at cycle 2)

**Status:** design source only. Nothing here is a live phase spec. It is built when
`/arc-kickoff --lane policy` opens cycle 2, and that kickoff writes the phase spec, the
ADRs (band 0500–0599) and re-verifies every count below.

### The problem, measured

`hq.policy.yaml` shows effective levels, and ADR-0910 gives a monthly guard that the owner
starts. Nothing records, per capability, when it last succeeded, when it was last refused
correctly, or when it was last audited. **An L1 that has never been exercised looks
identical to an L1 that works.** For spend, publish, deploy, network and shell, that is the
difference between a policy and a poster: pre-mortem row 3 of this plan, in its exact words.

Measured on the canonical spine (main clone, 2026-10-07, 1,695 events, 61 day-files):
**zero** `policy.level.changed`, `policy.demoted`, `spend.reserved`, `spend.released` and
`incident.raised` have ever been emitted, and no `approval.requested` has carried the
`policy.promotion` profile. Every level the engine enforces today is fixture-proven and
production-unexercised. Lane assumption row 1 (`initiatives/policy/PLAN.md`) fired on that
count. See `initiatives/policy/PROGRESS.md` `## Now`.

### Which cells the bar applies to today

The effective level is `min(ceiling, cap)`. No `policy.level.changed` exists, so every cap
is still the L1 birth cap. On `hq.policy.yaml` at `9864ee29` (15 subjects):

| Capability | Pairs at effective L1 | Pairs at L0 | Under the BELOW-BAR rule? |
|---|---|---|---|
| shell | 11 | 4 | yes, all 11 |
| network | 6 | 9 | yes, all 6 |
| spend | 0 | 15 | no: L0 is the deny, so there is nothing to evidence |
| publish | 0 | 15 | no |
| deploy | 0 | 15 | no |

**17 cells are in scope today, and every one of them is BELOW-BAR**: none has a refusal
receipt the fold can read (next table). That is the expected first reading, not a defect of
the rule. L0 cells are still rendered, with `n/a` in place of an age.

### What counts as a refusal exercise, per capability

A refusal exercise is **a real attempted action that the policy refused, recorded on the
spine**. It is never a unit test, a fixture or a bats run: tests prove the code, and this
measures the running system. "Recorded" means a receipt the fold can attribute to one
(kind, capability) pair **from typed payload fields**. The fold never parses free text, so a
receipt whose capability lives only inside a prose `what` string does not count.

| Capability | Counts as a refusal exercise | Existing kind that carries it today | Instrumented? | Who owns the adapter |
|---|---|---|---|---|
| **shell** | A Bash call (interactive) or a driver spawn (headless) that the policy turned into `deny` or `propose` instead of executing | L2+ overreach: `incident.raised` with `source: "policy <kind>/shell"` (`recordOverreach`). Headless L0: `incident.raised` `source: "arc-run policy gate"` + `run.completed reason=policy`, with the capability only in prose. Scheduler: `incident.raised class=policy-declined` with `denials` | **No at L1**: the hook prints `BLOCKED … at L1 (propose)` and writes nothing. Headless L0: process-attributable only | **policy** (`policy-hook.mjs`, the `arc-run` gate) |
| **network** | A WebFetch/WebSearch/MCP call or a headless egress attempt to a destination the grant does not allow, refused | Same carriers as shell (`source: "policy <kind>/network"` at L2+) | **No at L1**, same gap | **policy** (hook + `authorizeAction` domain decision). A headless egress adapter does not exist yet; **engine** owns the driver side |
| **spend** | A `reserveAndSpend` that `checkReservation` refused (over cap, outside the window, L0) against a real provider budget | None. The refusal returns `{ ok: false }` and emits nothing. `spend.released` records a release *after* a reservation (race, provider failure), which is not a policy refusal | **No** | **policy** (`lib/policy/spend.mjs`). Out of the bar until a spend pair reaches L1 |
| **publish** | An attempted publish (growth's sender, a publish-class MCP tool) refused by `authorizeAction` | None. growth's publish path emits `content.published` on success and **does not import the policy library** (grep, 2026-10-07: no growth script calls it). `targets.publish` is empty | **No** on either side | **growth** routes its sender through `authorizeAction` (its band, ADR-1101); policy owns the receipt shape |
| **deploy** | An attempted deploy (launch's git-triggered prod deploy, a deploy-class MCP tool) refused | None. No deploy path calls the policy library | **No** | **launch** (its deploy gate, PLAN-launch REQ-03); policy owns the receipt shape |

Success and audit carriers, also existing kinds only:

| Field | Read from |
|---|---|
| `last_success` | shell/network: `run.completed outcome=ok` of a process holding the pair (process-level, honest about it). spend: `cost.incurred` with `reservation_ref` (settlement profile). publish: `content.published`. deploy: `ship.done`. At L1 a "success" is a *recorded propose*, which has no carrier today (the L1 gap above) |
| `last_refusal` | The table above. `policy.demoted` also counts, since it cites an `incident.raised` |
| `last_audit` | The policy evidence guard's own `run.completed` (its process name is fixed at kickoff). One audit covers every cell it read |

**The L1 gap is the centre of this amendment.** POL-A defines L1 as *"propose — prepared and
recorded, never executed"*, and today a propose is prepared and **not recorded**. Choosing
the existing kind that records it is fork POL-L1 below, and it is the kickoff's to decide.

### The fold

`evidence(spine, policy, asOf) → cells[]`. One cell per (subject × capability):
`{ subject, capability, effective, last_success, last_refusal, last_audit,
evidence_age_days, n, state }`.

- **Pure.** Spine events, the parsed policy and an `asOf` IST day go in; nothing is read
  from the clock or the filesystem inside it. The same three inputs give byte-identical
  output, always.
- `evidence_age_days` = the `asOf` IST calendar day minus the IST calendar day of
  `last_refusal`'s `ts`. Spine `ts` is already IST (`IST_TS_RE`), so no timezone is guessed.
- `state` is a closed enum: `fresh` · `stale` · `absent` · `unknown` · `n/a`. `unknown`
  means no existing kind can carry this cell's refusal (the not-instrumented rows above), and
  it is distinct from `absent`, which means the kind exists and has never fired.
- **Dependency, named: "Gap B's Availability enum".** It does not exist on `origin/main`
  `9864ee29` (grep: no `Gap B` and no Availability enum outside unrelated design/council
  docs). Until it lands, the fold ships the local enum above with a one-to-one mapping table.
  When it lands, the fold adopts it in the same change and the mapping is deleted. The lane
  that owns Gap B is **unnamed in the tree**, so the owner names it at kickoff.

### BELOW-BAR, the class that is not an absence check

`PASS = zero violations` cannot see a policy nobody uses (the CLAUDE.md lesson behind
ADR-0049). The evidence check reports **BELOW-BAR** for a cell where:

> effective ≥ L1 **and** capability ∈ {spend, publish, deploy, network, shell} **and**
> state ∈ {absent, unknown, stale} (stale = `evidence_age_days > n`)

- **N lives in `hq.policy.yaml`, next to the level:** `shell: { level: L1, evidence_days: 35 }`.
  The proposed starting value is 35 for every pair (the monthly guard cadence plus 4 days
  of grace). The owner sets the real numbers in the reviewed diff.
- **A missing N is BELOW-BAR (`reason: no-bar-declared`), never a lint FAIL.** A new
  required field would turn every lane's CI red over a file only the owner can edit. The
  insufficiency class carries it until the owner declares one.
- BELOW-BAR never changes a level and never denies an action. It is a reported state, read
  by the guard and the face.

### The guard

ADR-0910 belongs to **bench** (BEN-F) and is not edited. POL-L **adopts its rule** for its
own policy evidence guard: monthly, first working day, started by the owner. A clean run
emits **only** `run.completed`, and the inbox never carries no-op approvals.

- **Clean** ⇔ zero BELOW-BAR cells. A run with any BELOW-BAR cell raises **one**
  `approval.requested` (gate `policy-evidence`) listing every such cell, never one per cell.
- With the L1 gap open, the guard **cannot be clean**. That is intended: the guard says
  out loud what the configured levels hide.
- A missed month is visible from the spine without any new instrument: no guard
  `run.completed` in that month's slice (ADR-0910's own detection, reused).

### The face

The Policy room's subject table (`face/src/modules/kernel/policy/`) shows, in each cell, the
effective level and the evidence age (`12d`, `stale 41d`, `absent`, `unknown`, `n/a`).
It reads the same fold through `/api/policy` and does not re-derive anything (POL-D: one
interpretation). The face lane builds the cell from a fold field the policy lane serves.

### Invariants (carried verbatim into the cycle-2 kickoff plan)

- **(a)** A capability with **zero receipts** is BELOW-BAR, never PASS.
- **(b)** A refusal receipt older than N flips to BELOW-BAR **on the IST day boundary**,
  deterministically under replay: the same spine at `asOf = d + N` is fresh and at
  `asOf = d + N + 1` is stale, and both outputs are byte-identical across two replays.
- **(c)** The guard **cannot report clean** with any BELOW-BAR cell. The mutant that drops
  one BELOW-BAR cell from the guard's input goes red.

Each invariant is a fixture **and** a mutant (the CLAUDE.md "attack the test" rule): the
fold with `absent` mapped to PASS, the age computed from `Date.now()`, and the guard with
the BELOW-BAR filter deleted, each one killed by its fixture.

### A constraint the kickoff must plan around: the guard files are deny-listed

Phase 04 put `hq.policy.yaml`, `.claude/scripts/hq/lib/policy/**`, `policy-lint.mjs` and
`policy-hook.mjs` on the static deny floor (ADR-0502). An agent cannot edit them, which is
the rule working. So POL-L splits like this:

- **Agent-built, outside the guarded set:** the fold, the evidence check and the guard, as
  new files (e.g. `.claude/scripts/hq/policy-evidence.mjs` and a sibling lib), plus their
  bats suite, the face cell and the `/api/policy` field.
- **Owner paste, generated as whole files (the Phase 04 STEP1/STEP2 pattern, never a
  diff):** the `evidence_days` fields in `hq.policy.yaml`, the L1-propose receipt in
  `policy-hook.mjs`, and, once the fold is green, **adding the new evidence files to
  `ungrantable_resources` and the deny floor**. A guard an agent can edit to report clean is
  not a guard (ADR-0502's own sentence).

### Forks for the kickoff (recommendation given, not decided here)

| ID | Fork | Recommendation |
|---|---|---|
| POL-L1 | Which **existing** kind records an L1 propose? `note.logged` with a closed `policy.proposed` payload profile · `approval.requested` (floods the inbox: every propose would need a human) · `incident.raised` (wrong: `incident.mjs` rules a propose out on purpose) | `note.logged` + a closed profile validated first-party (`assertDecision` style). If no existing kind can carry it honestly, STOP and route a vocabulary ADR rather than shoehorn it. "Zero new kinds" is this amendment's constraint, and it is the assumption most likely to break |
| POL-L2 | Are interactive and headless refusals one cell or two? | One cell per (subject × capability). `session:interactive` is already its own subject, so the surfaces are separated by subject, not by a new axis |
| POL-L3 | Does a scheduler `policy-declined` incident count? | Yes, if its `denials` carry the capability as a typed field (verify the shape at kickoff); otherwise it counts as `unknown`, and the scheduler lane is asked for the field |

### Out of scope (v1.1)

Changing any level; auto-promotion or auto-demotion on evidence, in either direction
(promotion stays a human `policy.level.changed` citing evidence, ADR-0508); new spine kinds;
backfilling receipts onto historic events; synthetic "exercise" runs whose only purpose is
to refresh a cell (that is a unit test wearing a receipt); building growth's or launch's
adapters (theirs. This plan names the receipt shape they must emit).

### Assumptions (v1.1)

| Assumption | Trigger | Tests it |
|---|---|---|
| An existing kind can record an L1 propose honestly | POL-L1 finds no kind without inbox flood or a prose-only payload → STOP, vocabulary ADR | kickoff |
| N = 35 days is long enough that organic refusals keep cells fresh | After 2 guard runs, > half of in-scope cells are `stale` while the processes ran at all → N is wrong, or the work does not exercise its refusals; the owner reads which one | dogfood |
| Process-level `run.completed` is honest enough for shell/network `last_success` | A process holds a pair it never uses, and its runs read as that pair's success → narrow `last_success` to `unknown` for that capability | 5 |

## KICKOFF PROMPT — paste into Claude Code in the arc repo (only after the trigger fires)

```
/arc-kickoff --lane <policy — confirm name per POL-K> Policy Engine — enforced capability vectors

Design source: docs/strategy/plans/PLAN-policy.md (v1.0, approved; trigger fired:
<≥3 kinds at L2 / first headless job approved — name which>). Read it fully.
Decisions POL-A..J are locked; decide POL-K (lane name, century, code home) NOW and
record it with the kickoff ADRs, numbered from this lane's century.
Prerequisite gate: the Constitution must be ADOPTED (constitution.adopted on the spine)
— verify, else STOP and run the micro vocab ADR + sign-off + event first.
Phase 0 is the steel thread: schema, reducer fixtures, hostile corpus, and the hook
feasibility matrix exit together or the cycle stops (kill criteria at day 2).
Phase 4's two adversarial days are untouchable — do not compress them for any REQ.
No scheduler code of any kind; anything scheduler-shaped becomes a note in
BRIEF-scheduler.md. This is security-class work: policy-lint FAILs from birth.
STOP after PLAN.md + phase specs + kickoff-lint pass — I approve before Phase 0 work.
```

## KICKOFF PROMPT — cycle 2 (v1.1, POL-L)

```
/arc-kickoff --lane policy Evidenced levels — a configured level is not an evidenced level

Design source: docs/strategy/plans/PLAN-policy.md § v1.1 (POL-L, REQ-09). Read it fully.
This is cycle 2 of an existing lane (Cycle 9 closed 2026-08-10); ADRs from band 0500–0599.
Re-verify every count in § v1.1 on the canonical spine (main clone) before writing a REQ.
Decide forks POL-L1..L3 and record them as ADRs; if POL-L1 finds no existing kind that can
honestly record an L1 propose, STOP and route a vocabulary ADR — never shoehorn.
Name the lane that owns "Gap B's Availability enum" or ship the local enum + mapping.
Carry invariants (a)(b)(c) verbatim into PLAN.md Non-negotiables, each with a mutant.
Plan the deny-listed files as whole-file owner pastes (Phase 04 pattern), never diffs.
Out of scope: changing any level; auto-promotion/demotion on evidence (ADR-0508).
The fold + BELOW-BAR class is a gate: two fresh attackers (logic + boundary), /arc-attack.
```
