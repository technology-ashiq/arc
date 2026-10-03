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

## Critic on the live variants (2026-10-03, Phase 03 close)

S5 ran no critique at all: `design-critique.sh begin` refused every variant, because the
renderer's cross-session case (ADR-1417 case 3) read the critic's render of a page the composer
had already rendered as a retry. Fixed at `9ea7d9bd` + `5cf49d31` (ADR-1417 Amendment 1, attacked
r1 + r2). Both critiques then ran with the brief's pack attached and both viewports rendered:

| variant | owner | 1440x900 | 390x844 | verdict |
|---|---|---|---|---|
| c | 66 | 0 V · 0 BB · 5 W · 2 P | 0 V · 0 BB · 3 W · 1 P | PASS |
| b | 18 | 0 V · 0 BB · 3 W · 2 P | 0 V · 0 BB · 2 W · 1 P | PASS |

Artifacts: `docs/design/critique/2026-10-03-docs--design--explore--lexos-case-workspace-v3--variant-{b,c}--index-html.md`.
Both renders were opened in-session before these verdicts were carried. The critic attributes
findings to each viewport, which closes the "critic judges every rendered viewport" criterion live.

**What this does not prove.** Neither critique raised a BELOW-BAR, so no live finding exercised
the pack citation. That rule is proved by the gate on CI (`design-critique-pack.bats`: an uncited
BELOW-BAR and a citation outside the pack are both REFUSED), not by this run. The swapped-pack
mutant from the verification plan was not run: the lane has one fetchable gallery (ADR-1412), so
there is no second world-class set to swap in. Both are on the debt ledger.

**The critic agrees with the jurors, not the owner, on variant-b.** The owner scored it 18; the
critic passes it with nothing below the bar, and two of three jurors ranked it top-two. Three
agent judgments now sit on one side of the owner. That is calibration input for the next phase,
not a defect in this one.

## Single-gallery-bias read (PLAN assumptions ledger, successor row of 2026-09-27)

Read every juror reason (`ranking-1..3.md`) and both critiques for whether the pack's one gallery
(nicelydone) became the only style that counts:

- No juror reason names the pack, its gallery or a house style. Every reason argues from the
  brief: its "visible before action" list, its feel words, its kill-list, its destructive-action rule.
- All three jurors ranked the reference item last **for being off-brief** (a messaging inbox with
  an emoji empty state), not for looking like or unlike any gallery.
- The critic cited no pack screen as a bar. It viewed two (Linear project, Found record panel)
  and judged both variants against the brief.

**Not FIRED.** Nothing shows nicelydone's house style acting as the standard. The trigger stays
live: the reference was off-brief, so this run could not have shown a bias toward it either way.
