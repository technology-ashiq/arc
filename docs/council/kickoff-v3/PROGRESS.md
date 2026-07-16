# PROGRESS.md — arc-council v3 (cross-model juror)

> Scoped build tracker (arc's root PROGRESS.md untouched). Gate:
> `node .claude/scripts/kickoff-lint.mjs docs/council/kickoff-v3`.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 0 | Steel thread — juror script (fake impl) + artifact/run-record contract + 3 lint checks | 1 day | pending |
| 1 | Real providers (≥2) + protocol integration + dogfood + fabrication probe | 1.5 days | pending |

## Appetite burn
0 of 3 days used (phase appetites sum to 2.5).

## Done-log
- 2026-07-16 — Kickoff: PLAN + ADRs 0015–0018 + 2 phase specs. Forks user-decided: provider-agnostic OpenAI-compat protocol (any provider/model/key via env — no vendor dependency, free models usable), required-when-configured, ADR-0014 charter scope. Surveyor confirmed codex CLI absent → nothing depends on it.

## Now
Kickoff artifacts written; attack panel + kickoff-lint next, then the STOP review.
**Next step:** on explicit approval — Phase 0 (steel thread: juror fake impl + lint checks, red fixtures first).
