# Trial-gate ledger

> The evidence log that decides when a WARN-first substance gate becomes a real (FAIL-capable)
> gate. Written by `/arc-retro`; consumed by a human before flipping a gate. This file is the
> reason "scripts GATE, never LLM self-assessment" stays literally true — promotion is driven by
> recorded runs, not a judgement call. (Kickoff v4, item F1. Spec: `docs/kickoff-v4-plan.md`.)

## What "in trial" means

Every v3.5 substance gate — `pre-mortem-cite` · `appetite-sum` · `adr-wired` · `adr-confidence` ·
`architecture` · `current-state-structure` · `nonneg-drift` — ships in the `TRIAL` set in
`.claude/scripts/plan/kickoff-lint.mjs`. A trial gate **always WARNs** (suffix `[trial]`), even on a v3
plan; it never FAILs. `kickoff-lint` prints a `[trial-status]` footer showing the live-vs-trial count.

## Promotion criteria (both must hold)

A trial gate is **promotable** only when:

1. **Fixture-proven** — a bats test in `tests/kickoff-lint.bats` asserts the gate FAILs on its own
   named mutation, and the `good/` fixture passes clean (zero `[trial]` on the modelled practice).
2. **≥ 3 clean dogfood runs** — the gate has been exercised on ≥ 3 real kickoffs logged below with
   **zero false-positives** (it never fired on a plan that was actually fine).

Promotion = delete the group from the `TRIAL` set in `kickoff-lint.mjs` (one line), recorded in git.
`/arc-retro` proposes it as a diff; a human approves. A logged false-positive resets the count.

> Honesty: "3 clean runs" is a **threshold**, not a proof of correctness. It bounds false-positive
> risk — exactly what WARN-first was protecting against — nothing more.

## Ledger

`date | gate | run-ref | fired? | false-positive?`

| date | gate | run-ref | fired? | false-positive? |
|---|---|---|---|---|
| 2026-07-16 | (all substance gates) | c036e63 (arc-council-v2 kickoff) | no (0 `[trial]` WARNs) | no |
| 2026-07-16 | (all substance gates) | 58510be (arc-council-v3 kickoff) | no (0 `[trial]` WARNs) | no |
| 2026-07-19 | appetite-sum | venturemind PLAN (Phase-04 dogfood, external repo) | **YES** — over-commit branch: phases sum 16d > 15d total | **no** — verified arithmetically: 3+2+6+4+2 days against a stated 2-3 week total. The plan really does over-commit. |
| 2026-07-19 | pre-mortem-cite | venturemind PLAN (Phase-04 dogfood) | YES — 3 of 5 rows cite no plan token | unadjudicated — rows name real risks in prose; whether that is a miss or a true generic-row flag is not settled here |
| 2026-07-19 | nonneg-drift | venturemind PLAN (Phase-04 dogfood) | YES — 4 phase specs missing the verbatim block | no — the blocks genuinely are absent |
| 2026-07-19 | adr-wired | venturemind PLAN (Phase-04 dogfood) | YES — ADRs 0001-0004, 0006, 0008 not cited in any phase spec | unadjudicated — the decisions are implemented; the citation strings are absent (the known adr-wired ambiguity) |
| 2026-07-19 | verify-red | venturemind PLAN (Phase-04 dogfood) | YES — phase-00 names no **Test command:** | no — the field genuinely is missing |

<!-- Append one row per (gate × kickoff run). run-ref = a PLAN commit SHA, a dry-run id, or a
     fixture name. fired? = did the gate WARN on that run. false-positive? = did it WARN on a plan
     that was actually fine. Delete the (example) row once real runs exist. -->

## First real fire — 2026-07-19

Until this date the ledger held two runs, both zero-fire, both the same author's council
kickoffs. Nothing had ever fired, so "3 clean runs" measured silence rather than accuracy —
the exact objection the council raised when asked whether these gates should start blocking.

Running the gates against **venturemind**, a real external repo whose plan this author did not
write against these checks, produced the first fire data: five gates fired, on a plan that had
been sitting green-by-absence. `appetite-sum`'s over-commit branch is a verified TRUE positive
(phase appetites sum past the stated total, checked by hand). `nonneg-drift` and `verify-red`
fired on genuinely missing content. `pre-mortem-cite` and `adr-wired` fired in the way their
known ambiguity predicts and are left unadjudicated rather than scored either way.

This is one run, not three, and one repo, not several. It does not promote anything. It is
recorded because it is the first evidence in this file that measures a gate rather than its
silence.
