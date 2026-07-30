#!/usr/bin/env bash
# arc-evidence.sh -- assemble & verify a committed evidence bundle per phase
# (Phase 02, ADR-0002/0006). "Evidence over assertion": /arc-phase-done writes
# docs/evidence/phase-NN/ with the proof a phase actually passed its gates, plus
# a manifest of sha256 hashes so the bundle is tamper-evident. A phase cannot
# close without a verifiable bundle.
#
# Usage:
#   arc-evidence.sh bundle <phase> [--test-log <file>] [--out <dir>] [--lane <name>]
#   arc-evidence.sh verify <phase> [--out <dir>] [--lane <name>]
# Exit: 0 ok | 2 verify failed (missing bundle or hash mismatch) | 1 usage error
#       3 lane ambiguous | 4 unknown lane | 5 invalid lane name  (ADR-0054)
#
# EVIDENCE IS LANE-SCOPED GOING FORWARD (ADR-0055/PORT-F): in lane-mode bundles land
# in initiatives/<lane>/evidence/phase-NN/. In root-mode the path stays
# docs/evidence/phase-NN/ exactly as before — and the pre-portfolio bundles already
# there are FROZEN as the sole canonical copy; nothing moves them. An explicit --out
# still wins over both, so callers with their own destination are unaffected.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/../core/common.sh"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

cmd="${1:-}"; shift || true
phase_arg="${1:-}"; shift || true
out_dir=""; test_log=""; lane_args=()
# Every value-taking flag asserts it HAS a value: `shift 2` with one arg left does not
# shift, and the loop spins forever at 100% CPU — a truncated command line would hang
# the gate instead of failing it.
_need_val() { [ "$1" -ge 2 ] || { echo "arc-evidence: $2 needs a value" >&2; exit 1; }; }
while [ $# -gt 0 ]; do
  case "$1" in
    --out)      _need_val $# --out;      out_dir="$2";        shift 2;;
    --test-log) _need_val $# --test-log; test_log="$2";       shift 2;;
    # Array, never a string: an unquoted "$lane_args" word-splits, so a crafted
    # --lane value could smuggle in `--for kickoff` (creating a lane from a surface
    # that must never create one) or `--print human` (silently redirecting the bundle
    # into the frozen root docs/evidence/).
    --lane)     _need_val $# --lane;     lane_args=(--lane "$2"); shift 2;;
    *) echo "arc-evidence: unknown arg: $1" >&2; exit 1;;
  esac
done

[ -n "$cmd" ] && [ -n "$phase_arg" ] || { echo "usage: arc-evidence.sh {bundle|verify} <phase> [--test-log f] [--out d]" >&2; exit 1; }
case "$phase_arg" in
  ''|*[!0-9]*) echo "arc-evidence: phase must be a number 0-99, got: $phase_arg" >&2; exit 1;;
esac
[ "${#phase_arg}" -le 2 ] || { echo "arc-evidence: phase must be a number 0-99, got: $phase_arg" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "arc-evidence: jq required" >&2; exit 1; }

# Resolve the workspace only when the caller did not name a destination outright, and
# only AFTER the invocation is known to be well-formed: a malformed call must still
# fail exactly the way it failed before this cycle (root-golden.bats pins those bytes).
if [ -z "$out_dir" ]; then
  lane_out="$(bash "$HERE/../core/lane-resolve.sh" --root "$ROOT" --for evidence ${lane_args[@]+"${lane_args[@]}"})"
  lane_code=$?
  if [ "$lane_code" -ne 0 ]; then
    bash "$HERE/../core/lane-resolve.sh" --root "$ROOT" --for evidence ${lane_args[@]+"${lane_args[@]}"} --print human >&2
    exit "$lane_code"
  fi
  lane_mode="$(printf '%s\n' "$lane_out" | sed -n 's/^mode=//p')"
  lane_stat="$(printf '%s\n' "$lane_out" | sed -n 's/^status=//p')"
  lane_name="$(printf '%s\n' "$lane_out" | sed -n 's/^lane=//p')"
  lane_track="$(printf '%s\n' "$lane_out" | sed -n 's/^tracker=//p')"
  lane_via="$(printf '%s\n' "$lane_out" | sed -n 's/^via=//p')"
  # Fail closed. An unparseable answer must never fall through to the root path:
  # docs/evidence/ is frozen pre-portfolio history, and quietly writing a lane's
  # bundle into it would corrupt the one canonical copy (ADR-0055).
  case "$lane_mode" in
    lane)
      [ "$lane_stat" = "ok" ] || { echo "arc-evidence: refusing to create lane '$lane_name' — lanes are born at /arc-kickoff only" >&2; exit 4; }
      echo "Selected lane: $lane_name (via $lane_via)"
      out_dir="$ROOT/$lane_track/evidence";;
    root)
      out_dir="$ROOT/docs/evidence";;
    *)
      echo "arc-evidence: could not read the lane resolver's answer — refusing to guess a destination" >&2
      exit 1;;
  esac
fi

nn="$(printf '%s' "$phase_arg" | tr -cd '0-9')"; nn="$(printf '%02d' "$((10#${nn:-0}))")"
dir="$out_dir/phase-$nn"

case "$cmd" in
  bundle)
    mkdir -p "$dir"
    sha="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
    when="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    fullsha="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"

    # Gather whatever artifacts exist -> copy into the bundle (degrade if absent).
    manifest_files="$(mktemp)"; : > "$manifest_files"
    _grab() { # <src-rel> <dst-name>
      local src="$ROOT/$1" dst="$2"
      [ -f "$src" ] || return 0
      cp "$src" "$dir/$dst"
      printf '{"name":"%s","sha256":"%s"}\n' "$dst" "$(arc_hash_file "$dir/$dst")" >> "$manifest_files"
    }
    _grab ".claude/state/scan/verdict.json"      "scan-verdict.json"
    _grab ".claude/state/scan/scan-result.sarif" "scan-result.sarif"
    _grab "coverage/coverage-summary.json"        "coverage-summary.json"
    # review ledger for HEAD (committed proof of which reviews passed)
    [ -f "$ROOT/.claude/state/reviews/$sha.txt" ] && cp "$ROOT/.claude/state/reviews/$sha.txt" "$dir/reviews.txt" \
      && printf '{"name":"reviews.txt","sha256":"%s"}\n' "$(arc_hash_file "$dir/reviews.txt")" >> "$manifest_files"
    # optional test-run log -> store its hash (proof tests ran on this commit)
    if [ -n "$test_log" ] && [ -f "$test_log" ]; then
      cp "$test_log" "$dir/test-output.log"
      printf '{"name":"test-output.log","sha256":"%s"}\n' "$(arc_hash_file "$dir/test-output.log")" >> "$manifest_files"
    fi

    jq -n --arg phase "$nn" --arg commit "$fullsha" --arg short "$sha" --arg when "$when" \
          --slurpfile files "$manifest_files" \
      '{phase:$phase, commit:$commit, short:$short, generated:$when, files:($files)}' \
      > "$dir/manifest.json"
    rm -f "$manifest_files"
    echo "arc-evidence: bundle -> $dir ($(jq '.files|length' "$dir/manifest.json") artifact(s))"
    ;;

  verify)
    [ -f "$dir/manifest.json" ] || { echo "arc-evidence: no bundle at $dir (phase not closed with evidence)" >&2; exit 2; }
    bad=0
    while IFS= read -r entry; do
      name="$(printf '%s' "$entry" | jq -r '.name')"
      want="$(printf '%s' "$entry" | jq -r '.sha256')"
      got="$(arc_hash_file "$dir/$name")"
      if [ -z "$got" ]; then echo "arc-evidence: MISSING $name" >&2; bad=1
      elif [ "$got" != "$want" ]; then echo "arc-evidence: TAMPERED $name" >&2; bad=1; fi
    done < <(jq -c '.files[]' "$dir/manifest.json")
    if [ "$bad" -eq 0 ]; then echo "arc-evidence: bundle verified ($dir)"; exit 0; else exit 2; fi
    ;;

  *) echo "usage: arc-evidence.sh {bundle|verify} <phase>" >&2; exit 1;;
esac
