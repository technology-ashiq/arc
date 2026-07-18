#!/usr/bin/env bats
# Phase 04 -- arc-settings-merge.mjs.
#
# Found by dogfooding into a REAL consumer (venturemind, 2026-07-19): the sync copies
# .claude/settings.json wholesale, so a consumer's per-gate overrides were silently wiped
# and their gates went warn -> block. arc's OWN doc string in that file tells users to add
# those keys, and then the next sync deletes them.
#
# Ownership rule this encodes: arc owns the machinery (hooks, statusLine, its own `//` docs);
# the consumer owns their `arc` block values and anything arc does not ship.
bats_require_minimum_version 1.5.0
load 'test_helper'

M="$ARC_ROOT/.claude/scripts/core/arc-settings-merge.mjs"

setup() { WORK="$(mktemp -d)"; cd "$WORK" || return 1; }
teardown() { [ -n "${WORK:-}" ] && rm -rf "$WORK" 2>/dev/null || true; }

_arc_json_get() { node -e '
  const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  const v=process.argv[2].split(".").reduce((o,k)=>o==null?o:o[k], j);
  process.stdout.write(v===undefined?"ABSENT":typeof v==="object"?JSON.stringify(v):String(v));
' "$1" "$2"; }

@test "merge: a consumer's per-gate override survives (the venturemind bug)" {
  cat > arc.json <<'EOF'
{ "arc": { "//profile": "docs say: add coverageMode here to override", "profile": "standard" } }
EOF
  cat > consumer.json <<'EOF'
{ "arc": { "profile": "standard", "coverageMode": "warn", "docsGate": "warn" } }
EOF
  run bash -c "node '$M' arc.json consumer.json > merged.json"
  [ "$status" -eq 0 ]
  [ "$(_arc_json_get merged.json arc.coverageMode)" = "warn" ]
  [ "$(_arc_json_get merged.json arc.docsGate)" = "warn" ]
}

@test "merge: arc's new keys still land (the consumer is not frozen in time)" {
  cat > arc.json <<'EOF'
{ "arc": { "profile": "standard", "scanMode": "block" }, "statusLine": { "command": "NEW" } }
EOF
  cat > consumer.json <<'EOF'
{ "arc": { "profile": "standard", "coverageMode": "warn" }, "statusLine": { "command": "OLD" } }
EOF
  run bash -c "node '$M' arc.json consumer.json > merged.json"
  [ "$status" -eq 0 ]
  [ "$(_arc_json_get merged.json arc.scanMode)" = "block" ]     # arc's new key arrives
  [ "$(_arc_json_get merged.json arc.coverageMode)" = "warn" ]   # consumer's override kept
  [ "$(_arc_json_get merged.json statusLine.command)" = "NEW" ]  # machinery is arc's
}

@test "merge: permissions.allow is a UNION -- consumer entries are not deleted" {
  cat > arc.json <<'EOF'
{ "permissions": { "allow": ["Bash(git:*)", "Bash(arc-new:*)"] } }
EOF
  cat > consumer.json <<'EOF'
{ "permissions": { "allow": ["Bash(git:*)", "Bash(their-own-tool:*)"] } }
EOF
  run bash -c "node '$M' arc.json consumer.json > merged.json"
  [ "$status" -eq 0 ]
  [[ "$(_arc_json_get merged.json permissions.allow)" == *"their-own-tool"* ]]  # theirs kept
  [[ "$(_arc_json_get merged.json permissions.allow)" == *"arc-new"* ]]         # arc's added
  [ "$(node -e 'const a=require("./merged.json").permissions.allow;console.log(a.length===new Set(a).size)')" = "true" ]
}

@test "merge: a top-level key only the consumer has is preserved" {
  echo '{ "arc": { "profile": "standard" } }' > arc.json
  echo '{ "arc": { "profile": "standard" }, "theirCustomBlock": { "k": 1 } }' > consumer.json
  run bash -c "node '$M' arc.json consumer.json > merged.json"
  [ "$status" -eq 0 ]
  [ "$(_arc_json_get merged.json theirCustomBlock.k)" = "1" ]
}

@test "merge: arc's // doc strings are refreshed, not frozen at the consumer's stale copy" {
  echo '{ "arc": { "//profile": "NEW GUIDANCE", "profile": "standard" } }' > arc.json
  echo '{ "arc": { "//profile": "ANCIENT GUIDANCE", "profile": "standard" } }' > consumer.json
  run bash -c "node '$M' arc.json consumer.json > merged.json"
  [ "$status" -eq 0 ]
  [ "$(_arc_json_get merged.json 'arc.//profile')" = "NEW GUIDANCE" ]
}

@test "merge: unparseable consumer settings fails closed (exit 2, no partial output)" {
  echo '{ "arc": { "profile": "standard" } }' > arc.json
  printf '{ this is not json' > consumer.json
  run bash -c "node '$M' arc.json consumer.json > merged.json"
  [ "$status" -eq 2 ]
  [ ! -s merged.json ]                       # never emit a half-merged settings file
  [[ "$output" == *"consumer"* ]]            # and say which file was bad
}

@test "merge: no consumer file (fresh install) emits arc's version verbatim" {
  echo '{ "arc": { "profile": "standard" } }' > arc.json
  run bash -c "node '$M' arc.json /no/such/file.json > merged.json"
  [ "$status" -eq 0 ]
  [ "$(_arc_json_get merged.json arc.profile)" = "standard" ]
}

@test "merge: reports what it preserved, on stderr, before mutating (non-negotiable)" {
  echo '{ "arc": { "profile": "standard" } }' > arc.json
  echo '{ "arc": { "profile": "standard", "coverageMode": "warn" } }' > consumer.json
  run bash -c "node '$M' arc.json consumer.json 2>&1 >/dev/null"
  [ "$status" -eq 0 ]
  [[ "$output" == *"coverageMode"* ]]
}
