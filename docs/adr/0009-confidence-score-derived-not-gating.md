# ADR 0009 — Deployment confidence score is a derived summary, never a gate

**Status:** proposed · 2026-07-10

## Context
Gates emit per-gate verdicts (`verdict.json`, coverage summary, review ledger) but no single
answer to "how safe is this release?" Managers and future policy packs need one number with a
per-dimension breakdown (security / testing / architecture / docs). The fork: does the score
itself block, or is it presentation-only?

## Options considered
1. **Score as a new gate** (block below N%) — pros: one knob; cons: double-gating (individual
   gates already block), weights become a hidden policy, gaming target.
2. **Score as derived summary only** — pros: zero new blocking behavior, pure aggregation over
   existing evidence, cheap; cons: managers may still want a hard cutoff (defer to profiles).

## Decision
Option 2. A post-gate aggregation step (`.claude/scripts/confidence-score.sh`) reads every gate's
evidence artifact and emits `confidence.json`: weighted 0–100 total, per-dimension subscores,
top-3 recommended actions. Weights live in `arc.gates.yaml` (per-phase profile, ratchet rules
apply). Blocking stays exclusively with individual gates (ADR-0008). Score output feeds the
statusline, `/arc-phase-done` summary, and the Quality Passport (ADR-0010).

## Consequences
+ Single-glance UX ("Confidence 92%") without touching enforcement semantics.
+ Passport and policy packs get their summary field for free.
− A number invites gaming pressure — mitigated because inputs are the unfakeable gate artifacts.
− Weights are opinions; default table ships as template, projects tune their yaml (same pattern
  as the Phase 5 ratchet table).
