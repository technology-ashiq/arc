# Phase 09 live demo — the owner reads the front door against his design

**Date:** 2026-10-01 · **Where:** the MAIN clone (`E:/Work_Hub/01_Automemory/arc`) at `ad83b34f` (#305 merged), started with
`node .claude/scripts/hq/arc-face.mjs --port 8327` (8317 was held by another door the session did not start, so it was left
alone). The app URL went to the owner in the session; the token is not recorded here.

**What the owner did:** opened `/`, saw the neon face, one message line and ENTER HQ, entered the workroom and came back.

**What the owner said (in the session, verbatim):**

> design ithu machi, nalla iruka simple ah sleek ah

(Tanglish: "this is the design, mate — it looks good, simple and sleek.")

**The same message asked for more**, which is not a Phase 09 gap but a new capability, routed the same day:

> but epdi athukoda pesurathu, ethathu keta athu ans pannum la first, athyu koda models connect panra maari irunthuchu ne athellam pakalaya, arc pathi keta sollu, vera ethathu ketalum ans sollum voice la

That ask — talk to the face, any question answered, a model the owner adds, voice — became ADR-1350 / REQ-14 / Phase 10
(`/arc-change --lane face`, 2026-10-01). It does not reopen REQ-13: the front door as specified (option A, the hero) is what
he accepted.

**Not covered by this transcript:** keyboard ENTER HQ, WebGL-off and the palette on the door were not exercised by hand; each
is asserted on every CI leg by `face/scripts/smoke.mjs`'s front-door pass (run 36858931483, 19 of 19 green).
