# Phase 00 — Steel thread: one canonical process that lints clean, offline

**Goal (one line):** `processes/` exists as a real format — three pilot commands canonicalized into
`NAME.process.yaml`, a `process-lint` that reads a frozen YAML subset and a frozen JSON-Schema
subset and survives a fresh-agent attack, and an eval fixture per pilot — all offline, with no
compiler and no engine yet.

**Appetite:** 4 days
**Depends on:** none

Serves **REQ-01** (one canonical truth per pilot process).

## The steel thread, precisely

The thinnest end-to-end slice is: **a canonical file goes in, `process-lint` reads it, a verdict
comes out.** Input, core flow, output. No network, no model, no compiler. Everything later in the
cycle consumes this format, so it is built and attacked first.

## What this phase actually builds

The deterministic core is a **script**, not a prompt — the same split ADR-0047 already uses.

- `.claude/scripts/engine/yaml-subset.mjs` — the ADR-0200 parser. Reads block mappings, block
  sequences, plain/single/double-quoted scalars, block scalars (`|`, `|-`, `>`), comments, one
  document per file. **Rejects, loudly and by name:** anchors/aliases (`&`/`*`), tags (`!!`),
  **non-empty** flow collections, a second `---` document, merge keys (`<<`), and tab indentation.
  Every rejection names the construct and the line. The empty literals `[]` and `{}` are permitted
  — ADR-0200's one amendment, taken under its own revisit trigger after this phase's first lint run
  rejected the spec's own `inputs: []`. A second extension reopens the format decision.
  The `---` check runs **during parsing, never by pre-splitting the text**: a `---` inside a `body:`
  block scalar is a markdown horizontal rule, and a textual pre-split would cut the document in half
  at it. No pilot body contains one today, which is a snapshot and not a rule. It extends the precedent at
  `.claude/scripts/council/council-lint.mjs:52`, which reads `key: value` between frontmatter
  fences, rather than replacing it.
- `.claude/scripts/engine/schema-subset.mjs` — the ADR-0200 output-contract validator. Supports
  exactly `type`, `properties`, `required`, `enum`, `items`, `additionalProperties`, `minLength`,
  `pattern`. Any other keyword in a process's `output` block is a `process-lint` failure at
  authoring time, so an unsupported keyword can never be silently unenforced at run time.
- `.claude/scripts/engine/process-lint.mjs` — the gate. Output format
  `[check-id] FILE:LINE — Expected/Found/Example`, exit `0` clean / `1` failures. CLI:
  `process-lint.mjs [FILE...]` validates the named files; `--all` validates every
  `processes/*.process.yaml`. The check ids are fixed here so fixtures and messages can be written
  against them: `yaml-parse` · `yaml-excluded` · `schema-keyword` · `schema-shape` · `name-semver` ·
  `tool-unknown` · `permissions-invalid` · `placeholder-dialect` · `placeholder-malformed` ·
  `evals-path` · `target-passthrough` · `baseline-drift` · `lf-only` · `golden-unrecorded`.
  Two of those ids are **reserved in this phase and implemented in Phase 01** — `lf-only` (which
  checks *generated output*, the compensating instrument for the byte-diff's LF normalisation) and
  `golden-unrecorded`. They are listed now so the vocabulary is fixed once. **CRLF and mixed line
  endings in a canonical *source* file are `yaml-parse`, not `lf-only`** — a source file's encoding
  is the parser's business, a generated file's line endings are the compiler's, and they are
  different checks on different artifacts that would otherwise share a name and hide each other.
  Duplicate keys in one mapping are also `yaml-parse`.
  **On the WARN-first question, which the two documents could otherwise be read as contradicting:**
  the PLAN's no-go governs *promoting a gate to BLOCK in the CI pipeline*, which this phase does not
  do. It does not govern the tool's own exit code — a lint that cannot exit non-zero on a hostile
  input is not a lint, and its fixtures could assert nothing. `process-lint` exits 1 from day one;
  wiring it as a merge-blocking CI gate is a separate, trial-ledger-governed decision.
- `processes/commit-msg-draft.process.yaml`, `processes/review-diff.process.yaml`,
  `processes/kickoff-plan.process.yaml` — the 3 pilots, canonicalized in that order.
- `tests/fixtures/engine/hostile/` — the breaking-input corpus with an `INDEX` file, copying the
  TSV shape already used by `tests/fixtures/spine/hostile/INDEX`.
- `tests/fixtures/engine/evals/` — one eval fixture per pilot: an input and the expected output
  shape. **Written, never executed** — a bench runner is a declared no-go.
- `tests/engine-process-lint.bats` — the phase's proof.
- `products/engine/manifest.json` — `requires: ["core"]`. Shape copied from
  `products/design/manifest.json` and validated by running `product-lint.mjs`, not by trusting it.

## The canonical file's shape (ADR-0200 + ADR-0205 + ADR-0206), by example

The example headings sit one level down from real ones on purpose: a line-based reader splitting on
`##` does not respect code fences, which is retro-log 2026-07-16's exact defect class.

```yaml
name: commit-msg-draft
version: 1.0.0
intent: Stage related changes and write a conventional commit.
permissions: declared
inputs: []
tools:
  - git.op
  - shell.run
output:
  type: object
  required: [commits]
  additionalProperties: false
  properties:
    commits:
      type: array
      items:
        type: object
        required: [sha, subject]
        properties:
          sha: { type: string, pattern: "^[0-9a-f]{7,40}$" }
          subject: { type: string, minLength: 1 }
evals:
  - tests/fixtures/engine/evals/commit-msg-draft/basic.json
baseline:
  target: claude-code
  path: .claude/commands/arc-commit.md
  commit: 7abeda1
  sha256: 4eb87547ca4353e9802db22c7b558b3e7af0d70cdd94565753a956f133e66d77
body: |
  Commit the current work properly:
  ...the pilot's prose, verbatim and target-neutral...
```

Note the `output` block's `{ type: string, ... }` uses flow collections, which the parser rejects —
so in the real file those nest as block mappings. The example is written this way once, here, to
make the exclusion concrete; `process-lint`'s own fixture set includes this exact construct as a
FAIL case.

- **`baseline:`** is ADR-0202's pinned-hash mechanism. `process-lint` recomputes the live pilot's
  `sha256` and FAILs when it has moved, naming the file and both hashes — so drift during the cycle
  is adjudicated, never silently absorbed. The three baselines at `7abeda1` are recorded in
  `tests/fixtures/sync-golden/tree-manifest.txt` lines 32, 41, 47 and must be read from there, not
  retyped.
- **`body:`** is the single shared block scalar of ADR-0205. There is exactly one, every adapter
  renders it, and there is **no** per-target passthrough — `process-lint` rejects any key matching
  `x-<target>-*`.
- **`tools:`** draws from the seven of ADR-0206: `fs.read`, `fs.write`, `shell.run`, `web.search`,
  `git.op`, `ask.human`, `agent.invoke`. An eighth value is a FAIL, not an extension.
### The four field contracts an executor cannot guess

**`inputs:`** is a list of mappings, never bare scalars. Each entry has exactly these keys:
`name` (matching `^[a-z][a-z0-9_-]*$`), `type` (`string` in v1 — the only value), `required`
(boolean), and optionally `default` (a scalar) and `description` (a string). `required: true` with a
`default` is a `process-lint` FAIL: a default makes it not required. Per pilot:
`commit-msg-draft` → `[]`; `review-diff` → one entry `{name: base, type: string, required: false,
default: main}`; `kickoff-plan` → one entry `{name: goal, type: string, required: true}`.

**The neutral placeholder grammar is closed.** The whole of it is
`{{input.NAME}}` and `{{input.NAME|default:VALUE}}`. The path is exactly `input.` plus one
`inputs[].name` — **no** deeper dotting, **no** array indices, **no** other root than `input`. The
filter set is closed at **one**: `default`. Any other filter is an unknown-filter FAIL, which is
what makes that hostile fixture constructible. `VALUE` runs to the closing `}}` and is not escaped
or quoted; a `}}` inside a default is unrepresentable and is its own FAIL rather than a parse
surprise. A placeholder naming an input that `inputs:` does not declare is a FAIL.

**`evals:`** is a flat list of repo-relative file paths and there is **no include directive** — an
eval file cannot reference another, so "cyclic includes" names nothing and is not a fixture class.
The real hostile cases are: a path that escapes the repo root (`../../...`), a path that does not
exist, and a path naming the process file itself. `process-lint` FAILs each.

**Each eval fixture** is a JSON object with exactly `input` (an object keyed by `inputs[].name`) and
`expected` (an object matching the process's `output` schema). Written, never executed this cycle.

- **`permissions:`** is `declared` or `unrestricted`, and it exists because of a fact verified at
  `7abeda1`: `arc-kickoff.md` carries **no `allowed-tools:` line at all** — it and `arc-develop.md`
  are the only 2 of 24 commands without one — while still needing `agent.invoke`, `shell.run`,
  `fs.write` and `ask.human`. An adapter that derives `allowed-tools:` unconditionally from `tools:`
  would ADD a line the baseline does not have, and `arc-kickoff` would fail the byte-diff
  structurally rather than on prose. So "does this process declare an explicit permission set, or
  run unrestricted" is modelled as a property of the **process** — target-neutral, and not a
  passthrough field — and the adapter emits the line only when it is `declared`.
  `commit-msg-draft` and `review-diff` are `declared`; `kickoff-plan` is `unrestricted`.
- **`name` + `version`** must satisfy the spine's live `PROCESS_RE`. `process-lint` imports that
  regex from `.claude/scripts/hq/lib/validate.mjs` and asserts against it — never against a copy,
  because a copied regex is a regex that drifts.
- **`output:` binds to the process's terminal machine-readable result**, and `schema-subset.mjs`'s
  `type` values are the standard JSON-Schema seven: `object`, `array`, `string`, `number`,
  `integer`, `boolean`, `null`. For **`kickoff-plan` the contract binds to `approval.requested`**,
  named explicitly and not left as a choice: `kickoff.done` is a fire-and-forget marker, while
  `approval.requested` carries the terminal outcome the process actually produces — a plan that
  stops for a human, whose ULID is the approval id. The PLAN, phase-spec and ADR **files** it also
  authors are outside any receipt payload, and that is recorded as a known gap rather than
  schema'd away by pretending a file list is a return value. Note what defines the payload's
  fields: the process's own `output` block does. `validate.mjs` validates the event **envelope**
  and the kind vocabulary, never payload internals — so there is no external payload schema to
  import, and inventing one would be inventing a contract the spine does not have.

## Canonicalization order, and why

`arc-commit` (19 L) → `arc-review` (36 L) → `arc-kickoff` (132 L). Simple first, so the format's
holes are found on the cheap file. `arc-review` is the first to need `agent.invoke` (its `Task`
call to `code-reviewer`) and the first to need a neutral placeholder (`${1:-main}` becomes
`{{input.base|default:main}}`). `arc-kickoff` is last because it is where a residue is most likely,
and a residue there is a *result* under ADR-0205, not a failure.

## The adversarial pass (non-negotiable, bound to this phase)

`process-lint`, `yaml-subset.mjs` and `schema-subset.mjs` are parser-class artifacts. Before this
phase closes, a **fresh agent that has not seen the implementation** is given the source, the rules,
the existing fixtures and the instruction to walk past the gate.

**The mechanism, named so it is executable rather than aspirational.** Spawn a subagent with the
Task tool, `subagent_type: general-purpose`, from a context that has not built any of the three
files — never the build session itself, and never an agent already used earlier in this phase. Hand
it, by path: the three script files, this spec's rules sections, `tests/fixtures/engine/hostile/INDEX`,
and the instruction *"construct inputs that this gate accepts but should not, or rejects with a
message that misidentifies what is wrong — walk past it."* Its returned report is pasted into the
phase evidence pack unedited.

**What "session id" means here, and the limit of it.** The id and timestamp are recorded by the
**orchestrating** session from the Task tool's own return metadata — not copied from prose the
subagent wrote about itself. That distinction is the whole control: a subagent asserting its own
freshness is text it typed, and text cannot attest to its own provenance. State the residual
weakness plainly rather than dressing it up: if the harness in use does not expose that metadata,
this check degrades to an **operator attestation** that a separate context was used, which is
weaker evidence, and the evidence pack must label it as such instead of presenting an attestation
as a measurement. Every hole it finds is fixed and
pinned. A clean result from the author is evidence of a blind spot, not of a gate (retro-log
2026-08-02).

**Outcome, recorded 2026-08-03.** Three unanchored agents ran against the parser, the rule layer,
and the system-level "doctored artifact that displays legitimacy" angle. The author's own 36
fixtures had all been caught on the first run; the three agents found **~40 real holes** in the
directions those 36 never probed. The four that mattered most:

1. **`__proto__` as a key** re-pointed the object's prototype instead of creating an own property,
   so the key vanished from `Object.keys()` while staying readable — blinding *three* gates at once
   while every consumer still saw the value.
2. **A flow collection on its own line** (`{x-claude: v}`) parsed to a key literally named
   `{x-claude`, walking straight past the ADR-0205 passthrough check while every real YAML reader
   resolved it to the forbidden key. The file smuggled the escape hatch through the gate that
   exists to forbid it.
3. **Five keyword/type combinations linted clean and enforced nothing** (`minLength` on an object,
   `additionalProperties: false` with no `properties`, `output: {}`), making this layer's own
   "no constraint is silently unenforced" promise false.
4. **A 15-line fake lint that reads nothing passed 7 of the suite's 12 assertions** by looking the
   filename up in the fixture INDEX. Asserting a check id rather than a bare exit code was a real
   improvement and still not enough: a check id is a string the lint prints, not evidence it looked.

The corpus is now **two classes** — and the second exists because a reject-only corpus is
structurally blind to a legitimate file being wrongly refused, which is how eight ordinary
constructs (markdown emphasis in a quoted `intent`, a comment mentioning `&base`, a tab inside body
prose, a zero-indented sequence, an all-digit commit with a leading zero) were being hard-rejected
with every test green.

Target: **≥20 REJECT fixtures** (there are now 71) and **≥10 ACCEPT fixtures**, spanning at least — malformed YAML, each excluded
construct, a missing `output` block, an unknown schema keyword, an unknown tool value, an invalid
`permissions:` value, an `evals:` path that escapes the repo root / does not exist / names the
process file itself, a dialect-native placeholder inside `body:`, **a malformed *neutral* placeholder
inside `body:` (unbalanced braces, unknown filter, missing default after `|default:`, a path
escaping outside `input.*`)**, an `x-target-*` key, a `version` that fails `PROCESS_RE`, a
`baseline` whose `sha256` does not match, CRLF and mixed line endings, and duplicate keys in one
mapping. The neutral-placeholder cases matter because ADR-0206 invents that grammar in this cycle:
the only placeholder fixture otherwise pinned catches the *wrong* syntax and never a broken instance
of the syntax this plan just created.

## Exit criteria (Definition of Done)

- [ ] all 3 pilots exist under `processes/` and `process-lint` exits 0 on all 3
- [ ] `process-lint` exits 1 on every fixture in `tests/fixtures/engine/hostile/`, each with a
      message naming the check id, the file and the line
- [ ] **each check ships a negative control** proving it can fail — a gate that has never been seen
      to fail is a coin, not a gate (retro-log 2026-08-02)
- [ ] the fresh-agent adversarial pass has run, its findings are fixed, and every hole is pinned as
      a fixture; the agent's report is in the phase evidence pack **and names the agent's session
      id plus an explicit statement that it read none of `yaml-subset.mjs`, `schema-subset.mjs` or
      `process-lint.mjs` before attacking** — without that, the report is evidence of a report, not
      of freshness (retro-log 2026-08-02, both the arc-develop and arc-portfolio entries)
- [ ] one eval fixture per pilot exists under `tests/fixtures/engine/evals/`, written and unexecuted
- [ ] `baseline:` in each canonical file matches the live pilot's hash at `7abeda1`, and
      `process-lint` FAILs when it is mutated
- [ ] tests added and green: `bash tests/engine-process-lint.bats` on all 3 CI legs
- [ ] `tests/fixtures/sync-golden/tree-manifest.txt` regenerated as a named step — delta diffed
      first, only intended paths confirmed moved (retro-log 2026-07-22)
- [ ] `node .claude/scripts/core/product-lint.mjs` passes with the new `engine` manifest
- [ ] `.github/workflows/ci.yml`'s hand-maintained test-count floor is raised to match the new
      `@test` lines — raised to reality, never lowered to make a red build green
- [ ] **assumption A-01 resolved or escalated:** the ADR-0069 block-(d) trigger is named in writing.
      If it is "a second runtime is genuinely needed", that trigger is absent from block (d)'s list
      and its amending ADR is written before Phase 01 closes
- [ ] tracker updated in `initiatives/engine/PROGRESS.md`: the phase-00 row goes to
      `done`, the done-log gains a line, `burn:` and the appetite-burn line are recalculated, and
      `## Now` points at Phase 01. `PORTFOLIO.md`'s engine row derives from that header — never
      hand-edited (ADR-0051) — and `board-lint.sh` is re-run after

## Verification plan

- **Test command:** `bash tests/engine-process-lint.bats`
- **Expected failure first:** `not ok 1 process-lint accepts the three canonical pilots` — fails
  before any code with `Error: Cannot find module '.claude/scripts/engine/process-lint.mjs'` and
  **exit 1** (Node's uncaught-exception code; it is *not* 127 — 127 is a shell command-not-found
  code, which this invocation cannot produce because the script is run as `node <path>`).
  That exit code is exactly why the second red matters: `not ok 2 process-lint rejects an anchor`
  must assert the **module-not-found message**, not merely a non-zero exit, because a working lint
  rejecting a hostile input ALSO exits 1. A test that asserts only "exit 1" passes identically
  whether the script is missing or working, which is a test that proves nothing — the exact
  negative-control failure retro-log 2026-08-02 records passing six CI legs by luck.
- **Live demo scenario:** from a clean tree run
  `node .claude/scripts/engine/process-lint.mjs processes/commit-msg-draft.process.yaml` and expect
  exit 0 with no output; then run it against
  `tests/fixtures/engine/hostile/anchor-alias.process.yaml` and expect exit 1 with a line naming the
  construct and its line number. Then `git status` shows changes confined to `processes/`,
  `.claude/scripts/engine/`, `tests/`, `products/engine/` — plus exactly two files outside them that
  the exit criteria require and that this list must therefore name, or the demo's success condition
  contradicts the DoD: `.github/workflows/ci.yml` (test-count floor) and
  `initiatives/engine/PROGRESS.md` (tracker). Anything else outside those prefixes is a real finding.
- **Real-system check:** n/a — offline by construction this phase. The one live-repo read is the
  three pilot hashes, confirmed against `tests/fixtures/sync-golden/tree-manifest.txt`.
- **Expected evidence:** bats output for all 3 CI legs, the three canonical files pasted in full,
  the hostile-fixture INDEX, and the fresh-agent adversarial report with each finding's fix — the
  report carrying the agent's session id and timestamp and its own statement of what it did not
  read. Nothing else in this verification plan can tell a genuinely unanchored agent's report from
  the author's own relabelled, so that statement is the only instrument there is.

## Rabbit holes in this phase

- **Making the YAML parser general.** It reads the frozen subset of ADR-0200 and nothing else. A
  construct outside it is a parse error; the temptation to "just support anchors" is the first step
  to owning a YAML implementation.
- **Perfecting the taxonomy.** Seven primitives, capped by ADR-0206. If a pilot seems to need an
  eighth, that is assumption A-05 failing — stop and say so, do not add it quietly.
- **Compiling anything.** No adapter, no byte-diff, no output file this phase. That is Phase 01.
- **Making the eval fixtures good enough to score.** They are inputs and expected shapes. Anything
  that runs them is the declared bench no-go.

## Out of scope for this phase

- `arc-compile`, both adapters, the byte-diff and the source-of-truth flip → Phase 01.
- `arc-run`, drivers, budgets, `router.yaml`, secret scrubbing → Phase 02.
- Real runs and the 4th-driver timing → Phase 03.
- Anything in the PLAN's `## No-gos`.

## Your-setup / pending

Nothing. No keys, no accounts, no network — the phase runs entirely on committed files.

**Tripwire:** at 3.0 days inside this phase, canonicalize `arc-kickoff` to whatever the format
reaches, record the residue as an A-02 finding, and move to Phase 01 with two pilots proven rather
than three polished.

**Second tripwire — the one that actually protects the cap.** The first tripwire bounds pilot count;
it does not bound the parser, lint, fixture and adversarial work that is the bulk of this phase and
has to finish first. So: if the fresh-agent adversarial pass has not **started** by 3.0 days, it does
not get an open-ended remainder. Timebox it to the fraction of a day left, fix only what it finds
inside that box, and record any unattempted hole classes from the ≥20 target list as a carried gap
into Phase 01 — a short fixture count that is written down is recoverable; one that is silent is not.

Read both lines when the phase starts, not after it (Cycle 4's tripwire fired and was never applied).

## Non-negotiables (verbatim from PLAN)

- Every gate, lint, parser and driver wrapper this cycle ships gets an adversarial construct-a-breaking-input pass in the same section that ships it, run by a FRESH agent that has not seen the implementation, with every hole pinned as a fixture (retro-log 2026-08-02: the author's own 26 inputs found nothing and an unanchored agent then found 9 real holes).
- No component changes a model tier at run time, anywhere, under any condition — every production tier change is a reviewed `engine/router.yaml` diff citing ADR-0069 block (b)(1); escalation ends in a proposal receipt (ADR-0204).
- The 21 non-pilot commands stay hand-written and untouched this cycle, and no agent file is canonicalized.
- `arc-run` is headless only — it never wraps an interactive session.
- Every run emits `run.completed` with its cost through the standard emitter, and the emit is VERIFIED to have landed in `events/` and not in `_quarantine/` — exit 0 from a fire-and-forget writer is not evidence that anything was written (retro-log 2026-08-02).
- An unavailable cost or fingerprint field stays absent — never estimated, never inferred, never interpolated (ADR-0069 block (b)(5) and block (e)).
- Zero-dep Node plus POSIX is inherited: no LangChain-class dependency, no vendor SDK in any driver, plain HTTP for generic-api.
- Eval fixtures for the 3 pilots exist from Phase 0, and every gate ships with a negative control proving the check can fail (retro-log 2026-08-02).
- Editing any file the sync-golden manifest hashes means a named regeneration step: diff the delta first, confirm only intended paths moved, then re-record (retro-log 2026-07-22).
- The CI test-count floor is raised by re-running the count and asserting it equals the live `@test` total, never by hand-typing a number that four separate phase closes must each remember — a hand-maintained count is what rotted silently for five days in arc-orchestrator (retro-log 2026-07-22).
