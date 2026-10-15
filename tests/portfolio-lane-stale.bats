#!/usr/bin/env bats
# lane-stale -- portfolio Cycle 5, Phase 06, REQ-08 (ADR-0079).
#
# A LIVE lane no receipt has named (`payload.lane`) in 14 days is derived stale by a daily job into
# instance state and raised once per silence episode as `incident.raised class: lane-stale`, which the
# brief names under needs-you. PORTFOLIO.md never carries it, and board-lint --strict fails a hand-written
# stale field. Growth's 7-week and leads' 9-week silences are the fixtures.
#
# Each case builds its own repo (a copy of .claude/scripts, fixture lanes, a fixture spine) with the clock
# pinned by ARC_SPINE_NOW, so nothing reads the live spine or today's lanes. Every case asserts the job RAN
# (its summary line) before asserting what it derived; absence checks always sit beside a positive one.
bats_require_minimum_version 1.5.0
load 'test_helper'

NOW_MS=1791936000000   # 2026-10-14T00:00:00Z

teardown() { _arc_teardown; }

_repo() {
  SANDBOX="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$SANDBOX/.claude/state/hq/events" "$SANDBOX/initiatives"
  cp -r "$ARC_ROOT/.claude/scripts" "$SANDBOX/.claude/"
  git -C "$SANDBOX" init -q
  [ -f "$SANDBOX/.claude/scripts/hq/jobs/lane-stale.mjs" ]
  export ARC_SPINE_ROOT="$SANDBOX/.claude/state/hq"
  export ARC_SPINE_NOW="$NOW_MS"
  JOB="$SANDBOX/.claude/scripts/hq/jobs/lane-stale.mjs"
  STATE="$SANDBOX/.claude/state/portfolio/lane-stale.json"
}
_lane() { mkdir -p "$SANDBOX/initiatives/$1"; printf 'status: %s\ncycle: arc-%s (Cycle 1)\n\n# tracker\n' "$2" "$1" > "$SANDBOX/initiatives/$1/PROGRESS.md"; }
# _named LANE DAY ID [KIND] -- a receipt naming LANE, at 05:30 IST on DAY.
_named() { printf '{"id":"%s","kind":"%s","ts":"%sT05:30:00+05:30","supersedes":null,"payload":{"lane":"%s"}}\n' "$3" "${4:-phase.closed}" "$2" "$1" >> "$ARC_SPINE_ROOT/events/$2.jsonl"; }
_job() { run node "$JOB" "$@"; }
_ran() { [[ "$output" == *"lane-stale: "*" LIVE lane(s), "* ]]; }
_stale_of() { node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); const l=j.lanes[process.argv[2]]; console.log(l===undefined?"absent":String(l.stale))' "$STATE" "$1"; }
_incidents() { cat "$ARC_SPINE_ROOT"/events/*.jsonl 2>/dev/null | grep -c '"class":"lane-stale"' || true; }

# ---------- the two real silences ----------

@test "stale: growth's 7-week and leads' 9-week silences derive stale; a lane named 2 days ago does not" {
  _repo
  _lane growth LIVE; _lane leads LIVE; _lane face LIVE
  _named growth 2026-08-26 01M4VQ00000000000000000001
  _named leads 2026-08-12 01M4VQ00000000000000000002
  _named face 2026-10-12 01M4VQ00000000000000000003
  _job
  _ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"3 LIVE lane(s), 2 stale: growth, leads -- raised 2 new"* ]]
  [ "$(_stale_of growth)" = true ]
  [ "$(_stale_of leads)" = true ]
  [ "$(_stale_of face)" = false ]
  [ "$(_incidents)" -eq 2 ]
}

@test "stale: the 14-day boundary -- 13 days is fresh, 15 days is stale" {
  _repo
  _lane a LIVE; _lane b LIVE
  _named a 2026-10-01 01M4VQ00000000000000000004
  _named b 2026-09-29 01M4VQ00000000000000000005
  _job
  _ran
  [ "$(_stale_of a)" = false ]
  [ "$(_stale_of b)" = true ]
}

@test "stale: a LIVE lane never named at all is stale; IDLE and BLOCKED lanes are never judged" {
  _repo
  _lane quiet LIVE; _lane parked IDLE; _lane waiting BLOCKED
  _job
  _ran
  [ "$(_stale_of quiet)" = true ]
  [ "$(_stale_of parked)" = absent ]
  [ "$(_stale_of waiting)" = absent ]
  [[ "$output" == *"1 LIVE lane(s), 1 stale: quiet"* ]]
}

# ---------- once per episode, and the alarm is not activity ----------

@test "stale: a second run raises nothing new, quarantines nothing, and the lane stays stale" {
  _repo
  _lane growth LIVE
  _named growth 2026-08-26 01M4VQ00000000000000000006
  _job
  [[ "$output" == *"raised 1 new"* ]]
  [ "$(_incidents)" -eq 1 ]
  _job
  _ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"1 stale: growth -- raised 0 new, 1 already raised"* ]]
  [ "$(_incidents)" -eq 1 ]
  [ "$(_stale_of growth)" = true ]
  [ ! -s "$ARC_SPINE_ROOT/events/_quarantine/2026-10-14.jsonl" ]
}

@test "stale: the job's own lane-stale incidents never count as the lane being named" {
  _repo
  _lane growth LIVE
  printf '{"id":"01M4VQ00000000000000000007","kind":"incident.raised","ts":"2026-10-13T05:30:00+05:30","supersedes":null,"payload":{"class":"lane-stale","lane":"growth","silent_lane":"growth"}}\n' >> "$ARC_SPINE_ROOT/events/2026-10-13.jsonl"
  _job
  _ran
  [ "$(_stale_of growth)" = true ]
  _named growth 2026-10-13 01M4VQ00000000000000000008 note.logged
  _job
  _ran
  [ "$(_stale_of growth)" = false ]
}

@test "stale: a lane that wakes and falls silent again is raised again (a new episode)" {
  _repo
  _lane growth LIVE
  _named growth 2026-08-26 01M4VQ00000000000000000009
  _job
  [[ "$output" == *"raised 1 new"* ]]
  _named growth 2026-09-01 01M4VQ0000000000000000000A
  _job
  _ran
  [[ "$output" == *"raised 1 new"* ]]
  [ "$(_incidents)" -eq 2 ]
}

# ---------- the needs-you line names the lane ----------

@test "stale: the brief lists each silent lane by name under needs-you" {
  _repo
  _lane growth LIVE; _lane leads LIVE
  _named growth 2026-08-26 01M4VQ0000000000000000000B
  _job
  _ran
  run node "$SANDBOX/.claude/scripts/hq/arc-brief.mjs" --date 2026-10-14
  [ "$status" -eq 0 ]
  [[ "$output" == *"needs-you"* ]]
  [[ "$output" == *"incident.raised  lane-stale  growth  LIVE, no lane receipt since 2026-08-26"* ]]
  [[ "$output" == *"incident.raised  lane-stale  leads  LIVE, no lane receipt since ever"* ]]
}

# ---------- nothing tracked is written ----------

@test "stale: --dry-run derives and prints but writes no state file and no receipt" {
  _repo
  _lane growth LIVE
  _job --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" == *"growth"*"stale=true"* ]]
  [ ! -e "$STATE" ]
  [ "$(_incidents)" -eq 0 ]
  _job --bogus
  [ "$status" -eq 2 ]
  [[ "$output" == *'unknown argument "--bogus"'* ]]
}

@test "stale: the job writes only under .claude/state -- no tracked file changes" {
  _repo
  _lane growth LIVE
  printf '# board\n' > "$SANDBOX/PORTFOLIO.md"
  git -C "$SANDBOX" add -A >/dev/null && git -C "$SANDBOX" -c user.name=t -c user.email=t@t commit -qm seed
  _job
  _ran
  [ -s "$STATE" ]
  [ -z "$(git -C "$SANDBOX" status --porcelain --untracked-files=no)" ]
}

# ---------- board-lint --strict ----------

_board_repo() {
  _arc_lane_sandbox
  _arc_make_lane alpha LIVE
  cat > "$SANDBOX/PORTFOLIO.md" <<'EOF'
# PORTFOLIO.md

Updated: 2026-10-14

## Active initiatives

| lane | status | cycle | position | appetite/burn | blocked-on / depends-on | next |
|---|---|---|---|---|---|---|
| alpha | LIVE | c | 00 | 1d / 0d | — | NEXTCELL |

## Venture passports

| venture | repository | current status | next |
|---|---|---|---|
EOF
}
_board_set() { awk -v v="$1" '{ gsub(/NEXTCELL/, v); print }' "$SANDBOX/PORTFOLIO.md" > "$SANDBOX/b.tmp" && mv "$SANDBOX/b.tmp" "$SANDBOX/PORTFOLIO.md"; }
BL="$ARC_ROOT/.claude/scripts/core/board-lint.sh"

@test "board-lint --strict: a stale: field in a cell FAILs and exits 1; without --strict the exit stays 0" {
  _board_repo
  _board_set "stale: true"
  run bash "$BL" --root "$SANDBOX" --strict
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL [board-stale-hand-written] PORTFOLIO.md:9: cell stale: true"* ]]
  run bash "$BL" --root "$SANDBOX"
  [ "$status" -eq 0 ]
  [[ "$output" != *"board-stale-hand-written"* ]]
}

@test "board-lint --strict: a stale column header FAILs" {
  _board_repo
  awk '{ sub(/\| next \|$/, "| next | stale |"); print }' "$SANDBOX/PORTFOLIO.md" > "$SANDBOX/b.tmp" && mv "$SANDBOX/b.tmp" "$SANDBOX/PORTFOLIO.md"
  grep -qF "| next | stale |" "$SANDBOX/PORTFOLIO.md"
  run bash "$BL" --root "$SANDBOX" --strict
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL [board-stale-hand-written] PORTFOLIO.md:7: header cell stale"* ]]
}

@test "board-lint --strict: the prose word stale in a next cell is not a field (exit 0)" {
  _board_repo
  _board_set "the lane went stale last week, see the brief"
  grep -qF "went stale last week" "$SANDBOX/PORTFOLIO.md"
  run bash "$BL" --root "$SANDBOX" --strict
  [ "$status" -eq 0 ]
  [[ "$output" != *"board-stale-hand-written"* ]]
  _board_set_again() { awk '{ gsub(/the lane went stale last week, see the brief/, "LIVE, stale=yes"); print }' "$SANDBOX/PORTFOLIO.md" > "$SANDBOX/b.tmp" && mv "$SANDBOX/b.tmp" "$SANDBOX/PORTFOLIO.md"; }
  _board_set_again
  run bash "$BL" --root "$SANDBOX" --strict
  [ "$status" -eq 1 ]
}

@test "board-lint --strict: a stale field inside a fence or an HTML comment is not on the board" {
  _board_repo
  printf '\n```\n| x | stale: true |\n```\n\n<!--\n| y | stale: true |\n-->\n' >> "$SANDBOX/PORTFOLIO.md"
  grep -c "stale: true" "$SANDBOX/PORTFOLIO.md"
  run bash "$BL" --root "$SANDBOX" --strict
  [ "$status" -eq 0 ]
  [[ "$output" != *"board-stale-hand-written"* ]]
}

# ---------- the owner apply ----------

@test "owner apply: writes the job row, the policy subject and the stub; a second run changes nothing; jobs-lint clean" {
  T="$BATS_TEST_TMPDIR/apply"
  mkdir -p "$T/.claude"
  cp -r "$ARC_ROOT/.claude/scripts" "$T/.claude/"
  cp "$ARC_ROOT/hq.policy.yaml" "$ARC_ROOT/hq.jobs.yaml" "$T/"
  cp -r "$ARC_ROOT/processes" "$T/"
  rm -f "$T/processes/lane-stale.process.yaml"
  # Once the owner has applied, the committed files already hold the rows: strip them so the first run
  # proves the write again, never only the unchanged branch.
  awk '/# portfolio REQ-08 \(ADR-0079\)/ { s = 1 } s && /spend: \{ level: L0 \}/ { s = 0; next } !s' "$T/hq.policy.yaml" > "$T/p" && mv "$T/p" "$T/hq.policy.yaml"
  awk '/# The board that notices \(portfolio REQ-08/ { s = 1 } s && /catchup: skip/ { s = 0; next } !s' "$T/hq.jobs.yaml" > "$T/j" && mv "$T/j" "$T/hq.jobs.yaml"
  run grep -c 'lane-stale' "$T/hq.policy.yaml" "$T/hq.jobs.yaml"
  [[ "$output" == *"hq.policy.yaml:0"* && "$output" == *"hq.jobs.yaml:0"* ]]
  mv "$T/.claude/scripts/docs/wiki-build.mjs" "$T/.claude/scripts/docs/wiki-build.mjs.off"
  git -C "$T" init -q
  run node "$T/.claude/scripts/core/owner-apply-lane-stale.mjs"
  [ "$status" -eq 0 ]
  [[ "$output" == *"hq.policy.yaml: process:lane-stale added"* ]]
  [[ "$output" == *"hq.jobs.yaml: lane-stale added"* ]]
  [[ "$output" == *"processes/lane-stale.process.yaml: written"* ]]
  local before; before="$(cat "$T/hq.policy.yaml" "$T/hq.jobs.yaml" "$T/processes/lane-stale.process.yaml" | git hash-object --stdin)"
  run node "$T/.claude/scripts/core/owner-apply-lane-stale.mjs"
  [ "$status" -eq 0 ]
  [[ "$output" == *"already holds process:lane-stale -- unchanged"* ]]
  [ "$(cat "$T/hq.policy.yaml" "$T/hq.jobs.yaml" "$T/processes/lane-stale.process.yaml" | git hash-object --stdin)" = "$before" ]
  cd "$T"
  run node .claude/scripts/hq/jobs-lint.mjs
  [ "$status" -eq 0 ]
  [[ "$output" == *"jobs-lint: clean"* ]]
}

@test "board-lint --strict: the committed board carries no hand-written stale field (the merge-time gate)" {
  [ "$(grep -c '^| ' "$ARC_ROOT/PORTFOLIO.md")" -gt 10 ]
  run bash "$BL" --root "$ARC_ROOT" --strict
  [ "$status" -eq 0 ]
  [[ "$output" != *"FAIL [board-stale-hand-written]"* ]]
}

@test "stale: round-2 L1 -- a rehearsal or test receipt naming the lane does not reset the clock" {
  _repo
  _lane growth LIVE
  printf '{"id":"01M4VQ0000000000000000000C","kind":"phase.closed","ts":"2026-10-13T05:30:00+05:30","supersedes":null,"payload":{"lane":"growth","rehearsal":true}}\n' >> "$ARC_SPINE_ROOT/events/2026-10-13.jsonl"
  printf '{"id":"01M4VQ0000000000000000000D","kind":"phase.closed","ts":"2026-10-13T05:30:00+05:30","supersedes":null,"payload":{"lane":"growth","test":"false"}}\n' >> "$ARC_SPINE_ROOT/events/2026-10-13.jsonl"
  _job
  _ran
  [ "$(_stale_of growth)" = true ]
  _named growth 2026-10-13 01M4VQ0000000000000000000E
  _job
  [ "$(_stale_of growth)" = false ]
}

@test "stale: round-2 L2 -- a never-named lane back LIVE in a new cycle is a new episode and is raised again" {
  _repo
  _lane growth LIVE
  _job
  [[ "$output" == *"raised 1 new"* ]]
  printf 'status: LIVE\ncycle: arc-growth (Cycle 2)\n\n# tracker\n' > "$SANDBOX/initiatives/growth/PROGRESS.md"
  _job
  _ran
  [[ "$output" == *"raised 1 new"* ]]
  [ "$(_incidents)" -eq 2 ]
  _job
  [[ "$output" == *"raised 0 new, 1 already raised"* ]]
}

@test "stale: round-2 L3 -- the brief prints a lane-stale line only for a lane name in the lane grammar" {
  _repo
  printf '{"id":"01M4VQ0000000000000000000F","kind":"incident.raised","ts":"2026-10-14T05:30:00+05:30","supersedes":null,"payload":{"class":"lane-stale","silent_lane":"**evil** [x](y)","last_receipt_ts":"garbage"}}\n' >> "$ARC_SPINE_ROOT/events/2026-10-14.jsonl"
  printf '{"id":"01M4VQ0000000000000000000G","kind":"incident.raised","ts":"2026-10-14T05:31:00+05:30","supersedes":null,"payload":{"class":"lane-stale","silent_lane":"growth","last_receipt_ts":"garbage"}}\n' >> "$ARC_SPINE_ROOT/events/2026-10-14.jsonl"
  run node "$SANDBOX/.claude/scripts/hq/arc-brief.mjs" --date 2026-10-14
  [ "$status" -eq 0 ]
  [[ "$output" == *"incident.raised  lane-stale  growth  LIVE, no lane receipt since an unreadable date"* ]]
  [[ "$output" != *"evil"* ]]
}

@test "board-lint --strict: round-2 B6 -- a row with no trailing pipe keeps its last cell" {
  _board_repo
  awk '{ if (index($0, "| alpha |") == 1) { sub(/ \|$/, ""); sub(/NEXTCELL$/, "stale: yes") } print }' "$SANDBOX/PORTFOLIO.md" > "$SANDBOX/b.tmp" && mv "$SANDBOX/b.tmp" "$SANDBOX/PORTFOLIO.md"
  grep -q "| stale: yes$" "$SANDBOX/PORTFOLIO.md"
  run bash "$BL" --root "$SANDBOX" --strict
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL [board-stale-hand-written]"* ]]
}

@test "stale: this suite registers every case it declares" {
  n=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$n" -eq 20 ]
  [ "$BATS_TEST_NUMBER" -eq 20 ]
}
