// json-strict.mjs — see what JSON.parse hides: duplicate object keys.
//
// `JSON.parse` is last-wins, so a manifest whose BYTES contain a forbidden value can lint clean
// because a later duplicate of the same key overwrites it. The adversarial pass on the `evolve`
// section built exactly that: `"promote_via":["app/pricing/plans.tsx"],"promote_via":["ok.tsx"]`
// linted green while the money path sat in the file, and any first-wins reader downstream sees
// the money path. The refusal must not depend on duplicate-key ordering.
//
// Keys are compared DECODED, because that is what JSON.parse collapses on: "txn" and "txn"
// are one key to the parser, so a scanner comparing raw text lets a smuggled duplicate through.
//
// The spine has its own richer walk in hq/lib/canonical.mjs (it additionally enforces
// number-token round-tripping and a depth ceiling, both spine-specific). This one is deliberately
// narrower and lives in core so the manifest linter — a core file that must not import hq — can
// use it. Same attack class, two call sites, different jobs.

const SIMPLE_ESCAPES = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
// Deep enough for any real manifest, shallow enough that the walk cannot be used to exhaust
// memory with a million-deep skeleton.
const MAX_DEPTH = 100;

/**
 * Walk raw JSON text and throw on the first duplicate key.
 * @param {string} text
 * @param {string} where  message prefix
 * @throws {Error} with `.code === "DUP_KEY"` or `"BAD_JSON"` or `"DEPTH_EXCEEDED"`
 */
export function assertNoDuplicateKeys(text, where = "input") {
  const fail = (code, msg) => { const e = new Error(`${where}: ${msg}`); e.code = code; throw e; };
  const n = text.length;
  const stack = [];
  let expectKey = false;
  let i = 0;

  const readString = () => {
    i++; // opening quote
    let out = "";
    while (i < n) {
      const c = text[i];
      if (c === "\\") {
        const e = text[i + 1];
        if (e === undefined) fail("BAD_JSON", "unterminated escape");
        if (e === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("BAD_JSON", "malformed \\u escape");
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        if (!(e in SIMPLE_ESCAPES)) fail("BAD_JSON", `invalid escape \\${e}`);
        out += SIMPLE_ESCAPES[e];
        i += 2;
        continue;
      }
      if (c === '"') { i++; return out; }
      if (text.charCodeAt(i) < 0x20) fail("BAD_JSON", "raw control character inside a string");
      out += c;
      i++;
    }
    fail("BAD_JSON", "unterminated string");
  };

  while (i < n) {
    const c = text[i];
    if (c === '"') {
      const s = readString();
      if (expectKey) {
        const top = stack[stack.length - 1];
        if (top && top.type === "obj") {
          if (top.keys.has(s)) fail("DUP_KEY", `duplicate object key "${s}" — JSON.parse is last-wins, so one of the two values is invisible`);
          top.keys.add(s);
        }
        expectKey = false;
      }
      continue;
    }
    if (c === "{" || c === "[") {
      stack.push(c === "{" ? { type: "obj", keys: new Set() } : { type: "arr" });
      if (stack.length > MAX_DEPTH) fail("DEPTH_EXCEEDED", `nesting deeper than ${MAX_DEPTH}`);
      expectKey = c === "{";
      i++;
      continue;
    }
    if (c === "}" || c === "]") { stack.pop(); expectKey = false; i++; continue; }
    if (c === ",") { const top = stack[stack.length - 1]; expectKey = !!top && top.type === "obj"; i++; continue; }
    i++;
  }
}
