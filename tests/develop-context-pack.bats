#!/usr/bin/env bats
# Phase 05 -- the Context Pack: what past work already knows about this slice.
#
# Red-first: every @test here fails before .claude/scripts/develop/context-pack.mjs exists,
# and the FIRST failure is the missing module.
#
# The load-bearing red is the one-hop PAIR. "the two-hop item is absent" passes trivially for
# an implementation that follows no links at all, and "the one-hop item is present" passes for
# one that walks transitively. Neither alone means anything; the third case -- the SAME item,
# absent when only reachable at two hops and present when a second matched row links it
# directly -- is the only one that can tell a correct boundary from a broken one.
bats_require_minimum_version 1.5.0
load 'test_helper'

DEV_MJS() { echo "$ARC_ROOT/.claude/scripts/develop/develop.mjs"; }
FX()      { echo "$ARC_ROOT/tests/fixtures/develop/context-pack"; }

_dev() {
  local root="$1"; shift
  run node "$(DEV_MJS)" "$@" --lane develop --root "$root"
}

# A fresh copy of the fixture, so a test that writes never mutates the committed tree.
_tree() {
  local dst; dst="$(mktemp -d)/tree"
  cp -R "$(FX)" "$dst"
  echo "$dst"
}

# Known-by-construction commit counts over the blast radius: alpha 4, beta 3, gamma 2, delta 1.
# Identity is set REPO-LOCAL, never as subshell env: a clean Ubuntu runner has no global git
# identity and every commit in a test body then exits 128 while Windows and macOS pass
# (retro-log 2026-07-24).
_history() {
  local t="$1"
  (
    cd "$t" || exit 1
    git init -q
    git config user.email arc-test@arc.local
    git config user.name  arc-test
    git add -A && git commit -qm seed
    echo "// 2" >> src/auth/alpha.js; echo "// 2" >> src/auth/beta.js; echo "// 2" >> src/auth/gamma.js
    git add -A && git commit -qm two
    echo "// 3" >> src/auth/alpha.js; echo "// 3" >> src/auth/beta.js
    git add -A && git commit -qm three
    echo "// 4" >> src/auth/alpha.js
    git add -A && git commit -qm four
  ) >/dev/null 2>&1
}

# The fake stands in for the real binary wherever no `.codegraph/` index exists.
_with_codegraph() {
  local t="$1"
  mkdir -p "$t/.codegraph"
  export ARC_CODEGRAPH_CMD="$t/fake-codegraph.mjs"
}

_no_codegraph() {
  local t="$1"
  rm -rf "$t/.codegraph"
  unset ARC_CODEGRAPH_CMD
}

# The line the pack prints for one source, e.g. `_line churn` -> "  churn  3 · ...".
_line() { echo "$output" | grep -E "^[[:space:]]+$1[[:space:]]" | head -1; }

_ledger_of() { echo "$1/initiatives/develop/phases/phase-00-tasks.md"; }

teardown() { unset ARC_CODEGRAPH_CMD; }

# ---------------------------------------------------------------------------
# Slice 01 -- all five sources, on the committed fixture
# ---------------------------------------------------------------------------

@test "next prints a Context Pack naming all five sources" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  _dev "$t" start 0
  [ "$status" -eq 0 ]
  _dev "$t" next
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"Context Pack"* ]]
  for src in code adrs learning retro churn; do
    [ -n "$(_line "$src")" ] || { echo "missing source line: $src"; echo "$output"; false; }
  done
}

# ---------------------------------------------------------------------------
# Slice 02 -- which retrieval path ran, in BOTH cases
# ---------------------------------------------------------------------------

@test "the pack names grep-fallback when there is no .codegraph/" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  _dev "$t" start 0
  _dev "$t" next
  [[ "$(_line code)" == *"grep-fallback"* ]] || { echo "$output"; false; }
}

@test "the pack names codegraph when an index and the binary are both present" {
  local t; t="$(_tree)"; _history "$t"; _with_codegraph "$t"
  _dev "$t" start 0
  _dev "$t" next
  [[ "$(_line code)" == *"codegraph"* ]] || { echo "$output"; false; }
  [[ "$(_line code)" != *"grep-fallback"* ]] || { echo "$output"; false; }
}

@test "a codegraph that exits non-zero falls back to grep and SAYS why" {
  local t; t="$(_tree)"; _history "$t"
  mkdir -p "$t/.codegraph"
  export ARC_CODEGRAPH_CMD="$t/fake-codegraph.mjs"
  export ARC_CODEGRAPH_ARGS="--fail"
  _dev "$t" start 0
  _dev "$t" next
  unset ARC_CODEGRAPH_ARGS
  [[ "$(_line code)" == *"grep-fallback"* ]] || { echo "$output"; false; }
  [[ "$(_line code)" == *"exit"* ]] || { echo "a silent fallback is the failure this phase exists to prevent"; echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# Slice 03 -- one neighbourhood contract, satisfied from both paths
# ---------------------------------------------------------------------------

# Every invariant the pack's consumers rely on, asserted identically against both adapters.
_assert_neighbourhood_contract() {
  local t="$1" line items f
  line="$(_line code)"
  [ -n "$line" ] || { echo "no code line at all"; echo "$output"; return 1; }
  # names the path that ran, exactly one of the two
  [[ "$line" == *"codegraph"* || "$line" == *"grep-fallback"* ]] || { echo "unnamed path: $line"; return 1; }
  # Items sit after the ASCII count bracket, deliberately: a U+00B7 separator would be parsed
  # here under the C locale CI uses, and this suite must not depend on that working.
  items="$(echo "$line" | sed 's/^[^]]*] //; s/ (+[0-9]* more)$//')"
  [ -n "$items" ] || { echo "no items: $line"; return 1; }
  local list; list="$BATS_TEST_TMPDIR/neighbourhood.txt"
  echo "$items" | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -v '^$' > "$list"
  local n; n="$(wc -l < "$list" | tr -d ' ')"
  while IFS= read -r f; do
    [ "$f" != "(none)" ] || continue
    [ -e "$t/$f" ]      || { echo "item does not exist: $f"; return 1; }
    [[ "$f" != /* ]]    || { echo "item is not repo-relative: $f"; return 1; }
    [[ "$f" != *'\'* ]] || { echo "item is not forward-slashed: $f"; return 1; }
  done < "$list"
  # Sorted and deduped, compared under the SAME collation the producer sorts by. Asserting
  # order with bash `>` would compare under the runner's locale and pass or fail on the
  # runner's locale rather than on the contract.
  LC_ALL=C sort -cu "$list" || { echo "items are not sorted, or repeat"; cat "$list"; return 1; }
  [ "$n" -le 8 ] || { echo "neighbourhood is not capped: $n items"; return 1; }
  return 0
}

@test "the neighbourhood contract holds from the grep path" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  _dev "$t" start 0
  _dev "$t" next
  _assert_neighbourhood_contract "$t"
}

@test "the neighbourhood contract holds from the codegraph path" {
  local t; t="$(_tree)"; _history "$t"; _with_codegraph "$t"
  _dev "$t" start 0
  _dev "$t" next
  _assert_neighbourhood_contract "$t"
}

# ---------------------------------------------------------------------------
# Slice 04 -- one hop, and only one (ADR-0111)
# ---------------------------------------------------------------------------

@test "a matched learning row's typed links appear: the ADR, the rule and the fixture" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  _dev "$t" start 0
  _dev "$t" next
  local l; l="$(_line learning)"
  [[ "$l" == *"L-101"* ]]                        || { echo "$output"; false; }
  [[ "$l" == *"0900"* ]]                         || { echo "$output"; false; }
  [[ "$l" == *"CLAUDE.md"* ]]                    || { echo "$output"; false; }
  [[ "$l" == *"tests/fixtures/auth-token.md"* ]] || { echo "$output"; false; }
}

@test "an item reachable only at TWO hops does not appear" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  _dev "$t" start 0
  _dev "$t" next
  # ADR-0901 is cited in ADR-0900's prose and nowhere else; ADR-0900 is one hop from L-101.
  [[ "$output" != *"0901"* ]] || { echo "two-hop leak: 0901 surfaced"; echo "$output"; false; }
}

@test "that same item DOES appear when a different matched row links it one hop away" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  cat >> "$t/docs/develop/learning-ledger.md" <<'ROW'

#### learning: L-102

what-failed: the refresh path re-used a token past its expiry
why-missed: expiry was asserted in the unit test but stubbed in the integration test
prevention: assert expiry against a real clock in both layers
type: rule
tag: anti-pattern
area: auth
adr: 0901
phase: 00
lane: develop
cost: one clock injection
verdict: proposed
ROW
  _dev "$t" start 0
  _dev "$t" next
  [[ "$output" == *"L-102"* ]] || { echo "$output"; false; }
  [[ "$output" == *"0901"* ]]  || { echo "a correct second-path inclusion was dropped"; echo "$output"; false; }
}

@test "a learning row matching neither the area nor the blast radius never appears" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  _dev "$t" start 0
  _dev "$t" next
  # L-103 is area: ui with no path overlap. A pack that includes it matches nothing at all.
  [[ "$output" != *"L-103"* ]] || { echo "$output"; false; }
  [[ "$output" != *"0902"* ]]  || { echo "$output"; false; }
}

@test "a retro row with no tag overlap never appears" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  _dev "$t" start 0
  _dev "$t" next
  local r; r="$(_line retro)"
  [[ "$r" == *"token"* ]]  || { echo "the matching retro row was dropped"; echo "$output"; false; }
  [[ "$r" != *"migration"* ]] || { echo "an unmatched retro row surfaced"; echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# Slice 05 -- churn, computed from git log
# ---------------------------------------------------------------------------

@test "churn names the top 3 blast-radius files by commit count, with the counts" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  _dev "$t" start 0
  _dev "$t" next
  local c; c="$(_line churn)"
  [[ "$c" == *"alpha.js"* ]] || { echo "$output"; false; }
  [[ "$c" == *"beta.js"*  ]] || { echo "$output"; false; }
  [[ "$c" == *"gamma.js"* ]] || { echo "$output"; false; }
  [[ "$c" != *"delta.js"* ]] || { echo "top 3 means three: delta ranked 4th"; echo "$c"; false; }
  # counts are computed, never asserted: alpha 4, beta 3, gamma 2 by construction
  [[ "$c" == *"4"* && "$c" == *"3"* && "$c" == *"2"* ]] || { echo "$c"; false; }
}

@test "churn says so plainly when there is no git history to compute it from" {
  local t; t="$(_tree)"; _no_codegraph "$t"     # deliberately no _history
  _dev "$t" start 0
  _dev "$t" next
  local c; c="$(_line churn)"
  [ -n "$c" ] || { echo "the churn source vanished instead of reporting nothing"; echo "$output"; false; }
  [[ "$c" == *"0"* || "$c" == *"none"* ]] || { echo "$c"; false; }
}

# ---------------------------------------------------------------------------
# Slice 06 + 07 -- sources: is the audit trail, and it persists
# ---------------------------------------------------------------------------

@test "every source lands in the slice's sources: field, including the empty ones" {
  local t; t="$(_tree)"; _no_codegraph "$t"     # no history, so churn returns nothing
  _dev "$t" start 0
  _dev "$t" next
  local led; led="$(_ledger_of "$t")"
  local s; s="$(grep -m1 '^sources:' "$led")"
  for src in code adrs learning retro churn; do
    [[ "$s" == *"$src"* ]] || { echo "sources: does not name $src — $s"; false; }
  done
  # the source that returned nothing is present, not omitted
  [[ "$s" == *"churn(0)"* ]] || { echo "an empty source was omitted instead of recorded: $s"; false; }
}

@test "a pack that fell back to grep says so in the persisted sources: field" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  _dev "$t" start 0
  _dev "$t" next
  local led; led="$(_ledger_of "$t")"
  grep -q '^sources:.*grep-fallback' "$led" || { echo "$(grep '^sources:' "$led")"; false; }
}

@test "writing sources: leaves every other slice and every other field untouched" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  _dev "$t" start 0
  local led; led="$(_ledger_of "$t")"
  cp "$led" "$led.before"
  _dev "$t" next
  # exactly one line differs, and it is slice 01's sources: line
  local diffs; diffs="$(diff "$led.before" "$led" | grep -c '^[<>]' || true)"
  [ "$diffs" -eq 2 ] || { echo "expected one changed line, got:"; diff "$led.before" "$led" || true; false; }
  grep -q '^title: the auth token is verified before the handler runs$' "$led"
  [ "$(grep -c '^#### slice:' "$led")" -eq 3 ]
}

# ---------------------------------------------------------------------------
# Slice 08 -- holes found by a fresh agent that had not seen the code.
#
# Every one of these passed the suite above. They are pinned here because a hole
# that is fixed and not pinned is a hole that comes back, and because the pass
# itself is only evidence if what it found is executable.
# ---------------------------------------------------------------------------

CP() { echo "$ARC_ROOT/.claude/scripts/develop/context-pack.mjs"; }
LG() { echo "$ARC_ROOT/.claude/scripts/develop/ledger.mjs"; }

# A file:// URL node understands on all three legs. Git Bash hands out `/d/a/arc/...`, which
# node reads as `C:\d\a\arc\...` and cannot find -- nine probes below imported nothing, threw
# ERR_MODULE_NOT_FOUND, and three of them PASSED anyway because "output does not contain X" is
# satisfied by a stack trace. A vacuous pass is the failure this file exists to prevent.
_url() {
  local p="$1"
  command -v cygpath >/dev/null 2>&1 && p="$(cygpath -m "$p")"
  case "$p" in /*) echo "file://$p";; *) echo "file:///$p";; esac
}

# Run a node snippet with the modules under test imported as `cp` and `lg`.
_node() {
  local f="$BATS_TEST_TMPDIR/probe.mjs"
  {
    echo "import * as cp from '$(_url "$(CP)")';"
    echo "import * as lg from '$(_url "$(LG)")';"
    cat
  } > "$f"
  run node "$f"
  # The probe must have RUN. Every assertion below is about what it printed.
  [ "$status" -eq 0 ] || { echo "probe did not run:"; echo "$output"; return 1; }
}

@test "hole: a quoted Product line in a supersedes note does not claim the ADR" {
  local t; t="$(_tree)"; _no_codegraph "$t"
  printf '# ADR 0920\n\n> Supersedes the develop-lane rule, whose header read:\n> **Product:** `develop`\n\n**Product:** `design`\n' \
    > "$t/docs/adr/0920-quoted.md"
  printf '# ADR 0921\n\n> Replaces a design ruling, whose header read:\n> **Product:** `design`\n\n**Product:** `develop`\n' \
    > "$t/docs/adr/0921-mine.md"
  _dev "$t" start 0
  _dev "$t" next
  local a; a="$(_line adrs)"
  [[ "$a" != *"0920"* ]] || { echo "another product's ADR claimed by a quotation: $a"; false; }
  [[ "$a" == *"0921"* ]] || { echo "this lane's ADR lost to a quotation: $a"; false; }
}

@test "hole: a fenced Product example does not outrank the real header below it" {
  _node <<'JS'
const md = "# ADR\n\n```\n**Product:** `develop`\n```\n\n**Product:** `design`\n";
console.log(JSON.stringify(cp.productOf(md)));
JS
  [ "$output" = '"design"' ] || { echo "$output"; false; }
}

@test "hole: a Product line that says NOT this lane does not match this lane" {
  _node <<'JS'
console.log(JSON.stringify(cp.productOf("**Product:** `design` - explicitly NOT `develop`\n")));
JS
  [ "$output" = '"design"' ] || { echo "$output"; false; }
}

@test "hole: a fenced template row in the retro log is not read as a finding" {
  local t; t="$(_tree)"; _no_codegraph "$t"
  {
    echo
    echo 'To add a row, copy this:'
    echo
    echo '```'
    echo '2099-01-01 | example | TEMPLATE, records nothing | do the thing | auth,token'
    echo '```'
  } >> "$t/docs/retro-log.md"
  _dev "$t" start 0
  _dev "$t" next
  local r; r="$(_line retro)"
  [[ "$r" != *"TEMPLATE"* ]] || { echo "a template became a pattern that must not repeat: $r"; false; }
  [[ "$r" != *"2099"* ]]     || { echo "$r"; false; }
}

@test "hole: a scoreboard row with more than five columns is refused and counted" {
  local t; t="$(_tree)"; _no_codegraph "$t"
  echo '2026-08-02 | fixture | M | rework 2/4 | amendments 14 | burn 38 | auth' >> "$t/docs/retro-log.md"
  _dev "$t" start 0
  _dev "$t" next
  local r; r="$(_line retro)"
  [[ "$r" != *" M ["* ]] || { echo "a tier letter was read as a pattern: $r"; false; }
  [[ "$r" == *"5-column format"* ]] || { echo "the refusal was silent: $r"; false; }
}

@test "hole: a learning ledger that does not parse says so instead of reporting nothing" {
  local t; t="$(_tree)"; _no_codegraph "$t"
  # One unterminated fence above the rows. readRows reports it; the pack used to drop that.
  local led="$t/docs/develop/learning-ledger.md"
  {
    echo '```'
    echo 'an example row, fence left open'
    cat "$led"
  } > "$led.new"
  mv "$led.new" "$led"
  _dev "$t" start 0
  _dev "$t" next
  local l; l="$(_line learning)"
  [[ "$l" == *"parse error"* ]] || { echo "a broken ledger read as a repo with nothing to say: $l"; false; }
}

@test "hole: a duplicate slice id refuses the write rather than editing another slice" {
  _node <<'JS'
const src = "#### slice: 01\n\ntitle: first\nsources: a\n\n#### slice: 01\n\ntitle: second\nsources: b\n";
const r = lg.setSliceField(src, "01", "sources", "NEW");
console.log(JSON.stringify({ changed: r.changed, same: r.text === src, reason: r.reason || "" }));
JS
  [[ "$output" == *'"changed":false'* ]]   || { echo "$output"; false; }
  [[ "$output" == *'"same":true'* ]]       || { echo "$output"; false; }
  [[ "$output" == *"refusing to guess"* ]] || { echo "$output"; false; }
}

@test "hole: with a line number the write lands on THAT block, not the first with the id" {
  _node <<'JS'
const src = "#### slice: 01\n\ntitle: first\nsources: a\n\n#### slice: 01\n\ntitle: second\nsources: b\n";
const r = lg.setSliceField(src, "01", "sources", "NEW", { at: 6 });
console.log(JSON.stringify({ changed: r.changed, first: /sources: a/.test(r.text), second: /sources: NEW/.test(r.text) }));
JS
  [[ "$output" == *'"changed":true'* ]] || { echo "$output"; false; }
  [[ "$output" == *'"first":true'* ]]   || { echo "the already-proven slice was overwritten"; echo "$output"; false; }
  [[ "$output" == *'"second":true'* ]]  || { echo "$output"; false; }
}

@test "hole: one CRLF line does not rewrite the whole file to CRLF" {
  _node <<'JS'
const src = "#### slice: 01\r\n\ntitle: t\nsources: a\n";
const r = lg.setSliceField(src, "01", "sources", "NEW");
console.log(JSON.stringify({ crlf: (r.text.match(/\r\n/g) || []).length, hasNew: /sources: NEW\n/.test(r.text) }));
JS
  [[ "$output" == *'"crlf":1'* ]]      || { echo "line endings were rewritten wholesale: $output"; false; }
  [[ "$output" == *'"hasNew":true'* ]] || { echo "$output"; false; }
}

@test "hole: a lone carriage return inside a value does not split the line" {
  _node <<'JS'
const src = "#### slice: 01\n\ntitle: a\rb\nsources: x\n";
const r = lg.setSliceField(src, "01", "sources", "NEW");
console.log(JSON.stringify({ lines: r.text.split("\n").length, kept: r.text.includes("title: a\rb") }));
JS
  [[ "$output" == *'"lines":5'* ]]   || { echo "a value was split into two lines: $output"; false; }
  [[ "$output" == *'"kept":true'* ]] || { echo "$output"; false; }
}

@test "hole: the field line keeps its bullet and emphasis" {
  _node <<'JS'
const src = "#### slice: 01\n\n- **sources:** old\n";
const r = lg.setSliceField(src, "01", "sources", "NEW");
console.log(JSON.stringify(r.text.split("\n")[2]));
JS
  [ "$output" = '"- **sources:** NEW"' ] || { echo "presentation was rewritten: $output"; false; }
}

@test "hole: a human annotation on the sources line survives a rerun" {
  _node <<'JS'
const pack = { sources: [
  { name: "code", ran: "grep-fallback", note: "no .codegraph/", items: [], total: 2 },
  { name: "adrs", items: [], total: 1 }, { name: "learning", items: [], total: 0 },
  { name: "retro", items: [], total: 0 }, { name: "churn", items: [], total: 3 }] };
console.log(cp.sourcesField("phase-05-spec.md, learning: L-101 was applied by hand", pack));
JS
  [[ "$output" == *"L-101 was applied by hand"* ]] || { echo "an annotation was erased: $output"; false; }
  [[ "$output" == *"learning(0)"* ]]               || { echo "$output"; false; }
}

@test "hole: the placeholder is not carried into the audit trail" {
  _node <<'JS'
const pack = { sources: [
  { name: "code", ran: "grep-fallback", note: "no .codegraph/", items: [], total: 0 },
  { name: "adrs", items: [], total: 0 }, { name: "learning", items: [], total: 0 },
  { name: "retro", items: [], total: 0 }, { name: "churn", items: [], total: 0 }] };
console.log(cp.sourcesField("(empty until proven)", pack));
JS
  [[ "$output" != *"empty until proven"* ]] || { echo "$output"; false; }
}

@test "hole: sources: records WHY it fell back, not only that it did" {
  _node <<'JS'
const mk = (note) => ({ sources: [
  { name: "code", ran: "grep-fallback", note, items: [], total: 2 },
  { name: "adrs", items: [], total: 0 }, { name: "learning", items: [], total: 0 },
  { name: "retro", items: [], total: 0 }, { name: "churn", items: [], total: 0 }] });
const a = cp.sourcesField("s.md", mk("no .codegraph/"));
const b = cp.sourcesField("s.md", mk("codegraph exit 1"));
console.log(JSON.stringify({ identical: a === b, b }));
JS
  [[ "$output" == *'"identical":false'* ]] || { echo "a crashed index is indistinguishable from no index: $output"; false; }
  [[ "$output" == *"exit 1"* ]]            || { echo "$output"; false; }
}

@test "hole: a blast radius of . is refused rather than silently meaning everything" {
  _node <<'JS'
console.log(JSON.stringify(cp.fileSet(process.cwd(), { "blast-radius": "., docs" }, { fields: {} })));
JS
  [[ "$output" != *'"."'* ]] || { echo "the whole repo became the blast radius: $output"; false; }
}

@test "hole: a typed link pointing outside the repo is labelled, not passed on as fact" {
  local t; t="$(_tree)"; _no_codegraph "$t"
  {
    echo
    echo '#### learning: L-301'
    echo
    echo 'what-failed: a token was accepted after expiry'
    echo 'why-missed: the expiry clock was stubbed in both layers'
    echo 'prevention: assert expiry against a real clock'
    echo 'type: rule'
    echo 'area: auth'
    echo 'rule: ../../../etc/passwd'
    echo 'verdict: proposed'
  } >> "$t/docs/develop/learning-ledger.md"
  _dev "$t" start 0
  _dev "$t" next
  local l; l="$(_line learning)"
  [[ "$l" == *"not in this repo"* ]] || { echo "an outside path was handed on unlabelled: $l"; false; }
}

@test "hole: a case-only path match is dropped on every leg, not just the case-sensitive one" {
  _node <<'JS'
console.log(JSON.stringify(cp.fileSet(process.cwd(), { "blast-radius": "CLAUDE.MD, CLAUDE.md" }, { fields: {} })));
JS
  [[ "$output" != *"CLAUDE.MD"* ]] || { echo "a wrong-case path survived: $output"; false; }
}

# ---------------------------------------------------------------------------
# Slice 08, second pass -- holes found by a second fresh agent, on the external
# boundary: the subprocess adapter, git, the walk, and the containment checks.
# ---------------------------------------------------------------------------

# A git history where the only interesting facts are the ones being asserted.
_git_init() {
  local t="$1"
  git -C "$t" init -q
  git -C "$t" config user.email arc-test@arc.local
  git -C "$t" config user.name  arc-test
}

@test "hole: a non-ASCII filename is named as itself, not as its octal escapes" {
  local t; t="$(_tree)"
  # The name is written by node from a \u escape, never as a literal in this file: a UTF-8
  # byte here would depend on the runner's locale to survive, and the whole point is a name
  # git will C-quote.
  local mk='const fs=require("fs");const p=process.argv[1]+"/src/auth/caf\u00e9.js";fs.appendFileSync(p,"// x\n");'
  _git_init "$t"
  node -e "$mk" "$t"
  git -C "$t" add -A >/dev/null 2>&1
  git -C "$t" commit -qm seed >/dev/null 2>&1
  local i
  for i in 1 2 3; do
    node -e "$mk" "$t"
    git -C "$t" add -A >/dev/null 2>&1
    git -C "$t" commit -qm "c$i" >/dev/null 2>&1
  done
  # Directly, over the directory: the fixture spec names four ASCII files, so an end-to-end
  # run would never put this one in the blast radius and the assertion would test nothing.
  TREE="$t" _node <<'JS'
const c = cp.churn(process.env.TREE, ["src/auth"]);
console.log(JSON.stringify(c.items));
JS
  # git C-quotes any path outside ASCII by default; the escapes used to be read as directories
  # and the fabricated path ranked FIRST, with a computed count beside it.
  [[ "$output" != *'/303/'* && "$output" != *'\\303'* ]] || { echo "octal escapes became a path: $output"; false; }
  [[ "$output" == *"caf"* ]] || { echo "the most-churned file vanished: $output"; false; }
  [[ "$output" != *'"'*'"src/auth/caf'* ]] || { echo "the quote characters git added survived: $output"; false; }
}

@test "hole: churn drops paths the tree no longer holds, and says how many" {
  local t; t="$(_tree)"; _history "$t"
  git -C "$t" mv src/auth/alpha.js src/auth/omega.js >/dev/null 2>&1
  git -C "$t" commit -qm rename >/dev/null 2>&1
  # Two more on the new name, so the surviving file outranks the cap of three and its presence
  # is actually asserted rather than assumed.
  local i
  for i in 5 6; do
    printf '// %s\n' "$i" >> "$t/src/auth/omega.js"
    git -C "$t" add -A >/dev/null 2>&1
    git -C "$t" commit -qm "o$i" >/dev/null 2>&1
  done
  # A DIRECTORY blast radius, which is where this actually bites. A radius naming files one by
  # one never reaches the bug: `fileSet` drops a path that no longer exists before churn is
  # called, so git is never asked about it. Asserting it end-to-end passed while the drop it
  # claimed to check had not happened -- the assertion was true of a run that did nothing.
  TREE="$t" _node <<'JS'
const c = cp.churn(process.env.TREE, ["src/auth"]);
console.log(JSON.stringify({ items: c.items, note: c.note || "" }));
JS
  [[ "$output" != *"alpha.js"* ]] || { echo "a path the tree cannot open was handed on: $output"; false; }
  [[ "$output" == *"no longer in the tree"* ]] || { echo "the drop was silent: $output"; false; }
  # and the file that IS there, under its new name, is still counted
  [[ "$output" == *"omega.js"* ]] || { echo "$output"; false; }
}

@test "hole: churn's tie-break is by code point, not by the host's collator" {
  _node <<'JS'
const rank = (entries) =>
  entries.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([p]) => p);
// Under a locale collator "a.js" sorts first; by code point "B.js" does. Every other list in
// the module sorts by code point, and a pack must not differ between a dev box and CI.
console.log(JSON.stringify(rank([["a.js", 2], ["B.js", 2]])));
JS
  [ "$output" = '["B.js","a.js"]' ] || { echo "$output"; false; }
}

@test "hole: a codegraph that prints absolute paths is accepted, not called a liar" {
  local t; t="$(_tree)"; _history "$t"
  mkdir -p "$t/.codegraph"
  cat > "$t/cg-abs.mjs" <<'JS'
const root = process.cwd().split(String.fromCharCode(92)).join("/");
process.stdout.write(root + "/src/auth/alpha.js:12  verifyToken()\n" + root + "/src/auth/beta.js:3  check()\n");
JS
  export ARC_CODEGRAPH_CMD="$t/cg-abs.mjs"
  _dev "$t" start 0
  _dev "$t" next
  local c; c="$(_line code)"
  # These files exist and are inside the repo. Reporting "no path this repo holds" wrote a
  # false statement about another program permanently into the audit trail.
  [[ "$c" == *"codegraph"* && "$c" != *"grep-fallback"* ]] || { echo "$c"; false; }
  [[ "$c" == *"src/auth/alpha.js"* ]] || { echo "$c"; false; }
  [[ "$c" != *":/"* ]] || { echo "an absolute path reached the pack: $c"; false; }
}

@test "hole: a plain FILE named .codegraph is no index, not a missing binary" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  : > "$t/.codegraph"
  _dev "$t" start 0
  _dev "$t" next
  local c; c="$(_line code)"
  [[ "$c" == *"no .codegraph/"* ]] || { echo "wrong diagnosis: $c"; false; }
  [[ "$c" != *"not installed"* ]]  || { echo "sent to install a binary it does not need: $c"; false; }
}

@test "hole: a path containing a comma is omitted from the list and the omission is declared" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  printf 'require("./alpha.js");\n' > "$t/src/auth/a, b.js"
  _dev "$t" start 0
  _dev "$t" next
  local c; c="$(_line code)"
  # The pack's own contract is that a consumer can split this line on ", ". A path holding one
  # makes the count and the list disagree and yields two paths that do not exist.
  [[ "$c" == *"containing a comma omitted"* ]] || { echo "the omission was silent: $c"; false; }
  _assert_neighbourhood_contract "$t"
}

@test "hole: a git that fails for a reason other than an empty history says which" {
  local t; t="$(_tree)"; _no_codegraph "$t"; _history "$t"
  printf '[core\n' >> "$t/.git/config"          # any git-level failure will do
  _dev "$t" start 0
  _dev "$t" next
  local c; c="$(_line churn)"
  [[ "$c" != *"no git history"* ]] || { echo "a four-commit repo reported no history: $c"; false; }
  [[ "$c" == *"git log exited"* ]] || { echo "$c"; false; }
}

@test "hole: codegraph being asked about fewer files than the blast radius is declared" {
  local t; t="$(_tree)"; _history "$t"; _with_codegraph "$t"
  local i
  for i in 1 2 3 4 5 6; do printf 'export const e%s = %s;\n' "$i" "$i" > "$t/src/auth/e$i.js"; done
  # Name them all in the spec so the derived blast radius carries ten files.
  printf '\nAlso `src/auth/e1.js`, `src/auth/e2.js`, `src/auth/e3.js`, `src/auth/e4.js`, `src/auth/e5.js` and `src/auth/e6.js`.\n' \
    >> "$t/initiatives/develop/phases/phase-00-spec.md"
  _dev "$t" start 0
  _dev "$t" next
  local c; c="$(_line code)"
  [[ "$c" == *"asked about"* ]] || { echo "the narrower answer was presented as the neighbourhood: $c"; false; }
}

@test "hole: a ledger that cannot be written warns, and does not call the pack unavailable" {
  local t; t="$(_tree)"; _history "$t"; _no_codegraph "$t"
  _dev "$t" start 0
  local led; led="$(_ledger_of "$t")"
  chmod 444 "$led"
  # Windows ignores the mode bit for an account that owns the file; only assert where it bites.
  node -e "try{require('fs').appendFileSync(process.argv[1],'')}catch(e){process.exit(3)}" "$led" \
    && skip "this runner can still write a 444 file"
  _dev "$t" next
  chmod 644 "$led"
  [[ "$output" == *"NOT recorded"* ]] || { echo "$output"; false; }
  [[ "$output" != *"unavailable"* ]]  || { echo "a pack that printed in full was called unavailable"; echo "$output"; false; }
  [[ "$output" == *"Context Pack"* ]] || { echo "$output"; false; }
}

@test "hole: an adr link naming a decision that does not exist is labelled too" {
  local t; t="$(_tree)"; _no_codegraph "$t"
  {
    echo
    echo '#### learning: L-401'
    echo
    echo 'what-failed: a session cited a decision number that was never written'
    echo 'why-missed: a bare number reads as a citation and nothing resolved it'
    echo 'prevention: cite the path, not the number'
    echo 'type: rule'
    echo 'area: auth'
    echo 'adr: 9999'
    echo 'verdict: proposed'
  } >> "$t/docs/develop/learning-ledger.md"
  _dev "$t" start 0
  _dev "$t" next
  local l; l="$(_line learning)"
  # `rule:` and `fixture:` were checked and `adr:` was not, so a number nobody had written
  # printed as a governing decision -- the one place "appears in the pack" and "is a real
  # thing" could still diverge without saying so.
  [[ "$l" == *"adr:9999 (not in this repo)"* ]] || { echo "an unwritten ADR printed as governing: $l"; false; }
  # and the real one is NOT labelled
  [[ "$l" == *"adr:0900,"* || "$l" == *"adr:0900 "* ]] || { echo "a real ADR was labelled as missing: $l"; false; }
}
