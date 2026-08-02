#!/usr/bin/env node
/**
 * yaml-subset.mjs -- the ADR-0200 frozen YAML subset parser.
 *
 * arc core is zero-dep and Node's stdlib has no YAML parser, so choosing YAML for the
 * canonical process format means writing one. The honest containment for that cost is a
 * subset that is SMALL and FROZEN, where every excluded construct is a loud error naming
 * the construct and the line -- never a silent skip. A subset that degrades quietly is a
 * subset that lies about what it read.
 *
 * ACCEPTED: block mappings · block sequences · plain / single- / double-quoted scalars ·
 *           block scalars (| |- > >-) · # comments · exactly one document per file.
 * REJECTED, by name: anchors/aliases (&/*) · tags (!!) · flow collections ({} / []) ·
 *           a second --- document · merge keys (<<) · tab indentation · CR bytes.
 *
 * Two error classes, because they answer different questions:
 *   [yaml-parse]    the bytes are not this grammar at all (indent, CRLF, dup key, ...)
 *   [yaml-excluded] the bytes ARE valid YAML, but name a construct this subset excludes
 * The split matters: "you wrote something wrong" and "you wrote something we deliberately
 * do not support" need different fixes, and one message cannot carry both.
 *
 * Zero dependencies, Node 18+.
 */

// A construct is excluded by a RULE, not by a regex scattered through the parser, so the
// exclusion list is readable as data and the error message is derived from the same row
// that decides. Order matters only for which message wins on a line naming two of them.
export const EXCLUSIONS = Object.freeze([
  {
    name: "anchor",
    // `&name` / `*name` in VALUE position. Anchored to a value boundary so that a plain
    // scalar merely CONTAINING an ampersand ("Tom & Jerry") is not a false positive --
    // the failure that would make the subset unusable for prose.
    test: (v) => /(^|\s)[&*][A-Za-z0-9_][^\s]*\s*$/.test(v) || /(^|\s)[&*][A-Za-z0-9_][^\s]*\s/.test(v),
    say: "an anchor or alias (`&name` / `*name`)",
  },
  {
    name: "tag",
    test: (v) => /(^|\s)!!?[A-Za-z][A-Za-z0-9_:/-]*/.test(v),
    say: "a tag (`!!type`)",
  },
  {
    name: "flow-collection",
    // The EMPTY literals `[]` and `{}` are permitted; every other flow collection is not.
    // This is ADR-0200's first (and only) subset amendment, taken under its own revisit
    // trigger. The exclusion exists so the parser never implements flow-style parsing --
    // and `[]`/`{}` need no parsing at all: they are terminal tokens with no nesting, no
    // separators and no ambiguity. `inputs: []` is also the clearest way a human reads
    // "this process takes no inputs"; a bare `inputs:` parsing to null says the same thing
    // far less legibly, and the lint would have to treat absence and emptiness alike anyway.
    test: (v) => /^[[{]/.test(v.trim()) && !/^(\[\s*\]|\{\s*\})$/.test(v.trim()),
    say: "a non-empty flow collection (`{...}` / `[...]`)",
  },
]);

const TAB_RE = /^[ ]*\t/;

class YamlError extends Error {
  constructor(check, line, what, expected, found, example) {
    super(what);
    Object.assign(this, { check, line, what, expected, found, example });
  }
}

const err = (check, line, what, expected, found, example) => {
  throw new YamlError(check, line, what, expected, found, example);
};

// ---------- lexing ----------

/**
 * Split into logical lines, carrying the 1-based source line number so every error can
 * point at a real place in a real file. Blank and comment-only lines are dropped HERE and
 * never reach the parser -- except inside a block scalar, which is captured raw by the
 * parser itself and never sees this function's output.
 */
function lex(text) {
  if (text.includes("\r")) {
    const n = text.slice(0, text.indexOf("\r")).split("\n").length;
    err(
      "yaml-parse",
      n,
      "CR byte found -- this file is CRLF or has mixed line endings",
      "LF line endings only",
      "a \\r byte",
      "run `dos2unix` on the file, or configure the editor to write LF",
    );
  }
  const out = [];
  const raw = text.split("\n");
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    const n = i + 1;
    if (TAB_RE.test(line)) {
      err(
        "yaml-parse",
        n,
        "tab character used for indentation",
        "spaces only",
        "a tab in the indent",
        "indent with 2 spaces per level",
      );
    }
    if (!line.trim()) continue;
    if (/^\s*#/.test(line)) continue;
    const indent = line.length - line.replace(/^ +/, "").length;
    out.push({ n, indent, text: line.slice(indent), raw: line });
  }
  return { logical: out, raw };
}

/**
 * Strip a trailing `# comment` from a value, respecting quotes. Done by scan rather than
 * regex because a `#` inside a quoted scalar is DATA -- `pattern: "^#[0-9]{6}$"` is a
 * legitimate value and a regex-stripped version of it silently loses half the pattern.
 */
function stripComment(v) {
  let q = null;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (q) {
      if (c === "\\" && q === '"') { i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === "#" && (i === 0 || /\s/.test(v[i - 1]))) return v.slice(0, i).trimEnd();
  }
  return v.trimEnd();
}

function checkExclusions(value, n) {
  for (const rule of EXCLUSIONS) {
    if (rule.test(value)) {
      err(
        "yaml-excluded",
        n,
        `${rule.say} is outside the frozen YAML subset (ADR-0200)`,
        "block mappings, block sequences, scalars and block scalars only",
        value.length > 60 ? `${value.slice(0, 57)}...` : value,
        "rewrite the value without it -- the subset is deliberately small",
      );
    }
  }
}

/** Parse a scalar value into a JS value. Quoted stays string; plain is coerced. */
function scalar(v, n) {
  const t = v.trim();
  if (t === "") return "";
  if (t[0] === '"') {
    if (t.length < 2 || t[t.length - 1] !== '"') {
      err("yaml-parse", n, "unterminated double-quoted scalar", 'a closing `"`', t, 'key: "value"');
    }
    return t.slice(1, -1).replace(/\\(.)/g, (_, c) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
  }
  if (t[0] === "'") {
    if (t.length < 2 || t[t.length - 1] !== "'") {
      err("yaml-parse", n, "unterminated single-quoted scalar", "a closing `'`", t, "key: 'value'");
    }
    return t.slice(1, -1).replace(/''/g, "'");
  }
  checkExclusions(t, n);
  // The two permitted empty flow literals (ADR-0200's amendment) yield real empty
  // collections, not the strings "[]" / "{}" -- a consumer that has to string-compare an
  // empty list is a consumer that will eventually forget to.
  if (/^\[\s*\]$/.test(t)) return [];
  if (/^\{\s*\}$/.test(t)) return {};
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null" || t === "~") return null;
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d*\.\d+$/.test(t)) return Number(t);
  return t;
}

// ---------- parsing ----------

/**
 * Recursive-descent over the logical lines. `raw` is passed through so block scalars can
 * be captured verbatim from the ORIGINAL text -- a block scalar's content must survive
 * comment-stripping and blank-line removal untouched, since it holds the pilots' prose.
 */
function parseBlock(ctx, indent) {
  const { logical } = ctx;
  if (ctx.i >= logical.length) return null;
  const first = logical[ctx.i];
  if (first.text.startsWith("- ") || first.text === "-") return parseSeq(ctx, indent);
  return parseMap(ctx, indent);
}

function parseSeq(ctx, indent) {
  const { logical } = ctx;
  const out = [];
  while (ctx.i < logical.length) {
    const line = logical[ctx.i];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      err(
        "yaml-parse",
        line.n,
        "unexpected indentation inside a sequence",
        `indent ${indent}`,
        `indent ${line.indent}`,
        "align every `-` of one sequence to the same column",
      );
    }
    if (!(line.text.startsWith("- ") || line.text === "-")) break;
    const rest = line.text === "-" ? "" : line.text.slice(2);
    ctx.i++;
    if (rest.trim() === "") {
      const child = ctx.i < logical.length && logical[ctx.i].indent > indent ? parseBlock(ctx, logical[ctx.i].indent) : null;
      out.push(child);
      continue;
    }
    // `- key: value` opens a mapping whose first key sits on the dash line. Re-feed it as
    // a mapping line at the virtual indent just past the dash.
    if (/^[A-Za-z0-9_.-]+\s*:(\s|$)/.test(rest)) {
      const virt = indent + 2;
      logical.splice(ctx.i, 0, { n: line.n, indent: virt, text: rest, raw: line.raw });
      out.push(parseMap(ctx, virt));
      continue;
    }
    checkExclusions(rest, line.n);
    out.push(scalar(stripComment(rest), line.n));
  }
  return out;
}

function parseMap(ctx, indent) {
  const { logical } = ctx;
  const out = {};
  const seen = new Map();
  while (ctx.i < logical.length) {
    const line = logical[ctx.i];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      err(
        "yaml-parse",
        line.n,
        "unexpected indentation inside a mapping",
        `indent ${indent}`,
        `indent ${line.indent}`,
        "align every key of one mapping to the same column",
      );
    }
    if (line.text.startsWith("- ")) break;
    if (line.text.trim() === "---") {
      err(
        "yaml-excluded",
        line.n,
        "a second `---` document is outside the frozen YAML subset (ADR-0200)",
        "exactly one document per file",
        "---",
        "split the documents into separate files",
      );
    }

    const m = line.text.match(/^([^:]+):(?:\s+(.*))?$/);
    if (!m) {
      err(
        "yaml-parse",
        line.n,
        "line is not `key: value` and not a sequence item",
        "`key: value`, `key:` or `- item`",
        line.text.length > 60 ? `${line.text.slice(0, 57)}...` : line.text,
        "name: commit-msg-draft",
      );
    }
    const key = m[1].trim();
    if (key === "<<") {
      err(
        "yaml-excluded",
        line.n,
        "a merge key (`<<`) is outside the frozen YAML subset (ADR-0200)",
        "explicit keys only",
        "<<",
        "write the merged keys out in full",
      );
    }
    if (/^[&*!]/.test(key)) checkExclusions(key, line.n);
    if (seen.has(key)) {
      err(
        "yaml-parse",
        line.n,
        `duplicate key \`${key}\` in one mapping`,
        "each key once per mapping",
        `\`${key}\` first seen on line ${seen.get(key)}`,
        "remove or rename the second occurrence",
      );
    }
    seen.set(key, line.n);
    const rest = (m[2] ?? "").trim();
    ctx.i++;

    // Block scalar: capture from the RAW text, verbatim.
    const bs = rest.match(/^([|>])([-+]?)$/);
    if (bs) {
      // The key line's RAW index, not the next logical line's: the lexer drops blank lines,
      // and a block scalar whose body opens with one would silently lose it. Every pilot
      // body does open with one (the blank line after the frontmatter's closing `---`), so
      // this is not a hypothetical -- it is a one-byte round-trip failure on all three.
      out[key] = readBlockScalar(ctx, indent, bs[1], bs[2], line.n - 1);
      continue;
    }
    if (rest === "") {
      if (ctx.i < logical.length && logical[ctx.i].indent > indent) {
        out[key] = parseBlock(ctx, logical[ctx.i].indent);
      } else {
        out[key] = null;
      }
      continue;
    }
    checkExclusions(rest, line.n);
    out[key] = scalar(stripComment(rest), line.n);
  }
  return out;
}

/**
 * Read a block scalar's body straight out of the original lines. Indentation is set by the
 * first non-blank body line; blank lines inside the block are preserved. This is the one
 * place the parser reads `raw` rather than the lexed view, because the pilots' prose lives
 * here and comment-stripping it would corrupt the very bytes REQ-02 must reproduce.
 */
function readBlockScalar(ctx, keyIndent, style, chomp, keyRawIdx) {
  const { raw } = ctx;
  let blockIndent = null;
  const body = [];
  let r = keyRawIdx + 1;

  while (r < raw.length) {
    const line = raw[r];
    if (!line.trim()) { body.push(""); r++; continue; }
    const ind = line.length - line.replace(/^ +/, "").length;
    if (ind <= keyIndent) break;
    if (blockIndent === null) blockIndent = ind;
    if (ind < blockIndent) break;
    body.push(line.slice(blockIndent));
    r++;
  }
  while (body.length && body[body.length - 1] === "") body.pop();

  // Re-sync the logical cursor past everything the block consumed.
  while (ctx.i < ctx.logical.length && ctx.logical[ctx.i].n - 1 < r) ctx.i++;

  let text = style === ">" ? foldLines(body) : body.join("\n");
  if (chomp !== "-") text += "\n";
  return text;
}

function foldLines(body) {
  const out = [];
  let buf = [];
  for (const line of body) {
    if (line === "") { out.push(buf.join(" ")); buf = []; out.push(""); continue; }
    if (/^\s/.test(line)) { if (buf.length) { out.push(buf.join(" ")); buf = []; } out.push(line); continue; }
    buf.push(line.trim());
  }
  if (buf.length) out.push(buf.join(" "));
  return out.filter((l, idx, a) => !(l === "" && a[idx - 1] === "")).join("\n");
}

// ---------- entry point ----------

/**
 * Parse one document. Returns `{ ok: true, value }` or `{ ok: false, error }` -- never
 * throws at the boundary, because the lint wants to report a parse failure the same way it
 * reports every other finding, not crash with a stack trace at an operator.
 */
export function parseYamlSubset(text) {
  try {
    // Document markers are detected DURING parsing, never by pre-splitting the text. A
    // `---` line inside a `body:` block scalar is prose -- the pilots' bodies are markdown
    // and a horizontal rule is legal markdown -- and a textual pre-split would silently cut
    // the document in half at that line. The parser reaches `---` only where it is
    // structural, because readBlockScalar has already consumed everything inside a block.
    // Today no pilot body contains one; that is a snapshot, not a rule, and a parser that
    // is correct only for today's inputs is the failure retro-log 2026-08-02 records.
    const { logical, raw } = lex(text);
    if (!logical.length) {
      err("yaml-parse", 1, "file is empty or contains only comments", "a mapping", "nothing", "name: my-process");
    }
    // A single leading `---` opens the document and is legal YAML; drop it.
    const start = logical[0].text.trim() === "---" && logical[0].indent === 0 ? 1 : 0;
    if (start && logical.length === 1) {
      err("yaml-parse", 1, "file has a document marker but no content", "a mapping", "---", "name: my-process");
    }
    const ctx = { logical, raw, i: start };
    const value = parseBlock(ctx, logical[start].indent);
    if (ctx.i < logical.length) {
      const l = logical[ctx.i];
      if (l.text.trim() === "---") {
        err("yaml-excluded", l.n, "a second `---` document is outside the frozen YAML subset (ADR-0200)", "exactly one document per file", "---", "split the documents into separate files");
      }
      err(
        "yaml-parse",
        l.n,
        "trailing content after the document's root mapping",
        "one root mapping",
        l.text.slice(0, 57),
        "check the indentation of this line",
      );
    }
    return { ok: true, value };
  } catch (e) {
    if (e instanceof YamlError) return { ok: false, error: e };
    return {
      ok: false,
      error: new YamlError("yaml-parse", 1, `parser crashed: ${e.message}`, "parseable YAML", "an internal error", "report this file as a parser bug"),
    };
  }
}
