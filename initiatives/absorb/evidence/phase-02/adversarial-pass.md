# Phase 02 adversarial pass — 21 findings, 7 serious, 4 of them fixes of mine reopening

**Date:** 2026-08-09 · **Surface:** one fresh agent, unanchored to the implementation, prompt
carrying this lane's running list of already-fixed defects with the instruction to check each one in
every other file.

**CI was green 19/19 on the code this pass then broke in 21 places.** Green CI and a working guard
are different claims, and this file is the gap between them.

## Two claimed properties falsified outright

### The cap of 12 was evaded by the lane string

14 rows at `status: "adopted"`, with `lane` cycling `"absorb"` / `"absorb "` / `"Absorb"` /
`"ABSORB"` / `" absorb"` / `"absorb\t"` / `"аbsorb"` (Cyrillic а) → **`registry-ref: 0 warnings`**.
Not one warning of any group. The control, all 14 at exactly `"absorb"`, fired `[cap]` correctly.

`byLane` keyed on the raw string, and `lane` was validated only as a non-empty string. **Fixed** by
validating against the lane grammar that already exists in `.claude/rules/lanes.md`
(`[a-z][a-z0-9-]*`, 64 max) — one assertion closing trim, case and Unicode instead of three
normalisations. Verified after: 6 warnings across `[shape]` and `[cap]`.

### Lock-owned data nested under any key other than `lock_ref` was invisible

```json
{ "id":"T-01", "lock_ref":{"name":"fixture-tool","version":"1.0.0"},
  "pin":{"hash":"COPIED","publisher-auth":"COPIED","class":"write-capable","provenance":"COPIED"},
  "evidence":[{"sha256":"COPIED-IN-AN-ARRAY"}] }
```
→ **`0 warnings`.** Every field the file exists to keep out of the registry, one level down.

**This is the twin-fix shape, third occurrence in this lane.** I hardened `lock_ref` in Phase 01
because that is where the previous attacker looked, and left every other object open. **Fixed** by a
recursive walk over objects and array elements that reports the JSON path. Verified after: 4
`[duplication]` warnings naming `pin.hash`, `pin.publisher-auth`, `pin.class`, `evidence[0].sha256`.

## Four of the seven were my own fixes reopening

| Already-fixed defect | Where it came back |
|---|---|
| #1 — a `//` inside a string literal must not truncate a line | Applied to **line** comments only. Three constructions then deleted live code: a string containing `/*`, a `// */` line closing a block (inside a comment `//` means nothing, so `*/` really closes it and the import IS live), and a regex literal `/[/*]/`. All three were live `left-pad` imports reporting 0 warnings |
| #3 — a precondition silently disabling a whole feature (the Phase 01 walk that never recursed) | `CODE_EXT` gated the exec/install patterns, which are TEXT patterns. They were off for every type the allowlist admits — `.yaml`, `.md`, `.bats`, `.sh`. A `tests/evil.bats` with `npm install left-pad` and a curl-to-shell reported 0 warnings, **and CI executes that file.** A test enshrined the hole as intended behaviour |
| #5 — a denylist of the spellings its author thought of | Recurred in the list I had *just* widened: `hash ` (trailing space), `sha1`, `md5`, `fingerprint`, `tarball`, `signature` all walked past |
| #8 — fixtures handing unreadable paths to a checker, so the check never ran | Recurred **inside the flag added to fix it.** Pointed at a wrong-but-existing `--root`, every parse was skipped and the run said `0 warnings` |

## The gate had no caller

`rebuild-lint.mjs` was absent from `/arc-absorb`'s `allowed-tools`, from every command body, and from
`.github/`. It was reachable **only from its own bats suite** — so nothing routed a real rebuild
through it. A guard nothing calls is a guard that does not exist. `/arc-absorb` step 8 now runs it on
`git diff --name-only` before any proposal.

## The rest, fixed

`import x from"lodash"` / `import"lodash"` / `import{a}from"lodash"` — all valid JS, all past `\s+`,
and the shape any minifier emits · `require("lo" + "dash")` fell into the **gap** between the literal
check (wanting `)` after the quote) and the computed check (wanting no quote after the paren), the
cleanest invisible dependency available · an aliased loader `const r = require` defeats every
call-shaped pattern · a bare leading `/` is absolute and was read as repo-relative · a symlink inside
an allowlisted directory reaches any explicitly-out target · a directory given to `--paths` threw an
uncaught EISDIR at **exit 1**, outside the declared `{0,2}` set · one retired row could free three
slots · `decision_refs` was satisfied by the literal `true`, so "nothing adopts itself" passed on a
boolean · attribution cleared a **whole rebuild** on one stray English word in one unrelated file
("derived from the base type"), so two files copied verbatim rode through.

Every hole above is pinned as a regression fixture. `absorb-rebuild-lint` 22 → 32 tests,
`absorb-registry-ref` 31.

## What the pass confirmed as sound, so it is not re-attacked

Allowlist anchoring (`evil/processes/x.yaml`, `vendor/tests/y.bats`, `notprocesses/x`,
`processesX/evil.yaml` all refused) · the explicitly-out list enforced by name · traversal closed for
every real encoding (backslash, doubled slash, single-dot, absolute, `C:` drive-relative, UNC,
git-quoted, case-folded) · defect #1 genuinely fixed for line comments · `export * from`,
`import type … from`, `@scope/pkg`, `#subpath`, template-literal `import()` all caught · usage errors
are real exits rather than verdicts · `lock_ref` resolution sound in all five branches · declared
`@test` counts matching actual.

## A finding about the evidence mechanism itself, carried to the retro

`arc-evidence.sh bundle 02` produced a bundle with **0 artifacts** and `verify` reported
**"bundle verified"** and exited 0. A bundle containing nothing verifies exactly as well as a
complete one — the mechanism cannot distinguish "verified" from "nothing to verify". That is the same
class this cycle has now found five times, in the tool whose whole purpose is to make a phase close
on evidence rather than on assertion. Not absorb's file to change mid-phase; recorded as a retro
input with the fix named: `verify` should refuse a bundle with zero artifacts, or `bundle` should
refuse to write one.
