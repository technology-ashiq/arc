# Build Brief — phase 00 · the index exists and is honest

spec-hash: sha256:bf5e42dbd586e5db68ce8f8fd546863dcd459dd3fd16a8b727c3b5a20674f861
spec-hash-was: sha256:f07f05f9632b94df1d63ad6ea83463e5ed315e03f2d02aa24b160c7b273d307f
# Re-pointed by hand on 2026-08-11, in phase, deliberately -- the spec was corrected by THIS
# PHASE's own code, not by a change of mind: trial-ledger holds 49 ledger records not 37 and 19
# non-ledger rows not 31 (49+7+10+19 = 85 exactly, which the kickoff figures did not); docs/adr
# grew 140 -> 150 during the kickoff because this lane wrote ten ADRs; and a new section B3
# records why absolute counts are pinned only in fixture trees, plus the SECOND negative control
# the kickoff never specified. /arc-develop start refuses to regenerate over proven slices
# (ADR-0065), so the hash moves here, in the open, rather than the brief silently going stale.
# Moved a second time the same day, after CI refused the spec section C emit snippet: the
# kickoff wrote it from the payload shape and never ran it, and decision.recorded carries a
# WELDED idem that only arc-inbox derives. Both re-points are corrections of fact found by
# running the thing, not changes of intent -- no REQ, phase boundary or appetite moved.
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

likely-failure-mode: a parser hole in one adapter that the other four share, found by a fresh agent and not by the author
likely-regression-site: tests/fixtures/sync-golden/tree-manifest.txt - a byte-identity gate that passes locally and fails only on CI
riskiest-file: .claude/scripts/memory/lib/fields.mjs - every adapter's classification runs through its masking
expected-blockers: the spine cannot resolve inside this linked worktree, so the decisions organ is only measurable against the main clone or a seeded fixture
expected-proof-failures: MODULE_NOT_FOUND before the builder exists, then `expected build to FAIL on a seeded under-parse, got exit 0` before the count-verify is wired

### Slices

#### slice: 01

title: All 5 adapters (`retro-log`, `trial-ledger`, `learning-ledger`, `adr`, `decisions`) parse their organ and emit records — each a pure function, writing nothing (ADR-0700)
kind: logic
risk: high
proof: contract — `bats tests/memory-index.bats` :: the positive control parses every organ and every count matches
tier: contract
sources: phase-00-spec.md
decision: Five files under adapters/, each a pure function of a value. Not one uniform signature: adr needs its path (the number lives in the filename) and decisions has no text at all (the builder reads the spine and hands over the event array), which is what keeps spine-reader-lint green.
result: retro-log 54/54 - trial-ledger 49/49 - learning-ledger 4/4 - adr 150/150 - decisions 20/20 of 1004 spine events. 277 records.
commit: d594bfd

#### slice: 02

title: `N_parsed == N_indexed` printed **per organ**, and a deliberate mismatch fails the build
kind: logic
risk: medium
proof: contract — `bats tests/memory-index.bats` :: count-verify fails loudly when an organ under-parses, and :: a dropped record fails even when no expectation covers that organ
tier: contract
sources: phase-00-spec.md
decision: TWO channels, not one. The invariant N_parsed == N_indexed catches a record dropped after parsing; a per-fixture memory-expect.json catches an organ that under-parses, which leaves parsed and indexed agreeing on the wrong number. The live tree pins no absolute number at all - docs/adr grew 140 to 150 during this cycle.
result: organs-53of54 exits 1 with: expected 3 indexed record(s), got 2. organs-adr-collision exits 1 with: N_parsed 2 != N_indexed 1.
commit: d594bfd

#### slice: 03

title: **Code spans are masked before field-splitting**, and a fixture pins the one real row that proves why: the 2026-08-02 arc-model-policy row carries a literal `|` inside `` `(?:^|\n)##` ``. A naive split reports it as a malformed 6-field row and walls off a genuine lesson while `N_parsed == N_indexed` still passes — the count-verify cannot catch a misclassification, because excluded rows are outside `N_parsed`. Correct counts: **54** pattern rows, 10 scoreboard, **0 malformed** (ADR-0702)
kind: logic
risk: medium
proof: contract — `bats tests/memory-index.bats` :: a pipe inside a code span is data, not a separator
tier: contract
sources: phase-00-spec.md
decision: Mask code spans to spaces of the SAME length, split on the surviving pipes, then slice the ORIGINAL text at those offsets - so fields come back verbatim, backticks and pipes included. Multi-backtick runs are handled; an unclosed backtick must not swallow the line.
result: masked 54 pattern / 10 scoreboard / 0 malformed. naive 53 / 10 / 1. The row a naive split discards is the 2026-08-02 lesson about regex parsing bugs.
commit: d594bfd

#### slice: 04

title: Excluded rows are **named with file and line** (ADR-0702): the 10 retro scoreboard rows, and anything genuinely malformed — with the count of exclusions printed, so "zero exclusions" and "exclusions not checked" cannot look alike
kind: logic
risk: medium
proof: contract — `bats tests/memory-index.bats` :: every excluded row is named with its file and line
tier: contract
sources: phase-00-spec.md
decision: kind is set by the adapter that made the call, never re-derived by grepping the exclusion's own English message - a classifier that reads its display text reclassifies everything the day someone rewords it.
result: exclusions: 46 named, 0 malformed, each printed as path:line reason. 10 scoreboard + 7 headers + 10 separators + 19 non-ledger rows.
commit: d594bfd

#### slice: 05

title: Delete the index → rebuild → **the indexed record set is identical**: the same doc ids, in the same order, each with the same **record hash** — green on all 3 OSes, compared as records and never as db bytes (ADR-0701). **What is hashed:** sha256 over the record's **canonical serialization** — UTF-8, LF, keys sorted, no insignificant whitespace — which is arc's existing canonical form (ADR-0024). Hashing the serialized *record* rather than its source text is what makes the rule uniform across all five adapters, including `decisions`, whose records come from spine events and have no source text at all. **This phase proves INDEX determinism, not QUERY determinism**: ranking is Phase 1's, so a golden-query ordered-ids comparison cannot be run here and is Phase 1's exit criterion instead
kind: logic
risk: medium
proof: contract — `bats tests/memory-index.bats` :: delete the index and rebuild yields an identical record set
tier: contract
sources: phase-00-spec.md
decision: Hash the record's CANONICAL serialization (ADR-0024), not its source text - decisions records come from spine events and have no source text. Fixed organ order in code; ADRs globbed then sorted by filename; decisions sorted ULID-ascending, because directory order and spine append order are not stable across three OSes.
result: Two consecutive rebuilds on the live tree, index deleted between them: 277 records, dumped id+hash lines identical (diff empty).
commit: d594bfd

#### slice: 06

title: Staleness manifest (mtime + sha256, CRLF-normalized) present; any mismatch triggers a full rebuild with atomic temp-then-rename swap
kind: logic
risk: medium
proof: contract — `bats tests/memory-index.bats` :: the staleness manifest notices a changed organ
tier: contract
sources: phase-00-spec.md
decision: mtime is a cheap first filter only; the sha256 decides, so a touched-but-unchanged file does not force a rebuild and a changed file with a preserved mtime is still caught. ONE output file, temp-then-rename - two files renamed in sequence have a window where a reader sees a new index beside a stale manifest.
result: --status prints `stale: no (manifest matches)`; after appending one row it prints `stale: YES (docs/retro-log.md changed)`.
commit: d594bfd

#### slice: 07

title: **`memory-index.mjs` has a product-manifest entry** (`product-lint.mjs` green) and `tests/fixtures/sync-golden/tree-manifest.txt` is regenerated — a byte-identity gate that passes locally and fails only on CI. **Only the builder is registered in this phase**; `arc-recall.mjs` does not exist until Phase 1 and is registered there, in the same way
kind: logic
risk: medium
proof: static — `node .claude/scripts/core/product-lint.mjs`
tier: static
sources: phase-00-spec.md
decision: products/memory/manifest.json registers the seven scripts. arc-products.mjs CATALOG also needed the entry - tests/products.bats derives its expected list from the directory, so a manifest landing without its CATALOG entry fails there. Only the builder is registered in this phase; arc-recall.mjs does not exist yet.
result: product-lint: all manifests valid. sync delta diffed BEFORE re-recording: 7 added paths under scripts/memory plus exactly 3 content changes, all three deliberate edits of this commit.
commit: d594bfd

#### slice: 08

title: **Every new `tests/memory-*.bats` file has a measured entry in `tests/shard-timings.json`**, harvested from a real CI run; an unmeasured file is counted and named, never left riding the 16s default
kind: logic
risk: medium
proof: verified-real — `gh run view 31484005819 --json jobs`, windows shard 10/12, TAP timestamps
tier: verified-real
sources: phase-00-spec.md
decision: weigh-tests.yml takes no inputs and weighs all 105 files one job each, far too heavy to dispatch once per phase. The ordinary arc-ci log is timestamped per TAP line and the file runs inside ONE bats call in its shard, so the span from the TAP line before its first test to its last IS its contribution -- which is what the weight represents. Method recorded in the file, including the caveat that it was measured alongside other files rather than in isolation.
result: 31 tests, 44.5s on windows shard 10/12. Entered as 44. _known_gap drops from 4 unmeasured files to 3, and memory-index.bats is no longer riding _default_weight 16.
commit: 4ca0b49

#### slice: 09

title: Spine `decision.recorded` records are read **through the reader library only**; `spine-reader-lint.sh` stays green and `KINDS.length` is untouched at 44 (ADR-0703)
kind: logic
risk: medium
proof: static — `bash .claude/scripts/review/spine-reader-lint.sh`
tier: static
sources: phase-00-spec.md
decision: The lint's glob did not cover .claude/scripts/memory, so the DoD line would have passed on a file it never read. Added the directory. spine.mjs now re-exports spineRoot so a consumer can ask the reader where the spine is instead of importing lib/.
result: spine-reader-lint exit 0, and `git ls-files .claude/scripts/memory` shows 7 .mjs files now in its scan set. KINDS.length untouched at 44; zero events emitted.
commit: d594bfd

#### slice: 10

title: **The 12 golden queries (§D) are committed to `tests/fixtures/memory/golden-queries.tsv` in their own commit, before any adapter, alias or weight tuning** — the pass condition exists before the thing it grades (ADR-0706)
kind: logic
risk: medium
proof: contract — `bats tests/memory-index.bats` :: the golden query set carries no unresolved placeholder
tier: contract
sources: phase-00-spec.md
decision: Committed in its own commit before any adapter existed. Five rows carried `unresolved:` placeholders because their ids are content-positional and cannot be written down until the id grammar first runs; the loader must FAIL on a leftover placeholder rather than skip the row.
result: 12 rows, 4 tab-separated columns each, zero `unresolved:` tokens remaining. Resolved ids match a hand-derivation of the grammar exactly.
commit: e8a186c

#### slice: 11

title: **Grep baseline recorded**: those same 12 queries run by grep, timed, hit-rate tabled in evidence — measured BEFORE anything claims to beat it (ADR-0706)
kind: logic
risk: medium
proof: verified-real — `initiatives/memory/evidence/phase-00/grep-baseline.md`, 12 queries x 3 runs, median wall-clock
tier: verified-real
sources: phase-00-spec.md
decision: Measured at e8a186c, where .claude/scripts/memory does not exist. The pinned method scores 1/12 - but that is a floor artifact of grep having no ranking, so a strictly harder ORACLE control was recorded beside it: the rarest content word per query, i.e. grep at its best given someone who already knows the recorder's vocabulary.
result: pinned method 1/12 (STOP trigger is >= 10/12, does not fire). ORACLE 5/12 - and 5/12 is the number Phase 2 must beat. `officially` appears ZERO times in the corpus, which is the cleanest evidence for ADR-0709's alias layer.
commit: 98a9741

#### slice: 12

title: **Two fresh-agent adversarial passes on the adapters** (decision logic · shell/OS boundary) per ADR-0708, findings ledgered, holes fixed and pinned as fixtures or rejected with a reason
kind: logic
risk: medium
proof: verified-real — `initiatives/memory/evidence/phase-00/adversarial-decision-logic.md` and `initiatives/memory/evidence/phase-00/adversarial-shell-os.md`
tier: verified-real
sources: phase-00-spec.md
decision: Two fresh general-purpose agents in parallel, one on decision logic and one on the shell/OS boundary, neither having seen the implementation, both carrying this lane's running list of already-fixed defects with the instruction to check each one in every OTHER file.
result: 37 findings, 35 fixed, 2 rejected with a reason. EXACTLY ONE overlapped between the two agents (staleness blind to an added ADR) -- the measured argument for two surfaces rather than one attacker with more time. Nine fixes are one sentence: a line the parser did not understand left no trace, with N_parsed == N_indexed true throughout. The twin-fix this lane's pre-mortem predicted was found four lines apart in one function: the pipe split masked, the comma split below it not.
commit: 4ca0b49

#### slice: 13

title: tests added & green **on CI**, read per-JOB
kind: logic
risk: medium
proof: verified-real — `gh run view <id> --json jobs` read per-JOB, head SHA confirmed equal to local HEAD
tier: verified-real
sources: phase-00-spec.md
decision: CI is the only gate; no suite was run on this box. 31 tests in tests/memory-index.bats, auto-discovered by shard-tests.mjs, no workflow edit.
result: Run 31484874136 at head 1ff8ecb: 19/19 jobs success, read per-JOB. 31/31 memory tests EXECUTED and passed on all five OS x node combinations (ubuntu 18/20/22, macOS 20, windows 20) -- confirmed by counting TAP ok lines per leg, not by the absence of a failure.
commit: 1ff8ecb

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
