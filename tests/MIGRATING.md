# Migrating a lane from bats to node:test

The worker brief for ci Phase 03/04 (PLAN-ci D.3, ADR-2202, ADR-2207). One worker = one lane = one worktree =
one branch `migrate/<lane>` = one PR. You are trusted through `migrate-guard`, never by what you report.

## Start

```bash
bash .claude/scripts/core/migrate-worktree.sh <lane>     # creates the worktree + branch, prints the launch line
```

## The brief (paste-ready)

```
You are migrating ONE lane of arc's tests from bats to node:test. Lane: <lane>.
Read tests/MIGRATING.md, then tests/org/ as the worked example, then tests/<lane>-*.bats.
You MAY touch only: tests/<lane>/** (new), tests/<lane>-*.bats (delete at the end),
and fixtures via `git mv` into tests/<lane>/fixtures/ with no content change.
You MUST NOT edit source code, tests/_lib/, package.json, other lanes, or .github/.
If a test cannot be expressed without one of those, STOP and report. Do not work around it.
Every @test becomes a test with the SAME behaviour asserted. Never loosen an assertion, never
skip, never mark todo. If an old test was already broken, keep it failing and report it.
Write tests/<lane>/MIGRATED.md: old @test name -> new test name, one row each.
Write tests/<lane>/.count = the number of tests.
Time each file alone; a test over 20 s goes in its own file (files run in parallel, one file's tests in series).
Run: node --test "tests/<lane>/**/*.test.mjs" ; bats tests/<lane>-*.bats ; node .claude/scripts/core/migrate-guard.mjs <lane>
Push only when migrate-guard prints PASS. Open a PR titled "test(<lane>): migrate to node:test".
```

## Conventions

- One `tests/<lane>/<name>.test.mjs` per old `tests/<lane>-<name>.bats`; several one-test files may share one
  file (org: `fixture-run.test.mjs`) -- unless one is slow: org's 222 s became ~131 s when its four 30-83 s
  cases left the two files that ran them in series (`tests/org/MIGRATED.md`, pilot re-time). Keep every test NAME exactly as the `@test` string: the name map is then
  one name to itself, and the reviewer reads nothing into a rename.
- A lane-local helper the old files repeated goes in `tests/<lane>/<helper>.mjs` (org: `scratch.mjs`).
- Top-level `test(` calls only, one per line start: `migrate-guard`, `gate-parity` and the registered-test
  check all read them that way. No `describe` nesting.
- A file whose bats twin had an "every test in this file is registered" case keeps it:
  `const { test, registered, declared } = suite(import.meta.url)`.

## tests/_lib/arc.mjs

| helper | bats twin | use |
|---|---|---|
| `ARC_ROOT` | `$ARC_ROOT` | the repo root |
| `tmpDir(t, prefix)` | `$BATS_TEST_TMPDIR` | a fresh dir, removed when the test ends |
| `runNode(script, args, {env, cwd, input})` | `run node ...` | `{status, stdout, stderr, output}`; `output` is stdout+stderr, trailing newlines stripped |
| `runBash(script, args, opts)` | `run bash ...` | the same, for a bash script; args are argv, never interpolated |
| `copyTree(dest, paths, {optional})` | `cp -r "$ARC_ROOT/x" ...` | repo-relative files/dirs into a scratch tree |
| `mutant(t, src, edit)` / `mutate(path, edit)` | `sed` on a copy / in place | ASSERTS the bytes changed before returning |
| `sed(re, to)` | `sed 's/RE/TO/'` | an `edit` that applies to every matching line, as sed does |
| `treeManifest(root)` | `_arc_tree_manifest` | `path<TAB>sha256` per file, CR stripped, sorted |
| `suite(import.meta.url)` | the registered-test case | `{test, registered, declared}` |

`env` is merged over `process.env`: a bats `export X=...` in `setup()` becomes `{ env: { X } }` on every call.

## Translations that keep the assertion

| bats | node |
|---|---|
| `[ "$status" -eq 0 ] \|\| { echo "$output"; false; }` | `assert.equal(r.status, 0, r.output)` |
| `[[ "$output" == *"x"* ]]` | `assert.ok(r.output.includes("x"), r.output)` |
| `[[ "$output" == *"a"*"b"* ]]` | `assert.match(r.output, /a[\s\S]*b/)` -- ordered, as the glob was |
| `[[ "$output" == "x"* ]]` | `assert.ok(r.output.startsWith("x"), r.output)` |
| `[[ "$output" =~ re ]]` + `BASH_REMATCH` | `const m = r.output.match(/re/); assert.ok(m, ...)` |
| `grep -q 'x' file` | `assert.match(readFileSync(file, "utf8"), /x/m)` |
| `! grep -q ...` / `if ...; then false; fi` | `assert.ok(!...)` |
| `skip "..."` on one OS | make it run on every OS (org-judge: `symlinkSync(..., "junction")` on Windows), or STOP and report |

## Forbidden

`skip`, `todo`, `.only`, a weaker matcher than the bats line had, a test that asserts its output before it
asserts the command RAN, editing a shared file. `migrate-guard` fails the first three, the density guard the
fourth, and the reviewer's negative control (§6.4) the rest.

## MIGRATED.md

A header table (lane · harness · model · run date · old/new counts · dropped · timing), then:

```
| old @test | new test | file | note |
|---|---|---|---|
| org-card: an unknown key fails, naming it | org-card: an unknown key fails, naming it | card.test.mjs | from org-card.bats |
```

`new test` = `DROPPED` needs a reason in `note`. A `note` starting `density:` waives that test from the 90%
assertion-density floor and must say why the count fell.
