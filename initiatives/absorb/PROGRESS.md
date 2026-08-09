# PROGRESS.md — arc-absorb "the technique refinery"

status: LIVE
cycle: arc-absorb (Cycle 10, born 2026-08-09)
phase: 00 — built and pushed, awaiting CI (plan approved by owner 2026-08-09)
appetite: 8d
burn: 0.5d
blocked-on: CI — per-JOB conclusions on the absorb branch
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
| 00 | Steel thread: the matrix and its paperwork — DEV-B/C boundary audit, registry shape finalized, ADR-0601 template + `report-lint` (WARN-first) | 1d | 🟡 built, CI pending |
| 01 | Study harness, hostile-input-first — read-only pipeline, injection red corpus, adversarial pass, no-execution boundary fixture-proven **or STOP** | 2d | ⬜ not started |
| 02 | Registry and guards — status lint (cap 12, displacement, decision-ref), allowlist lint, license/attribution gate, PLANOFF skeleton | 1d | ⬜ not started |
| 03 | Governance drop — ADR-0603 owner-judge profile + blind mechanics + inbox chain, REQ-05 `PLAN-develop` addendum + freeze-log line + Toolbox template | 1d | ⬜ not started |
| 04 | The real absorb — ADR-0606's target end-to-end, 3-fixture A/B, sealed-blind judgement, adoption proposal, decision recorded, retro | 1.5d | ⬜ not started |

**Appetite burn: 0 of 8 days used.** Planned allocation 6.5d, leaving 1.5d slack. Slack is never
taken from Phase 1's adversarial pass. Kill tripwire at 4d (50%): if Phase 02 is not done, a
scope-cut conversation is mandatory.

## Done-log

_Nothing closed yet. The kickoff itself is not a phase._

- **2026-08-09** — lane born. ADR-0074 (company: arc-first ruling, venture clock deferred, trigger
  gate waived for this cycle, A8 tension flagged) and ADR-0600..0606 (ABS-A..G) recorded. PLAN.md,
  five phase specs and this tracker written. `kickoff-lint` passed; attack panel and simulation gate
  run. **Awaiting owner approval before any Phase 0 work.**

## Now

**Current position:** plan approved by the owner on 2026-08-09 with a standing instruction to
complete all phases without waiting, and to hold the merge until every phase is done. **Phase 00 is
built and pushed; CI has not yet returned.** The phase does not close until per-JOB conclusions are
green — `gh run view --json jobs`, never a watcher's exit code.

**What Phase 00 produced.** The DEV-B/C audit
(`evidence/phase-00/dev-bc-audit.md`) and it found four things worth the phase: develop's lock has
**no declared schema**, so "required field" is inferred behaviour and absorb's reference assertion is
deliberately the weaker resolution-only claim (FINDING 1.1) · the lock's `class` field is prose
carrying two machine-relevant facts, so a row must never restate either (1.2) · the scout's verdict
set is `worth vetting`/`refused here`/`unknown` with **no `technique` value**, so ADR-0604's referral
rule has nothing to hook into until REQ-05 lands it in Phase 03 (3.1) · and **ADR-0606's code-home
reason was wrong** — no product directory holds data, so "develop-lane symmetry" was false, but the
decision stands on a stronger reason found here: `products/` is outside the sync surface, so the
registry does not sit behind a byte-identity gate the way `capability-lock.json` does (§4, recorded
as ADR-0606 Amendment 1).

**One finding corrected mid-audit, kept visible rather than tidied:** FINDING 4.1 first said absorb
needs no `products/absorb/manifest.json`. That was wrong — `product-lint` refuses any synced file in
no product manifest, exit 2, in a CI step *before* bats, and it cost a full CI cycle on 2026-08-07.
The manifest exists.

**Next step:** read CI per JOB. Green → close Phase 00 via the DoD and start Phase 01 (study harness,
hostile-input-first, whose no-execution boundary is fixture-proven **or the cycle STOPs**). Red → fix
and re-push before anything else.

**Carried as a retro input, deliberately NOT fixed here:** CI's test-count floor is **911** against
an actual **1934**, so the gate that exists to catch suite shrinkage would not notice a loss of a
thousand tests. That rot predates absorb and belongs to no lane; fixing a shared `.github/` file
mid-phase for an out-of-scope reason is what pre-mortem row 5 and the change-discipline rule both
refuse. Raise it through `/arc-change`, not in passing.

**Two things the owner still owns, unrelated to this lane's work:** leads Phase 03 waits on the
`_dmarc.automemory.ai` TXT record, and policy Phase 04 waits on three `.claude/settings.json` edits.
Both lanes stay LIVE on the board until those land, and ADR-0074 records that absorb proceeding
does not clear them.
