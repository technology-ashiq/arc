# Jury confound — recorded before reading the rankings, not after

**What I did wrong.** The three variants and the reference were composed against
`fact-pack.md` as it stood. Later — after composition, before the jury read anything — the
first live run of `arc dash` against the real spine showed the pack's headline figure was
wrong (`1,386 receipts` quoted from a survey report; the reader derives `1,146`, and the
day-file line count agrees with the reader). I corrected the pack, which was right for the
build, and then handed the jurors the CORRECTED pack as the content contract for items that
had been built against the OLD one.

That is a moving target. The jury was asked to judge content fidelity against a document
that had changed under the items.

**How it showed up.** Juror 2 ranked `item-1 > item-3 > item-2 > item-4` and named, as its
largest swing factor, that "item-2 and item-4 both render 1,386 — the exact figure the fact
pack names as the mistaken number".

That differentiator does not survive checking. Measured directly:

| item | renders 1,386 | renders 1,146 |
|---|---|---|
| variant-a | yes (×2) | no |
| variant-b | yes (×2) | no |
| variant-c | yes (×2) | no |
| reference | yes (×1) | no |

**All four carry the stale figure.** It is not a differentiator at all — it is a constant.
Juror 2 singled out two of four for a defect the other two also have, and weighted its
ordering on it.

**How this is handled.**

1. The content-accuracy penalty is **discounted** in synthesis wherever it rests on the
   stale receipt count, because it applies equally to every item. What survives from each
   ranking is its reasoning about structure, density, honesty affordances and craft.
2. The rankings are **not re-run**. Re-running would cost a full panel to remove a factor
   that can be discounted precisely, and the panel exists so that one juror's bad
   differentiator does not decide anything.
3. The owner's PICK should be made on the **renders themselves** (the design lane's law says
   so anyway, and Cycle 3 is the record of what happens otherwise). These rankings are an
   input, not a verdict.

## Two further things the checking turned up

**Two of the three jurors fabricated the same fact, both in their winner's favour.**
Juror 2 wrote that item-1's headline "reads as 1,146 receipts, matching the fact pack".
Measured: item-1 renders `1,386` twice and `1,146` zero times. Both of juror 2's
content-accuracy claims are therefore wrong — the one that penalised two items for a shared
constant, and the one that credited its winner with a correction it does not contain.
Juror 1 made the identical error: it wrote that "item-3 and item-1 both render the fact
pack's corrected spine total (1,146 receipts)" and called that its key evidence. Measured:
neither does. Both jurors credited their chosen winners with a correction no item contains,
and both named it decisive.

That is not two independent mistakes — it is one induced artifact. The pack I handed them
states the corrected figure AND names 1,386 as "the mistaken number", so a juror looking for
compliance pattern-matched its preferred item as compliant. I built the trap and two of three
walked into it.

Consequence: **the content-accuracy reasoning in rankings 1 and 2 is void**, and with it
their stated decisive evidence. What survives from all three is the reasoning about
structure, density, resting space, colour discipline and honesty affordances — which is what
they were actually convened to judge. This is the reason a ranking is read against the
artifact instead of quoted.

**Juror 3 found a real defect, and its root cause is mine.** It flagged the reference's
inbox summary as arithmetically impossible. It mis-quoted the figures (it said
"55 raised, 42 decided, 2 open"; the page actually says `49 ever · 41 decided · 2 open`)
but the defect is real and worse than quoted: **49 − 41 = 8, not 2.**

That inconsistency did not originate with the composer. It was in the ORIGINAL fact-pack,
which I wrote from the survey: it stated `approval.requested 49`, `decision.recorded 41`,
and "the ONLY two" open, three numbers that cannot all be true. The composer rendered my
pack faithfully and inherited its contradiction.

The corrected, reader-derived figures reconcile exactly: **55 raised − 42 decided = 13
open.** Which is the argument for the whole product in one line: numbers that are derived
close; numbers that are quoted drift apart and then contradict each other in public.

**The lesson, which is mine.** A shared content fixture handed to a jury must be FROZEN at
composition time. If it is corrected mid-flight, either the items are rebuilt against the
correction or the jury is told which facts moved — I did neither, and a juror duly spent its
decisive reason on my bookkeeping rather than on the design.

Recorded here rather than quietly absorbed, because a confound that is only noticed inside
the synthesis is indistinguishable from one that was never noticed.
