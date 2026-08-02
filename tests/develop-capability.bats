#!/usr/bin/env bats
# Phase 06 -- capability acquisition: find it, pin it, and refuse it by default.
#
# Red-first: every @test here fails before .claude/scripts/develop/capability-vet.sh exists.
#
# The load-bearing red is the BLOCK/PASS PAIR, not the BLOCK list. A gate that refuses
# everything satisfies all eleven refusal tests and is worthless, so `clean` and
# `write-capable-ok` must PASS in the same run that the others fail. ADR-0110's own words:
# "a gate that passes everything reads as safety and provides none" -- and the inverse, a gate
# that fails everything, is discovered the first time someone needs it and then switched off.
#
# Every fixture differs from `clean` in exactly ONE way, so a BLOCK names its own cause.
bats_require_minimum_version 1.5.0
load 'test_helper'

VET() { echo "$ARC_ROOT/.claude/scripts/develop/capability-vet.sh"; }
FX()  { echo "$ARC_ROOT/tests/fixtures/develop/capability"; }

# Vet one fixture against the fixture allowlist, into a throwaway lock file.
_vet() {
  local name="$1"; shift
  LOCK="$BATS_TEST_TMPDIR/capability-lock.json"
  run bash "$(VET)" \
    --candidate "$(FX)/$name" \
    --allowlist "$(FX)/allowlist.txt" \
    --lock "$LOCK" "$@"
}

# Every refusal names the condition it refused on, in one place, so a BLOCK is actionable.
_blocks_on() {
  [ "$status" -ne 0 ] || { echo "expected a BLOCK, got exit 0:"; echo "$output"; return 1; }
  [[ "$output" == *"BLOCK"* ]] || { echo "no BLOCK line: $output"; return 1; }
  [[ "$output" == *"[$1]"* ]] || { echo "BLOCKed, but not on [$1]: $output"; return 1; }
}

# ---------------------------------------------------------------------------
# The PASS half. Without these the eleven refusals below prove nothing.
# ---------------------------------------------------------------------------

@test "a candidate satisfying every condition PASSES" {
  _vet clean
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PASS"* ]] || { echo "$output"; false; }
}

@test "a write-capable candidate PASSES when the human OK is recorded" {
  _vet write-capable-ok
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"write-capable"* ]] || { echo "the class was not stated: $output"; false; }
}

# ---------------------------------------------------------------------------
# One BLOCK per condition -- asserted once per condition, never once in total
# ---------------------------------------------------------------------------

@test "BLOCK: the candidate is not on the allowlist" {
  _vet no-allowlist
  _blocks_on allowlist
}

@test "BLOCK: the version is a range rather than a pin" {
  _vet no-version
  _blocks_on version
}

@test "BLOCK: no hash is recorded" {
  _vet no-hash
  _blocks_on hash
}

@test "BLOCK: provenance is one field where it must be two" {
  # publisher-auth and build-attestation answer different questions and are never collapsed
  # into one boolean (ADR-0110). Recording only the first is not provenance.
  _vet no-provenance
  _blocks_on provenance
}

@test "BLOCK: the content scan catches a planted exfiltration pattern" {
  _vet exfil
  _blocks_on content-scan
}

@test "BLOCK: the content scan catches a planted curl-pipe-sh" {
  _vet curl-pipe-sh
  _blocks_on content-scan
}

@test "BLOCK: a candidate that does not resolve is refused at the existence check" {
  _vet no-registry-record
  _blocks_on existence
}

@test "the existence check runs BEFORE anything else" {
  # A name that resolves to nothing must be refused first, not after five other opinions --
  # otherwise the report reads as though the thing exists and merely fails a policy.
  _vet no-registry-record
  local first
  first="$(echo "$output" | grep -E '^(BLOCK|PASS)' | head -1)"
  [[ "$first" == *"[existence]"* ]] || { echo "first verdict line was: $first"; false; }
}

@test "BLOCK: an unreadable candidate is treated as write-capable, not as clean" {
  # An absence of red flags is not a pass. A compiled blob routes to the human-OK path.
  _vet unreadable
  _blocks_on human-ok
  [[ "$output" == *"could not be read"* || "$output" == *"inconclusive"* ]] \
    || { echo "the reason was not stated: $output"; false; }
}

@test "BLOCK: a candidate claiming read-only while its source writes files" {
  # The self-report never overrides the scan (ADR-0110: ToolAnnotations are hints).
  _vet self-report-lies
  _blocks_on human-ok
  [[ "$output" == *"write"* ]] || { echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# Every BLOCK has a negative control: the same condition, satisfied, must PASS
# ---------------------------------------------------------------------------

@test "the allowlist check can pass as well as fail" {
  _vet clean
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _vet no-allowlist
  [ "$status" -ne 0 ]
}

@test "the human-OK check can pass as well as fail" {
  _vet write-capable-ok
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _vet self-report-lies
  [ "$status" -ne 0 ]
}

# ---------------------------------------------------------------------------
# The vet script never installs
# ---------------------------------------------------------------------------

@test "a hostile postinstall is scanned without ever executing" {
  local marker="$BATS_TEST_TMPDIR/postinstall-ran.txt"
  ARC_MARKER="$marker" _vet hostile-postinstall
  [ ! -e "$marker" ] || { echo "the candidate's lifecycle script RAN"; false; }
  # and it is still a real verdict, not a crash
  [[ "$output" == *"BLOCK"* || "$output" == *"PASS"* ]] || { echo "$output"; false; }
}

@test "the vet script does not invoke a package manager at all" {
  # Structural: reading the script is the only way to prove a command was never reachable,
  # and `npm install` inside a branch nothing exercises is still a loaded gun.
  run grep -nE '(npm|pnpm|yarn|pip|pip3|uv)[[:space:]]+(install|add|i)([[:space:]]|$)' "$(VET)"
  [ "$status" -ne 0 ] || { echo "an install command is present:"; echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# The lock file
# ---------------------------------------------------------------------------

@test "a PASS writes version, hash, both provenance fields and the date checked" {
  _vet clean
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -f "$LOCK" ] || { echo "no lock file written"; false; }
  run node -e '
    const l = require(process.argv[1]);
    const r = (l.capabilities || []).find((c) => c.name === "safe-tool");
    if (!r) { console.log("no row"); process.exit(1); }
    for (const k of ["version", "hash", "publisher-auth", "build-attestation", "checked"]) {
      if (!r[k]) { console.log("missing " + k); process.exit(1); }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.checked)) { console.log("bad date " + r.checked); process.exit(1); }
    console.log("row ok");
  ' "$LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "a BLOCK admits nothing, and records the refusal rather than losing it" {
  _vet exfil
  [ "$status" -ne 0 ]
  [ -f "$LOCK" ] || { echo "the refusal was not recorded anywhere"; false; }
  run node -e '
    const l = require(process.argv[1]);
    if ((l.capabilities || []).some((c) => c.name === "safe-tool")) { console.log("a refused candidate was ADMITTED"); process.exit(1); }
    const r = (l.refusals || []).find((c) => c.name === "safe-tool");
    if (!r) { console.log("the refusal was not recorded"); process.exit(1); }
    if (!r["refused-on"] || !r.why) { console.log("the refusal records no reason"); process.exit(1); }
    console.log("refused on: " + r["refused-on"]);
  ' "$LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"content-scan"* ]] || { echo "$output"; false; }
}

@test "a candidate admitted after an earlier refusal is not left in both lists" {
  # The same name refused once and admitted later must not read as both at once.
  _vet exfil
  [ "$status" -ne 0 ]
  _vet clean          # same name, same lock file, everything satisfied this time
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node -e '
    const l = require(process.argv[1]);
    const admitted = (l.capabilities || []).some((c) => c.name === "safe-tool");
    if (!admitted) { console.log("the passing run admitted nothing"); process.exit(1); }
    console.log("admitted, refusal history kept: " + ((l.refusals || []).length > 0));
  ' "$LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "--audit reports a lock row checked more than 30 days ago" {
  LOCK="$BATS_TEST_TMPDIR/old-lock.json"
  cat > "$LOCK" <<'JSON'
{ "capabilities": [
  { "name": "safe-tool", "registry": "npm", "version": "1.2.3", "hash": "sha512-abc",
    "publisher-auth": "recorded", "build-attestation": "none published", "checked": "2020-01-01" } ] }
JSON
  run bash "$(VET)" --audit --lock "$LOCK"
  [[ "$output" == *"safe-tool"* ]] || { echo "$output"; false; }
  [[ "$output" == *"stale"* ]] || { echo "staleness was not reported: $output"; false; }
}

@test "--audit says so plainly when nothing is stale" {
  LOCK="$BATS_TEST_TMPDIR/fresh-lock.json"
  local today; today="$(date -u +%Y-%m-%d)"
  cat > "$LOCK" <<JSON
{ "capabilities": [
  { "name": "safe-tool", "registry": "npm", "version": "1.2.3", "hash": "sha512-abc",
    "publisher-auth": "recorded", "build-attestation": "none published", "checked": "$today" } ] }
JSON
  run bash "$(VET)" --audit --lock "$LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The per-row form is a line STARTING with `stale`. The summary always contains the word
  # ("0 stale."), so a bare substring test called every clean audit a failure.
  run bash -c "bash '$(VET)' --audit --lock '$LOCK' | grep -c '^stale'"
  [ "$output" = "0" ] || { echo "a fresh row was reported stale"; false; }
}

# ---------------------------------------------------------------------------
# The scout reports and installs nothing; the command exists; the manifest lists them
# ---------------------------------------------------------------------------

@test "the capability-scout agent has no write tools" {
  local a="$ARC_ROOT/.claude/agents/capability-scout.md"
  [ -f "$a" ] || { echo "no agent definition"; false; }
  run grep -iE '^tools:.*(Write|Edit|NotebookEdit)' "$a"
  [ "$status" -ne 0 ] || { echo "the scout can write: $output"; false; }
}

@test "the arc-capability command exists and says it installs nothing" {
  local c="$ARC_ROOT/.claude/commands/arc-capability.md"
  [ -f "$c" ] || { echo "no command file"; false; }
  run grep -iE 'installs? nothing|never installs|refuses to install' "$c"
  [ "$status" -eq 0 ] || { echo "the command does not state its own limit"; false; }
}

@test "the product manifest lists every new file" {
  local m="$ARC_ROOT/products/develop/manifest.json"
  run node -e '
    const m = require(process.argv[1]);
    const want = {
      scripts:  ".claude/scripts/develop/capability-vet.sh",
      commands: ".claude/commands/arc-capability.md",
      agents:   ".claude/agents/capability-scout.md",
    };
    for (const [k, v] of Object.entries(want)) {
      if (!(m[k] || []).includes(v)) { console.log("manifest " + k + " is missing " + v); process.exit(1); }
    }
    console.log("manifest ok");
  ' "$m"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "root CLAUDE.md lists /arc-capability among its commands" {
  run grep -n '/arc-capability' "$ARC_ROOT/CLAUDE.md"
  [ "$status" -eq 0 ] || { echo "a new top-level entry point that nothing announces"; false; }
}

# ---------------------------------------------------------------------------
# The one REAL candidate, vetted by hand and committed as an artifact
# ---------------------------------------------------------------------------

@test "the committed lock file records the real candidate that was actually vetted" {
  # ADR-0110 separates vetting from installing, so arc gains a lock entry and NO dependency.
  # This asserts the artifact of the hand-run, never a live fetch: CI reaches no registry.
  #
  # The real candidate was madge, and the honest outcome is that the gate REFUSED it: its
  # hash verified byte-for-byte against the registry, its publisher was recorded, and its
  # source spawns `child_process`, which makes it write-capable and therefore Ashiq's call.
  # Asserting "an admitted row exists" would have forced a fabricated approval, which is the
  # one thing ADR-0108 and this phase's non-negotiables both exist to refuse. So this asserts
  # the DECISION is recorded with its facts, whichever way it went.
  local lock="$ARC_ROOT/.claude/scripts/develop/capability-lock.json"
  [ -f "$lock" ] || { echo "no committed lock file"; false; }
  run node -e '
    const l = require(process.argv[1]);
    const rows = [...(l.capabilities || []), ...(l.refusals || [])];
    if (!rows.length) { console.log("the lock file records no decision at all"); process.exit(1); }
    for (const r of rows) {
      for (const k of ["name", "registry", "version", "hash", "publisher-auth", "build-attestation", "checked"]) {
        if (!r[k]) { console.log(r.name + " is missing " + k); process.exit(1); }
      }
      if (!/^sha(256|512)-/.test(r.hash)) { console.log(r.name + " hash is not a registry integrity string"); process.exit(1); }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.checked)) { console.log(r.name + " checked date is not ISO"); process.exit(1); }
    }
    console.log("decisions: " + rows.map((r) => r.name + "@" + r.version).join(", "));
  ' "$lock"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "nothing write-capable is admitted without a recorded human OK" {
  # The committed lock file, checked against the rule rather than against today's contents.
  local lock="$ARC_ROOT/.claude/scripts/develop/capability-lock.json"
  run node -e '
    const l = require(process.argv[1]);
    const bad = (l.capabilities || []).filter((c) => /write-capable/.test(c.class || "") && !/human OK recorded/.test(c.class || ""));
    if (bad.length) { console.log("admitted without an OK: " + bad.map((c) => c.name).join(", ")); process.exit(1); }
    console.log("ok");
  ' "$lock"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "vetting a real candidate added no dependency to this repo" {
  # The whole point of ADR-0110's separation. If vetting ever installs, this fails.
  [ ! -e "$ARC_ROOT/node_modules" ] || { echo "node_modules exists in arc"; false; }
  # Guarded: arc has no package.json today, and `grep` on a missing file also exits non-zero.
  # An assertion that passes because the file is absent proves nothing about dependencies --
  # that is the vacuous pass Phase 05 shipped and CI caught.
  if [ -f "$ARC_ROOT/package.json" ]; then
    run grep -nE '"(dependencies|devDependencies)"' "$ARC_ROOT/package.json"
    [ "$status" -ne 0 ] || { echo "arc gained dependencies: $output"; false; }
  fi
}

# ---------------------------------------------------------------------------
# Holes two fresh agents found, neither having seen the code.
#
# Between them they defeated ALL SEVEN checks and got a candidate carrying
# child_process, `curl | sh`, env exfiltration and an /etc/cron.d write to
# `PASS — read-only`, exit 0. Every one is pinned here.
#
# The single root cause was one design decision: untrusted multi-line strings
# fed into line-oriented grep and sed. The metadata half is structural now.
# ---------------------------------------------------------------------------

@test "hole: a newline in the name does not smuggle a candidate past the allowlist" {
  # `grep -qxF` treats each line of the pattern as its own fixed string, so
  # `evil-package\nsafe-tool` matched — defeating the ONE control ADR-0110 names
  # as the anti-slopsquatting defence.
  _vet name-newline
  [ "$status" -ne 0 ] || { echo "an unallowlisted name PASSED: $output"; false; }
  [[ "$output" == *"not a package name"* ]] || { echo "$output"; false; }
}

@test "hole: the claimed hash must EQUAL the one the registry published" {
  # Shape-checking meant sixteen As satisfied "an integrity hash from the registry".
  _vet hash-mismatch
  _blocks_on hash
  [[ "$output" == *"not the one the registry published"* ]] || { echo "$output"; false; }
}

@test "hole: a payload outside src/ is scanned" {
  # A real npm tarball puts code in lib/ or dist/. Only src/ used to be read, and the
  # identical file one directory over came back read-only.
  _vet payload-outside-src
  _blocks_on content-scan
}

@test "hole: one NUL byte does not hide a payload from the scan" {
  # `grep -I` skips any file holding a NUL, and a NUL inside a JS comment changes nothing
  # about how the file executes. The flag string said -a AND -I; -I won.
  _vet nul-byte
  _blocks_on content-scan
  [ -n "$(echo "$output" | grep 'BLOCK \[human-ok\]')" ] || { echo "opaque should also mean write-capable"; echo "$output"; false; }
}

@test "hole: one readable file does not clear an opaque one" {
  # `grep -rIl . | head -1` asked "is ANY file readable", so a README beside a compiled
  # blob reclassified the whole candidate as read-only.
  _vet decoy-readable
  _blocks_on human-ok
  [[ "$output" == *"cannot be read as text"* ]] || { echo "$output"; false; }
}

@test "hole: a candidate cannot certify its own existence" {
  # `registry-record` was an attacker-chosen path; one candidate pointed it at its own
  # source file, which contained its name, and passed.
  _vet self-certified
  _blocks_on existence
}

@test "hole: a pinned version must be OFFERED, not merely a substring" {
  # `1.2.3` matched a registry offering only `1.2.31` and `1.2.32`.
  _vet version-substring
  _blocks_on version
  [[ "$output" == *"does not offer version"* ]] || { echo "$output"; false; }
}

@test "hole: false and 0 are not provenance records" {
  # jget stringified non-strings, so `false` satisfied "not empty" and was recorded
  # as `\"publisher-auth\": \"false\"`.
  _vet provenance-false
  _blocks_on provenance
}

@test "hole: a lifecycle hook is found anywhere in the tree, not only at the root" {
  # An npm tarball extracted into src/ puts its manifest at src/package.json.
  _vet hook-in-src
  _blocks_on human-ok
  [[ "$output" == *"lifecycle script"* ]] || { echo "$output"; false; }
}

@test "hole: a module specifier built at run time is write-capable" {
  # `require(\"child\" + \"_process\")` defeated the write detector with one +. What a
  # candidate loads at run time cannot be determined by reading it, and cannot-determine
  # is the condition that means write-capable.
  _vet dynamic-require
  _blocks_on human-ok
}

@test "hole: a human OK dated 0000-00-00 is not an approval" {
  _vet human-ok-fake-date
  _blocks_on human-ok
}

@test "hole: a candidate path a shell would mangle still gets scanned" {
  # The scan relativised its hits with `sed \"s|^\$CANDIDATE/||\"`, injecting an
  # unsanitised path into a sed expression. A path containing a backslash — the ORDINARY
  # native form on Windows — broke it, sed wrote nothing, every hit vanished, and a
  # hostile tree came back PASS read-only. Relativising is a string operation now.
  local d="$BATS_TEST_TMPDIR/we[ir]d dir"
  mkdir -p "$d"
  cp -R "$(FX)/payload-outside-src/." "$d/"
  run bash "$(VET)" --candidate "$d" --allowlist "$(FX)/allowlist.txt" --lock "$BATS_TEST_TMPDIR/l.json"
  [ "$status" -ne 0 ] || { echo "a hostile tree PASSED because of its own path: $output"; false; }
  [[ "$output" == *"content-scan"* ]] || { echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# Skills: pinned by commit, publishing no hash
# ---------------------------------------------------------------------------

@test "a skill pinned by commit SHA can PASS without an integrity hash" {
  # The hash check was unconditional while the script's own text said skills publish
  # none, so a real skill could only pass by fabricating a value nothing verified.
  _vet skill-clean
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "a skill pinned to a commit the record does not name BLOCKs" {
  # The skill branch checked the SHA's SHAPE and never compared it to anything.
  _vet skill-wrong-commit
  _blocks_on version
}

# ---------------------------------------------------------------------------
# The lock file is the durable record, so a failure to write it is a failure
# ---------------------------------------------------------------------------

@test "a lock file that does not parse is never silently overwritten" {
  LOCK="$BATS_TEST_TMPDIR/corrupt.json"
  printf '{ "capabilities": [ {"name":"previously-approved"} ], <<<<<<< HEAD\n' > "$LOCK"
  run bash "$(VET)" --candidate "$(FX)/clean" --allowlist "$(FX)/allowlist.txt" --lock "$LOCK"
  [ "$status" -ne 0 ] || { echo "$output"; false; }
  [[ "$output" == *"does not parse"* ]] || { echo "$output"; false; }
  grep -q 'previously-approved' "$LOCK" || { echo "prior approvals were erased"; false; }
}

@test "a lock write that fails is reported as a failure, not as a PASS" {
  LOCK="$BATS_TEST_TMPDIR/a-directory"
  mkdir -p "$LOCK"
  run bash "$(VET)" --candidate "$(FX)/clean" --allowlist "$(FX)/allowlist.txt" --lock "$LOCK"
  [ "$status" -ne 0 ] || { echo "PASS with nothing recorded: $output"; false; }
  [[ "$output" == *"Nothing was recorded"* ]] || { echo "$output"; false; }
}

@test "an admitted candidate is removed from the refusal list, and its history kept" {
  LOCK="$BATS_TEST_TMPDIR/hist.json"
  run bash "$(VET)" --candidate "$(FX)/exfil" --allowlist "$(FX)/allowlist.txt" --lock "$LOCK"
  [ "$status" -ne 0 ]
  run bash "$(VET)" --candidate "$(FX)/clean" --allowlist "$(FX)/allowlist.txt" --lock "$LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node -e '
    const l = require(process.argv[1]);
    const inCaps = (l.capabilities || []).filter((c) => c.name === "safe-tool");
    const inRef  = (l.refusals || []).filter((c) => c.name === "safe-tool");
    if (inCaps.length !== 1 || inRef.length !== 0) { console.log("it reads as both at once"); process.exit(1); }
    if (!inCaps[0]["previously-refused-on"]) { console.log("the refusal history was thrown away"); process.exit(1); }
    console.log("ok, history: " + inCaps[0]["previously-refused-on"]);
  ' "$LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# --audit
# ---------------------------------------------------------------------------

@test "--audit refuses a non-numeric max-age instead of disabling itself" {
  # `Number(\"abc\")` is NaN and `days > NaN` is always false, so one typo turned the
  # whole staleness report off and still exited 0.
  LOCK="$BATS_TEST_TMPDIR/old.json"
  printf '{ "capabilities": [ {"name":"t","version":"1.0.0","checked":"2020-01-01"} ] }\n' > "$LOCK"
  run bash "$(VET)" --audit --lock "$LOCK" --max-age abc
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"whole number"* ]] || { echo "$output"; false; }
}

@test "--audit treats a future checked date as stale" {
  LOCK="$BATS_TEST_TMPDIR/future.json"
  printf '{ "capabilities": [ {"name":"t","version":"1.0.0","checked":"2999-01-01"} ] }\n' > "$LOCK"
  run bash "$(VET)" --audit --lock "$LOCK"
  [[ "$output" == *"stale"* ]] || { echo "a date nobody can have checked read as fresh: $output"; false; }
}

@test "--audit exits non-zero when something is stale, so CI can gate on it" {
  LOCK="$BATS_TEST_TMPDIR/stale.json"
  printf '{ "capabilities": [ {"name":"t","version":"1.0.0","checked":"2020-01-01"} ] }\n' > "$LOCK"
  run bash "$(VET)" --audit --lock "$LOCK"
  [ "$status" -ne 0 ] || { echo "stale rows reported with exit 0: $output"; false; }
}

@test "--audit survives a malformed capabilities list instead of exiting 0 on a crash" {
  LOCK="$BATS_TEST_TMPDIR/malformed.json"
  printf '{ "capabilities": {} }\n' > "$LOCK"
  run bash "$(VET)" --audit --lock "$LOCK"
  [[ "$output" == *"malformed"* || "$output" == *"stale"* ]] || { echo "$output"; false; }
}

@test "--audit examines refusals too, not only admitted rows" {
  # A refused candidate's facts age as well, and a refusal nobody re-examines is a
  # decision resting on data nobody has checked since.
  LOCK="$BATS_TEST_TMPDIR/ref.json"
  printf '{ "capabilities": [], "refusals": [ {"name":"r","version":"1.0.0","checked":"2020-01-01"} ] }\n' > "$LOCK"
  run bash "$(VET)" --audit --lock "$LOCK"
  [[ "$output" == *"r@1.0.0"* ]] || { echo "refusals age unexamined: $output"; false; }
}

@test "an allowlist entry with a BOM, indent or trailing space still matches" {
  # A legitimate candidate was refused by cosmetic formatting, with a message blaming
  # the candidate.
  local a="$BATS_TEST_TMPDIR/allow.txt"
  printf '\xef\xbb\xbf  safe-tool  \n# a comment\n\nwriter-tool\n' > "$a"
  run bash "$(VET)" --candidate "$(FX)/clean" --allowlist "$a" --lock "$BATS_TEST_TMPDIR/l2.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "an empty allowlist still refuses everything" {
  local a="$BATS_TEST_TMPDIR/empty.txt"
  : > "$a"
  run bash "$(VET)" --candidate "$(FX)/clean" --allowlist "$a" --lock "$BATS_TEST_TMPDIR/l3.json"
  [ "$status" -ne 0 ] || { echo "an empty allowlist admitted something: $output"; false; }
  _blocks_on allowlist
}
