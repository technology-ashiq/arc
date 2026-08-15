// growth/guard -- REQ-03, ADR-1102. A PARSE of the publish command's module graph, never a grep.
//
// WHY NOT A GREP. `retro-log` 2026-08-04: a propose-only guard for that lane's most important rule
// was a grep, and it missed `from "fs"`, `fs/promises`, `child_process` and async exec/spawn. A
// mutant that overwrote the canonical file, deleted the champion, committed and spawned a deploy
// walked past it clean.
//
// So this walks the graph. From an entry file it follows every LOCAL import transitively and
// collects, per module, the specifiers it imports. The difference from a grep is not cosmetic:
//
//   - the source is TOKENISED FIRST -- comments and string/template literals are blanked -- so an
//     import named inside a comment or a string is not counted, and an import whose specifier is
//     built by concatenation is FLAGGED rather than silently missed;
//   - every import FORM is handled: static, side-effect-only, `import()` dynamic, and `require()`;
//   - the walk is transitive, so a capability re-exported one module deep is still found. The grep
//     that failed was reading one file.
//
// WHAT IT PROVES, precisely:
//   1. `child_process` (any spelling) is imported by AT MOST ONE module in the graph, and that
//      module is the declared choke point.
//   2. The choke point's allowlists contain no banned verb, and its protected-branch list is
//      non-empty. (Read from the module's own exports, not re-typed here.)
//   3. No module in the graph imports a deploy surface.
//
// WHAT IT DOES NOT PROVE, said out loud so nobody reads more into a green result: it cannot see
// what a subprocess does once started, and it cannot follow a specifier this code flags as
// non-literal. Both are reported rather than assumed away, and every finding is NAMED so a mutant
// cannot pass by crashing on something unrelated.

import { readFileSync } from "node:fs";
import { dirname, resolve as resolvePath, sep } from "node:path";

export class GuardError extends Error {
  constructor(code, message) { super(message); this.name = "GuardError"; this.code = code; }
}

const CHILD_PROCESS = /^(node:)?child_process$/;
// Deploy surfaces. A publish command that can reach one of these can ship without a human.
const DEPLOY_SPECIFIER = /(^|\/)(vercel|netlify|deploy-hook|@vercel)/i;

/**
 * Blank out comments and string/template literals, preserving length and newlines so offsets and
 * line numbers still line up. This is the step that makes the result a parse rather than a search:
 * text that only LOOKS like code stops counting.
 */
export function stripCodeNoise(src) {
  const s = String(src);
  let out = "";
  let i = 0;
  const n = s.length;
  const keep = (c) => (c === "\n" ? "\n" : " ");
  while (i < n) {
    const c = s[i];
    const d = s[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && s[i] !== "\n") { out += keep(s[i]); i++; }
      continue;
    }
    if (c === "/" && d === "*") {
      out += "  "; i += 2;
      while (i < n && !(s[i] === "*" && s[i + 1] === "/")) { out += keep(s[i]); i++; }
      out += i < n ? "  " : ""; i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += " "; i++;
      while (i < n) {
        if (s[i] === "\\") { out += "  "; i += 2; continue; }
        if (s[i] === quote) { out += " "; i++; break; }
        out += keep(s[i]); i++;
      }
      continue;
    }
    out += c; i++;
  }
  return out;
}

// Import forms. Run against the ORIGINAL source but anchored at offsets found in the stripped one,
// so a specifier is read from real bytes while its POSITION is proven to be code.
const IMPORT_AT = [
  { name: "static", re: /\bimport\b[^;\n]*?\bfrom\s*$/ },
  { name: "bare", re: /\bimport\s*$/ },
  { name: "dynamic", re: /\bimport\s*\(\s*$/ },
  { name: "require", re: /\brequire\s*\(\s*$/ },
];

/**
 * Every import specifier in a module, with the form that introduced it.
 *
 * Non-literal specifiers -- `import(base + name)` -- are returned with `literal: false` and a null
 * specifier. They are a FINDING, not a silent pass: a graph walker that cannot resolve a specifier
 * has not proven anything about what is behind it.
 */
export function importsOf(src) {
  const stripped = stripCodeNoise(src);
  const found = [];
  // Walk the ORIGINAL for quoted specifiers, and use the STRIPPED text to decide whether the
  // preceding characters are really code.
  const quoted = /(['"])([^'"\n]*)\1/g;
  let m;
  while ((m = quoted.exec(src)) !== null) {
    const before = stripped.slice(Math.max(0, m.index - 120), m.index);
    const form = IMPORT_AT.find((f) => f.re.test(before));
    if (form) found.push({ specifier: m[2], form: form.name, literal: true, index: m.index });
  }
  // Non-literal dynamic imports and requires: the call exists in code but the argument is not a
  // string literal at that position.
  const dyn = /\b(import|require)\s*\(\s*([^)'"\s][^)]*)\)/g;
  while ((m = dyn.exec(stripped)) !== null)
    found.push({ specifier: null, form: m[1] === "import" ? "dynamic" : "require", literal: false, index: m.index });
  return found;
}

// Network calls, found in CODE (the source is tokenised first, so a mention in a comment or a
// string does not count).
//
// This rule exists because the import audit alone could not see the third escape. A direct write
// to a deploy hook needs NO IMPORT AT ALL -- `fetch` is a global. A mutant doing
// `await fetch(hookUrl, {method:"POST"})` imported nothing, so a guard that only walked import
// specifiers reported a clean graph while the escape was right there. The publish ASSEMBLY graph
// has no legitimate reason to reach the network: the link checking lives in citation-lint, which
// is not in this graph.
const NETWORK_CALL_RE = /\b(fetch|XMLHttpRequest)\s*\(|\bhttps?\s*\.\s*(request|get)\s*\(/g;

const isLocal = (spec) => typeof spec === "string" && (spec.startsWith("./") || spec.startsWith("../"));

/** Walk the graph from `entry`, following local imports transitively. */
export function moduleGraph(entry) {
  const seen = new Map();
  const queue = [resolvePath(entry)];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    let src;
    try { src = readFileSync(file, "utf8"); }
    catch (e) { throw new GuardError("UNREADABLE", `module ${file} cannot be read: ${e.message}`); }
    const imports = importsOf(src);
    const stripped = stripCodeNoise(src);
    const network = [...stripped.matchAll(NETWORK_CALL_RE)].map((m) => m[0].trim());
    seen.set(file, { imports, network });
    for (const im of imports) {
      if (!im.literal || !isLocal(im.specifier)) continue;
      queue.push(resolvePath(dirname(file), im.specifier));
    }
  }
  return seen;
}

/**
 * The E2 assertion.
 *
 * Returns a list of findings. EMPTY means the graph carries no merge, no default-branch push and
 * no deploy capability. Every finding names WHICH rule caught it and in WHICH module, so the
 * running mutant's three escapes are attributable one by one -- a mutant that dies on an unrelated
 * fault is not a passing negative control (ADR-1102).
 */
export function auditPublishGraph(entry, { chokePoint } = {}) {
  const graph = moduleGraph(entry);
  const findings = [];
  const rel = (f) => f.split(sep).slice(-3).join("/");
  const chokeAbs = chokePoint ? resolvePath(chokePoint) : null;

  for (const [file, mod] of graph) {
    for (const call of mod.network)
      findings.push({ rule: "NETWORK_CALL", module: rel(file),
        detail: `calls ${JSON.stringify(call)} -- a deploy hook needs no import, so the import audit alone cannot see this escape` });
    for (const im of mod.imports) {
      if (!im.literal) {
        findings.push({ rule: "NON_LITERAL_IMPORT", module: rel(file),
          detail: `a ${im.form}() whose specifier is not a string literal -- the graph cannot be proven past it` });
        continue;
      }
      if (CHILD_PROCESS.test(im.specifier)) {
        if (!chokeAbs || file !== chokeAbs)
          findings.push({ rule: "SPAWN_OUTSIDE_CHOKE_POINT", module: rel(file),
            detail: `imports ${im.specifier}; only the declared choke point may spawn a subprocess` });
      }
      if (DEPLOY_SPECIFIER.test(im.specifier))
        findings.push({ rule: "DEPLOY_IMPORT", module: rel(file),
          detail: `imports ${im.specifier} -- a publish command that can reach a deploy surface can ship without a human` });
    }
  }
  return { modules: [...graph.keys()].map(rel), findings };
}

/**
 * The second half: the choke point's own tables may not contain a banned verb, and its
 * protected-branch list may not be empty.
 *
 * Read from the module's EXPORTS rather than re-typed here. A copy of the list in this file would
 * be a second thing to keep in sync, and the two would disagree the first time either moved --
 * which is the class of defect this lane has hit most often.
 */
export function auditAllowlists(mod) {
  const findings = [];
  const banned = new Set((mod.BANNED_VERBS || []).map((v) => String(v).toLowerCase()));
  if (banned.size === 0)
    findings.push({ rule: "EMPTY_BANNED_LIST", module: "exec-allowlist", detail: "BANNED_VERBS is empty, so the check passes vacuously" });
  if (!Array.isArray(mod.PROTECTED_BRANCHES) || mod.PROTECTED_BRANCHES.length === 0)
    findings.push({ rule: "EMPTY_PROTECTED_LIST", module: "exec-allowlist", detail: "PROTECTED_BRANCHES is empty, so every push target is allowed" });
  for (const [name, list] of [["GIT_ALLOWED", mod.GIT_ALLOWED], ["GH_ALLOWED", mod.GH_ALLOWED], ["GH_PR_ALLOWED", mod.GH_PR_ALLOWED]]) {
    for (const verb of list || [])
      if (banned.has(String(verb).toLowerCase()))
        findings.push({ rule: "BANNED_VERB_ALLOWED", module: "exec-allowlist", detail: `${name} contains ${JSON.stringify(verb)}, which is on BANNED_VERBS` });
    // A verb that is banned but absent from every allowlist is fine; a verb ALLOWED that names a
    // merge or a deploy is the mutant this catches.
    for (const verb of list || [])
      if (/^(merge|deploy|promote|ship)$/i.test(String(verb)))
        findings.push({ rule: "PUBLISHING_VERB_ALLOWED", module: "exec-allowlist", detail: `${name} contains the publishing verb ${JSON.stringify(verb)}` });
  }
  return findings;
}
