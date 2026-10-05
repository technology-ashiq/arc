# Phase 02 — A public skill reaches a role pinned, vetted, on a proposal branch

**Goal (one line):** `skill-import.mjs` fetches a SHA-pinned `SKILL.md`, refuses it by default on the ToxicSkills scan, and on PASS lands it with the role card on one proposal branch (ADR-1628).
**Appetite:** 0.6 days
**Depends on:** phase-00
**REQs closed here:** REQ-04

## Scope
- `.claude/scripts/org/lib/skill-source.mjs`: interface `fetchSkill({ owner, repo, path, sha })`; fake reads
  `tests/fixtures/org/skills/REPO/PATH`; real calls `gh api repos/O/R/contents/P?ref=SHA` (argv array, never
  a joined string) and decodes base64.
- `.claude/scripts/org/lib/skill-vet.mjs` (pure): returns every failed condition from ADR-1628's list.
- `.claude/scripts/org/skill-import.mjs github:OWNER/REPO/PATH@SHA --role ROLE [--source fake|real] [--dry-run]`:
  parse (40-hex SHA mandatory), fetch, vet, then `planProposal` + `writeProposal` (`core/proposal-branch.mjs`)
  with `.claude/skills/imported/NAME/SKILL.md`, the card's `binds.skills` entry, a provenance file
  `.claude/skills/imported/NAME/PROVENANCE.md` (source, SHA, vet report digest), then `approval.requested`.
  The `files` list also carries every consequence of adding the skill files, computed from main's bytes as
  `agent-scaffold` does: the sync-golden lines for `SKILL.md` and `PROVENANCE.md`, and the owning product's
  manifest entry if `product-lint` lists skills. The `approval.requested` payload names `gate: skill-import`,
  `adr: ADR-1628`, `branch`, `base`, `commit`, and is pre-judged with `spineRefusal` before the branch is
  written, as `agent-scaffold.mjs` does. `skill-import` runs `--dry-run` first and applies only with
  `--expect DIGEST` (`planDigest`).
- Manifest, sync golden, wiki in the same commit.

## Exit criteria (Definition of Done)
- [ ] clean fixture skill → proposal branch holds the three paths + one `approval.requested`
- [ ] each ToxicSkills fixture BLOCKs listing every failed condition; no branch, no event
- [ ] tests added & green on CI (`tests/org/skill-import.mjs` from a bats file)
- [ ] live demo run + output checked
- [ ] contract tests: fake and real arms share one expectation set; real arm only with `ARC_SKILL_IMPORT_LIVE=1`
- [ ] `/arc-attack` two surfaces once on the local commit before push (boundary attacker gets the ToxicSkills list)
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- **Test command:** `node tests/org/skill-import.mjs` (sandbox git repo, fake source).
- **Expected failure first:** `ERR_MODULE_NOT_FOUND ... org/skill-import.mjs`.
- **Live demo scenario:** `skill-import.mjs github:x/y/SKILL.md@main --role technical-writer --dry-run` refuses `UNPINNED`; the fake clean skill with `--dry-run` prints the planned branch and paths.
- **Real-system check:** the owner's checkout is byte-identical after a PASS run (`git status --porcelain` empty before and after in the sandbox).
- **Expected evidence:** CI per-JOB conclusions; fixture RAN line; the dry-run output.

## Rabbit holes in this phase
- A pattern list cannot prove a skill benign: the branch is a proposal the owner approves, never merged by the command.

## Out of scope for this phase
Registries other than GitHub; demand-counter wiring.

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- Nothing in this cycle writes to the owner's checkout or to `main`: every card or skill change is a proposal
  branch plus `approval.requested`.
- A refusal writes no event and no file, and names every failed condition.
- The role resolver is deterministic: the same cards and spine give the same agent.
- The model seat (`seat`, `seat_source`) keeps its meaning; the agent seat is new, separate fields.
- Tests run on CI, never on this box; a test asserts it RAN before asserting what it printed.
