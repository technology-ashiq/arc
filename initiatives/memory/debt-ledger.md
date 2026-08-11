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
