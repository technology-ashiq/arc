# Phase 08 — The feedback half: does the harness actually make things better?

**Goal (one line):** the record built in Phase 04 turns into an answer — six computed outcome
metrics, a calibration record spanning every phase, tags the Context Pack can match on, and
suggestions that arrive with a default so declining costs one word.
**Appetite:** 1.5 days
**Depends on:** phase-00, phase-04, phase-05

Serves **REQ-10**.

## Why this phase exists at all

The design source's §12 says it plainly: *"if a gate adds time without reducing escaped misses or
rework, it is removed or downgraded — data decides, not vibes."* Every phase before this one builds
machinery. **This is the phase that lets the machinery be judged**, and without it the Feature
Admission Rule has nothing to admit features against.

It was very nearly not built. The first draft of this cycle claimed to finish the design source
while these four items had no REQ and no phase — Phase 04 deferred them here, this phase deferred
them back. An attack pass caught it; the appetite was raised from 5 days to 7 to fund it.

## What this phase actually builds

### 1. Six outcome metrics, computed or absent

`develop-lint --metrics` derives all six from committed records — never from memory, never estimated:

| metric | derived from |
|---|---|
| escaped spec misses | `spec-fidelity` reports in evidence packs: findings raised after a phase closed |
| rework / stuck time | `slice.stuck` receipts on the spine, grouped by slice and backstop |
| time to first proven slice | `develop.started` → first `slice.done`, per phase |
| false-block rate | trial-ledger rows recording a gate firing on work that was actually fine |
| evidence completeness | slices carrying `proof:` + `tier:` + `commit:` ÷ total ticked slices |
| ceremony cost per validated slice | checkpoints + sketches + agent invocations ÷ proven slices |

**A metric it cannot derive is printed as `not derivable` with the reason, never as an estimate.**
A number nobody recomputes is a number that starts lying, and a plausible figure in a metrics report
is worse than a blank because it invites decisions.

### 2. The calibration record

Every prediction already scored at every handoff, aggregated across all phases to date — hit /
miss / unforeseen, per prediction field, with the trend visible. Cycle 5 alone produced 9 hit,
5 miss, 1 unforeseen across three phases, and the two riskiest-file misses both named the gate
rather than the parser underneath it. **That is what this record is for:** not a score, a pattern in
where judgement is reliably wrong.

Read-only and derived. It computes from ledgers that already exist; it stores nothing new.

### 3. Tags

Learning rows gain `tag:` from a closed vocabulary — `pattern` · `anti-pattern` ·
`library-verdict` · `fix-recipe` · `common-mistake`. Closed on purpose: the Context Pack matches on
it, and a free-text tag cannot be matched. `develop-lint` FAILs a tag outside the set; Phase 05's
retrieval gains tag matching alongside `area:`.

### 4. The suggestion engine

The Developer advises like a senior, and **suggestions batch at slice boundaries only** — never
mid-slice, because an interruption during implementation is a cost paid on every slice for a benefit
that lands on few.

Each suggestion carries: the evidence behind it · the same economics fields as approach sketches
(qualitative, plus computed counts, no invented durations) · **and a default, so "skip" costs one
word**. The standing questions it keeps asking: *is there an easier solution · is this
over-engineered · can this be deleted · can this reuse existing code · will this survive?*

**A suggestion is never coded ad-hoc.** It routes through a spec note, `/arc-change` or an ADR —
the existing change discipline, applied to the harness's own ideas. That is the same rule the owner
is bound by, and it exists because a good idea acted on immediately is how scope escapes.

## Exit criteria (Definition of Done)

- [ ] all 6 metrics compute from committed records on a fixture repo with known values, and each
      asserted against a hand-derived expected number
- [ ] a metric that cannot be derived prints `not derivable` **with its reason** — asserted by a
      fixture missing the records it needs; it must never print a figure there
- [ ] the calibration record aggregates every scored prediction across every phase in the fixture,
      and its totals match a hand count
- [ ] `develop-lint` FAILs a `tag:` outside the closed vocabulary and passes each of the five
- [ ] Phase 05's Context Pack matches learning rows on `tag:` as well as `area:` — asserted
- [ ] a suggestion carries evidence, economics and a default; one with an invented duration is
      lint-rejected; one raised mid-slice rather than at a boundary is rejected
- [ ] every new check has a negative control proving it can fail
- [ ] **the adversarial pass on this phase's lint additions is run by a fresh agent that has not
      seen the code, in the same commit that ships them** — not at phase close, which is where it
      got skipped on three gates in one phase on 2026-08-02
- [ ] tests green on all 3 CI legs · `tree-manifest.txt` regenerated · `products/develop/manifest.json`
      updated if any file is added · tracker updated

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts: bats over the metrics
deriver against a committed fixture repo whose spine receipts, ledgers and evidence packs are
hand-built so every one of the six metrics has a known correct answer — plus the negative case where
required records are absent and the output must say so rather than produce a number.

## Rabbit holes in this phase

- **A dashboard.** Six numbers and a calibration table, printed. Nothing renders.
- **A composite health score.** Six metrics that disagree are six pieces of information; averaged
  into one they are none. This is the invented-number trap wearing a summary's clothes.
- **Estimating a metric that will not derive.** `not derivable` is the honest output and the more
  useful one — it names a record that is missing, which is itself the finding.
- **A suggestion queue.** Suggestions are raised at a boundary and routed or dropped there. Anything
  kept is a debt-ledger row, which already exists.

## Out of scope for this phase

- Design-critic checkpoints — the cycle's one carve-out from the design source, because there is no
  UI REQ here to exercise them against. Debt-ledger row with a real trigger.
- Acting on any suggestion. This phase makes them arrive well-formed; the change discipline decides
  what happens next.
- Time-forward holdout measurement, which needs cycles after a promotion to exist.

## Your-setup / pending

Nothing. Everything is derived from records already committed by earlier phases.

**Tripwire:** at 1.2 days — 0.3d before the 1.5d appetite is spent — ship the six metrics and the
calibration record, and cut the suggestion engine to a debt row. The metrics are what let every
other gate be judged; the suggestion engine is the only part whose absence costs nothing measurable.

## Non-negotiables (verbatim from PLAN)

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion — this cycle builds the promotion machinery and is bound by it.
- Nothing is installed from the internet without a pinned version, a hash, recorded provenance and a content scan; a write-capable capability additionally needs Ashiq's recorded OK.
- A learning candidate is never graded by the context that authored it.
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in any ledger row is a lint finding.
- Any gate, lint or parser this cycle ships gets an adversarial construct-a-breaking-input pass run by a FRESH agent that has not seen the implementation, with every hole pinned as a fixture.
- Every retrieval states which source it actually used, including when it fell back to grep.
