# Trial-gate ledger

> The evidence log that decides when a WARN-first substance gate becomes a real (FAIL-capable)
> gate. Written by `/arc-retro`; consumed by a human before flipping a gate. This file is the
> reason "scripts GATE, never LLM self-assessment" stays literally true — promotion is driven by
> recorded runs, not a judgement call. (Kickoff v4, item F1. Spec: `docs/archive/kickoff-v4-plan.md`.)

## What "in trial" means

Every v3.5 substance gate — `pre-mortem-cite` · `appetite-sum` · `adr-wired` · `adr-confidence` ·
`architecture` · `current-state-structure` · `nonneg-drift` · `verify-red` — ships in the `TRIAL` set in
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
| 2026-07-22 | appetite-sum | arc's own PLAN (Phase-05 close) | **YES** — zero-slack branch: phases sum 27.5d = 92% of 30d | **unadjudicated, leaning false** — the arithmetic is correct, but the build closed at ~20% burn (~6 days actual against 27.5 budgeted). The risk the branch warns about (no buffer) did not materialise; it inverted. Counts against the **zero-slack** branch only — the **over-commit** branch (venturemind, 16d > 15d) is untouched by this row |
| 2026-07-28 | appetite-sum | arc's own PLAN (Cycle 2 receipt spine, Phase-04 retro) | **YES** — over-commit branch: phases sum 14.5d > 12.5d total | **unadjudicated, leaning false** — the arithmetic is correct (5+2.5+2.5+1.5+3), but the build reached Phase-04 close at **~40% burn (~5 of 12.5 days)** with every closed phase coming in *under* its own appetite (5d→~2d, 2.5d→~1d, 2.5d→~1d, 1.5d→~1d). The over-commit the branch warns about did not materialise; it inverted — the **second** logged inversion of this gate, after 2026-07-22. This one hits the over-commit branch, the same branch venturemind scored a true positive on, so that branch now has 1 true positive and 1 inverted fire |
| 2026-07-28 | (7 other substance gates) | arc's own PLAN (Cycle 2 receipt spine) | no — silent across the whole build | **n/a — not counted as a clean run.** Same-author silence on a plan written against these checks, which the "First real fire" note above says this file must stop scoring as accuracy. Recorded for completeness only |

| 2026-08-02 | self-declared-number (develop-lint) | registered at birth, arc-develop Phase 01 | not yet | — |
| 2026-08-02 | tier-floor (develop-lint) | registered at birth, arc-develop Phase 01 | not yet | — |

### develop-lint's two trial groups (ADR-0101)

`develop-lint` ships its **structural** checks as real BLOCKs from v1 and only its **heuristic**
checks WARN-first. The line is drawn on a principle, not a preference: false-block risk lives in
pattern matching, never in "did the file parse".

| group | why it is in trial | what would promote it |
|---|---|---|
| `self-declared-number` | a regex looking for a quality claim carrying a number. It could trip on a legitimate version string, dependency count or duration — none of which has been seen in a real ledger yet | fixture-proven both ways (it fires on `confidence 95%`, stays silent on `node 22.3.0` — both pinned in `tests/develop-lint.bats`) **plus** ≥3 clean dogfood runs on real phases with zero false positives |
| `tier-floor` | the UI and external-dep evidence floors have never run against a real UI slice, because this cycle has no UI REQ. Its judgement is untested on the thing it exists to judge | the same, and specifically ≥1 real `kind: ui` slice where the floor's verdict was checked against what a human thought of the evidence |

Not promotable on clean-run count alone: neither group has yet fired on a real phase, and a gate
that has never fired has not been observed to be right — only to be quiet.

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

## Phase 05 promotion decision — 2026-07-22: all 8 gates KEPT WARN

Phase 05 (REQ-12) requires that every TRIAL check is either promoted to FAIL carrying its
evidence row, **or explicitly kept WARN with this ledger stating why**. This is that record.
Nothing is promoted. The per-gate reasons:

| gate | fire data | kept WARN because |
|---|---|---|
| `appetite-sum` | 1 verified true positive (venturemind), 2 silent runs | 1 exercised run, not 3. The only gate with a clean true positive, and still short of the bar. |
| `nonneg-drift` | 1 true positive (venturemind) | 1 exercised run, not 3. |
| `verify-red` | 1 true positive (venturemind) | 1 exercised run, not 3. |
| `pre-mortem-cite` | 1 fire, **unadjudicated** | Its known ambiguity is unresolved — the fire can be scored neither clean nor false, so it counts toward nothing. |
| `adr-wired` | 1 fire, **unadjudicated** | Same: the decisions were implemented, only the citation strings absent. The gate's own semantics are the open question. |
| `adr-confidence` | never fired in any logged run | Zero fire data. Promoting it would promote silence — the exact thing the "First real fire" note above says this file must stop counting. |
| `architecture` | never fired | Zero fire data. Same reason. |
| `current-state-structure` | never fired | Zero fire data. Same reason. |

**A blocker that applies to all eight, independent of evidence.** Council session 001 ruled
promotion CONDITIONAL on a governed escape hatch existing first. It does not. `report()` in
`.claude/scripts/plan/kickoff-lint.mjs` ends in an unconditional `process.exit(1)` — there is
no recorded-reason bypass anywhere in `.claude/scripts/plan/`. A gate that can block a build
with no way to accept-with-reason means one false positive wedges the caller until someone
edits the linter. That is not a promotion-ready shape, regardless of how much fire data a
gate accumulates.

**What was considered and not done.** Building the escape hatch inside Phase 05 was the other
path. Rejected: it appears in no REQ and no phase-05 exit criterion, so it would need routing
through `/arc-change` with its own ADR, and its cost lands against a 0.5-week phase appetite
already committed to the docs rewrite. Promoting `appetite-sum` on one fire to get the phase
a promotion is the failure mode WARN-first exists to prevent — the threshold would be met by
redefining it, not by clearing it.

**What would change this.** Two more exercised runs on plans this author did not write against
these checks, plus the escape hatch shipped with a recorded-reason bypass and bats coverage.
The next dogfood cycle is the natural place for both. Until then the honest state of these
eight gates is: useful advisory output, insufficient evidence to block on.

## Cycle 2 (receipt spine) promotion decision — 2026-07-28: all 8 gates KEPT WARN

Second consecutive build to reach a promotion decision with nothing promotable. Recorded by
`/arc-retro 4`.

**Evidence added this cycle.** `appetite-sum` fired once (over-commit branch, 14.5d > 12.5d) and
the fire inverted: the build reached Phase-04 close at ~40% burn with every closed phase under
its own appetite. That is the gate's **second logged inversion** in a row. Its over-commit branch
now stands at 1 verified true positive (venturemind) against 1 inversion (here) — which is not
progress toward the bar, it is evidence the branch needs a stronger predicate than raw arithmetic
before it can block anything. The other seven gates stayed silent on a plan their own author
wrote against them; per the "First real fire" note this counts as silence, not accuracy, and adds
nothing to any gate's tally.

**The governing blocker still stands, unchanged and re-verified today.** Council session 001 made
promotion conditional on a governed escape hatch existing first. It still does not exist:
`report()` in `.claude/scripts/plan/kickoff-lint.mjs` still ends in an unconditional
`process.exit(1)` (line 469), and no recorded-reason bypass exists anywhere in
`.claude/scripts/plan/`. Until that ships, a promoted gate means one false positive wedges the
caller until someone edits the linter — and this cycle just produced another false-leaning fire
on the one gate closest to the bar.

**Net: no gate moves.** Nothing is deleted from the `TRIAL` set. The honest state of all eight is
unchanged from 2026-07-22: useful advisory output, insufficient evidence to block on.

---

# Non-kickoff TRIAL gates

The gates above are `kickoff-lint.mjs` substance gates. Cycle 2 added a TRIAL gate outside that
set — recorded here because the promotion discipline is the same, but the promotion mechanism is
different (an `arc.gates.yaml` `mode:` flip, not a `TRIAL` set edit).

## `spine-api` — reader-only grep-lint (REQ-09 / ADR-0030)

**What it enforces.** The spine is arc's only public API: every hq module outside the
implementation layer (`spine.mjs`, `arc-replay.mjs`, `lib/*`) must reach events and derived state
through the reader — never by opening `events/*.jsonl` or `state.db`, never by importing
`node:sqlite`. Scans tracked `.claude/scripts/hq/**.mjs` by glob (not a hardcoded list), ignores
comment-only tokens. Registered at `arc.gates.yaml:47` as `mode: warn`, `tier: hook`.

| date | gate | run-ref | fired? | false-positive? |
|---|---|---|---|---|
| 2026-07-24 | spine-api | Phase-03 close (`b8fb9e3`) — gate created | no — 5/5 bats green, no violations in tracked source | no |
| 2026-07-28 | spine-api | Phase-04 close review — `bash .claude/scripts/review/spine-reader-lint.sh` | no — exit 0, zero violations | no |

## Phase 04 promotion decision — 2026-07-28: `spine-api` KEPT WARN

Required by the Phase-04 exit criteria, which scope the TRIAL review to **this** gate only (the
8 kickoff-lint gates are locked WARN for the cycle regardless).

**Criterion 1 — fixture-proven: MET.** `tests/spine-reader-lint.bats` is 5/5 green on the owner's
box and asserts the gate FAILs on its own named mutations, not merely that it passes:

| # | Assertion | Covers |
|---|---|---|
| 2 | a consumer opening `events/*.jsonl` directly is flagged (exit 1), naming the file | true positive |
| 3 | a consumer reaching `state.db` / `node:sqlite` directly is flagged | true positive |
| 1 | clean consumers pass; the exempt implementation layer carrying the same real tokens is NOT flagged | false-positive edge |
| 4 | a token only inside a line or block comment does NOT trip the lint | false-positive edge |
| 5 | an untracked violating file is not scanned (tracked source only) | scope boundary |

This is stronger fixture coverage than any of the eight kickoff-lint gates has.

**Criterion 2 — ≥3 clean runs with zero false-positives: NOT MET.** Two runs are logged above,
both clean, and both on the same author's code written against this very check. By this file's
own standard — established in the "First real fire" note — that measures silence, not accuracy.
The honest reading is that the gate has never been exercised against source it did not already
agree with. It is also plausible the gate is clean because the reader-only discipline genuinely
holds (Phase 03 verified `brief`/`inbox` are reader-only); clean-because-correct and
clean-because-blind are indistinguishable without a fire on code the gate did not shape.

**Net: no flip.** `arc.gates.yaml` keeps `mode: warn` for `spine-api`. What would change it: one
more clean run plus at least one run against hq consumer code written by someone not designing to
this lint — the natural occasion is the next cycle's first new spine consumer (dashboard, evolve,
or policy), each of which is a genuine outside caller of the reader contract.

---

## Cycle 3 · arc-design (2026-07-28 → 2026-07-30) — no promotion

All eight kickoff-lint substance gates were exercised repeatedly across the cycle (kickoff-lint
ran on every `/arc-change`, every phase close and both `/arc-resume` runs).

| date | gate | run-ref | fired? | false-positive? |
|---|---|---|---|---|
| 2026-07-30 | `appetite-sum` | every run, cycle-long | **yes, every run** | **arguable — see below** |
| 2026-07-30 | `pre-mortem-cite` | every run | no | — |
| 2026-07-30 | `adr-wired` | every run | no | — |
| 2026-07-30 | `adr-confidence` | every run | no | — |
| 2026-07-30 | `architecture` | every run | no | — |
| 2026-07-30 | `current-state-structure` | every run | no | — |
| 2026-07-30 | `nonneg-drift` | every run | no | — |
| 2026-07-30 | `verify-red` | every run | no | — |

**`appetite-sum` — the honest reading.** It warned on every run that "phase appetites sum to 4.5d
= 90% of 5d total — zero slack is its own fiction". The cycle finished at **~60% actual burn**,
so the slack it predicted would be missing was in fact there. That is not obviously a
false-positive: the gate judges the *declared plan*, not the outcome, and the plan really did
declare 90%. But it also never told anyone anything they acted on across ~15 firings, which is
the shape of a gate that has learned to be ignored. **Logged as a fire with the false-positive
question left open rather than silently resolved in the gate's favour.**

**The other seven measure silence, not accuracy.** They ran clean on a plan written by the same
author who designed them, in a cycle where nothing they check went wrong. Clean-because-correct
and clean-because-blind stay indistinguishable until one fires on a plan it did not shape.

**Net: no flip.** Nothing meets both criteria. `appetite-sum`'s open false-positive question
resets its count regardless. The eight stay in `TRIAL`.

---

## Cycle 4 · arc-portfolio (2026-07-30 → 2026-08-02) — no promotion

All eight kickoff-lint substance gates were exercised repeatedly (kickoff-lint runs on every
`/arc-change`, every phase close and every `/arc-resume`; this cycle had four phase closes,
three changes and several resumes).

| date | gate | run-ref | fired? | false-positive? |
|---|---|---|---|---|
| 2026-08-02 | `appetite-sum` | every run, cycle-long | **yes, every run** | **no — and this one is outcome-confirmed** |
| 2026-08-02 | `pre-mortem-cite` | every run | no | — |
| 2026-08-02 | `adr-wired` | every run | no | — |
| 2026-08-02 | `adr-confidence` | every run | no | — |
| 2026-08-02 | `architecture` | every run | no | — |
| 2026-08-02 | `current-state-structure` | every run | no | — |
| 2026-08-02 | `nonneg-drift` | every run | no | — |
| 2026-08-02 | `verify-red` | every run | no | — |

**`appetite-sum` finally has the run Cycle 3 said it was missing.** It warned every run that
"phase appetites sum to 3d = 100% of 3d total — zero slack is its own fiction". The cycle
finished at **~112% actual burn**. Cycle 3's open question was whether a gate that judges the
*declared* plan means anything when the outcome comes in under it — there, 90% declared became
~60% actual and the missing slack turned out to be present. Here 100% declared became 112%
actual: Phase 02 overran by 0.35d and, with no slack to absorb it, that single overrun put the
whole cycle past its appetite. The prediction landed. This is the first firing on arc's own plan
that the outcome confirms rather than contradicts.

**It is still not promotable, and the reason is the ledger's own rule.** Cycle 3 logged the
`appetite-sum` firing with its false-positive question left open, and "a logged false-positive
resets that gate's count". So the count restarted at Cycle 3's close and this cycle is run **1
of the required 3**, not run 4. Criterion 1 is satisfied — `tests/kickoff-lint.bats:248` asserts
the gate fires on its own over-commit mutation — but criterion 2 is not, and the temptation to
read four historical rows as four clean runs is exactly what the reset rule exists to stop.

**Net: no flip.** The eight stay in `TRIAL`. What would change it for `appetite-sum`: two more
runs with the fire either confirmed by the outcome or absent. Promotion is also a code change
to `kickoff-lint.mjs`, and Phase 03's spec puts any code change out of scope — so even a
promotable gate could not have been flipped in this phase. It is the next cycle's first
candidate, recorded here rather than carried in someone's head.

**The other seven measure silence, not accuracy** — unchanged from Cycle 3, and now for a second
consecutive cycle they ran clean on a plan written by the same author who designed them.
Clean-because-correct and clean-because-blind stay indistinguishable until one fires on a plan
it did not shape. Two cycles of silence is not evidence of correctness; it is the same
un-tested condition, twice.
