# Phase 11 live demo — the owner reads the Settings page

**Dates:** 2026-10-05 .. 2026-10-07 · **Where:** the MAIN clone (`E:/Work_Hub/01_Automemory/arc`), started with
`node .claude/scripts/hq/arc-face.mjs`; the last read on a door started 2026-10-07 00:06 on `59786f55`, which holds
#346 (`5fb80422`, cost · used by · remove guard).

**What the owner was asked to do:** open Settings (its own page since ADR-1350 Amendment 2), edit a model, pick a voice,
then read a model's declared cost, its used-by line, and the remove guard (Amendment 4).

**What the owner said (in the session, verbatim):**

> sari thaniya irunthalum, seperate page ah vaikalama ?

(2026-10-05, at the first read of the Settings popup: voice worked; he asked for a page. Amendment 2 built it.)

> edit ok, voice ok

(2026-10-06, recorded in `evidence/phase-12/owner-demo.md` as well.)

> ama cost add panra option iruku

(2026-10-07. Tanglish: "yes, there is an option to add the cost.")

> "used by: no router class" varuthu

(2026-10-07. Tanglish: "it shows 'used by: no router class'.")

**Checked after he said it:** a private door started from the main clone (port 8399, its own token, stopped after the
read) answered `GET /api/model-policy` with 4 tiers and 12 classes and **0** rows naming a profile: `engine/router.yaml`
mentions `profile:` only in comments. His store holds two models (`Google`, `OpenRouter`). So "no router class" is the
true answer for both, and the line he read is the one `ModelsPanel.tsx` draws when the policy read succeeded and nothing
routes to the model.

**Not covered by this read (declared, not hidden):**

- **The remove guard was not exercised by hand.** No router row names either of his models, so a guarded refusal cannot
  be shown on his real router, and pressing Remove would have deleted a real model. Wiring a profile into
  `engine/router.yaml` for a demo is a production tier change (ADR-0069), so it was not done. The guard is asserted on every
  CI leg by `tests/face/talk.mjs` (remove and rename of a routed record refused with the rows named; an unreadable router
  refuses; the B1-B4 boundary fixes of round 1) — #346 merged green, run 37461161623, 19/19, suite 1..4185.
- **Test a model** was asserted on CI against `tests/face/fake-llm.mjs` (section T) and by the browser smoke; this file
  records no words of his about pressing Test.
