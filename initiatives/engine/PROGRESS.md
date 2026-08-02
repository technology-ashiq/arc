# PROGRESS.md — Cycle 6 · arc-engine "The Model-Agnostic Foundation"

status: LIVE
cycle: arc-engine (Cycle 6, opened 2026-08-03)
phase: 00 — the canonical layer, in progress
appetite: 14d
burn: 0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane engine` on 2026-08-03 and claims **ADR band
> 0200–0299**. Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`)
> stay at root and are never copied here (ADR-0053); evidence is lane-scoped at
> `initiatives/engine/evidence/phase-NN/` (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-engine-process-layer.md` (frozen — the decision record,
> not the cycle). Model policy is inherited from `docs/adr/0069-balanced-model-policy.md`.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | The canonical layer — `processes/` format, `process-lint` with its hostile-fixture corpus and a fresh-agent adversarial pass, 3 pilots canonicalized, eval fixtures written | 4 days | pending |
| 01 | The proof — `arc-compile --target claude-code` reaches 3/3 byte-identical, source of truth flips, DO-NOT-EDIT header lands, codex target plus recorded goldens | 3 days | pending |
| 02 | The engine — `arc-run` headless with hard budgets, schema check, proposal-receipt escalation, secret scrub, 3 drivers behind one interface, `router.yaml` and `--driver auto` | 4 days | pending |
| 03 | Dogfood and seal — real runs on a non-Claude driver, the 4th-driver timing run, retro, lint promotion review | 2 days | pending |

**Appetite burn: 0 of 14 days used (0%).** Phases allocate 13 of 14 days; the 1 day of slack is
deliberate. The design source said "2 weeks" while its own phases sum to 13 days — that only fits a
7-day week, so the cap is written as 14 rather than left as a word that over-commits by 30%.

| phase | appetite | spent | closed on |
|---|---|---|---|
| 00 canonical layer | 4d | — | — |
| 01 the proof | 3d | — | — |
| 02 the engine | 4d | — | — |
| 03 dogfood and seal | 2d | — | — |

**Kill checkpoint: at 8 days burned, is REQ-02 proven?** Not at 7 (50%), because Phase 00 plus
Phase 01 sum to exactly 7 and a tripwire that fires on every on-schedule run is a tripwire that
learns to be ignored — the shape `docs/trial-ledger.md` already records for `appetite-sum`.

## Done log

*(nothing yet — the cycle has not started)*

- 2026-08-03 — lane born by `/arc-kickoff --lane engine`. PLAN.md, 4 phase specs, ADRs 0200–0206
  written; `kickoff-lint` green. **No code.** Awaiting owner approval.

## Now

**Current position: plan APPROVED by Ashiq 2026-08-03. Phase 00 in progress.**

Approval recorded on the spine against `01KZ20EG6Y327ETNZVWTEC10HC`. Standing instruction: build all
four phases without stopping for per-phase sign-off, push freely, **merge only after Phase 03
closes**. The main session writes the code (ADR-0105); agents run the adversarial and verification
passes the plan mandates.

<details><summary>Pre-approval position (kept as the record)</summary>

**The plan existed and was not yet approved. Zero days burned, zero code written.**

`/arc-kickoff` has produced `PLAN.md`, `phases/phase-00-spec.md` through `phase-03-spec.md`, and
seven ADRs (0200–0206) covering ENG-A…E plus the two forks the design source left open — the shared
body with no per-target passthrough (0205) and the `agent.invoke` taxonomy extension (0206). An
`approval.requested` receipt is on the spine; its ULID is the approval id.

**Next step: the owner approves or amends the plan.** On approval, Phase 00 opens with
`/arc-develop start 0 --lane engine` — the steel thread is one canonical process file that
`process-lint` reads and rules on, entirely offline.

**Open before Phase 01 closes (assumption A-01):** which ADR-0069 block-(d) trigger fired is
recorded as **unstated**, not inferred. The one mechanically checkable trigger — a lane `PLAN.md`
naming public release or external users — does not fire against any of the four lanes. If the
answer is "a second runtime is genuinely needed", that trigger is absent from block (d)'s list and
needs its amending ADR first.

</details>
