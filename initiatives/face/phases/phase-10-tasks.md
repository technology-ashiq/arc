# Build Brief — phase 10 · The face talks: any question, the owner's model, answers by voice

spec-hash: sha256:7f8b3661edaeb0b9f2facf6e45ff7302fd55023e3f401118e5674872f963444a
lane: face
reqs: REQ-14
adrs: 0026, 1302, 1306, 1308, 1312, 1313, 1318, 1319, 1320, 1321, 1322, 1323, 1324, 1325, 1326, 1327, 1328, 1329, 1330, 1331, 1332, 1333, 1334, 1335, 1336, 1349, 1350
blast-radius: .claude/scripts/, /, docs/design/system/tokens.css, face/src/**, face/src/lib/*.mjs, face/src/modules/**, face/src/tokens.css, tests/face-dash.bats, tests/face/fake-llm.mjs, tests/face/talk.mjs
no-gos: (unnamed), (unnamed), Lifted 2026-10-01 by ADR-1350 (REQ-14, Phase 10), (unnamed), (unnamed), (unnamed), (unnamed), Lifted 2026-10-01 by ADR-1350, (unnamed), (unnamed)
blast-radius-dropped: 12

### Non-negotiables

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

### Predictions

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: **The owner adds a model in the face (ADR-1350 §1):** a settings panel lists models and adds one by name, OpenAI-compatible base URL, model id and optional key; one is active; switch and remove work. A fixture on the pure registry (`face/src/lib/*.mjs` + the door's store) holds add · switch · remove · a bad URL refused · a duplicate name refused.
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-10-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: **The key never comes back (ADR-1350 §2):** `POST /api/models` writes `~/.arc-private/face/models.json` (an env override points it at a sandbox in tests), outside the repo; `GET /api/models` returns the last four characters only. A fixture greps every door response for a planted key and FAILs on a hit; a mutant that echoes the key is the negative control. A planted key never appears in the repo tree (`git status` clean of it).
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-10-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: **Arc questions stay correct (ADR-1350 §3, ADR-1325):** deterministic first; the model is asked only for what the reader cannot reach, with the spine's evidence; a citation that does not resolve through L2 marks the answer *unverified*. The existing `ask.mjs` verification fixtures stay green, and a fake model that cites a ULID not on the spine is shown as unverified.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-10-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: **General questions get an answer, labelled:** a non-arc question with an active model returns the model's answer labelled "general — not from arc's record", with no citations; with no active model the face says how to add one (never a blank, never an error page). A fixture FAILs an unlabelled general answer, with its mutant control.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-10-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: **Every model answer is receipted (ADR-1350 §4):** the answer runs through `arc-run --process face-ask`; the receipt names the model and the lane. No new spine kind.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-10-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: **Asking on the front door:** one ask box under the face on `/`; the workroom dock uses the same brain. The browser smoke asks one arc question and one general question on `/` against the fake provider and reads both labels, in dark and in light.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-10-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: **Voice, as a setting (ADR-1350 §6):** speech in (`SpeechRecognition`) and speech out (`speechSynthesis`) behind one switch, off until the owner turns it on; the panel says where the browser sends audio. Where the browser has no speech API the mic control is absent and typing works. The pure voice state machine (idle · listening · thinking · speaking) is held by a fixture.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-10-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: **Offline-first (PLAN External dependencies):** the model provider has an interface, a fake (`tests/face/fake-llm.mjs`, an OpenAI-compatible local server) and the real `generic-api` path, plus a contract test; CI never calls a real provider.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-10-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: **Owner talks to it:** from the MAIN clone the owner adds his own model in the face, asks an arc question and a general one, by typing and by voice, and says whether it is what he asked for. The transcript goes to `evidence/phase-10/`. This is the criterion only he can tick.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-10-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: Two fresh attackers (logic · boundary); CI green per job; `/arc-phase-done 10` from the main clone.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-10-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
