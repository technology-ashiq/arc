# Phase 03 — Controlled escalation: the build stops grinding on its own

**Goal (one line):** when a slice is going wrong, a deterministic trigger — not the model's own
judgement about whether it is stuck — forces root-cause mode, a checkpoint, or an escalation to Ashiq.
**Appetite:** 0.5 days
**Depends on:** phase-00, phase-01

Serves **REQ-10** (deterministic escalation backstops).

**This phase is the pre-decided scope cut.** If the 50% tripwire fires at 2.5 days with Phase 01 not
done, this phase goes in full and the cycle closes at Phase 02. Its own items are ordered by
droppability below, so a partial cut is also possible without a conversation.

## What this phase actually builds, in drop order (last item drops first)

1. **Stuck backstops** — `.claude/scripts/develop/stuck-counter.sh` keyed by lane and slice in
   `.claude/state/develop/`. Tracks a normalised error fingerprint and the attempted hypothesis.
   Same fingerprint 3× → forced root-cause mode (`log-analyzer`: read the real error, build a minimal
   repro, then fix). 5 attempts on one slice → escalate to Ashiq with a one-screen diagnosis: tried ·
   current hypothesis · options. Every stuck event emits a `slice.stuck` receipt. Hypothesis novelty
   is claimable by a model, which is exactly why the count is the floor.
2. **Inline risk-triggered checkpoints** (ADR-0103) — `checkpoint` stops being Phase 00's stub. The
   trigger is path-matched by script, never self-assessed: the glob set is
   `.claude/rules/security-sensitive.md`'s paths, plus migrations, auth and public-API surface files.
   Ceiling backstop: 5 slices since the last checkpoint forces one (M tier); always before handoff.
   Checks are the half that needs no code understanding: which risk globs the diff touched, and the
   marker scan. The public-API surface diff is a PLAN no-go this cycle — it needs the same machinery
   as the complexity checks and does not fit 0.5 days beside the three backstops here.
3. **Debt-ledger marker lint** — `initiatives/<lane>/debt-ledger.md` (root-mode:
   `docs/develop/debt-ledger.md`), one row per deliberate compromise: what · where · why accepted ·
   cost of leaving it · pay-down trigger. `develop-lint` greps the slice diff for
   `TODO/FIXME/HACK/XXX`; a new marker with no ledger row is a WARN naming the file. WARN-first, no
   trial promotion this cycle.

If the risk-glob rules file does not already list the paths this needs, the glob set is declared
inline in the checkpoint script and the rules file is left alone — this phase does not have the
budget to refactor a shared rules file.

## Exit criteria (Definition of Done)

- [ ] the 4 backstops fire on fixtures: fingerprint 3× · 5 attempts · risk-glob diff · unregistered
      marker
- [ ] each backstop has a negative control — a fixture where it must *not* fire
- [ ] `slice.stuck` receipts land on the spine
- [ ] `checkpoint` runs inline from `next` and states plainly which trigger tripped
- [ ] tests added & green on all 3 CI legs
- [ ] `tree-manifest.txt` regenerated as a named step, and `ci.yml`'s test-count floor raised — this
      phase ships product files under time pressure, which is exactly where retro-log 2026-07-22's
      "surprise mid-task golden failure" lands
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts: bats driving the stuck
counter through a scripted failure sequence with the counter state asserted at each step, plus
fixture diffs that do and do not touch the risk globs.

## Rabbit holes in this phase

- **Making the fingerprint clever.** Normalise paths, line numbers and hex addresses out; stop there.
  A fingerprint that is too specific never repeats and the backstop never fires.
- **Refactoring `security-sensitive.md`** into a shared glob library. Out of budget — declare inline.
- **Complexity and circular-dependency checks.** PLAN `## No-gos`: they need madge or
  dependency-cruiser and only mean something on a JS/TS target.
- **Letting the model decide it is not stuck.** The counter is the floor precisely because the
  judgement is not trustworthy under pressure.

## Out of scope for this phase

- Approach sketches with economics fields, capability scouting, pattern mining, the Learning System —
  all in PLAN `## No-gos`.
- Promoting the marker WARN to BLOCK.

## Your-setup / pending

Nothing.

**Tripwire:** this phase IS the cycle's tripwire target. If it starts with less than 0.5 days of
appetite left, ship item 1 only and record items 2 and 3 as debt in the lane's debt ledger.

## Non-negotiables (verbatim from PLAN)

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever (ADR-0105).
- develop never closes a phase, never intakes scope and never creates a lane — `/arc-phase-done`, `/arc-change` and `/arc-kickoff` keep those jobs.
- Every slice declares its acceptance proof BEFORE implementation; `proof: none` is not a slice (ADR-0100).
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in a ledger row is a lint finding (ADR-0101).
- Any gate, lint or parser this build ships gets an adversarial construct-a-breaking-input pass in the same section that ships it, with every hole pinned as a fixture.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion.
- The whole lifecycle runs offline on a committed fixture; `--lane` is the only lane input and root-mode output stays byte-identical (ADR-0104).
