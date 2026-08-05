#!/usr/bin/env bats
# leads Phase 02 -- the reply parser (ADR-0405, ADR-0414). PARSER-CLASS.
#
# This file attacks replies.mjs at the byte level. Three invariants are under test and the
# third one is the headline:
#
#   1. limits fire BEFORE any decoding work
#   2. an ambiguous header is REFUSED, never resolved by picking one
#   3. NO ERROR MESSAGE EVER CONTAINS A CONTENT BYTE -- errors name an offset, a header name,
#      a length. The marker test below feeds a distinctive string through every failing path
#      at once and asserts it comes back out of none of them.
#
# ASCII-only test names; the file asserts that bats REGISTERED what it declares.
bats_require_minimum_version 1.5.0
load 'test_helper'

_p() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PIMPORT='const R = await import("./.claude/scripts/leads/lib/replies.mjs");
const B = (s) => Buffer.from(s, "utf8");
// The code of a refusal, or the literal ACCEPTED. Never the message -- a test asserting on a
// message template is D4, and it passes for a mutant that changed the rule and kept the words.
const code = (bytes) => { try { R.parseReply(bytes); return "ACCEPTED"; } catch (e) { return e.code || ("ERR:" + e.name); } };
const msg  = (bytes) => { try { R.parseReply(bytes); return ""; } catch (e) { return String(e.message); } };
const OK = "From: Adv 1 <adv1@firm1.example.com>\nSubject: Re: x\nContent-Type: text/plain\n\nSounds good, send a link.\n";'

# ---------- limits, before work ----------

@test "empty input is refused" {
  run _p "$PIMPORT console.log(code(B(\"\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"EMPTY_INPUT"* ]]
}

@test "input past the size limit is refused before it is parsed" {
  run _p "$PIMPORT console.log(code(Buffer.alloc(R.MAX_REPLY_BYTES + 1, 97)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"TOO_LARGE"* ]]
}

@test "a NUL byte is refused and the refusal names its offset" {
  run _p "$PIMPORT const b = Buffer.concat([B(OK.slice(0, 20)), Buffer.from([0]), B(OK.slice(20))]);
    console.log(code(b) + \" \" + (/offset 20/.test(msg(b)) ? \"located\" : \"UNLOCATED:\" + msg(b)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NUL_BYTE located"* ]]
}

@test "a message with no header body separator is refused" {
  run _p "$PIMPORT console.log(code(B(\"From: a <adv1@firm1.example.com>\nSubject: t\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NO_HEADER_BODY_SEPARATOR"* ]]
}

# ---------- line endings ----------

@test "a CRLF message parses identically to its bare LF twin" {
  run _p "$PIMPORT const lf = R.parseReply(B(OK)); const crlf = R.parseReply(B(OK.replace(/\n/g, \"\r\n\")));
    console.log([lf.address === crlf.address, lf.triage_class === crlf.triage_class, lf.reply_ref !== crlf.reply_ref].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Same meaning, DIFFERENT ref -- the ref is over raw bytes by design (ADR-0414).
  [[ "$output" == *"true true true"* ]]
}

# ---------- identity (ADR-0414) ----------

@test "the reply ref is stable across calls and moves on a one byte change" {
  run _p "$PIMPORT const a = R.replyRef(B(OK)), b = R.replyRef(B(OK)), c = R.replyRef(B(OK + \" \"));
    console.log([a === b, a !== c, /^reply_[0-9a-f]{32}$/.test(a)].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"true true true"* ]]
}

@test "the reply ref refuses a string, because decoding first would collide distinct inputs" {
  run _p "$PIMPORT try { R.replyRef(OK); console.log(\"ACCEPTED\"); } catch (e) { console.log(e.name); }"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"TypeError"* ]]
}

# ---------- address extraction ----------

@test "a display name holding an address does not win over the angle bracket addr spec" {
  run _p "$PIMPORT console.log(R.parseReply(B(\"From: \\\"adv1@firm1.example.com\\\" <adv9@firm9.example.com>\nSubject: s\nContent-Type: text/plain\n\nTake me off your list.\n\")).address);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"adv9@firm9.example.com"* ]]
  [[ "$output" != *"adv1@firm1.example.com"* ]]
}

@test "two From headers are refused rather than resolved" {
  run _p "$PIMPORT console.log(code(B(\"From: a <adv1@firm1.example.com>\nFrom: b <adv2@firm2.example.com>\nContent-Type: text/plain\n\nunsubscribe\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"DUPLICATE_HEADER"* ]]
}

@test "an unclosed angle bracket is refused" {
  run _p "$PIMPORT console.log(code(B(\"From: a <adv1@firm1.example.com\nContent-Type: text/plain\n\nhello\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"UNCLOSED_ANGLE_ADDR"* ]]
}

@test "a multi address From with no angle bracket addr spec is refused" {
  run _p "$PIMPORT console.log(code(B(\"From: adv1@firm1.example.com, adv2@firm2.example.com\nContent-Type: text/plain\n\nhello\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"MULTIPLE_ADDRESSES"* ]]
}

@test "an RFC 2047 encoded word in the addr spec position is refused" {
  run _p "$PIMPORT console.log(code(B(\"From: <=?utf-8?B?YWJj?=>\nContent-Type: text/plain\n\nhello\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ENCODED_WORD_IN_ADDR"* ]]
}

@test "a message with no From header is refused" {
  run _p "$PIMPORT console.log(code(B(\"Subject: s\nContent-Type: text/plain\n\nhello\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NO_FROM_HEADER"* ]]
}

# ---------- header block ----------

@test "a folded header is unfolded into one value" {
  run _p "$PIMPORT const h = R.parseHeaders(\"Subject: one\n  two\nFrom: a <adv1@firm1.example.com>\");
    console.log(h.get(\"subject\")[0]);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"one two"* ]]
}

@test "a header block that opens with a fold is refused" {
  run _p "$PIMPORT console.log(code(B(\"  folded first\nFrom: a <adv1@firm1.example.com>\nContent-Type: text/plain\n\nhi\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"HEADER_CONTINUATION_WITHOUT_HEADER"* ]]
}

@test "header names are matched case insensitively" {
  run _p "$PIMPORT console.log(R.parseReply(B(\"FROM: a <adv1@firm1.example.com>\nCONTENT-TYPE: text/plain\n\nSounds good.\n\")).address);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"adv1@firm1.example.com"* ]]
}

# ---------- MIME ----------

@test "quoted printable is decoded" {
  run _p "$PIMPORT const r = R.parseReply(B(\"From: a <adv1@firm1.example.com>\nContent-Type: text/plain\nContent-Transfer-Encoding: quoted-printable\n\nnot a fit =E2=80=94 sorry\n\"));
    console.log(r.triage_class + \" \" + (r.body_text.indexOf(\"=E2\") === -1 ? \"decoded\" : \"RAW\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"no decoded"* ]]
}

@test "base64 is decoded" {
  run _p "$PIMPORT const body = Buffer.from(\"Sounds good, send a link.\", \"utf8\").toString(\"base64\");
    const r = R.parseReply(B(\"From: a <adv1@firm1.example.com>\nContent-Type: text/plain\nContent-Transfer-Encoding: base64\n\n\" + body + \"\n\"));
    console.log(r.triage_class);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested"* ]]
}

@test "an unsupported transfer encoding is refused rather than guessed at" {
  run _p "$PIMPORT console.log(code(B(\"From: a <adv1@firm1.example.com>\nContent-Type: text/plain\nContent-Transfer-Encoding: uuencode\n\nhi\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"UNSUPPORTED_TRANSFER_ENCODING"* ]]
}

@test "a multipart reply is read from its text plain part" {
  run _p "$PIMPORT const m = [\"From: a <adv1@firm1.example.com>\", \"Content-Type: multipart/alternative; boundary=\\\"bnd\\\"\", \"\", \"--bnd\", \"Content-Type: text/html\", \"\", \"<p>not interested</p>\", \"--bnd\", \"Content-Type: text/plain\", \"\", \"Sounds good, send a link.\", \"--bnd--\", \"\"].join(\"\n\");
    console.log(R.parseReply(B(m)).triage_class);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested"* ]]
}

@test "an unquoted boundary parameter is honoured the same as a quoted one" {
  run _p "$PIMPORT const m = [\"From: a <adv1@firm1.example.com>\", \"Content-Type: multipart/mixed; boundary=bnd\", \"\", \"--bnd\", \"Content-Type: text/plain\", \"\", \"Sounds good, send a link.\", \"--bnd--\", \"\"].join(\"\n\");
    console.log(R.parseReply(B(m)).triage_class);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested"* ]]
}

@test "a multipart with no boundary parameter is refused" {
  run _p "$PIMPORT console.log(code(B(\"From: a <adv1@firm1.example.com>\nContent-Type: multipart/mixed\n\nbody\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"MULTIPART_WITHOUT_BOUNDARY"* ]]
}

@test "a multipart with no text plain part anywhere is refused" {
  run _p "$PIMPORT const m = [\"From: a <adv1@firm1.example.com>\", \"Content-Type: multipart/mixed; boundary=bnd\", \"\", \"--bnd\", \"Content-Type: application/pdf\", \"\", \"binaryish\", \"--bnd--\", \"\"].join(\"\n\");
    console.log(code(B(m)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NO_TEXT_PART"* ]]
}

@test "an html only reply is refused with its own code rather than silently emptied" {
  run _p "$PIMPORT console.log(code(B(\"From: a <adv1@firm1.example.com>\nContent-Type: text/html\n\n<p>Sounds good</p>\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"HTML_ONLY_REPLY"* ]]
}

@test "a boundary string appearing inside a part does not split it" {
  run _p "$PIMPORT const m = [\"From: a <adv1@firm1.example.com>\", \"Content-Type: multipart/mixed; boundary=bnd\", \"\", \"--bnd\", \"Content-Type: text/plain\", \"\", \"I mentioned --bnd in passing. Sounds good, send a link.\", \"--bnd--\", \"\"].join(\"\n\");
    const r = R.parseReply(B(m));
    console.log(r.triage_class + \" \" + (r.body_text.indexOf(\"in passing\") !== -1 ? \"whole\" : \"TRUNCATED\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested whole"* ]]
}

# ---------- the headline invariant ----------

@test "no refusal message anywhere contains a byte of the input" {
  run _p "$PIMPORT const M = \"ZZCONFIDENTIALZZ\";
    const cases = [
      \"From: a <adv1@firm1.example.com>\nSubject: \" + M + \"\n\",
      \"From: \" + M + \"\nContent-Type: text/plain\n\nbody\n\",
      \"From: a <adv1@firm1.example.com>\nFrom: b <adv2@firm2.example.com>\nContent-Type: text/plain\n\n\" + M + \"\n\",
      \"From: a <adv1@firm1.example.com>\nContent-Type: text/html\n\n<p>\" + M + \"</p>\n\",
      \"From: a <adv1@firm1.example.com>\nContent-Type: multipart/mixed\n\n\" + M + \"\n\",
      \"From: a <adv1@firm1.example.com>\nContent-Type: text/plain\nContent-Transfer-Encoding: uuencode\n\n\" + M + \"\n\",
      \"From: a <adv1@firm1.example.com\nContent-Type: text/plain\n\n\" + M + \"\n\",
    ];
    const leaked = cases.map(msg).filter((m) => m.indexOf(M) !== -1);
    // Assert every case actually FAILED first. If a case started parsing cleanly this test
    // would report zero leaks while testing nothing -- the vacuous pass.
    const failed = cases.filter((c) => code(B(c)) !== \"ACCEPTED\").length;
    console.log(failed + \"/\" + cases.length + \" failed, \" + leaked.length + \" leaked\");"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"7/7 failed, 0 leaked"* ]]
}

# ---------- quoted material ----------

@test "quoted lines and everything after a reply separator are removed" {
  run _p "$PIMPORT const t = R.stripQuoted([\"Yes please.\", \"\", \"On Tue, 4 Aug 2026 at 10:02, X <x@y.example.com> wrote:\", \"> unsubscribe here\", \"> more of our footer\"].join(\"\n\"));
    console.log(JSON.stringify(t));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *'"Yes please."'* ]]
}

@test "an RFC 3676 signature delimiter ends the visible text" {
  run _p "$PIMPORT console.log(JSON.stringify(R.stripQuoted([\"Keen.\", \"-- \", \"Adv 1, unsubscribe from everything\"].join(\"\n\"))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *'"Keen."'* ]]
}

@test "an Outlook quoted header block ends the visible text" {
  run _p "$PIMPORT console.log(JSON.stringify(R.stripQuoted([\"Sounds good.\", \"\", \"From: Outreach <o@s.example.net>\", \"Sent: Tuesday\", \"unsubscribe\"].join(\"\n\"))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *'"Sounds good."'* ]]
}

# ---------- registration ----------

@test "this file registers the 39 tests it declares" {
  # BATS_TEST_NAMES is what bats REGISTERED. Comparing a grep of this file to a literal in
  # this file is a tautology that cannot see a test bats DROPPED -- which is the only thing
  # the check exists to catch (a non-ASCII name is silently skipped).
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 39 ] || { echo "declared $declared, expected 39"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared declared tests -- one was DROPPED (non-ASCII name?)"; false; }
}

# ---------- found by the Phase-02 byte-boundary adversarial pass ----------

# The boundary is interpolated into a `new RegExp`. Past ~32k of pattern V8 throws a bare
# SyntaxError whose MESSAGE embeds the whole pattern -- i.e. the attacker's own bytes, straight
# out through a path that is not a ReplyParseError and therefore escaped the taxonomy entirely.
# A 98 KB file did it, one tenth of MAX_REPLY_BYTES, so no size limit fired first.
@test "a boundary longer than RFC 2046 allows is refused before it reaches the regex engine" {
  run _p "$PIMPORT const b = \"z\".repeat(40000);
    const m = B(\"From: a <adv1@firm1.example.com>\nContent-Type: multipart/mixed; boundary=\\\"\" + b + \"\\\"\n\n--x\n\");
    console.log(code(m) + \" \" + (msg(m).indexOf(\"zzzzzzzzzz\") === -1 ? \"clean\" : \"LEAKED\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"BOUNDARY_TOO_LONG clean"* ]]
}

# A `;` inside another parameter's QUOTED value is data, not a separator. A single regex
# scanning the whole header found the boundary inside `name="..."`, located zero parts, and
# refused a legitimate reply saying the sender wrote nothing.
@test "a semicolon inside a quoted parameter does not steal the boundary" {
  run _p "$PIMPORT const m = [\"From: a <adv1@firm1.example.com>\", \"Content-Type: multipart/mixed; name=\\\"x; boundary=evil\\\"; boundary=\\\"real\\\"\", \"\", \"--real\", \"Content-Type: text/plain\", \"\", \"Sounds good, send a link.\", \"--real--\", \"\"].join(\"\n\");
    console.log(R.parseReply(B(m)).triage_class);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested"* ]]
}

# The raw-byte NUL scan runs BEFORE decoding, so a NUL arriving as =00 or inside base64 walked
# straight past it into the store record and its JSON.
@test "a NUL smuggled through a transfer encoding is caught after decoding" {
  run _p "$PIMPORT const qp = B(\"From: a <adv1@firm1.example.com>\nContent-Type: text/plain\nContent-Transfer-Encoding: quoted-printable\n\nSounds good=00 send a link.\n\");
    const b64body = Buffer.from(\"Sounds good\" + String.fromCharCode(0) + \" send a link.\", \"utf8\").toString(\"base64\");
    const b64 = B(\"From: a <adv1@firm1.example.com>\nContent-Type: text/plain\nContent-Transfer-Encoding: base64\n\n\" + b64body + \"\n\");
    console.log(code(qp) + \" \" + code(b64));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NUL_BYTE NUL_BYTE"* ]]
}

# The whole string used to go through Buffer.from(s, "binary"), which truncates every code
# point above U+00FF to its low byte -- AFTER the body had already been utf8-decoded. Devanagari
# came out as arbitrary ASCII, which is both what a human reads to decide and what the triage
# rules then classify. This is a campaign aimed at Indian advocates.
@test "quoted printable preserves literal non ascii and still decodes escaped runs" {
  run _p "$PIMPORT const dev = \"\u0928\u092e\u0938\u094d\u0924\u0947\";
    const lit = R.parseReply(B(\"From: a <adv1@firm1.example.com>\nContent-Type: text/plain; charset=utf-8\nContent-Transfer-Encoding: quoted-printable\n\n\" + dev + \" sounds good, send a link.\n\"));
    const esc = R.parseReply(B(\"From: a <adv1@firm1.example.com>\nContent-Type: text/plain; charset=utf-8\nContent-Transfer-Encoding: quoted-printable\n\nCaf=C3=A9 sounds good, send a link.\n\"));
    console.log([lit.body_text.startsWith(dev), esc.body_text.startsWith(\"Caf\u00e9\"), lit.triage_class].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"true true interested"* ]]
}

@test "a charset this parser cannot decode is refused rather than mojibaked" {
  run _p "$PIMPORT console.log(code(B(\"From: a <adv1@firm1.example.com>\nContent-Type: text/plain; charset=iso-8859-1\n\nnot interested\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"UNSUPPORTED_CHARSET"* ]]
}

# `--file` is the documented manual door and Notepad plus PowerShell's Out-File both write a
# BOM. It failed closed, but pointed the operator at a missing separator.
@test "a leading UTF-8 BOM is stripped rather than reported as a malformed header" {
  run _p "$PIMPORT const bom = Buffer.concat([Buffer.from([0xEF,0xBB,0xBF]), B(OK)]);
    console.log(R.parseReply(bom).triage_class);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested"* ]]
}

# Headers CRLF, separator a bare LF LF. headerEnd matches the LF LF first and leaves a \r on
# the last header line; `.` does not match a CR and `$` without /m does not sit before one.
@test "a mixed CRLF and LF header block still parses" {
  run _p "$PIMPORT console.log(R.parseReply(B(\"From: a <adv1@firm1.example.com>\r\nSubject: Re: x\r\nContent-Type: text/plain\r\n\n\nSounds good, send a link.\n\")).triage_class);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested"* ]]
}

# A body that survives quote-stripping as nothing is REFUSED, not classified. Defaulting it to
# `later` is how a stripped-to-nothing opt-out passes silently.
@test "a body that is empty after quote stripping is refused" {
  run _p "$PIMPORT console.log(code(B(\"From: a <adv1@firm1.example.com>\nContent-Type: text/plain\n\n> everything here is quoted\n> and nothing is not\n\")));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"EMPTY_VISIBLE_BODY"* ]]
}

# The epilogue after the CLOSING delimiter is not a part. Split handed it back as one; it has
# no headers, header-less parts default to text/plain, so the empty epilogue matched as "the
# text/plain part" on every well-formed multipart and NO_TEXT_PART became unreachable.
@test "a multipart carrying only html is refused with the html code, not silently emptied" {
  run _p "$PIMPORT const m = [\"From: a <adv1@firm1.example.com>\", \"Content-Type: multipart/alternative; boundary=bnd\", \"\", \"--bnd\", \"Content-Type: text/html\", \"\", \"<p>remove me from your list</p>\", \"--bnd--\", \"\"].join(\"\n\");
    console.log(code(B(m)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"HTML_ONLY_REPLY"* ]]
}
