# Phase 10 — The face talks: any question, the owner's model, answers by voice

**Goal (one line):** REQ-14 — the owner asks the face anything, on the front door and in the workroom, by typing or by voice; arc questions come back correct and cited, general questions come back from the model he chose in the face and are labelled as general, and the answer can be spoken.
**Appetite:** 4 days
**Depends on:** phase-09
**Serves:** REQ-14
**Branch:** `feat/face-v2-10`
**Preconditions (STOP if absent):** Phase 09's PROGRESS row reads ✅ CLOSED **and the owner has approved ADR-1350** (its status reads accepted). The change is proposed until he says so.

## Exit criteria (Definition of Done)

- [ ] **The owner adds a model in the face (ADR-1350 §1):** a settings panel lists models and adds one by name, OpenAI-compatible base URL, model id and optional key; one is active; switch and remove work. A fixture on the pure registry (`face/src/lib/*.mjs` + the door's store) holds add · switch · remove · a bad URL refused · a duplicate name refused.
- [ ] **The key never comes back (ADR-1350 §2):** `POST /api/models` writes `~/.arc-private/face/models.json` (an env override points it at a sandbox in tests), outside the repo; `GET /api/models` returns the last four characters only. A fixture greps every door response for a planted key and FAILs on a hit; a mutant that echoes the key is the negative control. A planted key never appears in the repo tree (`git status` clean of it).
- [ ] **Arc questions stay correct (ADR-1350 §3, ADR-1325):** deterministic first; the model is asked only for what the reader cannot reach, with the spine's evidence; a citation that does not resolve through L2 marks the answer *unverified*. The existing `ask.mjs` verification fixtures stay green, and a fake model that cites a ULID not on the spine is shown as unverified.
- [ ] **General questions get an answer, labelled:** a non-arc question with an active model returns the model's answer labelled "general — not from arc's record", with no citations; with no active model the face says how to add one (never a blank, never an error page). A fixture FAILs an unlabelled general answer, with its mutant control.
- [ ] **Every model answer is receipted (ADR-1350 §4):** the answer runs through `arc-run --process face-ask`; the receipt names the model and the lane. No new spine kind.
- [ ] **Asking on the front door:** one ask box under the face on `/`; the workroom dock uses the same brain. The browser smoke asks one arc question and one general question on `/` against the fake provider and reads both labels, in dark and in light.
- [ ] **Voice, as a setting (ADR-1350 §6):** speech in (`SpeechRecognition`) and speech out (`speechSynthesis`) behind one switch, off until the owner turns it on; the panel says where the browser sends audio. Where the browser has no speech API the mic control is absent and typing works. The pure voice state machine (idle · listening · thinking · speaking) is held by a fixture.
- [ ] **Offline-first (PLAN External dependencies):** the model provider has an interface, a fake (`tests/face/fake-llm.mjs`, an OpenAI-compatible local server) and the real `generic-api` path, plus a contract test; CI never calls a real provider.
- [ ] **Owner talks to it:** from the MAIN clone the owner adds his own model in the face, asks an arc question and a general one, by typing and by voice, and says whether it is what he asked for. The transcript goes to `evidence/phase-10/`. This is the criterion only he can tick.
- [ ] Two fresh attackers (logic · boundary); CI green per job; `/arc-phase-done 10` from the main clone.

## Verification plan

Tests run on CI only, read per job, and each fixture asserts it RAN before asserting what it printed. One PR, one attack round, one push.

- **Test command:** `tests/face-dash.bats` → a new `tests/face/talk.mjs` (registry, key redaction, lane labels, voice state machine) and the harness smoke (`smoke.mjs`) extended to ask on `/` against `tests/face/fake-llm.mjs`.
- **Expected failure first:** before the change, `talk.mjs` fails to import the registry module; `GET /api/models` is a 404; the smoke finds no ask box on `/`.
- **Checks:** every registry transition; a planted key absent from every response and from the repo tree; an arc answer with a bad citation shown unverified; a general answer always labelled; no active model gives the how-to line; voice absent where the API is absent.
- **Live demo:** from the main clone, the owner adds a model of his choice, asks arc and general questions by text and by voice on `/`. Transcript to `evidence/phase-10/`.

## Rabbit holes in this phase

- **Spend control.** A per-answer ₹ estimate and a monthly cap are their own change if the owner asks; this phase shows which model answered, not what it cost.
- **Streaming.** Token-by-token answers into the face are not needed for a proper answer; the whole answer arrives at once.
- **Wake word and always-listening.** The mic is pressed, never ambient.
- **Tuning the face to the voice.** The presence follows the speaking state with the stage as it is; a new animation is the owner's call after he has heard it.
- **Provider SDKs.** One OpenAI-compatible shape through `generic-api`; no SDK per vendor (a PLAN non-negotiable of the engine).

## Out of scope for this phase

Write actions from Ask (ADR-1325 stands) · new spine kinds · option B's story sections (ADR-1349) · a spend cap · any change to the rooms.

## Your-setup / pending

The owner's OK on ADR-1350 before any code, a model of his choice (and its key, if it has one) at the live demo, and his read of it at the end.

## Non-negotiables (verbatim from PLAN)

<!-- Generated from PLAN.md at kickoff; resynced by /arc-change. Never hand-edited. -->

- The served registry is the only room list: modules attach to served ids, orphans are checked both ways, and the four extra rooms are exempted by name only (ADR-1306, ADR-1321, ADR-1327).
- Tokens have one source, `docs/design/system/tokens.css`; `face/src/tokens.css` is generated and never hand-edited, as `.claude/scripts/core/face-tokens.mjs --check` enforces; no colour literal under `face/src/modules/**`; council renders `--accent-dim` and violet is the non-real family alone (ADR-1308, ADR-1322).
- Every decision lives in a `.mjs` that node imports with no install: `fold.mjs` imports nothing from React, Vite or three, `View.tsx` carries no branch worth asserting, and Tailwind stops at L3 (ADR-1320, ADR-1323).
- `POST /api/decide` stays byte-parity with `arc-inbox`: the parity fixture is green on every PR of this cycle and is a Phase 05 exit criterion (ADR-1302, ADR-1333).
- Zero new spine kinds: every op emits a kind already in `validate.mjs` KINDS, and an op that would need a new one does not ship (ADR-0026, ADR-1334).
- Branch-only writes: a file-touching op writes to a `feat/face-*` branch, shows the diff and stops; `main` is untouchable and merge never exists in the face (ADR-1326).
- The WORK door has no logic of its own: each op shells the same script a hand-run calls, proven per op by a no-second-path fixture; an op without a green fixture ships read-only with an honest badge (ADR-1326).
- The SESSION door starts `arc-run --driver …`, never a harness binary (ADR-1326).
- No provider key in the browser; Ask keeps zero write tools and `ASK_ACTIONS` = `open_room` · `set_speed` · `enter_hq` (ADR-1325).
- No facts bundle under `face/src/**`: a module cites a door route or renders `NOT SERVED` (ADR-1324).
- No new surface outside `.claude/scripts/` this cycle; the layout move belongs to the distribute lane, in one atomic PR (ADR-1319).
- Real vs simulated / rehearsal / planned are never mixed or summed; planned rooms render dotted and every write inside them says REHEARSAL (ADR-1313, ADR-1328).
- Both moods ship together from Phase 01; light is never deferred to a later batch (ADR-1331).
- The reference is the target: v0.7 is the canonical design and the ported harness's frozen strings are the bar (ADR-1318, ADR-1330).
- REQ-10 claims the surface is operable over two real days and never claims the habit holds (ADR-1329).
- Localhost + token; no PII in git, the door or the intake; escaped serializer (ADR-1312).
- Zero product-code writes before explicit owner approval of this plan; each phase lands as its own feat branch + PR, and a phase closes through `/arc-phase-done` from the main clone before the next phase's branch opens (ADR-1332).
- Tests green on CI per job, never run on this box; the browser harness runs on every leg with Node ≥20.19 and Node 18 is a named, counted skip; structural face lints (`face-pure`, colour-literal, facts-bundle) FAIL from birth, heuristic arms start WARN-first; two fresh attackers per new gate (decision logic + shell/OS boundary) carrying the lane's fixed-defect list; assert it RAN before asserting what it printed (ADR-1335, ADR-1336).
