# Phase 02 evidence — the renderer, and the four documents resolved

Lane `docs`, Cycle 17. PR #280, merged as `88bd23de`. Approved to start by `decision.recorded`
`01M3CFQQSDCPNQNPKFTX7K9Z8F`.

## What shipped

- `wiki-build` renders `docs/wiki/`: an index and one page per entity — 131 pages across 17
  products, 17 lanes, 10 processes, 15 ADR bands, 28 commands, 30 agents, 7 rules and 7 gates,
  with **1891 relative links, every one resolving** (`demo.txt`). Every file starts with the
  do-not-edit banner; every page shows its hand-written narrative or a visible "narrative pending".
- `wiki-build --check` is the dirty-diff gate (REQ-06); `tests/docs-render.bats` also re-renders
  into scratch and diffs with `diff -r`, so the check does not certify itself.
- REQ-08: `docs/how-it-works.md`, `docs/how-arc-works-simple.md`, `docs/usermanual.md` and
  `docs/blueprint.md` moved whole to `docs/archive/` and stubbed in place (7 lines each, absolute
  links, because three of them sync into venture repos). The strategy file map and `CLAUDE.md` say
  so in the same PR. `inbound-references.md` lists the 68 referring files; none needed an edit.
  The first of them, `how-it-works.md`, still said arc "ships as six products" — there are 17.

## A design call made at build

Lane pages show **status and cycle only**. Phase, burn and blocked-on change every few hours; on a
committed, CI-checked page they would have turned every lane's tracker edit into a wiki
regeneration — a tax on every lane — for information the face already shows live (ADR-1509).
`wiki.json` is not committed for the same reason; `--json` produces it on demand.

## CI (read per job)

| Run | Head | Result |
|---|---|---|
| `36159823635` | `932b370f` | RED, and rightly: the DOC-A scanner had lost sync on a regex literal and never scanned the renderer; and a test link was relative to the wrong directory |
| `36163225987` | `fd12c825` | **19 of 19 success**, head SHA confirmed |
| `36165625324` | `88bd23de` (merged `main`) | dispatched to verify the merged tree |

## Adversarial pass (one round, per the owner's lean rule)

The full diff could not be attacked: an ADR file name (`0103-risk-checkpoints-...`) reads as an
`sk-` key and every generated page links it, so the secret guard stopped the input. The owner
approved attacking a code-only view (scripts, tests, CLAUDE.md, trackers).
`attack-e5730ee-r1-boundary.json`: 13 findings, 7 medium fixed, 6 low to the debt ledger. The
logic surface did not run (transport), the standing gap.

## Shard weights (Windows shard of `36163225987`)

`docs-render.bats` 46 s (new) · `docs-extract.bats` 49 s · `docs-coverage.bats` 35 s.
