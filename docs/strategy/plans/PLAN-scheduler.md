# PLAN — scheduler · "the heartbeat" — v1.0

> **STATUS: kickoff-grade — landed owner-instructed from a Cowork session, 2026-08-09.**
> Decisions are letters (SCH-A…L); real ADR numbers are assigned at kickoff from the
> century claimed per `PORTFOLIO.md` — never here. Owner-facing choices that remain open
> are §13 "Open decisions at kickoff". Provenance: `docs/archive/BRIEF-scheduler.md`
> (2026-07-22, superseded by this plan in the same drop) + four review rounds in one
> Cowork session, 2026-08-03 → 2026-08-09 (repo-grounded analysis · idea round I1–I16 ·
> self-critique W1–W5/A1–A6 · doc-pass round 4, defects D1–D4 + gaps G1–G3 fixed).
>
> **Trigger: CONVERTED — FIRED under the owner's Build-out Mandate (2026-08-09).** The
> brief's pull trigger (first L3 process / manual-start pain) asked for a receipted need;
> the mandate IS the receipted decision — arc build-out is the sole priority, ventures
> deprioritized, no trigger-waiting (same `decision.recorded` receipt as PLAN-executor's
> conversion; cite it in this kickoff's ADRs — A8's letter holds). Honesty note: no
> manual-start-pain receipt exists and none is invented — the proving week's actor-query
> metric (§8) starts the honest baseline instead.
>
> **The hard prerequisite is unchanged — and now MET.** "No policy = no unattended runs"
> survives intact: the policy engine is LIVE (lane `policy`, Cycle 9, merged `677b67e` /
> PR #130 on 2026-08-08; POL-A…J). Phase 2 still VERIFIES enforcement fixtures green at
> its gate — fail-closed, never assumed (C9's own phase 04 sits open on three owner
> `settings.json` edits; the gate check covers whatever remains).
>
> **Appetite: Tier S — 3 days effort** (elapsed longer: Phase 3 is a real proving week).
> Kill trigger: Phase 0 not green within 1.5d → stop and reassess (§9).

---

## 0. One-liner

A jobs file in git + one wrapper + the OS's own scheduler = every daily chore becomes a
receipted, budgeted, policy-checked headless run — **arc stays daemon-free, the spine
records everything, and silence becomes visible.**

## 1. Current state this plan rides on (verified 2026-08-03 · policy/mandate state re-verified 2026-08-09)

**Exists — reuse, never rebuild:**

| Piece | Where | What this plan takes from it |
|---|---|---|
| Headless runner | `.claude/scripts/engine/arc-run.mjs` | `--process --driver auto --budget inr=N,min=M`; budget stop (no fallback past cap); contract ladder retry-once → `approval.requested` proposal → stop (ADR-0204); tier pinning via `engine/router.yaml` |
| Driver retry layering | ADR-0203 | transport retries (≤2) live in drivers; contract retry (1) in arc-run — **the scheduler adds zero retries** |
| **Policy engine** | lane `policy` C9 — merged `677b67e` / PR #130, 2026-08-08 · `PLAN-policy.md` POL-A…J | the `hq.policy.yaml` action-kind vocabulary this plan's `policy_kind` field validates against · the ONE shared zero-dep policy library (POL-D: `authorizeAction`, `reserveSpend`, …) the wrapper calls — never a second implementation · fail-closed enforcement at `arc-run` + hooks |
| Spine + vocabulary | `.claude/scripts/hq/` · ADR-0026 lineage (count = live `KINDS.length`, ADR-0107 derived-count rule) | `run.completed`, `incident.raised`, `approval.requested`, `note.logged` — all four predate every extension: **zero NEW kinds needed for the scheduler** |
| Idem dedupe + quarantine surfacing | C2 spine · ADR-0032 | duplicate idem → quarantine + SKIP, surfaced not silent — reused for double-fire protection |
| Proven lock | `hq/lib/spine-io.mjs` `withLock` (post-#89) | the overlap lock **reuses this discipline** — a second, hand-rolled lock is banned |
| Brief renderer | `hq/arc-brief.mjs` | deterministic by construction, golden-fixtured, groups incl. needs-you — the jobs panel extends it |
| YAML subset parser | `.claude/scripts/engine/yaml-subset.mjs` | `hq.jobs.yaml` uses the same subset + same parser (A5 — no second parser class) |
| Lanes machinery | ADR-0050..0062, `lane-resolve` | kickoff is lane-native: `/arc-kickoff --lane scheduler` |
| Constitution | root `CONSTITUTION.md`, LAW since 2026-08-06 | A8 satisfied via the mandate receipt; A9 live-slot discipline gates the kickoff (§13) |

**Job reality:** the processes in `processes/` are interactive dev commands (verify the
current list at kickoff) — unschedulable. Every honest v1 job is a **deterministic
script** (₹0 LLM cost). The brief's implicit "jobs = LLM processes" picture is widened
accordingly (SCH-B) — deviation-on-record #1.

**Deviation-on-record #2:** the brief's kickoff prompt said "policy engine MUST be live —
verify, else STOP" as a kickoff gate. Policy is now live, so the letter is satisfied; this
plan keeps the CHECK but moves its bite to Phase 2 (the first unattended surface), where
it belongs — attended runs (Phases 0–1) are human-started runs, exactly as legal as
today's manual invocations.

## 2. Scope

**IN (v1):** `hq.jobs.yaml` + jobs-lint · one wrapper (`arc-jobs`) with run/catchup/list/
register/unregister · script-jobs AND process-jobs · receipts + idem@slot · per-job
overlap lock · missed-run detection in the brief · Windows Task Scheduler registration +
smoke · proving week with fire-drill · retro metric pack.

**OUT (v1) — see §10 rejected registry:** job dependency graphs · scheduler-layer retries ·
GH Actions for spine-receipted jobs · dynamic/runtime job creation · multi-machine ·
push-notification infra · full cron grammar · job history UI · per-job env overrides ·
money-touching jobs (banned by lint, not merely out of scope).

## 3. Decision record — SCH-A … SCH-L

Each entry: the decision, why, and its source round. ADR numbers at kickoff.

**SCH-A — External trigger only; Windows Task Scheduler primary; GH Actions excluded for
spine-receipted jobs.** No daemon inside arc, ever (the mold's no-daemon stance stands).
Registration targets Windows Task Scheduler (the machine that owns the spine); POSIX cron
documented for consumer repos. GH Actions cron is **rejected for any job that must land
receipts**: ADR-0025 puts the spine in instance state (`.claude/state/hq/`), so CI-run
receipts land on a throwaway runner spine — REQ-visible dishonesty. Boundary clarified:
repo-only automation (e.g. a nightly lint on main) is ordinary CI territory and never
enters `hq.jobs.yaml`. *(Round 1 F1 + Round 3 A4.)*

**SCH-B — `hq.jobs.yaml` is git-tracked config with a closed schema and a hostile lint.**
Repo root, same YAML subset as the engine, parsed by the SAME `yaml-subset.mjs` (A5).
Schema v1:

- top-level: `version: 1` · `monthly_ceiling_inr: <int>` · `defaults: {catchup: skip}`
- per job: `name` (`[a-z][a-z0-9-]*`, unique) · `type: script | process` ·
  `entry` (script: a path **inside `.claude/scripts/hq/jobs/` only**; process: a
  `processes/` name) · `budget` (`min:` mandatory for ALL; `inr:` mandatory for
  process-jobs, **forbidden** for script-jobs) · `policy_kind` (mandatory; must name a
  kind present in the LIVE `hq.policy.yaml` — deny-by-default means an absent kind is a
  lint FAIL, never a warning) · `cadence` · `enabled: true|false` · optional
  `catchup: run|skip`.
- **cadence grammar is closed and small:** `daily@HH:MM` | `weekdays@HH:MM` (IST fixed —
  the spine's TS is +05:30 by schema, no timezone knob exists to misconfigure). Full cron
  expressions are rejected: that is a parser-class rabbit hole.

`jobs-lint` exits 2 on: bad cadence · unknown process/script · entry outside the allowed
dir · missing/forbidden budget keys · duplicate names · **spend-capability policy_kind**
(hardcoded v1 ban list on top of policy's own law — money-touching jobs are unschedulable,
full stop) · **credential-looking values** (key/token/secret patterns) ·
**self-modification**: no entry may write to `hq.jobs.yaml` or `.claude/scripts/**` (a
job that can edit the schedule or the code is a persistence mechanism) · **ceiling
breach**: worst-case month = Σ(job `inr` × slots/month) must be ≤ `monthly_ceiling_inr` —
**runaway spend is killed at lint time, before any run exists**. `jobs-lint --bill`
prints the worst-case month. Hostile fixtures pinned; parser-class ⇒ adversarial pass
before Phase 1 (standing rule). *(Brief REQ-1 + Round 2 I8/I13/I1/I2 + Round 3 W1 cuts.)*

**SCH-C — One wrapper, one enforcement path.** `.claude/scripts/hq/arc-jobs.mjs`
(hq product; thin `.sh` entry per ADR-0031 shape). Surfaces: `run <name>` · `catchup` ·
`list` (incl. `--next 7` — the coming week's slot timetable, so the schedule is
inspectable before and after registration) · `register` · `unregister`. Every execution,
attended or scheduled, walks the same path: **lock → guards → execute → receipt**.
Authorization goes through the SHARED policy library (POL-D) — the wrapper never grows a
second interpretation of policy. Process-jobs delegate to `arc-run` unchanged (same
budget flags — a scheduled job can not exceed what a manual run of the same kind could;
fixture-proven). Script-jobs are spawned with the `min` budget as a hard timeout. Guards:
git-state (MERGE_HEAD / rebase in progress → skip + `note.logged`, never run on a
half-edited tree) · policy (SCH-G). The overlap lock is **per job** — two different jobs
at the same minute are legal; only a job overlapping ITSELF is blocked (round-4 fix D4) —
and it reuses the spine's `withLock` discipline; the second instance exits loud (exit 2)
and leaves a receipt. *(Brief REQ-2/3 + Round 2 I3/I5 + F5.)*

**SCH-D — The scheduler layer owns ZERO retries.** ADR-0203 (transport, in-driver) and
ADR-0204 (contract, in arc-run, terminating in a proposal receipt) already own the retry
ladder; a scheduler-side retry would multiply ladders — that is precisely the retry storm
the brief bans. The brief's "one retry max" is recorded as already spent inside arc-run.
A failed run's natural retry is the next cadence slot. **Deviation-on-record #3** (the
brief predates the engine ADRs). *(Round 1 F2.)*

**SCH-E — Receipts and their identity.** Every run emits `run.completed` via the standard
emitter: `actor: scheduler:<job>` for scheduled fires, the session actor for attended ones
— which makes REQ-06's "zero manual starts" **a spine query, not a diary claim**, and
"manual starts per week trending to zero" the module's own success metric. Payload:
`job`, `scheduled_for`, `started_at` (drift visible), `duration_ms`, `outcome`, plus
arc-run's own fields for process-jobs. **Idem = `<job>@<scheduled_for>`** — a double-fire
(Task Scheduler wake quirks) becomes a dup-idem quarantine event, surfaced by the existing
ADR-0032 path, never a silent second run. Slot identity is computed by the wrapper:
normal fire floors to the nearest slot; `catchup` targets the MISSED slot explicitly
(internal `--slot`) — without this the idem key lies. Round-4 fix D3 — the `catchup:`
FIELD governs only AUTOMATIC late-firing (Task Scheduler's run-when-available); the manual
`arc-jobs catchup` COMMAND runs every overdue job regardless of the field: a human asking
is human intent, and the receipt's actor records exactly that. `incident.raised` mapping
(closed): crash / receipt-write failure · lock overlap (first per job per day; repeats
supersede) · budget-declined. A contract failure raises nothing extra — arc-run's
`approval.requested` already lands in needs-you; double-raising would teach the needs-you
group to be ignored. *(Brief REQ-2 + Round 2 I4/I5 + Round 3 W2/W3.)*

**SCH-F — Missed-run detection is a reader-side derivation, and it must stay
deterministic.** Silence emits nothing, so the detector cannot live at the emitter. The
brief's jobs panel derives per job: last run, next expected, overdue state — as a **pure
function of (date, `hq.jobs.yaml`, spine events ≤ that day)**. `Date.now()` is banned in
the panel: the brief's `--date D` replay is byte-deterministic and golden-fixtured, and a
wall-clock dependency would break both. Overdue > 2× cadence ⇒ a needs-you line ("job X
silent since …"). `enabled: false` jobs render as *disabled* and are never counted
overdue — a deliberate off is not a silent death (round-4 fix D2). **Residual risk on the
record:** a dead heartbeat is only visible when a brief renders; mitigation is Task
Scheduler's own on-failure action (OS toast — outside arc, configured not built).
*(Brief REQ-4 + Round 1 F4 + Round 3 W4 + A4-line.)*

**SCH-G — Policy interlock: fail-closed, verified, never assumed.** The policy engine is
LIVE (C9) — so from Phase 0 the wrapper authorizes every job through the shared POL-D
library, deny-by-default, and `jobs-lint` validates every `policy_kind` against the live
`hq.policy.yaml`. `register` (the unattended surface) additionally requires the policy
enforcement fixtures GREEN at registration time and **refuses with exit 2** otherwise —
so if policy were ever rolled back or its fixtures went red, the heartbeat's unattended
half turns itself off rather than running unpoliced. The brief's invariant — headless
runs MUST be policy-checked — survives intact, now with the real mechanism under it.
*(Brief non-negotiable + Round 2 I15 + re-grounded 2026-08-09 against PLAN-policy/C9.)*

**SCH-H — Staircase build order: attended value first, cron flip last.** Phases 0–1
deliver a usable attended heartbeat (one command runs everything due; a SessionStart
nudge tells you when things are due). Phase 2 (registration = unattended) runs the SCH-G
gate check. The staircase is kept even with policy live — it is a risk gradient (the
unattended surface lands on machinery already proven attended), not a waiting room.
Hard line, lintable: the SessionStart fragment may READ and PRINT ("2 jobs overdue — run
`arc jobs catchup`") and may never execute a job — otherwise the nudge grows into a
back-door daemon. *(Round 2 I15 + Round 3 A5.)*

**SCH-I — v1 job set: script-jobs only, ₹0/month.**
1. `brief-materialize` — `weekdays@06:00`; renders today's brief to
   `.claude/state/hq/briefs/<date>.txt` (instance state, never the repo) so the morning
   read is zero-effort.
2. `day-close-roll` — `daily@00:15`, `catchup: run`; seals the most recent UNSEALED
   day(s): at 00:15 D−1's events are complete, a late seal beats no seal, and the roll is
   idempotent + multi-day so slept-through nights are caught up (ADR-0029 day-close sha —
   exact CLI verified at kickoff). **The heartbeat's first duty is sealing the books**,
   which turns tamper-evidence from an occasional act into a daily fact. *(Round-4 fix
   D1: the earlier `23:30` + default-skip draft both missed the 23:30–00:00 tail and let
   a slept-through night skip a seal silently.)*
3. `lexos-canary` *(candidate, owner call)* — `daily@08:00`; HTTP probe of
   lexos-bay.vercel.app (status + latency + cert window), failure ⇒ `incident.raised`.
The first process-job enters the file only when a daily-value process exists.
*(Brief REQ-5 needs ≥2 jobs; Round 1 F7.)*

**SCH-J — Windows registration is specified, not improvised.** `register` writes the Task
Scheduler entry with: absolute node path · cwd = repo root · "run when available"
battery/AC and wake settings **explicitly decided and recorded** (defaults silently skip
on battery — the #1 real-world silent-death cause) · task runs as the logged-in user.
Registration smoke test: register a next-minute throwaway job → receipt lands → unregister
— pinned as a fixture-backed runbook. AV/OneDrive interference on E: documented.
*(Round 2 I10/I11.)*

**SCH-K — One cross-lane enabler, named AND deferred.** arc-run today sets the receipt's
actor itself; a SCHEDULED process-job will need an actor passthrough (`--actor` flag or
`ARC_RUN_ACTOR` env — engine band, one small reviewed diff). **This is NOT a v1
dependency** (round-4 G1): v1 jobs are all script-jobs (the wrapper emits its own
receipts), and the process-delegation path is proven in Phase 0 against the engine's mock
driver in fixtures only. The engine diff is owed at the FIRST LIVE process-job, not
before — **this cycle touches zero engine code.** *(Round 3 W3 + Round 4 G1.)*

**SCH-L — The proving week proves the DETECTOR, not just the happy path.** During Phase 3,
one job's OS registration is deliberately removed for ≥1 day while `hq.jobs.yaml` still
says `enabled: true` — exactly the real silent-death shape: the file promises, the OS has
quietly stopped. The missed-run needs-you line MUST appear and is captured in evidence —
the smoke detector is tested with smoke. (Round-4 fix D2: disabling in the yaml would NOT
do — `enabled: false` legitimately suppresses overdue per SCH-F, so a disable-based drill
would test nothing.) The retro metric pack is pre-declared (§8) so the week cannot be
graded on vibes afterwards. *(Round 3 A1/A2.)*

## 4. REQ table (all measurable)

| REQ | Statement | Acceptance |
|---|---|---|
| REQ-01 | `hq.jobs.yaml` schema + `jobs-lint` (incl. ceiling, self-mod ban, creds ban, spend-kind ban, entry-dir allowlist, live-policy_kind validation) | hostile fixtures pinned (≥12 classes) all exit 2 · adversarial pass report committed · `--bill` prints worst-case month |
| REQ-02 | One wrapper, parity + lock + guards | fixtures: per-job overlap → loud exit 2 + receipt · scheduled run cannot exceed manual same-kind (byte-compared enforcement outcomes; process path via the engine's MOCK driver) · git-state skip · slot floor + catchup `--slot` correctness · catchup command overrides catchup field · authorization via the shared POL-D library only (grep-lint: no second policy read) |
| REQ-03 | Receipts + identity | every run = `run.completed` (actor, job, scheduled_for, started_at, outcome) · double-fire fixture → dup-idem quarantined AND surfaced · incident mapping fixtures (crash, overlap, budget) |
| REQ-04 | Unattended registration (Windows) | register/unregister scripts + settings recorded · next-minute smoke green · `register` refuses (exit 2) unless policy enforcement fixtures are green — fail-closed if policy is ever rolled back (fixture) |
| REQ-05 | Brief jobs panel | last/next/overdue per job · pure f(date, jobs, spine) — replay `--date D` byte-identical, golden pinned · overdue >2× cadence ⇒ needs-you line · yaml-disabled jobs shown as *disabled*, never overdue |
| REQ-06 | Proving week | ≥2 jobs · **zero manual starts proven by actor query** · all receipts on spine · gap audit clean |
| REQ-07 | Fire-drill | one job's OS task removed ≥1 day mid-week (yaml still `enabled: true`) → needs-you line captured in evidence |
| REQ-08 | Evidence + retro | metric pack (§8) computed from the spine only · retro run · TRIAL promotions reviewed |

## 5. `hq.jobs.yaml` — concrete example

```yaml
version: 1
monthly_ceiling_inr: 0        # v1 is all script-jobs; raised by reviewed diff when
                              # the first process-job enters
defaults:
  catchup: skip

jobs:
  - name: brief-materialize
    type: script
    entry: .claude/scripts/hq/jobs/brief-materialize.mjs
    budget: { min: 2 }
    policy_kind: report.compile     # must exist in the live hq.policy.yaml (SCH-B)
    cadence: weekdays@06:00
    enabled: true

  - name: day-close-roll
    type: script
    entry: .claude/scripts/hq/jobs/day-close-roll.mjs
    budget: { min: 2 }
    policy_kind: ledger.seal
    cadence: daily@00:15          # seals D-1 (its events are complete by then)
    enabled: true
    catchup: run                  # a late seal beats no seal; roll is idempotent

  - name: lexos-canary            # owner call — candidate job #3
    type: script
    entry: .claude/scripts/hq/jobs/lexos-canary.mjs
    budget: { min: 3 }
    policy_kind: ops.probe
    cadence: daily@08:00
    enabled: false                # flipped on at Phase 3 if approved
    catchup: run                  # a late canary is still worth running
```

*(The three `policy_kind` values are placeholders — Phase 0 aligns them with the kinds the
live `hq.policy.yaml` actually declares, adding rows there via policy's own process if
needed. Deny-by-default: no row, no job.)*

## 6. Phases (3d effort total)

**Phase 0 — the law and the wrapper core (1d).**
Schema + `jobs-lint` (all §3 SCH-B rules, incl. live-policy validation) + hostile corpus +
**adversarial pass** · wrapper core: per-job lock (withLock reuse), slot computation,
receipts + idem@slot, git-state guard, POL-D authorization, script-job timeout,
process-job delegation (mock-driver fixtures).
*DoD:* lint fixtures green 3-OS · adversarial report written · wrapper fixtures green ·
zero writes outside the initiative.
*Out:* any registration, any brief change.

**Phase 1 — the attended heartbeat (0.5d).**
`run` / `catchup` / `list --next 7` · SessionStart read-only nudge (hard line lint) ·
brief jobs panel (deterministic, golden) with overdue needs-you.
*DoD:* from this day the heartbeat is USABLE — one command runs everything due; the brief
shows the jobs panel; replay determinism goldens green.
*Value note:* daily value lands here, before any unattended risk exists.

**Phase 2 — the cron flip (1d). GATE: SCH-G — policy enforcement fixtures green
(policy is LIVE since C9; verify, never assume).**
`register`/`unregister` + SCH-J settings + next-minute smoke · register-refusal fixture
(policy fixtures red → exit 2, fail-closed).
*DoD:* both v1 jobs registered · smoke receipt captured · policy-gate fixtures green ·
off-switch rehearsed: `unregister` all → clean Task Scheduler state verified — the whole
heartbeat turns off with one command (round-4 G2).

**Phase 3 — proving week + retro (0.5d effort / ≥7d elapsed).**
≥2 jobs scheduled, zero manual starts (actor query) · fire-drill (SCH-L) · gap audit ·
evidence bundle · `/arc-retro` with the §8 pack.

## 7. Pre-mortem (top 5)

1. **Runaway scheduled spend** → ceiling lint (static, at commit time) + per-run budgets +
   spend-kinds unschedulable (jobs-lint ban ON TOP of policy's own money law — POL: E2
   money never above L1). v1 worst case is ₹0 by construction.
2. **Silent job death** → REQ-05 derivation + REQ-07 fire-drill (detector itself proven) +
   SCH-J battery/wake settings (the #1 real cause) + OS-level on-failure toast.
3. **Overlap corruption** → per-job withLock reuse (post-#89 semantics) + loud-exit
   fixture + idem@slot as the second net.
4. **Scope creep into a workflow engine** → §10 rejected registry + appetite cap + the
   deferred list (§12) already cut.
5. **Trust collapse from needs-you spam** → incident taxonomy closed (SCH-E), supersedes
   discipline on repeats, contract failures never double-raised, disabled ≠ overdue.

## 8. Retro metric pack (pre-declared, spine-derived only)

runs attempted / completed / missed · drift p50 (`started_at − scheduled_for`) · manual
starts for scheduled kinds (actor query — target 0) · incidents by class · quarantined
double-fires · ₹ spent vs ceiling (expected 0) · brief-panel needs-you occurrences and
whether each was true (fire-drill = at least one true positive).

## 9. Kill criteria

- Phase 0 not green in 1.5d → stop; the cycle dies, the analysis survives.
- Phase 3 shows <2 jobs worth scheduling → the cron flip is parked (register stays off),
  the attended wrapper + brief panel are kept — they are already daily value.
- Any Phase-2 policy-bypass finding (a path that runs unattended without the check) →
  registration revoked until re-fixed and re-fixtured; that is an incident, not a note.

## 10. Rejected registry (v1)

| Rejected | Why |
|---|---|
| Job dependency graphs (A-after-B) | that is a workflow engine; cadence + cursors already order the day |
| Scheduler-layer retries | ADR-0203/0204 own the ladder; layered retries = storms |
| GH Actions for receipted jobs | ADR-0025 instance spine — receipts would die on a CI runner |
| Dynamic job creation at runtime | self-modifying schedule = persistence hole (SCH-B ban) |
| Full cron grammar | parser-class surface for zero v1 need |
| Push-notification infra | the brief + inbox ARE the alerting; OS toast covers task-failure |
| Multi-machine scheduling | one spine, one machine (ADR-0025); revisit only with an export/ingest ADR |
| Job history UI | the spine + brief panel are the history |
| Per-job env overrides | env discipline stays global; overrides breed unreproducible runs |
| Money-touching jobs | not deferred — BANNED by lint (brief non-negotiable + policy money law) |

## 11. Cross-plan obligations

- **policy (`PLAN-policy.md`, C9 live):** `policy_kind` validates against the live
  `hq.policy.yaml`; authorization only via the shared POL-D library; POL-G's
  driver-eligibility contract is what any future L2 scheduled kind must pass; needed
  policy rows land via policy's own process, never edited ad hoc from this lane.
- **engine:** actor passthrough for arc-run (SCH-K) — owed at the first LIVE process-job,
  zero engine code this cycle.
- **executor (`PLAN-executor.md`):** its unlock ladder's last rung ("scheduler-era
  unattended runs") lands on THIS module's rails when its own receipts earn it — nothing
  here grants it.
- **leads (`PLAN-leads.md`):** its "no background scheduler" hard line is untouched —
  scheduler landing does NOT auto-schedule leads; sends stay human-started L1 until
  leads' own trial-ledger evidence says otherwise.
- **dashboard / chat-mcp (later):** reuse the jobs-panel derivation — no second truth.
- **evolve:** `run.completed` payload fields stay `metric.observed`-mappable; the
  proving-week pack is a ready-made scoreboard seed.

## 12. Deferred (consciously, from the idea rounds)

Duration-creep watch · full jobs panel with per-job detail (minimal version ships) ·
full env-loading work for process-jobs (arrives with the first process-job; creds-lint
ships now) · per-job catchup beyond the two `run` exceptions (global default `skip`).

## 13. Open decisions at kickoff (owner rules there; none block this file)

1. **Phase pacing** — keep the staircase rhythm (attended Phases 0–1 proven in daily use
   before Phase 2 registration), or compress and run all phases continuously now that the
   policy gate is already met?
2. **Job #3 `lexos-canary`** — in (enabled at Phase 3) or out?
3. **Wake setting** — laptop WAKES for 00:15 day-close (guaranteed nightly seal, costs
   sleep) or "run when available" + `catchup: run` (gentler; seal lands at next wake)?
4. **Lane + century** — new lane `scheduler` claiming the next free century per
   `PORTFOLIO.md` (0600s as of 2026-08-08), or fold into the company/hq band 0001–0099
   (model-policy precedent)? POL-K precedent: left open by design, decided at kickoff.
5. **Build-out queue slot** — PLAN-executor names scheduler "a later build-out slot";
   confirm its position against the live board (A9: live slot must be free — leads C8 /
   policy C9 close first, or the owner rules).

## 14. KICKOFF PROMPT (paste-ready)

```
/arc-kickoff --lane scheduler — the heartbeat
Design source: docs/strategy/plans/PLAN-scheduler.md (v1.0).
Trigger: FIRED — owner's Build-out Mandate (2026-08-09); cite its decision.recorded
in the kickoff ADRs (A8's letter holds).
Locked: SCH-A..L · no daemon · zero scheduler-layer retries · ceiling lint ·
idem=job@slot · per-job withLock reuse · spend-kinds unschedulable · POL-D shared
authorization only · Phase-2 gate = policy enforcement fixtures green (fail-closed).
Verify first: live slot free (A9, board) · policy C9 state incl. the three owner
settings.json edits · century claim per PORTFOLIO.md · processes/ list · day-close CLI.
Adversarial pass on jobs-lint before Phase 1. Resolve §13 opens.
STOP after PLAN.md + phase specs for my approval.
```

— end of PLAN-scheduler v1.0 —
