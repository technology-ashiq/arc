# ADR 0011 — Root-cause memory is an append-only JSONL ledger, not a knowledge graph

**Status:** proposed · 2026-07-10

## Context
Reviews and retros currently forget: the same class of bug can recur without arc noticing.
A "quality knowledge graph" was proposed (cross-repo learning, pattern confidence). At arc's
data scale (one repo, one team) a graph DB is negative ROI — empty infrastructure plus
maintenance. But the 70%-value core is cheap: remember past findings + root causes and put
them in front of the reviewer.

## Options considered
1. **Graph DB / embeddings store** — pros: scales to the grand vision; cons: no data to fill it,
   new heavy dependency, violates the no-paid/no-heavy-deps posture.
2. **Append-only JSONL ledger + prompt injection** — pros: merge-friendly by construction
   (same pattern as the baseline file), greppable, zero deps, Claude-readable; cons: linear
   scan (irrelevant at this scale), no cross-repo learning (premature anyway).

## Decision
Option 2. `docs/evidence/findings-ledger.jsonl` — one line per resolved finding/incident:
fingerprint, category, root cause (one sentence), gate that caught it (or `escaped`), fix ref,
date. Written by `/arc-retro`, `/arc-fix-issue`, and triage resolution. Consumed two ways:
(a) code-reviewer agent gets the ledger's category/root-cause digest in its context;
(b) an escaped-defect entry triggers the retro question "which gate should have caught this →
tighten it" — the time-machine loop, human-driven, no ML.

## Consequences
+ Reviews get institutional memory at the cost of one flat file.
+ Escaped defects become gate improvements instead of anecdotes (feeds north-star metric).
+ Clean upgrade path: if data ever justifies it, the ledger is the import format for a real graph.
− Digest must stay small (token budget) — cap at category counts + last-N root causes.
− Garbage-in risk: root-cause line is required at write time; empty root cause = ledger write fails.
