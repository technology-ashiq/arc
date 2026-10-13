# Phase 13 — The cap bites

**Goal (one line):** a live router row's `max_cost` refuses the next attempt once the run's measured spend reaches
it, with a typed refusal on the receipt, and a cap nothing can measure will not load.
**Appetite:** 0.75 day — blown appetite means cut or kill, never silent extension.
**Depends on:** phase-12

Serves **REQ-14 (REQ-C)** (PLAN). Decision: **ADR-0231**.

## Exit criteria (Definition of Done)

- [ ] `claude-code` joins `METERING_DRIVERS` only if Phase 12's real capture carried `total_cost_usd`.
- [ ] `METERING_DRIVERS` gains `claude-code` and `generic-api`; `chainTermFaults` requires `max_cost_currency` with a
  numeric cap and refuses it on `unmetered`; hostile load fixture per fault.
- [ ] `termsCheck` compares spend in the cap's currency; other-currency or answered-and-unreported spend is unproven.
- [ ] `run.completed` carries `refusal: {code: MAX_COST_REACHED | MAX_COST_UNPROVEN, spent, cap}` with
  `failure_class: budget` when a hop or schema retry is refused by the cap; counter 0 / positive control 1; also through the fake `claude-code` CLI (json path), and a streamed run reporting
  nothing gives `MAX_COST_UNPROVEN`; `refusal.spent.amount` equals the run's `cost.incurred.amount`.
- [ ] `engine/router.yaml`: every metered row carries numeric `max_cost` + `max_cost_currency: USD`, reasons beside
  them; `build-in-public-draft` (hermes) stays `unmetered`; every fixture router migrated (counted at phase start).
- [ ] Two-surface `/arc-attack`; CI green per job.

## Verification plan

- **Coarse:** `node tests/engine-spend.mjs` section K (cap) + `tests/engine-router-row.bats` currency fixtures through
  the real arc-run against the local server; refined when the phase starts.

## Rabbit holes in this phase

Converting USD to compare with `--budget inr=` → no-go.

## Out of scope for this phase

The live spine (Phase 14).

## Your-setup / pending

None.

## Non-negotiables (verbatim from PLAN)

- **Null never becomes 0.** An absent, unreadable or wrong-typed provider figure is absent on every surface — sidecar,
  `hops[]`, `run.completed`, money row — and a measured 0 is distinguishable from it everywhere (ADR-0069 b5).
- Money is integer minor units by decimal-string arithmetic; no float is ever multiplied into a money field, and no
  rate converts one currency into another (ADR-1012, ADR-1003, ADR-0229).
- Zero new event kinds; `cost.incurred` is ADR-1001's kind; `run.completed` gains payload fields only and its `reason`
  values are unchanged; every emit is VERIFIED in `events/`, not `_quarantine/`.
- **No new driver, no model work (no tier, pin, profile or `models:` change), no change to `failure-class.mjs`'s six
  classes.** `METERING_DRIVERS` and the money comparison in `termsCheck` are the only edits to that file.
- One module owns spend parsing (`spendOf` in `common.mjs`) and one owns the cap decision (`termsCheck`); no second
  copy in arc-run, a driver, bench or the face ("validate one read, compare another" is this lane's recorded twin).
- Every gate ships with a negative control that actually runs; a probe asserts it RAN before asserting what it printed.
- Every phase gets the two-surface `/arc-attack` (logic + boundary) carrying `initiatives/engine/fixed-defects.md`,
  one round on the local commit before the push, at most two rounds per PR.
- Tests run on CI only, read per job with `ci-digest`; nothing is reported done on local evidence.
- Before editing a shared root organ — `engine/router.yaml`, `docs/adr/`, `tests/`, `.github/` — run
  `git log origin/main --oneline -5 -- PATH`, and at a merge take the STRONGER version.
- A program embedded in a shell string carries no apostrophes, no single quotes, and — inside double quotes — no
  backtick and no dollar sign; such a program goes in its own file.
