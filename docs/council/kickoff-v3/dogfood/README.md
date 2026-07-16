# v3 juror dogfood — live cross-model evidence (REQ-03/04)

Real external models, run 2026-07-16 from keys in `.env.local` (never printed, never committed;
key-in-artifact grep = clean on every run).

## REQ-03 — provider-agnostic, env-only switch
The SAME `council-juror.mjs` produced valid, SHA-bound artifacts from TWO different real providers,
changing only `JUROR_BASE_URL`/`JUROR_MODEL`/`JUROR_API_KEY`:
- **Google Gemini** (`generativelanguage.googleapis.com`, `gemini-2.5-flash-lite`) → S2 Supported, A4 Plausible
- **OpenRouter** (`openrouter.ai`, `google/gemma-4-26b-a4b-it:free`) → S2 Supported, A4 Plausible

The failure taxonomy was exercised live too: Gemini `[rate-limit]` (HTTP 429, retried 3×) before the
window cleared; OpenRouter `[http]` 404 on a bad slug and `[rate-limit]` on upstream-throttled free
models — each named distinctly, never a stack trace, always a clean exit code.

## REQ-04 — live deep-run juror on the v2 dogfood
`juror-points.md` is the anchor set from the v2 four-hop dogfood (first-pass Weak/Contested + rebuttal
ids: A1, A4, S4). A live Gemini juror independently re-graded them → `juror-artifact.md` (script-written,
`Juror-Artifact-SHA256: d9247da5…`). The juror **independently corroborated all three anchor grades**
(A1/S4 Plausible, A4 Weak) — a genuine second model family reaching the same read, so no juror-verifier
disagreement to surface. `verdict.md` folds the juror section + `Juror:` + SHA line into the v2 verdict.

## The proof
```
node .claude/scripts/council-lint.mjs --verdict docs/council/kickoff-v3/dogfood/verdict.md \
  --juror-artifact docs/council/kickoff-v3/dogfood/juror-artifact.md      # → all checks passed ✔
```
And the binding bites: flipping one displayed rating (`A4: Weak → Plausible`) in the verdict makes the
same command exit 1 — *"the displayed rating was doctored (REQ-05)"*. The council's fabrication surface
is now anchored to what a DIFFERENT model actually said.
