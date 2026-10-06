#!/usr/bin/env bats
# discover Phase 03 -- the human gate and the venture.yaml launch accepts (REQ-05, REQ-06, REQ-09;
# ADR-1905, ADR-1912, ADR-1916). launch's loadProfile + resolveBoard are imported from launch,
# never copied; a contract change there turns this suite red the same day.

bats_require_minimum_version 1.5.0
load 'test_helper'

CLI() { printf '%s' "$ARC_ROOT/.claude/scripts/discover/arc-discover.mjs"; }
FX() { printf '%s' "$ARC_ROOT/tests/discover/fixtures/$1"; }
EVENT() { printf '%s' "$ARC_ROOT/.claude/scripts/hq/arc-event.mjs"; }

idem_for() { node -e 'process.stdout.write(require("crypto").createHash("sha256").update("decision.recorded|" + process.argv[1]).digest("hex"))' "$1"; }

setup() {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT" "$BATS_TEST_TMPDIR/ventures"
  H="$BATS_TEST_TMPDIR/h"
}

# hunt -> score -> judge -> propose; prints the approval request id.
to_proposal() {
  node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "chasing late payments" --query "invoicing software pain" --offline-fixture "$(FX recorded/hn.json)" --out "$H" >/dev/null
  node "$(CLI)" score --in "$H" >/dev/null
  node "$(CLI)" judge --in "$H" >/dev/null
  node "$(CLI)" propose --in "$H" --emit >/dev/null
  node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).request)' "$H/proposal.json"
}

decide() { # request verdict reason-file
  node -e '
    const fs = require("fs");
    fs.writeFileSync(process.argv[4], JSON.stringify({ decides: process.argv[1], verdict: process.argv[2], reason: fs.readFileSync(process.argv[3], "utf8").trim() }));
  ' "$1" "$2" "$3" "$BATS_TEST_TMPDIR/dec.json"
  node "$(EVENT)" emit decision.recorded --strict --payload-file "$BATS_TEST_TMPDIR/dec.json" --idem "$(idem_for "$1")" | tail -1
}

# launch's own acceptor, imported from launch, on a ventures dir.
launch_accepts() {
  node --input-type=module -e '
    const [root, slug, dir] = process.argv.slice(1);
    const { pathToFileURL } = await import("node:url");
    const { loadProfile, loadCatalog, resolveBoard } = await import(pathToFileURL(root + "/.claude/scripts/launch/lib/catalog.mjs").href);
    try { const p = loadProfile(slug, dir); resolveBoard(loadCatalog(), p); process.stdout.write("ACCEPTED " + p.honesty_class + " " + p.type); }
    catch (e) { process.stdout.write("REFUSED " + e.code + " " + e.message); }
  ' "$ARC_ROOT" "$1" "$2"
}

slug_of() { node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).slug)' "$H/proposal.json"; }

@test "discover-export: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "discover-export: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 6 ] || { echo "declared $declared, expected 6"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "discover-export: the winner is one approval.requested carrying its fingerprint and tokens" {
  local ask
  ask=$(to_proposal)
  [[ "$ask" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] || { echo "no request: $ask"; false; }
  run --separate-stderr node -e '
    const fs = require("fs"), path = require("path");
    const dir = path.join(process.argv[1], "events");
    const evs = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).flatMap((f) => fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
    const asks = evs.filter((e) => e.kind === "approval.requested");
    const p = asks[0] && asks[0].payload;
    process.stdout.write(asks.length === 1 && p.gate === "discover-winner" && /^[0-9a-f]{64}$/.test(p.cluster_fp) && p.cluster_tokens.length > 0 ? "one" : "bad " + JSON.stringify(asks));
  ' "$ARC_SPINE_ROOT"
  [ "$status" -eq 0 ] && [ "$output" = "one" ] || { echo "$output $stderr"; false; }
}

@test "discover-export: nothing is exported while open or after a reject, and the reject feeds the next hunt" {
  local ask dec
  ask=$(to_proposal)
  run --separate-stderr node "$(CLI)" export --in "$H" --ventures-dir "$BATS_TEST_TMPDIR/ventures"
  [ "$status" -eq 2 ] && [[ "$stderr" == *"is still open"* ]] || { echo "[open] $status $stderr"; false; }
  printf 'not this one, too generic' > "$BATS_TEST_TMPDIR/reason.txt"
  dec=$(decide "$ask" reject "$BATS_TEST_TMPDIR/reason.txt")
  [[ "$dec" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] || { echo "reject not recorded: $dec"; false; }
  run --separate-stderr node "$(CLI)" export --in "$H" --ventures-dir "$BATS_TEST_TMPDIR/ventures"
  [ "$status" -eq 2 ] && [[ "$stderr" == *"was rejected"* ]] || { echo "[rejected] $status $stderr"; false; }
  [ -z "$(ls -A "$BATS_TEST_TMPDIR/ventures")" ] || { echo "a file was written"; false; }
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "chasing late payments" --query "invoicing software pain" --offline-fixture "$(FX recorded/hn.json)" --out "$BATS_TEST_TMPDIR/h2"
  [ "$status" -eq 0 ] && [[ "$output" == *"previously rejected $dec"* ]] || { echo "the next hunt did not read the reject: $output"; false; }
}

@test "discover-export: an approved winner is a venture.yaml launch accepts with zero edits, plus its evidence" {
  local ask slug
  ask=$(to_proposal)
  slug=$(slug_of)
  printf 'yes, build it' > "$BATS_TEST_TMPDIR/reason.txt"
  decide "$ask" approve "$BATS_TEST_TMPDIR/reason.txt" >/dev/null
  run --separate-stderr node "$(CLI)" export --in "$H" --ventures-dir "$BATS_TEST_TMPDIR/ventures"
  [ "$status" -eq 0 ] && [[ "$output" == *"accepted by launch loadProfile"* ]] || { echo "$status $output $stderr"; false; }
  [ -f "$BATS_TEST_TMPDIR/ventures/$slug.venture.yaml" ] && [ -f "$BATS_TEST_TMPDIR/ventures/$slug.hunt.md" ] || { echo "files missing"; ls "$BATS_TEST_TMPDIR/ventures"; false; }
  run launch_accepts "$slug" "$BATS_TEST_TMPDIR/ventures"
  [ "$output" = "ACCEPTED rehearsal saas-b2b" ] || { echo "$output"; false; }
  grep -q "^# evidence: $slug.hunt.md$" "$BATS_TEST_TMPDIR/ventures/$slug.venture.yaml" || { echo "no evidence link"; false; }
  grep -qE '^# money_signal.estimate_minor: ([0-9]+ USD|ABSENT) -- ' "$BATS_TEST_TMPDIR/ventures/$slug.venture.yaml" || { echo "no money seed"; false; }
  grep -q 'https://news.ycombinator.com/item?id=' "$BATS_TEST_TMPDIR/ventures/$slug.hunt.md" || { echo "no evidence links in hunt.md"; false; }
  ! grep -rqE '"kind":"revenue\.' "$ARC_SPINE_ROOT/events" || { echo "discover emitted a revenue event"; false; }
  run --separate-stderr node "$(CLI)" export --in "$H" --ventures-dir "$BATS_TEST_TMPDIR/ventures"
  [ "$status" -eq 2 ] && [[ "$stderr" == *"never overwritten"* ]] || { echo "[re-export] $status $stderr"; false; }
}

@test "discover-export: owner overrides apply, and an override outside launch's enum is refused" {
  local ask slug
  ask=$(to_proposal)
  slug=$(slug_of)
  printf 'go. honesty_class=real type=saas-b2c region=in' > "$BATS_TEST_TMPDIR/reason.txt"
  decide "$ask" approve "$BATS_TEST_TMPDIR/reason.txt" >/dev/null
  run --separate-stderr node "$(CLI)" export --in "$H" --ventures-dir "$BATS_TEST_TMPDIR/ventures"
  [ "$status" -eq 0 ] || { echo "$status $stderr"; false; }
  run launch_accepts "$slug" "$BATS_TEST_TMPDIR/ventures"
  [ "$output" = "ACCEPTED real saas-b2c" ] || { echo "$output"; false; }
  rm -rf "$BATS_TEST_TMPDIR/spine" "$BATS_TEST_TMPDIR/ventures" "$H" && mkdir -p "$ARC_SPINE_ROOT" "$BATS_TEST_TMPDIR/ventures"
  ask=$(to_proposal)
  printf 'go type=saas-b2b;rm' > "$BATS_TEST_TMPDIR/reason.txt"
  decide "$ask" approve "$BATS_TEST_TMPDIR/reason.txt" >/dev/null
  run --separate-stderr node "$(CLI)" export --in "$H" --ventures-dir "$BATS_TEST_TMPDIR/ventures"
  [ "$status" -eq 2 ] && [[ "$stderr" == *"BAD_OVERRIDE"*"type="* ]] || { echo "[bad override] $status $stderr"; false; }
  [ -z "$(ls -A "$BATS_TEST_TMPDIR/ventures")" ] || { echo "a refused export wrote a file"; false; }
}

@test "discover-export: hostile titles stay out of the yaml, and an injected field is refused by launch naming it" {
  node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "invoice payments" --offline-fixture "$(FX hostile.json)" --out "$H" >/dev/null
  node "$(CLI)" score --in "$H" >/dev/null
  node "$(CLI)" judge --in "$H" >/dev/null
  node "$(CLI)" propose --in "$H" --emit >/dev/null
  local ask slug
  ask=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).request)' "$H/proposal.json")
  slug=$(slug_of)
  printf 'ok' > "$BATS_TEST_TMPDIR/reason.txt"
  decide "$ask" approve "$BATS_TEST_TMPDIR/reason.txt" >/dev/null
  run --separate-stderr node "$(CLI)" export --in "$H" --ventures-dir "$BATS_TEST_TMPDIR/ventures"
  [ "$status" -eq 0 ] || { echo "$status $stderr"; false; }
  local y="$BATS_TEST_TMPDIR/ventures/$slug.venture.yaml"
  ! grep -qE 'PWNED|touch|rm -rf|\{\{' "$y" || { echo "mined text reached the yaml"; cat "$y"; false; }
  [ ! -e "$BATS_TEST_TMPDIR/PWNED_SUBST" ] && [ ! -e "$ARC_ROOT/PWNED_SUBST" ]
  run launch_accepts "$slug" "$BATS_TEST_TMPDIR/ventures"
  [[ "$output" == "ACCEPTED "* ]] || { echo "$output"; false; }
  # Negative arm: the same file with a hostile title planted in `type` -- launch must refuse, naming type.
  node -e '
    const fs = require("fs");
    const title = JSON.parse(JSON.parse(fs.readFileSync(process.argv[2], "utf8")).responses[0].body).hits[0].title;
    fs.writeFileSync(process.argv[1], fs.readFileSync(process.argv[1], "utf8").replace(/^type: .*$/m, "type: " + JSON.stringify(title)));
  ' "$y" "$(FX hostile.json)"
  run launch_accepts "$slug" "$BATS_TEST_TMPDIR/ventures"
  [[ "$output" == "REFUSED SHAPE venture profile field type="* ]] || { echo "$output"; false; }
}
