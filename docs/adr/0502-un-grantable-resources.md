# ADR 0502 — Un-grantable resources: the resource-level twin of Constitution E2

**Status:** accepted
**Date:** 2026-08-06
**Product:** `policy`
**Reversibility:** two-way
**Revisit trigger:** a legitimate automated flow needs to write one of the listed paths and the
work cannot be done by a human repo edit. That is a real signal the list is wrong, not a reason
to grant an exception at runtime — it reopens this ADR.

## Context

ADR-0501 makes `permissions.deny` in `.claude/settings.json` the fail-closed floor of the
interactive surface. That floor lives in a file, and files are written by the `write` capability
this engine is supposed to govern. Under POL-B's pure capability-vector model, `write` is
granted per action kind against write roots — so an action kind promoted to a write level that
includes the repo's `.claude/` tree can **delete the deny rule that binds it**, then proceed.

The same hole applies to `hq.policy.yaml` itself (POL-A's human-declared ceiling — "changing a
ceiling is a repo edit, never an agent action", which today is a sentence in an ADR rather than
an enforced property) and to the hook scripts in `.claude/hooks/`, where deleting a file is
enough: per ADR-0501's table, a missing hook script is fail-open.

This is pre-mortem row 2 ("a bypass path exists around the wrapper") recurring one layer up, and
it is visible **now**, from evidence in hand — not a hypothetical for Phase 4 to discover. The
engine cycle already shipped the same shape once: `permissions: declared` with only `ask.human`
meant unrestricted.

## Options considered

1. **A — an un-grantable resource list, hard-excluded from every `write` grant** regardless of
   ceiling or cap. Pros: closes it before any code exists; costs one clause in the schema and
   one hostile-corpus family. Cons: introduces a path-based exclusion into a model that was
   until now purely capability-and-level.
2. **B — treat these paths as ordinary `write` targets under the normal ceiling/cap.** Pros: no
   new mechanism. Cons: a kind legitimately promoted to write can disarm its own cage; the
   backstop is only as strong as the weakest grant anywhere in the file.
3. **C — leave it for Phase 4's red team to find.** Pros: zero cost now. Cons: a known hole
   deliberately shipped into a security build, then rediscovered at a cost of a finding plus a
   regression-fixture retrofit. Contradicts the plan's own pre-mortem.

## Decision

**Option A.** The policy schema gains a closed, non-overridable **un-grantable resource list**,
excluded at `authorizeAction` time regardless of the kind's ceiling or event-earned cap — from
every `write` grant **and from every `shell` grant capable of mutating a file**, because in
POL-A's model `shell` and `write` are separate vectors and an exclusion written against writes
alone is trivially walked around by `git checkout HEAD -- .claude/settings.json`, `sed -i`,
`cp`, `mv`, or output redirection:

```
.claude/settings.json      .claude/settings.local.json      .claude/hooks/**
hq.policy.yaml
```

Framing matters, and this is why the mechanism is not a bolt-on: **Constitution E2 is a list of
un-grantable *actions*; this is the list of un-grantable *targets*.** Same shape, same
justification, same enforcement point — the model gains a second axis it already had the
vocabulary for, rather than a special case. Like E2, the list is quoted into `policy-lint`, an
entry above L0 is a parse error, and removing an entry is a repo edit in a reviewed diff.

Deleting a hook script is treated as a write to `.claude/hooks/**` and is therefore already
covered; that is deliberate, because ADR-0501 established that a missing hook script fails open.
So is the quieter version — leaving the file in place but making it non-spawnable via a
permission bit or an extension rename, which touches no content bytes and reaches the same
fail-open outcome. Both are REQ-08 attack rows.

The exclusion is applied **after** path normalisation, and the normaliser is itself a target.
This repo runs on win32, where the bypasses are broader than the usual traversal-and-symlink
pair: NTFS junctions and hardlinks need no elevated privilege, `path.resolve` does not collapse
8.3 short names (`RUNPRO~1`), and the filesystem folds case while the comparison may not. Those
are REQ-01 hostile-corpus rows, not footnotes.

**Evidence:** `.claude/settings.json` currently holds the 12 deny rules and the PreToolUse
matcher list; `.claude/hooks/` holds `_dispatch.sh`, `PreToolUse.sh`, `PreToolUse.d/`,
`PreToolUse-edit.sh`, `PreToolUse-edit.d/`. Settings-scope behaviour (deny rules merge and only
get stricter, but nothing prevents an edit to the file that supplies them) per
`https://code.claude.com/docs/en/settings.md`, checked 2026-08-06.
**Confidence:** high — the hole follows from file permissions and the deny-rule model, and needs
no unverified platform behaviour to be real.
**Rejected because:** B — a promoted write disarms its own constraint, so the floor is not a
floor. C — knowingly shipping a named hole into a security build, to be paid for later at a
higher price.

## Consequences

Easier: the fail-closed floor of ADR-0501 and the human-declared ceiling of POL-A become
properties the engine enforces rather than conventions it documents; the hostile corpus gains an
obvious, cheap family (write-to-settings, write-to-policy-file, delete-a-hook, and each of those
via traversal, symlink and encoded paths). Harder: the write grammar now has two parts (roots
plus exclusions) and the exclusion must be applied after path normalisation — traversal and
symlink escape are how this gets bypassed, so those are REQ-01 hostile-corpus rows and REQ-08
attack rows, not afterthoughts. If the revisit trigger fires, the answer is a human repo edit to
the list, never a runtime grant.
