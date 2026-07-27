# Phase 04 — gap audit (session-log vs spine)

**Run:** 2026-07-28 · **Window:** 2026-07-24 → 2026-07-28 · **Trigger:** pre-mortem #2
("silent wiring gaps — 'replayable day' is a lie"). Required by the Phase-04 DoD; not cut by
amendment #1.

**Verdict: a real defect was found.** The spine silently drops genuine receipts. This is the
finding the dogfood existed to produce.

---

## 1. What was compared

Git history + reflog for the window against `.claude/state/hq/events/` (valid receipts) and
`events/_quarantine/` (rejections).

| Date | Real arc work? | Valid receipts | Quarantined | Verdict |
|---|---|---|---|---|
| 2026-07-24 | yes | 22 | 22 (all DUP_IDEM) | covered, but see §2 |
| 2026-07-25 | yes — 4 commits, 18:49–23:41 | **1** (14:05) | 9 (all DUP_IDEM), last at 17:31 | **gap** |
| 2026-07-26 | yes — 4 commits, owner confirms Claude Code in this repo | **0 — no day file at all** | **0 — no quarantine file** | **gap, unexplained tail** |
| 2026-07-27 | no arc work (Lexos + non-code) | 0 | 0 | not a gap — out of host scope |
| 2026-07-28 | yes | 5 | 11 (all DUP_IDEM) | covered, but see §2 |

## 2. Root cause (proven in code)

`.claude/scripts/hq/arc-event.mjs:99`:

```js
const derived = sha256Hex(`${actor}|${venture}|${kind}|${runId}|${outcome}|${canonicalize(payload)}`);
```

**The idem preimage carries no time and no per-session identity.** Every component is constant
for hook-mode emissions:

- `actor` — always `arc-event`
- `venture` — always `arc`
- `kind` — always `note.logged` (session lifecycle rides `note.logged`; ADR-0026 closed the
  vocabulary at 18 kinds, so there is no dedicated session kind)
- `runId` — `envOr("ARC_RUN_ID", "r-adhoc")`, and **nothing sets `ARC_RUN_ID` for hook
  emissions** — every receipt in this window carries `"run_id":"r-adhoc"`
- `outcome` — always `ok`

So the idem collapses to a pure function of the payload:

| Emission | Payload | Idem is a function of | Consequence |
|---|---|---|---|
| SessionStart (`SessionStart.d/90-emit.sh`) | `{event:"session.start", branch:B}` | **the branch name** | the 2nd and every later session ever started on branch B is dropped |
| PostToolUse (`PostToolUse.d/90-emit.sh`) | `{event:"tool.postuse", file:F}` | **the file path** | the 2nd and every later edit of file F, on any day, is dropped |

These are not duplicates. They are distinct real events at distinct times, discarded because
the idem cannot tell them apart. The rejection is by design invisible: hook mode never blocks
and exits 0 (ADR-0031), so the session shows no sign that a receipt was lost.

**Verified against the data:** the 07-28 quarantine entries name the exact collision, e.g.
`"idem already on the spine as 01KY9BDX8E9AQ424HHWT6TV0MB"` for a repeat edit of
`day-log.md` — a file edited earlier the same session.

## 3. Corrections to earlier records

The Day-1 log entry in `day-log.md` reads *"Dedup working as designed … **No data loss, not a
gap**"*. **That conclusion was wrong** and is superseded by this audit: those 22 rejections were
real receipts destroyed, not duplicate noise absorbed. The Day-1 text is left in place (the
spine's own append-only ethic — corrections supersede, never overwrite) with this audit as the
correction of record.

## 4. Impact on REQ-01 (`validated`)

REQ-01 claims *"every factory action leaves a receipt"*, validated at Phase 01 by a scripted
dry-run golden. **The golden passes and the claim is still false in real use** — every event in
a scripted run is distinct, so no collision occurs; real work repeats actions on the same file
and branch constantly, so it does.

REQ-01's status is **not** silently changed here. Flagged for the closing `/arc-retro` and
`/arc-phase-done 4` decision: REQ-01 either needs re-validation against a repeat-action fixture
or an honest downgrade.

## 5. Open — not explained by §2

2026-07-26 produced **neither valid receipts nor quarantine entries** — total silence, no day
file created. The idem defect explains dropped receipts, but dropped receipts still write a
quarantine line (as they did on 07-25 and 07-28). So a second, separate cause is likely on that
date and is **not** identified. Candidates not yet tested: the async `nohup … &` SessionStart /
PostToolUse emissions (Phase-01 assumption row 3 moved them off the critical path) losing the
race on that session, or the hooks not firing at all. Filed as open — no fix attempted here.

## 6. Actions

Per the phase spec, no emission points are added and no code is changed during the dogfood
(vocabulary/wiring closed — ADR-0026); gaps are named and filed.

| # | Finding | Disposition |
|---|---|---|
| 1 | Idem preimage lacks time/run identity → silent loss of repeat receipts | File as a post-cycle ADR + fix in the next cycle. Candidate fix: include `ms` (or a real per-session `run_id`) in the preimage for hook-mode lifecycle events, keeping content-idem for the `ingest` path where cross-day dedup is REQUIRED (REQ-03) |
| 2 | Day-1 "no data loss" conclusion was wrong | Corrected by §3 above |
| 3 | REQ-01's golden cannot catch this class | Raise at `/arc-retro`: add a repeat-action fixture (same file edited twice) before REQ-01 can be called validated |
| 4 | 2026-07-26 total silence unexplained | Open; carried into the retro as a known unknown, not closed as understood |

## 7. Note on the window length

Amendment #1 cut the window from 5 working days to 3. This defect surfaced only because the
window ran past Day 1 — the collision is invisible in a single session's first touch of each
file. Recorded as evidence that the multi-day requirement did real work, and as the reason a
future cycle should not shorten it further.
