# PROGRESS.md — Cycle 2 · Receipt Spine

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (orchestrator) CLOSED 2026-07-22: `docs/archive/PROGRESS-2026-07-22.md`.
> The v2 world-best initiative stays parked (ADR-0017).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Spine core: dual-mode emitter · canonical serializer · hostile corpus + adversarial pass (ckpt A) · replay · reader · twin determinism CI (ckpt B) | 5 days | ✅ done 2026-07-23 |
| 01 | Factory wiring: EVENT.d fragments + flow emissions + dry-run golden + overhead check | 2.5 days | ✅ done 2026-07-23 |
| 02 | Money + brief: strict revenue ingest (cross-day idem) + one-screen brief + cost (stretch) | 2.5 days | ✅ done 2026-07-23 |
| 03 | Inbox + API seal: approvals flow + cursor catch-up + reader-only grep-lint (TRIAL) | 1.5 days | ✅ done 2026-07-24 |
| 04 | Live dogfood: 3 real working days (amended from 5, 2026-07-28) · honest revenue · gap audit · evidence bundle · retro | 3 days (≥5 elapsed) | 🟡 in progress |

## Done log

- 2026-07-24 — **Phase 03 CLOSED ✅** via `/arc-phase-done 3`. Approvals are receipts and the
  reader is the sealed, only API. **REQ-06:** `arc inbox` lists open `approval.requested` by
  folding `decision.recorded` through the reader; `arc approve/reject ID --reason` writes exactly
  one `decision.recorded` via the one writer; unknown / wrong-kind / already-decided (even a
  different reason) refuse and never duplicate; replays byte-identically; no approval state
  outside the spine. Decision payload **sealed at the validator core** (`assertDecision`,
  owner-approved). `approval.requested` emission points live at the kickoff plan-approval +
  phase-done sign-off gates (REQ-01 dry-run golden extended). **REQ-09:** reader-only grep-lint
  enters TRIAL (`spine-api` `mode: warn` gate, glob-scan of tracked hq source — brief/inbox are
  reader-only); same-ms-burst fixture proves `--since` resolves ties by append order, never ULID
  string compare. **Mandatory adversarial pass (7 lenses, 40 candidates) found + fixed 2 real
  holes** — an idem pre-claim / two-key desync that permanently locked an approval out of the
  inbox, and C1 terminal-escape smuggling in a reason — both pinned strict+hook. **W8 (cursor
  store) CUT** — the pre-planned reserved cut; REQ-09 acceptance + DoD-3 met by the grep-lint +
  same-ms-burst, so it drops no REQ and no DoD checkbox. **REQ-06 + REQ-09 → validated.**
  Touched-file suites green (spine-inbox 18/18, spine-cursor 2/2, spine-reader-lint 5/5, gates
  15/15, golden-dryrun 2/2) + validator node smoke check; the full 3-OS × Node matrix is the push
  authority. sync-golden `tree-manifest` regenerated (exactly 5 intended paths moved). Evidence:
  `docs/evidence/phase-03/`. **Metrics:** appetite 1.5d → **actual ~1d part-time** ·
  `amendments: 0` · REQs: 2 validated / 0 dropped-this-phase (W8 an implementation cut, not a REQ).
- 2026-07-23 — **Phase 02 CLOSED ✅** via `/arc-phase-done 2`. Money reaches the spine exactly
  once and the day reads in one screen. **REQ-03:** `revenue.received` / `revenue.simulated`
  ingest validates `amount` (positive integer, minor units, 1..1e12) + `currency` (ISO-4217);
  same-day AND cross-day duplicates dedupe to ONE (content idem). Parser-class **adversarial
  pass** (5 lenses, ~135 candidates) found + fixed **1 hole** — a fractional amount that
  IEEE-rounded to an integer was sealed as a value nobody sent; closed at the number-token
  scanner, pinned red. **REQ-05:** `arc brief` groups needs-you / money / progress / background
  (reader-only), money from minor units, background always collapses to a count (the noise
  floor), `--full` expands; REQ-04 determinism intact. **REQ-08 (cost) CUT** — owner's call
  (the pre-planned stretch cut; cost deferred to a later cycle). Full suite **334/334** (+10)
  3-OS CI green (run on 6a380fc). Live demo: ingest twice → ONE event, `arc brief` shows the
  money line. Evidence bundle verified (`docs/evidence/phase-02/`). **Metrics:** appetite 2.5d →
  **actual ~1d part-time** · `amendments: 0` · `reopened: n` · REQs: 2 validated / 1 dropped.
  Two CI catches (both the bare-sync golden going stale after editing synced hq scripts) —
  regenerated; now memorized as a pre-push step.
- 2026-07-23 — **Phase 01 CLOSED ✅** via `/arc-phase-done 1`. Every factory action now leaves a
  receipt: 7 flows wired to emit their Appendix-A kinds (6 core + council deep-runs-only) with
  scoped `arc-event.sh` permissions, and EVENT.d `90-emit` fragments (SessionStart/End +
  PostToolUse) drop `note.logged` lifecycle receipts through the existing dispatcher. REQ-01 →
  validated. Full suite **324/324** (+6) across 3-OS × Node CI green (run 29997447315). Live
  demo shown: a real session (this one) captured 5 receipts in gitignored `.claude/state/hq`,
  `arc brief` renders them; redaction-live pinned on the synthesis path (4/4), guard-chain
  regression 11/11, durability inherited from the Phase-0 corpus. Evidence bundle verified
  (`docs/evidence/phase-01/`). **Metrics:** appetite 2.5d → **actual ~1d part-time** (well
  under) · `amendments: 0` · `reopened: n`. **Assumptions fired-as-planned:** row 1 (golden gap
  → command-level emission) + row 3 (overhead ~2s > 1s → async append) — recorded in PLAN's
  ledger. One CI catch: the bare-sync golden was stale after the wiring (7 rehashed command
  files + 3 new fragments) → regenerated (`22cd656`) — the gate the local touched-files runs
  can't see, exactly why CI owns the full suite.
- 2026-07-23 — **Phase 00 CLOSED ✅** via `/arc-phase-done 0`. Both checkpoints shipped;
  REQ-02 + REQ-04 → validated. Full suite **318/318** local (Windows) + 3-OS × 3-Node CI
  green (ubuntu/windows/macOS on Node 20, ubuntu on Node 18 no-sqlite + Node 22 accelerator);
  spine suites 47/47. Live demo shown (hook-append, secret SKIP/exit-2, byte-identical
  rebuild). Evidence bundle verified (`docs/evidence/phase-00/`: scan-verdict + sarif +
  test-output.log pinned; adversarial-report, ckptB-measurements, red/green runs, golden diff
  committed alongside). **Metrics:** appetite 5d → **actual ~2d part-time** (well under) ·
  `amendments: 0` · `reopened: n` · `t-to-phase0: ~1 day since kickoff`. Adversarial pass
  found + fixed **25 confirmed holes** in code that had passed its own 22 tests — the phase's
  defining event. Assumption row 2 measured and HOLDS (1.1s vs 5s), so the sqlite accelerator
  stays optional.
- 2026-07-22 — **Phase 00 ckpt B built** (`33357bb`). `spine.mjs` reader (arc's only public
  API — `--since` resolves by append order, not ULID sort), `arc-replay.mjs` (rebuilds all
  derived state from empty; repairs both crash windows), minimal `arc-brief.mjs`. REQ-04
  twin determinism + sqlite-vs-scan equivalence gate in CI; matrix 3 → 5 jobs (Node 18 leg
  for the no-sqlite path, Node 22 for the accelerator). Assumptions row 2 **measured and
  HOLDS**: 1.1s over a 90-day/3600-event synthetic spine against a 5s trigger, so the
  accelerator stays optional. 47/47 spine tests green. Two bugs found while writing the
  gate: sqlite couldn't see torn lines (engines disagreed on damage), and `withLock` dropped
  the lock when handed an async body.
- 2026-07-22 — **ckpt A validated on 3-OS CI** — PR #44, run 29958837544: ubuntu, windows,
  macOS, ci-tier all green. Local runs are one OS; this is the authority (`d53daed`).
- 2026-07-22 — **Phase 00 ckpt A hardened and DONE** (`107c3c8`). Adversarial pass: 45
  agents, 6 lenses, 38 claims, **25 confirmed** after independent refutation attempts —
  including an escaped-duplicate-key bypass that let a forged `actor`/`outcome` be sealed in
  strict mode, structural credentials landing on the spine untouched, raw secret bytes
  written to quarantine on non-secret rejections (ADR-0028 violated by the code citing it),
  and a lock three processes could hold at once. All 25 fixed. Corpus 37 → 50 fixtures +
  7 behavioural regressions; 29/29 green. Report: `docs/evidence/phase-00/adversarial-report.md`.
- 2026-07-22 — **Phase 00 ckpt A built** (`54c20ac`, `701e990`). Dual-mode `arc-event`
  (hook never blocks / `--strict` exits 2, one validator core), canonical serializer + sha +
  ULID, strict JSON reader, fail-safe multi-view secret scan, lock + single-write append +
  idem index + day-close markers. 37-fixture hostile corpus written and run RED first
  (`docs/evidence/phase-00/red-run-ckptA.txt`) → 22/22 green. Product `hq` registered;
  golden tree-manifest regenerated on a reviewed diff (no `state/` paths — SPINE-B holds).
  Two hardcoded six-product test lists now derive from `products/`. **Not closed:** the
  mandatory adversarial pass is still running; its holes get fixed and pinned before ckpt B.
- 2026-07-22 — **Kickoff.** Orchestrator tracker archived (`docs/archive/PLAN-2026-07-22.md`,
  `PROGRESS-2026-07-22.md`, `phases-orchestrator-2026-07-22/`). ADR-0024..0031 recorded
  (SPINE-A..H). PLAN.md + `phases/phase-00..04-spec.md` written from
  `docs/strategy/plans/PLAN-cycle2-receipt-spine-v2.1.md` (decisions locked, not re-litigated).
  Attack panel: 3 attackers, 18 findings, 12 accepted as exact mutations. Awaiting approval.

## Appetite burn

**~5 of ~12.5 part-time days used** (Phase 00 + 01 + 02 + 03 done, each under its own appetite
— ~40% burnt). 2.5-week hard cap. Kill check at ~6.25 days (50%): REQ-02 + REQ-04 green? —
**validated at Phase-0 close, so the tripwire is satisfied early; well under it.** REQ-08 was
the pre-planned **first cut** (taken at Phase-02 close, owner's call — NOT burn pressure);
REQ-09's cursor demo is the reserved second cut (lint stays). 100% → cut or kill, never extend.
**Third, unplanned cut taken 2026-07-28** — Phase 04's dogfood window 5 → 3 working days
(amendment #1). Taken at ~40% burn with the tripwire never reached, so it is NOT one of the
plan's pressure-cuts: it is an owner priority call (Lexos focus). Named here so the cut ledger
stays honest.

## Now

**Phase 04 (Live dogfood) — STARTED 2026-07-24. Host = arc itself (owner's call). The last phase.**
Entry gate done via `/arc-change`: host confirmed + the coarse Verification plan refined into a
concrete daily-cadence checklist (`phases/phase-04-spec.md`). Venture repos (venturemind /
Opportunity-Scout) deferred — they carry the arc framework but NOT the spine (no `scripts/hq/`
emitter, `hq` unregistered; would need a one-time install). Assumptions row 4 holds via its
arc-self branch — no FIRED. REQ-07 is the last open requirement; closing Phase 04 closes the cycle.

**AMENDMENT #1 — 2026-07-28, owner's call, routed via `/arc-change`:** the dogfood window is cut
from **≥5 consecutive real working days to ≥3 real working days**, and "consecutive" is dropped
as inaccurate. **Not appetite-forced** (~40% burnt; the 50%/6.25d tripwire was never reached and
its REQ-02+REQ-04 condition has been green since Phase 0) and **not an assumption failure**
(ledger row 4's trigger never fired — recorded as *strained* in PLAN.md). Real reason: owner
reprioritization toward the **Lexos** venture, whose repo has no spine installed, so more days
would have bought thin arc-self evidence. **Nothing else is cut** — gap audit, quarantine review,
evidence bundle, retro and the grep-lint TRIAL decision all still gate the close. REQ-07 will
close as "mechanism proven on 3 real days, live value pending" — never as "proven on 5".
Full rationale + cost: `phases/phase-04-spec.md` § Amendment #1.

**Daily loop:** work normally → receipts auto-emit to `.claude/state/hq/events/DATE.jsonl`
(Phase 1/3 wiring) → `arc brief` once/day (confirm ≤ one screen) → copy that day's brief + JSONL
into `docs/evidence/phase-04/`. Revenue = `revenue.simulated` only (arc earns nothing real; no
fabricated `revenue.received`).

**Progress: window CLOSED at 3/3 working days ✅** — captured 2026-07-24, 07-25, 07-28.
- **Day 1 (07-24):** brief 10 lines / 306 ms ✅ (REQ-05) · 22 receipts (note.logged 19 ·
  approval.requested · decision.recorded · phase.closed) · quarantine 22 dup-idem (dedup working).
- **Day 2 (07-25):** brief 1 line · 1 receipt (note.logged, session-end) — a thin day; bundled
  2026-07-28 (backfill, the same-day copy step was missed).
- **Day 3 (07-28):** brief 5 lines · 5 receipts (session.start + 4 tool.postuse) · quarantine 11
  dup-idem (amplified by repeated same-file edits this session).
- **Non-days:** 07-26 = real arc commits with **zero receipts → the open gap**, still to be
  audited. 07-27 = Lexos work, outside this cycle's host scope (not a gap).
- Retro note logged: hook+command emissions overlap (noise, not a defect — fix out of scope here).
  Day log: `docs/evidence/phase-04/day-log.md`.

**① GAP AUDIT DONE 2026-07-28 → `docs/evidence/phase-04/gap-audit.md`. A REAL DEFECT WAS FOUND.**
The idem preimage (`arc-event.mjs:99`) carries no time and no per-session identity — `run_id` is
always the default `r-adhoc` and every other component is constant for hook emissions — so the
idem collapses to a pure function of the payload: **session receipts key on the branch name,
file-edit receipts key on the file path.** Every repeat session on a branch, and every repeat
edit of a file, is silently rejected as `DUP_IDEM` and lost. Hook mode never blocks (ADR-0031),
so the loss is invisible. Evidence: 07-25 = 1 valid / 9 dropped · 07-28 = 5 valid / 11 dropped ·
**07-26 = zero valid, no day file at all**. Two consequences:
- **The Day-1 log's "dedup working, no data loss, not a gap" was WRONG** — corrected in the audit
  (§3); the original text stays (corrections supersede, ADR-0029).
- **REQ-01 ("every factory action leaves a receipt") is `validated` but false in real use** — its
  dry-run golden can't catch this, since every event in a scripted run is distinct. Status
  deliberately NOT changed here; it is a `/arc-retro` + `/arc-phase-done 4` decision.
Not fixed during the dogfood (wiring/vocabulary closed, ADR-0026) — named and filed for the next
cycle. **Still open, honestly:** 07-26 produced neither receipts NOR quarantine lines, and the
idem defect does not explain total silence — a second cause is unidentified (audit §5).

**② QUARANTINE REVIEW DONE** → `docs/evidence/phase-04/quarantine-review.md`. 101 entries, two
codes, all accounted for: **100 `DUP_IDEM`** (every one a lost real receipt, per ①, NOT benign
dedup) + **1 `BAD_JSON`** (2026-07-23, pre-window, empty payload correctly refused; `raw` empty so
not root-caused — filed low-priority). Containment itself proved sound: no session ever blocked,
nothing invalid reached `events/*.jsonl`, and `stub_only:false` on all 101 → the ADR-0028
redaction fail-safe never had to fire and no secret bytes were written. The defect is the idem
policy, not the quarantine mechanism. No entry is replayed — lost receipts are recorded as lost.

**③ BUNDLE SUMMARY DONE** → `docs/evidence/phase-04/SUMMARY.md`. Bundle now complete: 3 briefs +
3 JSONL copies + day-log + gap-audit + quarantine-review + summary.

**④ RETRO DONE 2026-07-28** (`/arc-retro 4`). Findings, corrections and decisions:
- **Recurring pattern logged** → `docs/retro-log.md`: an instrument anomaly was explained away
  with a plausible benign story instead of tested — twice this phase (the 22 quarantine dups read
  as "dedup working, no data loss"; a zero-receipt day read as "no work happened"). Prevention:
  test the benign explanation against the **mechanism** before recording it as fine. A plausible
  story hid a real data-loss defect for 4 days inside the phase built to catch it.
- **Guideline added** → `CLAUDE.md`: verify `git branch --show-current` immediately before every
  commit (this session committed to `main` after an unnoticed branch switch; one-off, so no
  retro-log line — guideline only).
- **REQ-01 DOWNGRADED `validated` → `active`** (owner's call, option A). Its acceptance passes
  while its outcome is false; re-validation now additionally requires a **repeat-action fixture**
  (same file edited twice, same branch entered twice, both landing distinct receipts). Recorded
  in PLAN.md's REQ table.
- **TRIAL gates: all 8 KEPT WARN, nothing promoted** → `docs/trial-ledger.md`. `appetite-sum`
  fired (14.5d > 12.5d) and **inverted** — the build reached this point at ~40% burn with every
  closed phase under its own appetite; that is its second consecutive inverted fire. The other 7
  stayed silent on their own author's plan, which the ledger scores as silence, not accuracy.
  The governing blocker also re-verified as still standing: `kickoff-lint.mjs:469` remains an
  unconditional `process.exit(1)` with no recorded-reason bypass.
- **Scoreboard row appended** → `docs/retro-log.md`: `M | rework 0/4 | amendments 1 | FIRED 2/6 |
  burn ~40% | sim-blockers-r1 not-recorded | t-to-phase0 ~1d`.

**⑤ `/arc-phase-done 4` RAN 2026-07-28 → REFUSED the close, correctly.** Two blockers it caught
that the retro had missed; both now cleared:
- **ADR-0031's revisit trigger had FIRED and was unrouted.** Its trigger — *"Phase-4 gap audit
  shows quarantine swallowing events … silent data loss"* — is exactly what ① found. Phase-done's
  trigger scan refuses to close on unrouted risk. Routed via `/arc-change` → **[ADR-0032]
  (docs/adr/0032-spine-i-hook-mode-rejections-must-surface.md)**: hook-mode rejections must
  surface in the **brief** (needs-you group), because ADR-0031's "loud SKIP" is loud on stderr
  inside a hook nobody watches, and the quarantine file is gitignored — a channel nobody reads is
  not surfacing. **"Never block a session" is untouched and stays inviolate.** Decided, not built
  (no wiring changes this phase — ADR-0026); enters the next cycle with the idem fix. ADR-0031
  stamped FIRED with the pointer. The other 7 ADRs were scanned — none fired (ADR-0028's trigger
  is *redaction* false-positives; every rejection here was `DUP_IDEM`, `stub_only:false`).
- **Exit criterion 5 had reviewed the WRONG gate.** The spec scopes the TRIAL review to the NEW
  reader-only grep-lint gate ONLY; the retro reviewed the 8 kickoff-lint gates, which the spec
  locks WARN regardless. Corrected: **`spine-api` reviewed and KEPT WARN**
  (`docs/trial-ledger.md`). Criterion 1 (fixture-proven) is MET and is stronger than any
  kickoff-lint gate's — 5/5 bats green, asserting the gate FAILs on its own mutations plus three
  false-positive edges. Criterion 2 is NOT met: 2 logged runs, both on the author's own code
  written against the check, which this ledger scores as silence, not accuracy.

**Also confirmed at phase-done:** zero source or test files changed during Phase 04 (docs and
tracker only), so the suite state is unchanged from the Phase-03 close (3-OS CI green); plan-drift
lint passes.

**Remaining to close Phase 04:** re-run `/arc-phase-done 4` now that both blockers are cleared.

**Appetite:** ~40% burnt (~5 of 12.5 days); Phase 04 appetite 3d effort / ≥5 elapsed — elapsed
MET (07-24 → 07-28). Tripwire (50% / 6.25d) not reached; REQ-02 + REQ-04 green → kill-criteria
satisfied. The amendment above was a priority call, not burn pressure.

**Scoreboard:** 2 active — REQ-07 (this phase, amended bar) + **REQ-01 (downgraded at the retro,
needs a repeat-action fixture)** · 6 validated (02–06, 09) · 1 dropped (REQ-08 cost).
