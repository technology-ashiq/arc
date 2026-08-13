# PROGRESS.md — Cycle 7 · arc-engine "The Hired Hands"

status: LIVE
cycle: arc-engine (Cycle 7, opened 2026-08-12)
phase: 04
appetite: 7.5d
burn: 2.0d
blocked-on: the hire decision (a spine receipt this worktree cannot emit) and the capped-key ceiling figure — see ## Now
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Cycle 6 is archived at `archive/PLAN-cycle6-2026-08-03.md` and
> `archive/PROGRESS-cycle6-2026-08-03.md`; its phases 00–03 stay on disk and Phase 00 is carried
> here as a parked row. This cycle claims **ADR 0208–0219**. `0207` was written by the `memory` lane
> on 2026-08-11 **with the owner's approval** (retiring a migration proof is an engine decision) —
> sanctioned, not a stray — but invisible from this worktree, and it surfaced only by checking
> sibling worktrees before numbering.
> Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`) stay at root
> and are never copied here (ADR-0053); evidence is lane-scoped at
> `initiatives/engine/evidence/phase-NN/` (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-executor.md` v2.0 (frozen — the decision record, not the
> cycle). Model policy is inherited from `docs/adr/0069-balanced-model-policy.md`, amended for
> runtimes by ADR-0212.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — **parked, shipped in Cycle 6** (canonical process layer, `arc-run`, driver contract, `router.yaml`) | — | ✅ done 2026-08-03 |
| 04 | The law, and proof the hands exist — mandate receipt, ADR-0212 merged, runtime installed behind a container backend, ONE live headless invocation, **or the STOP fires** | 1 day | pending |
| 05 | The shim — `drivers/hermes` on the real 3-code contract, `drivers/mock` replay, two-surface adversarial pass on the output parser | 1.5 days | pending |
| 06 | **Certification or STOP** — 12 fixtures green against the real runtime with receipts, plus the scrubbed-transcript evidence path | 2 days | pending |
| 07 | The hire — ONE reviewed `router.yaml` diff carrying the policy row and termination spec, the capped key, the calibration baseline | 1 day | pending |
| 08 | The job — draft process authored, context-pack flow, ≥3 real runs with per-draft verdicts, a hand-written results table, retro and seal | 1.5 days | pending |

**Appetite burn: 0.0 of 7.5 days used (0%).** Phases allocate 7 of 7.5 — **93%, and the half-day of
slack is thin**, flagged by `kickoff-lint` and left honest rather than padded. The design source's
"1.5 weeks (8 working days)" rounds up: 1.5 weeks is 7.5 working days at a 5-day week, so the cap is
written as the smaller, true number. Kill checkpoint is read at **day 5**, not at the 50% mark of
3.75 — 50% falls inside Phase 06 while it is still on schedule, and a tripwire that fires on an
on-track run is one that learns to be ignored.

## Done log

- 2026-08-12 — `/arc-kickoff --lane engine`. Cycle 6 archived; `PLAN.md`, 5 phase specs and **ADRs
  0208–0219** written; `kickoff-lint` green. **No code.** Awaiting owner approval.
  - Owner answered three forks in-session: **Hermes Agent, container-backed** (EXE-A) · **OpenRouter
    capped key** (EXE-F) · **arc's own build-out journey** as the draft subject (REQ-07).
  - Four agents ran before the plan was written — a codebase survey and three researchers (runtime
    scorecard, agent-runtime supply-chain threat model, hard-capped credential landscape).
  - **Five drift items** found against the design source's 2026-08-09 snapshot, the largest being
    that the ENG-D exit map it calls "inherited" **does not exist** — the real contract is
    `{ OK: 0, DRIVER_FAIL: 1, BUDGET_DECLINED: 2 }` and there is no data-boundary concept at any
    layer, while the certification suite asserted `exit 5` twice. Resolved by ADR-0219 rather than
    discovered in Phase 05.
  - **The two researchers disagreed** on the chosen runtime's security record and the disagreement is
    recorded rather than averaged: one found ≥12 aggregator CVEs with vendor silence, the other
    fetched the vendor's advisories page live and found zero published. Recorded in ADR-0208's
    Evidence and Confidence lines and in the rabbit holes.
  - **Attack panel: 3 fresh agents, 21 findings, 19 accepted, 1 rejected, 1 stale.** The four that
    mattered were ordering defects: the capped credential was provisioned a phase *after* the
    fixtures that consume it (which could have fired the STOP for a scheduling bug rather than an
    isolation gap); the data-boundary mechanism was certified in Phase 06 but built in Phase 08; the
    adversarial pass was bound to the phase close rather than the shipping PR; and the pre-decided
    cut named an artifact no spec produced. Rejected: bumping Phase 06 to 2.5d — `out-of-appetite`.
  - **Simulation gate: 18 blockers on round 1, 6 live on round 2** (a seventh was already closed by an
    edit the simulator did not see). Two non-zero rounds is the gate's escalation point. All six were
    mechanical rather than judgement calls and were closed — the spine-payload contract, the vetting
    OK format and date, the wait protocol for owner acts, the appetite clock epoch and unit, the CI
    shard-timing and count-floor mechanics, and the STOP record location. **They are closed but NOT
    re-verified by a third simulator round**, because the gate permits one respawn. Round-1 count for
    the retro scoreboard: `sim-blockers-r1 18`.
  - **One defect caught that would have quarantined a receipt:** `decision.recorded` is not a
    standalone kind. Its payload is closed to `decides`/`verdict`/`reason`, and `decides` must be the
    ULID of the `approval.requested` it decides. The design source, the Phase 0 description and the
    first draft of this spec all had the mandate landing as a single `decision.recorded` — which
    exits 0 and quarantines silently, this lane's own recorded failure.

- 2026-08-12 — **pre-approval runnability recon** (no install, no execution). Verdict **RUNNABLE
  HERE**: Windows is Tier 1 native for this runtime, no WSL needed for the headless CLI, and
  `hermes -z` is confirmed verbatim as single-prompt-in / final-response-out with a usage sidecar
  written even on failure. Two things changed as a result, landed as dated pre-approval amendments to
  ADR-0208 and ADR-0209 rather than silent edits:
  - **Tag `v2026.8.3` carries `assets: []`** — nothing attached — and the npm and PyPI channels were
    retired in that same release, while `install.ps1` is not a tracked file at the tag and is served
    live from the docs site defaulting to *latest*. A host `curl`-pipe install would be unpinnable
    and the worst available shape for this runtime. **The runtime is therefore obtained as a container
    image and the digest is the pin** — the one content-addressable handle the vendor offers.
  - **Ollama defaults to as little as 4,096 tokens of context against the ≥64,000 this runtime
    expects, and truncates silently rather than erroring.** Phase 04 raises it explicitly.
- 2026-08-12 — **plan APPROVED by Ashiq.** Docker Desktop started and verified up (`29.6.1`,
  linux/WSL2). Approval recorded on the canonical spine against `01KZTG8B82Q6HT4472Q288GCJ1`;
  decision receipt `01KZTKAF70H19K7PNJVWBXZDT5`, verified present in `events/` and absent from
  `_quarantine/`. Lane flips IDLE → LIVE and Phase 04 opens.

## Now

**Current position, 2026-08-13: Phases 04 and 05 built and CI-green; 06 and 07 partly built; the
rows that need a spine receipt or a credential are named below and are NOT counted as done.**

### HANDOFF — read this first if you are resuming

Everything is committed and pushed. Branch `technology-ashiq/arc-executor`, **PR #172 open**.
Nothing lives only in a session.

**CI IS GREEN, AND THAT IS A REAL GREEN.** Run on `4cae3f8`: **19/19 jobs**, read per-JOB. The
three windows tests that had been red for two days — `arc-scan`, `baseline`, `arc-profile` — now
report `ok`, **not skip**. That distinction matters and was checked: a canary in
`tests/test_helper.bash` makes them SKIP when the scanner cannot flag its own known-positive, so
a green run had to be inspected to tell passing from skipping.

**The two-day CI failure was an UNPINNED opengrep, and neither of the two explanations previously
written down was right.** Main SHA `6792091c` ran arc-ci twice across 2026-08-12T14:55:32Z — run
`31604575944` at 14:02 GREEN, run `31622490938` at 17:24 RED — identical commit, identical shard
list, identical runner. opengrep v1.27.0 published in between and its windows binary exits 2
(semgrep's FATAL code). `adapters/semgrep.sh` had discarded that status for its whole life
(`>/dev/null 2>&1 || true`), which is why nobody could see the reason. The owner applied the pin
to v1.26.0 across four workflow files; `.github/` is outside the assistant write scope.

### What is built and green

- **Phase 04** — runtime installed digest-pinned, one live headless invocation, evidence bundle,
  slice ledger filled (13 slices; slice 09, the capped key, recorded CARRIED to Phase 06).
- **Phase 05** — `drivers/hermes` on the real 3-code contract, `drivers/type-tagged-hash`,
  47 contract tests. `drivers/mock` and the `version` verb were REUSED from the bench lane, not
  rebuilt — the pre-edit collision check caught that before a line was written.
- **Phase 06 (part)** — `cert-label.mjs`: the certification label is DERIVED, and a mock run is
  structurally incapable of producing one. `data-boundary.mjs`: the boundary is refused ABOVE the
  driver at arc-run exit 5, ONE confinement function with a test asserting exactly one call site.
  `engine-isolation-cert.bats`: the regression arm, fixtures 1, 2+3, 5, 11, 12.
- **Phase 07 (part)** — `router-row.mjs`: `cap`/`hosted`/`judge`/`review_by` all mandatory on a
  runtime row, enforced at router LOAD, with the full 16-cell hostile matrix (four malformed
  shapes per field) and a tenure boundary check whose clock is a parameter.

### Four adversarial passes ran. They found 60 holes.

Round 3 on `capability-vet.sh`: 24 holes, 16 surviving mutants, two CRITICAL.
Round 4 on the hermes shim: 36 holes, 18 surviving mutants, three CRITICAL. The two surfaces
overlapped on almost nothing, which is the structural-blind-spot claim measured rather than
asserted. All fixed and pinned as fixtures.

**The three that matter most, because none was findable by reading the code:**
- `settle()` discarded queued stdout and exited **0** — 8 MiB written, 458752 received. macOS
  only, because node's stdout-to-a-pipe is async there and synchronous on the other two legs.
  This was in `common.mjs` and affected **all five drivers**.
- The container command line was asserted by NOTHING: a driver mutated to run
  `--privileged -v /:/host` with the model input never passed was byte-identical green.
- Three parse holes returned an attacker-chosen or simply wrong document, including a
  pretty-printed answer yielding a nested FRAGMENT — the likeliest of all to fire in production.

**Five comments in this cycle's own code asserted things the code did not do.** Each is corrected
in place and named in the commit that corrected it. That is worth more than the fixes.

### OWED, and not counted as done

1. **The runtime ROW in `engine/router.yaml`.** ADR-0217 requires it to cite the decision that
   made the hire, and that decision is a spine receipt this worktree cannot emit — the emitter
   refuses by design, and a receipt written here is real, valid and invisible to `arc-inbox`.
   Writing a row citing a ULID that does not exist would be a fabricated reference. **Emit the
   hire decision from `E:/Work_Hub/01_Automemory/arc`, then the row lands with its ULID.** The
   `hq.policy.yaml` row and the termination spec ride the SAME change.
2. **The capped key** (REQ-05, and Phase 06 fixtures 4 and 10). Settled path: free models plus an
   UNFUNDED key, so fixture 10 asserts the provider's real HTTP 402 at zero spend. Needs the
   owner to name the ceiling figure BEFORE issuance (ADR-0213 / A-05).
3. **Phase 06 fixtures 4, 6, 7, 8, 10** — a live credential, a real container, real egress
   control, two consecutive real runs. Fixture 7 is already recorded PARTIAL: domain-granular
   egress is UNPROVABLE without netns or a proxy sidecar.
4. **The scrubbed transcript per dispatch** (REQ-03) and `run.completed` carrying the MP-F seat.
5. **An adversarial pass on the certification SUITE itself** — the attacker's job is to make a
   fixture pass while the property it claims is false. Phase 06 lists it as an exit criterion.
6. **Phase 08 entirely** — the draft process, context packs, and >=3 real runs with verdicts.
7. **The three arc-scan weights in `tests/shard-timings.json` are FAILING-time, not run-time** —
   both weigh runs they came from ran after opengrep broke. Re-measure now that the pin has
   landed.

### Two things a resuming session should not re-learn the hard way

**A test seam must run on all three legs.** The red corpus started as a `.sh` and failed on
ubuntu and macOS with EACCES (mode 100644) and on windows because Node cannot execute a shebang
script there at all. All 33 tests, all three OSes, one cause — and the local check that passed
beforehand had run the fixture through `bash` rather than through the driver.

**A bats file that fails to GATHER takes its whole shard with it.** One unbalanced quote produced
`declared 2435, executed 1` on nine jobs, and the only signal was that count. There is now a test
that shell-parses every `tests/*.bats` the way gather does.
