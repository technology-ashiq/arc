# Phase 02 — Bounded rebuttal + verbatim handoff

**Goal (one line):** Rebuttal-set points get exactly one blind-preserving second exchange with a re-grade, and the verifier reads members' and researchers' verbatim files instead of Chair summaries.
**Appetite:** 2.5 days
**Depends on:** phase-00, phase-01

## Exit criteria (Definition of Done)
- [ ] `arc-council.md` gains the rebuttal step: compute the rebuttal set (ADR-0008: Contested-rated ∪ verifier-DISPUTED IDs), one FIXED single-point rebuttal prompt template per paired ID, ONE round, verifier re-grades only those IDs
- [ ] `## REBUTTAL LOG` rendered (pre→post rating + one-line reason per ID); section absent when no rebuttal ran
- [ ] `council-lint.mjs` no-rubber-stamp gains the ADR-0008 first-pass path (REBUTTAL LOG pre-column counts as contest evidence); red + good fixtures under `docs/council/kickoff-v2/fixtures/phase-02/` (incl. the all-resolved-after-rebuttal good fixture and the zero-rebuttal no-log good fixture)
- [ ] Verbatim handoff (REQ-07): every member output AND every researcher FACT PACK written to a file; the verifier Task input carries the paths, not summaries
- [ ] Dogfood: one deep run with ≥1 rebuttal-set ID completes the four-hop chain (members → verifier → rebuttal → re-grade) in-session with 0 spawn/state-loss errors; transcript shows single-point rebuttal prompts only, and ≥1 brief fact spot-checked against its FACT PACK source (F8 both hops)
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse at kickoff — refine via `/arc-change` when the phase starts. One dogfood deep run with ≥1
rebuttal-set ID must show: REBUTTAL LOG present with a reason per ID · final-only VERIFIER RATINGS ·
`--verdict` green via the first-pass rule · four-hop chain clean (0 spawn errors) · verifier input
= file paths for every member + researcher · ≥1 brief fact verified against its FACT PACK.

## Rabbit holes in this phase
- Rebuttal prompt improvisation → the fixed template in the command is the ONLY allowed shape.
- Re-grading beyond the rebuttal set → forbidden; untouched IDs keep their first-pass rating.

## Out of scope for this phase
- Probes + grading script + runbook → phase-3.

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- Member independence holds through rebuttal — a rebutting member sees ONLY the single opposing point it answers, never sibling outputs; failed members retried blind (fairness.md invariant 1).
- Rebuttal is bounded: ONE round, rebuttal-set IDs only — the rebuttal set = IDs rated Contested plus IDs listed under the verifier's DISPUTED section — and the verifier re-grades only those IDs (ADR-0008).
- First-pass contest evidence is never erased — when a rebuttal ran, `## REBUTTAL LOG` records every pre→post rating with a one-line reason; no rebuttal ran → no REBUTTAL LOG section (ADR-0008).
- Past verdicts are append-only — review appends `## OUTCOME`; nothing rewrites DECISION, CONFIDENCE, or ratings. Sole sanctioned exception: the one dated ADR-0010 correction to session 001.
- No fabrication extends to eval assets — seeded errors are labeled as seeded inside eval files, probes run only in non-saving modes (quick + verifier-only, never a deep run), and OUTCOME entries record what actually happened (ADR-0011).
- Quick-mode output stays exempt from every `--verdict`/`--brief` check — quick writes no file and carries no POINT-IDs, VERIFIER RATINGS, or Research-mode line; no council-lint invocation targets a quick transcript.
- Council-files-only — changes touch `.claude/commands/arc-council.md`, `.claude/agents/council-*.md`, `.claude/scripts/council-*.mjs`, `docs/council/**`, and new council-scoped files; arc's root tracker and every non-council file stay untouched.
