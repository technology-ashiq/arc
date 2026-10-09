# Phase 03 — attack dispositions

## attack b6ffd12 r1 (seven trust and data slots, ADR-1742..1747; base ccfb15d4)

- Logic: 0 findings. Boundary: 10, every one fixed in this session:
  - B1 [high] the runner's exit became a deny-list on "fail"; back to an allow-list of ok and absent.
  - B5 [high] restore-drill trusted any drill file's run; it now checks each run's file against backup's reported
    drill-digest.
  - B2 [medium] ABSENT text and answerer pass through `clean` and a code-point cut; the runner cleans the reason it prints.
  - B3 [medium] `pause` checks an already-fired abort and drops its listener (dependency-scan, errors, migration-rollback).
  - B4 [medium] legal pages are read through a 1 MB capped stream that is cancelled after.
  - B6 [medium] the drill run is the newest one that ran launch's file, with cancelled and skipped runs passed over.
  - B7 [medium] the dump never leaves the job: one job, no upload, the dump removed always.
  - B8 [medium] ABSENT needs the home page to answer 200; a dead site is not ok.
  - B9 [low] the rollback test is `.mjs`.
  - B10 [low] the Sentry probe carries a per-verify nonce, so no stale event can match.

## attack edfe42c r2 (fixes of r1)

- Logic: 0. Boundary: 8. B1 [medium] not a hole: `runner.mjs` imports `clean` at line 11. B2 [medium] fixed: clause
  pairs are found by indexOf over at most 200 openers (pinned, `hostile`). B3 [low] fixed: each probe event carries
  `fingerprint: [probe, nonce]`, so every verify's event is its own issue whatever Sentry's grouping. B6 [low] fixed:
  the headers probe releases the body. B7 [low] fixed: ABSENT needs the launch shell's generator tag on `/` (pinned,
  `parked`). B4, B5, B8 [low] -> D37.
