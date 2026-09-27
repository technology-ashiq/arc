<!-- facts: appetite=39b40118 blocked-on=a68c9074 burn=28bfa716 cycle=94f71035 depends-on=a68c9074 hasPlan=b5bea41b phase=d7fd44aa status=4c1abf59 title=c2349201 -->

# model-policy

## In plain words

Think of a small company where every employee quietly decided, on their own, what grade
of work they were qualified to do — nobody ever wrote down the rule, and nobody could point
at a document and say why one person was trusted with judgment calls and another was only
trusted with mechanical listing. <!-- plain -->

That was arc's actual situation: 27 agents, each with a `model:` line in its frontmatter,
and nothing anywhere recording why any seat sits on the tier it sits on. <!-- src: docs/adr/0069-balanced-model-policy.md#Context -->
The real goal of this lane was to stop that from being taste and make it a written,
adopted policy — which seat gets which tier, why, what would change it, and the receipt
discipline every future model decision must carry — plus four cheap discipline fixes an
audit had already surfaced, so that when a later engine cycle needs a routing table it
implements a policy that already exists instead of inventing one under deadline. <!-- src: initiatives/model-policy/PLAN.md#Goal -->

### What it is building

This lane does not build software. It builds **policy** — a rule that any future `model:`
edit in an agent's frontmatter must follow, recorded as a reviewed diff citing `ADR-0069`
rather than a quiet edit — plus four narrow fixes to mechanisms that already existed. <!-- src: initiatives/model-policy/PLAN.md#presumes; CLAUDE.md#quiet -->

The main artifact is `ADR-0069`, the Balanced Model Policy itself. It defines tiers,
states what must never happen, names the metrics that would tell us the policy is wrong,
and says when the engine cycle starts. <!-- src: docs/adr/0069-balanced-model-policy.md#Brier -->

Block (c) names the five metrics, each with a formula and a named data source, defined but
not instrumented; block (e) is the model-fingerprint block every experiment arm,
calibration-relevant run, and policy exception records. <!-- src: docs/adr/0069-balanced-model-policy.md#Brier; docs/adr/0069-balanced-model-policy.md#agent-file -->

Two of its blocks are carve-out clauses that the never-do list says are both
human-approved: exploratory-trial freedom and an emergency fallback. <!-- src: docs/adr/0069-balanced-model-policy.md#never-do -->

Around it sit `ADR-0063` through `ADR-0068` — six decisions (MP-A through MP-F) that each
give the reasoning ADR-0069 states normatively but does not re-argue — and `ADR-0070`,
the one experiment this lane actually ran, deciding a real question with real data rather
than a rule. <!-- src: docs/adr/0069-balanced-model-policy.md; docs/adr/0070-composer-seat-stays-balanced-workhorse.md -->

The four discipline fixes are: a middle-cost tier for the `/arc-council` command, an
unblocked calibration scoreboard, a fair paired experiment on one untested agent's model
tier, and a place for rejected attacker findings to leave a trace instead of vanishing. <!-- src: initiatives/model-policy/PLAN.md#presumes -->

## arc words → normal words

| arc calls it | It is really |
|---|---|
| tier | A pay grade for how hard a piece of work is — never the name of a vendor's model. `cheap-scan`, `balanced-workhorse`, `high-judgment`, `independent-family-verifier` are the four grades this policy defines. <!-- src: docs/adr/0069-balanced-model-policy.md --> |
| seat | One named agent's job, e.g. `code-reviewer` or `ui-composer` — the thing a tier gets assigned to. <!-- src: docs/adr/0069-balanced-model-policy.md#never-do --> |
| implementation v1 | The label on today's claude mapping (haiku/sonnet/opus) — a swappable choice, not the definition of the tier itself. <!-- src: docs/adr/0069-balanced-model-policy.md --> |
| MP-A..F | Six decision ADRs (0063–0068), each the reasoning behind one slice of the policy. <!-- src: docs/adr/0069-balanced-model-policy.md --> |
| MP-F fingerprint | A fixed list of fields (provider, exact model id, agent role, agent-file/prompt commit SHA, input/brief SHA, timestamp, wall-clock duration, effort setting if visible, statusline cost if visible) that any model comparison must record, where an unavailable field stays absent rather than estimated. <!-- src: docs/adr/0068-mp-f-model-fingerprint-forward-only-never-estimated.md -->|
| council `standard` mode | A fixed-price middle option for `/arc-council` between the unverified `quick` and the full `deep` panel. <!-- src: .claude/commands/arc-council.md -->|
| calibration scoreboard | `council-calibrate.mjs`'s tally of council predictions graded HIT/MISS/UNRESOLVED against what actually happened, scored by a Brier score. <!-- src: .claude/scripts/council/council-calibrate.mjs -->|
| reject-log | The one `REJECTED: <finding> — <reason>` line `/arc-kickoff`'s attack-panel step writes for each finding the session declines, `<reason>` drawn only from the fixed six-word taxonomy `duplicate`, `out-of-appetite`, `unsupported`, `violates-no-go`, `already-covered`, `non-actionable`. <!-- src: .claude/commands/arc-kickoff.md#non-actionable -->|
| paired A/B | Two runs of the same brief, same commit, same assignment, differing in exactly one variable (here: the model tier), ranked blind before either arm's identity is revealed. <!-- src: initiatives/model-policy/phases/phase-02-spec.md -->|
| exploratory-trial freedom | Trying any model, any provider, on an isolated receipted branch, with no policy amendment needed — only a *production* tier change needs one. <!-- src: docs/adr/0069-balanced-model-policy.md#Exploratory-trial -->|

## How the work was planned

The plan's own **Current state** section says it was verified against the tree at kickoff
rather than carried over from the design source, because two of the design source's
claims came back different once checked mechanically: the assumed `/arc-change` mirror of
the attacker reject-log does not exist, and the design renderer's Arial font-pin applies
only when `PIN_FONT=1`, rather than unconditionally. <!-- src: initiatives/model-policy/PLAN.md#presumes -->

**The appetite was 3 days, hard cap, tier S** — a constraint, not an estimate; blowing it
meant cutting scope or killing a phase, never a silent extension. <!-- src: initiatives/model-policy/PLAN.md#BRIEF-composer-ab.md -->

Four kill criteria were written down before any work started: at 1.25 days, Phase 01 not
closed means re-forecasting Phase 02's window; at 1.5 days (50%), REQ-01 unmerged means
stopping and taking the policy itself to `/arc-council standard`; if the Phase 02 paired
runs cannot both finish by 2.5 days, bank whichever arm finished and drop the rest to a
follow-up brief; at 100%, cut or kill. <!-- src: initiatives/model-policy/PLAN.md#BRIEF-composer-ab.md -->

Five REQs carried the whole cycle: REQ-01 is the policy itself (Phase 0); REQ-02 and
REQ-04 are Phase 1 (the council `standard` mode and the calibration unblock); REQ-03 is
Phase 2 (the paired composer experiment); REQ-05 is Phase 3 (the reject-log). <!-- src: initiatives/model-policy/PLAN.md#risk-ordered -->

The plan's Phases section is headed "risk-ordered" and states plainly why Phase 0 goes
first: "Nothing else in this cycle means anything if the policy does not exist — every
other REQ is a discipline the policy names." <!-- src: initiatives/model-policy/PLAN.md#risk-ordered -->

Out of scope for this cycle, regardless of what surfaced mid-work: router, drivers and
bench (their own sleeping plans); per-call cost enforcement; an automatic complexity
classifier or auto-escalation; external-juror expansion; changing the design pipeline
beyond the REQ-03 paired runs; and rewriting the 3-variant explore tooling. <!-- src: initiatives/model-policy/PLAN.md#auto-escalation -->

Anything engine-shaped that came up mid-cycle was to become a queued note in
`docs/strategy/plans/PLAN-engine-process-layer.md`, routed through `/arc-change`, never
built here. <!-- src: initiatives/model-policy/PLAN.md#auto-escalation -->

The plan's assumptions ledger names each assumption next to its own falsification trigger
and the phase that tests it — among them A-01, whether the workhorse composer seat is a
live quality bottleneck (tested by Phase 2), and A-06, whether a real kickoff will run
soon enough to exercise the reject-log line, its trigger being 14 days passing with none
recorded (tested by Phase 3). <!-- src: initiatives/model-policy/PLAN.md#auto-escalation -->

## The phases, one by one

**Phase 00 — the steel thread (0.5 days appetite; PLAN.md's Phase table names this
REQ-01).** Write `ADR-0069` with all seven content blocks, get `kickoff-lint` to exit 0
with the ADR indexed, and merge it. <!-- src: initiatives/model-policy/phases/phase-00-spec.md; initiatives/model-policy/PLAN.md#risk-ordered -->

The phase's own verification plan predicted a specific first failure: adding the ADR-0069
row to `PLAN.md`'s index *before* the file existed would fail `kickoff-lint`'s `[adr]`
check, not the `[adr-wired]` check the spec first guessed at. The real run confirmed
exactly that — `FAIL [adr] ADR 0069 in index but docs/adr/0069-*.md not found` — and the
spec was corrected to match the code before the phase closed. <!-- src: initiatives/model-policy/phases/phase-00-spec.md; initiatives/model-policy/evidence/phase-00/01-lint-RED.txt; initiatives/model-policy/PROGRESS.md#Done-log -->

Writing the ADR turned the check green: `kickoff-lint: all checks passed`. <!-- src: initiatives/model-policy/evidence/phase-00/02-lint-GREEN.txt; initiatives/model-policy/PROGRESS.md#Done-log -->

The seat census — the table ADR-0069 builds its tier map from — was checked against the
live tree with `grep -r '^model:' .claude/agents/ | sort` rather than trusted from memory,
and it returned 27 lines: 1 haiku, 22 sonnet, 4 opus. <!-- src: initiatives/model-policy/evidence/phase-00/03-census.txt; docs/adr/0069-balanced-model-policy.md#never-do -->

After the phase looked done, two fresh-context agents re-read the merged ADR against the
tree and found seven defects the author had missed: a citation of `ADR-0023` that should
have been `ADR-0026`; a spine event kind named in a metric formula (`phase.done`) that
does not exist in the closed 18-kind vocabulary (the real kind is `phase.closed`); a
metric formula that named `PREDICTION` where the calibration script actually reads
`CONFIDENCE:`; a sentence predicting data that the same ADR's own rule forbids predicting;
two metrics contradicting each other on which one produces data this cycle; ADR numbers
(0015–0018, 0002) resolving to the wrong namespace — precisely the cross-namespace trap
one of the ADRs itself was written to warn about; and a promised "escalation defaults"
handover that no block of the ADR actually defines. All seven were fixed before close. <!-- src: initiatives/model-policy/PROGRESS.md#Done-log -->

A drift sweep also found that nothing any agent loads every session pointed at ADR-0069 —
so a "Model tiers are law, not taste" rule was added to `CLAUDE.md`, without which the
never-do list's rule against silent tier changes had no reader to bind. <!-- src: initiatives/model-policy/PROGRESS.md#Adoption; CLAUDE.md#quiet; docs/adr/0069-balanced-model-policy.md#never-do -->

**Phase 01 — council `standard` mode and the calibration unblock (0.75 days appetite,
REQ-02 + REQ-04).** Document and run `/arc-council standard` for real inside a fixed
envelope — at most 2 researchers, 3 stances, 1 verifier, at most 6 seats and 7 model
calls, no domain experts, no juror, no rebuttal round — and separately, get the
calibration scoreboard to surface its one historic session without manufacturing a grade. <!-- src: initiatives/model-policy/phases/phase-01-spec.md -->

Before the fix, `council-calibrate --overdue` reported nothing overdue because session
001 carried no `Review-by:` line at all. <!-- src: initiatives/model-policy/evidence/phase-01/01-calibrate-RED-before.txt; initiatives/model-policy/PLAN.md#presumes -->

The session was retrofitted by **appending** `Review-by:` and `Resolution:` lines — never
rewriting anything — and the same command then listed it as overdue, which the phase
treated as the actual proof the mechanism worked rather than an assertion that it should. <!-- src: initiatives/model-policy/evidence/phase-01/02-calibrate-GREEN-overdue.txt; initiatives/model-policy/PLAN.md#Success -->

A `git diff`-style additions-only check on the session file showed insertions only,
deletions zero. <!-- src: initiatives/model-policy/evidence/phase-01/02-calibrate-GREEN-overdue.txt -->

`council-calibrate`'s output at this point showed the session excluded from scoring
rather than counted a miss — `scored: 0`, `excluded (WAIT/UNRESOLVED): 1` — and the same
run's `--overdue` check found nothing overdue. <!-- src: initiatives/model-policy/evidence/phase-01/03-calibrate-outcome-recorded.txt -->

Session 001 graded `UNRESOLVED` with the scoreboard still at zero scored is the pass
condition for REQ-04, not a shortfall: a forced HIT/MISS would have violated Truth-Law E3. <!-- src: initiatives/model-policy/PROGRESS.md#delivered -->

Along the way `council-lint`'s section regex was found unanchored, so it failed a
*correct* session for merely mentioning `## OUTCOME` in prose; `council-calibrate` carried
the identical regex and had only survived by reading the last section. <!-- src: initiatives/model-policy/PROGRESS.md#delivered -->

Both scripts were fixed and pinned with a negative-control regression test. <!-- src: initiatives/model-policy/evidence/phase-01/04-lint-anchor-fix.txt; initiatives/model-policy/PROGRESS.md#delivered -->

The `standard` mode itself was proven on a real owner question — "should arc reach a
self-standing good shape before any revenue venture starts?" — inside the envelope at 6
seats and 6 model calls against a ceiling of 7; the verifier contested 6 of 15 points on
its own, so the send-back-once guard was never needed. <!-- src: initiatives/model-policy/PROGRESS.md#delivered -->

The saved session also records two honesty items against itself: the Chair anchored a
date wrong at High confidence and every member inherited the error before the verifier
caught it, and the evidence brief's own framing leaned against the proposition. <!-- src: initiatives/model-policy/PROGRESS.md#delivered -->

**Phase 02 — the paired composer A/B (1.25 days appetite, REQ-03).** Answer, with one
receipted experiment rather than an opinion, whether `ui-composer` (running on
`balanced-workhorse`) deserved the `high-judgment` tier that `design-director` — the agent
that judges its output — already sits on. <!-- src: initiatives/model-policy/phases/phase-02-spec.md; docs/adr/0070-composer-seat-stays-balanced-workhorse.md#Context -->
Every fairness condition was asserted before either arm ran: one pinned commit
(`e46bbda`); one director assignment written once and copied byte-for-byte into the
second arm, with SHA-256 equality checked per variant before any composer started; the
same renderer recipe on all six pages with `PIN_FONT=0` so typography survived into the
judgement, instead of the Arial pin that had erased a whole earlier cycle's typography
from its own verdicts. <!-- src: initiatives/model-policy/evidence/phase-02/fingerprints.md; docs/adr/0070-composer-seat-stays-balanced-workhorse.md -->
Run S (three composers on balanced-workhorse) and run O (three composers on
high-judgment) each recorded an MP-F fingerprint; both left `statusline cost` recorded as
absent, because arc has no per-item cost attribution to read it from. <!-- src: initiatives/model-policy/evidence/phase-02/fingerprints.md -->
No reference screen existed, so the ranking became six items rather than the planned
seven, and `design-jury` — whose agent file is hard-coded for exactly four items — was
overridden by prompt only, its file left untouched, logged as a documented deviation. <!-- src: docs/adr/0070-composer-seat-stays-balanced-workhorse.md -->
The owner's blind ranking put the workhorse variant ahead of the high-judgment variant in
all three same-thesis pairs, 3–0 (`item-2 > item-5 > item-6 > item-3 > item-4 > item-1`,
arm pattern S O S O S O). <!-- src: initiatives/model-policy/evidence/phase-02/rankings.md -->
The independent jury ranking disagreed and also alternated perfectly, this time 2–1 the
other way (`item-5 > item-4 > item-1 > item-2 > item-3 > item-6`, arm pattern O S O S O
S). <!-- src: initiatives/model-policy/evidence/phase-02/jury-ranking.md -->
Recorded wall-clock showed run O was not slower — about 58.0 minutes total against run
S's about 80.5 minutes. <!-- src: initiatives/model-policy/evidence/phase-02/rankings.md -->
By the formula fixed before any output was seen — keep high-judgment only if the blind
ordering shows a material gain the owner accepts, "slightly better" alone reverts — the
result kept `ui-composer` on balanced-workhorse, recorded in `ADR-0070`. <!-- src: docs/adr/0070-composer-seat-stays-balanced-workhorse.md#Decision -->

**Phase 03 — the reject-log, mode-ladder dogfood, and close (0.5 days appetite,
REQ-05).** Change `/arc-kickoff` step 5 from "reject → drop silently, no log" to one line
per rejected finding, `REJECTED: <finding> — <reason>`, with `<reason>` drawn only from a
fixed six-word taxonomy: `duplicate`, `out-of-appetite`, `unsupported`,
`violates-no-go`, `already-covered`, `non-actionable`. <!-- src: .claude/commands/arc-kickoff.md#non-actionable; initiatives/model-policy/PLAN.md#risk-ordered -->

The scope was `arc-kickoff.md` only — the design source's assumed `/arc-change` mirror
did not exist and was not built, re-verified at phase time as still absent. <!-- src: initiatives/model-policy/phases/phase-03-spec.md -->

The mode-ladder dogfood came back only partially met, and the phase recorded that plainly
rather than padding it: `quick` ran zero times, `deep` ran zero times, and `standard` ran
once — running the other two modes purely to fill the row would have been manufacturing
usage, the same failure REQ-04 refused when it declined to force a HIT/MISS onto
session 001. <!-- src: initiatives/model-policy/evidence/phase-03/mode-mix.md -->

No trial-ledger rows were required this phase, because the `council-lint` change from
Phase 01 was a bug fix to an existing check, not a new WARN-first gate. <!-- src: initiatives/model-policy/evidence/phase-03/mode-mix.md; initiatives/model-policy/PROGRESS.md#delivered -->

## What it decided

| ADR | In one line |
|---|---|
| `ADR-0063` (MP-A) | The model policy outranks the implementation, with two human-approved carve-outs: an emergency fallback and exploratory-trial freedom. <!-- src: docs/adr/0063-mp-a-policy-outranks-implementation.md -->|
| `ADR-0064` (MP-B) | Judgment seats get the strongest tier by principle; a creative seat has to earn its tier through a receipted A/B instead. <!-- src: docs/adr/0064-mp-b-seat-tier-principle-creative-seats-earn-their-tier.md -->|
| `ADR-0065` (MP-C) | The council mode ladder is fixed at three rungs — `quick`, `standard`, `deep` — and the human picks the word. <!-- src: docs/adr/0065-mp-c-council-mode-ladder-fixed-at-three.md -->|
| `ADR-0066` (MP-D) | The session-001 retrofit is an append executing council-v2's `ADR-0012`; council-v2's `ADR-0010` already-executed a separate `CONFIDENCE` cap and does not sanction this append. <!-- src: docs/adr/0066-mp-d-session-001-retrofit-executes-council-v2-adr-0010.md -->|
| `ADR-0067` (MP-E) | The attacker reject-log is a trace, not a process: one line, a fixed taxonomy, no rebuttal. <!-- src: docs/adr/0067-mp-e-attacker-reject-log-is-a-trace-not-a-process.md -->|
| `ADR-0068` (MP-F) | Model fingerprints are forward-only and never estimated; a field that cannot be read stays absent. <!-- src: docs/adr/0068-mp-f-model-fingerprint-forward-only-never-estimated.md -->|
| `ADR-0069` | The Balanced Model Policy itself — tiers, the never-do list, the five metrics, the engine trigger, the fingerprint block, and both carve-out clauses, in one operative document. <!-- src: docs/adr/0069-balanced-model-policy.md#never-do; docs/adr/0069-balanced-model-policy.md#Brier; docs/adr/0069-balanced-model-policy.md#agent-file; docs/adr/0069-balanced-model-policy.md#Exploratory-trial -->|
| `ADR-0070` | The composer seat stays balanced-workhorse: the paired A/B returned no owner-visible gain for the high-judgment tier. <!-- src: docs/adr/0070-composer-seat-stays-balanced-workhorse.md -->|

Every one of these eight is filed with `Product: company` — arc-wide, per `ADR-0053` —
rather than under a per-lane product namespace; each ADR's own header also states plainly
that it was produced by the `model-policy` lane, which is how this page attributes them to
this lane at all. <!-- src: docs/adr/0063-mp-a-policy-outranks-implementation.md; docs/adr/0064-mp-b-seat-tier-principle-creative-seats-earn-their-tier.md; docs/adr/0065-mp-c-council-mode-ladder-fixed-at-three.md; docs/adr/0066-mp-d-session-001-retrofit-executes-council-v2-adr-0010.md; docs/adr/0067-mp-e-attacker-reject-log-is-a-trace-not-a-process.md; docs/adr/0068-mp-f-model-fingerprint-forward-only-never-estimated.md; docs/adr/0069-balanced-model-policy.md; docs/adr/0070-composer-seat-stays-balanced-workhorse.md -->

`ADR-0069` also supersedes, in scope only, an older council decision on per-agent model
tiers for the council seats specifically — the rest of that older decision is untouched. <!-- src: docs/adr/0069-balanced-model-policy.md#Supersedes -->

## Where it stands now

Status is `IDLE`; the cycle (Cycle 5) closed 2026-08-02; appetite was 3 days and burn came
in at 0.7 days. <!-- src: fact:lanes/model-policy.status; fact:lanes/model-policy.cycle; fact:lanes/model-policy.appetite; fact:lanes/model-policy.burn -->
All four phases closed, all five REQs validated, and none of the kill-criteria
tripwires fired. <!-- src: initiatives/model-policy/PROGRESS.md#Now -->
The burn figure needs its own caveat, which `PROGRESS.md` states plainly rather than
letting stand as a bare number: this is *agent* wall-clock, not owner-hours, on the first
cycle where most execution ran agent-parallel — six composers built simultaneously, and
the owner's own time in the whole cycle was roughly one approval, one council question,
and one blind ranking. Comparing 0.7 days here against an earlier cycle's 3.35 days is
comparing two different units. <!-- src: initiatives/model-policy/PROGRESS.md -->
What this cycle explicitly did **not** establish, recorded so it is not claimed later: no
absolute design-quality bar (only a comparison between two arms); no cost figure (both
arms record `statusline cost: absent`); no real mode mix (one `standard` run, zero `quick`,
zero `deep`); and REQ-05 is implemented but unproven — no kickoff has yet produced a real
`REJECTED:` line. <!-- src: initiatives/model-policy/PROGRESS.md#Now -->
Of the six assumptions logged at kickoff, one is dead (the workhorse composer bottleneck,
killed by the interleaved rankings) and the rest remain open with their triggers
still armed. <!-- src: initiatives/model-policy/PROGRESS.md -->
The lane's own next step is stated plainly: `/arc-kickoff --lane model-policy` when a new
cycle pulls it; until then a later engine cycle inherits `ADR-0069` rather than deciding
its own routing questions, with one flagged conflict already queued for that cycle to
reconcile — `PLAN-engine-process-layer.md`'s ENG-E ladder has an auto-switching middle step
that block (b)(1) forbids. <!-- src: initiatives/model-policy/PROGRESS.md#Now -->

## The bigger loop

### What went wrong and what was learned

Three rows in the retro log carry the exact tag `arc-model-policy`: one about a citation
that resolved to the wrong ADR, one about a closed cycle still read as open by a stale
trigger document, and one about an unanchored section regex. <!-- src: docs/retro-log.md#arc-model-policy -->

The first: a bare ADR number cited across namespaces resolved to a different, unrelated
decision four times in one cycle — and the cycle that had just written the warning about
this exact trap (`MP-D`) walked into it three ADRs later, inside `MP-D` itself. The lesson
recorded: a citation is `<namespace> ADR-NNNN` plus a path, never a bare number, and when a
plan says "per ADR-X", open ADR-X before acting. <!-- src: docs/retro-log.md#ledgers -->

The second: a cycle that had closed five days earlier was still reported live by the
company log, and a trigger that reads that log therefore reported itself unfired when it
had already fired — the archived tracker, two git commits, and the retro log's own
scoreboard row all agreed it was closed, but `docs/HISTORY.md` was never updated, and a
two-week clock had been running unnoticed. The lesson: when a document is a trigger's
condition, that document is now a control and needs the same "what asserts this is here?"
question as any gate. <!-- src: docs/retro-log.md#arc-model-policy -->

The third: the same markdown-contract regex class bit from the opposite direction of an
earlier bug — this time an inline `## OUTCOME` mentioned in prose was read by an
unanchored regex as a real section, so `council-lint` failed a *correct* session for
documenting the contract it enforces, and `council-calibrate` carried the identical regex,
surviving only by reading the last section. The fix recorded: a section regex anchors to
line start from the start, and the breaking-input test is written both ways — a real
heading the regex must catch, and a prose mention it must not. <!-- src: docs/retro-log.md#arc-model-policy -->

`PROGRESS.md`'s own done-log records seven defects an author-written ADR carried that
only a fresh pair of readers caught, including a citation to the wrong spine event kind and
a metric formula naming a field the calibration script does not actually read. <!-- src: initiatives/model-policy/PROGRESS.md#Done-log -->

### How it connects to the rest of arc

`ADR-0069` is written as the document a future engine build inherits rather than
reinvents: its own north-star line says the engine kickoff should need zero new "which
model where" forks, because it copies its tier definitions and seat map, its
prohibitions, and its receipt schema straight from this ADR. <!-- src: docs/adr/0069-balanced-model-policy.md#Brier -->

That inheritance already happened once, from the other side: a later `engine` lane's
`ADR-0212` amends ADR-0069's blocks (a) and (b) directly, to say that an agent runtime —
an external autonomous agent system invoked as an engine driver — occupies the model seat
itself rather than naming one specific model. <!-- src: docs/adr/0212-exe-e-an-agent-runtime-occupies-the-model-seat-amending-adr-0069.md -->

Inside arc's own daily operation, `CLAUDE.md`'s Code standards section carries a line
citing `ADR-0069` by name and stating the rule every session is bound by: a `model:` edit
in an agent's frontmatter is a production tier change, and it needs a reviewed diff citing
that ADR, never a quiet edit. <!-- src: CLAUDE.md#quiet -->

The lane also changed two existing surfaces: it added the council `standard` mode to
`.claude/commands/arc-council.md` (REQ-02) and the reject-log line to
`.claude/commands/arc-kickoff.md` (REQ-05). <!-- src: .claude/commands/arc-council.md#ADR-0065; .claude/commands/arc-kickoff.md#non-actionable -->

## Glossary

- **tier** — A description of the work, defined independent of any vendor — never a
  vendor's product name. `cheap-scan`, `balanced-workhorse`, `high-judgment`,
  `independent-family-verifier`. <!-- src: docs/adr/0069-balanced-model-policy.md -->
- **seat** — One named agent, e.g. `ui-composer` or `code-reviewer` — the thing a tier is
  assigned to. <!-- src: docs/adr/0069-balanced-model-policy.md#never-do -->
- **implementation v1** — The label on the current claude-model mapping (haiku / sonnet /
  opus), marking it as swappable rather than the definition of the tiers. <!-- src: docs/adr/0069-balanced-model-policy.md -->
- **MP-A..F** — The six decision ADRs (0063–0068) behind the policy, each argued once and
  cited rather than restated. <!-- src: docs/adr/0069-balanced-model-policy.md -->
- **never-do list** — Block (b) of ADR-0069: no auto-switching, no LLM-judge as sole
  metric, no silent tier changes, same-model consensus is not independent truth, absent
  data is never estimated. <!-- src: docs/adr/0069-balanced-model-policy.md#never-do -->
- **MP-F fingerprint** — The fixed field list any model comparison must record, with an
  unavailable field left absent rather than estimated. <!-- src: docs/adr/0068-mp-f-model-fingerprint-forward-only-never-estimated.md -->
- **engine trigger** — The two named conditions (public-release prep begins, or a
  provider event) that would start a future engine cycle; on monthly AI spend, no
  threshold is set. <!-- src: docs/adr/0069-balanced-model-policy.md#Brier -->
- **`standard` mode** — The fixed-envelope middle option for `/arc-council`: at most 2
  researchers, 3 stances, 1 verifier, at most 6 seats and 7 calls. <!-- src: .claude/commands/arc-council.md -->
- **calibration scoreboard** — `council-calibrate.mjs`'s HIT/MISS/UNRESOLVED tally of past
  council predictions against what actually happened. <!-- src: .claude/scripts/council/council-calibrate.mjs -->
- **reject-log** — The one `REJECTED: <finding> — <reason>` line `/arc-kickoff` now writes
  per declined attacker finding, reason drawn from a fixed six-word list. <!-- src: .claude/commands/arc-kickoff.md#non-actionable -->
- **paired A/B** — Two runs of one brief at one commit, differing in exactly one variable,
  ranked blind before either arm's identity is revealed. <!-- src: initiatives/model-policy/phases/phase-02-spec.md -->
- **exploratory-trial freedom** — Trying any model on an isolated, receipted branch needs
  no policy amendment; only a production tier change does. <!-- src: docs/adr/0069-balanced-model-policy.md#Exploratory-trial -->
