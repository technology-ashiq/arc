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
