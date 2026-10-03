# Phase 11 — One Settings menu: test a model before asking it, and choose the voice

**Goal (one line):** REQ-15 — the owner opens one Settings menu from HQ, adds a model and **tests** it (ok or why not, and how many seconds it took) before he asks it anything, sees each model's last test beside it, and picks the voice the face speaks in and how fast.
**Appetite:** 1.5 days
**Depends on:** phase-10
**Serves:** REQ-15
**Branch:** `feat/face-v2-11-settings`
**Preconditions (STOP if absent):** Phase 10's PROGRESS row reads ✅ CLOSED (it does, 2026-10-02) and the owner chose this phase before the dogfood (he did, 2026-10-03: "Now, before dogfood").

Why it exists (owner, 2026-10-03, after #314 merged): "work aguthu response slow ah iruku, yen settings thaniya vacha, atha oru menu la add pannalam la simple ah models add verify and test apdi, then voice la change panna mudiyatha?" The spine showed the same free model answering in 3.3 s at night and 36-37 s in the afternoon, and another model refusing twice in under a second -- facts the face had no way to show him before he asked.

## Exit criteria (Definition of Done)

- [ ] **One Settings menu (ADR-1350 Amendment 1 §1):** HQ's header Settings opens one menu with two sections, **Models** and **Voice**, and the ⌘K palette has a "Settings" entry that opens the same menu. Still never on the front door's ask bar (`door-no-settings` holds).
- [ ] **Test a model (Amendment 1 §2):** each model row has **Test**. `POST /api/models/test` with a model's name asks that model one fixed probe question through `arc-run --process face-ask` (receipted like any answer; the active model does not change) and returns `ok` or the same plain-language cause `providerFault` gives, plus the seconds it took. The row shows ✓ or ✗, the seconds, and when it was tested. A fixture against `tests/face/fake-llm.mjs` holds: a healthy model tests ok with a duration; a 429 tests as busy; a model name that is not in the registry is refused; the key appears in no response.
- [ ] **The last test is kept per model:** the door keeps each model's last test result for as long as it runs (not written to disk, no key in it); `GET /api/models` returns it beside each row. A fixture asserts a test is visible on the next read and a removed model's result is gone.
- [ ] **Choose the voice (Amendment 1 §3):** the Voice section keeps the on/off switch and adds the browser's own voices as a list, a speed (0.75x to 1.5x) and **Preview**, which speaks one short sentence. The choice lives in the browser (`localStorage`, like the switch) and every spoken answer uses it. Pure decisions in `face/src/lib/talk.mjs` (`voicePick`, `voiceRate`) are held by `tests/face/talk.mjs`: a saved voice no longer installed falls back to the default, and a rate outside the range is clamped.
- [ ] **Browser smoke:** the smoke opens Settings from the header and from ⌘K, finds both sections, presses Test on a fake-provider model and reads ✓ and a duration, in dark and in light.
- [ ] Two fresh attackers (logic · boundary) -- one round (owner rule, 2026-09-25); CI green per job; `/arc-phase-done 11` from the main clone.

## Verification plan

Tests run on CI only, read per job; each fixture asserts it RAN before asserting what it printed. One PR, one attack round, one push.

| Exit criterion | Check | Evidence | Who |
|---|---|---|---|
| One menu | smoke: header Settings and ⌘K "Settings" both open it; two sections found | CI smoke log | CI |
| Test a model | `tests/face/talk.mjs` section T against fake-llm: ok + seconds, 429 busy, unknown name refused, key absent | CI per job | CI |
| Last test kept | same section: visible on next `GET /api/models`, gone after remove | CI per job | CI |
| Voice choice | `tests/face/talk.mjs` section V: `voicePick` fallback, `voiceRate` clamp | CI per job | CI |
| Live | from the main clone the owner opens Settings, tests his models, picks a voice; his words go to `evidence/phase-11/owner-demo.md` | evidence file | owner |

- **Expected failure first:** `POST /api/models/test` is a 404; `voicePick` does not import.

## Rabbit holes in this phase

- **Making a slow free model fast.** The provider's load is not arc's; the test shows it so the owner can choose. Streaming answers stays out (ADR-1350).
- **Testing every model on a timer.** A test is pressed, never ambient: it spends the owner's quota.
- **Voices from a cloud TTS.** The browser's voices only; no new dependency, no key.

## Out of scope for this phase

A spend cap or ₹ per answer · streaming · new spine kinds · any change to the rooms or the front door.

## Your-setup / pending

His live read at the end, from the main clone.

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
