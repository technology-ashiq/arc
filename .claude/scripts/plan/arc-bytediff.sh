#!/usr/bin/env bash
# arc-bytediff.sh -- the Phase-3 byte-diff gate (ADR-0018 / REQ-07).
#
# Proves that a per-product `git mv` RELOCATED files without ALTERING them: each moved
# file's LF-normalized SHA-256 content + git file-mode (exec bit 100755/100644, symlink
# 120000) is byte-identical at its new path to what it was at the old path before the move.
# The move only relocated; it never edited. Ref-string updates in OTHER files (commands,
# hooks, manifests) are the checkpoint's declared content changes -- verified by the full
# bats suite + the reviewed golden regen -- and are NOT this gate's concern.
#
# git plumbing is used deliberately: filesystem exec bits are unreliable on Windows Git Bash,
# but git's tracked mode (100644 / 100755 / 120000-for-symlinks) is stable on every platform.
#
# Usage:
#   arc-bytediff.sh verify-move <old-path> <new-path> [--ref <gitref>]   # default ref: HEAD
#   arc-bytediff.sh verify-moves <pairs-file> [--no-complete]   # TAB-separated old<TAB>new lines
# Exit: 0 = content+mode preserved · 2 = altered (a real move-integrity failure) · 1 = usage.
set -uo pipefail

_sha() {
  if   command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  elif command -v shasum    >/dev/null 2>&1; then shasum -a 256 | cut -d' ' -f1
  else openssl dgst -sha256 | sed 's/.* //'
  fi
}
_lfsha() { tr -d '\r' | _sha; }                                   # LF-normalized content hash
_mode_ref() { git ls-tree "$1" -- "$2" 2>/dev/null | awk '{print $1}'; }   # <ref> <path> -> git mode
_mode_idx() { git ls-files -s -- "$1" 2>/dev/null | awk '{print $1}'; }     # <path> -> staged git mode
# <path> -> a tracked path differing from it ONLY by case, if one exists. git is case-sensitive
# even where the filesystem is not (core.ignorecase=true), so `[ -e ]` happily resolves a path
# git does not track -- and the mode lookup then returns empty and gets masked by the fallback.
_idx_case_variant() { git ls-files 2>/dev/null | awk -v p="$1" 'tolower($0)==tolower(p) && $0!=p {print; exit}'; }

cmd="${1:-}"; shift || true
case "$cmd" in
  verify-move)
    ref="HEAD"; old=""; new=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --ref) ref="${2:?--ref needs a value}"; shift 2 ;;
        -*)    echo "arc-bytediff: unknown flag: $1" >&2; exit 1 ;;
        *)     if [ -z "$old" ]; then old="$1"; elif [ -z "$new" ]; then new="$1";
               else echo "arc-bytediff: too many arguments" >&2; exit 1; fi; shift ;;
      esac
    done
    [ -n "$old" ] && [ -n "$new" ] || { echo "usage: arc-bytediff.sh verify-move <old> <new> [--ref REF]" >&2; exit 1; }

    if ! git cat-file -e "$ref:$old" 2>/dev/null; then
      echo "arc-bytediff: FAIL -- old path '$old' not found in $ref" >&2; exit 2
    fi
    oldsha="$(git show "$ref:$old" 2>/dev/null | _lfsha)"
    oldmode="$(_mode_ref "$ref" "$old")"

    if [ ! -e "$new" ] && [ -z "$(_mode_idx "$new")" ]; then
      echo "arc-bytediff: FAIL -- new path '$new' missing from working tree AND index" >&2; exit 2
    fi
    # Case check BEFORE trusting the filesystem: if git has no entry at this exact path but
    # does have one that differs only by case, the operator typed the wrong case. Every
    # downstream check would compare wrong-to-wrong and report OK. First honest detection
    # would otherwise be a case-sensitive CI leg, post-commit, bundle already sealed.
    if [ -z "$(_mode_idx "$new")" ]; then
      variant="$(_idx_case_variant "$new")"
      if [ -n "$variant" ]; then
        echo "arc-bytediff: FAIL -- case mismatch: git tracks '$variant', not '$new'" >&2; exit 2
      fi
    fi

    # A move means the old path is GONE. Identical content at the new path is necessary but
    # not sufficient -- `cp` leaves a frozen duplicate behind that satisfies every hash check.
    if [ -e "$old" ]; then
      echo "arc-bytediff: FAIL -- old path '$old' is still present (copy, not move)" >&2; exit 2
    fi

    if [ -e "$new" ]; then newsha="$(_lfsha < "$new")"
    else                  newsha="$(git show ":$new" 2>/dev/null | _lfsha)"; fi
    newmode="$(_mode_idx "$new")"; [ -z "$newmode" ] && newmode="$oldmode"   # unstaged -> trust git-mv preservation

    fail=0
    if [ "$oldsha" != "$newsha" ]; then
      echo "arc-bytediff: FAIL content altered: '$old' ($oldsha) -> '$new' ($newsha)"; fail=1; fi
    if [ -n "$oldmode" ] && [ -n "$newmode" ] && [ "$oldmode" != "$newmode" ]; then
      echo "arc-bytediff: FAIL mode altered: '$old' ($oldmode) -> '$new' ($newmode)"; fail=1; fi
    [ "$fail" -eq 0 ] && echo "arc-bytediff: OK  $old -> $new  (content+mode preserved)"
    [ "$fail" -eq 0 ] && exit 0 || exit 2
    ;;

  verify-moves)
    f=""; complete=1
    while [ $# -gt 0 ]; do
      case "$1" in
        --no-complete) complete=0; shift ;;
        -*) echo "arc-bytediff: unknown flag: $1" >&2; exit 1 ;;
        *)  if [ -z "$f" ]; then f="$1"; else echo "arc-bytediff: too many arguments" >&2; exit 1; fi; shift ;;
      esac
    done
    [ -f "$f" ] || { echo "usage: arc-bytediff.sh verify-moves <pairs-file> [--no-complete]" >&2; exit 1; }
    rc=0; n=0
    # `|| [ -n "${old:-}" ]` is load-bearing: `read` returns nonzero at EOF-without-newline, so
    # a pairs file whose last line lacks \n would have its FINAL pair read into the variables
    # and then silently skipped -- while `verified N move(s)` under-counted to match, making the
    # transcript self-consistent and wrong. Generate pairs from git, and still never trust `read`.
    while IFS=$'\t' read -r old new _rest || [ -n "${old:-}" ]; do
      if [ -z "${old:-}" ]; then old=""; continue; fi
      case "$old" in \#*) old=""; continue ;; esac
      n=$((n+1))
      bash "$0" verify-move "$old" "$new" || rc=2
      old=""
    done < "$f"

    # Completeness: the gate cannot prove it was handed every move, so ask git directly. Any
    # staged rename absent from the pairs file is an unverified move riding in the same commit.
    if [ "$complete" -eq 1 ] && git rev-parse --verify -q HEAD >/dev/null 2>&1; then
      _staged="$(mktemp)"
      git diff --cached --diff-filter=R -M --name-status HEAD 2>/dev/null > "$_staged"
      uncovered=""
      while IFS=$'\t' read -r _st _sold snew || [ -n "${_st:-}" ]; do
        [ -z "${snew:-}" ] && { _st=""; continue; }
        awk -F'\t' -v t="$snew" '$0 !~ /^#/ && $2==t {found=1} END{exit !found}' "$f" \
          || uncovered="$uncovered $snew"
        _st=""
      done < "$_staged"
      rm -f "$_staged"
      if [ -n "$uncovered" ]; then
        echo "arc-bytediff: FAIL -- staged rename(s) uncovered by the pairs file:$uncovered" >&2
        rc=2
      fi
    fi

    echo "arc-bytediff: verified $n move(s) -- $([ "$rc" -eq 0 ] && echo 'all preserved' || echo 'INTEGRITY FAILURE')"
    exit "$rc"
    ;;

  *) echo "usage: arc-bytediff.sh {verify-move <old> <new> [--ref REF] | verify-moves <pairs-file>}" >&2; exit 1 ;;
esac
