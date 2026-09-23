# Phase 05 — the real-place check (2026-09-23)

The door in **live** mode from the main clone (`E:/Work_Hub/01_Automemory/arc`) at `2fba48f7` (the merge of #263, the
last Phase 05 PR), over the canonical spine. Driver: a scratch script that boots `arc-dash.mjs --port 8531` with a
session token, reads the registry, plans five ops, and applies ONE -- capture an idea -- from the door's own origin,
then reads its receipt back off the spine files. No op that spends or leaves the machine was applied.

```
door: mode=live spine=canonical events=1379 days=47 torn=0 unreadableDays=0
GET  /api/ops                          200  31 ops
PLAN today.capture-idea                200  ok   ₹0 -- no model is called          no file changes -- one receipt
PLAN develop.checkpoint                200  ok   ₹0 -- no model is called          no file changes -- one receipt
PLAN bench.run-model (mock)            200  ok   ₹0 -- the mock driver reaches no provider
PLAN legal.full-read (fixture venture) 200  ok   ₹0 -- apply acts outside the spine; only your click runs it
PLAN org.lane-status face LIVE         200  REFUSED by the tool, verbatim (exit 2):
                                            "lane-status: face is already LIVE with that blocker on main -- nothing to change"
APPLY today.capture-idea               200  done ok -> idea.captured 01M37CDRK7E03P67E45Y1BDT4E (2026-09-23T20:28:55+05:30)
SPINE read-back                             found: idea.captured 01M37CDRK7E03P67E45Y1BDT4E, the same text
PULSE                                       4f71242bfda7f68aae77dca6 -> d0d0b0b9a710cf5a706b51c9 (moved with the receipt)
```

What each line shows, against the spec's Verification plan ("from the main clone, each shipped op's `plan` read back,
then one `apply` whose receipt is read off the spine; money-spending ops plan only; the live-rooms demo: a spine append
shows without a reload"):

- **The registry is served live, whole:** 31 ops, the count REQ-07 names (`residue.md`: residue none).
- **Plans read back with their command line, ₹ estimate and effect**, and one tool refusal rendered in the tool's own
  words (the DoD row "a tool's own refusal renders verbatim", on the live tree).
- **One apply, receipted:** the idea landed as a real `idea.captured` on the company spine and was found there by id.
- **Live rooms:** the door's pulse moved with the receipt, which is what makes an open room re-read (REQ-11; the
  in-browser timing, 922 ms, was measured in PR 2 and runs on every CI leg in `tests/face-browser.bats`).

The remaining 26 ops' plans were not repeated here: each is driven plan -> apply -> receipt against a sim door, with
its hand-run compared, by its ring's suite on every CI leg (`tests/face/work-door.mjs` and the ring suites).
