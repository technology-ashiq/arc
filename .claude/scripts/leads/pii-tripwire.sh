#!/usr/bin/env bash
# pii-tripwire.sh -- the ALARM, not the wall (ADR-0410).
#
# The wall is location isolation: lead PII lives outside the repository directory, so it
# cannot be committed by accident. This catches the common accident anyway -- an address or a
# store path that made it into a tracked file -- and it is honest about what it cannot do: it
# CANNOT prove arbitrary prose PII-free. A name in a sentence passes here. That limit is
# stated in ADR-0410 and is not a defect to be fixed with a bigger regex.
#
# SCOPE is leads-owned paths only. Repo-wide would turn CI red on pre-existing content from
# commit one, and a gate that is red for reasons outside the change is a gate people learn to
# ignore.
#
# Exit: 0 clean | 2 violation (path + line + rule named) | 3 usage / cannot-scan.
#
# ---------------------------------------------------------------------------------------
# HARDENED after an adversarial pass on the shell/OS surface. Every guard below replaces a
# CONFIRMED bypass, and the shape of most of them is "the previous version reported success
# while scanning nothing", which is worse than having no gate at all:
#
#   * `git ls-files ... || true` swallowed every failure, so a non-git directory scanned zero
#     files and exited 0
#   * unquoted $files skipped any tracked path containing a space or a glob character
#   * git quotes non-ASCII paths by default (core.quotePath), so `tests/fixtures/leads/jose.json`
#     with an accent was silently skipped -- hence -z and core.quotePath=off
#   * grep announced "Binary file ... matches" instead of the match on a NUL-bearing file, so
#     rule 1 failed OPEN while rule 2 pasted the banner into its line-number field -- hence -a
#   * the default store path was derived from $HOME while store.mjs derives it from
#     os.homedir(); on the Windows leg those differ (/c/Users/x vs C:\Users\x), so the two
#     native forms searched were both wrong. The path is now asked OF store.mjs.
# ---------------------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
if [ -z "$REPO_ROOT" ] || [ ! -d "$REPO_ROOT" ]; then
  echo "pii-tripwire: usage: pii-tripwire.sh [repo-root]  (not inside a git repo?)" >&2
  exit 3
fi
cd "$REPO_ROOT"

# Refuse rather than scan nothing. `git ls-files` in a non-repo exits non-zero and used to be
# swallowed by `|| true`, producing "clean (0 files scanned)" and exit 0.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "pii-tripwire: $REPO_ROOT is not a git work tree -- refusing to report clean on a scan that cannot happen" >&2
  exit 3
fi

# Fixture-class paths may carry RESERVED-domain addresses (RFC 2606) and nothing else. The
# leads bats files belong here for the same reason the fixture corpus does: they are test data
# by construction, and holding them to "no address at all" would push their sample addresses
# into runtime assembly for no safety gain. Anything outside these prefixes still FAILs on any
# address at all.
_is_fixture_class() {
  case "$1" in
    tests/fixtures/leads/*) return 0 ;;
    tests/leads-*.bats) return 0 ;;
    *) return 1 ;;
  esac
}

EMAIL_RE='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z][A-Za-z]*'

# Whether a DOMAIN is RFC-2606 reserved. A function over the extracted domain rather than one
# regex: `firm1.example.com` is a SUBDOMAIN of a reserved domain and must pass (an anchored
# alternation rejected it), and a negated letter-range bracket is a locale-collation trap this
# repo bans outright. Suffix matching with `case` needs no ranges.
_is_reserved_domain() {
  case "$1" in
    example.com|example.net|example.org) return 0 ;;
    *.example.com|*.example.net|*.example.org) return 0 ;;
    *.test|*.invalid) return 0 ;;
    *) return 1 ;;
  esac
}

violations=0
scanned=0
report() {
  printf 'pii-tripwire: VIOLATION %s\n  file: %s:%s\n  rule: %s\n' "$1" "$2" "$3" "$4" >&2
  violations=$((violations + 1))
}

# -z with NUL-delimited reads, and core.quotePath=off so a non-ASCII path arrives as itself
# rather than as an octal-escaped quoted string. This is the pattern tests/test_helper.bash
# already uses; it had not reached here.
FILES=()
while IFS= read -r -d '' f; do
  FILES+=("$f")
done < <(git -c core.quotePath=off ls-files -z -- \
  '.claude/scripts/leads' \
  '.claude/config/leads.json' \
  'products/leads' \
  'initiatives/leads' \
  'tests/leads-*.bats' \
  'tests/fixtures/leads' 2>/dev/null)

# ---------- the store path, asked OF the module that defines it ----------
#
# Deriving it here from $HOME was a second implementation of a rule that already had one, and
# the two disagreed on exactly the leg the rule exists to protect. Ask store.mjs; fall back to
# the shell derivation only if node is unavailable, and say so.
STORE_RESOLVED=""
if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/.claude/scripts/leads/lib/store.mjs" ]; then
  # Two traps live in this one call, and the first version hit both:
  #
  #   1. `process.argv[1]` under `node -e` is NOT the extra argument -- this is the same
  #      argv[1] confusion that once had a validator parsing its own source for a whole suite.
  #      The path comes in through the environment instead.
  #   2. a Windows absolute path is not a valid ESM specifier; `import("C:\...")` throws, so
  #      the resolution silently failed and fell back to the $HOME derivation -- the exact
  #      divergence asking store.mjs was supposed to eliminate. pathToFileURL fixes it.
  #
  # Both failures were INVISIBLE because of `2>/dev/null || true`: the fallback looked like a
  # working path while searching for a string nothing would ever contain.
  STORE_RESOLVED="$(LEADS_STORE_MODULE="$REPO_ROOT/.claude/scripts/leads/lib/store.mjs" \
    node --input-type=module -e \
    'import {pathToFileURL} from "node:url"; const {storePath} = await import(pathToFileURL(process.env.LEADS_STORE_MODULE).href); process.stdout.write(storePath());' \
    2>/dev/null || true)"
fi
if [ -z "$STORE_RESOLVED" ]; then
  # Say so. A silent fallback to a path derived differently from the one the code uses is how
  # this gate came to scan for a string that could never appear.
  echo "pii-tripwire: NOTE -- could not resolve the store path via store.mjs; falling back to a shell derivation, which may differ from os.homedir() on this platform" >&2
  STORE_RESOLVED="${ARC_LEADS_STORE:-${HOME:-}/.arc/leads}"
fi
# Strip trailing separators: Node's resolve() drops them and the raw env value may not, which
# made a store path ending in "/" match nothing.
while : ; do
  case "$STORE_RESOLVED" in
    */|*\\) STORE_RESOLVED="${STORE_RESOLVED%?}" ;;
    *) break ;;
  esac
done
store_posix="$(printf '%s' "$STORE_RESOLVED" | tr '\\' '/')"
store_win="$(printf '%s' "$STORE_RESOLVED" | tr '/' '\\')"

for f in "${FILES[@]+"${FILES[@]}"}"; do
  [ -f "$f" ] || continue
  # Skip ONLY this script, by exact path -- a basename skip would also exempt any future file
  # that happens to share the name.
  [ "$f" = ".claude/scripts/leads/pii-tripwire.sh" ] && continue
  scanned=$((scanned + 1))

  # ---------- rule 1: email-shaped strings ----------
  # -a so a file containing a NUL is scanned as text rather than answered with
  # "Binary file ... matches", which rule 1 read as no-match.
  while IFS=: read -r lineno addr; do
    [ -n "${lineno:-}" ] || continue
    [ -n "${addr:-}" ] || continue
    domain=$(printf '%s' "$addr" | sed 's/.*@//' | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')
    if _is_fixture_class "$f"; then
      if ! _is_reserved_domain "$domain"; then
        report "non-reserved address in a fixture path" "$f" "$lineno" \
          "fixture and test paths may hold ONLY example.com/.net/.org (and their subdomains), .test, .invalid (RFC 2606) -- so even a fixture cannot carry a real address"
      fi
    else
      report "email-shaped string in a tracked file" "$f" "$lineno" \
        "lead addresses live in the private store outside the repo (ADR-0410); git history is forever and this repo is headed public"
    fi
  done < <(grep -a -noE "$EMAIL_RE" "$f" 2>/dev/null || true)

  # ---------- rule 2: a resolved store path in a tracked file ----------
  for form in "$store_posix" "$store_win"; do
    [ -n "$form" ] || continue
    while IFS=: read -r lineno _; do
      [ -n "${lineno:-}" ] || continue
      report "resolved store path in a tracked file" "$f" "$lineno" \
        "the store path resolves at runtime from ARC_LEADS_STORE; a personal filesystem path committed to a future-public repo is itself a leak (ADR-0410)"
    done < <(grep -a -niF "$form" "$f" 2>/dev/null || true)
  done
done

if [ "$violations" -gt 0 ]; then
  echo "pii-tripwire: $violations violation(s) across $scanned file(s)" >&2
  exit 2
fi

# A gate that passes while scanning nothing is worse than no gate: it reports safety it never
# measured. In a repo that HAS leads paths this can only mean the scope globs stopped matching.
if [ "$scanned" -eq 0 ]; then
  echo "pii-tripwire: scanned 0 files -- the scope globs match nothing, so this run measured NOTHING and cannot report clean" >&2
  exit 3
fi

echo "pii-tripwire: clean ($scanned tracked leads files scanned)"
exit 0
