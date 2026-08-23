#!/usr/bin/env bats
# Cycle 16 Phase 01 (REQ-02) -- the composer sees its own work.
#
# ADR-1415: iron law 1 said "your directory only", and design v2 requires the composer to read
# two things outside variant-<x>/ -- its own rendered PNG and the brief's reference pack. Unlike
# the brief's TEXT, an image cannot be inlined into a subagent prompt, so there is no other way
# to deliver it. This lane has already paid for that shape once: the director wrote the canonical
# content fixture into matrix.md while iron law 1 forbade composers from reading matrix.md, so
# three composers invented three different cases and only the one that broke the rule matched.
#
# The adversarial pass on Phase 00 made the point that decides this file's shape: a read
# allowlist stated only in prompt prose is not a control. `ui-composer` declares bare `Read`,
# which is unscoped, so iron law 1 is obeyed only because the agent chooses to -- and a negative
# control over prose tests COMPLIANCE, not REFUSAL. So the boundary is a hook, and these cases
# drive the hook.
bats_require_minimum_version 1.5.0
load 'test_helper'

_composer_sandbox() {
  _arc_design_sandbox
  EX="docs/design/explore/lexos-v1"
  mkdir -p "$SANDBOX/$EX/variant-a" "$SANDBOX/$EX/variant-b" \
           "$SANDBOX/.claude/state/design/renders/lexos-v1--variant-a" \
           "$SANDBOX/.claude/state/design/renders/lexos-v1--variant-b" \
           "$SANDBOX/.claude/state/design/refpacks/lexos-v1"
  printf 'thesis a\n'  > "$SANDBOX/$EX/variant-a/thesis.txt"
  printf 'page a\n'    > "$SANDBOX/$EX/variant-a/index.html"
  printf 'page b\n'    > "$SANDBOX/$EX/variant-b/index.html"
  printf 'brief\n'     > "$SANDBOX/$EX/brief.md"
  printf 'matrix\n'    > "$SANDBOX/$EX/matrix.md"
  : > "$SANDBOX/.claude/state/design/renders/lexos-v1--variant-a/x.png"
  : > "$SANDBOX/.claude/state/design/renders/lexos-v1--variant-b/x.png"
  : > "$SANDBOX/.claude/state/design/refpacks/lexos-v1/ref-1.png"
}

_csc() { echo "$SANDBOX/.claude/scripts/design/composer-scope-check.sh"; }
_arm() { bash "$(_csc)" --begin lexos-v1 variant-a >/dev/null; }

teardown() { _arc_teardown; }

# ---------- 1. the boundary is scoped to a RUN, never global ----------

@test "composer scope: with no marker the check is a no-op" {
  _composer_sandbox
  # An always-on rule would block every other agent in the repo, including the one that
  # fixes what the composer got wrong. Same shape as the critic's boundary and /arc-freeze.
  run bash "$(_csc)" "README.md"
  [ "$status" -eq 0 ]
}

@test "composer scope: --begin arms and --end releases" {
  _composer_sandbox
  run bash "$(_csc)" --begin lexos-v1 variant-a
  [ "$status" -eq 0 ]
  [ -f "$SANDBOX/.claude/state/design/composer-session" ]
  run bash "$(_csc)" --end
  [ "$status" -eq 0 ]
  [ ! -f "$SANDBOX/.claude/state/design/composer-session" ]
}

@test "composer scope: --begin without a variant refuses" {
  _composer_sandbox
  run bash "$(_csc)" --begin lexos-v1
  [ "$status" -eq 2 ]
}

# ---------- 2. what the allowlist ADMITS ----------

@test "composer scope: its own variant dir is readable" {
  _composer_sandbox; _arm
  run bash "$(_csc)" "docs/design/explore/lexos-v1/variant-a/index.html"
  [ "$status" -eq 0 ]
}

@test "composer scope: its own session's render is readable" {
  _composer_sandbox; _arm
  run bash "$(_csc)" ".claude/state/design/renders/lexos-v1--variant-a/x.png"
  [ "$status" -eq 0 ]
}

@test "composer scope: the brief's reference pack is readable" {
  _composer_sandbox; _arm
  run bash "$(_csc)" ".claude/state/design/refpacks/lexos-v1/ref-1.png"
  [ "$status" -eq 0 ]
}

# ---------- 3. what it REFUSES -- the negative controls ----------

@test "composer scope: a SIBLING variant's render is refused" {
  _composer_sandbox; _arm
  # THE control for ADR-1415. The allowlist is session-scoped precisely so that widening the
  # composer's reach does not hand every composer every other composer's work -- the blindness
  # is what makes the panel worth anything.
  run bash "$(_csc)" ".claude/state/design/renders/lexos-v1--variant-b/x.png"
  [ "$status" -eq 2 ]
  echo "$output" | grep -q "sibling"
}

@test "composer scope: another variant's directory is refused" {
  _composer_sandbox; _arm
  run bash "$(_csc)" "docs/design/explore/lexos-v1/variant-b/index.html"
  [ "$status" -eq 2 ]
}

@test "composer scope: the matrix stays forbidden" {
  _composer_sandbox; _arm
  run bash "$(_csc)" "docs/design/explore/lexos-v1/matrix.md"
  [ "$status" -eq 2 ]
}

@test "composer scope: the brief FILE stays forbidden even though the pack is allowed" {
  _composer_sandbox; _arm
  # The pack is images the composer must open itself; the brief is text the prompt carries.
  # Widening to "anything about this brief" would quietly re-permit the file iron law 1 names.
  run bash "$(_csc)" "docs/design/explore/lexos-v1/brief.md"
  [ "$status" -eq 2 ]
}

@test "composer scope: a product file is refused" {
  _composer_sandbox; _arm
  run bash "$(_csc)" "app/page.tsx"
  [ "$status" -eq 2 ]
}

@test "composer scope: a traversal segment is refused outright" {
  _composer_sandbox; _arm
  # A `..` segment carries an allowed prefix and still lands elsewhere. Prefix matching cannot
  # see that, so traversal is refused BEFORE any normalising, on every OS -- the same rule
  # critic-scope-check.sh learned from three-OS CI.
  run bash "$(_csc)" "docs/design/explore/lexos-v1/variant-a/../../../../README.md"
  [ "$status" -eq 2 ]
}

@test "composer scope: an absolute path to a sibling render is refused too" {
  _composer_sandbox; _arm
  # Path SPELLINGS differ per OS (/var vs /private/var, 8.3 short names, MSYS /tmp). Comparing
  # strings blocks the composer's own legitimate read on one leg and lets a sibling through on
  # another, so both sides go through one resolver.
  run bash "$(_csc)" "$SANDBOX/.claude/state/design/renders/lexos-v1--variant-b/x.png"
  [ "$status" -eq 2 ]
}

@test "composer scope: an absolute path to its OWN render is allowed" {
  _composer_sandbox; _arm
  # The paired positive. A refusal-only suite cannot tell a working boundary from one that
  # blocks everything, and a boundary that blocks the read it must allow is just broken.
  run bash "$(_csc)" "$SANDBOX/.claude/state/design/renders/lexos-v1--variant-a/x.png"
  [ "$status" -eq 0 ]
}

@test "composer scope: an unreadable target does not block" {
  _composer_sandbox; _arm
  # If the payload carries no path there is nothing to judge, and blocking on "cannot tell"
  # would break every unrelated read in the session.
  run bash "$(_csc)"
  [ "$status" -eq 0 ]
}

# ---------- 4. the hook fragment actually delegates ----------

@test "composer scope: the PreToolUse-read fragment is a no-op with no marker" {
  _composer_sandbox
  run bash "$SANDBOX/.claude/hooks/PreToolUse-read.d/10-design-composer.sh" "README.md"
  [ "$status" -eq 0 ]
}

@test "composer scope: the PreToolUse-read fragment BLOCKS a sibling read while armed" {
  _composer_sandbox; _arm
  run bash "$SANDBOX/.claude/hooks/PreToolUse-read.d/10-design-composer.sh" \
      ".claude/state/design/renders/lexos-v1--variant-b/x.png"
  [ "$status" -eq 2 ]
}

@test "composer scope: a missing scope script fails OPEN rather than breaking the session" {
  _composer_sandbox
  rm -f "$(_csc)"
  run bash "$SANDBOX/.claude/hooks/PreToolUse-read.d/10-design-composer.sh" "anything"
  [ "$status" -eq 0 ]
}

# ---------- 5. the agent contract, which the hook enforces ----------

@test "ui-composer declares a scoped Bash grant for the renderer and nothing wider" {
  # It has tools: Read, Glob, Grep, Write today -- NO Bash at all. DSV-B called this "the
  # critic's allowlist pattern", but the critic's grant is for arc-event.sh; no agent in this
  # repo holds a renderer grant, so there was no precedent to copy.
  fm="$(sed -n '1,12p' "$ARC_ROOT/.claude/agents/ui-composer.md")"
  echo "$fm" | grep -q 'design-render.sh'
  # Never a bare Bash grant.
  echo "$fm" | grep -qE '^tools:.*[[:space:]]Bash[,[:space:]]*$' && false
  true
}

@test "ui-composer iron law 1 names the enumerated read allowlist and keeps every prohibition" {
  body="$(cat "$ARC_ROOT/.claude/agents/ui-composer.md")"
  echo "$body" | grep -q 'refpacks'
  echo "$body" | grep -q 'renders'
  # The prohibitions survive verbatim -- widening to "do not read another variant" would
  # silently re-permit the brief file and product files, undoing two earlier decisions.
  echo "$body" | grep -q "another variant"
  echo "$body" | grep -q "the matrix"
  echo "$body" | grep -q "the brief"
}
