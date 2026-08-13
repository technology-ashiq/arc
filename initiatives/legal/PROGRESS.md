# PROGRESS.md — arc-legal "the policy pack"

status: LIVE
cycle: arc-legal (Cycle 14, opened 2026-08-12)
phase: 00
appetite: 5d
burn: 0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Evidence is lane-scoped at `initiatives/legal/evidence/phase-NN/` (ADR-0055). ADRs, the
> retro-log, HISTORY and the trial-ledger stay at repo root (ADR-0053). This lane holds ADR
> century **1000–1099**; ADR-1000..1011 are locked there.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — three core pages end to end: schema, render, three lints, hash fixtures, two-surface adversarial pass, text attack panel | 2d | ✅ 2026-08-13 |
| 01 | The full set and its receipts — remaining four pages, scenario fixtures, completeness over seven, inbox wiring, hash-chain enforcement | 1.5d | in progress |
| 02 | Guards and governance — `--verify`, generated venture CI guard, pins + `--bump-templates`, template-edit approval, checklist renderer (all rows manual — probe automation cut at kickoff) | 0.5d | pending |
| 03 | The real render — LexOS real facts, approval, commit into its tree, integration handoff, evidence bundle, retro | 1d | pending |

## Done-log

**Phase 00 — closed 2026-08-13.** A facts file becomes seven pages, deterministically, and four
lints read the rendered bytes. Evidence: `initiatives/legal/evidence/phase-00/bundle.md`.

Closed against every exit criterion, with three things worth naming rather than burying:

- **CI green at `140cc00`, 19 of 19 jobs, read per-JOB.** It took three red runs to get there and
  every red was real — dead mutation controls, then a product with no CATALOG entry plus a test
  that asserted the wrong law, then a golden manifest regenerated mid-change instead of last.
- **The negative controls were dead for the whole first push.** The helper ran under bats `run`,
  a subshell, so every mutation control for all three lints silently passed. That is why three
  criticals survived to be found by an agent rather than by a test.
- **Five fresh attackers, ~70 findings**, and they were worth more than the code. Three converged
  independently on the same #1: a venture itemising other people's records with the flag false
  rendered a page that listed them and promised nothing.

Appetite: 2d budgeted, closed inside it.

## Appetite burn

**~3d of 5d used (60%).** Re-derived at this close, not carried forward: Phase 00 closed inside
its 2d, and Phase 01 has spent roughly 1d of its 1.5d with the receipts half now built and the
adversarial pass on it still running. Phases 02 and 03 hold 1.5d between them against a 2d
remainder, so the position is tight but not yet over.

The kill tripwire was **2.5d if Phase 00 is not closed**. Phase 00 IS closed, so it did not fire.
The honest read is that the scope grew rather than the estimate slipping: the reader panels
returned 68 findings and a fourth lint (ADR-1013) that no phase spec anticipated, because nothing
in the plan predicted that the worst defects would be BETWEEN pages rather than on them.

_Historic, for the record:_ **0d of 5d used.** Phase appetites sum to exactly 5d, so there is **no calendar slack** — the slack
is scope slack, held in the pre-decided cut order (probe automation → `--verify` polish → checklist
renderer) and never taken from the adversarial passes. Kill tripwire at 2.5d if Phase 00 is not
closed.

This figure is **re-derived at every close, never carried forward** — `arc-memory` 2026-08-12 shipped
a tracker reading 55% when the truth was 75%, set before the last phase was built and never
recomputed.

## Now

**Position:** kickoff **APPROVED 2026-08-13** — `decision.recorded` `01KZVM9TR488384Q7CR8P2N271`,
verdict `approve`, verified on the canonical spine and not quarantined. The owner approved in
session and instructed the build to run all four phases without further check-ins, pushing as it
goes and merging only once every phase is closed. Phase 00 is OPEN.

`kickoff-lint` passes with one WARN (zero calendar slack, true and named). The simulation gate ran
twice: 13 blockers → 8, all eight closed in the executor contract, and **round 2's fixes are not
re-verified** because only one respawn is permitted.

**What the kickoff verified rather than assumed:**

- The Build-out Mandate is on the canonical spine — `decision.recorded` **`01KZTM348858PDH44K4HA64CVA`**
  (deciding `01KZTM2DYQXXYHVBJZC462D982`), both read out of
  `E:/Work_Hub/01_Automemory/arc/.claude/state/hq/events/2026-08-12.jsonl`, neither quarantined.
- ADR century **1000–1099** claimed, checked across all sixteen sibling worktrees (highest anywhere
  is 0914).
- **Razorpay's page list is not the six the design source recorded.** The default activation flow
  documents FIVE; a separate, conditional six-item list exists for additional e-commerce sites. The
  built set is the verified superset of SEVEN (ADR-1001), and the "card statement descriptor" claim
  was dropped as unverified.
- **DPDP Rule 3 is NOT in force.** Notice, consent, grievance and SDF duties all commence together
  on 13/14-May-2027; today only Board-institutional provisions are live (ADR-1006).
- **LexOS is not a merchant.** Its own ADR-0003 makes each law firm its own Razorpay merchant, so
  `payment_model` gained a third value `none` before any receipt exists (ADR-1011). It also has zero
  policy pages and no footer at all.

**Open, and owed to the owner before Phase 00 code:** the operator's GST-registration posture
(assumptions ledger row 3). Both branches exist either way, so it blocks Phase 03, not Phase 00.

**Kickoff receipts, emitted from the canonical clone and verified by event id in `events/` with
zero matching entries in `events/_quarantine/`:**

| kind | id |
|---|---|
| `kickoff.done` | `01KZVK87WKTN34N7HPXE8A1A3N` |
| `approval.requested` | `01KZVK8EMVQAE4ZEFB99HKGKBM` |
| `decision.recorded` | `01KZVM9TR488384Q7CR8P2N271` (verdict `approve`, decides the row above) |

**Built so far (Phases 00 and 01, not yet closed against their DoD):** the bounded YAML parser,
the total type-tagged canonicaliser, the three-tier schema with cross-field rules, the clause
renderer, the three lints, seven authored pages, six cross-product fixture ventures, three bats
suites and two node probes. All six ventures render all seven pages at **0 FAIL, 0 WARN**; every
mutant negative control is RED; `kickoff-lint` and `product-lint` pass.

**Five fresh attackers ran** — three text stances on the RENDERED bytes, plus decision-logic and
shell/OS surfaces on the code. They returned roughly 70 findings between them and they were worth
more than the code. Three converged independently on the same #1: a venture itemising other
people's records with the flag false rendered a page listing them and promising nothing. The
decision-logic pass found three criticals that put a false or missing legal statement on a page at
exit 0. The shell/OS pass found why macOS was red — a lexical path compare in the entry guard,
whose correct version already existed in the memory lane and had never been applied here.

**The honest part:** CI was RED on the first Phase 00 push, on exactly the eight mutation controls.
Every negative control for all three lints was dead — the helper ran under bats `run`, a subshell —
which is why the three criticals survived to be found by an agent rather than by a test. Fixed.

**CI IS GREEN.** Run `31672005249` at `dae95d5` — 19 of 19 jobs `success`, read per-JOB. It took
three runs: the first was the dead mutation controls, the second was two real defects (a product
on disk with no `CATALOG` entry, and a test asserting the wrong law).

**Correction to what this file said yesterday.** It reported Phases 00 and 01 as "built, not yet
closed". That was true of Phase 00 and **wrong about Phase 01**, which is roughly half built. Two
fresh spec-fidelity passes, reading only each spec and its diff, returned Phase 01 at **2 criteria
MET, 5 PARTIAL, 7 NOT MET**. The seven pages and the render side are done; the entire
receipts/approval/publish half is not:

| Phase 01 criterion | State |
|---|---|
| four remaining pages authored | MET |
| text attack panel on the four new pages | **MET this session** — 3 stances, 68 findings, all UNSOUND |
| scenario fixture set, own commit, before the lint | **MET this session** — 36 rows, `db5f896` |
| completeness reports MISSING and UNANSWERED | **MET this session** — `547d3f9`, 4 running controls |
| routes from FORMAT-tier facts, no URL constants | MET |
| `tree-manifest` regenerated for the new shipped files | **NOT MET — unsatisfiable as written.** `products/legal/` is outside `.claude/`, the only tree either sync path copies, so the manifest has zero rows for it |
| CI check that `targets.publish` stays empty, with a mutant | NOT MET |
| `approval.requested` strict payload, unknown keys rejected | NOT MET |
| owner decision via `arc-inbox` → `decision.recorded` | NOT MET |
| every emit verified by id in `events/` and `_quarantine/` | NOT MET |
| publish refuses a hash mismatch · TOCTOU fixture · backdating fixture | NOT MET |
| re-publish semantic diff | NOT MET |
| two-surface adversarial pass on the **receipt/approval** path | NOT MET — two surfaces ran, on render/lint/CLI. Same ceremony, different subject, and the subject was the point |

`tests/legal-pages.bats`, `legal-scenarios.bats` and `legal-receipts.bats` were the verification
plan's three suites. Only `legal-scenarios.bats` now exists.

**A non-negotiable is breached and the owner should see it.** ADR-1007 fires the kill-criteria
path when a panel calls the DPDP clause unsound. `privacy.mdx` says *"The DPDP Act **gives you**
the option…"* in the present tense, eight sections after saying those provisions have not
commenced — so the page denies and asserts the same duty. ADR-1006 is the decision it breaks. The
fix is one sentence; the reason it survived four reads is that it sits inside the clause everyone
had already approved, and **no lint in this lane compares two clauses on one page**.

### Since that correction was written

| Criterion | Now |
|---|---|
| CI check that `targets.publish` stays empty, with a mutant | **MET** — `publish-gate.mjs`, three mutants (inline list, block list, key deleted). See the honest gap below. |
| completeness reports MISSING and UNANSWERED | MET |
| scenario fixture set | MET — 42 rows |
| text panel on the four new pages | MET — 68 findings, 8 of the worst closed, 8 named as open |

**The kill-criteria sentence is fixed.** `privacy` now says s.5(3) has not commenced and that the
option is offered voluntarily, ahead of the duty. Grepped the pattern across all seven templates:
every other DPDP reference was already future-tense.

**ADR-1013 adds a fourth lint, `consistency`**, because three reader stances independently put a
contradiction BETWEEN two pages in their top four findings — and every one of those pages passed
all three existing lints, which each read a single page. The negative control is the argument:
`mutate cross-page-drift` scores value 0 · trace 0 · completeness 0 · **consistency 1**.

**A GSTIN pattern was standing in for validation.** All three gst fixtures carried structurally
perfect numbers whose statutory Mod-36 check digit was wrong. Found by the regulator stance, not
by any test here.

**Honest gaps, named rather than left to be found:**

- `publish-gate.mjs` should be its own CI step. `.github/` is write-denied in this workspace, so
  it runs inside the bats step instead — a publish target still turns the build red; what is lost
  is the clear failure label, not the coverage.
- `products/legal/` still reaches no consumer: `templates/` and `data/` sit outside `.claude/`,
  the only tree either sync path copies.
- Eight panel findings remain open, listed in the evidence file. None asserts an untruth; each is
  a page less complete or more absolute than it should be.

**Still NOT built — the receipts half of Phase 01:** `publish` with hash-chain enforcement, the
TOCTOU and backdating fixtures, `approval.requested` with its strict payload, the `arc-inbox`
decision, re-publish semantic diff, and the two-surface adversarial pass on that path. Phases 02
and 03 are untouched.

**CI:** last green was `dae95d5` (19/19). `0d79056` went red on the sync byte-identity tests —
the golden manifest was regenerated mid-change instead of last, a rule already written in
`.claude/rules/testing.md` (defect-list row 19). Fixed at `97060bf`, and every commit since
regenerates it last. Runs for `97060bf`, `4e9d2c0` and `1db8407` are queued behind a saturated
runner pool and **have not yet reported** — nothing after `dae95d5` is proven green.

**Carried, not resolved:** the operator's GST-registration posture (assumptions ledger row 3).
Fixtures cover both branches, so nothing before Phase 03 depends on the answer; Phase 03 asks it or
renders `gst_registered: false` under the ledger row's trigger.
