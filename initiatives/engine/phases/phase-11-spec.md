# Phase 11 — Steel thread for metered runs: provider figure to one money row

**Goal (one line):** a dispatch whose provider reports spend leaves `run.completed.spend` and exactly one
`cost.incurred` on the spine, and a dispatch whose provider reports none leaves a named absence and zero money rows.
**Appetite:** 0.75 day — blown appetite means cut or kill, never silent extension.
**Depends on:** phase-00

Serves **REQ-13 (REQ-B)** (PLAN). Decisions: **ADR-0229**, **ADR-0230**.

## Exit criteria (Definition of Done)

- [ ] `drivers/common.mjs` exports `spendOf(value, currency)` → `{ amount, currency, provider_amount }` or `null`, by
  decimal-string arithmetic (ADR-0229): `0.07 → 7`, `0.0700001 → 8`, `1e-7 → 1`, `0 → 0`; absent / `null` / string /
  negative / non-finite / past 1e12 → `null`. `writeCost` gains a `spend` field written to the sidecar only when
  `spendOf` returned a figure; `mock`'s `__cost.inr` maps to `{amount: inr, currency: "INR"}` so existing fixtures keep
  their meaning.
- [ ] `generic-api` sends `usage: {include: true}` and reads `envelope.usage.cost` (SSE last chunk and plain JSON)
  through `spendOf(·, "USD")`; a missing `cost` writes no `spend`.
- [ ] arc-run: each hop records `spend` from the sidecar (never re-parsed); `run.completed` carries `spend` (the
  per-currency integer sum of measured attempts, `provider_amount` summed as decimal strings) or `spend: null` +
  `spend_absence: driver-unmetered | not-reported`; `reason` values unchanged.
- [ ] arc-run writes ONE `cost.incurred` per metered run per currency through `emitEvent`, AFTER `run.completed`,
  payload per ADR-0230 (`run_ref` = the `run.completed` id, `venture: arc`, `source: measured`, `process`, `driver`,
  `model`, `label`, no `reservation_ref`), verified landed in `events/`; an unmetered run writes none.
- [ ] Re-emitting the money row for one (`run_ref`, `currency`) is refused (idempotency key); two identical-looking runs
  both land (count 2, quarantine 0) — fixtures.
- [ ] ONE rounding per run per currency: `sumSpend` in `common.mjs` adds `provider_amount` exactly and rounds once;
  `0.004 + 0.004` → `run.completed.spend.amount == cost.incurred.amount == 1`.
- [ ] `basis` (`harness-reported` | `provider-reported`) on `run.completed.spend` and the money row, and in its `label`.
- [ ] `unbookedRuns(events)` returns 1 on a fixture spine with a spent `run.completed` and no money row, 0 on the clean
  one; a failed money emit prints a typed `arc-run: could not emit cost.incurred` line.
- [ ] A-13 checked: a fixture spine with one engine `cost.incurred` leaves `policy/spend.mjs`'s fold unchanged.
- [ ] The `costs.mjs` fold over the fixture spine shows a USD measured cost line equal to the run's `amount`.
- [ ] Two-surface `/arc-attack` run on the local commit, findings fixed or rejected by the six-word taxonomy;
  `fixed-defects.md` updated; CI green per job.

## Verification plan

- **Test command:** `node tests/engine-spend.mjs` (new; sections S = `spendOf` corpus, G = generic-api local server,
  R = arc-run receipts on a fixture spine) wired into a bats suite `tests/engine-spend.bats`; CI only.
- **Expected failure first:** before the change `spendOf` is not exported (`SyntaxError: ... does not provide an
  export named 'spendOf'`), and section R's "one cost.incurred per metered run" reads **0** rows where it expects 1.
- **Live demo scenario:** run arc-run with `--driver generic-api` against the test's local server answering
  `usage.cost: 0.000183` → `run.completed.spend = {amount: 1, currency: "USD", provider_amount: "0.000183"}` and one
  `cost.incurred` with the same `run_ref`; the same run with `cost` omitted → `spend: null`,
  `spend_absence: not-reported`, zero money rows (count read from `events/`, positive control 1).
- **Real-system check:** n/a — fakes only this phase (local endpoint, `mock`); the real gateway is read in Phase 14.
- **Expected evidence:** CI per-job logs naming the S/G/R counts; the attack evidence files under
  `initiatives/engine/evidence/phase-11/`.

## Rabbit holes in this phase

- `Math.ceil(x * 100)` → decimal-string parse (PLAN rabbit hole 2).
- Teaching `costs.mjs` anything new → no-go; it already renders USD.

## Out of scope for this phase

`claude-code` spend (Phase 12); the cap and the metering-table flip (Phase 13); the live spine (Phase 14).

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
