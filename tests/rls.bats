#!/usr/bin/env bats
# Phase 03 #4 -- RLS test harness. Every table in `public` must have RLS enabled,
# or the anon role reaches it through PostgREST (the #1 Supabase mistake). The
# gate introspects the DB, BLOCKS on any RLS-less table, and writes the generated
# per-table anon assertions as evidence. Needs a live DB, so tests use a FAKE SQL
# runner (ARC_RLS_SQL, reads a query on stdin) returning canned introspection.
bats_require_minimum_version 1.5.0
load 'test_helper'

GATE="$ARC_ROOT/.claude/scripts/review/rls-gate.sh"

# Fake SQL runner: the introspection query -> the table list in $FAKE_RLS_TABLES;
# anything else (reachability) -> "1", unless $FAKE_RLS_UNREACHABLE is set.
_fake_sql() {
  local d; d="$(mktemp -d)"
  cat > "$d/sql" <<'EOF'
#!/usr/bin/env bash
q="$(cat)"
case "$q" in
  *relrowsecurity*|*pg_class*) [ -n "${FAKE_RLS_TABLES:-}" ] && cat "$FAKE_RLS_TABLES" || true;;
  *) [ -n "${FAKE_RLS_UNREACHABLE:-}" ] || echo "1";;
esac
EOF
  chmod +x "$d/sql"; echo "$d/sql"
}

@test "rls-gate: a public table without RLS => BLOCK (exit 2)" {
  local sql; sql="$(_fake_sql)"; local od; od="$(mktemp -d)"
  local t; t="$(mktemp)"; printf 'users|t\npublic_data|f\n' > "$t"
  run env ARC_RLS_SQL="$sql" FAKE_RLS_TABLES="$t" bash "$GATE" --out-dir "$od"
  [ "$status" -eq 2 ]
  [[ "$output" == *"public_data"* ]]
  [[ "$output" == *"RLS"* ]]
  rm -f "$t"; rm -rf "$od" "$(dirname "$sql")"
}

@test "rls-gate: all public tables RLS-enabled => PASS (exit 0)" {
  local sql; sql="$(_fake_sql)"; local od; od="$(mktemp -d)"
  local t; t="$(mktemp)"; printf 'users|t\nprofiles|t\n' > "$t"
  run env ARC_RLS_SQL="$sql" FAKE_RLS_TABLES="$t" bash "$GATE" --out-dir "$od"
  [ "$status" -eq 0 ]
  run jq -r '.verdict' "$od/rls.json"
  [ "$output" = "pass" ]
  rm -f "$t"; rm -rf "$od" "$(dirname "$sql")"
}

@test "rls-gate: no public tables => PASS (nothing to check)" {
  local sql; sql="$(_fake_sql)"; local od; od="$(mktemp -d)"
  local t; t="$(mktemp)"; : > "$t"
  run env ARC_RLS_SQL="$sql" FAKE_RLS_TABLES="$t" bash "$GATE" --out-dir "$od"
  [ "$status" -eq 0 ]
  rm -f "$t"; rm -rf "$od" "$(dirname "$sql")"
}

@test "rls-gate: unreachable DB => SKIPPED, exit 0 (never crashes the hook)" {
  local sql; sql="$(_fake_sql)"; local od; od="$(mktemp -d)"
  run env ARC_RLS_SQL="$sql" FAKE_RLS_UNREACHABLE=1 bash "$GATE" --out-dir "$od"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED rls"* ]]
  rm -rf "$od" "$(dirname "$sql")"
}

@test "rls-gate: generates runnable per-table anon assertions as evidence" {
  local sql; sql="$(_fake_sql)"; local od; od="$(mktemp -d)"
  local t; t="$(mktemp)"; printf 'users|t\npublic_data|f\n' > "$t"
  env ARC_RLS_SQL="$sql" FAKE_RLS_TABLES="$t" bash "$GATE" --out-dir "$od" --exit-zero
  [ -f "$od/assertions.sql" ]
  run cat "$od/assertions.sql"
  [[ "$output" == *"SET ROLE anon"* ]]
  [[ "$output" == *"public.users"* ]]
  [[ "$output" == *"public.public_data"* ]]
  rm -f "$t"; rm -rf "$od" "$(dirname "$sql")"
}
