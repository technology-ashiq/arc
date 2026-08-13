# PROGRESS.md — Cycle 7 · arc-engine "The Hired Hands"

status: LIVE
cycle: arc-engine (Cycle 7, opened 2026-08-12)
phase: 04
appetite: 7.5d
burn: 2.0d
blocked-on: the hire decision (a spine receipt this worktree cannot emit) and the capped-key ceiling figure — see ## Now

**Current position, 2026-08-14: Phases 04 and 05 built and CI-green; 06 and 07 partly built; the
rows that need a spine receipt or a credential are named below and are NOT counted as done.**

> **MERGE NOTE, 2026-08-14.** This section is the union of two engine-lane sessions that ran in the
> same window without seeing each other — this branch, and the work that landed on `main` through
> PR #184. Everything from both is here. Where they disagreed, the disagreement is recorded rather
> than flattened, and one warning the other session left has since been ANSWERED (see burn, below).

### HANDOFF — read this first if you are resuming

Everything is committed and pushed. Branch `technology-ashiq/arc-executor`, **PR #172 open**.
Nothing lives only in a session.

`/arc-kickoff` produced `PLAN.md`, `phases/phase-04-spec.md` through `phase-08-spec.md`, and twelve
ADRs (0208–0219) covering EXE-A…K plus one decision the design source did not anticipate. Receipts:
`kickoff.done` `01KZTG835C356GPN7452603ZZX` · `approval.requested` `01KZTG8B82Q6HT4472Q288GCJ1` ·
`decision.recorded` `01KZTKAF70H19K7PNJVWBXZDT5`.

**The `burn: 0.0d` warning from the other session is ANSWERED.** It said, correctly, that a clock
reading 0.0 means Phase 04's STOP cannot fire on schedule, and that the session which burned the
days must record the real figure. `burn` is now **2.0d**, derived from the calendar (Phase 04
opened 2026-08-12) rather than invented. `board-lint` cross-checks it against `PORTFOLIO.md`.

**Why Phase 04 looks different from the design source's Phase 0.** The source's Phase 0 was law
only — ADRs, the amendment, the runtime pick on paper. This lane's previous cycle closed with its
central claim unproven for exactly one reason: nothing runnable was installed and no credential
existed, and that was discovered at Phase 03 rather than Phase 00. So REQ-00 makes one live
headless invocation a Phase-04 exit criterion. If the runtime cannot run on this machine, EXE-A's
STOP fires at 1 day burned instead of 5.

**CI IS GREEN, AND THAT IS A REAL GREEN.** Runs on `4cae3f8` and `4b52930`: **19/19 jobs**, read
per-JOB. The three windows tests that had been red for two days — `arc-scan`, `baseline`,
`arc-profile` — now report `ok`, **not skip**. That distinction had to be checked: a canary in
`tests/test_helper.bash` makes them SKIP when the scanner cannot flag its own known-positive, so a
green run does not by itself say they ran.

### The opengrep failure, diagnosed twice, and the merge that resolved it

**Two lanes found the same cause independently and pinned to different versions.** ledger
reproduced the detection loss locally with v1.25.0. This lane found a SAME-SHA green/red pair
across the release instant — main `6792091c`, run `31604575944` at 14:02Z GREEN, run `31622490938`
at 17:24Z RED, identical commit and shard list — and measured the windows binary of v1.27.0
exiting **2**, semgrep's FATAL code. `adapters/semgrep.sh` had discarded that status for its whole
life (`>/dev/null 2>&1 || true`), which is why the reason was invisible for two days.

The merge takes **v1.26.0** and ledger's comment: v1.26.0 is what the GREEN run of that pair
actually ran, proven across all three OS legs, and re-proven on `4cae3f8`. See the note in
`.github/workflows/ci.yml` — including ledger's point that a test which SKIPS when the scanner
finds nothing would have hidden the detection loss entirely. Both that and the canary are true;
the canary is a diagnostic only because the pin now exists.

### What is built and green

- **Phase 04** — runtime installed digest-pinned, one live headless invocation, evidence bundle,
  slice ledger filled (13 slices; slice 09, the capped key, recorded CARRIED to Phase 06).
- **Phase 05** — `drivers/hermes` on the real 3-code contract, `type-tagged-hash.mjs`, 47 contract
  tests. `drivers/mock` and the `version` verb were REUSED from the bench lane, not rebuilt.
- **Phase 06 (part)** — `cert-label.mjs`: the certification label is DERIVED, and a mock run is
  structurally incapable of producing one. `data-boundary.mjs`: refused ABOVE the driver at arc-run
  exit 5, ONE confinement function with a test asserting exactly one call site.
  `engine-isolation-cert.bats`: the regression arm, fixtures 1, 2+3, 5, 11, 12.
- **Phase 07 (part)** — `router-row.mjs`: `cap`/`hosted`/`judge`/`review_by` all mandatory on a
  runtime row, enforced at router LOAD, full 16-cell hostile matrix, tenure boundary testable.

### Adversarial passes. Four of them, and PR #184's. They found 60 holes here plus PR #184's set.

Round 3 on `capability-vet.sh`: 24 holes, 16 surviving mutants, two CRITICAL.
Round 4 on the hermes shim: 36 holes, 18 surviving mutants, three CRITICAL.

**The three that matter most, because none was findable by reading the code:**
- `settle()` discarded queued stdout and exited **0** — 8 MiB written, 458752 received. macOS only,
  because node's stdout-to-a-pipe is async there and synchronous on the other two legs. This was in
  `common.mjs` and affected **all five drivers**.
- The container command line was asserted by NOTHING: a driver mutated to run
  `--privileged -v /:/host` with the model input never passed was byte-identical green.
- Three parse holes returned an attacker-chosen or wrong document, including a pretty-printed
  answer yielding a nested FRAGMENT — the likeliest of all to fire in production.

**Five comments in this cycle's own code asserted things the code did not do.** Each is corrected
in place and named in the commit that corrected it. That is worth more than the fixes.

**2026-08-13, PR #184 — the adversarial pass earned its cost before merge.** Two fresh agents on
different surfaces attacked it while CI was green on all 19 jobs, and overlapped on almost nothing.
The shell/OS attacker **reproduced** the motivating failure rather than trusting it (inline
`--payload` + a Windows path → `REJECT BAD_JSON -- invalid escape \U`; `--payload-file` → sealed),
so the payload half shipped. **The gate half was backed out**: `verifyLanded` carried three
independent defects — a UTC/IST day mismatch making it wrong for 22.9% of the clock, a spine-root
rule disagreeing with the emitter, and a `bash -c` scan that **executed** a path component. All
three were survivable as a warning and none as a gate. **CI was green only because it ran at 14:22
UTC, outside the bad window** — the tests passed by clock luck, which is exactly what an
adversarial pass exists to catch and a green suite cannot. Also found and fixed: `--strict` put the
emitter's 15s lock wait inside a 10s SIGKILL, orphaning a node grandchild that sealed the receipt
*after* arc-run reported it lost; `mkdtempSync` sat outside its `try`, so a bad TMPDIR inverted the
fail-closed policy denial into a stack trace; and three of nine test guards **could not fail**.

### OWED, and not counted as done

1. **The runtime ROW in `engine/router.yaml`** — UNBLOCKED as of 2026-08-14. The hire decision is on
   the spine: `approval.requested` `01KZYG5QBAM1ZZQJK7J0ZG13AK` → `decision.recorded`
   **`01KZYG5R1BB8BJ1R4MRFY5SP4M`**, both verified present in
   `.claude/state/hq/events/2026-08-14.jsonl` and absent from `_quarantine/`. ADR-0217's row cites
   that ULID plus the mandate decision `01KZTM348858PDH44K4HA64CVA`. The `hq.policy.yaml` row
   (`"process:build-in-public-draft"`, born L1) and the termination spec ride the SAME change.
2. **The capped key** (REQ-05, and Phase 06 fixtures 4 and 10). Settled path: free models plus an
   UNFUNDED key, so fixture 10 asserts the provider's real HTTP 402 at zero spend. Needs the owner
   to name the ceiling figure BEFORE issuance (ADR-0213 / A-05). Recommended figure: **0**.
3. **Phase 06 fixtures 4, 6, 7, 8, 10** — a live credential, a real container, real egress control,
   two consecutive real runs. Fixture 7 is already recorded PARTIAL: domain-granular egress is
   UNPROVABLE without netns or a proxy sidecar.
4. **The scrubbed transcript per dispatch** (REQ-03) and `run.completed` carrying the MP-F seat.
5. **An adversarial pass on the certification SUITE itself** — the attacker's job is to make a
   fixture pass while the property it claims is false. A Phase 06 exit criterion.
6. **Phase 08 entirely** — the draft process, context packs, and >=3 real runs with verdicts.
7. **The three arc-scan weights in `tests/shard-timings.json` are FAILING-time, not run-time** —
   both weigh runs they came from ran after opengrep broke. Re-measure now that the pin has landed.
8. **ADR-0220's per-invocation model/root seam — OFF THIS CYCLE'S CLOCK, ITS OWN PR.** It unblocks
   **four `bench` Phase 03 DoD items**: one real model benched end to end · candidate proven REACHED
   (real model id, non-zero tokens) · REQ-05 preflight · human verdict. `tests/bench-steel-probe.mjs`
   already pins both failures and **must go RED when the seam lands** — it passes today for the
   wrong reasons. Another lane is waiting on this; it is not engine's to defer quietly.

### Four things a resuming session should not re-learn the hard way

**A test seam must run on all three legs.** The red corpus started as a `.sh` and failed on ubuntu
and macOS with EACCES (mode 100644) and on windows because Node cannot execute a shebang script
there at all. All 33 tests, all three OSes, one cause — and the local check that passed beforehand
had run the fixture through `bash` rather than through the driver.

**A bats file that fails to GATHER takes its whole shard with it.** One unbalanced quote produced
`declared 2435, executed 1` on nine jobs, and the only signal was that count. There is now a test
that shell-parses every `tests/*.bats` the way gather does.

**A green suite can be green by clock luck.** PR #184's gate passed CI at 14:22 UTC and was wrong
for 22.9% of the day. Nothing in the suite could have said so.

**Two lanes will reach for the same missing line on the same day.** It happened twice in this
window: the opengrep pin, and a `.gitattributes` byte-fixture entry both lanes numbered "seventh".
The merge is the only place either of them found out.
