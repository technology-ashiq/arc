# Phase 03 — Dogfood and seal: used for real, and a 4th driver timed

**Goal (one line):** the engine stops being a fixture exercise — `commit-msg-draft` runs on a
non-Claude driver on real work at least three times with receipts that are confirmed to have
landed, a fourth driver is stubbed against a clock to test the north-star, and the cycle's gates are
reviewed for promotion.

**Appetite:** 2 days
**Depends on:** phase-02

Serves **REQ-08** (a new driver is a shim file, and the engine has been used for real).

## Why this phase exists at all

Everything before it is proven against fixtures the same session wrote. That is the shape retro-log
2026-08-02 records twice: a harness green on its own fixtures while real holes sit in it, and a
control that was never asserted to exist. Phase 02 can be entirely green and the engine still be
unusable on real work — this phase is the only place that claim gets tested.

## The three things it does

1. **Real runs.** `commit-msg-draft` drafts commit messages for actual work in this repo, via
   `arc-run`, on a driver that is not `claude-code`, **at least 3 times**. Each run's
   `run.completed` receipt is confirmed present in `.claude/state/hq/events/` and absent from
   `_quarantine/` — looked at, not inferred from exit 0.
2. **The north-star timing.** A fourth driver is stubbed from nothing to its first passing contract
   fixture, **timed with a clock**, target under 60 minutes. This is a measurement of the ADR-0203
   interface, not a product: the stub is not promoted and does not ship. If it takes longer, the
   interface leaked engine concerns and that is the finding — recorded, not rounded down.
3. **Promotion review.** Every gate this cycle shipped is reviewed against `docs/trial-ledger.md`'s
   two criteria (fixture-proven, plus ≥3 clean dogfood runs with zero false positives). Gates that
   qualify are proposed as a diff; gates that do not stay WARN. `/arc-retro` proposes, a human
   approves — this phase never promotes a gate on its own judgement.

## What "real work" means, and what would make it a lie

A real run uses a diff this repo actually produced, not a fixture diff. A run that is set up to
succeed is a fourth fixture wearing a costume. If all three real runs are trivially easy, say so in
the evidence rather than reporting three successes — retro-log 2026-07-28 records an instrument
anomaly being explained away with a plausible story twice in one phase, and the honest version of
this phase is the one that reports a weak result as weak.

## Exit criteria (Definition of Done)

- [ ] ≥3 real `arc-run` invocations of `commit-msg-draft` on a non-`claude-code` driver, each with
      its `run.completed` receipt confirmed in `events/` and confirmed absent from `_quarantine/`
- [ ] each of the 3 real runs is rated in the evidence pack **trivial / typical / hard**, with a
      one-line reason — a run recorded only as pass/fail is the shape retro-log 2026-07-28 names,
      where an anomaly gets a plausible story instead of a test. Three trivial runs is a reportable
      result, not a passing one
- [ ] the 4th-driver stub reached its first passing contract fixture, with the elapsed time recorded
      as measured — under 60 minutes, or the overrun recorded as an A-07 finding with what leaked.
      **If the pre-decided cut dropped this run, REQ-08 closes `partial: timing untested`** — the
      phase still closes on its real runs, because a REQ whose single acceptance clause bundles the
      cuttable with the non-cuttable becomes unsatisfiable the moment its own escape valve is used
- [ ] the 4th-driver stub is **not** shipped: it is removed or quarantined before close
- [ ] every gate shipped this cycle is reviewed against the trial-ledger criteria, and each is
      either proposed for promotion as a diff or explicitly left WARN with the reason
- [ ] `/arc-retro` run for the cycle; recurring corrections appended to `docs/retro-log.md`
- [ ] assumption A-01 is closed: the ADR-0069 block-(d) trigger is named in writing, and if it was
      the second-runtime trigger, its amending ADR has landed
- [ ] `docs/HISTORY.md` records the cycle close (ADR-0071 — a cycle is CLOSED when HISTORY says so)
- [ ] tracker updated in `initiatives/engine/PROGRESS.md`, `board-lint.sh` re-run

## Verification plan

Coarse at kickoff, refined when the phase starts (via `/arc-change`): the evidence is the spine
itself — the three receipts read back out of the day files rather than asserted — plus the timed
stub's clock record and the trial-ledger rows the promotion review produces.

## Rabbit holes in this phase

- **Making the 4th driver good.** It is a stopwatch, not a product. The moment it becomes useful it
  stops measuring the interface and starts measuring enthusiasm.
- **Promoting gates because the cycle went well.** The trial-ledger criteria are the criteria. A
  gate with two clean runs stays WARN.
- **Rescuing a weak dogfood result.** Three easy runs reported as three successes is the failure
  this phase exists to avoid.

## Out of scope for this phase

- Any new capability. This phase ships no feature.
- Computing ADR-0069's metrics, a bench runner, a fourth production driver, canonicalizing further
  commands — all in the PLAN's `## No-gos`.

## Your-setup / pending

The same optional endpoint and CLI as Phase 02. At least one non-`claude-code` driver must be
genuinely runnable for this phase to mean anything; if none is, that is a blocking finding to
report, not a phase to close.

**Tripwire:** at 1.0 day inside this phase, if fewer than 3 real runs have happened, stop adding
polish and get the runs — the promotion review and the timing run are both cuttable, the real runs
are not. Read this line when the phase starts, not after it.

## Non-negotiables (verbatim from PLAN)

- Every gate, lint, parser and driver wrapper this cycle ships gets an adversarial construct-a-breaking-input pass in the same section that ships it, run by a FRESH agent that has not seen the implementation, with every hole pinned as a fixture (retro-log 2026-08-02: the author's own 26 inputs found nothing and an unanchored agent then found 9 real holes).
- No component changes a model tier at run time, anywhere, under any condition — every production tier change is a reviewed `engine/router.yaml` diff citing ADR-0069 block (b)(1); escalation ends in a proposal receipt (ADR-0204).
- The 21 non-pilot commands stay hand-written and untouched this cycle, and no agent file is canonicalized.
- `arc-run` is headless only — it never wraps an interactive session.
- Every run emits `run.completed` with its cost through the standard emitter, and the emit is VERIFIED to have landed in `events/` and not in `_quarantine/` — exit 0 from a fire-and-forget writer is not evidence that anything was written (retro-log 2026-08-02).
- An unavailable cost or fingerprint field stays absent — never estimated, never inferred, never interpolated (ADR-0069 block (b)(5) and block (e)).
- Zero-dep Node plus POSIX is inherited: no LangChain-class dependency, no vendor SDK in any driver, plain HTTP for generic-api.
- Eval fixtures for the 3 pilots exist from Phase 0, and every gate ships with a negative control proving the check can fail (retro-log 2026-08-02).
- Editing any file the sync-golden manifest hashes means a named regeneration step: diff the delta first, confirm only intended paths moved, then re-record (retro-log 2026-07-22).
- The CI test-count floor is raised by re-running the count and asserting it equals the live `@test` total, never by hand-typing a number that four separate phase closes must each remember — a hand-maintained count is what rotted silently for five days in arc-orchestrator (retro-log 2026-07-22).
