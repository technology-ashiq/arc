# Phase 10 live demo — the owner talks to the face

**Date:** 2026-10-02 · **Where:** the MAIN clone (`E:/Work_Hub/01_Automemory/arc`) at `41b0e365` (#309 merged, on top of
#307 and #308), started with `node .claude/scripts/hq/arc-face.mjs` (door on 8317, app on 5180). The app URL went to the
owner in the session; the token is not recorded here.

**What the owner was asked to do:** open Settings from HQ's header and add a model of his choice, then on `/` ask one arc
question and one general question, by typing and by voice, and read the two labels.

**What the owner said (in the session, verbatim):**

> check pannen, okay va iruku

(Tanglish: "I checked it, it's okay.")

**Not covered by this transcript:** the owner did not say which model he added or which questions he asked, so this file
does not claim the voice path or either label was exercised by hand. Each is asserted on every CI leg: the registry, key
redaction, lane labels and the voice state machine by `tests/face/talk.mjs`, and an arc and a general ask on `/` against
`tests/face/fake-llm.mjs`, in dark and light, by `face/scripts/smoke.mjs` (#307, #308, #309 merged green).
