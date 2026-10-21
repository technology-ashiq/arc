# Build Brief — phase 01 · Tokens + kit: one source, two moods, the shared kit, and the 9 bespoke rooms on it

spec-hash: sha256:4cdd6ced0e99a3cffc390035a3d914e54842d4b356fbad96e38aa024c8dfab08
lane: face
reqs: REQ-02
adrs: 0026, 1302, 1306, 1308, 1312, 1313, 1318, 1319, 1320, 1321, 1322, 1323, 1324, 1325, 1326, 1327, 1328, 1329, 1330, 1331, 1332, 1333, 1334, 1335, 1336
blast-radius: .claude/scripts/, docs/design/system/tokens.css, face/package.json, face/src/**, face/src/lib/*.mjs, face/src/modules/**, face/src/tokens.css, face/src/ui/**, face/src/ui/bits.tsx, face/src/ui/kit.tsx, initiatives/face/evidence/phase-01/, tests/face-browser.bats, tests/face/l3-logic.mjs, tests/face/tokens-contrast.mjs
no-gos: (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed)
blast-radius-dropped: 15

### Non-negotiables

- The served registry is the only room list: modules attach to served ids, orphans are checked both ways, and the four extra rooms are exempted by name only (ADR-1306, ADR-1321, ADR-1327).
- Tokens have one source, `docs/design/system/tokens.css`; `face/src/tokens.css` is generated and never hand-edited, as `.claude/scripts/core/face-tokens.mjs --check` enforces; no colour literal under `face/src/modules/**`; council renders `--accent-dim` and violet is the non-real family alone (ADR-1308, ADR-1322).
- Every decision lives in a `.mjs` that node imports with no install: `fold.mjs` imports nothing from React, Vite or three, `View.tsx` carries no branch worth asserting, and Tailwind stops at L3 (ADR-1320, ADR-1323).
- `POST /api/decide` stays byte-parity with `arc-inbox`: the parity fixture is green on every PR of this cycle and is a Phase 05 exit criterion (ADR-1302, ADR-1333).
- Zero new spine kinds: every op emits a kind already in `validate.mjs` KINDS, and an op that would need a new one does not ship (ADR-0026, ADR-1334).
- Branch-only writes: a file-touching op writes to a `feat/face-*` branch, shows the diff and stops; `main` is untouchable and merge never exists in the face (ADR-1326).
- The WORK door has no logic of its own: each op shells the same script a hand-run calls, proven per op by a no-second-path fixture; an op without a green fixture ships read-only with an honest badge (ADR-1326).
- The SESSION door starts `arc-run --driver ...`, never a harness binary (ADR-1326).
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

likely-failure-mode: v0.7's own token values fail the computed 4.5:1 floor in places (light --text-3 on every surface, dark --text-3 on bg-4, light amber/green/blue on bg-4), so the canonical file carries adjusted values and the owner's by-eye read may call the light mood flatter than the reference
likely-regression-site: the v1 rooms in the light mood: ~1,800 inline references to the landing token names (--prose, --meta, --panel, --hairline) render light-on-paper unless html.hq aliases each one, and Tailwind v4 preflight changes default margins and button styling under every room
riskiest-file: face/package-lock.json -- adding tailwindcss, @tailwindcss/vite and phosphor on Windows must still carry the linux-x64-gnu and darwin-arm64 bindings of @tailwindcss/oxide and lightningcss at the declared versions, or the Phase 00 lockfile arm FAILs before any build
expected-blockers: npm ci on the Node 20 legs failing to resolve an @tailwindcss/oxide native binding from the Windows-generated lockfile; and an @import ordering error when the generated tokens.css follows @import "tailwindcss" (assumptions ledger row 4)
expected-proof-failures: the first implementation run of tests/face-browser.bats is red in the light mood on at least one room -- a v1 room or the shell writing a colour outside a token -- and the first contrast run needs one --write round before the header matches

### Prediction scores

likely-failure-mode: hit — v0.7's own values failed the computed floor: five tokens on the first measured set (47ad5476) and seven plus one fill once the attack widened the pair set to every alias, fill and chip backdrop (0b51ea17), each adjustment listed in the tokens.css header; whether the light mood reads flatter is the owner's by-eye read, which is still open
likely-regression-site: hit — the v1 rooms were the site: the LEGACY NAMES block in html.hq was built for exactly that (47ad5476), and the decision-logic attacker's HIGH finding 5 showed an alias (--faint) could be re-spelled below the floor without being measured, fixed by the ROLES table in 0b51ea17
riskiest-file: miss — face/package-lock.json passed the lockfile arm and npm ci on all three OSes on the first implementation run (35204281571); the file that carried the most defects was tests/face/tokens-contrast.mjs (9 HIGH attacker findings, rewritten in 0b51ea17), then .claude/scripts/core/face-colour-literal.mjs
expected-blockers: miss — no oxide binding failure and no @import ordering failure (assumptions ledger row 4 held: the generated copy built under Tailwind v4 in run 35204281571); the one blocker was unforeseen: product-lint stopped every job of run 35204006463 at "unmapped file (synced but in no product): .claude/scripts/core/face-colour-literal.mjs", fixed in 3c952e05
expected-proof-failures: miss — the first implementation run that reached the tests (35204281571) was 19/19 green, both moods included; the only red CI runs were the intended red-first run (35201425258) and the product-lint stop

### Slices

#### slice: 01

title: `docs/design/system/tokens.css` rewritten: `:root` landing untouched · `html.hq` (dark) · `html.hq.hq-light` (paper); `--blue` added for neutral progress; council → `--accent-dim` and violet reserved for the non-real family (ADR-1322).
kind: logic
risk: high
proof: contract -- tests/face/tokens-contrast.mjs on CI reads html.hq and html.hq.hq-light with 0 missing tokens (--blue, --accent-dim, every -rgb triple present) and the three reserved-meaning laws hold per mood (council = --accent-dim, simulated = violet, live = accent never green); red first on `missing selector html.hq.hq-light` and `missing token --blue`; face-tokens --check exit 0 on the copy
tier: contract
sources: phase-01-spec.md
decision: :root kept byte-identical as the landing; html.hq and html.hq.hq-light carry v0.7's values with five AA adjustments (dark --text-3 #868d9a; light --text-3 #636b77, --green #187835, --amber #906000, --blue #0866d4), --accent-dim added per mood (dark rgba(var(--accent-rgb),0.74), light #3a6a6d), --kind-council/--mode-live/--sim-* re-pointed inside html.hq, and the legacy names (--prose, --panel, --hairline, ...) aliased to the workroom scale so the v1 rooms flip with the mood (debt row)
result: red first (run 35201425258): `FAIL missing selector html.hq.hq-light`, `FAIL dark: missing token --blue`, `FAIL light: missing token --blue` on ubuntu 18/20/22, macOS and windows. Green: arc-ci run 35207463369 on head 0b51ea17, 19/19 jobs success, read per job; `ok face v2: both moods' contrast ratios are computed, above their floors, and match the header` on all 5 configurations, with the header's law lines "council is var(--accent-dim) -- holds", "council is at least 30 degrees from violet -- holds", "live is var(--accent) -- holds" in both moods
commit: 0b51ea17

#### slice: 02

title: Every text-on-surface contrast ratio for both moods is **computed by `tests/face/tokens-contrast.mjs`** and written into the file header by the same script — never typed; a pair under 4.5:1 (3:1 for large/UI) FAILs.
kind: logic
risk: medium
proof: unit -- tokens-contrast.mjs check mode exit 0 with moods=2 pairs>=150 findings=0 on every CI leg, and its --selftest arms PASS by name (typed number, missing block, missing light mood, light --text-3 under 4.5:1, -rgb triple disagreeing with its hex, council->violet, live->green, missing --blue, unbalanced file)
tier: unit
sources: phase-01-spec.md
decision: the pair set is declared in the script header and is every ink/hue token on every surface token (not a curated where-used list), plus each hue on its own 10% chip tint built from its -rgb triple (so a triple that disagrees with its hex is its own finding), three fills and UI 3:1 meters and focus ring; cells are truncated to two decimals so a cell never displays a floor it misses; the block is rendered with no trailing whitespace
result: arc-ci run 35207463369 on head 0b51ea17, 19/19 jobs success, read per job; `ok face v2: tokens-contrast REFUSES a typed header, a low pair and a broken reserved meaning (mutant arms)` on all 5 configurations, the bats test requiring each of its 10 named arms to print PASS; the block itself is evidence/phase-01/contrast-table.md
commit: 0b51ea17

#### slice: 03

title: `face-tokens.mjs` generator run; `--check` exit 0; a planted edit in `face/src/tokens.css` FAILs `--check`.
kind: logic
risk: medium
proof: contract -- tests/face-l3.bats runs face-tokens.mjs --check (exit 0, "matches") and --selftest (a hand-edited, a length-preserving and a missing copy each exit 1) against the regenerated copy on CI
tier: contract
sources: phase-01-spec.md
decision: face-tokens.mjs needed no change: its --check and selftest already FAIL a hand-edited, a length-preserving and a missing copy; the copy was regenerated after the header was written
result: arc-ci run 35207463369 on head 0b51ea17, 19/19 jobs success, read per job; `ok the L3 token copy is in sync with the canonical design tokens` and `ok face-tokens REFUSES a hand-edited copy and a wrong source (mutant arms)` on all 5 configurations, the latter now also requiring "a copy linked onto the source is refused, source untouched"
commit: 0b51ea17

#### slice: 04

title: `face/package.json` gains `tailwindcss` + `@tailwindcss/vite` (^4.3.x) and `@phosphor-icons/react` (^2.1.x) — the ranges verified in ADR-1323; phosphor is the only icon set; the lockfile regenerated so the Phase 00 platform check passes for linux-x64, darwin-arm64 and win32-x64.
kind: logic
risk: medium
proof: integration -- on CI the Phase 00 lockfile arm exits 0 on ubuntu, macOS and windows with tailwindcss + @tailwindcss/vite ^4.3 and @phosphor-icons/react ^2.1 in face/package.json, and npm ci + vite build in a copy of face/ exit 0 with dist/index.html written
tier: integration
sources: phase-01-spec.md
decision: tailwindcss and @tailwindcss/vite ^4.3.3 as devDependencies, @phosphor-icons/react ^2.1.10 as a dependency; installed in a scratch copy of face/ with npm 11.16 on Windows, and the lockfile read before copying back: @tailwindcss/oxide and both lightningcss families (1.33.0 hoisted, 1.32.0 nested under @tailwindcss/node) carry linux-x64-gnu, darwin-arm64 and win32-x64-msvc entries at the declared versions
result: arc-ci run 35207463369 on head 0b51ea17, 19/19 jobs success, read per job; `ok face-browser: the lockfile carries this platform's native packages (offline)` on all 5 configurations (family-names @tailwindcss/oxide, lightningcss, rolldown required by name), and `ok face-browser: npm ci and vite build succeed in a copy of face/` on ubuntu Node 20 and 22, macOS and windows (the counted skip on Node 18); first passed in run 35204281571
commit: 47ad5476

#### slice: 05

title: `face/src/ui/kit.tsx` + `face/src/ui/bits.tsx` ported: `RoomHead` · `KpiStrip` · `HPanel` · `PickRow` · `Meter` · `Chip` · `Empty` · `SectionLabel`. The light remap uses `@custom-variant` under `html.hq.hq-light`; no `filter: invert()` (ADR-1331).
kind: logic
risk: medium
proof: e2e-visual -- the kit exports RoomHead, KpiStrip, HPanel, PickRow, Meter, Chip, Empty and SectionLabel (asserted statically in tests/face/l3-logic.mjs), no `filter: invert` anywhere under face/src, @custom-variant hq-light declared over html.hq.hq-light in face/src/index.css, and the browser smoke opens every room in both moods on CI
tier: e2e-visual
sources: phase-01-spec.md
decision: kit.tsx + bits.tsx port v0.7 with three declared deltas (no colour spelled out, council = --kind-council, live = --mode-live); the v1 renderers keep their props through ui/legacy.tsx (debt row); index.css imports Tailwind with source(".") because the default scan base is the cwd and the browser suite builds a copy of face/ from the repo root, then the token copy, then @custom-variant hq-light with the --color-white remap applied through @variant; the mood goes on <html> in main.tsx before the first render, the toggle lives in the rail, and the face stage renders in the dark mood only (debt row); Inter added to the Google Fonts link (debt row)
result: arc-ci run 35207463369 on head 0b51ea17, 19/19 jobs success, read per job; `ok L3 logic runs with no install and no build, and every check passes` on all 5 configurations, including the kit's exports, no inverting filter under face/src, @custom-variant hq-light over html.hq.hq-light, index.css declaring only --color-white, and the mood applied before the first render; the build test asserts the emitted CSS carries .text-\[22px\] and --color-white
commit: 47ad5476

#### slice: 06

title: Colour-literal lint (FAIL from birth): scans `face/src/ui/**` and `face/src/modules/**`, prints the files-scanned count, asserts it is > 0, and FAILs a planted hex, `white` and `black` literal.
kind: logic
risk: medium
proof: unit -- tests/face/colour-literal.mjs on CI: the real tree prints scanned>0 findings=0; planted hex, white and black fixtures each exit 1 naming the literal and its line; near-misses (entity, whitespace-nowrap, rgba(var())) pass; red first with ERR_MODULE_NOT_FOUND before the lint exists
tier: unit
sources: phase-01-spec.md
decision: the lint reads every byte of every file, comments included, rather than lexing TSX (a guessing lexer goes quiet); four kinds -- hex (not an &# entity), named white/black (not the white-space property), numeric-argument colour functions, Tailwind default-palette utilities; NUL bytes, symlinks and special files are named findings; scanned=0 FAILs; lives at .claude/scripts/core/ (ADR-1319), so the sync-golden manifest gains one row and face-l3.bats's face/src mention check names it as its second exclusion
result: red first (run 35201425258): `ERR_MODULE_NOT_FOUND ... face-colour-literal.mjs`. Green: arc-ci run 35207463369 on head 0b51ea17, 19/19 jobs success, read per job; `ok face v2: the colour-literal lint finds 0 literals in ui/** and modules/**, and FAILs planted ones` on all 5 configurations (RAN floor 35; the real tree reports scanned>0 findings=0)
commit: 0b51ea17

#### slice: 07

title: The 9 bespoke rooms (Today · Inbox · Map · Spine · Board · Money · Council · Ventures · Ask arc) render on the kit; `tests/face-browser.bats` gains a mood arm and reads 0 console errors and 0 exceptions for every served room in BOTH moods on every Node ≥20.19 leg.
kind: logic
risk: medium
proof: e2e-visual -- tests/face-browser.bats on every Node >=20.19 leg prints `smoke: opened=33 openable=33 errors=0 ... mood=dark mood-miss=0` AND the same line with `mood=light mood-miss=0`; red first with `hq-light: class not applied on <html>`; a mood mutant control FAILS a clean line carrying mood-miss>0
tier: e2e-visual
sources: phase-01-spec.md
decision: one harness process runs dark then light against one door and preview; smoke writes the mood with Page.addScriptToEvaluateOnNewDocument under the app's own key (arc-hq-theme, v0.7's) and reads <html>'s class list after the room settles; a room whose class list was never read counts as a miss; the bats verdict is called once per mood and each reads only its own line; the 9 bespoke rooms moved their headers to RoomHead and their titled cards to HPanel (three parallel agents, diffs reviewed: handler, data-* and role attributes unchanged, ids moved to titleId) and every colour literal in them became a token; the build test now also asserts the emitted CSS carries a kit utility and the light mood
result: red first (run 35201425258): every room `mood-miss=33`, `hq-light: class not applied on <html> (33 room(s): ...)` on ubuntu, macOS and windows. Green: arc-ci run 35207463369 on head 0b51ea17, 19/19 jobs success, read per job; on ubuntu Node 20 and 22, macOS and windows each: `smoke: opened=33 openable=33 errors=0 excluded-errors=0 unsettled=0 expected=33 not-opened=lane mood=dark mood-miss=0` AND the same line with `mood=light mood-miss=0`; both MUTANT CONTROL tests ok on all 5 configurations
commit: 0b51ea17

#### slice: 08

title: Block A tripwire reading (day 3 of 6) recorded in PROGRESS.md; at this phase's exit, the owner's by-eye read of the 9 rooms × 2 moods recorded — if they do not render, STOP (PLAN kill criteria).
kind: logic
risk: medium
proof: verified-real -- PROGRESS.md carries the Block A day-3 reading, and the owner's by-eye read of the 9 rooms x 2 moods is recorded in evidence/phase-01/owner-read-9-rooms-2-moods.md in his words
tier: verified-real
sources: phase-01-spec.md
decision: the Block A reading was taken from CI rather than asserted: clause 2 read GREEN on run 35207463369 before the owner was asked; the owner was shown the live HQ from the main clone plus 18 screenshots, and asked the two rulings spec-fidelity raised in the same question set
result: PROGRESS.md carries the Block A reading (clause 2 GREEN, run 35207463369); evidence/phase-01/owner-read-9-rooms-2-moods.md records the owner's answers verbatim, 2026-09-17: "Render aagudhu -- close pannu" (no STOP), "AA-adjusted values vechukko", "Dark-la mattum, Phase 02 decide"
commit: efcd4def

#### slice: 09

title: Two fresh attackers (contrast/lint decision logic · generator + shell/OS boundary) with the fixed-defect list; holes fixed + pinned.
kind: logic
risk: medium
proof: verified-real -- two fresh attacker agents (decision logic: tokens-contrast + colour-literal; shell/OS boundary: face-tokens generator, harness mood arm, lint walk) given fixed-defects.md; every confirmed hole fixed, pinned as a check and appended to fixed-defects.md; reports in evidence/phase-01/attacker-reports.md
tier: verified-real
sources: phase-01-spec.md
decision: two general-purpose agents launched together on 47ad5476, each in a private scratch directory, each with fixed-defects.md; decision logic found 13 (9 HIGH), shell/OS found 10 (1 MEDIUM). Every HIGH and MEDIUM fixed and pinned (22 lines appended to fixed-defects.md, dispositions in evidence/phase-01/attacker-reports.md); two scoped as debt (lint roots, harness signal handling). Fixing the pair set moved five light hues a further step and dark --on-red to --bg-0, all recorded in the tokens.css header
result: attacker reports and dispositions in evidence/phase-01/attacker-reports.md (23 findings: 20 FIXED, 3 DEBT/SCOPE); fixes pinned and green in arc-ci run 35207463369 on head 0b51ea17, 19/19 jobs success, read per job
commit: 0b51ea17

#### slice: 10

title: CI green per job; `/arc-phase-done 01` from the main clone.
kind: logic
risk: medium
proof: verified-real -- gh run view --json jobs on the PR head SHA reads every job success, saved as evidence/phase-01/ci-jobs.json; /arc-phase-done 01 from the main clone
tier: verified-real
sources: phase-01-spec.md
decision: (empty until proven)
result: PR #235 run 35209617606 on head efcd4def, 19/19 jobs read per job; merged as 4fcb53db; main re-verified by workflow_dispatch run 35211136090 -- attempt 1 18/19 (windows shard 1/12: Chrome wrote no DevToolsActivePort within 30000 ms on its first launch, same image and tree green in three earlier runs), attempt 2 re-ran that job: 19/19, windows smoke opened=33 in both moods; full suite 1..3404 on ubuntu Node 20; saved as evidence/phase-01/ci-jobs.json. /arc-phase-done 01 from the main clone: receipts phase.closed 01M2QGWHBAX0329SNCX8Q2CPAX and approval.requested 01M2QGWHNYEBPAC97EEMV55JDH in the canonical spine
commit: 4fcb53db
