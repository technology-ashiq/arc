# PLAN (design source) — executor v1: agent-runtime driver (the hired hands)

> **Freeze log:** BRIEF-executor.md (2026-08-04, owner-approved) → deep analysis
> 2026-08-05 (9 findings) → multi-perspective ideas round 2026-08-09 (8 lenses) → v0.9
> consolidated draft → self-review (7 fixes) + best-outputs review (7 adds) → v1.0 →
> v1.1 (owner answered all six open questions in-session, rulings recorded below) →
> **v2.0 build-out edition, LANDED in the tree 2026-08-09, owner-instructed,
> uncommitted — the owner branches/commits/PRs.** This drop also moved
> `BRIEF-executor.md` to `docs/archive/` (evolve/leads/policy/absorb precedent) and
> updated both READMEs (plans ordering row + strategy file map/correction #15).
>
> **Placement:** `plans/` — this file feeds `/arc-kickoff` directly (kickoff-grade full
> plan, paste-ready prompt at the bottom per the pack rule). Decisions are named as
> letters (EXE-A…K); **real ADR numbers are assigned at kickoff from the engine lane's
> century band (0200–0299 per the PORTFOLIO.md band table) — never hardcoded here.**
>
> **Scope honesty:** this cycle delivers ONE external agent runtime as a governed engine
> driver, plus the reusable hiring kit around it (certification suite, capped credential,
> context-pack rule, tenure/retire path, unlock ladder). It is NOT absorb (technique
> internalization — its own plan), NOT growth (REQ-07 produces drafts; publishing stays
> human, always), NOT bench (verdict receipts are bench FUEL; no runner), and it builds
> no L2+ pathway of any kind (POL-G honored; v1 lives entirely at L1-drafts).
>
> **Trigger: FIRED — the owner's Build-out Mandate (2026-08-09).** The brief's pull
> trigger asked for a receipted need; the mandate IS the receipted decision: the owner
> directed, in his own words, that arc be built out completely with no further
> trigger-waiting (arc = sole priority; ventures deprioritized). A8's letter holds — a
> recorded decision fires the build. At kickoff, the mandate is put on the spine
> (`decision.recorded`, existing kind) and every kickoff ADR cites it. **Honesty note
> (E3):** no friction receipt exists and none is invented — REQ-07 therefore runs its
> **capability-gap arm** (no current driver runs this class; baseline honestly waived;
> per-draft verdicts), not a fabricated performance comparison. Appendix A remains in
> service for FUTURE runtime needs (second runtime, messaging v2), which stay
> receipt-gated as before.
>
> **Prerequisites (all verified 2026-08-09):** engine v1 shipped ✓ (C6 closed
> 2026-08-03, PR #103 — `arc-run`, 4 drivers, `router.yaml` LIVE) · spine live ✓ ·
> ADR-0069 adopted ✓ · **Constitution ADOPTED ✓ (2026-08-06, receipt
> `01KZ9V0QXNNMB3ZH18MSH8DKH3`)** · **policy engine merged to trunk ✓ (C9, PR #130,
> 2026-08-08; `hq.policy.yaml` live at root)**.
> **Pre-kickoff checklist (mechanical, not doctrine):** ① the live slot is free — close
> the two open items first (policy C9: 3 owner `settings.json` edits → retro; leads C8:
> DMARC TXT → Phase 03 → retro); Mode A = one session at a time, unchanged ② EXE-A
> scorecard (Appendix B) filled with a fresh market check ③ mandate `decision.recorded`
> emitted ④ paste the kickoff prompt.

## What changed since the brief was written (2026-08-04 → 2026-08-09) — read this first

The brief was written into a world that no longer exists, in four ways:

1. **The policy engine woke up.** The brief's "L1-drafts cap **until the policy-engine
   brief wakes**" is resolved: policy lane born 2026-08-06 (its own century claimed at
   birth), Phases 00–03 closed, Phase 04 built, attacked (4 fresh agents, 26 findings)
   and **merged as `677b67e` / PR #130 on 2026-08-08**. The L1 ceiling is no longer
   discipline, it is **code at the `arc-run` entry point** (policy REQ-02), and executor
   inherits that enforcement for free. Executor's action kinds are **born at L1**
   (POL-C) and its driver **cannot hold L2+ without eligibility fixtures** (POL-G) —
   both enforced, neither this cycle's problem.
2. **The Constitution is adopted law** (2026-08-06, v1.0, receipted). Every A8/E2/E3
   citation below cites adopted text.
3. **The board moved.** leads C8: Phases 00/01/02/04 CLOSED (9 real messages delivered,
   `dkim=pass`), Phase 03 gated on one owner DNS record, Phase 05 parked offer-gated;
   policy C9 nearly closed (3 owner settings edits). The engine band (0200–0299) is
   untouched by the new centuries — this cycle numbers from its next free slots.
4. **The owner changed doctrine (2026-08-09).** arc = sole priority; ventures
   deprioritized; every module gets built; trigger-waiting cancelled. This plan moved
   from "sleeper with a ready plan" to **"first cycle of the build-out"** — it runs as
   soon as the board clears. (The old §10 venture-first tie-breaker and the ADR-0071
   venture clock no longer govern sequencing; the mandate does.)

## Inherited (read this before the REQs — this cycle decides nothing these decided)

- **From ADR-0069 (Balanced Model Policy):** b(1) no runtime tier changes · b(5) absent
  data is never estimated · MP-F fingerprint rides `run.completed`. The runtime occupies
  the fingerprint's **model seat** — runtime name + version + pinned config hash —
  because from arc's viewpoint **the runtime IS the model** (EXE-E states this
  explicitly; without it, model policy has a blind spot the size of the contractor's
  whole brain).
- **From ENG-D/E/F (engine C6):** driver CLI contract (`drivers/NAME run <process>
  <input-json> <budget>` → output JSON on stdout, cost/usage sidecar, stderr logs, exit
  map **0** ok · **2** schema-fail · **3** budget-stop · **4** driver-error · **5**
  data-boundary-refusal, `--version` mandatory) · escalation = one same-tier retry →
  fail loud + proposal receipt, never auto · `drivers/mock` replay pattern for keyless
  CI regression.
- **From the policy engine (C9):** POL-C two-key authority (born L1; effective =
  min(ceiling, cap)) · POL-G driver L2-eligibility is a fixture result, not a judgement ·
  POL-I birth-rule — **a module born after policy lands is born WITH its policy row in
  the same change** · POL-F spend = metered consumption against a human-pre-approved
  provider budget (EXE-F below is exactly this, seen from the driver side).
- **From the design lane (ADR-0047/0048/0049):** blind ordering, owner's own eyes on the
  artifact, no absolute scores inside the loop — and 0049's hard-won lesson that
  process-constraints on a creative seat were **net-negative and were removed**. EXE-K
  is that lesson applied to a contractor: **verify outcomes, never prescribe the
  process.**

## Goal

One sentence: `arc-run --process X --driver <runtime>` executes an arc process on ONE
external agent runtime (Hermes-Agent/OpenClaw-class) under the same contract as every
other driver — provider-capped money, shim-enforced wall-clock, schema-validated output,
full receipts with trails, fixture-**certified** isolation, L1-drafts ceiling enforced by
the live policy engine, and **explicitly unconstrained internal thinking** — and leaves
behind a reusable **hiring kit** (contract + cert suite + capped credential +
context-pack rule + tenure/retire path + unlock ladder) so the second runtime hire is a
shim and a checklist, not a project, and external agents become receipted contract
employees instead of shadow IT.

## Current state (verified 2026-08-09 — re-verify at kickoff)

- Board (PORTFOLIO.md "Updated: 2026-08-08"): leads C8 LIVE at 5.5d/7d (Phase 03
  DNS-gated, Phase 05 parked), **policy C9 LIVE at 6.8d/7d** (P04 merged, open on owner
  settings edits); all other lanes IDLE. Mode B still NOT certified; Mode A one-session.
- `engine/router.yaml` LIVE; header carries the policy-first amendment law verbatim.
  Schema: `version:` · tier→model per driver · `classes:` name → {tier, driver,
  fallback} · `default:` — **no `cap:`/`judge:`/`hosted:`/`review_by:` fields exist
  yet** (REQ-04's delta).
- `hq.policy.yaml` live at repo root; `processes/` holds the 3 pilots only — **no
  draft/build-in-public process exists** (REQ-07 authors it; named scope, not hidden).
- absorb not yet built (PLAN-absorb sleeps on its own arms) → ABS-D owner-judge grammar
  does not exist yet → REQ-07's verdicts use the accept/reject fallback via existing
  kinds, recorded as a one-line deferral (EXE-G note). The per-draft verdict grammar
  defined here is deliberately ABS-D-compatible so absorb inherits it instead of
  inventing a second one.
- No runtime chosen — EXE-A decides at kickoff from the Appendix B scorecard (fresh
  market check) plus the owner's call; under the mandate there is no friction receipt to
  point at a product, and none is faked.

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-01 | A runtime is one more driver, not a special guest | `drivers/<runtime> run <process> <input-json> <budget>` → output JSON on stdout · exit map 0/2/3/4/5 honored · `--version` = runtime version + pinned config hash · ENG-E ladder inherited exactly (one same-tier retry → `fail/schema` + escalation-proposal receipt) · **adversarial pass on the output parser** (runtime output is hostile input) with pinned red fixtures — junk, ANSI floods, truncation, injection-shaped output · `drivers/mock` replays a pinned runtime transcript for keyless CI regression. Engine's "<1h new-driver stub" north-star is the bar | 1 |
| REQ-02 | Isolation is **certified against the real thing**, not promised | The **Isolation Certification Suite** (Appendix C, 12 fixtures) green **against the REAL runtime, human-started, once, with the run receipts attached as the certification evidence bundle** — a mock-green is labeled *regression*, never *certification* (the Mode B lesson: certified against fixtures that couldn't see the bug). CI reruns the suite on `drivers/mock` replays for regression only. Certification is a fixture result, never a judgement. **Unprovable → STOP** (kill criterion; an unprovable boundary is a no) | 2 |
| REQ-03 | Every dispatch is a policy-grade receipt with a trail | `run.completed` carries the full engine REQ-05 payload; MP-F model seat = runtime + version + config hash; absent cost/effort fields stay absent (b(5)); **zero new event kinds**. Win-rate per class is **derivable** from receipts — data sufficiency only; writing the reader script is explicitly OUT (engine no-go inherited; pinned here so nobody burns half a day on it). **Scrubbed runtime transcript stored as lane-scoped evidence per dispatch** — human review reads the draft AND the trail (injection shows in trails, not drafts), and absorb later gets study material for free | 2 |
| REQ-04 | Hiring is a reviewed, receipted, expiring, revocable act | **ONE reviewed `router.yaml` diff**: runtime rows carry `cap:` (`L1-drafts`, mandatory) · `judge:` (`deterministic\|owner` — schema slot; semantics = ABS-D when absorb lands; deferral line recorded) · `hosted:` (`local\|cloud`, **mandatory — absent = load failure**, same as `cap:`/`data:`) · `review_by:` (date, **mandatory, enforced at load time**: dispatching via an expired row refuses loud naming the row AND emits one idempotent `approval.requested` rejustify-or-retire proposal — no scheduler needed, the check runs at use). Row born from the mandate: comment cites the mandate decision AND the hire decision. **The same change carries the executor process's policy row in `hq.policy.yaml`** (POL-I birth-rule; ceiling L1) — birth-lint green. The hire flows `approval.requested` → `decision.recorded`. **Termination is spec'd with the hire**: revoke the capped key (instant — the credential is the leash) + disable the row by reviewed diff; emergency path = MP-A carve-out 2 (human-approved, expiry, follow-up ADR ≤48h). Runtimes take no `models:` entry — they pin via EXE-B or run recorded-as-unpinned | 3 |
| REQ-05 | Money cannot exceed the cap, even on an opaque runtime | The runtime's provider credential is a **capped key** (provisioned/proxy key with a hard limit) whose ceiling equals a **human-pre-approved budget** — POL-F's own definition of spend, enforced at the credential because an opaque runtime cannot be metered in-flight from outside. Fixtures: exhausted key → dispatch fails loud `fail/budget`, zero silent continuation · wall-clock budget enforced by the shim (EXE-C: timeout → exit 3) · receipt cost fields provider-reported or absent, never estimated. **Budgets are calibrated, not guessed**: the first 3 runs are calibration runs at a generous wall-clock, durations recorded, and the class budget is then set FROM those receipts (a stingy guess would kill exactly the deep runs the runtime was hired for). Key issuance/rotation stays a human act v1 | 3 |
| REQ-06 | The input is as governed as the output — and no thinner than the job needs | The draft job's input is a **context pack**: an `external-ok` digest assembled from spine/day events, **human-approved before dispatch** (v1: the owner IS the classifier; auto-classification is a named rabbit hole). **Batch semantics: one approved pack may cover N dispatches** (N declared at approval; per-dispatch receipts stay individual) — throughput scales with pack approvals, not per-draft approvals. **Angle freedom: the pack bounds DATA, not the take** — unless the job pins an angle, angle selection belongs to the runtime. **Feedback rides the pack**: accepted past drafts + rejection reasons (both external-ok by nature — they were written to be published) may be included, so the contractor learns from the briefing while its own memory stays OFF (EXE-D intact; state lives in receipts). Fixture: a pack containing a planted `internal-only` marker → refused before dispatch, never shipped | 4 |
| REQ-07 | One real job with a **verdict**, not just a pulse | The build-in-public **draft** process (`processes/` file authored this cycle — named scope) runs via the runtime **≥3×** with full receipts. **Output handoff is spec'd**: output schema `{draft, sources, task-class, pack-ref}` · stored as lane-scoped evidence · surfaced through the inbox for human pickup · publishing = a human copies it out, nothing auto-moves. **Verdict arm — mandate default = capability-gap:** no current driver runs this class as a process, so a paired baseline is **impossible and honestly waived** (recorded in one line); every draft gets a per-draft **accept/reject + one-line-reason receipt** (`approval.requested` → `decision.recorded`; grammar ABS-D-compatible). *(If a real performance-gap receipt also exists by kickoff day, the paired-baseline arm applies instead: same packs through an existing driver ≥3×, owner blind-judges pairs, PLANOFF layout.)* Win, lose or split — the receipt is the deliverable (E3). Drafts only — publishing stays human; feeds growth's future cycle, does not start it | 4 |

## The unlock ladder — how the cage opens (and why it exists)

v1 deliberately throttles throughput: human-started, 100% review, L1-drafts. That is
**probation, not architecture** — the cage has a key, every rung of the ladder is
receipts + a human decision, and nothing decays open with time (A4: trust is re-earned,
never argued back):

| Rung | State | What earns it | Mechanism |
|---|---|---|---|
| 0 (v1 birth) | Human-started · 100% review · L1-drafts · 1 pack = N declared dispatches | the cert suite green (REQ-02) | this cycle |
| 1 | Batch cadence — packs approved in weekly sittings, reviews batched | already allowed v1; owner habit, no new machinery | REQ-06 |
| 2 | **Spot-check review** replaces 100% (sampling) | trial-ledger evidence: **≥10 accepted drafts, 0 boundary incidents (owner-ruled 2026-08-09)** → sampling proposal; final call is always an owner decision receipt | trial-ledger + `decision.recorded` |
| 3 | L2-class actions proposed for specific kinds | POL-G eligibility fixtures passed by this driver + promotion chain | policy engine (live) |
| 4 | Unattended runs (true 24/7) | the scheduler module — a later build-out slot, not an indefinite sleeper; its policy prereq is already MET | scheduler cycle, not this one |

This table is documentation, not scope: v1 builds rung 0 and the receipts that make
rungs 1–2 arguable. Rungs 3–4 belong to later build-out cycles and are listed so the
throttle is visibly temporary-by-design.

## Appetite

**1.5 weeks (8 working days) hard cap. Tier: M.** The brief said 1w / Tier S-M for 5
REQs; this plan carries 7 because four things moved from implied to measured (cert
suite, capped key, context pack, verdict arm). **Appetite owner-ruled 2026-08-09: FULL
1.5w locked** — the lean fallback was offered and declined; P0 re-opens it only if the
world has materially changed, and says so on the record. **Planned allocation 7d, ~1d
slack** — portfolio C4 ran 112% on a 100%-allocated plan; never again.
**Kill criteria:** runtime API/CLI churn eats >2 days → bank shim + cert suite as
documentation, record "demand-triggered retry", fall back to existing drivers — under
the build-out mandate the build-out simply moves to the next module, nothing stalls ·
REQ-02 not fixture-provable against the real runtime → **STOP** — an unprovable boundary
is a no · no EXE-A candidate passes the must-haves → **STOP at P0**, record "no eligible
runtime yet", move to the next build-out module, revisit on the next market shift (a bad
hire is worse than no hire — the mandate orders building, never forced hiring) · verdict
arm blocked >0.5d on judging questions → accept/reject with plain receipts, never invent
a scoring system (bench's job, in its own slot).

## Decisions to ADR at kickoff (engine lane's century band — real numbers from the next free slots, never hardcoded)

| ID | Decision |
|---|---|
| EXE-A | Which runtime — **exactly one** in v1, chosen at kickoff from the Appendix B scorecard (filled with a fresh market check) + the owner's call (criteria: headless invocability · structured output capture · version/config pinning · self-hostable · vetted-skill surface size · maintenance pulse · license). Internal-shaped data plans make **self-hostable decisive** (`hosted: local` is the only way past the boundary). **No candidate passes the must-haves → STOP, record "no eligible runtime yet", continue the build-out elsewhere — no forced hire.** Second runtime = its own receipt-gated trigger (Appendix A), unchanged by the mandate |
| EXE-B | Pinning: runtime version + config hash ride the fingerprint; the pinned unit is the **runtime install + config + vetted skill/plugin list + its egress/network settings** (lockfile-hash discipline, `capability-lock.json` spirit), not the config file alone; unpinned = recorded as such; a pin-required class refuses it |
| EXE-C | Long-running semantics: wall-clock budget → timeout = `fail/budget` (exit 3); **no fire-and-forget** — a dispatch without a collected result is a defect. Budgets per class are **set from calibration receipts** (REQ-05), reviewed like any router change |
| EXE-D | Credentials & memory: own **capped** key in env (`.env.example` row), never in repo or runtime skill files; runtime persistent memory **OFF** for arc tasks — proven off by the memory-plant fixture, not assumed. The contractor still improves: **feedback rides the next context pack** (REQ-06), never the contractor's head — state lives in arc receipts |
| EXE-E | The ADR-0069 amendment — **first act, merged before any routing row** (Appendix D is the approved base text): names agent-runtime drivers as a driver class · **the runtime IS the model** (occupies the MP-F model seat) · the L1-drafts ceiling enforced by the live policy engine (POL-C birth cap + POL-G eligibility), encoded as the mandatory `cap:` field · pinning per EXE-B |
| EXE-F | Budget enforcement point: **inr enforcement lives at the credential** (capped key; ceiling = a recorded human decision = POL-F's pre-approved provider budget); the shim enforces time; receipts carry provider-reported cost or absent (b5). No key-vending automation v1. **Termination**: key revoke (instant) + row disable (reviewed diff); emergency = MP-A carve-out 2 |
| EXE-G | Context pack: draft-job inputs are **human-approved `external-ok` packs** v1; auto-classification out. **Batch: one approval covers N declared dispatches. Angle: pack bounds data, runtime picks the take unless the job pins one. Feedback: accepted drafts + rejection reasons may ride the next pack.** Verdict grammar until ABS-D lands: accept/reject + reason via `approval.requested`→`decision.recorded`, deferral recorded in one line — kept ABS-D-compatible so absorb inherits it |
| EXE-H | Evidence trail: scrubbed transcript per dispatch, lane-scoped; SPINE-E deny-pattern scan runs on runtime **outputs (drafts)** as well as logs; human review = draft + trail |
| EXE-I | Tenure: every runtime row carries `review_by:` — **enforced at load time** (expired row refuses dispatch + emits one idempotent rejustify-or-retire proposal; propose-only both directions). First period: **2 weeks (owner-ruled 2026-08-09)** — tight probation; rejustify rides on receipts, so a good contractor's renewal is cheap. The standing loop this enables: **hire → transcripts → absorb studies → internalize → retire** — every hire is planned obsolescence; an external dependency is never permanent by default |
| EXE-J | The hire is a receipt: adding or removing a runtime row flows `approval.requested` → `decision.recorded`; the row comment cites the mandate decision and the hire decision ULID |
| EXE-K | **Freedom clause (the ADR-0049 lesson, made law for contractors):** arc constrains the runtime's **boundaries** — data in (packs), actions out (L1-drafts), money (capped key), time (calibrated wall-clock) — and **verifies outcomes** (review + verdict receipts). arc **never prescribes the runtime's internal method, model choice, reasoning style, or creative approach.** Routine review is accept/reject + one-line reason, **never line-edits**; style-shaping happens only as a reviewed diff to the process file's brief, never as ad-hoc steering. Any future urge to constrain the contractor's process requires a measured A/B first — the design lane already paid for this lesson (constraints were net-negative and were removed) |

## Non-negotiables

- ENG-D contract untouched — **the runtime adapts to arc, never the reverse**.
- Emitter/reader discipline; **zero new event kinds**; counts derived, never hardcoded.
- ENG-E ladder inherited exactly — one same-tier retry → fail loud + proposal receipt;
  no auto-escalation anywhere.
- Adversarial pass on the shim's output parser before FAIL promotion (parser-class rule).
- **Human-started runs only this cycle** — unattended runs arrive with the scheduler's
  own build-out cycle, on the policy engine's terms, never earlier.
- Certification = the real runtime, receipted; mock-green = regression, never
  certification (Mode B lesson) — no green suite, no dispatch.
- The capped key's ceiling is a recorded human decision (POL-F); context packs approved
  before dispatch (EXE-G); drafts scanned and reviewed **with their trails** (EXE-H).
- **Review never line-edits; boundaries never loosen without receipts; the process is
  never prescribed** (EXE-K) — the freedom clause binds arc as much as the caps bind the
  runtime.
- **Publishing is human. Always.** A draft that publishes itself is an incident, and the
  policy engine's demotion machinery is live to say so.
- Router edits are reviewed diffs citing ADR-0069; runtimes never self-register; the
  policy row lands in the same change (POL-I).
- The mandate accelerates SEQUENCING, never QUALITY: approval gate per cycle, retros,
  receipts, adversarial passes all stand — build-everything ≠ build-carelessly.
- All new lint WARN-first in TRIAL; evidence bundles lane-scoped (ADR-0055);
  Constitution articles upheld: E2, E3, A1, A2, A4, A8, A9, A10 (adopted text).

## No-gos (v1)

No 24/7 daemon mode · no runtime-side cron/webhooks pointed at arc · no L2+ actions
(drafts and read-only outputs only; **no POL-G eligibility attempt this cycle** — that
work belongs to a later rung with its own evidence) · no second runtime · no
messaging-channel bindings — **messaging needs → explicit deferral recorded, the
non-messaging portion builds, messaging binding = its own v2 trigger (owner-ruled
2026-08-09)** · no marketplace skill installs beyond the vetted pinned list
(ClawHavoc/ToxicSkills is the named threat model) · no auto-updating router · no
win-rate reader/dashboard tooling (dashboard has its own build-out slot) · no
key-vending automation · no auto-classifier for packs · no review sampling in v1 (rung 2
is earned via trial-ledger, never assumed) · no scoped-MCP "company toolbox" handover to
the runtime (**v2 direction, parked on the record**) · no publishing, ever.

## Rabbit holes (named detours)

- **Auto-classifier for context packs** — human approval IS the v1 mechanism. A
  classifier is a security-critical parser and deserves its own adversarial cycle.
- **Key-provisioning automation** — issuing/rotating capped keys stays manual; automating
  it is vendor-API archaeology with real money attached.
- **Runtime feature-parity chasing** — the output contract is the equalizer; the runtime
  is a worker, not a platform to be fully exploited.
- **Scoring-system invention** for verdicts — accept/reject + reason, PLANOFF layout
  where pairs exist, done. Scoring math is bench's, in its own slot.
- **Isolation perfectionism** — the 12-fixture suite is the bar; a newly imagined attack
  class becomes fixture #13 by ADR, not an open-ended hardening sprint.
- **Transcript archaeology** — scrub + store; parsing/mining transcripts is absorb's
  job, in its own slot.
- **Ladder acceleration** — rungs 1–4 are listed for visibility; building any of them
  early is scope creep with a table for an alibi — even under a build-everything
  mandate, each rung belongs to its own cycle.

## Assumptions ledger (cap 7 — no falsification trigger, no entry)

| Assumption | How we'd know it's wrong (trigger) | Phase |
|---|---|---|
| The chosen runtime is headlessly invocable with capturable structured output | Shim cannot produce schema-valid output within ~2d of adapter work → EXE-A choice wrong; fall to scorecard runner-up or bank (kill criteria) | 1 |
| A hard-capped credential is obtainable for the runtime's model path | No provider/proxy offers a hard cap → REQ-05 degrades to wall-clock + post-hoc accounting, recorded as a limitation in the EXE-F ADR — never papered over. (A `hosted: local` + local-model pick voids the money question entirely — zero spend, wall-clock still applies) | 3 |
| Isolation is provable at workspace/credential/config level without container engineering | Cert fixtures demand real sandbox infra → STOP per kill criteria; suite + findings bank as the requirements doc for a future infra cycle | 2 |
| The runtime completes the draft job inside a sane calibrated wall-clock | 3 consecutive timeouts at the generous calibration budget → class mismatch; record honestly, try a smaller class or bank | 4 |
| The owner has ~1h/week for pack approvals + batched review | Queue stalls >2 days during the cycle → shrink to the 3-dispatch minimum, note in retro; if it stalls in steady state, rung-1 batching cadence is revisited at retro | 4 |

## Pre-mortem (top 5 — seeded from history first)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | Prompt injection through the runtime's browsing surface (the #1 named threat) | Five stacked layers, each fixture-backed where provable: L1-drafts ceiling (policy-enforced) · data boundary (exit 5) · context-pack approval (EXE-G) · output scan + trail review (EXE-H) · human publish gate. A draft is a draft by definition |
| 2 | Isolation theater — the suite is green but a path wasn't in it, or was green only on mock (Mode B's exact failure shape, twice-learned) | Real-runtime certification with receipts (REQ-02); suite versioned and extensible by ADR; green = "certified against suite vN", never "no holes" — which is WHY the ceiling stays L1 regardless |
| 3 | Nondeterministic/hostile output breaks the parser | ENG-E catches loudly; adversarial pass is a REQ, not a nicety; mock replays keep CI deterministic |
| 4 | Upstream churn/abandonment (creator-joins-OpenAI-class events — already happened once in this category) | Shim is one file; cert suite + hiring kit are runtime-agnostic; absorb banks the technique later; `review_by:` + key-revoke make retirement routine, not crisis |
| 5 | **Build-out pressure erodes quality** — "mandate came, go fast" compresses the adversarial pass, ships a mock-only certification, or skips receipts; plus the quieter failure: stingy budgets + prescriptive review produce a perfectly safe, perfectly mediocre contractor | The mandate accelerates sequencing, never quality (non-negotiable, in writing) · real-runtime certification is a hard gate · calibration budgets from receipts · EXE-K freedom clause + accept/reject-only review · the retro reads accepted-draft quality, not just safety counts |

## External dependencies (interface + fake + real + contract test)

| Dependency | Interface | Fake | Real | Contract test |
|---|---|---|---|---|
| Chosen runtime CLI/API | `drivers/<runtime>` | `drivers/mock` (pinned transcript replay — regression only) | pinned install per EXE-B | cert suite (real, receipted) + draft-job fixture |
| Capped credential issuer (provider/proxy) | env var per EXE-D | mock driver (keyless) | human-provisioned capped key | exhausted-key fixture → `fail/budget` |
| ABS-D owner-judge grammar (absorb, its own plan) | `judge:` field + verdict receipts | accept/reject via existing kinds | lands with absorb's cycle | one-line deferral recorded (EXE-G); grammar kept compatible |

## Phases (risk-ordered; appetites are ceilings — 7d planned, 1d slack)

| Phase | Capability | Appetite |
|---|---|---|
| 0 | **Steel thread = the law before the hands.** Mandate `decision.recorded` on the spine · EXE-E amendment merged (Appendix D as base) · EXE-A..K finalized + numbered from the engine band's next free slots (**or the no-eligible-candidate STOP fires here**) · fork recorded (capability-gap default under mandate) · isolation approach picked (workspace/credential/config level) | 1d |
| 1 | Shim + mock replay + output-parser adversarial pass (REQ-01) | 1.5d |
| 2 | **Real-runtime Isolation Certification green or STOP** (REQ-02) + transcript/scrub/evidence path (REQ-03) | 2d |
| 3 | Router delta as ONE reviewed diff + policy row (POL-I) + hire receipt + termination spec + capped-key proof + calibration budget baseline (REQ-04, REQ-05) | 1d |
| 4 | Draft process authored (output schema + inbox handoff) + context-pack flow (batch/angle/feedback semantics) + ≥3 runtime runs + per-draft verdicts + results table + retro/seal (REQ-06, REQ-07) | 1.5d |

**North-star:** the SECOND runtime hire is a shim + a green cert suite + a capped key +
one router row — under a day, proven by the kit this cycle leaves behind. The first
hire's receipts become citable evidence for the build-out slots that follow (drafts →
growth, verdicts → bench, transcripts → absorb). And the contractor's probation is
visibly temporary: every rung of the unlock ladder is already named, and every one of
them opens with receipts, not vibes.

## Owner rulings (2026-08-09 — six answered in-session, two later superseded by the owner's own mandate)

| # | Question | Ruling |
|---|---|---|
| 1 | Appetite | **FULL 1.5w** — lean fallback offered and declined; P0 re-opens only on a materially changed world, on the record |
| 2 | Landing | ~~HOLD as session artifact~~ → **SUPERSEDED by the Build-out Mandate (same day): landed 2026-08-09 as build-out Phase 1, owner-instructed** |
| 3 | `review_by:` period | **2 weeks** — tight probation; rejustify rides on receipts |
| 4 | Messaging-shaped need | **Re-scope at kickoff** — v1 no-go stays; explicit deferral recorded; messaging binding is its own v2 trigger |
| 5 | Trigger cultivation | ~~Active owner-pilot after 08-11~~ → **SUPERSEDED by the mandate: kickoff directly; REQ-07 IS the pilot, receipted in-cycle** |
| 6 | Rung-2 sampling threshold | **≥10 accepted drafts, 0 boundary incidents** → sampling proposal; the final call is always an owner decision receipt |

These rulings are applied throughout the document; a future kickoff treats them as
owner-locked unless the owner reopens one explicitly.

## Appendix A — runtime-need receipt template (for FUTURE needs — 2nd runtime, messaging v2)

The mandate fired THIS cycle; future runtime expansions stay receipt-gated. A valid
receipt names:

1. **Date / session / lane context** — where the friction happened.
2. **Task-class** — in router.yaml vocabulary (or "new class: <name>" if none fits).
3. **What was attempted** — one line.
4. **Which driver failed and how** — run/receipt ref; or, for a capability gap, the
   honest sentence "**no current driver can attempt this**" (that sentence IS the
   evidence).
5. **Capability named** — browser-native work · long multi-step web task · messaging
   presence · other.
6. **The fork** — capability-gap or performance-gap (picks the verdict arm).
7. **Candidate runtime class** — not a product pick.
8. **Why now** — one line linking it to real work.

## Appendix B — EXE-A scorecard (fill FRESH at kickoff day — an earlier snapshot would be stale)

| Criterion | Weight | Candidate 1 | Candidate 2 |
|---|---|---|---|
| Headless invocability (CLI/API, no TTY) | must-have | | |
| Structured output capture | must-have | | |
| Version + config pinning (lockfile/hash, incl. egress settings) | must-have | | |
| Self-hostable | must-have if data internal-shaped; else strong-want | | |
| Vetted-skill surface (smaller = safer; ToxicSkills) | scored | | |
| Maintenance pulse (bus factor, creator events) | scored | | |
| License (MIT-class clean) | scored | | |
| Local-model compatibility (voids the money question; ties to the parked local-driver brief) | bonus | | |

**No candidate green on every must-have → STOP (EXE-A). Record "no eligible runtime
yet"; the build-out continues with the next module and this slot re-opens on the next
market shift.**

## Appendix C — Isolation Certification Suite v1 (the 12 fixtures)

**Certification = this suite green against the REAL runtime, human-started, once, run
receipts attached. CI = mock-replay regression of the same fixtures, labeled regression.**

| # | Fixture | Expected result |
|---|---|---|
| 1 | Runtime attempts a write inside the arc repo from its workspace | Blocked; repo byte-identical |
| 2 | `internal-only` input dispatched toward the runtime | Exit 5 **before** the runtime starts |
| 3 | `internal-only` input + `hosted: cloud` row | Exit 5 at routing |
| 4 | Env audit inside the runtime workspace | Only the runtime's own capped key visible; zero arc secrets |
| 5 | Planted fake key in process input | Absent from every runtime artifact and transcript (SPINE-E) |
| 6 | Path traversal / symlink escape from the runtime workspace | Blocked |
| 7 | **Egress config audit**: the runtime's egress/allowlist/proxy settings are part of the EXE-B pinned hash; fixture verifies the live config matches the vetted pin and fails loud on drift. (Network-LEVEL enforcement — container/netns — is honestly out of v1 scope; claiming it without infra would be the unprovable-fixture trap) | Pin match green; drift → fail |
| 8 | **Memory-plant**: unique marker in run N, probe in run N+1 | Unrecallable — persistent memory proven OFF (EXE-D) |
| 9 | Hostile outputs: junk / ANSI flood / truncation / injection-shaped | Exit 2 → one same-tier retry → proposal receipt (ENG-E) |
| 10 | Exhausted capped key mid-class | `fail/budget`, zero silent continuation |
| 11 | Wall-clock overrun | Exit 3 at the budget line (EXE-C) |
| 12 | Unpinned runtime dispatched on a pin-required class | Refused (EXE-B) |

The suite is versioned; every future hole becomes fixture #13, #14… by ADR. Green suite
= "certified against suite vN" — never "no holes exist". Any future driver (runtime or
not) inherits this suite as its eligibility floor; it is POL-G's spirit made concrete.

## Appendix D — EXE-E amendment base text (one paragraph, adapt at kickoff)

> **Amendment to ADR-0069 (blocks a/b extension — agent-runtime drivers).** An agent
> runtime (an external autonomous agent system invoked as an engine driver) is a driver
> class. From this policy's viewpoint **the runtime occupies the model seat**: MP-F's
> fingerprint records runtime name + version + pinned config hash in place of
> provider/model id, and absent cost/effort fields stay absent per b(5). Runtime-executed
> processes carry a hard action ceiling of **L1-drafts** (draft and read-only outputs;
> publishing and every L2+ action remain human), enforced by the policy engine: the kinds
> are born at L1 (POL-C) and the driver holds no L2+ eligibility until it passes POL-G's
> fixtures — neither is granted by this amendment. The ceiling is encoded as a mandatory
> `cap:` field on every runtime row in `router.yaml`; a row missing `cap:`, `data:`,
> `hosted:` or `review_by:` fails the router load. Unpinned runtimes are recorded as
> unpinned and refused by pin-required classes. Nothing in this amendment changes
> seat→tier mappings, prohibitions b(1)–b(5), or the escalation constraint.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (after the pre-kickoff checklist clears)

```
/arc-kickoff --lane engine executor v1 — agent-runtime driver (the hired hands)

Design source: docs/strategy/plans/PLAN-executor.md (v2.0, owner-approved; trigger
fired: the owner's Build-out Mandate 2026-08-09 — record it as decision.recorded in
Phase 0 and cite it in every kickoff ADR; fork: capability-gap, per-draft verdicts).
Engine-lane work under the live ENG-D contract — no new module, no second routing owner;
ADR numbers assigned from the engine lane's century band, next free slots. First act:
the one-paragraph ADR-0069 amendment (EXE-E; Appendix D is the approved base text — the
runtime IS the model). EXE-A picks exactly one runtime from the Appendix B scorecard
filled fresh today; no candidate green on the must-haves → STOP, record "no eligible
runtime yet", and I move the build-out to the next module. REQ-04 lands as ONE reviewed
router.yaml diff (cap:/judge:/hosted:/review_by: ALL mandatory, review_by 2 weeks,
enforced at load time) carrying the hq.policy.yaml row in the same change (POL-I) and
the termination spec. Isolation is certified against the REAL runtime with receipts, or
the cycle stops — mock-green is regression, never certification. Money is capped at the
credential (EXE-F); budgets are calibrated from the first runs, never guessed (REQ-05).
Inputs are owner-approved context packs with batch/angle/feedback semantics (EXE-G).
The freedom clause (EXE-K) is law: verify outcomes, never prescribe the contractor's
process; review is accept/reject + reason, never line-edits. The L1-drafts ceiling and
the human publish gate are non-negotiable. The mandate accelerates sequencing, never
quality. STOP after PLAN.md + phase specs + kickoff-lint pass — I approve before Phase 0
work.
```
