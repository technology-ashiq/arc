# PLANOFF — T-01 pre-emit finding verification · RESULTS

**Run 2026-08-10.** Protocol: [`PROTOCOL.md`](PROTOCOL.md), committed in `fd82315` **before**
`.claude/scripts/absorb/ab-run.mjs` existed. Harness: `node .claude/scripts/absorb/ab-run.mjs
--fixtures tests/fixtures/absorb/finding-verification`. Fixtures: 3, built by an agent held blind to
the rebuild diff. Candidates: 22.

## Verdict on the pre-committed pass condition: **NEW-WINS**

```
PRIMARY unresolvable-false-in-main   OLD 3 -> NEW 0   (reduction 3)
SECONDARY true-in-appendix           OLD 0 -> NEW 6   (cost, not loss)
GATE     true-lost                   0   (must be 0)
excluded supported-false-in-main     5   (byte-match cannot catch; not claimed)
bucket   near-miss-demoted           2   (reviewer error, one re-cite away)
```

All three conditions hold: nothing was lost, the primary metric fell strictly, and every demoted true
finding is present in the appendix. NEW removed **100% of the class it claims to remove.**

## AND THE NUMBER THE PROTOCOL DID NOT NAME, which points the other way

| | main report | true / false | precision |
|---|---|---|---|
| OLD | 22 findings | 14 / 8 | 63.6% |
| **NEW** | **13 findings** | **8 / 5** | **61.5%** |

**NEW's main report is 2.1 points LESS true than OLD's.** It removes 9 findings from the main report,
and **6 of those 9 are TRUE** — more truth than falsehood, in absolute terms.

This was computed after the first run and is deliberately **not** part of the pass condition. The
protocol fixed its metrics before the harness existed and that ordering is not negotiable. But the move
the discipline forbids is swapping in a metric that *flatters* the result; this one does the opposite,
so omitting it would be the dishonest choice rather than the disciplined one. It is in the harness
output permanently, above the verdict line, with the verdict line telling the reader to read it first.

**Both numbers are true, because they answer different questions.**

- *Did NEW remove the class it claims?* Yes, completely. Three false findings whose citation did not
  resolve are gone.
- *Is the resulting report more true?* Barely — and slightly less, because the appendix absorbed six
  true findings on the way.

The reconciliation, stated plainly so a reader is not left to infer it: **NEW's value is not a truer
report. It is that every finding remaining in the main report is verifiable, and the unverifiable ones
are visibly set aside instead of mixed in.** Whether that is worth six demoted true findings is a
judgement about how a reader uses a review, and no computation in this file decides it. Which is
exactly why ADR-0603 sends it to a human.

## What NEW cannot catch, in its own words

**Five of the eight false findings quote a real line byte-exactly** — the line simply does not say what
the claim says. A byte-match cannot see that, and `docs/playbooks/finding-verification.md` says so
("Does not claim: general accuracy"). Counted here, named, and excluded from the verdict, because
folding them in would score the technique against a claim it refuses and dropping them would hide the
size of what it leaves open.

So on this fixture set: the claimed class, **3/3 caught**. The unclaimed class, **0/5**.

## The hole no quote check closes, recorded before the run

`03/F3`: the claim is about the `unit` job, the `cite` lands on the `lint` job, and both
`    runs-on: ubuntu-latest` lines are **byte-identical** — so the quote verifies against the wrong
job and the finding passes as verified while being mis-located. Duplicate lines are ordinary in YAML
and shell. Named in `PROTOCOL.md` before the harness ran, by the fixture author, who found it while
building the subject rather than after seeing a score.

## Independent confirmation, which is worth more than the numbers

The blind fixture author predicted this run's outcome **from the fixtures alone, before the harness
existed**: *"if Rule NEW is applied as a byte-match: 13 candidates reach the main report, 9 go to the
appendix. Of the 13 kept, 5 are false. Of the 9 demoted, 6 are true — 4 structurally unquotable, 2
only because the cite is sloppy."*

Measured: 13 main / 9 appendix · 5 false kept · 6 true demoted · 2 near-miss. **Every figure matches.**
Two independent computations of the same quantity, one of which had never seen the implementation.

## Fixture author's caveats, reproduced unedited

Recorded because the person who chose what this is measured against is the only participant who never
saw the change, and their reservations are evidence rather than commentary.

1. Rule NEW as written is a byte-match, and byte-matching cannot catch the 5 most dangerous false
   findings here. If you score NEW on "false findings caught" you will get 3/8 unless the
   implementation judges *support*, not just *match*. Those are two different capabilities and the
   score should separate them.
2. The recall/precision weighting decides the winner and the fixture cannot arbitrate it. Write the
   weighting down before you look at the numbers, or the metric gets chosen after the result.
3. The two near-misses penalise the reviewer, not the rule. If the real change lets a reviewer re-cite
   and re-submit, these are not losses — they are one round trip. Score them in their own bucket.
4. `03/F3` is a hole no quote check can close.
5. `quotable` for a false finding means "the cite resolves to a real quotable line", not "the quote
   supports the claim."
6. The unquotable rate here (4 of 14 true findings, 29%) is my invention, not an estimate. Treat the
   fixture as a discrimination test, not a forecast of production impact.
7. I chose the subjects, so I chose the severities — and the unquotable trues are among the
   highest-severity defects in each subject. I believe that is realistic, but it is the choice that
   maximises the cost of losing them, and you should be free to discount it.

Caveat 2 was honoured: `PROTOCOL.md` landed in its own commit before the harness. Caveats 1 and 3 were
built into the metric set as separate buckets. Caveats 5, 6 and 7 stand unanswered and are the reason
this run does not license a claim about arc's real review output.

## What this run does not establish

Restated from the protocol so nobody has to hold two files open: it does not measure the production
rate of unquotable findings · it does not test the appendix's protective effect, since nothing in arc
reads the appendix back and the source's calibration loop is not rebuilt · it does not test the
before-emission ordering, which leaves no artifact · and it does not test whether the rule reaches the
writer, since on `/arc-audit` the findings are produced by a subagent whose definition is off the
ADR-0602 allowlist.

## The blinding here is WEAK, and saying so is the point

The two artifacts are `quartz.md` and `harbor.md` in this directory — the reports a reviewer would
actually receive under each rule, rendered from the fixtures by
`ab-run.mjs --render OLD|NEW`. Labels come from ADR-0603's fixed information-free pool; the mapping is
sealed under commitment `0169fd06…` and is not in git.

**But one report opens with `Appendix -- unverified: 9 entries` and carries 13 findings; the other has
no appendix and carries 22.** Anyone who has read the playbook can tell which rule produced which in
one glance, and the owner has. The filenames were renamed to the labels so the *filename* is not the
tell, and the structure still is.

So this is **a receipt, not a blind trial** — and the receipt is the part worth having: ADR-0603 exists
so a judgement is recorded with a pick and a reason rather than remembered. Phase 03's A/B was on
*wording*, where blinding genuinely held (the owner picked the variant carrying T-01's gate without
being able to know it). A structural change cannot be hidden that way, and pretending otherwise would
be the overclaim this lane refuses.

**What the owner is actually being asked** is the question the numbers above could not answer: given
these two reports and nothing else, which one would you rather receive from a security audit — the
larger one where nothing is separated, or the smaller one where nine findings are set aside as
unverified? That is a judgement about how a review gets used, and it is the whole gap between
`NEW-WINS` on the primary metric and `-2.1 points` on precision.

**Also recorded:** the mapping lives only in `.claude/state/absorb/seals/PHASE04-T01.json`, which is
gitignored — correct before the reveal, and it means the reveal is impossible from a fresh clone. Same
shape as the spine-fragmentation finding filed against `hq` this week. The reveal writes the mapping
into this file, which is where it becomes durable.

## REVEALED 2026-08-10 — the owner picked the OLD WAY

```
quartz  = old-way          <- PICKED
harbor  = absorbed-way
```

**Decision `01KZN380GP5EDF58H6VRTT0S0T`**, deciding approval `01KZN0ZBK5YW0YJRE9NZ0CW5Q1`, reason
**`pick=quartz; findings neraya iruku`** — *"there are a lot of findings"*. Mapping written to
`mapping.json` by `judgement.mjs reveal` against the recorded decision, not by hand.

**So the harness and the human disagree, and that is the most valuable thing this cycle produced.**
`ab-run` said the technique removes 3/3 of the class it claims. The owner, shown both actual outputs
with nothing else, preferred the one *without* it. Both are true: the benefit is real and measured, and
the owner does not value it enough to accept 9 findings moved out of the main report. ADR-0603 makes
the owner's pick the verdict — *"`verdict` is the OWNER's recorded pick, not the runner's opinion"* —
and a mechanism that only ratifies its own candidate is not a mechanism.

**What the pick does NOT decide.** The phase spec carries **two** owner actions: this A/B pick, and a
separate adopt-or-refuse decision on the proposal. REQ-07 requires both directions to go through the
inbox — *"adoption and retirement each end as an inbox item with a reason"* — so the registry row does
not move on this ULID. It moves on the adoption decision's.

### One observation, and it is NOT a reason to overturn anything

The reason given is about the *number* of findings. The absorbed-way report opens with
`Appendix -- unverified: 9 entries` and then says `13 findings`; the old-way says `22 findings`. A
reader scanning the top sees 13 against 22. But the absorbed way does not *lose* nine findings — it
moves them one heading down.

So the pick may be about **presentation** rather than about the rule. **That reading changes nothing
here.** It is an inference about intent, the decision is a recorded fact, and this lane exists
precisely to stop a measured result being re-narrated into the answer its author preferred. If the
presentation is the real issue, that is a new candidate for a future cycle with its own study and its
own A/B — not a re-run of this one, and not a footnote that quietly reverses a receipt.

## ADOPTED 2026-08-10 — and the two receipts point different ways

Proposal `01KZN50D1EP8H7PX51XY8XMHAA` (subject `absorb.adoption`, direction `retire`, my
recommendation) · decision **`01KZN5H1E2RDHT9ZGQ4CSR85ZB`**, reason **`adopt; appendix irundhaalum ok`**
— *adopt, the appendix is fine*. The owner overruled the recommendation. `products/absorb/
registry.json` moves T-01 to `adopted` on that ref.

**Both receipts stand and neither is edited.** The blind A/B pick chose the OLD-WAY report; the
adoption decision chose to adopt the absorbed way. That is not a contradiction being smoothed over:

- The section above recorded, **before the adoption existed**, that the pick looked like a judgement
  about *presentation* rather than about the rule — 13 findings shown against 22, while nine move one
  heading down rather than away — and then refused to let that inference overturn the pick.
- The adoption is the owner **settling** that question with a second receipt. It is not the earlier
  result being re-narrated, which is the move this lane exists to prevent and which would have been
  available to me if I had waited to write the presentation observation until after the adoption
  landed. It was written first, which is why it can be cited now.

**What was adopted, stated at its real strength.** The claimed class is removed 3/3 across three
fixtures. Main-report precision falls 2.1 points. Five of eight false findings are untouched because a
byte-match cannot judge whether a quote supports its claim. Enforcement is a prompt-forwarding
instruction, not a gate: the findings on `/arc-audit` are written by the `security-auditor` subagent
whose definition is off the ADR-0602 allowlist, so `.claude/commands/arc-audit.md` telling the
orchestrator to carry the requirement into the Task prompt is the whole mechanism. `adopted` is the
registry's word for "the owner decided to use it", not for "it is enforced".

## Next

Nothing on this A/B. The evidence bundle, Phase 04's close and the cycle's close follow.
