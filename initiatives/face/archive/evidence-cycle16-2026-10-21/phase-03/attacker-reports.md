# Phase 03, command ring — attacker reports and dispositions

Two fresh agents, launched together against commit `f87db315` (the ring's first implementation push),
each told it did not write the code, each given `initiatives/face/fixed-defects.md` with the
instruction to check every line of it in every file it attacked, each in its own private scratch
directory, neither allowed to run bats, a suite or an install, and neither writing to the repo. One
attacked the decision logic (the facts-bundle lint `face-facts.mjs`, and the read host's decisions in
`face/src/lib/registry.mjs`); one attacked the shell/OS boundary (the lint's walk, CLI and package
reads; the smoke's heading and NOT SERVED checks and their bats verdicts; the host effect loop in
`RoomFrame.tsx`). Both confirmed every hole by running the code on a construction; the decision-logic
attacker also built the constructions with Vite 8 to show the facts reach a bundle.

The code changed under both of them while they worked (the CI-red fixes for run 35241805573); each
re-ran its probes against the edited files, and every finding below holds on them.

Disposition key: **FIXED** (code changed, a check pins it, a line in fixed-defects.md) ·
**SCOPE** (the gate declares it does not see this, and why) · **DEBT** (a row in debt-ledger.md).

## Attacker 1 — decision logic

20 findings: 14 in the lint, 8 in the read host (two shared a root cause across files).

| # | finding | severity | disposition |
|---|---|---|---|
| 1 | an import after `x++`, `debugger` or `x!` invisible (face-facts and face-pure) | HIGH | FIXED — `importStatements` treats a reserved `import`/`export` as a statement start; three checks |
| 2 | literals outside object/array literals never counted (consts, calls, JSX text, a `[` after `}`) | HIGH | FIXED — file totals FAIL at 2000 leaves or 48000 characters, WARN at half; checks for 3000 constants and 2200 JSX text rows · SCOPE for a split under the thresholds (declared) |
| 3 | JSON.parse/atob saw only a direct literal | HIGH | FIXED — any literal text inside the call, through `globalThis`; `+` chains and templates judged as one text; three checks |
| 4 | a regex literal carried 39 KB of text | HIGH | FIXED — the regex source rides on its token and is judged; check |
| 5 | the stylesheet exception read through an export, a namespace import, single-quoted JSON | HIGH | FIXED — exported or namespace-reachable constants are text; single-quoted JSON members FAIL; two checks |
| 6 | a package-style name climbing through `..` (import, export-from, `import()`, CSS) | HIGH | FIXED — a `.`/`..`/empty segment refuses the name; two checks |
| 7 | `require()` and `import x = require()` had no rule | HIGH | FIXED — any `require(` FAILs; check |
| 8 | the fetch rule read only the literal's text (8 spellings) | MED | FIXED — plain `/api/` routes only, globals, parentheses, template heads, computed keys, `Request`, raw network APIs; six checks |
| 9 | a `.css` file had no blob or JSON rule | MED | FIXED — quoted CSS strings and JSON members judged; two checks |
| 10 | local package specs npm reads as files | MED | FIXED — `pathSpec` covers tarballs, drives, home, dot folders, case-folded protocols; five checks |
| 11 | vite `define` and `resolve.alias` inlined facts | MED | FIXED — `build-config` arm; two checks · SCOPE for a plugin written to inject facts (declared) |
| 12 | 15 pushes of 63-leaf objects dodged the WARN | LOW-MED | SCOPE — the declared split limit |
| 13 | a TypeScript return type made a function body a data literal (false FAIL) | MED | FIXED — a `{` is data only after a value position; check |
| 14 | Vite's worker `new URL`, `?worker` and a glob `import` option FAILed (false FAIL) | MED/LOW | FIXED — allowed for code inside face/src; check |
| R1 | a getter route: checked as one route, keyed and pathed as another | HIGH | FIXED — `snapshotRead` copies each read once; check |
| R2 | an unfrozen manifest widened its routes after attaching | HIGH | FIXED — a frozen manifest copy at attach; check |
| R3 | an unpaired surrogate id passed, then `readPath` threw during render | MED | FIXED — refused by `readProblem`; check |
| R4 | `dropReads` kept a lane read whose id is `act` | MED/LOW | FIXED — act keys are two-tuples; check |
| R5 | a `.` or `..` id climbed out of its path | LOW | FIXED — refused; check |
| R6 | an act on an undeclared route poisoned every later fold | MED | FIXED — `routeDeclared`; the host names it on the frame and stores nothing; check |
| R7 | `notServedOf` missed Map/Set and recursed through a getter | LOW | FIXED — data properties, Map/Set values, a depth cap; check |
| R8 | a later `poll: true` on a repeated read was dropped | LOW | FIXED — either copy's poll flag holds; check |

## Attacker 2 — shell/OS boundary

13 confirmed, 1 low item, 5 unconfirmed.

| # | finding | severity | disposition |
|---|---|---|---|
| 1 | a `browser` field mapped a clean file to a facts file | HIGH | FIXED — `browser`, `exports`, `imports`, `workspaces` FAIL; checks |
| 2 | the package imported itself through `exports` | HIGH | FIXED — as above |
| 3 | path installs past the regex; `overrides`, `workspaces` unread | HIGH | FIXED — `pathSpec`, `overrides`/`resolutions` walked, and the lockfile's link and path entries FAIL |
| 4 | `@import"x"` and `@import/**/"x"` passed | MED | FIXED — comments blanked, optional whitespace; two checks |
| 5 | vite `define`/`alias` | MED | FIXED — `build-config` |
| 6 | an NTFS alternate data stream hid data behind `a.mjs:facts.mjs` | MED (Windows) | FIXED — a colon in a relative specifier is refused; check · SCOPE: a stream is never walked (declared) |
| 7 | `..` from a linked parent resolved from the link path, not the real one | MED | FIXED — relative specifiers resolve from the real folder; a junction-based check with a counted skip |
| 8 | the heading check compared the door with itself; zero rooms checked passed `judge` | MED | FIXED — the harness passes the contract's frozen sentences and the door must agree; `judge` refuses zero checked; mutant checks |
| 9 | the NOT SERVED check could not fail on a count; an unread count became 0 | MED | FIXED — `panels=unread`; bats requires the browser's count to EQUAL the shipped rings' list rows |
| 10 | after a stamp or re-read the room sat on LOADING until the next poll | MED | FIXED — `dropAll` bumps the load effect |
| 11 | a poll in flight when the stamp landed brought back the stamped approval | MED | FIXED — a read epoch discards reads older than the drop |
| 12 | an as-of change during a stamp hid a stamp that landed | MED | FIXED — acts are not tied to the door's abort, and a door change keeps the act log |
| 13 | a re-cased climb `../SRC/lib/x.mjs` read differently per OS | MED | FIXED — `caseProblem` on every relative specifier; check |
| 14 | root-case checked only the last segment; `oneLine` left ESC; a BOM in package.json failed closed | LOW | FIXED for `oneLine` (face-pure and smoke) and the BOM · DEBT for deeper root-case segments (below) |
| U | Tailwind `@plugin`/`@config`; lockfile `file:` entries; macOS normalization; `--shots` unattacked | — | FIXED for `@plugin`/`@config`/`@source`/`@reference` and the lockfile · SCOPE for Unicode normalization of folder names (no macOS runner locally) · the `--shots` flag writes only evidence under a directory the owner names |

The link arm of `tests/face/face-facts.mjs` now falls back to a directory junction, which needs no
privilege on Windows, so it runs on every configuration instead of skipping there.

## What held (both)

Imports of JSON, `?raw`, attributes and `export *` from outside; glob queries; `new URL` of a data
file; env reads beyond MODE; fetch and EventSource of literals; JSON.parse of a literal; CSS climbs;
`data:` URLs; bundle names; read keys that cannot collide; `__proto__`/`constructor` routes and query
keys refused; `$` and `/?#%` encoded in ids; acts on GET routes refused; junctions under face/src FAIL
as links; device names, trailing dots and case-variant extensions FAIL as data files; `--root=PATH`
refused; harness children cannot print a verdict line; `doorText` equals `unescapeDoorText`.
