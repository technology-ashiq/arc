# Phase 02 — Parallel-safety floor

**Goal (one line):** WIP info line at kickoff preflight (counted = LIVE+BLOCKED, informational only, ADR-0052), two-table board lint with Expected/Found/Example messages (REQ-03), manifest-derived ownership lint (ADR-0057), and the spine concurrency contract — strict retry → exit 2, hook-mode `_pending/` spool surfaced in status/brief and drained under the next lock, zero-interleaving proven on 3 OS (REQ-04) — all WARN-first.

**Appetite:** 0.75 days
**Depends on:** phase-01

Mode B (ADR-0056) is certified ONLY when REQ-04 is green; until then concurrent emitters
are forbidden and the board carries `Mode B: not certified`. WIP counting per ADR-0052
never stops kickoff at any count. Cross-lane writes per ADR-0053 are exactly what the
ownership lint catches; ventures stay passport-rows-only per ADR-0059.

## Verification plan

- Coarse (refined via `/arc-change` when the phase starts): fixtures per REQ-03 + REQ-04 acceptance — WIP count printed and kickoff proceeds at 2+, board↔header divergence WARNs with Expected/Found/Example, seeded cross-lane edit WARNs, 3-OS concurrent-emit fixtures show zero interleaved lines with every event in main file or spool, spool drain + visibility fixtured.

## Rabbit holes in this phase

- Turning the spool into an event bus or daemon (ADR-0027's no-bus stance holds — it is
  a timeout fallback only). Board schema generalization. Promotion of any WARN to BLOCK
  (trial-ledger evidence only).

## Out of scope for this phase

- Docs rewrite + retro (Phase 3). Real-world parallel validation (next cycle: develop
  kickoff = first native lane, the dogfood tripwire).

## Your-setup / pending

- None.

## Non-negotiables (verbatim from PLAN)

- Philosophy untouched: Golden Loop, gates, receipts, change discipline — a lane is a namespace for tracker state, nothing more (ADR-0050, ADR-0053).
- No history rewrite and no history duplication: frozen paths stay frozen as sole canonical copies; lanes link, never copy (ADR-0055, ADR-0058).
- Root-mode green at every commit — byte-identical when no `initiatives/` dir exists; the bare-root fixture is a permanent consumer contract (ADR-0054).
- feat/* branch + PR, never main.
- All new lints WARN-first, and every WARN prints Expected / Found / Example (ADR-0057).
- Spine receipts for kickoff / phase-done / retro as usual; no silently lost receipts — degrade visibly, never lose, never block (ADR-0056, REQ-04).
- Never guess a lane: explicit `--lane` beats auto-resolve beats ask; destructive commands confirm the selected lane (ADR-0054).
