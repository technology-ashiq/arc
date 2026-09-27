<!-- facts: agents=11fa07ca commands=985b1f2d docs=4f53cda1 faceRing=785b1405 faceRoom=26771559 files=55f9cf64 requires=8ba3b34a scripts=39a1d961 version=8e633b4f -->

## In plain words

Picture a construction crew handed an approved blueprint. They do not pour the whole building in one go and hope it holds. They finish one room, call in an inspector to sign off that specific room, write down who signed off and when, and only then move to the next room. If the same wall keeps failing the same inspection, the crew stops guessing at fixes and calls in someone to find the actual cause before touching it again. <!-- plain -->

develop is that discipline, applied to a piece of software rather than a building. `/arc-develop` turns an approved phase into small, spec-anchored, independently proven increments -- start, next, status, checkpoint, handoff. <!-- src: .claude/commands/arc-develop.md -->

It sits in the stretch between two other products: `plan` owns the intent behind a phase and `review`/`qa` own the audit afterwards, while develop supplies the context, the discipline, the checkpoints and the evidence for the building in between -- and it never builds the code itself. There is no coder subagent, ever; a person writes it. <!-- src: .claude/commands/arc-develop.md -->

Underneath, develop requires only two other products, `core` and `hq`, and asks for nothing else. <!-- src: products/develop/manifest.json -->

### Why this needs to be a product at all

Hand a crew a blueprint and walk away, and three things quietly go missing. Nobody writes down the shortcuts taken under time pressure, so they get taken again without anyone remembering the first time. A team stuck on the same wall convinces itself every attempt is a fresh idea, when it is the same failure recurring. And months later nobody can point at which inspection actually covered which room, so the paper trail is trusted more than it deserves. <!-- plain -->

develop's own governing rule is that every number is computed by a tool or earned from a scored outcome -- a confidence score a model invents about itself is not evidence. An intentional shortcut gets a debt-ledger row naming what it is, where it lives, why it was accepted, its cost, and the trigger that pays it down, rather than staying an unrecorded shortcut, forgotten forever. <!-- src: .claude/commands/arc-develop.md -->

And develop never modifies its own policies, gates or skills without a recorded, approved promotion -- the discipline it enforces on a build applies to itself too. <!-- src: .claude/commands/arc-develop.md -->

## arc words → normal words

| arc word | It is really | Meaning |
|---|---|---|
| phase | one approved chunk of work | The build unit develop turns into slices; `/arc-develop start <n>` reads that phase's own spec file and decomposes it. <!-- src: .claude/scripts/develop/develop.mjs#modeStart --> |
| slice | one proven increment | One numbered block in the ledger, carrying its own title, proof, tier, result and commit; a slice counts as proven only once both its result and its commit are really filled in. <!-- src: .claude/scripts/develop/ledger.mjs#isProven --> |
| Build Brief + slice ledger | the phase's paper trail | One file, `phase-NN-tasks.md`, holding the phase's derived header and scored predictions in `key: value` lines, its non-negotiables as a bullet list, and every slice block in the same `key: value` grammar. <!-- src: ADR-0100; .claude/scripts/develop/ledger.mjs#renderLedger --> |
| tier | how strong the proof is | One of six named evidence strengths a slice's proof can carry: static, unit, contract, integration, e2e-visual, verified-real. <!-- src: .claude/scripts/develop/ledger.mjs#TIERS --> |
| checkpoint | the inline safety stop | A check that runs automatically right after a risky slice is proven, before the next one is handed out, by matching the changed files against a fixed list of risk globs -- auth, migrations, public-api, security-sensitive, and the gate itself. <!-- src: .claude/scripts/develop/develop.mjs#modeNext; .claude/scripts/develop/quality.mjs#RISK_GLOBS; ADR-0103 --> |
| Context Pack | what past work already knows | Five sources -- code, ADRs, learning rows, retro patterns, churn -- assembled and handed over BEFORE a slice is built, one hop only, with every source recorded even the ones that found nothing. <!-- src: .claude/scripts/develop/develop.mjs#modeNext; .claude/scripts/develop/context-pack.mjs; ADR-0111 --> |
| stuck / fingerprint | the flailing detector | A normalised hash of an error's shape; the same fingerprint three times forces root-cause mode (`FINGERPRINT_LIMIT`), and five attempts on one slice escalates with a one-screen diagnosis (`ATTEMPT_LIMIT`). <!-- src: .claude/scripts/develop/stuck.mjs#FINGERPRINT_LIMIT; .claude/scripts/develop/stuck.mjs#ATTEMPT_LIMIT --> |
| learning row | a written lesson | One entry in the learning ledger describing what failed, why the process missed it, and a proposed reusable prevention -- never promoted on its own say-so. <!-- src: docs/develop/learning-ledger.md --> |
| holdout | the fixtures nobody authors against | Fixtures excluded from a candidate's authoring context and never printed by any command -- though the authoring session could still read them directly, so this is labelled "process-enforced" rather than "blind": a truly cryptographic holdout is impossible in this repo. <!-- src: ADR-0109 --> |
| debt ledger | the recorded shortcut list | A row for every intentional shortcut -- what, where, why accepted, cost of leaving it, pay-down trigger -- so a corner cut on purpose is not a corner forgotten. <!-- src: initiatives/develop/debt-ledger.md --> |
| capability | an outside tool being considered | Something the harness lacks that `/arc-capability` scouts for and `capability-vet.sh` either admits with a lockfile row or refuses, never installing it either way. <!-- src: .claude/commands/arc-capability.md --> |

## How a job flows

Once a phase is approved -- develop's own router note sends a new build or milestone to `/arc-kickoff`, a mid-build idea or scope change to `/arc-change`, and closing a phase to `/arc-phase-done`, because develop never does those three jobs itself. <!-- src: .claude/commands/arc-develop.md -->

`/arc-develop start <n>` reads that phase's own spec file, derives the Build Brief's header fields from it, and writes one slice per exit-criteria checkbox -- refusing outright and writing nothing if the spec is missing, or if the ledger already holds a proven slice that would be overwritten. <!-- src: .claude/scripts/develop/develop.mjs#modeStart -->

From there, `next` hands over one slice at a time, and for each one the building session works through the same steps: sketch a short micro-plan, declare the proof and tier before writing any code, implement it, run the declared proof and paste the real output into the ledger's result field, commit the slice locally and record the commit SHA, then call `next` again -- which emits the `slice.done` receipt for what was just proved and hands out the following slice. <!-- src: .claude/commands/arc-develop.md; .claude/scripts/develop/develop.mjs#modeNext -->

develop itself never runs git on the build session's behalf and never fills in a slice's own result -- the session commits locally, and develop only reads what was left behind and moves the marker forward, which is what gives a later checkpoint a real commit to measure against. <!-- src: .claude/scripts/develop/develop.mjs#modeNext; ADR-0102 -->

A slice whose diff touches a risk glob -- auth, migrations, public-api, security-sensitive paths, or the gate scripts themselves -- trips a checkpoint automatically at that same slice boundary, before the next slice is even offered, using the identical script a standalone checkpoint call would run. <!-- src: .claude/scripts/develop/quality.mjs#RISK_GLOBS; ADR-0103 -->

Once every slice in the ledger is proven, `handoff` refuses to proceed until each of the phase's own predictions carries a real hit, miss or unforeseen verdict with the reference that settles it, then writes the evidence pack as a file -- not a printout -- and says the phase is ready for `/arc-phase-done` -- develop never closes a phase itself. <!-- src: .claude/scripts/develop/develop.mjs#modeHandoff; .claude/scripts/develop/develop.mjs#evDir -->

## The stages, one by one

1. **start `<n>`** -- validates the phase's spec file exists, derives the Build Brief's header fields (the spec's own hash, its REQ and ADR citations, its blast radius, PLAN.md's no-gos), and writes one slice per exit-criteria checkbox with every proof field set to the ledger's own "not filled in yet" placeholder until it is filled in. <!-- src: .claude/scripts/develop/develop.mjs#modeStart; .claude/scripts/develop/ledger.mjs#PLACEHOLDER -->
3. **checkpoint** -- runs automatically inside `next` whenever a proven slice exists, and stays callable on its own; it never judges a slice's own declared risk level, only which paths its diff actually touched, printing that no risk globs tripped when none did, and it separately warns on any new debt marker (`TODO`/`FIXME`/`HACK`/`XXX`) with no row in the debt ledger. <!-- src: .claude/scripts/develop/develop.mjs#modeCheckpoint; .claude/scripts/develop/develop.mjs#debtPath -->
4. **If a slice keeps failing** -- the build session records each attempt's error against `stuck.mjs`, which normalises it into a fingerprint; the same fingerprint recurring three times forces root-cause mode, and five attempts on one slice escalates with a one-screen diagnosis naming what was tried, the current hypothesis, and three explicit options. Every backstop firing emits its own `slice.stuck` receipt, because the attempt counters themselves live in disposable local state. <!-- src: .claude/scripts/develop/stuck.mjs -->
6. **status** -- reprints the phase and slice progress, the next unproven slice, and the last receipt kinds seen on the spine, noting any expected kind still missing. <!-- src: .claude/scripts/develop/develop.mjs#modeStatus -->
7. **handoff `<n>`** -- refuses until every prediction is scored, then assembles the evidence pack develop hands to `/arc-phase-done`. <!-- src: .claude/scripts/develop/develop.mjs#modeHandoff -->

## Every part, explained

### Commands

- `/arc-develop <mode> [phase] [--lane NAME]` -- the execution harness itself: `start`, `next`, `status`, `checkpoint` and `handoff`, with the standing rule that there is no coder subagent, ever. <!-- src: .claude/commands/arc-develop.md -->
- `/arc-capability <need> | --vet <dir> | --audit` -- two halves in a fixed order: the scout finds candidates and writes nothing, and the gate refuses admission by default; the command installs nothing itself, ever. <!-- src: .claude/commands/arc-capability.md -->

### Agents

- `spec-fidelity` -- a fresh context whose entire information set is one phase's spec and its diff; it answers five fixed questions (built what the spec says, scope creep, exit-criteria drift, non-negotiables intact, and one plain-words line on user-visible behaviour) and ends on one of three fixed verdict lines, never a score. It never reads the slice ledger, the Build Brief, the PLAN or any session notes. <!-- src: .claude/agents/spec-fidelity.md -->
- `capability-scout` -- returns one table (need, candidate, source, quality evidence, verdict) for a stated capability gap, with no write tools of its own; it runs only on `/arc-capability`, a Build Brief declaring a gap, or a stale lockfile entry, never on its own initiative. <!-- src: .claude/agents/capability-scout.md -->
- `pattern-miner` -- finds prior art for one declared product, UX, architecture or external-API decision and returns a Pattern Annex capped at twenty lines, every row carrying a source and an adopted-or-rejected verdict; it runs only when a slice declares a `decision-type`. <!-- src: .claude/agents/pattern-miner.md -->

### Processes

- `develop-proof` -- proves the next unproven slice of a LIVE lane from evidence already recorded, ending on its own `slice.done` receipt; the face room's "Prove a slice" row starts it through `arc-run --process develop-proof`, its only file write is one result line under a gitignored scratch path, its only shell scope is `develop.mjs prove`, and it never runs a test itself -- "tests green" means green on CI, and the result names that evidence. <!-- src: processes/develop-proof.process.yaml -->

### Scripts

**The core lifecycle.** `develop.mjs` is the deterministic core behind every mode -- start, next, prove, status, checkpoint, handoff -- and it never commits and never writes to the spine's exit code on its own account; it imports lane resolution rather than reimplementing it. <!-- src: .claude/scripts/develop/develop.mjs#lane-resolve -->

**The ledger grammar.** `ledger.mjs` is the writer and tolerant-detection parser for the slice-block `key: value` grammar -- tolerant about heading level, emphasis and whitespace when detecting a slice or a field, and strict about the value itself, so a near-miss fails closed rather than being silently ignored. <!-- src: .claude/scripts/develop/ledger.mjs -->

**The proof floor.** `develop-lint.mjs` is the gate: three structural checks -- `ledger-unparseable`, `brief-stale`, `slice-unproven` -- BLOCK from the first version, and three heuristic checks -- `self-declared-number`, `tier-floor`, and how many `approach-sketch`es a slice carries -- ship WARN-first, promoted to BLOCK only through `docs/trial-ledger.md`'s existing mechanism; an approach sketch's own content is a separate, structural check that BLOCKs from v1, because a malformed sketch reads as a considered decision when it is not. <!-- src: .claude/scripts/develop/develop-lint.mjs#TRIAL; ADR-0101; initiatives/develop/PROGRESS.md -->

**The Context Pack.** `context-pack.mjs` assembles what past work already knows about a slice from five sources -- code, ADRs, learning rows, retro patterns, churn -- one hop only, and records every source including the ones that returned nothing. <!-- src: .claude/scripts/develop/context-pack.mjs -->

**The stuck protocol.** `stuck.mjs` normalises an error into a fingerprint and counts attempts per slice, forcing root-cause mode or an escalation on the deterministic backstops described above; every backstop firing emits a `slice.stuck` receipt because its own state under `.claude/state/develop/` is disposable. <!-- src: .claude/scripts/develop/stuck.mjs -->

**The Learning System.** `learning.mjs` parses the learning ledger, replays a candidate safeguard against a fixture corpus, and lists the visible fixture inventory with the withheld holdout left out. <!-- src: .claude/scripts/develop/learning.mjs --> `replay-child.mjs` is the separate process that replay actually runs in: it receives only frozen fixture bodies, returns only booleans, and never sees a fixture's `expect`, `id` or `category`, because an adversarial pass found several ways a candidate could game a replay that shared more than that. <!-- src: .claude/scripts/develop/replay-child.mjs -->

**Quality intelligence.** `quality.mjs` validates the Pattern Annex a slice owes when it declares a decision, and the Approach sketches a slice owes when its own paths trip a risk glob -- both recorded in a separate `phase-NN-quality.md` file rather than inside the ledger itself. <!-- src: .claude/scripts/develop/quality.mjs -->

**Outcome metrics.** `metrics.mjs` computes six outcome metrics -- `escaped-spec-misses`, `rework-stuck`, `time-to-first-proven-slice`, `false-block-rate`, `evidence-completeness`, `ceremony-cost` -- and the calibration record of every scored prediction, each one either computed from committed records or reported as `not derivable` with the reason. <!-- src: .claude/scripts/develop/metrics.mjs#escapedSpecMisses; .claude/scripts/develop/metrics.mjs#reworkStuck; .claude/scripts/develop/metrics.mjs#timeToFirstProven; .claude/scripts/develop/metrics.mjs#falseBlockRate; .claude/scripts/develop/metrics.mjs#evidenceCompleteness; .claude/scripts/develop/metrics.mjs#ceremonyCost -->

**Capability vetting.** `capability-vet.sh` is the gate `/arc-capability --vet` runs: it BLOCKs unless existence, allowlist membership, an exact version pin, a hash equal to the one the registry published, two separately-recorded provenance fields, a clean content scan, and -- when the candidate is write-capable -- a recorded human OK, all hold; it never installs anything. <!-- src: .claude/scripts/develop/capability-vet.sh; .claude/commands/arc-capability.md -->

**Candidates and records.** `candidates/L-002.mjs` and `candidates/L-004.mjs` are two attempts at an executable safeguard for learning row L-002 -- L-002 was rejected by a fresh evaluator on its own code, and its rewrite L-004 stopped firing entirely and was rejected too, this time on its computed replay counts alone. <!-- src: .claude/scripts/develop/candidates/L-002.mjs; .claude/scripts/develop/candidates/L-004.mjs; docs/develop/learning-ledger.md -->

`capability-allowlist.txt` names the capabilities decided on in advance, and `capability-lock.json` records every capability admitted or refused, each row re-checked for staleness after thirty days. <!-- src: .claude/scripts/develop/capability-allowlist.txt; .claude/scripts/develop/capability-lock.json; ADR-0110 -->

### Gates and rules

- `[ledger-unparseable]`, `[brief-stale]`, `[slice-unproven]` -- the three structural checks that BLOCK from the first version, because each is a presence-or-parse question with no judgement in it. <!-- src: ADR-0101 -->
- `[self-declared-number]`, `[tier-floor]` -- heuristic checks that ship WARN-first and promote to BLOCK only through `docs/trial-ledger.md`. <!-- src: ADR-0101; .claude/scripts/develop/develop-lint.mjs -->
- `[pattern-annex]`, `[approach-sketch]` -- owed only by a slice that declares a decision, and by a slice whose own paths trip a risk glob, so neither fires on every slice. <!-- src: .claude/scripts/develop/develop-lint.mjs -->
- `[learning-row]` -- validates every row in the learning ledger, checked from the repository root rather than from one lane's own tracker. <!-- src: .claude/scripts/develop/develop-lint.mjs -->
- The learning ledger's own promotion rule -- a row cannot reach `verdict: promoted` without carrying computed replay counts, a verdict from a fresh agent that never saw the authoring reasoning, and a recorded approval, and `forward-verified:` stays `no` until a later cycle measures whether the learning actually generalised. <!-- src: docs/develop/learning-ledger.md; ADR-0108; ADR-0109 -->
- A committed fake phase is the permanent regression fixture for the ledger grammar and the lifecycle, including the root-mode byte-identical golden, rather than a one-time demonstration. <!-- src: ADR-0104 -->

## The bigger loop

### The life of a phase, in its own numbers

Phase 00 did not use `/arc-develop` on itself, because the tool did not exist yet; Phase 01 is the first phase actually run through it, and it built the proof floor. Nine slices went in, and `status` reported `slice 5/9` partway through and `9/9` from committed files alone once the phase closed. <!-- src: initiatives/develop/PROGRESS.md -->

The author's own twenty-six breaking inputs against the new gate were all caught -- a true result about the author's own blind spot, not about the gate. A fresh agent that had never seen the parser then attacked the direction the author never tried and found nine holes, including a four-slice ledger claiming `proof: it works` and `commit: yes` that parsed to zero slices and zero errors, with the gate reporting "all checks passed". <!-- src: initiatives/develop/PROGRESS.md; ADR-0108 -->

Phase 04's Learning System ran the loop end to end twice, against one real finding, and returned no both times. Candidate L-002 was sent to a fresh evaluator carrying only the candidate and its computed replay counts, and it was rejected on the code itself, not the counts; the rewrite, L-004, stopped firing entirely rather than false-blocking on the two clean controls that rejection had produced. <!-- src: docs/develop/learning-ledger.md; initiatives/develop/PROGRESS.md -->

### How it connects to the rest of arc

- develop requires `core` and `hq`, and nothing else. <!-- src: products/develop/manifest.json -->
- It rides the existing lane resolver by passing `--for develop` through the same generic path every other surface uses, rather than teaching `lane-resolve.sh`/`lane-resolve.mjs` a new surface -- the highest-blast-radius file pair in the repo stays untouched. <!-- src: ADR-0105 -->
- Inside arc's own division of labour, `plan` owns intent and `review`/`qa` own the audit; develop owns the stretch between them, and hands its finished evidence pack to `/arc-phase-done` rather than closing a phase itself. <!-- src: .claude/commands/arc-develop.md -->
- A mid-build idea or scope change is routed through `/arc-change` rather than built ad-hoc inside develop's own loop -- develop's own router note says it never does kickoff's, change's or phase-done's three jobs. <!-- src: .claude/commands/arc-develop.md -->
- The four receipt kinds develop emits -- `develop.started`, `slice.done`, `handoff.ready`, `slice.stuck` -- exist because the spine's closed kind vocabulary was extended by name for this lifecycle, once for the first three and again for the stuck protocol. <!-- src: ADR-0106; ADR-0107 -->
- develop's own face room, named `develop`, sits in the `factory` ring, and is what the four receipt kinds above are shown against; its sanctioned surfaces are `phase-NN-tasks.md`, the debt and learning ledgers, `capability-lock.json`, and DEVELOP kinds. <!-- src: products/develop/manifest.json -->

## Glossary

- **phase** -- one approved chunk of work, decomposed into slices by `/arc-develop start <n>`. <!-- src: .claude/scripts/develop/develop.mjs#modeStart -->
- **slice** -- one numbered increment in the ledger, proven only once both its result and its commit are filled in. <!-- src: .claude/scripts/develop/ledger.mjs#isProven -->
- **Build Brief / slice ledger** -- the one file per phase holding its derived header, non-negotiables, scored predictions and every slice block. <!-- src: .claude/scripts/develop/ledger.mjs; ADR-0100 -->
- **tier** -- one of six named evidence strengths a slice's proof can carry. <!-- src: .claude/scripts/develop/ledger.mjs#TIERS -->
- **checkpoint** -- the automatic, risk-glob-triggered stop that runs inline at a slice boundary. <!-- src: .claude/scripts/develop/develop.mjs#modeCheckpoint; ADR-0103 -->
- **stuck / fingerprint** -- the normalised error hash behind the deterministic backstops that force root-cause mode or escalate. <!-- src: .claude/scripts/develop/stuck.mjs#fingerprint -->
- **learning row** -- one entry in the learning ledger: what failed, why it was missed, and a proposed prevention. <!-- src: docs/develop/learning-ledger.md -->
- **holdout** -- the withheld fixtures a learning candidate is graded against but never authored against. <!-- src: ADR-0109 -->
- **debt ledger** -- the recorded row for every intentional shortcut, so it is not forgotten. <!-- src: initiatives/develop/debt-ledger.md -->
- **capability** -- an outside tool `/arc-capability` scouts and `capability-vet.sh` admits or refuses, never installs. <!-- src: .claude/commands/arc-capability.md -->
- **human-ok** -- the recorded approval a write-capable capability needs before it can be admitted. <!-- src: .claude/scripts/develop/capability-vet.sh -->
- **capability-lock.json** -- the record of every capability admitted or refused, and on what basis. <!-- src: .claude/scripts/develop/capability-lock.json -->
- **develop-proof** -- the headless process that proves one slice of a LIVE lane from evidence already recorded. <!-- src: processes/develop-proof.process.yaml -->
