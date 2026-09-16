# Phase 00 — Harness steel thread: v0.7 in, L3 built on CI, the ported smoke opening today's rooms

**Goal (one line):** v0.7 lands as the canonical reference with its 36-module contract frozen, and a bats suite builds `face/` and opens every served room in a real headless Chrome on every CI leg with Node ≥20.19 (ADR-1336).
**Appetite:** 2 days (hard stop at 2 days without a green browser suite — ADR-1336)
**Depends on:** none
**Serves:** no REQ (steel thread) — it de-risks REQ-01 and REQ-09 before any dependent work.
**Branch:** `feat/face-v2-00`
**Preconditions (STOP if absent):** the owner has approved PLAN.md — a `decision.recorded` answering the kickoff `approval.requested{gate: kickoff}`, whose ULID is written in PROGRESS.md § Now — and the kickoff PR has merged to `main`.

## Exit criteria (Definition of Done)

**Intake (ADR-1318)**
- [ ] v0.7 source copied from `E:/Work_Hub/01_Automemory/arc-face-hq2/assets/arcface` to `docs/design/reference/face-hq/assets/arcface/`, **excluding** `node_modules/`, `dist/`, `.shots/`; the v0.4 tree moves to `docs/design/reference/face-hq/assets/arcface-v0.4/` with a `SUPERSEDED.md`; `docs/design/explore/face-hq-v{1,2}/` gain a superseded note — nothing deleted.
- [ ] PII grep of the whole intake (owner email, phone numbers, LexOS contact values held in `~/.arc-private/legal/lexos`) is clean; any file that carries them is excluded and named in `SOURCE.md`. The arc repo is public.
- [ ] `docs/design/reference/face-hq/SOURCE.md` rewritten against v0.7 — form · where · what — and the four corrections on record (PLAN-face-v2 §1): **(1)** v0.7 renders violet for council AND simulated; the token law keeps council `--accent-dim` (ADR-1322) · **(2)** v0.7's `--blue` (neutral progress) is adopted · **(3)** `src/data/arcFacts.js` (137 KB facts snapshot) never enters the product (ADR-1324) · **(4)** v0.7's browser-side brain with a pasted key and `approve`/`reject` actions is not the product's Ask (ADR-1325).
- [ ] `docs/design/system/hq-design-system-v0.7.md` copied from `E:/Work_Hub/01_Automemory/arc-face-hq2/docs/superpowers/specs/2026-09-15-hq-design-system.md`.

**Contract**
- [ ] `initiatives/face/contracts/modules-v2.json`, derived by a script from `src/hq/roomRegistry.js` + `rooms.generated.json`, never typed by hand: one row per module — `id` (always the SERVED id) · `alias` (the v0.7 id when it differs) · `ring` (read from `rooms.generated.json` for served ids and from `roomRegistry.js` for extras; both carry it and agree today — on disagreement the served ring wins and the delta report names it) · `class` (`served` | `served-planned` | `extra`) · v0.7 `reads` — plus the served entries that get no module (`chat-mcp` generic, `lane` template). Expected per PLAN § Module inventory: 36 modules = 29 same-id + 3 renamed + 4 extra; if the script disagrees, its output wins and the delta report says why.
- [ ] `initiatives/face/evidence/phase-00/delta-report.md` names every renamed id (`today`←overview · `engine-room`←engine · `council-chamber`←council), every extra (ADR-1327), the served-planned rooms (ADR-1328), and the served entries with no v0.7 design.
- [ ] `initiatives/face/fixed-defects.md` seeded — the lane's running list of already-fixed defects that every attacker prompt this cycle carries: each Cycle 15 hole recorded in `initiatives/face/archive/**` and the arc-face rows of `docs/retro-log.md`, one line each (defect · file it was fixed in · the pattern to check elsewhere). Every attacker pass this cycle appends to it.
- [ ] v0.7 baseline shots for REQ-01: the reference's own `scripts/shots.mjs` on the owner's box, 1440×1000, both moods, one shot per v0.7 room; PNGs stay local and gitignored (Cycle 15's `.playwright-mcp/` precedent); `initiatives/face/evidence/phase-00/baseline-shots.json` commits room id · mood · sha256 · viewport · Chrome version.

**Harness thread (ADR-1330, ADR-1335)**
- [ ] `face/scripts/cdp.mjs` — dependency-free RFC 6455 client (text frames, client masking) + CDP calls (launch, navigate, evaluate, console + exception stream). No `WebSocket` global.
- [ ] `tests/face/fake-cdp.mjs` + `tests/face/cdp-client.mjs` — the client proven against a scripted fake on all 5 CI configurations (no Chrome, no install).
- [ ] `face/scripts/smoke.mjs` ported from v0.7: Chrome discovery per ADR-1335 (`CHROME_BIN` only if set · Windows `App Paths` registry key then `%ProgramFiles%` · macOS `/Applications` · Linux `command -v google-chrome`) → FAIL naming every place tried; prints the runner image name; `--no-sandbox` on Linux; room ids read from `/api/rooms`, never a hand list; per-room console errors + exceptions; a JSON report printed to stdout.
- [ ] `tests/face-browser.bats`: (1) prints `node -v` and the runner image; Node <20.19 → prints `SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19` and the skip is asserted as a skip — and a SKIP on any leg other than the Node 18 leg FAILs, so a Node-20 leg pinned below 20.19 can never pass silently; (2) offline lockfile platform check FAILs if `face/package-lock.json` lacks the native optional entries this OS needs for what the lockfile holds TODAY (Vite 8's native bindings) — Phase 01 extends the same check to `@tailwindcss/oxide-*`; (3) `npm ci --include=optional` in `face/`; (4) `vite build`; (5) door started `--spine` over a fixture from `tests/fixtures/face/gen-spine.mjs` (exists — `tests/face/dash-doors.mjs` uses it); (6) `vite preview` with `ARC_DASH_ORIGIN` and a check that `/api/health` answers through the preview proxy; (7) smoke opens every OPENABLE room `/api/rooms` serves — 34 entries today, 33 openable; each `template` entry (today only `lane`) is printed by name as not opened, never silently dropped; (8) every executing job prints `face-browser: RAN leg=OS/NODE` — the file is picked up by the CI sharder (`shard-tests.mjs` refuses a file that lands in no shard), and the evidence lists that line per job, so "added a bats file" is never mistaken for "the gate ran".
- [ ] Vacuous-pass guard, BOTH directions: the suite asserts `opened == openable > 0` (openable = `/api/rooms` entries whose `status` is not `template` — 33 today; PLAN § Module inventory) BEFORE asserting 0 console errors and 0 exceptions (a stub smoke that never navigates is kept as the mutant control and FAILs); AND a planted page that throws a real console error is opened over REAL Chrome — not `fake-cdp.mjs` — and the suite FAILs on it, proving the real socket path detects an error (retro-log 2026-08-17: a fake whose right answer equals the failure's answer proves nothing).
- [ ] No inline program strings: `tests/face-browser.bats` and `face/scripts/*` run no `node -e` / `bash -c` program text; every program is its own file (CLAUDE.md shell-string rule), and `tests/embedded-program-probe.mjs` — the existing automated half of that rule — scans the new files (its `scanned=` count rises), extended if it does not already reach them.
- [ ] `cdp.mjs` and `smoke.mjs` main-guards realpath BOTH `argv[1]` and `import.meta.url`; a symlinked-tmpdir mutant is the fixture (retro-log 2026-08-19, the fourth recurrence).
- [ ] A v1 room that throws is fixed only if the fix is one line; otherwise it goes on a named baseline list in the delta report that can only shrink, its Phase 03 module must empty it, and the suite's 0-exceptions assertion excludes exactly the ids on that list — never a global relaxation.
- [ ] A measured shard weight for `tests/face-browser.bats` is committed to `tests/shard-timings.json`, the table the CI sharder reads — never the 16 s default; before editing that shared table, `git log origin/main --oneline -5 -- tests/shard-timings.json` runs per `.claude/rules/lanes.md` § Shared files, and a collision is resolved by re-measuring on the merged tree, never by keeping the earlier number.

**Close**
- [ ] CI green per job on the PR head SHA (`gh run view <id> --json jobs`, head SHA = local HEAD): the browser arm EXECUTED on ubuntu Node 20 + 22, macOS and windows; the counted SKIP on ubuntu Node 18.
- [ ] Two fresh attackers — one on the smoke/CDP decision logic, one on the bats suite's shell/OS boundary — each carrying the lane's fixed-defect list; holes fixed and pinned as fixtures.
- [ ] `/arc-phase-done 00` from the main clone; PROGRESS row ✅ + done-log.

## Verification plan

- **Test command:** `node tests/face/cdp-client.mjs` and `bats tests/face-browser.bats` — on CI only, every leg, read per job with `gh run view <id> --json jobs`; never run on this box.
- **Expected failure first:** the tests are committed before the client: `node tests/face/cdp-client.mjs` fails `ERR_MODULE_NOT_FOUND … face/scripts/cdp.mjs`, and the bats arm `every served room opened` fails `opened=0 openable=33` (openable derived from `/api/rooms` at run time) against the stub smoke that exits without navigating (the stub stays as the mutant control).
- **Live demo scenario:** after merge, from the main clone: `node .claude/scripts/hq/arc-face.mjs` → open the printed URL → the served rooms still render as before; then the owner opens the windows-leg job log and reads `face-browser: RAN` then `N/N rooms · 0 console errors · 0 exceptions · chrome=PATH`.
- **Real-system check:** the PR's CI run — browser arm executed (not skipped) on 4 leg types, counted SKIP on Node 18; the reference runs from its own folder on the owner's box (`cd docs/design/reference/face-hq/assets/arcface && npm install && npm run dev`, its `node_modules/` gitignored by the folder's own `.gitignore`).
- **Expected evidence:** `initiatives/face/evidence/phase-00/` — `delta-report.md` · `ci-jobs.json` · `smoke-log-excerpts.md` (per OS, from `gh run view --log`) · the two attacker reports.

## Rabbit holes in this phase

- **Porting `flows.mjs` now.** Detour: flows come in Phase 05 with the work door (ADR-1334); this phase ports smoke only.
- **Fixing v1 rooms Phase 03 replaces.** Detour: the one-line rule and the shrinking baseline list above.
- **Chrome timing flakes.** Detour: poll a DOM condition with a hard cap; never a longer fixed sleep.
- **A lockfile that fails the platform check.** Detour: regenerate on the owner's box with `npm install --os=<os> --cpu=<cpu>` for each CI platform; never commit `node_modules`.

## Out of scope for this phase

Tokens, kit and the light mood → Phase 01 · shell, module folders, `face-pure` → Phase 02 · any module → Phase 03 · flows and the work door → Phase 05.

## Your-setup / pending

- The owner keeps `E:/Work_Hub/01_Automemory/arc-face-hq2/` readable until the intake lands — both `assets/arcface/` and `docs/superpowers/specs/2026-09-15-hq-design-system.md`; if a `CHANGES-v0.8.md` has appeared, the owner rules which version is intake before the copy.
- If the lockfile platform check FAILs on a non-Windows configuration (likely — the lockfile was generated on Windows), the session supplies the per-platform `npm install --os=… --cpu=…` commands and the lockfile is regenerated on the owner's box inside this phase's 2 days.
- The owner runs the git for `feat/face-v2-00` and the merge; the close runs from the main clone.

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
