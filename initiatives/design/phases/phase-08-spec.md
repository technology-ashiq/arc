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

Refined 2026-10-07 via `/arc-change` (owner: "phase 08 start pannu"). Five slices, each red-first
on CI; S1-S3 are code and carry the two-surface attack on their own PR, S4-S5 are the close.

- **S1 -- provenance on every render receipt (ADR-1410 consequence).** `design-render.sh` writes
  `provenance` into each meta, derived from the route's own directory and nothing else:
  `variant-<x>` → `arc`, `rival-<p>` → `rival:<p>`, `ref-<sha16>` → `reference`, any other mode
  (product routes, critique) → `arc`. A meta without the field is read as absent, never as arc.
- **S2 -- the packager and its lint.** `design-package.mjs build --explore <id> --render <variant> ...`
  copies only arc renders into `docs/design/blind-test/<id>/package/` as `direction-N.png`, and writes
  a `package.json` binding each file to its render meta, session and sha256. `lint <dir>` re-checks a
  package already on disk: every image must hash to exactly one render meta whose `provenance` is
  `arc`. **Proved by three planted refusals, each refused by name:** a rival render (`provenance`
  `rival:stitch`), a gallery image (bytes equal to a refpack file; also any file whose path or bytes
  come from `.claude/state/design/refpacks/`), and a render whose meta carries no `provenance`
  (fails closed). A clean three-direction package passes, so the refusals are not a broken gate.
- **S3 -- spend caps and the manual-drop door.**
  - *Spend:* `hq.policy.yaml` is owner-only (deny-listed for the session) and every kind's `spend` is
    already `L0`; ₹0 is the default today. The cap is enforced by READING it, not by editing it:
    `design-sources-lint.mjs` refuses a source with `cost: paid` and `status: active|trial` while
    `hq.policy.yaml` grants no kind `spend` above `L0`. Negative control: flipping the paid `mobbin`
    row to `trial` in a fixture is refused, naming the source and the policy file.
  - *Manual drop:* `design-refpack.mjs drop --brief <id> --file <path> --url <where-it-came-from>
    --principle <text> --avoid <text>` copies an owner-chosen screen into the pack under
    `manual-<sha16>.<ext>` and appends a `sources.md` row with source `manual (owner)`. The next pack
    listing shows it attributed. A drop with no `--url` or no `--principle` is refused; a drop is
    never fetched, so robots and the registry do not apply, and the row says so.
- **Attack:** two fresh attackers on the S1-S3 PR (logic on the packager's provenance decision and the
  spend rule; boundary on file naming, hashing, links and the drop copy), carrying the lane's
  fixed-defects list. This is the irreversible gate of the cycle, so both rounds run.
- **S4 -- the retro.** `/arc-retro 08 --lane design` settles all three ADR-1411 predictions in plain
  words from receipts: (1) post-Phase-03 controlled blind score ≥60 -- v3 best arc 66, v4 best arc 60;
  (2) rival-beats-all-arc ≤50% by cycle end -- owner 0 of 1 run, jury 1 of 2 rankings; (3) ADR-1416's
  EXP-A1 call, scored against the session. The metric pack is computed from spine receipts only, and
  every assumption-ledger trigger is RUN; a dogfood-gated row is NOT EVALUABLE.
- **S5 -- the lane close.** PROGRESS row ✅, `## Now`, `docs/HISTORY.md` and PORTFOLIO's row move in one
  commit; the wiki is regenerated in the same PR.

**DoD amendment (2026-10-07, owner OK the same day: "OK, build pannu"):** the spend-cap row said "edited under the shared-file
protocol". `hq.policy.yaml` is not editable from a session at all, and it already holds ₹0 (`spend: L0`)
for every kind, so S3 enforces the cap by reading the file. An edit would be the owner's own, and none is
needed for a ₹0 cap.

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
