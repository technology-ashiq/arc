# Phase 03 — Eval harness

**Goal (one line):** The honesty machinery is probed and graded: seeded lies get caught in both research modes, framing doesn't flip decisions, and the session store provably stays clean.
**Appetite:** 2 days
**Depends on:** phase-00, phase-02

## Exit criteria (Definition of Done)
- [ ] Eval assets under `docs/council/kickoff-v2/eval/` (ADR-0011, repo-only — sync never ships `docs/council/`): 3 planted-error fixture briefs (each seed labeled as seeded inside the file), 2 framing flip-rate question pairs, a zero-dep grading script, and a runbook that explicitly forbids deep-mode probes
- [ ] Drift guard: fixtures regenerated from phase-2 dogfood artifacts and schema-validated with `council-lint.mjs` before any grading (PLAN pre-mortem row 5 / ADR-0011 consequence)
- [ ] Planted-error probes: verifier-only calls, BOTH research modes (live + model-knowledge), seeded fact flagged 6/6; the grading script exits 1 naming any miss
- [ ] Flip-rate probes: 2 question pairs in `quick` mode; DECISION match asserted per pair by the grading script
- [ ] Isolation proof: after the full probe run, `git status` shows `docs/council/sessions/` untouched
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse at kickoff — refine via `/arc-change` when the phase starts. The runbook executed
end-to-end once: grading script exit 0 with 6/6 planted-error catches + 2/2 DECISION matches,
fixture schema-validation transcript included, and `git status` proof that the session store is
untouched — all pasted into the PROGRESS done-log.

## Rabbit holes in this phase
- Probe-set growth → hard cap per PLAN (3 planted-error + 2 flip-rate pairs); more probes = next cycle.
- Grading script stays zero-dep node — no test-framework dependency sneaks in.

## Out of scope for this phase
- CI wiring and a bats runner for council-lint fixtures (both No-gos this cycle).

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
