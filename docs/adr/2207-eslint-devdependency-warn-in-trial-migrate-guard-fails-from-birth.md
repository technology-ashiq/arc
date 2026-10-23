# ADR 2207 — ESLint as a devDependency, WARN in TRIAL; `migrate-guard` and the per-lane floors FAIL from birth

**Status:** accepted
**Date:** 2026-10-24
**Product:** `company`
**Reversibility:** two-way
**Revisit trigger:** the ci retro reviews ESLint's WARN output, and promotes it to FAIL or removes it.

## Context

CI-N was answered **yes** by the owner at kickoff on 2026-10-24. CI-S is locked. The standing rule is that new lint starts WARN in TRIAL. `AGENTS.md:12` says "zero npm deps", which means runtime.

## Options considered

1. **No linter.** `npm run lint` would be only the arc gates.
2. **ESLint** (flat config, `eslint:recommended` + `no-undef` / `no-unused-vars`) as the only devDependency, with a committed lockfile. `dependencies` stays `{}`.

## Decision

Option 2, starting WARN: it reports in `quality` and never blocks until the retro promotes it. **Named exception:** `migrate-guard` and the per-lane `.count` floors are FAIL from birth (precedent: `face-coverage`). A guard against silent test loss that only warns would let a cheaper worker model straight through.

## Consequences

`AGENTS.md:12` is clarified to say "zero runtime npm deps". A rule turned off carries a one-line reason in `eslint.config.mjs`, and a blanket disable is never allowed.
