# Phase 03 — close evidence (2026-10-07)

The proving week closed six weeks after the 2026-08-26 date it could have closed on. Nothing was
waiting on the system in that time; the lane simply was not resumed. The extra 44 days were not
wasted: they are the longest unattended record this heartbeat has, they contain the fire-drill
left running for five weeks, and they surfaced the one gap this phase exists to catch.

Every number below comes from `arc-jobs audit` / `arc-jobs panel` run in the canonical clone
(`E:\Work_Hub\01_Automemory\arc`, main @ `290b2d09`) against the live spine. Raw output sits next
to this file; nothing is restated from memory.

| File | What it is |
|---|---|
| `audit-week.txt` | the pre-declared proving week, 2026-08-17..08-23 |
| `audit-full.txt` | the whole unattended record, 2026-08-17..10-06 (51 days) |
| `audit-restored.txt` | the 8 days after the drill job came back, 2026-09-29..10-06 |
| `drill-panel-replay-2026-08-26.txt` | `panel --date 2026-08-26` — the day the drill was computed to fire |
| `brief-2026-09-29-live.txt` | the brief the scheduled job itself wrote at 15:42 on its first run back |
| `gap-classes.txt` | every one of the 39 missed slots, graded by class (method below) |

## 1. The week (DoD: ≥2 jobs unattended ≥7 consecutive days) — MET

`audit-week.txt`, 2026-08-17..08-23, 7 days: both jobs registered and firing, `attempted 10 ·
completed 10 · failed 0 · missed 2`. The two missed slots are both 2026-08-20 — the day ADR-0808
was written about. The audit prints `NOT CLEAN: 2 unexplained gap(s)`, as ADR-0808 requires it to
keep doing; the closing verdict is the class of those two gaps, in §3.

## 2. Zero manual starts (DoD: proven by an actor query) — MET

`manual starts (target 0) 0` in all three windows, including the 51-day one. Every
`run.completed` for a scheduled kind carries actor `scheduler:<job>`; 49 of 49 do.

## 3. Every gap classified, zero in "arc was running and the job did not fire" — MET for the week, ONE found after it

ADR-0808 left one gap classified by written inference (no `events/2026-08-20.jsonl`) and said
that must be the last time. It is: this close grades every gap against the **Windows System
event log**, which records power state independently of arc — boot (Kernel-General 12), shutdown
(13), connected-standby entry/exit (Kernel-Power 506/507), EventLog start/stop (6005/6006). The
machine's state at each slot is the last such event before it. That is a witness, not an
inference from spine silence (ADR-0808 option 4, which stays rejected).

`gap-classes.txt`, all 39 missed slots in 51 days:

| Class | Slots | Meaning |
|---|---|---|
| DOWNTIME | 13 | the machine was off or in standby at the slot (incl. both 2026-08-20 slots: standby since 08-19T23:00 and 08-20T04:33) |
| DRILL | 3 | `brief-materialize` 08-24/25/26 — the drill's intended misses |
| DRILL-NOT-RESTORED | 22 | `brief-materialize` 08-27..09-25 — the drill's OS task was never put back (§5) |
| **ARC-SIDE** | **1** | **`day-close-roll` 2026-09-28T00:15** |

**The pre-declared week has zero ARC-SIDE gaps**, so the exit criterion as amended by ADR-0808 is
met on the window it was written for. The ARC-SIDE gap is outside it and is reported anyway,
because a close that hides the one finding of its own class is the failure this lane exists to
prevent.

**2026-09-28T00:15, `day-close-roll`, the full record.** System log: boot 09-27T09:42, Winlogon
logon (7001) 09-27T09:43, standby exit 09:44, then nothing until logoff (7002) and shutdown at
09-28T01:25. The machine was on, awake and logged on at 00:15 — and the job is registered with
logon model Interactive, so every condition for it to fire held. `job-logs/day-close-roll.log`
has no entry between the 09-27 run and the 09-29 run: the action never started, or never got as
far as its redirect. A session had re-registered `brief-materialize` at 09-27T02:02 (two
`scheduler.register` notes on the spine). The Task Scheduler operational log no longer holds
September, so the cause is **undetermined**, and it is written down as undetermined rather than
guessed. The work was not lost: the 09-29 run sealed both `2026-09-27` and `2026-09-28`
(`sealed=2` in the log), because day-close-roll seals every unsealed day, not only its own.

Routed, not absorbed: it is the first real arc-side miss, it is exactly what ADR-0807's deferred
logon trigger and ADR-0808's deferred witnessed-downtime mechanism are for, and it carries into
the next scheduler cycle with them (PROGRESS `## Now`).

## 4. Fire-drill — PASSED, and captured live

Drill: `brief-materialize` OS task removed 2026-08-23 ~17:00 with `hq.jobs.yaml` still
`enabled: true`; `day-close-roll` left registered as the control.

- **Predicted and replayed:** `drill-panel-replay-2026-08-26.txt` shows `brief-materialize
  OVERDUE (3 missed)` and exactly one needs-you line, while the control reads `enabled`, last
  2026-08-26T00:15. One job overdue, control healthy — a pass, not an incident.
- **Captured live, not reconstructed:** the spec's verification plan asks for the line as it
  appears. No brief was materialized while the drill held — the drilled job IS the brief writer,
  so the line could only reach a session nudge. The first brief after the job came back,
  `brief-2026-09-29-live.txt`, was written at 15:42 by `scheduler:brief-materialize` itself and
  reads `job brief-materialize silent since 2026-08-21T14:56:25+05:30 -- 27 scheduled slots
  missed (weekdays@06:00)`. The detector reported its own outage in its first breath back.
- The audit's needs-you history shows the line on every day from 2026-08-26 to 2026-09-28 (34
  days). All 34 are true positives: the job really was not running.

## 5. What went wrong in the drill itself

**The drill was armed and never disarmed by its owner.** The spec said "I will ask before
removing and restoring the fire-drill job's OS task"; the removal happened, the restore did not,
and nothing tracked it. `brief-materialize` stayed unregistered for 35 days, missing 22 slots
past the drill's three, while needs-you raised it every single day. It came back on 2026-09-27
only because another session re-registered it. Lesson for the retro: a fault injection is two
actions, and the second needs a dated row in the tracker the moment the first one runs.

## 6. Metric pack (from the spine only)

| Metric | Week 08-17..23 | Full 08-17..10-06 | Restored 09-29..10-06 |
|---|---|---|---|
| attempted / completed / failed | 10 / 10 / 0 | 49 / 49 / 0 | 14 / 14 / 0 |
| missed | 2 (downtime) | 39 (13 downtime, 25 drill, 1 arc-side) | **0 — CLEAN** |
| drift p50 | 17482000ms | 4000ms | 3000ms |
| manual starts (target 0) | 0 | 0 | 0 |
| incidents by class | all 0 | all 0 | all 0 |
| quarantined double-fires | 0 | 0 | 0 |
| ₹ spent vs ceiling | ₹0 | ₹0 | ₹0 |
| needs-you days | 0 | 34, all true | 0 |

The week's 4.9 h drift p50 is `brief-materialize` catching up at wake time rather than 06:00,
not lateness inside a running session. `day-close-roll`'s own p50 is 3 s in every window.

**The 8 restored days grade CLEAN outright** — 14 of 14 slots served, no gaps of any class —
the strict ADR-0808-free verdict, on a window nobody chose in advance. It is reported as
corroboration, never as the closing window: picking the window after the result is what the
pre-declared metric pack forbids.

## 7. Ledger rows

- ADR-0804 `StartWhenAvailable` — answered 2026-08-23 (DROPPED, ADR-0807). Quarantined
  double-fires: `events/_quarantine/` holds 14 files and none carries a `scheduler:` actor.
- ADR-0806 overlap lock + incident taxonomy — **confirmed at close, in the negative**: 51 days,
  zero lock contention, every incident class 0. Both mechanisms remain proven by fixture only and
  never in the real. This is a limit of the evidence, not a pass.
