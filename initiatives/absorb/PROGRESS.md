# PROGRESS.md — arc-absorb "the technique refinery"

status: LIVE
cycle: arc-absorb (Cycle 10, born 2026-08-09)
phase: 03 — starting (00, 01, 02 CLOSED)
appetite: 8d
burn: 3.0d
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
| 02 | Registry and guards — status lint (cap 12, displacement, decision-ref), allowlist lint, license/attribution gate, PLANOFF skeleton | 1d | ✅ CLOSED 2026-08-09 |
| 03 | Governance drop — ADR-0603 owner-judge profile + blind mechanics + inbox chain, REQ-05 `PLAN-develop` addendum + freeze-log line + Toolbox template | 1d | ⬜ not started |
| 04 | The real absorb — ADR-0606's target end-to-end, 3-fixture A/B, sealed-blind judgement, adoption proposal, decision recorded, retro | 1.5d | ⬜ not started |

**Appetite burn: 3.0 of 8 days used.** Planned allocation 6.5d, leaving 1.5d slack. Kill tripwire at
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

- **2026-08-09 — Phase 02 CLOSED ✅** *Registry and guards.*
  **Shipped:** `rebuild-lint.mjs` (ADR-0602 allowlist + parse-based dependency check + per-file
  attribution gate) · `registry-ref.mjs` extended with the status lifecycle, the 12-per-lane cap and
  its displacement rule · `products/absorb/allowlist.txt` as ADR-0602's single lint-readable copy,
  held against the ADR by a test **including the pattern count** · the PLANOFF skeleton.
  **Tests: 78 → 119 absorb tests**; repo total 2022. **CI green 19/19** on run `31304789752` at
  `e0677846`, verified to be this HEAD rather than an earlier commit. **Actual ~1.0d vs 1d.**
  `amendments: 0` (/arc-change) · **1 ADR amendment** (ADR-0605 A1) · `reopened: n`.
  **Evidence bundle written and verified** (ADR-0002, first phase owing one):
  `evidence/phase-02/` — `adversarial-pass.md`, `lint-demo.txt`, `manifest.json`.
  **ADR-0605 AMENDMENT 1 — I had put the PLANOFF bundle in a FROZEN directory.** `docs/evidence/**`
  is the sole canonical copy of pre-portfolio history (ADR-0058) and evidence is lane-scoped forward
  (ADR-0055). `planner-bench` sits there because it PREDATES the portfolio split. Mirroring its
  layout was right; mirroring its location was an inference I never checked. The bundle is
  `initiatives/absorb/evidence/planoff/`, and comparability is a LINK rather than an extension.
  **The adversarial pass returned 21 findings, 7 serious, and FOUR were my own fixes reopening** —
  full record in `evidence/phase-02/adversarial-pass.md`. Two claimed properties were falsified: the
  cap of 12 was evaded by varying the lane string, and lock-owned data nested under any key other
  than `lock_ref` was invisible. **And the gate had no caller at all** — `rebuild-lint` was
  reachable only from its own bats suite.

## Now

**Current position:** Phases 00, 01 and 02 CLOSED. Study harness, registry guards and the rebuild
gate all exist, all fixture-proven, all adversarially attacked. **Phase 03 starting** — the
governance drop.

**Trigger scan at the Phase 02 close: assumptions row 6 FIRED A SECOND TIME.**

Its trigger is *"a deliberately malformed report or a registry row with a hash field passes its lint
green — a wrong line of code, not a wrong decision."* Phase 02's adversarial pass found three: the
cap evaded by a lane string, lock-owned data nested one level deeper, and block-comment stripping
deleting live code. Resolved inside the phase again, every hole pinned as a fixture, so it is not
routed through `/arc-change` as unresolved risk.

**The second firing carries a sharper lesson than the first, and it is the retro's headline: in BOTH
phases CI was GREEN when the adversarial pass found the serious holes.** 19/19 jobs green, then 18
findings in Phase 01 and 21 in Phase 02. CI proves the assertions held; it cannot prove a guard
guards. The two-surface adversarial pass is not a review step in this lane, it is the only thing that
has ever found a class-one defect here — and it has now paid for itself three times.

**Second retro input: four of Phase 02's seven serious findings were MY OWN EARLIER FIXES
REOPENING** (defects #1, #3, #5 and #8 from the running list), including #8 recurring *inside the
flag added to fix it*. The written rule "grep the pattern, not the file" has now failed in this lane
twice. What actually worked both times was the attacker's prompt carrying the running defect list
with the instruction to check each one in every OTHER file — mechanism over advisory, exactly as the
2026-08-04 evolve retro concluded.

**Third retro input, about arc's own tooling:** `arc-evidence.sh bundle 02` produced a **zero-artifact
bundle** and `verify` reported *"bundle verified"*, exit 0. It cannot distinguish "verified" from
"nothing to verify" — in the tool whose entire purpose is making a phase close on evidence rather
than assertion. Fifth instance of that class this cycle. Left alone (shared file, out of scope) with
the fix named: `verify` should refuse a zero-artifact bundle.

No other assumption fired. No indexed ADR's revisit condition is true.

**Next step:** Phase 03 — the governance drop. ADR-0603's owner-judge payload profile (strict
`subject: "absorb.ab-judgement"`, unknown keys AND missing required keys both refused), the
hash-commitment blind mapping revealed only after `decision.recorded`, the inbox chain fixtures for
REQ-06 and REQ-07, and REQ-05's `PLAN-develop` team-leader addendum as a reviewed diff plus a
freeze-log line — which is **two** edits, because the scout's verdict set has no `technique` value for
ADR-0604's referral rule to hook into.

**⚠ PHASE 03 NEEDS ONE OWNER PICK, and it is the first thing in this cycle that I cannot self-serve.**
REQ-06's live demo requires a real `decision.recorded` to exist, carrying a real pick and a real
reason, made by the owner through the existing inbox. That is the entire point of ADR-0603: a human
judgement is a receipt, not a memory. I will build the chain, queue a synthetic blind A/B, and print
the exact command. **Phase 04 then needs a second pick** — the real adopt-or-refuse decision.

**Unchanged and owner-owned:** leads Phase 03 waits on the `_dmarc.automemory.ai` TXT record; policy
Phase 04 waits on three `.claude/settings.json` edits.
