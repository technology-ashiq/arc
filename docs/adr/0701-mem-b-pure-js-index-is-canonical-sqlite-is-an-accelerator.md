# ADR 0701 — MEM-B: a pure-JS inverted index is the canonical recall path; `node:sqlite` FTS5 is an optional accelerator behind an equivalence gate

**Status:** accepted
**Date:** 2026-08-11
**Product:** `memory`
**Reversibility:** one-way
**Revisit trigger:** the canonical JS engine exceeds **500ms** for a single `arc-recall` query on
the real corpus on the owner's machine or the ubuntu CI leg → the sqlite accelerator is promoted
from optional to the default-when-available path (it is already equivalence-gated, so the
promotion is a flag change, not a rewrite). Conversely, if the accelerator has not been exercised
by any real query for a full cycle after it ships, propose deleting it rather than maintaining a
second engine for nothing.

## Context

`PLAN-memory.md` v1.1 proposed storing the recall index in the built-in `node:sqlite` FTS5
engine, at `.claude/state/memory/index.db`, and made the FTS5 probe the cycle's **first act**
with an explicit instruction: *any failure → STOP and bring the owner the pure-JS fallback
decision.*

The probe was run on 2026-08-11. Two things came back, and they point opposite ways.

**The capability is real.** On the owner's machine (Node v24.18.0, win32/x64, SQLite 3.53.1) a
probe exercising exactly what §6.3 needs passed on every count: FTS5 virtual table, `unicode61`
tokenizer folding diacritics, external-content (`content=docs`) tables, `bm25()` with per-column
weights, parameterized `MATCH` (no query string ever concatenated into SQL), and atomic
temp-db-plus-rename. No experimental warning on Node 24.

**The platform is not.** `node:sqlite` exists only on **Node 22+**. arc's CI matrix
(`.github/workflows/ci.yml`) is:

| leg | node | `node:sqlite` |
|---|---|---|
| ubuntu-latest | 18 | ✗ |
| ubuntu-latest | 20 | ✗ |
| ubuntu-latest | 22 | ✓ |
| macos-latest ×3 shards | 20 | ✗ |
| windows-latest ×12 shards | 20 | ✗ |

**Only 1 of the 5 distinct OS×node combinations can import the module at all** — a single job out
of the matrix's 18 (macOS is sharded ×3 and Windows ×12, so job count and combination count differ
and it is the combination count that matters here). A sqlite-only index would make
REQ-01's stated acceptance — *delete the index → rebuild → identical results, green on 3 OSes* —
literally unmeetable, because two of the three OSes have no engine to run it on. It would also
make `arc-recall` fail outright on Node 18/20, which is the runtime of every root-mode consumer
install (LexOS and future venture repos), directly contradicting REQ-02's *"any session, in arc
or any root-mode install"*.

This fork is not new to arc. **ADR-0024** (accepted, one-way) faced it for the receipt spine and
ruled: the canonical read path must work on Node ≥18 everywhere; `node:sqlite` is an *optional
accelerator behind an equivalence gate*; "sqlite as truth" was rejected **specifically because it
needs Node 22+ while CI keeps a Node 18 leg**. That ruling is not merely documented — it is
implemented in `.claude/scripts/hq/spine.mjs`, which imports `node:sqlite` **lazily** with the
comment *"the accelerator must never be able to break the path it is only supposed to
accelerate"* and degrades with `node:sqlite unavailable (Node < 22)`.

Making memory sqlite-only would therefore make it the **first arc component to hard-require Node
22**, overturning a one-way ADR by omission rather than by decision.

The corpus size is the other decisive constraint, and it argues the same way. Measured
2026-08-11: retro-log 53 pattern rows, trial-ledger 85 table rows, learning-ledger 4 blocks, 140
ADRs — the three text organs total ~80KB, the ADR directory ~853KB. That is a few hundred
records. An in-memory inverted index with BM25 scoring over that corpus is not a compromise; at
this size it is comfortably sub-second without an engine at all.

## Options considered

1. **sqlite-only (as originally drafted, MEM-B v1.1)** — pros: FTS5 and `bm25()` come free, no
   ranking code to write. Cons: untestable on 2 of 3 CI OSes, dead on Node 18/20 root-mode
   installs, requires changing the CI matrix to Node 22 on macOS and Windows, and silently
   overturns ADR-0024.
2. **pure-JS only, no sqlite ever** — pros: simplest possible thing that works everywhere, one
   engine, no equivalence burden. Cons: forfeits a capability already proven available, and when
   the corpus eventually outgrows a linear scan the answer has to be rebuilt rather than
   switched on.
3. **pure-JS canonical + `node:sqlite` FTS5 optional accelerator behind an equivalence gate** —
   chosen. Pros: runs on every OS and every Node ≥18, testable on all six CI legs, matches the
   pattern arc already ships for the spine, and keeps the measured FTS5 capability on the shelf
   with a defined promotion trigger. Cons: two engines must be proven to agree — a real,
   recurring cost that buys no speed at today's corpus size.

## Decision

The **canonical** recall path is a pure-JS inverted index with BM25 scoring, built in-process,
requiring nothing beyond Node ≥18 and zero npm dependencies. It is the path every test, every
fixture, and every consumer gets by default.

`node:sqlite` FTS5 is an **optional accelerator**, imported **lazily** so that its absence can
never break the canonical path, selected only when the module exists *and* the built index is
present. It is governed by an **equivalence gate**: for the golden query set, both engines must
return the **same ordered list of document ids** — canonically compared, never by comparing db
bytes, which are not reproducible and were never the contract.

Ordering requires a **documented tie-break, or the gate produces false drift**: on equal bm25
scores both engines sort **id-ascending**. This is not hypothetical — the corpus is tag-heavy with
many short, similar bodies (`verification` appears on 17 rows, `gate` on 12), so score ties are
expected, and "same ordered ids" without a tie-break rule is untestable.

The gate must also be unable to pass by doing nothing: on the 4 combinations without the module
the sqlite side **skips visibly and counted**, and a run in which *every* leg skipped is a
**FAIL**. A pass condition that is only an absence cannot detect its own non-execution.

Engine selection is explicit and inspectable (`--engine js|sqlite|auto`, default `auto`, with the
chosen engine named in `--json` output), so a test can force either side and the equivalence gate
can run both in one process.

The index remains **derived-only** at `.claude/state/memory/index.db` (plus the JS engine's own
artifact), never committed — verified 2026-08-11: `.gitignore` already covers `.claude/state/`.
Staleness is a manifest of mtime+sha256 per source; any mismatch triggers a **full rebuild**, not
an incremental update.

**Evidence:** local probe 2026-08-11, Node v24.18.0 / win32-x64 / SQLite 3.53.1 — FTS5,
unicode61, external-content, weighted `bm25()`, parameterized MATCH and atomic rename all
verified in one run, exit 0. CI matrix read from `.github/workflows/ci.yml` (6 OS×node legs, one
at Node 22). Precedent read from `docs/adr/0024-spine-a-append-only-canonical-jsonl-is-truth.md`
and its live implementation in `.claude/scripts/hq/spine.mjs`. Corpus measured the same day.
No third-party package is cited by this decision — both engines are Node built-ins, so there is
no registry entry to verify and no supply-chain surface.
**Confidence:** high.
**Rejected because:** sqlite-only — unrunnable on 2 of 3 CI OSes and on every Node 18/20 consumer
install; pure-JS-only — discards a capability already measured as available for no gain.

## Consequences

- **Easier:** `arc-recall` runs everywhere arc runs, with no runtime floor above arc's own. All
  six CI legs test the real path rather than skipping. Root-mode installs need no Node upgrade.
- **Harder:** two engines must be kept in agreement. That equivalence gate is now a first-class
  requirement with its own tests, not a footnote — and it is the honest price of this option over
  a single-engine build.
- **Watch for:** the accelerator earning its keep. At today's corpus size it buys no measurable
  speed, so it is the **first thing cut** if the 4-day appetite squeezes — cutting it costs the
  user nothing observable. The revisit trigger above exists so that "we keep it because we built
  it" never becomes the reason.
- The 500ms promotion threshold is deliberately well under REQ-02's 1s budget, so the switch is
  made on a trend rather than at the moment the contract breaks.
