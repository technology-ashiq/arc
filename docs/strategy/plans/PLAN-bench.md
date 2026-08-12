# PLAN (design source) — bench runner v1: "the model market"

> **Freeze log:** v0.1 2026-08-02 (brief→plan expansion) → v0.2 2026-08-02 (repo
> grounding: lanes, spine mapping, tier ladder) → v0.3 2026-08-02 (owner review round 1:
> 16 accepted / 1 rejected — a 70/20/10 weighted composite, reason in BEN-A) → v0.4
> 2026-08-02 (owner review round 2: 8/8 accepted — driver-explicit CLI, K-group budget
> reservation, partial-run proposal bar, baseline re-pin causes, comparability split,
> per-class floor, REQ-05 preflight, BEN-F wording) → **v1.0 2026-08-12, landed
> owner-approved ("Sari plan ah repo la podu"), re-grounded to the post-mandate repo**
> (engine C6 closed · ADR-0069 law · constitution adopted · policy C9 live · ADR
> centuries · vocabulary extensible by micro ADR). Decisions BEN-A..H locked; real ADR
> numbers at kickoff from the century claimed per `PORTFOLIO.md`.

> **Trigger (pull):** ≥2 drivers in REAL use AND they disagree on quality/cost for some
> task class — OR a new model's arrival makes re-evaluation worth a day.
> **Prereqs (hard):** the engine lane's driver fleet in real use with receipts. Engine C6
> (closed 2026-08-03) shipped bench's handshake — task-class-tagged, revisioned eval
> fixtures · `engine/router.yaml` · MP-F `run.completed` payloads · the eligible-cost
> rule; the agent-runtime driver fleet arrives via `PLAN-executor.md` ON THE ENGINE LANE.
> **Deliberately NOT converted under the Build-out Mandate (2026-08-09):** bench's gate
> is a PREREQ, not trigger-patience — a runner with no road benches nothing. When ≥2
> drivers are genuinely in use, the mandate (or the original pull) fires this plan.
> **Cascade rule:** a new-model event while the fleet doesn't exist lands on the ENGINE
> lane (provider-event trigger, ADR-0069 block (d)), never here — no quick-bench
> exceptions.
> **Lane:** bench runs as lane `bench`, born ONLY by the kickoff prompt below
> (`/arc-kickoff … --lane bench`, ADR-0054); workspace `initiatives/bench/`; board row in
> the same commit (ADR-0061/0062); **claims the next free ADR century per
> `PORTFOLIO.md`**. Mode A only (ADR-0056 — Mode B remains uncertified).
> **Do not start before the trigger fires** (Constitution A8 — adopted v1.0 2026-08-06).

## Goal

One sentence: `arc engine bench --driver <driver> --model <provider/model> --budget
inr=<cap>` (namespace inherited from the engine's ENG-D decision — re-verify the 0200s
ADR at kickoff) runs every fixture-shipping process against ONE explicitly-named
driver+model pair, scores contract-compliance + assertion pass-rate + cost + latency
with deterministic checks, and emits a **propose-only router diff whose evidence,
approval and verdict all live on the spine as ordinary receipts** — so a new model
becomes a same-day, receipted routing decision instead of a migration project, and a
silently-drifting champion is caught within a month.

## Current state (verified 2026-08-12 — MUST re-verify at kickoff)

- **Engine C6 CLOSED 2026-08-03** (PR #103; 2.0d of 14d — a scope-banked cycle):
  `processes/` holds the 3 canonical pilots (commit-msg-draft · review-diff ·
  kickoff-plan) and `engine/router.yaml` is live at root — both company organs
  (ADR-0053); the old `products/engine/` layout ambiguity is RESOLVED. ENG decisions
  hold the 0200 century (0200–0206 taken). **Kickoff must re-verify exactly which ENG
  REQs shipped vs banked** — the trigger's "in REAL use" clause is NOT met today, and
  the driver fleet is executor-plan territory (engine lane, no new century; its first
  act amends ADR-0069 so the RUNTIME is part of the model seat, and its REQ-04 evolves
  `router.yaml` with `cap:/judge:/hosted:/review_by:` fields — bench reads whatever
  schema is then live).
- **The bench handshake already exists** (engine plan v2, REQ-01/05 — written FOR this
  plan): eval packs carry a revision field, each fixture a task-class tag, target ≥5
  fixtures per exercised class (classes the pilots don't touch honestly hold 0); drivers
  answer `--version`; every run's `run.completed` carries the MP-F fingerprint and the
  eligible-cost rule (provider usage × pinned pricing snapshot = derived; neither
  available → absent, NEVER estimated — ADR-0069 b(5)). Bench inherits its fuel with
  zero re-instrumentation.
- **Balanced Model Policy = LAW (ADR-0069, C5):** tiers by policy name, b(1) no runtime
  tier changes (bench is propose-only by constitution of the policy, not just by taste),
  b(5) absent-never-estimated, MP-F fingerprint definition — bench REUSES all of it,
  inventing no parallel vocabulary. Constitution adopted v1.0 2026-08-06 (receipt
  `01KZ9V0QXNNMB3ZH18MSH8DKH3`).
- **Policy engine LIVE** (C9 merged 2026-08-08 PR #130, cycle closed 08-10;
  `hq.policy.yaml` at root): bench emits existing kinds only, but kickoff runs the POL-I
  check — if the policy registry keys the bench process/actions, the rows land in the
  same change.
- **Spine vocabulary is extensible now** — micro vocab ADRs against live `KINDS.length`
  added develop/policy/metric kinds (e.g. `metric.observed`, ADR-0408). Bench still
  needs **zero new kinds** (BEN-H): `run.completed` / `approval.requested` /
  `decision.recorded` are long-stable; the inbox (open `approval.requested`,
  ADR-0027/0030) is the needs-you surface; `arc-inbox` decisions carry schema-mandatory
  reasons with idem bound to the approval ULID.
- **Scheduler plan is ready** (mandate-converted; `hq.jobs.yaml`, v1 jobs are
  script-class ₹0 ONLY) — bench's champion guard costs money, so it is NOT a scheduler
  v1 job; it stays owner-started monthly until the jobs ladder admits spend-class jobs
  (BEN-F).
- **ABS-D owner-judge grammar exists** (absorb C10 closed 2026-08-10, 0600s) — bench's
  REQ-05 human verdict framing inherits it (the strategy README records this handoff).
- **Live-slot rule (A9):** leads C8 is LIVE (Phase 03 running) — bench kickoff requires
  a free live slot per the standing A9 gate.
- N = number of processes shipping fixtures at kickoff (3 pilots today). Bench value
  scales with N; bench never creates fixtures.

## Success requirements

(numbering 1:1 with the archived BRIEF-bench)

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-01 | One command, full scorecard, honestly reproducible | **CLI contract:** `arc engine bench --driver <driver> --model <provider/model> --budget inr=<cap>` — **driver explicit and mandatory for a candidate run** (the same model id via a different driver is a DIFFERENT bench subject); `--champion` mode resolves driver+model pairs from the live router table. Runs EVERY fixture-shipping process for ONE candidate: per-process schema pass-rate AND assertion pass-rate (never combined), median cost (INR) + median latency over **K runs per fixture** (BEN-B, default 3), executed **sequentially** (BEN-E). Every run records the provenance tuple (BEN-B) and captures raw outputs (redacted). **Replay proof:** re-scoring captured outputs → byte-identical scorecard (fixture-proven). Live rerun variance is REPORTED, never presented as certainty. Report artifact under `initiatives/bench/evidence/` + one `run.completed` (`process: bench@x.y.z`, `model: <provider/model>`, MP-F fingerprint, eligible cost) | 0 |
| REQ-02 | Routing change = reviewable proposal, never a mutation | `--propose` emits THREE artifacts: human evidence table per task class · machine-readable results manifest · **stable unified diff pinned to the exact router SHA the run read**. Eligibility is gates-first (BEN-A) **including the completeness gate: a class in which any selected fixture was skipped, budget-aborted, or ended non-scoreable proposes NOTHING**. Any gate failing → **`NO PROPOSAL — insufficient or unsafe evidence`** for that class, never a misleading diff. **A partial run is diagnosis, not promotion evidence — flagged `partial`, proposal-barred.** Proposal leaves `approval.requested` (gate `router-merge`) on the spine. Bench has NO write path to the live router — fixture proves it byte-unchanged after any run | 1 |
| REQ-03 | Silent provider drift gets caught | `bench --champion` re-runs current champions and compares along **split comparability axes (BEN-D)**: quality comparison requires quality-compatibility (fixture/eval revision · process version · driver version · model id · request settings); cost comparison requires token usage + pricing snapshot, with the delta **classified** {provider-rate change · token-use/output-length change · unknown/mixed}. Three-tier alerts (BEN-D) land as inbox items / report lines. **Baseline re-establishes whenever a compatibility component changes, the breaking reason stated on the receipt** — a score movement alone is never a re-pin cause. Owner-started monthly (BEN-F) | 2 |
| REQ-04 | Benching can't silently burn money | **Admission control at fixture-group granularity (BEN-E): before a fixture starts, reserve K × its worst-case per-invocation spend** against BOTH the run cap and the process sub-cap; if the remainder can't cover the whole group, the fixture is NOT started (recorded `failure: budget`, skipped, evidence kept — its class becomes `NO PROPOSAL` per REQ-02). Post-call reconciliation with measured provider cost; the engine's budget machinery is the backstop. Cap exhausted → abort remaining, partial report, `run.completed` `outcome: fail`, `payload.reason: "budget"` | 0 |
| REQ-05 | The loop is proven on a real event | **Preflight (recorded before Phase 2 starts):** candidate is genuinely new to arc · reachable through an EXISTING engine driver · credentials/access verified. Then: one real model benched end-to-end → proposal → human MERGED or REJECTED through `arc-inbox --reason` (`decision.recorded`, reason schema-mandatory), the verdict framed per the **ABS-D owner-judge grammar**. **Both outcomes are success** — evidence-backed routing, not forced adoption | 2 |

## Appetite

**4 days hard cap.** By the mechanical ladder (S ≤ 3d) that is **Tier: M** — buys the ×3
attacker panel + simulation gate at kickoff. **Owner call at kickoff:** keep 4d/M
(recommended — parser-class code) or cut to 3d and take Tier S.
**Kill criteria (50% tripwire):** 2d burnt without REQ-01's replay proof green on ≥3
processes → the scoring approach is wrong; bank the scorecard format + any fixture
strengthening, stop, retro. · Fixtures cannot discriminate champion vs candidate on ANY
process by 2d → stop benching, spend the remaining appetite strengthening that process's
own evals (pre-mortem #1's exit, taken deliberately).

## Decisions to ADR at kickoff

Defaults bold — confirm every number at kickoff; real ADR numbers from the lane's
claimed century (`PORTFOLIO.md`), each with Reversibility and, for one-way doors, a
Revisit trigger.

| ID | Decision |
|---|---|
| BEN-A | Selection policy: **hard gates first, then explainable ranking — no composite score.** Eligibility gates (ALL must pass, else `NO PROPOSAL` for that class): **completeness — every selected fixture in the class finished all K attempts with a scoreable outcome (schema/assertion pass or fail); any skip, budget-abort, transport failure or timeout disqualifies the class** · no schema regression vs champion · assertion pass-rate ≥ champion − **2pp** · fixture coverage ≥ MIN_FIXTURES **per task class** (BEN-D) · cost source eligible & comparable (BEN-D cost axis, ADR-0069 b(5)) · candidate ran the SAME eval-pack revision as champion. Among eligible: assertion within ±**2pp** → lower median cost wins; above +2pp → quality wins; **p95 latency reported, tiebreak-only**. Verdicts per task class — never one global average. A weighted composite (70/20/10) was REJECTED on the record 2026-08-02 — mixes units (%, ₹, ms), the normalization choice silently dominates, and a blend hides WHICH dimension moved (ADR-0049 / "a score needs a visible scale"); two-way door via ADR amendment |
| BEN-B | Reproducibility contract — **replay-deterministic, variance-honest.** Provenance tuple recorded on every run: fixture IDs + input SHAs · eval-pack revision · process version · **driver name + `--version` (explicit CLI subject — same model, different driver = different subject)** · exact model ID + **MP-F fingerprint (ADR-0069; verify the executor amendment's runtime-in-the-seat state at kickoff)** · request settings · router SHA · pricing snapshot · timestamp · normalized results. Scoring captured outputs is pure: replay → byte-identical scorecard. Live calls: **K = 3** per fixture, temp 0 where offered, medians reported WITH spread. Absent fields stay absent — never estimated (b(5)) |
| BEN-C | Record + report schemas. Per-fixture normalized record: process + task class · fixture ID + input SHA · eval-pack revision · driver + model fingerprint · schema pass/fail · assertion pass/fail · latency · token/provider cost + INR estimate (eligible-cost rule) · failure category ∈ {transport, budget, schema, assertion, timeout} · redacted artifact ref. Proposal row: task class · current champion · candidate · contract result · quality result · cost Δ (classified) · latency Δ · recommendation. Three artifacts per REQ-02; raw results under `initiatives/bench/evidence/`. The diff never travels without the table |
| BEN-D | Drift + comparability — **two axes, three tiers, per-class floor.** *Quality comparability:* fixture/eval revision · process version · driver version · model id · request settings. *Cost comparability:* token usage + pricing snapshot; cost deltas classified {provider-rate change · token-use change · unknown/mixed} so a price hike is never hidden behind an "incompatible baseline". *Alerts:* (1) any new schema failure in a previously-clean champion → immediate inbox item · (2) assertion drop ≥ **10pp** AND ≥ **2** fixtures fail → inbox item · (3) cost increase > **20%** → REPORT-ONLY. Alerts only where the class ships ≥ **MIN_FIXTURES = 5** (per task class — engine's handshake targets exactly this) and the drop exceeds the recorded baseline variance band. *Baseline re-pin:* re-establishes whenever a quality-compatibility component changes OR a routing change is merged; **the receipt states the compatibility-breaking reason; a score movement alone is NEVER a re-pin cause** (anti-goalpost clause). Baseline refresh is a measured observation — human approval is only for routing changes. False alert = retro item → ADR recalibration |
| BEN-E | Budget — **admission control at fixture-group granularity, sequential v1.** Reservation unit = **K × worst-case per-invocation spend**, checked against BOTH the full-run cap and the process sub-cap BEFORE the group starts (provider cost is only known after a call — post-call checking alone is not a cap). Can't cover the whole group → don't start it. **Fixture execution is sequential in v1** — no reservation-ledger races; parallel bench = a separate later decision. Defaults: full-run **₹500**, per-process **₹100** — PLACEHOLDERS priced 2026-08, re-price at kickoff against the then-current pricing snapshot; caps visible in every report |
| BEN-F | Guard cadence: **monthly, first working day, owner-started.** A clean guard run emits ONLY `run.completed` — **no approval event exists for a no-drift run** (the spine never carries no-op approvals); `approval.requested` is created ONLY by drift findings (gate `drift`) and router proposals (gate `router-merge`). A missed month is detectable from the spine itself (no champion `run.completed` that month). Scheduler note: v1 scheduler jobs are script-class ₹0 — the guard becomes a scheduled job only when the jobs ladder admits spend-class jobs, by ITS decision, not this plan's |
| BEN-G | "Quality" in v1 = **assertion pass-rate, nothing more** — no LLM judges, no human panels. Richer signals = a separate brief, pulled by a real mis-ranking incident |
| BEN-H | Spine mapping — **zero new kinds**: `run.completed` with `process: bench@x.y.z` · `approval.requested` gates `router-merge` / `drift` (the engine's own escalation-proposal receipts set this exact precedent, ENG-E v2) · `decision.recorded` via `arc-inbox` · all emits first-party `--strict` (ADR-0031/0032) · evidence paths POSIX-relative into the lane's evidence dir · baseline re-pin reason rides the establishing run's `run.completed` payload. Fallback if spine ownership rejects the reading: a **micro vocab ADR against live `KINDS.length`** (the established develop/policy/metric pattern) — a separate deliberate decision, never an improvised kind |

## Non-negotiables

- Propose-only: a human merges every routing change; bench has no write path to the
  router (fixture-enforced; ADR-0069 b(1) makes this policy law, not preference).
- Fixtures = the same eval packs processes ship — no bench-only forks.
- Deterministic checks only; no LLM-judges-LLM in v1 (BEN-G).
- **One candidate driver+model pair per bench run** (v1) — driver named explicitly; no
  tournaments, no sweeps.
- **Per-task-class verdicts only** — never one collapsed average across processes.
- Schema pass-rate and assertion pass-rate stay SEPARATE.
- **A partial run never emits a proposal** — preserved as diagnosis, flagged `partial`,
  affected classes read `NO PROPOSAL` (REQ-02/BEN-A).
- **One failed fixture cannot erase the rest of a run's evidence** (fixture-proven, P3).
- **Sequential fixture execution in v1** (BEN-E).
- Human-started runs only; no auto-scheduling (BEN-F); a clean guard run leaves no open
  approval on the spine.
- No new spine kinds (BEN-H); standard emitter, first-party `--strict`; real vs simulated
  never mixed; secret redaction verified on ALL stored bench artifacts (SPINE-E / engine
  REQ-07 inheritance).
- Offline-first: bench's own tests run against the engine's **`drivers/mock`** (ENG-F,
  pinned replay) — real drivers touch money only in real runs; tests centralised in
  `tests/` (ADR-0021).
- Mode A only (ADR-0056). Adversarial pass on scorecard parser + diff generator before
  FAIL promotion (parser-class rule); new lint starts WARN in TRIAL.
- Mid-cycle changes via `/arc-change --lane bench` — never ad-hoc.

## No-gos

No public leaderboard · no auto-merge / auto-apply / automatic model switching · no new
spine kinds in this cycle (BEN-H's micro-ADR fallback is the only door, its own decision)
· no new-driver creation from inside bench (drivers = engine/executor territory) · no
prompt optimization · no score-database product (spine + artifacts are the record; the
dashboard brief reads them later) · no scheduler/cron work · no eval-framework rewrite ·
no benching interactive sessions (headless engine runs only) · no parallel fixture
execution in v1 · no amending ADR-0069 from inside this cycle.

## Assumptions ledger (cap 7 — each with its falsification trigger)

| # | Assumption | Falsified when → then |
|---|---|---|
| 1 | The engine lane (C6 + executor work) delivers ≥2 drivers in REAL use with `run.completed` receipts | Kickoff-day census finds fewer → the trigger never fired; bench stays asleep (this is the gate working, not failing) |
| 2 | Per-task-class fixture counts reach the BEN-D floor for the classes worth routing | Counts < 5 for a class → that class reads `NO PROPOSAL — evidence insufficient` until the OWNING process's evals grow (kill-criteria exit redirects appetite there) |
| 3 | A full bench run fits the BEN-E cap at kickoff-time prices | Kickoff re-pricing says no → raise cap by explicit decision or trim K / process set |
| 4 | A bench run is semantically a `run.completed` (no new kind) | Spine ownership rejects → BEN-H fallback: micro vocab ADR against live `KINDS.length` |
| 5 | The monthly manual guard actually gets run — **absence is visible on the spine** | 2 consecutive missed months → a spend-class scheduler job becomes the recorded ask |
| 6 | The CLI namespace (`arc engine bench` assumed) and the router.yaml schema (executor's `cap:/judge:/hosted:/review_by:` fields) are stable inheritances | Either moved → kickoff re-verifies against the live ENG-D ADR (0200s) and the live router schema; bench NEVER forks its own |

## External dependencies

Candidate model APIs — reached **only through engine drivers** (interface = the live
ENG-D contract · fake = `drivers/mock` (ENG-F, pinned replay) · real = the generic-api /
agent-runtime drivers · contract test = schema-validated outputs on all drivers). REQ-05
preflight verifies driver support + credentials BEFORE the real event. Bench adds no new
external dependency of its own.

## Rabbit holes

Statistical rigor spiral (K-runs + medians + the variance band is v1; upgrading needs a
real false-alert incident) · composite-score philosophy (settled, reopening door named in
BEN-A) · latency micro-benchmarking (network jitter ≠ model speed) · "just one LLM judge"
(BEN-G's no) · report/diff UI polish (the evidence table IS the interface) · spine-kind
bikeshedding (BEN-H settles it) · multi-candidate tournaments · parallel execution +
reservation-ledger engineering (sequential v1 makes it moot).

## Pre-mortem (top 5)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | Eval fixtures too weak / too few per class | Kill-criteria exit + per-class MIN_FIXTURES floor + `NO PROPOSAL`; strengthening flows to the owning process (that value returns to everything) |
| 2 | Bench cost surprise | K-group admission control (reserve before start) + dual caps + sequential execution + engine backstop; eligible cost on every receipt |
| 3 | Scores trusted blindly / partial evidence promotes | Gates-first incl. completeness gate; partial runs flagged and proposal-barred; the only write path is a human `arc-inbox` decision with a schema-mandatory reason |
| 4 | Drift guard cries wolf or goes blind | Three-tier rule + split comparability axes (a price change can't blind the quality guard, and a price hike can't hide) + variance band + enumerated re-pin causes with receipts + the anti-goalpost clause |
| 5 | Hot new model + fleet not ready → "quick bench" hack pressure | Cascade rule in the trigger banner: that event lands on the ENGINE lane; bench without the fleet does not exist |

## Phases

| Phase | Capability | Depends on | Appetite | Exit proof |
|---|---|---|---|---|
| 0 — Bench core | Fixture discovery over the engine's task-class-tagged eval packs · explicit `--driver`/`--model` candidate execution via engine drivers (`drivers/mock` in tests) · deterministic scorer with provenance capture · **K-group admission-controlled budget, sequential execution** · `run.completed` (+MP-F fingerprint, eligible cost) · build-time adversarial pass on the scorecard parser | — | 1.25d | Captured outputs replayed → byte-identical scorecard · budget-exhaust fixture: the group that can't be covered NEVER starts, evidence intact, class marked |
| 1 — Router proposal | Evidence table per task class · machine-readable manifest · stable unified diff pinned to router SHA (live schema, executor fields included) · gates-first eligibility incl. completeness gate · `NO PROPOSAL` path · `approval.requested` (gate `router-merge`) | 0 | 1d | Router checksum unchanged after any run · diff applies cleanly as a REVIEW artifact only · a gate-failing class AND a partial run each yield `NO PROPOSAL`, never a diff |
| 2 — Drift guard + real event | Champion baseline pinning with enumerated re-pin causes · split-axis comparison + cost-delta classification · three-tier alerts → inbox · **REQ-05 preflight (new + driver-supported + access verified)** · ONE real model end-to-end → proposal → human merge/reject with reason (ABS-D grammar) | 1 | 1.25d | Drift-alert fixture fires each tier correctly · re-pin receipt names its compatibility-breaking cause · real candidate reaches a recorded accept/reject decision |
| 3 — Seal + retro | System-level adversarial fixtures (malformed eval output · unknown model · missing cost · budget edges incl. the K-group boundary · nondeterministic ordering · **attempted router mutation**) · secret-redaction verify on all stored artifacts · partial-failure evidence preservation proof · docs/runbook · retro | 2 | 0.5d | Full suite green · total bench cost + outcome on the spine · retro answers: "did the eval packs discriminate?" — if not, the follow-up strengthens the OWNING process's evals, not bench |

**North-star:** a brand-new model goes from "announced" to "routed or rejected, with the
whole chain — run, proposal, verdict, reason — readable off the spine" in one sitting,
under the budget cap, with zero router edits a human didn't merge.

## Changes vs BRIEF-bench (traceability — the brief is archived at `docs/archive/BRIEF-bench.md`)

1. Reproducibility redefined: replay-determinism + the provenance tuple + variance
   reported (the brief's "same config → same scores" is not a keepable promise for
   nondeterministic models).
2. "Quality" pinned to assertion pass-rate only (BEN-G).
3. Drift guard: three-tier rule + split comparability axes + per-class floor (BEN-D).
4. Budget promoted to a named decision with K-group admission control (BEN-E).
5. Guard cadence explicit: monthly, first working day, manual; clean runs leave no
   approval events (BEN-F).
6. Cascade rule: a new-model event without the fleet lands on the engine lane.
7. Kill criteria added; Phase 3 seal added; CLI made driver-explicit.
8. No-gos extended; spine mapping locked to existing kinds (BEN-H).

## Adjudication history (2026-08-02, two owner review rounds — 25 rulings)

**Round 1 — 16 accepted / 1 rejected.** Accepted: provenance-tuple reproducibility ·
one-candidate-per-run · per-task-class verdicts · central tests (ADR-0021) · 4-phase
split with the seal · per-fixture record + failure taxonomy {transport, budget, schema,
assertion, timeout} · admission-controlled budget · three review artifacts + router-SHA
pinning · gates-first eligibility + same-eval-revision + the `NO PROPOSAL` null result ·
the 2pp safety band · three-tier drift alerts · first-working-day cadence · seal
checklist · engine-layout inheritance · both-outcomes-are-success. **Rejected: a
70/20/10 quality/cost/latency weighted composite** — units don't mix (%, ₹, ms), the
normalization choice silently dominates, a blend hides which dimension moved (ADR-0049 /
"a score needs a visible scale"); replaced by gates → ±2pp band → cost → p95
tiebreak-only. Two-way door: one ADR amendment reopens it.

**Round 2 — 8/8 accepted (three fixed round-1-era rules):** driver-explicit CLI
(`--driver` mandatory for candidates) · reservation unit = K × worst-case + sequential v1
(fixed a 3× under-reserve) · the partial-run proposal bar via the completeness gate
(fixed a selection-bias leak: cheap fixtures run first, cost medians bias low) ·
enumerated baseline re-pin causes (fixed a deadlock: a merge-only rule froze the guard on
the first eval-pack bump) · quality/cost comparability split with classified cost deltas
· MIN_FIXTURES explicitly per task class · the REQ-05 preflight · BEN-F reworded so a
clean monthly run creates no no-op approval.

**Re-grounding v0.4 → v1.0 (2026-08-12, facts only — no adjudicated rule changed):**
engine C6 closed with the handshake shipped and the layout resolved (root organs) ·
ADR-0069 + constitution + policy engine now law/live · ADR numbering moved to
lane-claimed centuries · vocabulary extensibility moved to micro vocab ADRs (BEN-H
fallback rewording) · scheduler hand-off nuanced (₹0 job classes) · ABS-D inheritance
recorded · executor plan named as the fleet's path · mandate non-conversion put on the
record.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (ONLY after the trigger fires: ≥2 drivers in REAL use, verified)

```
/arc-kickoff bench runner — the model market --lane bench
Design source: docs/strategy/plans/PLAN-bench.md (v1.0, approved; trigger fired: <drivers
disagree on X / new model Y>; driver-fleet census attached; per-task-class fixture counts
checked). Read it fully. Gates first: live slot free (A9) · claim the next free ADR
century per PORTFOLIO.md · POL-I policy-row check · verify the live ENG-D CLI namespace
and router.yaml schema (executor fields) · verify the MP-F runtime-amendment state.
Appetite 4 days → Tier M by the ladder; I confirm keep-4d/M vs cut-to-3d/S at step 1.
Decisions BEN-A..H are drafted with defaults — confirm every number (2pp band, K=3,
MIN_FIXTURES=5 per class, three-tier drift thresholds, ₹500/₹100 caps vs the pricing
snapshot, first-working-day cadence) against the shipped engine, then assign ADR numbers
from the claimed century. Propose-only + deterministic scoring + shared fixtures + one
candidate per run + driver-explicit CLI + per-task-class verdicts + partial-never-proposes
+ zero new spine kinds are LOCKED. Re-verify the current-state section — it was written
2026-08-12. STOP after PLAN.md + phase specs + kickoff-lint (+ simulation gate if Tier M)
— I approve via arc-inbox before Phase 0 code.
```
