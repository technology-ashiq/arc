# Phase 05 — Work door + every work verb + live rooms: the owner's hand, with no second brain

**Goal (one line):** REQ-04 + REQ-07 + REQ-09 + REQ-11 — `/api/op/:id/plan|apply` runs the real tools, the flagship six first and then all 31 work verbs in every room, each proven to call what a hand-run calls; flows run in CI; coverage checks ops both ways; every room re-reads when arc changes (ADR-1326, ADR-1334, ADR-1339).
**Appetite:** 10 days (4 allotted + 6 banked from Blocks A and B, ADR-1339) — door + six 3d · live rooms 1d · kernel ring 2d · factory ring 2d · money + company ring 2d
**Depends on:** phase-04
**Serves:** REQ-04, REQ-07, REQ-09, REQ-11
**Branch:** `feat/face-v2-05` (the door-plus-six PR), then `feat/face-v2-05-live` and `feat/face-v2-05-<ring>` — one PR each, merged on green CI per job
**Preconditions (STOP if absent):** Phase 04's PROGRESS row reads ✅ CLOSED via `/arc-phase-done 04` from the main clone; the owner has ruled PLAN-face-v2 §13 items 4 and 5 (ADR-1337, ADR-1339); the Block B tripwire reading is recorded in PROGRESS.md.

## The five PRs, in risk order

| PR | What ships | Verbs |
|---|---|---|
| 1 · door + six | the door machinery below, the shared `arc-event --dry-run`, and the flagship six: `bench-a-model` · `close month` · `growth publish` · `ledger criteria` · `capture-idea` · `develop checkpoint` | 6 |
| 2 · live rooms | the door signals a change; the open room re-reads within 5 s; every module re-reads on change (REQ-11) | — |
| 3 · kernel | tier proposal · register job · open experiment · bench propose · pin source · trial · driver switch · cap proposal · measure · conclude | 10 |
| 4 · factory | develop slice · design open brief · send-to-council · record pick · pin tool · switch profile · terminate · add agent | 8 |
| 5 · money + company | ingest · leads daily send · legal full-read stamp · venture register · kill review · set lane status · define concept | 7 |

The verbs, buckets and exact gaps are in `initiatives/face/evidence/phase-05/cli-probe.md` (31 work verbs; the 15
SESSION verbs are Phase 06's).

## Exit criteria (Definition of Done)

- [x] **Day-1 CLI probe, before any door code:** every §5.2 verb recorded in `initiatives/face/evidence/phase-05/cli-probe.md` — the CLI's path, its dry-run/plan mode, whether its output is machine-readable, and the kind it emits against `validate.mjs` KINDS (2026-09-19: 2 READY · 15 SMALL-GAP · 14 BIG-GAP · 15 SESSION · 0 NEEDS-KIND; assumptions ledger row 6 FIRED, routed by ADR-1339).
- [ ] **Owning-lane changes are additive and measured (ADR-1339):** each gap is closed in the owning lane's own script — a plan/dry-run flag, `--json`, a receipt of an existing kind, a thin CLI over that lane's existing library, or a bug the probe found — as its own commit; a fixture pins the current behaviour BEFORE the change and stays green after it; a LIVE lane's file is checked with `git log origin/main -5 -- <path>` first; no change weakens that lane's non-negotiables. An op with no honest route this way is a residue row, never door logic.
- [ ] Server ops registry beside the door (`.claude/scripts/hq/face-ops.mjs`, ADR-1319): each op names the exact script or emitter a hand-run calls; its main-guard realpaths both sides.
- [ ] Binding table per op (ADR-1334): v0.7 kind → the existing kind the real CLI emits | NOT SHIPPABLE; written from each CLI, never from the v0.7 name.
- [ ] `POST /api/op/:id/plan` → command line + file diff + ₹ estimate; `POST /api/op/:id/apply` → runs, streams, emits a receipt of a kind in `validate.mjs` KINDS.
- [ ] Per-op **no-second-path fixture**: the door's invocation equals the hand-run invocation; an op without it green does not ship and its module renders read-only with an honest badge.
- [ ] **`main`-untouchable fixture:** a file-touching op writes only to a `feat/face-*` branch, shows the diff and stops; no merge exists.
- [ ] A tool's own refusal (send-window, cap, budget, lint) renders verbatim.
- [ ] Module `ops.mjs` filled for shipped ops; `face-coverage` op half: a module `ops[]` id missing from the server registry FAILs, and vice versa; selftest arms > 93.
- [ ] `face/scripts/flows.mjs` ported: button text, placeholders, `data-*`, h1 frozen; event assertions read receipts through the door; runs from `tests/face-browser.bats` on every Node ≥20.19 leg; a planted change to a frozen string FAILs.
- [ ] `POST /api/decide` byte-parity fixture green (former REQ-08, ADR-1333); route-enumeration fixture proves no bulk write path appeared.
- [ ] **Block C gate:** if the six flagship ops cannot all be made green, the door does not ship — every module read-only with a no-verbs badge — and the door moves to its own cycle.
- [ ] **Block C tripwire (day 5, burn 9d):** PR 1 not green on CI → every BIG-GAP verb not yet shipped becomes a residue row filed to its lane; the rings re-plan; no extension (ADR-1339).
- [ ] **Every work verb (REQ-07):** each of the 31 ships with its no-second-path fixture green, or is a row in `evidence/phase-05/residue.md` naming the missing piece and the lane it is filed to; `tests/face/` holds the residue equal to the ops registry both ways (a verb can neither vanish nor be invented); the owner approves the residue as a whole at `/arc-phase-done 05`.
- [ ] **Proposals stay proposals:** driver switch and terminate write a `feat/face-*` branch by git plumbing (never a checkout), show the diff and raise `approval.requested`; the cap proposal raises the `policy.promotion` approval and writes no branch, because `hq.policy.yaml` is an un-grantable target (amended 2026-09-19, ADR-1340); nothing in the face writes `engine/router.yaml` or `hq.policy.yaml`, and a fixture proves it.
- [ ] **Human-run ops apply only on the owner's click:** close month, the leads send, growth publish and the legal stamp are applied by `apply` from a click and never from Ask, a schedule or a replay; a fixture proves each refuses the other three paths.
- [ ] **Live rooms (REQ-11):** the door signals a change when the spine or a declared file changes; the open room re-reads within 5 s, proven by a browser-harness fixture that appends a spine event and times the panel; an op's receipt appears in its room within 5 s of `apply`; every room re-reads on change because the host re-reads all of an open room's reads on the door's pulse (no module can opt out; the planted mutant is a host that stops re-reading, which the browser live flow FAILs).
- [ ] Two fresh attackers per PR (door decision logic · shell/git boundary), each carrying the fixed-defect list; CI green per job on every PR; `/arc-phase-done 05` from the main clone.

## Verification plan

Per PR, RED first: the no-second-path and `main`-untouchable fixtures fail against a door with no ops registry; each
owning-lane change's behaviour-pinning fixture is green BEFORE the change and after it; flows fail on a planted
string. Then green per job on CI. Live demo per PR: from the main clone, each shipped op's `plan` read back, then one
`apply` whose receipt is read off the spine; for money-spending ops (bench run, bench propose) the demo is `plan` only
unless the owner approves the spend. The live-rooms PR's demo: a spine append shows in the open room without a reload.

## Rabbit holes in this phase

- **CLIs with no dry-run** — the gap is closed in the owning lane (ADR-1339), never by a shim in the door (ADR-1326).
- **A `--dry-run` a CLI silently ignores** — `develop.mjs` swallows an unknown flag as a positional (`lane-resolve.mjs:218`) and `design-explore.sh` skips it (`:53`), so both would really write; the flag is parsed and a fixture proves the plan path writes nothing.
- **Ops that "need" a new kind** — out of scope and labelled (ADR-1334); none found by the probe.
- **Spending on a plan** — `arc-bench --propose` always re-runs the bench; its plan mode must invoke nothing.
- **LIVE lanes' files** (bench, growth, leads, legal, scheduler) — another session may be editing them; check `origin/main` first and keep each change one commit.
- **The engine seam** — `face-ask`'s `hq.policy.yaml` row still waits on the empty-allowlist seam; no op routes around it (PLAN-face-v2 §11).

## Out of scope for this phase

The 15 SESSION verbs (council convene, develop proof, close phase, review, qa, ship, hire, dispatch, log lesson,
promote rule, absorb adopt, growth draft, adopt plan, record ADR, lane birth) → Phase 06 · merge from the UI → never ·
direct writes to `engine/router.yaml` or `hq.policy.yaml` → never.

## Current-phase notes

- **2026-09-19, PR 1 (door + six), where it departs from the letter above, stated rather than hidden:**
  - `ops.mjs` names op **ids only**. PLAN-face-v2 §5.1's example put label and fields in the module; they live once, in
    the server registry (`.claude/scripts/hq/face-ops.mjs`), and the dock reads them through `GET /api/ops` -- one
    spelling of what the door validates, with `face-coverage`'s op half holding ids equal both ways.
  - **Apply streams by polling** `GET /api/op-run/:planId` (the tool's lines so far, then its result) rather than a
    chunked response: every door answer keeps going through the one escaping serializer, and a second apply of the same
    plan replays the run instead of opening a second stream.
  - **Three Phase 03 verb-pending cards are retired** (money: criteria, close the month; growth: merge and publish),
    each named by its op's `retires`; `evidence/phase-05/verbs-pending.md` is Phase 03's cards minus exactly those, held
    by `module-frame` to the folds and to the registry. Bench's "Add a model to the bench" card stays until the kernel
    ring ships its propose half -- it promises the whole flow, and only the run is live.
  - **The `flows.mjs` port moves to PR 2** (live rooms), which rebuilds the browser harness anyway. PR 1 drives every op
    through the same door routes the dock uses (`tests/face/work-door.mjs`: plan, confirm, apply, replay, and the
    hand-run's receipt compared per op), and the dock itself was driven in a real browser against a sim door: money
    `close month` (plan GREEN, confirm, run, `month.closed`) and bench `run` on the mock driver (16 streamed lines,
    `run.completed`), 0 console errors.
  - **Found by building it, fixed in the owning lanes:** `arc-pnl`'s criteria request needs `--idem
    sha256("ledger.criteria|"+digest)` (the printed two-step never said so -- the emitter refused it); a bench ceiling of
    ₹0 runs nothing (the field floor is 1); the door reads for a receipt whatever the exit (bench exits 1 on a partial run
    and still records it).

- **2026-09-19, PR 2 (live rooms + flows):**
  - **The pulse, not a push.** `GET /api/pulse` is a fingerprint of what the rooms read, built from stats alone
    (names, sizes, mtimes of the spine's day files and quarantine, the allow-listed files, every lane's PROGRESS.md,
    PLAN.md and phases/, docs/adr/). The shell asks it every 2 s (`PULSE_MS`); a change re-reads ALL of the open room's
    reads -- keeping the last answer on screen while they read, so nothing flickers -- plus the inbox chip and the
    registry. A server push (SSE over a file watcher) was the alternative; a stat poll has no watcher to lose events on
    one OS, and 2 s sits well inside REQ-11's 5 s. Successful pulse and run-poll answers are not journalled.
  - **REQ-11's per-module check is replaced** by the host-level re-read (PLAN amended the same day): a room cannot be
    read-once when the host re-reads all of its reads, so the mutant worth planting is a host that stops, and the
    browser live flow FAILs it.
  - **The `flows.mjs` port:** `face/scripts/flows.mjs` drives every registry op through its room's dock in Chrome --
    typing by placeholder, clicking the FROZEN "Plan it" / "Run it", ticking a human-run op -- and reads each receipt
    back through `/api/spine`; then the live flow appends a receipt behind the spine room and times its re-read. The
    harness runs the flows once, after both moods' smoke, because they write to the fixture. A planted rename of a
    frozen button FAILs `tests/face/live-pulse.mjs`.
  - **Round 2 of PR 1's attackers lands here** (fixed-defects.md, "PR 2 -- round 2"). Every finding was a TWIN of a PR
    1 fix, one file over, so the fixes reach past the door: `arc-inbox` reads by scan and the door forces
    `ARC_SPINE_ENGINE=scan` for itself and its tools; `arc-run` prints `arc-run: receipt run.completed <id>` on stderr
    and bench credits only that id; bench's `gitEnv` compares names upper-cased; every POST body is strict (CRLF and one
    BOM normalised, duplicates refused); `/api/ask` runs through `runTool`, so its timeout ends the tree; a live door
    refuses all five spine test doors and every malformed flag. The dock shows a text field's size in bytes as the
    owner types; one-line fields refuse bidi controls and name the character they refuse. Three process-tree
    remainders are debt rows, not claims: Windows descendants after the tool exits, POSIX `setsid` escapes, and bench's
    own synchronous attempt timeout.

- **2026-09-19, PR 3 (kernel ring) -- ships as 3a and 3b.** ADR-1340 answers the three questions the ring raised before
  any op was built: an effect past the spine (the machine's scheduler, a proposal branch) is refused on a sim door at
  APPLY (`SIM_EFFECT`) while its dry-run plan still runs; a file change is a `feat/face-*` branch written by git
  plumbing (`core/proposal-branch.mjs`), never a checkout; the cap proposal is the `policy.promotion` approval and
  writes no branch (the DoD line amended the same day); evolve's open/measure/conclude are wired to the spine
  (`evolve/wire.mjs`). **3a** carries seven verbs: register job (`arc-jobs register --dry-run|--receipt`, and arc-jobs
  now refuses an unknown flag -- `register x --dry-run` used to register for real), driver switch and tier proposal
  (`engine/propose.mjs`, one router line on a branch plus `approval.requested`), cap proposal (`hq/policy-promote.mjs`),
  and open/measure/conclude (`arc-evolve`). **3b** carries pin source and trial (absorb: the study report and the
  seal's commitment are FILES, so both go through the proposal-branch writer) and bench propose (a no-invoke plan
  from an existing run's evidence). Split because 3b's absorb changes are a second design (bundle files on a branch)
  and 3a's seven are ready to be attacked now.
  - On this tree no product declares an evolve section, so the three evolve ops refuse by name -- the dock shows the
    tool's sentence, and the flows and the parity suite hold that refusal identical by door and by hand. The
    receipts are proven in `tests/face/kernel-ring.mjs` over a scratch repo that declares one, through to a verdict.
  - **3b, built:** `bench.propose` (`arc-bench --propose --from <run> --champion <run>` -- the gates and diff of a
    live propose, over a run that already happened; artifacts beside the spine; nothing runs, nothing spends),
    `absorb.pin-source` (`absorb/pin.mjs`: study's scaffold on a proposal branch -- study.mjs itself still names no
    execution primitive) and `absorb.trial` (`absorb/trial.mjs` over `judgement.mjs seal --bundle-dir`: the commitment
    on a proposal branch, the branch checked writable BEFORE the seal burns the correlation). The seal's flags became
    a closed set -- an unknown flag used to be ignored, so a mistyped `--dry-run` sealed for real -- and its
    reused-bundle refusal now runs before anything is written. Bench's "Add a model to the bench" card retires
    (running and proposing are both live). The proposal tools' APPLY paths are proven in `kernel-ring.mjs` in a
    scratch repository: a branch appears, the owner's tree does not move, the approval names what was written.
  - Retired with their ops: model-policy's "Propose a tier change" and evolve's "Open an experiment". The policy
    room's card ("Propose a cap, or demote a pair") and the scheduler's ("Register a job" -- a reviewed diff to
    hq.jobs.yaml, a different verb from registering a row with the OS) stay: neither op is all of its card.

## Your-setup / pending

Both §13 rulings are in (ADR-1337, ADR-1339). The owner's click is the keystroke for the human-run ops; any real spend
in a demo (a bench run) waits on the owner's OK.

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
