#!/usr/bin/env bats
# Phase 08 -- the feedback half: does the harness actually make things better?
#
# Red-first: every @test here fails before .claude/scripts/develop/metrics.mjs exists.
#
# The load-bearing assertion is the PAIR, and it is not "the number is right". A deriver that
# returns a plausible figure for everything satisfies every positive test; one that returns
# `not derivable` for everything satisfies every negative one. So each metric is asserted
# against a HAND-DERIVED number on a fixture whose records were built to produce it, AND
# asserted to say `not derivable` WITH A REASON on a fixture that lacks the records.
#
# A plausible figure in a metrics report is worse than a blank, because it invites decisions.
bats_require_minimum_version 1.5.0
load 'test_helper'

M()  { echo "$ARC_ROOT/.claude/scripts/develop/metrics.mjs"; }
LNT(){ echo "$ARC_ROOT/.claude/scripts/develop/develop-lint.mjs"; }
FXM(){ echo "$ARC_ROOT/tests/fixtures/develop/metrics"; }

_url() {
  local p="$1"
  command -v cygpath >/dev/null 2>&1 && p="$(cygpath -m "$p")"
  case "$p" in /*) echo "file://$p";; *) echo "file:///$p";; esac
}

# Derive the metrics for a fixture tree and print them as JSON.
_metrics() {
  local tree="$(FXM)/$1"
  local probe="$BATS_TEST_TMPDIR/probe.mjs"
  {
    echo "import * as m from '$(_url "$(M)")';"
    echo "const r = m.metrics(process.argv[2], process.argv[2] + '/initiatives/develop');"
    echo "console.log(JSON.stringify(r));"
  } > "$probe"
  run node "$probe" "$tree"
  [ "$status" -eq 0 ] || { echo "probe did not run:"; echo "$output"; return 1; }
}

# One metric's value, or the literal string "null".
_val() { echo "$output" | node -e "
  let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{
    const m=JSON.parse(s).find(x=>x.name===process.argv[1]);
    console.log(m===undefined?'MISSING':(m.value===null?'null':String(m.value)));
  });" "$1"; }

_reason() { echo "$output" | node -e "
  let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{
    const m=JSON.parse(s).find(x=>x.name===process.argv[1]);
    console.log(m===undefined?'MISSING':String(m.reason||''));
  });" "$1"; }

METRICS="escaped-spec-misses rework-stuck time-to-first-proven-slice false-block-rate evidence-completeness ceremony-cost"

# ---------------------------------------------------------------------------
# All six compute, each against a number derived by hand from the fixture
# ---------------------------------------------------------------------------

@test "all six metrics are reported, by name" {
  _metrics have
  local k
  for k in $METRICS; do
    [ "$(_val "$k")" != "MISSING" ] || { echo "metric absent: $k"; echo "$output"; false; }
  done
}

@test "escaped spec misses counts the fidelity reports that found drift" {
  # phase-00 says `FIDELITY: drift found`, phase-01 says `FIDELITY: clean` => 1
  _metrics have
  [ "$(_val escaped-spec-misses)" = "1" ] || { echo "got $(_val escaped-spec-misses)"; echo "$output"; false; }
}

@test "rework counts the slice.stuck receipts on the spine" {
  # two receipts, one per backstop => 2
  _metrics have
  [ "$(_val rework-stuck)" = "2" ] || { echo "got $(_val rework-stuck)"; echo "$output"; false; }
}

@test "time to first proven slice is computed from the receipt timestamps" {
  # phase 00: 10:00 -> 11:30 = 90 min. phase 01: 14:00 -> 14:30 = 30 min. mean 60.
  _metrics have
  [ "$(_val time-to-first-proven-slice)" = "60" ] || { echo "got $(_val time-to-first-proven-slice)"; echo "$output"; false; }
}

@test "false-block rate is adjudicated false positives over logged runs" {
  # 4 logged rows, 1 adjudicated a false positive => 0.25
  _metrics have
  [ "$(_val false-block-rate)" = "0.25" ] || { echo "got $(_val false-block-rate)"; echo "$output"; false; }
}

@test "evidence completeness is complete ticked slices over ticked slices" {
  # ticked = 4 (00/01, 00/02, 01/01, 01/02); complete = 3 (00/02 has no tier) => 0.75
  _metrics have
  [ "$(_val evidence-completeness)" = "0.75" ] || { echo "got $(_val evidence-completeness)"; echo "$output"; false; }
}

@test "ceremony cost counts recorded artifacts per proven slice" {
  # 1 annex + 1 sketch section + 2 stuck receipts = 4, over 4 proven slices => 1
  _metrics have
  [ "$(_val ceremony-cost)" = "1" ] || { echo "got $(_val ceremony-cost)"; echo "$output"; false; }
}

@test "ceremony cost declares what it does NOT count" {
  # Agent invocations are not recorded anywhere, and a measure that omits something must say
  # so -- the rule this repo already writes down about transforms.
  _metrics have
  local n; n="$(_reason ceremony-cost)"
  [[ "$n" == *"agent"* ]] || { echo "the omission is undeclared: $n"; false; }
}

# ---------------------------------------------------------------------------
# The negative half: absent records must produce a REASON, never a figure
# ---------------------------------------------------------------------------

@test "every metric says not derivable, with a reason, when its records are absent" {
  _metrics bare
  local k
  for k in $METRICS; do
    [ "$(_val "$k")" = "null" ] || { echo "$k invented a figure: $(_val "$k")"; false; }
    local r; r="$(_reason "$k")"
    [ -n "$r" ] && [ "$r" != "MISSING" ] || { echo "$k is not derivable and does not say why"; false; }
  done
}

@test "a metric that cannot be derived is never printed as a number" {
  _metrics bare
  run bash -c "echo '$output' | grep -cE '\"value\":[0-9]'"
  [ "$output" = "0" ] || { echo "a figure appeared where nothing was derivable"; false; }
}

# ---------------------------------------------------------------------------
# The calibration record
# ---------------------------------------------------------------------------

@test "the calibration record aggregates every scored prediction across every phase" {
  # phase 00: hit, miss, hit. phase 01: miss, unforeseen. => 2 hit, 2 miss, 1 unforeseen, 5 total
  local probe="$BATS_TEST_TMPDIR/cal.mjs"
  {
    echo "import * as m from '$(_url "$(M)")';"
    echo "console.log(JSON.stringify(m.calibration(process.argv[2] + '/initiatives/develop')));"
  } > "$probe"
  run node "$probe" "$(FXM)/have"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q '"hit":2' || { echo "$output"; false; }
  echo "$output" | grep -q '"miss":2' || { echo "$output"; false; }
  echo "$output" | grep -q '"unforeseen":1' || { echo "$output"; false; }
  echo "$output" | grep -q '"total":5' || { echo "$output"; false; }
}

@test "the calibration record breaks down by prediction field, not only in total" {
  # The point is not a score, it is a pattern in where judgement is reliably wrong.
  local probe="$BATS_TEST_TMPDIR/cal2.mjs"
  {
    echo "import * as m from '$(_url "$(M)")';"
    echo "console.log(JSON.stringify(m.calibration(process.argv[2] + '/initiatives/develop').byField));"
  } > "$probe"
  run node "$probe" "$(FXM)/have"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q 'likely-failure-mode' || { echo "$output"; false; }
  echo "$output" | grep -q 'riskiest-file' || { echo "$output"; false; }
}

@test "the calibration record stores nothing -- it is derived" {
  local before after
  before="$(find "$(FXM)/have" -type f | wc -l | tr -d ' ')"
  local probe="$BATS_TEST_TMPDIR/cal3.mjs"
  { echo "import * as m from '$(_url "$(M)")';"
    echo "m.calibration(process.argv[2] + '/initiatives/develop');"; } > "$probe"
  run node "$probe" "$(FXM)/have"
  after="$(find "$(FXM)/have" -type f | wc -l | tr -d ' ')"
  [ "$before" = "$after" ] || { echo "it wrote something: $before -> $after"; false; }
}

# ---------------------------------------------------------------------------
# Tags: a closed vocabulary, because the Context Pack matches on it
# ---------------------------------------------------------------------------

@test "develop-lint FAILs a learning tag outside the closed vocabulary" {
  local t="$BATS_TEST_TMPDIR/tagtree"
  mkdir -p "$t/docs/develop" "$t/tests/fixtures/develop-evals/withheld"
  printf "expect: flagged

A withheld fixture, so the corpus guard is satisfied and the TAG is what is
being checked here.
" > "$t/tests/fixtures/develop-evals/withheld/F-901.md"
  cat > "$t/docs/develop/learning-ledger.md" <<'LED'
# Learning ledger — fixture

#### learning: L-001

what-failed: something went wrong once
why-missed: nothing looked for it
prevention: look for it
type: rule
tag: vibes
area: build
adr: 0108
verdict: proposed
LED
  run node "$(LNT)" --root "$t"
  [ "$status" -ne 0 ] || { echo "a free-text tag was accepted: $output"; false; }
  [[ "$output" == *"tag"* ]] || { echo "$output"; false; }
}

@test "each of the five tags in the vocabulary passes" {
  local t="$BATS_TEST_TMPDIR/tagok" tag
  for tag in pattern anti-pattern library-verdict fix-recipe common-mistake; do
    rm -rf "$t"; mkdir -p "$t/docs/develop" "$t/tests/fixtures/develop-evals/withheld"
    printf "expect: flagged

held out
" > "$t/tests/fixtures/develop-evals/withheld/F-901.md"
    cat > "$t/docs/develop/learning-ledger.md" <<LED
# Learning ledger — fixture

#### learning: L-001

what-failed: something went wrong once
why-missed: nothing looked for it
prevention: look for it
type: rule
tag: $tag
area: build
adr: 0108
verdict: proposed
LED
    run node "$(LNT)" --root "$t"
    [ "$status" -eq 0 ] || { echo "tag '$tag' was rejected:"; echo "$output"; false; }
  done
}

# ---------------------------------------------------------------------------
# Phase 05's Context Pack matches on tag as well as area
# ---------------------------------------------------------------------------

@test "the Context Pack matches a learning row on its tag" {
  local t="$BATS_TEST_TMPDIR/packtree"
  mkdir -p "$t/docs/develop" "$t/tests/fixtures/develop-evals/withheld"
  printf "expect: flagged

A withheld fixture, so the corpus guard is satisfied and the TAG is what is
being checked here.
" > "$t/tests/fixtures/develop-evals/withheld/F-901.md"
  cat > "$t/docs/develop/learning-ledger.md" <<'LED'
# Learning ledger — fixture

#### learning: L-500

what-failed: a matcher over-fired on the controls written to prove it over-fired
why-missed: the fixture mixed the artifact with commentary about it
prevention: a fixture must BE the artifact
type: rule
tag: anti-pattern
area: ui
adr: 0108
verdict: proposed
LED
  local probe="$BATS_TEST_TMPDIR/pack.mjs"
  {
    echo "import * as cp from '$(_url "$ARC_ROOT/.claude/scripts/develop/context-pack.mjs")';"
    echo "const corpus = new Set(['anti-pattern']);"
    echo "console.log(JSON.stringify(cp.learning(process.argv[2], [], corpus).items));"
  } > "$probe"
  run node "$probe" "$t"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # `area: ui` does not match and no path overlaps: the tag is the only thing that can pull it.
  [[ "$output" == *"L-500"* ]] || { echo "a tagged row was not retrieved by its tag: $output"; false; }
}

@test "the Context Pack does NOT pull a row whose tag is not in the corpus" {
  local t="$BATS_TEST_TMPDIR/packtree2"
  mkdir -p "$t/docs/develop" "$t/tests/fixtures/develop-evals/withheld"
  printf "expect: flagged

A withheld fixture, so the corpus guard is satisfied and the TAG is what is
being checked here.
" > "$t/tests/fixtures/develop-evals/withheld/F-901.md"
  cat > "$t/docs/develop/learning-ledger.md" <<'LED'
# Learning ledger — fixture

#### learning: L-501

what-failed: an unrelated thing
why-missed: unrelated
prevention: unrelated
type: rule
tag: library-verdict
area: ui
adr: 0108
verdict: proposed
LED
  local probe="$BATS_TEST_TMPDIR/pack2.mjs"
  {
    echo "import * as cp from '$(_url "$ARC_ROOT/.claude/scripts/develop/context-pack.mjs")';"
    echo "console.log(JSON.stringify(cp.learning(process.argv[2], [], new Set(['anti-pattern'])).items));"
  } > "$probe"
  run node "$probe" "$t"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"L-501"* ]] || { echo "tag matching pulls everything: $output"; false; }
}

# ---------------------------------------------------------------------------
# Suggestions: evidence, economics, a default, and a slice boundary
# ---------------------------------------------------------------------------

_sugg() {
  local q="$BATS_TEST_TMPDIR/q.md"
  cat > "$q"
  local probe="$BATS_TEST_TMPDIR/sg.mjs"
  {
    echo "import * as m from '$(_url "$(M)")';"
    echo "import { readFileSync } from 'node:fs';"
    echo "const r = m.validateSuggestions(readFileSync(process.argv[2], 'utf8'));"
    echo "console.log(JSON.stringify(r.fails.map(f => f.msg)));"
  } > "$probe"
  run node "$probe" "$q"
  [ "$status" -eq 0 ] || { echo "probe did not run:"; echo "$output"; return 1; }
}

@test "a complete suggestion at a slice boundary passes" {
  _sugg <<'EOF'
### Suggestions — slice 02 boundary

#### suggestion: 1

what: read the risk globs from the shared rules file instead of the inline list
evidence: the debt ledger records two copies of "risky paths" and one already drifted
maintenance: touches 2 files, deletes one list
operational-surface: deps +0, services +0, config +0
deletion-opportunity: the inline RISK_GLOBS block
default: skip
EOF
  [ "$output" = "[]" ] || { echo "$output"; false; }
}

@test "a suggestion with no default is rejected -- declining must cost one word" {
  _sugg <<'EOF'
### Suggestions — slice 02 boundary

#### suggestion: 1

what: do a thing
evidence: some evidence
maintenance: touches 2 files
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
EOF
  [[ "$output" == *"default"* ]] || { echo "$output"; false; }
}

@test "a suggestion with no evidence is rejected" {
  _sugg <<'EOF'
### Suggestions — slice 02 boundary

#### suggestion: 1

what: do a thing
maintenance: touches 2 files
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
default: skip
EOF
  [[ "$output" == *"evidence"* ]] || { echo "$output"; false; }
}

@test "a suggestion pricing itself in time is rejected" {
  _sugg <<'EOF'
### Suggestions — slice 02 boundary

#### suggestion: 1

what: do a thing
evidence: some evidence
maintenance: roughly ~3 weeks of upkeep
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
default: skip
EOF
  [[ "$output" == *"time"* ]] || { echo "$output"; false; }
}

@test "a suggestion raised mid-slice rather than at a boundary is rejected" {
  # An interruption during implementation is a cost paid on every slice for a benefit that
  # lands on few, which is why the batching rule exists at all.
  _sugg <<'EOF'
### Suggestions — slice 02 mid-slice

#### suggestion: 1

what: do a thing
evidence: some evidence
maintenance: touches 2 files
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
default: skip
EOF
  [[ "$output" == *"boundary"* ]] || { echo "$output"; false; }
}

@test "develop-lint reports the metrics when asked, and not otherwise" {
  run node "$(LNT)" --root "$(FXM)/have" --lane develop --metrics
  [[ "$output" == *"evidence-completeness"* ]] || { echo "--metrics printed no metrics: $output"; false; }
  run node "$(LNT)" --root "$(FXM)/have" --lane develop
  [[ "$output" != *"evidence-completeness"* ]] || { echo "metrics printed without being asked: $output"; false; }
}

# ---------------------------------------------------------------------------
# Holes a fresh agent found, none of which the suite above could see.
# Thirteen were wrong numbers reported as real ones. One was live on this repo.
# ---------------------------------------------------------------------------

# Copy the `have` fixture somewhere writable, mutate one file, derive.
_mutate() {
  MTREE="$BATS_TEST_TMPDIR/t"
  rm -rf "$MTREE"
  cp -R "$(FXM)/have" "$MTREE"
}
_derive() {
  local probe="$BATS_TEST_TMPDIR/d.mjs"
  {
    echo "import * as m from '$(_url "$(M)")';"
    echo "const r = m.metrics(process.argv[2], process.argv[2] + '/initiatives/develop', 'develop');"
    echo "console.log(JSON.stringify(r));"
  } > "$probe"
  run node "$probe" "$MTREE"
  [ "$status" -eq 0 ] || { echo "probe did not run:"; echo "$output"; return 1; }
}

@test "hole: an unadjudicated trial row is not counted as a clean record" {
  # LIVE on this repo: five rows reading `unadjudicated - ...` went into the denominator and
  # a rate of 0 came out, presented as measured.
  _mutate
  cat > "$MTREE/docs/trial-ledger.md" <<'MD'
| date | gate | run | fired? | adjudication |
|---|---|---|---|---|
| 2026-08-01 | alpha-gate | a real phase | YES | **unadjudicated, leaning false** — the arithmetic is correct |
| 2026-08-01 | beta-gate | a real phase | YES | unadjudicated — nobody has looked yet |
| 2026-08-01 | gamma-gate | a real phase | YES | false positive — the work was fine |
MD
  _derive
  [ "$(_val false-block-rate)" = "1" ] || { echo "got $(_val false-block-rate)"; echo "$output"; false; }
  [[ "$(_reason false-block-rate)" == *"unadjudicated"* ]] || { echo "$(_reason false-block-rate)"; false; }
}

@test "hole: false positive in prose is not read as the verdict" {
  _mutate
  cat > "$MTREE/docs/trial-ledger.md" <<'MD'
| date | gate | run | fired? | adjudication |
|---|---|---|---|---|
| 2026-08-01 | alpha-gate | a real phase | YES | false positives were ruled out; this is a TRUE positive |
| 2026-08-01 | beta-gate | a real phase | YES | true positive — it caught a real defect |
MD
  _derive
  [ "$(_val false-block-rate)" = "0" ] || { echo "got $(_val false-block-rate)"; false; }
}

@test "hole: adding a column does not zero the false-block rate" {
  _mutate
  cat > "$MTREE/docs/trial-ledger.md" <<'MD'
| date | gate | run | fired? | adjudication | notes |
|---|---|---|---|---|---|
| 2026-08-01 | alpha-gate | a real phase | YES | false positive — the work was fine | reported by Ashiq |
| 2026-08-01 | beta-gate | a real phase | YES | false positive — the glob was wrong | reported by Ashiq |
MD
  _derive
  [ "$(_val false-block-rate)" = "1" ] || { echo "got $(_val false-block-rate)"; false; }
}

@test "hole: a fenced example row in the trial ledger is not a logged run" {
  _mutate
  { printf '%s\n' '```'
    printf '%s\n' '| 2026-01-01 | example-gate | how to fill this in | YES | false positive — example only |'
    printf '%s\n' '```'
    cat "$(FXM)/have/docs/trial-ledger.md"; } > "$MTREE/docs/trial-ledger.md"
  _derive
  [ "$(_val false-block-rate)" = "0.25" ] || { echo "got $(_val false-block-rate)"; false; }
}

@test "hole: a fenced FIDELITY line is not a verdict" {
  _mutate
  { printf '%s\n' "A drifted report ends with the line:" '' '```' 'FIDELITY: drift found' '```' ''
    printf '%s\n' 'FIDELITY: clean'; } > "$MTREE/initiatives/develop/evidence/phase-01/spec-fidelity.md"
  _derive
  [ "$(_val escaped-spec-misses)" = "1" ] || { echo "got $(_val escaped-spec-misses)"; false; }
}

@test "hole: a negated mention of drift is not drift" {
  _mutate
  printf '%s\n' 'No FIDELITY: drift found anywhere in this diff.' '' 'FIDELITY: clean' \
    > "$MTREE/initiatives/develop/evidence/phase-01/spec-fidelity.md"
  _derive
  [ "$(_val escaped-spec-misses)" = "1" ] || { echo "got $(_val escaped-spec-misses)"; false; }
}

@test "hole: an archived evidence directory is not a phase" {
  _mutate
  mkdir -p "$MTREE/initiatives/develop/evidence/archive-2026-07"
  cp "$MTREE/initiatives/develop/evidence/phase-00/spec-fidelity.md" \
     "$MTREE/initiatives/develop/evidence/archive-2026-07/spec-fidelity.md"
  _derive
  [ "$(_val escaped-spec-misses)" = "1" ] || { echo "got $(_val escaped-spec-misses)"; false; }
}

@test "hole: receipts are paired by time, not by the order they were written" {
  _mutate
  cat > "$MTREE/.claude/state/hq/events/2026-08-01.jsonl" <<'JL'
{"kind":"slice.done","ts":"2026-08-01T18:00:00Z","payload":{"lane":"develop","slice":"09","phase":"00"}}
{"kind":"develop.started","ts":"2026-08-01T10:00:00Z","payload":{"lane":"develop","phase":"00"}}
{"kind":"slice.done","ts":"2026-08-01T11:30:00Z","payload":{"lane":"develop","slice":"01","phase":"00"}}
JL
  _derive
  [ "$(_val time-to-first-proven-slice)" = "90" ] || { echo "got $(_val time-to-first-proven-slice)"; false; }
}

@test "hole: another lane's receipts are not this lane's" {
  # Every lane numbers its phases 00, 01, ..., so this fires the moment a second lane exists.
  _mutate
  cat > "$MTREE/.claude/state/hq/events/2026-08-01.jsonl" <<'JL'
{"kind":"develop.started","ts":"2026-08-01T10:00:00Z","payload":{"lane":"develop","phase":"00"}}
{"kind":"slice.done","ts":"2026-08-01T10:02:00Z","payload":{"lane":"lexos","slice":"01","phase":"00"}}
{"kind":"slice.stuck","ts":"2026-08-01T10:40:00Z","payload":{"lane":"lexos","slice":"01","backstop":"fingerprint"}}
{"kind":"slice.done","ts":"2026-08-01T11:30:00Z","payload":{"lane":"develop","slice":"01","phase":"00"}}
JL
  _derive
  [ "$(_val time-to-first-proven-slice)" = "90" ] || { echo "got $(_val time-to-first-proven-slice)"; false; }
  [ "$(_val rework-stuck)" = "0" ] || { echo "another lane's backstop counted: $(_val rework-stuck)"; false; }
}

@test "hole: a numeric or unpadded phase still pairs" {
  _mutate
  cat > "$MTREE/.claude/state/hq/events/2026-08-01.jsonl" <<'JL'
{"kind":"develop.started","ts":"2026-08-01T10:00:00Z","payload":{"lane":"develop","phase":0}}
{"kind":"slice.done","ts":"2026-08-01T11:30:00Z","payload":{"lane":"develop","slice":"01","phase":0}}
{"kind":"develop.started","ts":"2026-08-01T14:00:00Z","payload":{"lane":"develop","phase":"1"}}
{"kind":"slice.done","ts":"2026-08-01T14:30:00Z","payload":{"lane":"develop","slice":"01","phase":"01"}}
JL
  _derive
  [ "$(_val time-to-first-proven-slice)" = "60" ] || { echo "got $(_val time-to-first-proven-slice)"; false; }
}

@test "hole: a timestamp with no timezone is refused, not read in the local zone" {
  _mutate
  cat > "$MTREE/.claude/state/hq/events/2026-08-01.jsonl" <<'JL'
{"kind":"develop.started","ts":"2026-08-01T10:00:00Z","payload":{"lane":"develop","phase":"00"}}
{"kind":"slice.done","ts":"2026-08-01T11:30:00","payload":{"lane":"develop","slice":"01","phase":"00"}}
JL
  _derive
  [ "$(_val time-to-first-proven-slice)" = "null" ] || { echo "a machine-dependent number: $(_val time-to-first-proven-slice)"; false; }
  [[ "$(_reason time-to-first-proven-slice)" == *"timezone"* ]] || { echo "$(_reason time-to-first-proven-slice)"; false; }
}

@test "hole: a restarted phase is measured from the run that finished it" {
  _mutate
  cat > "$MTREE/.claude/state/hq/events/2026-08-01.jsonl" <<'JL'
{"kind":"develop.started","ts":"2026-08-01T08:00:00Z","payload":{"lane":"develop","phase":"00"}}
{"kind":"develop.started","ts":"2026-08-01T11:00:00Z","payload":{"lane":"develop","phase":"00"}}
{"kind":"slice.done","ts":"2026-08-01T11:30:00Z","payload":{"lane":"develop","slice":"01","phase":"00"}}
JL
  _derive
  [ "$(_val time-to-first-proven-slice)" = "30" ] || { echo "got $(_val time-to-first-proven-slice)"; false; }
}

@test "hole: one receipt with a wrong year does not become the headline" {
  _mutate
  cat > "$MTREE/.claude/state/hq/events/2026-08-01.jsonl" <<'JL'
{"kind":"develop.started","ts":"2026-08-01T10:00:00Z","payload":{"lane":"develop","phase":"00"}}
{"kind":"slice.done","ts":"2026-08-01T11:30:00Z","payload":{"lane":"develop","slice":"01","phase":"00"}}
{"kind":"develop.started","ts":"2026-08-01T14:00:00Z","payload":{"lane":"develop","phase":"01"}}
{"kind":"slice.done","ts":"2126-08-01T14:30:00Z","payload":{"lane":"develop","slice":"01","phase":"01"}}
JL
  _derive
  # The median survives one bad record; the mean was 26,297,340 minutes.
  local v; v="$(_val time-to-first-proven-slice)"
  [ "$v" -lt 100000 ] 2>/dev/null || { echo "an outlier became the figure: $v"; false; }
}

@test "hole: a duplicated events file does not double every count" {
  _mutate
  cp "$MTREE/.claude/state/hq/events/2026-08-01.jsonl" "$MTREE/.claude/state/hq/events/2026-08-01.bak.jsonl"
  _derive
  [ "$(_val rework-stuck)" = "2" ] || { echo "a restored backup doubled it: $(_val rework-stuck)"; false; }
}

@test "hole: a ledger that does not parse is refused, not counted around" {
  # A malformed slice id, a duplicate id and an unterminated fence each dropped slices, and
  # every one of them moved the number in the flattering direction.
  _mutate
  cat >> "$MTREE/initiatives/develop/phases/phase-01-tasks.md" <<'LED'

#### slice: 01

title: a duplicate id
result: done
commit: eee5555
LED
  _derive
  [ "$(_val evidence-completeness)" = "null" ] || { echo "counted over a broken ledger: $(_val evidence-completeness)"; false; }
  [[ "$(_reason evidence-completeness)" == *"do not parse"* ]] || { echo "$(_reason evidence-completeness)"; false; }
}

@test "hole: calibration does not count a note left in the scores section" {
  _mutate
  printf '%s\n' 'summary: hit — this line is a note, not a scored prediction' \
    >> "$MTREE/initiatives/develop/phases/phase-01-tasks.md"
  local probe="$BATS_TEST_TMPDIR/c.mjs"
  { echo "import * as m from '$(_url "$(M)")';"
    echo "console.log(JSON.stringify(m.calibration(process.argv[2] + '/initiatives/develop')));"; } > "$probe"
  run node "$probe" "$MTREE"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q '"total":5' || { echo "a note became calibration data: $output"; false; }
}

@test "hole: a score keyed constructor neither inflates the total nor pollutes Object" {
  _mutate
  printf '%s\n' 'constructor: hit — the object was built as predicted' \
    >> "$MTREE/initiatives/develop/phases/phase-01-tasks.md"
  local probe="$BATS_TEST_TMPDIR/c2.mjs"
  { echo "import * as m from '$(_url "$(M)")';"
    echo "const c = m.calibration(process.argv[2] + '/initiatives/develop');"
    echo "console.log(JSON.stringify({ total: c.total, poisoned: String(Object.hit) }));"; } > "$probe"
  run node "$probe" "$MTREE"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q '"total":5' || { echo "$output"; false; }
  echo "$output" | grep -q '"poisoned":"undefined"' || { echo "the global Object was written to: $output"; false; }
}

@test "hole: a hedged verdict is not a clean hit" {
  _mutate
  printf '%s\n' 'riskiest-file: hit-and-miss — it was both, honestly' \
    >> "$MTREE/initiatives/develop/phases/phase-01-tasks.md"
  local probe="$BATS_TEST_TMPDIR/c3.mjs"
  { echo "import * as m from '$(_url "$(M)")';"
    echo "const c = m.calibration(process.argv[2] + '/initiatives/develop');"
    echo "console.log(JSON.stringify({ hit: c.hit, unreadable: c.unreadable.length }));"; } > "$probe"
  run node "$probe" "$MTREE"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q '"hit":2' || { echo "a hedge was scored as a hit: $output"; false; }
  echo "$output" | grep -q '"unreadable":1' || { echo "it was dropped in silence: $output"; false; }
}

@test "hole: deletion-opportunity none is an answer, not an empty field" {
  # quality.mjs had already learned this; metrics.mjs used the other isFilled and made the
  # same value a false BLOCK in one file and legal in the other.
  _sugg <<'EOF'
### Suggestions — slice 02 boundary

#### suggestion: 1

what: read the risk globs from the shared rules file
evidence: the debt ledger records two copies and one already drifted
maintenance: touches 2 files
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
default: skip
EOF
  [ "$output" = "[]" ] || { echo "the honest answer was rejected: $output"; false; }
}

@test "hole: the word boundary anywhere in the heading is not a boundary" {
  _sugg <<'EOF'
### Suggestions — raised mid-slice, nowhere near a boundary

#### suggestion: 1

what: do a thing
evidence: some evidence
maintenance: touches 2 files
operational-surface: deps +0, services +0, config +0
deletion-opportunity: none
default: skip
EOF
  [[ "$output" == *"boundary"* ]] || { echo "a mid-slice section passed: $output"; false; }
}
