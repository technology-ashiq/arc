// ventures.mjs -- the STRICT reader for the root `ventures.yaml` company organ (ADR-1008 / LED-I).
//
// This file parses the numbers that decide whether a venture lives. ADR-1008 calls it parser-class
// for one reason, quoted: "a criteria parser that accepts a malformed line is a criteria parser
// that silently disables a kill switch". So every rule below REFUSES rather than repairs, and
// every refusal names the line number and the offending text -- the operator who has to fix the
// file is the same person the control exists to slow down, and a refusal they cannot act on is a
// refusal they will route around.
//
// WHY THERE IS NO YAML LIBRARY HERE, and never will be: a general YAML reader is a superset
// machine. It resolves anchors, merges keys, coerces `no` to false, and reads `090` as 90 or as a
// string depending on which spec version it implements -- it answers "what does this file mean?"
// with a default. This document has ONE legal shape and four legal keys (ADR-1008 v1). Accepting a
// superset of that shape IS the risk, so the subset below is hand-written, closed, and small
// enough to read in one sitting -- the property that matters for a control nobody re-audits.
//
// WHAT THE DIGEST COVERS -- read this before assuming it hashes the file. The digest is taken over
// the PARSED, CANONICALIZED values, never over the raw bytes. Reformatting, adding or removing a
// comment, and switching line endings all leave it UNCHANGED; changing any number, adding or
// removing a venture, or changing `version` all change it. That is the point: the ADR-1008 receipt
// must fire on a goalpost that moved and must stay quiet on a whitespace edit, or it becomes the
// rubber stamp named in that ADR's own revisit trigger.

import { SpineError, canonicalize, sha256Hex } from "../canonical.mjs";

// The one ceiling for both criteria. WHY 1,000,000: the realistic failure is not an operator
// typing an absurd number on purpose, it is a trailing-zero slip -- `90` becomes `900000` and the
// switch is off for 2,466 years while still LOOKING armed. 1e6 days is ~2,700 years and 1e6 monthly
// visits is orders past anything a venture near its kill line sees, so nothing legitimate is
// refused and every typo of that class is loud.
export const MAX_CRITERION_VALUE = 1000000;
const MAX_CRITERION_DIGITS = String(MAX_CRITERION_VALUE).length;

const TOP_KEYS = Object.freeze(["version", "ventures"]);
// Exactly two criteria in v1 (ADR-1008). An MRR floor was deliberately NOT added; adding a third
// key here is a tracked decision, not an edit.
export const KILL_CRITERIA = Object.freeze(["days_without_revenue", "traffic_floor_monthly"]);

const VENTURE_NAME_RE = /^[a-z][a-z0-9-]{0,63}$/;
// These pass the grammar and break `mkdir` on exactly one of the three CI legs (.claude/rules/lanes.md).
const RESERVED_DEVICE_NAMES = new Set([
  "con", "prn", "aux", "nul",
  ...Array.from({ length: 10 }, (_, i) => `com${i}`),
  ...Array.from({ length: 10 }, (_, i) => `lpt${i}`),
]);

// A bare positive decimal integer and nothing else. This single expression is what refuses floats,
// exponents, a leading + or -, leading zeros, underscores, hex/octal/binary, Infinity and NaN --
// they are not separate rules, they are all "not this shape". Zero is refused with them: a floor
// nothing can fall below is a disabled switch spelled as an armed one.
const INTEGER_RE = /^[1-9][0-9]*$/;
// Not load-bearing -- INTEGER_RE already refuses every one of these. They exist only so the message
// can name what was written, because a YAML reader coerces these to null/true/false and a criterion
// that reads as null is silently "no limit".
const YAML_NULLISH = new Set(["~", "null", "Null", "NULL"]);
const YAML_BOOLEANISH = new Set([
  "true", "True", "TRUE", "false", "False", "FALSE",
  "yes", "Yes", "YES", "no", "No", "NO", "on", "On", "ON", "off", "Off", "OFF", "y", "Y", "n", "N",
]);

const isMap = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

// Every refusal goes through here, so "names the line and the text" is a property of the module
// rather than a habit of whoever wrote the last check.
function fail(code, lineNo, text, why) {
  throw new SpineError(code, `ventures.yaml line ${lineNo}: ${why} -- got ${JSON.stringify(text)}`);
}

// Refused BY NAME, not as "unexpected token": a parser that reports a parse error for an anchor
// teaches the operator nothing, and they will try three more spellings of the same idea.
const LINE_FEATURES = Object.freeze([
  [/^---/, "a multi-document marker (---)"],
  [/^\.\.\./, "an end-of-document marker (...)"],
  [/^-( |$)/, "a sequence item (- )"],
  [/^\?( |$)/, "an explicit key (? )"],
  [/^<</, "a merge key (<<)"],
  [/^&/, "an anchor (&)"],
  [/^\*/, "an alias (*)"],
  [/^\{/, "a flow mapping ({)"],
  [/^\[/, "a flow sequence ([)"],
  [/^!/, "a tag (!)"],
]);

const VALUE_FEATURES = Object.freeze([
  [/^&/, "an anchor (&)"],
  [/^\*/, "an alias (*)"],
  [/^\{/, "a flow mapping ({)"],
  [/^\[/, "a flow sequence ([)"],
  [/^[|>]/, "a block scalar (| or >)"],
  [/^!/, "a tag (!)"],
]);

function refuseFeatures(table, text, lineNo, raw) {
  for (const [re, what] of table)
    if (re.test(text))
      fail("UNSUPPORTED_VENTURES_YAML", lineNo, raw, `${what} is not part of this subset -- ventures.yaml is plain nested key: value only`);
}

// Any control byte other than the LF this parser accepts, refused before a single line is read.
// TAB is one of them, so it is refused EVERYWHERE -- including inside a comment and on an otherwise
// blank line. That is deliberate and it is the whole of rule "no tab indentation": a tab renders at
// whatever width the reader is configured for, so a tab-indented block is a document whose
// structure depends on the editor that opens it. NUL is named on its own because a raw 0x00
// recently made another file in this lane binary to git, which hid its entire diff.
// JSON.stringify escapes the offender, so the message stays printable in a terminal.
//
// HONEST LIMIT OF THE C1 BRANCH (0x80-0x9f), stated rather than implied, because an earlier version
// of this comment implied more than the code does. The check runs on the DECODED string, and the
// caller decodes with utf8, which maps every invalid byte sequence to U+FFFD before this ever sees
// it. So a raw latin-1 or cp1252 high byte -- the realistic way a C1 byte reaches a YAML file at
// all -- arrives here as U+FFFD (above 0x9f) and does NOT trip this branch; only a properly encoded
// C1 code point such as U+0085 does. The residual is bounded rather than dangerous: mojibake
// survives only inside a comment, since the same byte in a key, a venture name or a value is
// refused by the grammar (BAD_VENTURES_SYNTAX / BAD_VENTURES_VALUE), and a comment cannot move the
// digest. A grammar is worth what it refuses, never what its comment says it refuses.
function assertNoControlChars(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0x0a) continue;
    if (c > 0x1f && c !== 0x7f && !(c >= 0x80 && c <= 0x9f)) continue;
    const before = text.slice(0, i);
    const lineNo = before.split("\n").length;
    const start = before.lastIndexOf("\n") + 1;
    const end = text.indexOf("\n", i);
    // Escaped by hand rather than by JSON.stringify, which leaves DEL and the C1 range as
    // themselves: echoing an invisible byte back invisibly is how "the line looks fine to me"
    // becomes a support thread.
    const lineText = text
      .slice(start, end < 0 ? text.length : end)
      .replace(/[\x00-\x1f\x7f-\x9f]/g, (ch) => "\\x" + ch.charCodeAt(0).toString(16).padStart(2, "0"));
    const indenting = c === 0x09 && /^[ \t]*$/.test(text.slice(start, i));
    const label =
      c === 0x09 ? "a TAB (0x09)" :
      c === 0x00 ? "NUL (0x00)" :
      c === 0x0d ? "a lone CR (0x0d), a half-normalized line ending" :
      `0x${c.toString(16).padStart(2, "0")}`;
    const why = indenting
      ? "used for indentation; indentation here is exactly 2 spaces per level"
      : "is not legal anywhere in this document";
    throw new SpineError(
      indenting ? "BAD_VENTURES_INDENT" : "BAD_VENTURES_CHAR",
      `ventures.yaml line ${lineNo}: ${label} at column ${i - start + 1} ${why} -- got ${JSON.stringify(lineText)}`,
    );
  }
}

function assertVentureName(name, lineNo, raw) {
  if (!VENTURE_NAME_RE.test(name))
    fail("BAD_VENTURES_NAME", lineNo, raw, `venture name ${JSON.stringify(name)} must match [a-z][a-z0-9-]{0,63}`);
  if (RESERVED_DEVICE_NAMES.has(name))
    fail("BAD_VENTURES_NAME", lineNo, raw, `venture name ${JSON.stringify(name)} is a Windows reserved device name; it passes the grammar and breaks mkdir on exactly one of the three CI legs`);
}

function parseCriterion(key, value, lineNo, raw) {
  if (YAML_NULLISH.has(value) || YAML_BOOLEANISH.has(value))
    fail("BAD_VENTURES_VALUE", lineNo, raw, `${key} is the YAML null/boolean ${JSON.stringify(value)}; a reader that coerces it hands the kill check "no limit"`);
  if (!INTEGER_RE.test(value))
    fail("BAD_VENTURES_VALUE", lineNo, raw, `${key} must be a bare positive decimal integer -- no sign, no leading zero, no decimal point, no exponent, no underscore, no quotes, no 0x/0o/0b`);
  if (value.length > MAX_CRITERION_DIGITS || Number(value) > MAX_CRITERION_VALUE)
    fail("BAD_VENTURES_VALUE", lineNo, raw, `${key} exceeds the ceiling of ${MAX_CRITERION_VALUE}; a threshold nothing can ever cross is a disabled kill switch wearing the costume of an armed one`);
  return Number(value);
}

export function parseVentures(text) {
  if (typeof text !== "string")
    throw new SpineError("BAD_VENTURES_SYNTAX", `ventures.yaml must be read as a string, got ${typeof text}`);

  // BOM first: it is invisible, so a document that opens with one would otherwise be refused for a
  // `version` key that looks exactly right on screen -- a baffling error, and the kind an operator
  // resolves by deleting the line rather than the byte.
  let body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  // CRLF collapses BEFORE the control scan, so a Windows checkout is ordinary input while a LONE CR
  // -- a legacy ending, or half of a mangled edit -- still lands in the scan as the control byte it is.
  body = body.replace(/\r\n/g, "\n");
  assertNoControlChars(body);

  const lines = body.split("\n");
  const seenTopKeys = new Set();
  // Sets, not object keys: a venture named `constructor` matches the name grammar, and `in` on a
  // plain object answers true for it before any venture is declared.
  const seenVentureNames = new Set();
  const records = [];
  let current = null;
  let version = null;
  let sawVentures = false;
  let contentLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i];

    // No tab can reach here -- assertNoControlChars refused the document before it was split.
    if (raw.trim() === "") continue;   // blank or whitespace-only: carries no structure
    if (/^ *#/.test(raw)) continue;    // whole-line comment

    if (/ $/.test(raw))
      fail("BAD_VENTURES_SYNTAX", lineNo, raw, "trailing whitespace after a value; an edit nobody can see must not be an edit this parser accepts");

    // A `#` STARTS A COMMENT ONLY WHEN WHITESPACE PRECEDES IT -- which is real YAML's rule, and is
    // here for a reason found by attacking the version that dropped it.
    //
    // That version truncated at the FIRST `#` anywhere, and defended the divergence from YAML with
    // "safe because no legal value can contain one". That reasons about a value that WANTS a hash.
    // The dangerous case is a value whose truncation leaves a DIFFERENT LEGAL VALUE:
    //
    //   days_without_revenue: 90#000      accepted as 90        (PyYAML reads the string "90#000")
    //   traffic_floor_monthly: 1#00000    accepted as 1         a floor of one visit a month
    //
    // Both passed INTEGER_RE, because the regex was applied AFTER the truncation, and both slipped
    // under MAX_CRITERION_VALUE -- the ceiling built precisely to catch trailing-zero slips -- for
    // the same reason. Every other YAML reader, and every editor's syntax highlighting, disagrees
    // with the parser about those bytes, so the file a human reviews is not the file this arms.
    const hash = raw.search(/(?:^|[ \t])#/);
    const code = (hash < 0 ? raw : raw.slice(0, hash)).replace(/ +$/, "");
    const indent = code.match(/^ */)[0].length;
    const trimmed = code.slice(indent);
    if (trimmed === "") continue; // a comment that began after only spaces

    refuseFeatures(LINE_FEATURES, trimmed, lineNo, raw);

    if (indent % 2 !== 0)
      fail("BAD_VENTURES_INDENT", lineNo, raw, `indented ${indent} spaces; every level is exactly 2`);
    const depth = indent / 2;
    if (depth > 3)
      fail("BAD_VENTURES_INDENT", lineNo, raw, "indented deeper than any parent allows; this document nests exactly 4 levels (ventures > venture > kill > criterion)");

    const colon = trimmed.indexOf(":");
    if (colon < 0)
      fail("BAD_VENTURES_SYNTAX", lineNo, raw, "every line is `key:` or `key: value`, and this one carries no colon");
    const key = trimmed.slice(0, colon);
    const rest = trimmed.slice(colon + 1);
    if (key === "")
      fail("BAD_VENTURES_SYNTAX", lineNo, raw, "the key is empty");
    // A POSITIVE test, never a negated character range. `tests/portability.bats` refuses any NEW
    // negated letter range in this tree, because a shell glob resolves one through the locale's
    // collation and this repo has been bitten by exactly that. A JS regex is code-point based and
    // would have been safe -- but the gate is a blanket grep and cannot know that, and arguing with
    // a portability gate one exception at a time is how the gate stops meaning anything. The
    // positive form is also what this lane already prefers for identifiers.
    //
    // THIS COMMENT IS PROSE ON PURPOSE. The first version of it QUOTED the offending form to
    // explain the fix, and the gate fired on the explanation -- it strips shell comments before
    // grepping and this is a .mjs file, so a `//` comment is scanned as code. That is the exact
    // recurrence CLAUDE.md records from Cycle 6, where a fix was reintroduced inside the comment
    // explaining the previous one. Reported rather than patched around: the gate's own comment says
    // "only code counts", and for .mjs files it currently counts comments too.
    if (!/^[A-Za-z0-9_-]+$/.test(key))
      fail("BAD_VENTURES_SYNTAX", lineNo, raw, `key ${JSON.stringify(key)} carries a character no key in this document can hold`);

    let value = null;
    if (rest !== "") {
      if (!rest.startsWith(" "))
        fail("BAD_VENTURES_SYNTAX", lineNo, raw, "a value must be separated from its key by a space, as `key: value`");
      value = rest.replace(/^ +/, "");
      refuseFeatures(VALUE_FEATURES, value, lineNo, raw);
      if (/^["']/.test(value))
        fail("BAD_VENTURES_VALUE", lineNo, raw, "a quoted number is not a number here; values are bare positive decimal integers");
    }

    if (depth === 0) {
      // Duplicate is checked before every other top-level rule: a second `version` is more honestly
      // reported as a duplicate than as an ordering violation.
      if (seenTopKeys.has(key))
        fail("DUPLICATE_VENTURES_KEY", lineNo, raw, `top-level key ${JSON.stringify(key)} appears twice`);
      if (key === "version") {
        if (contentLines > 0)
          fail("BAD_VENTURES_VERSION", lineNo, raw, "`version` must be the FIRST key in the document; a schema version that arrives after the data has been read decided nothing about how to read it");
        if (value === null)
          fail("BAD_VENTURES_VERSION", lineNo, raw, "`version` requires a value");
        if (value !== "1")
          fail("BAD_VENTURES_VERSION", lineNo, raw, "the only accepted version is the integer 1 (ADR-1008 v1)");
        version = 1;
      } else if (key === "ventures") {
        if (value !== null)
          fail("BAD_VENTURES_SYNTAX", lineNo, raw, "`ventures` is a mapping of venture names, never a scalar");
        sawVentures = true;
      } else {
        fail("UNKNOWN_VENTURES_FIELD", lineNo, raw, `unknown top-level key ${JSON.stringify(key)}; the top level holds exactly ${TOP_KEYS.join(" and ")}`);
      }
      seenTopKeys.add(key);
      current = null;
    } else if (depth === 1) {
      if (!sawVentures)
        fail("BAD_VENTURES_INDENT", lineNo, raw, "indented under nothing; a venture must sit under the `ventures:` key");
      assertVentureName(key, lineNo, raw);
      if (seenVentureNames.has(key))
        fail("DUPLICATE_VENTURES_KEY", lineNo, raw, `venture ${JSON.stringify(key)} is declared twice`);
      if (value !== null)
        fail("BAD_VENTURES_SYNTAX", lineNo, raw, "a venture is a mapping holding `kill:`, never a scalar");
      seenVentureNames.add(key);
      current = { name: key, line: lineNo, killLine: 0, seen: new Set(), values: Object.create(null) };
      records.push(current);
    } else if (depth === 2) {
      if (!current)
        fail("BAD_VENTURES_INDENT", lineNo, raw, "indented deeper than its parent allows; `kill:` must sit under a venture name");
      if (key !== "kill")
        fail("UNKNOWN_VENTURES_FIELD", lineNo, raw, `unknown key ${JSON.stringify(key)}; a venture holds exactly \`kill\` and nothing else`);
      if (current.killLine)
        fail("DUPLICATE_VENTURES_KEY", lineNo, raw, `venture ${JSON.stringify(current.name)} declares \`kill\` twice (first at line ${current.killLine})`);
      if (value !== null)
        fail("BAD_VENTURES_SYNTAX", lineNo, raw, "`kill` is a mapping holding the two criteria, never a scalar");
      current.killLine = lineNo;
    } else {
      if (!current || !current.killLine)
        fail("BAD_VENTURES_INDENT", lineNo, raw, "indented deeper than its parent allows; a criterion must sit under a `kill:` key");
      if (!KILL_CRITERIA.includes(key))
        fail("UNKNOWN_VENTURES_FIELD", lineNo, raw, `unknown criterion ${JSON.stringify(key)}; a kill block holds exactly ${KILL_CRITERIA.join(" and ")} (ADR-1008 v1)`);
      // NEVER last-wins. A duplicated `days_without_revenue` is precisely how a real threshold gets
      // shadowed by a fake one in a diff that reads as an addition.
      if (current.seen.has(key))
        fail("DUPLICATE_VENTURES_KEY", lineNo, raw, `venture ${JSON.stringify(current.name)} sets ${key} twice; the second value would shadow the first`);
      if (value === null)
        fail("BAD_VENTURES_VALUE", lineNo, raw, `${key} requires a value; a criterion with no number is not a criterion`);
      current.seen.add(key);
      current.values[key] = parseCriterion(key, value, lineNo, raw);
    }

    contentLines++;
  }

  if (version === null)
    throw new SpineError("BAD_VENTURES_VERSION", "ventures.yaml carries no `version` key; an unversioned criteria file cannot be read safely by a future parser (ADR-1008)");
  if (!sawVentures)
    throw new SpineError("MISSING_VENTURES_FIELD", "ventures.yaml carries no `ventures` key");
  if (records.length === 0)
    throw new SpineError("EMPTY_VENTURES", "`ventures:` holds no ventures; an empty map disables every kill switch at once and looks like a tidy file while doing it");

  for (const r of records) {
    if (!r.killLine)
      throw new SpineError("MISSING_VENTURES_FIELD", `ventures.yaml line ${r.line}: venture ${JSON.stringify(r.name)} declares no \`kill:\` block`);
    for (const k of KILL_CRITERIA)
      if (!r.seen.has(k))
        throw new SpineError("MISSING_VENTURES_FIELD", `ventures.yaml line ${r.killLine}: venture ${JSON.stringify(r.name)} is missing ${k}; BOTH criteria are required and an absent one is not a default`);
  }

  const ventures = Object.create(null);
  for (const r of records)
    ventures[r.name] = Object.freeze({
      kill: Object.freeze({
        days_without_revenue: r.values.days_without_revenue,
        traffic_floor_monthly: r.values.traffic_floor_monthly,
      }),
    });

  // Frozen: the digest is a claim about THESE values, and a caller that can mutate the object it
  // was handed can make that claim false without touching the file the receipt names.
  const parsed = { version, ventures: Object.freeze(ventures) };
  return Object.freeze({ ...parsed, digest: venturesDigest(parsed) });
}

// The exact string the digest is taken over. Exported so a test and the ADR-1008 receipt path
// derive it the same way instead of each re-deriving "canonical" from the same paragraph.
//
// Rebuilt key by key rather than copied, and re-validated: nothing outside the contract can reach
// the digest, whether it arrived from a hand-built object or from a later change to this parser.
export function canonicalVentures(parsed) {
  if (!isMap(parsed))
    throw new SpineError("BAD_VENTURES_SHAPE", `canonical form needs a parsed ventures object, got ${JSON.stringify(parsed)}`);
  for (const k of Object.keys(parsed))
    // `digest` is accepted and EXCLUDED, exactly as eventSha excludes `sha`: parseVentures returns
    // it, so callers hand that object straight back, and a digest that covered itself is a fixpoint.
    if (k !== "version" && k !== "ventures" && k !== "digest")
      throw new SpineError("UNKNOWN_VENTURES_FIELD", `unknown top-level key ${JSON.stringify(k)} in the parsed ventures object`);
  if (parsed.version !== 1)
    throw new SpineError("BAD_VENTURES_VERSION", `version ${JSON.stringify(parsed.version)} must be the integer 1 (ADR-1008 v1)`);
  if (!isMap(parsed.ventures))
    throw new SpineError("MISSING_VENTURES_FIELD", "the parsed object carries no `ventures` map");

  const names = Object.keys(parsed.ventures).sort();
  if (names.length === 0)
    throw new SpineError("EMPTY_VENTURES", "the parsed object holds zero ventures, which is every kill switch disabled");

  const ventures = Object.create(null);
  for (const name of names) {
    if (!VENTURE_NAME_RE.test(name) || RESERVED_DEVICE_NAMES.has(name))
      throw new SpineError("BAD_VENTURES_NAME", `venture name ${JSON.stringify(name)} is not a legal venture name`);
    const venture = parsed.ventures[name];
    if (!isMap(venture))
      throw new SpineError("BAD_VENTURES_SHAPE", `venture ${JSON.stringify(name)} must be a mapping`);
    for (const k of Object.keys(venture))
      if (k !== "kill")
        throw new SpineError("UNKNOWN_VENTURES_FIELD", `venture ${JSON.stringify(name)} carries unknown key ${JSON.stringify(k)}; a venture holds exactly \`kill\``);
    const kill = venture.kill;
    if (!isMap(kill))
      throw new SpineError("MISSING_VENTURES_FIELD", `venture ${JSON.stringify(name)} carries no \`kill\` block`);
    for (const k of Object.keys(kill))
      if (!KILL_CRITERIA.includes(k))
        throw new SpineError("UNKNOWN_VENTURES_FIELD", `venture ${JSON.stringify(name)} carries unknown criterion ${JSON.stringify(k)}`);
    const values = Object.create(null);
    for (const k of KILL_CRITERIA) {
      const v = kill[k];
      if (!Number.isInteger(v) || v < 1 || v > MAX_CRITERION_VALUE)
        throw new SpineError("BAD_VENTURES_VALUE", `venture ${JSON.stringify(name)} criterion ${k} ${JSON.stringify(v)} must be an integer in 1..${MAX_CRITERION_VALUE}`);
      values[k] = v;
    }
    ventures[name] = { kill: values };
  }

  // canonicalize() is the lane's ONE canonical form (ADR-0024): UTF-8, LF, keys sorted by UTF-16
  // code unit, no insignificant whitespace. Re-deriving a second sorted-JSON writer here is how two
  // digests of the same criteria end up disagreeing.
  return canonicalize({ version: 1, ventures });
}

// Lowercase sha256 hex via sha256Hex from canonical.mjs -- node:crypto, defined once for the lane.
export function venturesDigest(parsed) {
  return sha256Hex(canonicalVentures(parsed));
}
