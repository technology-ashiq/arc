# Phase 04 — quarantine review (ADR-0031)

**Reviewed:** 2026-07-28 at window close · **Source:** `.claude/state/hq/events/_quarantine/`
(instance-local and gitignored — SPINE-B; counts and classifications recorded here because the
raw files do not travel with the repo).

Required by the Phase-04 DoD: *"review `events/_quarantine/` at close; explain each entry in the
bundle."* Every entry below is accounted for.

---

## Totals by day and code

| Day | Entries | `DUP_IDEM` | `BAD_JSON` | `stub_only:true` | In window? |
|---|---|---|---|---|---|
| 2026-07-23 | 35 | 34 | 1 | 0 | no — pre-window (Phase 03) |
| 2026-07-24 | 27 | 27 | 0 | 0 | yes — Day 1 |
| 2026-07-25 | 9 | 9 | 0 | 0 | yes — Day 2 |
| 2026-07-28 | 30 | 30 | 0 | 0 | yes — Day 3 |
| 2026-07-26 / 27 | **0 — no file** | — | — | — | see gap audit §5 |

Two codes only. Both are explained below; there is no unexplained entry.

## 1. `DUP_IDEM` — 100 entries — **NOT benign**

These are **not** duplicate noise. Per `gap-audit.md` §2, the idem preimage carries no time and
no per-session identity, so it collapses to a pure function of the payload — meaning a repeat
session on a branch, or a repeat edit of a file, produces a colliding idem and is discarded.
**Each of these 100 entries is a real receipt that was lost.**

Direct evidence from Day 3, where the collision was watched happening live as this session
edited the same files repeatedly:

| File edited | Times rejected |
|---|---|
| `PROGRESS.md` | 9 |
| `PLAN.md` | 7 |
| `docs/evidence/phase-04/day-log.md` | 6 |
| `phases/phase-04-spec.md` | 4 |
| `docs/evidence/phase-04/brief-2026-07-28.txt` | 2 |
| 2 memory files (1 each) | 2 |

The Day-3 quarantine count rose from 11 to 30 during the closing work itself — the defect
reproducing in real time, on the very files documenting it.

**Superseded:** the Day-1 log entry called these *"dedup working as designed … no data loss, not
a gap."* That reading was wrong. The original wording stays in `day-log.md` (corrections
supersede rather than overwrite — ADR-0029); this review and the gap audit are the correction.

## 2. `BAD_JSON` — 1 entry — pre-window, cause not confirmed

```
{"code":"BAD_JSON","day":"2026-07-23","raw":"","reason":"--payload: Unexpected end of JSON input",
 "stub_only":false,"ts":"2026-07-23T22:15:18+05:30"}
```

A single emit reached the validator with an **empty** `--payload` and was correctly refused.
Dated 2026-07-23 — one day **before** Day 1, so outside the dogfood window; it belongs to the
Phase-03 development period. `raw` is empty, so the malformed input itself is not recoverable
from the record.

Not root-caused, and not guessed at here. A plausible path exists (`90-emit.sh` falls back to a
literal payload string when `jq` is absent, and a partially-written payload would fail the same
way) but nothing in the record confirms it. Filed as a low-priority open item alongside the
gap audit's §5.

## 3. What the quarantine mechanism itself proves — the good news

The rejection path behaved exactly as designed on all 101 entries:

- **Hook mode never blocked a session.** Every rejection exited 0; no session was interrupted or
  failed at any point in the window (ADR-0031 holds).
- **Nothing invalid reached the spine.** Every quarantined event stayed off `events/*.jsonl`.
- **No secret ever hit the quarantine file.** `stub_only` is `false` on all 101 entries, meaning
  the redaction fail-safe (ADR-0028) never had to strip a payload — no secret-bearing emit
  occurred, and no raw secret bytes were written to quarantine.

The containment is sound. What is wrong is the **idem policy feeding it**, not the quarantine
mechanism — the spine is correctly refusing what it believes are duplicates; it simply believes
wrongly.

## 4. Disposition

No quarantined entry is replayed or recovered here. Recovery would mean re-emitting events whose
timestamps are gone, which the spine's own ethic forbids (append-only, never reconstruct). The
lost receipts are recorded as lost. The fix belongs to the next cycle — see `gap-audit.md` §6.
