# Debt ledger — the docs lane

LOW findings left after the two attack rounds a PR is allowed (memory: attack rounds capped at two),
one line each, with where they came from. Each is paid in a later slice or closed with a reason.

## Phase 00 -- the logic surface that never ran

- **DOC-K half-met on Phase 00.** The logic attacker (ADR-0226, `--driver generic-api --trial-model $ARC_ATTACK_TRIAL_MODEL`) failed on transport twice: HTTP 503 on round 1, HTTP 429 on a direct `arc-run` retry against the merged squash `f32d8957`. No substitute agent was used. Owner ruled 2026-09-25 to close with this recorded. Pay: the first Phase 01 logic round that runs is given `--base f32d8957^` as well, or a working model is set and Phase 00's diff attacked on its own.

## Phase 00 (attack fb17189, round 2, boundary)

- **B5** — a crash and a real refusal share exit 2 in the writer tests; the assertions check the message text, not a crash-free run. Pay: assert no `wiki-build: ` stack line in each refusal test.
- **B6** — the "resolves outside the tree" and the non-ENOENT read-failure branches have no test that only they decide (outside-tree needs a linked parent; EACCES needs a non-Windows chmod). Pay: two POSIX-only fixture cases.
- **B9** — a closed STDERR turns a usage exit 2 into an uncaught EPIPE exit 1. Pay: guard stderr writes the way `say()` guards stdout.
- **B10** — only a UTF-8 BOM is handled; a UTF-16 file (PowerShell 5.1's default `Out-File`) parses as garbage facts at exit 0. Pay: refuse a UTF-16 BOM by name.
- **B11** — stdout mode inherits the console's newline handling; the byte guarantee is proven only for `--out`. Pay: say so in `--help`, or test stdout bytes on the Windows leg.

## Phase 01 (attack 8bc7826, round 1, boundary)

- **P1 B14** — the reverse direction sees only directories and `.md` stems, because face-coverage's helpers list nothing else; a stray `docs/wiki/products/x.mdx` or `docs/wiki/index.html` is invisible to `wiki-coverage`. Covered from Phase 02 by the regenerate-and-diff check (ADR-1504), which compares every byte and every file under `docs/wiki/` except `_narrative/`. Pay fully: a `treeFiles` export in face-coverage, in a cycle that may touch that file.
- **Logic surface** — failed on transport again for Phase 01 round 1 (same free trial model). Same standing gap as Phase 00.

## Phase 01 (attack f3b311d, round 2, boundary)

- **P1r2 B6/B7** — exit-2 stderr writes and the self-test's own diagnostic lines are not EPIPE-guarded / some go to stdout. Pay: one guarded `say()` for both streams.
- **P1r2 B8** — `collect`'s counts reduce assumes list shapes forwardFindings already validated; a malformed injected world could throw instead of reporting. Only the self-test injects. Pay: reuse forward's shape check.
- **P1r2 B9** — disk names are interpolated raw into finding lines; a name with a newline could forge a line. Pay: JSON-escape every disk-derived name, as `[bad-id]` already does.
- **P1r2 B10** — `tests/docs/write-pages.mjs` lets import/extract/write failures escape as unhandled rejections (exit 1). Test helper only. Pay: one try/catch to exit 2.
- **P1r2 B11** — an unreadable page directory (EACCES) surfaces as an uncaught throw from face-coverage's `readdirSync` (exit 2 with a stack), not a named finding. Not silent; not pretty. Pay with P1 B14's `treeFiles` export.

## Phase 02 (attack e5730ee, the one round, boundary)

- **P2 B5** — a render failure under `--check` prints to stdout, not stderr. Pay with P1r2 B6/B7's guarded writer.
- **P2 B7** — superseded: the per-dir lstat is now `pathProblems`, which names every non-ENOENT error.
- **P2 B8** — `sameBytes` now normalises BOM/CR like every other read; a CRLF checkout of `docs/wiki/` is equal, which is the intent. Closed.
- **P2 B10** — `link-check.mjs` does not parse a link target containing a space or a `)`; the renderer emits none. Pay when a path with either appears.
- **P2 B12** — two ids one case apart would render two pages (one file on Windows/macOS); `wiki-coverage` already fails `[id-collision]` on exactly that, so CI stops it. Pay: the renderer refuses too.
- **P2 B13** — `wiki-build` with no flags now writes `docs/wiki/` (it used to refuse). Intended by the Phase 02 spec; the writer refuses everything outside `docs/wiki/` and every hand-written file.
