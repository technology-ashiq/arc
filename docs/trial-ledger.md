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
| 2026-08-03 | approach-sketch, the COUNT only (develop-lint) | registered at birth, arc-develop Phase 07 | not yet | — |
| 2026-08-03 | approach-sketch COUNT (develop-lint) | arc-develop Cycle 6, phases 05-08 | **YES** — fired on phase-01 slice 01, whose title names `develop-lint.mjs` | **unadjudicated** — the slice predates the check by four phases, so the firing is retroactive: neither a clean fire nor a false one. It has never yet fired on a slice written while the check existed |
| 2026-08-03 | self-declared-number (develop-lint) | arc-develop Cycle 6, phases 05-08 | no — silent across 55 slices | **n/a — not counted as a clean run.** Same-author silence on ledgers written against the check, which this file already says must not be scored as accuracy |
| 2026-08-03 | tier-floor (develop-lint) | arc-develop Cycle 6, phases 05-08 | no — silent; no `kind: ui` slice exists to test it | **n/a — not counted.** The floor it exists to enforce was never reachable |
| 2026-08-07 | birth-rule (kickoff-lint) | registered at birth, policy Phase 03 | not yet | — |
| 2026-08-09 | heading, inventory, id, row-field (report-lint) | registered at birth, absorb Phase 00 | fired on deliberately malformed inputs only — see note | **n/a — not counted** |
| 2026-08-09 | lock-ref, duplication (registry-ref) | registered at birth, absorb Phase 00 | fired on deliberately malformed inputs only — see note | **n/a — not counted** |
| 2026-08-09 | status, cap, decision-ref, evidence, shape (registry-ref) | registered at birth, absorb Phase 02 | fired on deliberately malformed inputs only — see note | **n/a — not counted** |
| 2026-08-09 | allowlist, deps, attribution (rebuild-lint) | registered at birth, absorb Phase 02 | fired on deliberately malformed inputs only — see note | **n/a — not counted** |
| 2026-08-07 | birth-rule (kickoff-lint) | arc's own tree, all 8 lanes | no — silent on every lane | **n/a — NOT counted as 8 clean runs, and not as one.** See below |

### `birth-rule` — why its silence proves nothing yet (policy Phase 03, REQ-07)

The gate fires when a `processes/*.process.yaml` has no `process:NAME` row in `hq.policy.yaml`.
Run across all eight lanes on 2026-08-07 it printed **nothing**, and that is the correct output:
all three processes carry rows. It is also **worthless as promotion evidence**, for the reason
this file already states twice — same-author silence on a tree written against the check is not
accuracy, it is tautology. Counting eight silent lanes as eight clean runs would be the most
expensive misreading available here.

**What a real clean run looks like for this gate:** a process file lands in `processes/` in some
*other* lane's change, and the gate fires on it, and the row it asked for turns out to be the
right thing to add. Until a process is born after this check existed, the count stays at zero
however many times the lint is run.

**Fixture-proven: yes**, and by more than the criteria ask. `tests/kickoff-lint.bats` carries nine
`[birth-rule]` cases including both directions of the `name:`-beats-filename rule, an unparseable
policy file, and a CI control that runs against the real tree. Two fresh adversarial agents on
different surfaces additionally built mutant `kickoff-lint` copies with the check deleted, to find
tests that stay green when the gate is gone.

**A tension worth recording for whoever judges promotion.** By the principle stated below for
`develop-lint` — structural checks BLOCK from v1, only heuristics WARN-first, because false-block
risk lives in pattern matching and never in "did the file parse" — this gate is **structural**. A
file either has a row or it does not; there is no judgement in it and no false positive to protect
against. It is in TRIAL anyway, and not for the usual reason: `kickoff-lint.mjs` is run by every
lane and is **synced into consumer repos with no policy engine**, so the blast radius of a wrong
FAIL is a sibling lane's kickoff breaking over a file it never touched. That is a
consequence-of-being-wrong argument, not a likelihood-of-being-wrong one, and it is the whole
reason `/arc-retro` should think twice before promoting a check that looks trivially safe.

`develop-lint` ships its **structural** checks as real BLOCKs from v1 and only its **heuristic**
checks WARN-first. The line is drawn on a principle, not a preference: false-block risk lives in
pattern matching, never in "did the file parse".

| group | why it is in trial | what would promote it |
|---|---|---|
| `self-declared-number` | a regex looking for a quality claim carrying a number. It could trip on a legitimate version string, dependency count or duration — none of which has been seen in a real ledger yet | fixture-proven both ways (it fires on `confidence 95%`, stays silent on `node 22.3.0` — both pinned in `tests/develop-lint.bats`) **plus** ≥3 clean dogfood runs on real phases with zero false positives |
| `approach-sketch`, the COUNT only | "this slice should have had sketches" rests on a path glob deciding what is risky, and a glob is a heuristic that has never fired on a real phase. Its CONTENT checks are deliberately NOT in trial and FAIL from v1: a sketch pricing itself in months is a fact about the text, not a judgement about the path | fixture-proven both ways (it warns on a risk-glob slice with no sketches and stays silent on a non-risk slice, both pinned in `tests/develop-quality.bats`) **plus** ≥3 real phases where a warned slice genuinely wanted alternatives and an unwarned one genuinely did not |
| `tier-floor` | the UI and external-dep evidence floors have never run against a real UI slice, because this cycle has no UI REQ. Its judgement is untested on the thing it exists to judge | the same, and specifically ≥1 real `kind: ui` slice where the floor's verdict was checked against what a human thought of the evidence |

Not promotable on clean-run count alone: neither group has yet fired on a real phase, and a gate
that has never fired has not been observed to be right — only to be quiet.

<!-- Append one row per (gate × kickoff run). run-ref = a PLAN commit SHA, a dry-run id, or a
     fixture name. fired? = did the gate WARN on that run. false-positive? = did it WARN on a plan
     that was actually fine. Delete the (example) row once real runs exist. -->

### absorb Cycle 10 close, 2026-08-09: THREE gates exercised, ZERO promotable, count stays at zero

`report-lint` · `registry-ref` · `rebuild-lint`. Each fired repeatedly this cycle, and **not one
firing counts as a clean dogfood run.** Every input they fired on was malformed **on purpose, by
their own author, minutes after the check was written** — a heading renamed, a citation blanked, a
lane string case-varied, a reference pointed at a package that does not exist.

**That is fixture evidence (criterion 1). It is not criterion 2, and the distinction is the whole
point of this file.** Counting it would be the same-author-silence error this ledger already refuses
twice, merely inverted: same-author **noise**, on inputs built to make noise.

**All three are fixture-proven to the criteria's satisfaction**, and more than asked: each carries a
mutant negative control that RUNS a stub and asserts the suite rejects it — necessary because all
three are WARN-first and exit 0 on every judged run, so an exit-code assertion proves nothing and
only the warning payload can fail.

**What a real clean run looks like for these three:** a report, registry row or rebuild diff produced
by an actual study, where the lint fires on something the author did not already know was wrong and
the thing it asked for turns out to be the right thing to add. Phase 04 produced the first real
report — and it linted **clean on the first run**, so it is not a fire and not a clean-run datapoint
either. **The count stays at zero for all three.**

**One uncomfortable note for whoever eventually judges promotion.** In three of this cycle's four
adversarial passes, CI was GREEN 19/19 and the pass then found serious holes in these very gates —
including a report consisting entirely of quoted studied content that `report-lint` passed with
**zero warnings**, and a registry row copying every lock-owned field one level deeper that
`registry-ref` resolved **completely clean**. A gate that a fresh attacker walks past is not ready to
FAIL a build, whatever its run count says. **Promotion should wait on an adversarial pass finding
nothing, not merely on three quiet runs.**

| date | gate | run-ref | fired? | false-positive? |
|---|---|---|---|---|
| 2026-08-09 | heading, inventory, id, row-field (report-lint) | absorb Cycle 10 close | author-malformed only; clean on the first REAL report | **n/a — not counted** |
| 2026-08-09 | lock-ref, duplication, status, cap, decision-ref, evidence, shape (registry-ref) | absorb Cycle 10 close | author-malformed only; clean on the first REAL row | **n/a — not counted** |
| 2026-08-09 | allowlist, deps, attribution (rebuild-lint) | absorb Cycle 10 close | author-malformed only; clean on the one REAL rebuild diff | **n/a — not counted** |

### `report-lint` and `registry-ref` — registered at birth, and their first fires do NOT count (absorb Phase 00)

Two lane-owned WARN-first gates joined the ledger on 2026-08-09, following the `develop-lint`
precedent that this file already covers gates outside `kickoff-lint`:

- **`report-lint`** (`.claude/scripts/absorb/report-lint.mjs`) — groups `heading` · `inventory` ·
  `id` · `row-field`. Validates an extraction report against ADR-0601.
- **`registry-ref`** (`.claude/scripts/absorb/registry-ref.mjs`) — groups `lock-ref` ·
  `duplication`. Asserts a registry row's reference into `capability-lock.json` resolves, and that
  the row copies none of the lock's fields (A5).

**Both fired during Phase 00's steel-thread demo, and neither firing is promotion evidence.** Every
input they fired on was malformed *on purpose, by their own author, minutes after the checks were
written* — a heading renamed, a citation blanked, a reference pointed at a package that does not
exist. That is **fixture evidence** (promotion criterion 1) and it is recorded as such. It is not a
clean dogfood run (criterion 2), and counting it would be the same-author-silence error this file
already refuses twice, merely inverted: same-author *noise* on inputs built to make noise.

**What a real clean run looks like for these two:** a report written during an actual study — Phase
01 at the earliest, Phase 04 for the first real one — where the lint fires on something the author
did not already know was wrong, and the thing it asked for turns out to be the right thing to add.
Until then the count stays at **zero**.

**One asymmetry worth flagging for whoever judges promotion.** `registry-ref`'s `duplication` group
is structural, not heuristic: a row either has a `hash` key or it does not, and there is no
judgement in it. By this file's own structural-vs-heuristic principle it would qualify to BLOCK from
v1. It is in TRIAL on **consistency** instead — absorb's other gate is genuinely heuristic, and
shipping one lane's two gates at two different severities in the same phase would make the WARN-first
rule look negotiable. That is a consequence-of-inconsistency argument, not a
likelihood-of-being-wrong one, and it is the weaker of the two reasons this file has seen for holding
a structural check in trial.

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

---

## Cycle 7 · arc-evolve (2026-08-03 → 2026-08-04) — no promotion

| date | gate | run-ref | fired? | false-positive? |
|---|---|---|---|---|
| 2026-08-04 | `appetite-sum` | every run, cycle-long | **yes, every run** | **unadjudicated — see below** |
| 2026-08-04 | 7 other kickoff-lint substance gates | every run | no | **n/a — not counted** (author-written plan; silence, not accuracy) |
| 2026-08-04 | `spine-api` | evolve board joins the scan (`b103d7a`); `spine-reader-lint.sh` exit 0 | no | no |

**`appetite-sum` — 100% declared, 100.0% actual, and the fire scores as neither.** It warned every
run that "phase appetites sum to 7d = 100% of 7d total — zero slack is its own fiction". Cycle 4 is
this gate's one confirmation (100% declared → 112% actual). Here the cycle landed **exactly at cap
and did not overrun**, so the prediction neither landed like Cycle 4's nor inverted like Cycle 3's.

The substance did hold, and it is on the record in the lane: Phase 04 was named at kickoff as the
designated cut and was **built rather than cut**, so the only slack in the plan was spent as work.
The cycle carried no buffer and finished only because nothing went badly wrong for long. That is
the condition the gate names — it simply never got tested, because nothing needed absorbing.

**Unadjudicated, therefore counts toward nothing**, the same treatment `pre-mortem-cite` and
`adr-wired` have carried since 2026-07-19. The run count stays at **1 of 3** (Cycle 4's).

**`spine-api` — the run this ledger asked for by name arrived, and it still is not the run it
needed.** The 2026-07-28 decision said what would move it: *"one more clean run plus at least one
run against hq consumer code written by someone not designing to this lint — the natural occasion
is the next cycle's first new spine consumer (dashboard, **evolve**, or policy)."* evolve arrived.
`.claude/scripts/evolve/board.mjs` is a genuine outside consumer of the reader contract, the lint
was widened to scan `.claude/scripts/evolve/`, and it exits 0. That is the third clean run.

**But `board.mjs` was written with ADR-0030 in hand.** It is the same author designing to the same
lint, which is precisely the ambiguity this file already refuses to resolve in a gate's favour. The
condition was "code written by someone **not** designing to this lint", and that has still never
happened. Criterion 1 remains the strongest in the file; criterion 2 remains unmet on its own terms.

**Net: no flip.** Nothing leaves the `TRIAL` set; `arc.gates.yaml` keeps `mode: warn` for
`spine-api`.

### Registered, not promoted: a pattern-matching gate that BLOCKs from birth

Cycle 7 shipped the **money-surface denylist** (`.claude/scripts/core/money-surfaces.json` +
`moneySurfaceMatch`), which refuses any `promote_via` path touching a money surface. REQ-01 required
it to `exit 2` **permanently**, from birth — and it is a glob pattern-match, exactly the shape
ADR-0101 assigns to WARN-first trial ("false-block risk lives in pattern matching, never in did the
file parse").

It is recorded here as a **deliberate exception, not an oversight**. The asymmetry justifies it: a
false block refuses to auto-optimise something it should not have touched, which is the safe
direction, whereas a false pass lets an experiment rewrite a payment path. Its v2 form is already
infix (`**/*stripe*/**`) because prefix-only matching missed `app/(pricing)/page.tsx` during the
adversarial pass. Logged so the exception is visible rather than assumed.

> Gap noted, not filled: this ledger has no promotion decision for **Cycle 5** or **Cycle 6**. The
> eight kickoff-lint gates ran across both. Their evidence is unrecorded and cannot be
> reconstructed here honestly, so it is not being back-filled — only flagged.

## Cycle 9 (policy) + Cycle 10 (absorb) — promotion decision, 2026-08-10

| date | gate | run-ref | fired? | false-positive? |
|---|---|---|---|---|
| 2026-08-06 | `appetite-sum` | arc-policy kickoff, then every run cycle-long | **yes, every run** | **no — outcome-confirmed TRUE positive** |
| 2026-08-09 | `appetite-sum` | arc-absorb kickoff, then every run cycle-long | **yes, every run** | **no — outcome-confirmed TRUE positive** |
| 2026-08-09 | `pre-mortem-cite` · `adr-wired` · `adr-confidence` · `architecture` · `current-state-structure` · `nonneg-drift` · `verify-red` | arc-absorb kickoff + 5 phase closes | **no** | n/a — silent runs, no evidence either way |

**`appetite-sum` scored honestly, and both fires were RIGHT.** On policy it warned that phases summed
to 6.75 of 7 days; the 0.25d of slack was then consumed by the owner-action round trip that the plan
had not predicted. On absorb it warned *"6.5d = 81% of 8d total — zero slack is its own fiction"*; the
1.5d of slack was then consumed by Phase 04 **reopening**. In both cycles the gate said the margin was
thin and in both cycles the margin was spent on something unplanned. That is what a true positive looks
like when the plan survives anyway.

**Net: NO FLIP. The eight stay in `TRIAL`, and the reason is unchanged from Cycles 3, 4 and 7.**

`appetite-sum` now has **four** runs that are clean or outcome-confirmed (venturemind 07-19, 08-02,
policy 08-06, absorb 08-09) against a bar of three. It is fixture-proven: `tests/kickoff-lint.bats`
asserts both the over-commit warning payload and that an unparseable appetite never fails. **On the
letter of the criteria it is promotable.** It is not being promoted, for one reason written down rather
than felt: **three rows in this ledger read *"unadjudicated, leaning false"*** (07-22, 07-28, 08-04).
This ledger's own rule is that a logged false-positive resets the count, and flipping a gate from WARN
to FAIL while three of its own rows lean toward having been wrong would be promoting on judgement —
which is the single thing the ledger exists to prevent.

**What would settle it, concretely.** Adjudicate those three rows: for each, read the cycle's final
burn out of its `PROGRESS.md` and ask whether the slack the gate warned about was in fact needed. That
is three lookups against committed numbers, not a new dogfood cycle. It is the smallest remaining piece
of work between `appetite-sum` and being the first live substance gate — and it is deliberately left as
a named task rather than done here, because a gate promoted in the same breath as the evidence that
promoted it has had no second reader.

**The other seven stayed silent across two full cycles.** Ten phase closes, two kickoffs, zero fires.
Silence is not evidence of correctness — `[trial-status]` has reported `0 live, 9 in trial` since
Cycle 3, and a gate that has never fired on a real plan has never been tested by one either.

---

## Cycle 11 · arc-memory — 2026-08-12

| date | gate | run-ref | fired? | false-positive? |
|---|---|---|---|---|
| 2026-08-12 | `appetite-sum` (**zero-slack** branch) | arc-memory Cycle 11, every run cycle-long | **yes, every run** — 4.5d = 90% of 5d | **leaning false** — the cycle closed at **75% of 5d**, so the slack it warned was missing was in fact there. Same shape as 07-22 and 08-04 |
| 2026-08-12 | `appetite-sum` (**over-commit** branch) | arc-memory Cycle 11, every run cycle-long | **no** — 4.5d <= 5d, correctly silent | **no** — a clean run |
| 2026-08-12 | `birth-rule(kickoff-lint)` | arc-memory Cycle 11, every run | **no** — 3 processes checked against `hq.policy.yaml`, 0 ungoverned | **no** — a clean run |

### The finding that settles `appetite-sum`, and it is not the adjudication

Cycle 10's retro left three lookups as the smallest remaining piece of work. Doing them turned up
something the ledger had been missing for three cycles: **`appetite-sum` is two gates, and only one
of them is promotable.**

```
kickoff-lint.mjs:327   if (sumDays > totalDays)        gate("appetite-sum", "... over-commits ...")
kickoff-lint.mjs:329   else if (sumDays > 0.8*total)   warn("appetite-sum", "... zero slack ...")
```

Line 327 goes through `gate()`, which consults `TRIAL`. **Line 329 calls `warn()` directly**, so the
zero-slack branch is a WARN *by construction* — removing the group from `TRIAL` cannot touch it, now
or ever. The two branches have been logged under one name since 2026-07-19, and every argument about
promotion has been conducted as though a single gate were being flipped.

Sorting the three doubtful rows by branch:

| row | branch | recorded outcome | adjudication |
|---|---|---|---|
| 2026-07-22 (92% of 30d) | **zero-slack** | closed ~20–22% | leaning false stands — **and promotion cannot affect it** |
| 2026-08-04 (evolve, 100% declared) | **zero-slack** | C7 closed at **100% of 7d** | the gate was RIGHT: a cycle landing on exactly 100% had no margin, which is what it said — **and promotion cannot affect it either** |
| 2026-07-28 (14.5d > 12.5d) | **over-commit** | C2 closed at ~40% of 12.5d | **re-adjudicated: TRUE POSITIVE** — see below |

**2026-07-28 was scored against the wrong question, and the ledger contradicts itself on it.** The
2026-07-19 venturemind row is the identical shape on the identical branch (16d > 15d) and is recorded
as a *"verified TRUE positive"*. 07-28 was judged by outcome — *the overrun never happened* — while
07-19 was judged by arithmetic. **The over-commit branch does not predict an overrun.** It says the
declared phases do not fit inside the declared appetite, which is a defect in the document, not a
forecast about the work. That defect was real on 2026-07-28 and is still real in the archived plan.
Scoring the same shape two ways is the inconsistency; fixing it is not judgement, it is arithmetic.

**Over-commit branch, after adjudication:** two fires (07-19, 07-28), **both TRUE**, zero false
positives, plus a clean silent run this cycle and on every cycle since. Fixture-proven at
`tests/kickoff-lint.bats` — the over-commit payload is asserted, and an unparseable appetite is proven
never to fail. **Both criteria hold on the branch that promotion actually moves.**

**Checked before proposing, because a promotion that breaks a live lane is worse than no promotion:**
every one of the nine lane PLANs plus the root-mode PLAN was run through the gate first. **Zero trip
the over-commit branch** (`over-commit=0` on all ten), so the flip changes no lane's exit code today.

**Net: FLIP — `appetite-sum` leaves `TRIAL`**, on the owner's approval as the second reader, which is
the condition Cycle 10 named. The zero-slack branch keeps warning forever and keeps its two
leaning-false rows, because `warn()` is what it calls. `[trial-status]` goes to **1 live, 8 in trial** —
the first substance gate to go live since the set was created in Cycle 3.

**The other eight stayed silent again.** Eleven phase closes now, three kickoffs, zero fires. Silence
is still not evidence of correctness.
