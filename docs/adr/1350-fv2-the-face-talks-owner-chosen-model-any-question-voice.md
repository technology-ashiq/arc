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

## Amendment 1 (2026-10-03, owner) — one Settings menu: test a model, choose the voice

**Why.** After #314 the owner found answers slow and asked for "models add verify and test" in one menu, and whether the voice can change. The spine showed one free model at 3-8 s at night and 36-37 s in the afternoon, and another refusing in under a second; the face had no way to show either before he asked.

1. **One menu.** HQ's header Settings and a ⌘K "Settings" entry open one menu with two sections, Models and Voice. The front door's ask bar still carries no settings (the 2026-10-01 ruling stands).
2. **Test a model.** `POST /api/models/test` (its own path; one method per path, as §2) takes a model's name, asks that model one fixed probe question through `arc-run --process face-ask`, and returns `ok` or `providerFault`'s plain cause, plus the seconds taken. It is receipted like any answer (§4), changes no active model, and returns no key. The door keeps each model's last test in memory while it runs, returned beside its row by `GET /api/models`; nothing new is written to disk. A test is pressed, never run on a timer: it spends the owner's quota.
3. **Choose the voice.** The Voice section adds the browser's own `speechSynthesis` voices, a speed of 0.75x to 1.5x, and a preview. The choice is kept in the browser beside the switch (§6); no cloud voice, no new dependency, no key.

Filed as REQ-15 / Phase 11, before the dogfood (Phase 08). Appetite +1.5d (total 38.5d). No new spine kind; streaming and a spend cap stay out.

## Amendment 2 (2026-10-05, owner) — Settings is its own page, not a popup

**Why.** At the Phase 11 live read the owner found voice working and asked for Settings as a page of its own:
"sari thaniya irunthalum, seperate page ah vaikalama ?" -- even kept apart from the rooms, as a separate page.

1. **A page in the workroom, not a room.** Settings draws in the workroom's main area in place of a room, at its own
   address (`#/lane&view=settings` over the lane room, `#hq&view=settings` over the home), so it can be reloaded, bookmarked and left with Back. It is not a room in the rail's groups, not served
   by `/api/rooms`, and not a surface: the workroom stays the one surface besides the front door (ADR-1349), so
   `face-coverage`'s room and surface counts do not move.
2. **Three ways in.** HQ's header Settings, a Settings link at the foot of the rail (below the rooms, not counted with
   them; the owner asked for it in the menu the same day, "menu laye add pannirlaama") and the ⌘K "Settings" entry open
   the page; leaving it returns to the room
   that was open. The front door still carries no settings (the 2026-10-01 ruling stands, `door-no-settings` holds).
3. **The same contents.** Models (add, activate, remove, Test with ok-or-why and seconds, the last test kept) and Voice
   (the switch, the browser's voices, speed 0.75x to 1.5x, Preview), unchanged from Amendment 1. No door route changes.

Filed inside Phase 11 (still open), REQ-15's acceptance amended from "one menu" to "one Settings page". Appetite
+0.5d inside Phase 11's 1.5d; the total stays 38.5d.
