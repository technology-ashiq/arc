# Build Brief — phase 06 · Session door: streaming work started by a click

spec-hash: sha256:5feabde167602bad13d2d74ef9eeeacfa756c7a5117e2f9ef025e1ff2072f67c
lane: face
reqs: REQ-08
adrs: 0026, 1302, 1306, 1308, 1312, 1313, 1318, 1319, 1320, 1321, 1322, 1323, 1324, 1325, 1326, 1327, 1328, 1329, 1330, 1331, 1332, 1333, 1334, 1335, 1336, 1339
blast-radius: .claude/scripts/, docs/design/system/tokens.css, face/src/**, face/src/modules/**, face/src/tokens.css
no-gos: (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed)
blast-radius-dropped: 24

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

title: Session door start / stream / attach beside the work door; every session's command line is `arc-run --driver …`; a command line naming a harness binary FAILs the fixture.
kind: logic
risk: high
proof: tests/face/session-door.mjs via tests/face-dash.bats on CI, every job: parts A (15 rows each spawn node arc-run.mjs --process --driver, list-built, detached), B (12 driver-only mutants FAIL: harness as command, harness as stray arg, joined argv, --driver missing/empty/unknown), C (no/forged/spent/expired click -> CLICK_REQUIRED, 0 spawns), D (door in another process starts a real run and exits; a fresh door attaches mid-run, lines in written order, receipt read off the spine by printed id), E (arc-dash sim routes: 428 CLICK_REQUIRED, NO_ORIGIN, SIM_SPEND after spend); dash-doors route enumeration updated to three mutating routes
tier: integration
sources: phase-06-spec.md, code:grep-fallback(1304; no .codegraph/), adrs(40), learning(2), retro(15), churn(267)
decision: the session is its directory (session.json + one run.log for stdout+stderr + exit.json) and the child is spawned detached, so the door holds no session state and a restart loses nothing; one-shot click tokens (60 s) are the only in-memory state; driverOnly() runs on the argv about to be spawned, not on the row; rows whose process file is absent refuse NO_PROCESS rather than borrow a process
result: CI run 36038847731 @ 8e389a5a: GREEN, all 19 jobs, every OS (ci-digest exit 0) -- tests/face/session-door.mjs ran 57+ checks on ubuntu 18/20/22, macOS and 12 Windows shards; run 36034089985 @ 60c13e92 was red ONLY on the bats wrapper's *FAIL* glob (attack B1), all 57 checks ok. Two boundary attack rounds (60c13e9: 15 findings, 8e389a5: 14) fixed in ac6288d2; 2 debts ledgered.
commit: 60c13e92, 8e389a5a, ac6288d2 (PR #269)

#### slice: 02

title: Click-started only: a fixture proves 0 sessions start on page load, on reload, or on attach.
kind: logic
risk: medium
proof: tests/face/session-dock.mjs via face-l3.bats -- lib/sessions.mjs decisions, and the click-only gate over the RAW text of every face/src file: outside door.mjs the start method is named exactly once, inside onStart, onStart occurs only as its declaration and onClick, no file but door.mjs names a session route, and door.mjs refuses a caller's click and spreads a fresh one last; the suite prints MUTANTS: n and face-l3.bats requires exactly n REFUSED (22 today: every hook shape, optional call, .call, alias, bracket, string-hidden, door.call on the route, a new .js/.jsx file, an unreadable file kind, the token skipped or overridden, onStart unbound); plus the browser flow (face/scripts/flows.mjs via face-browser.bats): every face-sessions room opened and reloaded on a NEW document naming that room, a seeded running session (a child the flow owns) attached and read RUNNING, the door journal counts 0 start requests (fail-closed: UNMEASURED on any unreadable line), then one Start click makes exactly 1, refused SIM_SPEND by name (sessions_verdict, with its own mutant control)
tier: e2e-visual
sources: phase-06-spec.md
decision: the spawn counter is the door's own journal of START REQUESTS (refused or not), not spawned children: a mutant that auto-starts on a detached CI checkout is refused BRANCH_REFUSED and spawns nothing, but it still asked -- so the request is what is counted; door.sessionStart fetches its click token itself, so no caller can hold one across a mount or replay one
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: A council convened from the `council` module streams its phases and lands a `council.verdict` receipt; absorb read and hire certification land receipts of kinds already in `validate.mjs` KINDS, or are labelled NOT SHIPPABLE (ADR-1334). The probe found `/arc-council`'s verdict payload fails the closed `council.verdict` shape (`validate.mjs:316`) — fixed in the council lane, additively, before the demo.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: **Every SESSION verb (ADR-1339):** the 15 in `evidence/phase-05/cli-probe.md` — council convene · develop proof · close phase · review · qa · ship · hire · dispatch · log lesson · promote rule · absorb adopt · growth draft · adopt plan · record ADR · lane birth — each starts from a click through `arc-run --driver` and lands a receipt of an existing kind, or is a residue row approved by the owner as a whole. A verb whose command has no process file (qa, ship and others) gets one from the engine lane, additively; `ship` deploys outward, so its session stops for the owner's confirmation before the deploy step.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: The Engine room shows driver, model and health; no key (ADR-1325).
kind: logic
risk: medium
proof: tests/face/engine-room.mjs via face-l3.bats: the engine-room fold over a fixture spine page of run.completed receipts draws one health row per driver with its run count, its LAST run's outcome and its model; the face's no-key check (face/src/lib/keys.mjs) is clean on the fixture and FAILs a provider key planted in every read the room holds (/api/engine body, a spine receipt payload, a router fault line, a map key, the lane card and router file when read), naming the read and never the key; keys.mjs and the spine's redactor (hq/lib/redact.mjs DENY_RULES) both catch every provider sample
tier: contract
sources: phase-06-spec.md
decision: health is MEASURED from run.completed receipts grouped by driver (runsBy, the same reader the per-process runs use), never a live probe of a provider -- a probe would spend and would need the key the browser must not hold; the no-key check lives face-side as a fold input over every payload the room holds, so a door defect is drawn as a named refusal (KEY_IN_BROWSER) rather than as data, and its shapes are held equal to the spine redactor's by the same samples
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: Two fresh attackers (session decision logic · process/OS boundary); CI green per job; `/arc-phase-done 06` from the main clone.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-06-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
