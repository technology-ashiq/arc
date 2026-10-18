# Playbook — write the procedure, not the workaround

**Applies to:** `processes/*.process.yaml`, hand-written `.claude/commands/*.md`, and anything else that
arc compiles or syncs to more than one harness (`engine/harnesses.yaml`, `arc-compile.mjs --target`).

**Provenance.** Re-expressed from `addyosmani/agent-skills` @ `aeac41d4` (`docs/skill-anatomy.md:159-168`,
MIT, (c) 2025 Addy Osmani), technique **T-13** in
`initiatives/absorb/evidence/agent-skills/extraction-report.md`. Nothing is copied. Landed by ADR-0607.

---

## The rule

**A step you cannot justify without naming one model, one model version, or one harness's private tool
name is a workaround, and it does not belong in a process.** Put it in an issue or the debt ledger.
Write the capability ("read the file", "run the focused test", "ask the owner one question"), not the
mechanism one runtime happens to expose.

arc compiles one process to several harnesses. A step written around one model's mistake runs on every
target, constrains the ones that never made that mistake, and spends turns they need for the work. The
source cites a measurement that skills written against one model's failures can leave a stronger model
worse off than no skill; that paper was not read during the study, so treat the claim as the source's.

## Two smells to check before adding a step

- **Over-specified mechanics.** An exact command form or serialization detail where stating the goal
  would do, justified by "model X gets this wrong otherwise".
- **Fragmented diagnostics.** Three inspection steps where one would confirm the same thing. Turn
  budget is finite.

## What is NOT a workaround

**Environment facts stay.** Some arc steps exist because of a measured defect in the *machine*, not the
model, and they apply to every harness that runs there:

- the shell-string rule in `AGENTS.md` (an apostrophe, backtick or `$` in an embedded program),
- MSYS bash expanding an `@file` argument as a response file on Windows,
- realpath on both sides of a Node main-guard behind a symlink.

These name a shell, an OS or a runtime, not a model. Keep them, and say which environment they protect
against so a reader can tell them apart from a model workaround.
