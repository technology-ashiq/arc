# Phase 04 — Live dogfood · evidence bundle summary

**Phase:** 04 (Live dogfood) — the last phase of Cycle 2 · **Host:** arc itself
**Window:** 2026-07-24 → 2026-07-28 (5 elapsed calendar days, 3 real working days)
**REQ:** REQ-07 · **Compiled:** 2026-07-28

---

## 1. What this bundle contains

| File | What it holds |
|---|---|
| `day-log.md` | Per-day record: brief size, receipt counts + kinds, quarantine, observations |
| `brief-2026-07-24.txt` · `-25` · `-28` | The actual `arc brief` output for each working day |
| `events-2026-07-24.jsonl` · `-25` · `-28` | Copies of that day's spine receipts (live spine is gitignored — SPINE-B) |
| `gap-audit.md` | Session-log vs spine comparison (pre-mortem #2) — **the defect finding** |
| `quarantine-review.md` | Every quarantine entry classified and explained (ADR-0031) |
| `SUMMARY.md` | This file |

## 2. The window

| Day | Date | Brief | Valid receipts | Quarantined |
|---|---|---|---|---|
| 1 | 2026-07-24 | 10 lines / 306 ms | 22 | 27 |
| 2 | 2026-07-25 | 1 line | 1 | 9 |
| 3 | 2026-07-28 | 5 lines | 5 | 30 |
| — | 2026-07-26 | *none* | **0 — no day file** | 0 |
| — | 2026-07-27 | *none* | 0 | 0 |

**2026-07-26** had 4 real arc commits and confirmed Claude Code use in this repo, yet produced
nothing at all — the window's central anomaly (§4).
**2026-07-27** was work on the Lexos venture plus non-code work; Lexos has no spine installed, so
zero receipts is correct there, not a gap.

**Amendment #1 (2026-07-28, owner's call, routed via `/arc-change`):** the window was cut from
≥5 real working days to ≥3, and "consecutive" was dropped because the captured days are not
calendar-consecutive. Not appetite-forced (~40% burnt; the 50% tripwire was never reached) and
not an assumption failure — the reason was owner reprioritization toward the Lexos venture. Full
rationale and stated cost: `phases/phase-04-spec.md` § Amendment #1.

## 3. What the dogfood proved — honestly

**Held up (REQ-05):** the brief rendered ≤ one screen on all 3 days (10 / 1 / 5 lines) and well
under the 5s budget (306 ms measured Day 1). It read from the spine reader only.

**Held up (ADR-0031 / ADR-0028):** hook mode never blocked or failed a session across the whole
window — 101 rejections, every one exiting 0. Nothing invalid reached `events/*.jsonl`. No secret
ever hit the spine or the quarantine (`stub_only:false` on every entry).

**Did NOT hold up (REQ-01):** *"every factory action leaves a receipt"* is false in real use. The
spine silently discarded 100 real receipts across the window.

**Revenue:** zero `revenue.received`, as required — arc earns no real money and none was
fabricated. The `revenue.simulated` path was not exercised this window, so REQ-07 closes as
**"mechanism proven, live value pending"** — the honest wording the plan reserved for exactly
this case.

## 4. The finding

The dogfood's whole purpose was to surface what the tests could not, and it did.

`arc-event.mjs:99` derives the idem from
`actor|venture|kind|run_id|outcome|payload` — **no timestamp, no per-session identity.** For hook
emissions every one of those is constant (`run_id` is always the default `r-adhoc`; nothing sets
`ARC_RUN_ID`), so the idem reduces to a function of the payload alone:

- session receipts key on **the branch name** → the 2nd+ session ever on a branch is dropped
- file-edit receipts key on **the file path** → the 2nd+ edit of a file, ever, is dropped

Because hook mode never blocks, the loss is invisible at the time it happens. This explains the
thin days directly — and on Day 3 the defect was observed reproducing live, discarding 9 receipts
for `PROGRESS.md` and 7 for `PLAN.md` as those very files were edited to document it.

**Still open and not explained:** 2026-07-26 produced neither receipts nor quarantine lines.
Dropped receipts still write a quarantine line, so total silence points to a second, separate
cause that has not been identified. Recorded as a known unknown rather than closed
(`gap-audit.md` §5).

## 5. Corrections of record

The Day-1 log concluded the quarantine entries showed *"dedup working as designed … no data loss,
not a gap."* **That was wrong.** Superseded by `gap-audit.md` and `quarantine-review.md`; the
original text remains in `day-log.md` because corrections supersede rather than overwrite
(ADR-0029) — the same discipline the spine itself enforces.

## 6. Open decisions carried to `/arc-retro` and `/arc-phase-done 4`

1. **REQ-01's status.** Marked `validated`, but its dry-run golden cannot catch this class —
   every event in a scripted run is distinct. Either re-validate against a repeat-action fixture
   (same file edited twice, same branch entered twice) or downgrade it honestly. Deliberately
   left unchanged in the tracker pending that call.
2. **The idem fix.** Candidate: include `ms` or a real per-session `run_id` in the preimage for
   hook-mode lifecycle events, while keeping content-derived idem on the `ingest` path where
   cross-day dedup is *required* (REQ-03). Next cycle — not fixed during the dogfood, since
   wiring and vocabulary are closed for this phase (ADR-0026).
3. **The 07-26 silence.** Unidentified second cause.
4. **The reader-only grep-lint TRIAL gate.** Its promote/hold decision is due at the retro.

## 7. Note on window length

The collision is invisible on a first touch of each file, so a single-day window would have shown
nothing wrong. This defect surfaced only because the window ran past Day 1 — evidence that the
multi-day requirement earned its keep, and a reason not to shorten it further in a future cycle.
