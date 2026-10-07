# ADR 2008 — DST-H: packaging is a zero-dependency Node CLI over the existing scripts, and nothing publishes

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** one-way
**Revisit trigger:** the owner decides to publish. That decision is irreversible (indexed, cached) and gets its own owner OK and its own lane step. It is never a side effect of this cycle.

## Context

A harness user needs one command to get arc. Publishing outward is irreversible, and the LexOS-mockups near-miss is why the CLAUDE.md publish rule exists. The 210 bats files are a fact. "Bash looks unprofessional" is a feeling. Cited from ADR-2000.

## Options considered

1. **Port the scripts to Node and publish to npm** — 12 days become 40, and the publish is irreversible.
2. **A thin zero-dependency CLI that calls the scripts, installed from git or a local tarball.**

## Decision

Option 2. `bin/arc.mjs` provides `init · doctor · compile`. The v1 invocation contract has two forms, both tested on a clean runner on the three OS legs (REQ-08):

1. `npx github:technology-ashiq/arc init --target <t>`
2. `npm i -g ./arc-<version>.tgz && arc init …`, from `npm pack`

`package.json` has an empty `dependencies`. **No `npm publish`**, no public README rewrite and no bash port happen in this cycle.

## Consequences

The CLI is only as portable as the bash bodies it calls. On Windows that means Git Bash (`bash` must resolve to Git Bash, not WSL; memory `hq-must-start-from-git-bash`), and `doctor` reports which `bash` it found.
