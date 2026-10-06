# Phase 03 — The human gate, the venture.yaml exporter, and one real hunt

**Goal (one line):** an owner-approved finalist leaves as a `venture.yaml` that launch's own `loadProfile()` accepts with zero edits, proven on one real niche end to end.
**Appetite:** 2 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-02
**REQs closed here:** REQ-05, REQ-06, REQ-09, REQ-07

## Scope

- Inbox handoff (`approval.requested`) → owner `decision.recorded` with `cluster_fp` + token set (the writer test loads Phase 01's pinned reject fixture); the exporter (serializer) → `{slug}.venture.yaml` + `{slug}.hunt.md`, with injection fixtures checked against every `fixed-defects.md` line; the slug guard and refuse-on-exists; the money seed as a yaml comment; the CI fixture over launch's imported `loadProfile`/`resolveBoard`; the REAL hunt from the main clone after the code PR merges, its evidence in a second small PR; adversarial pass; retro.

## Exit criteria (Definition of Done)

- [ ] REQ-05/06/09/07 acceptance met as written in PLAN; CI per JOB green; evidence bundle merged; closed through `/arc-phase-done 03` from the MAIN clone; tracker updated

## Verification plan

- Coarse: CI bats `tests/discover-export.bats` (positive + injected-negative over launch's `loadProfile`), then the real hunt from the main clone with wall-clock timing. Refined at phase start via `/arc-change`.

## Rabbit holes in this phase

- Adding a field launch lacks: it goes in `.hunt.md` (ADR-1905).

## Out of scope for this phase

- invoking `arc launch new` (the owner runs it)

## Non-negotiables (verbatim from PLAN)

- Miner, normalizer, clusterer and exporter are parser-class: hostile web text must never reach a shell, an eval or the yaml, proven by injection fixtures in BOTH the clusterer and the exporter (twin-fix rule).
- The `venture.yaml` is written by a serializer, never string-built, and carries exactly the LAU-J fields (ADR-1905).
- Two-surface adversarial pass via `/arc-attack` (ADR-0226) per PR, logic and boundary, carrying `initiatives/discover/fixed-defects.md`; the author is never the attacker.
- Deterministic pipeline: the same snapshot gives identical clusters, scores, order and yaml bytes on all 3 OS legs against a committed golden hash; no float, locale sort, CRLF, wall-clock or absolute path in any hashed output.
- Evidence links are preserved end to end: a score without clickable sources is invalid, and a `venture.yaml` without a linked `.hunt.md` is invalid.
- Zero new spine kinds and no edit to any council payload; reads go through the spine reader only (ADR-1906, ADR-1910).
- growth's adapter and launch's contract are imported, never copied or edited (ADR-1901, ADR-1912).
- Zero npm deps; central `tests/`; tests run on CI only, and every fixture asserts it RAN before asserting what it printed.
- Model tiers are named by ADR-0069 tier names; no quiet `model:` edits.
