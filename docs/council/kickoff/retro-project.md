# arc-council — project retro (final, all 5 phases)

> Scoped/self-contained. On merge to main, port the scoreboard row + the retro-log line into root
> `docs/retro-log.md`. Per-phase findings live in `retro-phase-00..03.md`; this file consolidates + scores.

## Scoreboard (counted from PROGRESS done-log + PLAN ledgers, not estimated)
```
2026-07-15 | arc-council | M | rework 0/5 | amendments 0 | FIRED 0/5 | burn 100% | sim-blockers-r1 1 | t-to-phase0 0
```
- **rework 0/5** — 0 phases reopened after close; 5 closed (0–4).
- **amendments 0** — PLAN/spec unchanged after the kickoff STOP; the attack-hardened plan held through all 5 phases.
- **FIRED 0/5** — none of the 5 pre-mortem failure-causes materialized (groupthink → independence held;
  hallucination → verifier caught it; always-deep cost → `quick` exists; lint false-pass → red-first fixtures
  held; scope creep → additive-only held). *But 3 real findings surfaced OUTSIDE the pre-mortem — see F10.*
- **burn 100%** — 12/12 appetite-days, on budget, no scope cut, no overrun.
- **sim-blockers-r1 1** — plan-simulator round-1 raised 1 blocker (scoped tracker path); fixed, round-2 = 0.
- **t-to-phase0 0** — Phase 0 (steel thread) closed the same day as kickoff.

## Project-level finding
| # | Pattern | Prevention | Recurring? |
|---|---|---|---|
| F10 | The pre-mortem (5 strategic failure-causes) predicted none of the *real* friction: F6 (agent registration timing), F8 (Chair brief-compression fidelity), F9 (decision-term ambiguity). The actual risks in a multi-agent prompt build are **operational/orchestration**, not strategic. | For a multi-agent/prompt-artifact kickoff, seed the pre-mortem with orchestration risks too — subagent lifecycle/registration, Chair-compression fidelity, prompt/term ambiguity, roster mis-selection — not only market/strategy risks. | yes |

## Retro-log line (port to root `docs/retro-log.md` on merge)
```
2026-07-15 | arc-council | pre-mortem covered strategic risks but missed the real orchestration friction (agent lifecycle, Chair-compression, term ambiguity) | for multi-agent/prompt builds, seed the pre-mortem with orchestration risks, not only strategy | premortem,orchestration,agents
```

## What went right (worth keeping)
- **Test-first held every phase** — a red fixture before every `council-lint` capability made "verified" real, not asserted; the negative fixtures still bite.
- **The verifier earned its keep** — across dogfoods it caught a dead-law citation (annulled €15M fine), a
  brief error the whole panel inherited (actix version), and rubber-stamp/strawman attempts — the single
  highest-value part of the design.
- **Scoped-kickoff-into-a-folder** kept arc's own tracker untouched while giving full `/arc-kickoff` rigor.

## Steps not applicable
- **Trial-gate promotion:** the arc-council kickoff was 1 clean `kickoff-lint` run; promotion needs ≥3 +
  a bats fixture, so nothing is promotable. (Logged for the record; no `docs/trial-ledger.md` change on this branch.)
