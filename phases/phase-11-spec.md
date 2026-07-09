# Phase 11 — Findings ledger (root-cause memory)

<!-- Next cycle. Depends on: Phase 02 (triage/suppression flow); feeds code-reviewer + retro. ADR-0011. -->

**Goal (one line):** resolved findings and escaped defects accumulate in an append-only JSONL ledger whose digest feeds review context and turns every escaped defect into a gate improvement — institutional memory without a graph DB.
**Appetite:** 1 week.

## Exit criteria (Definition of Done)

- [ ] `docs/evidence/findings-ledger.jsonl` — one line per entry: fingerprint, category, root cause (required, non-empty), caught-by gate or `escaped`, fix ref, date; append-only, sorted, merge-friendly (baseline-file pattern)
- [ ] Writers wired: `/arc-retro`, `/arc-fix-issue`, triage resolution — empty root cause = write refused
- [ ] code-reviewer agent receives ledger digest (category counts + last-N root causes, hard token cap) in its context
- [ ] `escaped` entry triggers the retro prompt: "which gate should have caught this → proposed tightening" — output lands as a profile/gate change or an ADR, tracked
- [ ] Live demo: seed ledger with a recurring category → code-reviewer flags a new instance of that pattern citing the ledger
- [ ] bats + 3-OS CI green; tracker updated

## Rabbit holes in this phase

- Graph DB / embeddings temptation → refused by ADR-0011; JSONL is the import format if scale ever justifies it
- Digest bloat → hard cap (category counts + last 20 root causes); no full-ledger prompt dumps

## Out of scope for this phase

- Cross-repo learning · pattern-confidence scoring · any ML — premature at current data scale

## Your-setup / pending

- None
