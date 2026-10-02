# Phase 03 S5 -- live explore, owner blind score (lexos-case-workspace-v3)

Text only, per the owner ruling of 2026-09-16: the HTML and PNGs stay local under the gitignored
`docs/design/explore/lexos-*/` and `.claude/state/design/`.

- Explore: `lexos-case-workspace-v3`, base `9c59bdc2`, brief `docs/design/briefs/lexos-case-workspace/brief.md`
- Rubric: [`docs/design/rubrics/lexos-case-workspace.md`](../../../../docs/design/rubrics/lexos-case-workspace.md), owner-approved 2026-09-30, sha frozen at the deal
- Items dealt: N=5 -- three arc variants (a, b, c), the fresh plain-prompt control (variant-d), one pack reference (nicelydone `88211aba0761f304`)
- Divergence call: passed for all three variants (director, 2026-09-30)
- `jury-check`: 3 rankings, **0 deviations** (2026-09-30T02:40:53Z)

## Juror rankings (best first)

| juror | ranking |
|---|---|
| 1 | control > b > c > a > reference |
| 2 | b > a > c > control > reference |
| 3 (high-judgment seat) | c > control > b > a > reference |

All three put the reference last: it is a messaging-inbox screen, off-brief for a case workspace.

## Owner blind score (2026-10-02T18:27:01Z, `note.logged` receipt emitted)

| item | source | score |
|---|---|---|
| c | arc variant-c | 66 |
| a | arc variant-a | 64 |
| e | plain-prompt control | 51 |
| d | reference | 45 |
| b | arc variant-b | 18 |

`unblind`: best arc 66, plain-prompt control 51, reference 45.

## Taste tripwire reading

PLAN's kill criterion compares the controlled owner score with the freshly measured plain-prompt
bar but does not say best-of or mean. Best arc is 66 against 51; the arc mean is 49.3 against
51, pulled down by variant-b alone. **Owner ruling 2026-10-03: improvement exists, continue** --
read as best-of, which is what explore mode is for (three directions, one picked). The tripwire
does not fire; Phases 05-07 stay in scope.

## Signals worth carrying

- **Jurors and owner disagree on variant-b.** Two of three jurors ranked it first or second; the
  owner scored it 18, the lowest of all five. Juror taste is not yet a proxy for the owner's.
- **The reference did not work as a bar.** It was off-brief, so its 45 says nothing about craft.
  A future deal should draw a reference that shows the same job.
- Self-review catch rate: 3/4 iterations caught a defect (variant-a 1/2, variant-b 1/1, variant-c 1/1).
