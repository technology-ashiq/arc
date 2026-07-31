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

    # ADR-0060: never write over evidence another commit owns. The root-mode path is keyed
    # on the phase number alone and carries no cycle identity, so every cycle's phase-NN
    # lands in the same directory -- four different "close Phase 00" commits had already
    # done so before this refusal existed, each silently rewriting the previous manifest's
    # commit pointer. A same-commit re-run stays idempotent: closing a phase may re-bundle.
    # Fail CLOSED: a manifest that exists must positively identify THIS commit, or the
    # write is refused. An unreadable or commit-less manifest is not "unowned" -- it is the
    # case where ownership cannot be established, which is exactly when overwriting is
    # least safe. (Adversarial pass, 2026-07-31: the first cut read the commit with a `//
    # ""` fallback, so corrupt JSON produced an empty owner and sailed straight through.)
    if [ -f "$dir/manifest.json" ]; then
      owner="$(jq -r '.commit // ""' "$dir/manifest.json" 2>/dev/null || echo "")"
      if [ "$owner" != "$fullsha" ]; then
        owner_short="$(jq -r '.short // ""' "$dir/manifest.json" 2>/dev/null || echo "")"
        owner_when="$(jq -r '.generated // ""' "$dir/manifest.json" 2>/dev/null || echo "")"
        {
          echo "arc-evidence: REFUSING to bundle into $dir"
          if [ -n "$owner" ]; then
            echo "  that bundle belongs to commit ${owner_short:-$owner} (generated ${owner_when:-unknown})"
          else
            echo "  a manifest is already there but names no commit this run can read"
          fi
          echo "  this run is commit $sha — writing here would overwrite evidence that is not yours"
          echo "  bundle somewhere this cycle owns, e.g.:"
          echo "    arc-evidence.sh bundle $phase_arg --out docs/evidence/<cycle>"
        } >&2
        exit 3
      fi
    fi

    # Gather whatever artifacts exist -> copy into the bundle (degrade if absent).
    # Copying is all this section does; the manifest is built from the directory below,
    # so an artifact that lands here by any route is covered exactly once.
    manifest_files="$(mktemp)"
    _grab() { # <src-rel> <dst-name>
      local src="$ROOT/$1" dst="$2"
      [ -f "$src" ] || return 0
      cp "$src" "$dir/$dst"
    }
    _grab ".claude/state/scan/verdict.json"      "scan-verdict.json"
    _grab ".claude/state/scan/scan-result.sarif" "scan-result.sarif"
    _grab "coverage/coverage-summary.json"        "coverage-summary.json"
    # review ledger for HEAD (committed proof of which reviews passed)
    [ -f "$ROOT/.claude/state/reviews/$sha.txt" ] && cp "$ROOT/.claude/state/reviews/$sha.txt" "$dir/reviews.txt"
    # optional test-run log -> store its hash (proof tests ran on this commit)
    if [ -n "$test_log" ] && [ -f "$test_log" ]; then
      cp "$test_log" "$dir/test-output.log"
    fi

    # ADR-0060: the manifest describes the BUNDLE, not the writer. Hashing only what this
    # run collected is what let `verify` report success over seven files from another cycle
    # -- a gate that checks what it wrote cannot see contamination. Rebuild the list from
    # the directory itself, so anything present is either covered or a verify failure.
    # LC_ALL=C sort: byte order, so the manifest is identical on every OS.
    : > "$manifest_files"
    find "$dir" -type f | LC_ALL=C sort | while IFS= read -r f; do
      rel="${f#"$dir"/}"
      [ "$rel" = "manifest.json" ] && continue      # written after; cannot hash itself
      printf '{"name":"%s","sha256":"%s"}\n' "$rel" "$(arc_hash_file "$f")" >> "$manifest_files"
    done

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
    # ADR-0060: a file present but unlisted is the failure the old loop could not see --
    # it only ever walked the manifest, so anything the manifest omitted was invisible.
    # That is how a previous cycle's seven artifacts sat inside a "verified" bundle.
    while IFS= read -r f; do
      rel="${f#"$dir"/}"
      [ "$rel" = "manifest.json" ] && continue
      jq -e --arg n "$rel" 'any(.files[]; .name == $n)' "$dir/manifest.json" >/dev/null 2>&1 \
        || { echo "arc-evidence: UNLISTED $rel (in the bundle, absent from the manifest)" >&2; bad=1; }
    done < <(find "$dir" -type f | LC_ALL=C sort)

    if [ "$bad" -eq 0 ]; then echo "arc-evidence: bundle verified ($dir)"; exit 0; else exit 2; fi
    ;;

  *) echo "usage: arc-evidence.sh {bundle|verify} <phase>" >&2; exit 1;;
esac
