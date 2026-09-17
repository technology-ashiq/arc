#!/usr/bin/env node
// face-pure -- the module contract, as a lint (face v2 Phase 02, REQ-03, ADR-1320).
//
// A module is four files and no fifth: module.mjs (the manifest) · fold.mjs (every decision) ·
// ops.mjs (its verbs) · View.tsx (the render). The contract exists because CI never installs at the
// repo root, so a decision inside a .tsx is a decision nobody tests; this lint is what makes the
// contract hold for 36 modules under time pressure rather than for the first few.
//
// FAIL from birth: no WARN phase, no allow-list, no per-module exemption.
//
// What it FAILs:
//   shape    a module folder that is not exactly the four files (a missing one, a fifth file or
//            folder, a file where a folder belongs, a ring or id outside the kebab grammar, an
//            empty ring folder, a symlink, a NUL byte)
//   imports  a module.mjs, fold.mjs or ops.mjs -- and every relative .mjs it reaches, followed to
//            the end -- importing anything but a relative .mjs inside face/src or a node builtin; a
//            builtin that loads code (module, vm, child_process, worker_threads, ...); a computed
//            import(); require; import.meta; eval and the Function constructor
//   View     a View.tsx holding a branch: if/else/switch/for/while/try/throw, a comparison, an
//            arithmetic, bitwise or nullish operator, optional chaining, typeof/instanceof/in/new,
//            a regex, a type or class declaration, a nested ternary, a destructuring default, a
//            lookup keyed by anything but a number literal, a call to anything but `.map`, React's
//            own hooks, a handler (`onX`) or a local setter (`setX`), and a CONDITION (the operand
//            of `&&`, `||`, `?:` or `!`) that is not a boolean field
//
// "A boolean field fold() returns" is read structurally, by NAME: a dotted path whose last segment
// starts with is · has · can · should · show (BOOLEAN_FIELD). tests/face/face-pure.mjs imports every
// real module's fold under node and FAILs a boolean-named field whose value is not a boolean, so the
// name cannot lie about the value on the tree CI sees.
//
// How it reads a View: a small lexer that tells a JSX `<` from a comparison by the token before it,
// a regex from a division the same way, and JSX text and attribute strings from code. It is not a
// TypeScript parser (PLAN rabbit hole), and what it does not understand is a FINDING, never a skip:
// an unterminated string, an unbalanced bracket, a JSX tag it cannot read and an empty file are each
// `view-unscannable`. Declared limits, each of which fails closed rather than open:
//   - type syntax: a View's types come from fold.mjs's JSDoc (`import type`); a type argument reads
//     as a comparison, a union reads as a bitwise OR, a local `type` is a keyword finding;
//   - a function return-type annotation on a View is not supported;
//   - a statement break without a semicolon is read from a newline between an expression's end and
//     the next expression's start (the ASI cases a View meets), not from the full ASI grammar.
//
// Usage: face-pure.mjs [--root PATH]   (default: face/src/modules, which must exist)
// Exit:  0 scanned more than zero modules, folds and views, and found nothing
//        1 a finding, or nothing scanned
//        2 could not run (a bad argument, an unreadable root)
import { readFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { isBuiltin } from "node:module";
import { join, dirname, resolve, relative, sep, basename, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
export const DEFAULT_ROOT = "face/src/modules";
export const MODULE_FILES = Object.freeze(["module.mjs", "fold.mjs", "ops.mjs", "View.tsx"]);
export const BOOLEAN_FIELD = /^(is|has|can|should|show)[A-Z0-9_]/;
const NAME = /^[a-z][a-z0-9-]*$/;
// Passes the kebab grammar and still breaks mkdir on exactly one of the three CI legs.
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
// Node builtins that load or run code: a fold importing one of them can reach React after all.
const LOADERS = new Set(["module", "vm", "child_process", "worker_threads", "wasi", "repl", "inspector", "inspector/promises", "cluster"]);

// ───────────────────────────────────────────────────────────────────────────────────────────────
// The lexer
// ───────────────────────────────────────────────────────────────────────────────────────────────

class LexError extends Error {
  constructor(message, line, col) { super(message); this.line = line; this.col = col; }
}

const PUNCT = [">>>=", "...", "===", "!==", "**=", "<<=", ">>=", ">>>", "&&=", "||=", "??=",
  "=>", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "++", "--", "+=", "-=", "*=", "/=", "%=",
  "&=", "|=", "^=", "**", "<<", ">>", "{", "}", "(", ")", "[", "]", ";", ",", "<", ">", "+", "-",
  "*", "/", "%", "&", "|", "^", "!", "~", "?", ":", "=", ".", "@", "#"];

// Reserved words only. Contextual words (`of`, `as`, `get`, `set`, `async`, `let`) are names: were
// they keywords here, `get(f)` would skip the call rule and a `/` after a variable named `set` would
// read as a regex.
export const KEYWORDS = new Set(["break", "case", "catch", "class", "const", "continue", "debugger", "default",
  "delete", "do", "else", "export", "extends", "finally", "for", "function", "if", "import", "in", "instanceof",
  "new", "return", "switch", "throw", "try", "typeof", "var", "void", "while", "with", "yield", "enum", "await"]);
// Names that are values, so an expression can end on them.
const VALUE_WORDS = new Set(["this", "super", "null", "true", "false", "undefined"]);
// After these a `/` starts a regex and a `<` starts JSX: they cannot be the end of an operand.
const EXPR_PREFIX_WORDS = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw",
  "case", "do", "else", "yield", "await", "default", "export"]);
const OPENERS = { ")": "(", "]": "[", "}": "{" };
// Identifier characters are ECMAScript's own (ID_Start / ID_Continue, plus ZWNJ and ZWJ), and whitespace
// is JavaScript's own `\s` class -- every Unicode space separator, not a hand-kept list. A lexer whose idea
// of a space is narrower than node's read `import<EM SPACE>React` as one name and never saw the import
// (face v2 Phase 02 attack; the twin of the ASCII-whitespace fix in fixed-defects).
const NAME_START = /[\p{ID_Start}$_]/u;
const NAME_PART = /[\p{ID_Continue}$]/u;
const ZWNJ_ZWJ = new Set([0x200c, 0x200d]);
const isNamePart = (c) => NAME_PART.test(c) || ZWNJ_ZWJ.has(c.charCodeAt(0));
const isSpace = (c) => /\s/.test(c);
const NUMBER = /^(?:0[xXoObB][0-9a-fA-F_]+n?|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?n?)/;
// JavaScript's four line terminators. A `//` comment ends at ANY of them, and a string or a regex may
// not span one (U+2028/U+2029 aside in strings). Reading only LF let a `// x<U+2028>import React`
// hide a whole statement from the scan while node ran it (face v2 Phase 02 attack). Built from char
// codes so no editor or tool can turn an escape into an invisible byte in this file.
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const isLineBreak = (c) => c === "\n" || c === "\r" || c === LS || c === PS;

/** A line for a log anything parses: every line terminator in `text` made visible, so a name cannot forge a line. */
export function oneLine(text) {
  let out = "";
  for (const c of String(text)) out += isLineBreak(c) ? `<U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}>` : c;
  return out;
}

/** Whether a token can END an operand (so a following `/` divides and a following `<` compares). */
function isEnder(t) {
  if (!t) return false;
  if (t.k === "name") return t.prop === true || !KEYWORDS.has(t.v) || VALUE_WORDS.has(t.v);
  if (t.k === "num" || t.k === "str" || t.k === "re") return true;
  return t.k === "p" && (t.v === ")" || t.v === "]" || t.v === "}" || t.v === "`end" || t.v === "jsx/>" || t.v === "jsx</>");
}

/** Whether a token can START a new expression statement after a newline (the ASI cases a View meets). */
function isStarter(t) {
  if (!t) return false;
  if (t.k === "name") return !KEYWORDS.has(t.v) || VALUE_WORDS.has(t.v) || EXPR_PREFIX_WORDS.has(t.v);
  if (t.k === "num" || t.k === "str") return true;
  return t.k === "p" && (t.v === "!" || t.v === "`" || t.v === "jsx<");
}

/**
 * Tokens for `text`. With `jsx`, a `<` in operand position starts a JSX element whose text and
 * attribute strings are not code. Every bracket (`(` `[` `{` `${` a template and a JSX element) is
 * paired: `pair` on each end holds the other's index, and `inside` on every token holds the index
 * of the innermost bracket it sits in (-1 at the top level).
 * @returns {{ tokens: object[], error: null | { message: string, line: number, col: number } }}
 */
export function lex(text, { jsx = false } = {}) {
  const src = String(text);
  const tokens = [];
  const stack = []; // indices of open bracket tokens
  let i = 0, line = 1, col = 1, nl = false;
  // A leading byte-order mark is not code.
  if (src.charCodeAt(0) === 0xfeff) { i = 1; }

  const advance = (n) => {
    for (let k = 0; k < n; k++) {
      if (src[i] === "\n") { line++; col = 1; } else col++;
      i++;
    }
  };
  const prev = () => tokens[tokens.length - 1];
  const push = (k, v, at) => {
    const t = { k, v, line: at.line, col: at.col, nl, pair: -1, inside: stack.length ? stack[stack.length - 1] : -1 };
    nl = false;
    tokens.push(t);
    return tokens.length - 1;
  };
  const here = () => ({ line, col });
  const open = (v, at, kind) => {
    const idx = push("p", v, at);
    tokens[idx].kind = kind;
    stack.push(idx);
    return idx;
  };
  const close = (v, at, expectOpen) => {
    if (!stack.length) throw new LexError(`"${v}" closes nothing`, at.line, at.col);
    const o = stack[stack.length - 1];
    const ov = tokens[o].v;
    if (!expectOpen.includes(ov)) throw new LexError(`"${v}" does not close "${ov}" opened at ${tokens[o].line}:${tokens[o].col}`, at.line, at.col);
    stack.pop();
    const idx = push("p", v, at);
    tokens[idx].pair = o;
    tokens[o].pair = idx;
    tokens[idx].inside = stack.length ? stack[stack.length - 1] : -1;
    return idx;
  };

  /** Skip whitespace and comments; `nl` records whether a line break was crossed. */
  const skipTrivia = () => {
    for (;;) {
      const c = src[i];
      if (c === undefined) return;
      if (isLineBreak(c)) { nl = true; advance(1); continue; }
      if (isSpace(c)) { advance(1); continue; }
      if (c === "/" && src[i + 1] === "/") { while (i < src.length && !isLineBreak(src[i])) advance(1); continue; }
      if (c === "/" && src[i + 1] === "*") {
        const at = here();
        const end = src.indexOf("*/", i + 2);
        if (end === -1) throw new LexError("an unterminated /* comment", at.line, at.col);
        if ([...src.slice(i, end)].some(isLineBreak)) nl = true;
        advance(end + 2 - i);
        continue;
      }
      return;
    }
  };

  const readString = (quote) => {
    const at = here();
    advance(1);
    let v = "";
    for (;;) {
      const c = src[i];
      // A string may hold U+2028/U+2029 (ES2019) but not a CR or an LF.
      if (c === undefined || c === "\n" || c === "\r") throw new LexError("an unterminated string", at.line, at.col);
      if (c === "\\") {
        // A line continuation may be CRLF: the escape covers both bytes.
        const n = src[i + 1] === undefined ? 1 : src[i + 1] === "\r" && src[i + 2] === "\n" ? 3 : 2;
        v += src.slice(i, i + n);
        advance(n);
        continue;
      }
      if (c === quote) { advance(1); break; }
      v += c;
      advance(1);
    }
    push("str", v, at);
  };

  const readRegex = () => {
    const at = here();
    advance(1);
    let inClass = false;
    for (;;) {
      const c = src[i];
      if (c === undefined || isLineBreak(c)) throw new LexError("an unterminated regex", at.line, at.col);
      if (c === "\\") { advance(src[i + 1] === undefined || isLineBreak(src[i + 1]) ? 1 : 2); continue; }
      if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      else if (c === "/" && !inClass) { advance(1); break; }
      advance(1);
    }
    while (i < src.length && /[a-z]/i.test(src[i])) advance(1);
    push("re", "regex", at);
  };

  const readTemplate = () => {
    const at = here();
    open("`", at, "tpl");
    advance(1);
    for (;;) {
      const c = src[i];
      if (c === undefined) throw new LexError("an unterminated template literal", at.line, at.col);
      if (c === "\\") { advance(src[i + 1] === undefined ? 1 : 2); continue; }
      if (c === "`") { const end = here(); advance(1); close("`end", end, ["`"]); return; }
      if (c === "$" && src[i + 1] === "{") {
        const o = here();
        open("${", o, "tpl-expr");
        advance(2);
        code(true);
        const e = here();
        if (src[i] !== "}") throw new LexError("an unterminated ${ in a template literal", o.line, o.col);
        advance(1);
        close("}", e, ["${"]);
        continue;
      }
      advance(1);
    }
  };

  /** The kind of a `{` in code, from the token before it: a block, or an object / pattern / type. */
  const braceKind = () => {
    const p = prev();
    if (!p) return "block";
    if (p.k === "p") {
      if (p.v === ")" || p.v === "=>" || p.v === ";" || p.v === "}") return "block";
      if (p.v === "{") return tokens[tokens.length - 1].kind === "block" ? "block" : "object";
      return "object";
    }
    if (p.k === "name" && (p.v === "else" || p.v === "try" || p.v === "finally" || p.v === "do")) return "block";
    return "object";
  };

  const jsxName = () => {
    const m = /^[A-Za-z_$][\w$.:-]*/.exec(src.slice(i));
    return m ? m[0] : null;
  };
  const skipJsxSpace = () => {
    for (;;) {
      const c = src[i];
      if (c !== undefined && isSpace(c)) { advance(1); continue; }
      if (c === "/" && src[i + 1] === "*") {
        const at = here();
        const end = src.indexOf("*/", i + 2);
        if (end === -1) throw new LexError("an unterminated /* comment in a JSX tag", at.line, at.col);
        advance(end + 2 - i);
        continue;
      }
      if (c === "/" && src[i + 1] === "/") { while (i < src.length && !isLineBreak(src[i])) advance(1); continue; }
      return;
    }
  };
  /** `{ ... }` inside JSX: an attribute value, a spread, or a child expression. */
  const jsxContainer = () => {
    const at = here();
    open("{", at, "jsx");
    advance(1);
    code(true);
    const e = here();
    if (src[i] !== "}") throw new LexError("an unterminated { in JSX", at.line, at.col);
    advance(1);
    close("}", e, ["{"]);
  };

  const jsxElement = () => {
    const at = here();
    const openIdx = open("jsx<", at, "jsx");
    advance(1);
    skipJsxSpace();
    let name = "";
    if (src[i] !== ">") {
      name = jsxName();
      if (name === null) throw new LexError("a JSX tag this lint cannot read", at.line, at.col);
      advance(name.length);
    }
    // attributes
    for (;;) {
      skipJsxSpace();
      const c = src[i];
      if (c === undefined) throw new LexError(`an unclosed JSX tag <${name}>`, at.line, at.col);
      if (c === "/" && src[i + 1] === ">") {
        if (name === "") throw new LexError("a self-closing fragment", at.line, at.col);
        const e = here(); advance(2); close("jsx/>", e, ["jsx<"]); return;
      }
      if (c === ">") { advance(1); break; }
      if (name === "") throw new LexError("attributes on a fragment", at.line, at.col);
      if (c === "{") { jsxContainer(); continue; }
      const attr = jsxName();
      if (attr === null) throw new LexError(`a JSX attribute this lint cannot read in <${name}>`, line, col);
      advance(attr.length);
      skipJsxSpace();
      if (src[i] !== "=") continue;
      advance(1);
      skipJsxSpace();
      const v = src[i];
      if (v === '"' || v === "'") {
        const s = here();
        const end = src.indexOf(v, i + 1);
        if (end === -1) throw new LexError("an unterminated JSX attribute string", s.line, s.col);
        const value = src.slice(i + 1, end);
        advance(end + 1 - i);
        push("str", value, s);
      } else if (v === "{") jsxContainer();
      else if (v === "<") jsxElement();
      else throw new LexError(`a JSX attribute value this lint cannot read in <${name}>`, line, col);
    }
    push("p", "jsx>", here());
    // children
    for (;;) {
      const c = src[i];
      if (c === undefined) throw new LexError(`an unclosed JSX element <${name}>`, at.line, at.col);
      if (c === "{") { jsxContainer(); continue; }
      if (c === "<") {
        let j = i + 1;
        while (j < src.length && isSpace(src[j])) j++;
        if (src[j] === "/") {
          const e = here();
          advance(j + 1 - i);
          skipJsxSpace();
          let closing = "";
          if (src[i] !== ">") {
            closing = jsxName();
            if (closing === null) throw new LexError("a JSX closing tag this lint cannot read", e.line, e.col);
            advance(closing.length);
            skipJsxSpace();
          }
          if (src[i] !== ">") throw new LexError(`an unterminated closing tag </${closing}>`, e.line, e.col);
          if (closing !== name) throw new LexError(`</${closing}> does not close <${name}> opened at ${tokens[openIdx].line}:${tokens[openIdx].col}`, e.line, e.col);
          advance(1);
          close("jsx</>", e, ["jsx<"]);
          return;
        }
        jsxElement();
        continue;
      }
      advance(1);
    }
  };

  /** Code until the end of input, or until an unmatched `}` when `inBrace` (left for the caller). */
  function code(inBrace) {
    let depth = 0;
    for (;;) {
      skipTrivia();
      const c = src[i];
      if (c === undefined) {
        if (inBrace) throw new LexError("input ended inside a { ... }", line, col);
        return;
      }
      const at = here();
      if (c === "}" && depth === 0 && inBrace) return;
      if (c === '"' || c === "'") { readString(c); continue; }
      if (c === "`") { readTemplate(); continue; }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
        const m = NUMBER.exec(src.slice(i));
        advance(m[0].length);
        push("num", m[0], at);
        continue;
      }
      if (NAME_START.test(c)) {
        let j = i + 1;
        // A name never absorbs a line terminator or a space-like character: `foo<U+2028>import x from "react"`
        // is a name, a line break and an import statement, and must lex as exactly that.
        while (j < src.length && isNamePart(src[j])) j++;
        const v = src.slice(i, j);
        advance(j - i);
        const before = prev();
        const ni = push("name", v, at);
        // After `.` or `?.` a name is a PROPERTY, even one spelled like a keyword: `f.default < x` is a
        // comparison, not a JSX element opened after the keyword `default` (face v2 Phase 02 attack).
        tokens[ni].prop = Boolean(before) && before.k === "p" && (before.v === "." || before.v === "?.");
        continue;
      }
      const p = prev();
      const operandPosition = !isEnder(p) || (p && p.k === "name" && p.prop !== true && EXPR_PREFIX_WORDS.has(p.v));
      if (c === "/" && src[i + 1] !== "/" && src[i + 1] !== "*" && operandPosition) { readRegex(); continue; }
      if (c === "<" && jsx && operandPosition) { jsxElement(); continue; }
      let v = null;
      for (const cand of PUNCT) if (src.startsWith(cand, i)) { v = cand; break; }
      if (v === "?." && /[0-9]/.test(src[i + 2] ?? "")) v = "?";
      if (v === null) throw new LexError(`a character this lint cannot read: ${JSON.stringify(c)}`, at.line, at.col);
      if (v === "{") { const kind = braceKind(); advance(1); open("{", at, kind); depth++; continue; }
      if (v === "(" || v === "[") { advance(1); open(v, at, v); continue; }
      if (v === "}") {
        if (depth === 0) throw new LexError('a "}" that closes nothing', at.line, at.col);
        advance(1); close("}", at, ["{"]); depth--; continue;
      }
      if (v === ")" || v === "]") { advance(1); close(v, at, [OPENERS[v]]); continue; }
      advance(v.length);
      push("p", v, at);
    }
  }

  try {
    code(false);
    if (stack.length) {
      const t = tokens[stack[stack.length - 1]];
      throw new LexError(`"${t.v}" is never closed`, t.line, t.col);
    }
    return { tokens, error: null };
  } catch (e) {
    if (e instanceof LexError) return { tokens, error: { message: e.message, line: e.line, col: e.col } };
    throw e;
  }
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Imports: statements, bindings and specifiers
// ───────────────────────────────────────────────────────────────────────────────────────────────

const isP = (t, v) => Boolean(t) && t.k === "p" && t.v === v;
const isName = (t, v) => Boolean(t) && t.k === "name" && (v === undefined || t.v === v);

/** Whether token `i` begins a statement: nothing before it, or a `;` / block end, or a line break after an operand. */
function statementStart(tokens, i) {
  const p = tokens[i - 1];
  if (!p) return true;
  if (isP(p, ";") || isP(p, "}") || (isP(p, "{") && p.kind === "block")) return true;
  return tokens[i].nl && isEnder(p);
}

/**
 * Every static import and export-from statement: its token span, its specifier and the value names it binds.
 * @returns {{ start: number, end: number, spec: string, specAt: object, names: string[], typeOnly: boolean }[]}
 */
function importStatements(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!(isName(t, "import") || isName(t, "export")) || !statementStart(tokens, i)) continue;
    if (isName(t, "import") && (isP(tokens[i + 1], "(") || isP(tokens[i + 1], "."))) continue;
    if (isName(t, "export") && !(isP(tokens[i + 1], "{") || isP(tokens[i + 1], "*") || (isName(tokens[i + 1], "type") && isP(tokens[i + 2], "{")))) continue;
    // Walk to the specifier: the string after `from`, or the string straight after `import`.
    let j = i + 1;
    let spec = null;
    const names = [];
    let typeOnly = isName(tokens[i + 1], "type");
    let braceDepth = 0;
    let typeNext = false;
    for (; j < tokens.length; j++) {
      const u = tokens[j];
      if (u.k === "str" && (j === i + 1 || isName(tokens[j - 1], "from"))) { spec = u; break; }
      if (isP(u, ";")) break;
      // `export { a }` with no `from`: the next statement is not this one's specifier.
      if (j > i && u.k === "name" && (u.v === "import" || u.v === "export") && statementStart(tokens, j)) break;
      if (isP(u, "{")) { braceDepth++; continue; }
      if (isP(u, "}")) { braceDepth--; continue; }
      if (u.k !== "name" || isName(u, "from") || isName(u, "as") || u.v === "import" || u.v === "export") {
        if (isName(u, "as") && tokens[j + 1] && tokens[j + 1].k === "name") { names.pop(); names.push(tokens[j + 1].v); j++; }
        continue;
      }
      if (u.v === "type" && j !== i + 1 && braceDepth > 0 && tokens[j + 1] && tokens[j + 1].k === "name") { typeNext = true; continue; }
      if (u.v === "type" && j === i + 1) continue;
      if (typeNext) { typeNext = false; continue; }
      names.push(u.v);
    }
    if (!spec) continue;
    let end = j;
    // `with { type: "json" }` / `assert { ... }` belong to the statement.
    if ((isName(tokens[end + 1], "with") || isName(tokens[end + 1], "assert")) && isP(tokens[end + 2], "{") && tokens[end + 2].pair > 0) end = tokens[end + 2].pair;
    if (isP(tokens[end + 1], ";")) end++;
    out.push({ start: i, end, spec: spec.v, specAt: spec, names: typeOnly ? [] : names, typeOnly, isExport: isName(t, "export") });
    i = end;
  }
  return out;
}

/** What a module specifier is: a relative .mjs, a builtin, a code-loading builtin, or something a fold may not import. */
export function classifySpec(spec) {
  const s = String(spec);
  if (s.startsWith("./") || s.startsWith("../")) {
    // `%` too: path.resolve reads `%2e%2e` as a folder name and node's loader decodes it to `..`, so the
    // lint and node would resolve two different files (face v2 Phase 02 attack).
    if (s.includes("%") || s.includes("\\") || s.includes("?") || s.includes("#") || s.includes("//") || /(^|\/)\.(\/|$)/.test(s.replace(/^\.\.?\//, "")))
      return { ok: false, kind: "fold-import", why: `the relative import ${JSON.stringify(s)} carries a query, a fragment, a backslash or an empty segment` };
    if (!/^(\.\.?\/)+([^/]+\/)*[^/]+\.mjs$/.test(s))
      return { ok: false, kind: "fold-import", why: `${JSON.stringify(s)} is a relative import of something that is not a .mjs file` };
    return { ok: true, relative: true };
  }
  if (isBuiltin(s)) {
    const bare = s.startsWith("node:") ? s.slice(5) : s;
    if (LOADERS.has(bare)) return { ok: false, kind: "fold-loader", why: `${JSON.stringify(s)} is a builtin that loads code -- through it a fold can reach React after all` };
    return { ok: true, relative: false };
  }
  return { ok: false, kind: "fold-import", why: `${JSON.stringify(s)} is not a relative .mjs or a node builtin -- a fold imports nothing from React, Vite, three or any package (ADR-1320)` };
}

/**
 * The imports of one .mjs file (module.mjs, fold.mjs, ops.mjs, or a helper one of them reaches),
 * with a finding for each import the contract refuses. Not transitive: `lintModules` follows the
 * relative ones.
 */
export function scanModuleImports(text, file) {
  const { tokens, error } = lex(text, { jsx: false });
  const findings = [];
  const imports = [];
  const add = (t, kind, detail) => findings.push({ file, line: t ? t.line : 1, col: t ? t.col : 1, kind, detail });
  if (error) { add(error, "fold-unscannable", `the lint could not read this file past here: ${error.message}`); return { imports, findings }; }
  for (const st of importStatements(tokens)) {
    imports.push({ spec: st.spec, line: st.specAt.line, col: st.specAt.col, how: st.isExport ? "export-from" : "import" });
    const c = classifySpec(st.spec);
    if (!c.ok) add(tokens[st.start], c.kind, c.why);
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.k !== "name") continue;
    const afterDot = isP(tokens[i - 1], ".") || isP(tokens[i - 1], "?.");
    if (t.v === "import" && !afterDot) {
      if (isP(tokens[i + 1], ".")) { add(t, "fold-import-meta", "import.meta is the bundler's and the runtime's, not a pure fold's"); continue; }
      if (isP(tokens[i + 1], "(")) {
        const a = tokens[i + 2], b = tokens[i + 3];
        if (a && a.k === "str" && isP(b, ")")) {
          imports.push({ spec: a.v, line: a.line, col: a.col, how: "dynamic" });
          const c = classifySpec(a.v);
          if (!c.ok) add(t, c.kind, c.why);
        } else add(t, "fold-dynamic-import", "an import() of a computed specifier cannot be checked, so it is refused");
      }
      continue;
    }
    if (afterDot && t.v !== "eval") continue;
    if (t.v === "require" && isP(tokens[i + 1], "(")) add(t, "fold-require", "require() loads anything; a fold imports with ESM, statically");
    else if (t.v === "eval" && isP(tokens[i + 1], "(")) add(t, "fold-eval", "eval runs a string as code");
    else if (t.v === "Function" && isP(tokens[i + 1], "(")) add(t, "fold-eval", "the Function constructor runs a string as code");
  }
  return { imports: imports.sort((x, y) => x.line - y.line || x.col - y.col), findings };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Views
// ───────────────────────────────────────────────────────────────────────────────────────────────

const BANNED_KEYWORDS = new Set(["if", "else", "switch", "case", "for", "while", "do", "try", "catch", "finally", "throw",
  "class", "new", "typeof", "instanceof", "in", "delete", "with", "debugger", "enum", "namespace", "declare", "abstract",
  "interface", "yield"]);
const OPERATORS = new Set(["<", ">", "<=", ">=", "==", "!=", "===", "!==", "+", "*", "/", "%", "**", "++", "--",
  "+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>=", ">>>=", "&=", "|=", "^=", "&&=", "||=", "??=",
  "&", "|", "^", "~", "<<", ">>", ">>>", "??", "?."]);
const MEMBER_CALLS = new Set(["map", "preventDefault", "stopPropagation", "focus", "blur", "select", "scrollIntoView"]);
const WALK_STOP_P = new Set([",", ";", "?", ":", "=", "=>", "...", "+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>=",
  ">>>=", "&=", "|=", "^=", "&&=", "||=", "??=", "jsx>"]);
const WALK_STOP_WORDS = new Set(["return", "case", "default", "else", "do", "throw", "yield", "export", "const", "let", "var"]);

const isOpen = (t) => t.k === "p" && (t.v === "(" || t.v === "[" || t.v === "{" || t.v === "${" || t.v === "`" || t.v === "jsx<");
const isClose = (t) => t.k === "p" && (t.v === ")" || t.v === "]" || t.v === "}" || t.v === "`end" || t.v === "jsx/>" || t.v === "jsx</>");

/** Is `t` a ternary `?` rather than an optional marker (`a?: T`, `(a?, b)`, `a? = x`)? */
function isTernary(tokens, i) {
  const t = tokens[i];
  if (!isP(t, "?")) return false;
  const n = tokens[i + 1];
  return !(isP(n, ":") || isP(n, ")") || isP(n, ",") || isP(n, "="));
}

/**
 * The index of the first token of the expression ending at `i`, walking back at one depth: a closing
 * bracket jumps to its opener, an opening bracket or a separator ends the walk. `stopAtLogic` also
 * stops at `&&` and `||`.
 */
function walkBack(tokens, i, stopAtLogic) {
  let j = i;
  for (;;) {
    const t = tokens[j];
    if (isClose(t)) { j = t.pair; }
    const cur = tokens[j];
    const p = tokens[j - 1];
    if (!p) return j;
    if (isOpen(p) && p.pair > j - 1) return j;
    if (p.k === "p" && WALK_STOP_P.has(p.v)) return j;
    if (stopAtLogic && p.k === "p" && (p.v === "&&" || p.v === "||")) return j;
    if (p.k === "name" && WALK_STOP_WORDS.has(p.v)) return j;
    if (cur.nl && isEnder(p) && isStarter(cur)) return j;
    j--;
  }
}

/** The index of the last token of the expression starting at `i`, walking forward at one depth. */
function walkForward(tokens, i, stopAtLogic) {
  let j = i;
  for (;;) {
    const t = tokens[j];
    if (isOpen(t) && t.pair > j) j = t.pair;
    const n = tokens[j + 1];
    if (!n) return j;
    if (isClose(n) && n.pair < j + 1) return j;
    if (n.k === "p" && WALK_STOP_P.has(n.v)) return j;
    if (stopAtLogic && n.k === "p" && (n.v === "&&" || n.v === "||")) return j;
    if (n.k === "name" && WALK_STOP_WORDS.has(n.v)) return j;
    if (n.nl && isEnder(tokens[j]) && isStarter(n)) return j;
    j++;
  }
}

/** Does tokens[s..e] read as a boolean expression: fields named as booleans, `!`, `&&`, `||` and parentheses? */
export function isBooleanExpression(tokens, s, e) {
  let i = s;
  const term = () => {
    if (i > e) return false;
    if (isP(tokens[i], "!")) {
      i++;
      if (i > e || isP(tokens[i], "!")) return false;
    }
    const t = tokens[i];
    if (isP(t, "(")) {
      const close = t.pair;
      if (close < 0 || close > e) return false;
      const inner = isBooleanExpression(tokens, i + 1, close - 1);
      i = close + 1;
      return inner;
    }
    if (!t || t.k !== "name" || (KEYWORDS.has(t.v) && !VALUE_WORDS.has(t.v))) return false;
    const root = t.v;
    let last = t.v;
    let segments = 1;
    i++;
    while (i <= e && isP(tokens[i], ".") && tokens[i + 1] && tokens[i + 1].k === "name" && i + 1 <= e) {
      last = tokens[i + 1].v;
      segments++;
      i += 2;
    }
    // A FIELD of what fold() returned (or of a row in it): at least `f.isX` / `row.isX`. A bare
    // `isBig` is a local the View named itself, and `ctx.*` / `props.*` is context, not fold's output
    // (face v2 Phase 02 spec-fidelity: `const isBig = f.count` passed on its name alone).
    return segments >= 2 && root !== "ctx" && root !== "props" && BOOLEAN_FIELD.test(last);
  };
  if (s > e) return false;
  if (!term()) return false;
  while (i <= e) {
    if (!(isP(tokens[i], "&&") || isP(tokens[i], "||"))) return false;
    i++;
    if (!term()) return false;
  }
  return i === e + 1;
}

/**
 * Every branch in a View.tsx, as findings. A View renders what fold() returned and decides nothing.
 * @returns {{ file: string, line: number, col: number, kind: string, detail: string }[]}
 */
export function scanView(text, file) {
  const { tokens, error } = lex(text, { jsx: true });
  const findings = [];
  const seen = new Set();
  const add = (t, kind, detail) => {
    const key = `${t.line}:${t.col}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ file, line: t.line, col: t.col, kind, detail });
  };
  if (error) { add(error, "view-unscannable", `the lint could not read this View past here: ${error.message}`); return findings; }
  if (tokens.length === 0) { add({ line: 1, col: 1 }, "view-unscannable", "an empty View.tsx renders nothing and is not a View"); return findings; }

  const statements = importStatements(tokens);
  const skip = new Uint8Array(tokens.length);
  /** name -> the specifier it was imported from */
  const imported = new Map();
  for (const st of statements) {
    for (let k = st.start; k <= st.end; k++) skip[k] = 1;
    for (const n of st.names) imported.set(n, st.spec);
  }

  const doneChains = new Set();
  for (let i = 0; i < tokens.length; i++) {
    if (skip[i]) continue;
    const t = tokens[i];
    const p = tokens[i - 1];
    const n = tokens[i + 1];

    if (t.k === "re") { add(t, "view-regex", "a regex is a decision; fold() makes it"); continue; }

    if (t.k === "name") {
      // A boolean is fold's to compute AND to name. A View that binds its own boolean-named name -- a
      // local, a parameter, a destructured or renamed key, an object key -- can make a boolean out of
      // anything and branch on it by name; only a property read (`f.isX`, `row.isX`) is fold's.
      if (!isP(p, ".") && !isP(p, "?.") && BOOLEAN_FIELD.test(t.v)) {
        add(t, "view-condition", `\`${t.v}\` is a boolean-named binding the View made itself -- read the field fold() returns (f.${t.v})`);
        continue;
      }
      const property = isP(p, ".") || isP(p, "?.") || (n && isP(n, ":") && (isP(p, "{") || isP(p, ",")) && tokens[t.inside] && tokens[t.inside].kind === "object");
      if (property) continue;
      if (BANNED_KEYWORDS.has(t.v)) { add(t, "view-keyword", `\`${t.v}\` in a View -- the decision belongs in fold.mjs`); continue; }
      if (t.v === "default" && !isName(p, "export")) { add(t, "view-keyword", "`default` outside `export default` is a switch arm"); continue; }
      if (t.v === "type" && n && n.k === "name" && (statementStart(tokens, i) || isName(p, "export"))) { add(t, "view-keyword", "a local type declaration -- a View's types come from fold.mjs's JSDoc"); continue; }
      if (t.v === "import" && isP(n, ".")) { add(t, "view-keyword", "import.meta in a View"); continue; }
      // A tagged template is a call.
      if (n && isP(n, "`") && !KEYWORDS.has(t.v)) { add(t, "view-call", `a tagged template \`${t.v}\`...\`\` is a call`); continue; }
      continue;
    }

    if (t.k !== "p") continue;

    if (t.v === "@") { add(t, "view-keyword", "a decorator in a View"); continue; }

    if (OPERATORS.has(t.v)) { add(t, "view-operator", `\`${t.v}\` in a View -- ${t.v === "?." || t.v === "??" ? "a null branch" : t.v === "<" || t.v === ">" ? "a comparison (or a type argument)" : "a comparison or an arithmetic"}; fold() computes it`); continue; }

    if (t.v === "-") {
      const literal = n && n.k === "num" && (!p || (p.k === "p" && ["(", "[", "{", ",", ":", "=", "=>", "?", "${"].includes(p.v)) || isName(p, "return"));
      if (!literal) add(t, "view-operator", "`-` in a View -- an arithmetic; fold() computes it");
      continue;
    }

    if (t.v === "=") {
      const enc = tokens[t.inside];
      if (enc && !(enc.v === "{" && enc.kind === "block")) {
        add(t, "view-default", enc.v === "{" && enc.kind === "object" || enc.v === "(" || enc.v === "["
          ? "a default value is a decision about a missing value; fold() returns the resolved one"
          : "an assignment inside an expression");
      }
      continue;
    }

    if (t.v === "!") {
      // After an operand, `!` is TypeScript's non-null assertion (`ref.current!`), not a negation.
      if (isEnder(p)) continue;
      if (isP(n, "!")) { add(t, "view-condition", "a double negation coerces a value to a boolean; fold() returns the boolean"); continue; }
      const end = walkForward(tokens, i + 1, true);
      // The operand of `!` is one term: up to the next `&&`/`||` at this depth.
      if (!isBooleanExpression(tokens, i, end)) add(t, "view-condition", "the operand of `!` is not a boolean field fold() returns (is/has/can/should/show...)");
      continue;
    }

    if (t.v === "?") {
      if (!isTernary(tokens, i)) continue;
      const start = walkBack(tokens, i - 1, false);
      if (!isBooleanExpression(tokens, start, i - 1)) add(tokens[start] ?? t, "view-condition", "a ternary's condition is not a boolean field fold() returns (is/has/can/should/show...)");
      // Nested: another ternary anywhere between this `?` and the end of its alternate.
      let j = i + 1;
      let colon = -1;
      for (; j < tokens.length; j++) {
        const u = tokens[j];
        if (isOpen(u) && u.pair > j) { for (let k = j + 1; k < u.pair; k++) if (isTernary(tokens, k)) { add(t, "view-nested-ternary", "a ternary inside a ternary -- fold() resolves it to one value"); break; } j = u.pair; continue; }
        if (isClose(u) && u.pair < i) break;
        if (isP(u, ",") || isP(u, ";")) break;
        if (u.k === "name" && WALK_STOP_WORDS.has(u.v)) break;
        if (isTernary(tokens, j)) { add(t, "view-nested-ternary", "a ternary inside a ternary -- fold() resolves it to one value"); break; }
        if (isP(u, ":")) { if (colon === -1) { colon = j; continue; } break; }
        if (u.nl && colon !== -1 && isEnder(tokens[j - 1]) && isStarter(u) && j > colon + 1) break;
      }
      continue;
    }

    if (t.v === "&&" || t.v === "||") {
      const start = walkBack(tokens, i - 1, false);
      if (doneChains.has(start)) continue;
      doneChains.add(start);
      const end = walkForward(tokens, i + 1, false);
      // A chain feeding a ternary is that ternary's condition, judged whole above.
      if (isTernary(tokens, end + 1)) continue;
      const operands = [];
      let s = start;
      let hasOr = false;
      for (let k = start; k <= end; k++) {
        const u = tokens[k];
        if (isOpen(u) && u.pair > k) { k = u.pair; continue; }
        if (isP(u, "&&") || isP(u, "||")) { operands.push([s, k - 1, u]); s = k + 1; if (u.v === "||") hasOr = true; }
      }
      // `cond && <X/>` renders its LAST operand, so that one is a value. An `||` has no such idiom:
      // its last operand is a default for a falsy first one, which is a decision -- all of it is judged.
      if (hasOr) operands.push([s, end]);
      for (const [os, oe] of operands) {
        if (!isBooleanExpression(tokens, os, oe)) add(tokens[os] ?? t, "view-condition", "a condition that is not a boolean field fold() returns (is/has/can/should/show...) -- fold() makes the decision and returns it named");
      }
      continue;
    }

    if (t.v === "(") {
      if (!p) continue;
      if (p.k === "name") {
        if (KEYWORDS.has(p.v) && p.prop !== true && p.v !== "import") continue; // `function (`, `if (` (already a finding), `return (`
        const before = tokens[i - 2];
        if (isName(before, "function")) continue; // a declaration names a function; it does not call one
        if (p.v === "import") { add(p, "view-call", "a dynamic import() in a View"); continue; }
        const member = isP(before, ".") || isP(before, "?.");
        // A handler is called through the context or the props a View was handed -- `ctx.onOpen(id)` --
        // never through data: `f.onCompute(x)` is a decision wearing a handler's name.
        let rootIdx = i - 1;
        while (rootIdx >= 2 && (isP(tokens[rootIdx - 1], ".") || isP(tokens[rootIdx - 1], "?.")) && tokens[rootIdx - 2].k === "name") rootIdx -= 2;
        const root = tokens[rootIdx];
        const ok = member
          ? MEMBER_CALLS.has(p.v) || (/^on[A-Z]/.test(p.v) && root && (root.v === "ctx" || root.v === "props"))
          : (/^use[A-Z]/.test(p.v) && imported.get(p.v) === "react") || (/^(on|set)[A-Z]/.test(p.v) && !imported.has(p.v));
        if (!ok) add(p, "view-call", `a call to \`${p.v}\` in a View -- a View calls .map, React's hooks, handlers and setters; fold() computes the rest`);
        continue;
      }
      if (isP(p, ")") || isP(p, "]") || isP(p, "`end")) { add(t, "view-call", "a call on the result of an expression in a View"); continue; }
      // `function () { ... }()`: a body's closing brace followed by a call.
      if (isP(p, "}") && p.pair > 0 && (isP(tokens[p.pair - 1], ")") || isP(tokens[p.pair - 1], "=>"))) { add(t, "view-call", "an immediately invoked function in a View"); continue; }
      continue;
    }

    if (t.v === "`" && p && (isP(p, ")") || isP(p, "]"))) { add(t, "view-call", "a tagged template on an expression is a call"); continue; }

    if (t.v === "[") {
      // A computed key -- `{ [f.state]: label }` or `const { [f.state]: x } = f.labels` -- is a lookup keyed by data.
      const enclosing = tokens[t.inside];
      if (p && (isP(p, "{") || isP(p, ",")) && enclosing && enclosing.v === "{" && enclosing.kind === "object") {
        add(t, "view-lookup", "a computed key is a lookup keyed by data; fold() returns the resolved value");
        continue;
      }
      // After `}` too: `{ open: 'Open', late: 'Late' }[f.state]` indexes an object literal.
      const member = p && ((p.k === "name" && (p.prop === true || !KEYWORDS.has(p.v) || VALUE_WORDS.has(p.v))) || isP(p, ")") || isP(p, "]") || isP(p, "}") || p.k === "str" || isP(p, "`end"));
      if (!member) continue;
      const inner = t.pair - i - 1;
      if (inner === 0) continue; // `Row[]`, an array type
      if (inner === 1 && tokens[i + 1].k === "num") continue;
      add(t, "view-lookup", "a lookup keyed by data is a branch; fold() returns the resolved value");
      continue;
    }
  }
  return findings.sort((a, b) => a.line - b.line || a.col - b.col);
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// The walk
// ───────────────────────────────────────────────────────────────────────────────────────────────

function sortedEntries(dir) {
  return readdirSync(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Whether every folder and file an import NAMES exists with exactly that spelling, walked from the
 * importing file's own folder. Every segment the specifier spells is checked -- including one reached
 * after climbing above face/src and coming back down (`../../../../SRC/lib/x.mjs`), which a check of
 * only the path below face/src passed on a case-insensitive disk (face v2 Phase 02 attack). The
 * folders the importer already lives in are not re-spelled, so an 8.3 short name in a temp path
 * cannot turn into a false finding.
 */
function specSpelledExactly(fromDir, spec) {
  let dir = fromDir;
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") { dir = dirname(dir); continue; }
    let names;
    try { names = readdirSync(dir); } catch { return false; }
    if (!names.includes(seg)) return false;
    dir = join(dir, seg);
  }
  return true;
}

/**
 * Lint a modules root: every ring folder, every module folder, every file of the four, and every
 * relative .mjs a module's .mjs files reach.
 * @param {string} root  the modules root (face/src/modules)
 * @param {{ srcRoot?: string, base?: string }} [opts]  srcRoot: where relative imports must stay (face/src);
 *        base: what finding paths are shown relative to
 */
export function lintModules(root, { srcRoot = dirname(root), base = process.cwd() } = {}) {
  const report = { modules: 0, folds: 0, views: 0, files: 0, findings: [] };
  const show = (p) => relative(base, p).split(sep).join("/") || ".";
  const finding = (p, kind, detail, line = 0, col = 0) => report.findings.push({ file: show(p), line, col, kind, detail });
  const visited = new Set();
  let srcReal = null;
  try { srcReal = realpathSync(srcRoot); } catch { /* reported per import below */ }

  const checkMjs = (abs) => {
    let real;
    try { real = realpathSync(abs); } catch { real = abs; }
    if (visited.has(real)) return;
    visited.add(real);
    let buf;
    try { buf = readFileSync(abs); } catch (e) { finding(abs, "fold-unscannable", `could not read: ${e.code ?? e.message}`); return; }
    if (buf.includes(0)) { finding(abs, "binary", "the file carries a NUL byte and cannot be scanned"); return; }
    const { imports, findings } = scanModuleImports(buf.toString("utf8"), show(abs));
    report.findings.push(...findings);
    for (const imp of imports) {
      const c = classifySpec(imp.spec);
      if (!c.ok || !c.relative) continue;
      const target = resolve(dirname(abs), imp.spec);
      if (srcReal === null) { finding(abs, "fold-outside-src", `face/src (${srcRoot}) could not be resolved, so ${imp.spec} cannot be shown to stay inside it`, imp.line, imp.col); continue; }
      let st;
      try { st = lstatSync(target); } catch { finding(abs, "fold-missing-import", `${imp.spec} resolves to a file that does not exist`, imp.line, imp.col); continue; }
      if (st.isSymbolicLink()) { finding(abs, "symlink", `${imp.spec} is a symlink -- an import that points somewhere else is not followed`, imp.line, imp.col); continue; }
      // Spelling before containment: a case-variant path must read the same on every OS, not as
      // missing on ext4 and as leaving face/src on APFS.
      if (!specSpelledExactly(dirname(abs), imp.spec)) { finding(abs, "fold-missing-import", `${imp.spec} matches a file only case-insensitively -- it would not resolve on a case-sensitive filesystem`, imp.line, imp.col); continue; }
      let targetReal;
      try { targetReal = realpathSync(target); } catch { targetReal = target; }
      const rel = relative(srcReal, targetReal);
      if (rel.startsWith("..") || isAbsolute(rel) || rel === "") { finding(abs, "fold-outside-src", `${imp.spec} leaves face/src -- a fold's imports stay inside the app`, imp.line, imp.col); continue; }
      if (rel.split(sep).includes("node_modules")) { finding(abs, "fold-import", `${imp.spec} reaches into node_modules`, imp.line, imp.col); continue; }
      if (!st.isFile()) { finding(abs, "fold-missing-import", `${imp.spec} is not a file`, imp.line, imp.col); continue; }
      checkMjs(target);
    }
  };

  const scanModule = (dir) => {
    const entries = sortedEntries(dir);
    const present = new Set(entries);
    for (const e of entries) if (!MODULE_FILES.includes(e)) finding(join(dir, e), "fifth-file", "a module is four files and no fifth (ADR-1320)");
    for (const f of MODULE_FILES) {
      const abs = join(dir, f);
      if (!present.has(f)) { finding(abs, "missing-file", `a module carries ${MODULE_FILES.join(", ")}; ${f} is missing`); continue; }
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) { finding(abs, "symlink", "a module file that is a symlink is not followed"); continue; }
      if (!st.isFile()) { finding(abs, "missing-file", `${f} is not a file`); continue; }
      report.files++;
      if (f === "View.tsx") {
        report.views++;
        const buf = readFileSync(abs);
        if (buf.includes(0)) { finding(abs, "binary", "the file carries a NUL byte and cannot be scanned"); continue; }
        report.findings.push(...scanView(buf.toString("utf8"), show(abs)));
      } else {
        if (f === "fold.mjs") report.folds++;
        checkMjs(abs);
      }
    }
  };

  let st;
  try { st = lstatSync(root); } catch (e) {
    if (e && e.code === "ENOENT") { finding(root, "absent-root", "the modules root is absent -- renamed, moved or re-cased?"); return report; }
    throw new Error(`cannot read root ${root}: ${e.message}`);
  }
  if (st.isSymbolicLink()) { finding(root, "symlink", "a modules root that is a symlink is not followed"); return report; }
  if (!st.isDirectory()) { finding(root, "not-a-folder", "the modules root is not a directory"); return report; }
  try {
    if (!readdirSync(dirname(root)).includes(basename(root))) { finding(root, "root-case", "the root's spelling does not match the folder on disk"); return report; }
  } catch { /* the parent is unreadable; the walk below reports what it can */ }

  for (const ring of sortedEntries(root)) {
    const rp = join(root, ring);
    const rs = lstatSync(rp);
    if (rs.isSymbolicLink()) { finding(rp, "symlink", "not followed -- a ring folder is a real directory"); continue; }
    if (!rs.isDirectory()) { finding(rp, rs.isFile() ? "not-a-folder" : "special", "only ring folders live at the top of the modules root"); continue; }
    if (!NAME.test(ring) || WINDOWS_DEVICE.test(ring)) finding(rp, "bad-name", "a ring folder is a kebab-case ring name");
    const ids = sortedEntries(rp);
    if (ids.length === 0) finding(rp, "empty-ring", "a ring folder with no module in it");
    for (const id of ids) {
      const dp = join(rp, id);
      const ds = lstatSync(dp);
      if (ds.isSymbolicLink()) { finding(dp, "symlink", "not followed -- a module folder is a real directory"); continue; }
      if (!ds.isDirectory()) { finding(dp, ds.isFile() ? "not-a-folder" : "special", "only module folders live inside a ring folder"); continue; }
      if (!NAME.test(id) || WINDOWS_DEVICE.test(id)) finding(dp, "bad-name", "a module folder is a kebab-case room id (and never a Windows device name)");
      report.modules++;
      scanModule(dp);
    }
  }
  return report;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// The CLI
// ───────────────────────────────────────────────────────────────────────────────────────────────

export function parseArgs(argv) {
  let root = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a !== "--root") throw new Error(`unknown argument ${JSON.stringify(a)} (the only flag is --root PATH)`);
    if (root !== null) throw new Error("--root given twice -- which one is meant is not a guess");
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--") || v.trim() === "") throw new Error("--root needs a path");
    root = v;
    i++;
  }
  return { root };
}

function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { console.error(`face-pure: ${e.message}`); return 2; }
  const root = opts.root === null ? join(REPO, DEFAULT_ROOT) : resolve(process.cwd(), opts.root);
  const base = opts.root === null ? REPO : process.cwd();
  let report;
  try { report = lintModules(root, { srcRoot: dirname(root), base }); }
  catch (e) { console.error(`face-pure: ${e.message}`); return 2; }
  for (const f of report.findings) console.log(oneLine(`FAIL ${f.file}:${f.line}:${f.col} ${f.kind} ${f.detail}`));
  if (report.modules === 0) console.log("FAIL nothing was scanned -- zero modules is not a pure tree");
  console.log(`face-pure: modules=${report.modules} folds=${report.folds} views=${report.views} files=${report.files} findings=${report.findings.length}`);
  return report.modules > 0 && report.folds > 0 && report.views > 0 && report.findings.length === 0 ? 0 : 1;
}

/** "Was this file RUN, or imported?" -- realpath on BOTH sides, so a symlink or a renamed path still runs it. */
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) process.exitCode = main(process.argv.slice(2));
