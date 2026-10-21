# Phase 04 — the attacker rounds (2026-09-18)

Each round was a fresh pair of agents: one on the decision logic, one on the HTTP / shell / OS boundary. Each
carried `initiatives/face/fixed-defects.md` with the instruction to check every line in every OTHER file. Every
reproduced hole is fixed and pinned, or is a debt row with its trigger. The per-hole lines are in
`fixed-defects.md` under "Face v2 Phase 04" and its Rounds 2, 3 and 4.

| round | target | holes reproduced | mutants (survived / built) | outcome |
|---|---|---|---|---|
| 1 | the Phase 04 build | 25 (decision 20 of 21 mutants survived; boundary 11) | 20 / 21 | fixed, pinned in the new `tests/face/phase04-folds.mjs`; `4cfc7002` |
| 2 | the round-1 fixes | the twins one route over (the pnl kill path, the gates resolver, scrub, validate-one-read-another) | 5 more survived | fixed, pinned; `65697998` |
| 3 | the round-2 fixes | boundary 13 (the door's OLDER routes kept Phase 04's classes); decision 7 | 29 / 52 | fixed, pinned (130 checks); older-route twins closed as a current-phase note; `348c3783` |
| 4 | the round-3 diff alone | boundary 9; decision 7 (one vacuous: a fix in a helper no room called) | 7 / 23 (2 equivalent) | fixed, pinned (141 checks); `d62ea4b6` |

**Not attacked:** the round-4 fixes themselves. Each round found fewer and smaller holes than the one before; the
cycle was stopped at four rounds and eight agents, and that is recorded here rather than implied away.

**Debt rows the rounds produced** (`debt-ledger.md`): per-request spine reads; the gates shell-out cost; the verbatim
log view (by design, ADR-1312); the private-copy parse under a race (no deterministic test); `arc-replay` and
unreadable days (spine lane); hardlinks (realpath cannot see them); the unopened-day count on brief, inbox and rooms;
the door-side receipt joins; `name@HOST` addresses.

**Filed to other lanes:** the spine lock's Windows `LOCK_TIMEOUT` recurred on the same emit index (`j=23`) as its
2026-08-24 occurrence -- recorded in `tests/spine-concurrency.bats`; `arc-replay`'s blindness to unreadable days.
