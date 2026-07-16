# Phase 01 — Real providers + protocol integration + fabrication probe

**Goal (one line):** The juror works against ≥2 real OpenAI-compatible providers with only env changes, is wired into the deep-run protocol, and provably catches the P2 fabrication attack.
**Appetite:** 1.5 days
**Depends on:** phase-00

## Exit criteria (Definition of Done)
- [ ] Real impl in `council-juror.mjs`: `fetch` to `JUROR_BASE_URL` chat-completions with `JUROR_MODEL`/`JUROR_API_KEY` (the ADR-0015 provider-agnostic protocol); retry + timeout; failure taxonomy names timeout/auth/rate-limit/parse distinctly (REQ-03)
- [ ] ≥2 real providers produce valid artifacts changing ONLY env (whichever two keys exist: OpenAI / Gemini-compat / DeepSeek / Groq / xAI / OpenRouter)
- [ ] `arc-council.md`: juror step after 5b (script-invoked on the rebuttal set + first-pass anchors, ADR-0017), writing `--out` to a path derived from the session slug + UTC run-id (e.g. `docs/council/sessions/.juror/<slug>-<utc-run-id>.md`) so concurrent/retried runs never overwrite or replay another run's artifact + step-7 `Juror:` line + `## JUROR RATINGS` + `Juror-Artifact-SHA256:` binding line (REQ-05); juror-vs-verifier disagreements surfaced under `## UNRESOLVED` (ADR-0018); env vars documented in the command + `docs/council/README.md` (never `.env.example` on-branch)
- [ ] Live dogfood on the v2 dogfood rebuttal artifacts with a real provider: script-written artifact, verdict passes lint (REQ-04)
- [ ] Fabrication probe (REQ-05): the P2 attack fixture (fabricated first-pass contest) + juror configured → exit 1; honest twin → exit 0
- [ ] Adversarial breaking-input pass on the full juror surface; key-leak grep clean; tracker updated

## Verification plan

Coarse at kickoff — refine via `/arc-change` when the phase starts. Must show: two real-provider
artifacts (env-only diff) · dogfood verdict green · fabrication probe red/green pair · failure
taxonomy demo (bad key → named auth failure, not a stack trace).

## Rabbit holes in this phase
- One strict output-format prompt; at most ONE revision if a dogfood call is unparseable.
- No provider benchmarking — two working providers is the bar, not a league table.

## Out of scope for this phase
- Signing/checksums (ADR-0018 revisit) · widening juror scope (ADR-0017 revisit) · quick-mode juror.

## Your-setup / pending
- ≥2 API keys for OpenAI-compatible providers (free tiers fine — e.g. Groq / Gemini / OpenRouter / DeepSeek), supplied as env vars at dogfood time. **Ashiq provides; never committed.**

## Non-negotiables (verbatim from PLAN)

- Council-files-only (as v2): changes touch `.claude/commands/arc-council.md`, `.claude/scripts/council-*.mjs`, `docs/council/**`, and new council-scoped files; `.env.example` and every other root file stay untouched on this branch.
- Secrets: `JUROR_API_KEY` is read from env only — never committed, never echoed into artifacts, run-records, fixtures, or logs (pre-mortem row 4 carries the grep check).
- Offline-first: the fake impl + its contract test are green (Phase 0) before any real provider call exists (Phase 1); an unconfigured deep run always completes with a named `Juror: unavailable` line (ADR-0016).
- The juror never modifies ratings — it is an append-only independent grader; disagreement is surfaced under `## UNRESOLVED`, and agreement is never required (ADR-0018).
- Required-when-configured is mechanical: a configured juror that failed is a named lint failure, never a silent skip (ADR-0016).
- Every new lint check ships red-fixture-first AND gets an adversarial breaking-input pass before its phase closes (v2 retro F1 — mandatory verification, not optional review).
