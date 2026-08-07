# ADR 0507 — No capability may be used to exceed another capability's grant

**Status:** accepted
**Date:** 2026-08-06
**Product:** `policy`
**Reversibility:** two-way
**Revisit trigger:** a program lands in `argv0_allow` that the classification table cannot
honestly classify, or a real workflow is blocked because a legitimately-narrow tool is
classified as an interpreter. Either means the table is wrong; fixing the table is a reviewed
repo edit, never a runtime exception.

## Context

An adversarial pass over the freshly-written schema found a total bypass, using a binary the
schema's own worked example allowlists:

```yaml
shell: { level: L2, argv0_allow: ["git", "node", "bats"] }
```

```bash
node -e "require('fs').writeFileSync('.claude/settings.json', '{}')"
```

That command contains **no chaining metacharacter**, so the "reject `;`, `&&`, `||`, backtick,
`$(`" rule never fires. It contains **no discrete path argument**, so ADR-0502's
filesystem-identity check has nothing to `stat` — the guarded path is a string inside an
argument to an allowed program. The write roots are not consulted, because this is a `shell`
action, not a `write` action. The un-grantable resource list, the write roots, and the deny
floor are all bypassed at once, by a kind that was never granted `write` above L2 and may not
have been granted `write` at all.

`git` is the same problem wearing a different hat: `git fetch` and `git push` reach the network
regardless of the kind's `network` level, and `git checkout HEAD -- .claude/settings.json`
rewrites a guarded file with no write grant in sight.

This also undermines ADR-0505's reasoning. That ADR argued a demotion should bite only the
capability involved, on the basis that the eight capabilities are independent vectors. They are
not. A `write` incident that demotes only `write` leaves the same kind's `shell: L2` able to
perform the identical write one step later.

The general shape: **a capability whose bound admits an instrument that can reproduce another
capability's effect is not bounded at all** — it is the union of everything that instrument can
do, and the vector model silently becomes decorative.

## Options considered

1. **A — forbid interpreters in `argv0_allow` entirely.** Pros: simplest, closes it absolutely.
   Cons: `node` is how this repo runs literally everything, so `shell` becomes unusable for real
   processes and the policy file grows a permanent lie (people would grant `L3` to get work
   done, which is worse).
2. **B — parse interpreter arguments** and extract the paths and hosts they touch. Pros: precise
   in principle. Cons: it is writing a static analyser for every language an interpreter accepts,
   which is unbounded and would be defeated by one layer of string concatenation. This is the
   rabbit hole, not the fix.
3. **C — a derivation rule: a capability is capped at the minimum of every capability its
   instruments can reproduce.** Pros: closes the bypass without parsing anything, and it composes
   with `min(ceiling, cap)` that already exists. Cons: needs a classification table for argv0
   entries, which is a maintained artifact.

## Decision

**Option C, stated as an invariant:** *no capability may be used to exceed another capability's
grant.*

`hq.policy.yaml` gains a closed `argv0_classes:` table mapping each permitted program name to
the set of capabilities it can reproduce. `policy-lint` and `authorizeAction` then apply:

```
effective(shell) = min( ceiling(shell), cap(shell),
                        min over c in reproduced_by(argv0_allow) of effective(c) )
```

with the seed classification:

| Class | Programs | Reproduces |
|---|---|---|
| `interpreter` | `node`, `python`, `python3`, `ruby`, `perl`, `sh`, `bash`, `zsh`, `pwsh`, `powershell` | **every capability** — an interpreter is a general machine, so `shell` is capped at the minimum across all eight |
| `vcs` | `git`, `gh` | `write`, `network` |
| `fetcher` | `curl`, `wget` | `network` |
| `packager` | `npm`, `pnpm`, `yarn`, `pip` | `write`, `network`, and `shell` (they run arbitrary lifecycle scripts) |
| `narrow` | `bats`, `jq`, `sha256sum`, `diff` | nothing beyond `shell` |

**An argv0 absent from `argv0_classes:` is a lint error**, not an implicit `narrow`. That is
deny-by-default applied to the allowlist itself — the failure mode being closed is precisely
"nobody thought about what this program can do".

Two consequences worth naming, because they are the point:

- **The bypass closes without parsing anything.** A kind with `node` in `argv0_allow` and
  `write: L0` has `effective(shell) = L0`. It cannot run `node` at all, which is correct: for
  that kind, running `node` *is* an unbounded write.
- **ADR-0505's per-capability demotion becomes safe, and needs no widening.** Because the
  minimum is recomputed at every authorization, demoting `write` after a write incident
  automatically lowers `shell`'s effective level for any kind holding an interpreter. The
  cross-capability pivot is closed by the derivation rule rather than by a broader bite, so
  ADR-0505's "smallest blast radius" reasoning holds — it just needed this rule underneath it.

**Evidence:** the bypass was constructed by a fresh adversarial agent against
`initiatives/policy/phases/phase-00-spec.md`'s own worked example, which grants
`argv0_allow: ["git", "node", "bats"]`. No external source; the schema contradicted itself.
Corroborating precedent in this repo: the engine cycle's adversarial pass found
`permissions: declared` with only `ask.human` meant unrestricted — the same failure of a
declaration that does not constrain what it names.
**Confidence:** high for the bypass and for the fix's mechanics; **medium** for the completeness
of the classification table, which is why an unclassified argv0 is an error rather than a
default, and why the table is a REQ-08 attack surface.
**Rejected because:** A — makes `shell` unusable in a Node-only repo, which produces dishonest
grants rather than safe ones. B — a static analyser for arbitrary interpreter input is unbounded
and one string concatenation from useless.

## Consequences

Easier: the vector model becomes true rather than aspirational, and the un-grantable resource
list, the write roots and the deny floor stop being bypassable through an allowlisted program.
The rule is one `min()` over a table, so it costs almost nothing at authorize time. Harder:
`argv0_classes:` is a maintained artifact that must be right, and being wrong is silent in the
permissive direction — so it is an explicit REQ-08 attack row ("find a program in the table whose
class understates what it can do") and an unclassified program is a hard error. Grants also get
harder to write: a process that needs `node` now needs its `write` and `network` levels to
actually reflect what it does, which is the honesty this build exists to force.
