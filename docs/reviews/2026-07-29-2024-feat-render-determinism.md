# Code review — `feat/render-determinism` (issue #57)

- **Date:** 2026-07-29
- **Branch:** `feat/render-determinism`
- **Base:** `main` @ `5106d5e` (PR #61 merge — Phase 02 close)
- **Reviewed:** the working tree, uncommitted at review time; committed immediately after as
  the commit this file ships in
- **Reviewer:** `code-reviewer` subagent, 4 rounds
- **Verdict:** **ship** (round 4). Rounds 1–3 were `fix-first`.

## Scope

| File | Change |
|---|---|
| `.claude/scripts/design/design-render.sh` | the substantive fix |
| `tests/design-steel-thread.bats` | new §7, 10 cases |
| `tests/fixtures/design/fake-agent-browser.sh` | NEW — fake transport |
| `tests/fixtures/design/57-repro.html` | NEW — committed reproducer |
| `tests/test_helper.bash` | sandbox now copies `common.sh` |
| `tests/fixtures/sync-golden/tree-manifest.txt` | one hash re-recorded |
| `PLAN.md`, `PROGRESS.md` | ledger row + tracker |

## Scanners (round 4)

| Tool | Result |
|---|---|
| opengrep `--config auto --error` | **0 findings** / 65 rules, all 5 code files |
| gitleaks (history + worktree) | 15 hits, **0 in scope** — all pre-existing detector fixtures |
| osv-scanner | N/A — no dependency manifest in repo |
| knip / `npm run lint` | N/A — no `package.json` |
| shellcheck | **SKIPPED — not installed.** The highest-value missing scanner for a shell-only diff (`scoop install shellcheck`) |

## Findings

Every finding below was **verified by execution against the real browser**, not by reading.
Rounds are listed because the sequence is the point: three of the four rounds found a defect
in the *previous round's fix*, and two of those defects were in verification method rather
than in code.

### Round 1 — `fix-first`

1. **Refusal left a false evidence pair on disk.** A refusal after capture left `<slug>.png`
   holding the last unstable capture while `<slug>.json` still claimed an older hash — a
   silently disagreeing pair, in the directory where #57 was found.
   *Resolved:* `rm -f "$PNG" "$META"` before every post-capture refusal exit, including the
   pre-existing stale-duplicate path. Pinned by "a refusal leaves no PNG still claiming the
   old meta's hash".
2. **`applied=1` was a hardcoded literal, not a check.** The new fail-closed gate proved only
   that the eval *ran*. Reviewer demonstrated an eval that creates the style element and skips
   `appendChild` still returning `applied=1`.
   *Resolved (twice — see round 2).*
3. **A broken hasher was misdiagnosed as instability.** With no sha256 tool, a perfectly stable
   page took 6 captures and reported "does not render to a stable image".
   *Resolved:* `NOHASH` break with its own message and exit path.
4. **macOS leg risk + a vacuous case.** The sandbox lacked `common.sh`, so the script fell back
   to raw `sha256sum`, which stock macOS does not ship — on the macOS CI leg two cases would go
   red and the disagreement case would have **passed vacuously** (both hashes empty → refusal
   for the wrong reason).
   *Resolved:* sandbox copies `common.sh`; `_want_hash` hashes via the production
   `arc_hash_file` in a subshell; both cases assert `[ -n "$want" ]`.
5. **The real-browser case was aimed at a page where the race cannot occur.** `arc-hq-mockup.html`
   declares `system-ui`, so the pin changes the font, forces a reflow, and the capture rides
   behind it.
   *Resolved:* repointed, then repointed again (round 3).

### Round 2 — `fix-first`

6. **The `trap` swallowed SIGTERM.** `trap '…' EXIT INT TERM` with a non-exiting handler meant
   the script *survived* a TERM that previously killed it: a CI timeout or cancelled job would
   hang, and the probe was deleted mid-write then recreated.
   *Resolved:* three separate traps; INT exits 130, TERM exits 143.
7. **The measured `applied` still failed OPEN on exactly the #57 population.** Round 1's fix
   read back the computed font — but on a page that already declares the Arial stack (which is
   *what makes the race possible at all*) the page satisfies the font test by itself, so the
   check degenerated to "an element exists". A `style-src` CSP appends the element and applies
   nothing: `applied=1` with nothing applied.
   **My own round-1 verification was the flawed part** — stripping `appendChild` also removes
   the element, so `!!el` carried the refusal and the font test was never exercised.
   *Resolved:* `el.sheet.cssRules.length > 0` as the page-independent discriminator, plus
   `document.body || document.documentElement` (on a frameset/XML document `body` is null and
   `getComputedStyle(null)` throws outside the try, rejecting the eval and refusing the run
   citing determinism rules for an unrelated cause). Verified on variant-b: normal injection
   `applied=1`, element appended with a zero-rule sheet `applied=0`.

### Round 3 — `fix-first`

8. **The committed reproducer fixture was not a reproducer.** Measured byte-identical before
   and after injection (`b93db54b` → `b93db54b`), height 900 — shorter than the viewport, so
   `--full` never stitched. The case renders it could not fail against the pre-fix script.
   Root cause of my error: I wrote the reproducer property as "the page declares the pinned
   stack", which buys only *layout* neutrality. The property is two-sided — layout-neutral pin
   **and at least one element whose font the pin still changes**. `<button>`, `<kbd>`, `<code>`,
   `<input>`, `<select>` carry a UA font-family that does not inherit from body.
   *Resolved:* fixture rebuilt (6 buttons, 5 kbd, code, 2 inputs, a select), measured
   `138d3fa9` → `c45c1142`, height 1275. Two wrong table rows corrected —
   `-webkit-font-smoothing` is macOS-only in Blink and cannot be the pixel driver on the
   Windows or Linux legs.
   **And pinned so it cannot decay again:** new case "the #57 fixture is actually a reproducer"
   captures, injects, re-captures and asserts the hashes **differ**. Proved by stripping every
   control from the fixture → EXIT=1 with the diagnostic; restored byte-identical.

### Round 4 — `ship`

Reviewer independently reproduced every measurement. One extra: the pin alone and the full
recipe produce the *identical* before/after pair on the fixture, confirming the font pin is the
whole pixel driver and that the guard case's pin-only injection is representative.

Two comment-level nits, both actioned:
- The fixture claimed the pin **cannot** change height; it measures 1275 → 1274 (one pixel,
  from the controls). Wording now records the measured resting state so a future reader does
  not mistake it for decay. Fixed heights + inline-block were tried and did not close it
  (1279 → 1278); not worth chasing.
- `skip "could not open the fixture"` → `false` with a diagnostic: `agent-browser` is already
  known present at that line, so a failed open is a real breakage, not a skip.

**Not actioned, deliberately:** `*` does not cross shadow boundaries, so a web-component route
would report `applied=1` with shadow content unpinned. No such route exists this cycle; an
untested branch is the worse trade. Recorded here as a known limit.

## Tests

- `design-steel-thread.bats` **39/39** (was 29 before this change; §7 adds 10)
- `design-explore.bats` 16/16 · `design-lint.bats` 28/28 · `sync.bats` 23/23 · `products.bats` 34/34
- Manifest `ec00ae85…` matches the file byte-for-byte
- **Red-first:** 5 of the §7 cases fail against the pre-fix script. The 4 that pass both ways
  are policy/shape pins plus the intermittent real-browser case, which is documented in the
  file as a smoke check rather than a gate.

## Standing gap

`shellcheck` is not installed on this machine and was skipped in all four rounds. For a
shell-only diff it is the scanner most likely to catch what four rounds of reading did not.
Worth `scoop install shellcheck` before the next shell-heavy change.
