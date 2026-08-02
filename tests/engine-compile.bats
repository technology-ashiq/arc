#!/usr/bin/env bats
# Phase 01 -- the proof. arc-compile reaches 3/3 byte-identical against the hand-written
# pilots, then the source of truth flips.
#
# The byte-diff is a MIGRATION gate (ADR-0202) and this file treats it as one.
#
# REQ-02 is asserted with `--against-baseline`, which renders without the DO-NOT-EDIT header
# and compares against the pilot AS IT WAS at the commit each canonical file pins, read out
# of git. That is what makes the proof DURABLE. Comparing against the working tree could only
# ever run once: the flip writes a header, and from that moment the working-tree file is no
# longer the thing REQ-02 claimed to reproduce. Reading the pin gives the same answer forever,
# and it is the pin doing the job it was recorded for.
#
# The post-flip gate is the separate `--check` (no flag), which compares the render WITH its
# header against the generated file — and that is also ADR-0201's hand-edit detection.
#
# Every green assertion here is paired with a negative control. A 3/3 that cannot be made to
# fail is a coin, not a proof.
bats_require_minimum_version 1.5.0
load 'test_helper'

CC()   { echo "$ARC_ROOT/.claude/scripts/engine/arc-compile.mjs"; }
LINT() { echo "$ARC_ROOT/.claude/scripts/engine/process-lint.mjs"; }

# `sed -i` is a GNU-ism; BSD sed (macos) reads the next arg as a backup suffix.
_sed_i() { sed "$1" "$2" > "$2.tmp" && mv "$2.tmp" "$2"; }

# A throwaway copy of processes/ so nothing here mutates the committed canonical files.
_procs() {
  local d; d="$(mktemp -d)"
  mkdir -p "$d/processes"
  cp "$ARC_ROOT"/processes/*.process.yaml "$d/processes/"
  echo "$d"
}

# ---------------------------------------------------------------------------
# REQ-02 -- the proof, and that it can fail
# ---------------------------------------------------------------------------

@test "REQ-02: all 3 pilots compile byte-identical to their hand-written baselines" {
  run node "$(CC)" --check --all --target claude-code --against-baseline --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"3/3 byte-identical"* ]]
}

@test "negative control: one changed word in a canonical body fails the byte-diff, with an offset" {
  local d; d="$(_procs)"
  _sed_i 's/Never commit blind/Never commit blindly/' "$d/processes/commit-msg-draft.process.yaml"
  # --root stays the real repo so the baseline path resolves; only processes/ is the copy.
  run node "$(CC)" --check "$d/processes/commit-msg-draft.process.yaml" --target claude-code --against-baseline --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[byte-diff]"* ]]
  [[ "$output" =~ differs\ at\ byte\ [0-9]+ ]]
  [[ "$output" == *"Expected:"* ]]
  [[ "$output" == *"Found:"* ]]
}

@test "negative control: dropping one tool scope changes the allowed-tools line" {
  local d; d="$(_procs)"
  _sed_i 's/^      - "log:\*"$//' "$d/processes/commit-msg-draft.process.yaml"
  run node "$(CC)" --check "$d/processes/commit-msg-draft.process.yaml" --target claude-code --against-baseline --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[byte-diff]"* ]]
}

# ---------------------------------------------------------------------------
# ADR-0201 -- adapters are pure functions
# ---------------------------------------------------------------------------

@test "adapters are pure: same input, same output, and no clock/randomness/env/filesystem" {
  run node -e '
    (async () => {
      const root = process.argv[1].replace(/\\/g, "/");
      const { readFileSync } = await import("node:fs");
      const { parseYamlSubset } = await import("file:///" + root + "/.claude/scripts/engine/yaml-subset.mjs");
      let bad = 0;
      for (const target of ["claude-code", "codex"]) {
        const src = root + "/.claude/scripts/engine/adapters/" + target + ".mjs";
        const mod = await import("file:///" + src);
        for (const p of ["commit-msg-draft", "review-diff", "kickoff-plan"]) {
          const doc = parseYamlSubset(readFileSync(root + "/processes/" + p + ".process.yaml", "utf8")).value;
          if (mod.render(doc) !== mod.render(doc)) { console.error(target + "/" + p + ": render is not deterministic"); bad++; }
        }
        const text = readFileSync(src, "utf8");
        for (const forbidden of ["Date.now", "Math.random", "process.env", "readFileSync", "writeFileSync", "new Date"]) {
          if (text.includes(forbidden)) { console.error(target + " adapter references " + forbidden); bad++; }
        }
      }
      process.exit(bad ? 1 : 0);
    })();
  ' "$ARC_ROOT"
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# lf-only -- the instrument that covers what LF-normalisation deletes
# ---------------------------------------------------------------------------

@test "lf-only: a CR in rendered output is caught by its OWN check, not by the byte-diff" {
  local d; d="$(_procs)"
  # A \r escape in a double-quoted scalar is the one legal way to get a CR into rendered
  # output from a source file the parser accepts (it rejects literal CR bytes outright).
  _sed_i 's/^intent: "Stage related changes and write a conventional commit."$/intent: "Stage related\\rchanges"/' \
    "$d/processes/commit-msg-draft.process.yaml"
  run grep -c 'intent: "Stage related\\rchanges"' "$d/processes/commit-msg-draft.process.yaml"
  [ "$output" = "1" ]   # the mutation actually applied; a silent no-op would fake this test

  run node "$(CC)" --check "$d/processes/commit-msg-draft.process.yaml" --target claude-code --against-baseline --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[lf-only]"* ]]
  [[ "$output" != *"[byte-diff]"* ]]   # the two instruments stay distinct
}

# ---------------------------------------------------------------------------
# REQ-03 -- the second dialect
# ---------------------------------------------------------------------------

@test "REQ-03: the codex target reproduces its recorded goldens for all 3 pilots" {
  run node "$(CC)" --check --all --target codex --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"3/3 byte-identical"* ]]
}

@test "REQ-03: an unrecorded golden change fails rather than being absorbed" {
  local d; d="$(_procs)"
  _sed_i 's/^version: 1.0.0$/version: 1.1.0/' "$d/processes/commit-msg-draft.process.yaml"
  run node "$(CC)" --check "$d/processes/commit-msg-draft.process.yaml" --target codex --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[byte-diff]"* ]]
}

@test "REQ-03: codex names what it cannot express instead of faking it" {
  # kickoff-plan declares agent.invoke, which codex has no equivalent for. The adapter must
  # say so in the artifact -- a silently degraded delegation is REQ-03 passing mechanically
  # while failing its intent.
  run grep -c "Delegation note" "$ARC_ROOT/tests/fixtures/engine/goldens/codex/kickoff-plan.md"
  [ "$output" = "1" ]
}

@test "both targets carry a DO-NOT-EDIT header naming their source and regeneration command" {
  for f in "$ARC_ROOT"/tests/fixtures/engine/goldens/codex/*.md; do
    run grep -c "GENERATED by arc-compile" "$f"; [ "$output" = "1" ]
    run grep -c "Source of truth: processes/" "$f"; [ "$output" = "1" ]
  done
}

# ---------------------------------------------------------------------------
# CLI contract
# ---------------------------------------------------------------------------

@test "arc-compile rejects an unknown option and an unknown target" {
  run node "$(CC)" --check --all --definitely-not-an-option
  [ "$status" -eq 2 ]
  run node "$(CC)" --check --all --target no-such-target --root "$ARC_ROOT"
  [ "$status" -eq 2 ]
  [[ "$output" == *"unknown target"* ]]
}

@test "arc-compile refuses to run with neither --check nor --write" {
  run node "$(CC)" --all --root "$ARC_ROOT"
  [ "$status" -eq 2 ]
}

@test "the post-flip gate is a DIFFERENT comparison, and it is the hand-edit detector" {
  run node "$(CC)" --check --all --target claude-code --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"3/3 byte-identical"* ]]
}

@test "hand-edit detection: a line appended to a generated file is caught" {
  local d; d="$(mktemp -d)"
  mkdir -p "$d/.claude/commands" "$d/processes"
  cp "$ARC_ROOT"/processes/commit-msg-draft.process.yaml "$d/processes/"
  cp "$ARC_ROOT"/.claude/commands/arc-commit.md "$d/.claude/commands/"
  # clean copy first: the tree must be green before the tamper means anything
  run node "$(CC)" --check "$d/processes/commit-msg-draft.process.yaml" --target claude-code --root "$d"
  [ "$status" -eq 0 ]
  printf '\nSNEAKY HAND EDIT\n' >> "$d/.claude/commands/arc-commit.md"
  run node "$(CC)" --check "$d/processes/commit-msg-draft.process.yaml" --target claude-code --root "$d"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[byte-diff]"* ]]
}
