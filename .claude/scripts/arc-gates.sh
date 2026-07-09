#!/usr/bin/env bash
# arc-gates.sh -- generic gate-runner (Phase 02). Reads arc.gates.yaml and runs
# the gates for a tier. ALL gate logic lives here + in the yaml; hooks just call
# this. No yq dependency: a strict built-in awk parser handles the flat schema, so
# enforcement never silently dies because a YAML tool is missing (pre-mortem #2).
#
# Usage:
#   arc-gates.sh --tier hook            # run hook-tier gates (default)
#   arc-gates.sh --tier ci              # run ci-tier gates
#   arc-gates.sh --list                 # print parsed gates as JSONL (no run)
#   arc-gates.sh --gates-file <path>    # override arc.gates.yaml
# Exit: 0 = all gates pass / warn-only, 2 = at least one block-mode gate failed.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
GATES_FILE="${ARC_GATES_FILE:-$ROOT/arc.gates.yaml}"

# --- strict YAML parser for the flat gates schema -> JSONL (one gate per line) ---
_parse_gates() {
  awk '
    function esc(s){ gsub(/\\/,"\\\\",s); gsub(/"/,"\\\"",s); return s }
    function flush(){ if(have){
      print "{\"name\":\""     esc(o["name"])     "\",\"check\":\""   esc(o["check"]) \
            "\",\"mode\":\""    esc(o["mode"])     "\",\"tier\":\""    esc(o["tier"]) \
            "\",\"runtime\":\"" esc(o["runtime"])  "\",\"evidence\":\"" esc(o["evidence"]) "\"}"
      delete o; have=0
    }}
    { line=$0; sub(/\r$/,"",line)
      t=line; sub(/^[ \t]+/,"",t)
      if(t=="" || substr(t,1,1)=="#" || t=="gates:") next
      if(match(line,/^[ \t]*-[ \t]*name:[ \t]*/)){ flush(); o["name"]=substr(line,RSTART+RLENGTH); have=1; next }
      if(match(line,/^[ \t]+[A-Za-z_]+:[ \t]*/)){
        k=line; sub(/:[ \t]*.*$/,"",k); sub(/^[ \t]+/,"",k)
        v=line; sub(/^[ \t]+[A-Za-z_]+:[ \t]*/,"",v)
        o[k]=v; have=1; next
      }
    }
    END{ flush() }
  ' "$1"
}

tier="hook"; do_list=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tier)       tier="${2:-hook}"; shift 2;;
    --list)       do_list=1; shift;;
    --gates-file) GATES_FILE="${2:-}"; shift 2;;
    -h|--help)    grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "arc-gates: unknown arg: $1" >&2; exit 1;;
  esac
done

if [ ! -f "$GATES_FILE" ]; then
  echo "arc-gates: SKIPPED (no gates file at $GATES_FILE) -- enforcement advisory" >&2
  exit 0
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "arc-gates: SKIPPED (jq not installed) -- enforcement advisory" >&2
  exit 0
fi

gates_jsonl="$(_parse_gates "$GATES_FILE")"

if [ "$do_list" -eq 1 ]; then printf '%s\n' "$gates_jsonl"; exit 0; fi

cd "$ROOT" || exit 0
blocked=0; ran=0
while IFS= read -r g; do
  [ -n "$g" ] || continue
  name="$(printf '%s' "$g"  | jq -r '.name')"
  check="$(printf '%s' "$g" | jq -r '.check')"
  gmode="$(printf '%s' "$g" | jq -r '.mode')"
  gtier="$(printf '%s' "$g" | jq -r '.tier')"
  [ "$gtier" = "$tier" ] || continue
  if [ -z "$name" ] || [ -z "$check" ]; then echo "arc-gates: skipping malformed gate: $g" >&2; continue; fi
  if [ "$gmode" = "off" ]; then echo "arc-gates: [$name] off -- skipped" >&2; continue; fi

  ran=$((ran+1))
  bash -c "$check" 1>&2; rc=$?

  if [ "$rc" -eq 0 ]; then echo "arc-gates: [$name] pass" >&2; continue; fi
  # gate failed -> resolve effective severity
  eff="$gmode"
  [ "$gmode" = "profile" ] && { [ "$rc" -eq 2 ] && eff="block" || eff="warn"; }
  case "$eff" in
    block) echo "arc-gates: [$name] FAIL -> BLOCK (rc=$rc)" >&2; blocked=1;;
    *)     echo "arc-gates: [$name] fail -> warn (rc=$rc)" >&2;;
  esac
done <<< "$gates_jsonl"

echo "arc-gates: tier=$tier ran=$ran blocked=$blocked" >&2
[ "$blocked" -eq 1 ] && exit 2 || exit 0
