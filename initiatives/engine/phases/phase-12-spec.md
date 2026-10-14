# Phase 12 — Every production driver reports what it spent

**Goal (one line):** `claude-code` reads its session spend at session end through an interface with a fake and a
real implementation, and every driver that cannot know its spend says nothing, on the record.
**Appetite:** 0.75 day — blown appetite means cut or kill, never silent extension.
**Depends on:** phase-11

Serves **REQ-12 (REQ-A)** (PLAN). Decision: **ADR-0229**.

## Exit criteria (Definition of Done)

- [ ] `drivers/claude-code.mjs` has a `SessionSpend` seam: `read(envelope)` returns the raw `total_cost_usd` or
  absent, from the json envelope AND the stream `result` event; the figure goes through `spendOf(·, "USD")` only.
- [ ] The fake CLIs (`fail-claude-cli.mjs` / `fake-claude-stream.mjs` family) emit `total_cost_usd` present, absent,
  string, negative; each asserted on `run.completed.spend` / `spend_absence`.
- [ ] The full hostile corpus of REQ-12 passes as named assertions, and a float mutant of `spendOf`
  (`Math.ceil(x*100)`) turns the `0.07` check red; the mutant RAN is asserted first.
- [ ] A grep gate: no `total_cost_usd`, `usage.cost` or money `* 100` outside `common.mjs` and the two driver read sites.
- [ ] `hermes` and `codex` stay unmetered; the driver comments and the PLAN say why.
- [ ] Two-surface `/arc-attack`; CI green per job.

## Verification plan

- **Test command:** `node tests/engine-spend.mjs` sections C (claude-code) and M (mutant); CI only.
- **Expected failure first:** a fake CLI envelope carrying `total_cost_usd: 0.0731` yields `spend_absence:
  driver-unmetered` before the change, where the test expects `{amount: 8, currency: "USD"}`.
- **Live demo scenario:** coarse — a fake-CLI dispatch shows `spend` on `run.completed` and one `cost.incurred`.
- **Real-system check:** one real `claude -p --output-format json` call and one `--output-format stream-json` call
  (a few cents, notional on the owner's subscription) are captured verbatim with the CLI version into
  `tests/fixtures/engine/real-claude-envelope.json` and `real-claude-stream-result.json`; `SessionSpend` is asserted
  against those captures, not only hand-written fakes. If `total_cost_usd` is absent from either, A-11 has fired and the
  `claude-code` metering flip is cut from Phase 13.
- **Expected evidence:** CI per-job logs; attack evidence under `evidence/phase-12/`.

## Rabbit holes in this phase

Price tables for `codex`/`hermes` → no-go (PLAN rabbit hole 1).

## Out of scope for this phase

The cap (Phase 13).

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
