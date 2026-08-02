# Phase 00 — Steel thread: the lifecycle runs end-to-end, offline, lane-native

**Goal (one line):** `/arc-develop` carries a fake phase from `start` through `next` and `status` to
`handoff` with nothing but committed files and no network, writing a durable Build Brief + slice
ledger and leaving receipts behind it.
**Appetite:** 1.5 days
**Depends on:** none

Serves **REQ-01** (brief + ledger), **REQ-02** (lane contract + root-mode), **REQ-03** (cold status),
**REQ-04** (receipts).

## What this phase actually builds

The deterministic core is a **script**, not a prompt. arc commands are markdown prompt files; their
verdicts and their file writes belong to scripts, which is what makes them testable offline and is
the same split `design-critique.sh` / `arc-design-critique.md` already uses (ADR-0047 — the runner
owns the verdict and the receipt).

- `.claude/scripts/develop/develop.mjs` — subcommands `start | next | status | handoff`. Imports
  `resolveLane` from `.claude/scripts/core/lane-resolve.mjs`; never re-implements resolution; never
  invokes git (ADR-0102).
- `.claude/commands/arc-develop.md` — the prompt wrapper: calls the script, prints the
  `Selected lane:` echo first in lane-mode, then the PORTFOLIO summary, then the script's report.
- `.claude/scripts/develop/ledger.mjs` — the ADR-0100 grammar: writer + tolerant-detection parser.
  Phase 00 ships the writer and a parser that reads what it wrote; Phase 01 makes the parser survive
  attack.
- `products/develop/manifest.json` — `requires: ["core", "hq"]`, listing the command, the scripts and
  the fake-phase fixture (ADR-0105).
- **Three committed fixtures** (ADR-0104), because one tree cannot hold two ledger states at once:
  - `tests/fixtures/develop/fake-phase/` — a phase spec and **no** `tasks.md`. This is what `start`
    writes into; its ledger comes out with **5 slices, 0 proven**, so `status` prints `slice 0/5`.
  - `tests/fixtures/develop/fake-phase-midway/` — the same spec plus a committed `tasks.md` holding
    **5 slices, 2 proven**. This is what proves `status` reconstructs cold (`slice 2/5`, next
    unproven `03`) and what proves `start` refuses to clobber a ledger with proven slices.
  - `tests/fixtures/develop/root-mode/` — a tree with no `initiatives/` directory, for the
    byte-identical golden.
- `tests/develop-lifecycle.bats` — the phase's proof.

### What each mode does in Phase 00

- **`start <n>`** — validates the phase spec exists, computes the derived header fields, writes the
  Build Brief + the slice ledger, emits `develop.started`. Refuses (non-zero, writes nothing) when
  the spec is absent or the ledger already holds a proven slice.
- **`next`** — the **advance** step, and the only mode that emits `slice.done`. In order: (1) read
  the ledger; (2) if the slice most recently handed out now has both `result:` and `commit:` filled,
  it is proven — emit `slice.done` for it; (3) select the next slice with no `result:`, print its id,
  title, declared `proof:` and the brief's blast radius; (4) if none remain, print
  `all slices proven — run handoff` and exit 0. `next` never writes code, never runs git, and never
  fills `result:` itself — the session does both, which is ADR-0102's whole point. It only reads what
  the session left behind and moves the marker.
- **`status`** — read-only reconstruction from committed files, no session memory. Prints the
  statusline, the next unproven slice id, and the last 3 receipt kinds.
- **`handoff <n>`** — assembles the evidence pack and emits `handoff.ready`. Phases 02 and 03 own
  the real scoring and fidelity logic; here it is the minimal assembler.
- **`checkpoint`** — a stub in this phase: resolves the lane, prints `no checks wired yet`, exits 0.
  It becomes real in Phase 03. Naming it now keeps the five-mode surface stable so the command file
  does not change shape later.

### The statusline, exactly

`develop · <lane> · phase NN · slice X/Y` where **X is the count of proven slices** (those with both
`result:` and `commit:` filled) and **Y is the total slice count**. X is progress, not position — the
slice being worked on is reported separately as the next-unproven id. A fresh ledger prints
`slice 0/5`, never `slice 1/5`. Root-mode drops the ` · <lane>` segment entirely.

### The `--root` flag

`--root PATH` names the tree the command operates on; it defaults to the git toplevel. `--root`
selects the *repository*, `--lane` selects the *initiative inside it* — they are orthogonal and both
may appear. It exists so the bats tests can drive the whole lifecycle against
`tests/fixtures/develop/fake-phase/` while writing nothing outside it, and so the root-mode fixture
can be exercised without a second checkout. Lane resolution is anchored on `--root` when given, which
is what makes the root-mode golden reproducible.

## The grammar this phase writes (ADR-0100), by example

This is the contract the writer emits and the Phase-01 parser must accept. Detection is tolerant
(heading level, emphasis, surrounding whitespace); the value grammar is strict.

> The example's headings are shown **one level down** from what the real file uses, so that this
> example cannot masquerade as a section of this spec — a line-based reader splitting on `##` does
> not respect code fences, which is retro-log 2026-07-16's exact defect class. Heading *level* is
> noise to this grammar by design (ADR-0100 tolerant detection), so nothing depends on the shift.

```markdown
# Build Brief — phase 00 · Steel thread

spec-hash: sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
lane: develop
reqs: REQ-01, REQ-02, REQ-03, REQ-04
adrs: 0047, 0051, 0063, 0064, 0065, 0067, 0068
blast-radius: .claude/commands/arc-develop.md, .claude/scripts/develop/develop.mjs, products/develop/manifest.json
no-gos: Delivery-order layers 3-5, Full Context Pack retrieval, Evaluation-suite seeding, Approach sketches with economics fields, Every checkpoint health check that needs to understand code, Dogfooding on real phases, Promoting any gate to BLOCK

### Non-negotiables

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever (ADR-0105).
- (…the remaining 6 bullets, copied byte-for-byte from this spec's own closing block…)

### Predictions

likely-failure-mode: the ledger parser accepts what the writer emits and nothing else
likely-regression-site: lane echo ordering in root-mode output
riskiest-file: .claude/scripts/develop/ledger.mjs
expected-blockers: none
expected-proof-failures: the root-mode golden on the Windows leg

### Slices

#### slice: 01

title: ledger writer emits a brief header for a phase spec
kind: infra
risk: high
proof: unit — `bash tests/develop-lifecycle.bats -f "brief header"`
tier: unit
sources: phase-00-spec.md, ADR-0100
decision: —
result: (empty until proven)
commit: (empty until proven)
```

- **`spec-hash:`** is `sha256` over the **raw bytes** of `phase-NN-spec.md`, rendered
  `sha256:<lowercase hex>`. Phase 01's `brief-stale` BLOCK recomputes it and compares.
- **Prediction fields are exactly these five, in this order**, and they are the whole taxonomy:
  `likely-failure-mode`, `likely-regression-site`, `riskiest-file`, `expected-blockers`,
  `expected-proof-failures`.
- **A slice block** opens at a `slice:` heading carrying its id and runs to the next one. `result:`
  holds pasted proof output — multi-line output goes in a fence directly beneath it.
- **`kind:`** is one of `ui` / `external-dep` / `logic` / `infra` and drives Phase 01's tier floors.

### How each derived header field is computed

Every field is a deterministic function of files the executor can read. No judgement, no summarising.

- **`reqs:`** — the `REQ-NN` tokens on the phase spec's `Serves` line, in order.
- **`adrs:`** — **every** `ADR-NNNN` token appearing anywhere in the phase spec's text, deduped and
  sorted ascending, rendered as bare 4-digit numbers. All of them, including ones cited only in the
  non-negotiables block: an ADR the spec bothers to cite is context the executor needs. For this
  spec that is exactly `0047, 0051, 0063, 0064, 0065, 0067, 0068` — run the grep, do not curate.
- **`no-gos:`** — from the **lane's `PLAN.md`** `## No-gos` section (not this spec's "Out of scope",
  which is phase-local and different): take the first `**bold**` span of each bullet, strip trailing
  punctuation, join with commas. Every no-go bullet leads with a bold phrase precisely so this is
  mechanical; a bullet without one is a PLAN authoring error and the field records it as `(unnamed)`
  rather than guessing.
- **`non-negotiables:`** — copied byte-for-byte from **this spec's own** closing non-negotiables
  block (the last section in this file), never from PLAN directly. That block is already
  gate-verified against PLAN by kickoff-lint's `nonneg-drift`, so copying the verified copy means
  there is one drift check, not two.
  *(That heading's literal text is deliberately not quoted here: `nonneg-drift`'s regex is not
  line-anchored, so prose quoting the heading is picked up AS the heading and the gate then compares
  the wrong block. Found by this file. Logged for `/arc-change` — it is a hole in a shipped arc gate,
  not in this build.)*
- **`spec-hash:`** — see above.
- **`blast-radius:`** — see below.

### How `blast-radius:` is computed (the grep fallback)

Deterministic, no code graph, and **purely a filter — never a transformation**:

1. Collect every backtick-quoted path-like token in the phase spec's own text and in the
   `Measurable acceptance` cells of the REQs that spec serves.
2. Keep a token if `git ls-files` knows it, **or** if it sits under a directory `git ls-files`
   knows. Drop the rest.
3. Emit the survivors **verbatim, deduped, sorted ascending**. A surviving token is never rewritten,
   shortened, or collapsed to its parent directory — the directory test in step 2 decides whether a
   token lives, not what it turns into. Three implementers must produce byte-identical output.

Worked example — the fixture spec cites `` `.claude/scripts/develop/develop.mjs` `` and
`` `products/develop/manifest.json` ``. Neither file exists yet, but `.claude/scripts/` and
`products/` do, so both survive step 2 and appear whole in step 3. A token matching no known file and
no known directory is dropped and counted in the brief's footer, so a silently-empty blast radius is
visible rather than absent.

## Receipts: how they are emitted and where they land

```bash
bash .claude/scripts/hq/arc-event.sh emit develop.started \
  --payload '{"lane":"develop","phase":"00"}'
```

Events append to **`.claude/state/hq/events/<YYYY-MM-DD>.jsonl`** — one dated file per day, flat, not
a nested year/month/day tree. The spine root resolves to `.claude/state/hq` at the repo with both
`.claude/` and `.git/`, and `ARC_SPINE_ROOT` overrides it. Each line carries
`id · v · ts · idem · actor · process · model · venture · run_id · kind · payload · outcome · cost ·
evidence · supersedes`; the lane travels in `payload`, not in a dedicated column. The three kinds
this phase emits are `develop.started`, `slice.done`, `handoff.ready`.

## The manifest this phase ships

```json
{
  "name": "develop",
  "version": "0.1.0",
  "requires": ["core", "hq"],
  "commands": [".claude/commands/arc-develop.md"],
  "scripts": [
    ".claude/scripts/develop/develop.mjs",
    ".claude/scripts/develop/ledger.mjs"
  ],
  "files": [],
  "docs": []
}
```

Shape copied from `products/design/manifest.json`, which is the live precedent `product-lint.mjs`
already accepts. Run the lint after writing it rather than trusting this example.

## Exit criteria (Definition of Done)

- [ ] `start → next → status → handoff` runs end-to-end on `tests/fixtures/develop/fake-phase/` with
      no network and no repo state outside the fixture
- [ ] `phase-NN-tasks.md` is written with a Build Brief header (REQs · non-negotiables · no-gos · ADR
      list · grep-based blast radius · 5-field prediction block · the **spec hash** Phase 01's
      `brief-stale` BLOCK checks against) and 5 slice blocks, each with `proof:`, `tier:` and `kind:`
- [ ] `--lane` is the only lane input: an unknown lane exits 4, lists known lanes and creates nothing;
      a bare first argument is read as the mode/phase, never as a lane
- [ ] the root-mode fixture's output is byte-identical to its recorded golden
- [ ] `develop.started`, `slice.done`, `handoff.ready` land on the spine carrying the lane; a spine
      failure leaves the command's exit code unchanged
- [ ] `status` reconstructs position from committed files alone, with no session context
- [ ] **the writer never destroys committed truth:** `start` against a ledger holding ≥1 proven slice
      exits non-zero and writes nothing, and any write that finds the ledger changed underneath it
      since it was read exits non-zero instead of overwriting. Two sessions in one working tree is a
      real condition here, not a hypothetical, and ADR-0102 puts proof-to-commit SHAs in that file
- [ ] tests added & green: `bash tests/develop-lifecycle.bats` on all 3 CI legs
- [ ] `tests/fixtures/sync-golden/tree-manifest.txt` regenerated as a named step — delta diffed
      first, only intended paths confirmed moved (retro-log 2026-07-22)
- [ ] `node .claude/scripts/core/product-lint.mjs` passes with the new `develop` manifest
- [ ] `.github/workflows/ci.yml`'s hand-maintained test-count floor is raised to cover the new
      `@test` lines — raised to match reality, never lowered to make a red build green
- [ ] root `CLAUDE.md` gains `/arc-develop` in `## Commands`, and its "only the five command lines
      showing `[--lane <name>]`" sentence becomes six — a lane surface the root file does not know
      about is exactly the count-rot drift retro-log 2026-07-22 records
- [ ] tracker updated — in **`initiatives/develop/PROGRESS.md`**: the phase-00 row's `Status` cell in
      the `## Phase table` becomes `✅ done YYYY-MM-DD`, a line is appended under `## Done log`, the
      `burn:` machine-header key and the appetite-burn line are recalculated, and `## Now` is rewritten
      to point at Phase 01. `PORTFOLIO.md`'s develop row derives from that header — never hand-edit
      the board independently (ADR-0051), and re-run `board-lint.sh` after

## Verification plan

- **Test command:** `bash tests/develop-lifecycle.bats`
- **Expected failure first:** `not ok 1 start writes a brief and a slice ledger for the fake phase` —
  fails before any code with `Error: Cannot find module '.claude/scripts/develop/develop.mjs'`. The
  second red is `not ok 4 unknown lane exits 4 and creates nothing`, which must fail with exit 127
  (script absent) rather than 4, proving the assertion reads the real exit code and not a default.
- **Live demo scenario:** from a clean tree, with `FX=tests/fixtures/develop/fake-phase`, run each of
  `start 0`, `next`, `status`, `handoff 0` as
  `node .claude/scripts/develop/develop.mjs <mode> --lane develop --root "$FX"` — **every mode takes
  both flags on every call**; neither is remembered between invocations, because `status` must work
  cold. Expected: `status` prints `develop · develop · phase 00 · slice 0/5` (nothing is proven yet —
  the session has not implemented anything), and `git status` shows changes confined to the fixture
  directory. Then repeat `status` against `fake-phase-midway` and expect `slice 2/5` with next
  unproven `03`.
- **Real-system check:** n/a — fixtures only this phase, by design (offline-first). The one live-repo
  touch is the spine: confirm a `develop.started` line appears in
  `.claude/state/hq/events/<today>.jsonl` with `"lane":"develop"` in its `payload`. To prove the
  write failure is survivable **portably on all 3 legs**, set `ARC_SPINE_ROOT` to a path that is an
  existing **regular file** — the write then fails identically on ubuntu, macos and windows, with no
  `chmod` and no permission-model differences. Assert the command's exit code is unchanged.
- **Expected evidence:** bats output for all 3 legs, the written `phase-00-tasks.md` pasted in full,
  the root-mode golden diff showing zero bytes changed, and the spine JSONL lines.

## Rabbit holes in this phase

- **Making the ledger parser bulletproof here.** It is Phase 01's job with Phase 01's adversarial
  budget. Phase 00's parser only needs to read what Phase 00's writer wrote.
- **A pretty statusline.** One line, the format the design source names (`develop · <lane> · phase 02
  · slice 4/9`), nothing more.
- **Teaching `lane-resolve` about the `develop` surface** — ADR-0105 says ride the generic `--for`
  path. If a test seems to need a resolver edit, that is assumption #1 failing: stop and say so.
- **Designing the prediction taxonomy.** 5 fixed fields from the design source §5.1, written as a
  template. No scoring logic here — that is Phase 02.

## Out of scope for this phase

- `develop-lint` and every gate → Phase 01.
- Prediction *scoring* and the `spec-fidelity` agent → Phase 02.
- Real `checkpoint` checks, stuck backstops, debt ledger → Phase 03.
- Anything in the PLAN's `## No-gos`.

## Your-setup / pending

Nothing. No keys, no accounts, no network. The phase runs on a committed fixture by construction.

**Tripwire:** at 2.0 days inside this phase, cut the Build Brief to the grep blast radius plus the ADR
list only, and defer the `checkpoint` stub to Phase 03. Read this line when the phase starts, not
after it (Cycle 4's tripwire fired and was never applied).

## Non-negotiables (verbatim from PLAN)

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever (ADR-0105).
- develop never closes a phase, never intakes scope and never creates a lane — `/arc-phase-done`, `/arc-change` and `/arc-kickoff` keep those jobs.
- Every slice declares its acceptance proof BEFORE implementation; `proof: none` is not a slice (ADR-0100).
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in a ledger row is a lint finding (ADR-0101).
- Any gate, lint or parser this build ships gets an adversarial construct-a-breaking-input pass in the same section that ships it, with every hole pinned as a fixture.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion.
- The whole lifecycle runs offline on a committed fixture; `--lane` is the only lane input and root-mode output stays byte-identical (ADR-0104).
