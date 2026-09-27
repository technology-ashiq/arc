<!-- facts: agents=4f53cda1 commands=4f53cda1 docs=4f53cda1 faceRing=0cfa9728 faceRoom=a9aa5465 files=4f53cda1 requires=8ba3b34a scripts=0f87ee60 version=39fe4a40 -->

## In plain words

Picture a workshop that never assumes a new idea is better just because it sounds better: it tries the idea alongside the old way, on a small slice of real use, counts what actually happens to both, and only keeps the new way once the count clearly says so. <!-- plain -->

**evolve is arc's self-improvement engine** — the machinery that runs a controlled experiment on one of arc's own surfaces, decides whether the challenger really beat the champion, and proposes the change for a human to merge. <!-- src: initiatives/evolve/PROGRESS.md; .claude/scripts/evolve/verdict.mjs#decide; ADR-0306; .claude/scripts/evolve/lineage.mjs#buildProposal; ADR-0305 -->

The cycle that built it was literally named "The Self-Improvement Engine". <!-- src: initiatives/evolve/PROGRESS.md -->

evolve requires `core` (for the `evolve` manifest contract a module must satisfy before it can be experimented on — declaring the section at all is optional, but a declared one is checked key by key and closed to unknown keys) and `hq` (for the spine — arc's append-only receipt log — that every experiment reads and writes through). <!-- src: products/evolve/manifest.json; .claude/scripts/core/evolve-manifest.mjs#checkEvolveSection; ADR-0301; .claude/scripts/hq/spine.mjs#ADR-0030; .claude/scripts/hq/arc-event.mjs#writer -->

It declares no `/arc-*` commands and no named agents of its own — its own scripts call it "the library", and `arc-evolve` is the command-line tool that runs it, not a slash command you type. <!-- src: products/evolve/manifest.json; .claude/scripts/evolve/wire.mjs; .claude/scripts/evolve/arc-evolve.mjs -->

### Why this needs to be a product at all

Without a rule for how a decision gets made, "did this change help?" is one person's impression of a chart. evolve exists to replace that impression with one pinned statistical test, computed at most once per experiment, from receipts on a spine nobody can quietly edit. <!-- src: .claude/scripts/evolve/verdict.mjs#decide; ADR-0306; ADR-0029 -->

A verdict only exists when the lower bound of the improvement clears a declared floor **and** the point delta reaches the minimum detectable effect **and** both arms have enough units **and** no guardrail is breached **and** there are zero cohort violations **and** no measurement window is still missing — every one of those, not some of them. <!-- src: .claude/scripts/evolve/verdict.mjs#decideInner; ADR-0306 -->

That "all of them, not some of them" design is deliberate: a pass condition defined only as an absence of problems lets characterless, unproven work through, and evolve's verdict gate is written to fail for insufficiency, not merely for rule-breaking. <!-- src: ADR-0306 -->

The second reason evolve has to be its own product, with its own heavy rules, is that **the machine itself is never allowed to apply the change it decides on.** Promoting a winning challenger, and rolling back a champion that later degrades, both end at the same place: a proposal in a human's inbox. <!-- src: .claude/scripts/evolve/lineage.mjs; ADR-0305 -->

That rule has no carve-out even for an emergency rollback, because after a promotion a human may have hand-edited the file — a machine holding an old patch and applying it anyway would silently destroy that edit. <!-- src: ADR-0305 -->

## arc words → normal words

| arc calls it | It is really | Meaning |
|---|---|---|
| `module` | a product opting in | A product whose `manifest.json` carries a valid `evolve` section — metrics, experiments, evals and an allowlist of files it may change. Without one, an experiment on it is refused by name. <!-- src: .claude/scripts/evolve/wire.mjs#moduleFor; ADR-0301 --> |
| `surface` | the one thing being tested | A slug the module declares, pointing at one target file. <!-- src: .claude/scripts/evolve/wire.mjs#planOpen; ADR-0301 --> |
| `experiment` | the trial itself | Exactly two arms compared on one surface — never one, never three. <!-- src: .claude/scripts/evolve/wire.mjs#planOpen; ADR-0306 --> |
| `arm` | one version being tried | A tag like `+champion` or `+challenger-a`, declared in a fixed order when the experiment opens. <!-- src: .claude/scripts/evolve/assign.mjs#armFor; ADR-0303 --> |
| champion / challenger | the incumbent and the candidate | The verdict math compares "arm 2, the challenger" against "arm 1, the champion" — the difference is always challenger minus champion. <!-- src: .claude/scripts/evolve/verdict.mjs#newcombeWilsonDifference --> |
| `cohort` | which half a unit is in | Every unit is also split, separately from its arm, into a `generation` cohort (exploratory) and a `verdict` cohort (the one the decision is computed from), 50:50 by default. <!-- src: .claude/scripts/evolve/assign.mjs#COHORTS; ADR-0310 --> |
| `base_sha` / seal | the sealed starting point | The sha256 of the target file's bytes at the moment the experiment opened — if the file moves underneath a live experiment, its measurements can no longer be attributed to either side of the change. <!-- src: .claude/scripts/evolve/assign.mjs#sealBroken --> |
| `per_arm_floor` | the minimum sample size | How many units an arm needs before its evidence counts at all; below it, the board prints each under-floor arm's own count against the floor as `insufficient evidence`. <!-- src: .claude/scripts/evolve/board.mjs#insufficient --> |
| `MISSING` | honestly nothing measured yet | A window with no measurement for an arm is rendered as `MISSING`, never summed or treated as a zero. <!-- src: .claude/scripts/evolve/board.mjs -->  |
| verdict / no-verdict | the one-time answer | The outcome of the pinned test, computed once and recorded either way — even a computed "no" is final and written down, so the test can never be quietly re-run until it wins. <!-- src: .claude/scripts/evolve/wire.mjs#planConclude; ADR-0306 --> |
| propose-only | the machine never writes | Both directions — a promotion and a revert — become one `promotion.proposed` receipt, its `kind` field naming which, for a human to act on; there is no code path anywhere in evolve that writes a canonical file. <!-- src: ADR-0304; .claude/scripts/evolve/lineage.mjs#buildProposal; ADR-0305 --> |
| `config_hash` / `metric_hash` | the receipt for what was measured | Hashes of every input the verdict depends on and of the exact measurements it was computed from, so a replay that disagrees is a detectable defect rather than a difference of opinion. <!-- src: .claude/scripts/evolve/verdict.mjs#configHash; .claude/scripts/evolve/verdict.mjs#metricHash --> |

## How a job flows

An experiment's life runs through **open**, **measure** and **conclude**: open it against a sealed target, measure it as many times as real observations come in, and conclude it once — which either records a verdict or a final no-verdict. A change riding that experiment then follows its own SHA-bound chain, **opened → proposed → promoted → watch**: propose is bound to the same sealed `base_sha` the experiment opened against, a human then merges the proposal, and the watch keeps confirming what is actually served. <!-- src: .claude/scripts/evolve/wire.mjs#planOpen; docs/strategy/plans/PLAN-evolve.md; .claude/scripts/evolve/lineage.mjs; .claude/scripts/evolve/lineage.mjs#mayWatch -->

Every one of `open`, `measure` and `conclude` runs in two passes on the command line: without `--expect` it only plans and prints a digest of exactly what it would write; run again with `--expect <that digest>`, it re-derives everything from the spine as it stands right now, and writes only if the digest still matches — otherwise it refuses as stale and writes nothing. <!-- src: .claude/scripts/evolve/arc-evolve.mjs -->

That two-step exists because a plan can be read by a person and then applied minutes later, and in between the spine can move — so the write always re-checks the world it is about to write into, never trusts what it read the first time. <!-- src: ADR-1340 -->

## The stages, one by one

2. **Measure.** Each call reports one unit's value for one metric over one dated window, with at least one real observation. The CLI computes which arm and cohort that unit belongs to as a pure hash of the experiment id and the unit id — never a coin flip and never a counter — and if a receipt already recorded that unit under a different arm or cohort, the new measurement is refused rather than silently overwriting it. Measuring is refused outright on a closed, already-verdicted, expired, or seal-broken experiment. <!-- src: .claude/scripts/evolve/wire.mjs#planMeasure; .claude/scripts/evolve/assign.mjs#armFor -->

3. **Conclude.** The module must declare exactly one metric with the primary role and a direction of `higher-is-better` or `lower-is-better`, and the module's own alpha must be one the pinned test has a quantile for (only `0.05`, in v1). Every unit's measurement is re-placed by `assign()`, the function that placed it, and a unit whose recorded arm or cohort disagrees with that placement blocks the conclusion outright. The test then runs once, direction-adjusted, over the verdict cohort's complete windows only. A test that was fully computable and did not clear the bar is written down as a final `no-verdict`; a test that cannot be computed yet (below floor, a window still missing, a violation) writes nothing at all. <!-- src: .claude/scripts/evolve/wire.mjs#NO_PRIMARY; .claude/scripts/evolve/verdict.mjs#zFor; ADR-0306 -->

4. **Propose.** Generating a diff first requires a live "ticket": the seal must still match the target's current bytes, and the destination file must be on the module's declared allowlist of files it is even permitted to touch. The proposal's id is a hash of every field that says what it does, so a field cannot be edited after the id was minted without the mismatch being caught later. <!-- src: .claude/scripts/evolve/lineage.mjs#mayPropose; ADR-0301 -->

5. **Promote.** A human merges the proposal, or does not. An `experiment.promoted` receipt may only be written if the bytes actually observed in the merged file equal the proposal's own candidate digest — a merge of the wrong bytes is refused, not recorded as a success. <!-- src: .claude/scripts/evolve/lineage.mjs#mayRecordPromotion -->

6. **Watch.** The watch keeps checking that what is actually being served still matches what was promoted. If the file drifts to something else entirely, evolve does not generate a patch — an unexplained change gets a "manual intervention required" incident, not a machine guess. If instead the promoted arm's own performance degrades below evolve's own observation floor, the surface is frozen and, only when a real archived champion and a real revert patch both exist, a revert is proposed — never applied. <!-- src: .claude/scripts/evolve/lineage.mjs#onPostPromotionDrift; .claude/scripts/evolve/lineage.mjs#onDegradation; ADR-0305 -->

## Every part, explained

### Commands

evolve's manifest declares an empty commands list — there is no `/arc-*` slash command that belongs to this product. <!-- src: products/evolve/manifest.json -->

### Agents

evolve's manifest declares an empty agents list — no named subagent is registered to this product. <!-- src: products/evolve/manifest.json -->

### Processes

Product manifests have no field for declaring a process at all — the closed list of manifest keys never included one — so this is not something evolve's manifest could state either way. <!-- src: .claude/scripts/core/product-lint.mjs#KNOWN_FIELDS -->

### Scripts

- `arc-evolve.mjs` is the command-line entry point: `arc-evolve board`, `open`, `measure` and `conclude`. It parses flags strictly (an unknown flag, a repeated flag, or a value that looks like another flag is refused outright) and locates every module that declares a valid `evolve` section; `open`, `measure` and `conclude` run the plan/apply pattern described above, while `board` instead renders the read-only board. <!-- src: .claude/scripts/evolve/arc-evolve.mjs#main; .claude/scripts/evolve/arc-evolve.mjs#declaredModules; .claude/scripts/evolve/arc-evolve.mjs#parseFlags -->
- `assign.mjs` computes which arm and which cohort a unit belongs to, purely as a hash of the experiment id and unit id — never a random draw, a counter, or the clock — and also checks the concurrency cap, the canonical seal, and whether an experiment has outlived its TTL. <!-- src: .claude/scripts/evolve/assign.mjs#armFor; .claude/scripts/evolve/assign.mjs#concurrencyRefusal; .claude/scripts/evolve/assign.mjs#sealBroken; .claude/scripts/evolve/assign.mjs#ttlExpired -->
- `board.mjs` is the reader: it folds every receipt on the spine into the honest status of every experiment, admitting only receipts whose envelope and payload re-pass the same grammar the emitter checked, and rendering absent data as `MISSING` rather than as zero. <!-- src: .claude/scripts/evolve/board.mjs; ADR-0030 -->
- `canon.mjs` is the one shared encoder every hash in this product goes through — it refuses to encode values (like `NaN` or `-Infinity`) that would otherwise collide with a different, meaningful value under a naive encoding. <!-- src: .claude/scripts/evolve/canon.mjs -->
- `verdict.mjs` holds the one pinned statistical test, `newcombe-wilson-difference-v1`, plus the gate function that decides whether a verdict exists at all, plus the config and metric hashes a verdict receipt carries. <!-- src: .claude/scripts/evolve/verdict.mjs; ADR-0306 -->
- `lineage.mjs` is the four-hop chain from an opened experiment to a served promotion — open's seal, the proposal, the human's merge, and the watch — and the propose-only boundary that keeps every hop a proposal rather than a write. <!-- src: .claude/scripts/evolve/lineage.mjs; ADR-0305 -->
- `calibrate.mjs` measures whether the council's own stated confidence (High, Medium or Low) actually matches how often its calls turned out right, from receipts rather than from session notes, and reports "insufficient evidence" below a minimum number of scored sessions rather than a precise-looking number that means nothing. <!-- src: .claude/scripts/evolve/calibrate.mjs -->
- `wire.mjs` turns the module manifests and spine receipts handed to it into the `open`, `measure` and `conclude` receipt payloads `arc-evolve` emits, or a refusal that says why. It is pure — none of its functions writes, spawns or reads a file itself; `arc-evolve.mjs` does the actual reading, and `arc-event` judges and writes. <!-- src: .claude/scripts/evolve/wire.mjs -->

### Gates and rules

- `tests/evolve-contract.bats` guards the `evolve` manifest section itself — the same strict field-closing lint every product manifest goes through. <!-- src: tests/evolve-contract.bats; ADR-0301 -->
- `tests/evolve-receipts.bats` guards the eight experiment receipt kinds, asserting that a receipt actually lands on the spine rather than trusting an emitter's exit code. <!-- src: tests/evolve-receipts.bats; ADR-0304 -->
- `tests/evolve-board.bats` guards the reader: every fixture is emitted through the real emitter into a throwaway spine, so a receipt the validators would refuse can never quietly become board input. <!-- src: tests/evolve-board.bats -->
- `tests/evolve-runner.bats` and `tests/evolve-gate.bats` guard deterministic assignment, the canonical seal, TTL and concurrency, and the verdict gate — the fifteen breaks a fresh, unanchored agent found in this layer. <!-- src: tests/evolve-runner.bats; tests/evolve-gate.bats -->
- `tests/evolve-verdict.bats` holds the pinned test to a published worked example, with reference vectors that were derived independently, twice, before the implementation existed. <!-- src: tests/evolve-verdict.bats; ADR-0311 -->
- `tests/evolve-lineage.bats` asserts the propose-only rule by parsing `lineage.mjs`'s own import specifiers for a filesystem or process import, rather than merely grepping for one, because every hop has a negative control. <!-- src: tests/evolve-lineage.bats; ADR-0305 -->
- `tests/evolve-calibrate.bats` guards council calibration — above all, that an `unresolved` outcome is excluded rather than scored as a miss. <!-- src: tests/evolve-calibrate.bats; ADR-0307 -->
- The spine's event vocabulary is closed, so evolve's eight experiment kinds and its `council.outcome` kind each had to be added to it by their own ADR rather than as a free-form field. <!-- src: ADR-0026; ADR-0309; ADR-0310 -->

The face app's kernel-ring room for this product is named `evolve`, with two stations named `arms` and `board`, and it lists twelve event kinds it draws from. <!-- src: products/evolve/manifest.json -->

Today that room carries the badge "fixture-proven, unexercised" — the same words the cycle closed on. <!-- src: products/evolve/manifest.json; initiatives/evolve/PROGRESS.md -->

## The bigger loop

### An engine built before it had anything to run

evolve's five phases were all closed on 2026-08-04, and the cycle's own badge reads "fixture-proven, unexercised". <!-- src: initiatives/evolve/PROGRESS.md; products/evolve/manifest.json -->

That is not an oversight; it is a recorded, deliberate decision. arc's own rule says a self-improvement engine like this should sleep until a real venture has four or more weeks of real outcome receipts on the spine — and at kickoff, every one of those conditions was verified unmet: no client module existed, and the very event kind the trigger depends on was not even in the spine's closed vocabulary yet, so those four weeks were not merely absent, they were technically impossible to accumulate. <!-- src: ADR-0300 -->

The owner was shown that evidence in full and directed the build forward anyway, twice, so the cycle proceeded on fixtures with the client feed declared as an absent dependency rather than faked — building a synthetic feed was explicitly rejected, because manufacturing data would corrupt the exact rule ("absent is `MISSING`, never zero") the whole engine exists to protect. <!-- src: ADR-0300 -->

Across those five phases, five separate fresh, unanchored agents attacking each layer in turn found fifty-eight real breaks in code that had already passed every test its own author wrote — in-band separators inside hash preimages, a refusal that returned `null` and was read as "not expired", a gate that threw an exception instead of returning a refusal, and a validator that checked one read of a value and then compared a second, different read of the same value. <!-- src: initiatives/evolve/PROGRESS.md -->

One of those breaks was in the verdict math itself: both independently-derived reference vectors paired the statistical test's terms for the wrong side of the subtraction, so every lower bound on an uneven pair of arms came out too high, and the corrected formula was only found once a fresh attacker made the code actually emit a verdict for the first time. <!-- src: ADR-0311 -->

Because the client feed never arrived inside this cycle's scope, no real experiment has ever been opened on a real arc surface — the cycle's own record states that its north-star claim closes as fixture-proven, unexercised, the same standard an earlier lane's own partial claim had already set as precedent. <!-- src: initiatives/evolve/PROGRESS.md; ADR-0300 -->

### How it connects to the rest of arc

evolve requires `core` and `hq`: the manifest contract that decides whether a module may be experimented on lives in `core`, precisely so that `core` never has to import anything from `evolve` itself. <!-- src: products/evolve/manifest.json; .claude/scripts/core/evolve-manifest.mjs#sync-to-project -->

`leads` is recorded as evolve's first client — it ships the `metric.observed` vocabulary evolve's trigger depends on, but not evolve's clock, because that client cycle was itself blocked from emitting any real campaign metric. <!-- src: ADR-0408 -->

`absorb` deliberately does not route its own A/B tests through evolve's experiment machinery in its first version — running them bench-style instead, specifically so that exercising an unproven engine for the first time does not become absorb's problem. <!-- src: ADR-0605 -->

face's kernel ring is what actually wires evolve's `open`, `measure` and `conclude` to the spine and the module manifests through a real command line. Before that wiring, `measure` and `conclude` existed only as library functions (`assign.mjs`, `verdict.mjs`'s `decide`), with no CLI connecting them to the spine or the module manifests. <!-- src: ADR-1340 -->

## Glossary

- **module** — a product that declares a valid `evolve` section in its `manifest.json`. <!-- src: ADR-0301 -->
- **surface** — the one slug, and one target file, that a module has opened up to experiments. <!-- src: .claude/scripts/evolve/wire.mjs#planOpen -->
- **experiment** — a two-arm trial on one surface, identified by an `x-` id. <!-- src: .claude/scripts/evolve/wire.mjs#planOpen -->
- **arm** — one of the two variants, tagged with a leading `+`. <!-- src: .claude/scripts/evolve/assign.mjs#armFor; .claude/scripts/evolve/wire.mjs#ARM_RE; .claude/scripts/evolve/wire.mjs#NOT_TWO_ARMS -->
- **champion / challenger** — the first-declared arm and the second; the verdict is always challenger minus champion, direction-adjusted. <!-- src: .claude/scripts/evolve/verdict.mjs#newcombeWilsonDifference; ADR-0306 -->
- **cohort** — `generation` (exploratory) or `verdict` (the one the decision counts), assigned independently of the arm. <!-- src: .claude/scripts/evolve/assign.mjs#COHORTS; ADR-0310 -->
- **seal / base_sha** — the sha256 of the target file's bytes at the moment the experiment opened. <!-- src: .claude/scripts/evolve/assign.mjs#sealBroken -->
- **per-arm floor** — the minimum number of units an arm needs before its evidence is counted at all. <!-- src: .claude/scripts/evolve/board.mjs; ADR-0301 -->
- **MISSING** — a window nobody measured; never rendered as, or folded into, a zero. <!-- src: .claude/scripts/evolve/board.mjs -->
- **verdict / no-verdict** — the one-time, final outcome of the pinned statistical test. <!-- src: .claude/scripts/evolve/wire.mjs#planConclude; ADR-0306 -->
- **propose-only** — the rule that the machine never writes a canonical file, in either direction: only a human merge does. <!-- src: .claude/scripts/evolve/lineage.mjs; ADR-0305 -->
- **hop** — one of the four links in the promotion chain: opened, proposed, promoted, watch. <!-- src: .claude/scripts/evolve/lineage.mjs -->
- **config hash / metric hash** — the two digests a verdict receipt carries, binding what it was computed from. <!-- src: .claude/scripts/evolve/verdict.mjs#configHash -->
- **calibration** — scoring whether the council's own stated confidence actually predicted its outcomes. <!-- src: .claude/scripts/evolve/calibrate.mjs -->
