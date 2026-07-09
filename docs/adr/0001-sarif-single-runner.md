# ADR 0001 — SARIF as single findings format; one arc-scan runner with adapters

**Status:** accepted · 2026-07-09

## Context
Integrating 10+ industry tools (semgrep, CodeQL, Trivy, gitleaks, Stryker, ZAP…) per-gate would create N bespoke pipelines (gstack's per-skill model). Each tool has its own output format; gates need one merge point for triage, baseline, and evidence.

## Decision
One `arc-scan` runner: diff-scope → per-tool adapter files → normalize to a **minimal SARIF field set** (ruleId, level, message, location, fingerprint) → single merged result. New tool = one adapter file, nothing else changes.

## Consequences
+ Adding tools becomes cheap; triage/baseline/suppression written once.
+ Structural advantage over per-skill pipelines (single evidence artifact).
− Lossy vs full SARIF spec (accepted — rabbit-hole detour).
− Adapter interface is a new abstraction to maintain; extracted only after 2 real adapters exist (Phase 0).
