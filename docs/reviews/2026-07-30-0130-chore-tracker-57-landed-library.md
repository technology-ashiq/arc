# Code review — design intelligence library (Phase 03 step 1)

- **Date:** 2026-07-30
- **Branch:** `chore/tracker-57-landed`
- **Base:** `main` @ `d2d8a85`
- **Reviewer:** `code-reviewer` subagent, 4 rounds
- **Verdict:** **ship** (round 4, after one regex line). Rounds 1–3 were `fix-first`.

## Scope

| File | Change |
|---|---|
| `.claude/scripts/design/design-lint.mjs` | `--library` mode added to the EXISTING lint (no parallel script); `stripComments` + rewritten `stripFences` |
| `docs/templates/design-library-entry-template.md` | NEW, added to `products/design/manifest.json` docs |
| `docs/design/library/` | 4 first entries + README |
| `tests/design-lint.bats` | new §4 — 23 cases |
| `tests/fixtures/design-lint/library/` | 13 committed fixtures |
| `tests/fixtures/sync-golden/tree-manifest.txt` | re-recorded 4× as the lint changed |

## Scanners (round 4)

opengrep: 1 hit, **false positive** (`detect-non-literal-regexp` — the value comes from the
frozen `LIB_HEADINGS`). gitleaks: 15 hits, **0 in scope** (pre-existing deliberate fixtures).
osv-scanner / knip / npm: N/A, no `package.json`. **shellcheck: not installed** — no shell in
this diff, so unlike the #57 review it costs nothing here.

## The finding that matters more than any individual bug

**Four adversarial rounds. Every round found a defect created by the previous round's fix.**

| Round | Attacks | Real bypasses | Where they came from |
|---|---|---|---|
| 1 (mine) | 16 | 2 | the original code |
| 2 | 15 | 6 | **3 in round 1's fix** |
| 3 | — | 1 critical | **round 2's fix** |
| 4 | — | 3 variants | **round 3's fix** |

Round 1 found two holes. Declaring the adversarial pass "done" there — which is what the
non-negotiable literally asks for — would have shipped a gate whose headline invariant was
bypassable by deleting three characters, and a lint that broke the consumer's documented path.

Every hole after round 1 was in a **stripper that modelled only well-formed input**. That is the
class, and it is worth naming because it will recur: `stripFences` and `stripComments` are
parsers, and a parser written against valid documents is not a parser, it is a formatter.

## Findings

### Round 1 — `fix-first`

1. **Both required headings inside an HTML comment satisfied the section check.** Reader sees an
   entry with no principle; machine sees two met contracts. The twin of the brief lint's
   fenced-heading hole, same root cause: structure parsed on two different texts.
   *Resolved:* one structural text, fences and comments both stripped.
2. **Gate mode discovered only `<YYYY-MM-DD>-<slug>.md`,** so an untagged `notes.md` sat in the
   library and passed in silence — a filename decided whether "untagged observations don't
   enter" applied at all. *Resolved:* every `.md` linted, non-conforming names their own error.

### Round 2 — `fix-first` (three of these were in round 1's fix)

3. **Unterminated `<!--`** runs to EOF per CommonMark, so deleting the closing delimiter
   restored the hole just closed.
4. **Unterminated code fence** — same bypass on the other stripper. `~~~` was also unhandled,
   while `design-gate.sh` already handled it: two components disagreeing about what a fence is.
5. **The brief lint carried the identical comment hole** and nobody had looked, because its own
   adversarial pass had only ever attacked fences. A whole section could be commented out and
   the brief called complete. *Resolved on the brief path and the `--floors` export.*
6. **The shipped template passed when copied and given only prose** — four of its eight tags
   ship pre-filled with valid values, so the rule fell to copy-paste rather than to attack. It
   syncs to consumer projects, so copy-paste is their default path.
7. **Reference-style links** and **bare digits** both cleared the prose floor.
8. **False positive:** `<[^>]+>` ate real prose — "runway < twelve months" counted as markup. A
   gate that rejects correct work trains authors to pad, which is the failure the floor exists
   to prevent. Pinned as a green fixture.

### Round 3 — `fix-first` (in round 2's fix)

9. **The unterminated-fence branch was not line-anchored,** so one inline ``` mention blanked
   the rest of a document — and the shipped template mentions it once in its own guidance.
   **Filling the template in correctly produced ten errors** about tags and headings plainly
   visible on the page. My fixture missed it because it reproduced the template's tag block but
   not its comment — the third instance this change of *a fixture that did not represent the
   path*. *Resolved:* line-anchored per CommonMark, and pinned by a case that reads the REAL
   template, fills it, asserts the substitutions happened, and asserts exit 0.
10. Shortcut reference links `[a]` — the third link form of the same rule. Autolink
    `<https://…>` false-positived as an unfilled prompt. `critiquedRoutes()` still carried a
    private fence definition.

### Round 4 — `ship` after one line (in round 3's fix)

11. **The closer grammar was too lax.** CommonMark forbids an info string on a closing fence and
    requires same-or-longer; ` ```md … ```js ` and ` ````md … ``` ` therefore run to EOF for a
    reader while the matcher ended the block early. Three variants, all reproduced by hand
    before fixing. *Resolved:* `` `{3,} `` captures the full opener run, `` \1(?:`*|~*)[ \t]* ``
    requires same-or-longer with only whitespace after. The mirror is pinned too — equal-length,
    longer and tilde closers must still close, or the fix is a stripper that never closes.

### Content, not code — the finding I care about most

12. **`docs/design/library/2026-07-29-merging-surfaces-dissolves-their-contracts.md` made a
    factual claim its own source contradicts.** It listed the five declared states as "settled,
    unresolved, loading, empty, disabled". The brief says **empty · loading · error · success ·
    disabled**; `settled`/`unresolved` are the *losing variant's relabelling*, which juror 2
    explicitly criticised. The entry whose entire subject is *what did each region owe* stated
    the obligation in the wrong vocabulary and got 2 of 5 names wrong.
    *Resolved:* the brief's five words verbatim, the brief cited as a source, and the relabelling
    written up as a second-order observation with juror 2 credited — which makes the entry
    better than it was. The other three entries were checked against the rankings and hold.

## Two of my own test artifacts were broken the same way

- `hole-unterminated-comment.md` quoted the closing delimiter inside backticks, which
  **terminated its own comment**. The fixture was green and testing nothing.
- The digits case sed-patched one of the green fixture's *two* prose lines, leaving the second
  standing, so the section was never thin.

Both looked like guards. Neither guarded anything. Same class as finding 9.

## Tests

`design-lint` **51/51** (was 28) · `design-steel-thread` 39/39 · `design-explore` 16/16 ·
`sync` 23/23 · `products` 34/34 · `kickoff-lint` clean.

Red-first verified on every HOLE case. Brief-path behaviour differential run by the reviewer
against **all three** successive `stripFences` rewrites: 0 differences across every fixture
brief, the real brief and every critique artifact; `--floors` byte-identical throughout.

## Known limits, recorded rather than guessed at

- `*` does not cross shadow boundaries, so a web-component route would report `applied=1` with
  shadow content unpinned. No such route this cycle.
- The prose floor counts `[A-Za-z]{2,}`, so it is English-only. Noted for if the library ever
  takes non-English entries.
- Eight filler words still clear the floor. Deliberate: the floor stops empty entries; whether a
  principle is any good is an agent's call, not a script's (ADR-0048).
