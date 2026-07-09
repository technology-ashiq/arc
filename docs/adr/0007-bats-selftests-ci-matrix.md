# ADR 0007 — bats-core self-tests; CI matrix ubuntu + windows Git Bash

**Status:** accepted · 2026-07-09

## Context
arc's entire enforcement machinery is bash. It currently has zero tests of itself — the single biggest credibility gap vs gstack (280 test files) and the root cause of drift like the unwired code-stamp. Its primary runtime is Git Bash on Windows, which differs from Linux bash in paths, available interpreters, and line endings.

## Decision
bats-core is the test framework for all hooks/scripts/adapters. GitHub Actions matrix runs the suite on ubuntu-latest AND windows-latest (Git Bash). Red CI blocks merge on the arc repo. New scripts must keep the python3→jq→sed parse-fallback pattern.

## Consequences
+ The mold finally practices what it preaches; Windows breakage caught pre-merge (pre-mortem #4, #6).
− CI minutes cost; bats has limited mocking — external tools faked via PATH-shim stubs (standard bats pattern).

## Amendment — 2026-07-09 (macOS support)
**Status:** accepted.

The CI matrix extends to **ubuntu-latest + windows-latest (Git Bash) + macos-latest** — three-OS
parity is the portability moat; a Linux-or-Windows-only enforcement layer is not credible.

New standing rule for ALL hooks/scripts/adapters: **bash-3.2-safe and POSIX-portable.** macOS ships
bash 3.2 (2007) as `/bin/bash`. Forbidden: `mapfile`/`readarray`, associative arrays (`declare -A`),
and GNU-only util flags. Use portable forms instead:
- text edit in place: write to a tmpfile + `mv` (not GNU `sed -i` vs BSD `sed -i ''`)
- dates: avoid GNU `date -d` / BSD `date -v` — pass values in or use `jq`/`awk`
- stat: avoid GNU `stat -c` / BSD `stat -f` — detect-and-branch or derive via `ls`/`wc`
- keep the existing `python3 → jq → sed` parse-fallback pattern

Consequence: existing Phase 00/01 scripts get a portability audit before the matrix goes green
(mostly already compliant — no mapfile/assoc-arrays used). **Code home: folded into Phase 02**
(gate-engine phase already rewrites the CI + gate-runner; new bash must be bash-3.2-safe from day one).
