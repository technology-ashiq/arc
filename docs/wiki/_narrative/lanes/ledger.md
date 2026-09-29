<!-- facts: appetite=c68c3357 blocked-on=a68c9074 burn=e02f5370 cycle=32c7a505 depends-on=a68c9074 hasPlan=b5bea41b phase=0b3aa5a1 status=4c1abf59 title=b02da083 -->
```tagline
The shopkeeper's notebook for arc's businesses. It turns raw receipts into a profit-and-loss report,
and once a month it closes the page in ink so a closed number can never quietly change.
```

# Start here

## In plain words

Think of arc as a small company that will one day run shops of its own. Every time something happens,
a sale, a fee, a bill, arc writes a one-line receipt in its logbook (the spine).

A pile of receipts is not the same as knowing how a shop is doing. Somebody has to add them up.

```panel big
**ledger is the shopkeeper's notebook.** One page a day, ink only, never erased. It reads the receipts and answers the plain questions: how much did we really earn, what did it cost, and how close is this shop to the line where we shut it down?

It reads the logbook. It never rewrites it. The one thing it may add is a single seal, `month.closed`, and only after the month's numbers have been checked against the bank side.
```

### What this lane is for

When this lane was born, the plan (`initiatives/ledger/PLAN.md`) found that the logbook held no revenue
receipts and no cost receipts at all, and no code existed to read money out of it. arc had receipts and
no way to say whether a venture was winning.

The lane's answer is one report, `arc pnl`, plus the checking machinery behind it. There is no new slash
command for it in v1 (ADR-1009).

## arc words → normal words

```lede
Nine pieces of arc jargon. Each is an ordinary shop-counter thing wearing a technical name.
```

```rosetta
`arc pnl` | the report | prints a venture's profit and loss from the logbook
`ventures.yaml` | the "shut it down if" sheet | each venture's kill criteria, in one file at the repo root
kill-distance | how close to the cliff | how near a venture is to its own shut-down line
MRR | the monthly subscription income | recurring money, without tax
reconciliation gate | matching the till to the bank | a month cannot close until both agree
`month.closed` | the ink seal on a page | the one new receipt kind ledger may write
cost trichotomy | three honest cost lines | measured, declared and shared costs, never summed into one
twin-determinism | delete the notes, rebuild, same answer | replaying the logbook must give an identical report
closed schema | a form with no free-text box | a revenue receipt may only hold the fields named for it
```

## How the notebook works

```lede
Receipts go in one side. A report comes out the other. Closing a month is the only step that writes
anything back.
```

```flow
source: the logbook (spine)
box: ① Read receipts | revenue and costs
box: ② Add them up | money math, no guessing
box: ③ Show the report | arc pnl
box*: ④ Close the month | only if it matches
labels: read, sum, check
out: no bank data | month stays open
out: mismatch | month stays open
out+: month.closed | the page is sealed
divider: 3 | reads only | may write one seal
note: A rail with no bank data blocks the close exactly like a mismatch does.
caption: Figure 1 — the ledger's month. | Everything left of the dashed line is read-only.
```

## The stages, one by one

```lede
Four phases, ordered by risk. Each one is written twice: first in ordinary words, then what it built.
```

```steps
t: Phase 0, the money math
plain: First make the arithmetic trustworthy, and make sure no customer's personal details can ever reach the logbook.
d: Money is counted as whole small units, never fractions. A receipt has a closed set of fields, so anything unlisted is refused. Two export readers and a check that a rebuild gives the same answer.
f: `.claude/scripts/hq/lib/validate-ledger.mjs` · `.claude/scripts/hq/arc-pnl.mjs`

t: Phase 1, the cliff meter
plain: Show how close each venture is to its own shut-down line, and make moving that line leave a paper trail.
d: The criteria live in `ventures.yaml`. Changing one needs a receipt, so nobody can quietly move the goalposts.
f: `ventures.yaml` · `initiatives/ledger/phases/phase-01-spec.md`

t: Phase 2, closing and costs
plain: Add the month-end ritual, and show the three kinds of cost on separate lines.
d: The reconciliation gate checks each payment channel against the logbook in both directions. Only then may `month.closed` be written.
f: `initiatives/ledger/phases/phase-02-spec.md`

t: Phase 3, the proof on the real logbook
plain: Run it on arc's actual logbook and show what it says, even when the honest answer is nothing.
d: The real logbook holds no revenue yet, so the report shows an honest empty. A `--simulated` view exists for demos and is labelled as simulated.
f: `initiatives/ledger/evidence/phase-03/README.md`
```

# The bigger loop

## A month, as a story

```lede
An illustration of how one month would run once a real shop is earning. It is an example, not a record.
```

```loop
top: 1 | the receipts
top: 5 | the seal
stage: 1 · Money arrives | receipts go in the logbook
stage: 2 · Report | arc pnl shows the numbers
stage: 3 · Meter | distance to the cliff is printed
stage*: 4 · Match | till against bank, both ways
stage!: 5 · Sealed | month.closed, never restated
labels: read, watch, check, seal
back: last -> 4 | a mismatch keeps the page open
caption: Figure 2 — a month in the notebook. | The loop back is the point: no match, no seal.
```

1. Two payments arrive and land in the logbook as receipts.
2. `arc pnl` adds them up: gross, fees, tax and what is left.
3. The report prints how far the shop is from its shut-down line.
4. At month end, the bank's own totals are compared with the logbook. One is missing, so the month stays open.
5. Once the missing one is found and the two agree, the page is sealed. It can not be restated later.

*The two payments are an illustration, not real money.*

## Where it stands

Status is IDLE. The cycle opened on 2026-08-12 and closed on 2026-08-13, using 7 of its 8 days
(`initiatives/ledger/PROGRESS.md`). All four phases are closed.

One planned piece, `--explain` (every number explaining itself), was cut on purpose, as the first item
on the plan's cut list, to stay inside the time budget.

**Mechanism proven, live value pending.** Every check has run on test data and on the real logbook, but no
real money has flowed through it yet. The first real month closed behind a green match is the milestone
still ahead, and it is not a gate on this lane closing. What is owed next: real redacted export samples
from the payment providers, since the two readers were tested against made-up samples only.

## How it connects to the rest of arc

- ledger reads and writes the logbook through the same reader and writer every other part of arc uses.
- It shares a few files that belong to no lane, such as `ventures.yaml`. The rule there is to check what another lane changed first.
- Its decisions are ADR-1000 to ADR-1018. Three of them (ADR-1016, ADR-1017, ADR-1018) were written during the build, because the work contradicted an earlier decision.
- Its retro lessons are in `docs/retro-log.md`.

# Meta

## Glossary

```gloss
spine: arc's logbook. Every event is one line, added to the end and never edited.
PII: personal information about a customer, such as a phone number or a name with a birth date.
kill criterion: a written condition under which a venture is shut down, such as a revenue floor.
rail: one payment channel, for example one provider that settles money to the bank.
minor units: the smallest coin, for example paise or cents, so money is whole numbers.
```
