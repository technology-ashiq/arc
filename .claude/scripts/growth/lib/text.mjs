// growth/text -- the ONE text layer. Folding, blocks, and link extraction, used by slop-lint,
// citation-lint and generate's negative control.
//
// WHY THIS FILE EXISTS. An adversarial pass on 2026-08-14 ran two agents at the growth lints and
// returned 35 executed holes. The two CRITICALs were the same defect wearing different hats:
//
//   - `slop-lint` folded away invisible characters before matching. `citation-lint`, one directory
//     over, did no folding at all -- so a zero-width space inside "40%" or "according to" made
//     every figure and attribution invisible to the only function enforcing E3's truth law.
//   - `generate`'s anti-prescription control was a raw substring scan, so a soft hyphen inside each
//     marker word hid a complete v0-style structural brief and the control returned true.
//
// That is this repo's oldest recurring failure: a fix applied in one file and left standing in its
// twin, three times in two days by the count in CLAUDE.md. A shared list of rules did not stop it.
// One shared IMPLEMENTATION does, because there is no twin left to forget.
//
// The second CRITICAL was structural: slop-lint matched against a single PHYSICAL LINE, so any
// listed phrase straddling an ordinary markdown soft wrap was missed and the verdict became a
// function of the writer's wrap column. Hence `blocks()` -- prose is matched per paragraph, and
// offsets map back to real line numbers so the report still points at a line a human can find.

// Invisible characters that render as nothing and would otherwise split a literal phrase.
//
// Cf (format) and Cc (control) cover ZWSP/ZWNJ/ZWJ/word-joiner/BOM/bidi. Cn is NOT used and the
// whole Mn category is NOT stripped: Mn holds real combining accents, and removing them would
// mangle every language that composes them -- a "fix" that corrupts Vietnamese to catch a bypass.
// What IS added is the targeted Mn/format set that carries no visible mark:
//   U+034F COMBINING GRAPHEME JOINER · U+180E MONGOLIAN VOWEL SEPARATOR · U+FE00-FE0F variation
//   selectors · U+00AD SOFT HYPHEN (Cf already, named here because it is the one that defeated
//   the prescription control).
// Written as ESCAPES, never as the characters themselves. A class of invisible characters spelled
// literally is a class nobody can review in a diff, which is the same property that makes them a
// bypass in the first place.
export const INVISIBLE_RE = /[\p{Cf}\p{Cc}\u034F\u180E\uFE00-\uFE0F]/gu;

// Every dash `foldText` folds. The em-dash density counter reads THIS list too: it used to count
// only U+2014 while the fold treated six characters as dashes, so an en-dash pile evaded the one
// structural marker in the list. One set, both readers.
export const DASH_CLASS = "\\u2010-\\u2015\\u2212";
const DASHES_RE = new RegExp(`[${DASH_CLASS}]`, "gu");
// The SENTENCE-dash class: em (U+2014), horizontal bar (U+2015) and en (U+2013). En-dash is in
// deliberately -- it is the standard sentence dash in British and European style and renders
// near-identically, so counting only U+2014 made the one structural marker evadable by a keystroke.
// U+2010-U+2012 (hyphens) and U+2212 (minus) are OUT: those join words and numbers rather than
// separating clauses. The cost is a line carrying three or more en-dashed RANGES ("2020-2024")
// tripping the density marker; that is rare in prose and visible in the report when it happens.
export const EM_DASHES_RE = /[\u2013\u2014\u2015]/gu;

// Markdown emphasis and code ticks. `It is **important to note**` rendered identically to the plain
// form and matched nothing, so bolding a tell was a one-keystroke bypass.
const EMPHASIS_RE = /[*_`~]/g;

/**
 * Fold text to the form matchers compare against.
 *
 * Order matters: invisibles first (so NFKC cannot compose around them), then NFKC (which maps
 * fullwidth digits and ligatures to ASCII), then the quote and dash folds NFKC does NOT do --
 * U+2019 is not compatibility-equivalent to U+0027 -- then case, then whitespace.
 */
export function foldText(s) {
  return String(s)
    .replace(INVISIBLE_RE, "")
    .normalize("NFKC")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(DASHES_RE, "-")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** `foldText` plus emphasis removal, for phrase matching over prose. */
export function foldForPhrases(s) {
  return foldText(String(s).replace(EMPHASIS_RE, ""));
}

/**
 * Split into blocks (paragraphs), keeping every line's real number.
 *
 * A fenced code block is returned as ONE block flagged `fenced`, so each lint can decide. They
 * decide differently and on purpose: slop-lint scans fences (a fence must never become a bypass)
 * while citation-lint skips them (a JSON snippet containing `"since": 2024` is not a claim of
 * fact). Both choices fail toward the safer outcome for their own gate.
 */
export function blocks(text) {
  const lines = String(text).split(/\r\n|\r|\n/);
  const out = [];
  let cur = null;
  let fence = null;
  const flush = () => { if (cur) out.push(cur); cur = null; };
  lines.forEach((raw, i) => {
    const n = i + 1;
    const fenceMark = raw.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      cur.lines.push({ line: n, text: raw });
      if (fenceMark && fenceMark[1][0] === fence[0] && fenceMark[1].length >= fence.length) { flush(); fence = null; }
      return;
    }
    if (fenceMark) {
      flush();
      fence = fenceMark[1];
      cur = { startLine: n, fenced: true, lines: [{ line: n, text: raw }] };
      return;
    }
    if (raw.trim() === "") { flush(); return; }
    if (!cur) cur = { startLine: n, fenced: false, lines: [] };
    cur.lines.push({ line: n, text: raw });
  });
  flush();
  return out;
}

/**
 * Fold a block into one string and keep a map back to line numbers, so a phrase that straddles a
 * soft wrap is both FOUND and reported at the line where it starts.
 */
export function foldBlock(block, { phrases = false } = {}) {
  const fold = phrases ? foldForPhrases : foldText;
  let folded = "";
  const spans = [];
  for (const l of block.lines) {
    const piece = fold(l.text);
    if (piece === "") continue;
    if (folded !== "") folded += " ";
    spans.push({ start: folded.length, end: folded.length + piece.length, line: l.line });
    folded += piece;
  }
  const lineAt = (offset) => {
    for (const s of spans) if (offset >= s.start && offset <= s.end) return s.line;
    return block.startLine;
  };
  return { folded, lineAt };
}

// ---------------------------------------------------------------------------------------------
// LINKS -- one extractor, because two disagreed.
//
// `citation-lint.linksIn` counted markdown-inline AND bare URLs; `generate.bodyLinks` counted only
// markdown-inline. So a body whose every claim was cited with a bare URL passed the citation gate
// and then rendered with `citations: []` -- the exact lie `renderMdx` says it prevents, reached
// from the other side.
// ---------------------------------------------------------------------------------------------

/**
 * Markdown inline link, with BALANCED parentheses in the URL.
 *
 * `[^)\s]+` truncated `https://en.wikipedia.org/wiki/A_(b)` at the inner paren, in both files
 * identically -- so the frontmatter recorded a URL that does not exist and the link checker then
 * WARNed DEAD_LINK on a live source. Wikipedia disambiguation URLs are among the commonest
 * citations there are, which is why this is worth a hand-written scan rather than a regex.
 */
function scanInlineLinks(s, out) {
  const str = String(s);
  // Consumed spans are blanked out before the bare-URL pass. Without that, the balanced-paren fix
  // produced BOTH the correct URL and the truncated one: the inline scan returned
  // `.../A_(b)` and the bare-URL regex then matched `.../A_(b` out of the same characters, so a
  // single citation appeared twice in frontmatter, once in a form that 404s.
  let masked = str;
  const blank = (from, to) => { masked = masked.slice(0, from) + " ".repeat(to - from) + masked.slice(to); };
  for (let i = 0; i < str.length; i++) {
    if (str[i] !== "[") continue;
    // Find the label's closing bracket (no nesting: markdown does not allow it unescaped).
    const close = str.indexOf("]", i + 1);
    if (close === -1 || str[close + 1] !== "(") continue;
    let depth = 1, j = close + 2, url = "";
    while (j < str.length && depth > 0) {
      const c = str[j];
      if (c === "(") depth++;
      else if (c === ")") { depth--; if (depth === 0) break; }
      url += c;
      j++;
    }
    if (depth !== 0) continue; // unterminated: not a link
    // A title after the URL: [x](url "title")
    const m = url.match(/^\s*(<[^>]*>|\S+)(?:\s+"[^"]*")?\s*$/);
    if (m) out.push(m[1].replace(/^<|>$/g, ""));
    blank(i, Math.min(j + 1, str.length));
    i = j;
  }
  return masked;
}

const BARE_URL_RE = /<?\bhttps?:\/\/[^\s<>)\]]+>?/g;
const REF_DEF_RE = /^\s{0,3}\[([^\]]+)\]:\s*(\S+)/;

/** Reference-style definitions and footnote definitions in a whole document: label -> url. */
export function linkDefinitions(text) {
  const defs = new Map();
  for (const raw of String(text).split(/\r\n|\r|\n/)) {
    const m = raw.match(REF_DEF_RE);
    if (m) defs.set(m[1].toLowerCase(), m[2].replace(/^<|>$/g, ""));
  }
  return defs;
}

/**
 * Every link in a string: markdown-inline, bare, autolinked, and reference-style where the label
 * resolves against `defs`. One implementation, every caller.
 */
export function extractLinks(s, defs = new Map()) {
  const out = [];
  const masked = scanInlineLinks(s, out);
  for (const m of String(masked).matchAll(BARE_URL_RE)) out.push(m[0].replace(/^<|>$/g, "").replace(/[.,;:]+$/, ""));
  // Reference style: [label][ref] and the shortcut [ref][] / [ref]. Footnotes: [^1].
  for (const m of String(s).matchAll(/\[[^\]\n]*\]\[([^\]\n]*)\]/g)) {
    const key = (m[1] || "").toLowerCase();
    if (defs.has(key)) out.push(defs.get(key));
  }
  for (const m of String(s).matchAll(/\[\^([^\]\n]+)\]/g)) {
    const key = ("^" + m[1]).toLowerCase();
    if (defs.has(key)) out.push(defs.get(key));
  }
  const seen = new Set();
  return out.filter((u) => u !== "" && !seen.has(u) && seen.add(u));
}

/**
 * Does this link count as a SOURCE for a claim of fact?
 *
 * Only an absolute http(s) URL does. An image, a page anchor, a relative internal link and a
 * `mailto:`/`javascript:` URI all satisfied "carries a source link" before this existed -- and
 * since `generate` instructs the writer to add internal cluster links, a fabricated figure next to
 * an internal cross-link passed the truth gate and the article could cite itself in a loop.
 */
export function isSourceLink(url) {
  return /^https?:\/\/[^\s/]+\.[^\s/]/i.test(String(url));
}
