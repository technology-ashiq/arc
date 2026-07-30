# Design critique — variant B (narrative), round 2 (re-verification)

- target: `docs/design/explore/lexos-case-workspace-v1/variant-b/index.html`
- screenshot_sha256: `6e790f32b8512a1a4ccf331dbf9c44456c4f71c36158a00f91f88bfeaaec84bb`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/lexos-case-workspace/brief.md`

## What I looked at

Full-page desktop render (1440 wide, full scrolled height) of the case-record stream, judged
fresh against all four contracts, not spot-checked against round 1 alone: topbar, case identity,
the quartet strip (Parties / Case number / Status / Next hearing / Overdue), the measure-departure
note, "Add entry", the five-item "Show:" filter, the "Ahead" card, the "Jump to next-due entry"
link, the open `Jul 2026` period with six dated entries (including the highlighted, unrecorded
14 Jul hearing), the collapsed `May 2026` period, the keyboard legend, and the full appendix of
declared states for the case header and a period.

**Round-1 VIOLATION, re-checked on this render:** the brief's "always visible, never behind a
click" for the identity quartet is two independent requirements — on screen through scroll, and
complete without truncation. Round 1 caught the second failing (a clipped Parties value with no
recovery). On this render the Parties field reads the case's full name
(`Meera Raghunathan v. Sunvale Housing Pvt. Ltd.`), identical to the page H1, on its own full-width
row above the four-column strip rather than squeezed into a narrow column — a structural change,
not a coincidence of this fixture's name length. **Completeness: resolved, on these pixels.**
**On-screen-through-scroll: cannot be judged from this artifact.** A flattened full-page capture
does not simulate a mid-page scroll position, so it cannot show whether the strip actually stays
pinned once the record is scrolled — that half of the requirement is a gap in this run, not a
pass, and not a fail either.

**Other gaps in this run, not judged as pass or fail:** only a 1440×900 desktop capture exists,
so the declared mobile reflow is unverified. No focus-visible state was captured (nothing is
focused in a static render). Reduced motion cannot be judged from a still image. Only the
default `All` state of the in-stream filter was rendered, so whether selecting a filter truly
filters in place cannot be confirmed from pixels. The collapsed `May 2026` period and the closed
`Add entry` form body were not rendered open.

## Findings

- WEAKNESS: the **Overdue** field in the quartet strip — the fact the brief names directly as
  required pre-action knowledge ("whether anything on it is overdue") — renders as plain bold
  text with no badge or colour treatment, while the adjacent, less time-pressured **Status**
  field gets a filled colour pill (`Active`). The one fact in the quartet most likely to change
  what the reader does next carries the flattest visual weight of the four. Location: the
  "OVERDUE" field of the quartet strip, right of "NEXT HEARING".

- WEAKNESS: suspect several interactive elements fall under the brief's declared 44px target
  floor — the row-action links (`Edit` / `Remove … — cannot be undone`) render as plain,
  unpadded inline text sitting close together, and the "Show:" filter items read the same way.
  This is a suspicion only, not a measurement — hand the real number to design-lint before
  treating it as settled. Location: row actions on every dated entry (24 Jul, 21 Jul, 16 Jul,
  08 Jul, 02 Jul), and the filter row under "Add entry".

- POLISH: the active "Show:" filter item (`All`) still carries an underline beneath it — a
  residual tab-navigation cue — even though the filled-pill treatment round 1 flagged is gone.
  Smaller echo of the same "address, not lens" tension, not eliminated. Location: filter row
  directly below "Add entry".

- POLISH: the Overdue count has no direct link to the entries it counts, unlike Next hearing,
  which is paired with an explanatory "Ahead" card immediately below it — a small missed
  connective thread between the header metric and the content that explains it. Location:
  OVERDUE field in the quartet strip versus the entry stream below.

## What is working

The round-1 violation reads as genuinely fixed, not patched around: the Parties value now
occupies a dedicated full-width row with room to wrap rather than a narrow clipped column, and it
matches the H1 verbatim. Two round-1 weaknesses also look resolved on these pixels even though
neither was mandatory — "Record outcome" is now a solid primary-styled button, clearly
distinguished from the plain "Edit" links beside other entries, and the "Show:" filter has moved
from filled rounded pills to an inline text list, which reads much closer to the matrix's own
"lens" framing. The open and collapsed period headers now share one bare-month form
(`Jul 2026` / `May 2026`), closing the rhythm break round 1 noted. The full five-state matrix
(empty · loading · error · success · disabled) is still rendered concretely for both the case
header and a period, destructive actions still name the thing and state irreversibility in a
colour distinct from benign actions, every visible term traces to the content contract's closed
vocabulary, and no lorem ipsum appears anywhere on the page.

No new defect was found elsewhere on the page as a side effect of the round-1 fix — the risk this
round was explicitly watching for.
