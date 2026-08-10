# Phase 04 — the real absorb (proof of life)

**Goal (one line):** ADR-0606's named target goes through the whole loop — study, report,
classification, rebuild diff, 3-fixture A/B, sealed-blind owner judgement, adoption proposal,
decision recorded — because mechanics without one real absorb means the cycle is not done.
**Appetite:** 1.5 days — blown appetite means cut scope or kill, never extend silently
**Depends on:** phase-03

## Exit criteria (Definition of Done)

- [ ] **The target is studied read-only:** gstack's post-build review pass, pinned by commit or date,
      producing an `extraction-report.md` that passes `report-lint` with zero warnings and carries a
      `file:line` citation per claim. The target and its receipt are ADR-0606's, and the receipt is
      `docs/evidence/planner-bench/LEDGER.md` PLANOFF-01 — arc took the top composite and still
      neither found nor survived the malformed-escape defect.
- [ ] **The classification is recorded with its reason** — and **ABSORB is not the required answer**.
      A ROUTE or SKIP verdict is a valid, honest outcome (assumptions ledger: the advantage may be
      outside the ADR-0602 allowlist). If the verdict is not ABSORB, REQ-08 closes on the recorded
      verdict plus its evidence, and the adoption half is honestly not exercised — recorded as such
      rather than forced.
- [ ] **The landing site is `docs/playbooks/finding-verification.md` with `.claude/commands/arc-audit.md`
      as its caller** — ADR-0602 **Amendment 2**, which takes Amendment 1's already-recorded route 2
      rather than widening anything. The DO-NOT-WIDEN ruling of 2026-08-09 stands. Two constraints
      travel with this and are exit conditions, not notes: the playbook **must** have a caller from
      birth (Amendment 1 named "a playbook nothing references" as route 2's failure mode, and this
      cycle already shipped a guard with no caller once), and the caller **must not** be a file
      compiled from `processes/` — `arc-review.md`, `arc-kickoff.md` and `arc-commit.md` are
      `GENERATED FILE — DO NOT EDIT` and a rebuild there vanishes at the next `arc-compile` with the
      registry still claiming it shipped. `arc-audit.md` is hand-written; verified, not assumed.
- [ ] **The playbook gets its `products/review/manifest.json` `docs` row in the same diff, and the
      golden manifest is regenerated.** `arc-audit.md` ships to consumer repos through the `review`
      product; a caller that references a file no product installs is a dangling reference in every
      consumer — the "guard with no caller" failure inverted, and invisible in this repo because here
      the file exists. `product-lint` must pass and `tests/fixtures/sync-golden/tree-manifest.txt` must
      be regenerated, since the byte-identity gate hash-pins every synced path.
- [ ] **On an ABSORB verdict: a rebuild diff confined to the allowlist**, ideas re-expressed, zero
      new runtime dependencies, attribution in both places if anything permissive was copied.
- [ ] **Adversarial pass on the rebuild diff, on an ABSORB verdict** — a fresh agent, unanchored to
      the implementation, attacks the rebuilt unspecified-input handling with hostile inputs before
      it counts as done; its prompt carries the lane's running list of already-fixed defects from
      phases 00 through 03 with the instruction to check each one in this new file too. Holes land as
      pinned regression fixtures **before** the A/B runs. The non-negotiable "a gate, lint or parser
      is not done until a fresh adversarial pass has attacked it" applies word-for-word to REQ-08's
      rebuild — and this phase is the one that ships a parser-class fix, so it is the last place the
      pass should have been missing.
- [ ] **A/B on at least 3 representative fixtures, and the fixtures are chosen by an agent that
      never saw the rebuild diff**, of the unspecified-input defect class, old-way versus
      absorbed-way, in PLANOFF layout (protocol, scoring, RESULTS) under `initiatives/absorb/evidence/planoff/`
      (**ADR-0605 Amendment 1** moved it there; `docs/evidence/**` is frozen per ADR-0058, so this
      criterion as first written pointed at a tree nothing may add to and would have read as unmet)
      with its `LEDGER.md` line (REQ-03). The next bullet stops the diff's author from grading it;
      this clause stops that same author from picking what it is graded against.
- [ ] **The A/B runs on fixtures, never on this cycle's own diff.** The first absorb edits arc's
      review surface, so measuring it against its own change would be the author grading the author.
      This ordering is not optional.
- [ ] **Sealed-blind owner judgement recorded** per ADR-0603: labels randomized, mapping sealed,
      revealed only after `decision.recorded` lands with **pick and reason**.
- [ ] **Adoption proposal in the inbox with its results table attached** — a proposal without its
      table is lint-invalid — and the owner's decision recorded. The registry row moves only on that
      decision ref.
- [ ] **The complete evidence bundle is committed** under `initiatives/absorb/evidence/phase-04/`
      plus the PLANOFF bundle under `initiatives/absorb/evidence/planoff/` (ADR-0605 A1, not the frozen
      `docs/evidence/**`).
- [ ] **Retro recorded** in `docs/retro-log.md`, including the cycle scoreboard row, the
      assumptions ledger's fired-or-not status for all seven rows stated explicitly, **and ADR-0074's
      two open waiver conditions closed out by name** — the venture clock's status (fired or not,
      read from `PORTFOLIO.md`) and the A8 tension's status (open or owner-resolved). **Neither may
      close on silence:** this cycle was born because a clock and a flag were both left to documents
      nothing re-read, and pre-mortem row 4 exists to stop that recurring here.
- [ ] tests added and **green on CI**, per-JOB conclusions read; test counts asserted; `@test` names
      ASCII-only
- [ ] tracker updated (PROGRESS.md row and done-log)

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts: the A/B itself is the
verification — 3 fixtures of the target class scored old-way versus absorbed-way with deterministic
checks where they exist and the ADR-0603 receipt where they do not, plus the full inbox chain run for
real once, with the sealed mapping revealed only after the decision.

## Rabbit holes in this phase

- **Absorbing the whole review pass.** The unit is one technique: one registry row, one rebuild diff.
  "Rebuild their whole pipeline" is several candidates or a SKIP.
- **Forcing an ABSORB verdict to make the cycle look complete.** A SKIP with a reason is a real
  result and the exit criteria say so. A forced adoption is the tool-hoarding failure arriving on
  day one.
- **Archaeology.** More than 1 day on the source means SKIP with a reason; the target was chosen
  partly because it is readable locally.
- **Judging on arc's own diff.** Named in the exit criteria because it is the tempting shortcut.

## Out of scope for this phase

Widening the ADR-0602 allowlist to reach the technique (that is an amendment, not a phase task) ·
bench's scoring machinery · evolve's experiment machinery · a second absorb, which the no-gos forbid
while one is in flight.

## Your-setup / pending

**Two owner actions, both small and both blocking:** the sealed-blind A/B pick through the inbox, and
the adopt-or-refuse decision on the resulting proposal. Both are inbox picks with a reason. The
assumptions ledger bets each takes minutes rather than hours; if judging one candidate exceeds 30
minutes, that trigger has fired and it goes to the retro.

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
