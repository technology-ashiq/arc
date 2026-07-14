# Phase 02 — Deep research layer: the neutral Evidence Brief

**Goal (one line):** add `council-researcher` fan-out that builds ONE neutral, triangulated Evidence Brief
the whole council debates from, with a `model-knowledge` offline mode.
**Appetite:** 2 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-01

## Exit criteria (Definition of Done)
- [ ] Chair decomposes the question into 3–5 sub-questions and fans out `council-researcher` workers (cap ~5)
- [ ] the shared Evidence Brief lists ≥3 facts, each with a confidence label + ≥2 independent sources or a low-confidence mark (ADR-0003)
- [ ] the brief states facts only — no verdict-leaning language (neutral-brief non-negotiable)
- [ ] offline `model-knowledge` mode still yields a full verdict, brief marked accordingly
- [ ] members debate from the brief and may gap-fill, folding new facts back with sources
- [ ] live demo run (online + offline) + output checked
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- Coarse (refined when the phase starts via `/arc-change`): dogfood one online run — assert the brief has
  ≥3 sourced facts and spot-check ≥1 cited URL actually fetches — and one `model-knowledge` run that still
  returns a verdict; evidence = both briefs + the fetch spot-check in the done-log.

## Rabbit holes in this phase
- Endless fan-out → cap ~5 researchers, single round; "good enough", not exhaustive.
- Citation laundering → a cited URL must be fetchable; count alone doesn't prove a source was read.

## Out of scope for this phase
Domain experts + roster selection (phase-03); fairness wiring + auto-save (phase-04).

## Your-setup / pending
None — WebSearch/WebFetch are the built-in tools; offline mode needs nothing.

## Non-negotiables (verbatim from PLAN)

- **Member independence** — members are spawned in one parallel batch and never see each other's answers; a failed member is retried blind, never primed with siblings' returned answers.
- **No fabrication, neutral brief** — no invented sources or numbers; unverifiable claims are marked low-confidence; the Evidence Brief states facts only, with no language leaning toward any verdict.
- **Mechanically-verified verdict** — every KEY REASON and the DISSENT cite a POINT-ID the verifier rated Supported/Plausible; `council-lint` rejects a verdict that cites an unrated/Weak point or a run whose verifier contested nothing.
- **Commit under uncertainty** — the Chair always returns a concrete DECISION (YES / NO / CONDITIONAL / WAIT), never "it depends"; offline in `model-knowledge` mode a run still returns a verdict, and if every brief fact is low-confidence the honest decision is WAIT with a named de-risk test, not a confident YES/NO from priors.
- **Additive-only** — never modify arc's root tracker or any pre-existing file; only `.claude/commands/`, `.claude/agents/`, and `docs/council/references/` ship in sync; generated `docs/council/sessions/*` are sync-excluded.
- **Fair by construction, not self-report** — fairness invariants are enforced by `council-lint`/the verifier, never self-graded by the Chair that wrote the synthesis; the strongest surviving opposing point is always shown as DISSENT.
