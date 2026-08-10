# Phase 01 — study harness, hostile-input-first

**Goal (one line):** `/arc-absorb` studies a pinned source and emits a classified extraction report
**without ever executing what it read** — and that boundary is proven by fixtures that would catch
its absence, or the cycle STOPs.
**Appetite:** 2 days — blown appetite means cut scope or kill, never extend silently
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] **`/arc-absorb` read-only pipeline works end-to-end** on a pinned source (local clone, docs set
      or transcript): source pin recorded (commit or date) → files read → technique inventory →
      per-row ABSORB/INTEGRATE/ROUTE/SKIP verdict with reason → `extraction-report.md` in the
      ADR-0601 shape, passing `report-lint` with zero warnings.
- [ ] **The no-execution boundary is fixture-proven** — see the Verification plan. Proven means a
      fixture exists that FAILS if the boundary is removed. **If this cannot be achieved, the phase
      STOPs the cycle** (PLAN kill criterion): an unprovable boundary is a no, not a risk to accept.
- [ ] **Injection red corpus pinned** at `tests/fixtures/absorb/hostile/` with an `INDEX` carrying
      one row per family, its class, and its expected outcome — so adding a fixture needs no new
      test code. Families required at minimum: instruction-injection in a README · a prompt file
      posing as harness instructions · frontmatter forging a tool grant (the engine pass's real
      finding, same class) · path traversal in a documented file path · a symlink escaping the
      study root · an oversized or binary file where text is expected.
- [ ] **Every hostile fixture's outcome is REFUSE, QUARANTINE, or QUOTE-INERT with a reason, never
      silent tolerance** — and the recorded outcome is asserted, not merely the absence of a crash.
      **QUOTE-INERT is the instruction-injection family's legal outcome:** the string is included
      verbatim in the report as content attributed to its source file, and the harness's own
      behaviour is provably unchanged. Without that third value the demo's own injection outcome
      (step 3 below) has no verdict the INDEX is permitted to record, which would force a real
      result to be filed under a word that does not fit.
- [ ] **Adversarial pass run and its holes fixed** — **two fresh agents on different surfaces**
      (one on the classification and report logic, one on the shell and filesystem boundary), each
      unanchored to the implementation. Their prompts carry this lane's running list of
      already-fixed defects with the instruction to check each one in every other file. Every hole
      found lands as a pinned regression fixture. **This pass is untouchable within this phase** —
      it is not the slack, and it is not cut.
- [ ] tests added and **green on CI**, per-JOB conclusions read
- [ ] every new test file asserts its own registered test count from `BATS_TEST_NAMES`; all `@test`
      names ASCII-only
- [ ] tracker updated (PROGRESS.md row and done-log)

## Verification plan

- **Test command:** `bats tests/absorb-study-boundary.bats` then `bats tests/absorb-hostile.bats`
  — one file at a time, foreground; **CI is the gate**. Scope lines, so nothing is written twice or
  nowhere: `absorb-study-boundary.bats` = the no-execution proof and its positive control, plus the
  study root confinement (symlink, traversal, absolute path); `absorb-hostile.bats` = the **corpus
  driver only**, walking `tests/fixtures/absorb/hostile/INDEX`, routing each fixture by its declared
  family and asserting the recorded outcome.
- **Expected failure first:** `bats tests/absorb-study-boundary.bats` fails on its first case,
  `@test "studying a source whose preinstall writes a sentinel leaves no sentinel"`, with
  `command not found` on the study entry point and status `127` — the harness does not exist yet.
  **The case is built so it cannot pass vacuously, and this is the phase's whole point:** the
  fixture source carries (a) a `package.json` with a `preinstall` that writes `SENTINEL-A`, and
  (b) a module that writes `SENTINEL-B` at import time. The test asserts **three** things
  together — no `SENTINEL-A`, no `SENTINEL-B`, **and** that the study actually ran and produced a
  report naming both files in its inventory. Absence alone would pass on a harness that read
  nothing at all, which is exactly the failure class the repo has shipped before.
  **The positive control is mandatory and is a separate test:**
  `@test "the sentinel fixtures really do write when executed directly"` runs the preinstall and
  imports the module **outside** the study path in a temp tree, and asserts both sentinels DO
  appear. Without it, "no sentinel" is indistinguishable from a broken sentinel, and the boundary
  proof would be a tautology. **The negative control is THREE mutants, one per verb the DoD itself
  bans ("no install, no import, no eval") — not one:**
  `@test "a study harness that shells out to npm install fails this suite"`,
  `@test "a study harness that require()s or import()s a discovered file fails this suite"`, and
  `@test "a study harness that eval()s or Function()-constructs discovered content fails this suite"`
  each point the suite at a mutant built for that single verb and assert the suite REJECTS it. A
  harness that `require()`s a discovered module in order to classify it is a **plausible
  implementation choice, not an exotic attack** — it would write SENTINEL-B and still pass a suite
  whose only mutant covers the install path, leaving two of three removal modes asserted by nothing
  but the main test's assumed correctness. That is the vacuous-pass shape this phase exists to
  refuse. A grep for `child_process` is never the guard where these mutants can run.
- **Live demo scenario:** (1) `/arc-absorb` against a pinned local source → prints the pin, the
  files read, the inventory with one verdict per row, and the report path; `report-lint` on that
  report → `0 warnings`. (2) Re-run against the sentinel fixture source → report produced,
  inventory names the hostile files, and `ls` of the temp tree shows neither sentinel.
  (3) Run against the README carrying an instruction-injection string → the string appears in the
  report **as quoted studied content attributed to its file**, and the harness's own behaviour is
  unchanged; the INDEX row for that family records the outcome. (4) Run against a source containing
  a symlink pointing outside the study root → refused with a reason naming the escape, and nothing
  outside the root is read. (5) Point the study at a source needing more than the archaeology budget
  → a SKIP row with its reason, and no partial inventory.
- **Real-system check:** the boundary fixtures create **real filesystem objects** in a temp tree —
  a real `package.json` with a real `preinstall`, a real importable module, a real symlink. A
  string-only test of a no-execution rule is the vacuous pass this phase exists to prevent. No
  network is used at any point: the source is pinned and fetched **before** study begins, and the
  study path itself has no network step to test.
- **Expected evidence:** CI job output for both bats files with asserted test counts ·
  `tests/fixtures/absorb/hostile/INDEX` with one row per family, its class and expected outcome ·
  the two adversarial agents' findings lists, each hole naming its regression fixture ·
  the demo's five report outputs and the temp-tree listing showing no sentinels ·
  all committed under `initiatives/absorb/evidence/phase-01/`.

## Rabbit holes in this phase

- **Sandboxing as a substitute for not executing.** The rule is that studied code never runs, not
  that it runs somewhere safe. A container is a bigger project and a weaker promise.
- **Perfecting the classifier.** Four buckets, one reason per row. A finding that fits no bucket is
  recorded as such in the report (assumptions ledger row 2) and extends the matrix by ADR later —
  never shoehorned mid-study.
- **Growing the hostile corpus without bound.** The families listed in the exit criteria are the
  bar. New families come from what the adversarial pass actually finds, not from imagination.
- **Letting the adversarial pass slip to Phase 2.** It is inside this phase's appetite and inside
  its exit criteria. A phase that ships its gate unattacked has not shipped its gate.

## Out of scope for this phase

The registry's status lint, cap and displacement (Phase 2) · the allowlist lint and the license and
attribution gate (Phase 2) · the owner-judge profile and inbox chain (Phase 3) · any rebuild, A/B or
adoption (Phase 4). This phase reads and reports; it changes no arc file outside its own harness.

## Your-setup / pending

Nothing. The ADR-0606 first target is readable locally, so no credentials, network access or
accounts are needed. If a later source needs fetching, the fetch happens before study and is
pinned — it is not part of the study path.

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
