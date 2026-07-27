# Phase 04 — Live dogfood day log

**Host:** arc itself (owner's call, confirmed 2026-07-24). **Spine:** `.claude/state/hq/`
(gitignored — SPINE-B; per-day copies live in this bundle). **Window:** ≥5 consecutive real
working days. **Revenue:** `revenue.simulated` only this window (arc earns no real money) —
REQ-07 closes "mechanism proven, live value pending"; a real `revenue.received` would need a
provider export.

Each entry records: brief (lines / timing — REQ-05 ≤ one screen, <5s) · receipts (count + kinds) ·
quarantine (count + reason, reviewed per ADR-0031) · observations · revenue. Raw per-day artifacts:
`brief-DATE.txt`, `events-DATE.jsonl`.

---

## Day 1 — 2026-07-24

- **Brief** (`brief-2026-07-24.txt`): **10 lines** — ≤ one screen ✅ (REQ-05) · **306 ms** — <5s ✅.
  Groups rendered: needs-you (1 `approval.requested`) · progress (2: `phase.closed`,
  `decision.recorded`) · background 19 (`note.logged`) collapsed to a count (`--full` to expand).
- **Receipts** (`events-2026-07-24.jsonl`): **22 valid** — `note.logged` 19 · `approval.requested` 1 ·
  `decision.recorded` 1 · `phase.closed` 1. These are the real Phase-03 close + this session's
  activity flowing through the live spine.
- **Quarantine** (`events/_quarantine/2026-07-24.jsonl`, reviewed — not copied, transient):
  **22 entries, ALL "duplicate idem" rejections.** Dedup working as designed — hook-mode never
  blocks (exit 0), `stub_only` so no raw payload/secret persisted. **No data loss, not a gap.**
  ~14 distinct target ULIDs, some re-emitted 1–5×.
- **Observation → RETRO (not fixed mid-dogfood):** duplicate-quarantine rate ≈ 1 dup per valid
  receipt ⇒ hook fragments + command-level emissions overlap for some kinds (expected since the
  Phase-01 "hook fragments capture enough" assumption fired → command-level emission added to all
  7 flows). The idem index absorbs it cleanly (zero corruption), so this is noise, not a defect.
  Out of scope to re-wire this phase (vocabulary/wiring closed — ADR-0026); logged here for the
  closing `/arc-retro`.
- **Revenue:** none — no real money; `revenue.simulated` path not exercised today.
- **Note:** `events-2026-07-24.jsonl` is a snapshot taken 11:22 while the session is still live;
  refreshed at day/session close to capture the full day.

_Day 1 of ≥5 — ✅ captured._

## Day 2 — 2026-07-25

- **Brief** (`brief-2026-07-25.txt`): **1 line** — ≤ one screen ✅ (REQ-05). Background 1
  (`note.logged`), no needs-you/progress that day.
- **Receipts** (`events-2026-07-25.jsonl`): **1 valid** — `note.logged` (session-end marker on
  branch `feat/arc-cycle2-phase-04`, ts 14:05:40 IST). Minimal day — session opened/closed with
  no other factory action captured.
- **Quarantine:** none observed for this date.
- **Revenue:** none.
- **Note:** brief regenerated 2026-07-28 (backfill — the Day 2 bundle step was missed same-day);
  content is a byte-for-byte read of the live spine file, no reconstruction.

_Day 2 of ≥5 — ✅ captured (backfilled 2026-07-28)._

## Gap note — 2026-07-26 (pre-audit, flagged early)

- Git log shows 4 real commits this date (docs/strategy work: org-blueprint, legal-pack brief,
  strategy 3-layer reorg, PLAN-design). This is real factory action per the Phase-04 host
  definition (arc's own development).
- `.claude/state/hq/events/2026-07-26.jsonl` **does not exist** — zero receipts for a day with
  confirmed real work.
- **Not fixed here** — no new emission points this phase (vocabulary/wiring closed, ADR-0026).
  Logging now so the window-end gap audit (session-log vs spine, pre-mortem #2) has this
  pre-flagged rather than discovered cold. Candidate explanation to check at audit time: that
  day's work happened under conditions where the hook/command emission path didn't fire (e.g.
  a tool/session flow outside the wired 7 commands) — needs the actual gap-audit diff to confirm,
  not asserted here.

## Day 3 — 2026-07-28

- **Brief** (`brief-2026-07-28.txt`): **4 lines** — ≤ one screen ✅ (REQ-05). Background 4
  (`note.logged`), no needs-you/progress today.
- **Receipts** (`events-2026-07-28.jsonl`): **4 valid** — `note.logged` ×4: session.start
  (branch `feat/design-plan`) + 3 `tool.postuse` (PostToolUse hook capturing this session's own
  file edits — the Day-2 backfill + Day-3 first-snapshot work).
- **Quarantine** (`events/_quarantine/2026-07-28.jsonl`, reviewed — not copied, transient):
  **4 entries, all `DUP_IDEM`** — same overlap pattern as Day 1 (hook + command emission
  double-fire), dedup absorbed cleanly. No data loss, not a gap.
- **Revenue:** none.
- **Note:** refreshed 02:25→02:26 IST at end-of-session (superseding the earlier 02:25 mid-session
  snapshot) — this is the closing capture for Day 3, same as Day 1's close-of-day refresh.

_Day 3 of ≥5 — ✅ captured (refreshed at session close)._
