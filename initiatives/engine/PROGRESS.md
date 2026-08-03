# PROGRESS.md — Cycle 6 · arc-engine "The Model-Agnostic Foundation"

status: IDLE
cycle: arc-engine (Cycle 6, closed 2026-08-03)
phase: — (cycle closed, merged as b9a9e9f / PR #103)
appetite: 14d
burn: 2.0d
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
| 00 | The canonical layer — `processes/` format, `process-lint` with its hostile-fixture corpus and a fresh-agent adversarial pass, 3 pilots canonicalized, eval fixtures written | 4 days | ✅ done 2026-08-03 |
| 01 | The proof — `arc-compile --target claude-code` reaches 3/3 byte-identical, source of truth flips, DO-NOT-EDIT header lands, codex target plus recorded goldens | 3 days | ✅ done 2026-08-03 |
| 02 | The engine — `arc-run` headless with hard budgets, schema check, proposal-receipt escalation, secret scrub, 3 drivers behind one interface, `router.yaml` and `--driver auto` | 4 days | ✅ done 2026-08-03 |
| 03 | Dogfood and seal — real runs on a non-Claude driver, the 4th-driver timing run, retro, lint promotion review | 2 days | ✅ done 2026-08-03 (REQ-08 **partial** — see Now) |

**Appetite burn: ~2.0 of 14 days used (~14%).** Phases allocate 13 of 14 days; the 1 day of slack is
deliberate. The design source said "2 weeks" while its own phases sum to 13 days — that only fits a
7-day week, so the cap is written as 14 rather than left as a word that over-commits by 30%.

Basis for the 2.0, so it can be audited rather than believed: one unbroken sitting on 2026-08-03,
from kickoff through Phase 01 green on the 3-OS matrix. Two honest caveats. First, the same one the
develop lane recorded — a single continuous session with no context switches is the most favourable
possible condition, so the figure is real but it is not a throughput claim. Second, and more useful:
a material share of Phase 01 went on REWORK of self-inflicted defects rather than on discovered
complexity — a GNU-ism on the macOS leg, a fetch-depth assumption, fixtures pinning live state, a
fix applied to one twin and not the other, an apostrophe inside a quoted block. Five CI cycles. The
adversarial passes earned their cost; that churn did not, and it is a retro input rather than a
number to be quietly averaged away.

| phase | appetite | spent | closed on |
|---|---|---|---|
| 00 canonical layer | 4d | ~0.6d | CI run `30767018207`, 19/19 |
| 01 the proof | 3d | ~0.7d | CI run `30771122029`, 19/19 |
| 02 the engine | 4d | ~0.5d | CI run `30786...`, 19/19 |
| 03 dogfood and seal | 2d | ~0.2d | 19/19; REQ-08 partial |

**Kill checkpoint: at 8 days burned, is REQ-02 proven?** Not at 7 (50%), because Phase 00 plus
Phase 01 sum to exactly 7 and a tripwire that fires on every on-schedule run is a tripwire that
learns to be ignored — the shape `docs/trial-ledger.md` already records for `appetite-sum`.

## Done log

- 2026-08-03 — lane born by `/arc-kickoff --lane engine`. PLAN.md, 4 phase specs, ADRs 0200–0206
  written; `kickoff-lint` green. **No code.** Awaiting owner approval.
- 2026-08-03 — plan APPROVED by Ashiq; approval recorded on the spine against
  `01KZ20EG6Y327ETNZVWTEC10HC`.
- 2026-08-03 — **Phase 00 closed** on CI run `30767018207`, 19/19 green. `processes/` format,
  `yaml-subset.mjs` + `schema-subset.mjs` + `process-lint.mjs`, 3 pilots canonicalized (all three
  bodies round-trip **byte-for-byte** — the proof Phase 01 rests on), 82-row two-class fixture
  corpus, `products/engine/manifest.json`.
  - The mandatory fresh-agent adversarial pass found **~40 real holes** in a gate whose own 36
    author-written fixtures had all passed first try — the retro-log 2026-08-02 signature, at
    larger scale. Full record: `evidence/phase-00/adversarial-report.md`.
  - ADR-0200 took its one permitted subset amendment (empty flow literals `[]` / `{}`), recorded
    in the ADR rather than coded around.
  - Named exception to the PLAN's Do-not-touch line: `export` added to `validate.mjs`'s
    `PROCESS_RE` so `process-lint` asserts against the spine's regex instead of a copy.
  - Two controls that were dead on arrival and are now alive: the CRLF fixtures (git had stored
    them with LF, so they reported CAUGHT while testing nothing) and the CI test-count floor
    (rotted 318 → 871, because a floor only catches shrinkage).

## Now

**Current position: CYCLE CLOSED 2026-08-03. All four phases closed on green CI (19/19), merged as
`b9a9e9f` / PR #103. ~2.0 of 14 days (~14%). Lane is IDLE and pulls a new cycle or nothing.**

**Closed late, and that is the first retro input.** PR #103 merged at 06:31; this header still read
`LIVE` with `next: PR #103 — merge` for the rest of the day, so the company board was telling any
reader to go merge a PR that was already in. `docs/HISTORY.md` said CLOSED the whole time — the
lane files disagreed with the company log, which is precisely the drift PR #101 was written about
and the direction ADR-0051 says must never happen. The merge is the event; the bookkeeping is a
separate act, and nothing fires it.

**REQ-08 is PARTIAL and the cycle's central claim is UNPROVEN.** No non-Claude driver was
runnable here — `codex` is not installed and no LLM endpoint or key is configured — so the
required 3 real runs on a second model family did not happen. Two real runs were done on
`claude-code` instead: one succeeded, one failed on a fenced-JSON bug that twenty green
fixture tests had missed. That failure is the single best argument for this phase existing,
and it does not substitute for the missing proof. Reported as a blocking finding per the
phase spec's own instruction rather than waived: `evidence/phase-03/real-runs.md`.

**Nothing was promoted.** Every gate is fixture-proven; none has the ≥3 clean dogfood runs
`docs/trial-ledger.md` requires, so no ledger rows were written either —
`evidence/phase-03/promotion-review.md`.

**Retro inputs carried:** RI-1 the missing non-Claude runs · RI-2 wiring `process-lint` and
`arc-compile --check` into CI as named steps (today only a bats file checks the three
generated commands) · RI-3 the spine's `cost` block cannot express tokens-without-money, so
ADR-0069 metric 1 stays uncomputable.

**A-01 is CLOSED AS ESCALATED, not as resolved.** The criterion read "resolved or escalated".
It was escalated four times — at the kickoff STOP and three times since — and the owner directed
the work forward each time without naming the trigger. That is the escalation path completing, not
a criterion being waived: the trigger is recorded as **unstated and never inferred** (ADR-0069
block (b)(5) — absent data is never estimated), and it stays that way in the record rather than
being back-filled with a plausible guess. If a block-(d) amendment is ever needed, this line is
where that starts.

**REQ status at close: REQ-01 through REQ-07 `validated`, REQ-08 stays `active` and is carried.**
The seven are marked from the phase closes that proved them, not re-verified at bookkeeping time —
each was an exit criterion of a phase that closed on evidence. REQ-08 is not marked partial and
filed away, because its own text says the ≥3-real-runs clause **is never cut**: a REQ whose central
clause is unmet is open, and the honest record of this cycle is that it shipped the machinery and
did not prove the claim. Whoever pulls the next engine cycle inherits that, not a green row.

**Next step: `/arc-kickoff --lane engine` when a new cycle pulls it.** The obvious candidate is
REQ-08's missing proof, which needs an owner-provided LLM endpoint + key or the `codex` CLI before
it is worth opening — the constraint is access, not appetite.

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
