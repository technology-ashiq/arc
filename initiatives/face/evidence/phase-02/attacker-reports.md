# Phase 02 — attacker reports and dispositions

Two fresh agents, launched together against commit `335e4d28`, each told it did not write the
code, each given `initiatives/face/fixed-defects.md` with the instruction to check every line of it
in every file it attacked, each in its own private scratch directory, neither allowed to run bats, a
suite, an install or a build, and every scaffold run pointed with `--root` at a copy in its own
scratch directory. One attacked the decision logic (face-pure, registry.mjs, face-coverage's module
half, the tests that protect them); one attacked the shell/OS boundary (the scaffold, the tree walks,
the bats parsers, the render line). Neither wrote to the repo.

Disposition key: **FIXED** (code changed, a check pins it, a line added to fixed-defects.md) ·
**SCOPE** (the gate declares it does not see this, and why) · **DEBT** (a row in debt-ledger.md).

## Attacker 1 — decision logic

10 findings: 4 HIGH, 3 MEDIUM, 3 LOW. Every one confirmed by a probe (a scratch `.mjs` importing the
lint's exports, and node executing the same input to show it runs).

| # | finding | severity | disposition |
|---|---|---|---|
| H1 | Unicode whitespace (EM SPACE, IDEOGRAPHIC SPACE) merged tokens: `import<EM>React` was one name, `<EM>typeof` and `<EM>in` vanished | HIGH | FIXED — whitespace is JavaScript's own `\s` class and identifiers are ECMAScript ID_Start/ID_Continue (plus ZWNJ/ZWJ); checks: import and export after a Unicode space, typeof and in after an em space |
| H2 | a percent-encoded relative specifier (`../../../lib/%2e%2e/%2e%2e/pkg/evil.mjs`): the lint followed a decoy, node loaded a file outside face/src | HIGH | FIXED — `%` in a relative specifier is refused; check |
| H3 | a lookup keyed by data after `}` (`{ open: 'Open' }[f.state]`) and a computed destructuring key were not lookups | HIGH | FIXED — the `[` rule reads `}` as an indexable end, and a computed key in an object literal or pattern is a lookup; three checks |
| H4 | the gate and the browser classified an exempted ADR-1327 extra differently (gate fine, browser orphan) | HIGH | FIXED — `attachModules` takes the exempted ids face-coverage's `moduleFindings` returns; module-frame proves agreement with a row AND without one, on the real contracts |
| M1 | deleting the standalone `!` rule left the suite green | MEDIUM | FIXED — `disabled={!f.isEmpty}` passes, `disabled={!f.count}` FAILs |
| M2 | `f.default < f.x > (...) < /f.x>` opened a JSX element after a property spelled `default`, hiding a comparison and a ternary | MEDIUM | FIXED — a name after `.`/`?.` is a property token whatever it spells, for the lexer's operand position, the call rule and the lookup rule; checks for `f.default <` and `f.new(x)` |
| M3 | the "no shell file names a room" scan read a hand-kept list | MEDIUM | FIXED — every source file under face/src is scanned except room-owned paths excluded BY NAME with their reasons; checks that each excluded path exists and each core shell file is included |
| L1 | `onX` member calls passed on any receiver (`f.onCompute(x)`) | LOW | FIXED — `onX` only through `ctx` or `props`; checks both ways |
| L2 | an IIFE was not a call | LOW | FIXED — a body's `}` followed by `(` is a call; check |
| L3 | `'#inbox'` (hash, no slash) evaded the shell scan; concatenation (`'in' + 'box'`) evades it | LOW | FIXED for the hash form (check) · SCOPE for concatenation, which the scan declares it does not read |

Held (reported by the attacker): every literal branch, operator and keyword in ASCII; `.filter`,
`Math`, imported helpers and hooks not from react; `require`, `eval`, `new Function`, `import.meta`,
computed `import()`; React, three, vite, `.css`, `.js`, `.tsx`, alias, absolute and `file://` imports;
transitive imports two hops deep; import cycles; backslash, query, fragment and empty segments; case
mismatch and symlinked imports; NUL bytes; bad names; device names; fifth files; empty rings; and
registry orphan, misplaced, template, duplicate, manifest, bad-key and incomplete problems.

## Attacker 2 — shell/OS boundary

11 findings: 3 HIGH, 3 MEDIUM, 5 LOW. Eight confirmed by probes on Windows 11 (Node 24), three reasoned.

| # | finding | severity | disposition |
|---|---|---|---|
| H1 | a throw in `treeModules` (an unreadable ring, a name the OS cannot stat) crashed the scaffold after writing: no rollback, no RED line, a half-module left | HIGH | FIXED — the whole walk is one try that returns UNREADABLE with the error code; the scaffold's proof is inside try/catch, so any throw is RED with rollback; POSIX check: a module folder unreadable mid-proof is RED and the scaffold removed |
| H2 | a rollback crashed on a file Windows held open, leaving three of four files | HIGH | FIXED — `rmSync` retries, and `rollback` returns what would not go so the RED line names it instead of throwing; POSIX check: a folder that cannot be removed is returned by name |
| H3 | a `//` comment ended only at LF: `// x<U+2028>import React` (or CR, or U+2029) hid a statement node runs | HIGH | FIXED — every line terminator ends a comment, sets the statement-break flag, and ends a regex; a name never swallows one; checks for U+2028, U+2029 and a bare CR in a View and a fold |
| M1 | the scaffold wrote through a junction/symlink on the ring folder or on `face/src`, GREEN with the module outside `--root` | MEDIUM | FIXED — `face`, `face/src`, the modules root and the ring folder are lstat'ed (a link is REFUSED) and realpath-contained in `--root` before any write; checks with a junction (Windows) or symlink for the ring and for face/src, asserting nothing landed through the link |
| M2 | an import climbing above face/src and back down misspelled (`../../../../SRC/lib/x.mjs`) passed on Windows, read as "outside" on APFS | MEDIUM | FIXED — every segment the specifier names is spelled against the disk from the importer's own folder, before the containment check, so every OS gives the same finding; check |
| M3 | a served id `constructor` drew as a module (plain-object lookup) | MEDIUM | FIXED — null-prototype attachment and `Object.hasOwn`; the `RING_LEDE` twin in rooms.mjs; checks for constructor, toString, __proto__, hasOwnProperty and a ring named constructor |
| L1 | a modules root that is a file was an unhandled throw at exit 1 | LOW | FIXED — exit 2 with "is not a directory"; check |
| L2 | an exemption list with a BOM became "no exemption row" — a false refusal | LOW | FIXED — an unreadable extras or exemption list is exit 2 naming the file; check |
| L3 | a folder name carrying a newline could print a forged verdict line | LOW | FIXED — `oneLine` on every finding and report line in face-pure, face-coverage and the scaffold; POSIX check that a forged `face-pure: modules=99` never starts a line |
| L4 | the render verdict counted module FOLDERS, so the first ADR-1327 exemption would turn the browser red while the gate stayed green | LOW | FIXED — `render_verdict` takes face-coverage's module-half line: attached = served − generic, and the generic rooms must equal the gate's by name and order; mutant control updated with an exemption and a reordered generic list |
| L5 | face-coverage called `process.exit()` before a parsed stdout line could drain | LOW | FIXED — `process.exitCode` everywhere in its entry |

Held (reported by the attacker): main guards through a wrong-case path; junctions reported as links
by both walks; every argument refusal (unknown flags, `--flag=value`, repeats, empties, `--root --x`,
three segments, backslashes, trailing dots or spaces, look-alikes, device names); case-variant
existing modules; a normal RED rollback removing exactly what it created; BOM and UTF-16 registries
at exit 2; wrong-case module file names flagged the same on every OS; NUL and UTF-16 module files;
CRLF lexing; every new `sed` anchored, `grep` exclusions by full path, `find`/`wc`/`uname` portable
across GNU, BSD and Git Bash; the render line's ids grammar-checked; nothing secret in the render line.

## Found by CI, not by an attacker

The first implementation run (arc-ci `35224182573` on `335e4d28`) was green on every suite this
phase added and red on one step: `tsc --noEmit` refused the nine `ops.mjs` files
(`TS7005: Variable 'ops' implicitly has an 'any[]' type`). Fixed with a JSDoc type in every
`ops.mjs` and in the scaffold template.
