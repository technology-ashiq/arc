#!/usr/bin/env bats
# Phase 00 -- the hostile corpus DRIVER. This file holds no attack of its own.
#
# It walks tests/fixtures/policy/hostile/INDEX, routes each fixture to the surface its family
# names, and asserts the recorded outcome. Adding an attack is therefore adding a fixture and one
# INDEX row -- never new test code, which is what stops the corpus quietly stopping growing.
#
# Two families, because the attacks are not all decidable at the same time:
#   static   -- a .yaml policy fed to `policy-lint`; expected outcome is exit 2.
#   runtime  -- a .json candidate fed to `authorizeAction`; expected outcome is a decision.
#
# The driver also asserts the corpus SIZE from the INDEX, so a fixture that is deleted or that
# stops being routed turns this file red instead of shrinking in silence.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

DIR="tests/fixtures/policy/hostile"

_rows() { # family -> file names, one per line
  cd "$ARC_ROOT" && awk -v fam="$1" -F'\t' '!/^#/ && NF>=3 && $2==fam { print $1 }' "$DIR/INDEX"
}

@test "the INDEX exists and every row it names is a file that exists" {
  cd "$ARC_ROOT"
  [ -f "$DIR/INDEX" ]
  local missing=""
  while IFS=$'\t' read -r f fam outcome rest; do
    case "$f" in \#*|"") continue ;; esac
    [ -f "$DIR/$f" ] || missing="$missing $f"
  done < "$DIR/INDEX"
  [ -z "$missing" ] || { echo "INDEX names files that do not exist:$missing"; false; }
}

@test "every fixture file on disk is named by the INDEX" {
  cd "$ARC_ROOT"
  local orphan=""
  for p in "$DIR"/*.yaml "$DIR"/*.json; do
    [ -e "$p" ] || continue
    local b; b="$(basename "$p")"
    grep -q "^$b	" "$DIR/INDEX" || orphan="$orphan $b"
  done
  [ -z "$orphan" ] || { echo "fixtures on disk with no INDEX row:$orphan"; false; }
}

@test "every static fixture is refused by policy-lint with exit 2" {
  cd "$ARC_ROOT"
  local n=0 bad=""
  while read -r f; do
    [ -n "$f" ] || continue
    n=$((n+1))
    run node .claude/scripts/hq/policy-lint.mjs "$DIR/$f"
    [ "$status" -eq 2 ] || bad="$bad $f(exit=$status)"
  done < <(_rows static)
  [ "$n" -ge 12 ] || { echo "only $n static fixtures -- the corpus shrank"; false; }
  [ -z "$bad" ] || { echo "static fixtures that were NOT refused:$bad"; false; }
}

@test "every runtime fixture reaches the decision its INDEX row records" {
  cd "$ARC_ROOT"
  run node --input-type=module -e '
    const P = await import("./.claude/scripts/hq/lib/policy/index.mjs");
    const fs = await import("node:fs");
    const dir = "tests/fixtures/policy/hostile";
    const rows = fs.readFileSync(dir + "/INDEX", "utf8").split("\n")
      .filter(l => l.trim() && !l.startsWith("#")).map(l => l.split("\t"))
      .filter(c => c[1] === "runtime");
    if (rows.length < 8) throw new Error("only " + rows.length + " runtime fixtures -- the corpus shrank");
    const bad = [];
    for (const [file, , expected] of rows) {
      const fx = JSON.parse(fs.readFileSync(dir + "/" + file, "utf8"));
      const r = P.authorizeAction(fx.action, { policy: fx.policy, events: fx.events || [] });
      if (r.decision !== expected) bad.push(file + " => " + r.decision + " expected " + expected);
    }
    if (bad.length) throw new Error(bad.join(" | "));
    console.log("runtime fixtures ok: " + rows.length);'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"runtime fixtures ok"* ]]
}

@test "no fixture is a silent duplicate of another" {
  cd "$ARC_ROOT"
  local dupes; dupes="$(awk -F'\t' '!/^#/ && NF>=3 { print $1 }' "$DIR/INDEX" | sort | uniq -d)"
  [ -z "$dupes" ] || { echo "duplicate INDEX rows: $dupes"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 6 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 6 -- a @test was silently dropped"
    false
  }
}
