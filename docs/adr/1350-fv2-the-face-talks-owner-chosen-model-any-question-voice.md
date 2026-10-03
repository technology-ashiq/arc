# ADR 1350 — FV2-R: the face talks: any question, a model the owner picks in the face, answers by voice

**Status:** accepted 2026-10-01 by the owner (the owner asked for it on 2026-10-01 during `/arc-resume --lane face`, after the Phase 09 live demo; code waits on his OK)
**Date:** 2026-10-01
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a general answer is shown without its "not from arc's record" label, or an arc answer is shown as verified when a citation does not resolve; a stored key is ever read back by any endpoint; the owner finds voice mishears arc's words (ULIDs, kind names) often enough to stop using it.
**Amends:** ADR-1315 (voice deferred to the REQ-10 retro — the owner asked for voice before the dogfood, so its trigger fired early) · ADR-1325 (the brain keeps its contract — kept, with one addition: a model the owner configures, and a second, labelled lane for general questions) · two PLAN no-gos ("the model half of `face-ask`", "Web Speech voice").

## Context

At the Phase 09 live demo the owner read the front door against the design and accepted it ("design ithu machi, nalla iruka simple ah sleek ah"). Then the owner asked where the talking was. The design's face answers whatever it is asked, is connected to a model, and speaks. The cycle had ported none of it: ADR-1315 deferred voice, the PLAN listed "the model half of `face-ask`" as a no-go waiting on the engine seam, and the shipped Ask dock (`face/src/shell/Dock.tsx`) answers arc questions only, deterministically first (`arc-dash.mjs` `apiAsk`), text only, and only inside the workroom.

His words set the requirement: "arc face athoda product la ethathu keta ellame proper ah ans pannanum, arc ku oru llm connect pannuvom, ui la add panra maari irukanum, en istathuku na atha add pannuven, free/paid model ethunalaum, genral ah ketalum ans pannanum, arc ah pathi ketalum correct ah ans pannanum." Four things: any question gets a proper answer; arc questions are answered correctly; a model is connected to arc and the owner adds it from the UI, any model the owner likes, free or paid; the answer is spoken.

## Options considered

1. **Text-only, arc-only, the dock moved to the front door** — small. Rejected: it answers none of the four things he asked for.
2. **A model behind the face, its key in the browser** — simplest wiring. Rejected: ADR-1325's non-negotiable (no provider key in the browser), and the repo is public.
3. **The owner's model registry on the door (L2), set from a settings panel in the face, two labelled answer lanes, voice as a setting** — chosen.

## Decision

1. **The model is the owner's, added in the face.** A settings panel in the face lists the owner's models and adds one: a name, an OpenAI-compatible base URL, a model id and an optional key. That one shape reaches OpenRouter (free and paid models), OpenAI, Groq, DeepSeek, Anthropic's compatible endpoint, and a local Ollama or LM Studio (free, no key). The owner picks one as the active model and can add, switch and remove at will. The engine's `generic-api` driver already speaks this shape (plain `fetch`, no SDK).
2. **The key never lives in the browser.** The panel sends a new key once, over the token-guarded local door, to `POST /api/models/set` (a path of its own, because the face's route table holds one method per path); the door writes it to `~/.arc-private/face/models.json` (outside the repo, owner-only), and no endpoint ever returns it — `GET /api/models` shows the last four characters only. ADR-1325's line holds: after the save, the browser holds no key.
3. **Two answer lanes, always labelled.** *Arc questions* keep ADR-1325's contract: deterministic first; the model only for what the reader cannot reach, given the spine's evidence; every citation resolved through L2, and an answer whose citation does not resolve is marked *unverified*, never silently kept. *General questions* (anything not about arc) go to the owner's active model and are labelled **"general — not from arc's record"**, with no citations claimed. A question is routed to the arc lane when the deterministic reader recognises it or the model's routing reply names arc; when unsure, the answer is labelled general. Both lanes stay read-only: Ask gains no write tool and `ASK_ACTIONS` is unchanged.
4. **Every model answer is receipted.** It runs through `arc-run` as the governed `face-ask` process, so the model, the lane and the outcome land on the spine like every other run. No new spine kind (a no-go stands).
5. **The face asks and answers on the front door and in the workroom.** One ask box under the face on `/`; the workroom dock uses the same brain.
6. **Voice is a setting, on by the owner's choice.** Speech in through the browser's `SpeechRecognition`, speech out through `speechSynthesis` — no dependency, no key. The front door gets a mic control; the face's presence follows the speaking state. Text is always there; voice is never required.

## Consequences

Easier: the owner's design's main act — talk to the face — exists; any model the owner wants is a form, not a code change; free local models cost nothing.

Harder: a general answer cannot be verified, so the label is load-bearing and is held by a fixture. Chrome's `SpeechRecognition` sends audio to Google's servers (Edge's to Microsoft's) — the settings panel says so beside the switch. Speech mishears arc's words (ULIDs, kind names), which is why typing stays first-class. The door gains its first configuration write that is not a decision or an op; it is local-only and token-guarded like every other door write, and it writes nothing into the repo.

Not done here: per-answer ₹ estimates and a spend cap (the owner picks free or paid knowingly; a cap is its own change if the owner asks), streaming tokens into the face, a wake word.
