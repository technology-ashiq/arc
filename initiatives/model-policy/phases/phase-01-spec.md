# Phase 01 — Council `standard` mode, and the calibration loop unblocked honestly

**Goal (one line):** a verified-but-bounded council run has a fixed price the owner can
predict (`standard`), and the calibration scoreboard starts producing real data without
manufacturing any (session-001 retrofit + an honest grade).
**Appetite:** 0.75 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-00

## Exit criteria (Definition of Done)

**REQ-02 — `standard` mode**

- [ ] `/arc-council standard "<q>"` documented in `.claude/commands/arc-council.md`
- [ ] Envelope enforced as written: **≤2 researchers + 3 stances + 1 verifier — max 6
      seats, ≤7 model calls**; the existing send-back-once-if-nothing-contested guard is
      the only extra call
- [ ] **No** domain experts, **no** juror, **no** rebuttal round
- [ ] Post-verifier `Contested` / `DISPUTED` IDs go straight to `## UNRESOLVED` and are
      never debated
- [ ] **No auto-upgrade:** a run that 2 researchers cannot cover says so and recommends
      `deep`; the human explicitly chooses. It never silently becomes `deep`
- [ ] Run once **for real** on a genuine question; the saved session carries a
      `Mode: standard` line and passes `council-lint --verdict`
- [ ] `deep` remains the default — ADR-0002 untouched, juror contract (ADR-0015..0018)
      untouched, `quick` untouched
- [ ] Any new `council-lint` check ships **WARN-first** with a `docs/trial-ledger.md` row
- [ ] Adversarial breaking-input pass run against any lint check this phase ships, **bound
      to this phase** and not deferred to cycle close (pre-mortem row 5); holes found are
      fixed and pinned as fixtures

**REQ-04 — calibration unblocked**

- [ ] Session 001 retrofitted by **appending** `Review-by:` and `Resolution:` per council-v2
      **ADR-0012** (`docs/council/kickoff-v2/docs/adr/0012-outcome-lives-in-session-files.md`)
      — a session may carry more than one `## OUTCOME`/`Review-by:`, last authoritative.
      Every existing line preserved; nothing rewritten.
      > **Corrected 2026-08-02 (Phase 01).** This spec originally said "in place exactly per
      > council-v2 ADR-0010". ADR-0010 sanctions the `CONFIDENCE` High→Medium cap and **was
      > already executed 2026-07-15**; it never covered `Review-by:`/`Resolution:`. The right
      > authority is ADR-0012 and the act is an **append**, so this is additive and needs no
      > special sanction. The cross-namespace warning still stands: council ADR-0010 ≠ root
      > `docs/adr/0010` (Quality Passport). See ADR-0066's correction block.
- [ ] `council-calibrate --overdue` surfaces session 001 — mechanism proven by its own
      output, not by assertion
- [ ] Honesty fork resolved one way or the other, explicitly:
  - [ ] **if** the Resolution criterion is genuinely observable today → grade the real
        HIT/MISS via `/arc-council review`
  - [ ] **if not** → record `RESULT: UNRESOLVED` with a fresh future `Review-by:` — **this
        is a passing outcome**
- [ ] A forced or vague HIT/MISS fails this REQ (Truth-Law E3). The DoD is the working
      mechanism plus an honest grade, never a filled scoreboard
- [ ] tracker updated (PROGRESS.md row ✅ + done-log) · receipt emitted on the spine

## Verification plan

- **Test command:** `node .claude/scripts/council/council-calibrate.mjs --overdue` (then `node .claude/scripts/council/council-lint.mjs --verdict docs/council/sessions/001-ai-writing-assistant-trains-on-user-docs.md`)
- **Expected failure first:** run `--overdue` **before** the retrofit. Session 001 has no
  `Review-by:` line (verified 2026-08-02), so it cannot be surfaced and the command reports
  nothing overdue — an empty scoreboard is the current, broken, red state. After the
  retrofit appends `Review-by:`, the same command lists session 001. That transition is the
  mechanism proof; a green run that was never red proves only that the script executes.
  Second red→green: `council-lint --verdict` against the new `standard` session must fail
  before the `Mode: standard` line is recognised, then pass.
- **Live demo scenario:** (1) run `/arc-council standard "<a real question the owner
  actually has>"` end to end; count the seats and the model calls in the transcript against
  the envelope — 6 and 7 are ceilings, not targets. (2) Open the saved session file and read
  the `## UNRESOLVED` section: any `Contested`/`DISPUTED` ID must appear there undebated.
  (3) Run `--overdue` and see 001 listed.
- **Real-system check:** the retrofit is a one-way in-place edit to the only historic
  council artifact (ADR-0066). Before editing, `git diff` the file after the change and
  confirm **only** additions — `OUTCOME`, DECISION, CONFIDENCE and every rating byte
  unchanged. An accidental rewrite is not revertible into a clean "never touched" state.
- **Expected evidence:** the pre-retrofit empty `--overdue` output and the post-retrofit
  listing · the `git diff` of session 001 showing additions only · the saved `standard`
  session file with its `Mode: standard` line · seat/call count from the run · the
  adversarial-pass findings for any new lint check · trial-ledger row · spine receipt id.

## Rabbit holes in this phase

- **Grading under scoreboard pressure.** `UNRESOLVED` passes. The temptation is to squint
  at the 2026-07-15 question and declare a HIT so the scoreboard is not empty — that is the
  exact failure ADR-0066 and Truth-Law E3 exist to stop.
- **Markdown-contract parsing (retro 2026-07-16, twice).** The recurring bugs are:
  first-match where a section legitimately repeats (append-only `OUTCOME`/`Review-by`),
  case-insensitive-match-then-exact-compare, and `$` under `/m`. Any new check normalises
  case before compare, takes last-of/all repeated sections, anchors line regexes, and
  validates real calendar dates — not just shape.
- **Cosmetic-variant attacks (retro 2026-07-16).** A `Mode: standard` line a human reads as
  meaningful but an exact-match regex misses. Tolerant **detection**
  (bullet/emphasis/whitespace/heading-level as one) + strict value **grammar** (near-misses
  fail closed), from the start.
- **Letting `standard` grow.** The envelope is fixed (ADR-0065). "Just one more researcher
  for this question" is the mode becoming `deep` with extra steps.

## Out of scope for this phase

The paired composer A/B (Phase 2) · the attacker reject-log (Phase 3) · any change to
`quick` or to `deep`'s panel · promoting any WARN-first check to FAIL (that needs
trial-ledger evidence, per Constitution A1).

## Your-setup / pending

The owner must supply **one real question** for the `standard` run — a genuine decision,
not a test string. A synthetic question would prove the code path and nothing about whether
the envelope covers real use (assumption A-02).

## Non-negotiables (verbatim from PLAN)

- **No engine code.** Nothing under `processes/`, no drivers, no `router.yaml`, no budget enforcement, no bench runner — those plans sleep until their own triggers (A8).
- **No auto model switching anywhere.** Every production tier change is a reviewed diff citing the Balanced Model Policy (ADR-0069; rationale MP-A/ADR-0063); the two MP-A carve-outs are the only exceptions and both are human-approved.
- The session-model pin stays personal (`settings.local.json`) — shared settings never gain a `model` key this cycle.
- Council remains additive-only; council ADR-0002 (deep default) and the council-v3 juror contract (ADR-0015..0018) untouched; `standard` never weakens `deep`.
- REQ-03 verdicts follow ADR-0047/0048/0049: blind ordering + owner's own eyes on the artifact; no absolute scores inside the loop; PREDICTION pre-registered before reveal.
- Fingerprints are forward-only and never estimated (MP-F / ADR-0068).
- Every phase close leaves its receipt on the spine (existing kinds only).
