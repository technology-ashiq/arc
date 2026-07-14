# Phase 00 — Steel thread: a council that returns a verdict

**Goal (one line):** `/arc-council "<q>"` spawns advocate + skeptic + neutral in one parallel batch and the
Chair renders a single verdict with a concrete DECISION, end-to-end, offline (`model-knowledge`).
**Appetite:** 2 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** none

## Exit criteria (Definition of Done)
- [ ] `/arc-council "<q>"` runs end-to-end and returns a verdict containing a DECISION ∈ {YES, NO, CONDITIONAL, WAIT}
- [ ] advocate / skeptic / neutral are spawned in ONE parallel batch, none primed with another's answer
- [ ] `council-lint.mjs` (skeleton scope: the command + 3 core agents exist with valid frontmatter) exits 0
- [ ] live demo run + output checked
- [ ] verified against the real system — n/a this phase (offline `model-knowledge`, no web)
- [ ] contract tests green — n/a this phase (no external dep exercised yet)
- [ ] tracker updated — flip Phase 0's row to ✅ in `docs/council/kickoff/PROGRESS.md` and append an evidence line to its `## Done-log` section

## Verification plan
- **Test command:** `node .claude/scripts/council-lint.mjs`
- **Expected failure first:** before this phase, neither `.claude/scripts/council-lint.mjs` nor
  `.claude/commands/arc-council.md` nor the 3 core `council-*` agents exist, so the first run of the lint
  reports `FAIL arc-council.md missing` / `FAIL council-advocate missing` (exit 1). It goes green only once
  the skeleton command + 3 agents + the skeleton lint are written — red proves the lint checks real files.
- **Live demo scenario:** `/arc-council "Should I rewrite my 5k-line side project in Rust?"` → the Chair
  convenes 3 members and renders a verdict whose first line is `DECISION: <YES|NO|CONDITIONAL|WAIT>`.
- **Real-system check:** n/a — fakes only this phase (offline `model-knowledge`, no web calls).
- **Expected evidence:** `council-lint` exit-0 output + the rendered verdict block pasted into the done-log.

## Rabbit holes in this phase
- Parallel-spawn independence: spawn all 3 members in one message, never sequentially — a sequential spawn
  is the first way independence silently breaks.
- Don't reach for the global `~/.claude` council — arc-council is built fresh & arc-native (ADR-0001).
- Keep `council-lint` skeleton-only here (existence + frontmatter); POINT-ID checks arrive in phase-01.

## Out of scope for this phase
Verifier, research fan-out, domain experts, `quick` flag, saving verdicts — deferred to phases 1–4.

## Your-setup / pending
None — runs offline with no keys or accounts.

## Non-negotiables (verbatim from PLAN)

- **Member independence** — members are spawned in one parallel batch and never see each other's answers; a failed member is retried blind, never primed with siblings' returned answers.
- **No fabrication, neutral brief** — no invented sources or numbers; unverifiable claims are marked low-confidence; the Evidence Brief states facts only, with no language leaning toward any verdict.
- **Mechanically-verified verdict** — every KEY REASON and the DISSENT cite a POINT-ID the verifier rated Supported/Plausible; `council-lint` rejects a verdict that cites an unrated/Weak point or a run whose verifier contested nothing.
- **Commit under uncertainty** — the Chair always returns a concrete DECISION (YES / NO / CONDITIONAL / WAIT), never "it depends"; offline in `model-knowledge` mode a run still returns a verdict, and if every brief fact is low-confidence the honest decision is WAIT with a named de-risk test, not a confident YES/NO from priors.
- **Additive-only** — never modify arc's root tracker or any pre-existing file; only `.claude/commands/`, `.claude/agents/`, and `docs/council/references/` ship in sync; generated `docs/council/sessions/*` are sync-excluded.
- **Fair by construction, not self-report** — fairness invariants are enforced by `council-lint`/the verifier, never self-graded by the Chair that wrote the synthesis; the strongest surviving opposing point is always shown as DISSENT.
