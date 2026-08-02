# PLAN.md — fake lane (fixture)

> Fixture, not a real plan. Exists so `develop.mjs start` has a `## No-gos` section to derive the
> brief's `no-gos:` field from. Every bullet leads with a bold phrase, which is the contract the
> derivation rule depends on.

## Goal

Prove the develop lifecycle runs end-to-end offline.

## No-gos (explicitly out of scope)

- **Real network calls** — the fixture is offline by construction.
- **A second lane** — one lane is enough to exercise resolution.
- **Anything Phase 01 owns** — the lint is not built here.

## Non-negotiables

- Every slice declares its acceptance proof BEFORE implementation.
- The harness never runs git.
