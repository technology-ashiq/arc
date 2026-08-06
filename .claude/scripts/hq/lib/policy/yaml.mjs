/**
 * A deliberately NARROW YAML subset parser for hq.policy.yaml (ADR-0500, phase 00).
 *
 * Zero dependencies (A2). Everything outside the subset is a parse error, which is both the
 * cheap answer and the security-correct one: a policy file is read by a machine that must not
 * be creative about what it was told.
 *
 * THE ONE THING THIS FILE EXISTS TO GET RIGHT: duplicate keys are INSIDE the subset, not
 * outside it, so "everything outside the subset is an error" does NOT catch them for free. A
 * parser written the obvious way -- assign into a plain object as lines are read -- lets the
 * last occurrence win by ordinary JS semantics. For this schema that is a live escalation path:
 * a second, more permissive `write:` block for the same kind silently overrides an earlier,
 * stricter one, with no error anywhere. So every mapping tracks its own seen-keys set and
 * throws BEFORE the second value is assigned.
 *
 * Supported: block mappings (2-space indent), block sequences, flow mappings/sequences on one
 * line, double-quoted and bare scalars, integers and decimals, `#` comments outside quotes.
 * Not supported, on purpose: anchors, aliases, tags, multi-line scalars, single quotes,
 * multi-document streams, tabs for indentation.
 */

export class PolicyParseError extends Error {
  constructor(message, line) {
    super(line == null ? message : `${message} (line ${line})`);
    this.name = "PolicyParseError";
    this.code = "BAD_POLICY_YAML";
    this.line = line ?? null;
  }
}

const fail = (msg, line) => {
  throw new PolicyParseError(msg, line);
};

/** Strip a trailing `#` comment, respecting double-quoted spans. */
function stripComment(raw) {
  let inQuote = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"' && raw[i - 1] !== "\\") inQuote = !inQuote;
    else if (c === "#" && !inQuote && (i === 0 || /\s/.test(raw[i - 1]))) return raw.slice(0, i);
  }
  return raw;
}

/** Scalars: "quoted" | 123 | -1 | 1.5 | true | false | null | bare-token. */
function scalar(text, line) {
  const t = text.trim();
  if (t === "") fail("empty value where a scalar was expected", line);
  if (t.startsWith('"')) {
    if (!t.endsWith('"') || t.length < 2) fail(`unterminated quoted scalar ${t}`, line);
    const body = t.slice(1, -1);
    if (/(^|[^\\])"/.test(body)) fail("a quoted scalar may not contain an unescaped quote", line);
    return body.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (t.startsWith("'")) fail("single-quoted scalars are outside the supported subset -- use double quotes", line);
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null" || t === "~") return null;
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d*\.\d+$/.test(t)) return Number(t);
  if (/^[A-Za-z0-9_.:/@*-]+$/.test(t)) return t;
  fail(`scalar ${JSON.stringify(t)} is outside the supported subset`, line);
}

/**
 * Split a flow body on top-level commas, respecting nesting and quotes. Written by hand rather
 * than by regex because a regex that "mostly" splits a flow collection is how a grant with an
 * embedded comma silently becomes two grants.
 */
function splitFlow(body, line) {
  const parts = [];
  let depth = 0;
  let inQuote = false;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' && body[i - 1] !== "\\") inQuote = !inQuote;
    else if (!inQuote && (c === "{" || c === "[")) depth++;
    else if (!inQuote && (c === "}" || c === "]")) depth--;
    else if (!inQuote && c === "," && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
    if (depth < 0) fail("unbalanced bracket in a flow collection", line);
  }
  if (inQuote) fail("unterminated quote in a flow collection", line);
  if (depth !== 0) fail("unbalanced bracket in a flow collection", line);
  const tail = body.slice(start);
  if (tail.trim() !== "" || parts.length > 0) parts.push(tail);
  return parts;
}

function flowValue(text, line) {
  const t = text.trim();
  if (t.startsWith("[")) {
    if (!t.endsWith("]")) fail("unterminated flow sequence", line);
    const body = t.slice(1, -1).trim();
    if (body === "") return [];
    return splitFlow(body, line).map((p) => flowValue(p, line));
  }
  if (t.startsWith("{")) {
    if (!t.endsWith("}")) fail("unterminated flow mapping", line);
    const body = t.slice(1, -1).trim();
    const out = {};
    if (body === "") return out;
    const seen = new Set();
    for (const part of splitFlow(body, line)) {
      const idx = splitKey(part, line);
      const key = String(scalar(part.slice(0, idx), line));
      if (seen.has(key)) fail(`duplicate key ${JSON.stringify(key)} in one flow mapping`, line);
      seen.add(key);
      out[key] = flowValue(part.slice(idx + 1), line);
    }
    return out;
  }
  return scalar(t, line);
}

/** Index of the `:` that separates key from value, ignoring quoted spans and nesting. */
function splitKey(text, line) {
  let inQuote = false;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i - 1] !== "\\") inQuote = !inQuote;
    else if (!inQuote && (c === "{" || c === "[")) depth++;
    else if (!inQuote && (c === "}" || c === "]")) depth--;
    else if (c === ":" && !inQuote && depth === 0) {
      const next = text[i + 1];
      if (next === undefined || next === " ") return i;
    }
  }
  fail(`no key separator in ${JSON.stringify(text.trim())}`, line);
}

/** Parse `text` into a plain object. Throws PolicyParseError on anything outside the subset. */
export function parsePolicyYaml(text) {
  if (typeof text !== "string") fail("policy source must be a string");
  if (text.includes("\t")) fail("tabs are not valid indentation in this subset");
  const lines = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const body = stripComment(raw);
    if (body.trim() === "") return;
    const indent = body.length - body.replace(/^ +/, "").length;
    if (indent % 2 !== 0) fail(`indentation must be a multiple of 2 spaces`, i + 1);
    lines.push({ indent, text: body.trim(), line: i + 1 });
  });
  if (lines.length === 0) return {};

  let pos = 0;

  function parseBlock(indent) {
    // A block is a sequence if its first line starts with "- ", otherwise a mapping.
    if (lines[pos].text.startsWith("- ") || lines[pos].text === "-") return parseSeq(indent);
    return parseMap(indent);
  }

  function parseSeq(indent) {
    const out = [];
    while (pos < lines.length && lines[pos].indent === indent) {
      const cur = lines[pos];
      if (!cur.text.startsWith("- ") && cur.text !== "-") break;
      const rest = cur.text === "-" ? "" : cur.text.slice(2).trim();
      pos++;
      if (rest === "") {
        if (pos < lines.length && lines[pos].indent > indent) out.push(parseBlock(lines[pos].indent));
        else fail("a sequence entry has no value", cur.line);
      } else {
        out.push(flowValue(rest, cur.line));
      }
    }
    return out;
  }

  function parseMap(indent) {
    const out = {};
    const seen = new Set();
    while (pos < lines.length && lines[pos].indent === indent) {
      const cur = lines[pos];
      if (cur.text.startsWith("- ")) fail("a sequence entry where a mapping key was expected", cur.line);
      const idx = splitKey(cur.text, cur.line);
      const key = String(scalar(cur.text.slice(0, idx), cur.line));
      // Reject BEFORE assigning: the second value must never reach the object, because the
      // whole risk is a more permissive grant quietly replacing a stricter one.
      if (seen.has(key)) fail(`duplicate key ${JSON.stringify(key)} in one mapping`, cur.line);
      seen.add(key);
      const rest = cur.text.slice(idx + 1).trim();
      pos++;
      if (rest !== "") {
        out[key] = flowValue(rest, cur.line);
        continue;
      }
      if (pos < lines.length && lines[pos].indent > indent) out[key] = parseBlock(lines[pos].indent);
      else out[key] = null;
    }
    if (pos < lines.length && lines[pos].indent > indent)
      fail("unexpected deeper indentation", lines[pos].line);
    return out;
  }

  const doc = parseBlock(lines[0].indent);
  if (pos !== lines.length) fail("trailing content after the document", lines[pos].line);
  return doc;
}
