# ADR 1415 — The composer's iron law gains an explicit read-path allowlist

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a composer is found reading something inside the allowlist that leaks
another variant's work — the allowlist is then too coarse and narrows to per-variant paths.

## Context

`.claude/agents/ui-composer.md` iron law 1 reads: **"Your directory only.** Never read or write
another variant's dir, the matrix, the brief file, or any product file. Your write surface is
`variant-<x>/`."

Design v2 requires the composer to read two things that live outside `variant-<x>/`:
its **own rendered PNG** at `.claude/state/design/renders/`
([ADR-1401](1401-dsv-b-the-composer-sees-its-own-work.md)) and the **reference pack** at
`.claude/state/design/refpacks/<brief>/` ([ADR-1404](1404-dsv-e-reference-packs-cache-images-commit-provenance.md)).

This lane has already paid for this exact shape once. Its retro row for 2026-07-30 records that
the director wrote the canonical content fixture into `matrix.md` while iron law 1 forbade
composers from reading `matrix.md` — so three composers invented three different cases, and the
only one that matched had broken the rule. The lesson recorded then: *when a rule forbids
reading a file, check every consumer of that file has another way to get what it holds.*

Here there is no other way. The brief's **text** can be inlined into the composer's prompt, and
is. A **screenshot cannot be** — the composer must open the image itself to read it with vision.
So the choice is not between two delivery mechanisms; it is between amending the law and having
the composer either refuse or break it.

## Options considered

1. **Leave the law and inline the images** — pros: no change / cons: not possible; the
   orchestrator cannot paste pixels into a subagent prompt.
2. **Relax iron law 1 to "do not read another variant"** — pros: simple / cons: silently
   re-permits the brief file and product files, undoing two separate earlier decisions.
3. **Keep the law and add an explicit allowlist of read-permitted paths** — pros: the
   prohibition stays exactly as narrow as it was, and the new permission is enumerated /
   cons: the law is longer.

## Decision

Option 3. Iron law 1 keeps every existing prohibition and gains an enumerated read allowlist:
`.claude/state/design/renders/` (this variant's own session only) and
`.claude/state/design/refpacks/<brief>/`. Reading another variant's dir, the matrix, the brief
file and product files stays forbidden, verbatim.

The renders allowlist is **session-scoped**, which is only meaningful because
[ADR-1402](1402-dsv-c-the-renderer-is-session-safe-before-anything-runs-in-parallel.md) makes
sessions unique per run+variant — without that, "its own PNG" is not a well-defined path and
this allowlist would hand every composer every other composer's renders.

## Consequences

Easier: the composer can do the job design v2 gives it without breaking its own contract, and
the blindness that makes the panel worth anything is preserved by enumeration rather than by
hope. Harder: the allowlist is now a security-shaped surface, so it needs a negative control —
a composer that attempts to read a *sibling* variant's render must be refused, and that case is
one of the adversarial fixtures for Phase 01.

## Amendment 2026-09-16 — the enforcement surface, and what staleness may not do

This ADR was premised on `Read` being the composer's read path. It is not the only one: `Grep`
and `Glob` both return a sibling's content, which fired the kickoff assumption that tested this
allowlist (PLAN ledger, `FIRED 2026-08-24`). The boundary is enforced for all three tools.

A filesystem marker also outlives the compose that armed it. An abandoned `lexos-p01/variant-a`
boundary refused every read in its worktree for three weeks. The decision: **an armed boundary
never relaxes with age.** Staleness is made visible — `armed_at`, age and the release command in
every read and write refusal — but a stale marker still refuses. The alternative,
releasing on a dead pid, was rejected on a fact rather than a preference: the recorded pid
belongs to the short-lived `--begin` process, so it is dead immediately and would have disarmed
every boundary on arrival.

## Amendment 2026-09-17 — Bash was never scoped, and the harness says who is calling

The allowlist assumed the composer's Bash was already narrow: its frontmatter grants
`Bash(bash .claude/scripts/design/design-render.sh:*)`. It was not narrow. A subagent's `tools:`
field takes tool names only, so the specifier granted all of Bash. On the Phase 01 live demo
(`lexos-p02`) every composer ran node, `sed -i`, python and PowerShell through it. Bash walks past
this ADR's read allowlist and the write boundary alike. A transcript audit found no composer
touched a sibling, so isolation held in practice, but it was never enforced.

**Decision:** Bash is enforced by a PreToolUse hook, `composer-bash-check.sh` behind
`.claude/hooks/PreToolUse.d/10-design-composer.sh`, keyed on the payload's `agent_type`. An
owner-approved probe on 2026-09-17 measured that field: present with the agent's name for a
subagent, absent for the main session. The harness writes it and the agent cannot, so it can be
trusted where a marker file cannot. For `ui-composer` exactly one command shape runs:
- the renderer, `--mode explore`,
- on a page inside the one armed variant,
- into that variant's own session.

Everyone else's Bash is untouched.

**The route and the session are both pinned.** Rendering a sibling into the composer's own session
would otherwise deliver a sibling's pixels to the one place this ADR lets the composer read.

**The fragment is the owner's edit.** `.claude/hooks/**` is governance-denied to the session, so
its canonical content lives at `tests/fixtures/hooks/PreToolUse.d/10-design-composer.sh`. A test
stays red until the installed copy matches it.

**Revisit trigger:** `agent_type` is identity, so the read and write boundaries could scope to
`ui-composer` too, instead of refusing every caller while a marker exists. That would end the
operator lock that started this cycle's `/arc-change`, and would allow parallel composition. It
is a separate security-boundary change and needs its own owner decision.

## Note 2026-09-17 — this ADR's revisit trigger fired, and where it went

The trigger reads: *a composer is found reading something inside the allowlist that leaks another
variant's work*. The fifth attack pass found exactly that (BL-1 = BS-1). A composer's own render,
which this ADR admits, carried a sibling's pixels, because the composer's page framed the sibling
and the renderer opened `file://`. Narrowing the allowlist, the response this ADR anticipated,
would not have helped: the leak was inside the one render the composer must read. It was routed
through `/arc-change` to [ADR-1418](1418-an-explore-render-is-confined-to-its-own-variant-directory.md),
which confines the render to the variant directory. This ADR's allowlist is unchanged.
