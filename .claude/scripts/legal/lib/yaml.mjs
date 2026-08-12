/**
 * A deliberately SMALL YAML subset, and a named error for everything outside it.
 *
 * A facts file is hostile input (ADR-1002): it is edited in a hurry and interpolated into
 * sentences that carry legal meaning. A permissive parser is the wrong shape for that job,
 * because every construct it accepts quietly is a construct nobody wrote a rule for.
 *
 * ACCEPTED
 *   UTF-8; LF or CRLF; `#` comments outside quotes
 *   top-level mapping, 2-space indent, nesting depth <= 3
 *   block sequences (`- ` items)
 *   double-quoted strings, and bare tokens matching /^[A-Za-z0-9_@./:+-]+$/
 *
 * REFUSED, each with its own named code
 *   anchors, aliases, tags, merge keys, flow collections, multi-line and folded scalars,
 *   tabs in indentation, and a bare token with a leading zero -- the YAML 1.1 octal trap,
 *   where `030` reads as 24 on a parser that guesses.
 *
 * TYPING is explicit and narrow, because the canonicaliser downstream must never be handed
 * two values it cannot tell apart. A bare 1000 is a NUMBER; a quoted "1000" is a STRING;
 * they hash differently by construction (canonical.mjs), which is the collision `arc-evolve`
 * shipped on 2026-08-04.
 */

export class YamlError extends Error {
  constructor(code, line, message) {
    super(`${code} at line ${line}: ${message}`);
    this.code = code;
    this.line = line;
  }
}

const BARE = /^[A-Za-z0-9_@./:+-]+$/;
const INT = /^-?(0|[1-9][0-9]*)$/;
const OCTAL_TRAP = /^-?0[0-9]+$/;
const DATEISH = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DEPTH = 3;

// Strip a `#` comment, but only when the `#` is outside a double-quoted run. Doing this with
// a regex would eat a `#` inside a quoted value, and the address fields are exactly where a
// `#` legitimately appears.
function stripComment(raw, lineNo) {
  let out = "";
  let inQuote = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      // A backslash escape inside a quoted scalar is not part of this subset: it makes the
      // string's byte content depend on an unescaping step, and the denylist runs on rendered
      // bytes. Refuse it rather than support half of it.
      if (inQuote && raw[i - 1] === "\\") throw new YamlError("BACKSLASH_ESCAPE", lineNo, "backslash escapes are not part of this subset; remove it");
      inQuote = !inQuote;
      out += c;
      continue;
    }
    if (c === "#" && !inQuote) break;
    out += c;
  }
  if (inQuote) throw new YamlError("UNTERMINATED_QUOTE", lineNo, "a double quote is opened and never closed");
  return out.replace(/\s+$/, "");
}

function scalar(tok, lineNo) {
  if (tok.length >= 2 && tok[0] === '"' && tok[tok.length - 1] === '"') {
    const inner = tok.slice(1, -1);
    if (inner.includes('"')) throw new YamlError("EMBEDDED_QUOTE", lineNo, "a double quote inside a quoted scalar is not part of this subset");
    return inner; // always a STRING, whatever it looks like
  }
  if (tok.startsWith("&")) throw new YamlError("ANCHOR", lineNo, "anchors are not part of this subset");
  if (tok.startsWith("*")) throw new YamlError("ALIAS", lineNo, "aliases are not part of this subset");
  if (tok.startsWith("!")) throw new YamlError("TAG", lineNo, "tags are not part of this subset");
  if (tok === "|" || tok === ">" || tok === "|-" || tok === ">-")
    throw new YamlError("BLOCK_SCALAR", lineNo, "multi-line and folded scalars are not part of this subset");
  if (tok.startsWith("{") || tok.startsWith("["))
    throw new YamlError("FLOW_COLLECTION", lineNo, "flow collections are not part of this subset; use a block mapping or a `- ` sequence");
  if (tok === "true") return true;
  if (tok === "false") return false;
  if (tok === "null" || tok === "~") return null;
  if (OCTAL_TRAP.test(tok))
    throw new YamlError("LEADING_ZERO", lineNo, `"${tok}" has a leading zero. YAML 1.1 reads it as octal, so 030 becomes 24. Quote it to mean the text, or drop the zero to mean the number.`);
  if (INT.test(tok)) return Number(tok);
  if (DATEISH.test(tok)) return tok; // a date is carried as its ISO text, never as a Date object
  if (!BARE.test(tok))
    throw new YamlError("UNQUOTED_TEXT", lineNo, `"${tok.slice(0, 40)}" is not a bare token (letters, digits, and _ @ . / : + -). Anything with a space or punctuation must be double-quoted.`);
  return tok;
}

/**
 * Parse the subset. Returns a plain object of plain values -- no class instances, no Dates,
 * nothing the canonicaliser would have to special-case.
 */
export function parseFactsYaml(text) {
  // Both of these are built from escapes on purpose. A control byte or a BOM written
  // LITERALLY into a source file makes grep read the whole file as binary, and two later
  // patches then match nothing at all -- `arc-absorb` 2026-08-09, in the file that was
  // itself the guard against control characters. This file reproduced that defect on its
  // first draft, which is why the constants below are the only way it may be written.
  const NUL = "\u0000";
  const BOM = "\uFEFF";
  if (text.includes(NUL)) throw new YamlError("NUL_BYTE", 0, "the file contains a NUL byte");
  const lines = (text.startsWith(BOM) ? text.slice(1) : text).split(/\r?\n/);

  const root = {};
  // Each frame is { indent, container, kind } where kind is "map" or "seq".
  const stack = [{ indent: -1, container: root, kind: "map" }];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const rawLine = lines[i];
    if (/^\s*$/.test(rawLine)) continue;
    if (/^\s*#/.test(rawLine)) continue;

    const indentMatch = rawLine.match(/^[ \t]*/)[0];
    if (indentMatch.includes("\t"))
      throw new YamlError("TAB_INDENT", lineNo, "a tab is used for indentation; this subset is two-space indent only");
    const indent = indentMatch.length;
    if (indent % 2 !== 0)
      throw new YamlError("ODD_INDENT", lineNo, `indent is ${indent} spaces; this subset is two-space indent only`);

    const line = stripComment(rawLine.slice(indent), lineNo);
    if (line === "") continue;
    if (line.includes("<<:")) throw new YamlError("MERGE_KEY", lineNo, "merge keys are not part of this subset");

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const top = stack[stack.length - 1];
    if (stack.length > MAX_DEPTH + 1)
      throw new YamlError("TOO_DEEP", lineNo, `nesting is deeper than ${MAX_DEPTH} levels`);

    if (line.startsWith("- ") || line === "-") {
      if (top.kind !== "seq")
        throw new YamlError("UNEXPECTED_SEQUENCE", lineNo, "a `- ` item appears where a mapping key was expected");
      if (line === "-") throw new YamlError("EMPTY_SEQUENCE_ITEM", lineNo, "an empty `- ` item; this subset has no nested sequences");
      const itemTok = line.slice(2).trim();
      if (itemTok.includes(": ") || /:$/.test(itemTok))
        throw new YamlError("SEQUENCE_OF_MAPS", lineNo, "a sequence of mappings is not part of this subset");
      top.container.push(scalar(itemTok, lineNo));
      continue;
    }

    // Hyphens are allowed in keys because page ids carry them (`refund-cancellation`), and a
    // `routes:` mapping is keyed by page id. Without this the route map could not be written.
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*))?$/);
    if (!m)
      throw new YamlError("BAD_KEY", lineNo, `"${line.slice(0, 40)}" is not \`key: value\` or \`key:\` (keys are letters, digits, underscore and hyphen, starting with a letter or underscore)`);
    const [, key, rest] = m;

    if (top.kind !== "map")
      throw new YamlError("UNEXPECTED_KEY", lineNo, `key "${key}" appears inside a sequence`);
    if (Object.prototype.hasOwnProperty.call(top.container, key))
      throw new YamlError("DUPLICATE_KEY", lineNo, `key "${key}" is set twice in the same mapping; the second would silently win`);
    // A key that would collide with an inherited Object property is refused rather than
    // written: `__proto__: x` on a plain object is a prototype write, not a data write.
    if (key === "__proto__" || key === "constructor" || key === "prototype")
      throw new YamlError("RESERVED_KEY", lineNo, `key "${key}" is reserved`);

    if (rest === undefined || rest === "") {
      // A block follows. Which kind it is, is decided by the NEXT content line.
      let j = i + 1;
      while (j < lines.length && (/^\s*$/.test(lines[j]) || /^\s*#/.test(lines[j]))) j++;
      if (j >= lines.length) {
        top.container[key] = null;
        continue;
      }
      const nextIndent = lines[j].match(/^[ \t]*/)[0].length;
      if (nextIndent <= indent) {
        top.container[key] = null;
        continue;
      }
      const nextBody = lines[j].slice(nextIndent);
      if (nextBody.startsWith("- ")) {
        const arr = [];
        top.container[key] = arr;
        stack.push({ indent, container: arr, kind: "seq" });
      } else {
        const obj = {};
        top.container[key] = obj;
        stack.push({ indent, container: obj, kind: "map" });
      }
      continue;
    }

    top.container[key] = scalar(rest.trim(), lineNo);
  }

  return root;
}
