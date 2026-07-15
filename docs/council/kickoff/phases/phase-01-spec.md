# Phase 01 — Verified synthesis: the verifier + POINT-ID contract

**Goal (one line):** add `council-verifier` (opus) + numbered POINT-ID member contracts + the verdict
output format + the `quick` flag, so the verdict contains only verifier-rated points and a real dissent.
**Appetite:** 3 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-00

## Exit criteria (Definition of Done)
- [ ] each member response carries the 5 contract headers + numbered POINT-IDs (ADR-0007)
- [ ] `council-verifier` (opus, ADR-0006) rates points by ID and returns CONTRADICTIONS/CONSENSUS/DISPUTED/DROP
- [ ] every KEY REASON + the DISSENT bullet cite a POINT-ID the verifier rated Supported/Plausible
- [ ] `quick` opt-out (ADR-0002) skips verifier + renders a 3-member verdict
- [ ] `council-lint.mjs` extended: POINT-ID cross-reference + "verifier contested 0 points" check; exits 0
- [ ] live demo run + output checked
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- **Test command:** `node .claude/scripts/council-lint.mjs`
- **Expected failure first:** a red fixture verdict whose KEY REASON cites POINT-ID `P9` that is NOT in the
  verifier's Supported/Plausible list makes the extended lint report `FAIL KEY REASON cites unrated point
  P9` (exit 1); a second fixture where the verifier rated 0 points Weak/Contested reports `FAIL verifier
  contested nothing`. Both go green only when a real run's reasons all cite rated points and the verifier
  contested ≥1 — the fixtures prove the cross-reference actually bites.
- **Live demo scenario:** `/arc-council "Should a solo founder raise a pre-seed or bootstrap?"` → verdict
  shows the verifier's POINT RATINGS, KEY REASONS each citing a Supported/Plausible ID, and a DISSENT bullet
  citing a surviving opposing point; then `/arc-council quick "<same>"` returns a 3-member verdict with no
  verifier section.
- **Real-system check:** n/a — still offline `model-knowledge` this phase (web arrives in phase-02).
- **Expected evidence:** the two red fixtures + their green runs (lint output) and both verdict blocks in the done-log.

## Rabbit holes in this phase
- POINT-ID discipline: keep IDs simple (`P1`, `P2`…) per member; the lint greps them — don't invent a nested scheme.
- `quick` must actually skip spawning the verifier (not just skip rendering it) — cost is the point (ADR-0002).
- The verifier grades evidence, it does not re-argue the sides.

## Out of scope for this phase
Research fan-out + Evidence Brief (phase-02), domain experts (phase-03), auto-save + fairness wiring (phase-04).

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- **Member independence** — members are spawned in one parallel batch and never see each other's answers; a failed member is retried blind, never primed with siblings' returned answers.
- **No fabrication, neutral brief** — no invented sources or numbers; unverifiable claims are marked low-confidence; the Evidence Brief states facts only, with no language leaning toward any verdict.
- **Mechanically-verified verdict** — every KEY REASON and the DISSENT cite a POINT-ID the verifier rated Supported/Plausible; `council-lint` rejects a verdict that cites an unrated/Weak point or a run whose verifier contested nothing.
- **Commit under uncertainty** — the Chair always returns a concrete DECISION (YES / NO / CONDITIONAL / WAIT), never "it depends"; offline in `model-knowledge` mode a run still returns a verdict, and if every brief fact is low-confidence the honest decision is WAIT with a named de-risk test, not a confident YES/NO from priors.
- **Additive-only** — never modify arc's root tracker or any pre-existing file; only `.claude/commands/`, `.claude/agents/`, and `docs/council/references/` ship in sync; generated `docs/council/sessions/*` are sync-excluded.
- **Fair by construction, not self-report** — fairness invariants are enforced by `council-lint`/the verifier, never self-graded by the Chair that wrote the synthesis; the strongest surviving opposing point is always shown as DISSENT.
