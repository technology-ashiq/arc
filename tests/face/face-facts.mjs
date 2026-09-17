#!/usr/bin/env node
// face-facts.mjs -- the facts-bundle lint proven against planted bundles, with no install (face v2
// Phase 03, REQ-05, ADR-1324). The lint is .claude/scripts/core/face-facts.mjs; this file imports it,
// so before the lint exists this suite dies with ERR_MODULE_NOT_FOUND and prints no RAN line -- the
// red that comes first.
//
// What is proven here:
//   - every STRUCTURAL arm FAILs a planted construct by kind, and the CLI exits 1 on it -- including
//     v0.7's own arcFacts shape planted under face/src/lib;
//   - every HEURISTIC arm WARNs and exits 0 (the cycle's WARN-first rule for heuristics);
//   - what the product legitimately does passes: door reads, the module glob, a JSON body parsed at
//     runtime, package imports, the stylesheet's imports;
//   - the real face/src tree reads fail=0 with files counted.
//
// VACUOUS-PASS GUARD: the first check proves the lint loaded with its exports; the real tree must
// count files; the last line is "RAN: <n> checks, <f> failed".
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LINT = join(REPO, ".claude", "scripts", "core", "face-facts.mjs");
const PURE = join(REPO, ".claude", "scripts", "core", "face-pure.mjs");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const lint = await import(pathToFileURL(LINT).href);
const pure = await import(pathToFileURL(PURE).href);
check("the lint loaded with its walk, scans and limits (vacuous-pass guard)",
  typeof lint.lintFacts === "function" && typeof lint.scanCode === "function" && typeof lint.scanStyle === "function"
  && typeof lint.specifierProblem === "function" && lint.LIMITS && lint.LIMITS.literalFail === 200 && lint.LIMITS.blob === 2048);

const scratch = mkdtempSync(join(tmpdir(), "face-facts-"));
let n = 0;
/**
 * A planted app: face/package.json beside face/src, every file given, and one clean module so a
 * tree is never empty by accident.
 */
const plant = (files, { pkg = { name: "planted", dependencies: { react: "^19" } } } = {}) => {
  const face = join(scratch, `t${n++}`, "face");
  const src = join(face, "src");
  mkdirSync(join(src, "modules", "command", "today"), { recursive: true });
  writeFileSync(join(face, "package.json"), JSON.stringify(pkg));
  writeFileSync(join(src, "modules", "command", "today", "fold.mjs"), "export function fold(p, ctx) { return { sentence: ctx.room.sentence }; }\n");
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(src, ...rel.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return src;
};
const run = (src) => lint.lintFacts(src, { base: dirname(src) });
const kinds = (report, level) => report.findings.filter((f) => f.level === level).map((f) => f.kind);
const show = (report) => JSON.stringify(report.findings.map((f) => `${f.level} ${f.kind} ${f.file}:${f.line} ${f.detail}`));
const cli = (src) => spawnSync(process.execPath, [LINT, "--root", src], { encoding: "utf8", cwd: REPO });

const fails = (name, files, kind, opts) => {
  const src = plant(files, opts);
  const r = run(src);
  check(`PLANTED: ${name} FAILs (${kind})`, kinds(r, "FAIL").includes(kind), show(r));
  return src;
};
const warns = (name, files, kind) => {
  const src = plant(files);
  const r = run(src);
  check(`WARN: ${name} warns and does not FAIL (${kind})`, kinds(r, "WARN").includes(kind) && kinds(r, "FAIL").length === 0, show(r));
  const c = cli(src);
  check(`WARN: ${name} -- the CLI exits 0 and prints the WARN line`, c.status === 0 && c.stdout.includes(`WARN `) && c.stdout.includes(` ${kind} `), `${c.status} ${c.stdout}${c.stderr}`);
};
const passes = (name, files) => {
  const src = plant(files);
  const r = run(src);
  check(`passes: ${name}`, r.findings.length === 0 && r.code > 0, show(r));
};

// ── a clean tree ──
{
  const src = plant({ "App.tsx": "import { useState } from 'react'\nexport default function App() { const [n] = useState(0); return <p>{n}</p> }\n", "index.css": '@import "tailwindcss" source(".");\n@import "./tokens.css";\n', "tokens.css": ":root { --x: 1px; }\n" });
  const r = run(src);
  check("CLEAN: a tree of code and stylesheets passes with files counted", r.findings.length === 0 && r.code === 2 && r.styles === 2, show(r));
  const c = cli(src);
  check("CLEAN: the CLI exits 0 and reports fail=0", c.status === 0 && /face-facts: files=4 code=2 styles=2 leaves=\d+ fail=0 warn=0/.test(c.stdout), `${c.status} ${c.stdout}${c.stderr}`);
}

// ── v0.7's own bundle, planted ──
{
  const lanes = Array.from({ length: 40 }, (_, i) => `  { "id": "lane-${i}", "ring": "kernel", "status": "idle", "phasesTotal": ${i}, "phasesClosed": ${i}, "goal": "a goal" }`).join(",\n");
  const body = `// GENERATED from the arc repo (READ-ONLY) on 2026-08-25 by scratchpad/trim-facts.mjs.\nexport const FACTS = {\n "meta": { "generated": "2026-08-25T07:04:56.539Z", "lanes": 16 },\n "lanes": [\n${lanes}\n ]\n}\n`;
  const src = fails("v0.7's arcFacts shape under face/src/lib", { "lib/facts.mjs": body }, "data-mass");
  const c = cli(src);
  check("PLANTED: v0.7's arcFacts shape -- the CLI exits 1 naming the file and the kind", c.status === 1 && /FAIL \S*lib\/facts\.mjs:\d+:\d+ data-mass/.test(c.stdout), `${c.status} ${c.stdout}${c.stderr}`);
  check("PLANTED: v0.7's arcFacts shape also carries its banner as a WARN", run(src).findings.some((f) => f.kind === "banner" && f.level === "WARN"), show(run(src)));
}

// ── structural arms ──
fails("a JSON file under face/src", { "lib/facts.json": '{"lanes": 16}' }, "data-file");
fails("a .js file", { "lib/facts.js": "export const LANES = 16;\n" }, "data-file");
fails("a Markdown file", { "modules/command/today/notes.md": "# 22 commands\n" }, "data-file");
fails("an extensionless file", { "lib/FACTS": "16 lanes\n" }, "data-file");
fails("a ?raw import", { "lib/a.mjs": "import text from './b.mjs?raw';\nexport const t = text;\n", "lib/b.mjs": "export const b = 1;\n" }, "asset-import");
fails("a data import by extension", { "lib/a.mjs": "import data from './b.json';\nexport const d = data;\n" }, "asset-import");
fails("an import leaving face/src", { "lib/a.mjs": "import { FACTS } from '../../../docs/facts.mjs';\nexport const f = FACTS;\n" }, "import-outside");
fails("an export-from leaving face/src", { "lib/a.mjs": "export * from '../../initiatives/face/facts.mjs';\n" }, "import-outside");
fails("a dynamic import leaving face/src", { "lib/a.mjs": "export const load = () => import('../../../docs/facts.mjs');\n" }, "import-outside");
fails("an absolute import", { "lib/a.mjs": "import x from '/@fs/E:/arc/docs/facts.mjs';\nexport const y = x;\n" }, "import-outside");
fails("a # subpath import", { "lib/a.mjs": "import x from '#facts';\nexport const y = x;\n" }, "import-outside");
fails("a backslash in a relative specifier", { "lib/a.mjs": "import x from '.\\\\b.mjs';\nexport const y = x;\n" }, "import-outside");
fails("a JSON import attribute", { "lib/a.mjs": "import x from './b.mjs' with { type: 'json' };\nexport const y = x;\n", "lib/b.mjs": "export default 1;\n" }, "asset-import");
fails("a glob beyond ./ code", { "App.tsx": "const docs = import.meta.glob('../../docs/**/*.md', { eager: true })\nexport default function App() { return <p /> }\n" }, "glob");
fails("a glob asking for raw text", { "App.tsx": "const m = import.meta.glob('./modules/*/*/fold.mjs', { query: '?raw', import: 'default' })\nexport default function App() { return <p /> }\n" }, "glob");
fails("a glob with a computed pattern", { "App.tsx": "const p = './x/*.mjs'\nconst m = import.meta.glob(p)\nexport default function App() { return <p /> }\n" }, "glob");
fails("new URL(literal, import.meta.url)", { "lib/a.mjs": "export const u = new URL('../../docs/facts.json', import.meta.url);\n" }, "asset-url");
fails("an env value", { "lib/a.mjs": "export const facts = import.meta.env.VITE_FACTS;\n" }, "env-fact");
fails("a fetch of a static file", { "lib/a.mjs": "export const read = () => fetch('/facts.json');\n" }, "fetch-static");
fails("a fetch of a static template", { "lib/a.mjs": "export const read = (d) => fetch(`/data/${d}.json`);\n" }, "fetch-static");
fails("an EventSource on a static file", { "lib/a.mjs": "export const s = () => new EventSource('/facts.ndjson');\n" }, "fetch-static");
fails("a 2048-character string", { "lib/a.mjs": `export const blob = "${"x".repeat(2048)}";\n` }, "blob");
fails("a 2048-character template text", { "lib/a.mjs": `export const blob = \`${"y".repeat(2048)}\`;\n` }, "blob");
fails("2048 characters of JSX text", { "modules/command/today/View.tsx": `export default function View() { return <p>${"z".repeat(2048)}</p> }\n` }, "blob");
fails("JSON.parse of a literal", { "lib/a.mjs": "export const facts = JSON.parse('{\"lanes\":16}');\n" }, "blob");
fails("atob of a literal", { "lib/a.mjs": "export const facts = atob('eyJsYW5lcyI6MTZ9');\n" }, "blob");
fails("a data literal of 200 leaves", { "lib/a.mjs": `export const ROWS = [${Array.from({ length: 200 }, (_, i) => i).join(", ")}];\n` }, "data-mass");
fails("a file whose data literals hold 2100 leaves", { "lib/a.mjs": Array.from({ length: 21 }, (_, k) => `export const R${k} = [${Array.from({ length: 100 }, (_, i) => `"v${i}"`).join(", ")}];`).join("\n") + "\n" }, "data-mass");
fails("v0.7's bundle by file name", { "lib/arcKnowledge.mjs": "export const ARC = { spine: 1 };\n" }, "named-bundle");
fails("v0.7's bundle by import name", { "lib/a.mjs": "import { FACTS } from './arcFacts.mjs';\nexport const f = FACTS;\n", "lib/arcFacts.mjs": "export const FACTS = 1;\n" }, "named-bundle");
fails("an unscannable file", { "lib/a.mjs": "export const s = 'unterminated;\n" }, "unscannable");
fails("a NUL byte", { "lib/a.mjs": `export const s = 1;${String.fromCharCode(0)}\n` }, "unscannable");
fails("a stylesheet importing outside face/src", { "index.css": '@import "../../docs/design/facts.css";\n' }, "import-outside");
fails("a stylesheet url() leaving face/src", { "index.css": '.x { background: url("../../docs/facts.png"); }\n' }, "import-outside");
fails("a dependency installed from a path", {}, "package", { pkg: { name: "planted", dependencies: { facts: "file:../docs" } } });
fails("package.json subpath imports", {}, "package", { pkg: { name: "planted", imports: { "#facts": "../docs/facts.mjs" } } });

// ── a stylesheet carried as a literal (the Cycle 15 rooms) is scanned as a stylesheet, not waved through ──
{
  const css = `.t-room{color:var(--prose);padding:4px}\n`.repeat(80);
  passes("a CSS literal used only as the sole child of <style>", { "rooms/Room.tsx": `export default function Room() { return <div><style>{CSS}</style><p>x</p></div> }\nconst CSS = \`\n${css}\`\n` });
  fails("a stylesheet literal carrying JSON members", { "rooms/Room.tsx": `export default function Room() { return <style>{CSS}</style> }\nconst CSS = \`${css}{"lanes": 16, "goal": "x"}\`\n` }, "blob");
  fails("a CSS-named blob that code also reads", { "rooms/Room.tsx": `export default function Room() { return <div><style>{CSS}</style><p>{CSS.length}</p></div> }\nconst CSS = \`${css}\`\n` }, "blob");
  fails("a CSS-named blob rendered as a paragraph, not a stylesheet", { "rooms/Room.tsx": `export default function Room() { return <p>{CSS}</p> }\nconst CSS = \`${css}\`\n` }, "blob");
  fails("a stylesheet literal whose url() leaves face/src", { "rooms/Room.tsx": `export default function Room() { return <style>{CSS}</style> }\nconst CSS = \`${css}.x{background:url(../../../docs/facts.png)}\`\n` }, "import-outside");
}
passes("a package's .js deep import is code (three's examples)", { "face/Stage.tsx": "import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'\nexport default function Stage() { return <p>{String(RenderPass)}</p> }\n" });

// ── the Phase 03 attack: each confirmed hole, pinned ──
{
  const outside = "../../../docs/facts";
  fails("an import on the line after x++ (the ASI blind spot)", { "lib/counter.mjs": `let hits = 0\nhits++\nimport facts from "${outside}.mjs"\nexport const f = facts\n` }, "import-outside");
  fails("an export-from on the line after debugger", { "lib/dbg.mjs": `debugger\nexport * from "${outside}.mjs"\n` }, "import-outside");
  fails("an import on the line after a TypeScript non-null x!", { "lib/bang.ts": `declare const maybe: number | undefined\nconst sure = maybe!\nimport facts from "${outside}.mjs"\nexport const f = [sure, facts]\n` }, "import-outside");
  fails("3000 exported string constants outside any literal", { "lib/consts.mjs": Array.from({ length: 3000 }, (_, i) => `export const F${i} = "f87db${i}";`).join("\n") + "\n" }, "data-mass");
  fails("2100 rows of JSX text", { "ui/Facts.tsx": `export default function Facts() { return <dl>${Array.from({ length: 1100 }, (_, i) => `<dt>lane-${i}</dt><dd>LIVE ${i}</dd>`).join("")}</dl> }\n` }, "data-mass");
  fails("a + chain of short strings adding to a blob", { "lib/chain.mjs": `const RAW = ${Array.from({ length: 30 }, () => `"${"x".repeat(80)}"`).join(" + ")};\nexport const facts = RAW.length;\n` }, "blob");
  fails("a template whose literal parts add to a blob around ${\"\"}", { "lib/tpl.mjs": `export const t = \`${Array.from({ length: 30 }, () => "y".repeat(80)).join("${\"\"}")}\`;\n` }, "blob");
  fails("JSON.parse of a parenthesised literal", { "lib/p.mjs": "export const f = JSON.parse((\"{}\"));\n" }, "blob");
  fails("globalThis.JSON.parse of a literal", { "lib/p.mjs": "export const f = globalThis.JSON.parse(\"{}\");\n" }, "blob");
  fails("a 2100-character regex source", { "lib/re.mjs": `export const R = /${"a|".repeat(1050)}b/;\n` }, "blob");
  fails("an EXPORTED stylesheet constant is text, not a stylesheet", { "ui/Theme.tsx": `export const THEME_CSS = \`${".x{color:var(--a)}".repeat(150)}\`\nexport default function Theme() { return <style>{THEME_CSS}</style> }\n` }, "blob");
  fails("a stylesheet literal carrying single-quoted JSON members", { "rooms/Sheet.tsx": `export default function Sheet() { return <style>{SHEET}</style> }\nconst SHEET = \`.a{b:c} {'lanes': 16}\`\n` }, "blob");
  fails("a package name that climbs through ..", { "lib/climb.mjs": "export { F } from \"pkg/../../docs/facts.mjs\";\n" }, "import-outside");
  fails("a stylesheet url() through a package-style climb", { "index.css": ".x { background: url(x/../../../docs/facts.png); }\n" }, "import-outside");
  fails("require() of anything", { "lib/req.ts": "declare const require: (s: string) => unknown\nexport const f = require(\"./x.mjs\")\n" }, "import-outside");
  fails("a fetch of /api/../ that climbs out of the door", { "lib/f.mjs": "export const r = () => fetch(\"/api/../arc-facts.json\");\n" }, "fetch-static");
  fails("window.fetch of a static file", { "lib/f.mjs": "export const r = () => window.fetch(\"/arc-facts.json\");\n" }, "fetch-static");
  fails("a fetch of a parenthesised static literal", { "lib/f.mjs": "export const r = () => fetch((\"/arc-facts.json\"));\n" }, "fetch-static");
  fails("a fetch of a template holding only a literal", { "lib/f.mjs": "export const r = () => fetch(`${\"/arc-facts.json\"}`);\n" }, "fetch-static");
  fails("a fetch reached by a computed key", { "lib/f.mjs": "export const r = () => globalThis[\"fetch\"](\"/api/x\");\n" }, "fetch-static");
  fails("XMLHttpRequest at all", { "lib/f.mjs": "export const r = () => new XMLHttpRequest();\n" }, "fetch-static");
  fails("new Request of a static file", { "lib/f.mjs": "export const r = () => new Request(\"/arc-facts.json\");\n" }, "fetch-static");
  fails("a .css file carrying a 2100-character string", { "facts.css": `:root { --arc-facts: '${"z".repeat(2100)}'; }\n` }, "blob");
  fails("a .css file carrying a JSON member", { "facts.css": ":root { --arc-facts: '{\"lanes\": 16}'; }\n" }, "blob");
  fails("a CSS @import with no space", { "index.css": "@import\"../../docs/facts.css\";\n" }, "import-outside");
  fails("a CSS @import behind a comment", { "index.css": "@import/**/\"../../docs/facts.css\";\n" }, "import-outside");
  fails("a Tailwind @plugin leaving face/src", { "index.css": "@plugin \"../../docs/facts-plugin.mjs\";\n" }, "import-outside");
  fails("a colon in a relative specifier (an NTFS stream)", { "lib/a.mjs": "import x from \"./b.mjs:facts.mjs\";\nexport const y = x;\n" }, "import-outside");
  fails("a relative specifier matching a folder only case-insensitively", { "lib/a.mjs": "import x from \"../LIB/b.mjs\";\nexport const y = x;\n", "lib/b.mjs": "export const b = 1;\n" }, "import-outside");
  for (const [label, spec] of [["a tarball", "facts.tgz"], ["a drive path", "C:/facts"], ["a home path", "~/facts"], ["a dot folder", ".facts"], ["an upper-case FILE: protocol", "FILE:../facts"]]) {
    fails(`a dependency installed from ${label}`, {}, "package", { pkg: { name: "planted", dependencies: { facts: spec } } });
  }
  for (const field of ["browser", "exports", "workspaces"]) {
    fails(`package.json declaring ${field}`, {}, "package", { pkg: { name: "planted", [field]: field === "workspaces" ? ["../facts-pkg"] : { "./facts": "./vendor/facts.mjs" } } });
  }
  fails("an override that is a path", {}, "package", { pkg: { name: "planted", overrides: { react: "file:../facts" } } });
  {
    const src = plant({});
    writeFileSync(join(dirname(src), "vite.config.ts"), "import { defineConfig } from 'vite'\nexport default defineConfig({ define: { __ARC_FACTS__: '{}' } })\n");
    const r = run(src);
    check("PLANTED: a vite config that defines a value FAILs (build-config)", kinds(r, "FAIL").includes("build-config"), show(r));
    writeFileSync(join(dirname(src), "vite.config.ts"), "import { defineConfig } from 'vite'\nexport default defineConfig({ resolve: { alias: { 'arc-room-data': '../docs/facts.json' } } })\n");
    const r2 = run(src);
    check("PLANTED: a vite config with a resolve alias FAILs (build-config)", kinds(r2, "FAIL").includes("build-config"), show(r2));
  }
  passes("a TypeScript return type does not turn a function body into a data literal", { "lib/tones.ts": `export function tone(n: number): string {\n${Array.from({ length: 210 }, (_, i) => `  if (n === ${i}) return "t${i}"`).join("\n")}\n  return ""\n}\n` });
  passes("a web worker by new URL and by ?worker, and a glob picking its import", { "lib/w.ts": "export const w = () => new Worker(new URL(\"./layout.worker.ts\", import.meta.url), { type: \"module\" })\n", "lib/layout.worker.ts": "export const x = 1\n", "lib/w2.ts": "import W from \"./layout.worker.ts?worker\"\nexport const make = () => new W()\n", "App.tsx": "const panels = import.meta.glob('./lib/*.ts', { eager: true, import: 'default' })\nexport default function App() { return <p>{Object.keys(panels).length}</p> }\n" });
  check("oneLine makes an ESC visible, so a file name cannot repaint a verdict line", pure.oneLine(`a${String.fromCharCode(27)}[2Kb`) === "a<U+001B>[2Kb", pure.oneLine(`a${String.fromCharCode(27)}b`));
}

// a relative import climbing through a linked parent: resolved from the REAL folder, as node resolves it
{
  const baseDir = join(scratch, "linked");
  const real = join(baseDir, "R", "deep");
  mkdirSync(join(real, "face", "src"), { recursive: true });
  mkdirSync(join(real, "x", "face", "src"), { recursive: true });
  mkdirSync(join(baseDir, "L"), { recursive: true });
  writeFileSync(join(real, "face", "src", "a.mjs"), "import { y } from \"../../x/face/src/y.mjs\";\nexport const a = y;\n");
  writeFileSync(join(real, "x", "face", "src", "y.mjs"), "export const y = 1;\n");
  let linked = false;
  try {
    symlinkSync(join(real, "face"), join(baseDir, "L", "face"), "junction");
    symlinkSync(real, join(baseDir, "L", "x"), "junction");
    linked = true;
  } catch { /* no link on this OS for this user */ }
  if (linked) {
    const r = lint.lintFacts(join(baseDir, "L", "face", "src"), { base: baseDir, packageJson: null, configDir: null });
    check("PLANTED: a climb through a linked parent is judged from the real folder and FAILs (import-outside)", kinds(r, "FAIL").includes("import-outside"), show(r));
  }
  console.log(`face-facts: linked-parent-arm=${linked ? "ran" : "skipped"}`);
}

// a link: counted skip only where the OS cannot make one
{
  const src = plant({});
  let linked = false;
  try { symlinkSync(join(REPO, "README.md"), join(src, "lib-facts.mjs")); linked = true; } catch { /* no file-symlink privilege */ }
  // A directory junction needs no privilege on Windows, so the arm runs there too (face v2 Phase 03 attack).
  if (!linked) { try { symlinkSync(join(REPO, "docs"), join(src, "lib-docs"), "junction"); linked = true; } catch { /* no link at all */ } }
  if (linked) {
    const r = run(src);
    check("PLANTED: a symlink under face/src FAILs (link)", kinds(r, "FAIL").includes("link"), show(r));
  }
  console.log(`face-facts: link-arm=${linked ? "ran" : "skipped"}`);
}

// ── heuristic arms WARN-first ──
warns("a 64-leaf literal", { "lib/a.mjs": `export const ROWS = [${Array.from({ length: 64 }, (_, i) => i).join(", ")}];\n` }, "data-literal");
warns("a 512-character string", { "lib/a.mjs": `export const s = "${"x".repeat(512)}";\n` }, "long-string");
warns("a GENERATED banner", { "lib/a.mjs": "// GENERATED from the repo by a script\nexport const a = 1;\n" }, "banner");
warns("a count claim in a module", { "modules/command/today/View.tsx": "export default function View() { return <p>22 commands and 23 agents</p> }\n" }, "fact-literal");
warns("a ULID in a module", { "modules/command/today/ops.mjs": "export const ops = ['01M2QWMG3CSBD1B4JFSAKWEXYX'];\n" }, "fact-literal");
warns("a commit SHA in a module", { "modules/command/today/ops.mjs": "export const ops = ['merged as d76657d1'];\n" }, "fact-literal");
passes("a ULID outside the modules tree is not a module's fact", { "lib/a.mjs": "export const EXAMPLE = '01M2QWMG3CSBD1B4JFSAKWEXYX';\n" });

// ── what the product legitimately does ──
passes("a fetch through the door's /api/ and a computed template", { "lib/a.mjs": "export const a = () => fetch('/api/health');\nexport const b = (base, p) => fetch(`${base}${p}`);\nexport const c = (id) => fetch(`/api/lane/${id}`);\n" });
passes("the App's module glob with { eager: true }", { "App.tsx": "const m = { ...import.meta.glob('./modules/*/*/module.mjs', { eager: true }), ...import.meta.glob('./modules/*/*/View.tsx', { eager: true }) }\nexport default function App() { return <p>{Object.keys(m).length}</p> }\n" });
passes("import.meta.env.DEV and MODE", { "lib/a.mjs": "export const dev = import.meta.env.DEV;\nexport const mode = import.meta.env.MODE;\n" });
passes("JSON.parse of a door body", { "lib/a.mjs": "export const read = (body) => JSON.parse(body.text);\n" });
passes("package imports and a type import", { "App.tsx": "import { Tray } from '@phosphor-icons/react'\nimport type { Room } from './lib/rooms.mjs'\nexport default function App({ r }: { r: Room }) { return <Tray /> }\n", "lib/rooms.mjs": "export const x = 1;\n" });
passes("a relative import inside face/src from a module", { "modules/command/today/View.tsx": "import { HPanel } from '../../../ui/bits'\nexport default function View() { return <HPanel /> }\n", "ui/bits.tsx": "export function HPanel() { return <section /> }\n" });
passes("Tailwind classes and prose with numbers in a View outside the fact shapes", { "modules/command/today/View.tsx": 'export default function View() { return <p className="w-[240px] h-[56px]">the last 7 days</p> }\n' });

// ── the lexer's text tokens are opt-in, so face-pure's own stream is untouched ──
{
  const src = "export default function V({ f }) { return <p title={`a ${f.x} b`}>hello {f.y} world</p> }\n";
  const plain = pure.lex(src, { jsx: true });
  const withText = pure.lex(src, { jsx: true, text: true });
  check("lex: text tokens appear only when asked for", plain.tokens.every((t) => t.k !== "text") && withText.tokens.some((t) => t.k === "text" && t.v.includes("hello")) && withText.tokens.some((t) => t.k === "text" && t.v === "a "), JSON.stringify(withText.tokens.filter((t) => t.k === "text")));
  const strip = (ts) => JSON.stringify(ts.filter((t) => t.k !== "text").map((t) => [t.k, t.v, t.line, t.col]));
  check("lex: without the text tokens, the stream is the same one face-pure reads", strip(plain.tokens) === strip(withText.tokens));
  check("face-pure exports importStatements for the facts lint to share", typeof pure.importStatements === "function");
}

// ── the real tree ──
{
  const r = lint.lintFacts(join(REPO, "face", "src"), { base: REPO });
  check("the real tree was scanned (vacuous-pass guard)", r.code >= 30 && r.styles >= 1, `code=${r.code} styles=${r.styles}`);
  check("the real face/src carries no facts bundle: zero FAIL", kinds(r, "FAIL").length === 0, show(r));
  const c = spawnSync(process.execPath, [LINT], { encoding: "utf8", cwd: REPO });
  check("the CLI on the real tree exits 0 and prints its summary", c.status === 0 && /^face-facts: files=\d+ code=\d+ styles=\d+ leaves=\d+ fail=0 warn=\d+$/m.test(c.stdout), `${c.status} ${c.stdout}${c.stderr}`);
}

// ── the CLI refuses what it does not understand ──
{
  const bad = spawnSync(process.execPath, [LINT, "--roots", "x"], { encoding: "utf8", cwd: REPO });
  check("the CLI refuses an unknown flag with exit 2", bad.status === 2 && bad.stderr.includes("unknown argument"), `${bad.status} ${bad.stderr}`);
  const absent = spawnSync(process.execPath, [LINT, "--root", join(scratch, "no-such-src")], { encoding: "utf8", cwd: REPO });
  check("the CLI FAILs an absent root rather than passing nothing", absent.status === 1 && absent.stdout.includes("absent-root"), `${absent.status} ${absent.stdout}`);
}

try { rmSync(scratch, { recursive: true, force: true }); } catch { /* a temp dir; the OS reclaims it */ }
console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 60 ? 0 : 1;
