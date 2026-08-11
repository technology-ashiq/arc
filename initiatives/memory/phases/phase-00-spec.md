# Phase 00 — the index exists and is honest

**Goal (one line):** Every recorded lesson in the five company organs lands in one rebuildable index, with the count proven per organ and every skipped row named out loud.
**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** none

**Decisions this phase implements:** ADR-0700 (index in place, own nothing) · ADR-0701 (the canonical JS index is what Phase 0 builds; no sqlite here) · ADR-0702 (field-count parsing, named exclusions, stable id grammar) · ADR-0703 (spine reached through the reader only) · ADR-0706 (the golden set is authored and committed here, before anything it grades exists; the grep baseline is measured here) · ADR-0708 (two fresh-agent adversarial passes, in this phase).

## Execution contracts — what the executor is given and must not invent

> This section exists because a context-isolated executor reads only PLAN.md and this file. Every
> value below was measured against the live tree on 2026-08-11, not assumed.

### A. Doc-id grammar (ADR-0702)

```
retro:<YYYY-MM-DD>#<n>     n = 1-based ordinal among PATTERN rows of that date; scoreboard rows never counted
trial:<YYYY-MM-DD>#<n>     n = 1-based ordinal among LEDGER data rows of that date
learn:<L-NNN>              the id already written in the block heading
adr:<NNNN>                 rendered as: ADR-0026 (docs/adr/0026-spine-c-closed-event-kind-vocabulary-v1.md)
spine:decision/<ulid>
```

Ids derive from content position and stable keys, never from database rowids, so they survive a
rebuild. A rendered citation always carries the repo-relative path; a bare number is never printed
alone.

### B. Adapter record schemas

| Adapter | Source | Record fields | Named exclusions (printed with file + line) |
|---|---|---|---|
| `retro-log` | `docs/retro-log.md` | date, project, pattern, prevention, tags[] (comma-split) | the 10 nine-field scoreboard rows; blank and header lines |
| `trial-ledger` | `docs/trial-ledger.md` | date, gate, run-ref, fired, false-positive | the **7** table headers, **10** separator rows, and **31** rows belonging to the three unrelated 3-column tables (`group / why it is in trial / what would promote it`, `gate / fire data / kept WARN because`, `# / Assertion / Covers`) |
| `learning-ledger` | `docs/develop/learning-ledger.md` | id (L-NNN), what-failed, why-missed, prevention, type, tags, links{adr,rule,fixture,phase,lane}, verdict | none expected; a malformed block is a named error, never a silent skip |
| `adr` | `docs/adr/*.md` — the glob result is **sorted by filename** (i.e. by ADR number) before indexing, because directory order is not stable across the three OSes and "same order on rebuild" is a non-negotiable | number, slug, title (H1), status (`**Status:**` line), first paragraph | none; unparseable frontmatter is named and the file is indexed title-only |
| `decisions` | spine, via reader | ulid, ts, decides, verdict, reason | quarantine is never read; non-`decision.recorded` kinds are untouched |

**Measured counts this phase must reproduce exactly:** `retro-log 54/54` · `trial-ledger 37/37` ·
`learning-ledger 4/4` · `adr 140/140` · `decisions N/N`.

### B2. How fixture content reaches the adapters (the test-injection door)

The real organs always parse correctly, so the mandated negative controls are unreachable without
a way to point the builder at fabricated content. Two doors, both required:

- **Adapters are pure functions**, exported individually, so a unit fixture needs no filesystem at
  all. "Pure" means no I/O of the adapter's own — **not** that every signature is identical, and
  three of the five need more than a bare string:

  | Adapter | Signature | Why |
  |---|---|---|
  | `retro-log` | `parse(text) -> { records, exclusions }` | one file, ids derive from date + ordinal within the text |
  | `trial-ledger` | `parse(text) -> { records, exclusions }` | same |
  | `learning-ledger` | `parse(text) -> { records, exclusions }` | ids are the `L-NNN` written in the block |
  | `adr` | `parse(text, path) -> { records, exclusions }`, called **once per file** | §A requires the citation to carry both `adr:<NNNN>` and the exact repo-relative path, and neither is recoverable from the file body alone — the number lives in the filename. The caller globs `docs/adr/*.md` and supplies the path; the adapter still performs no I/O |
  | `decisions` | `fromEvents(events) -> { records, exclusions }` | there is **no text** to parse: §C mandates the spine be reached only through `spine.mjs`'s `query`/`readAll`. The caller does the reading; the adapter is handed the already-read event array, which keeps it pure and keeps `spine-reader-lint.sh` green |

  The rule that actually matters is the one all five share: **an adapter never opens a file and
  never touches the spine**. Reading is the builder's job, so every adapter is testable by passing
  it a value.

  **File layout:** one adapter per file under `.claude/scripts/memory/adapters/`, named for its
  organ (`retro-log.mjs`, `trial-ledger.mjs`, `learning-ledger.mjs`, `adr.mjs`, `decisions.mjs`).
  **All of Phase 0's bats content lives in the single file `tests/memory-index.bats`** — later
  phases add their own `tests/memory-*.bats`, which is why the DoD speaks of the glob.
- **The builder takes `--root <dir>`**, defaulting to the git toplevel, and resolves every organ
  path relative to it. The negative controls live as small organ trees under
  `tests/fixtures/memory/`, e.g. `tests/fixtures/memory/organs-53of54/docs/retro-log.md` — a copy
  of the real file with one pattern row removed — and the test runs
  `node .claude/scripts/memory/memory-index.mjs --root tests/fixtures/memory/organs-53of54 --rebuild`
  and asserts a non-zero exit. **A fixture tree carries all five organs, not only the modified one**, so that an
  unrelated missing-file error cannot masquerade as the count mismatch the test is trying to
  prove.

`--root` also gives the root-mode fixture (ADR-0707) somewhere to live: a fixture tree with no
`initiatives/` directory is just another root.

Note the trial-ledger figure: the file holds **85 pipe rows**, of which only **37** are ledger
records. Counting all 85 would index seven headers, ten separators and three unrelated tables as
if they were evidence.

### C. Spine access (ADR-0703)

The reader is `.claude/scripts/hq/spine.mjs`. Use its exported `query(root, filters)` (or
`readAll(root, engine)`); never open `events/**`, `*.jsonl` or `state.db` directly. The guard is
`bash .claude/scripts/review/spine-reader-lint.sh`, which greps the tracked hq source for exactly
those forbidden tokens and must stay green.

`decision.recorded` has a **closed** payload — `decides` (the ULID of the `approval.requested` it
decides), `verdict` (exactly `approve` or `reject`, case-exact), and `reason` (non-empty string).
No other key may exist.

**Building the seeded fixture spine — the emitter, not the reader.** `spine.mjs` is read-only by
design, so it cannot create the fixture. The writer is:

```
bash .claude/scripts/hq/arc-event.sh emit decision.recorded --payload '<json>'
```

run with **`ARC_SPINE_ROOT`** set to the scratch directory — the documented test-only door
(`.claude/scripts/hq/lib/spine-io.mjs`). Set it to a **non-empty** path: the variable is read by
**presence, not truthiness**, so `ARC_SPINE_ROOT=""` is a recorded failure shape, not a no-op.
Emitting through the real command means the fixture is produced by the same validator that guards
production, so a fixture that could not exist in production cannot exist in the test either.

Two operational facts, both learned the hard way while emitting this kickoff's own receipts:

- The emitter **refuses to write across checkouts**. Run from a worktree whose spine lives in
  another clone, it quarantines and tells you which directory to run from. Do not reach across
  with `ARC_SPINE_ROOT` — that is a test door, not a transport.
- **`decides` must be the ULID of a real `approval.requested`.** A decision cannot decide itself,
  and `verdict` is exactly `approve` or `reject`, case-exact. So the fixture seeds the approval
  first, captures the printed ULID, and only then seeds the decision that references it. The
  approval's own payload is `{"what": "<one line of what is being approved>", "gate": "<gate
  name>"}` — the emit command prints the new ULID on stdout and nothing else, so the fixture
  captures it directly:

  ```
  APPROVAL=$(ARC_SPINE_ROOT=<scratch> bash .claude/scripts/hq/arc-event.sh emit approval.requested \
      --payload '{"what":"seed for the memory decisions fixture","gate":"fixture"}')
  ARC_SPINE_ROOT=<scratch> bash .claude/scripts/hq/arc-event.sh emit decision.recorded \
      --payload "{\"decides\":\"$APPROVAL\",\"verdict\":\"reject\",\"reason\":\"worktree mode B is not certified\"}"
  ```

  Both kinds are already in the closed vocabulary, so neither is a vocabulary change. Note the
  `reason` text above is chosen so the `--decisions 'verdict:reject reason~worktree'` fixture in
  Phase 2 has something real to match.

After seeding, **look in both `events/` and `events/_quarantine/`** and confirm where the fixture
actually landed. Exit 0 from a fire-and-forget writer is not evidence that anything was written —
that is the 2026-08-02 lesson, and this phase's own fixture is the first place to honour it.

### D. The 12 golden queries — authored, resolved and committed IN THIS PHASE

They are committed to `tests/fixtures/memory/golden-queries.tsv` **in their own commit, before any
adapter, alias or weight tuning** (ADR-0706). Phase 0 needs them for its own rebuild-identity and
grep-baseline criteria; Phase 2 only wires them into CI as a gate.

| # | Query | Expected in top-3 |
|---|---|---|
| 1 | which ADR closed the spine event kind vocabulary | `adr:0026` |
| 2 | duplicate receipts silently lost idem preimage | the 2026-07-28 spine retro row |
| 3 | can two lanes emit in parallel worktree mode B | `adr:0056` |
| 4 | author wrote breaking inputs all caught fresh agent found holes | `learn:L-001` |
| 5 | exit 0 but receipts quarantined fire-and-forget | `learn:L-002` |
| 6 | appetite sum warned zero slack inverted fire | the `appetite-sum` trial-ledger rows |
| 7 | two sessions same ADR numbers collision century | the 2026-08-02 adr/numbering retro row |
| 8 | markdown heading regex anchored line start prose mention | the 2026-08-02 model-policy regex row |
| 9 | apostrophe single-quoted shell embedded node broke | the 2026-08-03 quoting row |
| 10 | when is a cycle officially closed which document | `adr:0071` |
| 11 | test passed while executing nothing vacuous | the 2026-08-03 vacuous-pass row |
| 12 | who approves a learning promotion fresh agent owner | `adr:0108` |

**File format** — `tests/fixtures/memory/golden-queries.tsv`, tab-separated, LF, one row per query,
a leading `#` comment line naming the columns:

| col | name | meaning |
|---|---|---|
| 1 | `id` | `G01`..`G12`, stable forever — a golden query is never renumbered |
| 2 | `query` | the literal string passed to `arc-recall`, verbatim, no shell quoting |
| 3 | `expect` | **one or more** accepted doc-ids, comma-separated. **Any one of them appearing in the top 3 passes the row** — this is what lets query 6 accept any of the `appetite-sum` ledger rows without pretending there is a single right answer |
| 4 | `note` | why this query exists / which miss it was added for (ADR-0709) |

Rows naming a retro row rather than a literal id are resolved to their exact `retro:DATE#n` /
`trial:DATE#n` ids **once the id grammar first runs**, and those resolved ids — one row may legally
carry several — are what get committed, still before any tuning, so the set cannot be bent to
flatter the results.

### D2. Grep baseline method (the number an assumptions-ledger trigger depends on)

The baseline decides whether the module's premise holds, so the method is fixed here rather than
chosen later:

- **Pattern:** for each query, drop stopwords and keep the content words; the grep pattern is
  those words joined by `|`. Case-insensitive, extended regex. **The stopword list is pinned here
  verbatim, because it is a gate input** — two executors with different lists get different hit
  counts, which can flip the `>= 10 of 12` STOP trigger:

  ```
  a an and are as at be but by can did do does for from had has have how i in is it its
  of on or that the their then there these they this to was were what when where which
  who why will with you your
  ```

  Nothing else is dropped. Technical tokens keep their punctuation (`sed -i`, `p=none`, `exit 0`)
  — the same reason ADR-0709 refuses stemming.
- **Command:** `grep -rniE "<pattern>" docs/retro-log.md docs/trial-ledger.md docs/develop/learning-ledger.md docs/adr/`
- **"Top-3 hit" for grep:** grep has no ranking, so its only order is file-then-line order. The row
  counts as a hit if an expected id's source line is among the **first 3 matching lines** of that
  output. This is deliberately **generous to grep** — a hostile definition would make the module
  look good by construction, which is the failure this baseline exists to prevent.
- **Timing:** three runs per query, **median** wall-clock recorded, on the owner box.
- **Recorded as:** a 12-row table of query · grep time · hit yes/no · which id matched, plus the
  total hit count out of 12, in `initiatives/memory/evidence/phase-00/grep-baseline.md`.

If grep scores **>= 10 of 12**, the assumptions-ledger row fires and the module's premise is thin —
that is a STOP-and-report to the owner, not a number to quietly improve.

### E. Adversarial passes and their ledger (ADR-0708)

Two agents, spawned fresh via the Task tool with `subagent_type: general-purpose` (there is no
purpose-built attacker type; what makes the pass work is the fresh context and the prompt, not a
specialised agent), neither having seen the implementation, each given the source + the rules +
the existing fixtures + "walk past it". Surface 1: decision logic (field
splitting, masking, exclusions, id grammar, counts). Surface 2: shell/OS boundary (paths, CRLF,
quoting, unicode, argv, exit codes, Windows vs BSD vs GNU).

Findings land in `initiatives/memory/evidence/phase-00/adversarial-<surface>.md`, one row per
finding: `| # | input | expected | actual | severity | disposition (fixed as fixture <name> /
rejected: <reason>) |`.

### F. Product-manifest and sync-golden regeneration

Both new scripts live under `.claude/scripts/`, which `sync-to-project.sh` ships into consumer
projects, so both need an entry in `products/memory/manifest.json` (new file, same v1 schema as
`products/hq/manifest.json`). Gate: `node .claude/scripts/core/product-lint.mjs`.

Regenerating the byte-identity fixture: sync into a scratch target with
`bash ./sync-to-project.sh <scratch>` (the script sits at the **repo root**, not under
`.claude/scripts/`), produce the manifest with the same `_arc_tree_manifest`
helper `tests/sync.bats` uses (`tests/test_helper.bash:479` — sorted `find`, CR stripped, sha256
per file), **diff the delta first and confirm only the intended paths moved**, then re-record
`tests/fixtures/sync-golden/tree-manifest.txt`. This gate passes locally and fails only on CI, so
the diff-first step is the control.

## Exit criteria (Definition of Done)

- [ ] All 5 adapters (`retro-log`, `trial-ledger`, `learning-ledger`, `adr`, `decisions`) parse their organ and emit records — each a pure function, writing nothing (ADR-0700)
- [ ] `N_parsed == N_indexed` printed **per organ**, and a deliberate mismatch fails the build
- [ ] **Code spans are masked before field-splitting**, and a fixture pins the one real row that proves why: the 2026-08-02 arc-model-policy row carries a literal `|` inside `` `(?:^|\n)##` ``. A naive split reports it as a malformed 6-field row and walls off a genuine lesson while `N_parsed == N_indexed` still passes — the count-verify cannot catch a misclassification, because excluded rows are outside `N_parsed`. Correct counts: **54** pattern rows, 10 scoreboard, **0 malformed** (ADR-0702)
- [ ] Excluded rows are **named with file and line** (ADR-0702): the 10 retro scoreboard rows, and anything genuinely malformed — with the count of exclusions printed, so "zero exclusions" and "exclusions not checked" cannot look alike
- [ ] Delete the index → rebuild → **the indexed record set is identical**: the same doc ids, in the same order, each with the same **record hash** — green on all 3 OSes, compared as records and never as db bytes (ADR-0701). **What is hashed:** sha256 over the record's **canonical serialization** — UTF-8, LF, keys sorted, no insignificant whitespace — which is arc's existing canonical form (ADR-0024). Hashing the serialized *record* rather than its source text is what makes the rule uniform across all five adapters, including `decisions`, whose records come from spine events and have no source text at all. **This phase proves INDEX determinism, not QUERY determinism**: ranking is Phase 1's, so a golden-query ordered-ids comparison cannot be run here and is Phase 1's exit criterion instead
- [ ] Staleness manifest (mtime + sha256, CRLF-normalized) present; any mismatch triggers a full rebuild with atomic temp-then-rename swap
- [ ] **`memory-index.mjs` has a product-manifest entry** (`product-lint.mjs` green) and `tests/fixtures/sync-golden/tree-manifest.txt` is regenerated — a byte-identity gate that passes locally and fails only on CI. **Only the builder is registered in this phase**; `arc-recall.mjs` does not exist until Phase 1 and is registered there, in the same way
- [ ] **Every new `tests/memory-*.bats` file has a measured entry in `tests/shard-timings.json`**, harvested from a real CI run; an unmeasured file is counted and named, never left riding the 16s default
- [ ] Spine `decision.recorded` records are read **through the reader library only**; `spine-reader-lint.sh` stays green and `KINDS.length` is untouched at 44 (ADR-0703)
- [ ] **The 12 golden queries (§D) are committed to `tests/fixtures/memory/golden-queries.tsv` in their own commit, before any adapter, alias or weight tuning** — the pass condition exists before the thing it grades (ADR-0706)
- [ ] **Grep baseline recorded**: those same 12 queries run by grep, timed, hit-rate tabled in evidence — measured BEFORE anything claims to beat it (ADR-0706)
- [ ] **Two fresh-agent adversarial passes on the adapters** (decision logic · shell/OS boundary) per ADR-0708, findings ledgered, holes fixed and pinned as fixtures or rejected with a reason
- [ ] tests added & green **on CI**, read per-JOB
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bats tests/memory-index.bats`
- **Invocation contract (one style everywhere):** the builder is always run as `node .claude/scripts/memory/memory-index.mjs …`, resolved from the repo root. It is **not** put on PATH, given a shebang, or `chmod +x` — a bare-command style would need per-OS setup across a Windows dev box and three CI legs for no gain.
- **Expected failure first:** `memory-index.bats::count-verify fails loudly when an organ under-parses` fails RED before the builder exists, with node's real message — `Error: Cannot find module '<repo>/.claude/scripts/memory/memory-index.mjs'` and `code: 'MODULE_NOT_FOUND'` (observed form, not a guess) → then, once the builder exists but before count-verify is wired, the same test fails with `expected build to FAIL on a seeded 53-of-54 parse, got exit 0`. That second red is the one that matters: it proves the count-verify can actually fail, rather than proving only that a file exists. A third red guards the misclassification hole the count-verify structurally cannot see: `memory-index.bats::a pipe inside a code span is data, not a separator` fails with `expected retro-log 54/54, got 53/53 + 1 named exclusion`.
- **Live demo scenario:**
  1. `node .claude/scripts/memory/memory-index.mjs --rebuild` on the real tree.
  2. Read the per-organ block: it must print `retro-log 54/54`, `trial-ledger 37/37`, `learning-ledger 4/4`, `adr 140/140`, **and `decisions N/N` in the same `parsed/indexed` format** — a bare spine count with no pairing cannot prove the fifth adapter's count-verify at all.
  3. Read the exclusions block: **10** scoreboard rows, each named with its file and line, and an explicit `0 malformed` — the literal-pipe row must appear as an INDEXED pattern row, not an exclusion.
  4. `rm -rf .claude/state/memory && node .claude/scripts/memory/memory-index.mjs --rebuild --dump-records` — the printed counts **and the dumped record set** (doc id + content hash, in index order) must match the first run byte-for-byte. No query is run here: ranking is Phase 1's, so Phase 0 proves the index is deterministic and Phase 1 proves the answers are.
- **Real-system check:** run against the live `docs/retro-log.md`, `docs/trial-ledger.md`, `docs/develop/learning-ledger.md`, `docs/adr/` and the real spine via the reader. Confirm `git status` is clean afterwards — memory must have written nothing outside `.claude/state/memory/`, which is gitignored. No fakes are involved for the organs; the only faked surface this phase is the seeded spine fixture.
- **Expected evidence:** `initiatives/memory/evidence/phase-00/` holds — the per-organ count output from two consecutive rebuilds, the named-exclusions listing, the grep-baseline table (query · grep time · top-3 hit yes/no), the 3-OS CI job links, and the two adversarial findings ledgers.

## Rabbit holes in this phase

- **Per-organ format special-casing.** trial-ledger has **one** record shape — the 5-column ledger row — and everything else in the file (7 headers, 10 separators, 31 rows of three unrelated 3-column tables) is an exclusion; §B is authoritative on this. retro-log carries two shapes (5 pattern, 9 scoreboard) **once code spans are masked** — before masking it looks like three, and the phantom third is a real lesson. Detour: mask code spans, then parse by field count, treating genuinely unknown shapes as **named exclusions**, never coercing. If any one organ needs more than ~0.5d, STOP — kill criterion 1.
- **A count-verify that cannot fail, and a count-verify that cannot see.** Detour: one negative-control fixture seeds an organ that under-parses by one row and asserts the build exits non-zero; a second asserts the literal-pipe row is indexed rather than excluded, because a row moved into the exclusion list leaves `N_parsed == N_indexed` perfectly true.
- **CRLF on the Windows dev box.** Detour: normalize before hashing and before every fixture comparison.

## Out of scope for this phase

- The recall CLI, ranking, aliases and citations rendering → Phase 1.
- Any hook into kickoff or review → Phase 1 (kickoff) and Phase 2 (review).
- The `node:sqlite` accelerator and its equivalence gate → Phase 2 (REQ-07). Phase 0 builds the canonical JS index only.

## Your-setup / pending

Nothing. No keys, no accounts, no infra — every input is a file already in this repo or the local spine.

Two build-environment facts, verified 2026-08-11, so no one has to guess:

- **CI discovers new tests automatically.** `.github/scripts/shard-tests.mjs` reads `tests/` and
  takes every `*.bats` file (`readdirSync(TESTS).filter(f => f.endsWith(".bats")).sort()`), so a
  new `tests/memory-*.bats` needs **no workflow edit**. It refuses loudly rather than silently if a
  shard would be empty. `tests/shard-timings.json` is advisory for balance only — which is exactly
  why an unmeasured file rides a default instead of erroring, and why the DoD requires a measured
  entry.
- **The spine fixture's scratch directory is `$BATS_TEST_TMPDIR`**, the per-test temp dir bats
  already provides. It is non-empty by construction, which matters because `ARC_SPINE_ROOT` is read
  by presence, not truthiness.

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
