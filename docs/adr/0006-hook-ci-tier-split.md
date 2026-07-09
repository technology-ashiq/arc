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

## Amendment — 2026-07-09 (pinned arc-tools docker image)
**Status:** accepted.

The **CI tier runs from a single, version-pinned `arc-tools` docker image** (all heavy verifiers —
CodeQL, Trivy, ZAP, Stryker, Lighthouse, schemathesis — at fixed versions). Rationale: a verdict is
only evidence if it is reproducible; pinning gives version stability + dev/CI parity, so the same
input yields the same findings/fingerprints across runs and machines (evidence integrity, ties to
the baseline in ADR-0002).

The **hook tier stays native** (no docker): the <30s budget cannot absorb container start-up, and a
hook must not depend on a running Docker daemon (often absent on a dev box). Hook-tier tools are
therefore installed natively / via `/arc-toolcheck --fix`, not pulled from the image.

Code home: image build lands in **Phase 03** (first heavy CI tools arrive there).
