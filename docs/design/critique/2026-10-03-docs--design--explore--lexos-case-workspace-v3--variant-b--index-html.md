# Design critique — docs/design/explore/lexos-case-workspace-v3/variant-b/index.html

- target: `docs/design/explore/lexos-case-workspace-v3/variant-b/index.html`
- screenshot_sha256: `7ad1625a1a7d996e0258248122241e47a3102fda84214f898ad08b93c69dcd4b` (1440x900 render; the 390x844 render has its own meta)
- viewport: `1440x900@1` and `390x844`
- brief: `docs/design/briefs/lexos-case-workspace/brief.md`

## What I looked at
Both full-page renders of Variant B, a single-column serif "case record". Each shows the case header, a record composer, an "Awaiting record" group, then July and May 2026 entries. Desktop adds a right-hand overdue/status column and a keyboard legend footer. I saw only the resting success state. No loading, empty, error or disabled state is rendered.

## Viewport 1440x900

- WEAKNESS: the row actions (Record done / Edit / Remove), the section-tab counts, the small-caps field labels and the "3 entries" captions are set very small. The dimmest of them may fall under the AA contrast floor, and the action links may fall under the declared 44px target floor. Both are measurable — verify with design-lint before fixing. — row action links, top tab bar, left label gutter — a11y floor in Contract B.
- WEAKNESS: the loading, empty, error and disabled states are not visible in this render. The brief says loading must exist, and a section switch must not be a bare wait. This is a gap in the render, not a confirmed miss. — whole page — Contract B state matrix.
- WEAKNESS: "Remove" is distinguished from "Edit" only by italics and underline weight, and it is not visibly danger-coloured. Nothing at rest says the removal cannot be undone. — row action clusters — Contract D destructive-language rule (`LINK_DANGER` intent).
- POLISH: the rules under the section headings stop short of the full-width row dividers beneath them. The section-heading rule and the row-divider rule read as two different measures. — "Awaiting record" / "July 2026" headings.
- POLISH: "Done for today · Next case" and "Awaiting record" are new vocabulary beyond the declared verbs. They are plausible and answer the brief's expert-path question, but they are deliberate additions and should be confirmed by the owner. — top-right nav, group heading.

## Viewport 390x844

- WEAKNESS: the tab rail, row action links and small-caps labels are tiny at phone width, and the action links sit close together. The 44px target floor and AA contrast are both suspects — verify with design-lint. — top tab rail, row actions.
- WEAKNESS: the keyboard legend does not appear on mobile. That is acceptable for touch, but the keyboard-first surface is then only partly visible at this viewport. — page footer.
- POLISH: the overdue numeral and the status / next hearing / today trio stack below the hero sentence. This keeps the overdue count visible early, but the numeral loses the weight it has in the desktop side column. — header block.

## What is working
- The hero sentence ("The hearing of 14 Jul 2026 has no outcome recorded… Two entries are overdue") says what happened and what is waiting before anything else is read. This is the "under control, one thing waiting" promise the brief sets as its bar.
- The serif court-record voice, the dated entries in a left gutter, and green marking only on the awaiting group give the page a clear focal point. It reads exact, unhurried and durable, not urgent or chatty. Overdue is carried by text ("OVERDUE BY 6 DAYS"), not by colour alone.
- Hierarchy is real: case title, then the hero sentence, then the composer, then awaiting items, then history. The mobile layout keeps the same order and holds together.
- Dates use the shipped `27 Jul 2026` format, and ₹ amounts use Indian grouping.
- I raised no BELOW-BAR. The page reaches a deliberate, characterful bar and makes visible choices of its own.
