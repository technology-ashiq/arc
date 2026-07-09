# ADR 0003 — Trivy over Snyk for SCA

**Status:** accepted · 2026-07-09

## Context
SCA needs dependency + lockfile scanning. Snyk's free tier is rate-limited and account-gated; a paid tool as a hard dependency violates the non-negotiables. Trivy is fully free, SARIF-native, covers deps + IaC config, single binary.

## Decision
Trivy is the SCA spine (alongside osv-scanner). Snyk becomes an optional adapter if a future user brings a license.

## Consequences
+ Zero cost, zero account requirement, docker-friendly.
− Lose Snyk's curated fix advice — partially covered by osv-scanner advisories + triage agent summarization.
