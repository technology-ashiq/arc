# Phase 03 — Inbox + API seal · evidence bundle

Closed 2026-07-24. Delivers **REQ-06** (approvals become receipts) and **REQ-09** (the spine is
the only API), against `phases/phase-03-spec.md`. Appetite 1.5d.

## DoD → evidence

| DoD item | Met by | Proof |
|---|---|---|
| `approval.requested` emission points live (kickoff, phase-done) | W4 | `arc-kickoff.md` / `arc-phase-done.md` emit at the request-OK gates; REQ-01 dry-run golden extended (`spine-golden-dryrun.bats` 2/2) |
| `arc inbox` lists via reader; approve/reject writes `decision.recorded`; replays identically; no state outside the spine; unknown/already-decided → pinned error | W1·W2·W3 | `spine-inbox.bats` 18/18 (list/decide, refusal path, replay-identical, DUP_IDEM backstop, no-state-outside-spine) |
| Cursor catch-up bats incl. same-ms-burst (append order, never string compare) | W6 | `spine-cursor.bats` 2/2 + committed fixture `tests/fixtures/spine/same-ms-burst/2026-07-22.jsonl` |
| Reader-only grep-lint enters TRIAL (`mode: warn`, glob-scan); brief/inbox zero direct events/state.db | W5 | `spine-reader-lint.bats` 5/5, `gates.bats` 15/15 (count 5→6, `spine-api` warn/hook); clean on real tree |
| Tracker updated · evidence bundle written | packaging | this bundle · PLAN/PROGRESS updated |

## Mandatory adversarial pass

`adversarial-report.md` — 7 attacker lenses, 40 candidates, **2 confirmed holes found + fixed +
pinned in both modes** (idem pre-claim / two-key desync; C1 terminal-escape smuggling), 21
defended, 17 manually assessed. This is the phase's defining event: two real integrity holes in
code that passed its own tests.

## Scope

- **REQ-08** (cost) — cut at Phase-02 close (pre-planned).
- **W8** (per-consumer cursor store) — cut 2026-07-24, the pre-planned reserved cut; REQ-09
  acceptance + DoD-3 fully met by W5+W6, so it drops no REQ and no DoD checkbox (see phase-03-spec).

## Test authority

Touched-file suites run green locally (chunk cadence). The **full 3-OS × Node matrix is the
authority on push** (locked test policy): `spine-emit.bats` full regression and the sync-golden
suites are verified there. The sync-golden `tree-manifest.txt` was regenerated from a fresh bare
sync; the diff moved exactly 5 paths (validate.mjs, arc-inbox.mjs, spine-reader-lint.sh,
arc-kickoff.md, arc-phase-done.md) and nothing else (pre-mortem #3).
