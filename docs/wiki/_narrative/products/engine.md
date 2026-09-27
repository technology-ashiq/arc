<!-- facts: agents=4f53cda1 commands=82b4eb5f docs=4f53cda1 faceRing=0cfa9728 faceRoom=8f6f454b files=4f53cda1 requires=8ba3b34a scripts=43ee405f version=8e633b4f -->

## In plain words

engine is that dispatch office: one script, `arc-run.mjs`, that takes one piece of work, looks up who is supposed to do that kind of job, sends it out to them, checks the finished answer against the job's own description, and writes one permanent line saying who did it, why, and what it cost. <!-- src: engine/router.yaml; docs/adr/0200-eng-a-a-process-is-one-yaml-file-with-a-schema-contract-and-its-own-semver.md; docs/adr/0204-eng-e-escalation-terminates-in-a-proposal-receipt-never-a-tier-change.md; .claude/scripts/engine/arc-run.mjs#routedRow; .claude/scripts/engine/arc-run.mjs#processIsSelfConsistent; .claude/scripts/engine/arc-run.mjs#emitRun -->

### Why this needs to be a product at all

If only one worker ever did the work, nobody would need a dispatch office -- you would simply hand them everything. The office exists because the company wants to use many different workers: a cheap and fast one for mechanical jobs, an expensive and careful one for judgment calls, sometimes an outside contractor for a specialist task. <!-- plain -->

| What is lost | What it looks like | engine's answer |
|---|---|---|
| You stop knowing who did the work | A bad call is traced back weeks later and nobody can say which model made it | A run's receipt names the model, the driver, and `model_source` -- which decision picked it -- on an append-only log nobody edits; if the write itself fails, arc-run says so rather than pretending it landed <!-- src: .claude/scripts/engine/arc-run.mjs#emitRun; .claude/scripts/engine/arc-run.mjs#fault_hint; docs/adr/0217-exe-j-a-hire-is-a-receipt-and-the-row-cites-the-decision-that-made-it.md --> |
| You stop knowing who approved a routing change | Someone sets an environment variable and a cheap job quietly starts running on the expensive model | Routing lives in one hand-edited file, and nothing writes to it while a run is in progress <!-- src: engine/router.yaml --> |
| You stop knowing whether the answer is real | A model returns something well-shaped and wrong, and the pipeline accepts it | Every answer is validated against the job's own output schema, and the job ships with worked examples that must also pass, so a broken job description and a weak model fail differently <!-- src: .claude/scripts/engine/schema-subset.mjs; docs/adr/0200-eng-a-a-process-is-one-yaml-file-with-a-schema-contract-and-its-own-semver.md; docs/adr/0204-eng-e-escalation-terminates-in-a-proposal-receipt-never-a-tier-change.md; .claude/scripts/engine/arc-run.mjs#processIsSelfConsistent --> |

That third row is what lets engine say whether the job description was broken or the model was too weak for the seat, rather than only that the run failed: a schema failure is retried once, and the job's own worked examples are checked before any driver is blamed. <!-- src: .claude/scripts/engine/arc-run.mjs#processIsSelfConsistent; docs/adr/0204-eng-e-escalation-terminates-in-a-proposal-receipt-never-a-tier-change.md -->

## arc words → normal words

| arc calls it | It is really | Meaning |
|---|---|---|
| process | the job description | One YAML file naming the tools it may touch, the exact shape the finished answer must have, and its own version number. It never names a model. <!-- src: docs/adr/0200-eng-a-a-process-is-one-yaml-file-with-a-schema-contract-and-its-own-semver.md --> |
| class / router.yaml | the staffing rota | One hand-edited file saying which grade of worker handles which kind of job, changed only by a reviewed diff, never automatically. <!-- src: engine/router.yaml --> |
| driver | the phone line | The code that knows how to reach one kind of worker -- a local CLI, a plain HTTP call, a container. Five exist today. <!-- src: .claude/scripts/engine/drivers/common.mjs; .claude/scripts/engine/drivers/hermes.mjs; .claude/scripts/engine/arc-run.mjs#DRIVERS --> |
| tier | the pay grade | A description of how hard the work is, never a vendor's product name. Four are defined; one is deliberately empty. <!-- src: docs/adr/0069-balanced-model-policy.md --> |
| receipt / the spine | the logbook entry | An append-only record of who ran, which model, how long, and what it cost. Lines are added, never edited. <!-- src: .claude/scripts/engine/arc-run.mjs#duration_ms --> |
| hire row | the employment contract | A router row that points at an outside runtime (an agent runtime, not a model API), carrying four extra contract terms. <!-- src: .claude/scripts/engine/router-row.mjs --> |
| cap | what they may do | The ceiling a contractor may not pass. `L1-drafts` means propose only -- a human copies anything out. <!-- src: engine/router.yaml --> |
| review_by | contract end date | Past this date the row is expired, and dispatching through it is refused rather than silently renewed or disabled. <!-- src: docs/adr/0216-exe-i-tenure-is-enforced-at-load-time-and-every-hire-is-planned-obsolescence.md --> |
| trial | a one-off audition | Naming a model on the command line for one run only, without touching the router or the tier. <!-- src: docs/adr/0220-the-model-is-a-per-invocation-trial-seam-separate-from-production-routing.md --> |
| model_source | whose decision picked the model | One of `router`, `trial`, `runtime`, or `none` -- so a receipt is never mistaken for a routing decision it was not. <!-- src: .claude/scripts/engine/arc-run.mjs#seatFor; docs/adr/0221-the-runtime-identity-leaves-the-model-seat-and-the-usage-flag-does-not-reliably-write.md --> |

## How a job flows

Several checkpoints refuse a bad job before anyone spends anything. Only once they pass does the driver process get spawned -- and after that, the answer still has to be checked and written down. <!-- src: docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md; .claude/scripts/engine/arc-run.mjs -->

1. **Guards.** Is the request even sensible: a real process name, a work-root that exists and is not this repo itself, a budget that has not already run out. <!-- src: .claude/scripts/engine/arc-run.mjs#canonPath; .claude/scripts/engine/arc-run.mjs#aTop; .claude/scripts/engine/arc-run.mjs#msRemaining -->
2. **Route.** The process name is looked up as a class in `engine/router.yaml`, which resolves to a tier, a driver, and, where one applies, a pinned model. An unknown class exits non-zero naming the class and the file. <!-- src: engine/router.yaml; .claude/scripts/engine/arc-run.mjs -->
3. **Terms and boundary.** If the row is a hire, its four contract terms and its tenure are checked; then the input document itself is scanned for an internal-only marker, before any driver process exists. <!-- src: .claude/scripts/engine/router-row.mjs; .claude/scripts/engine/data-boundary.mjs#boundaryRefusal -->
4. **Dispatch.** The driver runs as its own subprocess, and the model reaches it down exactly one path -- the `ARC_DRIVER_MODEL` value `arc-run` sets on that subprocess's environment. <!-- src: .claude/scripts/engine/arc-run.mjs#ARC_DRIVER_COST_FILE; .claude/scripts/engine/drivers/common.mjs#pinnedModel -->
5. **Verify and receipt.** The answer is validated against the process's own output schema, and the verdict -- ok or a named failure -- is written to the spine as one `run.completed` line. <!-- src: .claude/scripts/engine/arc-run.mjs#duration_ms; docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md -->

Two exit spaces exist, and they are not the same numbers: a driver's own three-code contract, and `arc-run`'s wider table built on top of it. <!-- src: docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md -->

| Layer | Code | Meaning |
|---|---|---|
| driver | 0 / 1 / 2 | produced an answer, even a bad one / driver failure / declined for budget <!-- src: .claude/scripts/engine/drivers/common.mjs#EXIT --> |
| arc-run | 0 | the run produced an accepted answer <!-- src: docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md --> |
| arc-run | 1 | cannot proceed -- unknown process, unparseable router, unknown driver, or an expired hire row <!-- src: docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md; .claude/scripts/engine/arc-run.mjs#router-tenure --> |
| arc-run | 2 | operator error -- a bad flag, a malformed or duplicated budget key, or a contractor named with no row that grants it <!-- src: docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md; .claude/scripts/engine/arc-run.mjs#validateDriverSelection --> |
| arc-run | 3, 4 | unused and reserved, on purpose, so their absence reads as deliberate <!-- src: docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md --> |
| arc-run | 5 | the data boundary refused the input, before any driver process was spawned <!-- src: .claude/scripts/engine/data-boundary.mjs#EXIT_DATA_BOUNDARY --> |

## The stages, one by one

1. **Check the paperwork before anyone starts.** Is the destination a real folder, and does the budget leave anything to spend -- checked before any driver process exists, because a bad destination discovered after dispatch has already cost the run. A blank `--work-root` once aimed a driver holding `commit:*` at the arc repo itself, which is why this stage runs first. <!-- src: .claude/scripts/engine/arc-run.mjs#parseBudget; .claude/scripts/engine/arc-run.mjs#msRemaining -->
2. **Look up who does this kind of job.** The process name is looked up as a class in `engine/router.yaml`, resolving to a tier, a driver, and, where one applies, a pinned model. An unknown class exits non-zero naming the class and the file, because the fix is always to edit that file, never to guess harder. <!-- src: engine/router.yaml; .claude/scripts/engine/arc-run.mjs -->
3. **If the worker is a hired contractor, read the contract.** A hire row carries `cap`, `hosted`, `judge` and `review_by`, all four checked when the router loads rather than when the row is used. An expired row refuses the dispatch and raises one idempotent rejustify-or-retire proposal, rather than silently renewing or disabling itself. <!-- src: .claude/scripts/engine/router-row.mjs; docs/adr/0216-exe-i-tenure-is-enforced-at-load-time-and-every-hire-is-planned-obsolescence.md -->
4. **Check this work is allowed to leave the building.** The input document is scanned for an internal-only marker before any driver process is spawned; a document that carries one, or one that fails to positively declare itself shareable while routing to a capped row, is refused here, and the refusal names where the work was about to go. <!-- src: .claude/scripts/engine/data-boundary.mjs#boundaryRefusal; docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md -->
5. **Send the job out -- this is where money starts.** The driver runs as its own subprocess, and the model reaches it down exactly one path, the `ARC_DRIVER_MODEL` value `arc-run` sets. A driver that instead read an ordinary environment variable for its model would be performing an unreviewed pay-grade change. <!-- src: .claude/scripts/engine/arc-run.mjs#ARC_DRIVER_COST_FILE; .claude/scripts/engine/drivers/common.mjs#pinnedModel; docs/adr/0069-balanced-model-policy.md -->
6. **Check the finished work, and say whose fault it is.** The answer is validated against the process's own output schema. A schema failure is retried once on the same tier; if the job's own worked examples fail too, the fault is the process, and no driver is accused -- otherwise the fault is the worker. <!-- src: .claude/scripts/engine/arc-run.mjs#processIsSelfConsistent; docs/adr/0204-eng-e-escalation-terminates-in-a-proposal-receipt-never-a-tier-change.md -->
7. **Write it in the logbook.** One `run.completed` line, append-only and immutable once its day closes, naming the model, `model_source`, the driver, how long it took and what it cost. <!-- src: .claude/scripts/engine/arc-run.mjs#duration_ms; .claude/scripts/hq/lib/spine-io.mjs#immutable -->

## Every part, explained

### Commands

engine owns one command file directly: `/arc-attack`, the PR loop's adversarial pass, which runs two fresh attackers -- one on a diff's logic, one on its boundary -- through `arc-run` itself, so the attacker sees only the diff it is handed and nothing of the session that wrote it. <!-- src: products/engine/manifest.json; .claude/commands/arc-attack.md; docs/adr/0226-the-pr-loops-attacker-pass-and-ci-read-run-as-governed-engine-work.md -->

Three more commands are not engine's own, but engine writes them. `/arc-commit`, `/arc-review` and `/arc-kickoff` are GENERATED files, compiled byte-for-byte from a process file by `arc-compile.mjs`; a hand-edit to any of the three is deleted the next time it runs. <!-- src: .claude/commands/arc-commit.md; .claude/commands/arc-review.md; .claude/commands/arc-kickoff.md; .claude/scripts/engine/arc-compile.mjs; docs/adr/0201-eng-b-adapters-are-pure-functions-and-a-generated-file-is-never-hand-edited.md -->

### Agents

engine defines no agent of its own -- its manifest's agent list is empty. What it does own is the seat map every other product's agents are hired into: the four tiers `cheap-scan`, `balanced-workhorse`, `high-judgment` and `independent-family-verifier`, the last of which is defined and deliberately unoccupied. <!-- src: fact:products/engine.agents; docs/adr/0069-balanced-model-policy.md -->

### Processes

Naming a process here does not mean engine invented the job, only that `arc-run` is how it is dispatched. <!-- src: .claude/scripts/engine/arc-run.mjs -->

| Process | What it does | Baseline / origin |
|---|---|---|
| `adr-record` | Records one owner decision as an ADR at the lane's next free number, ending on a `note.logged` receipt | No prior command to reproduce; the byte-diff requirement is waived as a capability gap <!-- src: processes/adr-record.process.yaml --> |
| `attack-diff` | Adversarially attacks one surface, logic or boundary, of a diff with concrete breaking inputs, carrying the lane's already-fixed defect patterns | Waived the same way: the attacker never had a prior hand-run command to pin against <!-- src: processes/attack-diff.process.yaml --> |
| `brief-materialize` | Not a runnable job at all -- a policy-subject stub so a scheduled brief-rendering job has something to be authorized as; `arc-run` refuses it by name before selecting any driver | The real work runs elsewhere, through the scheduler <!-- src: processes/brief-materialize.process.yaml; docs/adr/0802-sch-jobs-authorize-as-process-subjects.md --> |
| `build-in-public-draft` | Drafts one build-in-public post from an owner-approved context pack, capped at a draft -- never a publication | Waived: no existing driver ran this class before, so there was nothing to measure against <!-- src: processes/build-in-public-draft.process.yaml --> |
| `commit-msg-draft` | Stages related changes and writes a conventional commit | Migrated byte-for-byte from `/arc-commit`, pinned by commit and sha256 <!-- src: processes/commit-msg-draft.process.yaml; docs/adr/0202-eng-c-the-byte-diff-is-a-migration-gate-and-retires-at-the-flip.md --> |
| `council-convene` | Convenes the full arc council on one question, headless, ending on a `council.verdict` receipt | Runs `/arc-council`'s own file at run time rather than reproducing it, so its drift check is a hash pin on that command instead of a byte-diff baseline <!-- src: processes/council-convene.process.yaml --> |
| `day-close-roll` | Also not a runnable job -- the policy-subject stub behind the scheduled job that seals every unsealed day, oldest first | The real work runs elsewhere, through the scheduler <!-- src: processes/day-close-roll.process.yaml; docs/adr/0805-sch-multi-day-roll-lives-in-the-job-not-the-cli.md --> |
| `develop-proof` | Proves the next unproven slice of a live lane from evidence already recorded -- a CI reading or a merged PR, never a test run on this box -- ending on a `slice.done` receipt | Waived: no single command proves one slice alone <!-- src: processes/develop-proof.process.yaml --> |
| `kickoff-plan` | Kicks off a new build: tiered depth, an agent panel, an evidence-based plan, risk-ordered phases and a tracker | Migrated from `/arc-kickoff`; the byte-for-byte migration proof was retired 2026-08-11 once the memory lane's additive recall step made the command no longer byte-identical <!-- src: processes/kickoff-plan.process.yaml#retired; docs/adr/0207-a-migration-proof-retires-when-its-file-first-legitimately-changes.md --> |
| `lesson-log` | Logs one lesson as a `docs/retro-log.md` row after a near-duplicate check, ending on a `note.logged` receipt | Waived: the nearest command, `/arc-retro`, is a whole retro with owner approvals, so there is nothing to reproduce byte for byte <!-- src: processes/lesson-log.process.yaml --> |
| `narrative-verify` | Judges every block of one drafted wiki narrative against the sources its own anchors name, and returns one verdict per block | Waived: no command or agent ever did this before this rule existed <!-- src: processes/narrative-verify.process.yaml; docs/adr/1513-doc-m-a-drafted-narrative-ships-only-source-anchored-and-verified.md --> |
| `review-diff` | Reviews the current branch's diff with the code-reviewer subagent, archiving findings | Migrated from `/arc-review`; that migration proof was retired once an unrelated lane's change made the command additive rather than byte-identical <!-- src: processes/review-diff.process.yaml; docs/adr/0207-a-migration-proof-retires-when-its-file-first-legitimately-changes.md --> |
| `rule-promote` | Proposes one rule for its permanent home as a branch, ending on the `approval.requested` it raises -- it proposes and never applies | Waived: the nearest command proposes many findings at once, with a person present <!-- src: processes/rule-promote.process.yaml --> |

### Scripts

- **The process layer.** `yaml-subset.mjs` parses a process file's frozen YAML subset, and `schema-subset.mjs` validates its output contract against a frozen eight-keyword JSON-Schema subset; `process-lint.mjs` checks a process file's structure at authoring time; `arc-compile.mjs` reads a canonical process and calls a pure adapter, `adapters/claude-code.mjs` or `adapters/codex.mjs`, to render the dialect file a person actually runs. <!-- src: .claude/scripts/engine/yaml-subset.mjs; .claude/scripts/engine/schema-subset.mjs; .claude/scripts/engine/process-lint.mjs; .claude/scripts/engine/arc-compile.mjs; .claude/scripts/engine/adapters/claude-code.mjs; .claude/scripts/engine/adapters/codex.mjs -->
- **The dispatcher itself.** `arc-run.mjs` runs any canonical process on any driver, headless; `router-row.mjs` is the four-term check a hire row must pass at load time; `data-boundary.mjs` is the one function that decides whether an input may leave the building; `calibrate-budget.mjs` derives a class's wall-clock budget from receipts already landed, never from a guess. <!-- src: .claude/scripts/engine/arc-run.mjs; .claude/scripts/engine/router-row.mjs; .claude/scripts/engine/data-boundary.mjs; .claude/scripts/engine/calibrate-budget.mjs -->
- **The five drivers.** One file per worker -- `drivers/claude-code.mjs`, `drivers/generic-api.mjs`, `drivers/codex.mjs`, `drivers/mock.mjs` and `drivers/hermes.mjs` -- each paired with a thin POSIX `.sh` wrapper, all built on the shared exit contract and cost-sidecar plumbing in `drivers/common.mjs`. <!-- src: .claude/scripts/engine/drivers/common.mjs; .claude/scripts/engine/drivers/claude-code.mjs; .claude/scripts/engine/drivers/generic-api.mjs; .claude/scripts/engine/drivers/codex.mjs; .claude/scripts/engine/drivers/mock.mjs; .claude/scripts/engine/drivers/hermes.mjs; docs/adr/0203-eng-d-the-driver-interface-and-which-layer-owns-a-retry.md -->
- **The hire's supporting tooling.** `type-tagged-hash.mjs` computes the hired container's pinned config hash from a named preimage; `cert-label.mjs` decides whether an isolation-suite run may be labelled a certification or only a regression; `egress-proxy.py` and `egress-session.sh` run the allowlisting proxy a hired runtime's network calls pass through. <!-- src: .claude/scripts/engine/type-tagged-hash.mjs; .claude/scripts/engine/cert-label.mjs; .claude/scripts/engine/egress-proxy.py; .claude/scripts/engine/egress-session.sh -->
- **The attacker.** `arc-attack.mjs` runs the two-surface pass `/arc-attack` calls, and `build-attack-input.mjs` assembles the `arc-run --input` document one surface receives, carrying the lane's fixed-defect patterns. <!-- src: .claude/scripts/engine/arc-attack.mjs; .claude/scripts/engine/build-attack-input.mjs; .claude/commands/arc-attack.md -->
- **The model market and the roster.** `arc-bench.mjs` is the bench lane's scoring substrate; `propose.mjs` proposes moving a class to another driver or tier, or retiring a hire, each as a reviewed diff rather than a run-time change; `agent-scaffold.mjs` adds a new agent to the roster on its own proposal branch, with its tier declared at birth. <!-- src: .claude/scripts/engine/arc-bench.mjs; .claude/scripts/engine/propose.mjs; .claude/scripts/engine/agent-scaffold.mjs -->
- `build-pack-input.mjs` builds the `build-in-public-draft` input from a context pack file, kept as its own script rather than an inline command because the pack carries apostrophes, and a program embedded in a shell string carries none. <!-- src: .claude/scripts/engine/build-pack-input.mjs -->

### Gates and rules

engine's own test suite sits under `tests/`: eighteen `.bats` files plus seven `-probe.mjs` companions and two scripts that hold a background attacker process to its clock. <!-- src: tests/engine-attack-diff.bats; tests/engine-cert-label.bats; tests/engine-compile.bats; tests/engine-data-boundary.bats; tests/engine-driver-contract.bats; tests/engine-egress-proxy.bats; tests/engine-emit-path.bats; tests/engine-hermes-contract.bats; tests/engine-hermes-egress.bats; tests/engine-hermes-secrets.bats; tests/engine-hermes-smoke.bats; tests/engine-hermes-toolsets.bats; tests/engine-hermes-workspace.bats; tests/engine-isolation-cert.bats; tests/engine-model-seam.bats; tests/engine-process-lint.bats; tests/engine-router-row.bats; tests/engine-usage-reader.bats; tests/engine-attack-probe.mjs; tests/engine-cert-label-probe.mjs; tests/engine-data-boundary-probe.mjs; tests/engine-hermes-probe.mjs; tests/engine-progress-line-probe.mjs; tests/engine-router-row-probe.mjs; tests/engine-usage-flag-probe.mjs; tests/engine-attack-watch.mjs; tests/engine-driver-deadline.mjs -->

- **The contract itself.** `engine-driver-contract.bats` checks that every driver honours the same exit-code contract; `bench-driver-contract.bats` checks that the mock driver alone satisfies that same contract, the one driver bench's own suite dispatches; the pure `engine-progress-line-probe.mjs` checks what one stream-mode progress line may say; `engine-process-lint.bats` and `engine-compile.bats` check that job descriptions are valid and that a generated command still matches the process it was compiled from. <!-- src: tests/engine-driver-contract.bats; tests/bench-driver-contract.bats; tests/engine-progress-line-probe.mjs; tests/engine-process-lint.bats; tests/engine-compile.bats -->
- **The hire's governance.** `engine-router-row.bats` plus its probe check that a hire row carries all four contract terms at load time, never at dispatch; `engine-data-boundary.bats` plus its probe check that internal-only material never reaches an outside worker; `engine-model-seam.bats` checks that the seat is a clean model id, that a trial model reaches the driver, and that a trial may not override a routed tier. <!-- src: tests/engine-router-row.bats; tests/engine-router-row-probe.mjs; tests/engine-data-boundary.bats; tests/engine-data-boundary-probe.mjs; tests/engine-model-seam.bats -->
- **The rest.** `engine-isolation-cert.bats` and `engine-cert-label.bats`, plus its probe, check that the label names what kind of run happened -- never whether it passed -- and stays in step with the certification suite; `engine-egress-proxy.bats`, plus its probe, checks that the allowlisting proxy's parser rejects a wildcard or a bare hostname entry, and refuses outright to start on an empty allowlist; `engine-emit-path.bats` checks that a logbook line lands where it claims, and `engine-usage-reader.bats`, plus its probe, checks that a usage figure is read rather than estimated; `engine-attack-diff.bats`, plus its probe and its watch script, check the attacker pass itself. <!-- src: tests/engine-isolation-cert.bats; tests/engine-cert-label.bats; tests/engine-cert-label-probe.mjs; tests/engine-egress-proxy.bats; tests/fixtures/engine/hermes/egress-proxy-probe.py; tests/engine-emit-path.bats; tests/engine-usage-reader.bats; tests/engine-usage-flag-probe.mjs; tests/engine-attack-diff.bats; tests/engine-attack-probe.mjs; tests/engine-attack-watch.mjs -->

One more rule guards every script in this directory rather than one gate alone: a program embedded in a shell string may carry no apostrophe, checked by its own guard test. <!-- src: tests/embedded-program-guard.bats -->

Underneath the gates above sits one rule none of them states by name: no system component may change its own or another seat's model tier at runtime, and every production tier change is a reviewed diff citing this policy. <!-- src: docs/adr/0069-balanced-model-policy.md -->

## The bigger loop

### Life of a worker

Think of it like bringing in an outside contractor: a trial task first, then a contract with an end date, then either renewal or letting them go. <!-- plain -->

Terminating a hire is two acts, in this order: revoke the credential at the provider first, since a disabled row with a live key still spends if anything else reaches the runtime; delete the row second, because deleting is the only form with no reachable remainder. <!-- src: engine/router.yaml -->

That second step was measured false once. A row's own comment said naming an uninstalled driver would make the router refuse to load; measured, the router loaded fine, and only a separate, narrower check refused it, and only on one command-line path. A hired runtime is now unreachable unless a router row explicitly names that driver, checked the same way a class's own driver is checked. <!-- src: engine/router.yaml; docs/adr/0225-a-runtime-driver-is-unreachable-without-a-row-that-grants-it.md; .claude/scripts/engine/arc-run.mjs#validateDriverSelection -->

The one hire this lane made was measured working before its cycle closed: three owner-approved dispatches, three `run.completed` receipts, zero quarantined, one attempt each, 35.8 to 40.7 seconds -- two drafts accepted, one rejected, one line of reason each. <!-- src: initiatives/engine/PROGRESS.md -->

What that cycle does not claim is kept on the record rather than smoothed away: one certification fixture has no real-container arm; another fixture's proposal-receipt arm was never actually read off the spine for the real dispatches; a stored transcript cannot be joined to a receipt id by filename; and all three drafts chose the same pack entry out of five, which three runs cannot explain. <!-- src: initiatives/engine/PROGRESS.md -->

### Trying a new model without hiring it

Handing one real job to a brand-new model, just to see how it does, has to be cheap and easy -- or nobody ever tries one. <!-- plain -->

`--trial-model` names a model for one invocation only. It writes no router row, changes no tier, and the receipt records `model_source: trial` instead of `router`, so it can never be read back as a routing decision. <!-- src: docs/adr/0220-the-model-is-a-per-invocation-trial-seam-separate-from-production-routing.md; .claude/scripts/engine/arc-run.mjs -->

| | Normal run | Trial run |
|---|---|---|
| Who picks the model | the rota | the caller, on the command line <!-- src: .claude/scripts/engine/arc-run.mjs --> |
| Rota file touched | read | read, never written <!-- src: engine/router.yaml --> |
| Logbook says | `model_source: router` | `model_source: trial` <!-- src: .claude/scripts/engine/arc-run.mjs#seatFor --> |
| Works with `--driver auto` | yes | refused -- a trial may not silently override a reviewed routing decision <!-- src: .claude/scripts/engine/arc-run.mjs --> |
| Works on every driver | -- | refused on `codex` and `mock`: `codex` reads a pinned model but never sends it -- it invokes the CLI without it -- and `mock` reaches no provider, so neither can honestly carry a stamped model <!-- src: .claude/scripts/engine/drivers/codex.mjs; .claude/scripts/engine/drivers/mock.mjs; .claude/scripts/engine/arc-run.mjs#MODEL_CAPABLE --> |

```
# a trial, end to end -- nothing in the repo changes
ARC_LLM_ENDPOINT=https://integrate.api.nvidia.com/v1/chat/completions \
ARC_LLM_API_KEY=... \
node .claude/scripts/engine/arc-run.mjs \
  --process commit-msg-draft \
  --driver generic-api \
  --trial-model z-ai/glm-5.3-flash
```

### How it connects to the rest of arc

Several other rooms dispatch through engine too: the council convenes through `council-convene`; a lesson, a rule, an ADR, and a slice's proof each go through their own one-click process from the memory, strategy and develop rooms; and the PR loop's attacker pass goes through `attack-diff`. <!-- src: processes/council-convene.process.yaml; processes/lesson-log.process.yaml; processes/rule-promote.process.yaml; processes/adr-record.process.yaml; processes/develop-proof.process.yaml; processes/attack-diff.process.yaml; .claude/commands/arc-attack.md -->

engine's own face room, `engine-room`, sits in the kernel ring: five stations -- certification, dispatch, hire cards, hire line, router table -- and five concepts on the wall -- capped key, cert suite, context pack, router row, unlock ladder. <!-- src: products/engine/manifest.json -->

## Glossary

| Term | Meaning |
|---|---|
| process | One YAML job description; never names a model. <!-- src: docs/adr/0200-eng-a-a-process-is-one-yaml-file-with-a-schema-contract-and-its-own-semver.md --> |
| class | The name a process goes by on the router -- the same string, `processName`, used to look up its row in `engine/router.yaml`'s `classes`. <!-- src: .claude/scripts/engine/arc-run.mjs#routedRow --> |
| tier | A pay grade describing how hard the work is, provider-neutral by construction. <!-- src: docs/adr/0069-balanced-model-policy.md --> |
| driver | The code, behind one shared interface, that reaches one kind of worker -- a local CLI, an HTTP endpoint, or a container. <!-- src: docs/adr/0203-eng-d-the-driver-interface-and-which-layer-owns-a-retry.md; .claude/scripts/engine/drivers/hermes.mjs --> |
| pin | The specific model the router chose for this run. <!-- src: engine/router.yaml --> |
| trial | A model named on the command line for one run only, writing no router row. <!-- src: docs/adr/0220-the-model-is-a-per-invocation-trial-seam-separate-from-production-routing.md --> |
| model_source | `router`, `trial`, `runtime` or `none` -- the field that keeps a test from ever being mistaken for a decision. <!-- src: .claude/scripts/engine/arc-run.mjs#seatFor; docs/adr/0221-the-runtime-identity-leaves-the-model-seat-and-the-usage-flag-does-not-reliably-write.md --> |
| receipt / the spine | The append-only logbook; lines are added, never edited. <!-- src: .claude/scripts/engine/arc-run.mjs#emitRun --> |
| hire row | A router row pointing at an outside runtime, carrying four extra contract terms. <!-- src: .claude/scripts/engine/router-row.mjs --> |
| tenure | The `review_by` date; past it the row refuses and asks to be re-justified or retired. <!-- src: docs/adr/0216-exe-i-tenure-is-enforced-at-load-time-and-every-hire-is-planned-obsolescence.md --> |
| cap | The ceiling on what a contractor may do; `L1-drafts` means propose only. <!-- src: engine/router.yaml --> |
| data boundary | The check that internal-only material never routes to an outside worker. <!-- src: .claude/scripts/engine/data-boundary.mjs#boundaryRefusal --> |
| fixture / eval | A worked example checked against the process's own schema, used to tell a broken process apart from a weak model. <!-- src: docs/adr/0200-eng-a-a-process-is-one-yaml-file-with-a-schema-contract-and-its-own-semver.md; docs/adr/0204-eng-e-escalation-terminates-in-a-proposal-receipt-never-a-tier-change.md; .claude/scripts/engine/arc-run.mjs#processIsSelfConsistent --> |
| job stub | A process file that exists only to be a policy subject; `arc-run` refuses to dispatch it. <!-- src: .claude/scripts/engine/arc-run.mjs; docs/adr/0802-sch-jobs-authorize-as-process-subjects.md --> |
| baseline waiver | A process's recorded reason for carrying no baseline pin -- `capability-gap` when no existing driver runs this class, so there is nothing to measure against. <!-- src: processes/build-in-public-draft.process.yaml; docs/adr/0202-eng-c-the-byte-diff-is-a-migration-gate-and-retires-at-the-flip.md --> |
