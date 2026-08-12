# Debt ledger — lane `memory`

> One row per intentional shortcut: **what · where · why accepted · cost of leaving it ·
> pay-down trigger.** An unrecorded shortcut is forgotten forever (`/arc-develop` rules).
> Read by `develop.mjs checkpoint`, which refuses a new TODO/FIXME/HACK marker that has no row here.

## D-01 — REQ-06's named CI job is deferred; the gate bites through the suite instead

- **What.** ADR-0706 and the phase spec ask for the golden-set gate to run **as its own CI job**.
  It does not. The gate itself ships and is live, but it is exercised by
  `tests/memory-golden.bats` inside the sharded `selftest` matrix rather than by a named job.
- **Where.** `.github/workflows/ci.yml` — the job that is missing is `memory golden set (REQ-06)`.
  The gate that does exist: `.claude/scripts/memory/golden-check.mjs --gate`.
- **Why accepted.** `.github/workflows/**` sits in the **deny** list in `.claude/settings.json`,
  next to `CONSTITUTION.md`, the policy engine and the hooks — a guardrail set on purpose. Owner
  ruled on 2026-08-12: ship as-is and record the gap rather than loosen the rule for one job.
- **Cost of leaving it.** Lower than it looks, and stated precisely so nobody has to re-derive it.
  The red path is **live today**: `memory-golden.bats` runs `--gate` against the REAL index and
  the REAL golden set, and asserts exit 0 at 12/12. A regression below 12/12, or a corpus where
  the module stops beating the recorded grep baseline, fails that test and fails the build. What
  is genuinely lost is **legibility on a per-JOB read**: the verdict arrives inside whichever
  `selftest (…, shard N/12)` job happens to hold the file, so a red reads as a shard failure and
  the reader has to open the log to learn it was the quality gate. The gate does not weaken; the
  signal does.
- **Pay-down trigger.** Either (a) the deny rule is relaxed for `ci.yml` for any reason, or
  (b) a second REQ-06-class gate needs wiring — at which point two gates buried in shards is a
  legibility cost worth paying down in one edit rather than two. The exact block to add:

```yaml
  memory-golden:
    name: memory golden set (REQ-06)
    runs-on: ubuntu-latest
    defaults:
      run:
        shell: bash
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Build the index
        run: node .claude/scripts/memory/memory-index.mjs --rebuild --allow-missing-spine
      - name: Golden set must hit top-3 on every query, and beat the grep baseline
        run: node .claude/scripts/memory/golden-check.mjs --gate
```

`--allow-missing-spine` is correct and not a loosening: a fresh checkout has no `.claude/state/`
(gitignored), so the decisions organ is knowingly absent, and no golden row expects a decisions
record — all 12 name an adr/retro/learn/trial id. If a golden row ever names one, this flag stops
being safe and the gate says so by going red on a missing expected id, which is the correct
failure.

## D-02 — Phase 02 has NO `develop.started` / `slice.done` receipts, and they were not backfilled

- **What.** The two develop receipts for phase 02 do not exist on the spine and will not be
  created. `/arc-phase-done 02` will report them missing, and that report is correct.
- **Where.** `.claude/state/hq/events/<date>.jsonl` in the main clone at
  `E:/Work_Hub/01_Automemory/arc` (this worktree is blocked by the WORKTREE_SPINE guard).
  The emitter is `.claude/scripts/hq/arc-event.sh`; both kinds are live in the closed 44
  (`lib/validate.mjs:38`), so this is not a vocabulary problem — nothing was ever emitted.
- **Why it happened.** `/arc-develop next` resolves to **phase 01**, not 02: `findLedger` returns
  the lowest tasks-file holding any unproven slice, and `phase-01-tasks.md` holds 16/16 unproven
  because Phase 01 was built and closed outside the harness. The fix lives in the `develop` lane
  and this phase's no-gos bar cross-lane edits, so the slice loop was driven by hand — and the
  harness is the only thing that emits these receipts.
- **Why accepted rather than backfilled — the part worth reading.** Both ways of manufacturing
  them are worse than the gap:
  - **Emit now, at `ts = now`.** `develop.started` and `slice.done` land seconds apart, so
    `timeToFirstProven` (`.claude/scripts/develop/metrics.mjs:157`) records phase 02 at **~0
    minutes** and averages it into the company mean. That function has a declared plausibility
    CEILING (90 days, added after one receipt with a wrong year produced 26,297,340 minutes) and
    **no floor**, so nothing would catch it. A false number that looks real is worse than an
    absent one — the whole reason that ceiling exists.
  - **Emit with `ARC_SPINE_NOW` pinned to the slice commit times.** That is a test door used to
    make fixtures reproducible, and using it to write a past timestamp into an append-only
    company log is forging a receipt. This repo's own rule is that *a certification is not a
    memory of a green run*; a receipt is not a memory of having worked.
  The spine is append-only, so a wrong event cannot be deleted, only superseded. A named absence
  is recoverable; a false record is not.
- **Cost of leaving it.** Phase 02 contributes nothing to `time-to-first-proven-slice` or to any
  develop-lane metric derived from these two kinds, and the phase's slice lineage lives only in
  `phase-02-tasks.md` and the commit SHAs it names (`06e1837`, `e348fa1`, `723aa41`, `cf0c4c9`,
  `b7ade04`). Those are real evidence and they are not on the spine. Nothing else depends on it.
- **Pay-down trigger.** The `develop` lane fixing `findLedger` so `next` resolves to the correct
  phase. At that point the harness emits these receipts for every future phase and the gap stops
  growing. **It does not retro-fill phase 02, and this row is why.**
- **Owner call outstanding.** Whether `/arc-phase-done 02` may close with this row open is
  Ashiq's, not this session's. The recommendation is **yes, close with D-02 recorded**: the
  receipts prove that the harness ran, and the harness demonstrably did not — recording that
  truthfully is the point of having a ledger.
