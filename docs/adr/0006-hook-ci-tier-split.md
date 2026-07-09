# ADR 0006 — Hook tier vs CI tier split; heavy tools in docker

**Status:** accepted · 2026-07-09

## Context
Deploy-guard runs synchronously inside a PreToolUse hook — anything slow there destroys the dev loop. CodeQL, ZAP, Stryker, Lighthouse take minutes. ZAP and SonarQube-class tools are also painful natively on Windows.

## Decision
Two tiers declared per gate in `arc.gates.yaml`: **hook tier** (hard <30s budget: eslint, semgrep diff-scope, gitleaks, knip, jscpd) and **CI tier** (CodeQL, Trivy full, ZAP, Stryker, Lighthouse, schemathesis). Heavy tools run in docker. CI results sync back to the ledger; `/arc-ship` requires both tiers green.

## Consequences
+ Dev loop stays fast; Windows never runs ZAP natively.
− Ledger must reconcile async CI results with local stamps (Phase 2 gate-runner handles the merge).
− A ship can be blocked waiting on CI — accepted; that is the point.
