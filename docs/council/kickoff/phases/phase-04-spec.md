# Phase 04 — Fairness invariants + auto-save + sync wiring

**Goal (one line):** enforce the fairness invariants via `fairness.md` + `council-lint`, auto-save deep
verdicts, wire arc-council into `sync-to-project`, and write the user-facing docs.
**Appetite:** 3 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-02, phase-03

## Exit criteria (Definition of Done)
- [ ] verdict includes a `PREDICTION-vs-RESULT` line (Chair predicts DECISION + confidence BEFORE reading the verifier's output)
- [ ] `fairness.md` checklist exists and is verified by `council-lint`/the verifier, never Chair-self-graded
- [ ] a deep run auto-saves `docs/council/sessions/NNN-<slug>.md` with all 8 verdict sections (ADR-0005); a `quick` run writes 0 files
- [ ] this is the first run that stacks the full ~7–12 agent roster — completes with 0 spawn/concurrency errors
- [ ] `sync-to-project` includes the new files, excludes `docs/council/sessions/*`, and reports 0 modifications to pre-existing files
- [ ] README + CHANGELOG + CLAUDE.md command row added (additive only)
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- Coarse (refined when the phase starts via `/arc-change`): dogfood one full deep run (assert the saved
  session file + PREDICTION-vs-RESULT line + fairness checklist green under `council-lint`) and one `quick`
  run (assert 0 files written); then a `sync-to-project` dry-run asserting 0 pre-existing-file mods and no
  `sessions/*` copied. Evidence = the session file, the lint output, and the dry-run diff in the done-log.

## Rabbit holes in this phase
- Chair self-grading fairness → the checklist is verified by `council-lint`/the verifier, not the Chair.
- Shipping test verdicts → `sessions/*` is sync-excluded so consumer projects stay clean.

## Out of scope for this phase
Outcome-calibration loop (a v2 concern per PLAN No-gos); any UI.

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- **Member independence** — members are spawned in one parallel batch and never see each other's answers; a failed member is retried blind, never primed with siblings' returned answers.
- **No fabrication, neutral brief** — no invented sources or numbers; unverifiable claims are marked low-confidence; the Evidence Brief states facts only, with no language leaning toward any verdict.
- **Mechanically-verified verdict** — every KEY REASON and the DISSENT cite a POINT-ID the verifier rated Supported/Plausible; `council-lint` rejects a verdict that cites an unrated/Weak point or a run whose verifier contested nothing.
- **Commit under uncertainty** — the Chair always returns a concrete DECISION (YES / NO / CONDITIONAL / WAIT), never "it depends"; offline in `model-knowledge` mode a run still returns a verdict, and if every brief fact is low-confidence the honest decision is WAIT with a named de-risk test, not a confident YES/NO from priors.
- **Additive-only** — never modify arc's root tracker or any pre-existing file; only `.claude/commands/`, `.claude/agents/`, and `docs/council/references/` ship in sync; generated `docs/council/sessions/*` are sync-excluded.
- **Fair by construction, not self-report** — fairness invariants are enforced by `council-lint`/the verifier, never self-graded by the Chair that wrote the synthesis; the strongest surviving opposing point is always shown as DISSENT.
