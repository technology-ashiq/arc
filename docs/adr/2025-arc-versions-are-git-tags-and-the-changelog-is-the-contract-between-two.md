# ADR 2025 — arc versions are git tags, and the CHANGELOG is the contract between two

**Status:** accepted
**Date:** 2026-10-14
**Product:** `distribute` (repo root `VERSION`, `CHANGELOG.md`, a new `core` lint; DST-P)
**Reversibility:** one-way
**Why one-way:** a pushed tag is public on a public repo and consumers pin it; a moved or deleted tag breaks every install that names it
**Revisit trigger:** a pushed tag ever needs to move (that means the tag was cut before CI was green on its commit), or the BREAKING marker fails to stop an upgrade that needed a manual step.

## Context

`VERSION` reads `0.2.0`. `CHANGELOG.md` is Keep-a-Changelog with only an `[Unreleased]` section. `git tag` is empty
locally and on origin. Nothing ties `VERSION` to `CHANGELOG.md` (grep of `tests/` and `.claude/scripts/`). `outdated`
cannot say "N commits behind, here is what changed" without a named baseline and a document that lists changes between two.

## Options considered

1. **Commits only, no tags.** `outdated` could count commits but could never name a release or a breaking change.
2. **npm-registry versions.** `npm publish` is a no-go (ADR-2008).
3. **Semver git tags + `VERSION` + Keep-a-Changelog sections, kept in step by a lint. A BREAKING marker in the range stops `upgrade`.**

## Decision

Option 3.

- **Tags** are `v<semver>` annotated tags on `main` commits whose CI is green. The first one is `v0.2.0`, cut at this cycle's seal on
  the merged `main` commit that carries the `[0.2.0]` CHANGELOG section with `version-lint` green, after the owner's explicit OK
  for that push (kickoff attack: a tag at `4741c770` would hold only `[Unreleased]`, could never pass the lint, and could never move). Later tags are cut
  only after a PR merges, never on a branch head.
- **Lint** (`node .claude/scripts/core/version-lint.mjs`, run from `npm run lint` and a bats test): `VERSION` is one
  semver line; `CHANGELOG.md` has `## [Unreleased]` first and a `## [<VERSION>] - YYYY-MM-DD` section for the current
  version once that version is tagged; section versions strictly descend; no section is a version newer than `VERSION`.
  A tag that exists for `VERSION` but has no section is a FAIL. In a clone without tags (CI checkouts are shallow), the
  tag clause reports `tags: not fetched` and is skipped by name, never silently passed.
- **BREAKING marker:** a line under any section that starts `- **BREAKING**` marks that release breaking. `arc upgrade`
  refuses a range that contains one unless `--confirm`, and prints the line.
- **The manifest records `tag` and `commit`** (ADR-2024). Install from a tag (`github:technology-ashiq/arc#v0.2.0`)
  records the tag. Install from HEAD records `tag: <nearest tag whose commit == HEAD>` or `null`, and `outdated` prints
  `untagged` rather than inventing one.
- **CHANGELOG range** printed by `outdated`/`upgrade` = the sections strictly after the installed tag up to and
  including the target (or `[Unreleased]` when the target is HEAD). If the installed tag has no section, it says
  `changelog: no section for <tag>`.

## Consequences

- The tag push is outward and permanent on a public repo. It is cut once, on a green-CI `main` commit, and never moved.
- `CHANGELOG.md` gains a `[0.2.0]` section in P09, written from HISTORY for the distribute cycles. Older history
  is linked, not copied.
- CI's shallow checkout has no tags. The lint's tag clause is skipped there by name; the commit/section clauses run everywhere.

## Evidence

- `cat VERSION` → `0.2.0`; `head CHANGELOG.md` → header + `[Unreleased]`; `git ls-remote --tags origin` → empty (2026-10-14).
- Keep a Changelog 1.1.0 and SemVer 2.0.0 are the formats `CHANGELOG.md` already declares in its own header.

**Confidence:** high.
