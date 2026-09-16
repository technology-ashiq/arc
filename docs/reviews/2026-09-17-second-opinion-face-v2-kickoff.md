# Second opinion — face v2 kickoff plan (Cycle 16)

- **Target:** `initiatives/face/PLAN.md` + `initiatives/face/phases/phase-00-spec.md`, as drafted after the three-attacker panel (not a code diff).
- **Model:** OpenAI Codex CLI `codex-cli 0.147.0`, `codex exec -s read-only`, independent of the Claude session that wrote the plan.
- **Why:** `/arc-kickoff` step 8.75 — tier L runs a cross-model second opinion on the plan.
- **Verdict as returned:** **DISAGREE** — "the unresolved 36-versus-41 inventory contradiction means the core module/room contract cannot be implemented or tested deterministically."

## Findings and reconciliation

| # | Sev | Finding (condensed) | Outcome |
|---|---|---|---|
| 1 | critical | 36 modules vs 34 served + 4 extra + 3 planned = 41; no id-level membership | **Applied.** Measured: v0.7's 36 = 29 same-id (incl. the 3 served-planned) + 3 renames (`today`←overview, `engine-room`←engine, `council-chamber`←council) + 4 extras; served-only `chat-mcp` (generic) and `lane` (template). New PLAN § Module inventory; Phase 00's contract script re-derives it and wins on disagreement. The disagreement is resolved by measurement, not argument. |
| 2 | high | Phase 00 checks `@tailwindcss/oxide` before Tailwind exists | **Applied.** Phase 00 checks today's native entries (Vite 8); Phase 01 extends the check to oxide. |
| 3 | high | Adding a bats file is not proof CI runs it | **Applied.** Each executing job prints `face-browser: RAN leg=OS/NODE`; evidence lists it per job; the sharder (`shard-tests.mjs`) refuses an unplaced file. |
| 4 | high | 2-day appetite with a 3-day stop trigger under zero slack | **Applied.** Hard stop at 2 days (ADR-1336 trigger amended). The size risk itself is accepted and sits in pre-mortem row 3. |
| 5 | high | REQ-01's visual review has no baseline, capture contract or artifact | **Applied.** Phase 00 records baseline shots (1440×1000, both moods, sha256 manifest); Phase 03 names the capture contract, the `design-critic` reviewer and `shot-review-RING.md`; VIOLATION or BELOW-BAR blocks a ring's merge. |
| 6 | high | REQ-06 passes with every route still absent ("named residue") | **Applied.** Residue capped at 3 routes, each naming the missing lint parser and its lane, each owner-approved. |
| 7 | high | "Double-fired apply runs once" has no idempotency contract | **Applied.** Keyed by plan id, atomic claim, first receipt replayed; a CONCURRENT fixture counts one CLI invocation. |
| 8 | medium | REQ-05 cannot prove every figure cites a route | **Applied.** `module.mjs` declares `routes`; `fold()` receives only declared payloads (fixture FAILs an undeclared one); a panel with none renders `NOT SERVED`. |
| 9 | high | Owner rulings before Phase 05 have no deadline | **Applied.** Recorded no later than the Phase 04 close, raised at the Block B reading. |
| 10 | medium | "The lane's fixed-defect list" is named but never located | **Applied.** Phase 00 seeds `initiatives/face/fixed-defects.md` from Cycle 15's recorded holes; every attacker pass appends. Cycle 15 had stated the rule without ever creating the file. |

Critical disagreement: one (row 1), resolved before approval was requested — nothing is left blocked.
