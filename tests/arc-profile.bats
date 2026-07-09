#!/usr/bin/env bats
# Phase 01 -- strictness profile resolver + gate wiring (ADR-0008 block-by-default).
bats_require_minimum_version 1.5.0
load 'test_helper'

PROFILE_SH() { echo "$ARC_ROOT/.claude/scripts/arc-profile.sh"; }

# Write a throwaway settings.json, echo its path.
_settings() { local p; p="$(mktemp)"; printf '%s\n' "$1" > "$p"; echo "$p"; }

# ---------------------------------------------------------------------------
# Profile table
# ---------------------------------------------------------------------------

@test "default profile is standard (block-by-default)" {
  local s; s="$(_settings '{}')"
  run env ARC_SETTINGS="$s" ARC_PROFILE= bash "$(PROFILE_SH)" name
  [ "$output" = "standard" ]
}

@test "standard: core gates block, reviews = code,security" {
  local s; s="$(_settings '{"arc":{"profile":"standard"}}')"
  [ "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" mode coverage)" = "block" ]
  [ "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" mode docs)"     = "block" ]
  [ "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" mode scan)"     = "block" ]
  [ "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" reviews)"       = "code,security" ]
}

@test "starter: all gates warn, no required reviews" {
  local s; s="$(_settings '{"arc":{"profile":"starter"}}')"
  [ "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" mode coverage)" = "warn" ]
  [ "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" mode docs)"     = "warn" ]
  [ "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" mode scan)"     = "warn" ]
  [ -z "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" reviews)" ]
}

@test "strict: all gates block, full review set" {
  local s; s="$(_settings '{"arc":{"profile":"strict"}}')"
  [ "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" mode scan)" = "block" ]
  [ "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" reviews)"   = "code,security,qa,design,docs" ]
}

# ---------------------------------------------------------------------------
# Precedence
# ---------------------------------------------------------------------------

@test "ARC_PROFILE env overrides settings profile" {
  local s; s="$(_settings '{"arc":{"profile":"starter"}}')"
  run env ARC_SETTINGS="$s" ARC_PROFILE=strict bash "$(PROFILE_SH)" mode scan
  [ "$output" = "block" ]
}

@test "explicit per-gate key overrides the profile for that gate only" {
  local s; s="$(_settings '{"arc":{"profile":"standard","coverageMode":"warn"}}')"
  [ "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" mode coverage)" = "warn" ]   # override
  [ "$(ARC_SETTINGS=$s bash "$(PROFILE_SH)" mode docs)"     = "block" ]  # profile
}

@test "ARC_REQUIRED_REVIEWS env overrides reviews" {
  local s; s="$(_settings '{"arc":{"profile":"standard"}}')"
  run env ARC_SETTINGS="$s" ARC_REQUIRED_REVIEWS="code" bash "$(PROFILE_SH)" reviews
  [ "$output" = "code" ]
}

@test "unknown profile falls back to standard (safe default)" {
  local s; s="$(_settings '{"arc":{"profile":"bogus"}}')"
  # --separate-stderr so the (correct) warning on stderr does not pollute stdout
  run --separate-stderr env ARC_SETTINGS="$s" bash "$(PROFILE_SH)" name
  [ "$status" -eq 0 ]
  [ "$output" = "standard" ]
  [[ "$stderr" == *"unknown profile"* ]]
}

# ---------------------------------------------------------------------------
# Gate wiring: arc-scan honors the scan mode
# ---------------------------------------------------------------------------

@test "arc-scan: standard profile blocks a dirty scope (exit 2)" {
  _arc_need_semgrep; _arc_need_gitleaks
  local d; d="$(mktemp -d)"
  printf 'function h(req){ return eval(req.query.q); }\n' > "$d/bad.js"
  printf 'const t="ghp_16C7e42F292c6912E7710c838347Ae178B4a";\n' > "$d/s.js"
  printf '%s\n%s\n' "$d/bad.js" "$d/s.js" > "$d/scope.txt"
  run env ARC_PROFILE=standard bash "$ARC_SCAN_SRC/arc-scan.sh" --scope "$d/scope.txt" --no-stamp --out-dir "$d/out"
  [ "$status" -eq 2 ]
  rm -rf "$d"
}

@test "arc-scan: starter profile downgrades block to advisory (exit 0)" {
  _arc_need_semgrep; _arc_need_gitleaks
  local d; d="$(mktemp -d)"
  printf 'function h(req){ return eval(req.query.q); }\n' > "$d/bad.js"
  printf '%s\n' "$d/bad.js" > "$d/scope.txt"
  run env ARC_PROFILE=starter bash "$ARC_SCAN_SRC/arc-scan.sh" --scope "$d/scope.txt" --no-stamp --out-dir "$d/out"
  [ "$status" -eq 0 ]
  [[ "$output" == *"advisory"* ]]
  rm -rf "$d"
}

# ---------------------------------------------------------------------------
# Profile reviews -> ledger require (the block-by-default review backbone that
# /arc-review's code-stamp feeds).
# ---------------------------------------------------------------------------

@test "ledger require enforces the standard review set (code,security)" {
  _arc_sandbox
  local reviews; reviews="$(bash .claude/scripts/arc-profile.sh reviews)"   # default standard
  [ "$reviews" = "code,security" ]
  run bash .claude/scripts/review-ledger.sh require "$reviews"
  [ "$status" -eq 2 ]                                   # nothing stamped => BLOCK
  bash .claude/scripts/review-ledger.sh stamp code
  bash .claude/scripts/review-ledger.sh stamp security
  run bash .claude/scripts/review-ledger.sh require "$reviews"
  [ "$status" -eq 0 ]                                   # both stamped => pass
}
