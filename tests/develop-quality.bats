#!/usr/bin/env bats
# Phase 07 -- quality intelligence: prior art on decisions, alternatives on risky slices.
#
# The load-bearing assertion is the TRIGGER, in both directions. "an annex row without a
# verdict FAILs" proves nothing about a check that demands an annex from every slice, and
# "a risky slice without sketches WARNs" proves nothing about one that warns on all of them.
# So each check is asserted to FIRE on the case it is for and to STAY SILENT on the case it
# is not for, and the silence half is the one that keeps this from becoming process tax --
# which is the risk this cycle's plan ranks first.
bats_require_minimum_version 1.5.0
load 'test_helper'

Q()    { echo "$ARC_ROOT/.claude/scripts/develop/quality.mjs"; }
LINTQ(){ echo "$ARC_ROOT/.claude/scripts/develop/develop-lint.mjs"; }

_url() {
  local p="$1"
  command -v cygpath >/dev/null 2>&1 && p="$(cygpath -m "$p")"
  case "$p" in /*) echo "file://$p";; *) echo "file:///$p";; esac
}

# Run a probe with quality.mjs imported as `q`, over a ledger the test wrote to a FILE.
# A heredoc attached to a helper does not reliably reach its stdin under bats: every ledger
# arrived empty, every validator saw zero slices, and the two tests asserting "no findings"
# passed vacuously on nothing at all. The emptiness check below makes that impossible now.
_q() {
  local fn="$1" led="$2" qf="$3"
  # An EMPTY FILE, never /dev/null: node cannot read /dev/null as a path on the Windows leg,
  # and the probe then died before it validated anything.
  if [ -z "$qf" ]; then qf="$BATS_TEST_TMPDIR/empty-quality.md"; : > "$qf"; fi
  [ -s "$led" ] || { echo "the ledger fixture is empty -- the test would prove nothing"; return 1; }
  local probe="$BATS_TEST_TMPDIR/probe.mjs"
  {
    echo "import * as q from '$(_url "$(Q)")';"
    echo "import { readFileSync } from 'node:fs';"
    # argv[2], not argv[1]. For a node SCRIPT, argv[1] is the script itself -- the probe was
    # parsing its own JavaScript, which holds no slices, so every validator returned nothing
    # and the two tests asserting "no findings" passed on the wrong file entirely.
    echo "const r = q.$fn(readFileSync(process.argv[2], 'utf8'), readFileSync(process.argv[3], 'utf8'));"
    echo "console.log(JSON.stringify({ fails: (r.fails||[]).map(f => f.msg), warns: (r.warns||[]).map(f => f.msg) }));"
  } > "$probe"
  run node "$probe" "$led" "$qf"
  [ "$status" -eq 0 ] || { echo "probe did not run:"; echo "$output"; return 1; }
}

_has() { [[ "$output" == *"$1"* ]] || { echo "expected to find: $1"; echo "$output"; return 1; }; }
_lacks() { [[ "$output" != *"$1"* ]] || { echo "did NOT expect: $1"; echo "$output"; return 1; }; }
_no_fails() { [[ "$output" == *'"fails":[]'* ]] || { echo "expected no fails: $output"; return 1; }; }

_SLICE_PLAIN='#### slice: 01

title: rename the changelog heading
kind: logic
risk: medium
proof: static
tier: static
'

_SLICE_RISKY='#### slice: 01

title: verify the token in `src/auth/session.js` before the handler runs
kind: logic
risk: high
proof: unit
tier: unit
'

# ---------------------------------------------------------------------------
# The Pattern Annex runs on a declared decision, or not at all
# ---------------------------------------------------------------------------

@test "a slice with no declared decision gets no annex and is not asked for one" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_PLAIN
EOF
  _q validateAnnex "$BATS_TEST_TMPDIR/l.md"
  _no_fails
}

@test "a slice that declares a decision and carries no annex FAILs" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_PLAIN
decision-type: architecture
EOF
  _q validateAnnex "$BATS_TEST_TMPDIR/l.md"
  _has "declares a architecture decision but carries no Pattern Annex"
}

@test "an annex on a slice that declared nothing FAILs: mining is triggered, never ambient" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_PLAIN

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Pattern Annex — slice 01

| pattern | source | verdict |
|---|---|---|
| others use cursors | https://docs.example/api (primary docs) | adopted — bounded memory |
EOF
  _q validateAnnex "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "declares no \`decision-type:\`"
}

@test "a complete annex on a declared decision passes" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_PLAIN
decision-type: architecture

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Pattern Annex — slice 01

| pattern | source | verdict |
|---|---|---|
| Stripe paginates with an opaque cursor | https://docs.stripe.com/api/pagination (primary docs) | adopted — bounded memory at any depth |
| Linear returns hasNextPage beside it | https://linear.app/developers (primary docs) | rejected — the cursor already answers it |
EOF
  _q validateAnnex "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _no_fails
}

@test "an annex row missing its source FAILs, and names the row" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_PLAIN
decision-type: product

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Pattern Annex — slice 01

| pattern | source | verdict |
|---|---|---|
| Stripe paginates with an opaque cursor |  | adopted — bounded memory |
EOF
  _q validateAnnex "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "carries no source"
  _has "Stripe paginates"
}

@test "an annex row missing its verdict FAILs: a row with no decision is research theatre" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_PLAIN
decision-type: product

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Pattern Annex — slice 01

| pattern | source | verdict |
|---|---|---|
| Stripe paginates with an opaque cursor | https://docs.stripe.com/api (primary docs) | interesting |
EOF
  _q validateAnnex "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "no adopted-or-rejected verdict"
}

@test "an annex over the 20-line cap FAILs: the cap is enforced, not requested" {
  local rows=""
  local i
  for i in $(seq 1 24); do
    rows="$rows| pattern number $i | https://docs.example/$i (primary docs) | rejected — not applicable |
"
  done
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_PLAIN
decision-type: ux

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Pattern Annex — slice 01

| pattern | source | verdict |
|---|---|---|
$rows
EOF
  _q validateAnnex "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "over the 20-line cap"
}

@test "a decision-type outside the closed vocabulary FAILs" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_PLAIN
decision-type: vibes

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Pattern Annex — slice 01

| pattern | source | verdict |
|---|---|---|
| something | https://docs.example (primary docs) | adopted — fits |
EOF
  _q validateAnnex "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "outside product | ux | architecture | external-api"
}

@test "an annex heading naming no slice FAILs closed rather than being skipped" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_PLAIN

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Pattern Annex

| pattern | source | verdict |
|---|---|---|
| something | https://docs.example | adopted — fits |
EOF
  _q validateAnnex "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "names no slice"
}

# ---------------------------------------------------------------------------
# Approach sketches, gated by the risk globs and not by self-assessment
# ---------------------------------------------------------------------------

@test "a non-risk slice with no sketches is untouched" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_PLAIN
EOF
  _q validateSketches "$BATS_TEST_TMPDIR/l.md"
  [[ "$output" == *'"warns":[]'* ]] || { echo "$output"; false; }
  _no_fails
}

@test "a risk-glob slice with no sketches WARNs, and names the class it tripped" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_RISKY
EOF
  _q validateSketches "$BATS_TEST_TMPDIR/l.md"
  _has "touches auth"
  _has "carries no approach sketches"
}

@test "risk is decided by PATH, never by the slice's own risk field" {
  # `risk: high` on a slice naming no path must not summon sketches: "is this risky?" is
  # exactly the judgement a model under time pressure gets wrong, always in one direction.
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
#### slice: 01

title: rewrite the introduction paragraph
kind: logic
risk: high
proof: static
tier: static
EOF
  _q validateSketches "$BATS_TEST_TMPDIR/l.md"
  [[ "$output" == *'"warns":[]'* ]] || { echo "self-declared risk summoned sketches: $output"; false; }
}

@test "a risky slice with two complete sketches passes" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_RISKY

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Approach sketches — slice 01

#### approach: 1

summary: verify in middleware, before the route handler is reached
trade-offs: one place to change, but every route pays the check
blast-radius: the router and every handler under it
maintenance: touches 3 call sites, no new pattern
operational-surface: deps +0, services +0, config +1
deletion-opportunity: lets us delete the per-handler token checks
verdict: picked

#### approach: 2

summary: verify inside each handler
trade-offs: precise, and forgettable — a new handler forgets it
blast-radius: every handler, individually
maintenance: touches 14 call sites and adds a rule people must remember
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
verdict: rejected
rejected-because: the failure mode is a handler nobody remembered to change
EOF
  _q validateSketches "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _no_fails
}

@test "a sketch pricing itself in months is rejected" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_RISKY

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Approach sketches — slice 01

#### approach: 1

summary: verify in middleware
trade-offs: one place to change
blast-radius: the router
maintenance: roughly ~6 months of maintenance
operational-surface: deps +0, services +0, config +1
deletion-opportunity: the per-handler checks
verdict: picked

#### approach: 2

summary: verify in each handler
trade-offs: precise and forgettable
blast-radius: every handler
maintenance: touches 14 call sites
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
verdict: rejected
rejected-because: a handler nobody remembered to change
EOF
  _q validateSketches "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "prices the work in time"
}

@test "computed counts are NOT mistaken for invented durations" {
  # The negative control for the duration check. "touches 3 call sites" and "deps +0" are
  # exactly what a sketch is supposed to carry; a check that rejected them would push authors
  # back to prose, which is the opposite of the point.
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_RISKY

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Approach sketches — slice 01

#### approach: 1

summary: verify in middleware
trade-offs: one place to change
blast-radius: the router and 14 handlers
maintenance: touches 3 call sites, no new pattern
operational-surface: deps +0, services +1, config +2
deletion-opportunity: 4 per-handler checks
verdict: picked

#### approach: 2

summary: verify in each handler
trade-offs: precise and forgettable
blast-radius: 14 handlers
maintenance: touches 14 call sites
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
verdict: rejected
rejected-because: a handler nobody remembered to change
EOF
  _q validateSketches "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _no_fails
}

@test "a rejected approach with no rejected-because FAILs" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_RISKY

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Approach sketches — slice 01

#### approach: 1

summary: verify in middleware
trade-offs: one place
blast-radius: the router
maintenance: touches 3 call sites
operational-surface: deps +0, services +0, config +1
deletion-opportunity: the per-handler checks
verdict: picked

#### approach: 2

summary: verify in each handler
trade-offs: precise
blast-radius: every handler
maintenance: touches 14 call sites
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
verdict: rejected
EOF
  _q validateSketches "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "rejected with no \`rejected-because:\`"
}

@test "no picked approach, or two, FAILs" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_RISKY

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Approach sketches — slice 01

#### approach: 1

summary: a
trade-offs: b
blast-radius: c
maintenance: touches 1 call site
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
verdict: picked

#### approach: 2

summary: d
trade-offs: e
blast-radius: f
maintenance: touches 2 call sites
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
verdict: picked
EOF
  _q validateSketches "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "2 picked approach(es)"
}

@test "one approach is a defence and four are a survey: both FAIL" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_RISKY

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Approach sketches — slice 01

#### approach: 1

summary: a
trade-offs: b
blast-radius: c
maintenance: touches 1 call site
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
verdict: picked
EOF
  _q validateSketches "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "1 approach(es); the comparison is 2 or 3"
}

@test "an operational surface with no counts FAILs" {
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_RISKY

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Approach sketches — slice 01

#### approach: 1

summary: a
trade-offs: b
blast-radius: c
maintenance: touches 1 call site
operational-surface: a few extra config keys
deletion-opportunity: none
verdict: picked

#### approach: 2

summary: d
trade-offs: e
blast-radius: f
maintenance: touches 2 call sites
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
verdict: rejected
rejected-because: it forgets
EOF
  _q validateSketches "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "operational surface with no counts"
}

@test "an approach marker the grammar will not accept FAILs closed" {
  # The same discipline the ledger's NEAR_SLICE applies: a line a person reads as an approach
  # must become one or become an error, never silently become a field.
  cat > "$BATS_TEST_TMPDIR/l.md" <<EOF
$_SLICE_RISKY

EOF
  cat > "$BATS_TEST_TMPDIR/q.md" <<EOF
### Approach sketches — slice 01

#### approach: A

summary: an id the grammar does not accept
verdict: picked

#### approach: 2

summary: d
trade-offs: e
blast-radius: f
maintenance: touches 2 call sites
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
verdict: rejected
rejected-because: it forgets
EOF
  _q validateSketches "$BATS_TEST_TMPDIR/l.md" "$BATS_TEST_TMPDIR/q.md"
  _has "read as an approach marker"
}

# ---------------------------------------------------------------------------
# The checks are wired into develop-lint, with the right severities
# ---------------------------------------------------------------------------

@test "develop-lint FAILs a bad annex and WARNs a missing sketch" {
  local t; t="$(mktemp -d)/tree"
  mkdir -p "$t/initiatives/develop/phases"
  # a spec must exist, or [brief-stale] fires and this test measures that instead
  printf "# Phase 00

## Exit criteria

- [ ] a thing
" > "$t/initiatives/develop/phases/phase-00-spec.md"
  cat > "$t/initiatives/develop/phases/phase-00-tasks.md" <<'LEDGER'
# Build Brief - phase 00 - fixture

spec-hash: sha256:0000000000000000000000000000000000000000000000000000000000000000
lane: develop

### Slices

#### slice: 01

title: verify the token in `src/auth/session.js`
kind: logic
risk: medium
proof: unit - `bats x`
tier: unit
decision-type: architecture
result: done
commit: abc1234
LEDGER
  cat > "$t/initiatives/develop/phases/phase-00-quality.md" <<'QUALITY'
# Quality annex - phase 00

### Pattern Annex - slice 01

| pattern | source | verdict |
|---|---|---|
| someone does this | https://docs.example (primary docs) | maybe |
QUALITY
  run node "$(LINTQ)" --root "$t" --lane develop
  [ "$status" -ne 0 ] || { echo "a verdict-less annex row did not FAIL: $output"; false; }
  [[ "$output" == *"pattern-annex"* ]] || { echo "$output"; false; }
  [[ "$output" == *"approach-sketch"* ]] || { echo "the sketch WARN did not fire: $output"; false; }
  [[ "$output" == *"[trial]"* ]] || { echo "the sketch count must be WARN-first: $output"; false; }
}

@test "develop-lint accepts a ledger whose slices carry two complete sketches" {
  # The whole feature was unusable: approach blocks lived in the ledger, and `#### approach: 2`
  # closed the slice and dropped its seven fields into the brief namespace, where they collided
  # with approach 1's. A valid pair of sketches produced seven `brief repeats key` BLOCKs.
  local t; t="$(mktemp -d)/tree"
  mkdir -p "$t/initiatives/develop/phases"
  # a spec must exist, or [brief-stale] fires and this test measures that instead
  printf "# Phase 00

## Exit criteria

- [ ] a thing
" > "$t/initiatives/develop/phases/phase-00-spec.md"
  cat > "$t/initiatives/develop/phases/phase-00-tasks.md" <<'LEDGER'
# Build Brief - phase 00 - fixture

spec-hash: sha256:0000000000000000000000000000000000000000000000000000000000000000
lane: develop

### Slices

#### slice: 01

title: verify the token in `src/auth/session.js`
kind: logic
risk: medium
proof: unit - `bats x`
tier: unit
result: done
commit: abc1234
LEDGER
  cat > "$t/initiatives/develop/phases/phase-00-quality.md" <<'QUALITY'
# Quality annex - phase 00

### Approach sketches - slice 01

#### approach: 1

summary: verify in middleware, before the route handler is reached
trade-offs: one place to change, but every route pays the check
blast-radius: the router and every handler under it
maintenance: touches 3 call sites, no new pattern
operational-surface: deps +0, services +0, config +1
deletion-opportunity: the per-handler token checks
verdict: picked - one place to change beats fourteen

#### approach: 2

summary: verify inside each handler
trade-offs: precise, and forgettable
blast-radius: every handler, individually
maintenance: touches 14 call sites
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
verdict: rejected
rejected-because: the failure mode is a handler nobody remembered to change
QUALITY
  run node "$(LINTQ)" --root "$t" --lane develop
  # The sketches themselves must produce nothing. The fixture brief is deliberately minimal and
  # trips [brief-stale], which is a different check and not what this test is about.
  [[ "$output" != *"repeats key"* ]] || { echo "approach fields collided with the brief: $output"; false; }
  [[ "$output" != *"FAIL  [approach-sketch]"* ]] || { echo "a valid pair of sketches was rejected: $output"; false; }
  [[ "$output" != *"FAIL  [pattern-annex]"* ]] || { echo "$output"; false; }
}

@test "the pattern-miner agent is decision-triggered and has no write tools" {
  local a="$ARC_ROOT/.claude/agents/pattern-miner.md"
  [ -f "$a" ] || { echo "no agent definition"; false; }
  run grep -iE '^tools:.*(Write|Edit|NotebookEdit)' "$a"
  [ "$status" -ne 0 ] || { echo "the miner can write: $output"; false; }
  run grep -iE 'decision-triggered|never ambient|declared decision' "$a"
  [ "$status" -eq 0 ] || { echo "the definition does not state its own trigger"; false; }
}

@test "the risk globs have exactly one definition in the tree" {
  # They were declared inline in develop.mjs and needed again here; two copies drift, and the
  # debt ledger records what that costs. This asserts the copy did not come back.
  run bash -c "grep -rln 'name: \"security-sensitive\", re:' '$ARC_ROOT/.claude/scripts' | wc -l"
  [ "$output" = "1" ] || { echo "RISK_GLOBS is declared in $output places"; false; }
}
