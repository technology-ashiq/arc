# Phase 07 S5 -- live run, arc x3 vs Stitch, owner blind score (lexos-case-workspace-v4)

Text only, per the owner ruling of 2026-09-16: the HTML and PNGs stay local under the gitignored
`docs/design/explore/lexos-*/` and `.claude/state/design/`. Rival draft never committed (ADR-1422).

- Explore: `lexos-case-workspace-v4`, base `e313a026`, brief `docs/design/briefs/lexos-case-workspace/brief.md`
- Rubric: [`docs/design/rubrics/lexos-case-workspace.md`](../../../../docs/design/rubrics/lexos-case-workspace.md), sha frozen at the deal
- Deal: N=7, seed `20261007`, key sha `c65e43b79d0a72ee...`. Items: three arc variants (a command center, b guided workflow, c review workspace), the fresh plain-prompt control (variant-d, every-3rd-run cadence), the Stitch rival, two pack references (nicelydone `b7fdffbc4871a0c4`, `9480d6174a1a4962`)
- Theses: design-director, three structures that each scored >=59 with the owner before, three new art directions away from the plain-prompt language (`matrix.md`)
- Gates: all three variants cleared `compose-done` (surfaces, coverage, self-review substantiated, 4 rows)
- `jury-check`: 2 rankings, **0 deviations**

## The rival, real transport

- `design-explore.sh rival lexos-case-workspace-v4 --viewport 1440x900`:
  `rival stitch: DRAFTED 55958 bytes, 29 assets vendored (stitch-sdk 0.3.5, screen 41b0c5a822bd)`
- Receipt: `html_host contribution.usercontent.google.com`, `html_path /download`, SDK tree pinned
  (`931bece9e9210c5e...`), vendored page `eb8ae19e...`, 29 assets / 2,496,215 bytes from the three
  allow-listed hosts. The render (opened in-session) is fully styled offline -- fonts and Tailwind
  vendored, the check Phase 06 failed.

## Owner blind score (2026-10-07T05:49:29Z, `note.logged` receipt emitted)

| item | source | score |
|---|---|---|
| a | arc variant-b (guided workflow) | **60** |
| c | **rival: Stitch** | **59** |
| f | arc variant-c (review workspace) | 57 |
| b | plain-prompt control (variant-d) | 51 |
| e | arc variant-a (command center) | 49 |
| d | reference (nicelydone b7fdffbc) | 0 |
| g | reference (nicelydone 9480d617) | 0 |

The owner on the references: "d and g ithuku design ila" -- neither shows a design for this job,
so both were scored 0. That is a finding about the pack, not about the references' craft.

`unblind`: best arc 60, plain-prompt control 51 (arc beats it), reference 0.

## rival-beats-all-arc (ADR-1411 sealed prediction 2) -- recorded, `note.logged` receipt emitted

- **Owner: no** -- rival 59 vs best arc 60. A one-point margin; not a tie.
- **Jury: 1 of 2** valid rankings put the rival above every arc variant.

## Juror rankings, unblinded (best first)

| juror | ranking |
|---|---|
| 1 | control > **Stitch** > arc-a > arc-b > arc-c > ref > ref |
| 3 (high-judgment seat) | control > arc-a > arc-c > **Stitch** > arc-b > ref > ref |

Both jurors ranked the plain-prompt control FIRST; the owner scored it 51, fourth of five designs.
Both jurors ranked arc-b (guided workflow) 4th-5th; the owner scored it highest. The v3 run showed
the same split on a guided-workflow variant (owner 18, jurors top-two). **Juror taste is still not a
proxy for the owner's, and it disagrees with him in a consistent direction** -- calibration input
for the Phase 08 retro, not a defect of this phase.

## Blindness gate (verification plan)

A fresh agent given ONLY the items dir and asked to find the rival from file names, ordering,
metadata or EXIF: **it could not name the rival.** It named item-g (a reference: a 2x RGBA PNG
carrying the gallery's iTXt source URL) and called item-d (a reference: the only JPEG) a second
outlier. So the rival was blind; the **references were not** -- a real defect against REQ-09's
"all rendered by arc's own renderer". Owner ruling 2026-10-07: keep this deal (the rival was blind,
which is the claim being tested) and fix the references forward. Fixed in S4b, PR #374: every
reference is framed and rendered by the same renderer, the deal refuses any non-PNG item or
provenance-carrying chunk, and stamps one mtime on every item.

## Deviations, logged

1. **Two jurors, not three.** The second balanced seat was refused by the session's permission
   classifier and was not worked around (same as Phase 04).
2. **The first composer for variant-a never saw the brief**: its read hook refuses brief.md and
   matrix.md by design and the prompt had named them as files. That build was discarded unseen; the
   director wrote one packet per letter (no sibling content) and every composer got brief + packet
   inline.
3. **Variant-c's first composer ran with the wrong working directory** and could not reach the
   renderer; it was resumed at the repo root before any render.
4. **Variant-a's mobile clip fix is unrendered** (iteration cap reached); the desktop render dealt is
   iteration 3.
5. **The surface markers were not in the first prompts**; variant-a needed a markup-only fix after
   its iterations (the `main` wrapper carried a product marker around the doc strip).
