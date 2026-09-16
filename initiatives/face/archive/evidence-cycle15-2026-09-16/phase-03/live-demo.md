# Phase 03 — live demo on the REAL spine (2026-08-19)

The DoD asks for a live demo, not a fixture pass. `arc dash` was booted in **live mode**
against the canonical spine (`ARC_SPINE_ROOT=E:/Work_Hub/01_Automemory/arc/.claude/state/hq`
— the env door names the spine explicitly, which is the only legal way to reach it from a
worktree; `spineRoot()` refuses a linked worktree otherwise) and every door was driven.

## What the doors returned

```
health: mode=live events=1146 days=22 closed=21 kindsSeen=14/46 torn=0
        idem=1146 quarantined=245
quarantine byCode: DUP_IDEM 231 · BAD_ARGS 6 · UNKNOWN_KIND 3 · BAD_DECISION 2 ·
                   BAD_JSON 1 · BAD_ADOPTION_PROPOSAL 1 · BAD_PROCESS 1
cursor: 01M0C7F4A5G91HKCM24B3HVQ4V

inbox:  open=13  decided=42   (approval.requested raised: 55)
board:  16 lanes, 7 LIVE, updated 2026-08-19
lane/face: status=LIVE phase=03 burn=4d      (read through the board lint's own parser)
brief:  24 lines, assembled by the arc-brief CLI itself
as-of 2026-08-12 (a real sealed day): 1000 events, more=true, deterministic across two reads
file/constitution: sha256=233a6496… badge="file, not log", 5585 bytes
pnl: model + kill panel both present (real revenue ₹0 — the honest empty)
```

The Build-out Mandate receipt `01KZTM348858PDH44K4HA64CVA` was located **through the door**
(`/api/spine?kind=decision.recorded`), day-file 2026-08-12 — the same receipt ADR-1300
cites, now reachable by the surface that cites it.

## What the live read CAUGHT — the reason this evidence exists

The frozen fact-pack said **1,386 receipts**. The door says **1,146**, and the day-file line
count agrees with the door exactly. 1,386 was a number quoted from a survey report and
carried into a contract without being derived — the precise defect ADR-0107's derive-it rule
exists to prevent, and the design source reproduces it too (it carries 1,121 from its own
grep). `spine.mjs` is the authority (ADR-0030); the pack now carries the derived figure and
says why.

Two more corrections fell out of the same read:

- **Open approvals: 2 → 13.** The pack's "the ONLY two" was a stale snapshot; the engine
  lane has since raised escalations and draft verdicts. Four distinct approval PROFILES are
  live (phase-done · engine-escalation · draft-verdict · the growth gates), which is exactly
  what the Inbox's profile-specific detail bodies exist for — and nobody noticed the count
  moving, which is the argument for the room.
- **`content.published` 1 → 4, `run.completed` 17 → 25** and the rest re-derived through
  `spine.query` rather than quoted.

Every one of these is the face doing its job before it has a UI: a surface that derives
its numbers disagreed with a document that quoted them, and the surface was right.

## Known gap, recorded rather than hidden

The three variants and the reference render the stale `1,386`. They were composed against
the pack as it stood, all four carry the same figure, so the blind comparison is unaffected
(content is a constant across items by construction). The corrected pack is what the winning
thesis builds against — and in the built face the number is derived at read time, never
transcribed, so this class of error cannot survive into L3.
