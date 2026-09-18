# Phase 08 — governance + retro

**Goal (one line):** nothing leaves this repo carrying someone else's authorship, spend stays
capped, the manual-drop door works — and all three sealed predictions are settled on the record.
**Appetite:** 1 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-07
**Implements:** ADR-1410 · ADR-1411

## Exit criteria (Definition of Done)

- [ ] Packager lint **refuses a planted rival render** and **refuses a planted gallery image** in
      any package leaving the repo ([ADR-1410](../../../docs/adr/1410-dsv-k-outbound-blind-packages-carry-arc-authored-renders-only.md))
- [ ] A render whose provenance is **absent fails closed** — it is never defaulted to
      arc-authored
- [ ] Adaptable-principle discipline **verified across the cycle's packs by reading them** — a
      `sources.md` row whose principle describes appearance rather than a transferable idea
      fails. No second automated lint is built: Phase 02's human read already gates this, and a
      duplicate checker maps to no REQ-10 acceptance line
- [ ] Per-source spend caps ride `hq.policy.yaml`, ₹0 default — edited under the shared-file
      protocol: `git log origin/main -5 -- hq.policy.yaml` run **before** the edit, stronger
      version taken at merge
- [ ] Manual-drop door proved end to end: a file dropped by the owner appears **attributed** in
      the next pack
- [ ] Two-surface adversarial pass by fresh agents on the packager lint — this is the gate whose
      failure is irreversible, so it gets the strongest attack of the cycle
- [ ] **Retro settles all three sealed predictions** of
      [ADR-1411](../../../docs/adr/1411-dsv-l-calibration-is-controlled-or-it-is-theatre.md),
      hit or miss, in plain words: the ≥60/100 post-Phase-03 score, the ≤50% rival-beats-all-arc
      rate, and [ADR-1416](../../../docs/adr/1416-the-exp-a1-prediction-is-session-authored-on-the-owners-delegation.md)'s
      EXP-A1 call — the last of which calibrates the session, not the owner, and is scored as such
- [ ] Retro metric pack computed from spine receipts only: owner blind score trend ·
      rival-beats-all-arc rate · self-review catch rate · per-source availability lines ·
      captures and wall-clock per explore · EXP-A1 prediction vs outcome
- [ ] Every assumption-ledger trigger is **run**, not eyeballed; a dogfood-gated row is recorded
      NOT EVALUABLE rather than VALIDATED
- [ ] tests added & green **on CI, read per JOB at the branch head SHA**
- [ ] tracker updated (PROGRESS.md row ✅ + done-log) and `docs/HISTORY.md` updated as part of
      the close, not as a follow-up

## Verification plan

Coarse — refined via `/arc-change` when the phase starts. The packager is proved by refusal, not
by a clean pass: plant a rival render and a gallery image and assert each is refused by name.
Provenance-absent is a third planted case. The retro's prediction settlement is proved by all
three appearing with an explicit verdict — a prediction left unmarked is a miss, not a pending.

## Rabbit holes in this phase

- **Proving the packager by packaging something clean.** A gate that only passes has not been
  tested. Detour: three planted refusals.
- **Scoring the sealed predictions generously.** Detour: a falsified prediction is written
  plainly; a ledger of hits calibrates nothing.
- **Marking a dogfood-gated assumption VALIDATED because the phase went well.** Detour: NOT
  EVALUABLE is an honest status and this repo has scored six rows green on an engine that never ran.

## Out of scope for this phase

Any outbound blind package actually being sent — that is post-v2 and needs the owner's explicit
publish approval · promoting any warn-tier gate to block-tier, which needs the retro plus his OK.

## Your-setup / pending

Owner sign-off on the retro's promotions, if any are proposed.

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
