# Handoff pack — phase 00 · lane evolve

13/13 slices proven.

## Prediction calibration

1 hit · 1 miss · 3 unforeseen

- **likely-failure-mode** — unforeseen — 9f3e296. I would have said "new kinds silently quarantined while the emitter exits 0", and one receipt was lost exactly that way. But the phase's real failure mode was a validator that looked correct, passed 54 of my own tests, and had 15 holes in it
- **likely-regression-site** — unforeseen — a69cbda. hq/lib/validate.mjs and the emitter were the obvious guess and did carry most of the defects, but the regression that actually broke CI landed in the DESIGN suite, through a load-time import into a test sandbox that was an incomplete product install
- **riskiest-file** — hit — 9f3e296. .claude/scripts/hq/lib/validate-experiment.mjs took 9 of the 15 holes, including all three severe ones. This is the one line I would have gotten right in advance, and it is also the least useful, because knowing which file is risky did not stop me writing the bugs
- **expected-blockers** — unforeseen — a69cbda. Four CI failures, three of classes I had not considered at all: bats silently DROPPING a test whose name is non-ASCII, a test sandbox being an incomplete install of a product, and a lint message that differs by filesystem case-sensitivity so one manifest gets two verdicts
- **expected-proof-failures** — miss — 9f3e296. Red-before-green held everywhere. What I did not predict is that one of MY OWN tests would be wrong in a way that hid a severe bug: the correction test varied window_end, so it "corrected" a different window and stayed green while corrections could never land at all

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | contract | contract - `bats tests/evolve-contract.bats` drives product-lint over 1 good and 9 new hostile fixtures inside the existing corpus, red first | 231a24c |
| 02 | contract | contract - the golden delta is derived and reviewed BEFORE regeneration (comm/join over path+hash columns), then `bats tests/sync.bats` proves byte-identity on both the rsync and cp-r install paths | 6725764 |
| 03 | contract | contract - `bats tests/evolve-contract.bats` gains two coverage-walk cases: a new `hostile/unmapped-file` fixture that must exit 2 naming the orphan by exact path, and the real repo root which must exit 0 | b77f818 |
| 04 | contract | contract - `bats tests/evolve-receipts.bats` drives all eight kinds through the REAL emitter into a sandboxed spine; closed-payload, enum, seal, split, arm, TTL and idem cases each have their own failing fixture | a50489e |
| 05 | contract | contract - four cases in `bats tests/evolve-receipts.bats`: metric.observed still UNKNOWN_KIND, a URL-shaped source_id refused, an email-shaped unit_id refused, the h-<16 hex> form accepted | a50489e |
| 06 | contract | contract - the loop in `bats tests/evolve-receipts.bats` test 1 runs all eight kinds and asserts, in this order: the emit's own exit code, then events/ non-empty, then quarantine empty, then the landed line carries the kind | a50489e |
| 07 | contract | contract - the backward-compat control (legacy name@x.y.z validates) is run GREEN BEFORE the regex is touched; then arm-tagged ids validate, six near-miss slugs fail closed, and an identity check proves validate.PROCESS_RE and core.PROCESS_RE are the SAME object | a50489e |
| 08 | verified-real | verified-real - run on the REAL spine, not a sandbox: emit through arc-event.sh --strict with the exit captured, quarantine re-counted, then `spine.mjs read --kind experiment.opened`, then the seal re-derived from the live file and compared | 509164f |
| 09 | contract | contract - TWO fresh unanchored agents (not the author, not this session), one on the manifest validator + money classifier, one on the eight receipt validators + grammar; each told to CONSTRUCT AND RUN breaking inputs and that a finding it did not execute is not a finding | 9f3e296 |
| 10 | contract | contract - the full arc CI matrix on PR #108: 19 jobs across ubuntu 18/20/22, macos (3 shards) and windows (12 shards) | a69cbda |
| 11 | verified-real | verified-real - the spec's live-demo scenario run end to end against the real repo and the real spine, output read | 509164f |
| 12 | contract | contract - both evolve suites run entirely against fixtures and a sandboxed spine (ARC_SPINE_ROOT); no client feed is touched because none exists | a69cbda |
| 13 | static | static - PROGRESS.md machine header, phase table and done-log updated; PORTFOLIO.md gains the evolve row; the board-drift check enforces both directions in CI | a69cbda |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

<!-- paste the fidelity report here; the verdict line is the last line of its output -->
