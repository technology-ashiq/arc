# Phase 01 — eyes, viewports and the canvas gate · evidence bundle

**REQ-02**, the composer sees its own work before anyone else judges it. **REQ-03**, every surface
the brief declares is rendered and correctly classified.
**Closed:** 2026-09-17 · **Appetite:** 1.5d · **Actual:** about 4 build days (08-24, 08-25, 09-16,
09-17) · **Branch:** `feat/arc-design-v2-c16`

## The verdict

`arc-ci` run **35226423229**, head SHA `d7afadf35199d081bb344d2c963e07909e5076f4`, confirmed equal
to the branch tip, read **per JOB**:
- 14 of 19 jobs `success`.
- The 5 red jobs fail on exactly **14 distinct tests**, all of them the named red-first set of
  Phase 02 Slice B in `tests/design-refpack.bats` (`refpack:`, `registry:`, `preflight:`), 70
  failures across 5 legs.
- No other test is red on any leg. `declared = executed` on all 18 reconcile lines.

That is the gate as amended by the **owner's ruling of 2026-09-17**, routed through `/arc-change`:
Phase 01's own suites green on every leg, and the only red a later phase's named red-first set.

Phase 01's suites at that head, summed over every leg, with zero failures:
- `composer bash`: 185 ok
- `confine`: 105
- `surfaces`: 95
- `selfreview`: 120
- `viewports`: 35
- dispatcher `fixture`: 40

In the tree:
- `design-composer-eyes.bats`: 86 cases
- `design-surface-gate.bats`: 23
- `design-selfreview.bats`: 22
- `design-render-confine.bats`: 19
- `design-composer-bash.bats`: 37
- plus 9 dispatcher fixture cases in `hooks-dispatch.bats`

## Red before green

Every slice landed its tests first. The CI runs on those tests-only commits are in `PROGRESS.md`:
- the read boundary (`66817698`), the surface gate (`01f8d04c`) and the self-review manifest
  (`8f28ac87`), 08-23 and 08-24;
- the abandoned-boundary fix: run 35124911002, 9 of 10 red for the reasons they name;
- the one-surface self-review rule: run 35142810771, exactly two intended cases red on every leg;
- the composer Bash boundary: run 35150906946, six refusal cases red on all five legs;
- render confinement: run 35185025298, all 15 red for the reasons they name. That run's macOS shard
  3/3 also failed on unrelated tests, every one an `EIO` disk fault on the runner, not this change.

## Live demo and real-system checks

- `live-demo-lexos-p02.md`: three composers on the LexOS brief with mobile `yes`. Nine claimed fixes
  were confirmed by opening the iteration PNGs by hand. Five defects in Phase 01's own machinery
  were found and handled.
- `live-reverify-lexos-p03.md`: one composer under the installed Bash fragment and dispatcher.
  `compose-done` exited 0. Six renders were made, all `confined-loopback`. The manifest rows chain
  by hash: iteration 2's input `2664ac22…` is iteration 1's 1440x900 output, and its output
  `7b5fe77d…` is iteration 2's meta at that viewport. The three desktop PNGs were opened by hand:
  iteration 1's three defects are visibly fixed in iteration 2.
- `negative-control-transcript.md`: the installed read, edit and Bash hooks refuse a composer's
  sibling read, matrix read, sibling write and sibling `cat`, and allow its own page and its own
  render.
- `render-confinement-real-browser.md`: twelve synthetic pages on the real renderer. The sibling,
  matrix, remote and navigation attempts are refused, or blocked by Chromium with no pixel reaching
  the render.

No LexOS HTML or PNG is committed (owner ruling 2026-09-16). The explore directories stay untracked.

## Adversarial passes

All in `adversarial-open.md`, with a disposition for every finding:
- passes one to four: the gates, the allowlist, the abandoned boundary, and a code-reviewer pass;
- the fifth pass on the composer Bash boundary;
- the sixth on render confinement;
- the seventh to ninth on the Bash-boundary fixes, the ninth closing that surface under the owner's
  stop rule (no REALISTIC High or Med);
- a two-surface pass on the BS-4 dispatcher (none either).

Two owner edits were installed on 2026-09-17: the composer Bash fragment and the BS-4 dispatcher,
both byte-identical to their canonical fixtures and pinned by install cases that now run.

## Amendments to this phase

- `/arc-change` 2026-09-16: the abandoned boundary is diagnosable and never fails open.
- `/arc-change` 2026-09-17: render confinement (ADR-1418).
- `/arc-change` 2026-09-17: three DoD amendments by owner ruling — the CI gate above; iteration
  receipts named where they are built (session renders plus `self-review/manifest.md`, also in
  ADR-1401); and "the critic judges every rendered viewport" moved to Phase 03.

## Not shown here

- **A composer's refusal firing live.** The live composer hit none, and its transcript was empty when
  read. The refusals are shown by the transcript above and pinned on CI.
- **Spine receipts.** `arc-event` refuses inside a linked worktree by design, so `phase.closed` and
  its approval request are emitted from the main clone or after the merge, together with the
  kickoff pair.
