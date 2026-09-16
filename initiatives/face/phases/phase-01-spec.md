# Phase 01 — Tokens + kit: one source, two moods, the shared kit, and the 9 bespoke rooms on it

**Goal (one line):** REQ-02 — `docs/design/system/tokens.css` carries both moods with computed contrast, the copy is generated, v0.7's kit is ported onto Tailwind v4 in L3, and the 9 bespoke rooms render on it in both moods.
**Appetite:** 2 days
**Depends on:** phase-00
**Serves:** REQ-02
**Branch:** `feat/face-v2-01`
**Preconditions (STOP if absent):** Phase 00's PROGRESS row reads ✅ CLOSED via `/arc-phase-done 00` from the main clone.

## Exit criteria (Definition of Done)

- [ ] `docs/design/system/tokens.css` rewritten: `:root` landing untouched · `html.hq` (dark) · `html.hq.hq-light` (paper); `--blue` added for neutral progress; council → `--accent-dim` and violet reserved for the non-real family (ADR-1322).
- [ ] Every text-on-surface contrast ratio for both moods is **computed by `tests/face/tokens-contrast.mjs`** and written into the file header by the same script — never typed; a pair under 4.5:1 (3:1 for large/UI) FAILs.
- [ ] `face-tokens.mjs` generator run; `--check` exit 0; a planted edit in `face/src/tokens.css` FAILs `--check`.
- [ ] `face/package.json` gains `tailwindcss` + `@tailwindcss/vite` (^4.3.x) and `@phosphor-icons/react` (^2.1.x) — the ranges verified in ADR-1323; phosphor is the only icon set; the lockfile regenerated so the Phase 00 platform check passes for linux-x64, darwin-arm64 and win32-x64.
- [ ] `face/src/ui/kit.tsx` + `face/src/ui/bits.tsx` ported: `RoomHead` · `KpiStrip` · `HPanel` · `PickRow` · `Meter` · `Chip` · `Empty` · `SectionLabel`. The light remap uses `@custom-variant` under `html.hq.hq-light`; no `filter: invert()` (ADR-1331).
- [ ] Colour-literal lint (FAIL from birth): scans `face/src/ui/**` and `face/src/modules/**`, prints the files-scanned count, asserts it is > 0, and FAILs a planted hex, `white` and `black` literal.
- [ ] The 9 bespoke rooms (Today · Inbox · Map · Spine · Board · Money · Council · Ventures · Ask arc) render on the kit; `tests/face-browser.bats` gains a mood arm and reads 0 console errors and 0 exceptions for every served room in BOTH moods on every Node ≥20.19 leg.
- [ ] Block A tripwire reading (day 3 of 6) recorded in PROGRESS.md; at this phase's exit, the owner's by-eye read of the 9 rooms × 2 moods recorded — if they do not render, STOP (PLAN kill criteria).
- [ ] Two fresh attackers (contrast/lint decision logic · generator + shell/OS boundary) with the fixed-defect list; holes fixed + pinned.
- [ ] CI green per job; `/arc-phase-done 01` from the main clone.

## Verification plan

- **Test command:** `node .claude/scripts/core/face-tokens.mjs --check` · `node tests/face/tokens-contrast.mjs` · `node tests/face/l3-logic.mjs` · `bats tests/face-browser.bats` — on CI only, read per job.
- **Expected failure first:** `tests/face/tokens-contrast.mjs` is committed first and fails `missing selector html.hq.hq-light` and `missing token --blue`; the smoke mood arm fails `hq-light: class not applied on <html>`; the colour-literal lint's planted fixture fails before the lint exists with `ERR_MODULE_NOT_FOUND`.
- **Live demo scenario:** after merge, main clone: `node .claude/scripts/hq/arc-face.mjs` → toggle the mood → Today, Inbox, Council and Money in both moods; a council verdict chip reads `--accent-dim`, a simulated figure reads violet, and nothing is inverted.
- **Real-system check:** the PR's CI run — the lockfile arm and the browser arm pass on ubuntu, macOS and windows after the Tailwind install; the generated copy builds under Tailwind v4 (assumptions ledger row 4).
- **Expected evidence:** `initiatives/face/evidence/phase-01/` — `contrast-table.md` (script output) · `ci-jobs.json` · `owner-read-9-rooms-2-moods.md` · attacker reports.

## Rabbit holes in this phase

- **Hand-translating v0.7 utilities** — rejected (ADR-1323); port utilities as written.
- **Re-deciding colours the reference already chose** — the only permitted delta is ADR-1322's council rule.
- **Tailwind reaching `face/src/lib/*.mjs`** — `tests/face/l3-logic.mjs` keeps importing every `.mjs` with no install; a red there stops the phase.

## Out of scope for this phase

The v0.7 shell and module folders → Phase 02 · the other 27 modules → Phase 03.

## Your-setup / pending

- If the lockfile platform check fails, the owner regenerates the lockfile on the Windows box with per-platform `--os`/`--cpu` installs (the session supplies the exact commands).
- The owner's by-eye read of 9 rooms × 2 moods at exit.

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
