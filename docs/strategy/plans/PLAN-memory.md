# PLAN (design source) — memory v1: playbooks + recall

> **Freeze log:** `BRIEF-memory.md` (2026-07-22) → deep analysis vs the live tree
> 2026-08-03 → upgrade rounds 2026-08-03 and 2026-08-09 in Cowork chat (alias layer ·
> additive hooks · Goodhart fix · two-stage injection · root-mode-first) → v1.0 draft →
> **v1.1 owner-approved 2026-08-09 → landed in the tree the same day.** This drop also
> moves `BRIEF-memory.md` → `docs/archive/` and updates both READMEs
> (evolve/leads/policy/executor/scheduler/ledger/growth precedent). **Uncommitted — the
> owner branches/commits/PRs; the sandbox never touches git.** Decisions MEM-A…K locked
> at owner approval; MEM-L (century · thresholds · K/token budget · process-file names ·
> golden-floor values) deliberately open until kickoff.
>
> **Scope honesty:** this cycle delivers **index + recall + hooks over the organs arc
> already has**. NOT a new rule store (the organs stay exactly where they live) · NOT
> embeddings/vector search (measured pull-trigger in MEM-G) · NOT a knowledge graph
> (Graphify serves code-impact; no merge) · NOT auto-rule-writing (rules come from
> retros/humans — unchanged) · NOT a chat/dashboard surface (those sleepers consume
> `--json` at their own triggers) · NOT a change to what `/arc-retro` writes or where.
>
> **Trigger status: CONVERTED — FIRED under the owner's Build-out Mandate (2026-08-09
> — same `decision.recorded` as strategy-README correction #15, cited by the kickoff
> ADRs; A8's letter kept).** Honesty note: unlike the other mandate conversions,
> memory's organic pull ALSO has receipts on record — **(1)** retro-log 2026-08-02:
> bare ADR citations resolved to the WRONG decision four times in one cycle, including
> the cycle that wrote the warning; **(2)** HISTORY correction 2026-08-03: a stale
> company log made a fired trigger read unfired for five days; **(3)** two in-process
> consumers already exist (kickoff step 5 reads the whole retro-log; develop's Context
> Pack follows typed links, ADR-0111). Phase 0 measures a 12-query grep-baseline the
> module must beat — the trigger claim becomes a number either way.
>
> **Prerequisites (state 2026-08-09 — re-verify at kickoff):** spine live; closed
> vocabulary at its **live count** (31 post-evolve at grounding; leads' cycle added the
> `metric.observed` law ADR-0408 and policy's cycle adds its kinds — read
> `KINDS.length` at kickoff, ADR-0107 rule; **memory adds ZERO kinds regardless**) ·
> reader-only enforced (`spine-reader-lint.sh`) ✓ · lanes live (ADR-0050/0054) ✓ ·
> Constitution v1.0 adopted 2026-08-06 ✓ · policy engine merged (C9, PR #130,
> 2026-08-08) ✓ · kickoff/review are ENGINE-GENERATED from `processes/`
> (ADR-0201/0202) ✓ — hooks land as process-file edits · **live slot free (A9): read
> `PORTFOLIO.md` at kickoff, never assume** (leads C8 and policy C9 each sat one owner
> action from close at this freeze).
>
> **Relationship to existing plans:** **develop** — the learning ledger + Context Pack
> are develop's organs; memory indexes them, never owns them; a Context-Pack → recall
> integration is a follow-up `/arc-change` proposal to the develop lane, not this
> cycle. **evolve** — REQ-04's decision queries are the taste-learning feed evolve's
> plan names; no promotion machinery here; EVO-H0 is not memory's business (resolved in
> two halves elsewhere: ADR-0408 vocabulary + PLAN-growth REQ-05 feed). **bench** —
> shares the golden-fixture mindset; no inheritance either way. **absorb / growth /
> ledger / scheduler** — fellow next-lane candidates; whichever births first claims the
> next century, so nothing is hardcoded here. **executor** — engine-lane work, no
> century contention. **policy** — memory needs no `hq.policy.yaml` rows (POL-I n/a:
> no new action kinds; recall is read-only). **dashboard/chat** — future consumers of
> `--json`, at their own triggers. **Graphify** — code-impact graph, disjoint domain;
> recall may LINK later, never merge.

---

## 1. Goal

One sentence: `arc recall <query>` gives any session — human or process, in arc or any
root-mode install — the company's relevant recorded lessons, decisions and rules in
under a second, **verbatim and with canonical citations**, and the kickoff/review
processes receive them automatically — so a lesson arc has already paid for is never
re-learned because nobody could find it.

## 2. Current state (verified 2026-08-09 — re-verify counts at kickoff)

**The corpus (exists, is truth, is not findable enough):**

| Organ | Size (at grounding) | Format | Note |
|---|---|---|---|
| `docs/retro-log.md` | ~33 pattern rows + 6 scoreboard rows (C7/C8/C9 retros add more — recount) | `date \| project \| pattern \| prevention \| tags` | Header law: *"read as-is, never summarized"* — **preserved untouched** (MEM-E). Scoreboard rows are a different shape — named exclusion |
| `docs/trial-ledger.md` | ~20 evidence rows | table rows | gate-promotion decisions live here |
| `docs/develop/learning-ledger.md` | L-001..L-004 | `#### learning:` blocks + typed links | company organ (ADR-0053 spirit) |
| `docs/adr/` | ~126 files at grounding (bands: core 00xx · develop 01xx · engine 02xx · evolve 03xx · leads 04xx · policy 05xx) | one file per ADR | count grows every cycle — the adapter globs, never assumes |
| spine `decision.recorded` | via reader only | closed payload `decides\|verdict\|reason` | SPINE-G; vocabulary read live |

**Existing recall mechanisms (extend, never duplicate — A5):** kickoff step 5
whole-file retro-log read (manual tag-overlap) · Context Pack one-hop typed links
(ADR-0111) · grep.

**Platform facts that shaped the design:**

- **Zero npm dependencies** — no root `package.json`; a native dep (better-sqlite3)
  would be arc's first, ×3 CI OSes, through ADR-0110 vetting. Avoided (MEM-B).
- **`node:sqlite` FTS5 probe PASSED** 2026-08-09 on Node v22.22.2 (sandbox): FTS5
  virtual table + `bm25()` OK; experimental warning on 22.x → version gate in preflight.
- Derived-index precedent: `.claude/state/hq/derived/idem.index` (instance state,
  rebuildable, ADR-0025 pattern — confirm `.gitignore` coverage at kickoff).
- `/arc-retro` hand-written (directly editable) · `/arc-kickoff`, `/arc-review`
  GENERATED — changes only via `processes/` + `/arc-change` + `arc-compile`.
- Windows dev machine + 3-OS CI: all hashing/fixtures CRLF-normalized; all output
  paths repo-relative forward-slash.

## 3. Success requirements

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| **REQ-01 Ingest + index** | Every recorded lesson/decision is in one searchable index | 5 adapters (§6) → one FTS index. **Count-verified per source** (`N_parsed == N_indexed`, printed per organ, non-matching = build FAILURE); excluded rows **named in output** (scoreboards, malformed — never silent). Derived-only: delete index → rebuild → **canonical query-result comparison identical** (results, never db bytes; CRLF-normalized; fixture) | 0 |
| **REQ-02 Recall CLI** | The right lesson in <1s | Full surface in §7. bm25-ranked **verbatim** rows, prevention-first, canonical citation per row. <1s on the real corpus (owner machine + ubuntu CI leg, `time`d in evidence). Hostile-query fixtures green (§7.4). Alias expansion + tag-boost live. **Root-mode fixture: zero-lane tree** (MEM-I) | 1 |
| **REQ-03 In-process hooks (ADDITIVE)** | Recall happens without being asked | Kickoff process + recall step injecting the §8 block (top-K compact lines, fenced, budgeted); retro-log whole-file read **untouched**; review process same pattern with diff-derived query. Fixture: planted rule surfaces in a fixture kickoff. Budget overflow → truncate + `(+N more)` line, fixture-proven | 1–2 |
| **REQ-04 Decision memory** | Past decisions queryable, not archaeological | `--decisions` filters (§7.3) over `decision.recorded` via reader only; seeded fixture; **zero new kinds** (KINDS stays at its live count) | 2 |
| **REQ-05 Conflict surfacing** | Contradicting rules meet a human, not a merge bot | **Write-time:** `/arc-retro` pre-append near-duplicate check (≥2 shared tags AND token-overlap ≥ T — T settles at kickoff, MEM-L) shows candidate pairs; author proceeds/merges on the record. Read-time `--pairs` secondary. Never auto-resolved. **Designated cut #1** | 2 |
| **REQ-06 Instruments** | Recall quality is a number, not a vibe | **Golden set** (§9: 12 seed queries, expected ids, top-3 hit CI-asserted) · **grep-baseline** measured P0 and beaten by close · **surfaced→cited log** (observational ONLY — §10) | 0/2 |

## 4. Appetite

**4 days · Tier S/M.** P0 1.5d · P1 1.5d · P2 1d.

**Cut order (pinned now):** REQ-05 → REQ-04. **REQ-01/02/03 are the module** — don't
fit → the cycle stops, not shrinks.

**Kill criteria:** (1) P0 count-verify needs >~0.5d of per-file special-casing → STOP;
propose organ-format fixes as their own tiny change first — indexing a swamp validates
the swamp. (2) Preflight fails on any CI leg → STOP before P0; the pure-JS fallback is
an owner decision, never an improvisation.

**Banked stretch (NOT in appetite; each with its pull):** `--recurring`
failure-physics report (pull: a retro asks "have we seen this class before") ·
typed-link dossier rendering (pull: first user ask for grouped output) · council
precedent recall (pull: Brier ledger populated) · **embeddings** (pull: MEM-G floor
breached after ≥3 alias iterations) · cross-repo federation (pull: ≥2 repos + one real
cross-repo miss) · `rules/*.md` adapter (pull: first golden-set miss that lives there)
· dashboard learn-panel / chat tool (their own briefs).

## 5. Decisions to ADR at kickoff

> Century: **next free per `PORTFOLIO.md` at kickoff** — 0600–0699 was the next
> unclaimed band at this freeze; stale the moment any lane births first (absorb /
> growth / ledger / scheduler are fellow claimants).

| ID | Decision | Why (compressed) |
|---|---|---|
| **MEM-A** | **Index-in-place.** Organs stay where they live; memory indexes, never migrates/duplicates. `playbooks/` NOT created v1. | The brief (07-22) predates the learning ledger (08-02); a third store manufactures the sprawl REQ-05 fights. "Migration" = count-verified ingestion. |
| **MEM-B** | **Storage = built-in `node:sqlite` FTS5** at `.claude/state/memory/index.db` (instance state, never committed); staleness manifest (mtime+sha256 per source) → **always full rebuild**, atomic temp-db+rename. **Kickoff preflight:** FTS5 probe + `node --version`, 3 CI legs + owner machine; fail → pure-JS inverted-index fallback, owner decides pre-P0. | Zero-dep stays zero-dep; corpus <1MB → full rebuild cheap; incremental-update bug class never bought. Probe: Node v22.22.2 ✓. |
| **MEM-C** | **Output contract:** verbatim rows, prevention-first; canonical citation IDs (§6.2 grammar); `--json` stable schema (§7.5); `--grep` raw passthrough. Repo-relative forward-slash paths everywhere. | Citations kill the recorded 4×-wrong-ADR class; `--grep` is the honesty valve for lexical limits. |
| **MEM-D** | **Reader-only, emit-nothing.** Spine via reader lib exclusively; memory emits zero events v1; vocabulary untouched at live count; **no `hq.policy.yaml` rows (POL-I n/a — no new action kinds)**. | A recall is not company history; instruments are files. Cheapest spine + policy posture. |
| **MEM-E** | **Hooks additive-only**, landed as process-file edits via `/arc-change` + recompile (ADR-0201/0202). Injection = §8 fenced block, top-K compact + `--full` pull (two-stage), token-budgeted. Retro-log whole-file read untouched; replacing it with selection = separate future pull (trigger: retro-log > threshold tokens), recorded here, not exercised. | Zero regression; the "as-is, never summarized" law survives; the 08-03 interpolation lesson applied to LLM context. |
| **MEM-F** | **Conflicts: write-time first** at `/arc-retro` (hand-written, direct edit); detection = tag/lexical overlap ONLY; **semantic contradiction detection declared out of scope** — a lexical checker cannot read meaning. Humans merge; nothing auto-resolves. | Prevention at the pen beats detection at read; scope honesty prevents a theatre gate that passes on blindness. |
| **MEM-G** | **Golden set primary** (CI, ungameable); surfaced→cited **observational forever** (§10 Goodhart note); **embeddings trigger defined as a number**: golden-set top-3 precision < 10/12 after ≥3 alias-iteration fixes on a corpus ≥2× current (floor values confirmed at kickoff, MEM-L). | Without an instrument, "precision demonstrably insufficient" is unfireable — the EVO-H0 / HISTORY-staleness trap, pre-paid. |
| **MEM-H** | **Lane discipline:** new lane `--lane memory`; century next-free per board; code home §11; tests centralised (ADR-0021); manifest + ownership rows. **Cross-lane edits not this cycle** — Context-Pack integration is a follow-up `/arc-change` to develop. | Ownership boundaries hold even in a build-out era. |
| **MEM-I** | **Root-mode-first.** `arc-recall` runs in a zero-lane tree (fixture in REQ-02); `lane:` is provenance metadata. v1 proves the fixture; consumer-repo rollout (LexOS) rides the products install path later. | Root-mode is the permanent consumer contract (ADR-0054); lane-locked memory needs unbuilding before the public era. |
| **MEM-J** | **Parser-class law at the slice:** adapters + query parser each get a fresh-agent adversarial pass (two surfaces: decision logic · shell/OS boundary) **inside the phase that ships them**. New lints born WARN-first TRIAL. | 08-02 lesson (close-bound pass skipped all phase) + L-001 (author passes prove blind spots) — already paid for. |
| **MEM-K** | **Alias layer:** hand-curated `docs/memory/aliases.md` (git-reviewed) → deterministic query expansion; tag column bm25 weight > prevention > body; tokenizer pinned `unicode61`. **Every golden-set miss is fixed by an alias/tag edit** — recorded in the file with the miss it fixes. | BM25 fails on vocabulary mismatch ("duplicate events lost" vs "DUP_IDEM"); aliases fix it deterministically, auditable, before embeddings are discussable. |
| MEM-L | *(open at kickoff)* century confirm · T similarity threshold (MEM-F) · K + token budget (§8 defaults are proposals) · surfaced→cited log location · exact process-file names · MEM-G floor values. | Need the tree at kickoff time. |

## 6. Ingestion spec

### 6.1 Adapters (5, each a pure function: file/reader → records + exclusions)

| Adapter | Source | Record fields | Named exclusions |
|---|---|---|---|
| `retro-log` | `docs/retro-log.md` | date, project, pattern, prevention, tags[] | scoreboard rows (field-count/shape detect) · blank/header lines |
| `trial-ledger` | `docs/trial-ledger.md` | date, gate, run-ref, fired, verdict-text | prose sections; only ledger table rows |
| `learning-ledger` | `docs/develop/learning-ledger.md` | id (L-NNN), what-failed, why-missed, prevention, type, tags, links{adr,rule,fixture,phase,lane}, verdict | none expected; malformed block = named error |
| `adr` | `docs/adr/*.md` | number, slug, title, status?, first-paragraph, links | none; unparseable frontmatter = named, indexed title-only |
| `decisions` | spine via reader | ulid, ts, decides, verdict, reason | quarantine never read; non-decision kinds untouched |

Rules: adapters never write · pipe-in-content safe (field-count parse, never naive
split) · every exclusion printed with file+line · `N_parsed == N_indexed` per adapter
or the build fails loud.

### 6.2 Doc-id grammar (canonical citations)

```
retro:<YYYY-MM-DD>#<n>     n = ordinal among PATTERN rows that date (scoreboards don't count)
trial:<YYYY-MM-DD>#<n>
learn:<L-NNN>
adr:<NNNN>                 rendered as: ADR-0026 (docs/adr/0026-spine-c-....md)
spine:decision/<ulid>
```

IDs are stable across rebuilds (derived from content position/keys, never rowids).
Rendered citations always carry the repo-relative path — a bare number is never
printed alone (the recorded namespace trap).

### 6.3 Index schema (SQLite)

```
docs(id TEXT PK, source TEXT, path TEXT, date TEXT, lane TEXT, tags TEXT,
     prevention TEXT, body TEXT, extra JSON)
fts  = fts5(tags, prevention, body, content=docs, tokenize='unicode61')
       query-time weights via bm25(fts, w_tags, w_prev, w_body) — w_tags > w_prev > w_body
manifest(source_path TEXT PK, mtime_ms INT, sha256 TEXT)   -- CRLF-normalized hash
meta(key, value)                                            -- built_at, schema_version
```

Staleness check on every CLI invocation: any manifest mismatch → full rebuild (<1s
budget includes this on the current corpus), atomic swap.

## 7. Recall CLI spec

Home: `node .claude/scripts/memory/arc-recall.mjs` (products/memory ships it).

### 7.1 Surface

```
arc-recall "<query>" [--tag a,b] [--source retro|trial|learn|adr|decisions]
           [--since YYYY-MM-DD] [--lane <name>] [--limit N]
arc-recall --full <doc-id>          # exact recorded text, whole record
arc-recall --decisions "<filter>"   # §7.3
arc-recall --json ...               # §7.5 schema on stdout
arc-recall --grep "<raw>"           # no index: plain grep across the 4 organ files
arc-recall --rebuild                # force full rebuild
arc-recall --tags                   # tag frequency table (taxonomy emerges, not designed)
```

Exit map: `0` ran (zero results is a result, printed as such) · `1` internal error ·
`2` bad usage · `3` index unavailable and rebuild failed (message names the cause).

### 7.2 Default output (verbatim, prevention-first)

```
1. [learn:L-002] (spine,receipts · develop · 2026-08-02)
   never treat exit 0 from a fire-and-forget writer as evidence that anything was written
   ↳ cite: docs/develop/learning-ledger.md · full: arc-recall --full learn:L-002
2. [retro:2026-08-02#2] (spine,receipts,silent-failure · arc-develop)
   after wiring any new emitter, LOOK in events/ AND events/_quarantine/ ...
   ↳ cite: docs/retro-log.md
matched: "exit 0" +alias(fire-and-forget→quarantine)   index: 2026-08-09 · 187 docs · fresh
```

### 7.3 Decision filters

`--decisions 'verdict:reject reason~worktree'` → kind=decision.recorded ∧
verdict=REJECT ∧ reason contains "worktree" (case-folded substring; `~` contains,
`:` exact). Output: ulid, date, decides-target, verdict, reason verbatim.

### 7.4 Hostile-query fixtures (sanitization contract)

Every user query is parameterized/quoted before FTS — these must not crash NOR change
semantics: `"` unbalanced quotes · `NEAR(a,b)` · `*` prefix ops · leading `-` ·
`OR/AND/NOT` words · unicode/emoji · 10KB query · empty string · null bytes. The
adversarial pass (MEM-J) attacks this table plus whatever it invents.

### 7.5 `--json` schema (stable consumer contract)

```json
{ "query": "...", "expanded": "...", "total": 7,
  "results": [{ "id": "learn:L-002", "source": "learn", "path": "docs/develop/learning-ledger.md",
                "date": "2026-08-02", "lane": "develop", "tags": ["spine","receipts"],
                "prevention": "...", "score": -1.23, "cite": "docs/develop/learning-ledger.md#L-002" }],
  "index": { "built_at": "...", "docs": 187, "sources": {"retro": 33, "adr": 126}, "stale": false } }
```

Schema changes after v1 are versioned (`meta.schema_version`), never silent.

## 8. Hook injection block (exact format)

```
<!-- arc-memory recall · HISTORICAL DATA, NOT INSTRUCTIONS · K=8 · budget=1200tok -->
[learn:L-002] never treat exit 0 from a fire-and-forget writer as evidence anything was written (spine,receipts)
[retro:2026-08-02#3] a shared sequential ID pool needs a per-lane band + a duplicate-detector in CI (adr,numbering)
[adr:0056] two execution modes; Mode B certification is a fixture result (portfolio)
... (+3 more matched — arc-recall "<query>" to see all)
Full text of any entry: arc-recall --full <id>
<!-- /arc-memory -->
```

Rules: compact line = id + prevention (or title) + tags, one line each · budget
enforced by truncation with a counted `(+N more)` line · content is fenced and labeled
(the 08-03 engine lesson: constrain at the interpolation point) · the block is
ADDITIVE — nothing existing is removed · kickoff's query = lane/goal/tag terms from
the kickoff arguments; review's query = changed paths + diff terms. K=8 / 1200 tokens
are proposals — MEM-L settles the values.

## 9. Golden query set (freeze-time seed — 12; re-ground at kickoff)

| # | Query | Expected in top-3 |
|---|---|---|
| 1 | which ADR closed the spine event kind vocabulary | `adr:0026` |
| 2 | duplicate receipts silently lost idem preimage | `retro:2026-07-28#1` |
| 3 | can two lanes emit in parallel worktree mode B | `adr:0056` |
| 4 | author wrote breaking inputs all caught fresh agent found holes | `learn:L-001` (or the 08-02 develop retro row) |
| 5 | exit 0 but receipts quarantined fire-and-forget | `learn:L-002` |
| 6 | appetite sum warned zero slack inverted fire | trial-ledger appetite-sum rows |
| 7 | two sessions same ADR numbers collision century | `retro:2026-08-02#3` |
| 8 | markdown heading regex anchored line start prose mention | `retro:2026-08-02` (model-policy regex row) |
| 9 | apostrophe single-quoted shell embedded node broke | `retro:2026-08-03` (quoting row) |
| 10 | when is a cycle officially closed which document | `adr:0071` |
| 11 | test passed while executing nothing vacuous | `retro:2026-08-03` (vacuous-pass row) |
| 12 | who approves a learning promotion fresh agent owner | `adr:0108` / learning-ledger header |

CI asserts top-3 hit per query. **Phase 0 measures the same 12 by grep first** (time +
hit-rate, recorded in evidence) — the module must beat that baseline by close. Every
future miss added here gets its alias/tag fix recorded beside it (MEM-K).

## 10. Instruments & the Goodhart note

The golden set is the quality contract; red = build failure, not a dashboard. The
surfaced→cited log answers "does anyone use what the hook surfaces" as a **trend**,
and is disqualified from ever gating or promoting anything: `pre-mortem-cite` already
pressures plans to cite, so a cited-rate gate would train ritual citation and report
success. This paragraph exists so a future cycle cannot promote the metric without
overturning a recorded decision (MEM-G). If after ~3 hooked kickoffs the cited-trend
is ~zero, that is a retro input questioning the module's premise — the honest outcome,
kept reachable.

## 11. File layout (shipped by this cycle)

```
products/memory/                         manifest section, ownership rows
.claude/scripts/memory/
  arc-recall.mjs                         CLI (§7)
  memory-index.mjs                       rebuild + staleness manifest (§6.3)
  adapters/{retro-log,trial-ledger,learning-ledger,adr,decisions}.mjs
  lib/{query.mjs,aliases.mjs,cite.mjs}   sanitizer/expander · alias loader · id grammar
docs/memory/aliases.md                   curated alias file (MEM-K; each entry cites the miss it fixed)
processes/  (edited via /arc-change)     kickoff + review gain the recall step (§8)
.claude/commands/arc-retro.md            pre-append near-duplicate check (REQ-05; direct edit)
tests/memory-*.bats + tests/fixtures/memory/
.claude/state/memory/index.db            instance state — never committed
```

## 12. Phases (slice-level)

**P0 — the index exists and is honest (1.5d)**

| # | Slice | Proof |
|---|---|---|
| 0.1 | MEM-B preflight: FTS5 probe + node version, 3 CI legs + owner machine | probe output in evidence; fail → STOP |
| 0.2 | Grep-baseline: the 12 golden queries by grep, timed | baseline table in evidence |
| 0.3 | 5 adapters + count-verify + named exclusions | per-organ counts printed; scoreboard-exclusion fixture red→green |
| 0.4 | Index build + staleness manifest + atomic rebuild | rebuild fixture: delete → rebuild → canonical results identical (3 OSes) |
| 0.5 | **Fresh-agent adversarial pass on adapters (both surfaces), in-phase** | findings ledger; fixes landed or rejected with reason |

Exit: counts match per organ · rebuild fixture green 3 OSes · baseline recorded.

**P1 — recall people can trust (1.5d)**

| # | Slice | Proof |
|---|---|---|
| 1.1 | CLI core + §7.4 sanitization + exit map | hostile fixtures green |
| 1.2 | aliases.md + expansion + tag-boost weights | golden queries improve vs 0.2, shown |
| 1.3 | Citations + `--full` + `--json` + `--grep` + `--tags` | schema fixture; root-mode fixture (zero-lane tree) |
| 1.4 | <1s perf check (owner machine + ubuntu leg) | timed runs in evidence |
| 1.5 | Kickoff hook via `/arc-change` + planted-rule fixture | fixture kickoff surfaces the plant; budget-truncation fixture |
| 1.6 | Adversarial pass on the query surface | findings ledger |

Exit: golden set ≥ baseline already · plant surfaces · generated-file discipline lint green.

**P2 — decisions, conflicts, proof (1d)**

| # | Slice | Proof |
|---|---|---|
| 2.1 | `--decisions` filters via reader + seeded fixture | byte-exact reason text in output |
| 2.2 | `/arc-retro` write-time near-duplicate check (+`--pairs` if time holds) | fixture: planted near-dup pair surfaces pre-append |
| 2.3 | Review-process hook (diff-derived query) | fixture review surfaces a path-matched rule |
| 2.4 | Golden set into CI + baseline-beaten check + surfaced→cited log seeded | CI leg green; comparison table in evidence |
| 2.5 | Retro + HISTORY entry + cuts recorded with reasons | retro row; scoreboard line |

Exit: REQ-06 fully green · cut list (if any) on the record.

## 13. Pre-mortem (top 6, each citing its counter)

1. **Write-only memory nobody queries** → automatic additive hooks (MEM-E) · golden
   set proves findability (REQ-06) · cited-trend watches usage (MEM-G).
2. **Index drifts from files** → derived-only + staleness manifest + full rebuild +
   canonical-results fixture (MEM-B, REQ-01).
3. **Rule sprawl / dual truth** → index-in-place (MEM-A) · write-time dedup (MEM-F).
4. **Vocabulary mismatch quietly guts recall** → aliases + tag-boost (MEM-K), measured
   by the golden set, `--grep` escape hatch (MEM-C).
5. **Hook pollutes/hijacks LLM context** → fenced labeled block + budget + trusted
   git-reviewed sources only (MEM-E, §8).
6. **Platform surprise on one CI leg** → preflight with a named fallback decision
   before P0 (MEM-B) — the bench preflight lesson applied at day one.

## 14. Rejected alternatives (register)

| Alternative | Why rejected |
|---|---|
| Grep-wrapper only | No ranking/cross-corpus/safe-JSONL/top-K; survives as `--grep` |
| better-sqlite3 | First npm dep + native builds ×3 OS + ADR-0110 vetting, zero gain over built-in |
| Embeddings v1 | <1MB corpus; vocabulary gap solved deterministically (MEM-K); trigger now measured (MEM-G) |
| Migrate organs into `playbooks/` | Breaks live consumers (kickoff step 5, retro, trial flow); dual truth; brief predates the organs |
| Per-lane memory stores | ADR-0053: company organs single; `lane:` is a field |
| New event kinds (`recall.completed`) | Closed-vocabulary discipline; a recall is not history |
| LLM auto-tagging/summarizing at ingest | Non-deterministic index breaks the rebuild fixture; auto-rule-writing adjacent |
| Incremental index updates | A bug class bought for nothing at this size |
| Porter stemming | Mangles exact tech tokens (`sed -i`, `withLock`); aliases are auditable |
| Replace kickoff's retro-log read with selection | Fights the organ's own law for zero v1 gain; deferred behind a measured threshold (MEM-E) |
| Cited-rate as a gate | Goodhart via `pre-mortem-cite` (§10) |
| MCP server surface v1 | chat-mcp territory; CLI + `--json` is the whole needed contract |
| External memory SaaS (Mem0-class) | Violates files-are-truth + zero-dep + instance-local in one move |

**Drop package (EXECUTED 2026-08-09 — this landing):** 1. this file at
`docs/strategy/plans/PLAN-memory.md` · 2. `BRIEF-memory.md` → `docs/archive/` ·
3. `plans/README.md` memory row + PLAN count updated · 4. `docs/strategy/README.md`
file map + correction #19. Saved to disk only — the owner commits.

## 15. Kickoff prompt (paste-ready)

```
/arc-kickoff --lane memory memory v1 — playbooks + recall
Design source: docs/strategy/plans/PLAN-memory.md (v1.1). Trigger: FIRED under the
Build-out Mandate (2026-08-09) — cite the mandate `decision.recorded`; organic
evidence rows in the header. Decisions MEM-A..K are locked-directional — finalize and
assign real ADR numbers from the claimed century (next free per PORTFOLIO.md; MEM-L
settles now: century · T threshold · K/budget · log location · process-file names ·
MEM-G floors). FIRST ACT: MEM-B preflight (node:sqlite FTS5 probe, 3 CI legs + my
machine) — any failure → STOP and bring me the pure-JS fallback decision. Locked:
index-in-place · derived-only full-rebuild · reader-only emit-nothing (no policy rows,
POL-I n/a) · additive hooks via process files + /arc-change · verbatim output with
canonical citations · golden set in CI · cut order REQ-05 → REQ-04. Adversarial passes
bind to the shipping slice, two surfaces, fresh agents. Gates: live slot free (A9) —
read the board. STOP after PLAN.md + phase specs for my approval.
```

---

*Grounding: BRIEF-memory.md · PORTFOLIO.md (2026-08-08) · docs/HISTORY.md (C7 +
corrections) · docs/retro-log.md · docs/trial-ledger.md ·
docs/develop/learning-ledger.md · .claude/rules/lanes.md · spine validate.mjs (KINDS,
decision shape) · plans/README.md + strategy/README.md (corr. #1–18 at landing) ·
node:sqlite FTS5 probe (Node v22.22.2, 2026-08-09). Analysis sessions 2026-08-03 →
2026-08-09; landed on the owner's approval; git untouched by the sandbox.*
