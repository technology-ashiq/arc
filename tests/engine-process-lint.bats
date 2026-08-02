#!/usr/bin/env bats
# Phase 00 -- the canonical layer. process-lint over the ADR-0200 YAML subset and the
# ADR-0200 JSON-Schema subset, with the ADR-0205/0206 rules on top.
#
# The load-bearing shape is the NEGATIVE CONTROL, and one notch beyond it: every hostile
# fixture is asserted to fail *with its own check id*, not merely to exit non-zero. A
# fixture that fails for an unintended reason is a false pass, and "exit 1" alone cannot
# tell the two apart -- which is how a control that has never been seen to fail correctly
# ships as a gate (retro-log 2026-08-02).
#
# The corpus is data-driven from tests/fixtures/engine/hostile/INDEX, so adding a fixture
# without an INDEX row (or vice versa) is itself caught here rather than silently reducing
# coverage.
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT()  { echo "$ARC_ROOT/.claude/scripts/engine/process-lint.mjs"; }
HOST()  { echo "$ARC_ROOT/tests/fixtures/engine/hostile"; }

# ---------------------------------------------------------------------------
# The positive half
# ---------------------------------------------------------------------------

@test "process-lint accepts the three canonical pilots" {
  run node "$(LINT)" --all --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"all checks passed"* ]]
}

@test "process-lint accepts the good hostile-corpus base fixture" {
  run node "$(LINT)" "$(HOST)/good.process.yaml" --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
}

@test "all three pilots exist as canonical process files" {
  for p in commit-msg-draft review-diff kickoff-plan; do
    [ -f "$ARC_ROOT/processes/$p.process.yaml" ]
  done
}

@test "every pilot declares an eval fixture that exists" {
  for p in commit-msg-draft review-diff kickoff-plan; do
    [ -f "$ARC_ROOT/tests/fixtures/engine/evals/$p/basic.json" ]
    run node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" \
      "$ARC_ROOT/tests/fixtures/engine/evals/$p/basic.json"
    [ "$status" -eq 0 ]
  done
}

# ---------------------------------------------------------------------------
# The negative half: the whole corpus, each against ITS OWN check id
# ---------------------------------------------------------------------------

@test "every hostile fixture FAILs with the check id its INDEX row names" {
  local bad=0 checked=0
  while IFS=$'\t' read -r file code note; do
    case "$file" in \#*|"") continue ;; esac
    [ "$code" = "ACCEPT" ] && continue
    checked=$((checked + 1))
    run node "$(LINT)" "$(HOST)/$file" --root "$ARC_ROOT"
    if [ "$status" -eq 0 ]; then
      echo "WALKED PAST: $file expected [$code] but the lint passed it" >&2
      bad=$((bad + 1))
    elif [[ "$output" != *"[$code]"* ]]; then
      echo "WRONG REASON: $file expected [$code], got: $(echo "$output" | head -1)" >&2
      bad=$((bad + 1))
    fi
  done < "$(HOST)/INDEX"
  echo "checked $checked hostile fixture(s)" >&2
  [ "$checked" -ge 20 ]
  [ "$bad" -eq 0 ]
}

@test "every hostile fixture on disk has an INDEX row, and vice versa" {
  local on_disk indexed
  on_disk="$(cd "$(HOST)" && ls -1 ./*.process.yaml | sed 's#^\./##' | sort)"
  indexed="$(grep -v '^#' "$(HOST)/INDEX" | grep -v '^$' | cut -f1 | sort)"
  [ "$on_disk" = "$indexed" ]
}

# ---------------------------------------------------------------------------
# Round-trip: the proof Phase 01 actually rests on
# ---------------------------------------------------------------------------

@test "each pilot body round-trips byte-for-byte out of its block scalar" {
  run node -e '
    const { readFileSync } = require("node:fs");
    (async () => {
      const root = process.argv[1];
      const { parseYamlSubset } = await import("file:///" + root.replace(/\\\\/g, "/") + "/.claude/scripts/engine/yaml-subset.mjs");
      const norm = (s) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const cases = [
        ["commit-msg-draft", ".claude/commands/arc-commit.md", []],
        ["review-diff", ".claude/commands/arc-review.md", [[/\$\{1:-main\}/g, "{{input.base|default:main}}"]]],
        ["kickoff-plan", ".claude/commands/arc-kickoff.md", [[/\$ARGUMENTS\b/g, "{{input.goal}}"]]],
      ];
      let bad = 0;
      for (const [proc, src, subs] of cases) {
        let want = norm(readFileSync(root + "/" + src, "utf8")).match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)[1];
        for (const [re, to] of subs) want = want.replace(re, to);
        const p = parseYamlSubset(readFileSync(root + "/processes/" + proc + ".process.yaml", "utf8"));
        if (!p.ok) { console.error(proc + ": parse failed"); bad++; continue; }
        if (p.value.body !== want) { console.error(proc + ": body differs (" + p.value.body.length + " vs " + want.length + ")"); bad++; }
      }
      process.exit(bad ? 1 : 0);
    })();
  ' "$ARC_ROOT"
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# Targeted controls for the rules that are easiest to get subtly wrong
# ---------------------------------------------------------------------------

@test "the empty flow literals are permitted but a non-empty one is not" {
  local t; t="$(mktemp -d)"
  sed 's/^inputs:$/inputs: []/; /^  - name: base$/,/^    description: "base-branch"$/d' \
    "$(HOST)/good.process.yaml" > "$t/empty.process.yaml"
  # the body still references {{input.base}}, so strip it to keep this test about flow style
  sed -i 's/{{input.base|default:main}}/nothing/' "$t/empty.process.yaml"
  run node "$(LINT)" "$t/empty.process.yaml" --root "$ARC_ROOT"
  [ "$status" -eq 0 ]

  run node "$(LINT)" "$(HOST)/flow-collection.process.yaml" --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[yaml-excluded]"* ]]
}

@test "a CRLF source file is yaml-parse, never lf-only (different artifacts, different checks)" {
  run node "$(LINT)" "$(HOST)/crlf.process.yaml" --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[yaml-parse]"* ]]
  [[ "$output" != *"[lf-only]"* ]]
}

@test "process-lint reports the line number of the offending construct" {
  run node "$(LINT)" "$(HOST)/tab-indent.process.yaml" --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" =~ tab-indent\.process\.yaml:[0-9]+ ]]
}

@test "an unknown option is rejected rather than silently ignored" {
  run node "$(LINT)" --definitely-not-an-option
  [ "$status" -eq 2 ]
}

@test "process-lint asserts name@version against the spine's own PROCESS_RE, not a copy" {
  run grep -q 'from "../hq/lib/validate.mjs"' "$(LINT)"
  [ "$status" -eq 0 ]
  run grep -c 'PROCESS_RE\s*=\s*/' "$(LINT)"
  [ "$output" = "0" ]
}
