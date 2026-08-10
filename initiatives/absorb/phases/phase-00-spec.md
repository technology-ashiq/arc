# Phase 00 — the matrix and its paperwork (steel thread)

**Goal (one line):** a named source produces a lint-verdicted extraction report — the thinnest
end-to-end slice of the refinery's paperwork spine, with the DEV-B/C boundary audited first so the
registry references a real contract rather than a remembered one.
**Appetite:** 1 day — blown appetite means cut scope or kill, never extend silently
**Depends on:** none

## Exit criteria (Definition of Done)

- [ ] **DEV-B/C boundary audit committed** as `initiatives/absorb/evidence/phase-00/dev-bc-audit.md`:
      what develop C6 actually shipped, read from the tree. **The three inputs, each by path:**
      (a) `.claude/scripts/develop/capability-lock.json` — the exact row contract, every field, which
      are required and which are nullable; (b) `.claude/scripts/develop/capability-vet.sh` — its
      refusal conditions and which are BLOCK versus WARN; (c)
      **`.claude/agents/capability-scout.md`** — the Capability Proposal table's columns and its
      verdict set. Every claim cites `file:line`.
      **Known before the audit starts, and it must be confirmed or corrected rather than
      rediscovered:** the scout's verdict set is `worth vetting` / `refused here` / `unknown` —
      **there is no `technique` value**, so ADR-0604's "a Capability Proposal returning technique
      refers here" currently has nothing to hook into. The audit states this as a finding, and it is
      what REQ-05's verdict-set clause exists to close in Phase 3.
      **Any place the audit contradicts what ADR-0600 or ADR-0604 assumed is named explicitly**, and
      the ADR gets an amendment note rather than a silent reinterpretation.
- [ ] **ADR-0600's registry reference format finalized against that audit** — the field the registry
      row uses to point at a lock entry is named and justified by the audit's finding, and
      `products/absorb/registry.json` exists carrying its `$comment` schema and **zero rows**
      (ADR-0606: empty seed). **Top-level shape, pinned so Phase 2 does not have to guess:**
      `{ "$comment": "...", "techniques": [] }` — the row array key is `techniques`. The `$comment`
      lists the full REQ-04 field set, even though only the lock-reference field's lint exists this
      phase; a schema that describes less than the row shape it will hold is a schema that lies.
      Any mutant or malformed fixture used by a negative control in this phase lives under
      `tests/fixtures/absorb/`.
- [ ] **ADR-0601's report template committed** at `products/absorb/templates/extraction-report.md`.
      **The five required headings, verbatim and in this order:** `## Source` · `## Study scope` ·
      `## Technique inventory` · `## Verdict summary` · `## SKIP and refusal log`.
      **The inventory table's columns, verbatim:** `| id | name | what it does | why it wins |
      citation | verdict | reason | license note | risk note |`. **`id` format:** `T-01`, `T-02`,
      zero-padded and unique within one report — it is the string a `report-lint` warning must name
      when it reports a row.
      **The three fields `report-lint` checks per row in this phase** (the rest are Phase 2, per the
      cut order below): `citation`, `license note`, `verdict`.
- [ ] **`report-lint` exists** at `.claude/scripts/absorb/report-lint.mjs`, WARN-first in TRIAL, and
      validates the five required headings plus the three per-row fields above. It is registered in
      `docs/trial-ledger.md`, appending a row in **that file's existing schema —
      `| date | gate | run-ref | fired? | false-positive? |`** — never a new schema of its own.
- [ ] **The `capability-lock.json` contract test lands here, not later** (PLAN External dependencies
      assigns it to Phase 0): `tests/absorb-registry-ref.bats` asserts the registry's
      lock-reference field round-trips against **both** a fixture lock file at
      `tests/fixtures/absorb/lock-fixture.json` carrying a synthetic row **and** the real
      `.claude/scripts/develop/capability-lock.json`. Two sources, because a fixture-only test cannot
      see develop reshaping the real file, and a real-file-only test cannot construct the edge rows.
- [ ] **Steel thread demonstrated end-to-end:** a hand-written minimal report for one named source
      goes in, `report-lint` returns a verdict naming each missing field, and the verdict is the
      committed evidence.
- [ ] **The kickoff ADRs are VERIFIED here, not authored here.** ADR-0074 and ADR-0600 through
      ADR-0606 were written at kickoff and are already `accepted`; the century was claimed at kickoff
      by taking the `0600–0699` row in `PORTFOLIO.md`'s band table. Phase 0's job is to confirm all
      eight files exist, that `kickoff-lint --lane absorb` still passes, and that no file outside
      `0600–0699` was written by this lane. **Phase 0 authors no ADR** unless the audit contradicts
      one, in which case it adds an amendment note to that file.
- [ ] tests added and **green on CI** (never run the suite on this box) — CI is
      `.github/workflows/ci.yml`, triggered by pushing the branch and opening a PR, and the verdict
      is read with `gh run view --json jobs` **per JOB conclusion**, never from `gh run watch
      --exit-status`, which has already exited 0 on a run whose conclusion was `failure`
- [ ] every new test file asserts its own registered test count from `BATS_TEST_NAMES`, and every
      `@test` name is ASCII-only
- [ ] tracker updated: the Phases-table row in **`initiatives/absorb/PROGRESS.md`** flips to ✅, a
      dated line is appended to that file's **`## Done-log`** section, and its **`## Now`** block is
      rewritten to name the next step. The machine header's `phase:` and `burn:` are updated in the
      same edit, because `PORTFOLIO.md` derives from that header

## Verification plan

- **Test command:** `bats tests/absorb-report-lint.bats` then `bats tests/absorb-registry-ref.bats`
  — one file at a time, foreground; **CI is the gate** (`.claude/rules/testing.md`), specifically
  `.github/workflows/ci.yml`, read per JOB conclusion via `gh run view --json jobs`. One scope line
  each, so nothing is written twice or nowhere: `absorb-report-lint.bats` covers the five heading
  checks, the three per-row field checks, the WARN-first exit contract, and the mutant negative
  control; `absorb-registry-ref.bats` covers only the lock-reference round-trip, against the fixture
  lock file and the real one.
- **Expected failure first:** `bats tests/absorb-report-lint.bats` fails on its first case,
  `@test "report-lint names every missing required heading"`, with
  `node: cannot find module '.claude/scripts/absorb/report-lint.mjs'` and status `127` — neither the
  lint nor the template exists yet. **The second red is the one that matters:**
  `@test "report-lint warns on an inventory row with no license note"` feeds a report that is
  complete except for one row's license field and asserts the warning text **names that field and
  that row id**. It fails before the field loop exists, and once it passes it cannot pass
  vacuously — a lint that skipped the row could not name it. **Third red, the negative control:**
  `@test "a report-lint that returns a fixed empty warning list fails this suite"` runs a mutant
  copy that hardcodes zero warnings against the same malformed input and asserts the suite REJECTS
  it. WARN-first means exit 0 on a bad report, so exit code proves nothing here — the assertions
  are on the warning payload, and this control is what makes that falsifiable.
  **`absorb-registry-ref.bats`'s red:** `@test "a registry row's lock reference resolves in the real
  lock file"` fails with `no such file` on `products/absorb/registry.json` before the registry
  exists, and its non-vacuous sibling
  `@test "a registry row referencing a name absent from the lock is reported"` asserts the failure
  **names the unresolvable reference** — a check that skipped the lookup could not name it.
- **Live demo scenario:** (1) `node .claude/scripts/absorb/report-lint.mjs` against the committed
  template filled in for one source → exit 0, prints `0 warnings`. (2) Delete the
  `## Verdict summary` heading from a copy → exit 0 with a warning naming that heading (WARN-first
  in TRIAL is the whole point: it reports without blocking). (3) Blank one inventory row's citation
  field → exit 0 with a warning naming the row id and the field. (4) Print
  `products/absorb/registry.json` → valid JSON, `$comment` schema present, row array empty.
  (5) Open `dev-bc-audit.md` → every claim carries a `file:line`.
- **Real-system check:** the audit is performed against the **real committed files** in
  `.claude/scripts/develop/` — `capability-lock.json` and `capability-vet.sh` are read as they
  exist, never described from `PLAN-develop`'s prose about them. A discrepancy between the plan's
  description and the file is a finding, and the file wins.
- **Expected evidence:** CI job output for `absorb-report-lint.bats` with its asserted test count ·
  `initiatives/absorb/evidence/phase-00/dev-bc-audit.md` · the filled sample report plus the three
  `report-lint` verdict outputs from the demo · the `docs/trial-ledger.md` row for the new gate.

## Pre-planned cuts, in order — decided now, not at 6pm on day 1

An attacker judged this phase over-full for 1 day: a from-tree audit with `file:line` citations
across two real files, a finalized registry format, a committed template, **and** a new lint reaching
green CI with its own mutant negative control. That reading is fair. The answer is **not** to spend
slack extending a locked appetite before any overrun exists — appetite is a constraint, and a blown
one means cut, never a silent extension. So the cut order is decided in advance, and which cuts were
taken is recorded in the phase-close note (the policy Cycle-9 phase-00 precedent):

1. **The audit's `file:line` citation density** drops from every field to every *claim absorb
   actually depends on* — the lock row's required-versus-nullable split, the vet gate's BLOCK set,
   the proposal verdict set. Fields absorb never reads get a one-line summary instead of a citation.
2. **`report-lint`'s per-row field checks** narrow to the three fields with a live consumer this
   cycle (citation, license note, classification verdict). Headings stay fully checked. The
   remaining row fields become Phase 2 work, recorded in the close note as an inherited obligation
   rather than a forgotten intention.
3. **The sample filled report** shrinks to one technique row instead of a representative set. The
   steel thread needs one row to be a thread.

**Never cut:** the DEV-B/C audit's existence and its contradiction-naming clause · `report-lint`
existing and being WARN-first · the mutant negative control · the empty-but-schema'd
`registry.json`. Those four are the phase. If they cannot be reached inside the appetite, that is
the kill criterion working rather than failing.

## Rabbit holes in this phase

- **Auditing all of develop C6.** The audit's scope is the three surfaces ADR-0600 and ADR-0604
  actually lean on: the lock row contract, the vet gate's refusal set, the proposal verdict set.
  Everything else develop shipped is out of scope, however interesting.
- **Designing the perfect registry schema.** Only the fields ADR-0600 names, and only because each
  has a live consumer this cycle. A field with no consumer is deleted, not deferred.
- **Making `report-lint` FAIL.** It is WARN-first in TRIAL by rule. Wanting it to block is a
  `/arc-retro` promotion argument, not a Phase-0 edit.

## Out of scope for this phase

The study harness itself, hostile fixtures and the read-only boundary proof (all Phase 1) · the
registry's status lint, cap and displacement logic (Phase 2) · the owner-judge profile (Phase 3) ·
any real absorb (Phase 4). This phase produces the paperwork the later phases fill.

## Your-setup / pending

Nothing. No keys, accounts, network or infra — the audit reads committed files and the lint is
zero-dep Node.

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
