# Phase 02 — registry and guards

**Goal (one line):** the registry becomes enforceable — cap, displacement and decision-ref
transitions are lint-checked, the rebuild allowlist is machine-readable, and the license and
attribution rule has a gate instead of a good intention.
**Appetite:** 1 day — blown appetite means cut scope or kill, never extend silently
**Depends on:** phase-01

## Exit criteria (Definition of Done)

- [ ] **Registry status lint live** (WARN-first in TRIAL): valid status enum · the **12-adopted cap
      per lane** counted from the file · an adoption at the cap that names no displacement warns ·
      a transition to `adopted` or `retired` with no `decision.recorded` ref warns (REQ-04, REQ-07).
- [ ] **A registry row carrying its own pin or hash field warns** — pin, hash, provenance and
      publisher-auth live only in `capability-lock.json`, and the row references it (A5, ADR-0600).
- [ ] **ADR-0602 allowlist lint live** (WARN-first): the allowlist is read from **one**
      lint-readable list generated from ADR-0602, never retyped; a rebuild diff touching a path
      outside it warns and names the path.
- [ ] **License and attribution gate live:** a rebuild derived from a permissive-license source with
      no `attribution` field in its registry row, or no source comment in the rebuilt file, warns
      and names which of the two is missing. An incompatible-license source produces a **refusal
      row** with its reason, and the refusal is not deletable (A10).
- [ ] **Zero-new-dependency fixture, parse-based and never grep-based:** the fixture parses the
      rebuild diff (AST, or resolving the diffed files through Node's own module resolver) to
      enumerate every `import`, `require()`, dynamic `import()` and string-built specifier, plus a
      separate check for install and exec invocations, and fails on any new runtime dependency
      (REQ-02). **A grep-only implementation is refused by this repo's own history** —
      `docs/retro-log.md`, 2026-08-04, arc-evolve: a propose-only grep guard missed `from "fs"`,
      `fs/promises`, `child_process` and async exec/spawn, and a mutant module walked straight past
      it. The negative-control mutant here must add its dependency through **one of those exact
      missed forms**.
- [ ] **`initiatives/absorb/evidence/planoff/` PLANOFF skeleton committed** (**ADR-0605 A1** moved it during this phase; the criterion as written named the frozen `docs/evidence/**`, and the phase closed against the lane path) — protocol, scoring and RESULTS layout
      plus an append-only `LEDGER.md` with its header and zero rows, mirroring
      `docs/evidence/planner-bench/` rather than reinventing it (ADR-0605).
- [ ] **Every lint added here has a negative control that RUNS a mutant** built to walk past it, and
      each asserts the check ran before asserting what it reported.
- [ ] **Adversarial pass on this phase's gates** — a fresh agent, unanchored, prompt carrying the
      lane's running list of already-fixed defects with the instruction to check each one in every
      other file. Holes fixed and pinned as fixtures.
- [ ] tests added and **green on CI**, per-JOB conclusions read; test counts asserted; `@test` names
      ASCII-only
- [ ] tracker updated (PROGRESS.md row and done-log)

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts (detailed verification
for a far-future phase is fiction): bats coverage over the registry lint, the allowlist lint and the
license gate — each with a mutant negative control — plus a live demo walking a registry from
`candidate` to `adopted` at the cap and showing the displacement and decision-ref warnings by name.

## Rabbit holes in this phase

- **Making the cap configurable.** It is 12 by ADR-0600 and the assumptions ledger tests the size.
  A knob would make the bet unfalsifiable.
- **A license classifier.** The gate checks that attribution exists where the row says the license
  is permissive, and that a refusal row exists where it is not. Deciding license compatibility
  itself stays a recorded human call.
- **Promoting these lints to FAIL because they look ready.** WARN-first in TRIAL by rule; promotion
  is a `/arc-retro` decision against `docs/trial-ledger.md`.

## Out of scope for this phase

The owner-judge profile and the inbox chain (Phase 3) · the `PLAN-develop` addendum (Phase 3) · any
real study, rebuild or A/B (Phase 4). This phase builds guards and fills no registry rows with real
techniques.

## Your-setup / pending

Nothing. Zero-dep Node, local fixtures, no network.

## Non-negotiables (verbatim from PLAN)

- Study is read-only and injection-aware: studied READMEs, prompts and transcripts are hostile input, so parser-class discipline applies from birth with pinned red fixtures and an adversarial pass before any FAIL promotion.
- Studied code never executes during study — no install, no import, no eval; execution happens only through vetted paths after a rebuild.
- Zero new event kinds; ADR-0603 is a payload profile only, and the closed spine vocabulary is not extended by this cycle.
- License hygiene: re-express ideas, refuse incompatible copies and record the refusal, attribute permissive copies in both the registry row and the rebuilt file.
- Propose-only in both directions: adoption and retirement each end in the inbox, and no self-adoption path exists.
- Rebuilds land only on the ADR-0602 allowlist; arbitrary paths are never a rebuild target.
- Zero-dep Node and POSIX (A2); tests stay centralised at `tests/` (ADR-0021); every new lint ships WARN-first in TRIAL and is promoted only by `/arc-retro`.
- Never delete: SKIPped sources and retired techniques keep their registry rows and reports (A10).
- A gate, lint or parser is not done until a fresh adversarial pass has attacked it and the found holes are fixed and pinned as fixtures — and the pass attacks the TEST that protects the rule, not only the rule.
- Constitution articles upheld: E3, A2, A5, A9, A10. **A8 is the exception and is not claimed as upheld** — this cycle runs under ADR-0074's recorded reading that lexos, running a root-mode arc install, pulls arc's completion; that tension is flagged for the owner and only he may resolve it.
