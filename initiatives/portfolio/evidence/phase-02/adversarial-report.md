# Phase 02 — adversarial breaking-input pass

**Run 2026-08-01, before close.** Required by `docs/retro-log.md:10` (arc-council-v2,
2026-07-16): *"for any hand-authored gate/lint/parser, run an adversarial breaking-input
workflow BEFORE close; mandatory verification, not optional review"* — and by this phase's
own Definition of Done.

**It had not been run.** Sections B, D and F shipped without it; only section A carried one
(19 confirmed holes, recorded in the spec). This pass is that omission being paid off.

## Method

Six independent passes, each given one target and one attack lens, each required to report
both its hits **and** the attacks that correctly held — a pass that reports only hits is not
measurable. Every pass worked in throwaway sandboxes; nothing in the repo was modified.

| Lens | Target |
|---|---|
| markdown/table structure | `board-lint.sh` |
| machine-header key/value + bash-vs-node twin divergence | `board-lint.sh`, `lane-resolve.{sh,mjs}` |
| git state, filesystem, environment | `board-lint.sh` |
| manifest derivation, path matching, exemptions | `ownership-lint.sh` |
| spool file states | `spine-io.mjs` drain, `arc-event.mjs` |
| timing, ordering, concurrency, day boundaries | `withLock`, `appendEvent`, `close-day` |

**61 findings reported. 9 verified by hand** — re-running the reproduction and reading the
result directly, not carrying the report's verdict. Nothing was rejected on verification;
the remaining 52 are **reported but unconfirmed** and are labelled as such below.

## Verified by hand (9)

Each of these was reproduced independently before being believed.

1. **`ownership-lint --base` typo silently disables the lint.** `git diff --name-only
   "$BASE...HEAD" 2>/dev/null` fails, `CHANGED` is empty, and the next line exits 0. A real
   cross-lane edit goes unreported. `--base origin/main` on a shallow clone reaches this.
   *Same bug class as Phase 01's `git status` empty-stdout finding, in a new script one
   phase later.*
2. **Spool `ts` is never re-validated.** A spool file carrying `"ts":"not-a-date"` is
   appended to `events/not-a-date.jsonl`. `listDays()` filters that name out, so the receipt
   is invisible to `spine read`, `spine days`, brief and replay — on disk, not on the spine,
   not in `_pending`, not in `_quarantine`. **Lost.** The drain reports `drained 1`.
3. **Spool `ts` is used as a path component.** `"../../../pwn".slice(0,10)` is
   `"../../../p"`, so the receipt was written to `/tmp/p.jsonl` — three directories above
   the spine root. File content decides the write path.
4. **The drain skips the secret scan (ADR-0028 bypass).** The payload the front door refuses
   with `SKIP SECRET` lands in cleartext on the append-only spine when it arrives via
   `_pending/`. The drain's assumption "sealed by the emitter, so already past the scan" is
   a claim about provenance that the code never establishes.
5. **`--lane a --lane b` is last-wins in `ownership-lint`, and the verdict inverts with flag
   order.** `lane-resolve.sh` correctly answers `status=invalid reason=duplicate-lane`
   (exit 5); the lint's own flag parser collapses the duplicate before the resolver sees it.
   `.claude/rules/lanes.md` names this exact failure: *"silently picking one of two named
   lanes is precisely the 'never guess' failure."*
6. **A trailing `--lane` with an empty value is dropped, and the lint auto-resolves and
   speaks anyway** — a verdict about a lane the operator never named. `lanes.md` names this
   one too: *"an unquoted empty value silently eats the next flag."*
7. **`git mv` out of another lane is invisible.** A plain `rm` of the same file is caught;
   `git diff --name-only` prints only the destination of a rename, so the source path never
   enters the subject set. Stealing a file is a stronger violation than editing it.
8. **Any non-ASCII filename is invisible to `ownership-lint`.** Git's default
   `core.quotePath=true` returns `"initiatives/design/na\303\257ve.md"` — quoted — so
   `case "$_p" in initiatives/*)` never matches and no manifest entry compares equal.
9. **A waiter breaks the lock of a holder that is alive and still working.**
   `LOCK_STALE_MS` (5000) < `STRICT_LOCK_TIMEOUT_MS` (15000), and `withLock` re-reads its
   token once at acquire and never again during `fn()`. Reproduced at production defaults:
   holder still inside its critical section, lock deleted and taken by the waiter. Two
   writers in one critical section is how duplicate receipts reach an append-only spine
   with both processes exiting 0. **This one is fixed in this branch, with a red-first
   fixture** (`tests/spine-concurrency.bats`, `lock:` — it reports `HOLDER_LOST_LOCK` and
   fails when the fix is reverted).

## Reported but unconfirmed (52)

Recorded so the work is not lost. **These carry an agent's verdict, not mine** — each still
needs its reproduction re-run before it is believed or acted on.

**`spine-io.mjs` drain / spool — 9 further** · a spool file whose append always throws is
retried forever with no terminal state · a directory named `x.json` is "quarantined" on
every emit while the message says it was moved · a failed quarantine still reports success ·
`_pending` as a file throws out of the drain and takes the caller's receipt with it · a
multi-line spool file is appended verbatim and breaks the one-event-per-line invariant ·
`MAX_EVENT_BYTES` is not enforced on the drain path · a destroyed spool file leaves a
tombstone naming nothing · `pendingCount` counts directories and `.tmp` leftovers ·
`close-day` seals the day and leaves an undrainable receipt behind.

**Lock / ordering — 7 further** · duplicates on the spine from the stale-break race (the
verified finding's consequence, measured at 30 duplicated ids in 90 lines) · the same race
against `close-day`, producing a `day.closed` sha that describes bytes that no longer exist
· `LOCK_LOST` is not routed to the spool, so a sealed receipt is quarantined with only the
raw flag text · the drain report is discarded whenever the caller's own append throws ·
`close-day` mutates the spine then reports only its own refusal · `listPending` outside the
try · same-millisecond spool files drain in ULID order rather than arrival order.

**`board-lint.sh` structure — 15** · a setext heading does not close the section, so a
foreign table satisfies the row/lane iff · a second table under one heading yields lanes
named `lane` and `---` · `_PARSEABLE == 0` does not suppress the rows, so positional
per-column WARNs are emitted about a header that was never asserted · a later well-formed
header licenses positional reads of an earlier mis-ordered table · a 4-space-indented code
block is parsed as real rows · an `Updated:` inside a code block wins over the real one · a
missing separator row silently eats the first data row · a misplaced separator is reported
as a lane · a broken passports table empties the venture set and produces the one
`/arc-kickoff --lane lexos` advice ADR-0059 forbids · a stray `|`-prefixed prose line shifts
the whole positional scheme · a pipe-prefixed line after the table becomes a "lane" whose
suggested fix is an unquoted multi-word `--lane` value · a markdown link in the lane cell
double-reports · a backticked `<!--` in a cell swallows the rest of the board · a
leading-pipe-less GFM table is invisible · one extra `|` in the header row makes every lane
"have no row".

**`board-lint.sh` / `lane-resolve` header parsing — 9** · `_safe_name` renders multi-byte
names per BYTE in bash and per CODE UNIT in node, so the twins disagree (`caf??` vs `caf?`)
— and the fixture that claims to pin this uses the one input class that cannot expose it ·
an empty header value plus an empty board cell is reported as drift with `Expected` and
`Found` both `(none)`, a block arc's own shape gate rejects with 66 · a `status:` inside an
HTML comment is authoritative for all three readers, flipping lane eligibility · a header
value containing U+2190 lands in the `Example` and fails the shape gate · a value containing
the citation separator re-splits the source pointer · the dependency WARN always cites the
`blocked-on` line even when `depends-on` drifted · an absent dependency key yields an
`Example` that never converges and grows on each application · a lane that is also a
passport row has every per-column check suppressed · a `|` in a header value can never match
the board's mandatory GFM escape.

**`board-lint.sh` environment — 5** · ambient `GIT_DIR` silently overrides `--root`, in both
directions · freshness is measured against the **committer** date, so an amend, rebase or
squash-merge makes a board committed in the same commit as its lane report itself stale
(arc's own merge path) · a future-dated commit makes the board permanently stale and the
`Example` tells the operator to paste a future date · one `git log` per lane, 24s at 61
lanes and 129s at 251 · a mid-merge conflict is parsed by last-wins and the `Example`
resolves the conflict by coin flip.

**`ownership-lint.sh` — 7 further** · a second product claiming the same path masks the
lane's claim, decided by directory sort order · a `./`-prefixed manifest entry owns nothing
· a case-different entry owns nothing on two of three CI legs · a directory-shaped entry
owns nothing inside it · the `Found:` citation points at a `PROGRESS.md` that need not exist
· any quoted occurrence anywhere in a manifest counts as an ownership claim · a
manifest-owned path under a non-lane `initiatives/` subdirectory is never checked.

## What was done about it in this phase

**Fixed and pinned:** finding 9 only — the lock. It is the one that puts wrong data on an
immutable artifact, and it was reachable at production defaults.

**Reverted:** section F, the `_pending/` spool. Findings 2, 3, 4 are defects in code written
the same day, and the drain is also what made finding 9 reachable in ordinary operation: it
moved an unbounded, `O(pending × idem-index)` body inside the critical section that had
previously held a single append. Reverting removes all four at once and returns hook-mode
timeouts to `_quarantine/` — the known state before this phase.

**Routed:** everything else, to Phase 03 retro input RI-1.

## The thing worth carrying forward

Every one of the nine verified findings was produced by **running** the artifact. None came
from reading it, and the code had been read carefully — sections B, D and F each ship with
long comments explaining why they are correct, and several of those comments are the exact
claims the pass falsified. `board-lint.sh` passes its own 41 fixtures. `spine-spool.bats`
passed 9 fixtures on three operating systems.

`docs/retro-log.md:10` already said this in 2026-07-16: *"code that looked correct and
passed its own fixtures"*. This phase shipped three gates without the pass and then found
the same thing again.
