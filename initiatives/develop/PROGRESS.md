# PROGRESS.md — Cycle 5 · arc-develop "The Developer"

status: LIVE
cycle: arc-develop (Cycle 5, opened 2026-08-02)
phase: 02 — in progress
appetite: 5d
burn: 1.1d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane develop` on 2026-08-02 — arc's first natively-born
> lane. Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`) stay at
> root and are never copied here (ADR-0053); evidence is lane-scoped from Phase 00 forward
> (ADR-0055), at `initiatives/develop/evidence/phase-NN/`.
> Design source: `docs/strategy/plans/PLAN-develop.md` (frozen — the decision record, not the cycle).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — `/arc-develop` runs start → next → status → handoff end-to-end offline on the committed fake phase, lane-native, writing a durable brief + slice ledger and emitting receipts | 1.5 days | ✅ done 2026-08-02 |
| 01 | The proof floor — `develop-lint` with structural BLOCKs, evidence tiers, and a parser that survives ≥20 adversarial breaking inputs | 1.25 days | ✅ done 2026-08-02 |
| 02 | Earned judgment — predictions scored at handoff, and a fresh unanchored `spec-fidelity` pass over spec + diff | 0.75 days | pending |
| 03 | Controlled escalation — stuck backstops, inline risk-triggered checkpoints, debt-ledger marker lint | 0.5 days | pending |

**Appetite burn: ~1.1 of 5 days used (~22%), with 2 of 4 phases closed.** Phases allocate 4.0 days;
the remaining 1.0 day is deliberate slack, because Cycle 4 closed at 112% with none. The checkpoint
was 3.0 days with Phase 01 done — **it did not fire**: Phase 01 closed at ~1.1d, well inside it.
(A literal 50% mark would have been a broken instrument — Phase 00 + 01 already sum to 2.75d, so it
would have fired on every on-schedule run.)

Basis, so it can be audited rather than believed: one unbroken sitting on 2026-08-02. Phase 00
(~0.5d) covered the kickoff — plan, 4 specs, 6 ADRs, 3 attack rounds, 3 simulation rounds — plus the
ADR-band repair and the steel thread. Phase 01 (~0.6d) covered develop-lint, 45 adversarial fixtures
across two rounds, and closing the 9 holes the second round found. Both came in under their
appetites (1.5d and 1.25d), which is the cycle's whole slack margin holding so far.

## Done log

**Phase 00 — steel thread — closed 2026-08-02, ~0.5d against a 1.5d appetite.**
CI run `30751546128` green: 20 of 20 jobs, ubuntu + macos + windows, head `8c46844`
(`initiatives/develop/evidence/phase-00/ci-green.txt`). `/arc-develop` runs
start → next → status → checkpoint → handoff offline against committed fixtures; the lane
contract holds (unknown lane exits 4, duplicate `--lane` exits 5, reserved names exit 5, root-mode
byte-identical to its golden); receipts land; `status` reconstructs cold at `slice 2/5`.

Under appetite because the phase found its two hard problems early rather than late:

1. **The spine silently swallowed every receipt.** Its kind vocabulary is closed (ADR-0026) and
   `develop.started` was quarantined with `UNKNOWN_KIND` **while the command still exited 0** —
   a receipt that never landed, reported as success. ADR-0106 extends it 18 → 21.
2. **`sectionOf` shipped the `$`-under-`/m` bug** the retro-log records from 2026-07-16, so every
   derived brief field came back empty. Caught on its first run against a real fixture.

Two more caught by process rather than luck: a test that passed before any code existed (node's own
`Cannot find module` is also non-zero and also writes no file — it now asserts the reason), and the
ADR-number collision with the model-policy session, which forced the century-band rule.

**Phase 00 did not use `/arc-develop` on itself** — the tool did not exist yet. Phase 01 is the
first phase run through it, which is the real dogfood.

---

**Phase 01 — the proof floor — closed 2026-08-02, ~0.6d against a 1.25d appetite.**
CI run `30752975413` green: 20 of 20 jobs, head `33a8d45`
(`initiatives/develop/evidence/phase-01/ci-green.txt`). Nine slices, all proven through the
harness itself — `status` reported `slice 5/9` and then `9/9` from committed files alone.

`develop-lint` ships ADR-0101's split: `ledger-unparseable`, `brief-stale` and `slice-unproven`
BLOCK from v1; `self-declared-number` and `tier-floor` are WARN-first and registered in
`docs/trial-ledger.md` with what would promote them. Every BLOCK has a negative control proving
it can fail, and every failure names the offending slice and line.

**The phase's real lesson is about who may attack a gate.** My own 26 breaking inputs were all
caught on the first run — and that was a true result about a blind spot, not about the gate.
All 26 attacked one direction: a slice the parser SEES holding bad data. An unanchored agent,
blind to how the parser was written, attacked the other direction and found **9 holes**. The
flagship: a four-slice ledger claiming `proof: it works` / `tier: eyeballed` / `commit: yes`
that parsed to ZERO slices and ZERO errors, and the gate answered "all checks passed ✔".

Two of the nine deserve naming. A `#` line inside a fenced proof block closed the slice — so
the *sanctioned* way to record evidence (ADR-0100 prescribes that fence) was also the way to
stop being checked. And `isFilled` was a denylist of 8 strings holding the em dash but not the
en dash, while the writer itself emits an em dash — so `proof: –` read as a real value.

45 fixtures pinned now, all caught. Five round-2 fixtures initially "passed" because they were
cosmetic-only, with no violation riding along — a fixture that passes by parsing correctly pins
nothing, so they were rebuilt.

## Now

**Current position:** Phases 00 and 01 closed on green CI. Phase 02 — earned judgment — is open:
predictions scored at handoff against what actually happened, and a fresh unanchored
`spec-fidelity` pass reading only the spec and the diff.

Phase 02's spec requires it to **open by self-hosting** — run the shipped harness against its own
real `phase-02-spec.md` before building anything, because real-phase dogfooding is otherwise a
declared no-go and this is the only non-fixture proof the cycle buys.

**Next step:** `/arc-develop start 2 --lane develop`, then work the ledger slice by slice.

**Tracked, not built:** a duplicate-ADR-number check inside an existing lint, so CI catches a
forgotten century band instead of trusting the convention. Route via `/arc-change`.
