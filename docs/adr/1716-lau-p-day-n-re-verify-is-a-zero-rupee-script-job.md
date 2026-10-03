# ADR 1716 — LAU-P: day-N re-verify is a ₹0 script-class scheduler job

**Status:** accepted
**Date:** 2026-10-03
**Product:** `launch`
**Reversibility:** two-way

## Context

Certs expire, DMARC drifts, backups stop. Nobody looks. Locked in the design source `docs/strategy/plans/PLAN-launch.md` (v1.1, review-adjudicated). Fired by the owner ruling of 2026-10-03 (ADR-1700).

## Options considered

1. **Manual re-verify** — free / never happens.
2. **One `hq.jobs.yaml` row per venture, weekly, `verify --all`, LLM-free, browser-free**.

## Decision

Option 2 (OPS-G posture).

## Consequences

A regression surfaces as a brief `needs-you` line now, and as ops' `incident.raised` once ops is born.
