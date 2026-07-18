#!/usr/bin/env bash
# arc-evidence.sh -- assemble & verify a committed evidence bundle per phase
# (Phase 02, ADR-0002/0006). "Evidence over assertion": /arc-phase-done writes
# docs/evidence/phase-NN/ with the proof a phase actually passed its gates, plus
# a manifest of sha256 hashes so the bundle is tamper-evident. A phase cannot
# close without a verifiable bundle.
#
# Usage:
#   arc-evidence.sh bundle <phase> [--test-log <file>] [--out <dir>]
#   arc-evidence.sh verify <phase> [--out <dir>]
# Exit: 0 ok | 2 verify failed (missing bundle or hash mismatch) | 1 usage error
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/../core/common.sh"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

cmd="${1:-}"; shift || true
phase_arg="${1:-}"; shift || true
out_dir="$ROOT/docs/evidence"; test_log=""
while [ $# -gt 0 ]; do
  case "$1" in
    --out)      out_dir="${2:-}"; shift 2;;
    --test-log) test_log="${2:-}"; shift 2;;
    *) echo "arc-evidence: unknown arg: $1" >&2; exit 1;;
  esac
done
[ -n "$cmd" ] && [ -n "$phase_arg" ] || { echo "usage: arc-evidence.sh {bundle|verify} <phase> [--test-log f] [--out d]" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "arc-evidence: jq required" >&2; exit 1; }

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
