#!/usr/bin/env bats
# leads Phase 02 -- triage classification (ADR-0405).
#
# THE case in this file is "an interested reply that quotes our own unsubscribe footer".
# Every mail this system sends carries a List-Unsubscribe line (ADR-0402, non-negotiable) and
# every reply quotes it, so a classifier reading the whole body finds the word "unsubscribe"
# in essentially every reply and suppresses the entire campaign -- while every receipt looks
# correct, because suppression is exactly what the receipts would say happened.
#
# The second case is ordering: "not interested" contains "interested", so a rule set that
# tests interest first books a meeting with someone who declined.
#
# ASCII-only test names; the file asserts that bats REGISTERED what it declares.
bats_require_minimum_version 1.5.0
load 'test_helper'

_t() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

TIMPORT='const R = await import("./.claude/scripts/leads/lib/replies.mjs");
const fs = await import("node:fs");
const B = (s) => Buffer.from(s, "utf8");
const fx = (n) => fs.readFileSync("tests/fixtures/leads/replies/" + n);
const cls = (bytes) => R.parseReply(bytes).triage_class;
const mail = (hdrs, body) => B(hdrs + "\nContent-Type: text/plain\n\n" + body + "\n");
const FROM = "From: Adv 1 <adv1@firm1.example.com>";'

# ---------- the footer trap ----------

@test "an interested reply that quotes our own unsubscribe footer is NOT an unsubscribe" {
  run _t "$TIMPORT const r = R.parseReply(fx(\"03-interested-quoting-our-footer.eml\"));
    console.log(r.triage_class + \" \" + (r.body_text.indexOf(\"unsubscribe\") === -1 ? \"footer-stripped\" : \"FOOTER-KEPT\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested footer-stripped"* ]]
}

@test "the word unsubscribe below a reply separator classifies nothing" {
  run _t "$TIMPORT console.log(cls(mail(FROM, [\"Sounds good, send a link.\", \"\", \"On Tue 4 Aug 2026 at 10:02, X <x@y.example.com> wrote:\", \"> reply with unsubscribe to opt out\"].join(\"\n\"))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested"* ]]
}

@test "a quoted line asking to unsubscribe does not suppress the person who quoted it" {
  run _t "$TIMPORT console.log(cls(mail(FROM, [\"Keen to talk.\", \"> unsubscribe here: mailto:unsubscribe@sender.example.net\"].join(\"\n\"))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested"* ]]
}

# ---------- rule ordering ----------

@test "not interested is a no, never an interested" {
  run _t "$TIMPORT console.log(cls(mail(FROM, \"Thanks, but not interested.\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"no"* ]]
  [[ "$output" != *"interested"* ]]
}

@test "an explicit unsubscribe outranks an otherwise interested body" {
  run _t "$TIMPORT console.log(cls(mail(FROM, \"This sounds good but please remove me from this list.\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"unsubscribe"* ]]
}

# ---------- bounces are decided by headers ----------

@test "a delivery status notification is a bounce and names the FAILED recipient" {
  run _t "$TIMPORT const r = R.parseReply(fx(\"04-bounce-dsn.eml\"));
    console.log(r.triage_class + \" \" + r.address + \" \" + r.address_source);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"bounce adv4@firm4.example.com"* ]]
  # The lead is the recipient that failed, NOT the mail system that reported it.
  [[ "$output" != *"MAILER-DAEMON"* ]]
}

@test "an X-Failed-Recipients header alone makes a bounce" {
  run _t "$TIMPORT console.log(cls(B(\"From: postmaster@sender.example.net\nX-Failed-Recipients: adv2@firm2.example.com\nContent-Type: text/plain\n\ndelivery failed\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"bounce"* ]]
}

@test "a human writing that a mail bounced is not a bounce" {
  run _t "$TIMPORT console.log(cls(mail(FROM, \"Your last mail bounced back to me, resend it? Happy to chat.\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested"* ]]
  [[ "$output" != *"bounce"* ]]
}

@test "an out of office auto reply is not a bounce" {
  run _t "$TIMPORT console.log(cls(B(\"From: Adv 1 <adv1@firm1.example.com>\nAuto-Submitted: auto-replied\nSubject: Out of office\nContent-Type: text/plain\n\nI am away until Monday.\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"bounce"* ]]
}

@test "a delivery report naming no failed recipient is refused rather than guessed at" {
  # The message must LOOK like a delivery report -- a daemon-shaped sender alone no longer
  # qualifies, because a human replying from postmaster@ was being refused as one.
  run _t "$TIMPORT try { R.parseReply(B(\"From: MAILER-DAEMON@sender.example.net\nContent-Type: multipart/report; report-type=delivery-status; boundary=d\n\n--d\nContent-Type: text/plain\n\nit failed\n--d--\n\")); console.log(\"ACCEPTED\"); } catch (e) { console.log(e.code); }"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"BOUNCE_WITHOUT_RECIPIENT"* ]]
}

# ---------- the default ----------

@test "an unclassifiable reply defaults to later and says it was the default" {
  run _t "$TIMPORT const r = R.parseReply(fx(\"10-unclassifiable.eml\"));
    console.log(r.triage_class + \" \" + r.matched);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"later default"* ]]
}

@test "the default is never interested and never unsubscribe" {
  run _t "$TIMPORT const odd = [\"Hm.\", \"?\", \"Ok\", \"...\", \"Received, thanks\"];
    const seen = odd.map((b) => cls(mail(FROM, b)));
    const bad = seen.filter((c) => c === \"interested\" || c === \"unsubscribe\");
    console.log(seen.length + \" classified, \" + bad.length + \" landed on an auto-acting class\");"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"5 classified, 0 landed"* ]]
}

# ---------- the shipped corpus ----------

@test "every reply in the shipped corpus classifies without throwing" {
  run _t "$TIMPORT const dir = \"tests/fixtures/leads/replies\";
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(\".eml\")).sort();
    const out = files.map((f) => { try { return f + \"=\" + cls(fs.readFileSync(dir + \"/\" + f)); } catch (e) { return f + \"=THREW:\" + e.code; } });
    console.log(files.length + \" files | \" + out.join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"11 files"* ]]
  [[ "$output" != *"THREW"* ]]
  [[ "$output" == *"01-interested.eml=interested"* ]]
  [[ "$output" == *"02-unsubscribe.eml=unsubscribe"* ]]
  [[ "$output" == *"05-no.eml=no"* ]]
  [[ "$output" == *"06-later.eml=later"* ]]
  [[ "$output" == *"07-multipart-alternative.eml=interested"* ]]
  [[ "$output" == *"08-quoted-printable.eml=no"* ]]
}

@test "the display name spoof fixture is attributed to the angle bracket address" {
  run _t "$TIMPORT const r = R.parseReply(fx(\"09-display-name-spoof.eml\"));
    console.log(r.triage_class + \" \" + r.address);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"unsubscribe adv9@firm9.example.com"* ]]
}

@test "the classifier never reports the text it matched, only the rule" {
  run _t "$TIMPORT const r = R.parseReply(mail(FROM, \"ZZSECRETZZ please remove me from this list\"));
    console.log(r.matched + \" \" + (JSON.stringify({m: r.matched, c: r.triage_class}).indexOf(\"ZZSECRET\") === -1 ? \"clean\" : \"LEAKED\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"unsubscribe clean"* ]]
}


# ---------- found by the Phase-02 decision-logic adversarial pass ----------

# "do not call me" contains `call me`, an INTERESTED marker. The `no` rule was ordered ahead of
# `interested` because "not interested" contains "interested" -- the identical defect twenty
# characters away got no such treatment, and this one minted a CALENDAR DRAFT for someone who
# had just refused contact. Fix the pattern, not the instance.
@test "a negated contact request is an unsubscribe, never an interested" {
  run _t "$TIMPORT const cases = [\"Do not call me.\", \"Please do not call me again.\", \"Dont contact me.\", \"Never email me again.\", \"Please dont phone me.\"];
    console.log(cases.map((b) => cls(mail(FROM, b))).join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"unsubscribe unsubscribe unsubscribe unsubscribe unsubscribe"* ]]
}

# The apostrophe spelling, built from a char code so no shell or JS layer can eat it. This is
# the single most common way a person writes it, and the original grammar had only `do not`.
@test "the apostrophe spelling of a negated contact request also suppresses" {
  run _t "$TIMPORT const q = String.fromCharCode(39);
    const cases = [\"Don\" + q + \"t email me again.\", \"Please don\" + q + \"t contact me.\"];
    console.log(cases.map((b) => cls(mail(FROM, b))).join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"unsubscribe unsubscribe"* ]]
}

# The opt-out grammar was pinned to the exact spellings of ONE shipped fixture -- `do not` but
# never the contraction, `remove me` but never `remove my email`, `opt-out` but never `opt me
# out`. Eight ordinary phrasings classified `later` or `no`, which stops the sequence but emits
# NO suppression, so the person is contactable again next campaign, after a re-research, and
# after a dossier purge. Over-suppressing costs one lead; under-suppressing mails someone who
# told us in writing to stop.
@test "ordinary phrasings of a lawful opt out all suppress" {
  run _t "$TIMPORT const cases = [\"Please remove me from this list.\", \"Remove my email from your list.\", \"Take my name off your list.\", \"Please opt me out.\", \"Stop sending me emails.\", \"Delete my details from your database.\", \"Unsubscribe please.\", \"I no longer wish to receive these.\"];
    const seen = cases.map((b) => cls(mail(FROM, b)));
    const wrong = seen.filter((c) => c !== \"unsubscribe\");
    console.log(seen.length + \" phrasings, \" + wrong.length + \" failed to suppress\" + (wrong.length ? \": \" + wrong.join(\",\") : \"\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"8 phrasings, 0 failed to suppress"* ]]
}

# The negative control for the three above: a generous opt-out grammar must not swallow a warm
# reply. Without this, a rule that classified EVERYTHING as unsubscribe would pass all of them.
@test "the generous opt out grammar does not swallow interested or later replies" {
  run _t "$TIMPORT const cases = [[\"Sounds good, send a link.\", \"interested\"], [\"Keen - what times work?\", \"interested\"], [\"Circle back next quarter?\", \"later\"], [\"Thanks, but not interested.\", \"no\"], [\"Please remove that typo from the deck and resend.\", \"later\"]];
    const wrong = cases.filter((c) => cls(mail(FROM, c[0])) !== c[1]);
    console.log(cases.length + \" controls, \" + wrong.length + \" misclassified\" + (wrong.length ? \": \" + wrong.map((c) => c[0]).join(\" | \") : \"\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"5 controls, 0 misclassified"* ]]
}

# BOTTOM-POSTING is the Outlook default in a lot of corporate mail: the human writes BELOW the
# quoted original, so breaking at the first separator discarded 100% of what they wrote. A
# confirmed case ate a whole "take me off your list" and classified it `later`.
@test "a bottom posted reply is read rather than discarded" {
  run _t "$TIMPORT const body = [\"On Tue, 4 Aug 2026 at 10:02, Outreach <o@sender.example.net> wrote:\", \"> a note about your filings practice\", \"> to stop these, unsubscribe: mailto:unsubscribe@sender.example.net\", \"\", \"Please take me off your list.\"].join(\"\n\");
    const warm = body.replace(\"Please take me off your list.\", \"Sounds good, send me a link.\");
    console.log(cls(mail(FROM, body)) + \" \" + cls(mail(FROM, warm)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"unsubscribe interested"* ]]
}

# `isBounce` regexed the RAW From header including the display name, thirty lines below a
# function whose ten-line comment explains why the display name must never decide anything.
@test "a daemon address in the display name does not make an ordinary reply a bounce" {
  run _t "$TIMPORT const r = R.parseReply(B(\"From: \\\"MAILER-DAEMON@sender.example.net\\\" <adv1@firm1.example.com>\nSubject: Re: x\nContent-Type: text/plain\n\nSounds good, send a link.\n\"));
    console.log(r.triage_class + \" \" + r.address);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested adv1@firm1.example.com"* ]]
}

# A real person can and does reply from postmaster@. Matching the local part ALONE refused them
# with BOUNCE_WITHOUT_RECIPIENT -- no receipt written, sequence not stopped.
@test "a human replying from a role address is not a delivery report" {
  run _t "$TIMPORT console.log(cls(B(\"From: Postmaster Desk <postmaster@firm1.example.com>\nSubject: Re: x\nContent-Type: text/plain\n\nSounds good, send a link.\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested"* ]]
}

# The auto-submitted clause regexed the SUBJECT, which is OUR OWN subject line echoed back --
# so a campaign about "faster delivery of your filings" made every out-of-office a bounce.
@test "an out of office quoting our own subject line is not a bounce" {
  run _t "$TIMPORT console.log(cls(B(\"From: Adv 1 <adv1@firm1.example.com>\nAuto-Submitted: auto-replied\nSubject: Automatic reply: Re: faster delivery of your filings\nContent-Type: text/plain\n\nI am away until Monday.\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"bounce"* ]]
  [[ "$output" == *"later"* ]]
}

# A 4.x.x DELAY warning is the most common thing a mail system says and it means the opposite of
# a bounce -- Gmail and Postfix both put "you do not need to resend" in the body. Treating it as
# a failure suppressed a LIVE lead permanently, and because each retry notice has different
# bytes (hence a different reply_ref, hence a different idem) two of them FROZE the campaign.
@test "a transient delay notification is neither a bounce nor a reply" {
  run _t "$TIMPORT const dsn = (action) => B([\"From: Mail Delivery Subsystem <MAILER-DAEMON@sender.example.net>\", \"Subject: Delivery Status Notification (Delay)\", \"Content-Type: multipart/report; report-type=delivery-status; boundary=d\", \"\", \"--d\", \"Content-Type: text/plain\", \"\", \"YOU DO NOT NEED TO RESEND YOUR MESSAGE.\", \"\", \"--d\", \"Content-Type: message/delivery-status\", \"\", \"Final-Recipient: rfc822; adv1@firm1.example.com\", action, \"Status: 4.2.2\", \"\", \"--d--\", \"\"].join(\"\n\"));
    const codeOf = (b) => { try { return R.parseReply(b).triage_class; } catch (e) { return e.code; } };
    console.log([codeOf(dsn(\"Action: delayed\")), codeOf(dsn(\"Action: relayed\")), codeOf(dsn(\"Action: failed\"))].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # delayed and relayed record NOTHING; only a real failure is a bounce.
  [[ "$output" == *"NON_FAILURE_DSN NON_FAILURE_DSN bounce"* ]]
}

# The .gitattributes `-text` rule is what makes ADR-0414 identity stable across the three OS
# legs, and until this fixture existed the whole corpus was pure LF -- so deleting both -text
# lines left every test green. This pins the ref of a byte-exact CRLF file: the mutant IS the
# negative control.
@test "the CRLF fixture keeps its exact reply ref on every platform" {
  run _t "$TIMPORT const b = fx(\"11-crlf-windows-export.eml\");
    console.log(R.replyRef(b) + \" CR=\" + b.filter((x) => x === 13).length + \" \" + cls(b));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # If git ever normalises this file, the ref moves and this line fails -- which is the whole
  # point. Do not "fix" it by updating the hash; fix .gitattributes.
  [[ "$output" == *"reply_87aa2824757cd79f14b9d6f6f0a330f2 CR=7 interested"* ]]
}

@test "this file registers the 26 tests it declares" {
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 26 ] || { echo "declared $declared, expected 26"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared declared tests -- one was DROPPED (non-ASCII name?)"; false; }
}
