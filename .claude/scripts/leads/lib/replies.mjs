// replies.mjs — the reply parser and the triage classifier (ADR-0405, ADR-0414).
//
// This is PARSER-CLASS code: it consumes bytes an outsider chose, so it carries its own
// adversarial passes and every rule below is a refusal rather than a repair. Three invariants
// hold everywhere in this file, and the tests attack each one directly:
//
//   1. NO ERROR EVER CONTAINS A CONTENT BYTE. Errors name a reason code, the byte offset and
//      the path. That is deliberate and it is not merely privacy hygiene: this repo is headed
//      public, errors land in CI logs and scrollback, and a parser that quotes the input to
//      explain itself is a parser that publishes the input. `where`, never `what`.
//   2. LIMITS BEFORE WORK. Size and shape are checked before anything is decoded, so a
//      hostile input cannot make us allocate first and refuse second.
//   3. CLASSIFICATION READS ONLY WHAT THE HUMAN WROTE. Quoted material and signatures are
//      removed before a single rule runs — see stripQuoted, which exists because of the
//      footer trap described there. Skipping it makes every reply an unsubscribe.
//
// It parses enough RFC-5322/2045 to serve a real inbox and REFUSES the rest loudly. "Handle
// every MIME shape" is the rabbit hole the phase spec cuts; the fake's corpus plus a loud
// refusal for everything else is the shipped position.

import { createHash } from "node:crypto";

export class ReplyParseError extends Error {
  // `where` is a location (offset, header name, part index) and `hint` is an ACTION.
  // Neither may be built from input bytes. Callers add the path.
  constructor(code, where, hint) {
    super(`${code} at ${where} — ${hint}`);
    this.name = "ReplyParseError";
    this.code = code;
    this.where = where;
  }
}

// 1 MiB. A cold-outbound reply is a few kilobytes; anything past this is an attachment blast
// or an attack, and either way a human should look at it rather than this parser.
export const MAX_REPLY_BYTES = 1024 * 1024;

// ---------- identity (ADR-0414) ----------
//
// Over the RAW BYTES, before any parsing, so the identity cannot move when the parser
// improves. Buffer in, never a string: decoding first would fold every invalid-UTF-8 sequence
// onto U+FFFD and make two different files share an id.
export function replyRef(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("replyRef requires a Buffer — hashing a decoded string would collide distinct inputs on U+FFFD");
  return "reply_" + createHash("sha256").update(bytes).digest("hex").slice(0, 32);
}

// ---------- header block ----------

const CR = 0x0d, LF = 0x0a;

// Returns the byte offset just past the blank line that ends the header block, and the offset
// where the body starts. Handles CRLF and bare-LF files, because a reply saved by hand on
// Linux and one exported by a Windows client are both routine.
function headerEnd(buf) {
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === LF && buf[i + 1] === LF) return { end: i, body: i + 2 };
    if (buf[i] === CR && buf[i + 1] === LF && buf[i + 2] === CR && buf[i + 3] === LF)
      return { end: i, body: i + 4 };
  }
  return null;
}

// Header values are unfolded (a continuation line begins with SP or HTAB) and keyed by
// lowercase name. Duplicates keep EVERY occurrence: taking only the first lets a forged
// leading `From:` shadow the real one, and taking only the last lets a trailing one do it.
// The caller decides what a duplicate means, and for the fields that matter here a duplicate
// is a refusal.
export function parseHeaders(text) {
  const out = new Map();
  // A leading UTF-8 BOM is stripped, not refused. `--file` is the documented manual door and
  // Notepad and PowerShell's `Out-File -Encoding utf8` both write one, so a Windows operator
  // following the documentation hit MALFORMED_HEADER_LINE with a hint pointing at a missing
  // separator — fail-closed, but aimed at entirely the wrong thing. A BOM is an encoding mark,
  // not content. (A UTF-16 file still refuses, correctly, at the NUL scan.)
  //
  // A trailing CR is stripped because a MIXED ending (headers CRLF, separator a bare LF LF)
  // leaves one on the last header line: `.` does not match a CR and `$` without the m flag
  // does not sit before one, so `Name: value` stopped matching. This module's header claims
  // both endings are handled because both are routine — so is the mixture.
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.replace(/\r+$/, ""));
  let name = null, value = "";
  const flush = () => {
    if (name === null) return;
    const k = name.toLowerCase();
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(value.trim());
    name = null; value = "";
  };
  for (const line of lines) {
    if (/^[ \t]/.test(line)) {
      // A continuation with no header open is a malformed block, not a header named "".
      if (name === null) throw new ReplyParseError("HEADER_CONTINUATION_WITHOUT_HEADER", "header block line 1", "the header block starts with a folded line; the file is truncated or is not a mail message");
      value += " " + line.trim();
      continue;
    }
    const m = /^([!-9;-~]+):(.*)$/.exec(line);   // printable ASCII minus ':' , per RFC 5322 field-name
    if (!m) {
      if (line === "") continue;
      throw new ReplyParseError("MALFORMED_HEADER_LINE", `header block, ${line.length} bytes`, "a line in the header block is not `Name: value` and is not a fold — the header/body separator may be missing");
    }
    flush();
    name = m[1]; value = m[2];
  }
  flush();
  return out;
}

// Exactly one occurrence, or a refusal. Used for the fields that decide identity and routing.
function soleHeader(headers, name) {
  const v = headers.get(name);
  if (!v || v.length === 0) return null;
  if (v.length > 1)
    throw new ReplyParseError("DUPLICATE_HEADER", `header "${name}" x${v.length}`, `${name} appears more than once; which one is authoritative is exactly the ambiguity a forged header exploits, so this is refused rather than resolved`);
  return v[0];
}

// ---------- address extraction ----------
//
// The addr-spec is what is inside the LAST angle-bracket pair; a display name is free text an
// outsider chose and routinely contains an address. The shape of the attack, written without
// literal addresses because this file is inside the PII tripwire's scan scope and the gate does
// not care whether a leak is in a comment (it caught this comment, correctly):
//
//   From: "<a trusted-looking address, as the DISPLAY NAME>" <the address that actually sent>
//
// Reading the first address-shaped run of characters picks the display name. That is not a
// hypothetical — it is the standard display-name spoof, and it decides which dossier we match.
// The corpus fixture 09-display-name-spoof.eml is the concrete case.
const ADDR_RE = /^[^\s<>@,;:"()[\]\\]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export function addressFrom(headerValue, headerName) {
  const raw = String(headerValue == null ? "" : headerValue);
  let candidate;
  const lastOpen = raw.lastIndexOf("<");
  if (lastOpen !== -1) {
    const close = raw.indexOf(">", lastOpen);
    if (close === -1)
      throw new ReplyParseError("UNCLOSED_ANGLE_ADDR", `header "${headerName}"`, "an opening < has no closing >, so the address boundary is undecidable");
    candidate = raw.slice(lastOpen + 1, close).trim();
  } else {
    // A group list or a multi-address header is ambiguous for our purpose (which ONE person
    // replied), and guessing is how the wrong dossier gets matched.
    if (raw.includes(","))
      throw new ReplyParseError("MULTIPLE_ADDRESSES", `header "${headerName}"`, "more than one address is present and no angle-bracket addr-spec picks one out");
    candidate = raw.trim();
  }
  // RFC 2047 encoded-words are legal in a display name and never in an addr-spec.
  if (/^=\?/.test(candidate))
    throw new ReplyParseError("ENCODED_WORD_IN_ADDR", `header "${headerName}"`, "the addr-spec position holds an RFC-2047 encoded-word, which is not a valid address");
  if (!ADDR_RE.test(candidate))
    throw new ReplyParseError("UNPARSEABLE_ADDR", `header "${headerName}", ${candidate.length} bytes`, "the addr-spec position does not hold a single plain address");
  return candidate;
}

// ---------- MIME: enough, then a loud refusal ----------

// Only the `=XX` runs go through a byte round-trip; literal characters are left alone.
//
// The first version pushed the WHOLE string through `Buffer.from(s, "binary")`, which
// truncates every code point above U+00FF to its low byte. The string had already been
// utf8-decoded by then, so a QP body containing a literal non-ASCII character came out as
// arbitrary ASCII -- Devanagari became `(.8M$G`, and that text is both what a human reads to
// decide whether to book a meeting and what the triage regexes then classify. For a campaign
// aimed at Indian advocates that is not an edge case.
const decodeQp = (s) => {
  const soft = String(s).replace(/=\r?\n/g, "");   // soft line breaks
  let out = "", bytes = [];
  const flush = () => { if (bytes.length) { out += Buffer.from(bytes).toString("utf8"); bytes = []; } };
  for (let i = 0; i < soft.length; ) {
    const m = /^=([0-9A-Fa-f]{2})/.exec(soft.slice(i, i + 3));
    if (m) { bytes.push(parseInt(m[1], 16)); i += 3; continue; }
    flush();
    out += soft[i++];
  }
  flush();
  return out;
};

// Charsets we can decode losslessly from a body that has already been read as UTF-8. Anything
// else is REFUSED rather than mojibaked: the module's position is a refusal over a repair, and
// silently mangling the sentence a human reads to decide whether to book a meeting is the
// worst possible repair. Binding a real charset decoder waits for a chosen provider (ADR-0413).
// Built from a char code, never written as a literal or an escape: a NUL pasted into source
// is invisible in every editor and diff, which is precisely the property that makes it worth
// refusing in an email -- and it is not a property the code that removes it may have.
const NUL_CHAR = String.fromCharCode(0);

const CHARSET_OK = new Set(["utf-8", "utf8", "us-ascii", "ascii", ""]);

function decodePart(raw, encoding, charset) {
  const cs = String(charset || "").trim().toLowerCase().replace(/^"|"$/g, "");
  if (!CHARSET_OK.has(cs))
    throw new ReplyParseError("UNSUPPORTED_CHARSET", `charset "${cs.slice(0, 32)}"`, "supported: utf-8 and us-ascii. Refusing rather than decoding it wrongly — a silently mangled body is what a human would read to decide, and it would look like the sender wrote it");
  const e = String(encoding || "7bit").trim().toLowerCase();
  let text;
  if (e === "7bit" || e === "8bit" || e === "binary") text = raw;
  else if (e === "quoted-printable") text = decodeQp(raw);
  else if (e === "base64") text = Buffer.from(raw.replace(/\s+/g, ""), "base64").toString("utf8");
  else throw new ReplyParseError("UNSUPPORTED_TRANSFER_ENCODING", `Content-Transfer-Encoding "${e.slice(0, 32)}"`, "supported: 7bit, 8bit, binary, quoted-printable, base64 — anything else is refused rather than guessed at");

  // The raw-byte NUL scan in parseReply runs BEFORE any decoding, so a NUL smuggled as `=00`
  // or inside base64 walked straight past it and landed in the store record and its JSON.
  // The scan's own stated reason -- a text parse truncating at an attacker-chosen point --
  // applies to the DECODED text, which is the text that actually gets stored and read.
  const nul = text.indexOf(NUL_CHAR);
  if (nul !== -1)
    throw new ReplyParseError("NUL_BYTE", `offset ${nul} of the decoded body`, "a NUL appears after transfer-decoding; the raw-byte scan cannot see one that arrives as =00 or inside base64");
  return text;
}

// Parameters are TOKENISED, not regexed out of the whole header.
//
// A single regex scanning for `;\s*boundary\s*=` anywhere in the value finds the one INSIDE
// another parameter's quoted string:
//
//   Content-Type: multipart/mixed; name="x; boundary=evil"; boundary="real"
//
// It picked `evil`, located zero parts, and refused a legitimate reply with "the sender wrote
// nothing" (D1: a grammar pinned to a shape the producer does not guarantee). A quoted string
// is a single token and a `;` inside it is data — that is the whole point of the quoting.
function ctParams(ct) {
  const s = String(ct || "");
  const out = new Map();
  let i = s.indexOf(";");
  while (i !== -1 && i < s.length) {
    i++;
    while (i < s.length && /\s/.test(s[i])) i++;
    let name = "";
    while (i < s.length && s[i] !== "=" && s[i] !== ";") name += s[i++];
    if (s[i] !== "=") { i = s.indexOf(";", i); continue; }
    i++;                                        // past the '='
    let value = "";
    if (s[i] === '"') {
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === "\\" && i + 1 < s.length) i++;   // RFC 2045 quoted-pair
        value += s[i++];
      }
      i++;                                      // past the closing quote
      i = s.indexOf(";", i);
    } else {
      while (i < s.length && s[i] !== ";") value += s[i++];
      i = s.indexOf(";", i);
    }
    const key = name.trim().toLowerCase();
    if (key && !out.has(key)) out.set(key, value.trim());
  }
  return out;
}
const paramOf = (ct, key) => (ctParams(ct).get(String(key).toLowerCase()) ?? null);

// RFC 2046 caps a boundary at 70 characters. Enforced, because the boundary is interpolated
// into a `new RegExp` and V8 throws a bare SyntaxError past ~32k of pattern -- a SyntaxError
// whose MESSAGE embeds the whole pattern, i.e. the attacker's own bytes. That is not a
// ReplyParseError, so it escaped the taxonomy and printed input verbatim to stderr, into CI
// logs and scrollback, breaking this module's first stated invariant. A 98 KB file did it,
// one tenth of MAX_REPLY_BYTES, so no size limit fired first (D3: the guard that protects the
// rule could not be reached by any input the tests ship with).
const MAX_BOUNDARY_LEN = 70;

// Body parts, bounded by the delimiter lines and STOPPING at the closing `--boundary--`.
//
// A plain `.split()` was wrong in a way that disabled the whole no-text-part refusal: the
// text after the CLOSING delimiter is an epilogue, not a part, and split handed it back as
// one. An epilogue has no header block, header-less parts default to text/plain per RFC 2046,
// and the empty epilogue therefore matched as "the text/plain part" on EVERY well-formed
// multipart. So `NO_TEXT_PART` was unreachable, and a multipart carrying only text/html --
// which is what a pure-HTML client actually sends -- parsed to `body_text: ""` and classified
// `later`. An HTML-only "remove me from your list" produced no suppression at all. The
// single-part text/html case was refused loudly; its multipart twin was not (D6).
function multipartParts(body, boundary) {
  const esc = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // `\r?` before `$` because in multiline mode `$` sits before the \n, so CRLF leaves the \r
  // inside the line. A delimiter is a LINE beginning with `--boundary`, never a bare
  // occurrence of the boundary string, which may legitimately appear inside a part's text.
  const re = new RegExp(`^--${esc}(--)?[ \\t]*\\r?$`, "gm");
  const parts = [];
  let start = null, m;
  while ((m = re.exec(body)) !== null) {
    if (start !== null) parts.push(body.slice(start, m.index));
    if (m[1]) return parts;               // closing delimiter — everything after is epilogue
    start = m.index + m[0].length;
  }
  if (start !== null) parts.push(body.slice(start));   // unterminated multipart: still parts
  return parts;
}

// Depth-limited: a multipart whose parts are multiparts is legal and is also an easy way to
// make a parser recurse until it dies. Two levels covers every real mail client.
//
// Returns the first NON-EMPTY text/plain. Emptiness matters: a text/plain part that decodes to
// nothing is not "the message", and accepting it is how a reply reads downstream as "the lead
// sent nothing" — the exact phrase paramOf's own comment uses.
function firstTextPlain(body, contentType, encoding, depth = 0, charset = null) {
  const ct = String(contentType || "text/plain").toLowerCase();
  if (!ct.startsWith("multipart/")) {
    if (ct.startsWith("text/plain")) return decodePart(body, encoding, charset);
    if (ct.startsWith("text/html"))
      throw new ReplyParseError("HTML_ONLY_REPLY", "top-level Content-Type", "the reply has no text/plain part; forward it as plain text or paste the text into a file — this parser does not render HTML, because an HTML-to-text step is a second parser and a second attack surface");
    throw new ReplyParseError("UNSUPPORTED_CONTENT_TYPE", `Content-Type "${ct.slice(0, 48)}"`, "supported: text/plain, or a multipart carrying one");
  }
  if (depth >= 2)
    throw new ReplyParseError("MULTIPART_TOO_DEEP", `nesting depth ${depth}`, "multipart nesting beyond two levels is refused");
  const boundary = paramOf(contentType, "boundary");
  if (!boundary)
    throw new ReplyParseError("MULTIPART_WITHOUT_BOUNDARY", "top-level Content-Type", "a multipart Content-Type carries no boundary parameter, so its parts cannot be located");
  if (boundary.length > MAX_BOUNDARY_LEN)
    throw new ReplyParseError("BOUNDARY_TOO_LONG", `boundary parameter, ${boundary.length} characters`, `RFC 2046 caps a boundary at ${MAX_BOUNDARY_LEN} characters; a longer one is refused before it reaches the regex engine`);

  const parts = multipartParts(body, boundary);
  let sawHtml = false;
  for (const raw of parts) {
    const part = raw.replace(/^\r?\n/, "");
    const sep = /\r?\n\r?\n/.exec(part);
    const hdrText = sep ? part.slice(0, sep.index) : "";
    const partBody = sep ? part.slice(sep.index + sep[0].length) : part;
    const h = parseHeaders(hdrText);
    const partCt = String((h.get("content-type") || ["text/plain"])[0]).toLowerCase();
    const partEnc = (h.get("content-transfer-encoding") || ["7bit"])[0];
    if (partCt.startsWith("multipart/")) {
      try {
        const nested = firstTextPlain(partBody, partCt, partEnc, depth + 1, paramOf(partCt, "charset"));
        if (nested.trim()) return nested;
      } catch (e) {
        if (e.code === "NO_TEXT_PART") continue;
        if (e.code === "HTML_ONLY_REPLY") { sawHtml = true; continue; }
        throw e;
      }
      continue;
    }
    if (partCt.startsWith("text/html")) { sawHtml = true; continue; }
    if (partCt.startsWith("text/plain")) {
      // The PART's own charset, not the top-level one -- a multipart may mix them.
      const decoded = decodePart(partBody, partEnc, paramOf(partCt, "charset"));
      if (decoded.trim()) return decoded;
    }
  }
  // An HTML-only multipart gets the HTML code, not the generic one: the operator's action is
  // different (forward it as plain text) and it is the common real case.
  if (sawHtml)
    throw new ReplyParseError("HTML_ONLY_REPLY", `multipart with ${parts.length} part(s)`, "the multipart carries an HTML part but no non-empty text/plain one; forward it as plain text or paste the text into a file");
  throw new ReplyParseError("NO_TEXT_PART", `multipart with ${parts.length} part(s)`, "no non-empty text/plain part was found in the multipart");
}

// ---------- what the human actually wrote ----------
//
// THE FOOTER TRAP. Every mail this system sends carries a List-Unsubscribe address and an
// unsubscribe line (ADR-0402, non-negotiable). Every reply quotes it. So a classifier reading
// the whole body finds the word "unsubscribe" in essentially 100% of replies, and suppresses
// every lead who answers "sounds great, when can we talk?".
//
// Suppression is one-way, so this failure is not a rounding error: it silently ends the
// campaign while every receipt looks correct. Quoted material comes off FIRST, always.
const SEPARATORS = [
  /^On .{1,200}\bwrote:\s*$/i,           // Gmail / Apple Mail
  /^-{2,}\s*Original Message\s*-{2,}\s*$/i,
  /^_{10,}\s*$/,                          // Outlook's horizontal rule
  /^Sent from my \w+/i,
  /^-{3,}\s*Forwarded message\s*-{3,}\s*$/i,
];

// Outlook's quoted header block, handled separately because a bare `^From:` is far too eager:
// a reply whose first line happens to begin "From: " is not a quote, and treating it as one
// discarded the entire message. The block is only a quote when a sibling header follows it
// within a couple of lines, which is what actually distinguishes it from prose.
const OUTLOOK_FROM = /^From:\s.{1,200}$/i;
const OUTLOOK_SIBLING = /^(?:Sent|To|Cc|Date|Subject):\s/i;
const isOutlookBlock = (lines, i) =>
  OUTLOOK_FROM.test(lines[i].trim()) &&
  lines.slice(i + 1, i + 4).some((l) => OUTLOOK_SIBLING.test(l.trim()));

// Two rules, and they are NOT the same rule:
//
//   a `>` line is quoted material    -- always dropped, wherever it sits
//   a separator line starts the quote-- everything after it is the ORIGINAL mail
//
// Collapsing them into one "break at the first separator" cut lost every BOTTOM-POSTED reply,
// which is the Outlook default in a lot of corporate mail: the human writes BELOW the quoted
// original, so 100% of what they wrote sits after the separator. A confirmed case ate an
// entire "Please take me off your list. Do not email me again." and classified it `later` --
// a lawful opt-out silently not honoured, by the same function whose header claims it reads
// only what the human wrote.
//
// So: take the text above the separator; if that is empty, the reply is bottom-posted and the
// human's words are the unquoted lines BELOW it. Our own footer is quoted with `>` in both
// layouts, so it is dropped either way and the footer trap stays closed.
export function stripQuoted(text) {
  const lines = String(text).split(/\r?\n/);
  const above = [], below = [];
  let past = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    // A signature ends the message outright and its content is never classified — it is our
    // correspondent's boilerplate, and boilerplate is exactly what these rules must not read.
    if (/^--\s*$/.test(t)) break;
    if (!past && (SEPARATORS.some((re) => re.test(t)) || isOutlookBlock(lines, i))) { past = true; continue; }
    if (/^\s*>/.test(line)) continue;                       // quoted, in either half
    (past ? below : above).push(line);
  }
  const top = above.join("\n").trim();
  return top || below.join("\n").trim();
}

// ---------- triage ----------
//
// Rules, not a model (the phase spec cuts reply-classification ML explicitly). Order is the
// design: it runs from the most consequential class to the least, and `no` is tested BEFORE
// `interested` because "not interested" contains "interested" and a substring match would
// book a meeting with someone who declined.
// The negated-contact form is checked FIRST and on its own, because it defeats every rule
// below it by construction: "do not call me" contains `call me`, which is an INTERESTED
// marker, so it minted a calendar draft for someone who had just refused contact. The `no`
// rule was ordered ahead of `interested` for precisely this reason — one phrase ("not
// interested") got the treatment and the identical defect twenty characters away did not.
// That is the twin-fix recurrence this repo keeps writing rules about: fix the pattern, not
// the instance.
const NEGATED_CONTACT =
  /\b(?:do\s*n[o']?t|dont|don`t|never|please\s+(?:do\s*n[o']?t|dont|stop))\s+(?:ever\s+)?(?:call|contact|e-?mail|mail|message|write|phone|ring|reach out to|get in touch)\b/i;

// Opt-out grammars, deliberately GENEROUS. The first version was pinned to the exact spellings
// of one shipped fixture — `do not` but never `don't`, `remove me` but never `remove my
// email`, `opt-out` but never `opt me out`, `stop emailing` but never `stop sending`. Eight
// ordinary phrasings of a lawful opt-out classified as `later` or `no`, which stops the
// sequence but emits NO suppression, so the person is contactable again in the next campaign,
// after a re-research, and after a dossier purge (D1: a grammar pinned to one form).
//
// The asymmetry is the argument for being generous here. Over-suppressing costs one lead who
// has to be re-added by hand. Under-suppressing mails someone who told us in writing to stop.
const UNSUBSCRIBE =
  /\b(?:unsubscribe|un-subscribe|opt(?:\s*me)?[\s-]*out|remove (?:me|my (?:e-?mail|name|address|details?|data|contact))|take (?:me|my (?:name|e-?mail|address|details?)) off|delete my (?:e-?mail|details?|data|record|contact)|stop (?:e-?mailing|emailing|contacting|messaging|mailing|sending)|no longer (?:wish|want) to (?:hear|receive|be contacted)|not to be contacted)\b/i;

const RULES = [
  ["unsubscribe", UNSUBSCRIBE],
  ["no", /\b(?:not interested|no thanks?|no thank you|not a (?:good )?fit|we(?:'| a)re (?:all )?(?:good|set|sorted)|pass on this|please stop|not for us|already have)\b/i],
  ["interested", /\b(?:interested|keen|sounds (?:good|great|interesting)|tell me more|happy to (?:chat|talk|meet|connect)|let'?s (?:talk|chat|meet|connect|set ?up)|book a|set up a call|send (?:me )?(?:a )?(?:link|time|invite)|what times?|when (?:can|are) you|call me|calendar|schedule)\b/i],
  ["later", /\b(?:later|next (?:quarter|month|year|week)|circle back|revisit|reach out (?:again|in)|after (?:the )?(?:holidays?|diwali|new year)|busy (?:right now|at the moment)|not (?:right )?now|q[1-4]\b)\b/i],
];

// Is this message from the MAIL SYSTEM rather than from a person? Decided by headers, never by
// body text: a human writing "your last mail bounced back to me" is not a bounce, and a DSN
// that politely says nothing recognisable still is one.
//
// The daemon test reads the ADDR-SPEC, not the raw header. Reading the raw value meant a
// display name deciding it — an ordinary reply from a real lead whose display name quoted a
// daemon address was treated as a delivery report, refused for naming no failed recipient, and
// so produced NO receipt and did not stop the sequence. `addressFrom` thirty lines above
// carries ten lines of comment about exactly that spoof; this function ignored them (D5: two
// reads of one value that disagree).
//
// The `auto-submitted` clause no longer regexes the SUBJECT. The subject of a reply is our own
// subject line echoed back, so a campaign about "faster delivery of your filings" made every
// out-of-office auto-reply a bounce.
const DAEMON_LOCAL = /^(?:mailer-daemon|postmaster|mail-daemon|double-bounce)$/i;

function isDaemonSender(headers) {
  const raw = (headers.get("from") || [""])[0];
  let addr;
  try { addr = addressFrom(raw, "From"); } catch { return false; }
  return DAEMON_LOCAL.test(addr.split("@")[0]);
}

// A daemon-looking SENDER is not on its own enough, and that was a second D6 in the same
// function: `postmaster@` is an RFC-mandated role address that a human can and does reply
// from, and matching it alone refused a real person with BOUNCE_WITHOUT_RECIPIENT — no
// receipt, sequence not stopped. A delivery report must actually LOOK like one: an explicit
// failed-recipient header, the RFC 3464 multipart/report structure, or a daemon sender whose
// body carries delivery-status fields.
export function isDeliveryReport(headers, bodyText = "") {
  if (headers.has("x-failed-recipients")) return true;
  const ct = String((headers.get("content-type") || [""])[0]).toLowerCase();
  if (ct.startsWith("multipart/report") && /report-type\s*=\s*"?delivery-status/i.test(ct)) return true;
  return isDaemonSender(headers) && (finalRecipient(bodyText) !== null || dsnDisposition(bodyText) !== null);
}

// RFC 3464 disposition. A delivery report is not automatically a failure: mail systems send
// `Action: delayed` retry warnings (Gmail and Postfix both do, and both say in the body "you
// do not need to resend your message"), and `delivered`/`relayed` reports on request.
//
// Treating those as bounces suppressed a LIVE lead permanently — `lead.suppressed`'s idem is
// `lead.suppressed|lead_id|reason`, so it never expires — and because each retry notice has
// different bytes, hence a different reply_ref, hence a different idem, TWO delay warnings for
// one healthy address FROZE the whole campaign. A transient delay is the single most common
// thing a mail system says, and it meant the opposite of what we recorded.
export function dsnDisposition(bodyText) {
  const action = /^Action:\s*([A-Za-z-]+)\s*$/im.exec(String(bodyText));
  const status = /^Status:\s*(\d)\.\d+\.\d+\s*$/im.exec(String(bodyText));
  if (action) return action[1].toLowerCase();
  // No Action field: fall back to the status class. 5.x.x is permanent, 4.x.x is transient.
  if (status) return status[1] === "4" ? "delayed" : status[1] === "5" ? "failed" : "relayed";
  return null;   // an unstructured mail-system message; the caller decides
}

// The default is `later`, and the choice is asymmetric on purpose. An unclassifiable reply
// still STOPS the sequence — reply-stop keys on the receipt existing, not on its class — so
// nothing is sent to that person either way. What the default decides is only what happens
// automatically NEXT: `later` books nothing and suppresses nothing, while defaulting to
// `interested` would mint meeting drafts from noise and defaulting to `unsubscribe` would
// silently suppress a warm lead on a parser miss. `later` is the class whose mistake a human
// can still undo.
// Every apostrophe-shaped character folded to the ASCII one BEFORE a rule runs.
//
// U+2019 is what iOS, Android, Word, Outlook and Gmail insert by autocorrect -- it is what a
// person actually types -- and it is what `=E2=80=99` decodes to on the quoted-printable path
// this parser explicitly supports. Without the fold, `don<U+2019>t call me again` classified as
// INTERESTED and minted a calendar draft, while the ASCII spelling of the same sentence
// suppressed. The rules were pinned to one spelling of a character with six (D1), and the test
// named "the apostrophe spelling" exercised the ASCII one that already worked.
//
// Folded for CLASSIFICATION ONLY. `reply_ref` is computed over the raw bytes before any
// parsing, so nothing here can move a receipt identity. Same discipline as store.mjs
// normalising an address before it is hashed.
const APOSTROPHES = /[‘’ʼʹ＇′´`]/g;
const foldApostrophes = (s) => String(s).replace(APOSTROPHES, "'");

export function triage(visibleText) {
  const text = foldApostrophes(visibleText);
  if (NEGATED_CONTACT.test(text)) return { triage_class: "unsubscribe", matched: "negated-contact" };
  for (const [cls, re] of RULES) {
    const m = re.exec(text);
    // `matched` is the RULE NAME, never the matched text — the matched text is content.
    if (m) return { triage_class: cls, matched: cls };
  }
  return { triage_class: "later", matched: "default" };
}

// ---------- the whole parse ----------

export function parseReply(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("parseReply requires a Buffer");
  // Limits BEFORE work.
  if (bytes.length === 0)
    throw new ReplyParseError("EMPTY_INPUT", "offset 0", "the input is zero bytes");
  if (bytes.length > MAX_REPLY_BYTES)
    throw new ReplyParseError("TOO_LARGE", `${bytes.length} bytes`, `the limit is ${MAX_REPLY_BYTES} bytes; a reply this size is an attachment blast and belongs in front of a human`);
  const nul = bytes.indexOf(0);
  if (nul !== -1)
    throw new ReplyParseError("NUL_BYTE", `offset ${nul}`, "a NUL byte is present; this is not a mail message and a text parse of it would truncate at an attacker-chosen point");

  const ref = replyRef(bytes);
  const split = headerEnd(bytes);
  if (!split)
    throw new ReplyParseError("NO_HEADER_BODY_SEPARATOR", `offset ${bytes.length} (end of input)`, "no blank line separates headers from body; the file is truncated or is not a mail message");

  const headers = parseHeaders(bytes.subarray(0, split.end).toString("utf8"));
  const bodyRaw = bytes.subarray(split.body).toString("utf8");

  // THE DELIVERY-REPORT BRANCH RUNS FIRST, and it never touches firstTextPlain.
  //
  // Ordering, not decoration. The body parse used to run before the classification, so a
  // bounce whose only body part was text/html died at HTML_ONLY_REPLY and a vendor relay's
  // odd MIME shape classified as `later` — a confirmed-dead address left sendable, because
  // a header-driven decision had been made to depend on a successful body parse. The DSN body
  // is read as RAW TEXT for its Final-Recipient and Action fields; it is a machine format and
  // does not go through the human-reply decoder at all.
  if (isDeliveryReport(headers, bodyRaw)) {
    const disposition = dsnDisposition(bodyRaw);
    // A transient delay or a success report is NOT a bounce and NOT a reply. Refused loudly,
    // so nothing is emitted at all: recording it would either suppress a live lead forever or
    // stop a sequence on a mail that is still in flight.
    if (disposition === "delayed" || disposition === "delivered" || disposition === "relayed" || disposition === "expanded")
      throw new ReplyParseError("NON_FAILURE_DSN", `Action: ${disposition}`, "this is a delivery-status notification that reports no failure (a retry warning or a success report) — it is neither a bounce nor a reply, so nothing is recorded for it");

    const failed = soleHeader(headers, "x-failed-recipients") || finalRecipient(bodyRaw);
    if (!failed)
      throw new ReplyParseError("BOUNCE_WITHOUT_RECIPIENT", "X-Failed-Recipients / Final-Recipient", "the message is a delivery report but names no failed recipient, so which lead bounced cannot be determined");
    return {
      reply_ref: ref,
      address: addressFrom(failed, "X-Failed-Recipients/Final-Recipient"),
      address_source: "x-failed-recipients",
      triage_class: "bounce",
      matched: "headers",
      dsn_action: disposition,
      subject_present: headers.has("subject"),
      visible_bytes: 0,
      body_text: "",           // a DSN body is machine output, not the lead's words
      is_bounce: true,
    };
  }

  const ct = soleHeader(headers, "content-type");
  const cte = soleHeader(headers, "content-transfer-encoding");
  const text = firstTextPlain(bodyRaw, ct, cte, 0, paramOf(ct, "charset"));
  const visible = stripQuoted(text);
  // An empty visible body is REFUSED, not classified. It means either the body genuinely had
  // nothing in it or our own stripping removed everything the human wrote — and both need a
  // person, not a default. Classifying it `later` is how a stripped-to-nothing opt-out passes
  // silently. `visible_bytes` was computed for exactly this check and then read nowhere.
  if (!visible)
    throw new ReplyParseError("EMPTY_VISIBLE_BODY", `${Buffer.byteLength(text, "utf8")} bytes of body, 0 after removing quoted material`, "nothing the sender wrote survived quote-stripping — refusing rather than classifying an empty message; open the file and triage it by hand");
  const { triage_class, matched } = triage(visible);

  const from = soleHeader(headers, "from");
  if (!from)
    throw new ReplyParseError("NO_FROM_HEADER", "header block", "the message has no From header, so which lead replied cannot be determined");

  return {
    reply_ref: ref,
    address: addressFrom(from, "From"),   // PII. Store-side only; never emitted.
    address_source: "from",
    triage_class,
    matched,
    dsn_action: null,
    subject_present: headers.has("subject"),
    visible_bytes: Buffer.byteLength(visible, "utf8"),
    body_text: visible,      // PII. Store only.
    is_bounce: false,
  };
}

// RFC 3464 `Final-Recipient: rfc822; <addr-spec>` inside the delivery-status part.
function finalRecipient(bodyText) {
  const m = /^Final-Recipient:\s*[^;\r\n]+;\s*(\S+)\s*$/im.exec(String(bodyText));
  return m ? m[1] : null;
}
