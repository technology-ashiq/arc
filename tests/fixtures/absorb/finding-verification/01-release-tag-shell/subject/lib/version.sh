#!/usr/bin/env bash
# Version helpers sourced by release-tag.sh. Sourcing has no side effects.

current_version() {
  local latest
  latest=$(git tag --list "v*" --sort=-v:refname | head -n 1)
  if [ -z "$latest" ]; then
    printf '0.0.0\n'
    return 0
  fi
  printf '%s\n' "${latest#v}"
}

bump_version() {
  local version="$1"
  local part="$2"
  local major minor patch
  IFS=. read -r major minor patch <<<"$version"

  case "$part" in
    major)
      printf 'v%s.0.0\n' "$((major + 1))"
      ;;
    minor)
      printf 'v%s.%s.%s\n' "$major" "$((minor + 1))" "$patch"
      ;;
    patch)
      printf 'v%s.%s.%s\n' "$major" "$minor" "$((patch + 1))"
      ;;
  esac
}
