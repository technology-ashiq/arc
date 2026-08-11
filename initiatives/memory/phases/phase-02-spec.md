# Phase 02 — decisions, conflicts, proof

**Goal (one line):** Past decisions become queryable, contradicting rules meet a human before they land, review starts receiving recall automatically, and recall quality becomes a number CI can fail on.
**Appetite:** 1.25 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-01

**Decisions this phase implements:** ADR-0703 (reader-only decision queries, zero new kinds) · ADR-0705 (write-time conflict surfacing, T=0.5, semantic detection out of scope) · ADR-0706 (golden set gates; surfaced→cited stays observational) · ADR-0701 (the equivalence gate between the canonical JS engine and the sqlite accelerator) · ADR-0704 (the review hook is an additive process-file step) · ADR-0707 (`lane` stays provenance, so the review hook works in a zero-lane tree too).

## Exit criteria (Definition of Done)

- [ ] REQ-04 — `--decisions 'verdict:reject reason~worktree'` filters `decision.recorded` through the reader only; seeded fixture returns byte-exact `reason` text; `KINDS.length` still 44 (ADR-0703)
- [ ] REQ-05 — `/arc-retro` pre-append near-duplicate check (>= 2 shared tags AND overlap >= 0.5); planted near-dup pair surfaces before append; nothing auto-resolves (ADR-0705)
- [ ] REQ-06 — 12 golden queries wired into CI as a **failing** gate; the Phase-0 grep baseline is beaten, comparison table in evidence; surfaced→cited log seeded at `.claude/state/memory/surfaced-cited.jsonl` and barred from gating (ADR-0706)
- [ ] REQ-07 — equivalence gate asserts both engines return the **same ordered ids** for all 12 golden queries under a documented **id-ascending tie-break on equal bm25**, and **skips visibly** on the 4 OS×node combinations without `node:sqlite`; a run in which *every* leg skipped is a FAIL (ADR-0701)
- [ ] REQ-08 — review hook landed as a `processes/review-diff.process.yaml` edit; fixture review surfaces a path-matched rule from a diff-derived query (ADR-0704)
- [ ] **Two fresh-agent adversarial passes on this phase's three new parser surfaces** — REQ-04's `--decisions` filter grammar, REQ-05's near-duplicate detector, REQ-08's diff-derived query — across the two required surfaces (decision logic · shell/OS boundary), findings ledgered (ADR-0708). This phase ships three parser-class surfaces in its thinnest appetite; 2026-08-02 recorded three gates skipping this pass in one phase, caught only when the close refused
- [ ] **The Phase-1 hook pass's fixed-defect list is handed to this phase's attackers**, with each defect checked against `review-diff.process.yaml` — the two hooks are near-identical edits 0.75d apart, which is the twin-fix shape the retro-log records more often than any other
- [ ] Retro row + HISTORY entry written; **every cut recorded with its reason**
- [ ] tests added & green **on CI**, read per-JOB
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts (detailed verification for a far-future phase is fiction): each REQ above is proven by its own bats fixture plus the evidence artifact named beside it, with the golden-set gate and the equivalence gate both running as CI jobs and both demonstrated failing once before being trusted.

## Rabbit holes in this phase

- **An equivalence gate that passes by skipping.** On 4 of the 5 OS×node combinations `node:sqlite` does not exist. Detour: the skip is **visible and counted** in the job output, and the one leg that can (ubuntu Node 22) must actually run both engines — a run where every leg skipped is a FAIL, not a pass. This is a pass condition that fails for insufficiency, not only for rule-breaking.
- **A conflict check that fires on everything.** Detour: T = 0.5 has a retune trigger in the assumptions ledger; if it fires on more than 1 in 3 real appends, it is retuned rather than tolerated.
- **Cutting quietly.** Detour: this phase carries the designated cuts; each cut is recorded in the retro row with its reason, per the pinned cut order. Note the owner raised the appetite 4d → 5d on 2026-08-11 **rather than** cutting REQ-07, so a cut here is now a genuine exception and not the expected path — and a second extension is a kill conversation, not a third number.

## Out of scope for this phase

- Embeddings, vector search, cross-repo federation, `--recurring` reports, typed-link dossier rendering, council precedent recall, a `rules/*.md` adapter, dashboard or chat surfaces — all banked stretch with their own named pull triggers in the design source.
- The Context-Pack ↔ recall integration, which is a follow-up `/arc-change` to the `develop` lane.

## Your-setup / pending

Nothing new.

## Non-negotiables (verbatim from PLAN)

- The canonical path runs on **Node >= 18 on all three OSes** with **zero npm dependencies**; the sqlite engine is lazily imported and can never break the path it only accelerates.
- The index is **derived-only** and gitignored; deleting it and rebuilding must reproduce identical ordered results.
- Every indexed row is **count-verified** (`N_parsed == N_indexed`) and every excluded row is **named with file and line** — never silently dropped.
- Output is **verbatim**; every citation carries a repo-relative path; a bare number is never printed alone.
- Memory **writes nothing** to the company organs and **emits nothing** to the spine.
- Hooks are **additive**; no existing read is replaced, and generated commands are changed only through their process file.
- Every parser-class surface gets **two fresh-agent adversarial passes on two different surfaces, inside the phase that ships it**; found holes are pinned as fixtures, and each pass carries the running list of defects already fixed in this lane, to be checked against every other file.
- Before editing any shared root organ (`processes/**`, `tests/**`, `.github/**`), run `git log origin/main --oneline -5` on that path first — the `leads` lane is LIVE on the same files, and a collision is resolved then, in one place, never at merge time.
- **Tests are green on CI, never on the dev box**, read per-JOB; all fixtures are CRLF-normalized and all paths repo-relative forward-slash.
