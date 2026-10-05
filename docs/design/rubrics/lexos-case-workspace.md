# Rubric -- lexos-case-workspace (Phase 03 S5, ADR-1411)

**Status: APPROVED by the owner 2026-09-30.** The owner approves or edits this file BEFORE the deal. The
deal records its sha256 (`design-explore.sh jury ... --rubric docs/design/rubrics/lexos-case-workspace.md`)
and `score` refuses if a single byte changes afterwards. A change after the deal is a recorded
decision, never an edit (phase-03 rabbit hole: tuning the rubric until the score rises).

Brief: [`docs/design/briefs/lexos-case-workspace/brief.md`](../briefs/lexos-case-workspace/brief.md).

## How to score

- Look at every item once before scoring any of them. Then give each ONE whole number, 0-100.
- Score the screen, not a guess at who made it. You do not know which item is arc, which is the
  plain-prompt control and which is a reference, and guessing is the thing the blind protects.
- Score once. `score` accepts one record; there is no second pass.

## Four questions -- lenses, not a weighted sum

1. **The job at a glance.** Can a lawyer see the case's status, next hearing and overdue count
   without opening anything (brief A.4)?
2. **One first thing.** Is there an obvious first place to look and one primary action --
   advance the case -- or does everything carry the same weight?
3. **Craft.** Type, spacing, alignment and colour restraint: would it hold up beside the
   reference screen below?
4. **Character.** Does it look designed for this product, or like a template or a spec sheet?

## Anchors

Fixed points on the scale. Each is a real screen with a reason, so the number means the same
thing on every run.

| score | screen | why it sits here |
|---|---|---|
| 0 | a blank, broken or unrendered page | nothing to judge |
| **23** | `docs/design/explore/lexos-case-workspace-v1/variant-a` | The owner's own score for the v1 set (ADR-0049). Four equal cards and a states spec sheet: no first thing to look at, the job is spread across the page. |
| **65** | `docs/design/experiments/2026-07-30-plain-prompt-baseline/baseline-1` | A plain prompt, no pipeline. The blocking fact (outcome not recorded) is a dark banner with its action, the due items run as a dated timeline with overdue marked, case facts sit in a side panel, under a serif case title. Clear hierarchy and a considered type pairing; the page below the banner is a plain list. |
| **85** | pack screen `b7fdffbc4871a0c4` (nicelydone, Linear project page) | Reference for craft only: a different product and an empty state, but the property panel, spacing and restraint are the bar for question 3. |
| 100 | -- | a ceiling nobody is expected to reach |

## Conditions on the anchors (settled before the deal)

- **The anchor screen `b7fdffbc4871a0c4` is NOT dealt as a `--ref`.** A reference item the owner
  has already seen with a number beside it is not blind. The deal takes its reference from the
  other five pack screens.
- **Re-render both arc-era anchors unpinned before the deal.** Done 2026-09-30, session `rubric-anchors`, recipe `font-true;aa-on`: v1-a `e3f47b906a9c2708`, baseline-1 `70919330e156cf89`. Their stored renders carry the
  old `font-pinned` recipe, so their typography was deleted (design-render.sh, owner decision
  2026-07-30). The live items render unpinned, and an anchor judged under a different recipe
  is not the same scale.
- **The ~65 anchor is a choice with a cost.** It is a plain-prompt output, and the fresh control
  is also a plain-prompt output, so it tells the scorer roughly where the control landed last
  time. The alternative is to leave the middle of the scale unanchored. The owner picks one.

## Approval

- [x] anchor numbers set by the owner: v1-a = 23 · baseline-1 = 65 · pack `b7fdffbc` = 85 (the middle anchor kept, its cost accepted)
- [x] approved by the owner on 2026-09-30 -- after this line is ticked, the file is frozen by the deal
