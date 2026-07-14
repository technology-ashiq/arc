# Phase 03 — Full domain roster + Chair selection

**Goal (one line):** ship all 7 domain experts and the Chair's per-question roster selection (domain match,
ceiling 4, documented tie-break with disclosure of any dropped domain).
**Appetite:** 2 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-01, phase-02

## Exit criteria (Definition of Done)
- [ ] 7 domain experts exist: strategist, risk-analyst, marketer, designer, engineer, policy-analyst, life-counselor
- [ ] each spawns via `subagent_type` with 0 missing-agent errors and returns the POINT-ID contract
- [ ] Chair classifies the question's domain(s) and convenes only the matched experts, announced inline (ADR-0004)
- [ ] a >4-domain question convenes the top-4 by a documented priority order and names the dropped domain(s) in caveats
- [ ] experts debate from the phase-02 Evidence Brief like any member
- [ ] live demo run (multi-domain) + output checked
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- Coarse (refined when the phase starts via `/arc-change`): dogfood a finance+marketing question →
  `council-risk-analyst` + `council-marketer` convene; a >4-domain question → exactly 4 convene + dropped
  domains named; a single-domain question → only its expert. Evidence = the three rosters in the done-log.

## Rabbit holes in this phase
- Over-convening → ceiling 4, domain-matched (ADR-0004); never "all 7 just in case".
- Building experts before the brief exists → they consume phase-02's Evidence Brief, so phase-02 lands first.

## Out of scope for this phase
Fairness wiring, auto-save, sync inclusion, docs (phase-04).

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- **Member independence** — members are spawned in one parallel batch and never see each other's answers; a failed member is retried blind, never primed with siblings' returned answers.
- **No fabrication, neutral brief** — no invented sources or numbers; unverifiable claims are marked low-confidence; the Evidence Brief states facts only, with no language leaning toward any verdict.
- **Mechanically-verified verdict** — every KEY REASON and the DISSENT cite a POINT-ID the verifier rated Supported/Plausible; `council-lint` rejects a verdict that cites an unrated/Weak point or a run whose verifier contested nothing.
- **Commit under uncertainty** — the Chair always returns a concrete DECISION (YES / NO / CONDITIONAL / WAIT), never "it depends"; offline in `model-knowledge` mode a run still returns a verdict, and if every brief fact is low-confidence the honest decision is WAIT with a named de-risk test, not a confident YES/NO from priors.
- **Additive-only** — never modify arc's root tracker or any pre-existing file; only `.claude/commands/`, `.claude/agents/`, and `docs/council/references/` ship in sync; generated `docs/council/sessions/*` are sync-excluded.
- **Fair by construction, not self-report** — fairness invariants are enforced by `council-lint`/the verifier, never self-graded by the Chair that wrote the synthesis; the strongest surviving opposing point is always shown as DISSENT.
