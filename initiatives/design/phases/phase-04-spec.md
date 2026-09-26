# Phase 04 — EXP-A1

**Goal (one line):** re-run [ADR-0070](../../../docs/adr/0070-composer-seat-stays-balanced-workhorse.md)'s
paired same-commit harness inside the new regime, with the prediction pre-registered and a
reference item present, and settle the composer-tier question with receipts either way.
**Appetite:** 0.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-03
**Implements:** ADR-1400 · ADR-1416

## Exit criteria (Definition of Done)

- [ ] The sealed prediction of
      [ADR-1416](../../../docs/adr/1416-the-exp-a1-prediction-is-session-authored-on-the-owners-delegation.md)
      is on the record **before** the run starts, with its session authorship stated on its face
- [ ] ADR-0070's paired same-commit harness is reused whole: SHA-asserted fixtures,
      per-invocation model override, sealed key
- [ ] The run happens **inside the new regime** — eyes, reference pack, craft-first jury — which
      is the condition ADR-0070's revisit trigger names
- [ ] A **reference item is present** in the jury pack; ADR-0070's run lacked one, and that was
      one of its two logged deviations
- [ ] **Zero writes** into `initiatives/model-policy/evidence/phase-02/` — that bundle carries
      `SEALED-key.md` and belongs to another lane. All output lands in
      `initiatives/design/evidence/phase-04/`
- [ ] The hash-unchanged check is **proven capable of failing**: a scratch copy of the phase-02
      bundle has one byte flipped, the same verify command runs against it, and its exit status
      is read **directly and never through a pipe** — `verify | tail` has already reported exit 0
      over the word TAMPERED in this repo
- [ ] The standing formula is applied explicitly: promotion requires material owner-visible gain
      **AND** the owner's explicit cost/time acceptance. Either arm failing means no promotion
- [ ] A decision ADR records the outcome, and the seat is evidence-backed whichever way it lands
- [ ] The sealed prediction is settled **hit or miss, in writing** — a falsified prediction is
      recorded plainly, since a ledger of hits calibrates nothing
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse — refined via `/arc-change` when the phase starts. The pairing is proved by asserting
both arms ran at the same commit SHA against the same fixture sha, with only the model override
differing — one variable, which is the discipline the engine lane learned the hard way when a
comparison moved two at once and built an ADR on the result. The seal is proved by verifying the
model-policy bundle's hashes are unchanged after the run.

## Rabbit holes in this phase

- **Amending the model-policy evidence bundle because it feels like the natural home.** That is
  how a bundle went TAMPERED in this repo before. Detour: read it, never write it.
- **Reading the result as seat politics.** Detour: the prediction was sealed first and the
  formula is fixed; both outcomes close the question.
- **Rescuing the prediction after seeing data.** Detour: refused outright — the owner may
  replace the sealed text only *before* the run.

## Out of scope for this phase

Any change to the composer's `model:` line unless the formula returns a promotion **and** the
owner accepts the cost · live sources · rivals.

## Your-setup / pending

If the owner wants his own prediction rather than the session-authored one, he supplies it
**before** this phase runs. After the run it is not a prediction.

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
