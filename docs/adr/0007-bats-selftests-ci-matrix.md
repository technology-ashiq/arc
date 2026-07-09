# ADR 0007 — bats-core self-tests; CI matrix ubuntu + windows Git Bash

**Status:** accepted · 2026-07-09

## Context
arc's entire enforcement machinery is bash. It currently has zero tests of itself — the single biggest credibility gap vs gstack (280 test files) and the root cause of drift like the unwired code-stamp. Its primary runtime is Git Bash on Windows, which differs from Linux bash in paths, available interpreters, and line endings.

## Decision
bats-core is the test framework for all hooks/scripts/adapters. GitHub Actions matrix runs the suite on ubuntu-latest AND windows-latest (Git Bash). Red CI blocks merge on the arc repo. New scripts must keep the python3→jq→sed parse-fallback pattern.

## Consequences
+ The mold finally practices what it preaches; Windows breakage caught pre-merge (pre-mortem #4, #6).
− CI minutes cost; bats has limited mocking — external tools faked via PATH-shim stubs (standard bats pattern).
