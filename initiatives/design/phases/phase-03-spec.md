# Phase 03 — taste loop

**Goal (one line):** a full explore runs on a lexos-class brief through a craft-first N-item
model-mixed jury with pack-anchored BELOW-BAR, and the owner produces a controlled blind score
that is comparable to every future run.
**Appetite:** 2 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-01, phase-02
**Implements:** ADR-1405 · ADR-1406 · ADR-1411 · ADR-1414

## Exit criteria (Definition of Done)

- [ ] `design-jury` contract amended from FOUR items to **N** — every spelling of the count, not
      the first one found. At least five separate spellings exist in that file today
- [ ] Jurors rank **craft**: hierarchy, type quality, spatial rhythm, colour intent, confidence.
      Compliance stays the lint's and critic's job
- [ ] Panel is model-mixed: one juror seated at **high-judgment** per
      [ADR-1414](../../../docs/adr/1414-the-curator-sits-at-balanced-workhorse-and-one-juror-at-high-judgment.md),
      shipped as a reviewed diff citing ADR-0069
- [ ] An N-item run completes with **0 logged prompt deviations**, AND a planted-deviation
      fixture — a doctored jury prompt told to skip one item — is proven CAUGHT and logged by
      that same mechanism first. A zero from a logger never shown to catch anything is a
      contract compared against nothing. The deviation class
      [ADR-0070](../../../docs/adr/0070-composer-seat-stays-balanced-workhorse.md) had to log ends here
- [ ] The critic receives the pack; every BELOW-BAR finding **cites ≥1 pack screen**
- [ ] Ranking reasons cite visual observations, not contract compliance
- [ ] Controlled owner ritual: seeded shuffle · short rubric · anchor examples · owner scores
      **0–100 blind before unblinding** · receipted as `note.logged {lens:design}`
- [ ] The jury pack carries ≥1 non-arc item (the reference screen this phase)
- [ ] The three sealed predictions of
      [ADR-1411](../../../docs/adr/1411-dsv-l-calibration-is-controlled-or-it-is-theatre.md) are
      on the record **before** the owner scores
- [ ] Self-review catch rate computed and recorded (assumption-ledger row 6 input)
- [ ] The composer's refpack read allowlist, granted in Phase 01 against an **empty** directory,
      is re-verified now that Phase 02 has populated it: the composer reads ≥1 real pack screen,
      and the sibling-variant negative control is re-run against real files
- [ ] Two-surface adversarial pass by fresh agents (decision logic · shell/OS boundary) on the
      N-item jury rewrite and the BELOW-BAR pack-citation requirement, run against the PR that
      ships them, holes fixed and pinned as fixtures
- [ ] tests added & green **on CI, read per JOB at the branch head SHA**
- [ ] live demo run + output checked — the owner opens the renders himself
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse — refined via `/arc-change` when the phase starts. The N-item amendment is proved by
running a jury at N=4, N=5 and N=6 with no prompt override in any of them. BELOW-BAR anchoring is
proved by a mutant run in which the pack is swapped for a deliberately world-class set and the
same variant's BELOW-BAR findings change. The owner's score is proved by its receipt existing
with a timestamp **before** the unblinding record — a score recorded after unblinding is not a
blind score, and the ordering is the assertion.

**This phase carries the taste tripwire.** If the controlled score does not beat the
plain-prompt bar (~40/100) after one re-run, Phases 05–07 do not start.

## Rabbit holes in this phase

- **Growing the panel to chase agreement.** ADR-0070 already measured owner-vs-jury inversion.
  Detour: the owner's controlled score is the anchor; the panel is evidence beside it.
- **Renaming BELOW-BAR findings into VIOLATIONs to make PASS meaningful.** Detour: the classes
  stay separate; PASS ≡ zero VIOLATION + zero BELOW-BAR, unchanged.
- **Tuning the rubric until the score rises.** Detour: anchors are fixed before the run and any
  change to them is a recorded decision, not an edit.

## Out of scope for this phase

EXP-A1 (Phase 04 — it runs only after this regime exists) · live external sources (Phase 05) ·
rivals in the jury (Phase 07) · the plain-prompt control's every-3rd-run cadence, which begins
once three runs exist.

## Your-setup / pending

**The owner scores blind, in person, before unblinding.** That keystroke is the phase gate and
cannot be delegated to an agent.

## Non-negotiables (verbatim from PLAN)

- **Look at the artifact before carrying its verdict.** No ranking, score, receipt or package
  is produced from a report about pixels that nobody in the session opened.
- **Zero new spine event kinds.** This cycle rides `review.completed {lens:design}`,
  `decision.recorded` and `note.logged` only.
- **Agents judge, scripts measure — ADR-0048.** A gate never asks an agent for a number it
  can compute.
- **Every new gate, lint and parser gets a two-surface adversarial pass by fresh agents that
  did not write it** — one on decision logic, one on the shell/OS boundary — and that pass runs
  against the PR THAT SHIPS THE GATE, never batched into the phase-close PR that comes after
  all of them. The attacker prompt carries this lane's running list of already-fixed defects.
- **A test that passes proves the assertion held, not that the code ran.** Every gate ships with
  a negative control that actually fails.
- **No reference image, rival draft or third-party screenshot is ever committed to git or
  placed in an outbound package.**
- **A `model:` frontmatter change is a governed tier change** citing ADR-0069 in a reviewed
  diff, never a quiet edit.
- **Shared organs are edited under the shared-file protocol.** Agent contracts under
  `.claude/agents/`, `.mcp.json`, `hq.policy.yaml` and `tests/**` belong to no lane:
  `git log origin/main -5` on the file runs BEFORE the edit, the stronger version is taken at
  merge, and a change to a contract another LIVE lane reads gets a cross-lane note first.
- **Closing a phase moves the lane's bookkeeping in the same commit as the merge, or the one
  right after it.** PROGRESS.md's row, its `## Now`, and `docs/HISTORY.md` move together — a
  lane whose HISTORY says CLOSED while PROGRESS still says LIVE is a failure, not a follow-up.
- **Tests are green on CI, per JOB, at the branch head SHA** — never on this box.
