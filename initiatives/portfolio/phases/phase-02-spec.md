# Phase 02 — Parallel-safety floor

**Goal (one line):** WIP info line at kickoff preflight (counted = LIVE+BLOCKED, informational only, ADR-0052), two-table board lint with Expected/Found/Example messages (REQ-03), manifest-derived ownership lint (ADR-0057), and the spine concurrency contract — strict retry → exit 2, hook-mode `_pending/` spool surfaced in status/brief and drained under the next lock, zero-interleaving proven on 3 OS (REQ-04) — all WARN-first.

**Appetite:** 0.75 days
**Depends on:** phase-01

Mode B (ADR-0056) is certified ONLY when REQ-04 is green; until then concurrent emitters
are forbidden and the board carries `Mode B: not certified`. WIP counting per ADR-0052
never stops kickoff at any count. Cross-lane writes per ADR-0053 are exactly what the
ownership lint catches; ventures stay passport-rows-only per ADR-0059.

## Verification plan

**REFINED 2026-08-01** via `/arc-change`, before any Phase-02 code (ADR-0061 · ADR-0062
settled the two Phase-01 deviations in the same pass). Every item below is a fixture that
either exists and passes or the phase does not close. No local runs — CI is the gate.

### A. The WARN message contract (REQ-03, REQ-04 — applies to every new WARN)

Every new WARN prints three labelled parts and a source location. One shared assertion
helper checks the shape, so a WARN that forgets a part fails the suite rather than shipping:

```
WARN [board-header-drift] PORTFOLIO.md:16 — initiatives row `portfolio` disagrees with its lane header
  Expected: burn 1.9d   ← initiatives/portfolio/PROGRESS.md:8  `burn: 1.9d`
  Found:    burn 1.4d   ← PORTFOLIO.md:16, column `appetite/burn`
  Example:  | portfolio | LIVE | arc-portfolio | 02 — Parallel-safety floor | 3d / 1.9d | — | … |
```

- **Expected** names the derived-from source *with its file and line* — the lane header is
  the truth (ADR-0051), so the WARN must point at it, not merely describe it.
- **Found** names the board cell and its line.
- **Example** is a paste-able corrected row, not prose.
- Fixtured per class: `[board-header-drift]` · `[board-row-no-lane]` (ADR-0061) ·
  `[lane-no-board-row]` · `[board-bad-status]` · `[board-bad-dependency-line]` ·
  `[board-venture-in-initiatives]` · `[board-stale-updated]` · `[lane-no-machine-header]`
  (ADR-0062) · `[ownership-cross-lane]`. Nine classes, nine message fixtures.
- **Exit code is 0 for every one of them.** A WARN-first lint that exits non-zero is a BLOCK
  wearing a WARN's label; one fixture per class asserts the exit code, not just the text.

### B. Board lint (REQ-03)

- **Both tables parsed, one grammar each.** Initiatives rows ↔ `initiatives/<lane>/` dir
  (ADR-0061: iff, in both directions — a row with no lane AND a lane with no row each WARN).
  Passport rows are grammar-checked and exempt from the directory check (ADR-0059).
- **Cross-check against the machine header, not prose.** Fixture hand-edits one board cell
  and asserts the exact drift WARN; a second asserts a matching board is silent.
- **Adversarial markdown pass — mandatory before close** (CLAUDE.md; council v2/v3 found 43
  real holes in parsers that passed their own tests). Constructed breaking inputs, each
  pinned as a fixture once fixed: `Status:`/`**status**:`/leading-whitespace variants ·
  a repeated `status:` key (last wins) · a machine-header key inside a fenced block
  (``` and ~~~) · CRLF line endings · a `##` heading appearing before the header block ends ·
  a board cell containing a literal `|` · a table row with a trailing-space column ·
  unicode look-alikes in a lane name · an em-dash where `—` is the empty marker vs a hyphen.
  Reuse `lane-resolve.sh`'s existing awk contract as the reference implementation — the two
  parsers must agree, and a fixture asserts they do on the same input.
- **Root-mode silence.** `tests/root-golden.bats` extended: with no `initiatives/`, the
  board lint emits nothing and changes no byte of existing output (permanent consumer
  contract, ADR-0054).

### C. WIP info line (REQ-03, ADR-0052)

- counted = **LIVE + BLOCKED**. Fixtures at 0, 1, 2 and 3 lanes assert the printed number.
- **QUEUED and IDLE are not counted** — one fixture each. This matters more after ADR-0061:
  `QUEUED` is now a state a real lane holds, so it is reachable and must be proven uncounted.
- **Kickoff PROCEEDS at every count**, exit 0, no prompt, no override ceremony — one fixture
  explicitly asserts *not blocked at 2+* (ADR-0052 is owner-locked; the v3 day-one BLOCK is
  the mistake this fixture exists to prevent recurring).

### D. Ownership lint (REQ-04, ADR-0057)

- Seeded cross-lane edit (resolved lane `portfolio`, diff touches `initiatives/design/**`)
  → `[ownership-cross-lane]` WARN with the three parts.
- **Manifest-derived, not hardcoded**: a fixture adds a path to the manifest and asserts the
  lint's verdict follows it. A lint whose map is a literal in its own source is not
  manifest-derived, and only this fixture can tell the difference.
- **Company organs are never flagged** (ADR-0053): editing `docs/adr/`, `docs/HISTORY.md`,
  the retro log, the trial ledger or `tests/` from any lane is silent. One fixture per organ.
- WARN-first: exit 0 in every case above.

### E. Spine concurrency — zero interleaving on 3 OS (REQ-04, tests A3)

The whole point is a test that cannot pass by accident, so it is built as control + subject:

1. **Negative control, same harness, same OS.** N writers append a **>8 KB** line each to a
   plain file with `>>` (over `PIPE_BUF`, so the append is not atomic). The control
   **must show a torn line**. If it does not, the harness is not achieving real concurrency
   on that leg and the subject's pass proves nothing — so the control failing to corrupt
   **fails the test**. This is the guard against a green concurrency gate that never contended.
2. **Subject.** 8 emitters × 25 events = 200, one `ARC_SPINE_ROOT`, strict mode with a
   generous timeout so nothing legitimately routes to the spool (this test is about the main
   file only). `ARC_SPINE_LOCK_STALE_MS` is set high enough that **no stale-break can occur
   during the run** — otherwise the fixture silently becomes a test of the stale-breaker.
3. **Assertions on the day JSONL:** every line parses as JSON (a torn write does not) ·
   line count == successful emits · every object carries the full required key set (catches
   a truncated-but-valid-looking line) · the multiset of event ids equals the multiset
   emitted — **nothing lost, nothing duplicated** · no zero-length line · exactly one
   trailing newline.
4. **3 OS means executed on 3 OS.** The file sits in the normal matrix, in no skip list,
   with ASCII-only `@test` names, and Phase 00's `declared == executed` reconciliation is
   what proves it ran rather than was counted (the 2026-07-30 em-dash incident, which
   recurred in Phase 01 — six tests that existed, were counted, and never ran).

### F. Spool — drain and visibility (REQ-04)

**The gap being closed, stated precisely:** today a hook-mode lock timeout falls into
`arc-event.mjs`'s catch-all and lands in `events/_quarantine/` — the same bucket as a
malformed payload. "Your event was invalid" and "the machine was busy" are different facts
and must stop sharing a destination.

- **Timeout is forced, not raced:** the test holds `events/.lock` with a live token and
  keeps its mtime fresh so it never goes stale, then emits in hook mode
  (`HOOK_LOCK_TIMEOUT_MS = 2000`).
- **Spool fixture:** exit **0** (hook never blocks a session) · the event lands in
  `events/_pending/` as its **own file**, one per event · it is **not** in `_quarantine/` ·
  stderr says which and why · the day file is byte-unchanged.
- **Drain fixture:** release the lock, run the next emit → the pending event is appended
  under that lock · the drained line is **byte-identical to what a direct emit would have
  written** (canonical serialization, compared against a same-input direct emit) · the idem
  index gains its entry · `_pending/` is empty · day-file ordering still obeys the canonical
  rule after a late arrival.
- **Idempotency fixture:** draining twice does not duplicate — the second drain is a no-op,
  asserted on both the day file and the idem index. A crash mid-drain leaves the event
  either spooled or appended, never both and never neither.
- **Visibility fixture:** with K spooled events, `status` and `brief` both print exactly K.
  At K = 0 the line is **absent**, so an empty spool does not add noise to every brief —
  and that absence is itself asserted, so "surfaced" cannot quietly become "surfaced only
  when someone looks".

### G. Mode B stays uncertified until E and F are green

`Mode B: not certified` remains on the board until every fixture in E and F passes on all
three legs (ADR-0056). Certification is a fixture result, not a judgement call — the phase
may not close by asserting it.

### Definition of Done for this phase

All of A–G green in one CI run on ubuntu + macOS + windows-git-bash, with
`declared == executed` on every leg, the adversarial pass in B run and its findings pinned,
root-mode goldens unchanged, and an evidence bundle at
`initiatives/portfolio/evidence/phase-02/`.

## Rabbit holes in this phase

- Turning the spool into an event bus or daemon (ADR-0027's no-bus stance holds — it is
  a timeout fallback only). Board schema generalization. Promotion of any WARN to BLOCK
  (trial-ledger evidence only).

## Out of scope for this phase

- Docs rewrite + retro (Phase 3). Real-world parallel validation (next cycle: develop
  kickoff = first native lane, the dogfood tripwire).

## Your-setup / pending

- None.

## Non-negotiables (verbatim from PLAN)

- Philosophy untouched: Golden Loop, gates, receipts, change discipline — a lane is a namespace for tracker state, nothing more (ADR-0050, ADR-0053).
- No history rewrite and no history duplication: frozen paths stay frozen as sole canonical copies; lanes link, never copy (ADR-0055, ADR-0058).
- Root-mode green at every commit — byte-identical when no `initiatives/` dir exists; the bare-root fixture is a permanent consumer contract (ADR-0054).
- feat/* branch + PR, never main.
- All new lints WARN-first, and every WARN prints Expected / Found / Example (ADR-0057).
- Spine receipts for kickoff / phase-done / retro as usual; no silently lost receipts — degrade visibly, never lose, never block (ADR-0056, REQ-04).
- Never guess a lane: explicit `--lane` beats auto-resolve beats ask; destructive commands confirm the selected lane (ADR-0054).
