# PROGRESS.md — arc-legal "the policy pack"

status: LIVE
cycle: arc-legal (Cycle 14, opened 2026-08-12)
phase: 03
appetite: 5d
burn: 4d
blocked-on: owner — five LexOS facts and a DPDP Rule 3 gazette check (Phase 03)
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Evidence is lane-scoped at `initiatives/legal/evidence/phase-NN/` (ADR-0055). ADRs, the
> retro-log, HISTORY and the trial-ledger stay at repo root (ADR-0053). This lane holds ADR
> century **1200–1299**; ADR-1200..1011 are locked there.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — three core pages end to end: schema, render, three lints, hash fixtures, two-surface adversarial pass, text attack panel | 2d | ✅ 2026-08-13 |
| 01 | The full set and its receipts — remaining four pages, scenario fixtures, completeness over seven, inbox wiring, hash-chain enforcement | 1.5d | ✅ 2026-10-07 |
| 02 | Guards and governance — `--verify`, generated venture CI guard, pins + `--bump-templates`, template-edit approval, checklist renderer (all rows manual — probe automation cut at kickoff) | 0.5d | ✅ 2026-10-07 |
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

**Phase 01 — closed 2026-10-07.** A decision approves bytes, and a re-publish shows what moved
before anyone signs it. Evidence: `initiatives/legal/evidence/phase-01/bundle.md` (manifest verified).

- **Built 2026-08-13/14, left open for seven weeks** with one criterion unmet: the semantic diff
  returned a constant empty field list and printed after the stamp. Built in PR #341 (`5e9f9e63`).
- **CI green at `37af2cfb`, 19 of 19 jobs, read per-JOB.** Two reds on the way, both real: a test
  whose mutant the schema refused before the diff ran, and a wiki count stale against a main that
  had moved during the run.
- **The real approval round-trip refused once, correctly.** The owner's first stamp
  (`01M49827H07TBPT40AZWGMCV34`) was refused as BACKDATED because the fixture still carried its
  August effective date. The second (`01M498QE6KV4T17YESB7DV18WX`) published 7 pages, verify INTACT.
  Every id is in `events/` and absent from `_quarantine/`.
- **Attackers:** four boundary passes and one logic pass, 1+1 high and 16 medium fixed, lows in
  `debt-ledger.md`. They had run with no carried defect list for the whole lane until 2026-10-06.
- `legal-receipts.bats` 31 → 42 tests. amendments: 0 · reopened: n.

Appetite: 1.5d budgeted, ~2d spent (over by ~0.5d, mostly the attack rounds and the late gap).

**Phase 02 — closed 2026-10-07.** A page that drifts from its receipt is detectable without arc,
a template edit cannot reach a venture silently, and the checklist asks for what a URL served.
Evidence: `initiatives/legal/evidence/phase-02/bundle.md` plus its 2026-10-06 addendum.

- Built 2026-08-14/15. One criterion was unmet until PR #341: a reachability PASS needed no served
  evidence. It now needs an excerpt plus the matched page hash, and says `self-attested, not
  fetched` on the row, because the probe arm is cut #1.
- `legal-checklist.bats` 10 → 14, `legal-pins.bats` 19. amendments: 0 · reopened: n.

Appetite: 0.5d budgeted, ~0.5d spent.

## Appetite burn

**~4d of 5d used (80%).** Re-derived at the 2026-10-07 close: Phase 00 2d, Phase 01 ~2d (0.5d
over), Phase 02 ~0.5d. Phase 03 holds 1d against a 1d remainder, so there is no slack left. The
next overrun is a scope cut inside Phase 03 (the integration handoff stays a document; nothing is
wired into LexOS), not an extension.

_Previous reading, 2026-08-15:_ **~3d of 5d used (60%).** Phase 00 closed inside
its 2d, and Phase 01 had spent roughly 1d of its 1.5d with the receipts half built and the
adversarial pass on it still running. Phases 02 and 03 held 1.5d between them against a 2d
remainder.

The kill tripwire was **2.5d if Phase 00 is not closed**. Phase 00 IS closed, so it did not fire.
The honest read is that the scope grew rather than the estimate slipping: the reader panels
returned 68 findings and a fourth lint (ADR-1213) that no phase spec anticipated, because nothing
in the plan predicted that the worst defects would be BETWEEN pages rather than on them.

_Historic, for the record:_ **0d of 5d used.** Phase appetites sum to exactly 5d, so there is **no calendar slack** — the slack
is scope slack, held in the pre-decided cut order (probe automation → `--verify` polish → checklist
renderer) and never taken from the adversarial passes. Kill tripwire at 2.5d if Phase 00 is not
closed.

This figure is **re-derived at every close, never carried forward** — `arc-memory` 2026-08-12 shipped
a tracker reading 55% when the truth was 75%, set before the last phase was built and never
recomputed.

## Now

**Position (2026-10-07):** Phases 00–02 closed. **Phase 03 OPEN, blocked on the owner:** five
LexOS facts, a gazette check of the DPDP Rule 3 date, then a read and stamp of the seven real
pages. **Set LexOS's `effective_date` on or after the day the stamp will land.** The fixture's
August date was refused as BACKDATED on 2026-10-07, and that cost one stamp.

**Phase 03 so far (2026-10-07):** at the owner's request the five owed facts carry clearly marked
PLACEHOLDER values in the private facts file, and the real values come later. Seven pages render
with all four lints run and 0 findings, and the checklist reads 7/7 NOT-APPLICABLE. A DRAFT is
committed in LexOS on `feat/legal-pages` (`649634a`, worktree `wt-lexos-legal`, not pushed) with
`legal/HANDOFF.md`. **Not proposed or published:** a stamp on placeholder bytes would be voided by
the real facts anyway (TOCTOU). **Found on the way, routed via `/arc-change`:** a real venture's
publish ledger would have landed in arc's PUBLIC tree with per-field prints of the operator's
contact facts. ADR-1214 moves it beside the venture's facts, and Phase 03 gained that criterion.

_Below: the 2026-10-06 note that led to these closes._

The tracker said `phase: 00 · burn: 0d` for seven weeks while Phases 01 and 02 were built on top
of it. Re-read against the specs on 2026-10-06, each phase had one exit criterion that was never
met, and both are now built in PR #341:

- **Phase 01** — the re-publish semantic diff returned a constant empty field list and printed
  only at publish, after the stamp. It now names the moved field at propose, binds the ledger it
  diffed against (`PREVIOUS_MOVED`), and WARNs `FULL-BLOB` when nothing can be named.
- **Phase 02** — a reachability PASS needed no served evidence at all. It now needs an excerpt of
  the served body and the page hash it matched, and every PASS is labelled `self-attested, not
  fetched`.

Bundles: `evidence/phase-01/bundle.md` (new) and the 2026-10-06 addendum in
`evidence/phase-02/bundle.md`. Low attack findings: `debt-ledger.md`.

**What closes Phase 01, in order:** merge #341 → from the canonical clone, raise a fresh fixture
`legal.publish` request on the merged engine (the one raised 2026-10-06, `01M46QX0KG8CB77HSX9AEE638E`,
predates the `previous_published_sha256` key and is left undecided on purpose) → **the owner stamps
it with `arc-inbox approve`** → publish → verify both ids in `events/` and absent from
`_quarantine/` → `/arc-phase-done 01`, then `/arc-phase-done 02`.

**What Phase 03 needs from the owner:** five facts in `~/.arc-private/legal/lexos/facts.yaml`
(legal name as on the PAN, geographic address, grievance postal address, `pricing.period`,
`effective_date`), a read and stamp of the seven rendered pages, and a gazette re-check of the DPDP
Rule 3 commencement. Secondary sources (Sept 2026) still put it at 13-May-2027 with the MeitY
compression proposal un-gazetted, so ADR-1206's revisit trigger has not fired; the primary fetch
did not return the commencement text, so assumptions-ledger row 2 stays a human check.

---

_Kickoff record, 2026-08-13, kept for the receipts:_

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
- ADR century **1200–1299** claimed, checked across all sixteen sibling worktrees (highest anywhere
  is 0914).
- **Razorpay's page list is not the six the design source recorded.** The default activation flow
  documents FIVE; a separate, conditional six-item list exists for additional e-commerce sites. The
  built set is the verified superset of SEVEN (ADR-1201), and the "card statement descriptor" claim
  was dropped as unverified.
- **DPDP Rule 3 is NOT in force.** Notice, consent, grievance and SDF duties all commence together
  on 13/14-May-2027; today only Board-institutional provisions are live (ADR-1206).
- **LexOS is not a merchant.** Its own ADR-0003 makes each law firm its own Razorpay merchant, so
  `payment_model` gained a third value `none` before any receipt exists (ADR-1211). It also has zero
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

**A non-negotiable is breached and the owner should see it.** ADR-1207 fires the kill-criteria
path when a panel calls the DPDP clause unsound. `privacy.mdx` says *"The DPDP Act **gives you**
the option…"* in the present tense, eight sections after saying those provisions have not
commenced — so the page denies and asserts the same duty. ADR-1206 is the decision it breaks. The
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

**ADR-1213 adds a fourth lint, `consistency`**, because three reader stances independently put a
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

---

## PICK UP HERE (next session)

**Last known-good: `eacce4e`, run `31701045962`, 19/19 jobs success, read per-JOB. Tree clean,
nothing half-built, nothing red.** Everything below is un-started work, not work in progress.

Do these in order. Each is independently shippable.

1. **`pins.yaml` + `--bump-templates`** — the biggest remaining item, and bigger than it sounds.
   The criterion is *"venture A on template set v3 and venture B on v5 both render correctly in
   one fixture run"*, and only `v1` exists today, so this needs a real multi-version set: a
   per-venture pin file, resolution of `TEMPLATE_SET` from it instead of the module constant, and
   two sets maintained at once. `--bump-templates` then forces per-venture re-approval, and a
   publish against a moved `template_set_sha` without a bump must be REFUSED.
   *Note:* `renderInputs()` currently hashes templates **and** all of `data/`, so "the set moved"
   already covers more than the name suggests — read its comment before changing the pin shape.

2. **Venture-side CI guard snippet** — must be **GENERATED from the same comparison function
   `--verify` calls**, never hand-copied. The spec is explicit about why: a future canonicaliser
   fix would land in `--verify` while the venture-side copy silently kept the old logic, in a repo
   no twin-fix sweep of this one can reach. The twin-fix pattern has now recurred five times here.

3. **Template-edit approval flow** — a template diff goes to the inbox as its own approval, never
   a silent commit (ADR-1205, REQ-07).

4. **Two-surface adversarial pass on `--verify` and the CI guard**, attacker prompts carrying
   `initiatives/legal/evidence/fixed-defect-list.md` (28 rows) with the instruction to check every
   row in every OTHER file. The last pass found 8 real holes, 5 of which published unapproved
   bytes — including one in a gate written the commit before. Budget for finding things.

5. **Phase 03 — the real LexOS render.** Blocked on one question owed to the owner: **is the
   operator GST-registered?** Both branches are built and fixture-pinned, so nothing before this
   depends on the answer.

**Two live gaps to carry, both already recorded above:** `publish-gate.mjs` has no dedicated CI
step because `.github/` is write-denied in this workspace (it runs inside the bats step, so it
still turns the build red), and eight text-panel findings remain open in
`initiatives/legal/evidence/phase-01/text-panel-round-2.md` — none asserts an untruth.

**And a CI habit worth keeping:** two pushes in a row created NO run at all (the draft-PR
behaviour `.claude/rules/testing.md` documents). It looks exactly like a slow queue. After every
push, confirm a run exists for the SHA and `gh workflow run ci.yml --ref <branch>` if not.

---

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
