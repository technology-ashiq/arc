# Build Brief — phase 00 · the index exists and is honest

spec-hash: sha256:f07f05f9632b94df1d63ad6ea83463e5ed315e03f2d02aa24b160c7b273d307f
lane: memory
reqs: 
adrs: 0024, 0026, 0700, 0701, 0702, 0703, 0706, 0707, 0708, 0709
blast-radius: .claude/scripts/, .claude/scripts/hq/lib/spine-io.mjs, .claude/scripts/hq/spine.mjs, .claude/scripts/memory/adapters/, .claude/state/memory/, .github/**, .github/scripts/shard-tests.mjs, docs/adr/, docs/adr/*.md, docs/develop/learning-ledger.md, docs/retro-log.md, docs/trial-ledger.md, initiatives/, initiatives/memory/evidence/phase-00/, initiatives/memory/evidence/phase-00/adversarial-<surface>.md, initiatives/memory/evidence/phase-00/grep-baseline.md, processes/**, products/hq/manifest.json, products/memory/manifest.json, sync-to-project.sh, tests/, tests/**, tests/fixtures/memory/, tests/fixtures/memory/golden-queries.tsv, tests/fixtures/memory/organs-53of54/docs/retro-log.md, tests/fixtures/sync-golden/tree-manifest.txt, tests/memory-*.bats, tests/memory-index.bats, tests/shard-timings.json, tests/sync.bats, tests/test_helper.bash:479
no-gos: No `playbooks/` directory, No embeddings, no vector search, no LLM at ingest or query time, No new spine event kinds, No semantic contradiction detection, No cross-lane edits, No auto-rule-writing, No chat, MCP, or dashboard surface, No cross-repo federation, No change to what `/arc-retro` writes or where, No incremental index updates
blast-radius-dropped: 20

### Non-negotiables

- The canonical path runs on **Node >= 18 on all three OSes** with **zero npm dependencies**; the sqlite engine is lazily imported and can never break the path it only accelerates.
- The index is **derived-only** and gitignored; deleting it and rebuilding must reproduce identical ordered results.
- Every indexed row is **count-verified** (`N_parsed == N_indexed`) and every excluded row is **named with file and line** — never silently dropped.
- Output is **verbatim**; every citation carries a repo-relative path; a bare number is never printed alone.
- Memory **writes nothing** to the company organs and **emits nothing** to the spine.
- Hooks are **additive**; no existing read is replaced, and generated commands are changed only through their process file.
- Every parser-class surface gets **two fresh-agent adversarial passes on two different surfaces, inside the phase that ships it**; found holes are pinned as fixtures, and each pass carries the running list of defects already fixed in this lane, to be checked against every other file.
- Before editing any shared root organ (`processes/**`, `tests/**`, `.github/**`), run `git log origin/main --oneline -5` on that path first — the `leads` lane is LIVE on the same files, and a collision is resolved then, in one place, never at merge time.
- **Tests are green on CI, never on the dev box**, read per-JOB; all fixtures are CRLF-normalized and all paths repo-relative forward-slash.

### Predictions

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: All 5 adapters (`retro-log`, `trial-ledger`, `learning-ledger`, `adr`, `decisions`) parse their organ and emit records — each a pure function, writing nothing (ADR-0700)
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: `N_parsed == N_indexed` printed **per organ**, and a deliberate mismatch fails the build
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: **Code spans are masked before field-splitting**, and a fixture pins the one real row that proves why: the 2026-08-02 arc-model-policy row carries a literal `|` inside `` `(?:^|\n)##` ``. A naive split reports it as a malformed 6-field row and walls off a genuine lesson while `N_parsed == N_indexed` still passes — the count-verify cannot catch a misclassification, because excluded rows are outside `N_parsed`. Correct counts: **54** pattern rows, 10 scoreboard, **0 malformed** (ADR-0702)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: Excluded rows are **named with file and line** (ADR-0702): the 10 retro scoreboard rows, and anything genuinely malformed — with the count of exclusions printed, so "zero exclusions" and "exclusions not checked" cannot look alike
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: Delete the index → rebuild → **the indexed record set is identical**: the same doc ids, in the same order, each with the same **record hash** — green on all 3 OSes, compared as records and never as db bytes (ADR-0701). **What is hashed:** sha256 over the record's **canonical serialization** — UTF-8, LF, keys sorted, no insignificant whitespace — which is arc's existing canonical form (ADR-0024). Hashing the serialized *record* rather than its source text is what makes the rule uniform across all five adapters, including `decisions`, whose records come from spine events and have no source text at all. **This phase proves INDEX determinism, not QUERY determinism**: ranking is Phase 1's, so a golden-query ordered-ids comparison cannot be run here and is Phase 1's exit criterion instead
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: Staleness manifest (mtime + sha256, CRLF-normalized) present; any mismatch triggers a full rebuild with atomic temp-then-rename swap
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: **`memory-index.mjs` has a product-manifest entry** (`product-lint.mjs` green) and `tests/fixtures/sync-golden/tree-manifest.txt` is regenerated — a byte-identity gate that passes locally and fails only on CI. **Only the builder is registered in this phase**; `arc-recall.mjs` does not exist until Phase 1 and is registered there, in the same way
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: **Every new `tests/memory-*.bats` file has a measured entry in `tests/shard-timings.json`**, harvested from a real CI run; an unmeasured file is counted and named, never left riding the 16s default
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: Spine `decision.recorded` records are read **through the reader library only**; `spine-reader-lint.sh` stays green and `KINDS.length` is untouched at 44 (ADR-0703)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: **The 12 golden queries (§D) are committed to `tests/fixtures/memory/golden-queries.tsv` in their own commit, before any adapter, alias or weight tuning** — the pass condition exists before the thing it grades (ADR-0706)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: **Grep baseline recorded**: those same 12 queries run by grep, timed, hit-rate tabled in evidence — measured BEFORE anything claims to beat it (ADR-0706)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 12

title: **Two fresh-agent adversarial passes on the adapters** (decision logic · shell/OS boundary) per ADR-0708, findings ledgered, holes fixed and pinned as fixtures or rejected with a reason
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 13

title: tests added & green **on CI**, read per-JOB
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 14

title: tracker updated (PROGRESS.md row ✅ + done-log)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
