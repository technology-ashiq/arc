# Merging two surfaces into one dissolves the contract each of them owed separately

- type: Anti
- domain: solo-operator venture dashboard
- user: owner returning to a queue after an interruption
- platform: desktop
- problem: showing a pending-work inbox and a chronological event timeline without making the page feel like two pages
- confidence: medium
- outcome: unknown
- source: arc explore run `hq-dashboard-v1`; jurors 1 and 3 (`docs/design/explore/hq-dashboard-v1/ranking-{1,3}.md`) on variant-c's fused inbox+timeline; the five-state wording is the brief's own (`docs/design/briefs/docs--strategy--arc-hq-mockup-html/brief.md`), and the relabelling is juror 2's finding (`ranking-2.md`)

## Principle

Fusing two surfaces into one list is a real and often good move — it removes a boundary the
user did not ask for, and the variant that did it here answered *return after an interruption*
better than either of the others. The cost is not visual. It is that any per-surface obligation
quietly becomes ambiguous.

This surface owed each of its two regions the same declaration: inbox and timeline each show
all five states — **empty · loading · error · success · disabled**, in the brief's own words.
Once the two regions are one region, "both declared it" and "one declared it and the other
inherited the claim" look identical on screen. The obligation was not dropped deliberately; it
stopped being answerable.

A second-order tell, and the reason the brief's exact five words matter here: the merged variant
also *renamed* one of them, carrying "unresolved" through the page where the brief says "error".
A juror flagged the relabelling directly. Once a surface is merged, its own vocabulary drifts
too, and a reader checking the contract word by word can no longer tick items off.

The transferable rule: before merging two regions, list what each owed *as a region*. If any
obligation is stated per-surface, merging converts it into an obligation nobody can verify was
met twice. Either re-state the obligation for the merged surface explicitly, or keep the seam.
The seam is cheap; an unverifiable contract is not.

Second-order effect worth carrying: the merged list also had to hold settled history and
not-yet-actionable placeholder rows alongside live decisions, so clearing the day's work meant
reading past items that were never actionable. A merge tends to inherit *all* of both sources'
content rules, not just their layout.

## Do not copy

Do not read this as "never merge an inbox and a timeline". The merge won this variant its
strongest praise, and on a product whose core job is *catch up on what happened*, the merged
form is probably right and the seam is the mistake. What must not be lifted is the merge as a
default. Copy the pre-merge question — what did each region owe on its own? — and answer it
before deciding.
