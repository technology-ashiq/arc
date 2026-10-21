# Phase 02 — spec-fidelity pass

The `spec-fidelity` agent read ONLY `initiatives/face/phases/phase-02-spec.md` and
`git diff 11b9655b..HEAD` (HEAD `b29c0404`), in a fresh context. Its verdict line stands as it filed
it: **`FIDELITY: drift found`**. Below, its findings in its own order, each with a disposition.

Disposition key: **FIXED** (changed, with a check) · **DECLARED** (a stated reading of the spec,
recorded here and in the slice's decision) · **DEBT** (a row in debt-ledger.md) · **OWNER** (the
owner's read at the phase close).

## Non-negotiables

| finding | disposition |
|---|---|
| Shell `.tsx` files carried decisions no node test reaches: the inbox chip's nested ternary (a failed read must never say "Inbox zero"), the mode dot's colour choice (violet is the non-real family's alone), the dock's plural | FIXED — `inboxChip`, `modeChip().dot` and `citationLine` in `face/src/lib/registry.mjs`, each held by `tests/face/module-frame.mjs`; the header and dock only render them |
| The nine carried module Views delegate to Cycle 15 renderers that still branch | DEBT — the carried-modules row (Phase 03 ring PRs replace each View and delete its renderer) |
| `App.tsx` attaches modules without the ADR-1327 exemption rows (latent while the list is empty) | DEBT — a new row: the rows reach the shell with the factory ring's first exemption; the lib already takes them and module-frame proves agreement with and without a row |
| v0.7 deltas the spec does not list (brain chip, day player, palette intents, dock chips) | DEBT + OWNER — rows already in debt-ledger.md; listed for the owner's read at close |

## Exit criteria

| # | finding | disposition |
|---|---|---|
| 3 | the reconcile is tested in `tests/face/module-frame.mjs`, not `tests/face/l3-logic.mjs` | DECLARED — a sibling suite run from the same `tests/face-l3.bats`, beside l3-logic, on every configuration; l3-logic carries the shell's `g` change. A separate file keeps the frame's arms and its RAN floor countable on their own |
| 4 | "conditions only on boolean fields fold() returns" was read by name alone: `const isBig = f.count` then `isBig &&`, and `ctx.room.hasTemplate &&`, passed | FIXED — a condition is a property read of at least two segments whose root is not `ctx` or `props`, and ANY boolean-named binding the View makes itself (a local, a parameter, a destructured or renamed key, an object key) is a finding; four checks |
| 4 | a View importing a Cycle 15 renderer moves every branch one file away | DEBT — the carried-modules row; face-pure reads `face/src/modules/**`, and a carried renderer is declared, not hidden |
| 6 | the scaffold proves the module half of face-coverage, not the whole gate | DECLARED + DEBT — the rest of the gate reads the whole repo, which a scaffold cannot change and a scratch copy does not carry; the whole gate runs on CI; a row records the pay-down |
| 6 | "what /api/rooms serves" is read as `rooms.generated.json` on disk | DECLARED — `apiRooms` in `.claude/scripts/hq/arc-dash.mjs` reads that file and serves its rooms and rings verbatim, adding only the `live` block; the smoke's expected set reads the same file (Phase 00) |
| 1 | shell prose named rooms in words ("the Map", "the Concepts room", "the Ask arc room") | FIXED — the palette, the no-such-room page and the dock no longer name a room; the quoted-id scan is derived over every non-room file under face/src |
| 7, 8 | CI per job, the attackers' freshness and the main-clone close are not visible in a diff | evidence — `ci-jobs.json`, `attacker-reports.md` and the close receipts |

## Scope beyond the spec

| item | disposition |
|---|---|
| `tsc --noEmit` in the build test; the WebGL guard; unmounting the face stage; the colour-literal lint reading the shell | DECLARED — each is a pay-down the debt ledger assigned to Phase 02 by name (rows: typecheck, WebGL guard, stage placement, lint roots) |
| face-coverage `process.exitCode` and one-line output | DECLARED — attacker fixes (shell/OS L3, L5), each in fixed-defects.md |
| the rail's dashed icon and module count | DECLARED — how the rail REPORTS a room with no module (ADR-1321) before it is opened; OWNER read |

## Behaviour, in the agent's words

"The face now opens in a v0.7-style workroom: a fixed room rail on the left, where the 24 rooms without
a module show a dashed icon, a top bar with the as-of date, data mode and a live inbox count, and a
text-only 'ask the company' box on every room. Rooms without a module now show a 'generic module'
note, and the animated face that used to sit behind the rooms in dark mode is gone."
