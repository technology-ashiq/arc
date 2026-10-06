# Phase 12 live demo — the owner sets his key in the face

**Date:** 2026-10-06 · **Where:** the MAIN clone (`E:/Work_Hub/01_Automemory/arc`) after #335 merged (`fb78f260`),
started with `node .claude/scripts/hq/arc-face.mjs`.

**What the owner was asked to do:** open ⚙ Settings → Keys and add `OPENROUTER_API_KEY` once, then edit a model and check
the voice (the last two are Phase 11's).

**What the owner said (in the session, verbatim):**

> OPENROUTER_API_KEY face la add panniten

(Tanglish: "I added OPENROUTER_API_KEY in the face.")

> edit ok, voice ok

**Checked after he said it (no value printed):** `~/.arc-private/keys/keys.json` exists outside the repo and lists
`STITCH_API_KEY` and `OPENROUTER_API_KEY`. `explainKey("OPENROUTER_API_KEY")` with the variable removed from the
environment found the stored value (73 characters, tail `…70ed`). That stored value, sent to OpenRouter's key-info
endpoint (`GET /api/v1/key`, no tokens spent), answered `status 200`; the key has a $10 limit with $5.20 used.

**Not covered by this transcript:** the owner's shell still carries `OPENROUTER_API_KEY` from an earlier `setx`, and the
environment wins (ADR-1351 §4), so arc's tools on this machine read that copy until he removes it; the read from the store
alone is the check above. The replace and remove buttons were not exercised by hand; they are asserted on every CI leg by
`face/scripts/smoke.mjs` (`hq-settings-keys`) and the door, file and driver paths by `tests/face/keys.mjs` (#335 merged
green, run 37414198527, 19/19, suite 1..4128).
