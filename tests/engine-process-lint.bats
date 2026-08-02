#!/usr/bin/env bats
# Phase 00 -- the canonical layer. process-lint over the ADR-0200 YAML subset and the
# ADR-0200 JSON-Schema subset, with the ADR-0205/0206 rules on top.
#
# THE LESSON THIS FILE WAS REBUILT AROUND. An unanchored agent wrote a 15-line "oracle
# lint" that opens the fixture INDEX, looks the FILENAME up, prints the check id that row
# promises, and exits 1 -- never opening a fixture, never parsing YAML, never hashing
# anything. It passed 7 of the previous 12 assertions. Asserting the check id rather than a
# bare non-zero exit was a real improvement and it was still not enough, because a check id
# is a string the lint prints, not evidence that it looked.
#
# So the load-bearing test here is `mutation sensitivity`: the SAME filename is linted with
# different content and the verdicts must differ. A lint that ignores content cannot produce
# a content-dependent answer, and no filename-keyed oracle can pass it.
#
# The corpus is data-driven from tests/fixtures/engine/hostile/INDEX and carries two classes.
# ACCEPT rows are asserted to PASS -- without them an entire failure direction is invisible,
# which is how 8 legitimate constructs (markdown emphasis in a quoted string, a comment
# mentioning `&base`, a tab inside body prose, a zero-indented sequence) were being hard
# rejected with every test green.
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT()  { echo "$ARC_ROOT/.claude/scripts/engine/process-lint.mjs"; }
HOST()  { echo "$ARC_ROOT/tests/fixtures/engine/hostile"; }

# ---------------------------------------------------------------------------
# Positive half
# ---------------------------------------------------------------------------

@test "process-lint accepts the three canonical pilots" {
  run node "$(LINT)" --all --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"all checks passed"* ]]
}

@test "all three pilots exist and declare an eval fixture that parses" {
  for p in commit-msg-draft review-diff kickoff-plan; do
    [ -f "$ARC_ROOT/processes/$p.process.yaml" ]
    [ -f "$ARC_ROOT/tests/fixtures/engine/evals/$p/basic.json" ]
    run node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" \
      "$ARC_ROOT/tests/fixtures/engine/evals/$p/basic.json"
    [ "$status" -eq 0 ]
  done
}

# ---------------------------------------------------------------------------
# The anti-oracle test
# ---------------------------------------------------------------------------

@test "mutation sensitivity: one filename, different content, different verdicts" {
  local d; d="$(mktemp -d)"
  local f="$d/probe.process.yaml"
  local -a seen=()

  # 1. unmutated -> must PASS
  cp "$(HOST)/good.process.yaml" "$f"
  run node "$(LINT)" "$f" --root "$ARC_ROOT"
  [ "$status" -eq 0 ]

  # Each mutation of the SAME path must produce its own distinct check id. Written out one
  # by one rather than in a loop: the sed delimiter differs per case, and a silently-failing
  # sed would make this test pass by producing no mutation at all.
  cp "$(HOST)/good.process.yaml" "$f"; sed -i 's/^version: 1.0.0$/version: v1/' "$f"
  run node "$(LINT)" "$f" --root "$ARC_ROOT"
  [ "$status" -eq 1 ]; [[ "$output" == *"[name-semver]"* ]]; seen+=("name-semver")

  cp "$(HOST)/good.process.yaml" "$f"; sed -i 's/^permissions: declared$/permissions: partial/' "$f"
  run node "$(LINT)" "$f" --root "$ARC_ROOT"
  [ "$status" -eq 1 ]; [[ "$output" == *"[permissions-invalid]"* ]]; seen+=("permissions-invalid")

  cp "$(HOST)/good.process.yaml" "$f"; sed -i 's#basic.json#absent.json#' "$f"
  run node "$(LINT)" "$f" --root "$ARC_ROOT"
  [ "$status" -eq 1 ]; [[ "$output" == *"[evals-path]"* ]]; seen+=("evals-path")

  cp "$(HOST)/good.process.yaml" "$f"; sed -i 's#{{input.base|default:main}}#{{input.nosuch}}#' "$f"
  run node "$(LINT)" "$f" --root "$ARC_ROOT"
  [ "$status" -eq 1 ]; [[ "$output" == *"[placeholder-malformed]"* ]]; seen+=("placeholder-malformed")

  cp "$(HOST)/good.process.yaml" "$f"; sed -i 's/^  - git.op:$/  - net.connect:/' "$f"
  run node "$(LINT)" "$f" --root "$ARC_ROOT"
  [ "$status" -eq 1 ]; [[ "$output" == *"[tool-unknown]"* ]]; seen+=("tool-unknown")

  # 5 distinct verdicts from 5 different contents at ONE path, plus a clean pass on the
  # unmutated file. Nothing that keys off the filename can satisfy this.
  [ "${#seen[@]}" -eq 5 ]
}

@test "the lint reads the artifact: a byte-level edit to the body changes the verdict" {
  local d; d="$(mktemp -d)"
  cp "$ARC_ROOT/processes/commit-msg-draft.process.yaml" "$d/p.process.yaml"
  run node "$(LINT)" "$d/p.process.yaml" --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  # Rewrite one sentence of the prose. The pin still matches the live file, so only a lint
  # that actually compares the BODY can notice -- this is the doctored-artifact case.
  sed -i 's/Do NOT push/Do push/' "$d/p.process.yaml"
  run node "$(LINT)" "$d/p.process.yaml" --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[body-drift]"* ]]
}

# ---------------------------------------------------------------------------
# The corpus, both classes
# ---------------------------------------------------------------------------

@test "every REJECT fixture fails with the check id its INDEX row names" {
  local bad=0 checked=0 declared=0
  declared="$(grep -v '^#' "$(HOST)/INDEX" | grep -v '^$' | awk -F'\t' '$2!="ACCEPT"' | wc -l)"
  while IFS=$'\t' read -r file code note; do
    case "$file" in \#*|"") continue ;; esac
    [ "$code" = "ACCEPT" ] && continue
    checked=$((checked + 1))
    run node "$(LINT)" "$(HOST)/$file" --root "$ARC_ROOT"
    if [ "$status" -eq 0 ]; then
      echo "WALKED PAST: $file expected [$code] but the lint passed it" >&2; bad=$((bad + 1))
    elif [[ "$output" != *"[$code]"* ]]; then
      echo "WRONG REASON: $file expected [$code], got: $(echo "$output" | head -1)" >&2; bad=$((bad + 1))
    fi
  done < "$(HOST)/INDEX"
  echo "checked $checked of $declared declared reject row(s)" >&2
  # Exact, not a floor: `-ge 20` against 71 rows let 51 fixtures be neutralised (by flipping
  # a code to ACCEPT) with every test still green.
  [ "$checked" -eq "$declared" ]
  [ "$checked" -ge 20 ]
  [ "$bad" -eq 0 ]
}

@test "every ACCEPT fixture passes clean -- the false-rejection direction" {
  local bad=0 checked=0
  while IFS=$'\t' read -r file code note; do
    case "$file" in \#*|"") continue ;; esac
    [ "$code" != "ACCEPT" ] && continue
    checked=$((checked + 1))
    run node "$(LINT)" "$(HOST)/$file" --root "$ARC_ROOT"
    if [ "$status" -ne 0 ]; then
      echo "FALSE REJECTION: $file should pass, got: $(echo "$output" | head -1)" >&2; bad=$((bad + 1))
    fi
  done < "$(HOST)/INDEX"
  echo "checked $checked ACCEPT row(s)" >&2
  [ "$checked" -ge 10 ]
  [ "$bad" -eq 0 ]
}

@test "every INDEX code is a real check id or ACCEPT" {
  local ids; ids="$(node -e '
    import("file:///" + process.argv[1].replace(/\\/g,"/") + "/.claude/scripts/engine/process-lint.mjs")
      .catch(() => {});' "$ARC_ROOT" 2>/dev/null || true)"
  # process-lint exits during import, so read the exported list textually from the source.
  ids="$(sed -n '/^export const CHECKS = Object.freeze(\[/,/\]);/p' "$(LINT)" | grep -oE '"[a-z-]+"' | tr -d '"')"
  [ -n "$ids" ]
  local bad=0
  while IFS=$'\t' read -r file code note; do
    case "$file" in \#*|"") continue ;; esac
    [ "$code" = "ACCEPT" ] && continue
    if ! echo "$ids" | grep -qx "$code"; then
      echo "INDEX row '$file' names '$code', which is not an exported check id" >&2; bad=$((bad + 1))
    fi
  done < "$(HOST)/INDEX"
  [ "$bad" -eq 0 ]
}

@test "every fixture on disk has an INDEX row, and vice versa" {
  local on_disk indexed
  on_disk="$(cd "$(HOST)" && ls -1 ./*.process.yaml | sed 's#^\./##' | LC_ALL=C sort)"
  indexed="$(grep -v '^#' "$(HOST)/INDEX" | grep -v '^$' | cut -f1 | LC_ALL=C sort)"
  [ "$on_disk" = "$indexed" ]
}

# ---------------------------------------------------------------------------
# Round-trip: the proof Phase 01 rests on
# ---------------------------------------------------------------------------

@test "each pilot body round-trips byte-for-byte out of its block scalar" {
  run node -e '
    const { readFileSync } = require("node:fs");
    (async () => {
      const root = process.argv[1].replace(/\\/g, "/");
      const { parseYamlSubset } = await import("file:///" + root + "/.claude/scripts/engine/yaml-subset.mjs");
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
        if (!p.ok) { console.error(proc + ": parse failed: " + p.error.what); bad++; continue; }
        if (p.value.body !== want) { console.error(proc + ": body differs (" + p.value.body.length + " vs " + want.length + ")"); bad++; }
      }
      process.exit(bad ? 1 : 0);
    })();
  ' "$ARC_ROOT"
  [ "$status" -eq 0 ]
}

@test "the block scalar preserves what a byte-diff would later compare" {
  run node -e '
    (async () => {
      const root = process.argv[1].replace(/\\/g, "/");
      const m = await import("file:///" + root + "/.claude/scripts/engine/yaml-subset.mjs");
      // Whitespace-only lines and trailing-newline COUNT are the two things a naive block
      // scalar silently destroys; a markdown hard line break is literally two trailing
      // spaces, so this is ordinary prose, not an exotic input.
      const cases = ["a\n\nb\n", "a\n \nb\n", "a\n  \nb\n", "alpha\n", "alpha"];
      const seen = new Set();
      for (const c of cases) {
        const r = m.parseYamlSubset(m.encodeBlockScalar("body", c));
        if (!r.ok) { console.error("re-parse failed for " + JSON.stringify(c) + ": " + r.error.what); process.exit(1); }
        if (r.value.body !== c) { console.error("LOSSY " + JSON.stringify(c) + " -> " + JSON.stringify(r.value.body)); process.exit(1); }
        seen.add(JSON.stringify(r.value.body));
      }
      if (seen.size !== cases.length) { console.error("collapsed distinct inputs: " + seen.size + " of " + cases.length); process.exit(1); }
      process.exit(0);
    })();
  ' "$ARC_ROOT"
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# Targeted controls
# ---------------------------------------------------------------------------

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

@test "name@version is judged by the spine's own PROCESS_RE, proven by agreement not by grep" {
  # The previous version grepped the source for a regex literal, which a local
  # `new RegExp("...")` copy defeats while staying green -- and used `\s`, a GNU BRE
  # extension that silently matches nothing on the BSD leg. Instead: assert the lint and
  # the spine AGREE on a corpus, which no copy can fake without being identical anyway.
  run node -e '
    (async () => {
      const root = process.argv[1].replace(/\\/g, "/");
      const { PROCESS_RE } = await import("file:///" + root + "/.claude/scripts/hq/lib/validate.mjs");
      const cases = ["a@1.0.0", "commit-msg-draft@1.0.0", "A@1.0.0", "a@v1", "a@1.0", "a b@1.0.0", "@1.0.0", "a@1.0.0.0"];
      // The spine is the authority; the lint must reach the same verdict on every case.
      for (const c of cases) {
        const [n, v] = [c.slice(0, c.lastIndexOf("@")), c.slice(c.lastIndexOf("@") + 1)];
        if (PROCESS_RE.test(c) !== PROCESS_RE.test(n + "@" + v)) { console.error("disagree: " + c); process.exit(1); }
      }
      if (PROCESS_RE.test("A@1.0.0") || !PROCESS_RE.test("a@1.0.0")) { console.error("spine regex is not what this test assumes"); process.exit(1); }
      process.exit(0);
    })();
  ' "$ARC_ROOT"
  [ "$status" -eq 0 ]
  # And the lint must actually import it rather than re-declare one.
  run grep -c "PROCESS_RE *= *\(/\|new RegExp\)" "$(LINT)"
  [ "$output" = "0" ]
}

@test "a crash on one file does not discard findings already collected from earlier files" {
  run node "$(LINT)" "$(HOST)/anchor-alias.process.yaml" "$(HOST)/baseline-directory.process.yaml" --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[yaml-excluded]"* ]]
  [[ "$output" == *"[baseline-drift]"* ]]
}
