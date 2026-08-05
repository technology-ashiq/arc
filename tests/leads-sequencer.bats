#!/usr/bin/env bats
# leads Phase 01 -- caps, suppression, the send-moment guard, the journal, and the review
# boundary (ADR-0403, ADR-0411, ADR-0412).
#
# THE property under test: approval authorizes an ATTEMPT, never a send. A human approves at
# 09:00, the lead unsubscribes at 09:30, the send fires at 10:00 -- and it must not go. Every
# check re-runs at the send moment against state folded fresh from receipts, and there is no
# mutable counter anywhere for anyone to edit.
#
# ASCII-only test names; the file asserts that bats REGISTERED what it declares.
bats_require_minimum_version 1.5.0
load 'test_helper'

_g() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 node --input-type=module -e "$1"; }

GIMPORT='const {guardSend, GuardRefusal, deriveState, breakerState, acquireLock} = await import("./.claude/scripts/leads/lib/guard.mjs");
const {loadCaps, CEILINGS, istDay, inSendWindow, withinRollingWindow, assertNoCapOverrides, CapError} = await import("./.claude/scripts/leads/lib/caps.mjs");
const fsx = await import("node:fs"), osx = await import("node:os"), pathx = await import("node:path");
// A REAL store: initStore + openStore + a dossier for the lead under test. The synthetic
// `{dir: mkdtemp()}` these tests used has no keyring and no dossier, so the suppression check
// -- which now resolves every key version from the store and REFUSES when it cannot -- turned
// every one of them into a refusal. That is the correct behaviour meeting an unreal fixture:
// a lead with no dossier cannot have its suppression checked, and "could not check" must
// never read as "found nothing".
const {initStore: _init, openStore: _open, leadId: _lid} = await import("./.claude/scripts/leads/lib/store.mjs");
function realStore(email = "adv@firm.example.com") {
  process.env.ARC_LEADS_STORE = fsx.mkdtempSync(pathx.join(osx.tmpdir(), "st"));
  _init();
  const st = _open();
  fsx.mkdirSync(pathx.join(st.dir, "dossiers"), {recursive: true});
  return st;
}
function withDossier(st, email) {
  const id = _lid(st, email);
  fsx.writeFileSync(pathx.join(st.dir, "dossiers", id + ".json"), JSON.stringify({lead_id: id, email}));
  return id;
}
const store = realStore();
const ID = withDossier(store, "adv@firm.example.com");
const OTHER = withDossier(store, "other@firm.example.com");
const SHA = "c".repeat(64);
// outreach.replied carries reply_ref now (ADR-0414); a fold input without one is a shape the
// validator refuses, i.e. a receipt that cannot exist on any spine.
const RREF = "reply_" + "d".repeat(32);
const sent = (n, at, lead=ID) => ({kind:"outreach.sent", payload:{lead_id:lead, campaign:"pilot", touch_n:n, submitted_at:at, idem_key:"k"+n, provider_message_id:"m"+n, draft_sha:SHA}});
const base = {campaign:"pilot", lead_id:ID, touch_n:1, draft_sha:SHA, approved_sha:SHA};
const NOW = "2026-08-04T10:00:00+05:30";
const refuse = (events, draft=base, now=NOW) => { try { guardSend({events, store, draft, now}); return "ALLOWED"; } catch (e) { return e instanceof GuardRefusal ? e.step : "ERR:" + e.message; } };'

# ---------- the headline TOCTOU case ----------

@test "a clean state allows the send" {
  run _g "$GIMPORT console.log(refuse([]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ALLOWED"* ]]
}

@test "a reply recorded after approval permanently blocks that send" {
  run _g "$GIMPORT console.log(refuse([{kind:'outreach.replied', payload:{lead_id:ID, campaign:'pilot', triage_class:'interested', ingested_at:NOW, reply_ref:RREF}}]));"
  [[ "$output" == *"reply-stop"* ]]
}

@test "a suppressed lead is refused" {
  run _g "$GIMPORT console.log(refuse([{kind:'lead.suppressed', payload:{lead_id:ID, reason:'unsubscribe', suppressed_at:NOW}}]));"
  [[ "$output" == *"suppression"* ]]
}

@test "an unsubscribe reply suppresses in the same fold" {
  run _g "$GIMPORT console.log(refuse([{kind:'outreach.replied', payload:{lead_id:ID, campaign:'pilot', triage_class:'unsubscribe', ingested_at:NOW, reply_ref:RREF}}]));"
  [[ "$output" == *"suppression"* ]] || [[ "$output" == *"reply-stop"* ]]
}

# A draft edited after approval must not send. This is evolve's candidate_sha discipline
# applied to outreach: approval binds EXACT content, not a lead and a slot.
@test "a draft edited after approval is refused on sha mismatch" {
  run _g "$GIMPORT console.log(refuse([], {...base, draft_sha:'d'.repeat(64)}));"
  [[ "$output" == *"draft-sha"* ]]
}

@test "a draft with no approved sha at all is refused" {
  run _g "$GIMPORT console.log(refuse([], {...base, approved_sha:null}));"
  [[ "$output" == *"draft-sha"* ]]
}

# ---------- caps ----------

@test "the 21st submitted send of the IST day is refused" {
  run _g "$GIMPORT
    const ev = Array.from({length:20}, (_,i) => sent(1, '2026-08-04T09:0' + (i%10) + ':00+05:30', withDossier(store, 'bulk' + i + '@firm.example.com')));
    console.log(refuse(ev));"
  [[ "$output" == *"daily-cap"* ]]
}

@test "20 sends on the IST day still allow the 20th" {
  run _g "$GIMPORT
    const ev = Array.from({length:19}, (_,i) => sent(1, '2026-08-04T09:0' + (i%10) + ':00+05:30', withDossier(store, 'bulk' + i + '@firm.example.com')));
    console.log(refuse(ev));"
  [[ "$output" == *"ALLOWED"* ]]
}

# Bucketed by the intent's submitted_at, never the spine emit time: a recovery receipt written
# after midnight would otherwise move a 23:55 send to the next day and free a slot on BOTH.
@test "midnight IST puts 23 59 and 00 01 on different days" {
  run _g "$GIMPORT console.log([istDay('2026-08-04T23:59:00+05:30'), istDay('2026-08-05T00:01:00+05:30')].join(' '));"
  [[ "$output" == *"2026-08-04 2026-08-05"* ]]
}

@test "a send at 23 59 does not consume the next days quota" {
  run _g "$GIMPORT
    const ev = Array.from({length:20}, (_,i) => sent(1, '2026-08-04T23:59:00+05:30', withDossier(store, 'bulk' + i + '@firm.example.com')));
    console.log(refuse(ev, base, '2026-08-05T10:00:00+05:30'));"
  [[ "$output" == *"ALLOWED"* ]]
}

@test "a third touch inside the rolling 7 day window is refused" {
  run _g "$GIMPORT console.log(refuse([sent(1,'2026-08-01T10:00:00+05:30'), sent(2,'2026-08-03T10:00:00+05:30')], {...base, touch_n:3}));"
  [[ "$output" == *"touch-cap"* ]]
}

# ROLLING, not a calendar week: a calendar week lets two touches land Sunday and Monday and
# calls it two weeks.
@test "the touch window is rolling not calendar" {
  run _g "$GIMPORT console.log([withinRollingWindow('2026-07-29T10:00:00+05:30','2026-08-04T10:00:00+05:30',7), withinRollingWindow('2026-07-20T10:00:00+05:30','2026-08-04T10:00:00+05:30',7)].join(' '));"
  [[ "$output" == *"true false"* ]]
}

@test "a send outside the IST business window is refused" {
  run _g "$GIMPORT console.log(refuse([], base, '2026-08-04T22:00:00+05:30'));"
  [[ "$output" == *"send-window"* ]]
}

@test "a send on a Sunday is refused" {
  run _g "$GIMPORT console.log(refuse([], base, '2026-08-02T10:00:00+05:30'));"
  [[ "$output" == *"send-window"* ]]
}

# ---------- ask-to-exceed ----------
#
# A cap you can raise by editing a file is not a cap. Config may LOWER a limit and may never
# raise one past its ceiling, and the refusal fires on the CONFIG rather than silently clamping
# -- an operator who typed 500 must see an error, not believe it took effect.
@test "a config value above the hard ceiling is refused" {
  run _g "$GIMPORT
    const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(),'cfg')), 'leads.json');
    fs.writeFileSync(p, JSON.stringify({caps:{per_ist_day: 500}}));
    try { loadCaps(p); console.log('ACCEPTED'); } catch (e) { console.log(e.code); }"
  [[ "$output" == *"CAP_ABOVE_CEILING"* ]]
}

@test "a config value below the ceiling is honoured" {
  run _g "$GIMPORT
    const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(),'cfg')), 'leads.json');
    fs.writeFileSync(p, JSON.stringify({caps:{per_ist_day: 5}}));
    console.log(loadCaps(p).per_ist_day);"
  [[ "$output" == *"5"* ]]
}

@test "an environment variable attempting to raise a cap is refused" {
  run _g "$GIMPORT process.env.LEADS_CAP_PER_DAY = '999';
    try { assertNoCapOverrides(process.env, []); console.log('ACCEPTED'); } catch (e) { console.log(e.code); }"
  [[ "$output" == *"CAP_OVERRIDE_REFUSED"* ]]
}

@test "a force flag is refused" {
  run _g "$GIMPORT
    try { assertNoCapOverrides({}, ['node','x','--force']); console.log('ACCEPTED'); } catch (e) { console.log(e.code); }"
  [[ "$output" == *"CAP_OVERRIDE_REFUSED"* ]]
}

# The counts are a FOLD. There is no counter file, so hand-editing state changes nothing --
# grep-provable, and this is the assertion that makes "no mutable counter" real.
@test "no mutable counter file exists in the leads tree" {
  run grep -rlE "sent_today|counter\.json|counts\.json" "$ARC_ROOT/.claude/scripts/leads/"
  [ "$status" -ne 0 ] || { echo "a counter file appeared: $output"; false; }
}

@test "counts rebuild identically from receipts in a second process" {
  run _g "$GIMPORT
    const ev = [sent(1,'2026-08-04T09:00:00+05:30'), sent(2,'2026-08-04T09:05:00+05:30',withDossier(store, 'e@firm.example.com'))];
    const a = deriveState(ev, {campaign:'pilot'}).perDay.get('2026-08-04');
    const b = deriveState([...ev].reverse(), {campaign:'pilot'}).perDay.get('2026-08-04');
    console.log(a + ' ' + b);"
  [[ "$output" == *"2 2"* ]]
}

# ---------- breakers ----------
#
# Sample-size honest: at n=25 one bounce is 4%, so a bare percentage floor freezes on noise.
# HOLD is the honest small-n response; FREEZE is the evidenced one.
@test "the first bounce is a HOLD not a FREEZE" {
  run _g "$GIMPORT console.log(breakerState({bounces:1, complaints:0}, 25).level);"
  [[ "$output" == *"HOLD"* ]]
}

@test "two bounces FREEZE the campaign" {
  run _g "$GIMPORT console.log(breakerState({bounces:2, complaints:0}, 25).level);"
  [[ "$output" == *"FROZEN"* ]]
}

@test "any spam complaint FREEZES immediately" {
  run _g "$GIMPORT console.log(breakerState({bounces:0, complaints:1}, 3).level);"
  [[ "$output" == *"FROZEN"* ]]
}

@test "one bounce in fifty sends does not FREEZE on the percentage alone" {
  run _g "$GIMPORT console.log(breakerState({bounces:1, complaints:0}, 50).level);"
  [[ "$output" == *"HOLD"* ]]
}

# A breaker that pauses nothing is the domain-burn failure with a receipt attached. This is the
# assertion the original fixtures lacked: they checked that a receipt was EMITTED, not that a
# send was STOPPED.
@test "a fired breaker actually stops a send" {
  run _g "$GIMPORT console.log(refuse([{kind:'outreach.replied', payload:{lead_id:OTHER, campaign:'pilot', triage_class:'bounce', ingested_at:NOW, reply_ref:RREF}}]));"
  [[ "$output" == *"campaign-state"* ]]
}

@test "a fired breaker is not cleared by a flag or an env var" {
  run _g "$GIMPORT
    process.env.LEADS_FORCE = '1';
    const ev = [{kind:'outreach.replied', payload:{lead_id:OTHER, campaign:'pilot', triage_class:'bounce', ingested_at:NOW, reply_ref:RREF}}];
    console.log(refuse(ev));"
  [[ "$output" == *"campaign-state"* ]]
}

# A clearance is a TYPED, incident-bound pairing now, not a free-text reason. This test used to
# pass a decision whose prose mentioned HOLD and pilot -- which is exactly the bypass an
# adversarial pass then demonstrated five ways. The positive case lives in
# tests/leads-adversarial.bats, which builds the incident id the same way the guard does.
@test "a free text approval reason does not clear a breaker" {
  run _g "$GIMPORT
    const ev = [{kind:'outreach.replied', payload:{lead_id:OTHER, campaign:'pilot', triage_class:'bounce', ingested_at:NOW, reply_ref:RREF}},
                {id:'01D', kind:'decision.recorded', payload:{decides:'01J000000000000000000000AB', verdict:'approve', reason:'HOLD on pilot reviewed: the address was a typo, resuming'}}];
    console.log(refuse(ev));"
  [[ "$output" == *"campaign-state"* ]]
}

# ---------- already sent ----------
#
# Found by walking the send path rather than reading it: the touch cap counts touches, so a
# second run of the daily command re-entered the chain for a draft already sent and reached the
# PROVIDER before the receipt idem stopped the duplicate record.
@test "a touch that already has a receipt is refused before the provider is asked" {
  run _g "$GIMPORT console.log(refuse([sent(1,'2026-08-04T09:00:00+05:30')]));"
  [[ "$output" == *"already-sent"* ]]
}

# ---------- the lock ----------

@test "a second process is refused the send lock and the holder is named" {
  run _g "$GIMPORT
    acquireLock(store);
    try { acquireLock(store); console.log('ACQUIRED-TWICE'); } catch (e) { console.log(e.step + ' ' + (/pid=/.test(e.message) ? 'holder-named' : 'NO-HOLDER')); }"
  [[ "$output" == *"lock holder-named"* ]]
}

# A lock held by a dead pid is refused, NEVER auto-broken: that process may sit between the
# provider ack and the receipt, and stealing its lock is how the same mail goes out twice.
@test "a stale lock is refused rather than broken" {
  run _g "$GIMPORT
    const fs = await import('node:fs'), path = await import('node:path');
    fs.writeFileSync(path.join(store.dir, '.send.lock'), 'pid=999999 started=old');
    try { acquireLock(store); console.log('STOLEN'); } catch (e) { console.log(e.step + (/never auto-broken|NEVER auto-broken/i.test(e.message) ? ' not-stolen' : ' NO-WARNING')); }"
  [[ "$output" == *"lock not-stolen"* ]]
}

# ---------- no background execution ----------

# CODE only. The first version matched its own documentation -- every comment saying "no
# daemon, ever" was a hit, so the test failed for describing the rule it enforces. A
# whole-line comment cannot execute anything; the portability lint in this repo already draws
# exactly this distinction and this test did not.
#
# `mailer-daemon` and `mail-daemon` are excluded, and that is a real distinction rather than a
# hole: they are the RFC role addresses a BOUNCE arrives from, matched by replies.mjs to decide
# whether a message came from a mail system or a person. A hyphenated mail role cannot schedule
# anything. The alternative -- renaming the constant to dodge the grep -- would leave the next
# legitimate mail-role match failing for the same reason, so the guard gets the distinction.
# A bare `daemon`, and anything that could actually run, still fails.
@test "no scheduler daemon or cron exists in the leads tree" {
  run bash -c "grep -rnE 'setInterval|cron|daemon|node-schedule' '$ARC_ROOT/.claude/scripts/leads/' | grep -vE ':[[:space:]]*(//|#|\*)' | grep -viE 'mail(er)?-daemon'"
  [ "$status" -ne 0 ] || { echo "background execution appeared in CODE: $output"; false; }
}

# The negative control for the exclusion above: the guard must still fire on real background
# execution, and on a bare `daemon` that is not a mail role. Without this, the `grep -v` could
# be widened to nothing and the suite would stay green.
@test "the no-daemon guard still fires on real background execution" {
  local probe; probe="$BATS_TEST_TMPDIR/probe"
  mkdir -p "$probe"
  printf '%s\n' 'setInterval(() => send(), 1000);' > "$probe/bad.mjs"
  printf '%s\n' 'const daemon = spawnDetached();' > "$probe/also-bad.mjs"
  printf '%s\n' 'const DAEMON_LOCAL = /^mailer-daemon$/i;' > "$probe/ok.mjs"
  run bash -c "grep -rnE 'setInterval|cron|daemon|node-schedule' '$probe/' | grep -vE ':[[:space:]]*(//|#|\*)' | grep -viE 'mail(er)?-daemon'"
  [ "$status" -eq 0 ] || { echo "the guard went blind"; false; }
  [[ "$output" == *"bad.mjs"* ]]
  [[ "$output" == *"also-bad.mjs"* ]]
  [[ "$output" != *"ok.mjs"* ]]
}

# ADR-0407 promotion is deliberately NOT built this cycle: its only input is >=2 campaigns and
# campaign #1 is BLOCKED. What this phase proves is the NEGATIVE -- L1 is unconditional.
@test "no send autonomy promotion code path exists" {
  run grep -rniE "autoApprove|auto_approve|promoteToL2|skipApproval" "$ARC_ROOT/.claude/scripts/leads/"
  [ "$status" -ne 0 ] || { echo "an autonomy path appeared: $output"; false; }
}

@test "this file registers the 34 tests it declares" {
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 34 ] || { echo "declared $declared, expected 34"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared -- one was DROPPED"; false; }
}
