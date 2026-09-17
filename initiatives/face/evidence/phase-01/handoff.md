# Handoff pack — phase 01 · lane face

8/10 slices proven.

## Prediction calibration

2 hit · 3 miss · 0 unforeseen

- **likely-failure-mode** — hit — v0.7's own values failed the computed floor: five tokens on the first measured set (47ad5476) and seven plus one fill once the attack widened the pair set to every alias, fill and chip backdrop (0b51ea17), each adjustment listed in the tokens.css header; whether the light mood reads flatter is the owner's by-eye read, which is still open
- **likely-regression-site** — hit — the v1 rooms were the site: the LEGACY NAMES block in html.hq was built for exactly that (47ad5476), and the decision-logic attacker's HIGH finding 5 showed an alias (--faint) could be re-spelled below the floor without being measured, fixed by the ROLES table in 0b51ea17
- **riskiest-file** — miss — face/package-lock.json passed the lockfile arm and npm ci on all three OSes on the first implementation run (35204281571); the file that carried the most defects was tests/face/tokens-contrast.mjs (9 HIGH attacker findings, rewritten in 0b51ea17), then .claude/scripts/core/face-colour-literal.mjs
- **expected-blockers** — miss — no oxide binding failure and no @import ordering failure (assumptions ledger row 4 held: the generated copy built under Tailwind v4 in run 35204281571); the one blocker was unforeseen: product-lint stopped every job of run 35204006463 at "unmapped file (synced but in no product): .claude/scripts/core/face-colour-literal.mjs", fixed in 3c952e05
- **expected-proof-failures** — miss — the first implementation run that reached the tests (35204281571) was 19/19 green, both moods included; the only red CI runs were the intended red-first run (35201425258) and the product-lint stop

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | contract | contract -- tests/face/tokens-contrast.mjs on CI reads html.hq and html.hq.hq-light with 0 missing tokens (--blue, --accent-dim, every -rgb triple present) and the three reserved-meaning laws hold per mood (council = --accent-dim, simulated = violet, live = accent never green); red first on `missing selector html.hq.hq-light` and `missing token --blue`; face-tokens --check exit 0 on the copy | 0b51ea17 |
| 02 | unit | unit -- tokens-contrast.mjs check mode exit 0 with moods=2 pairs>=150 findings=0 on every CI leg, and its --selftest arms PASS by name (typed number, missing block, missing light mood, light --text-3 under 4.5:1, -rgb triple disagreeing with its hex, council->violet, live->green, missing --blue, unbalanced file) | 0b51ea17 |
| 03 | contract | contract -- tests/face-l3.bats runs face-tokens.mjs --check (exit 0, "matches") and --selftest (a hand-edited, a length-preserving and a missing copy each exit 1) against the regenerated copy on CI | 0b51ea17 |
| 04 | integration | integration -- on CI the Phase 00 lockfile arm exits 0 on ubuntu, macOS and windows with tailwindcss + @tailwindcss/vite ^4.3 and @phosphor-icons/react ^2.1 in face/package.json, and npm ci + vite build in a copy of face/ exit 0 with dist/index.html written | 47ad5476 |
| 05 | e2e-visual | e2e-visual -- the kit exports RoomHead, KpiStrip, HPanel, PickRow, Meter, Chip, Empty and SectionLabel (asserted statically in tests/face/l3-logic.mjs), no `filter: invert` anywhere under face/src, @custom-variant hq-light declared over html.hq.hq-light in face/src/index.css, and the browser smoke opens every room in both moods on CI | 47ad5476 |
| 06 | unit | unit -- tests/face/colour-literal.mjs on CI: the real tree prints scanned>0 findings=0; planted hex, white and black fixtures each exit 1 naming the literal and its line; near-misses (entity, whitespace-nowrap, rgba(var())) pass; red first with ERR_MODULE_NOT_FOUND before the lint exists | 0b51ea17 |
| 07 | e2e-visual | e2e-visual -- tests/face-browser.bats on every Node >=20.19 leg prints `smoke: opened=33 openable=33 errors=0 ... mood=dark mood-miss=0` AND the same line with `mood=light mood-miss=0`; red first with `hq-light: class not applied on <html>`; a mood mutant control FAILS a clean line carrying mood-miss>0 | 0b51ea17 |
| 08 | verified-real | verified-real -- PROGRESS.md carries the Block A day-3 reading, and the owner's by-eye read of the 9 rooms x 2 moods is recorded in evidence/phase-01/owner-read-9-rooms-2-moods.md in his words | (empty until proven) |
| 09 | verified-real | verified-real -- two fresh attacker agents (decision logic: tokens-contrast + colour-literal; shell/OS boundary: face-tokens generator, harness mood arm, lint walk) given fixed-defects.md; every confirmed hole fixed, pinned as a check and appended to fixed-defects.md; reports in evidence/phase-01/attacker-reports.md | 0b51ea17 |
| 10 | verified-real | verified-real -- gh run view --json jobs on the PR head SHA reads every job success, saved as evidence/phase-01/ci-jobs.json; /arc-phase-done 01 from the main clone | (empty until proven) |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

The report is filed verbatim at `spec-fidelity.md` (over `af7c85cf..0b51ea17`). Its verdict line
is `FIDELITY: drift found`, and it stands as filed. Every finding's disposition:

| finding | disposition | where |
|---|---|---|
| (a) the 9 rooms render in the kit's frame (`RoomHead`, `HPanel`), while their inner CSS still reads the landing's token names through the LEGACY NAMES aliases; `KpiStrip`, `PickRow`, `Meter`, `Empty` have no reader yet | **DEBT + DECLARED** — the rooms are v1 renderers every Phase 03 ring deletes; rewriting ~1,800 inline references first would spend the appetite on code with a weeks-long life. Both moods are proven on CI for every served room, and the owner's by-eye read is the bar the criterion's "render" is judged by | `debt-ledger.md` (legacy aliases + `legacy.tsx` row) |
| (b) seven v0.7 colours and one fill moved for the 4.5:1 floor, against the rabbit-hole note "the only permitted delta is ADR-1322's council rule" | **DECLARED, raised to the owner** — the spec contradicts itself (exit criterion 2 FAILs any pair under 4.5:1, and v0.7's values fail it); the floor was taken as the exit criterion, the rabbit-hole note as guidance against re-choosing colours by taste. Each value moved along its own hue to the first step that clears, and each is listed with its reason in the tokens.css header. The owner rules at the by-eye read; a ruling against it reopens ADR-1322's collision note by new ADR | `docs/design/system/tokens.css` header · `contrast-table.md` |
| (c) the planted edit is tested in a temporary copy, not the live copy | **DECLARED** — Phase 00's deliberate design (a mutant that damages the repo is not a control); unchanged | `face-tokens.mjs` selftest comment |
| (d) three attacker findings deferred rather than fixed | **DEBT** — lint roots (rooms, shell, stage, index.css), harness signal handling; the comments-are-read rule is **SCOPE**, declared in the lint header | `debt-ledger.md` last two rows · `attacker-reports.md` |
| (e) "every served room" is 33 of 34 | **DECLARED** — `lane` is the lane-room template (`status: template`), not a room; PLAN's module inventory defines openable = served minus templates = 33, and the smoke asserts expected (from the contract) = openable = opened | `PLAN.md` module inventory · `smoke.mjs` `openableRooms` |
| criterion 8: the Block A reading is absent from the diff | **FIXED** — recorded in `PROGRESS.md` with run 35207463369 (clause 2 GREEN on CI; the by-eye read is the exit gate) | `PROGRESS.md` appetite paragraph |
| evidence: `contrast-table.md` missing | **FIXED** — the computed block, copied verbatim from the tokens.css header | `contrast-table.md` |
| scope: the face stage renders in the dark mood only | **DEBT, raised to the owner** — the particle glow reads against a dark ground and washes out on paper, and v0.7's workroom has no stage behind its rooms; Phase 02's shell places it. The v0.4-era note that the face is "the one element the owner required unchanged" predates v0.7 becoming canonical (ADR-1318), so the owner rules at the by-eye read | `debt-ledger.md` (face stage row) |
| scope: the rail's wordmark and `--bg-1` background; every room reads Inter | **DECLARED** — the toggle needed a home, and the kit's UI face is Inter; both are v0.7's, both are Phase 02's shell to finish | — |
| non-negotiable strain: `mood === 'dark' ? <FaceStage/> : null` in App.tsx | **DEBT** — the same face-stage row; the mood rule itself lives in `lib/mood.mjs` and is tested by l3-logic | `debt-ledger.md` |
| non-negotiable strain: Inter added to the Google Fonts link | **DEBT** — routed through `/arc-change` before Phase 07's dogfood days | `debt-ledger.md` (Google Fonts row) |
