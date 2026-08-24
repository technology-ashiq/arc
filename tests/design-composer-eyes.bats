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

# ---------- 6. the OTHER two read tools (adversarial pass, 2026-08-24) ----------
#
# The boundary was built for `Read` and settings.json matches `Read` alone. `ui-composer`
# declares `tools: Read, Glob, Grep, Write` -- and Grep and Glob each return a sibling
# variant's CONTENT. This is verbatim the assumptions-ledger trigger written at kickoff:
# "the allowlist covers one tool while the agent holds three".
#
# Widening the matcher is necessary and NOT sufficient, which is the part worth writing
# down. Read's payload carries `tool_input.file_path`; Grep's and Glob's carry `pattern`
# plus an OPTIONAL `path`. The scope check already falls back to `.path`, so a Grep that
# NAMES a sibling is caught the moment the matcher fires. A Grep with NO path is the hole:
# it searches from the repo root -- every variant, the matrix, the brief -- and arrives at
# the check as an empty target, where `[ -z "$TARGET" ] && exit 0` treats it as "cannot
# tell what is being read" and fails OPEN. For Read an absent file_path really is
# unreadable. For Grep and Glob an absent path MEANS "everything", and the two must not
# share a branch.

_payload() { printf '{"tool_name":"%s","tool_input":%s}' "$1" "$2"; }

@test "composer scope: a Grep that NAMES a sibling variant is refused" {
  _composer_sandbox; _arm
  run bash "$(_csc)" <<< "$(_payload Grep '{"pattern":"accent","path":"docs/design/explore/lexos-v1/variant-b"}')"
  [ "$status" -eq 2 ] || { echo "expected refusal, got $status: $output"; false; }
}

@test "composer scope: a Grep with NO path searches the whole tree and is refused" {
  _composer_sandbox; _arm
  # The hole. An unscoped search is not "unreadable", it is "all of it".
  run bash "$(_csc)" <<< "$(_payload Grep '{"pattern":"--accent"}')"
  [ "$status" -eq 2 ] || { echo "expected refusal of an unscoped Grep, got $status: $output"; false; }
}

@test "composer scope: a Glob with NO path is refused for the same reason" {
  _composer_sandbox; _arm
  run bash "$(_csc)" <<< "$(_payload Glob '{"pattern":"**/*.css"}')"
  [ "$status" -eq 2 ] || { echo "expected refusal of an unscoped Glob, got $status: $output"; false; }
}

@test "composer scope: a Glob scoped to its OWN variant dir is allowed" {
  _composer_sandbox; _arm
  # The paired positive control. A boundary that only proves it refuses has not proved it
  # discriminates -- and a Grep/Glob rule that blocks everything would take the composer's
  # own directory with it, which is the one place it must be able to look.
  run bash "$(_csc)" <<< "$(_payload Glob '{"pattern":"*.css","path":"docs/design/explore/lexos-v1/variant-a"}')"
  [ "$status" -eq 0 ] || { echo "expected its own dir to be allowed, got $status: $output"; false; }
}

@test "composer scope: a Read with NO file_path still fails OPEN, not closed" {
  _composer_sandbox; _arm
  # The distinction this whole section rests on, pinned from the other side. Read without a
  # file_path is a malformed payload the hook cannot judge; blocking it would break unrelated
  # reads for a reason nobody could see. Only Grep and Glob read an absent path as "all of it".
  run bash "$(_csc)" <<< "$(_payload Read '{}')"
  [ "$status" -eq 0 ] || { echo "a malformed Read payload must not block, got $status: $output"; false; }
}

@test "settings.json arms the read boundary for Grep and Glob, not for Read alone" {
  # The matcher is the arming surface. With `Read` alone the two other read tools never
  # reach the dispatcher at all, so every case above would pass against a hook production
  # never invokes -- the gate testing itself rather than the path.
  # cd + a RELATIVE path, read with fs -- never require() on an interpolated "$ARC_ROOT".
  # Git Bash hands out POSIX paths (/d/a/arc/arc) while node is a native Windows binary that
  # wants D:\a\arc\arc, so the interpolated form dies with "Cannot find module
  # '/d/a/arc/arc/.claude/settings.json'" on the windows leg ONLY. That is the worst shape a
  # wiring test can take: it would have stayed red on Windows after the wiring was fixed, so
  # its red would have stopped meaning anything. policy-hook.bats already reads this same file
  # the working way -- cd, then a relative path -- and this now matches it.
  cd "$ARC_ROOT"
  m="$(node -e '
    const fs = require("node:fs");
    const d = JSON.parse(fs.readFileSync(".claude/settings.json", "utf8"));
    const e = (d.hooks.PreToolUse || []).find(x => /PreToolUse-read/.test(JSON.stringify(x.hooks || [])));
    process.stdout.write(e ? String(e.matcher) : "");
  ')"
  [ -n "$m" ] || { echo "no PreToolUse entry dispatches to PreToolUse-read.sh"; false; }
  echo "$m" | grep -q 'Read'  || { echo "matcher lost Read: $m"; false; }
  echo "$m" | grep -q 'Grep'  || { echo "matcher does not arm Grep: $m"; false; }
  echo "$m" | grep -q 'Glob'  || { echo "matcher does not arm Glob: $m"; false; }
}

# ---------- 7. the PRODUCTION path, which is stdin and not argv ----------
#
# Every case in section 5 drives the fragment with the path as `$1`. Production never does:
# _dispatch.sh runs `bash "$f" < "$input"` with no arguments, so the path arrives as JSON on
# stdin. Delete the stdin branch from composer-scope-check.sh and all fifteen argv cases stay
# green -- the fifth vacuous-pass instance this cycle. These drive the real dispatcher with a
# real payload, which is the only shape that proves the wiring.

@test "composer scope: the real dispatcher blocks a sibling read from a STDIN payload" {
  _composer_sandbox; _arm
  run bash "$SANDBOX/.claude/hooks/PreToolUse-read.sh" \
      <<< "$(_payload Read '{"file_path":".claude/state/design/renders/lexos-v1--variant-b/x.png"}')"
  [ "$status" -eq 2 ] || { echo "expected the dispatcher to block, got $status: $output"; false; }
}

@test "composer scope: the real dispatcher passes its OWN render from a STDIN payload" {
  _composer_sandbox; _arm
  run bash "$SANDBOX/.claude/hooks/PreToolUse-read.sh" \
      <<< "$(_payload Read '{"file_path":".claude/state/design/renders/lexos-v1--variant-a/x.png"}')"
  [ "$status" -eq 0 ] || { echo "expected its own render to pass, got $status: $output"; false; }
}

@test "composer scope: with no marker the real dispatcher is a no-op on a STDIN payload" {
  _composer_sandbox
  run bash "$SANDBOX/.claude/hooks/PreToolUse-read.sh" \
      <<< "$(_payload Read '{"file_path":".claude/state/design/renders/lexos-v1--variant-b/x.png"}')"
  [ "$status" -eq 0 ] || { echo "an unarmed boundary must not block, got $status: $output"; false; }
}

# ---------- 8. the bookends that ARM the boundary ----------
#
# The finding this section exists for: `grep -rn` across commands, skills, processes, hooks
# and CI found ZERO production callers of composer-scope-check.sh --begin and ZERO of
# design-explore.sh surfaces|coverage|selfreview. Nothing armed the marker, so the hook's
# `[ -f "$MARKER" ] || exit 0` made it a permanent no-op outside these tests. Three gates
# were built and none were wired into the explore flow -- and every slice was green on CI,
# which is precisely the distinction between "the assertions held" and "the guard guards".
#
# The shape is design-critique.sh begin/finish, which already does this for the CRITIC.

_explore_sh() { echo "$SANDBOX/.claude/scripts/design/design-explore.sh"; }
_marker() { echo "$SANDBOX/.claude/state/design/composer-session"; }

@test "compose: arming is a real command, and it leaves the boundary armed" {
  _composer_sandbox
  [ ! -f "$(_marker)" ]
  run bash "$(_explore_sh)" compose lexos-v1 --variant a
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -f "$(_marker)" ] || { echo "compose ran and armed nothing: $output"; false; }
  grep -q 'explore=lexos-v1' "$(_marker)"
  grep -q 'variant=variant-a' "$(_marker)"
}

@test "compose: the armed boundary actually refuses a sibling, end to end" {
  _composer_sandbox
  # The whole point. Arming through the production command, refusing through the production
  # dispatcher, on a stdin payload -- no test-only --begin anywhere in the chain.
  bash "$(_explore_sh)" compose lexos-v1 --variant a >/dev/null
  run bash "$SANDBOX/.claude/hooks/PreToolUse-read.sh" \
      <<< "$(_payload Read '{"file_path":"docs/design/explore/lexos-v1/variant-b/index.html"}')"
  [ "$status" -eq 2 ] || { echo "armed by the real command and still not refusing: $status $output"; false; }
}

@test "compose: without --variant it refuses rather than arming something vague" {
  _composer_sandbox
  run bash "$(_explore_sh)" compose lexos-v1
  [ "$status" -ne 0 ]
  # The refusal must name the MISSING FLAG. Asserting only a non-zero exit passes just as
  # happily against a script with no compose subcommand at all -- which is precisely what it
  # did on the red-first run, where this case sat green among five genuine reds. A refusal
  # test cannot be red-first by construction, so the message is what separates "refused
  # correctly" from "was never there".
  echo "$output" | grep -q -- "--variant" || { echo "refused, but not for the missing flag: $output"; false; }
  [ ! -f "$(_marker)" ] || { echo "refused and armed anyway: $output"; false; }
}

@test "compose: a variant that does not exist refuses" {
  _composer_sandbox
  run bash "$(_explore_sh)" compose lexos-v1 --variant zz
  [ "$status" -ne 0 ]
  # Same reasoning as above: name the variant, so "no variant-zz" cannot be confused with
  # "no such command".
  echo "$output" | grep -q "zz" || { echo "refused without naming the variant: $output"; false; }
  [ ! -f "$(_marker)" ]
}

@test "compose-done: releases the boundary even when the gates FAIL" {
  _composer_sandbox
  bash "$(_explore_sh)" compose lexos-v1 --variant a >/dev/null
  # variant-a/index.html is "page a" -- no surface markers at all, so the surface gate fails.
  run bash "$(_explore_sh)" compose-done lexos-v1 --variant a
  [ "$status" -ne 0 ] || { echo "an unmarked page cleared the composer gates: $output"; false; }
  # THE POINT OF THIS CASE. design-critique.sh releases first and unconditionally because a
  # boundary left armed blocks every later read in the session for a reason nobody can see --
  # and the session that needs to fix what the gate just found is the one it would block.
  [ ! -f "$(_marker)" ] || { echo "the gates failed and the boundary stayed armed: $output"; false; }
}

@test "compose-done: a page that clears the gates reports success and releases" {
  _composer_sandbox
  cat > "$SANDBOX/$EX/variant-a/index.html" <<'EOF'
<!doctype html><title>a</title>
<main><section data-arc-surface="product"><h1>Matter 4821</h1></section></main>
EOF
  bash "$(_explore_sh)" compose lexos-v1 --variant a >/dev/null
  run bash "$(_explore_sh)" compose-done lexos-v1 --variant a
  [ "$status" -eq 0 ] || { echo "a correctly marked page did not clear: $output"; false; }
  [ ! -f "$(_marker)" ]
}

@test "compose-done: an absent page is refused, not skipped" {
  _composer_sandbox
  rm -f "$SANDBOX/$EX/variant-a/index.html"
  bash "$(_explore_sh)" compose lexos-v1 --variant a >/dev/null
  run bash "$(_explore_sh)" compose-done lexos-v1 --variant a
  [ "$status" -ne 0 ] || { echo "a composer that wrote nothing was reported as finished: $output"; false; }
  [ ! -f "$(_marker)" ]
}
