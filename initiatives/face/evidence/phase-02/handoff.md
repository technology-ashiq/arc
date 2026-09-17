# Handoff pack — phase 02 · lane face

8/8 slices proven.

## Prediction calibration

4 hit · 1 miss · 0 unforeseen

- **likely-failure-mode** — hit — the scan MISSED branches no operator token shows, in exactly the named direction: a lookup after an object literal and a computed key, a keyword spelled as a property opening a JSX element, and two whitespace/line-terminator classes that hid an import or a keyword (decision-logic attacker H1, H3, M2; shell/OS H3); the spec-fidelity pass added a boolean-named binding the View made itself; the other direction (a construct a real View needs flagged) never fired on the nine carried Views or the template (evidence/phase-02/attacker-reports.md, spec-fidelity.md)
- **likely-regression-site** — hit — the typecheck half: `tsc --noEmit` joining the build found a pre-existing implicit any in face/src/lib/mood.mjs on the red-first run 35221247877 and the untyped ops lists on run 35224182573; the smoke through the new shell was green in both moods on every leg on its first implementation run (35224182573), so the rail/header half did not fire
- **riskiest-file** — hit — .claude/scripts/core/face-pure.mjs carried more confirmed holes than any other file (4 HIGH decision-logic findings, the line-terminator HIGH, M2 and three LOW, then the spec-fidelity naming finding), all fixed in b29c0404 and 7718ae00
- **expected-blockers** — hit — the first `tsc --noEmit` on CI was red on pre-existing Cycle 15 code (mood.mjs, run 35221247877); the second clause did not fire: product-lint and the sync golden were registered before the first push and stopped no job
- **expected-proof-failures** — miss — the first implementation run (35224182573) showed no face-pure finding on the carried Views or the template and no windows-only failure in the scaffold suite; its one red was the untyped ops lists under the new typecheck, which nobody predicted

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | e2e-visual | e2e-visual -- on CI, tests/face/module-frame.mjs finds no served room id as a quoted literal in any shell file (App.tsx, main.tsx, shell/**, lib/shell.mjs, lib/registry.mjs) and the same scan FAILs a planted one; the rail groups follow the served `rings`, home is the first openable room in them, and `g` resolves home from the registry; tests/face-browser.bats runs `tsc --noEmit` before `vite build` and, on every Node >=20.19 leg, prints both mood summaries clean through the new shell | 7718ae00 |
| 02 | integration | integration -- on CI the browser smoke reads `data-render` off every room and prints `smoke: render mood=M module=N generic=G unmarked=0 generic-rooms=...` in both moods, where the bats verdict requires N to equal the module folders on disk and N+G to equal openable (a mutant line with module=0 FAILs); face-coverage on the real tree prints the same generic rooms BY NAME and exits 0 | 7718ae00 |
| 03 | unit | unit -- tests/face/module-frame.mjs (run beside l3-logic from tests/face-l3.bats) on CI: attachModules names an orphan folder, a served room with no module, a misplaced ring, a manifest whose id or ring disagrees with its folder, a template folder, one id in two rings and a malformed glob key; on the real tree it attaches every folder and its generic set EQUALS face-coverage's module half; red first on ERR_MODULE_NOT_FOUND before registry.mjs exists | 7718ae00 |
| 04 | unit | unit -- tests/face/face-pure.mjs on CI: the real tree prints `face-pure: modules=N folds=N views=N` with N>0 and findings=0; the CLI exits 1 on a planted branch in a View.tsx and on a planted React import in a fold.mjs, each named by kind and line; every JSX-hidden branch in the assumptions ledger (`{x > 0 && <X/>}`, a ternary on raw data, a comparison inside a template literal) FAILs while a condition on an is/has/can/should/show field passes; every module's fold.mjs, module.mjs and ops.mjs is imported by node with no install and the boolean-named fields fold returns are booleans; red first on ERR_MODULE_NOT_FOUND | 7718ae00 |
| 05 | unit | unit -- `face-coverage --selftest` on CI prints PASS by name for: an orphan module folder, a misplaced ring, a template folder, an ADR-1327 extra exempted by name passes, an exemption for a room that is not an extra (the unnamed fifth), an exemption citing another ADR, an exemption for a served room, an unreadable module tree; and an exit-1 arm for the orphan; tests/face-coverage.bats reads `exemptions=0` and `orphans=0` off the real tree | 7718ae00 |
| 06 | integration | integration -- tests/face/face-module.mjs on CI scaffolds a served room with no module into a scratch copy in one command that exits 0 and prints GREEN on face-pure and face-coverage's module half; it refuses an unserved id, the served ring's mismatch, the lane template, an unexempted extra, an existing module, a bad ring/id grammar and an unknown or `--flag=value` argument; a red verdict removes what it wrote; the script run through a symlink in a temp dir still runs (a counted skip only where the OS cannot make a symlink); expected-set.json homes the command and root CLAUDE.md's hand-written count equals the command files minus the generated ones | 7718ae00 |
| 07 | e2e-visual | e2e-visual -- gh run view --json jobs on the PR head SHA: tests/face-browser.bats green on ubuntu Node 20 + 22, macOS and windows, each job's log carrying `smoke: opened=33 openable=33 errors=0 ... mood=dark mood-miss=0`, the same line in light, and a render line per mood; ubuntu Node 18 a counted skip | 7718ae00 |
| 08 | verified-real | verified-real -- two fresh agents (decision logic: face-pure, registry reconcile, face-coverage module half; shell/OS boundary: face-module scaffold, lint walks, the browser render arm) each given fixed-defects.md; every confirmed hole fixed, pinned and appended to fixed-defects.md, reports in evidence/phase-02/attacker-reports.md; gh run view --json jobs on the PR head reads every job success (evidence/phase-02/ci-jobs.json); /arc-phase-done 02 from the main clone | d76657d1 |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

The pass ran in a fresh context over `phase-02-spec.md` and `git diff 11b9655b..b29c0404`. Its
verdict line is **`FIDELITY: drift found`**, and it stands as filed. Its findings, each with a
disposition (FIXED with a check, DECLARED, DEBT or OWNER), are filed at `spec-fidelity.md` beside
this pack; the fixes landed in `7718ae00`, green on run 35230101361:

- shell `.tsx` decisions (the inbox chip, the mode dot, the dock's plural) — FIXED into `registry.mjs`
- a condition read by name alone (`const isBig = f.count`, `ctx.room.hasTemplate`) — FIXED in `face-pure`
- shell prose naming rooms — FIXED
- the shell attaching without the ADR-1327 rows; the scaffold proving the module half — DEBT
- the frame's tests in `module-frame.mjs` beside l3-logic; `/api/rooms` read as `rooms.generated.json` — DECLARED
- the carried Views delegating to Cycle 15 renderers — DEBT (existing row)
- scope beyond the spec (typecheck, WebGL guard, stage unmount, lint roots, rail report) — DECLARED, each a debt row this phase was assigned

FIDELITY: drift found
