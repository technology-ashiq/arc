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
| 04 | Live dogfood: 3 real working days (amended from 5, 2026-07-28) · honest revenue · gap audit · evidence bundle · retro | 3 days (≥5 elapsed) | ✅ done 2026-07-28 |

## Done log

- 2026-07-28 — **Phase 04 CLOSED ✅** via `/arc-phase-done 4` — **and with it Cycle 2.** The spine
  ran on real work for **3 working days** (07-24, 07-25, 07-28; amended from 5 — amendment #1,
  owner's call, not appetite-forced). **REQ-07 → validated as "mechanism proven, live value
  pending"** — the exact wording the plan reserved for a pre-revenue close: zero
  `revenue.received`, nothing fabricated. **REQ-05 held every day** (briefs 10 / 1 / 3 lines,
  306 ms measured — inside one screen and far under the 5s budget), read from the reader only.
  **The dogfood earned its keep by failing:** the gap audit found the spine **silently destroying
  real receipts** — the idem preimage (`arc-event.mjs:99`) carries no time and no per-session
  identity, so `run_id` stays `r-adhoc` and the key collapses to a function of the payload alone;
  session receipts key on the branch name, file-edit receipts on the file path, so **every repeat
  action is dropped as a duplicate**. 100+ real receipts lost across the window; 2026-07-26 lost a
  whole working day. Watched reproducing live at close (PROGRESS.md rejected 9×, PLAN.md 7× while
  documenting the bug). **Two honest downgrades followed:** the Day-1 "dedup working, no data loss"
  reading was **wrong** and is superseded, and **REQ-01 was downgraded `validated` → `active`** —
  its golden passes while its outcome is false, and re-validation now needs a repeat-action
  fixture. **`/arc-phase-done` refused the first close attempt** and was right to: ADR-0031's
  revisit trigger had fired unrouted (→ **ADR-0032**, hook-mode rejections must surface in the
  brief; "never block a session" untouched), and the retro had reviewed the wrong TRIAL gate
  (corrected: **`spine-api` kept WARN** — fixture-proven, but only same-author clean runs).
  Zero source/test files changed this phase, so the suite is unchanged from the Phase-03 close
  (3-OS CI green); plan-drift lint green; evidence bundle `verify 4` passed (10 files).
  **Still open, stated not buried:** the idem fix and ADR-0032's brief surfacing are next-cycle
  work (no wiring changes during a dogfood — ADR-0026), and 2026-07-26's *total* silence — no
  receipts AND no quarantine lines — has a second cause that is **not identified**.
  **Metrics:** appetite 3d effort / ≥5 elapsed → **actual ~0.5d effort over 5 elapsed days** ·
  `amendments: 1` · `reopened: n` · REQs: 1 validated (07), 1 downgraded (01).
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

**CYCLE CLOSED 2026-07-28 at ~5.5 of ~12.5 part-time days (~44% burnt)** — all 5 phases done,
every one under its own appetite. 2.5-week hard cap never approached; the plan finished with
~56% of its appetite unspent. (`appetite-sum` had WARNed at kickoff that 14.5d of phases exceeded
the 12.5d total — the arithmetic was right and the risk inverted; logged in `docs/trial-ledger.md`.)

Historical line, kept: ~5 of ~12.5 days used with Phase 00 + 01 + 02 + 03 done, each under its
own appetite — ~40% burnt. 2.5-week hard cap. Kill check at ~6.25 days (50%): REQ-02 + REQ-04 green? —
**validated at Phase-0 close, so the tripwire is satisfied early; well under it.** REQ-08 was
the pre-planned **first cut** (taken at Phase-02 close, owner's call — NOT burn pressure);
REQ-09's cursor demo is the reserved second cut (lint stays). 100% → cut or kill, never extend.
**Third, unplanned cut taken 2026-07-28** — Phase 04's dogfood window 5 → 3 working days
(amendment #1). Taken at ~40% burn with the tripwire never reached, so it is NOT one of the
plan's pressure-cuts: it is an owner priority call (Lexos focus). Named here so the cut ledger
stays honest.

## Now

**CYCLE 2 (Receipt Spine) CLOSED ✅ 2026-07-28.** All 5 phases done. Nothing is in progress; the
next move is a new cycle's kickoff, not a phase.

**What shipped.** Every factory action and every rupee lands as one append-only event, consumed
only through one reader, rendered as a one-screen daily brief and an approval inbox — proven on
real work for 3 working days. 8 REQs closed: **7 validated** (02 spine-cannot-be-poisoned · 03
money-exactly-once · 04 twin-replay-determinism · 05 one-screen brief · 06 approvals-are-receipts
· 07 proven-on-real-work · 09 spine-is-the-only-API), **1 dropped** (08 cost — pre-planned cut).
ADRs 0024–0032 (SPINE-A..I).

**What did NOT close, stated plainly.**
- **REQ-01 is `active`, not validated** — downgraded at the retro. "Every factory action leaves a
  receipt" is false in real use: the idem preimage carries no time, so repeat actions on the same
  file or branch collide and are silently dropped (100+ receipts lost during the dogfood itself).
  Its golden passes because scripted runs never repeat. Re-validation needs a **repeat-action
  fixture**.
- **ADR-0032 is decided, not built** — hook-mode rejections must surface in the brief. No wiring
  changed during the dogfood (ADR-0026).
- **2026-07-26's total silence is unexplained** — no receipts *and* no quarantine lines. The idem
  defect explains dropped receipts, not silence. A second cause is unidentified.

**Carried into the next cycle** (the three above are its natural first slice): the idem fix, the
brief surfacing, the 07-26 unknown, plus the standing blocker on promoting any TRIAL gate —
`kickoff-lint.mjs:469` is still an unconditional `process.exit(1)` with no recorded-reason bypass.

**Evidence:** `docs/evidence/phase-04/` (10 files, `verify 4` passed) — day log, per-day briefs +
JSONL, gap audit, quarantine review, summary. **Retro:** `docs/retro-log.md` (pattern + scoreboard
row `M | rework 0/4 | amendments 1 | FIRED 2/6 | burn ~44%`).

**Owner's next call:** Cycle 3. The stated direction is the Lexos venture — and the dogfood just
made the case for installing the spine *where the real work actually happens*, since arc-self days
were thin precisely because the work had moved.
