# ADR 0023 — REQ-11 attic scope-cut: the registry answers "installed", not "ours"

**Status:** accepted
**Date:** 2026-07-19
**Reversibility:** two-way
**Decided by:** Ashiq, at Phase 05 start
**Amends:** REQ-11 (`active` → `dropped`) · the Phase 05 spec's attic exit criteria · ADR-0020's Phase-5 placement of the attic half
**Adds:** REQ-12 — Phase 05's remaining goal (docs rewrite + TRIAL promotions) needed a REQ of its own once REQ-11 left, since the plan lint requires every phase to serve a live requirement
**Preserves:** the working implementation + its 16 hostile-input tests at commit `e2b3646` (branch `feat/arc-phase-05-attic`, deliberately unmerged)

## Context

ADR-0020 split the original REQ-10 in two: a **report** half (`--prune-report`, list stale files,
mutate nothing) pulled forward into Phase 4, and an **attic** half (`--attic`, MOVE them to
`.claude/attic/DATE/`) kept for Phase 5. The report half shipped and is in use — it found 21
unowned files in venturemind, including the 6 that Phase 03's re-homing left behind.

The attic half was built at the start of Phase 05: move loop, `MANIFEST.tsv` for restore, collision
suffixing rather than overwrite, no delete call anywhere in the resolver. 16 bats cases green,
prune-report's 8 still green after sharing one walk between the two modes.

Then the mandatory adversarial pass ran against it, and it did not survive.

## The fact that decides it

**"Not in the registry" is not the same claim as "stale", and the gap is where the consumer lives.**

The registry answers exactly one question: *what did the last sync install?* Attic needed a
different one: *is this file ours to move?* Those come apart in a way that is not recoverable by
being more careful:

```
$ T=$(mktemp -d); sync-to-project.sh $T --products council     # FRESH install, valid registry
$ printf '# my own command\n' > $T/.claude/commands/deploy-staging.md
$ node arc-products.mjs --attic --target $T
moved    .claude/commands/deploy-staging.md  ->  .claude/attic/2026-07-19/...
$ ls $T/.claude/commands/deploy-staging.md
GONE
```

A file the consumer wrote themselves is unowned **by definition** — arc never installed it, so it
can never be in the registry. Their `/deploy-staging` command disappears at the next session start;
a hand-written `PreToolUse` guard would simply stop firing, with no error.

**This was reproduced on a fresh install carrying a valid registry.** It is therefore not
old-install drift, and no amount of registry coverage on new consumers fixes it — the initial
hypothesis when this was investigated, and a wrong one.

A second, independent case: a full sync followed by `sync-to-project.sh T --products council`
rewrites the registry from six products to two, while every sync path stays additive and deletes
nothing. 48 working arc files — `/arc-ship`, `/arc-qa`, `/arc-commit` — become "unowned" and would
be quarantined by an install the consumer performed, not an uninstall.

## The demand, measured

| Consumer | Stale files |
|---|---|
| venturemind | 21 |
| Opportunity-Scout | 0 (clean install) |
| every other | none — arc has no other consumers yet |

One repository, 21 files, and its owner is the person who would run the command. Moving them by
hand is a ten-minute job that needs no feature at all.

## Options considered

1. **Ownership ledger** — an append-only record of every path arc has ever written to a target,
   with content hashes, so ownership is provable rather than inferred. Pros: fixes the whole class,
   including the Phase-04 bug where sync clobbered a consumer's `settings.json`. Cons: it requires
   changing the **sync write path** — the most golden-gated, most load-bearing code in the repo,
   which every consumer depends on — in order to serve a cleanup tool with one user. Estimated 4–6
   days against a 0.5-week appetite for all three Phase-05 strands combined. Bending the core for a
   peripheral feature.
2. **Explicit-path attic** — drop auto-detection; the operator names what to quarantine, with
   `--prune-report` as the discovery step. Pros: the consumer-file bug becomes structurally
   impossible, ~30 lines, core untouched. Cons: still ships a feature with one known user, and
   still spends the phase's remaining appetite on the strand with the least demand.
3. **Scope-cut REQ-11.** Pros: no live bug exists, because the dangerous code was never merged; the
   phase's appetite goes to the two strands with real demand (docs rewrite, TRIAL promotions).
   Cons: REQ-11 becomes scope-cut history rather than a delivered capability, and venturemind's 21
   files stay where they are until moved by hand.

## Decision

**Option 3.** REQ-11 moves to `dropped` — the plan lint's vocabulary for a scope cut, which its own
comment defines as *"scope-cut HISTORY — never deleted"*. Cut from this cycle, not abandoned: the
revisit triggers below are the path back. `--prune-report` remains as shipped: read-only, and the
right tool for the problem that actually exists — making stale files visible.

This is not the bug being too hard to fix; option 2 fixes it in half a day. It is that the feature
does not yet have a user, and arc's own rule is *build nothing before its trigger*. The adversarial
pass did its job: it converted "ship the attic" into "find out whether the attic is worth shipping,"
and the answer, today, is no.

**Trigger to revisit — any ONE of:**
- a consumer arc does **not** own reports stale files it cannot clean up by hand, **or**
- ≥3 consumers carry stale files (hand-cleaning stops scaling), **or**
- a second bug lands in the same class as the Phase-04 `settings.json` clobber — arc overwriting
  or discarding something it did not install. That is the ledger's real trigger, and it is about
  sync safety, not about the attic.

## Consequences

- REQ-11's row in `PLAN.md` moves to `dropped` with a pointer here. The row is **not deleted** —
  a scope-cut requirement stays visible, per the plan's own rule.
- **REQ-12 is added.** Dropping REQ-11 left Phase 05 with no live requirement, which the plan lint
  rejects ("every phase >0 serves a live REQ") — correctly, since a phase with no REQ has nothing
  to close against. The docs rewrite and the TRIAL promotions were always the phase's real content;
  they simply had no measurable row of their own while attic was carrying the phase.
- `phases/phase-05-spec.md` drops its two attic exit criteria; the phase closes on the docs rewrite,
  the TRIAL→FAIL promotions and the retro.
- ADR-0020's decision (split REQ-10, report half early) is **unaffected and was correct** — the
  report shipped, found 21 real files, and remains the useful half. Only its Phase-5 placement of
  the attic half is superseded here.
- `--prune-report` gains one honest line of output. It calls consumer-authored files "unowned",
  which is true but reads as a verdict; the note says plainly that the list includes files arc did
  not install, and that not everything in it is stale. **This is the only live defect the whole
  investigation produced** — everything else was in unmerged code.
- The implementation and its 16 hostile-input tests are preserved at `e2b3646` on
  `feat/arc-phase-05-attic`. If the trigger fires, the starting point is a half-day of adaptation,
  not a rebuild — and the adversarial findings behind this decision are in the appendix below
  rather than waiting to be rediscovered.
- venturemind's 21 stale files: moved by hand, no tooling.

## Appendix — what the adversarial pass found

Three lenses (data-loss, hostile-input, twin-drift) against the built implementation. The two
blockers below are the decision; the rest were fixed in the spike before it was cut, and are listed
so a future attempt does not pay for them twice. All were reproduced, not reasoned about.

**Blockers — why the feature was cut**

1. **Consumer-authored files are unowned by definition.** A fresh install with a valid registry;
   `deploy-staging.md` and `my-reviewer.md` written by the consumer; both quarantined. No registry
   coverage fixes this, because arc never installed them and so can never list them.
2. **A narrowing `--products` sync orphans working files.** Full sync (6 products) then
   `--products council` rewrites the registry to 2 while every file stays on disk and working.
   48 live arc commands become "unowned" — an install the consumer performed, not an uninstall.

**Fixed in the spike, and worth keeping if this is ever revived**

3. A symlink/junction is one directory entry but `renameSync` relocates the whole subtree behind
   it — the report shows one line, the operator loses a tree. (Windows junctions need no elevation;
   verified.) Fixed: reported distinctly, never moved.
4. `renameSync` silently overwrites its destination, so the same path atticed twice in one day
   destroys the first copy — data loss with no delete call anywhere. Fixed: collision suffixing.
5. A control character in a filename forges lines in the very report the move is approved from
   (legal on the Linux/macOS CI legs). Fixed: report quotes them, mutation refuses.
6. `.claude/attic` existing as a regular *file* crashes `mkdirSync`. Fixed: skip-listed.
7. Windows MAX_PATH — the attic prefix adds ~25 chars, and the failure lands mid-run on a box
   without LongPathsEnabled (this dev box has it on, which is why it would not have been noticed).
   Fixed: length pre-check before the first move.
8. Fail-fast on a locked file deadlocks every later run at the same file. Fixed: collect failures,
   continue, exit 3.
9. `attic` was on no sync exclusion list, so arc's own attic could be copied into a consumer and
   overwrite theirs. Fixed in both twins.

**Not fixed, and the reason the cut is the right call rather than a delay**

10. "Report before mutate" was a `console.log` in the same process as the moves — one mistyped flag
    mutates immediately. A confirm gate closes it, but nothing closes blocker 1 short of an
    ownership model that changes the sync write path. That is where the cost stopped being
    proportionate to a feature with one user.
