# Phase 09 — live demo on the REAL spine (2026-08-24)

The DoD asks for a live demo, not a fixture pass. `arc dash` was booted in **live mode**
against the canonical spine — `ARC_SPINE_ROOT=E:/Work_Hub/01_Automemory/arc/.claude/state/hq`,
the env door naming the spine explicitly, which is the only legal way to reach it from a
worktree (`spineRoot()` refuses a linked one) — and every READ door was driven.

`POST /api/decide` was NOT driven. It is the one write path in this product, and evidence for
a phase must not change the thing the next phase measures. The journal was pointed at a
scratch directory for the same reason.

## What the doors returned

```
health: mode=live events=1194 days=26 closed=25 torn=0
        idemIndex=1194 kindsSeen=14/14
        quarantined total=247 by code: DUP_IDEM 231 · BAD_JSON 1 · BAD_ARGS 6 · UNKNOWN_KIND 3 · BAD_ADOPTION_PROPOSAL 1 · BAD_DECISION 3 · BAD_PROCESS 1 · NO_INPUT 1
        (DUP_IDEM is dedup, not loss -- the real losses are the 16 others)
rooms:  34 served · kinds ever fired 14
        states live=18 · file-borne=8 · unexercised=6 · index=2
        inventories served: adrs=14 · jobs=2 · ventures=1 · plannedRooms=4 · ci=4
        board        file-borne   lanes=1 rules=1 lints=2 concepts=4 adrs=1
        scheduler    live         kinds=2 lanes=1 lints=1 concepts=3 adrs=1 jobs=2
        ventures     unexercised  kinds=3 concepts=1 ventures=1
        strategy     file-borne   concepts=2 plans=24
        toolbelt     file-borne   lanes=1 commands=5 hooks=7 rules=6 lints=3 concepts=3 products=1 adrs=1 capabilities=6
        review-ship  live         kinds=4 commands=10 agents=3 gates=7 products=3 ci=4
        chat-mcp     file-borne   plannedRooms=1
board:  16 lanes · badge "file, not log"
inbox:  6 open
lane:   face phase=09 status=LIVE phases=9 omitted=0
        00 Phase 00 — Brief + coverage contract
        01 Phase 01 — Explore ×3 + design system (the design lane decides the look)
        03 Phase 03 — L2 `arc dash` (the steel thread of the doors)
brief:  200 25 lines
pnl:    200
refuse: no token -> 401 NO_TOKEN
        foreign Origin -> 403 BAD_ORIGIN
        traversal lane -> 404 UNKNOWN_ROUTE

NOT DRIVEN: POST /api/decide. It is the one write path and evidence must not change the
thing the next phase measures.
```

## What this shows, against Phase 09's exit criteria

**Nine inventories derived from the world, and SERVED.** `inventories served: adrs=14 ·
jobs=2 · ventures=1 · plannedRooms=4 · ci=4` — the block `/api/rooms` carries so a room can
render what `holds` cannot give it. Before ADR-1317 the door served no such block and the
board's "ADR map" station rendered nothing.

**The four empty stations carry rows, on the real tree.** `board adrs=1` (the company band;
the other thirteen home in their lanes' rooms and the full map comes from `inventories`),
`scheduler jobs=2`, `ventures ventures=1`, `strategy plans=24`, `toolbelt capabilities=6`,
`review-ship ci=4`. Each was a station that named a thing and drew nothing.

**`chat-mcp` exists.** 34 rooms served, and the room declared in `planned-rooms.json` and
ADR-1306 and generated nowhere is now one of them (`chat-mcp file-borne plannedRooms=1`).

**`/api/lane/:name` carries phases.** `phases=9 omitted=0` for the face lane, with titles —
the 107 specs across all lanes sat in the directory `apiLane` already read and never came
through the door.

**The four honest states are all exercised on real data:** `live=18 · file-borne=8 ·
unexercised=6 · index=2`. Not one of them is a bare zero.

**The refusals hold on the canonical spine**, not only against a fixture: `no token -> 401
NO_TOKEN`, `foreign Origin -> 403 BAD_ORIGIN`, and a traversal in the lane name is refused.

## One number that is quoted carefully

`quarantined total=247` is NOT 247 lost receipts. 231 are `DUP_IDEM` — the idem preimage
carries no time, so repeat edits of one file collide — and reading the total as loss is a
mistake this repo has already made and written down. The real losses are the **16** others,
broken out by code above so the number cannot be quoted without its shape.

## What this does NOT show

The write path, deliberately. Phase 04's evidence carries a real `decision.recorded` written
from the app through `/api/decide`; that is where the write proof lives, and repeating it here
would add a receipt to the canonical spine for no reason other than this document.
