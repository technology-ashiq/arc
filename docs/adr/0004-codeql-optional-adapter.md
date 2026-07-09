# ADR 0004 — CodeQL as optional adapter; semgrep is the SAST spine

**Status:** accepted · 2026-07-09

## Context
CodeQL's taint-tracking catches dataflow bugs semgrep misses, but its license is free only for OSS on GitHub; arc must work on private repos without licensing risk.

## Decision
semgrep (+ custom rules) is the always-available SAST layer. CodeQL is a CI-tier **optional adapter**: auto-detected, SKIPPED when unavailable/unlicensed, standard security query suites only this cycle.

## Consequences
+ No licensing landmine; private-repo users lose nothing they had.
+ OSS projects get deep dataflow analysis free.
− Two SAST vocabularies to normalize (handled by ADR-0001 minimal SARIF).
