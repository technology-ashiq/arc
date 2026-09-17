#!/usr/bin/env node
// face-pure.mjs -- the module-contract lint proven against planted breaks, with no install
// (face v2 Phase 02, REQ-03, ADR-1320). The lint is .claude/scripts/core/face-pure.mjs; this file
// imports it, so before the lint exists this suite dies with ERR_MODULE_NOT_FOUND and prints no
// RAN line -- the red that comes first.
//
// What is proven here, and where:
//   - a View.tsx carries no branch worth asserting: every construct the assumptions ledger names
//     (`{x > 0 && <X/>}`, a ternary on raw payload data, a comparison inside a template literal)
//     FAILs, and a condition on a boolean field fold() returns passes;
//   - a fold.mjs (and module.mjs, ops.mjs) imports only relative .mjs and node builtins, followed
//     through every relative import it makes;
//   - a module folder is exactly four files;
//   - the CLI FAILs a planted branch in a View.tsx and a planted React import in a fold.mjs, and
//     scans more than zero files on the real tree;
//   - every real module's .mjs files are imported by node with no install, and the boolean-named
//     fields its fold returns are booleans.
//
// VACUOUS-PASS GUARD: the first check proves the lint loaded with its exports; the real tree must
// report counts above zero; the last line is "RAN: <n> checks, <f> failed".
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, statSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LINT = join(REPO, ".claude", "scripts", "core", "face-pure.mjs");
const MODULES = join(REPO, "face", "src", "modules");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const lint = await import(pathToFileURL(LINT).href);
check("the lint loaded with its scan and walk exports",
  typeof lint.scanView === "function" && typeof lint.scanModuleImports === "function"
  && typeof lint.lintModules === "function" && lint.BOOLEAN_FIELD instanceof RegExp
  && Array.isArray(lint.MODULE_FILES) && lint.MODULE_FILES.length === 4);

const cli = (...args) => spawnSync(process.execPath, [LINT, ...args], { encoding: "utf8", cwd: REPO });
const viewFindings = (body) => lint.scanView(body, "View.tsx");
const show = (fs) => JSON.stringify(fs.map((f) => `${f.kind}@${f.line}:${f.col} ${f.detail ?? ""}`));

/** A whole View.tsx around one JSX expression, so each case reads as the construct it is about. */
const view = (jsx, { head = "", body = "" } = {}) => [
  "import type { ModuleViewProps } from '../../../lib/registry.mjs'",
  "import type { Folded } from './fold.mjs'",
  head,
  "export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewProps }) {",
  body,
  `  return <div>${jsx}</div>`,
  "}",
  "",
].join("\n");

const passes = (name, text) => {
  const fs = viewFindings(text);
  check(`View passes: ${name}`, fs.length === 0, show(fs));
};
const fails = (name, text, kind) => {
  const fs = viewFindings(text);
  check(`View FAILs: ${name} (${kind})`, fs.some((f) => f.kind === kind), show(fs));
};

// ── what a View may do ──
passes("a condition on a boolean field fold() returns", view("{f.isEmpty && <p>nothing yet</p>}"));
passes("a ternary on a boolean field", view("{f.hasRows ? <ul /> : <p>none</p>}"));
passes("a negated boolean field", view("{!f.isEmpty && <ul />}"));
passes("a chain of boolean fields, parenthesised", view("{f.isA && (f.isB || f.canC) && <b>x</b>}"));
passes("an or of boolean fields picking a branch", view("{f.isA || f.shouldB ? <b>a</b> : <i>b</i>}"));
passes("a map over rows with a row's own boolean field", view("<ul>{f.rows.map((row) => <li key={row.id}>{row.isLate && <b>late</b>}</li>)}</ul>"));
passes("JSX text carrying words and symbols a scanner could mistake for code",
  view("<p>if you can, 3 > 2 and a - b; for all rooms: switch off, case closed ?? yes</p>"));
passes("attribute strings carrying Tailwind classes and a comparison in prose",
  view('<div className="h-[30px] -ml-1 w-1/2 lg:pl-[240px]" title="a > b, 50% off">x</div>'));
passes("a template literal with a field and no operator", view("<div style={{ width: `${f.pct}%` }} />"));
passes("a negative number literal", view("<button tabIndex={-1} type=\"button\">x</button>"));
passes("a handler prop through ctx, guarded by a boolean field",
  view("<button type=\"button\" onClick={() => f.canOpen && ctx.onOpen(f.id)}>open</button>"));
passes("a React hook and a local setter",
  view("<button type=\"button\" onClick={() => setOpen(true)}>{f.label}</button>",
    { head: "import { useState } from 'react'", body: "  const [open, setOpen] = useState(false)" }));
passes("an event's own preventDefault", view("<form onSubmit={(e) => { e.preventDefault(); ctx.onOpen(f.id) }} />"));
passes("a re-exported icon and a kit component",
  view("<Empty title={f.title} />", { head: "import { Empty } from '../../../ui/bits'\nexport { Tray as Icon } from '@phosphor-icons/react'" }));
passes("comments carrying code that would fail", view("{/* if (a > b) return x ?? y */}<p>{f.title}</p>", { body: "  // switch (f.kind) { case 1: return a - b }" }));
passes("a string carrying code that would fail", view("<Empty title=\"if (a > b) { return null }\" hint={'x ?? y'} />"));
passes("a fragment and a self-closing tag with a spread", view("<><Row {...f.row} /></>"));
passes("an indexed read of a literal position", view("<p>{f.rows[0]}</p>"));

// ── what the assumptions ledger names: branches hidden in JSX, not only literal `if` ──
fails("a comparison hidden in a JSX condition", view("{f.count > 0 && <p>some</p>}"), "view-operator");
fails("a ternary on raw payload data", view("{f.count ? <p>some</p> : <p>none</p>}"), "view-condition");
fails("a template literal holding a comparison", view("<p title={`${f.n > 1 ? 's' : ''}`}>x</p>"), "view-operator");
fails("an or-default on a non-boolean value", view("<p>{f.label || 'none'}</p>"), "view-condition");
fails("an and-chain whose middle operand is not a boolean field", view("{f.isA && f.count && <p>x</p>}"), "view-condition");
fails("a condition on a call's result", view("{f.isOk() && <p>x</p>}"), "view-condition");
fails("a double negation coercing a value", view("{!!f.count && <p>x</p>}"), "view-condition");
fails("a condition on a field that is not named as a boolean", view("{f.open && <p>x</p>}"), "view-condition");
fails("a parenthesised or that smuggles a value", view("{(f.isA || f.label) && <p>x</p>}"), "view-condition");

// ── literal branches and operators ──
fails("an if statement", view("<p />", { body: "  if (f.isA) return null" }), "view-keyword");
fails("a switch", view("<p />", { body: "  switch (f.kind) { case 'a': return null }" }), "view-keyword");
fails("a for loop", view("<p />", { body: "  for (const r of f.rows) { void r }" }), "view-keyword");
fails("a try/catch", view("<p />", { body: "  try { ctx.onOpen(f.id) } catch { void 0 }" }), "view-keyword");
fails("a nested ternary", view("{f.isA ? f.isB ? <b /> : <i /> : <u />}"), "view-nested-ternary");
fails("a nested ternary inside a branch's attribute", view("{f.isA ? <b title={f.isB ? 'x' : 'y'} /> : <u />}"), "view-nested-ternary");
fails("arithmetic", view("<p>{f.a + f.b}</p>"), "view-operator");
fails("arithmetic in a statement", view("<p />", { body: "  const last = f.rows.length - 1" }), "view-operator");
fails("a nullish default", view("<p>{f.name ?? 'x'}</p>"), "view-operator");
fails("optional chaining", view("<p>{f.user?.name}</p>"), "view-operator");
fails("an equality", view("{f.kind === 'a' && <p>x</p>}"), "view-operator");
fails("a type argument, which reads as a comparison", view("<p />", { head: "import { useState } from 'react'", body: "  const [a] = useState<boolean>(false)" }), "view-operator");
fails("typeof", view("{typeof f.x && <p>x</p>}"), "view-keyword");
fails("new", view("<p>{new Date().getFullYear()}</p>"), "view-keyword");
fails("a local type declaration", view("<p />", { head: "type Row = { a: string }" }), "view-keyword");
fails("a class", view("<p />", { head: "class Box { }" }), "view-keyword");
fails("a regex literal", view("{/x/.test(f.s) && <p>x</p>}"), "view-regex");

// ── decisions with no operator token ──
fails("a filter call", view("<ul>{f.rows.filter((r) => r.isOpen).map((r) => <li key={r.id} />)}</ul>"), "view-call");
fails("Math", view("<p>{Math.max(f.a, f.b)}</p>"), "view-call");
fails("an imported helper called in the View", view("<p>{label(f)}</p>", { head: "import { label } from '../../../lib/rooms.mjs'" }), "view-call");
fails("an imported function wearing a handler's name", view("<p>{onCompute(f)}</p>", { head: "import { onCompute } from '../../../lib/rooms.mjs'" }), "view-call");
fails("a hook that is not React's", view("<p>{useLabel(f)}</p>", { head: "import { useLabel } from '../../../lib/rooms.mjs'" }), "view-call");
fails("a tagged template", view("<p>{css`x`}</p>"), "view-call");
fails("a dynamic import", view("<p />", { body: "  void import('./fold.mjs')" }), "view-call");
fails("a lookup keyed by data", view("<p>{LABELS[f.kind]}</p>"), "view-lookup");
fails("a lookup keyed by a string", view("{f['isA'] && <p>x</p>}"), "view-lookup");
fails("a destructuring default", "export default function View({ f, limit = 5 }: { f: Folded; limit: number }) {\n  return <p>{f.title}</p>\n}\n", "view-default");

// ── a file the scanner cannot read is a finding, never a quiet pass ──
fails("an unterminated string", view("<p>{'open}</p>"), "view-unscannable");
fails("an unclosed JSX element", "export default function View() {\n  return <div><p>x</div>\n}\n", "view-unscannable");
{
  const fs = viewFindings("");
  check("an empty View.tsx is a finding (nothing to render is not a View)", fs.some((f) => f.kind === "view-unscannable"), show(fs));
}
{
  const fs = viewFindings(view("{f.count > 0 && <p>x</p>}"));
  const hit = fs.find((f) => f.kind === "view-operator");
  check("a finding carries the line and column of the construct", hit && hit.line === 6 && hit.col > 1, show(fs));
}

// ── fold.mjs / module.mjs / ops.mjs imports ──
const importKinds = (text) => lint.scanModuleImports(text, "fold.mjs").findings.map((f) => f.kind);
const importPasses = (name, text) => {
  const r = lint.scanModuleImports(text, "fold.mjs");
  check(`fold import passes: ${name}`, r.findings.length === 0, JSON.stringify(r.findings));
};
const importFails = (name, text, kind) => {
  const k = importKinds(text);
  check(`fold import FAILs: ${name} (${kind})`, k.includes(kind), JSON.stringify(k));
};
importPasses("a relative .mjs", 'import { a } from "./helper.mjs";\nexport function fold() { return a; }\n');
importPasses("a node: builtin", 'import { join } from "node:path";\nexport const x = join;\n');
importPasses("a bare builtin", 'import path from "path";\nexport const x = path;\n');
importPasses("a re-export from a relative .mjs", 'export { byRing } from "../../../lib/rooms.mjs";\n');
importPasses("an import spelled inside a comment and a string", '// import React from "react"\nexport const s = "import React from \'react\'";\n');
importPasses("a regex literal holding a quote", 'export const re = /[\'"]react["\']/g;\nexport const q = 1 / 2;\n');
{
  const r = lint.scanModuleImports('import a from "./a.mjs";\nexport * from "./b.mjs";\nexport { c } from "node:fs";\n', "fold.mjs");
  check("every static specifier is reported with its line", r.imports.map((i) => `${i.spec}@${i.line}`).join(",") === "./a.mjs@1,./b.mjs@2,node:fs@3", JSON.stringify(r.imports));
}
importFails("React", 'import React from "react";\n', "fold-import");
importFails("a named import from react", "import { useState } from 'react'\n", "fold-import");
importFails("three", 'import * as THREE from "three";\n', "fold-import");
importFails("vite", 'import { defineConfig } from "vite";\n', "fold-import");
importFails("a stylesheet", 'import "./style.css";\n', "fold-import");
importFails("a .js file", 'import x from "./helper.js";\n', "fold-import");
importFails("a .tsx file", 'import View from "./View.tsx";\n', "fold-import");
importFails("a query on a .mjs", 'import x from "./helper.mjs?raw";\n', "fold-import");
importFails("an absolute path", 'import x from "/abs/helper.mjs";\n', "fold-import");
importFails("a file URL", 'import x from "file:///x/helper.mjs";\n', "fold-import");
importFails("an alias", 'import x from "@/lib/rooms.mjs";\n', "fold-import");
importFails("a re-export of a package", 'export * from "react";\n', "fold-import");
importFails("a literal dynamic import of a package", 'export const R = await import("react");\n', "fold-import");
importFails("a computed dynamic import", "export const load = (n) => import(n);\n", "fold-dynamic-import");
importFails("createRequire from node:module", 'import { createRequire } from "node:module";\n', "fold-loader");
importFails("vm from a bare builtin", 'import vm from "vm";\n', "fold-loader");
importFails("child_process", 'import { execSync } from "node:child_process";\n', "fold-loader");
importFails("require", 'const R = require("react");\n', "fold-require");
importFails("import.meta", "export const all = import.meta.glob('./x/*.mjs');\n", "fold-import-meta");
importFails("eval", "export const x = eval(\"1\");\n", "fold-eval");
importFails("the Function constructor", "export const f = new Function(\"return 1\");\n", "fold-eval");
importFails("an unterminated template", "export const s = `open ${1;\n", "fold-unscannable");

// ── scratch trees: the four-file shape, transitive imports, and the CLI ──
const scratch = mkdtempSync(join(tmpdir(), "face-pure-"));
const FOLD_OK = "/** @typedef {{ title: string }} Folded */\nexport function fold(payloads, ctx) { return { title: String(ctx.room.name) }; }\n";
const MODULE_OK = (ring, id) => `export default Object.freeze({ id: ${JSON.stringify(id)}, ring: ${JSON.stringify(ring)}, routes: Object.freeze([]), asOf: true });\n`;
const OPS_OK = "export const ops = Object.freeze([]);\n";
const VIEW_OK = view("<p>{f.title}</p>");
const writeModule = (root, ring, id, files = {}) => {
  const dir = join(root, ring, id);
  mkdirSync(dir, { recursive: true });
  const all = { "module.mjs": MODULE_OK(ring, id), "fold.mjs": FOLD_OK, "ops.mjs": OPS_OK, "View.tsx": VIEW_OK, ...files };
  for (const [name, text] of Object.entries(all)) if (text !== null) writeFileSync(join(dir, name), text);
  return dir;
};
const tree = (name) => {
  const src = join(scratch, name, "face", "src");
  const root = join(src, "modules");
  mkdirSync(join(src, "lib"), { recursive: true });
  mkdirSync(root, { recursive: true });
  return { src, root };
};
const lintTree = (t) => lint.lintModules(t.root, { srcRoot: t.src, base: t.src });
const kindsIn = (report) => report.findings.map((f) => f.kind);

try {
  {
    const t = tree("clean");
    writeModule(t.root, "command", "alpha");
    writeModule(t.root, "kernel", "beta");
    const r = lintTree(t);
    check("a clean scratch tree: 2 modules, 2 folds, 2 views, 8 files, no findings",
      r.modules === 2 && r.folds === 2 && r.views === 2 && r.files === 8 && r.findings.length === 0, JSON.stringify(r));
    const c = spawnSync(process.execPath, [LINT, "--root", t.root], { encoding: "utf8", cwd: join(scratch, "clean") });
    check("the CLI passes the clean scratch tree with exit 0", c.status === 0 && /face-pure: modules=2 folds=2 views=2 files=8 findings=0/.test(c.stdout), c.stdout + c.stderr);
  }
  {
    const t = tree("planted-branch");
    writeModule(t.root, "command", "alpha", { "View.tsx": view("{f.count > 0 && <p>some</p>}") });
    const c = spawnSync(process.execPath, [LINT, "--root", t.root], { encoding: "utf8" });
    check("PLANTED: a branch in a View.tsx exits 1", c.status === 1, `status=${c.status} ${c.stdout}${c.stderr}`);
    check("PLANTED: the branch is named by file, line and kind", /FAIL .*command\/alpha\/View\.tsx:6:\d+ view-operator/.test(c.stdout), c.stdout);
  }
  {
    const t = tree("planted-react");
    writeModule(t.root, "command", "alpha", { "fold.mjs": 'import { useMemo } from "react";\nexport function fold() { return { title: String(useMemo) }; }\n' });
    const c = spawnSync(process.execPath, [LINT, "--root", t.root], { encoding: "utf8" });
    check("PLANTED: a React import in a fold.mjs exits 1", c.status === 1, `status=${c.status} ${c.stdout}${c.stderr}`);
    check("PLANTED: the import is named by file, line and kind", /FAIL .*command\/alpha\/fold\.mjs:1:\d+ fold-import/.test(c.stdout), c.stdout);
  }
  {
    const t = tree("transitive");
    writeModule(t.root, "command", "alpha", { "fold.mjs": 'import { h } from "./helper.mjs";\nexport function fold() { return { title: h }; }\n', "helper.mjs": 'export { useMemo as h } from "react";\n' });
    const r = lintTree(t);
    check("a fold's relative helper that imports React FAILs, named at the helper",
      r.findings.some((f) => f.kind === "fold-import" && /helper\.mjs/.test(f.file)), JSON.stringify(r.findings));
    check("and the helper is also a fifth file in the module folder", kindsIn(r).includes("fifth-file"), JSON.stringify(r.findings));
  }
  {
    const t = tree("transitive-lib");
    writeFileSync(join(t.src, "lib", "deep.mjs"), 'import * as THREE from "three";\nexport const d = THREE;\n');
    writeFileSync(join(t.src, "lib", "mid.mjs"), 'export { d } from "./deep.mjs";\n');
    writeModule(t.root, "command", "alpha", { "fold.mjs": 'import { d } from "../../../lib/mid.mjs";\nexport function fold() { return { title: String(d) }; }\n' });
    const r = lintTree(t);
    check("a package two relative hops away (fold -> lib/mid -> lib/deep -> three) FAILs",
      r.findings.some((f) => f.kind === "fold-import" && /deep\.mjs/.test(f.file)), JSON.stringify(r.findings));
  }
  {
    const t = tree("outside");
    writeFileSync(join(scratch, "outside", "escape.mjs"), "export const e = 1;\n");
    writeModule(t.root, "command", "alpha", { "fold.mjs": 'import { e } from "../../../../../escape.mjs";\nexport function fold() { return { title: String(e) }; }\n' });
    const r = lintTree(t);
    check("a relative import that leaves face/src FAILs", kindsIn(r).includes("fold-outside-src"), JSON.stringify(r.findings));
  }
  {
    const t = tree("missing");
    writeModule(t.root, "command", "alpha", { "fold.mjs": 'import { e } from "../../../lib/nope.mjs";\nexport function fold() { return { title: String(e) }; }\n' });
    writeFileSync(join(t.src, "lib", "helper.mjs"), "export const h = 1;\n");
    writeModule(t.root, "command", "beta", { "fold.mjs": 'import { h } from "../../../lib/Helper.mjs";\nexport function fold() { return { title: String(h) }; }\n' });
    const r = lintTree(t);
    const missing = r.findings.filter((f) => f.kind === "fold-missing-import");
    check("a relative import of a file that does not exist FAILs", missing.some((f) => /alpha/.test(f.file)), JSON.stringify(r.findings));
    check("a relative import whose case differs from the disk FAILs on every OS", missing.some((f) => /beta/.test(f.file)), JSON.stringify(r.findings));
  }
  {
    const t = tree("cycle");
    writeFileSync(join(t.src, "lib", "a.mjs"), 'import { b } from "./b.mjs";\nexport const a = () => b;\n');
    writeFileSync(join(t.src, "lib", "b.mjs"), 'import { a } from "./a.mjs";\nexport const b = () => a;\n');
    writeModule(t.root, "command", "alpha", { "fold.mjs": 'import { a } from "../../../lib/a.mjs";\nexport function fold() { return { title: String(a) }; }\n' });
    const r = lintTree(t);
    check("an import cycle among relative helpers terminates with no finding", r.findings.length === 0, JSON.stringify(r.findings));
  }
  {
    const t = tree("shape");
    writeModule(t.root, "command", "no-view", { "View.tsx": null });
    writeModule(t.root, "command", "extra", { "styles.css": ".x { }\n" });
    mkdirSync(join(t.root, "command", "nested", "sub"), { recursive: true });
    writeModule(t.root, "command", "nested");
    writeFileSync(join(t.root, "README.md"), "a file at the ring level\n");
    // Not "Command": on a case-insensitive filesystem that IS the command folder above, and the
    // arm would pass on ext4 and silently test nothing on NTFS and APFS.
    writeModule(t.root, "Ring_X", "shouty");
    writeModule(t.root, "kernel", "Bad_Id");
    mkdirSync(join(t.root, "factory"), { recursive: true });
    const r = lintTree(t);
    const k = kindsIn(r);
    check("a module folder missing View.tsx FAILs", r.findings.some((f) => f.kind === "missing-file" && /no-view/.test(f.file)), JSON.stringify(r.findings));
    check("a fifth file FAILs (ADR-1320: no fifth)", r.findings.some((f) => f.kind === "fifth-file" && /styles\.css/.test(f.file)), JSON.stringify(r.findings));
    check("a directory inside a module folder is a fifth entry too", r.findings.some((f) => f.kind === "fifth-file" && /nested/.test(f.file)), JSON.stringify(r.findings));
    check("a file at the ring level FAILs", r.findings.some((f) => f.kind === "not-a-folder" && /README\.md/.test(f.file)), JSON.stringify(r.findings));
    check("a ring folder outside the kebab grammar FAILs", r.findings.some((f) => f.kind === "bad-name" && /Ring_X/.test(f.file)), JSON.stringify(r.findings));
    check("a module id outside the kebab grammar FAILs", r.findings.some((f) => f.kind === "bad-name" && /Bad_Id/.test(f.file)), JSON.stringify(r.findings));
    check("an empty ring folder FAILs (a ring with no module is not a module)", r.findings.some((f) => f.kind === "empty-ring" && /factory/.test(f.file)), JSON.stringify(r.findings));
    check("the shape findings do not hide the counts", r.modules >= 5 && k.length >= 7, JSON.stringify(r));
  }
  {
    const t = tree("binary");
    writeModule(t.root, "command", "alpha", { "View.tsx": "export default function View() {\n  return <p>a" + String.fromCharCode(0) + "b</p>\n}\n" });
    const r = lintTree(t);
    check("a NUL byte in a module file is a named finding, not a skipped file", kindsIn(r).includes("binary"), JSON.stringify(r.findings));
  }
  {
    const t = tree("empty");
    const c = spawnSync(process.execPath, [LINT, "--root", t.root], { encoding: "utf8" });
    check("an empty modules root exits 1: zero files is not a pure tree", c.status === 1 && /FAIL nothing was scanned/.test(c.stdout), c.stdout + c.stderr);
  }
  {
    const c = spawnSync(process.execPath, [LINT, "--root", join(scratch, "absent", "modules")], { encoding: "utf8" });
    check("an absent root exits 1 with a named finding", c.status === 1 && /absent-root/.test(c.stdout), `status=${c.status} ${c.stdout}${c.stderr}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

// ── the CLI's argument rules (fixed-defects: unknown flags, --flag=value, repeats, empty values) ──
for (const [name, args] of [
  ["an unknown flag", ["--fix"]],
  ["a --flag=value spelling", [`--root=${MODULES}`]],
  ["a repeated --root", ["--root", MODULES, "--root", MODULES]],
  ["an empty --root", ["--root", ""]],
  ["a --root that swallows the next flag", ["--root", "--selftest"]],
  ["a positional argument", [MODULES]],
]) {
  const r = cli(...args);
  check(`the CLI refuses ${name} with exit 2`, r.status === 2, `status=${r.status} ${r.stdout}${r.stderr}`);
}

// ── the real tree, through the CLI, the way CI calls it ──
{
  const r = cli();
  const m = /face-pure: modules=(\d+) folds=(\d+) views=(\d+) files=(\d+) findings=(\d+)/.exec(r.stdout);
  check("the real tree RAN and printed its counts", m !== null, r.stdout + r.stderr);
  check("the real tree scanned more than zero modules, folds and views", m !== null && Number(m[1]) > 0 && Number(m[2]) > 0 && Number(m[3]) > 0, m ? m[0] : "no count");
  check("the real tree carries every module as four files", m !== null && Number(m[4]) === 4 * Number(m[1]), m ? m[0] : "no count");
  check("the real tree is pure: exit 0 and findings=0", r.status === 0 && m !== null && m[5] === "0", r.stdout);
}

// ── REQ-03: every module's .mjs is imported by node with no install, and its fold runs ──
{
  const registry = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
  const folders = [];
  for (const ring of readdirSync(MODULES)) {
    const rp = join(MODULES, ring);
    if (!statSync(rp).isDirectory()) continue;
    for (const id of readdirSync(rp)) if (statSync(join(rp, id)).isDirectory()) folders.push({ ring, id, dir: join(rp, id) });
  }
  check("the real module tree holds folders to import (vacuous-pass guard)", folders.length > 0, `folders=${folders.length}`);
  const isBooleanName = (k) => lint.BOOLEAN_FIELD.test(k);
  /** Every boolean-named key, at any depth of arrays and plain objects, with its value's type. */
  const booleanNamed = (value, path = "f", out = []) => {
    if (Array.isArray(value)) value.forEach((v, i) => booleanNamed(v, `${path}[${i}]`, out));
    else if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
      for (const [k, v] of Object.entries(value)) {
        if (isBooleanName(k)) out.push({ path: `${path}.${k}`, type: typeof v });
        booleanNamed(v, `${path}.${k}`, out);
      }
    }
    return out;
  };
  let imported = 0;
  for (const { ring, id, dir } of folders) {
    const room = registry.rooms.find((r) => r.id === id) ?? { id, name: id, ring, sentence: "", lede: "" };
    let mod, fold, ops;
    try {
      mod = await import(pathToFileURL(join(dir, "module.mjs")).href);
      fold = await import(pathToFileURL(join(dir, "fold.mjs")).href);
      ops = await import(pathToFileURL(join(dir, "ops.mjs")).href);
      imported++;
    } catch (e) {
      check(`${ring}/${id}: module.mjs, fold.mjs and ops.mjs import under node with no install`, false, e.message);
      continue;
    }
    const m = mod.default;
    check(`${ring}/${id}: module.mjs names its own folder`, m && m.id === id && m.ring === ring, JSON.stringify(m));
    check(`${ring}/${id}: module.mjs declares routes as a list and asOf as a boolean`,
      m && Array.isArray(m.routes) && m.routes.every((r) => typeof r === "string" && r.startsWith("/api/")) && typeof m.asOf === "boolean", JSON.stringify(m));
    check(`${ring}/${id}: ops.mjs exports an ops list`, Array.isArray(ops.ops), typeof ops.ops);
    check(`${ring}/${id}: fold.mjs exports fold()`, typeof fold.fold === "function", typeof fold.fold);
    if (typeof fold.fold !== "function") continue;
    const ctx = { room, rooms: registry.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: registry.inventories ?? null, laneMap: {} };
    let out;
    try { out = fold.fold({}, ctx); } catch (e) { out = e; }
    check(`${ring}/${id}: fold() runs under node over the served room and returns a plain object`,
      out && typeof out === "object" && !(out instanceof Error) && Object.getPrototypeOf(out) === Object.prototype, out instanceof Error ? out.message : typeof out);
    const wrong = booleanNamed(out).filter((b) => b.type !== "boolean");
    check(`${ring}/${id}: every boolean-named field fold() returns is a boolean`, wrong.length === 0, JSON.stringify(wrong));
  }
  check("every module folder imported (none skipped by a throw)", imported === folders.length, `${imported}/${folders.length}`);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 100 ? 0 : 1;
