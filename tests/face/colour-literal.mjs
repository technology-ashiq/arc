#!/usr/bin/env node
// colour-literal.mjs -- the colour-literal lint proven against planted literals, with no install
// (face v2 Phase 01, REQ-02). The lint is .claude/scripts/core/face-colour-literal.mjs; this file
// imports it, so before the lint exists this suite dies with ERR_MODULE_NOT_FOUND and prints no
// RAN line -- the red that comes first.
//
// VACUOUS-PASS GUARD: the first check proves the module loaded with its exports; the real tree
// must report a files-scanned count above zero; the last line is "RAN: <n> checks, <f> failed".
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LINT = join(REPO, ".claude", "scripts", "core", "face-colour-literal.mjs");
const FIX = join(REPO, "tests", "fixtures", "face", "colour-literal");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const lint = await import(pathToFileURL(LINT).href);
check("the lint loaded with its scan and walk exports",
  typeof lint.scanText === "function" && typeof lint.lintRoots === "function" && Array.isArray(lint.DEFAULT_ROOTS));

const cli = (...args) => spawnSync(process.execPath, [LINT, ...args], { encoding: "utf8", cwd: REPO });
const kinds = (text) => lint.scanText(text, "x.tsx").map((f) => f.kind);

// ── the real tree, through the CLI, the way CI calls it ──
{
  const r = cli();
  const m = /colour-literal: scanned=(\d+) files findings=(\d+)/.exec(r.stdout);
  check("the real tree RAN and printed its files-scanned count", m !== null, r.stdout + r.stderr);
  check("the real tree scanned more than zero files", m !== null && Number(m[1]) > 0, m ? m[1] : "no count");
  check("the real tree carries 0 colour literals under ui/** and modules/**", r.status === 0 && m !== null && m[2] === "0", r.stdout);
  check("each default root is reported by name, present or absent", /root face\/src\/ui: /.test(r.stdout) && /root face\/src\/modules: /.test(r.stdout), r.stdout);
}

// ── the three planted literals the spec names, each a FAIL from the CLI ──
for (const [dir, kind, literal] of [["planted-hex", "hex", "#14171b"], ["planted-white", "named", "white"], ["planted-black", "named", "black"]]) {
  const r = cli("--root", join(FIX, dir));
  check(`${dir}: exits 1`, r.status === 1, `status=${r.status} ${r.stdout}${r.stderr}`);
  check(`${dir}: names the ${kind} literal ${literal} with its line`, new RegExp(`FAIL .*:\\d+:\\d+ ${kind} ${literal.replace("#", "\\#")}\\b`).test(r.stdout), r.stdout);
}
{
  const r = cli("--root", join(FIX, "clean"));
  check("clean fixture: exits 0 with every near-miss unflagged", r.status === 0 && /scanned=1 files findings=0/.test(r.stdout), r.stdout + r.stderr);
}

// ── the rules, one construct at a time ──
check("#fff is a hex literal", kinds(`a = "#fff"`).includes("hex"));
check("#FFFFFF80 (8 digits, upper case) is a hex literal", kinds(`a = "#FFFFFF80"`).includes("hex"));
check("#abcd (4 digits) is a hex literal", kinds(`a = "#abcd"`).includes("hex"));
check("an HTML numeric entity &#8983; is not a hex literal", kinds(`<span>&#8983;</span>`).length === 0);
check("a hex run of 5 or 7 digits is not a colour", kinds(`a = "#12345"; b = "#1234567"`).length === 0);
check("#/map (a hash route) is not a hex literal", kinds(`href="#/map"`).length === 0);
check("WHITE in upper case is a named literal", kinds(`color: WHITE`).includes("named"));
check("text-black/40 is a named literal", kinds(`className="text-black/40"`).includes("named"));
check("whitespace-nowrap is not a colour", kinds(`className="whitespace-nowrap"`).length === 0);
check("the CSS property white-space is not a colour, in any case", kinds(`.x{white-space:nowrap} .y{WHITE-SPACE: pre}`).length === 0);
check("but white-spaced prose and text-white-spacer are still the word white", kinds(`a white-spacer`).includes("named") && kinds(`bg-white-space2`).includes("named"));
check("an identifier containing a colour word is not a colour", kinds(`const isWhite = blackList;`).length === 0);
check("rgba(0,0,0,.5) is a function literal", kinds(`background: rgba(0,0,0,.5)`).includes("function"));
check("hsl( 210 20% 10% ) is a function literal", kinds(`c = "hsl( 210 20% 10% )"`).includes("function"));
check("oklch(0.7 0.1 200) is a function literal", kinds(`c = "oklch(0.7 0.1 200)"`).includes("function"));
check("rgba(var(--ink), 0.04) is a token, not a literal", kinds(`boxShadow: "inset 0 1px 0 rgba(var(--ink),0.04)"`).length === 0);
check("bg-slate-900 (a Tailwind palette class) is a palette literal", kinds(`className="bg-slate-900"`).includes("palette"));
check("text-(--accent) is a token utility, not a palette literal", kinds(`className="text-(--accent)"`).length === 0);
check("a literal inside a comment is still a literal (the lint does not guess at comments)", kinds(`// never #000 here`).includes("hex"));

// The attack on the rules (face v2 Phase 01): Tailwind reads `_` as a space, so a literal built
// out of underscores is a literal; the palette is every palette under every prefix.
check("shadow-[0_0_0_1px_#fff] is a hex literal", kinds(`className="shadow-[0_0_0_1px_#fff]"`).includes("hex"));
check("shadow-[inset_0_0_0_1px_white] is a named literal", kinds(`className="shadow-[inset_0_0_0_1px_white]"`).includes("named"));
check("shadow-[0_1px_2px_rgba(0,0,0,.5)] is a function literal", kinds(`className="shadow-[0_1px_2px_rgba(0,0,0,.5)]"`).includes("function"));
check("bg-mauve-900 and text-olive-500 are palette literals", kinds(`"bg-mauve-900 text-olive-500"`).filter((k) => k === "palette").length === 2);
check("inset-ring-red-500 and text-shadow-sky-400 are palette literals", kinds(`"inset-ring-red-500 text-shadow-sky-400"`).filter((k) => k === "palette").length === 2);
check("var(--color-rose-600) and theme(colors.red.500) are palette literals", kinds(`a: var(--color-rose-600); b: theme(colors.red.500)`).filter((k) => k === "palette").length === 2);
check("an HTML entity spelling a hash (&#35;ffffff) is an escaped literal", kinds(`<path fill="&#35;ffffff"/>`).includes("escaped-hex"));
check("a JS escape spelling a hash is an escaped literal", kinds(`const c = "\\x23ffffff"; const d = "\\u0023000000";`).filter((k) => k === "escaped-hex").length === 2);
check("a CSS escape inside a hex is an escaped literal", kinds(`.x{color:#\\66 ff}`).includes("escaped-hex"));
check("rgb(none 0 0) and rgb(calc(255) 255 255) are function literals", kinds(`a: rgb(none 0 0); b: rgb(calc(255) 255 255)`).filter((k) => k === "function").length === 2);
check("a relative colour with literal channels is a literal", kinds(`c: rgb(from var(--accent) 255 255 255)`).includes("function"));
check("a relative colour from a token with an alpha is a token", kinds(`c: rgb(from var(--accent) r g b / 0.5)`).length === 0);
check("a comment inside a colour function hides no number", kinds(`c: rgb(/**/255,255,255)`).includes("function"));
check("hsl(var(--h) var(--s) var(--l)) is a token", kinds(`c: hsl(var(--h) var(--s) var(--l))`).length === 0);
check("an unclosed colour function is a finding, never skipped", kinds(`c: rgb(var(--x)`).includes("function"));
{
  const f = lint.scanText(`ok\n  x = "#0b0d10"`, "a.tsx");
  check("a finding carries line and column", f.length === 1 && f[0].line === 2 && f[0].col === 8, JSON.stringify(f));
}

// ── the walk: absent, empty, binary, symlinked ──
const tmp = mkdtempSync(join(tmpdir(), "colour-literal-"));
try {
  const empty = join(tmp, "empty");
  mkdirSync(empty);
  const r0 = cli("--root", empty);
  check("a root with nothing in it: scanned=0 is a FAIL, never a clean pass", r0.status === 1 && /scanned=0 files/.test(r0.stdout) && /nothing was scanned/.test(r0.stdout), r0.stdout + r0.stderr);

  const absent = join(tmp, "nope");
  const r1 = cli("--root", absent, "--root", join(FIX, "clean"));
  check("an explicit root that is absent is a named FAIL, even while another root is scanned",
    r1.status === 1 && /absent-root/.test(r1.stdout) && /scanned=1 files/.test(r1.stdout), r1.stdout + r1.stderr);

  // The attack on the walk (face v2 Phase 01): two spellings of one root, or a root inside
  // another, counted one literal four times.
  const dup = join(tmp, "dup");
  mkdirSync(join(dup, "inner"), { recursive: true });
  writeFileSync(join(dup, "inner", "a.tsx"), `const c = "#123456";\n`);
  check("the same root spelled twice is refused (exit 2), never double-counted", cli("--root", dup, "--root", `${dup}/`).status === 2);
  check("a root inside another root is refused (exit 2)", cli("--root", dup, "--root", join(dup, "inner")).status === 2);

  // A re-cased folder: found on a case-insensitive disk, absent on a case-sensitive one -- a
  // FAIL on both, never a pass on one leg.
  mkdirSync(join(tmp, "Cased"));
  writeFileSync(join(tmp, "Cased", "ok.tsx"), `const c = "var(--accent)";\n`);
  const rc = cli("--root", join(tmp, "cased"));
  check("a root spelled in the wrong case FAILS on every filesystem", rc.status === 1 && /(absent-root|root-case)/.test(rc.stdout), rc.stdout + rc.stderr);

  if (process.platform !== "win32") {
    const rd = cli("--root", "/dev/null", "--root", join(FIX, "clean"));
    check("a device as a root is a named finding, never read as a clean file", rd.status === 1 && /special/.test(rd.stdout), rd.stdout + rd.stderr);
  } else {
    console.log("note: device-root arm runs on the POSIX legs only (/dev/null)");
  }

  const nested = join(tmp, "nested", "deep", "deeper");
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(nested, "View.tsx"), `export const x = "rgb(1, 2, 3)";\n`);
  const r2 = cli("--root", join(tmp, "nested"));
  check("a literal three directories down is found", r2.status === 1 && /function rgb\(/.test(r2.stdout), r2.stdout);

  const bin = join(tmp, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "a.tsx"), Buffer.from([0x63, 0x00, 0x23, 0x66, 0x66, 0x66]));
  const r3 = cli("--root", bin);
  check("a file carrying a NUL byte is a named finding, not skipped", r3.status === 1 && /binary/.test(r3.stdout), r3.stdout);

  const css = join(tmp, "css");
  mkdirSync(css);
  writeFileSync(join(css, "room.css"), `.x { color: #abcdef; }\n`);
  writeFileSync(join(css, "icon.svg"), `<svg><path fill="#000"/></svg>\n`);
  const r4 = cli("--root", css);
  check("every file is scanned whatever its extension (.css, .svg)", r4.status === 1 && /scanned=2 files findings=2/.test(r4.stdout), r4.stdout);

  let linked = false;
  const target = join(tmp, "outside");
  mkdirSync(target);
  writeFileSync(join(target, "far.tsx"), `const c = "#123456";\n`);
  const withLink = join(tmp, "withlink");
  mkdirSync(withLink);
  writeFileSync(join(withLink, "ok.tsx"), `const c = "var(--accent)";\n`);
  try { symlinkSync(target, join(withLink, "link"), "junction"); linked = true; } catch { /* no symlink rights on this runner */ }
  if (linked) {
    const r5 = cli("--root", withLink);
    check("a symlink under a root is a named finding, never silently followed or skipped", r5.status === 1 && /symlink/.test(r5.stdout), r5.stdout);
  } else {
    console.log("note: symlink arm not exercised -- this runner cannot create one");
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ── the CLI's own refusals ──
check("an unknown flag exits 2", cli("--roots", FIX).status === 2);
check("--root with no value exits 2", cli("--root").status === 2);
check("--root followed by a flag exits 2", cli("--root", "--root").status === 2);
check("--root=VALUE is refused, never silently ignored", cli(`--root=${FIX}`).status === 2);
check("the same --root twice exits 2", cli("--root", FIX, "--root", FIX).status === 2);

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 35 ? 0 : 1;
