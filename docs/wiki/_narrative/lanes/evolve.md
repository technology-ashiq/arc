<!-- facts: appetite=e02f5370 blocked-on=a68c9074 burn=ddae603d cycle=c874db40 depends-on=a68c9074 hasPlan=b5bea41b phase=bc06d26d status=4c1abf59 title=d33ff90e -->

## In plain words

Think of evolve as a lab bench set up in the corner of the company, fenced off from the shelf where finished work sits on display. <!-- plain -->

The real goal, from its own plan: for arc's module surfaces, weekly scoreboards drawn from the spine, bounded champion-versus-challenger experiments run only on files a module has explicitly declared, and promotion proposals that only apply after a person merges them — so a module improves on evidence, and nothing ever changes without a human merge, not even a rollback. <!-- src: initiatives/evolve/PLAN.md -->

evolve was also built ahead of the condition its own design source set for it: that plan says the lane should sleep until a venture has four or more weeks of real outcome metrics on the spine, and the owner was shown that the condition was unmet and directed the build forward anyway, twice, the second time explicitly. <!-- src: docs/adr/0300-evolve-is-built-ahead-of-its-trigger.md -->

### What it is building

evolve is the name used for both this lane and the one product it built here. <!-- src: initiatives/evolve/PLAN.md; products/evolve/manifest.json -->

That product sits in the kernel ring and requires the core and hq products underneath it. <!-- src: products/evolve/manifest.json -->

Its manifest lists eight scripts: `arc-evolve.mjs`, `assign.mjs`, `board.mjs`, `calibrate.mjs`, `canon.mjs`, `lineage.mjs`, `verdict.mjs` and `wire.mjs` — and no `/arc-*` slash command at all. <!-- src: products/evolve/manifest.json -->

The board is reached by running `arc-evolve board` — the script's own usage line, not a slash command. <!-- src: .claude/scripts/evolve/arc-evolve.mjs -->

evolve's job is to make an improvement provable — a scoreboard, a bounded experiment, a verdict test with a statistical floor, and a proposal that still waits on a person before anything moves. <!-- src: initiatives/evolve/PLAN.md -->

## arc words → normal words

| arc calls it | It is really |
|---|---|
| `evolve` manifest section | An optional JSON section inside a product's `manifest.json` naming which metrics, which files and which test may be touched; absent, `product-lint` exits 0 silently, and a module that simply forgot to declare it looks identical to one that deliberately opted out — only the registration gate can tell the difference. <!-- src: docs/adr/0301-evo-a-evolve-manifest-contract-strict-from-birth.md --> |
| champion / challenger | The two arms of one experiment. The split between them is fixed at config, never adapted mid-run, and both arms are tagged symmetrically, `+champion` and `+challenger-a`. <!-- src: initiatives/evolve/PLAN.md --> |
| cohort | A second split inside one experiment, independent of the arm: a generation cohort for exploration and a verdict cohort whose data alone counts toward a verdict, both assigned deterministically. <!-- src: docs/adr/0304-evo-d-typed-receipts-closed-payloads-idem-bound.md; docs/adr/0310-v1-operating-constants-and-the-six-open-kickoff-decisions.md --> |
| base_sha / the seal | The target file's sha256 as it stands at the moment an experiment opens; if the file's hash ever stops matching, the experiment closes as `killed`, reason `canonical-drift`, rather than producing a proposal. <!-- src: .claude/scripts/evolve/wire.mjs#planOpen; initiatives/evolve/phases/phase-02-spec.md --> |
| a verdict | The one output the pinned statistical test can produce, and only once both arms have met their per-arm floor: the confidence bound must be at least `effect_floor`, and separately the point delta must be at least the minimum detectable effect. <!-- src: docs/adr/0306-evo-f-verdict-test-pinned-to-newcombe-wilson-difference-v1.md --> |
| propose-only | The rule that neither a promotion nor a rollback ever writes a canonical file by itself — a person always makes the merge, even to undo a bad change. <!-- src: docs/adr/0305-evo-e-rollback-is-propose-only-in-both-directions.md --> |
| the SHA lineage | Four checked hops from a proposed diff to a running promotion: the diff against the sealed `base_sha`, the proposal's `patch_sha` and `candidate_sha`, a merge confirmed only once the observed file SHA equals `candidate_sha`, and a watch window that runs only while the served SHA still matches; drift after that watch window raises an incident and freezes the surface rather than triggering a machine-written revert. <!-- src: initiatives/evolve/PLAN.md; initiatives/evolve/phases/phase-03-spec.md --> |
| the watch window | The monitoring period after a promotion, which only starts once the served file's SHA matches the promoted candidate — a degradation past its own floor freezes the surface and sends an urgent revert proposal to the inbox. <!-- src: initiatives/evolve/phases/phase-03-spec.md --> |
| the council bridge | The Phase 4 work letting the council product measure its own jurors — hit-rates, confidence buckets and a Brier score — by reading typed receipts through the reader instead of old Markdown session files. <!-- src: initiatives/evolve/phases/phase-04-spec.md --> |

## How the work was planned

`PLAN.md` set six numbered outcomes, each with a fixture-based acceptance test, mapped across the five phases below (REQ-03 and REQ-04 both land in Phase 2). <!-- src: initiatives/evolve/PLAN.md -->

- REQ-01 — a module declares what may be optimised, checked by `product-lint`'s extended manifest validator, in Phase 0. <!-- src: initiatives/evolve/PLAN.md -->
- REQ-02 — the board shows every module's honest state, and a wiped-and-replayed spine reproduces it byte-identical, in Phase 1. <!-- src: initiatives/evolve/PLAN.md -->
- REQ-03 — experiments are bounded, deterministic and sealed, in Phase 2. <!-- src: initiatives/evolve/PLAN.md -->
- REQ-04 — a verdict exists only above honest statistical floors, produced by one pinned test, also in Phase 2. <!-- src: initiatives/evolve/PLAN.md -->
- REQ-05 — winners and rollbacks arrive as evidence on an unbroken SHA chain, in Phase 3. <!-- src: initiatives/evolve/PLAN.md -->
- REQ-06 — the council measures itself, in Phase 4. <!-- src: initiatives/evolve/PLAN.md -->

REQ-00 of the design source — `metric.observed` enablement — was declared explicitly not evolve's requirement: it is owned by the first client's cycle, and appears in `PLAN.md` only as an external dependency and a ledger row. <!-- src: initiatives/evolve/PLAN.md; docs/adr/0308-evo-h0-metric-observed-enablement-belongs-to-the-client.md -->

Appetite was set at a hard cap of seven days, tier M, with a kill checkpoint at the 50% mark — 3.5 days — that would stop the whole cycle if the board still could not replay to a byte-identical result. <!-- src: initiatives/evolve/PLAN.md -->

Phases 0 through 3, the four phases building the core engine, were budgeted 5.5 of those 7 days; Phase 4, the council bridge, was the only named slack in the cycle, pre-committed as something that could be cut rather than held quietly in reserve. <!-- src: initiatives/evolve/PLAN.md -->

The five phases were ordered by risk: the contract and the steel thread first, the council bridge last as the one piece allowed to be dropped under pressure. <!-- src: initiatives/evolve/PLAN.md -->

The lane was born by `/arc-kickoff --lane evolve` on 2026-08-03 and claimed ADR band 0300 to 0399 at that same kickoff. <!-- src: initiatives/evolve/PLAN.md -->

## The phases, one by one

| Phase | What it set out to prove | What shipped | Cost |
|---|---|---|---|
| 00 — Contract + steel thread | A module can declare an `evolve` manifest section validated strictly from birth, the eight experiment kinds exist on the spine with closed payloads, and one receipt travels end to end through the standard emitter and the reader. <!-- src: initiatives/evolve/phases/phase-00-spec.md --> | 13 of 13 slices closed 2026-08-04, CI green: the manifest section, eight new event kinds moving the closed vocabulary from 22 to 30, the variant grammar, and a real steel-thread receipt read back through the reader; the retro's own tally counts 15 real breaks here, in the contract and receipts, all fixed and pinned as fixtures. <!-- src: initiatives/evolve/PROGRESS.md#fresh-agent --> | 1.5 days. <!-- src: initiatives/evolve/PLAN.md --> |
| 01 — Board | `arc evolve board` renders every module's honest state from the reader alone, and a wiped-and-replayed spine produces a byte-identical board. <!-- src: initiatives/evolve/phases/phase-01-spec.md --> | 12 of 12 slices closed 2026-08-04; the board folds the spine into a status view, and the evolve product's own manifest was created in this phase. A fresh agent found 15 breaks in the first version, all pinned, and CI then found a 16th — an order dependency in the fold itself. <!-- src: initiatives/evolve/PROGRESS.md --> | 1.0 day. <!-- src: initiatives/evolve/PLAN.md --> |
| 02 — Runner + verdict math | Experiments assign deterministically, seal their target, respect floors and TTL, and produce a verdict only via the one pinned test, computed at most once. <!-- src: initiatives/evolve/phases/phase-02-spec.md --> | 9 of 9 slices closed 2026-08-04: deterministic assignment, the canonical seal, the TTL, the concurrency cap, and the `newcombe-wilson-difference-v1` test with reference vectors derived independently by two agents before any implementation existed — the two derivations disagreed on 6 of 8 cases. A third fresh agent found 15 more breaks, all fixed and pinned. <!-- src: initiatives/evolve/PROGRESS.md --> | 1.5 days. <!-- src: initiatives/evolve/PLAN.md --> |
| 03 — Promotion safety | A winner and a rollback both arrive as evidence on an unbroken four-hop SHA chain, and the canonical file stays provably untouched by the machine at every hop, in both directions. <!-- src: initiatives/evolve/phases/phase-03-spec.md --> | 11 of 11 slices closed 2026-08-04, with a negative control proving each of the four SHA hops can refuse, not only pass. A fourth fresh agent found 13 breaks, three of them on things this lane had already claimed were fixed — including the propose-only guard itself, which was a grep a mutant module walked straight past. <!-- src: initiatives/evolve/PROGRESS.md --> | 1.5 days. <!-- src: initiatives/evolve/PLAN.md --> |
| 04 — Council bridge | The council measures itself: verdict and outcome receipts land on the spine, `council-calibrate` reads them through the reader instead of Markdown, and the board shows calibration honestly or says `insufficient evidence`. <!-- src: initiatives/evolve/phases/phase-04-spec.md --> | 8 of 8 slices closed 2026-08-04. This phase was named the designated cut at kickoff — the one piece allowed to drop under burn pressure — and it was built anyway: `council.outcome` joined the closed vocabulary, moving it from 30 to 31 kinds; both council payloads were closed against invalid input; an unresolved outcome is excluded from calibration rather than scored as a miss. <!-- src: initiatives/evolve/PROGRESS.md; docs/adr/0307-evo-g-first-client-council-cut-and-local-autonomy-tags.md --> | 1.5 days, pre-named as the cycle's only slack. <!-- src: initiatives/evolve/PLAN.md --> |

## What it decided

| # | Decision |
|---|---|
| 0300 | evolve was built ahead of its own trigger — the owner overrode the design plan's sleep clause, directing the build forward twice. <!-- src: docs/adr/0300-evolve-is-built-ahead-of-its-trigger.md --> |
| 0301 | The `evolve` manifest section is a JSON section inside `manifest.json`, validated strictly from the day it is added. <!-- src: docs/adr/0301-evo-a-evolve-manifest-contract-strict-from-birth.md --> |
| 0302 | Metrics live on the spine, and two streams — the client's baseline feed and an experiment's own measurements — are never summed together. <!-- src: docs/adr/0302-evo-b-metrics-live-on-the-spine-with-a-stream-contract.md --> |
| 0303 | The variant grammar extends `PROCESS_RE` backward-compatibly, so every legacy value still validates. <!-- src: docs/adr/0303-evo-c-variant-grammar-extends-process-re-backward-compatibly.md --> |
| 0304 | Every experiment receipt is typed, closed-payload and idem-bound, one kind per lifecycle step. <!-- src: docs/adr/0304-evo-d-typed-receipts-closed-payloads-idem-bound.md --> |
| 0305 | Rollback is propose-only in both directions — the machine never writes a canonical file, not even to undo one. <!-- src: docs/adr/0305-evo-e-rollback-is-propose-only-in-both-directions.md --> |
| 0306 | One pinned verdict test, `newcombe-wilson-difference-v1`, and no second formula behind the same id. <!-- src: docs/adr/0306-evo-f-verdict-test-pinned-to-newcombe-wilson-difference-v1.md --> |
| 0307 | The first client slot stays explicitly unfilled, and the council bridge is named the one phase safe to cut under pressure. <!-- src: docs/adr/0307-evo-g-first-client-council-cut-and-local-autonomy-tags.md --> |
| 0308 | Enabling `metric.observed` belongs to the future client's cycle, not to evolve. <!-- src: docs/adr/0308-evo-h0-metric-observed-enablement-belongs-to-the-client.md --> |
| 0309 | The experiment vocabulary extends the closed kind list by ADR, frozen at eight kinds for this cycle. <!-- src: docs/adr/0309-evo-h1-experiment-vocabulary-extends-the-closed-kind-list.md --> |
| 0310 | Six v1 operating constants — α, `effect_floor`, the TTL, the concurrency cap, the cohort split, and the council outcome kind — were decided at kickoff rather than left open. <!-- src: docs/adr/0310-v1-operating-constants-and-the-six-open-kickoff-decisions.md --> |
| 0311 | "Bit-for-bit" is pinned to one chosen expression tree, and cross-checked to a stated tolerance against an independent derivation. <!-- src: docs/adr/0311-evo-f1-bit-for-bit-is-pinned-to-one-expression-tree.md --> |

That test is deliberately expensive: ADR-0306 estimates that detecting a click-through-rate improvement from 3% to 4.5% at 80% power needs roughly 1,900 units per arm — thousands, not hundreds — and says plainly that the real verdict sits outside this cycle's build appetite. <!-- src: docs/adr/0306-evo-f-verdict-test-pinned-to-newcombe-wilson-difference-v1.md -->

## Where it stands now

evolve's status is IDLE. <!-- src: fact:lanes/evolve.status -->

The cycle that built it is recorded as arc-evolve, Cycle 7, closed 2026-08-04. <!-- src: fact:lanes/evolve.cycle -->

Its phase field reads plainly: cycle closed, merged as `8e80927` / PR #108; fixture-proven, unexercised. <!-- src: fact:lanes/evolve.phase -->

It burned 7.0 of its 7-day appetite — all of it, with nothing left over. <!-- src: fact:lanes/evolve.burn; fact:lanes/evolve.appetite -->

`PLAN.md` states directly that every one of the six requirements was measured against a fixture-based acceptance criterion, and that none of the six ever required real traffic to demonstrate — it names this plainly rather than letting the "validated" label imply otherwise. <!-- src: initiatives/evolve/PLAN.md -->

What the cycle does not claim: the first real experiment opened on a chosen surface was cut and banked rather than delivered, and the close was written to say the north-star claim is fixture-proven, unexercised rather than met. <!-- src: initiatives/evolve/PROGRESS.md -->

The next cycle's entry condition is unchanged from the kickoff decision: the runway starts once a real client names a surface and `metric.observed` enters the closed kind list, and that enablement belongs to the client's cycle, not to evolve's. <!-- src: initiatives/evolve/PROGRESS.md; docs/adr/0308-evo-h0-metric-observed-enablement-belongs-to-the-client.md -->

Six debt rows carry forward from the close, each with a named pay-down trigger; the one flagged as mattering most is that `lineage.mjs` has no production caller, so every default inside it is a default the first real caller will inherit without ever having chosen it. <!-- src: initiatives/evolve/PROGRESS.md -->

## The bigger loop

### What went wrong and what was learned

Five phases, five fresh-agent adversarial passes, 58 real breaks total — 15 in the contract and receipts, 15 in the board, 15 in the assignment layer and verdict gate, 13 in the lineage chain — and every one of them was in code that had already passed every test its own author had written. <!-- src: initiatives/evolve/PROGRESS.md -->

- bats silently dropped a `@test` whose title used a non-ASCII character: five tests were written, never registered, never ran, and never failed — the file stayed green and the only signal was the test count quietly falling on CI. <!-- src: docs/retro-log.md -->
- The grep-based guard protecting this lane's single most important rule — propose-only — was itself porous: it missed `from "fs"`, `fs/promises`, `child_process`, and async exec or spawn, so a mutant module that overwrote the canonical file, deleted the champion, committed, and spawned a deploy walked straight past it clean. <!-- src: docs/retro-log.md -->
- The author's own test encoded the author's own wrong assumption and then confirmed it: a corrections-supersede test varied `window_end`, so it silently corrected a different window and stayed green for a whole phase while the real correction path was dead. <!-- src: docs/retro-log.md#window_end -->
- A defect fixed in one file was not applied to its twin one phase later: "validate one read, compare another" was closed in `verdict.mjs` in Phase 2 and stayed open in `lineage.mjs` until Phase 3's agent walked three hops with an accessor and found it again. <!-- src: docs/retro-log.md#accessor -->
- The script meant to close the tracker silently edited nothing: a Python `str.replace` was anchored on "To start Phase 03" while the file said "To start Phase 02", and `str.replace` returns the string unchanged rather than raising, so the close reported success while shipping a `## Now` block four phases stale — found a day later by the retro that was supposed to read it. <!-- src: initiatives/evolve/PROGRESS.md; docs/retro-log.md#str.replace -->

### How it connects to the rest of arc

Think of evolve as a small workshop tucked away inside a bigger company, doing its own experiments off to one side. <!-- plain -->

Its manifest declares that it requires the core and hq products underneath it. <!-- src: products/evolve/manifest.json -->

Its `evolve` manifest section extends the existing strict `manifest.json` parser rather than inventing a new file format, and its non-negotiables require the standard emitter for every receipt and reader-only spine consumption. <!-- src: docs/adr/0301-evo-a-evolve-manifest-contract-strict-from-birth.md; initiatives/evolve/PLAN.md -->

Its non-negotiables tie it to Article A6 of the company Constitution — the document that outranks every ADR, PLAN and line of code company-wide: winners land as reviewed diffs and nothing changes silently, which is why the machine never writes a canonical file itself, not to promote and not to revert. <!-- src: CONSTITUTION.md; initiatives/evolve/PLAN.md -->

The `policy` lane found, after this cycle closed, that ten of evolve's own event kinds had no group in the daily brief's four-way sort, so a day full of real experiment activity would have rendered exactly like a quiet day; the silent-drop half of that bug was fixed without evolve's input, but which section each of evolve's ten kinds belongs in is a decision only this lane can make. <!-- src: initiatives/evolve/PROGRESS.md -->

Phase 4 wires evolve directly into the council product: `council.outcome` and `council.verdict` receipts let `council-calibrate` score the council's own jurors from the spine instead of from Markdown session files. <!-- src: initiatives/evolve/phases/phase-04-spec.md -->

## Glossary

| Term | Meaning |
|---|---|
| lane | Each lane's own `PLAN.md`, `PROGRESS.md` and phase files live at `initiatives/<lane>/`, and only one plan is ever live per lane; evolve is the name used for both this lane and the one product it built. <!-- src: .claude/rules/lanes.md; initiatives/evolve/PLAN.md; products/evolve/manifest.json --> |
| phase | A slice of a lane's plan; `CLAUDE.md` states a phase closes only via `/arc-phase-done`, against tests green, a live demo and the tracker updated. <!-- src: CLAUDE.md; initiatives/evolve/phases/phase-00-spec.md --> |
| ADR | A written architecture decision record; evolve's ADRs run 0300 to 0311, inside the 0300–0399 band this lane claimed at birth. <!-- src: initiatives/evolve/PLAN.md; docs/adr/0311-evo-f1-bit-for-bit-is-pinned-to-one-expression-tree.md --> |
| manifest | Each product's `manifest.json`; evolve added a strict, optional `evolve` section to this existing schema instead of a new file format. <!-- src: docs/adr/0301-evo-a-evolve-manifest-contract-strict-from-birth.md --> |
| spine | The append-only receipt log every evolve event is written to; its non-negotiables commit it to reader-only consumption, never reading spine files directly. <!-- src: docs/adr/0304-evo-d-typed-receipts-closed-payloads-idem-bound.md; initiatives/evolve/PLAN.md --> |
| KINDS | The closed list of event kinds the spine will accept; evolve's eight experiment kinds and one council kind extended it from 22 to 31. <!-- src: docs/adr/0309-evo-h1-experiment-vocabulary-extends-the-closed-kind-list.md; initiatives/evolve/PROGRESS.md --> |
| idem | An identifier derived from every identity-bearing field in a receipt, never supplied by the caller, so a doubled emit collides rather than silently duplicating. <!-- src: docs/adr/0304-evo-d-typed-receipts-closed-payloads-idem-bound.md --> |
| champion / challenger | The two arms of one experiment, tagged symmetrically and split by a fixed, config-driven rule. <!-- src: initiatives/evolve/PLAN.md --> |
| cohort | The generation-versus-verdict split inside one experiment; both cohorts get deterministic assignment. <!-- src: docs/adr/0310-v1-operating-constants-and-the-six-open-kickoff-decisions.md --> |
| floor / effect_floor | The minimum per-arm sample count, and the minimum confidence bound, a verdict must clear before it can exist at all; `effect_floor` defaults to 0, plain superiority. <!-- src: docs/adr/0306-evo-f-verdict-test-pinned-to-newcombe-wilson-difference-v1.md; docs/adr/0310-v1-operating-constants-and-the-six-open-kickoff-decisions.md --> |
| TTL | The 28-day window an experiment is allowed to run before it is auto-archived as `no-verdict`, keeping its data. <!-- src: docs/adr/0310-v1-operating-constants-and-the-six-open-kickoff-decisions.md --> |
| base_sha / seal | The target file's sha256 as it stands at the moment an experiment opens, re-checked before any proposal can be built against it. <!-- src: .claude/scripts/evolve/wire.mjs#planOpen; initiatives/evolve/phases/phase-02-spec.md --> |
| promotion proposal | A `promotion.proposed` receipt carrying the proposal id, the patch, the base and candidate SHAs, and a frozen evidence table, placed in the approval inbox for a person to accept or reject. <!-- src: docs/adr/0304-evo-d-typed-receipts-closed-payloads-idem-bound.md; docs/adr/0310-v1-operating-constants-and-the-six-open-kickoff-decisions.md --> |
| watch window | The monitoring period after a promotion, gated on the served file's SHA still matching the candidate that was promoted. <!-- src: initiatives/evolve/phases/phase-03-spec.md --> |
| propose-only | The rule that the machine never writes a canonical file itself, not to promote and not to revert — a person always makes the merge. <!-- src: docs/adr/0305-evo-e-rollback-is-propose-only-in-both-directions.md --> |
| insufficient evidence / MISSING / PENDING | Three honest renderings the board uses instead of inventing a number: `PENDING` for a below-floor experiment surface, shown with its n-per-arm progress; `MISSING` for an incomplete data window; `insufficient evidence` for a council calibration below its floor. <!-- src: initiatives/evolve/phases/phase-01-spec.md; initiatives/evolve/phases/phase-04-spec.md --> |
| fresh adversarial agent | An agent that has not seen the implementation, running the adversarial breaking-input pass bound to the section that ships each gate; four of this cycle's five phases (00 through 03) each report the count of real holes it found — 15, 15, 15 and 13. <!-- src: initiatives/evolve/PLAN.md; initiatives/evolve/PROGRESS.md#fresh-agent --> |
