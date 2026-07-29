# Design critique — docs/design/explore/hq-dashboard-v1/variant-b/index.html

- target: `docs/design/explore/hq-dashboard-v1/variant-b/index.html`
- screenshot_sha256: `ed1b1100b448dd4569f6eb2dac8729a004bc651d438ca23e01f88660455a95da`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/docs--strategy--arc-hq-mockup-html/brief.md`

## What I looked at
Round 3, full-page render (1440×900 viewport, taller-than-viewport capture — nothing below the
fold is cut off) of the same "Review workspace": header with keyboard legend and spine-sync note,
the KPI strip, a left rail (six-card queue, "Done today" log, "Today's events" list, and a
reference empty-state card), and the right-hand evidence pane for "Kirana Express" (verdict +
score, ₹ amount, kill-criteria block, prior-receipts compare table, action row), followed by the
bottom appendix of the evidence pane's other states (empty/loading/error/disabled). Per the
recipe, font is forced to the fallback stack and all motion is disabled; neither is judged here.

## Round-2 status (not counted as current findings — see Findings below for anything still open)
- Bare council verdict score leaking into the "Today's events" rail (round-2 VIOLATION): **FIXED.**
  The list is now three lines — "08:10 Saathi Health — promoted to Phase 2", "07:52 Kirana Express
  — approval opened", "07:15 Bazaarly — queued for approval." The named line ("Bazaarly verdict
  posted, 6.8") is gone outright, and I checked every remaining line in the list, not only the one
  named: none carries a score, a ₹ amount, or a kill-criteria state. The rail is identifier/action-
  only again, matching every queue card's own venture/id/₹ shape.
- Verbatim duplication against "Done today" (round-2 WEAKNESS): **FIXED.** "Udhaar Metrics
  approved, RCT-114820" and "Farmstack Direct killed, RCT-114796" no longer appear in "Today's
  events" — the three remaining lines are each a distinct event not present in the log directly
  above.
- Naaptol Foods error-caption contrast risk (round-2 WEAKNESS): **looks resolved.** "Evidence
  failed to load · retry" now sits inside a visibly separate solid-filled pill against the card's
  own background — the same filled-chip treatment the kill-criteria "NEAR BREACH"/"BREACHED"
  badges use — rather than plain text floating on a background of the same hue. I have not
  measured this and am not asserting a ratio; a design-lint pass is still the routine final word,
  not because I still see a risk here.
- Inconsistent line shape within "Today's events" (round-2 POLISH): **FIXED.** All three lines now
  share one shape — venture, em dash, short action phrase — where round 2 saw three different
  shapes in three lines.

## Findings
No findings this round.

## What is working
The fix is scoped exactly as described: the rail is clean, the two duplicate lines are gone, and
"Today's events" now reads as calm and identifier/action-only — matching the assigned thesis's
requirement that a reader never has to reconstruct evidence from the rail. Everything the creation
side says it left untouched checks out untouched from the render: the evidence pane is still the
larger, dominant object on the page; all four kill-criteria badges (runway/burn/margin/growth)
still follow correctly from the numbers sitting next to them; and the queue's focus-vs-selection
distinction still reads as two different treatments — Kirana Express (open in the evidence pane)
as a filled/selected card with a matching filled reason chip ("Kill-criteria breached"), Bazaarly
and the "Runway below floor" chip as ring-only against the same plain background as their
neighbours.

## What I did not verify
Reduced motion and keyboard behaviour are not visible in a static render and the recipe disables
all animation/transition for this capture, so neither is judged here. I did not re-run a full
brief audit beyond the round-2 scope and the specific regression checks requested in this round
(evidence-pane dominance, kill-criteria badge consistency, focus-vs-selection) — anything outside
that was reported as stable in round 2 and I saw nothing in this render to contradict that.
