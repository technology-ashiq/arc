# ADR 1628 — `skill import` takes a SHA-pinned source, refuses by default on a ToxicSkills scan, and lands only on a proposal branch with the role card

**Status:** accepted
**Date:** 2026-10-05
**Product:** `org`
**Reversibility:** one-way
**Revisit trigger:** a skill that passed the vet is later found carrying an injection the scan did not name,
or a second registry (not GitHub) is needed.

## Context
An imported skill is untrusted text that agents will read as instructions. ORG-R item 2 (ADR-1618): pull a `SKILL.md` from a public registry for a role, vetted with ToxicSkills as the
named threat model (36% of sampled public skills carried a flaw, PLAN-org). `capability-vet.sh` (ADR-0110) is
the refuse-by-default precedent, but it vets *packages* against a registry record; a skill is a prompt.
`agent-scaffold.mjs` already lands changes through the one proposal writer (`core/proposal-branch.mjs`), never
touching the owner's checkout. REQ-09: a seat change and its card change land in the same branch.

## Options considered
1. **Fetch by URL at HEAD and copy into `.claude/skills/`**: unpinned, unvetted, straight into the tree.
2. **`.claude/scripts/org/skill-import.mjs github:OWNER/REPO/PATH@SHA --role ROLE`**: a 40-hex commit pin is
   mandatory; the fetch goes through an interface (fake: a fixture directory; real: `gh api`
   `repos/OWNER/REPO/contents/PATH?ref=SHA`); `lib/skill-vet.mjs` scans and refuses by default; on PASS the
   proposal writer lands `.claude/skills/imported/<name>/SKILL.md` + the card's `binds.skills` entry + its
   provenance line, then `approval.requested`.

## Decision
Option 2. The vet BLOCKs and lists EVERY failed condition (as `capability-vet.sh` does): no pin; frontmatter
missing `name`/`description`; size over 64 KiB; invisible or bidi Unicode; instructions to ignore or override
prior instructions; shell pipe-to-interpreter (`curl ... | sh` shapes); reads of credential paths or env
secrets; outbound posting of repo content; a `name` that collides with an existing skill. Nothing is written
to the working tree; a refused import emits nothing but its report. A role card that already binds the skill
is a no-op refusal.

## Consequences
Easier: the owner reviews one branch with the skill, the card and the provenance together. Harder: the scan is
a pattern list and cannot prove a skill benign; that is why it lands as a proposal the owner approves, never
on main directly.
