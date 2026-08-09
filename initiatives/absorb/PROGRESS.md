# PROGRESS.md — arc-absorb "the technique refinery"

status: LIVE
cycle: arc-absorb (Cycle 10, born 2026-08-09)
phase: 02 — starting (00, 01 CLOSED)
appetite: 8d
burn: 2.0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane absorb` on 2026-08-09 and claims **ADR band
> 0600–0699** (ADR-0600..0606). Company organs (`docs/adr/`, `docs/retro-log.md`,
> `docs/trial-ledger.md`, `tests/`) stay at root and are never copied here (ADR-0053); evidence
> is lane-scoped at `initiatives/absorb/evidence/phase-NN/` (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-absorb.md` v1.0 (frozen — the decision record, not
> the cycle). ABS-A..F are locked there; **ABS-G was decided at this kickoff as ADR-0606**.
>
> **Birth condition — read this before questioning the cycle's legitimacy.** None of the design
> source's three gates passed on 2026-08-09: the live slot was held by leads and policy, the
> venture clock ran to 2026-08-11, and **no trigger arm had fired**. The owner was shown that
> audit and ruled arc-first. **ADR-0074** records the ruling, defers the venture clock explicitly,
> waives the four-arm trigger gate for this cycle only, and **flags the A8 tension for the owner
> rather than resolving it**. A later session that notices "no arm fired" should read ADR-0074,
> not reopen the question.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread: the matrix and its paperwork — DEV-B/C boundary audit, registry shape finalized, ADR-0601 template + `report-lint` (WARN-first) | 1d | ✅ CLOSED 2026-08-09 |
| 01 | Study harness, hostile-input-first — read-only pipeline, injection red corpus, adversarial pass, no-execution boundary fixture-proven **or STOP** | 2d | ✅ CLOSED 2026-08-09 |
| 02 | Registry and guards — status lint (cap 12, displacement, decision-ref), allowlist lint, license/attribution gate, PLANOFF skeleton | 1d | ⬜ not started |
| 03 | Governance drop — ADR-0603 owner-judge profile + blind mechanics + inbox chain, REQ-05 `PLAN-develop` addendum + freeze-log line + Toolbox template | 1d | ⬜ not started |
| 04 | The real absorb — ADR-0606's target end-to-end, 3-fixture A/B, sealed-blind judgement, adoption proposal, decision recorded, retro | 1.5d | ⬜ not started |

**Appetite burn: 2.0 of 8 days used.** Planned allocation 6.5d, leaving 1.5d slack. Kill tripwire at
4d (50%): if Phase 02 is not done, a scope-cut conversation is mandatory. **Phase 00: ~0.5d against
1d** (pre-planned cut order never needed, no cut taken). **Phase 01: ~1.5d against 2d**, and the
adversarial pass was paid for out of the phase rather than out of slack, which is what the plan
requires.

## Done-log

- **2026-08-09** — lane born. ADR-0074 (company: arc-first ruling, venture clock deferred, trigger
  gate waived for this cycle, A8 tension flagged) and ADR-0600..0606 (ABS-A..G) recorded. PLAN.md,
  five phase specs and this tracker written. `kickoff-lint` passed. Attack panel: 3 fresh agents,
  **18 findings, 17 accepted, 1 rejected** (`defer REQ-05 — unsupported`). Simulation gate:
  **8 blockers → 0** in one round.
- **2026-08-09 — Phase 00 CLOSED ✅** *Steel thread: the matrix and its paperwork.*
  **Shipped:** DEV-B/C boundary audit · `products/absorb/registry.json` (schema + zero rows) ·
  `products/absorb/manifest.json` · ADR-0601 template · `report-lint.mjs` (5 headings, 3 row
  fields, WARN-first) · `registry-ref.mjs` (resolution + A5 no-duplication) ·
  `tests/fixtures/absorb/lock-fixture.json` · two bats suites with mutant negative controls ·
  steel thread demonstrated end to end.
  **Tests: 31 added** (14 report-lint + 17 registry-ref); repo total 1934. **CI green 19/19 jobs**,
  read per-JOB conclusion on run `31300644910` — never the watcher's exit code.
  **Actual ~0.5d vs 1d appetite.** `amendments: 0` (/arc-change) · **1 ADR amendment**
  (ADR-0606 A1, forced by the audit) · `reopened: n` · `t-to-phase0: 0d`.
  **Two CI reds on the way, both instructive:** `sedi` is a per-file helper, not a `test_helper`
  export — assuming otherwise cost one cycle. And `products.bats:75` caught a product manifest
  landing with no CATALOG entry, which is exactly the defect its own comment predicts; it could
  only notice because it derives its expectation from `ls products/` instead of freezing a list.
  **Evidence:** `initiatives/absorb/evidence/phase-00/` — `dev-bc-audit.md`, `sample-report.md`,
  `steel-thread-demo.txt`. No `arc-evidence.sh` bundle: those begin at Phase 02 (ADR-0002).
- **2026-08-09 — Phase 01 CLOSED ✅** *Study harness, hostile-input-first.*
  **Shipped:** `study.mjs` (confined read-only walk, `--inventory` / `--read` / `--scaffold`) ·
  `.claude/commands/arc-absorb.md` · the hostile corpus at `tests/fixtures/absorb/hostile/` with a
  5-column `INDEX` (6 attack families committed, 2 constructed at run time and named) ·
  `absorb-study-boundary.bats` (27) · `absorb-hostile.bats` (8) driver.
  **Tests: 31 → 78 absorb tests**; repo total 1981. **CI green 19/19**, run `31303232950`, per-JOB.
  **Actual ~1.5d vs 2d appetite.** `amendments: 0` · `reopened: n`.
  **THE KILL CRITERION DID NOT FIRE.** The no-execution boundary IS fixture-proven: three mutants
  (install / import / eval), each asserted to trip an env-supplied absolute sentinel, plus a positive
  control proving the sentinels fire when executed directly — without which "no sentinel" and "the
  sentinel is broken" are the same observation. Assumptions row 1 is therefore **validated**, and it
  was the row whose failure would have STOPped the cycle.
  **The adversarial pass (2 fresh agents, different surfaces) rewrote most of the phase** — see the
  commit for the full list. The three that matter: `walk()` never recursed at all (every directory
  failed a file-only confinement check, so `--inventory` saw depth 1 while the report attested to a
  full walk); a report consisting entirely of a studied README quoted inside a code fence linted with
  **zero warnings**; and the hostile driver passed a stub that opened **no file**, proving the
  envelope's shape while claiming to prove the outcome.
  **Evidence:** the four suites and the corpus INDEX are the evidence for this phase; the two agents'
  findings are quoted in the commit body rather than duplicated into a file.

## Now

**Current position:** Phases 00 and 01 CLOSED. The study harness exists, its no-execution boundary is
fixture-proven, and the hostile corpus is pinned and driven. **Phase 02 starting** — registry and
guards.

**Trigger scan at the Phase 01 close: ONE ROW FIRED, and it fired the way it was designed to.**

**Assumptions row 6 FIRED** — *"`report-lint` and the registry lint fail on a malformed input rather
than passing it through"*, whose trigger reads *"a deliberately malformed report or a registry row
with a hash field passes its lint green — a wrong line of code, not a wrong decision."* That is
exactly what the adversarial pass found, twice: a report consisting entirely of a studied README
quoted inside a code fence linted with **zero warnings**, and a registry row with every lock-owned
field copied one level deeper inside `lock_ref` resolved **completely clean**.

**Why this is recorded as the ledger working rather than as a miss.** The evolve retro of 2026-08-04
found that an assumptions ledger written entirely in design language cannot detect implementation
risk, and required that at kickoff **at least one trigger name something a wrong LINE OF CODE would
set off**. Row 6 is that row. It is the first row in this lane to fire, it fired on implementation
rather than on a decision, and the mechanism that caught it — the two-surface adversarial pass — is
Phase 01's own exit criterion. **The firing was resolved inside the phase it fired in**, with every
hole pinned as a regression fixture, so it is not routed through `/arc-change` as unresolved risk.
It is carried to the retro as evidence that the kickoff-time fix took.

**Assumptions row 1 is VALIDATED** — read-only study is fixture-provable. That was the STOP row.

No other row fired, and no indexed ADR's revisit condition is true: ADR-0603's sealed-mapping
mechanic does not exist until Phase 03, and ADR-0606's reopenable half needs the Phase 04 study.

**A second-order lesson worth the line, because it cost a CI cycle:** the first fix for the
case-variant divergence *had the same blind spot as the defect* — it compared `basename(rel)` with
`basename(realpathSync(...))`, and realpath does not canonicalise case on win32 or darwin, so it
compared a string with itself. It survived only because the test asserted **behaviour** (refused
identically on every leg) rather than implementation (the check runs). An implementation-shaped
assertion would have been green and wrong.

**Next step:** Phase 02 — registry status lint (cap 12, displacement, decision-ref transitions), the
ADR-0602 allowlist lint, the license/attribution gate, the zero-new-dependency fixture (parse-based,
never grep), and the `docs/evidence/absorb/` PLANOFF skeleton. Every lint gets a mutant negative
control, and Phase 02 is the **first phase that owes an `arc-evidence.sh` bundle** (ADR-0002).

**Still owner-owned, unchanged:** leads Phase 03 waits on the `_dmarc.automemory.ai` record, policy
Phase 04 on three `.claude/settings.json` edits. Absorb's own two owner picks arrive in Phases 03
and 04.
