# ADR 1304 — FACE-E: Map lines and stations are declared in manifests, never hand-drawn

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a real pipeline cannot be expressed as `face.stations` rows (a line
that is not a sequence of named steps) — the schema grows by ADR, the app never gains a
hand-drawn line.

## Context

The overview is a transit map of the pipelines (the design's fifth physics point): every
pipeline a line, every human gate a stamp station, the Inbox the interchange, the Spine
the ring line. Twenty-plus lines drawn by hand in the app would rot the day any lane
changes a step.

## Options considered

1. **Lines/stations from manifest `face:` sections (+ planned-rooms registry)** — pros:
   the map is derived state; a lane that changes its pipeline updates its own manifest;
   `face-coverage` can assert every line has a home. Cons: manifests must carry station
   data (schema work in Phase 05).
2. **Hand-drawn map in the L3 app** — pros: full visual control. Cons: silent drift from
   the tree; violates "the face never pretends".

## Decision

Option 1. Lines and stations come from `face.stations` in each product manifest; shared
stations join by **kind** (`approval.requested` → Inbox interchange, `run.completed`,
`metric.observed`, `incident.raised`, …). Rendering states are fixed: circle = machine
step · square = stamp · lock = seal · **dashed = built, unexercised** (a line with no
receipt ever, labelled *fixture-proven, unexercised*) · **dotted = planned** (from the
planned-rooms registry, never an invented manifest). A station with a receipt in the last
24 h glows once (200 ms) then stays lit; open human gates show an amber count square.

## Consequences

Easier: the map cannot lie about a pipeline the tree doesn't have; new lanes appear by
birth-rule (ADR-1306). Harder: map legibility at 20+ lines is a jury check, not a given
(assumptions row 4 — zoom-to-ring is the pre-decided fallback).
