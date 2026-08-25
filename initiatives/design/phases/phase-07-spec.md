# Phase 07 — rival integration

**Goal (one line):** rival drafts enter the same blind jury as arc's variants, rendered by arc's
own renderer and unlabelled — and whichever way it lands, the result is a receipt.
**Appetite:** 2 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-06
**Implements:** ADR-1409 · ADR-1410

## Exit criteria (Definition of Done)

- [ ] Rival adapter follows the engine lane's driver/adapter pattern
      ([ADR-0200..0206](../../../docs/adr/)) — no new pattern class is invented
- [ ] Same brief → one draft per rival → **arc's own renderer** → unlabelled items in one jury
- [ ] One blind jury over **arc×3 + ≥1 rival + 1 reference item**, all items indistinguishable
      by filename, ordering or metadata
- [ ] Seeded shuffle applied; jurors know nothing of authorship, thesis or item kind
- [ ] Standing control in place: a plain-prompt item enters every 3rd run
- [ ] **rival-beats-all-arc rate recorded on the spine whichever way it lands.** If a rival
      outranks every arc variant, that fact is receipted — the embarrassment is the point
- [ ] A rival win **never becomes a copy**: the director assigns a NEW thesis capturing the
      winning direction, and an arc-authored candidate re-enters critique → jury
- [ ] The run degrades to arc-only with a printed source-status line if a provider fails
      mid-cycle — never a silent three-item jury
- [ ] Provenance recorded on every render, so Phase 08's packager can refuse non-arc items
- [ ] Two-surface adversarial pass by fresh agents on the blinding mechanism and the
      rival-beats-all-arc recorder — decision logic on the ranking path, shell/OS boundary on
      file naming and directory ordering. The single-agent blind-identification check in the
      verification plan is **not** a substitute for it
- [ ] tests added & green **on CI, read per JOB at the branch head SHA**
- [ ] live demo run + output checked — the owner opens the renders himself
- [ ] contract tests green against the real rival implementation
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse — refined via `/arc-change` when the phase starts. Blindness is proved adversarially: a
fresh agent is given the jury's input directory and asked to identify which item is the rival —
if it can, from filenames, ordering, metadata or markup fingerprints, the blinding has failed and
the phase does not close. Degradation is proved by running with the provider's key removed and
asserting a printed status line plus an arc-only jury, not a silent one.

## Rabbit holes in this phase

- **Merging or adapting the winning rival's markup.** Detour: new thesis, arc rebuilds. A copy
  is slop with extra steps and legal risk.
- **Quietly dropping the rival when it wins.** Detour: the rate is recorded either way; that is
  the whole reason the bar exists.
- **Blinding by filename alone.** Markup fingerprints leak authorship too. Detour: the
  adversarial identification test is the gate.

## Out of scope for this phase

The packager and its arc-only lint (Phase 08) · a second rival if the first has not cleared
terms · any outbound blind package.

## Your-setup / pending

Credentials for the cleared provider. If terms clearance was refused in Phase 06, this phase
runs with reference + plain-prompt control only, and REQ-09 is scope-cut rather than faked.

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
