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

# Run a node snippet with the modules under test imported as `cp` and `lg`.
_node() {
  local f="$BATS_TEST_TMPDIR/probe.mjs"
  {
    echo "import * as cp from '$(CP)';"
    echo "import * as lg from '$(LG)';"
    cat
  } > "$f"
  run node "$f"
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
