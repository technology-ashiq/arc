<!-- facts: appetite=5e9c2398 blocked-on=a68c9074 burn=3211e87a cycle=8438563e depends-on=a68c9074 hasPlan=b5bea41b phase=991629d8 status=4c1abf59 title=ffe7e065 -->

## In plain words

Picture arc's dispatch office deciding to sign its first outside contractor instead of only ever calling its own staff. <!-- plain -->

The lane's own goal statement is: `arc-run --process X --driver hermes` executes an arc process on one external agent runtime under the same contract as every other engine driver — provider-capped money, run-owned wall-clock, schema-validated output, full receipts with scrubbed trails, isolation certified against the real runtime, an L1-drafts ceiling enforced by the live policy engine — and leaves behind a reusable hiring kit so the second runtime hire is a shim and a checklist rather than a project. <!-- src: initiatives/engine/PLAN.md -->

This is Cycle 7 of the `engine` lane, named "The Hired Hands." It inherits an open wound from Cycle 6 ("The Model-Agnostic Foundation"): that cycle shipped the engine and archived clean, but its central claim was never proven — REQ-08 asked for three real runs on a non-Claude driver and got zero, because nothing runnable was installed and no credential existed. Cycle 7's whole shape is a response to that gap, not a fresh start. <!-- src: initiatives/engine/PLAN.md -->

### What it is building

The product underneath this lane is `engine` itself — arc's dispatch office, in the `kernel` ring, requiring the `core` and `hq` products and holding ADR band 0200–0299. <!-- src: products/engine/manifest.json; initiatives/engine/PLAN.md#d1fdaab -->

What Cycle 7 adds to that product is one more driver, `drivers/hermes`, wired to an external agent runtime (Hermes Agent) under the same three-code driver contract as every other engine driver — never a special guest with its own rules. <!-- src: initiatives/engine/PLAN.md; docs/adr/0208-exe-a-the-runtime-is-hermes-agent-pinned-and-container-backed.md -->

Alongside the driver, the cycle builds the parts that make hiring an outside worker safe to repeat: a twelve-fixture isolation certification suite, a hard-capped provider credential, an owner-approved "context pack" rule for what the worker is allowed to see, a tenure/retire path so the hire expires on a date, and a documented "unlock ladder" for later rungs of autonomy that this cycle deliberately does not build. <!-- src: docs/strategy/plans/PLAN-executor.md; initiatives/engine/PLAN.md -->

## arc words → normal words

| arc calls it | It is really | Meaning |
|---|---|---|
| hire row | the employment contract | A `router.yaml` row that points at a runtime driver and carries four mandatory terms: `cap`, `hosted`, `judge`, `review_by`. <!-- src: initiatives/engine/PLAN.md; initiatives/engine/phases/phase-07-spec.md --> |
| `hosted` | inside or outside the building | Whether the row is `local` or `cloud`; `data-boundary.mjs` reads this field to decide how a refusal is reported when the row is not local. <!-- src: initiatives/engine/PROGRESS.md --> |
| `review_by` | the contract's end date | A date after which dispatching through the row refuses and asks to be re-justified or retired, enforced when the router loads. <!-- src: docs/adr/0216-exe-i-tenure-is-enforced-at-load-time-and-every-hire-is-planned-obsolescence.md --> |
| context pack | the folder handed to the contractor | An owner-approved bundle that bounds what data a dispatch may see; one approval can cover several dispatches, declared up front. <!-- src: docs/adr/0214-exe-g-inputs-are-owner-approved-packs-that-bound-data-not-the-take.md --> |
| certification vs. regression | the real test vs. the rehearsal | A run of the isolation suite against the real runtime is labelled `certification`; the same suite against the fake driver is labelled `regression`, and the label is asserted by a test rather than typed by hand. <!-- src: initiatives/engine/phases/phase-06-spec.md --> |
| capped key | the contractor's own wallet | A provider credential whose non-resetting spending ceiling is set before it is ever issued. <!-- src: docs/adr/0213-exe-f-the-money-ceiling-is-the-credential-and-no-cap-is-zero-overshoot.md --> |
| the mandate | the order to build | The owner's Build-out Mandate of 2026-08-09, put on the spine as two events — an `approval.requested` followed by the `decision.recorded` that decides it — and cited by every ADR this cycle wrote. <!-- src: initiatives/engine/PLAN.md; initiatives/engine/phases/phase-04-spec.md --> |
| data boundary | the "may this leave the building" check | A refusal, above the driver, of an internal-only input — refused before the runtime process starts, and, specifically against a `hosted: cloud` row, refused at routing. <!-- src: docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md; docs/adr/0212-exe-e-an-agent-runtime-occupies-the-model-seat-amending-adr-0069.md; initiatives/engine/phases/phase-06-spec.md --> |
| OUT-OF-CYCLE | work done after the clock stopped | A change routed through `/arc-change` and charged to no cycle's appetite, because the cycle it touches has already closed. <!-- src: initiatives/engine/PROGRESS.md; initiatives/engine/PLAN.md --> |

## How the work was planned

The plan's eight requirements each carry a measurable acceptance test, not a feeling. REQ-00 asks for one live headless invocation of the real runtime before anything else is built on it; REQ-01 asks that the runtime behave like one more driver, not a special guest; REQ-02 asks for the twelve-fixture isolation suite green against the real runtime; REQ-03 asks that every dispatch leave a policy-grade receipt with a scrubbed trail. <!-- src: initiatives/engine/PLAN.md#REQ-00; initiatives/engine/PROGRESS.md#eight -->

REQ-04 asks that hiring be a reviewed, receipted, expiring, revocable act; REQ-05 asks that money cannot exceed the cap even on an opaque runtime; REQ-06 asks that the input be as governed as the output; REQ-07 asks for one real job with a verdict, not just a pulse. <!-- src: initiatives/engine/PLAN.md#pulse -->

All eight requirements are recorded as `validated` in the plan's own requirements table, and the cycle closed with 8/8 REQ validated. <!-- src: initiatives/engine/PLAN.md#REQ-07; initiatives/engine/PROGRESS.md -->

The appetite — the time budget — moved twice, both times by an explicit owner ruling rather than a silent slide. It opened at 7.5 working days. At the day-5 checkpoint the certification requirement, REQ-02, was still not certified against the real runtime; the checkpoint fired, and the owner ruled to continue, raising the appetite to 9.5 days in writing. Later, asked to choose between cutting scope and taking more time with 7.5 days already burnt and 4.5 days of phases still ahead, the owner ruled "no scope cut, finish every phase," which raised the appetite a second time to 12 days and turned it from a gate that could kill the work into a forecast that gets reported. <!-- src: initiatives/engine/PLAN.md#forecast -->

Three hard STOP conditions were named in advance and stayed armed through both extensions: no candidate driver passing its must-have checks stops the cycle at Phase 04; REQ-02 turning out unprovable without sandbox-level infrastructure (netns, seccomp, a VM) stops the cycle outright, because an unprovable boundary is treated as a no; and runtime API or CLI churn eating more than two days means banking the work and falling back to the drivers already in place. <!-- src: initiatives/engine/PLAN.md#eligible; initiatives/engine/PLAN.md#A-04 -->

Two cuts were pre-decided, named before they were ever needed, so that a real overrun would not turn into an argument: if the cap was threatened, Phase 08 would first lose its hand-written results table, and only then any dispatch beyond a floor of three real runs — the three real runs themselves, and the adversarial passes, were named uncuttable because they are the only two things in the cycle that test the work outside its own fixtures. Both cuts were applied for real on 2026-08-16, at the scope-cut conversation `/arc-phase-done` forces at 50% burnt with the tripwire phase still open — held that day at 60% burnt with Phase 06 not yet done. <!-- src: initiatives/engine/PLAN.md#eligible; initiatives/engine/PROGRESS.md#APPLIED -->

The ADR numbering carried its own small history: this cycle claimed band 0208–0219, after finding that 0207 had already been written by the `memory` lane with the owner's approval and was invisible to this worktree until sibling worktrees were checked; and a separate seam (later ADR-0220) was raised mid-cycle by the `bench` lane, ruled out of scope for this cycle's appetite by the owner, and shipped as its own PR outside the 7.5-day clock even though its ADR number sits inside engine's band. <!-- src: initiatives/engine/PLAN.md#d1fdaab; initiatives/engine/PLAN.md#eligible -->

## The phases, one by one

| Phase | What it set out to do | What shipped | Cost |
|---|---|---|---|
| 00 | Steel thread from Cycle 6: the canonical process layer, `arc-run`, the driver contract and `router.yaml` this cycle builds on. Parked here rather than rebuilt. <!-- src: initiatives/engine/PLAN.md --> | Carried forward as a done row; no new work this cycle. <!-- src: initiatives/engine/PROGRESS.md --> | Its appetite belongs to Cycle 6, not this one. <!-- src: initiatives/engine/PLAN.md --> |
| 05 | Bring `drivers/hermes` onto the real three-code contract, ship `drivers/mock` for keyless regression, and put the output parser through a two-surface adversarial pass. <!-- src: initiatives/engine/phases/phase-05-spec.md --> | A 47-test red-fixture corpus (junk bytes, an ANSI flood, truncated JSON, injection-shaped output, empty stdout) plus twelve more rows the adversarial passes added; a live demo showed a spent deadline exiting the driver before the runtime even starts, and a wall-clock overrun landing a receipt reading `reason: budget`. <!-- src: initiatives/engine/PROGRESS.md --> | Budgeted 1.5 days; the shim itself fit inside that, and what overran was the two adversarial rounds, charged to the cycle rather than the phase. <!-- src: initiatives/engine/PROGRESS.md --> |
| 07 | Hire the contractor in one reviewed `router.yaml` diff meant to carry the routing row, the policy row and the termination path together, behind a hard-capped credential, with class budgets set from measured runs. The policy-row criterion was later moved to Phase 08 and marked not satisfiable here. <!-- src: initiatives/engine/phases/phase-07-spec.md --> | The row landed with all four mandatory terms enforced at router load; the capped key's ceiling read zero from the provider; a calibration baseline of three runs (248s / 319s / 342s) set the class budget; termination was demonstrated rather than only written, which is how a false claim about it was caught. <!-- src: initiatives/engine/PROGRESS.md; initiatives/engine/phases/phase-07-spec.md --> | Budgeted 1 day, largely built inside Phase 06's own work. <!-- src: initiatives/engine/PROGRESS.md --> |
| 08 | Give the contractor one real job on owner-approved context packs, run it at least three times, and record an accept-or-reject verdict per draft. <!-- src: initiatives/engine/phases/phase-08-spec.md --> | Three real dispatches, three `run.completed` receipts, zero quarantined, one attempt each, 35.8–40.7 seconds; two drafts accepted, one rejected, each with a one-line reason. Two pre-decided cuts (the hand-written results table, and any dispatch beyond the three-run floor) were applied. <!-- src: initiatives/engine/PROGRESS.md; initiatives/engine/phases/phase-08-spec.md --> | Budgeted 1.5 days for the phase; this close was also Cycle 7's close, whose own total came to 9.5 of 12 days burned, about 79%. <!-- src: initiatives/engine/PROGRESS.md#amendments --> |

## What it decided

| # | Decision, in one line | Status |
|---|---|---|
| 0200 | A process is one YAML file with a JSON-Schema output contract and its own version number. <!-- src: docs/adr/0200-eng-a-a-process-is-one-yaml-file-with-a-schema-contract-and-its-own-semver.md --> | accepted, 2026-08-03 |
| 0201 | An adapter transforms the canonical process into dialect text as a pure function, with no filesystem access of its own, and the file it generates is never hand-edited. <!-- src: docs/adr/0201-eng-b-adapters-are-pure-functions-and-a-generated-file-is-never-hand-edited.md --> | accepted, 2026-08-03 |
| 0202 | A line-ending-normalised diff against the old hand-written command is a migration gate that retires once the switch happens. <!-- src: docs/adr/0202-eng-c-the-byte-diff-is-a-migration-gate-and-retires-at-the-flip.md --> | accepted, 2026-08-03 |
| 0203 | The driver interface is fixed, and the ADR states which layer owns a retry. <!-- src: docs/adr/0203-eng-d-the-driver-interface-and-which-layer-owns-a-retry.md --> | accepted, 2026-08-03 |
| 0204 | An escalation always ends in a proposal receipt for a human to read, never in the system changing a model tier on its own. <!-- src: docs/adr/0204-eng-e-escalation-terminates-in-a-proposal-receipt-never-a-tier-change.md --> | accepted, 2026-08-03 |
| 0205 | A canonical process carries one shared body of instructions, with no per-target variant. <!-- src: docs/adr/0205-a-canonical-process-carries-one-shared-body-and-no-per-target-passthrough.md --> | accepted, 2026-08-03 |
| 0206 | The tool taxonomy gains `agent.invoke`, and inputs render through a neutral placeholder. <!-- src: docs/adr/0206-the-tool-taxonomy-gains-agent-invoke-and-inputs-render-through-a-neutral-placeholder.md --> | accepted, 2026-08-03 |
| 0207 | A migration proof retires the day its process file first legitimately changes. Written by the `memory` lane with the owner's approval, inside engine's band. <!-- src: docs/adr/0207-a-migration-proof-retires-when-its-file-first-legitimately-changes.md; initiatives/engine/PLAN.md --> | accepted, 2026-08-11 |
| 0208 | The hired runtime is Hermes Agent, pinned to a tag, and run behind a container backend. <!-- src: docs/adr/0208-exe-a-the-runtime-is-hermes-agent-pinned-and-container-backed.md --> | accepted, 2026-08-12 |
| 0209 | The unit that gets pinned is the skill layer, so the runtime binary itself can still be patched. <!-- src: docs/adr/0209-exe-b-the-pinned-unit-is-the-skill-layer-and-the-runtime-stays-patchable.md --> | accepted, 2026-08-12 |
| 0210 | Wall-clock budget belongs to the run, not to any one attempt; leaving a dispatch to run unwatched is a defect. <!-- src: docs/adr/0210-exe-c-wall-clock-is-a-property-of-the-run-and-fire-and-forget-is-a-defect.md --> | accepted, 2026-08-12 |
| 0211 | The provider credential is capped and lives in the environment; the runtime's own persistent memory is proven off. <!-- src: docs/adr/0211-exe-d-the-credential-is-capped-and-in-env-and-runtime-memory-is-proven-off.md --> | accepted, 2026-08-12 |
| 0212 | An agent runtime occupies the model seat, amending ADR-0069's blocks (a) and (b). <!-- src: docs/adr/0212-exe-e-an-agent-runtime-occupies-the-model-seat-amending-adr-0069.md --> | accepted, 2026-08-12 |
| 0213 | The money ceiling is the credential itself, and no cap policy claims zero overshoot. <!-- src: docs/adr/0213-exe-f-the-money-ceiling-is-the-credential-and-no-cap-is-zero-overshoot.md --> | accepted, 2026-08-12 |
| 0214 | Inputs are owner-approved context packs that bound the data a dispatch may see, not the angle it may take. <!-- src: docs/adr/0214-exe-g-inputs-are-owner-approved-packs-that-bound-data-not-the-take.md --> | accepted, 2026-08-12 |
| 0215 | The dispatch trail is itself the artifact, and drafts are scanned for secrets the same way logs are. <!-- src: docs/adr/0215-exe-h-the-trail-is-the-artifact-and-drafts-are-scanned-like-logs.md --> | accepted, 2026-08-12 |
| 0216 | Tenure is enforced when the router loads, and every hire is planned to eventually expire. <!-- src: docs/adr/0216-exe-i-tenure-is-enforced-at-load-time-and-every-hire-is-planned-obsolescence.md --> | accepted, 2026-08-12 |
| 0217 | A hire is a receipt: the router row cites the decision that authorised it. <!-- src: docs/adr/0217-exe-j-a-hire-is-a-receipt-and-the-row-cites-the-decision-that-made-it.md --> | accepted, 2026-08-12 |
| 0218 | arc verifies the contractor's outcomes and never prescribes its internal process. <!-- src: docs/adr/0218-exe-k-arc-verifies-outcomes-and-never-prescribes-the-contractors-process.md --> | accepted, 2026-08-12 |
| 0219 | The data boundary is refused above the driver, and the driver's existing three-code exit map is untouched. <!-- src: docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md --> | accepted, 2026-08-12 |
| 0220 | The model is a per-invocation trial seam, kept separate from production routing; ruled out of this cycle's appetite even though it is numbered in engine's band. <!-- src: docs/adr/0220-the-model-is-a-per-invocation-trial-seam-separate-from-production-routing.md; initiatives/engine/PLAN.md --> | accepted, 2026-08-13 |
| 0221 | Runtime identity moves out of the model seat into its own field, because the vendor's usage-report flag does not reliably write. <!-- src: docs/adr/0221-the-runtime-identity-leaves-the-model-seat-and-the-usage-flag-does-not-reliably-write.md --> | accepted, 2026-08-16 |
| 0222 | Each dispatch gets a private copy of the runtime's home directory, because the runtime's built-in memory cannot be turned off. <!-- src: docs/adr/0222-a-dispatch-gets-a-private-copy-of-the-runtime-home-because-memory-cannot-be-turned-off.md --> | accepted, 2026-08-17 |
| 0223 | An empty tools list is a declaration of "nothing granted," not an absence of one; its clause 4 was later amended. <!-- src: docs/adr/0223-an-empty-tools-list-is-a-declaration-not-an-absence.md --> | accepted (clause 4 amended by ADR-0226), 2026-08-18 |
| 0224 | What a process declares in its tools list becomes the runtime's own toolset allowlist. <!-- src: docs/adr/0224-what-a-process-declares-becomes-the-runtimes-toolset-allowlist.md --> | accepted, amended 2026-08-19 |
| 0225 | Dispatch through `arc-run` — routed, an explicit `--driver`, or a fallback hop — requires a router row that grants the runtime; the driver's own shell script has no such gate and can still be run directly. <!-- src: docs/adr/0225-a-runtime-driver-is-unreachable-without-a-row-that-grants-it.md#THROUGH --> | accepted, 2026-08-23 |
| 0226 | The PR loop's attacker pass and its CI read become governed engine work rather than something the building session does ad hoc; amended once to drop the "new session per PR round" rule. <!-- src: docs/adr/0226-the-pr-loops-attacker-pass-and-ci-read-run-as-governed-engine-work.md; initiatives/engine/PROGRESS.md --> | proposed, 2026-09-23 |
| 0227 | The schema subset gains one nullable pair — a two-entry `type` list with `"null"` — and nothing else. <!-- src: docs/adr/0227-the-schema-subset-gains-one-nullable-pair-and-nothing-else.md --> | accepted, 2026-09-26 |

## Where it stands now

The lane's own tracker header reads `status: IDLE`, cycle `arc-engine (Cycle 7, opened 2026-08-12)`, `phase: 08 (cycle closed)`, `appetite: 12d`, `burn: 9.5d`, with nothing recorded as blocking and nothing recorded as a dependency. <!-- src: fact:lanes/engine.status; fact:lanes/engine.cycle; fact:lanes/engine.phase; fact:lanes/engine.appetite; fact:lanes/engine.burn; fact:lanes/engine.blocked-on; fact:lanes/engine.depends-on -->

Cycle 7 itself closed on 2026-08-24 with all six phases done and all eight requirements validated, at 9.5 of 12 days burned, about 79%. <!-- src: initiatives/engine/PROGRESS.md -->

The lane has not gone quiet since. Further work landed after the close, each change routed through `/arc-change` and charged to no cycle's appetite because Cycle 7 is closed. <!-- src: initiatives/engine/PROGRESS.md#Now -->

On 2026-09-15, `main` had been red since 2026-09-01 because the hired contractor's own route (`build-in-public-draft`, `review_by: 2026-08-31`) had expired exactly as ADR-0216 designs it to, and the fix repaired three tests and a `bench` probe that were reading the tenure clock rather than the thing each was meant to measure — without weakening the tenure gate itself, on the owner's ruling that the expired row stays deferred, neither renewed nor retired. <!-- src: initiatives/engine/PROGRESS.md -->

On 2026-09-23, the PR loop's own adversarial attacker pass and CI read became governed engine work under ADR-0226, merged as PR #265; the merged tree was verified 19/19 the next day, after the one red Windows-shard flake (unrelated to this PR) was re-run and passed. <!-- src: initiatives/engine/PROGRESS.md#GIT_FAILED; docs/adr/0226-the-pr-loops-attacker-pass-and-ci-read-run-as-governed-engine-work.md -->

On 2026-09-26, a bug surfaced in the `face` lane: a logic attack through the `generic-api` driver ran for about 1.5 hours with no result, because the driver ignored the run's own deadline and retried silently. The same PR also added ADR-0227's nullable-type schema pair for the nullable `twin_of` gap, which the same write-up records as found separately that day within the same out-of-cycle bug entry, and the fix is recorded still carrying six low-severity findings as open debt with a named pay-down trigger. <!-- src: initiatives/engine/PROGRESS.md#twin_of; docs/adr/0227-the-schema-subset-gains-one-nullable-pair-and-nothing-else.md; initiatives/engine/debt-ledger.md -->

What the cycle explicitly does not claim: fixture 5 has no real-container arm, fixture 9's proposal-receipt arm was never read off the spine for the real dispatches, a transcript cannot be joined to a receipt id by filename, and all three accepted-or-rejected drafts chose the same context-pack entry out of five, which three runs cannot explain. <!-- src: initiatives/engine/PROGRESS.md -->

## The bigger loop

Follow one dispatch of the hired contractor from pack to receipt, because it shows every piece working together. The owner approves a context pack — `pack-2026-08-23-cycle7`, marked `external-ok`, declaring in advance that three dispatches may be drawn from it. <!-- src: initiatives/engine/phases/phase-08-spec.md -->

Each dispatch runs inside a private copy of the runtime home rather than the shared template, so nothing the runtime "remembers" survives past that one run. <!-- src: docs/adr/0222-a-dispatch-gets-a-private-copy-of-the-runtime-home-because-memory-cannot-be-turned-off.md -->

The router row that names the runtime carries `cap: L1-drafts`, `hosted:`, `judge:` and `review_by:`, all checked when the router loads rather than only when the row is used. <!-- src: initiatives/engine/phases/phase-07-spec.md -->

The runtime produces a draft; the answer is scanned for secret-shaped text before it is stored, and a scrubbed transcript is kept alongside it. <!-- src: docs/adr/0215-exe-h-the-trail-is-the-artifact-and-drafts-are-scanned-like-logs.md -->

A `run.completed` receipt lands on the append-only spine, and the run is checked against `_quarantine/` as well as the normal event log, because an emitter exiting cleanly is not by itself evidence anything was written. <!-- src: initiatives/engine/PROGRESS.md -->

The owner then makes each verdict against the draft artifact itself, not a report about it, and records an accept or reject plus a one-line reason — never a line-edit. <!-- src: initiatives/engine/phases/phase-08-spec.md; docs/adr/0218-exe-k-arc-verifies-outcomes-and-never-prescribes-the-contractors-process.md -->

Nothing publishes itself; publishing stays a human copying the accepted text out. <!-- src: initiatives/engine/PLAN.md -->

### What went wrong and what was learned

Five pattern rows came out of the cycle-close retro, and they repeat a small number of shapes rather than describing five unrelated accidents. <!-- src: initiatives/engine/PROGRESS.md -->

`router.yaml`'s termination statement about pointing to hire a runtime was revised, and the revision was also mistaken; a certification transcript statement was also mistaken, though the transcript was stored and true. <!-- src: docs/retro-log.md#CORRECTION -->

`git log --all` was asked, and correctly treated an adjacent one; transcripts sat untracked on disk, unrecoverable attempts among them. <!-- src: docs/retro-log.md#ADJACENT -->

Tenure, `hosted`, runtime-grant and driver-set load only whenever auto is set — mandatory. <!-- src: docs/retro-log.md#runtime-grant -->

Agreed: `--transcript-dir --dry-run` consumed, turning a preview into a paid dispatch. <!-- src: docs/retro-log.md#AGREED -->

Underneath those retro rows sits a recurring class this cycle names for itself: a fix produced by an adversarial pass is itself unattacked code, and this cycle re-shipped the same already-fixed defect shape more than once inside a fix meant to close it. <!-- src: initiatives/engine/PROGRESS.md#UNATTACKED --> The cycle also recorded three named comments in its own code — B3, B6, A9 — that claimed more than the code actually held, each corrected to match what the code does. <!-- src: initiatives/engine/PROGRESS.md#B3 -->

A lesson recurred: the retro's `ARC_DRIVER_FAKE` returning before `produce` — a driver, without code executing; the fix: swap the response, never the path. <!-- src: initiatives/engine/PLAN.md#theater; docs/retro-log.md#ARC_DRIVER_FAKE -->

### How it connects to the rest of arc

`engine` requires the `core` and `hq` products underneath it and sits in the `kernel` ring. <!-- src: products/engine/manifest.json -->

The `bench` lane depends on the per-invocation model seam this cycle deliberately kept off its own clock (ADR-0220), and its own probe was hit by the September tenure-expiry incident: the probe borrows the first runnable process, `build-in-public-draft`, to ask whether a driver carries a model, and that process's expired route answered first — exit 1, an unrecognised verdict, `OperatorError` — instead of an answer about the driver. <!-- src: docs/adr/0220-the-model-is-a-per-invocation-trial-seam-separate-from-production-routing.md; initiatives/engine/PROGRESS.md#vehicle -->

The `absorb` lane's own judge grammar (ABS-D) was kept compatible with the accept/reject receipts this cycle writes, with the gap between them recorded as a one-line deferral rather than built here. <!-- src: docs/adr/0214-exe-g-inputs-are-owner-approved-packs-that-bound-data-not-the-take.md -->

The hired contractor's process row could not land on its own: POL-I's birth rule and `policy-lint` pulled in opposite directions, so the process file and its `hq.policy.yaml` grant had to land in the same change, and the owner pasted that row in himself because opening that deny so an agent could write its own hiring grant is exactly what POL-I exists to prevent. <!-- src: initiatives/engine/PROGRESS.md#ungrantable -->

The September driver-deadline bug surfaced from a logic attack in the `face` lane running through `generic-api`, one of the drivers listed among engine's own scripts. <!-- src: initiatives/engine/PROGRESS.md#twin_of; products/engine/manifest.json -->

Company-wide organs stayed untouched by this lane's own build: `docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md` and `tests/` stay root organs for every lane. <!-- src: initiatives/engine/PLAN.md#Do-not-touch -->

This lane's own scrubbed transcript per dispatch is stored at `initiatives/engine/evidence/phase-NN/` rather than the frozen `docs/evidence/**`. <!-- src: initiatives/engine/PLAN.md#phase-NN -->

## Glossary

- **process** — a job description: one YAML file naming its steps, the abstract tools it may touch, the required output shape, and its fixture references (`evals`); it names no model. <!-- src: docs/adr/0200-eng-a-a-process-is-one-yaml-file-with-a-schema-contract-and-its-own-semver.md -->
- **driver** — the code that knows how to call one worker — a CLI, an API, or (as of this cycle) an external agent runtime — behind one fixed interface. <!-- src: docs/adr/0203-eng-d-the-driver-interface-and-which-layer-owns-a-retry.md; docs/adr/0212-exe-e-an-agent-runtime-occupies-the-model-seat-amending-adr-0069.md -->
- **runtime** — an external agent (Hermes Agent, in this cycle) that occupies the model seat instead of a plain model call. <!-- src: docs/adr/0212-exe-e-an-agent-runtime-occupies-the-model-seat-amending-adr-0069.md; docs/adr/0208-exe-a-the-runtime-is-hermes-agent-pinned-and-container-backed.md -->
- **hire row** — a `router.yaml` row pointing at a runtime driver, carrying `cap`, `hosted`, `judge` and `review_by` together. <!-- src: docs/adr/0212-exe-e-an-agent-runtime-occupies-the-model-seat-amending-adr-0069.md; initiatives/engine/PLAN.md#REQ-07; initiatives/engine/phases/phase-07-spec.md -->
- **tenure** — the `review_by` date; past it, the row refuses to dispatch and asks to be re-justified or retired. <!-- src: docs/adr/0216-exe-i-tenure-is-enforced-at-load-time-and-every-hire-is-planned-obsolescence.md -->
- **context pack** — an owner-approved bundle of data a dispatch may see, bounding the data rather than the angle taken. <!-- src: docs/adr/0214-exe-g-inputs-are-owner-approved-packs-that-bound-data-not-the-take.md -->
- **certification** — a run of the isolation suite against the real runtime, human-started; a `regression` run against the mock driver can never be labelled this way. <!-- src: initiatives/engine/phases/phase-06-spec.md -->
- **capped key** — a provider credential whose spending ceiling is set, non-resetting, before it is issued. <!-- src: docs/adr/0213-exe-f-the-money-ceiling-is-the-credential-and-no-cap-is-zero-overshoot.md -->
- **data boundary** — the refusal, above the driver, of an internal-only input before the runtime process starts, and, specifically against a `hosted: cloud` row, at routing. <!-- src: docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md; initiatives/engine/phases/phase-06-spec.md; docs/adr/0212-exe-e-an-agent-runtime-occupies-the-model-seat-amending-adr-0069.md -->
- **appetite** — the time budget set for a phase or a cycle in this plan; each time it moved, it moved only by an explicit, written owner ruling. <!-- src: initiatives/engine/PLAN.md; initiatives/engine/PROGRESS.md -->
- **burn** — how much of the appetite has been used, measured in active days rather than a stopwatch. <!-- src: initiatives/engine/PROGRESS.md -->
- **STOP** — a named condition whose evaluation is itself recorded: the phase that carries one writes `STOP evaluated: fired` or `did not fire, because X` at its close, even when it does not fire. <!-- src: initiatives/engine/PLAN.md#evaluated -->
- **OUT-OF-CYCLE** — work routed through `/arc-change`, charged to no cycle's appetite once the cycle it touches has closed; a separate time estimate may still be reported at close for tracking, but that estimate is not a charge against any cycle's budget. <!-- src: initiatives/engine/PROGRESS.md#post-close; initiatives/engine/PLAN.md -->
- **lane** — a workstream with exactly one live plan, tracked in each lane's `PLAN.md`. <!-- src: CLAUDE.md -->
