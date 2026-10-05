# Design critique — docs/design/explore/lexos-case-workspace-v3/variant-c/index.html

- target: `docs/design/explore/lexos-case-workspace-v3/variant-c/index.html`
- screenshot_sha256: see render meta `.claude/state/design/renders/design-critic/docs--design--explore--lexos-case-workspace-v3--variant-c--index-html--1440x900.json` and `--390x844.json`
- viewport: 1440x900 and 390x844
- brief: `docs/design/briefs/lexos-case-workspace/brief.md`

## What I looked at
Both full-page renders (dark ground, one cream "do this now" card, numbered step rail, tabbed record below), plus two pack screens (Linear project, Found transaction panel) for comparison.

## Viewport 1440x900

- WEAKNESS: The "Due later" and "Waiting" step rows, the step numerals 2-5 and the small meta text read as the dimmest things on the dark ground and may fall under the AA floor — measurable, verify with design-lint before fixing. Seen in the step list below the card and in the hearing sub-lines.
- WEAKNESS: Faint stray tick marks sit on the cream card's left and right edges and short hairlines sit along its bottom edge, which look like rendering artefacts rather than intent — card edges around the form. They undercut "durable / exact".
- WEAKNESS: Step 1 is due 14 Jul 2026, earlier than today, yet it carries no OVERDUE label while steps 2 and 3 do. The most overdue item is the only one not named as such, and the header count of 2 does not obviously include or exclude it — step rail vs header Overdue figure. This weakens "exact".
- WEAKNESS: Width is used unevenly. The record list and its row rules stop short of the header and footer rules, and the right third of the tab area is empty — hearings list. The brief names unused width as a known debt.
- WEAKNESS: "Remove" sits in salmon beside the unrecorded hearing, the very row the hero card is asking the user to resolve. It is the loudest link in the record area and competes with the primary action. It does distinguish itself from benign links as the brief asks, but the placement is risky.
- POLISH: "Today 30 Jul 2026" in the header meta line is an unrequested label and reads slightly chatty against "unhurried".
- POLISH: The shortcut strip at the foot teaches keys well, but its three groups have uneven gaps.

## Viewport 390x844

- WEAKNESS: The four tabs wrap onto two rows. The active underline sits only under the first row, and the second row (Tasks, Notes) is misaligned with the first — record tabs. Tab targets may also be under the 44px floor; verify with design-lint.
- WEAKNESS: The rail line and the large "1" sit above the card and the line runs behind it, so the card is not clearly tied to step 1 as it is on desktop — top of the card.
- WEAKNESS: "Remove" links under each hearing are small and close to the meta text; target size is a suspicion for design-lint.
- POLISH: Header meta wraps awkwardly ("Client: ... · Claim / ₹18,45,000 · Today ..."), splitting the claim amount from its label.

## What is working
The page opens on one thing waiting on the lawyer: a large cream card with a plain-fact headline on a dark ground, with the status, next hearing and overdue figures above it. That is a real focal point and keeps all of brief question 4 visible. Court vocabulary is intact (hearing, outcome, Record outcome, ₹ in Indian grouping, dates in the shipped format), the voice is a record rather than an assistant, and the Ctrl Enter chip and shortcut strip serve the keyboard-first path. Mobile holds the same order and stays legible. The brief's bar is reached in character; I raise no BELOW-BAR.
