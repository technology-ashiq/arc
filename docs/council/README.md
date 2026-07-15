# arc-council

`/arc-council "<your question>"` convenes a multi-agent advisory council and returns ONE decision with
confidence, preserved dissent, and the cheapest test to de-risk it — on any question (startup, business,
finance, personal, politics, marketing, development, design). Prefix `quick` for a fast, unverified take.

## How a run works
1. **Intake** — the Chair restates the question as one decision statement, disambiguates any load-bearing
   ambiguous term, records a pre-registered PREDICTION, and classifies the domain(s).
2. **Research fan-out** — `council-researcher` workers build ONE neutral, triangulated Evidence Brief (live
   web, or offline `model-knowledge`).
3. **Convene** — 3 stance members (advocate / skeptic / neutral) + the matched domain experts (ceiling 4,
   any dropped are named) debate the brief independently, in one parallel batch.
4. **Cross-examine** — `council-verifier` (opus) grades every point by POINT-ID (Supported / Plausible /
   Weak / Contested) and flags brief-framing bias.
5. **Decide** — the Chair drops Weak/Contested points, weighs the survivors, and renders a verdict whose
   KEY REASONS + DISSENT cite only verifier-Supported/Plausible points, with PREDICTION-vs-RESULT.

## Files
- `.claude/commands/arc-council.md` — the Chair protocol (self-contained source of truth).
- `.claude/agents/council-*.md` — the 12 members (advocate, skeptic, neutral, researcher, verifier + 7 experts).
- `.claude/scripts/council-lint.mjs` — the gate (`--verdict`, `--brief`, static).
- `references/fairness.md` — the fairness & anti-rigging invariants (and what the lint enforces).
- `sessions/` — saved deep-run verdicts (git-tracked here; **excluded** from `sync-to-project`).
- `kickoff/` — the scoped build tracker (PLAN, ADRs, phase specs, retros).

Built fresh & arc-native (not the global `~/.claude` council, per ADR-0001). Ships via `sync-to-project`:
the `.claude/` files travel into consumer projects; `docs/council/` stays in this repo, so no sample
verdicts leak. The command is self-contained, so it runs without the reference docs.
