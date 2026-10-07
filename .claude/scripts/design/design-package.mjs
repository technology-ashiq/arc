#!/usr/bin/env node
// design-package.mjs -- the outbound blind package carries arc-authored renders only (Phase 08 S2, ADR-1410).
//
//   design-package.mjs build --root R --explore <id> --render variant-<x> [--render ...] [--viewport WxH] [--out <dir>]
//   design-package.mjs lint  --root R --dir <package-dir>
//
// A package leaves the repo and reaches people (ADR-0040's two blind streams). Publication is irreversible,
// so the gate is mechanical: every image in a package must hash to a render receipt whose `provenance` is
// `arc` (written by design-render.sh from the route's own directory, Phase 08 S1). Refused by name:
//   GALLERY            bytes equal to a reference-pack file (a third party's screenshot)
//   NON-ARC            a render receipt says rival:<p> or reference
//   PROVENANCE-ABSENT  a render receipt with no provenance -- never defaulted to arc
//   UNATTRIBUTED       no render receipt at all for these bytes
//   NOT-ALLOWED        a link, a directory, or a file type a package does not carry
// `build` copies the chosen arc renders and then runs `lint` on what it wrote; a package that fails its own
// lint is removed. The receipt binding is written beside the package (package-manifest.json), never in it. Exit 0 clean, 1 refused or usage.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const clean = (v) => String(v).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, " ");
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
// A package carries images and nothing else. A README could say which direction is which as easily as the
// mapping could, and no check reads prose (attack 0b68278 B5), so any text lives BESIDE the package.
const TEXT_ALLOWED = new Set();

function fail(msg) {
  console.log(`design-package: ${clean(msg)}`);
  process.exit(1);
}

function parse(argv, known, repeat = new Set()) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!known.has(k)) fail(`unknown argument '${k}'`);
    if (i + 1 >= argv.length || argv[i + 1] === "") fail(`${k} needs a value`);
    if (repeat.has(k)) (o[k] ??= []).push(argv[i + 1]);
    else if (k in o) fail(`${k} given twice`);
    else o[k] = argv[i + 1];
  }
  return o;
}

// Every file under `dir`, walked without following links. A link is reported, never entered.
function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

// sha256 -> [provenance of every render receipt that names these bytes]. `null` stands for a receipt with no
// provenance field. Built from the receipts themselves, so a package is judged by the record, not by its names.
export function renderIndex(root) {
  const idx = new Map();
  for (const f of walk(join(root, ".claude", "state", "design", "renders"))) {
    if (!f.endsWith(".json")) continue;
    let m;
    try { m = JSON.parse(readFileSync(f, "utf8")); } catch { continue; }
    if (!m || typeof m !== "object" || !/^[0-9a-f]{64}$/.test(String(m.screenshot_sha256 ?? ""))) continue;
    // A receipt counts only for the render it sits beside: its png is a regular, single-link file inside the
    // receipt's own session dir, and its bytes are the hash it claims. A bare JSON naming any bytes as arc --
    // or a receipt pointing at a file elsewhere -- attributes nothing (attack 12b79c2 L1 L2).
    if (!ownRender(root, f, m)) continue;
    const prov = Object.hasOwn(m, "provenance") && typeof m.provenance === "string" && m.provenance !== "" ? m.provenance : null;
    const list = idx.get(m.screenshot_sha256) ?? [];
    list.push(prov);
    idx.set(m.screenshot_sha256, list);
  }
  return idx;
}

// The receipt at `metaFile` names a render it owns: `png` resolves (realpath) inside the receipt's own dir,
// is a regular file with one link, and hashes to the recorded sha. Returns the real path, or null.
export function ownRender(root, metaFile, m) {
  if (typeof m.png !== "string" || !m.png) return null;
  let dir, file;
  try { dir = realpathSync(join(metaFile, "..")); file = realpathSync(resolve(root, m.png)); } catch { return null; }
  if (!file.startsWith(dir + sep)) return null;
  const st = lstatSync(file, { throwIfNoEntry: false });
  if (!st || !st.isFile() || st.nlink !== 1) return null;
  try { if (sha256(readFileSync(file)) !== m.screenshot_sha256) return null; } catch { return null; }
  return file;
}

// sha256 of every file in every reference pack -- a gallery screenshot under any name is still one.
export function galleryIndex(root) {
  const set = new Set();
  for (const f of walk(join(root, ".claude", "state", "design", "refpacks"))) {
    try { set.add(sha256(readFileSync(f))); } catch { /* unreadable: not a pack image we can match */ }
  }
  return set;
}

// The verdict on one package dir: [{file, cls, detail}] -- empty means clean. Pure over its inputs.
export function lintPackage(dir, renders, gallery) {
  const findings = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) { return [{ file: dir, cls: "NOT-ALLOWED", detail: `the package dir cannot be read (${e.code || e.message})` }]; }
  let images = 0;
  const seenBytes = new Map();
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const p = join(dir, e.name);
    if (e.isSymbolicLink()) { findings.push({ file: e.name, cls: "NOT-ALLOWED", detail: "a link -- a package carries files, never pointers" }); continue; }
    if (e.isDirectory()) { findings.push({ file: e.name, cls: "NOT-ALLOWED", detail: "a directory -- a package is flat" }); continue; }
    if (!e.isFile()) { findings.push({ file: e.name, cls: "NOT-ALLOWED", detail: "not a regular file" }); continue; }
    if (TEXT_ALLOWED.has(e.name)) continue;
    if (extname(e.name).toLowerCase() !== ".png") { findings.push({ file: e.name, cls: "NOT-ALLOWED", detail: `a ${extname(e.name) || "typeless"} file -- a package carries PNG renders only; notes live beside it` }); continue; }
    images++;
    const h = sha256(readFileSync(p));
    // One direction, one file: the same render twice is a package that claims more directions than it has.
    if (seenBytes.has(h)) { findings.push({ file: e.name, cls: "DUPLICATE", detail: `the same bytes as ${seenBytes.get(h)}` }); continue; }
    seenBytes.set(h, e.name);
    if (gallery.has(h)) { findings.push({ file: e.name, cls: "GALLERY", detail: "these bytes are a reference-pack image -- a third party's screenshot never leaves the repo" }); continue; }
    const provs = renders.get(h);
    if (!provs || provs.length === 0) { findings.push({ file: e.name, cls: "UNATTRIBUTED", detail: "no render receipt names these bytes -- a package carries only renders arc can show it made" }); continue; }
    const nonArc = [...new Set(provs.filter((x) => x !== null && x !== "arc"))];
    if (nonArc.length) { findings.push({ file: e.name, cls: "NON-ARC", detail: `the render receipt says ${nonArc.join(", ")}` }); continue; }
    if (provs.some((x) => x === null)) { findings.push({ file: e.name, cls: "PROVENANCE-ABSENT", detail: "a render receipt for these bytes carries no provenance -- absent is never read as arc" }); continue; }
  }
  if (images === 0) findings.push({ file: basename(dir), cls: "NOT-ALLOWED", detail: "no images -- an empty package is not a clean one" });
  return findings;
}

function report(findings, dir) {
  for (const f of findings) console.log(clean(`design-package: REFUSED ${f.cls} ${f.file} -- ${f.detail}`));
  console.log(clean(`design-package: ${findings.length ? `${findings.length} refusal(s)` : "clean -- every image is an arc render"} in ${dir}`));
}

function lint(argv) {
  const o = parse(argv, new Set(["--root", "--dir"]));
  if (!o["--root"] || !o["--dir"]) fail("lint needs --root R --dir <package-dir>");
  const root = resolve(o["--root"]);
  const dir = resolve(root, o["--dir"]);
  const findings = lintPackage(dir, renderIndex(root), galleryIndex(root));
  report(findings, relative(root, dir).split(sep).join("/"));
  process.exit(findings.length ? 1 : 0);
}

function build(argv) {
  const o = parse(argv, new Set(["--root", "--explore", "--render", "--viewport", "--out"]), new Set(["--render"]));
  if (!o["--root"] || !o["--explore"] || !o["--render"]) fail("build needs --root R --explore <id> --render variant-<x> [...]");
  const root = resolve(o["--root"]);
  const id = o["--explore"];
  if (!ID.test(id) || RESERVED.test(id)) fail(`--explore '${id}' is not an id`);
  const viewport = o["--viewport"] ?? "1440x900";
  if (!/^[1-9][0-9]{1,4}x[1-9][0-9]{1,4}$/.test(viewport)) fail(`--viewport takes WxH, got '${viewport}'`);
  const renders = o["--render"];
  const seen = new Set();
  for (const v of renders) {
    // Only an arc variant can be asked for at all; a rival or a reference is refused before any copy.
    if (!/^variant-[a-z]$/.test(v)) fail(`--render takes variant-<letter>, got '${v}' -- a package carries arc variants only`);
    if (seen.has(v)) fail(`--render ${v} given twice`);
    seen.add(v);
  }
  const out = resolve(root, o["--out"] ?? join("docs", "design", "blind-test", id, "package"));
  const blindRoot = resolve(root, "docs", "design", "blind-test");
  // Strictly below, one dir per explore: the blind-test root itself is never a package (0b68278 B2).
  if (!(out + sep).startsWith(blindRoot + sep) || dirname(out) === blindRoot || out === blindRoot) fail("--out must be a dir inside docs/design/blind-test/<explore>/");
  if (existsSync(out)) fail(`${relative(root, out).split(sep).join("/")} already exists; a package is built once, into an empty place`);
  // Lexical containment is not containment: every existing component from the repo root down to the package's
  // parent is a real directory, not a link, so the copies and the cleanup land where the name says (12b79c2 L4 B5).
  const manifest = join(out, "..", "package-manifest.json");
  for (let p = dirname(out); ; p = dirname(p)) {
    const st = lstatSync(p, { throwIfNoEntry: false });
    if (st && (st.isSymbolicLink() || !st.isDirectory())) fail(`${relative(root, p).split(sep).join("/") || "."} is a link or not a directory`);
    if (p === root || dirname(p) === p) break;
  }
  if (existsSync(manifest)) fail(`${relative(root, manifest).split(sep).join("/")} already exists; a package is built once, into an empty place`);

  const picked = renders.map((v, i) => {
    const sess = join(root, ".claude", "state", "design", "renders", `${id}--${v}`);
    const metas = existsSync(sess) ? readdirSync(sess).filter((f) => f.endsWith(".json")) : [];
    let best = null;
    for (const f of metas) {
      let m;
      try { m = JSON.parse(readFileSync(join(sess, f), "utf8")); } catch { continue; }
      if (!m || m.viewport !== `${viewport}@1` || typeof m.png !== "string") continue;
      const iter = Number.isInteger(m.iter) ? m.iter : 0;
      if (best && best.iter === iter && best.m.screenshot_sha256 !== m.screenshot_sha256) fail(`${v} has two different renders at iter ${iter}; render it again so one is the latest`);
      if (!best || iter > best.iter) best = { m, iter, meta: join(sess, f) };
    }
    if (!best) fail(`${v} has no render at ${viewport}`);
    if (best.m.provenance !== "arc") fail(`${v}'s latest render records provenance '${clean(best.m.provenance ?? "absent")}', not arc -- render it again with the current renderer`);
    // The same binding the lint uses: realpath inside the receipt's own session, one link, the hashed bytes.
    const file = ownRender(root, best.meta, best.m);
    if (!file) fail(`${v}'s render is not a single-link file inside its own session that hashes to its receipt`);
    return { variant: v, file, sha: best.m.screenshot_sha256, meta: relative(root, best.meta).split(sep).join("/"), name: `direction-${i + 1}.png` };
  });

  // The package is judged by the same lint anyone runs later, and the manifest -- the record that calls these
  // files arc's -- is written only after that lint passes; anything that fails, a throw included, leaves
  // neither behind (12b79c2 L7 B3 B4).
  let findings;
  try {
    // The parent may exist; the package dir itself is claimed exclusively, so two builds cannot share it (B3).
    mkdirSync(dirname(out), { recursive: true });
    mkdirSync(out);
    for (const p of picked) copyFileSync(p.file, join(out, p.name));
    findings = lintPackage(out, renderIndex(root), galleryIndex(root));
    report(findings, relative(root, out).split(sep).join("/"));
    if (!findings.length) writeFileSync(manifest, `${JSON.stringify({ explore: id, built: new Date().toISOString(), viewport, files: picked.map((p) => ({ file: p.name, sha256: p.sha, receipt: p.meta, provenance: "arc" })) }, null, 2)}\n`, { flag: "wx" });
  } catch (e) {
    // A manifest this run half-wrote goes too; one from another run was refused up front (B4).
    try { rmSync(manifest, { force: true }); } catch { /* reported below */ }
    findings = [{ file: basename(out), cls: "NOT-ALLOWED", detail: `the build failed (${e.code || e.message})` }];
    report(findings, relative(root, out).split(sep).join("/"));
  }
  if (findings.length) {
    try { rmSync(out, { recursive: true, force: true }); } catch { /* reported above; left for the operator */ }
    process.exit(1);
  }
  console.log(`design-package: built ${picked.length} direction(s) -- the mapping is package-manifest.json beside the package, never inside it`);
}

// Runs as a command when this file IS the command; realpath both sides, and fall back to the file name so a
// path the realpath cannot resolve still runs rather than silently exiting 0.
const realOf = (p) => { try { return realpathSync(p); } catch { return p; } };
const invoked = process.argv[1] ? realOf(process.argv[1]) : "";
const self = realOf(fileURLToPath(import.meta.url));
if (invoked && (invoked === self || basename(invoked) === basename(self))) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "build") build(rest);
  else if (cmd === "lint") lint(rest);
  else fail("usage: design-package.mjs build|lint --root R ...");
}
