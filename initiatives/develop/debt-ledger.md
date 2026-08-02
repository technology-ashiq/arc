# Debt ledger — lane `develop`

> Intentional shortcuts are debts; unrecorded debts are forgotten forever. Every deliberate
> compromise gets a row: **what · where · why accepted · cost of leaving it · pay-down trigger.**
>
> Lane-scoped by design (ADR-0055's spirit): a shortcut belongs to the initiative that took it.
> Root-mode consumers use `docs/develop/debt-ledger.md` instead.
>
> `/arc-develop checkpoint` greps changed files for `TODO`/`FIXME`/`HACK`/`XXX` and WARNs on any
> marker whose file has no row here. WARN-first — this ledger has not been used on a real phase
> yet, and a gate promoted before it has ever fired is promoted on nothing.
>
> A deferred suggestion lands here too. Deferral is a debt, not a deletion.

| what | where | why accepted | cost of leaving it | pay-down trigger |
|---|---|---|---|---|
| Risk globs are declared inline in `develop.mjs` rather than read from `.claude/rules/security-sensitive.md` | `.claude/scripts/develop/develop.mjs` (`RISK_GLOBS`) | Phase 03 had 0.5d and refactoring a shared rules file consumed by other surfaces is not a 0.5d job | Two places now describe "risky paths" and they can drift; a rule added to `security-sensitive.md` will not reach the checkpoint | The first time a glob is added to one and not the other, or the next phase that touches `security-sensitive.md` for any reason |
| Checkpoint health checks ship without the public-API surface diff, the complexity delta, or the circular-dependency check | `.claude/scripts/develop/develop.mjs` (`modeCheckpoint`) | All three need something that can read code — madge, dependency-cruiser, or an AST — and arc core is zero-dep. Declared a PLAN no-go rather than half-built | A checkpoint reports "no risk globs tripped" on a change that materially widened the public surface, and reads as reassurance | The first phase whose target is a JS/TS app where those tools are already present, or a real escaped defect that a surface diff would have caught |
| `spec-fidelity` was exercised through a general-purpose agent carrying its contract inline, not through its own registered agent type | `.claude/agents/spec-fidelity.md` | The agent file was created in the same session that needed it, and agent types register at session start | The shipped agent definition has never been loaded by the runtime that will load it; a frontmatter error would not surface until someone else runs it | The next session that runs `/arc-develop handoff` — it must invoke the real agent type and confirm it loads |
| ~~The duplicate-ADR-number check exists as a convention only~~ **PAID DOWN 2026-08-02, PR #97** | `kickoff-lint.mjs` `[adr-dup]` + a bats test over the real `docs/adr/` | — | — | Closed. An attack pass on Cycle 6 flagged this row as contradicting PLAN's Current State, which was correct: the row was stale, not the claim. The check FAILs when two files share a four-digit prefix and names every file claiming it |
