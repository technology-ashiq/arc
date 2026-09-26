# Phase 06 — Session door: streaming work started by a click

**Goal (one line):** REQ-08 — council convene, absorb read, hire certification and every SESSION verb the Phase 05 probe found (15) start from a click, stream their phases, and land as receipts of existing kinds, always through `arc-run --driver` (ADR-1326, ADR-1333, ADR-1339).
**Appetite:** 5 days (2 allotted + 3 banked from Blocks A and B, ADR-1339)
**Depends on:** phase-05
**Serves:** REQ-08
**Branch:** `feat/face-v2-06`
**Preconditions (STOP if absent):** Phase 05's PROGRESS row reads ✅ CLOSED via `/arc-phase-done 05` from the main clone.

## Exit criteria (Definition of Done)

- [x] Session door start / stream / attach beside the work door; every session's command line is `arc-run --driver …`; a command line naming a harness binary FAILs the fixture.
- [x] Click-started only: a fixture proves 0 sessions start on page load, on reload, or on attach.
- [x] A council convened from the `council` module streams its phases and lands a `council.verdict` receipt; absorb read and hire certification land receipts of kinds already in `validate.mjs` KINDS, or are labelled NOT SHIPPABLE (ADR-1334). The probe found `/arc-council`'s verdict payload fails the closed `council.verdict` shape (`validate.mjs:316`) — fixed in the council lane, additively, before the demo.
- [x] **Every SESSION verb (ADR-1339):** the 15 in `evidence/phase-05/cli-probe.md` — council convene · develop proof · close phase · review · qa · ship · hire · dispatch · log lesson · promote rule · absorb adopt · growth draft · adopt plan · record ADR · lane birth — each starts from a click through `arc-run --driver` and lands a receipt of an existing kind, or is a residue row approved by the owner as a whole. A verb whose command has no process file (qa, ship and others) gets one from the engine lane, additively; `ship` deploys outward, so its session stops for the owner's confirmation before the deploy step. **-- ticked NARROWER than written: see the 2026-09-26 close note.**
- [x] The Engine room shows driver, model and health; no key (ADR-1325).
- [x] Two fresh attackers (session decision logic · process/OS boundary); CI green per job; `/arc-phase-done 06` from the main clone. **-- ticked NARROWER than written: see the 2026-09-26 close note.**

## Verification plan

Refined 2026-09-24 via `/arc-change --lane face` at phase open (was: "the no-click and driver-only fixtures RED
first, green per job; one real council convene from the face as the live demo, its receipt read back from the spine").
Tests run on CI only, read per job; each fixture asserts it RAN before asserting what it printed.

**Per exit criterion — the check that ticks it:**

1. **Session door start / stream / attach, driver-only.** RED first against a door with no session route: a fixture
   calls start for every SESSION registry row and asserts the spawned argv begins `node … arc-run.mjs` with
   `--process <name> --driver <name|auto>`. Mutants the fixture must FAIL: a row whose argv names `claude`, `codex`,
   `hermes` or any harness binary directly; a row whose argv is built by string join (one arg containing a space);
   `--driver` missing or empty. Stream: the door relays the run's phase lines in order; attach re-reads the run's own
   receipts and transcript, and a fixture proves the door keeps no session state (restart the door mid-run → attach
   still shows the run).
2. **Click-started only.** A browser-harness fixture opens every room with a session verb, reloads it, and attaches
   to a running session; the spawn counter reads 0 after each. Mutants: an auto-start on mount, a start on reload,
   a start from Ask (`ASK_ACTIONS` stays the three), a start from a replayed request with no click token — each FAILs.
3. **Council convene, the live demo.** Before the demo, the council lane's additive fix makes `/arc-council` emit
   exactly `session_id · question_hash · call · confidence` (`validate.mjs:316`); its pinning fixture is RED on
   today's payload (BAD_COUNCIL) and green after. Demo, from the main clone after merge: one convene clicked in the
   `council` module, its phases streamed, the `council.verdict` receipt read back off the spine by ULID. The spend
   is the owner's to approve first; a refusal by the council's budget guard renders verbatim and is not a pass.
4. **Every SESSION verb (15).** Each row below lands in its own PR (grouped by owning lane) with: its process file
   (existing, or added additively by the engine lane), its door row, a fixture that it starts only through
   `arc-run --driver`, and its receipt read back as a kind already in `validate.mjs` KINDS. A verb that cannot meet
   that is a row in `evidence/phase-06/residue.md` naming the missing piece and the lane it is filed to; the owner
   approves the residue as a whole. REQ-08's "absorb read" and "hire certification" are the probe's `absorb adopt`
   and `hire` rows.

   | Verb (module) | Process file today | Receipt kind (existing) |
   |---|---|---|
   | council convene (council) | none — engine lane adds | `council.verdict` after the payload fix |
   | develop proof (develop) | none | `slice.done` |
   | close phase (develop) | none | `phase.closed` |
   | review (review-ship) | `review-diff` ✓ | `review.completed` |
   | qa (review-ship) | none | `qa.completed` |
   | ship (review-ship) | none | `ship.done` — the session stops for the owner's confirm before `vercel --prod`; a fixture proves no deploy step runs without it |
   | hire (executor) | none | chosen in its PR from KINDS, else residue |
   | dispatch (executor) | any — the door itself | `run.completed` |
   | log lesson (memory) | none | `note.logged` (`lesson.logged` is invented, ADR-1334) |
   | promote rule (memory) | none | `approval.requested` — the owner approves the diff |
   | absorb adopt (absorb) | none | chosen in its PR from KINDS, else residue |
   | growth draft (growth) | none | chosen in its PR from KINDS, else residue |
   | adopt plan (strategy) | `kickoff-plan` ✓ | `kickoff.done` |
   | record ADR (strategy) | none | `note.logged` or residue (`adr.recorded` is not a kind) |
   | lane birth (org) | `kickoff-plan` ✓ | `kickoff.done` |

5. **Engine room.** A fixture renders the room from a fixture spine and asserts driver, model and health are shown;
   a planted provider-key string in any door response the room reads FAILs the no-key check (ADR-1325).
6. **Attack + close.** Two fresh `/arc-attack` agents per PR — session decision logic, and the process/OS boundary
   (argv construction, child lifetime, Windows spawn) — each carrying the lane's fixed-defect list; at most two rounds
   (LOW leftovers to the debt ledger). CI green per job via `ci-digest`; `/arc-phase-done 06` from the main clone.

## Rabbit holes in this phase

- **Long-running sessions outliving the door** — attach reads the session's own receipts; the door holds no session state of its own.
- **Budget spend on a demo** — the convene uses the council's own budget guard; the face renders its refusal verbatim.

## Out of scope for this phase

New drivers or router classes (engine lane) · scheduled sessions (scheduler lane).

## Current-phase notes

**2026-09-26 — the close (`/arc-phase-done 06`).** Two criteria are ticked NARROWER than written, and each is DECLARED
for the owner's stamp on `approval.requested{gate: phase-done}` `01M3EBDGQ70ETM8PXDHNKHSZXJ`:

- **Every SESSION verb.** Of the 15, **5 ship with their receipt read back**: council convene (the live demo), develop
  proof, log lesson, promote rule and record ADR. **4 start from a click, but their own receipt has not been read
  back**: review, dispatch, adopt plan and lane birth. Each one's process body emits the row's kind, and a fixture
  checks that. **6 are residue**, filed to their lanes: ship, qa, hire, close phase, absorb adopt and growth draft. It
  is all in `evidence/phase-06/residue.md`, which a fixture holds to the registry both ways. The owner ruled the six
  residue rows on 2026-09-26. The four read-backs are a debt-ledger row. `ship`'s confirm stop is enforced by refusing
  the start (`CONFIRM_STEP_UNENFORCED`), not by pausing before the deploy, so it is a residue row, not a pass.
- **Two fresh attackers.** 13 boundary rounds ran across 8 PRs, with 175 findings and 118 fixed-defect rows
  (`evidence/phase-06/attackers.md`). The logic surface never ran, because the free trial model answered 429. That is
  a debt-ledger row, paid by a logic pass over the phase diff once a paid model is set. CI is green per job: the
  merged tree `465f5b82` passed the main dispatch 19/19 (run 36225129900), and the close's fixture PR `ea347dfc`
  passed 19/19 (run 36227021580) with suite `1..3545`, 0 not ok.

Spec-fidelity: drift found, and every item is dispositioned in `evidence/phase-06/spec-fidelity.md`.

## Your-setup / pending

The owner approves any real council spend the demo triggers; the owner runs the git for `feat/face-v2-06`.

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
