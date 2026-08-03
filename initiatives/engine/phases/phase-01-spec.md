# Phase 01 — The proof: 3/3 byte-identical, then the flip

**Goal (one line):** `arc-compile --target claude-code` reproduces all three pilot command files
byte-identical to their `7abeda1` baseline; only then does `processes/` become source of truth, the
DO-NOT-EDIT header lands as its own commit, and a second dialect (`--target codex`) ships with
recorded goldens.

**Appetite:** 3 days
**Depends on:** phase-00

Serves **REQ-02** (compile, don't rewrite — proven) and **REQ-03** (a second dialect exists).

## Why this phase is the heart

Everything after it assumes the canonical files are the truth. That assumption is only earned by
the byte-diff, and ADR-0202 fixes exactly what the byte-diff is: a **migration** gate that proves
the move lost nothing, retired at the flip. It is not a permanent regression check, and it never
becomes one.

The 8-day kill criterion reads off this phase. If REQ-02 is not proven by then, the compile approach
is wrong for this codebase, and `process-lint` plus the canonical files are banked as documentation.

## What this phase actually builds

- `.claude/scripts/engine/arc-compile.mjs` — reads a canonical file, writes a dialect file.
  `--target claude-code|codex`, `--check` (compare without writing), `--all`.
- `.claude/scripts/engine/adapters/claude-code.mjs` and `adapters/codex.mjs` — **pure functions**
  `canonical → text` (ADR-0201): no clock, no randomness, no environment reads, no filesystem
  access of their own. `arc-compile` does the reading and writing; adapters transform strings. That
  purity is what makes the byte-diff a measurement rather than a coincidence.
- Each adapter owns its **tool mapping table** — the seven abstract primitives to that dialect's
  permission syntax. For claude-code: `git.op` and `shell.run` render into the `allowed-tools`
  line's `Bash(...)` entries, `agent.invoke` renders `Task`, `fs.write` renders `Write`. The table
  is data in one file, reviewed once, never scattered through the renderer.
- **The `allowed-tools:` line is emitted only when the process says `permissions: declared`.**
  Verified at `7abeda1`: `arc-kickoff.md` has no such line (it and `arc-develop.md` are the only 2
  of 24 without one), so an unconditional derivation adds a line the baseline lacks and fails the
  byte-diff structurally. `commit-msg-draft` and `review-diff` are `declared`; `kickoff-plan` is
  `unrestricted`. A test asserts the `unrestricted` path emits **no** `allowed-tools:` line at all —
  a negative assertion, because "the line is correct" and "the line is absent" are different claims
  and only one of them is what `arc-kickoff` needs.
- **The LF-only check, as a shipped artifact.** `process-lint` gains a named check asserting every
  generated file is LF-only, with a **negative control fixture** — one generated file seeded with a
  CRLF line — proving the check can fail. This is not a footnote to the byte-diff: the byte-diff
  deletes line-ending information by design (below), so if this check does not actually ship, a
  Windows-only CRLF regression passes 3/3 and reaches a generated pilot. A compensating instrument
  that exists only in prose is the `design-render.sh` Arial pin all over again (retro-log
  2026-07-30).
- `tests/fixtures/engine/goldens/codex/` — one recorded golden per pilot (REQ-03).
- `tests/engine-compile.bats` — the phase's proof.

## The byte-diff, exactly

1. Render the canonical file through the claude-code adapter.
2. LF-normalise **both** sides: `\r\n` and a lone trailing `\r` collapse to `\n`.
3. Compare bytes. Any difference fails, and the failure prints the first differing byte offset plus
   16 bytes of context either side — a diff that says only "files differ" costs an hour per round.

**What normalisation destroys, and what covers it.** LF-normalising deletes line-ending
information, which is precisely what a Windows leg would differ on — the retro-log 2026-07-30
pattern where a transform added for measurement removes the property being measured. So line
endings are measured by a *different* instrument: `process-lint` asserts every generated file is
LF-only, as its own named check with its own message. One instrument measures content, another
measures line endings, and neither is asked to do the other's job.

**The pre-existing second check.** All 3 pilots are hashed in
`tests/fixtures/sync-golden/tree-manifest.txt` (lines 32, 41, 47). A byte-identical regeneration
moves **zero** hashes there. That gate already runs in CI and was not built for this — which is
what makes it a genuinely independent confirmation of REQ-02 rather than a restatement of it.

## Ordering: the header lands after the proof, never before

REQ-02 measures against the *current hand-written* files, which carry no DO-NOT-EDIT header.
Emitting the header during the proof would make the proof unreachable by construction. So:

1. **Prove** — `arc-compile --check --all --target claude-code` reports 3/3 identical. Nothing is
   written. `tree-manifest.txt` is untouched.
2. **Flip** — `processes/` is declared source of truth. Recorded in `PROGRESS.md`'s done-log.
3. **Header** — a separate commit adds the DO-NOT-EDIT header (naming the canonical source and the
   regeneration command) to the 3 generated files. This moves exactly 3 hashes: diff the delta
   first, confirm only those 3 paths moved, re-record, and name the change in the commit message
   (retro-log 2026-07-22).

Hand-edit detection is by **content hash recorded beside the generated file**, not by reading the
header — an edit that also deletes the header must still be caught, and a check that trusts the
marker it polices catches only honest mistakes (ADR-0201). WARN-first, promoted per
`docs/trial-ledger.md`.

## The codex target, and what it is allowed to fail at

`--target codex` renders the same shared `body:` (ADR-0205) with codex-dialect frontmatter and its
own tool mapping. `agent.invoke` is the known hard case: ADR-0206 leaves it deliberately coarse, and
if the codex dialect has no delegation form, the adapter **fails the compile with a named message**
rather than emitting something that superficially resembles a working command. That failure is a
fact worth surfacing — REQ-03 passing mechanically while failing its intent is the outcome to
avoid.

Goldens are recorded, and `process-lint` FAILs on a golden that changed without a reviewed diff —
the existing golden-fixture rule extended, not a new mechanism.

## If a residue appears (assumption A-02)

If a pilot cannot reach byte-identical because some bytes are producible from no shared body:
**name the residue, measure it in bytes and lines, and record it** — most likely in `arc-kickoff.md`
at 132 lines. ADR-0205's revisit trigger then decides between a bounded per-target field and
declaring that pilot non-migratable. Do not invent a passthrough field to make the number go green;
that is the hollowing-out ADR-0205 exists to prevent, and a documented canonical file beside a
hand-written dialect file is value the kill criteria already bank.

## Exit criteria (Definition of Done)

- [ ] `arc-compile --check --all --target claude-code` reports **3/3 byte-identical**, or the
      residue is named, measured and adjudicated under ADR-0205's revisit trigger
- [ ] `tree-manifest.txt` shows **zero** hashes moved for the 3 pilot paths during the proof step
- [ ] adapters are pure: a test runs each twice and asserts identical output, and asserts neither
      reads the clock, the environment, or the filesystem
- [ ] source of truth flipped, recorded in the done-log; THEN the DO-NOT-EDIT header lands in its
      own commit moving exactly 3 manifest hashes, delta diffed first
- [ ] hand-edit detection FAILs on a generated file mutated with its header intact **and** on one
      mutated with its header deleted
- [ ] **the LF-only check ships and is proven to fail**: `process-lint` FAILs on the CRLF-seeded
      negative-control fixture and passes on the real generated files — REQ-02 is not claimed proven
      until this exists, because the byte-diff cannot see what it normalised away
- [ ] `--target codex` emits all 3 pilots or names the exact construct it cannot express; goldens
      recorded under `tests/fixtures/engine/goldens/codex/`; `process-lint` FAILs on an unrecorded
      golden change
- [ ] regenerating any file under `tests/fixtures/engine/goldens/codex/` is a named step in its own
      right — delta diffed first, only the intended pilots confirmed to have moved, re-recorded in
      the same commit as the adapter change that caused it. The same discipline `tree-manifest.txt`
      already gets, extended to this cycle's new golden set, because a second golden mechanism born
      in the same phase that regenerates the first one is how a hash moves without anyone deciding
      it should (retro-log 2026-07-22)
- [ ] the fresh-agent adversarial pass has run against `arc-compile` and both adapters, findings
      fixed and pinned
- [ ] tests added and green: `bash tests/engine-compile.bats` on all 3 CI legs
- [ ] CI test-count floor raised to match the new `@test` lines
- [ ] tracker updated in `initiatives/engine/PROGRESS.md` (row, done-log, `burn:`, `## Now`), and
      `board-lint.sh` re-run

## Verification plan

- **Test command:** `bash tests/engine-compile.bats`
- **Expected failure first:** `not ok 1 claude-code target reproduces arc-commit.md byte-identical`
  — fails before any code with `Error: Cannot find module '.claude/scripts/engine/arc-compile.mjs'`.
  The second red is `not ok 4 adapter output is identical across two runs`, which must fail with
  exit 127 rather than a passing comparison of two empty strings — an equality test over two
  absent outputs passes for the wrong reason, and that is the failure this red is written to catch.
- **Live demo scenario:** run `node .claude/scripts/engine/arc-compile.mjs --check --all --target claude-code`
  and expect `3/3 identical` on stdout with exit 0. Mutate one byte of
  `processes/commit-msg-draft.process.yaml`'s `body:` and re-run: expect exit 1 naming the byte
  offset and 16 bytes of context. Then run `bash tests/sync.bats` and confirm the two
  byte-identity tests at lines 66 and 73 (`bare install is byte-identical to the golden fixture`,
  rsync and cp-r paths) still pass — they `diff` a freshly generated manifest against
  `tests/fixtures/sync-golden/tree-manifest.txt`, so zero moved paths means those two stay green.
  There is **no** `sync-golden.sh`; `tests/sync.bats` is the whole of the manifest verifier, and
  naming a script that does not exist is how a stated control becomes no control at all.
- **Real-system check:** the generated files are compared against the live
  `.claude/commands/*.md` at `7abeda1` — this is the one phase whose subject IS the real repo. The
  comparison reads the files; it must not write them until the flip step.
- **Expected evidence:** bats output for all 3 CI legs, the `--check --all` output showing 3/3, the
  manifest delta for the header commit showing exactly 3 paths, the three codex goldens, and the
  adversarial report.

## Rabbit holes in this phase

- **Chasing the last few bytes of `arc-kickoff.md`.** The tripwire below exists for this. A named
  residue is a result under ADR-0205, not a failure to grind at.
- **Making the codex output good.** It must be runnable and recorded, not admired. Driver feature
  parity is a declared rabbit hole; the output contract is the equalizer.
- **Keeping the byte-diff alive as a regression gate.** ADR-0202 retires it at the flip. Reviving it
  freezes the pilots against improvement.
- **Prettifying the adapter's rendering.** Byte-identical is the only aesthetic that matters here.

## Out of scope for this phase

- `arc-run`, drivers, budgets, escalation, `router.yaml`, secret scrubbing → Phase 02.
- Real runs, the 4th-driver timing, lint promotions → Phase 03.
- Canonicalizing any of the 21 non-pilot commands, ever this cycle.
- Anything in the PLAN's `## No-gos`.

## Your-setup / pending

Nothing new. The codex adapter is written and golden-recorded without the `codex` binary being
installed — running it is Phase 02's driver work.

**Tripwire:** at 2.0 days inside this phase, if `arc-kickoff` is not byte-identical, freeze it as a
named residue, ship the flip for the two pilots that are, and carry the third as an A-02 finding
into the retro. Read this line when the phase starts, not after it.

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
