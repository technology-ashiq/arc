# PROGRESS.md — Cycle 6 · arc-engine "The Model-Agnostic Foundation"

status: LIVE
cycle: arc-engine (Cycle 6, opened 2026-08-03)
phase: 02 — the engine (01 green, close held on A-01)
appetite: 14d
burn: 1.3d
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
| 01 | The proof — `arc-compile --target claude-code` reaches 3/3 byte-identical, source of truth flips, DO-NOT-EDIT header lands, codex target plus recorded goldens | 3 days | 🟡 work complete, close HELD on A-01 |
| 02 | The engine — `arc-run` headless with hard budgets, schema check, proposal-receipt escalation, secret scrub, 3 drivers behind one interface, `router.yaml` and `--driver auto` | 4 days | pending |
| 03 | Dogfood and seal — real runs on a non-Claude driver, the 4th-driver timing run, retro, lint promotion review | 2 days | pending |

**Appetite burn: ~1.3 of 14 days used (~9%).** Phases allocate 13 of 14 days; the 1 day of slack is
deliberate. The design source said "2 weeks" while its own phases sum to 13 days — that only fits a
7-day week, so the cap is written as 14 rather than left as a word that over-commits by 30%.

Basis for the 1.3, so it can be audited rather than believed: one unbroken sitting on 2026-08-03,
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
| 01 the proof | 3d | ~0.7d | CI run `30771122029`, 19/19 — close held, see `## Now` |
| 02 the engine | 4d | — | — |
| 03 dogfood and seal | 2d | — | — |

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

**Current position: Phase 00 CLOSED. Phase 01 work COMPLETE and green (19/19) but NOT closed —
its close is held on assumption A-01. ~1.3 of 14 days. Phase 02 in progress.**

**Why Phase 01 is 🟡 and not ✅.** Every technical exit criterion is met and evidenced: 3/3
byte-identical (`evidence/phase-01/req-02-byte-identical.txt`), the flip, the codex goldens, CI
19/19 (`evidence/phase-01/ci-green.txt`), and the fresh-agent adversarial pass with ~25 findings
fixed. The one unmet criterion is the one this phase spec wrote for itself: **A-01, the ADR-0069
block-(d) trigger, is still unstated.** The owner was asked at the kickoff STOP and twice since,
and answered other questions; it has not been inferred (block (b)(5): absent data is never
estimated). Waiving a criterion because the rest went well is precisely how a gate learns to be
ignored, so the row stays amber and the phase stays open. It closes on one line.

Building continues regardless — Phase 02 does not depend on A-01, and the standing instruction is
not to stall.

Standing instruction: build all four phases without stopping for per-phase sign-off, push freely,
**merge only after Phase 03 closes** (draft PR #103 carries the cycle). The main session writes the
code (ADR-0105); agents run the adversarial and verification passes the plan mandates.

**Next step: Phase 02 — `arc-run` headless, 3 drivers behind one interface, hard budgets,
proposal-receipt escalation, secret scrub, `engine/router.yaml`.** It needs no network to be
proven: every driver has a fake, and the contract suite runs the identical assertions against
each. The real arms need an LLM endpoint + key and the `codex` CLI, both owner-provided and both
recorded as not-run rather than skipped silently if absent.

**Open, and it blocks Phase 01's close (assumption A-01).** The ADR-0069 block-(d) trigger is still
recorded as **unstated** — the owner was asked at the kickoff STOP and answered a different
question, and it has not been inferred (block (b)(5): absent data is never estimated). The one
mechanically checkable trigger does not fire against any of the four lanes. If the answer is "a
second runtime is genuinely needed", that trigger is absent from block (d)'s list and needs its
amending ADR before Phase 01 can close.

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
