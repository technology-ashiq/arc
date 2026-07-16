# Phase 00 — Steel thread: tightened verdict gates

**Goal (one line):** The three new `--verdict` checks ship red-first end-to-end — fixtures fail, checks land, fixtures pass — and session 001 is corrected per ADR-0010.
**Appetite:** 2 days
**Depends on:** none

## Exit criteria (Definition of Done)
- [ ] Three new `--verdict` checks live in `council-lint.mjs`: decision-core (`DECISION:` + `CONFIDENCE:` + DISSENT section with ≥1 cited ID, with the WAIT-zero-Supported/Plausible exemption), model-knowledge confidence cap (offline + `CONFIDENCE: High` fails), UNRESOLVED rules (rebuttal-set IDs per ADR-0008; present-but-empty fails; absent passes) with the [Pn] citation check scoped to KEY REASONS + DISSENT
- [ ] Red + good fixtures under `docs/council/kickoff-v2/fixtures/phase-00/`, authored to the schema block below: `bad-nodecision.md` · `bad-noconfidence.md` · `bad-nodissent.md` · `bad-mk-high.md` · `bad-unresolved-empty.md` · `bad-weak-in-reasons.md` (regression re-pin of the v1 rule) · `good-full.md` (baseline) · `good-wait-allweak.md` · `good-mk-medium.md` · `good-unresolved.md` (rebuttal-set fixture: ≥1 ID from a `Contested` rating AND ≥1 ID sourced from a `## DISPUTED` bullet, per the PLAN parse rule). Every `bad-*` exits 1 naming its check, every `good-*` exits 0 — and every `good-*` must ALSO satisfy the pre-existing no-rubber-stamp gate (≥1 ID rated Weak OR Contested; Weak counts, so `good-wait-allweak.md`'s all-Weak set passes it; give `good-full.md` and `good-mk-medium.md` ≥1 Weak rating each)
- [ ] Session 001 corrected per ADR-0010, three edits in one dated commit: (a) `CONFIDENCE: High` → `CONFIDENCE: Medium`; (b) the v1 contract line `PREDICTION: … → RESULT: CONDITIONAL / High` → `… / Medium`, and the "raised confidence" prose reworded to match (NOTE: this v1 PREDICTION-vs-RESULT line is unrelated to phase-1's `## OUTCOME` / `RESULT: HIT|MISS|UNRESOLVED` grammar — phase-1 stays out of scope here); (c) a dated correction note appended citing ADR-0010
- [ ] Stale-quote grep clean over the shipped council surface only — `docs/council/README.md`, `docs/council/references/`, `docs/council/sessions/` — kickoff trackers (`kickoff/`, `kickoff-v2/`) are historical records and exempt (REQ-02)
- [ ] `arc-council.md` step-7 template gains `## UNRESOLVED` (renders the rebuttal set per ADR-0008)
- [ ] No regression: v1 `--brief` mode, static mode, and every v1 fixture behave exactly as before
- [ ] tracker updated (PROGRESS.md row ✅ + done-log; `/arc-phase-done 0` flips REQ-01/02/03 to validated)

## Verification plan

- **Test command:** `node .claude/scripts/council-lint.mjs --verdict docs/council/kickoff-v2/fixtures/phase-00/bad-nodecision.md`
- **Expected failure first:** run BEFORE the phase is built, this exits 0 — the shipped lint has no decision-core check, so the fixture sweep's expected-exit-1 assertion fails RED. After the phase it exits 1 naming the decision-core check. Same red-first pattern for `bad-mk-high.md` (model-knowledge cap) and `bad-unresolved-empty.md` (UNRESOLVED rules).
- **Live demo scenario:** `node .claude/scripts/council-lint.mjs --verdict docs/council/sessions/001-ai-writing-assistant-trains-on-user-docs.md` → exit 0 after the ADR-0010 correction; the pre-correction version (via `git show`) → exit 1 naming the model-knowledge cap.
- **Real-system check:** git log shows one dated ADR-0010 correction commit whose diff touches only session 001 (fixtures/lint/template edits land in their own separate commits); `--brief` and static modes rerun green on v1 fixtures.
- **Expected evidence:** full phase-00 fixture-sweep transcript (named check per bad fixture, exit 0 per good fixture) pasted into the PROGRESS done-log.

## Verdict document schema (fixture + template ground truth)

The v1 shape (from `arc-council.md` step 7) with the v2 additions marked. Fixtures are authored to
exactly this; the three new checks parse exactly this. `Review-by:`/`Resolution:`/`## OUTCOME`
(phase-1) and `## REBUTTAL LOG` (phase-2) are ABSENT from phase-0 fixtures.

```
# arc-council — <question> (<date>)            ← title line; free preamble lines allowed

## VERIFIER RATINGS
- A1: Supported — <one line>                   ← `<ID>: <Supported|Plausible|Weak|Contested> — …`
- S2: Contested — <one line>

## DISPUTED                                    ← optional verifier section; bullets are free prose,
- N2 vs RK1: <one line>                          IDs parsed as [A-Z]{1,2}\d+ tokens (PLAN parse rule)

## UNRESOLVED                                  ← NEW (REQ-03): rebuttal-set IDs, ≥1 bullet when present
- S2 vs A4: <one line — genuine unresolved uncertainty>

## VERDICT
PREDICTION: <pred / conf> → RESULT: <decision / conf>   ← v1 fairness line (regex `^PREDICTION:`)
DECISION: YES | NO | CONDITIONAL | WAIT                 ← NEW check: line must exist (REQ-01)
CONFIDENCE: High | Medium | Low                         ← NEW check: line must exist (REQ-01);
Research mode: live | model-knowledge                     model-knowledge caps it at Medium (REQ-02)
Roster: <members>

KEY REASONS:                                   ← [Pn] cites allowed ONLY here and in DISSENT (REQ-03)
- [A1] <reason>

DISSENT (strongest surviving opposing point):  ← NEW check: block must exist with ≥1 [Pn] bullet
- [S1] <the best case against>                   (REQ-01; exempt when zero Supported/Plausible
                                                  ratings exist and DECISION is WAIT)
CHEAPEST TEST TO DE-RISK:
- <smallest fastest test>
```

## Rabbit holes in this phase
- No refactor of v1 lint internals — add checks, never restructure the shipped parsing.
- `## UNRESOLVED` is display-only — no new rating vocabulary beyond Supported/Plausible/Weak/Contested.

## Out of scope for this phase
- REBUTTAL LOG parsing + the first-pass no-rubber-stamp path → phase-2.
- `Review-by:` / `Resolution:` / `## OUTCOME` → phase-1.

## Your-setup / pending
None — zero-dep node + repo files only.

## Non-negotiables (verbatim from PLAN)

- Member independence holds through rebuttal — a rebutting member sees ONLY the single opposing point it answers, never sibling outputs; failed members retried blind (fairness.md invariant 1).
- Rebuttal is bounded: ONE round, rebuttal-set IDs only — the rebuttal set = IDs rated Contested plus IDs listed under the verifier's DISPUTED section — and the verifier re-grades only those IDs (ADR-0008).
- First-pass contest evidence is never erased — when a rebuttal ran, `## REBUTTAL LOG` records every pre→post rating with a one-line reason; no rebuttal ran → no REBUTTAL LOG section (ADR-0008).
- Past verdicts are append-only — review appends `## OUTCOME`; nothing rewrites DECISION, CONFIDENCE, or ratings. Sole sanctioned exception: the one dated ADR-0010 correction to session 001.
- No fabrication extends to eval assets — seeded errors are labeled as seeded inside eval files, probes run only in non-saving modes (quick + verifier-only, never a deep run), and OUTCOME entries record what actually happened (ADR-0011).
- Quick-mode output stays exempt from every `--verdict`/`--brief` check — quick writes no file and carries no POINT-IDs, VERIFIER RATINGS, or Research-mode line; no council-lint invocation targets a quick transcript.
- Council-files-only — changes touch `.claude/commands/arc-council.md`, `.claude/agents/council-*.md`, `.claude/scripts/council-*.mjs`, `docs/council/**`, and new council-scoped files; arc's root tracker and every non-council file stay untouched.
