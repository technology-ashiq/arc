#!/usr/bin/env bats
# launch Phase 00 -- the adapter trust boundary, enforced at run time (ADR-1719; REQ-09 re-runs these on real adapters).
#
# An adapter cannot exceed what its row allows: a changed adapter is un-vetted until re-vetted, a host outside hosts[]
# is refused, a write outside the venture root is refused, and a sensitive action waits for the owner BEFORE it runs.
# Line endings alone never un-vet an adapter (the one change the digest is declared blind to).
bats_require_minimum_version 1.5.0
load 'test_helper'

L() { printf '%s' "$ARC_ROOT/.claude/scripts/launch/arc-launch.mjs"; }

setup() {
  local out; out=$(node "$ARC_ROOT/tests/launch/make-fixture.mjs" "$BATS_TEST_TMPDIR/fx") || { echo "fixture failed"; return 1; }
  eval "$out"
  [ -n "$FX_FLAGS" ] && [ -s "$FX_ADAPTER" ] || { echo "fixture empty"; return 1; }
}

slot_field() { node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(s.slots[process.argv[2]][process.argv[3]])' "$FX_STATE" "$1" "$2"; }
provider_total() { node -e 'const fs=require("fs");const f=process.argv[1];console.log(fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")).length:0)' "$FAKE_PROVIDER_FILE"; }

@test "launch-trust: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "launch-trust: a one-byte adapter edit after vet is refused as digest drift, nothing runs" {
  printf '\n// one byte more\n' >> "$FX_ADAPTER"
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"changed since it was vetted (digest drift)"*"reads as candidate"* ]] || { echo "$output"; false; }
  [[ "$output" != *"FAKE_CREATED"* ]] || { echo "the drifted adapter ran: $output"; false; }
  [ "$(provider_total)" -eq 0 ]
}

@test "launch-trust: a CRLF copy of a vetted adapter keeps its digest and runs" {
  node -e 'const fs=require("fs");const p=process.argv[1];fs.writeFileSync(p,fs.readFileSync(p,"utf8").replace(/\r?\n/g,"\r\n"))' "$FX_ADAPTER"
  # Read the bytes with node: Git Bash's grep on the Windows leg reads in text mode and never sees a CR.
  node -e 'process.exit(require("fs").readFileSync(process.argv[1]).includes(13) ? 0 : 1)' "$FX_ADAPTER" || { echo "CRLF conversion did not land"; false; }
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"probe: verified"* ]] || { echo "$output"; false; }
}

@test "launch-trust: a fetch to a host outside hosts[] is refused with HOST_REFUSED before any create" {
  run env FAKE_FETCH_HOST=evil.example node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$(slot_field probe reason)" == "refused:HOST_REFUSED evil.example is not in this provider's hosts[]"* ]] || { echo "$(slot_field probe reason)"; false; }
  [ "$(provider_total)" -eq 0 ]
}

@test "launch-trust: a subdomain of a listed host is allowed, a lookalike suffix is not" {
  run node -e 'import(process.argv[1]).then(m=>{const h=["api.cloudflare.com","pooler.supabase.com"];console.log([m.hostAllowed("aws-0-ap-south-1.pooler.supabase.com",h),m.hostAllowed("api.cloudflare.com",h),m.hostAllowed("evilpooler.supabase.com",h),m.hostAllowed("api.cloudflare.com.evil.example",h)].join(","))})' "$(node -e 'console.log(require("url").pathToFileURL(process.argv[1]).href)' "$ARC_ROOT/.claude/scripts/launch/lib/ctx.mjs")"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true,true,false,false" ] || { echo "$output"; false; }
}

@test "launch-trust: a write outside the venture root is refused with WRITE_REFUSED and lands nowhere" {
  run env FAKE_WRITE=../escape.txt node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$(slot_field probe reason)" == "refused:WRITE_REFUSED"* ]] || { echo "$(slot_field probe reason)"; false; }
  [ ! -e "$FX_DIR/escape.txt" ]
  [ "$(provider_total)" -eq 0 ]
}

@test "launch-trust: a write inside the venture root is allowed" {
  run env FAKE_WRITE=app/page.txt node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$FX_DIR/venture-root/app/page.txt" ]
}

@test "launch-trust: a sensitive action emits approval.requested and pauses before the action runs" {
  run env FAKE_SENSITIVE=delete node "$(L)" apply sens --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 5 ] || { echo "$output"; false; }
  [[ "$output" == *"delete needs the owner -- approval.requested "* ]] || { echo "$output"; false; }
  grep -q '"kind":"approval.requested"' "$ARC_SPINE_ROOT"/events/*.jsonl
  grep -q '"gate":"sensitive:delete"' "$ARC_SPINE_ROOT"/events/*.jsonl
  [ "$(provider_total)" -eq 0 ]
  local id; id=$(slot_field sens approval_id)
  run node "$ARC_ROOT/.claude/scripts/hq/arc-inbox.mjs" approve "$id" --reason "fixture approval"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run env FAKE_SENSITIVE=delete node "$(L)" apply sens --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(slot_field sens state)" = "verified" ]
}

@test "launch-trust: an undeclared sensitive action is refused, not silently allowed" {
  run env FAKE_SENSITIVE=delete node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$(slot_field probe reason)" == "refused:SENSITIVE_UNDECLARED"* ]] || { echo "$(slot_field probe reason)"; false; }
}

@test "launch-trust: a write through a linked directory inside the root is refused (L1, junction)" {
  mkdir -p "$FX_DIR/outside"
  node -e 'require("fs").symlinkSync(process.argv[1],process.argv[2],"junction")' "$FX_DIR/outside" "$FX_DIR/venture-root/evildir" || { echo "could not create the link"; false; }
  run env FAKE_WRITE=evildir/x.txt node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$(slot_field probe reason)" == "refused:WRITE_REFUSED"*"passes through a link"* ]] || { echo "$(slot_field probe reason)"; false; }
  [ ! -e "$FX_DIR/outside/x.txt" ]
}

@test "launch-trust: a write to a leaf that is a symlink out of the root is refused (L1, file link)" {
  mkdir -p "$FX_DIR/outside"
  node -e 'require("fs").symlinkSync(process.argv[1],process.argv[2],"file")' "$FX_DIR/outside/target.txt" "$FX_DIR/venture-root/evil" 2>/dev/null || skip "this OS refuses unprivileged file symlinks; the junction test covers the rule"
  run env FAKE_WRITE=evil node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$(slot_field probe reason)" == "refused:WRITE_REFUSED"*"passes through a link"* ]] || { echo "$(slot_field probe reason)"; false; }
  [ ! -e "$FX_DIR/outside/target.txt" ]
}

@test "launch-trust: a write to a device name or an NTFS stream is refused on every OS (06cbc03 B6)" {
  local p
  for p in nul "a.txt:stream" "C:foo" "dir/con.txt"; do
    run env FAKE_WRITE="$p" node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
    [ "$status" -eq 1 ] || { echo "$p: $output"; false; }
    [[ "$(slot_field probe reason)" == "refused:WRITE_REFUSED"* ]] || { echo "$p: $(slot_field probe reason)"; false; }
  done
}

@test "launch-trust: every built adapter keeps its digest across CRLF, drifts on one byte, sends nothing off its hosts, and cannot write outside the root (REQ-09, ADR-1749)" {
  run node "$ARC_ROOT/tests/launch/trust-all.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN all"* ]] || { echo "the sweep never ran: $output"; false; }
  DONE=$(printf '%s\n' "$output" | sed -n 's/^DONE //p')
  [ -n "$DONE" ] || { echo "the sweep never finished: $output"; false; }
  j() { node -e 'const o=JSON.parse(process.argv[1]);console.log(String(eval(process.argv[2])))' "$DONE" "$1"; }
  # The sweep covers every built adapter, and that count only grows: 28 at Phase 03.
  [ "$(j 'o.checked >= 28')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.results.filter((r) => !r.crlfSame || !r.editDiffers || r.drift !== "DIGEST_DRIFT").map((r) => r.id).join(",")')" = "" ] || { echo "$DONE"; false; }
  [ "$(j 'o.results.filter((r) => r.leaked !== 0).map((r) => r.id).join(",")')" = "" ] || { echo "$DONE"; false; }
  [ "$(j 'o.results.filter((r) => r.write !== "WRITE_REFUSED").map((r) => r.id).join(",")')" = "" ] || { echo "$DONE"; false; }
  # At least the adapters that reach a request before any upstream check were refused at the host guard.
  [ "$(j 'o.results.filter((r) => r.hostRefused).length >= 4')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.results.flatMap((r) => r.sensitive).every((s) => s.endsWith(":APPROVAL_PENDING")) && o.results.flatMap((r) => r.sensitiveApproved).every((s) => s.endsWith(":allowed"))')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.results.flatMap((r) => r.sensitive).length >= 2')" = "true" ] || { echo "$DONE"; false; }
}
