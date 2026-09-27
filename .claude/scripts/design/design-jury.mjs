// design-jury.mjs -- the explore's jury step (Phase 03 S1; ADR-1405, ADR-1411). Called by
// design-explore.sh `jury` and `jury-check`; there was no runner before this, so the contract's
// "the runner collects the rankings" named something that did not exist.
//
//   deal  --root R --id ID --n N --seed S [--viewport WxH] --ref <sha16> [--ref ...]
//         The variants' latest renders at one viewport (bytes re-hashed against their metas) plus
//         >=1 screen from the brief's reference pack (each bound to its sources.md row), dealt as
//         item-a.. under a seeded shuffle. The key goes to .claude/state (never committed), written
//         once: a second deal is refused, because a re-deal after seeing rankings is a re-roll.
//   check --root R --id ID
//         Every docs/design/explore/<id>/ranking-*.md against the key: one ranked line of exactly
//         N distinct known items, reference-position left unset, one Why heading per adjacent pair.
//         Each miss is a deviation, logged and counted; any deviation exits 1. No rankings is a
//         refusal, never a clean zero.
//
// Known limit: a pack screen keeps its own format and size, so an item can differ from the
// renders in ways a juror can see. Phase 07 renders every item through arc's renderer.
//
// Exit: 0 ok | 1 refused, or deviations found.
import { createHash } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const LABELS = "abcdefghijklmnopqrstuvwxyz";
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"]);

const clean = (v) => String(v).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, " ");
function fail(msg) { console.log(`design-explore jury: ${clean(msg)}`); process.exit(1); }
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const validId = (v) => typeof v === "string" && ID.test(v) && !RESERVED.test(v);

function parse(argv, known, repeat = new Set()) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!known.has(k)) fail(`unknown argument '${k}'`);
    if (i + 1 >= argv.length || argv[i + 1] === "" || argv[i + 1].startsWith("--")) fail(`${k} needs a value`);
    if (repeat.has(k)) (o[k] ??= []).push(argv[i + 1]);
    else if (k in o) fail(`${k} given twice`);
    else o[k] = argv[i + 1];
  }
  return o;
}

// mulberry32: a small seeded PRNG, so one seed deals one order on every OS.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function exploreOf(root, id) {
  if (!validId(id)) fail(`the explore id must match ${ID} and not be a device name`);
  const dir = join(root, "docs", "design", "explore", id);
  const rec = join(dir, "explore.txt");
  if (!existsSync(rec)) fail(`no explore '${id}' here (no ${rec})`);
  const line = readFileSync(rec, "utf8").split(/\r?\n/).find((l) => l.startsWith("brief="));
  const briefPath = line ? line.slice("brief=".length).trim() : "";
  const brief = basename(dirname(briefPath));
  if (!/^docs\/design\/briefs\/[^/]+\/brief\.md$/.test(briefPath) || !validId(brief)) fail(`explore.txt names no brief under docs/design/briefs/<id>/brief.md (got '${briefPath}')`);
  return { dir, brief, jury: join(root, ".claude", "state", "design", "explore", id, "jury") };
}

function deal(argv) {
  const o = parse(argv, new Set(["--root", "--id", "--n", "--seed", "--viewport", "--ref"]), new Set(["--ref"]));
  const root = o["--root"];
  if (!root) fail("--root is required");
  const ex = exploreOf(root, o["--id"]);
  if (!/^[0-9]{1,2}$/.test(o["--n"] ?? "")) fail("--n takes the item count, a whole number");
  const n = Number(o["--n"]);
  if (!/^[0-9]{1,10}$/.test(o["--seed"] ?? "") || Number(o["--seed"]) > 4294967295) fail("--seed takes a whole number below 2^32");
  const seed = Number(o["--seed"]);
  const viewport = o["--viewport"] ?? "1440x900";
  if (!/^[0-9]{2,5}x[0-9]{2,5}$/.test(viewport)) fail("--viewport takes WxH");
  const refs = o["--ref"] ?? [];
  if (refs.length === 0) fail("a jury needs at least one reference item from the brief's pack (--ref <sha16>) -- best-of-the-variants is not a bar");
  if (existsSync(join(ex.jury, "key.json"))) fail(`this explore was already dealt (${join(ex.jury, "key.json")}); a re-deal after rankings is a re-roll, so it is refused`);

  const items = [];
  // Variants: every variant-<x>/ with an index.html, its highest-iter render at this viewport.
  const variants = readdirSync(ex.dir).filter((d) => /^variant-[a-z]$/.test(d) && existsSync(join(ex.dir, d, "index.html"))).sort();
  if (variants.length < 2) fail(`a jury ranks at least two variants; ${variants.length} found`);
  for (const v of variants) {
    const sess = join(root, ".claude", "state", "design", "renders", `${basename(ex.dir)}--${v}`);
    const metas = existsSync(sess) ? readdirSync(sess).filter((f) => f.endsWith(".json")) : [];
    let best = null;
    for (const f of metas) {
      let m;
      try { m = JSON.parse(readFileSync(join(sess, f), "utf8")); } catch { continue; }
      if (!m || m.viewport !== `${viewport}@1` || typeof m.png !== "string" || !/^[0-9a-f]{64}$/.test(m.screenshot_sha256 || "")) continue;
      const iter = Number.isInteger(m.iter) ? m.iter : 0;
      if (best && best.iter === iter && best.m.route !== m.route) fail(`${v} has two routes rendered at ${viewport}; the jury judges one screen per variant`);
      if (!best || iter > best.iter) best = { m, iter };
    }
    if (!best) fail(`${v} has no render at ${viewport} (render it first)`);
    if (best.m.png.includes("..") || best.m.png.startsWith("/") || /^[A-Za-z]:/.test(best.m.png)) fail(`${v}'s meta names a png outside the tree`);
    const file = join(root, best.m.png);
    if (!existsSync(file)) fail(`${v}'s render ${best.m.png} is missing`);
    const bytes = readFileSync(file);
    if (sha256(bytes) !== best.m.screenshot_sha256) fail(`${v}'s render bytes no longer match its meta; render again`);
    items.push({ kind: "variant", source: v, path: file, sha256: best.m.screenshot_sha256, ext: extname(file).toLowerCase() || ".png" });
  }
  // References: each --ref is one pack image, bound to a provenance row in the brief's sources.md.
  const packDir = join(root, ".claude", "state", "design", "refpacks", ex.brief);
  const sourcesMd = join(root, "docs", "design", "refpacks", ex.brief, "sources.md");
  const rows = existsSync(sourcesMd) ? readFileSync(sourcesMd, "utf8") : "";
  const seenRef = new Set();
  for (const r of refs) {
    if (!/^[0-9a-f]{16}$/.test(r)) fail(`--ref takes a 16-hex sha prefix, got '${r}'`);
    if (seenRef.has(r)) fail(`--ref ${r} given twice`);
    seenRef.add(r);
    const hits = existsSync(packDir) ? readdirSync(packDir).filter((f) => new RegExp(`^[a-z0-9-]+-${r}\\.[a-z]+$`).test(f)) : [];
    if (hits.length !== 1) fail(`--ref ${r}: ${hits.length} pack image(s) match in ${packDir}; exactly one is needed`);
    const file = join(packDir, hits[0]);
    const ext = extname(file).toLowerCase();
    if (!IMAGE_EXT.has(ext)) fail(`--ref ${r} is not an image file`);
    const full = sha256(readFileSync(file));
    if (!full.startsWith(r)) fail(`--ref ${r}: the file's bytes hash to ${full.slice(0, 16)}; the pack was changed`);
    if (!rows.split(/\r?\n/).some((l) => l.startsWith("|") && l.split("|").map((c) => c.trim()).includes(full))) {
      fail(`--ref ${r} has no provenance row in ${sourcesMd}; an unattributed screen never enters a jury`);
    }
    items.push({ kind: "reference", source: basename(file, ext), path: file, sha256: full, ext });
  }
  if (items.length !== n) fail(`--n ${n} was declared, and ${items.length} items are dealt (${variants.length} variants and ${refs.length} reference(s)); the count is a contract, so name it right`);
  if (n > LABELS.length) fail(`at most ${LABELS.length} items`);

  // Fisher-Yates under the seed.
  const next = rng(seed);
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  const itemsDir = join(ex.jury, "items");
  mkdirSync(itemsDir, { recursive: true });
  const key = { id: basename(ex.dir), brief: ex.brief, n, seed, viewport, dealt: new Date().toISOString(), items: [] };
  items.forEach((it, i) => {
    const label = `item-${LABELS[i]}`;
    const file = `${label}${it.ext}`;
    copyFileSync(it.path, join(itemsDir, file));
    if (sha256(readFileSync(join(itemsDir, file))) !== it.sha256) fail(`${label} did not copy byte for byte`);
    key.items.push({ label, file, kind: it.kind, source: it.source, sha256: it.sha256 });
  });
  const body = `${JSON.stringify(key, null, 2)}\n`;
  // Written once: `wx` refuses if another deal got there first.
  try { writeFileSync(join(ex.jury, "key.json"), body, { flag: "wx" }); } catch (e) {
    fail(e.code === "EEXIST" ? "this explore was already dealt by another run" : `the key could not be written (${e.code || e.message})`);
  }
  console.log(`design-explore jury: dealt ${n} items to ${itemsDir.split("\\").join("/")} -- ${key.items.map((i) => i.file).join(" ")}`);
  console.log(`design-explore jury: key sealed, sha256 ${sha256(body)}; each juror gets the items dir and the brief, never the key`);
}

function check(argv) {
  const o = parse(argv, new Set(["--root", "--id"]));
  const root = o["--root"];
  if (!root) fail("--root is required");
  const ex = exploreOf(root, o["--id"]);
  const keyPath = join(ex.jury, "key.json");
  if (!existsSync(keyPath)) fail(`no deal for this explore (${keyPath}); run jury first`);
  let key;
  try { key = JSON.parse(readFileSync(keyPath, "utf8")); } catch { fail("the sealed key does not parse"); }
  const labels = key.items.map((i) => i.label);
  const kindOf = Object.fromEntries(key.items.map((i) => [i.label, i]));
  const files = readdirSync(ex.dir).filter((f) => /^ranking-[0-9]+\.md$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (files.length === 0) fail("no rankings to check -- an empty panel is not a clean one");

  const devs = [];
  const rankings = [];
  for (const f of files) {
    const text = readFileSync(join(ex.dir, f), "utf8");
    const lines = text.split(/\r?\n/);
    const mine = [];
    const dev = (cls, detail = "") => mine.push({ file: f, cls, detail });
    const ranked = lines.filter((l) => /^- ranked:/.test(l));
    let order = [];
    if (ranked.length !== 1) dev("ranked-line-count", String(ranked.length));
    else {
      order = ranked[0].slice("- ranked:".length).split(">").map((s) => s.trim()).filter(Boolean);
      const seen = new Set();
      for (const x of order) {
        if (!/^item-[a-z]$/.test(x) || !labels.includes(x)) dev("unknown-item", x);
        else if (seen.has(x)) dev("duplicate-item", x);
        seen.add(x);
      }
      for (const l of labels) if (!seen.has(l)) dev("missing-item", l);
      if (order.length !== key.n) dev("count", `${order.length} of ${key.n}`);
    }
    const refLines = lines.filter((l) => /^- reference-position:/.test(l));
    if (refLines.length !== 1 || refLines[0].trim() !== "- reference-position: unset") dev("reference-guess", refLines.map((l) => l.trim()).join(" / ") || "absent");
    const whys = lines.map((l) => l.match(/^## Why (\S+) over (\S+)\s*$/)).filter(Boolean).map((m) => `${m[1]}>${m[2]}`);
    const want = order.slice(1).map((x, i) => `${order[i]}>${x}`);
    if (whys.join(",") !== want.join(",")) dev("why-pairs", `${whys.length} heading(s), ${want.length} expected`);

    const valid = mine.length === 0;
    const refPos = valid ? order.findIndex((x) => kindOf[x].kind === "reference") + 1 : null;
    rankings.push({ file: f, valid, deviations: mine.map((d) => d.cls), ranked: order, sources: valid ? order.map((x) => kindOf[x].source) : null, referencePosition: refPos });
    devs.push(...mine);
  }
  if (devs.length) {
    const ts = new Date().toISOString();
    appendFileSync(join(ex.jury, "deviations.log"), devs.map((d) => `${ts}\t${d.file}\t${d.cls}\t${clean(d.detail)}\n`).join(""));
  }
  const result = { id: key.id, n: key.n, checked: new Date().toISOString(), deviations: devs.length, rankings };
  const tmp = join(ex.jury, `result.json.${process.pid}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(result, null, 2)}\n`);
  renameSync(tmp, join(ex.jury, "result.json"));
  for (const d of devs) console.log(`design-explore jury-check: DEVIATION ${d.file} ${d.cls} ${clean(d.detail)}`);
  console.log(`design-explore jury-check: ${files.length} ranking(s), ${devs.length} deviation(s)`);
  process.exit(devs.length ? 1 : 0);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "deal") deal(rest);
else if (cmd === "check") check(rest);
else fail("usage: design-jury.mjs deal|check --root R --id ID ...");
