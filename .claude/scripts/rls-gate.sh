#!/usr/bin/env bash
# rls-gate.sh -- Row Level Security gate for Supabase/Postgres targets (Phase 03).
# Every table in `public` must have RLS enabled, or the anon role reaches it
# through PostgREST -- the #1 Supabase security mistake nobody else's gate checks.
# Introspects the DB, BLOCKS on any RLS-less table, and writes the generated
# per-table anon assertions as runnable evidence. Needs a live DB; degrades to
# SKIPPED (never crashes the hook) when the database is unreachable.
#
#   usage: rls-gate.sh [--out-dir <dir>] [--exit-zero]
#   exit: 0 = pass/skipped, 2 = block (unless --exit-zero)
#
# SQL access resolves first-hit:
#   ARC_RLS_SQL   -- a command reading a query on stdin, printing rows (tests/override)
#   native psql   -- with ARC_RLS_DBURL (a postgres connection string)
#   docker        -- exec psql inside the running supabase_db container
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=core/common.sh
. "$HERE/core/common.sh"
ROOT="${ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

out_dir="$ROOT/.claude/state/rls"; exit_zero=0
while [ $# -gt 0 ]; do
  case "$1" in
    --out-dir)   out_dir="${2:-}"; shift 2;;
    --exit-zero) exit_zero=1; shift;;
    *) shift;;
  esac
done
mkdir -p "$out_dir"

_supabase_db_container() { docker ps --format '{{.Names}}' 2>/dev/null | grep -m1 'supabase_db' || true; }

# _rls_sql <query> -> rows on stdout (empty on any failure -- degrade-safe).
_rls_sql() {
  local q="$1"
  if [ -n "${ARC_RLS_SQL:-}" ]; then printf '%s' "$q" | bash -c "$ARC_RLS_SQL" 2>/dev/null; return 0; fi
  if arc_have psql && [ -n "${ARC_RLS_DBURL:-}" ]; then
    printf '%s' "$q" | psql "$ARC_RLS_DBURL" -tAX 2>/dev/null; return 0
  fi
  local c; c="$(_supabase_db_container)"
  if [ -n "$c" ] && arc_have docker; then
    printf '%s' "$q" | docker exec -i "$c" psql -U postgres -d postgres -tAX 2>/dev/null; return 0
  fi
  return 0
}

# --- reachability: no DB => SKIPPED (never blocks the hook) -------------------
if [ -z "$(_rls_sql 'SELECT 1;' | tr -d '[:space:]')" ]; then
  arc_skip "rls (no reachable database -- start local Supabase: supabase start, or set ARC_RLS_DBURL)"
  exit 0
fi

# --- introspect public tables + their RLS-enabled flag -----------------------
INTRO="SELECT c.relname || '|' || (CASE WHEN c.relrowsecurity THEN 't' ELSE 'f' END) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1;"
tables="$(_rls_sql "$INTRO")"

assertions="$out_dir/assertions.sql"
verdict="$out_dir/rls.json"
: > "$assertions"
printf -- '-- arc RLS assertions: the anon role must be denied on every public table.\n' >> "$assertions"
printf -- '-- Run against local Supabase; each SELECT must return 0 rows (or error).\n\n' >> "$assertions"

total=0; exposed=0; exposed_list=""
while IFS='|' read -r tbl rls; do
  tbl="${tbl%$'\r'}"; rls="${rls%$'\r'}"
  [ -n "$tbl" ] || continue
  total=$((total + 1))
  {
    printf -- '-- %s (RLS %s)\n' "$tbl" "$([ "$rls" = t ] && echo enabled || echo DISABLED)"
    printf 'SET ROLE anon;\n'
    printf '  SELECT count(*) FROM public.%s;   -- expect: denied / 0 rows\n' "$tbl"
    printf 'RESET ROLE;\n\n'
  } >> "$assertions"
  if [ "$rls" != "t" ]; then
    exposed=$((exposed + 1)); exposed_list="$exposed_list $tbl"
    arc_log "rls: BLOCK -- public.$tbl has RLS DISABLED; the anon role can read/write it"
  fi
done <<EOF
$tables
EOF

if [ "$exposed" -gt 0 ]; then vd="block"; else vd="pass"; fi
printf '{"verdict":"%s","tables":%s,"exposed":%s,"exposed_tables":"%s"}\n' \
  "$vd" "$total" "$exposed" "$(echo $exposed_list)" > "$verdict"
arc_log "rls: verdict=$vd ($total public table(s), $exposed exposed) | assertions: $assertions"

if [ "$vd" = "block" ] && [ "$exit_zero" -eq 0 ]; then exit 2; fi
exit 0
