# PROGRESS.md — arc-absorb "the technique refinery"

status: LIVE
cycle: arc-absorb (Cycle 10, born 2026-08-09)
phase: 04 — study done, rebuild BLOCKED by owner ruling (00, 01, 02, 03 CLOSED)
appetite: 8d
burn: 5.0d
blocked-on: owner — the Phase 03 inbox pick (REQ-06's live demo, the one row Phase 03 closed with open)
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
| 03 | Governance drop — ADR-0603 owner-judge profile + blind mechanics + inbox chain, REQ-05 `PLAN-develop` addendum + freeze-log line + Toolbox template | 1d | ✅ CLOSED 2026-08-09, one row open by owner decision |
| 04 | The real absorb — ADR-0606's target end-to-end, 3-fixture A/B, sealed-blind judgement, adoption proposal, decision recorded, retro | 1.5d | 🟡 study + classification DONE; rebuild BLOCKED — owner ruled the allowlist stays |

**Appetite burn: 5.0 of 8 days used.** Planned allocation 6.5d, leaving 1.5d slack. Kill tripwire at
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

- **2026-08-09 — Phase 03 CLOSED ✅, with ONE ROW OPEN by the owner's decision.** *Governance drop.*
  **Shipped:** ADR-0603's payload profile at the SPINE boundary (`validate-absorb.mjs`, two lines in
  the shared validator) · the hash-commitment seal/reveal (`judgement.mjs`) · REQ-05's four-part
  cross-lane diff — `PLAN-develop` §7.1a, its freeze-log line, the `technique` verdict
  `capability-scout.md` never had, and `docs/templates/toolbox-template.md`.
  **Tests: 26 in `absorb-judgement.bats`**; repo 2077. **CI green 19/19**, run `31310632368`.
  **Actual ~1.5d vs 1d appetite.** `amendments: 0` (/arc-change) · **1 ADR amendment** (ADR-0603 A1,
  plus its enforcement clause) · `reopened: n`.
  **REQ-05 and REQ-07 VALIDATED. REQ-06 stays `active`** — its mechanism is fixture-proven but its
  live demo needs a real owner judgement on the real spine, and flipping it would assert a receipt
  that does not exist, in the phase whose whole subject is that a judgement must be a receipt rather
  than a memory. Approval `01KZJXBNKT6PEYC87TW5D53QTP` is queued and open.
  **Closed by the owner's explicit decision** — the leads Phase 04 precedent, where closing with a
  row open was likewise the owner's call and not the lane's.
  **Its adversarial pass: 22 findings, 6 HIGH, three falsifying properties outright** — the
  commitment preimage was not injective so `verify` said OK on a tampered mapping; a `--correlation`
  traversal wrote the plaintext into a git-tracked path; the blinding test survived blinding being
  deleted. Then two named blockers fixed: `--decision` accepted any string, and Amendment 1's
  `pick=` prefix was enforced nowhere — I wrote that sentence and did not implement it.
  **Evidence:** `evidence/phase-03/chain-proof.md` + manifest, verified.

## Now

**Current position:** Phases 00, 01, 02, 03 CLOSED. Phase 04's study and classification are done.
**Phase 04's rebuild is closed off by the owner's ruling, not pending.**

**THE OWNER RULED ON THE ALLOWLIST, 2026-08-09: DO NOT WIDEN.** `.claude/agents/**` stays off it and
**T-01 stays a `candidate` row.** So the first real absorb ends at a recorded classification rather
than an adoption — and that is the outcome, not a failure to reach one. Recorded in ADR-0602
Amendment 1 together with the three routes that would legitimately unblock it later, in order of
preference, so a future cycle does not re-argue this from scratch.

**Why the ruling is right, kept because it will be tempting to revisit:** the first thing to test the
boundary asked to be let through. A boundary that widens for its first real applicant was never a
boundary, and the pressure came from the lane that wanted the room — precisely the case ADR-0602
exists to refuse. Holding it cost one blocked rebuild; conceding it would have cost the rule.

**What this cycle proved, and what it did not.** PROVEN on real input: study → report → classify →
gate. The extraction report lints clean, the registry's first real row lints clean, `rebuild-lint`
returned 0 warnings on a real diff, and the 4-bucket matrix returned 1 ABSORB / 2 SKIP / 1 ROUTE with
nothing shoehorned. NOT PROVEN: rebuild → A/B → adoption. **REQ-08 is not met and REQ-03's A/B never
ran** — recorded as not-met rather than narrated as nearly-done.

**One owner action remains, and it is the only one:** the Phase 03 pick, which closes REQ-06's live
demo and is the row Phase 03 closed with open.

```
node .claude/scripts/hq/arc-inbox.mjs approve 01KZJXBNKT6PEYC87TW5D53QTP --reason "pick=quartz; <why>"
```

Labels are **quartz | fathom** and tell you nothing about which is which by design; the mapping is
sealed behind a hash and revealed only after the decision lands. Either label is a valid answer — the
pick proves the chain, not that one variant is better.

**Next step after that:** Phase 04 cannot complete REQ-08, so the honest close is a **retro** that
records what the loop proved, what it did not, and the five findings below — then the cycle ends
under its appetite with the mechanics banked and one real study on the record.

**Five retro inputs banked.** CI was GREEN before three of the four adversarial passes found their
serious holes · four of Phase 02's seven serious findings were earlier fixes of mine REOPENING ·
`arc-evidence.sh` reports "verified" on a zero-artifact bundle · a test that only passes while the
defect is present is a test FOR the defect · and an allowlist can admit a path that another lane's
proof has frozen.

**Unchanged and owner-owned elsewhere:** leads Phase 03 waits on the `_dmarc.automemory.ai` record;
policy Phase 04 on three `.claude/settings.json` edits.
