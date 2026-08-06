#!/usr/bin/env bats
# Phase 00 -- policy-lint, the validator that makes hq.policy.yaml law.
#
# policy-lint FAILS FROM BIRTH (exit 2 on any violation). It is not an advisory lint, so there is
# no WARN-first period and no TRIAL entry: the spine strict-mode precedent applies, because a
# policy file that parses when it should not is a grant nobody authorised.
#
# This file proves the STATIC rules -- the ones decidable from the file plus CONSTITUTION.md.
# Runtime authorization lives in policy-authorize.bats; the hostile corpus is driven end to end
# by policy-hostile.bats. A rule proven here is pinned to its own message, not to a shared code.
#
# ASCII-only test names -- bats silently DROPS a @test whose name carries a non-ASCII character
# (five tests once vanished behind a green file, visible only as a shrinking CI count), so this
# file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT=".claude/scripts/hq/policy-lint.mjs"

# A minimal VALID policy, built by composition so each test mutates one thing. Written as a
# heredoc into a temp file -- never interpolated into a shell string, because the E2 clause
# carries an apostrophe (Ashiq's) and one apostrophe closes a single-quoted program.
_write_policy() { # $1 = target path, stdin = the `kinds:` block
  local target="$1"
  cat > "$target" <<'HEADER'
version: 1

constitution:
  version: "1.0"
  sha256: "233a64961dc0a028ceca6b113405ead699f9185b39342924c32c05f9786b6ee6"
  receipt: "01KZ9V0QXNNMB3ZH18MSH8DKH3"

levels:
  L0: "denied"
  L1: "propose"
  L2: "bounded"
  L3: "unbounded within the capability"

ungrantable_actions:
  - "moving money"
  - "killing a venture"
  - "changing prices"
  - "unlocking real-money trading"
  - "publishing under Ashiq's name"

ungrantable_resources:
  - ".claude/settings.json"
  - ".claude/settings.local.json"
  - ".claude/hooks/**"
  - "hq.policy.yaml"

targets:
  message: []
  publish: []
  deploy: []

argv0_classes:
  node: { class: interpreter, reproduces: ["*"] }
  git: { class: vcs, reproduces: ["write", "network"] }
  bats: { class: narrow, reproduces: [] }
  jq: { class: narrow, reproduces: [] }

kinds:
HEADER
  cat >> "$target"
}

# The default kinds block: one narrow, entirely valid kind.
_default_kinds() {
  cat <<'KINDS'
  "session:interactive":
    e2: []
    read: { level: L3 }
    write: { level: L0 }
    shell: { level: L2, argv0_allow: ["bats", "jq"] }
    network: { level: L0 }
    message: { level: L0 }
    publish: { level: L0 }
    deploy: { level: L0 }
    spend: { level: L0 }
KINDS
}

_lint() { cd "$ARC_ROOT" && node "$LINT" "$1"; }

setup() {
  POL="$BATS_TEST_TMPDIR/p.yaml"
  _default_kinds | _write_policy "$POL"
}

@test "a valid policy file lints clean and exits 0" {
  run _lint "$POL"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "policy-lint exits 2 when a capability is granted L4" {
  sed -i 's/read: { level: L3 }/read: { level: L4 }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"L4"* ]]
}

@test "an unknown capability name is a hard error" {
  sed -i 's/read: { level: L3 }/telepathy: { level: L3 }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"telepathy"* ]]
}

@test "an unknown top level key is a hard error" {
  printf '\nsurprise: 1\n' >> "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"surprise"* ]]
}

@test "a missing e2 key is a lint error -- silence is not consent" {
  sed -i '/e2: \[\]/d' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"e2"* ]]
}

@test "a non-empty e2 caps every capability at L1, blanket not per-item" {
  sed -i 's/e2: \[\]/e2: ["killing a venture"]/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"E2"* ]] || [[ "$output" == *"e2"* ]]
}

@test "an e2 entry that is not one of the five constitutional items is rejected" {
  sed -i 's/e2: \[\]/e2: ["reorganising the furniture"]/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
}

@test "spend above L1 is an unconditional error even with an empty e2" {
  sed -i 's/spend: { level: L0 }/spend: { level: L2, cap: { amount: 100, currency: "INR", window: daily } }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"spend"* ]]
}

@test "duplicate keys in one mapping are rejected before the second value is assigned" {
  sed -i 's/write: { level: L0 }/write: { level: L0 }\n    write: { level: L3 }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"duplicate"* ]]
}

@test "a contradictory grant -- a write root that swallows an un-grantable resource" {
  sed -i 's|write: { level: L0 }|write: { level: L2, roots: ["**"] }|' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
}

@test "a contradictory grant -- bounded network whose bound admits nothing" {
  sed -i 's/network: { level: L0 }/network: { level: L2, domains: [] }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
}

@test "L2 with no declared bound is an error -- that is what separates L2 from L3" {
  sed -i 's/write: { level: L0 }/write: { level: L2 }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
}

@test "a wildcard network domain is rejected" {
  sed -i 's/network: { level: L0 }/network: { level: L2, domains: ["*.example.com"] }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
}

@test "an IP literal network domain is rejected" {
  sed -i 's/network: { level: L0 }/network: { level: L2, domains: ["10.0.0.1"] }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
}

@test "a negative spend amount is rejected" {
  sed -i 's/spend: { level: L0 }/spend: { level: L1, cap: { amount: -5, currency: "INR", window: daily } }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
}

@test "a decimal spend amount is rejected -- minor units are integers" {
  sed -i 's/spend: { level: L0 }/spend: { level: L1, cap: { amount: 10.5, currency: "INR", window: daily } }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
}

@test "a lowercase currency is rejected" {
  sed -i 's/spend: { level: L0 }/spend: { level: L1, cap: { amount: 10, currency: "inr", window: daily } }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
}

@test "an argv0 absent from argv0_classes is a lint error, never an implicit narrow" {
  sed -i 's/argv0_allow: \["bats", "jq"\]/argv0_allow: ["bats", "curl"]/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"curl"* ]]
}

@test "an argv0_classes entry listing shell in its reproduces is a lint error" {
  sed -i 's/bats: { class: narrow, reproduces: \[\] }/bats: { class: narrow, reproduces: ["shell"] }/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"shell"* ]]
}

@test "an unknown kind name is rejected -- the subject set is derived, not invented" {
  sed -i 's/"session:interactive":/"process:no-such-process-anywhere":/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
}

@test "the E2 quote must match the Constitution element for element" {
  sed -i 's/- "changing prices"/- "changing the prices"/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"E2"* ]]
}

@test "a wrong constitution sha256 fails the hash check before the parse is attempted" {
  sed -i 's/233a64961dc0a028ceca6b113405ead699f9185b39342924c32c05f9786b6ee6/0000000000000000000000000000000000000000000000000000000000000000/' "$POL"
  run _lint "$POL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"sha256"* ]] || [[ "$output" == *"hash"* ]]
}

@test "the repo committed hq.policy.yaml lints clean" {
  run _lint "hq.policy.yaml"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "this file registered every test it declares" {
  # bats drops a @test whose name is not ASCII, and the drop is invisible in a green run.
  [ "${#BATS_TEST_NAMES[@]}" -eq 24 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 24 -- a @test was silently dropped"
    false
  }
}
