# Phase 12 — The owner's keys: set once in the face, read by arc's tools

**Goal (one line):** REQ-16 — the owner adds any key as `NAME : value` on the Settings page, replaces or removes it, never sees a value again, and arc's `generic-api` driver reads a key from there when its own environment variable is unset.
**Appetite:** 2 days
**Depends on:** phase-11
**Serves:** REQ-16
**Branch:** `feat/face-v2-12-keys`
**Preconditions (STOP if absent):** Phase 11's model edit is merged (PR #332) and the owner accepted ADR-1351 (he did, 2026-10-05: "Yes, build it", then "Dynamic add panra maari vai ... key : value").

Why it exists (owner, 2026-10-05): "athe maari API keys la add pannalama, ovvoru timeum session la kodukura mari iruku, ella API's add panra maari pannalama?" Each key lives somewhere different today (a user environment variable set by `setx`, which a running shell cannot see; a chat paste), so a session asks him again.

## Exit criteria (Definition of Done)

- [x] **A Keys section on the Settings page (ADR-1351 §1):** a third section beside Models and Voice lists every stored key by name with "…abcd" or "set"; **add** takes a name and a value, **replace** a new value, **remove** deletes it. Names are `^[A-Z][A-Z0-9_]{1,63}$`, values 8 to 4000 printable characters with no spaces, at most 50 keys; a duplicate name (any case) is refused.
- [x] **Stored outside the repo, never returned (§2, §3):** `~/.arc-private/keys/keys.json` (or `ARC_KEYS_FILE`, refused inside the repo), written atomically. `GET /api/keys` and `POST /api/keys/set` return names, `hasValue` and a tail of a value of 20 or more characters only; a planted value appears in no door response and nowhere in the repo tree. Pure decisions in `.claude/scripts/hq/lib/keys.mjs`, held by `tests/face/keys.mjs`.
- [x] **The environment wins, the store fills in (§4):** `resolveKey(name)` returns the process environment's value when set and the store's otherwise; the `generic-api` driver reads `ARC_LLM_API_KEY` through it, or the name in `ARC_LLM_KEY_NAME`. A fixture proves both orders and a mutant that prefers the store FAILs.
- [x] **Browser smoke:** Settings → Keys adds a key, reads its tail back, replaces it and removes it, in dark and in light; the value is in no page text.
- [x] Two fresh attackers (logic · boundary) -- one round; CI green per job; the owner's live read; `/arc-phase-done 12` from the main clone.

## Verification plan

Tests run on CI only, read per job; each fixture asserts it RAN before asserting what it printed. One PR, one attack round, one push.

| Exit criterion | Check | Evidence | Who |
|---|---|---|---|
| Keys section | smoke `hq-settings-keys` (add, tail, replace, remove), both moods | CI smoke log | CI |
| Never returned | `tests/face/keys.mjs`: planted value absent from every route body and the repo tree; mutant view that echoes the record FAILs | CI per job | CI |
| Store outside repo | same suite: `ARC_KEYS_FILE` inside the repo refused; atomic write | CI per job | CI |
| Env wins | same suite: env set → env; env unset → store; mutant preferring the store FAILs; generic-api reads through it | CI per job | CI |
| Live | from the main clone the owner adds his OpenRouter key on the page; the next attack's logic surface runs without him pasting it | evidence file | owner |

- **Expected failure first:** `GET /api/keys` is a 404; `resolveKey` does not import.

## Rabbit holes in this phase

- **Encrypting the file.** A key the door must read back in clear has to be decryptable on this machine; the protection is where the file lives and its permissions, as for `models.json`.
- **Rewiring every tool at once.** One reader (`generic-api`) proves the resolver; other lanes adopt it as their own change.
- **Showing a value "just once" after save.** The page never holds a stored value.

## Out of scope for this phase

Per-model keys pointing at a named key · other lanes' adapters · a key's expiry or rotation reminders · syncing keys between machines.

## Your-setup / pending

His live read at the end, from the main clone: add the OpenRouter key on the page once.

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
