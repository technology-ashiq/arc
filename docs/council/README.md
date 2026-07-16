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

## Use arc-council in another project
The usual template sync carries the council too — nothing extra to run:

```
bash sync-to-project.sh <target-project-dir>      # or: sync-to-project.ps1 -Target <dir>
```

Council-wise it brings the command + 12 agents + the scripts (with the rest of `.claude/`), these
docs, the `docs/council/sessions/` skeleton, and appends the `JUROR_*` contract to the target's
`.env.example` once. Re-run any time to update — the target's own verdicts
(`docs/council/sessions/**`) are never touched. In the target: juror keys (optional) go in its own
`.env.local`, then **restart the Claude Code session** — commands load at session start.
Everything is project-relative; no path edits needed.

## Cross-model juror (v3)
Deep runs invoke an independent second grader from a DIFFERENT model family on the debate's anchor set
(first-pass Weak/Contested + rebuttal-log ids). `council-juror.mjs` — not the Chair — writes the juror
artifact and prints the `Juror-Artifact-SHA256:` binding the lint verifies with `--juror-artifact`.
Configure ANY OpenAI-compatible provider by env (never committed): `JUROR_BASE_URL` (e.g.
`https://api.groq.com/openai/v1`, `https://generativelanguage.googleapis.com/v1beta/openai`,
`https://openrouter.ai/api/v1`, `https://api.deepseek.com`), `JUROR_MODEL`, `JUROR_API_KEY`
(+ optional `JUROR_TIMEOUT_MS`). Unset ⇒ the verdict says `Juror: unavailable (not configured)` and the
run proceeds (offline-first); configured ⇒ the juror is required (ADR-0016). Free tiers work fine.

Built fresh & arc-native (not the global `~/.claude` council, per ADR-0001). Ships via `sync-to-project`:
the `.claude/` files travel into consumer projects; `docs/council/` stays in this repo, so no sample
verdicts leak. The command is self-contained, so it runs without the reference docs.
