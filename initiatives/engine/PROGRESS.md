# PROGRESS.md — Cycle 7 · arc-engine "The Hired Hands"

status: LIVE
cycle: arc-engine (Cycle 7, opened 2026-08-12)
phase: 04
appetite: 7.5d
burn: 0.0d
blocked-on: —
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

- 2026-08-13 — **`/arc-change --lane engine`: bench cannot vary the model through `arc-run`.** Raised by
  the `bench` lane after Cycle 13 merged (`15a61c7`). Triaged as **three items, not one**, and the
  claims were verified against `arc-run.mjs` directly rather than carried from the report.
  - **The seam → ADR-0220, ruled OUT-OF-CYCLE by the owner.** `arc-run.mjs:402` rebuilds the driver env
    and overwrites two caller-set variables. `ARC_DRIVER_MODEL` is clobbered **on purpose** (lines
    140–145: the env var *was* the model knob, and that was "an un-reviewed tier change of exactly the
    kind ADR-0069 b1 forbids"), so this is a decision, not a bug — the naive fix reopens a closed hole.
    The only surviving pin path needs an `engine/router.yaml` row, and **bench has no write path to the
    router ever** (its own REQ-02 asserts the SHA unchanged before and after every run). `ARC_ROOT` is a
    second defect on the same line: `root` conflates *where arc's machinery lives* with *where the
    driver works*, so a benched `commit-msg-draft` (`git.op: add:*` + `commit:*`) would stage and commit
    **inside the arc repo**. ADR-0069 **(g)** is the door — trials may use any model when isolated and
    receipted. Ships as its own PR, **not charged to this cycle's 7.5 days**, so the day-5 kill
    checkpoint keeps measuring only the hire.
  - **Two `arc-run` emit-path BUGS → charged here, added to `phases/phase-04-spec.md`.** `:279` passes
    `--payload` inline where `arc-event.sh:29` already accepts `--payload-file` — a **twin-fix**, bench
    met the identical defect and closed it on its own path. On Windows a path in a payload returns
    `REJECT BAD_JSON -- invalid escape \U`, so only a failure receipt can be written. And `:278` emits
    `run.completed` without `--strict` (`arc-event.sh:27`): `verifyLanded()` does detect quarantine but
    only **warns to stderr while arc-run exits 0**, so a quarantined receipt reads as a green run —
    a live violation of this plan's "exit 0 is not evidence" non-negotiable.
  - Band check done before claiming `0220`: `technology-ashiq/arc-engine` @ `424f24e` is a stale
    **Cycle 6** branch topping out at `0206`, so `main` was the truth and `0219` the real high-water
    mark. Next engine cycle starts at **0221**.

## Now

**Current position, 2026-08-12: APPROVED. Phase 04 is opening. 0.0 of 7.5 days burned.**

> ⚠ **The `burn: 0.0d` in the machine header above is STALE, and it is the STOP clock.** Phase 04
> opened 2026-08-12; slices 01 and 02 are proven and slice 06 was written, attacked and reverted since.
> That is not zero days. Phase 04's STOP is specified as *"one working day of burn **as recorded in
> `initiatives/engine/PROGRESS.md`**"*, so a clock reading 0.0 means the STOP cannot fire on schedule.
> **No number is invented here** (ADR-0069 b5 / Constitution E3 — absent beats estimated), and
> `board-lint` cross-checks this field against `PORTFOLIO.md`, so the two move together or not at all.
> The session that burned the days records the real figure.

`/arc-kickoff` produced `PLAN.md`, `phases/phase-04-spec.md` through `phase-08-spec.md`, and twelve
ADRs (0208–0219) covering EXE-A…K plus one decision the design source did not anticipate. Receipts:
`kickoff.done` `01KZTG835C356GPN7452603ZZX` · `approval.requested` `01KZTG8B82Q6HT4472Q288GCJ1` ·
`decision.recorded` `01KZTKAF70H19K7PNJVWBXZDT5`.

**All spine writes go through the canonical clone at `E:/Work_Hub/01_Automemory/arc`.** This worktree
has its own gitignored spine and the emitter refuses to write there — a receipt written in a worktree
is real, valid, and invisible to `arc-inbox`, which would print "no open approvals" while one sat in
it.

**Phase 04 is running.** Slice 01 proven (the mandate is on the spine, two events, verified out of
`_quarantine/`). Slice 02 (ADR-0212 to `main`) is PR #165, CI green 19/19 at `f4da3cc`, re-running
after a merge from `main` that resolved a real `PORTFOLIO.md` collision with two lanes that landed
mid-flight.

**Slice 06 is BLOCKED and the reason is named.** A change was routed via `/arc-change` as a bug —
`capability-vet.sh` advertises OCI digest support and the path is unreachable — then **written,
attacked, and reverted** (`a1148f7` → `8f4c3d2`). The two-surface adversarial pass earned its cost
immediately: the fix had **regressed a pinned hole** (`record.name` is the package name in
npm/PyPI/git, so a packument publishing only `0.0.1` admitted a pin of `1.2.3`), its central
justification was **factually wrong** (SRI is base64-44, OCI is hex-64 — a faithful re-notation
never normalises to a match), it wrote an **unverified tag coordinate** into the production lock,
and **four mutants of the added lines survived all 55 tests**. Reverted rather than patched, because
the OCI path also has **no name binding** — a Docker Hub tag body carries no repository identity, so
one recorded response certifies any allowlisted name, and closing that needs a design call.

The same pass found **four criticals that predate this cycle and survive the revert**, including a
**content-scan bypass by filename** verified on the real script: a candidate placing hostile code in
`src/registry.json` gets `PASS — read-only`, exit 0. All filed as **issue #167**.

**The runtime is therefore pinned and verified out-of-band, and NOT gate-admitted.** The allowlist
entry and lock row were reverted with the change. Nothing is admitted that the gate cannot stand
behind.

**The capped-key ceiling figure is NOT needed yet.** Phases 04, 05 and 06 all run at zero spend
against the local ollama endpoint; the credential is first required by certification fixtures 4 and
10. That owner decision can wait without blocking anything.

**Of the three owner acts that gated Phase 04, two are done and the third is deferred.** The Docker
daemon is up (`29.6.1`, linux/WSL2, verified before the approval was recorded). The runtime is
obtained by Phase 04 itself, as a digest-pinned container image. The capped-key ceiling figure is
still unnamed and deliberately so — see above; nothing blocks on it until Phase 06.

**Why Phase 04 looks different from the design source's Phase 0.** The source's Phase 0 was law only
— ADRs, the amendment, the runtime pick on paper. This lane's previous cycle closed with its central
claim unproven for exactly one reason: nothing runnable was installed and no credential existed, and
that was discovered at Phase 03 rather than Phase 00. So REQ-00 makes one live headless invocation a
Phase-04 exit criterion. If the runtime cannot run on this machine, EXE-A's STOP fires at 1 day
burned instead of 5.

**Next action (2026-08-13).** Two tracks, deliberately separate so the cycle clock stays honest:

1. **In Phase 04, on this cycle's clock** — build the two emit-path fixes now in
   `phases/phase-04-spec.md`: `--payload-file` and `--strict`. Both are wiring to flags
   `arc-event.sh` already supports. They carry a **bounded** adversarial pass on the emit path before
   their PR merges (not the full two-surface panel), and the twin-fix instruction is to grep the
   pattern across every **other** emit call site in this lane and record the count checked.
2. **Off the clock, its own PR** — ADR-0220's per-invocation model/root seam. Unblocks four `bench`
   Phase 03 DoD items: one real model benched end to end · candidate proven REACHED (real model id,
   non-zero tokens) · REQ-05 preflight · human verdict. `tests/bench-steel-probe.mjs` already pins both
   failures and **must go red** when the seam lands — it passes today for the wrong reasons.
