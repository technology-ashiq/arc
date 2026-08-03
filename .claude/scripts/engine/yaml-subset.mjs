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
 *           block scalars (| |- > >-) · # comments · one document · the empty flow
 *           literals `[]` and `{}` (ADR-0200's one amendment).
 * REJECTED BY NAME: anchors/aliases · tags · non-empty flow collections · a second `---` ·
 *           merge keys · directives · explicit-key `?` · tab or exotic-whitespace indent ·
 *           CR bytes · block-scalar `+` chomping and explicit indentation indicators.
 *
 * REBUILT after the mandatory fresh-agent adversarial pass. Three unanchored agents found
 * ~40 holes in a version whose own 36 author-written fixtures all passed first try. The
 * structural lesson, worth more than any single fix: exclusions were tested on ONE axis --
 * "excluded construct, spelled the obvious way, in value position after `key: `" -- so
 * every hole lay off that axis. Two consequences are designed in now:
 *
 *   1. Exclusions are decided on STRUCTURE (does this logical line open a flow collection,
 *      in key or value position?) rather than on a regex over `m[2]`. `{x-claude: v}` on its
 *      own line used to parse to a key literally named `{x-claude`, which walked straight
 *      past the ADR-0205 passthrough gate while every real YAML reader saw the forbidden
 *      key -- the file smuggled the escape hatch through the check that exists to forbid it.
 *   2. Comments are stripped ONCE, in the lexer, before any structural decision. Running
 *      exclusions over raw still-quoted still-commented text meant `intent: "rebase onto
 *      *main*"` and `permissions: declared # see &base` were both rejected as anchors, and
 *      `inputs: # the declared inputs` broke the file outright.
 *
 * Zero dependencies, Node 18+.
 */

const MAX_DEPTH = 64;

class YamlError extends Error {
  constructor(check, line, what, expected, found, example) {
    super(what);
    Object.assign(this, { check, line, what, expected, found, example });
  }
}
const err = (check, line, what, expected, found, example) => {
  throw new YamlError(check, line, what, expected, found, example);
};
const excluded = (line, say, found, example) =>
  err("yaml-excluded", line, `${say} is outside the frozen YAML subset (ADR-0200)`,
    "block mappings, block sequences, scalars and block scalars only", found, example);

// ---------- lexing ----------

/**
 * Strip a trailing `# comment`, respecting quotes. Quote state opens only when the value
 * STARTS with a quote: a bare apostrophe inside a plain scalar is an apostrophe, and
 * treating it as an opening quote made `note: draft the user's message # TODO` keep its
 * comment forever.
 */
export function stripComment(v) {
  const t = v.trimStart();
  const lead = v.length - t.length;
  const q = t[0] === '"' || t[0] === "'" ? t[0] : null;
  if (q) {
    for (let i = 1; i < t.length; i++) {
      if (q === '"' && t[i] === "\\") { i++; continue; }
      if (t[i] === q) {
        if (q === "'" && t[i + 1] === "'") { i++; continue; }
        const rest = t.slice(i + 1);
        const h = rest.indexOf("#");
        return v.slice(0, lead) + (h < 0 ? t : t.slice(0, i + 1 + h)).trimEnd();
      }
    }
    return v.trimEnd(); // unterminated; scalar() reports it
  }
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "#" && (i === 0 || /\s/.test(t[i - 1]))) return (v.slice(0, lead) + t.slice(0, i)).trimEnd();
  }
  return v.trimEnd();
}

function lex(text) {
  if (text.includes("\r")) {
    const n = text.slice(0, text.indexOf("\r")).split("\n").length;
    err("yaml-parse", n, "CR byte found -- this file is CRLF or has mixed line endings",
      "LF line endings only", "a \\r byte", "run `dos2unix` on the file, or write LF");
  }
  const out = [];
  const raw = text.split("\n");
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    const n = i + 1;
    if (!line.trim()) continue;
    if (/^[ \t \f\v]*#/.test(line)) continue;
    const m = line.match(/^[ \t \f\v]*/)[0];
    const indent = m.length;
    // Tab and its invisible cousins are recorded, not thrown: they are illegal only in
    // STRUCTURAL indentation, and the parser sees structural lines only. Throwing in the
    // lexer made a tab anywhere inside a `body:` unauthorable -- and bodies are markdown,
    // where a fenced Makefile or TSV snippet is ordinary content, not indentation.
    // NBSP/FF/VT matter for a different reason: they are invisible, they are what a
    // copy-paste actually produces, and counting them as zero indent silently reparented
    // a nested key into a root sibling.
    const badWs = /[\t]/.test(m) ? "a tab" : /[ ]/.test(m) ? "a non-breaking space" : /[\f\v]/.test(m) ? "a form-feed or vertical-tab" : null;
    const body = line.slice(indent);
    out.push({ n, indent, text: body, content: stripComment(body), badWs, raw: line });
  }
  return { logical: out, raw };
}

// ---------- exclusion checks ----------

// Anchor/alias names admit `.`, `-`, `/`, `$` and non-ASCII letters, so requiring
// [A-Za-z0-9_] after the sigil let `&.d` / `*ベース` through -- and js-yaml resolved those
// same bytes to a DIFFERENT document with no error from either parser.
const ANCHOR_RE = /(^|\s)[&*][^\s,\[\]{}]+(\s|$)/;
const TAG_RE = /(^|\s)!(!|<|%)?[^\s]*/;

function checkValueExclusions(v, n) {
  const t = v.trim();
  if (t === "") return;
  if (ANCHOR_RE.test(t)) excluded(n, "an anchor or alias (`&name` / `*name`)", t.slice(0, 60), "rewrite the value without it");
  if (TAG_RE.test(t)) excluded(n, "a tag (`!type`)", t.slice(0, 60), "rewrite the value without it");
}

/** Structural flow detection: a logical line that OPENS a flow collection, anywhere. */
function checkFlow(content, n) {
  const t = content.trim();
  if (!/^[[{]/.test(t)) return;
  if (/^(\[\s*\]|\{\s*\})$/.test(t)) return; // the permitted empty literals
  excluded(n, "a non-empty flow collection (`{...}` / `[...]`)", t.slice(0, 60),
    "use block style -- flow style is not parsed, so it would be read as a differently-shaped document");
}

/** Parse a scalar. Quoted values are DATA and never see the exclusion rules. */
function scalar(v, n) {
  const t = v.trim();
  if (t === "") return "";
  if (t[0] === '"') {
    let closed = -1;
    for (let i = 1; i < t.length; i++) {
      if (t[i] === "\\") { i++; continue; }
      if (t[i] === '"') { closed = i; break; }
    }
    if (closed !== t.length - 1) {
      err("yaml-parse", n, "unterminated double-quoted scalar", 'a closing `"`', t.slice(0, 60), 'key: "value"');
    }
    return t.slice(1, -1).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (whole, c) => {
      if (c[0] === "u") return String.fromCharCode(parseInt(c.slice(1), 16));
      if (c[0] === "x") return String.fromCharCode(parseInt(c.slice(1), 16));
      if (c === "n") return "\n";
      if (c === "t") return "\t";
      if (c === "r") return "\r";
      if (c === "0") return "\0";
      if (c === "\\" || c === '"' || c === "/") return c;
      // Every other escape used to lose just its backslash, so `"café"` became
      // `cafu00e9` -- silent corruption in a format whose whole job is byte fidelity.
      err("yaml-parse", n, `unsupported escape \`\\${c}\` in a double-quoted scalar`,
        "\\n \\t \\r \\0 \\\\ \\\" \\/ \\uXXXX \\xXX", whole, "use a supported escape");
      return c;
    });
  }
  if (t[0] === "'") {
    let closed = -1;
    for (let i = 1; i < t.length; i++) {
      if (t[i] === "'") { if (t[i + 1] === "'") { i++; continue; } closed = i; break; }
    }
    if (closed !== t.length - 1) {
      err("yaml-parse", n, "unterminated single-quoted scalar", "a closing `'`", t.slice(0, 60), "key: 'value'");
    }
    return t.slice(1, -1).replace(/''/g, "'");
  }
  checkValueExclusions(t, n);
  if (/^\[\s*\]$/.test(t)) return [];
  if (/^\{\s*\}$/.test(t)) return {};
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null" || t === "~") return null;
  // Numeric coercion, but never for a leading-zero digit run: `commit: 0123456` became the
  // number 123456 and the lint then reported "baseline.commit is missing" on a correct
  // file. Roughly 3.7% of 7-char short SHAs are all digits.
  if (/^-?[1-9]\d*$/.test(t) || t === "0") return Number(t);
  if (/^-?\d*\.\d+$/.test(t)) return Number(t);
  return t;
}

// ---------- parsing ----------

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function guardStructural(line) {
  if (line.badWs) {
    err("yaml-parse", line.n, `${line.badWs} used for indentation`, "ASCII spaces only",
      line.badWs, "indent with 2 spaces per level");
  }
  const t = line.content.trim();
  if (t === "---") excluded(line.n, "a second `---` document", "---", "split the documents into separate files");
  if (t === "...") excluded(line.n, "a `...` document-end marker", "...", "remove it");
  if (t.startsWith("%")) excluded(line.n, "a directive (`%YAML` / `%TAG`)", t.slice(0, 40), "remove it");
  if (t === "?" || t.startsWith("? ")) excluded(line.n, "an explicit key (`?`)", t.slice(0, 40), "use `key: value`");
  if (t === "<<" || t.startsWith("<<:")) excluded(line.n, "a merge key (`<<`)", t.slice(0, 40), "write the merged keys out in full");
  checkFlow(line.content, line.n);
}

function parseBlock(ctx, indent, depth) {
  if (depth > MAX_DEPTH) {
    err("yaml-parse", ctx.logical[Math.min(ctx.i, ctx.logical.length - 1)]?.n ?? 1,
      `nesting deeper than ${MAX_DEPTH} levels`, `at most ${MAX_DEPTH} levels`, "deeper nesting",
      "a canonical process is a flat document -- this depth is a malformed or hostile file");
  }
  const { logical } = ctx;
  if (ctx.i >= logical.length) return null;
  const f = logical[ctx.i];
  return f.content.startsWith("- ") || f.content === "-" ? parseSeq(ctx, indent, depth) : parseMap(ctx, indent, depth);
}

function parseSeq(ctx, indent, depth) {
  const { logical } = ctx;
  const out = [];
  while (ctx.i < logical.length) {
    const line = logical[ctx.i];
    if (line.indent < indent) break;
    if (!(line.content.startsWith("- ") || line.content === "-")) break;
    guardStructural(line);
    if (line.indent > indent) {
      err("yaml-parse", line.n, "unexpected indentation inside a sequence", `indent ${indent}`, `indent ${line.indent}`, "align every `-` of one sequence to the same column");
    }
    // `rest` is trimmed before the mapping test: `-   owner: ashiq` (aligned with extra
    // spaces, which is why a human writes it) silently became the STRING "owner: ashiq".
    const rest = line.content === "-" ? "" : line.content.slice(2).trim();
    ctx.i++;
    if (rest === "") {
      out.push(ctx.i < logical.length && logical[ctx.i].indent > indent ? parseBlock(ctx, logical[ctx.i].indent, depth + 1) : null);
      continue;
    }
    checkFlow(rest, line.n);
    if (/^[^\s:][^:]*:(\s|$)/.test(rest)) {
      const virt = indent + 2;
      logical.splice(ctx.i, 0, { ...line, indent: virt, text: rest, content: rest });
      out.push(parseMap(ctx, virt, depth + 1));
      continue;
    }
    out.push(scalar(rest, line.n));
  }
  return out;
}

function parseMap(ctx, indent, depth) {
  const { logical } = ctx;
  const out = Object.create(null);
  const seen = new Map();
  while (ctx.i < logical.length) {
    const line = logical[ctx.i];
    if (line.indent < indent) break;
    if (line.content.startsWith("- ")) break;
    guardStructural(line);
    if (line.indent > indent) {
      err("yaml-parse", line.n, "unexpected indentation inside a mapping", `indent ${indent}`, `indent ${line.indent}`, "align every key of one mapping to the same column");
    }

    const m = line.content.match(/^([^:]+):(?:\s+(.*))?$/);
    if (!m) {
      err("yaml-parse", line.n, "line is not `key: value` and not a sequence item",
        "`key: value`, `key:` or `- item`", line.content.slice(0, 60), "name: commit-msg-draft");
    }
    const key = m[1].trim();
    // `out[key] = v` with key `__proto__` invokes the Object.prototype setter: it re-points
    // the prototype instead of creating an own property, so the key vanishes from
    // Object.keys() while staying readable via `.` and `in`. Every gate that enumerates
    // keys goes blind while every consumer still sees it. Both defences are kept --
    // prototype-less mappings AND a loud rejection.
    if (FORBIDDEN_KEYS.has(key)) {
      err("yaml-parse", line.n, `\`${key}\` is not usable as a mapping key`, "an ordinary key name", key,
        "rename it -- these names collide with JavaScript object internals");
    }
    if (seen.has(key)) {
      err("yaml-parse", line.n, `duplicate key \`${key}\` in one mapping`, "each key once per mapping",
        `\`${key}\` first seen on line ${seen.get(key)}`, "remove or rename the second occurrence");
    }
    seen.set(key, line.n);
    const rest = (m[2] ?? "").trim();
    ctx.i++;

    const bs = rest.match(/^([|>])([-+]?)(\d*)$/);
    if (bs) {
      if (bs[2] === "+") excluded(line.n, "block-scalar `+` (keep) chomping", `${bs[1]}+`, "use `|` (clip) or `|-` (strip)");
      if (bs[3]) excluded(line.n, "an explicit block-scalar indentation indicator", rest, "use `|` and indent the body by 2");
      out[key] = readBlockScalar(ctx, indent, bs[1], bs[2], line.n - 1);
      continue;
    }
    if (rest === "") {
      // A nested block may sit at the SAME indent as its key when it is a sequence -- the
      // canonical output of yq, js-yaml.dump and every Kubernetes manifest. Rejecting it
      // made the most common YAML spelling in the world unparseable.
      const nxt = ctx.i < logical.length ? logical[ctx.i] : null;
      if (nxt && nxt.indent > indent) out[key] = parseBlock(ctx, nxt.indent, depth + 1);
      else if (nxt && nxt.indent === indent && (nxt.content.startsWith("- ") || nxt.content === "-")) out[key] = parseSeq(ctx, indent, depth + 1);
      else out[key] = null;
      continue;
    }
    checkFlow(rest, line.n);
    out[key] = scalar(rest, line.n);
  }
  return out;
}

/**
 * Read a block scalar's body straight out of the original lines -- this is the one place
 * the parser reads `raw` rather than the lexed view, because the pilots' markdown prose
 * lives here and comment-stripping or blank-line removal would corrupt the exact bytes
 * REQ-02 has to reproduce.
 */
function readBlockScalar(ctx, keyIndent, style, chomp, keyRawIdx) {
  const { raw } = ctx;
  let blockIndent = null;
  const body = [];
  let r = keyRawIdx + 1;
  while (r < raw.length) {
    const line = raw[r];
    if (!line.trim()) {
      // Keep whatever sits past the block indent. Pushing "" collapsed "a\n\nb", "a\n \nb"
      // and "a\n  \nb" into one value -- and a markdown hard line break IS two trailing
      // spaces, so this was lossy on ordinary prose.
      body.push(blockIndent === null ? "" : line.slice(Math.min(blockIndent, line.length)));
      r++;
      continue;
    }
    const ind = line.length - line.replace(/^ +/, "").length;
    if (ind <= keyIndent) break;
    if (blockIndent === null) blockIndent = ind;
    if (ind < blockIndent) break;
    body.push(line.slice(blockIndent));
    r++;
  }
  while (ctx.i < ctx.logical.length && ctx.logical[ctx.i].n - 1 < r) ctx.i++;

  let end = body.length;
  while (end > 0 && body[end - 1] === "") end--;
  const content = body.slice(0, end);
  const text = style === ">" ? foldLines(content) : content.join("\n");
  return chomp === "-" ? text : `${text}\n`;
}

/**
 * Folded style. YAML turns n+1 consecutive line breaks into n breaks; the previous dedup
 * collapsed EVERY blank run to exactly one, so any number of paragraph breaks past the
 * first was unrecoverable.
 */
function foldLines(body) {
  const out = [];
  let buf = [];
  let blanks = 0;
  const flush = () => { if (buf.length) { out.push(buf.join(" ")); buf = []; } };
  for (const line of body) {
    if (line === "") { blanks++; continue; }
    if (blanks) { flush(); out.push(...Array(blanks - 1 > 0 ? blanks - 1 : 0).fill("")); blanks = 0; if (out.length && out[out.length - 1] !== "") out.push(""); }
    if (/^\s/.test(line)) { flush(); out.push(line); continue; }
    buf.push(line.trim());
  }
  flush();
  return out.join("\n");
}

/** Re-encode a string as a block scalar body -- process-lint's representability check. */
export function encodeBlockScalar(key, text, indent = 2) {
  const pad = " ".repeat(indent);
  const trailing = (text.match(/\n*$/) || [""])[0].length;
  const core = text.replace(/\n+$/, "");
  const lines = core.split("\n").map((l) => (l === "" ? "" : pad + l));
  // `+` is excluded by name, so a body needing 2+ trailing newlines is UNREPRESENTABLE and
  // must fail the round-trip rather than be silently clipped.
  return `${key}: |${trailing === 0 ? "-" : ""}\n${lines.join("\n")}\n${trailing > 1 ? "\n".repeat(trailing - 1) : ""}`;
}

// ---------- entry point ----------

export function parseYamlSubset(text) {
  try {
    // Document markers are found DURING parsing, never by pre-splitting: a `---` inside a
    // `body:` block scalar is a markdown horizontal rule, and a textual split would cut the
    // document in half at it.
    const { logical, raw } = lex(text);
    if (!logical.length) err("yaml-parse", 1, "file is empty or contains only comments", "a mapping", "nothing", "name: my-process");
    const start = logical[0].content.trim() === "---" && logical[0].indent === 0 ? 1 : 0;
    if (start && logical.length === 1) err("yaml-parse", 1, "file has a document marker but no content", "a mapping", "---", "name: my-process");
    const ctx = { logical, raw, i: start };
    const value = parseBlock(ctx, logical[start].indent, 0);
    if (ctx.i < logical.length) {
      const l = logical[ctx.i];
      guardStructural(l);
      err("yaml-parse", l.n, "trailing content after the document's root mapping", "one root mapping",
        l.content.slice(0, 57), "check the indentation of this line");
    }
    return { ok: true, value };
  } catch (e) {
    if (e instanceof YamlError) return { ok: false, error: e };
    if (e instanceof RangeError) {
      return { ok: false, error: new YamlError("yaml-parse", 1, "document nests too deeply for this parser", `at most ${MAX_DEPTH} levels`, e.message, "a canonical process is a flat document") };
    }
    return { ok: false, error: new YamlError("yaml-parse", 1, `parser crashed: ${e.message}`, "parseable YAML", "an internal error", "report this file as a parser bug") };
  }
}
