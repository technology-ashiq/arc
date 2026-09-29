<!-- facts: appetite=c68c3357 blocked-on=a68c9074 burn=96d97217 cycle=ef40fafb depends-on=a68c9074 hasPlan=b5bea41b phase=27491f50 status=8ddd7aee title=b2ca57cd -->
```tagline
The trial room for new AI workers. A candidate model sits the same small tests the current best one
sits, and bench can only recommend. A person decides.
```

# Start here

## In plain words

Think of arc as a small company whose staff are AI models. Each kind of job (writing a commit message,
reviewing a diff) is done by whichever model is currently the best fit. Without a proper test, changing
who does a job is slow and done by hunch.

**bench is the trial room.** A new model is brought in, given the same small tests the current holder
of the job already sits, and marked on the same sheet. Then bench writes a short note: "this one looks
as good and costs less" or "no, here is why".

```panel big
**bench never hires anyone.** It may only *propose* a change to the staff rota (`engine/router.yaml`). A person reads the proposal and says yes or no. Bench has no way to write to the rota itself, and the run checks afterwards that the rota did not change.
```

### What this lane is for

Without bench, a new model arrives and nobody can say whether it is any good at arc's real jobs. And a
model already on the job can quietly get worse or dearer, and nobody notices.

The lane's goal, from its plan (`initiatives/bench/PLAN.md`), is that a new model becomes a same-day
decision with a paper trail, and that a champion who is slipping is caught within a month.

### Why it took a road first

When the lane was born, the plan checked its own assumptions against the real repo. Five did not hold
(ADR-0900 to ADR-0905 record them): only one worker had ever produced a real receipt, the test cases
carried no marking scheme, the practice driver did not exist, and there was no price list. So the lane
spent its first phase building the missing road, and its appetite (its time budget) was set at eight days.

## arc words → normal words

```lede
Eight pieces of arc jargon. Each is an ordinary hiring-trial thing wearing a technical name.
```

```rosetta
bench | the trial room | tests one named model and proposes; never decides
champion | the current best worker for a job | what a candidate is compared against
candidate | the new worker on trial | always named by hand; never picked or swept automatically
fixture | one exam question with its answer key | ships with each process that can be benched
K=3 | sit every exam three times | the three results are never blended into one
propose-only | "write the recommendation, do not sign it" | a person merges every routing change
ceiling | a spending cap someone typed in by hand | stops a run before it spends; it is not a real price list
drift guard | a monthly check on the champion | catches quiet slipping in quality or cost
```

## How one trial goes

```lede
The exam is marked by fixed checks, not by anyone's opinion. Money is set aside before each exam
starts, and any failed gate ends in a written reason, not a recommendation.
```

```flow
source: arc-bench.mjs --driver D --model M
box: ① Set the cap | money reserved first
box: ② Sit the exams | each one three times
box: ③ Mark them | schema, answers, cost
box*: ④ Gates | all must pass
labels: reserved, scored, then
out: no cap | refused, never defaulted
out: -
out: -
out: gate fails | NO PROPOSAL, with the reason
out+: proposal | evidence + diff, for a person
divider: 2 | free to refuse | money is spent
note: Nothing is merged by bench. A person answers the proposal through arc-inbox.
caption: Figure 1 — one bench run. | The dashed line is where the trial starts costing real money.
```

## The stages, one by one

```lede
Each stage is written twice: first in ordinary words, then what actually happens.
```

```steps
t: Reserve the money first
plain: Before an exam starts, bench sets aside the worst-case cost of all three sittings. If the cap cannot cover it, that exam is never started. A missing cap is a refusal, never a guess.
d: Admission control by fixture group, against both a whole-run cap and a per-process cap (ADR-0909). The caps are typed in by hand in `initiatives/bench/ceilings.json`.
f: `.claude/scripts/engine/arc-bench.mjs`

t: Sit and mark the exams
plain: The candidate does each exam three times. Marking is mechanical: does the answer have the right shape, and does it pass the answer key. Cost and speed are noted too. Nothing is averaged away.
d: Quality means assertion pass-rate (ADR-0905). An exam with no answer key counts as absent, never as a pass. Re-marking the saved answers gives byte-identical scores (ADR-0913).
f: `commit-msg-draft` is the one job armed with real exams so far

t: Run the gates
plain: A list of tests the candidate must clear, in a fixed order. There is no single score. All the evidence is shown side by side.
d: Selection is gates-first with no composite score (ADR-0906).
f: `initiatives/bench/PLAN.md`

t: Write the proposal, or the reason not to
plain: If every gate passes, bench writes an evidence table, a machine-readable copy, and a diff of the rota pinned to the exact version it read. If not, only the first two, headed NO PROPOSAL with the reason.
d: Three artifacts (ADR-0907). It goes onto arc's logbook using the existing event kinds only (ADR-0911), and it travels through the same policy gate as everything else (ADR-0912).
f: `engine/router.yaml` is read, never written
```

# The bigger loop

## The monthly check

```lede
The champion is re-sat once a month. Quality and cost are judged separately, and a fall in score is
never a reason to move the goalposts.
```

The drift guard is the same trial run on the current champion. It watches two things on separate
sheets: is it answering worse, and is it costing more. A clean month leaves nothing waiting for a
person (ADR-0910). It is started by the owner, not by a timer, and `docs/runbooks/bench.md` says how
to run it and read the report (ADR-0908 sets the tiers).

## A trial, as a story

```loop
top: 1 | a new model
top: 5 | the rota
stage: 1 · A new model appears | cheaper, claims to be as good
stage: 2 · Both sit the exams | champion and candidate
stage: 3 · Gates run | quality, cost, cap
stage*: 4 · Proposal filed | a person is asked
stage!: 5 · Person answers | yes or no, with a reason
labels: names, marks, evidence, verdict
back: last -> 1 | a "no" is recorded too, so nobody re-asks blind
caption: Figure 2 — one real trial, start to finish. | Both a yes and a no count as the loop working.
```

1. A cheaper model is named on the command line.
2. It and the current champion sit the same exams, three times each.
3. The gates compare them. Say it matches on answers and costs less.
4. Bench files a proposal to change the rota.
5. A person opens `arc-inbox`, approves or rejects, and writes why.

*This story is an illustration of how the loop runs. It is not a real result.*

## Where it stands

The tracker (`initiatives/bench/PROGRESS.md`) shows the live phase and burn in the generated sections.
In words: the road, the marking, the proposals, the drift guard and a hostile-input pass are all built
and closed. One piece is not done, the **real event**: running a genuine new model through the whole
loop once, to a recorded human verdict.

That piece needs two things nobody else can supply. It needs the owner's go-ahead to spend real money
(the tracker names a worst-case cap), and it needs a human to press approve or reject. The tracker also
says a change outside this lane blocked it again on 2026-09-15: an expired staff-rota row in the engine
lane makes any run that names a model fail before reaching a provider. The fix is engine's to make,
tracked in `initiatives/engine/PROGRESS.md`.

What is next: unblock that, then run the real event from the main clone (the spine refuses to record
from a worktree), then close the phase.

The adversarial pass of the seal phase found many real holes in code the lane had just written, for
example a run that could overspend its cap more than twice over. The full table is in
`initiatives/bench/evidence/phase-04/adversarial-pass.md`.

## How it connects to the rest of arc

- **The engine lane.** Bench reads engine's process files and staff rota and uses its runner. Engine
  owns the runner (`arc-run.mjs`) and the trial-model seam bench relies on (engine ADR-0220).
- **The logbook and inbox.** Runs and proposals land on the same append-only logbook as every other
  lane, and are answered through `arc-inbox`.

# Meta

## Glossary

```gloss
driver: the adapter that calls a particular AI provider. Bench may add only a practice driver, never a new provider.
mock driver: the practice driver. It replays saved answers, so bench's own tests cost nothing (`.claude/scripts/engine/drivers/mock.sh`).
real event: the one time a genuine new model is run through the whole loop, to a person's recorded answer.
spine: arc's append-only logbook of what happened.
```
