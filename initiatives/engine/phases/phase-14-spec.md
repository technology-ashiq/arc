# Phase 14 — Money room live

**Goal (one line):** after the final merge, real dispatches from the main clone put cost lines on the live spine and
the Money room serves them through the door.
**Appetite:** 0.25 day — blown appetite means cut or kill, never silent extension.
**Depends on:** phase-13

Serves **REQ-15 (REQ-D)** (PLAN). Decisions: **ADR-0230**, A-11, A-12, A-14.

## Exit criteria (Definition of Done)

- [ ] The cycle's PR is merged on green CI, and the main clone is pulled to the merge.
- [ ] At least one real arc-run dispatch per metering driver reachable on the box (`claude-code`; `generic-api` when
  the owner's gateway key is present) runs from the main clone and writes `run.completed.spend` + one `cost.incurred`.
- [ ] `/api/pnl` read through the door's HTTP route serves cost lines with `amount > 0`, each traced to its
  `run.completed` by `run_ref`; no hand-emitted money event exists (checked by the trace); `unbookedRuns` over the live
  spine returns 0; the evidence states whether each figure was billed or notional.
- [ ] Evidence bundle, retro, PROGRESS done-log, PORTFOLIO row, wiki regenerated.

## Verification plan

- **Coarse:** the door read's JSON and the `run_ref` trace saved under `evidence/phase-14/`; refined when the phase starts.

## Rabbit holes in this phase

Hand-emitting a `cost.incurred` to make the room light up → refused by REQ-15's own wording.

## Out of scope for this phase

New Money room UI.

## Your-setup / pending

The real dispatch spends a few cents of the owner's Claude usage; the generic-api leg needs his stored gateway key.

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
