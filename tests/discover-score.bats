#!/usr/bin/env bats
# discover Phase 02 -- evidence-traced scoring from owner-owned weights (REQ-03; ADR-1903).

bats_require_minimum_version 1.5.0
load 'test_helper'

CLI() { printf '%s' "$ARC_ROOT/.claude/scripts/discover/arc-discover.mjs"; }
FX() { printf '%s' "$ARC_ROOT/tests/discover/fixtures/$1"; }
EVENT() { printf '%s' "$ARC_ROOT/.claude/scripts/hq/arc-event.mjs"; }
sha() { node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))' "$1"; }

idem_for() { node -e 'process.stdout.write(require("crypto").createHash("sha256").update("decision.recorded|" + process.argv[1]).digest("hex"))' "$1"; }

setup() {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT"
}

hunt_recorded() {
  node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "chasing late payments" --query "invoicing software pain" --offline-fixture "$(FX recorded/hn.json)" --out "$1"
}

# Rewrites one weight in a copy of score.yaml; $3=keep|update the sha line; prints the new sha.
edit_weight() {
  node -e '
    const fs = require("fs"), { createHash } = require("crypto");
    const [src, dst, mode, decision] = process.argv.slice(1);
    let t = fs.readFileSync(src, "utf8").replace(/^  money_signal: [0-9]+$/m, "  money_signal: 35");
    const w = { pain_frequency: 40, money_signal: 35, buildability_2w: 20, moat_hint: 10 };
    const sha = createHash("sha256").update(Object.entries(w).map(([k, v]) => k + "=" + v).join("\n"), "utf8").digest("hex");
    if (mode === "update") t = t.replace(/^weights_sha256: [0-9a-f]+$/m, "weights_sha256: " + sha).replace(/^decision: .*$/m, "decision: " + decision);
    fs.writeFileSync(dst, t);
    process.stdout.write(sha);
  ' "$ARC_ROOT/products/discover/score.yaml" "$1" "$2" "${3:-none}"
}

@test "discover-score: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "discover-score: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 6 ] || { echo "declared $declared, expected 6"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "discover-score: the same clusters give byte-identical scores, every row cites evidence" {
  run --separate-stderr hunt_recorded "$BATS_TEST_TMPDIR/h"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  run --separate-stderr node "$(CLI)" score --in "$BATS_TEST_TMPDIR/h"
  [ "$status" -eq 0 ] && [[ "$output" == "score: "*" scored, 0 previously rejected"* ]] || { echo "$status $output $stderr"; false; }
  cp "$BATS_TEST_TMPDIR/h/scores.json" "$BATS_TEST_TMPDIR/first.json"
  run --separate-stderr node "$(CLI)" score --in "$BATS_TEST_TMPDIR/h"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  [ "$(sha "$BATS_TEST_TMPDIR/first.json")" = "$(sha "$BATS_TEST_TMPDIR/h/scores.json")" ] || { echo "two score runs differ"; false; }
  run --separate-stderr node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const bad = d.scores.filter((s) => !s.evidence.length || !Number.isSafeInteger(s.score));
    const sorted = d.scores.every((s, i, a) => i === 0 || a[i - 1].score >= s.score);
    process.stdout.write(d.scores.length >= 12 && bad.length === 0 && sorted ? "ok " + d.scores.length : "bad " + JSON.stringify(bad.slice(0, 2)) + " sorted=" + sorted);
  ' "$BATS_TEST_TMPDIR/h/scores.json"
  [ "$status" -eq 0 ] && [[ "$output" == "ok "* ]] || { echo "$output $stderr"; false; }
}

@test "discover-score: an ABSENT engagement is named in the row, never a 0 or NaN" {
  mkdir -p "$BATS_TEST_TMPDIR/a" && cp "$(FX clusters-absent.json)" "$BATS_TEST_TMPDIR/a/clusters.json"
  run --separate-stderr node "$(CLI)" score --in "$BATS_TEST_TMPDIR/a"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  run --separate-stderr node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const a = d.scores.find((s) => s.cluster_fp === "a".repeat(64));
    const text = JSON.stringify(d);
    process.stdout.write([a.terms.pain_frequency.note, a.money_signal.estimate_minor, text.includes("NaN") || text.includes("null,") ? "has-nan" : "clean"].join("|"));
  ' "$BATS_TEST_TMPDIR/a/scores.json"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  [ "$output" = "engagement: ABSENT (size only)|2900|clean" ] || { echo "$output"; false; }
}

@test "discover-score: a weight edited without its sha is refused (DIS-C)" {
  mkdir -p "$BATS_TEST_TMPDIR/a" && cp "$(FX clusters-absent.json)" "$BATS_TEST_TMPDIR/a/clusters.json"
  edit_weight "$BATS_TEST_TMPDIR/w.yaml" keep >/dev/null
  run --separate-stderr node "$(CLI)" score --in "$BATS_TEST_TMPDIR/a" --weights "$BATS_TEST_TMPDIR/w.yaml"
  [ "$status" -eq 2 ] && [[ "$stderr" == *"WEIGHTS_UNRECEIPTED"*"without updating weights_sha256"* ]] || { echo "$status $stderr"; false; }
  [ ! -e "$BATS_TEST_TMPDIR/a/scores.json" ] || { echo "a refused run still wrote scores.json"; false; }
}

@test "discover-score: a new weight applies only after an approved discover-weights decision" {
  mkdir -p "$BATS_TEST_TMPDIR/a" && cp "$(FX clusters-absent.json)" "$BATS_TEST_TMPDIR/a/clusters.json"
  local sha ask dec
  sha=$(edit_weight "$BATS_TEST_TMPDIR/w.yaml" update 01UNKNOWNDECISION000000000)
  run --separate-stderr node "$(CLI)" score --in "$BATS_TEST_TMPDIR/a" --weights "$BATS_TEST_TMPDIR/w.yaml"
  [ "$status" -eq 2 ] && [[ "$stderr" == *"is not an approved discover-weights request"* ]] || { echo "[no decision] $status $stderr"; false; }
  printf '{"what":"discover weights money_signal 35","gate":"discover-weights","weights_sha256":"%s"}' "$sha" > "$BATS_TEST_TMPDIR/ask.json"
  ask=$(node "$(EVENT)" emit approval.requested --strict --process discover@0.1.0 --payload-file "$BATS_TEST_TMPDIR/ask.json" | tail -1)
  [[ "$ask" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] || { echo "ask not recorded: $ask"; false; }
  printf '{"decides":"%s","verdict":"approve","reason":"fixture weights"}' "$ask" > "$BATS_TEST_TMPDIR/dec.json"
  dec=$(node "$(EVENT)" emit decision.recorded --strict --payload-file "$BATS_TEST_TMPDIR/dec.json" --idem "$(idem_for "$ask")" | tail -1)
  [[ "$dec" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] || { echo "decision not recorded: $dec"; false; }
  edit_weight "$BATS_TEST_TMPDIR/w.yaml" update "$dec" >/dev/null
  run --separate-stderr node "$(CLI)" score --in "$BATS_TEST_TMPDIR/a" --weights "$BATS_TEST_TMPDIR/w.yaml"
  [ "$status" -eq 0 ] || { echo "[approved] $status $stderr"; false; }
  grep -q '"money_signal": 35' "$BATS_TEST_TMPDIR/a/scores.json" || { echo "the approved weight did not apply"; false; }
}

@test "discover-score: a previously rejected cluster is listed, never scored" {
  mkdir -p "$BATS_TEST_TMPDIR/j" && cp "$(FX judge-one/clusters.json)" "$BATS_TEST_TMPDIR/j/clusters.json"
  run --separate-stderr node "$(CLI)" score --in "$BATS_TEST_TMPDIR/j"
  [ "$status" -eq 0 ] && [[ "$output" == "score: 1 scored, 1 previously rejected"* ]] || { echo "$status $output $stderr"; false; }
}
