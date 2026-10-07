// design-jury.mjs -- the explore's jury step (Phase 03 S1; ADR-1405, ADR-1411). Called by
// design-explore.sh `jury` and `jury-check`; there was no runner before this, so the contract's
// "the runner collects the rankings" named something that did not exist.
//
//   deal  --root R --id ID --n N --seed S [--viewport WxH] --ref <sha16> [--ref ...] [--rival <provider> ...]
//         The variants' latest renders at one viewport (bytes re-hashed against their metas) plus
//         >=1 screen from the brief's reference pack (each bound to its sources.md row), dealt as
//         item-a.. under a seeded shuffle. The key goes to .claude/state (never committed), written
//         once: a second deal is refused, because a re-deal after seeing rankings is a re-roll.
//         --rival (Phase 07, ADR-1409/1422): the rival's vendored draft at rival-<provider>/, rendered by
//         the same renderer into the same session shape, dealt under the same opaque labels. Its kind lives
//         only in the key. A rival that could not draft is named on a printed line and left out -- the
//         count must then be declared without it, so an arc-only jury is never a silent one.
//   check --root R --id ID
//         Every docs/design/explore/<id>/ranking-*.md against the key: one ranked line of exactly
//         N distinct known items, reference-position left unset, one Why heading per adjacent pair.
//         Each miss is a deviation, logged and counted; any deviation exits 1. No rankings is a
//         refusal, never a clean zero.
//
//   score   --root R --id ID --scores item-a=N,item-b=N,...   (S4, ADR-1411)
//         The owner's blind 0-100 score for EVERY item, once. Refused after unblinding, if the rubric
//         changed since the deal, or if ADR-1411's sealed predictions are not on the record.
//   unblind --root R --id ID
//         Refused until the score exists -- a score recorded after unblinding is not blind, so the
//         ordering IS the assertion. Prints which item was which, and the arc-vs-control bar.
//   catch-rate --root R --id ID
//         Self-review iterations that caught a defect, over all iterations (assumption row 6).
//
// Known limit: a pack screen keeps its own format and size, so an item can differ from the
// renders in ways a juror can see. Phase 07 renders every item through arc's renderer.
//
// Exit: 0 ok | 1 refused, or deviations found.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PROVIDERS } from "./design-rival.mjs";

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const LABELS = "abcdefghijklmnopqrstuvwxyz";
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"]);

const clean = (v) => String(v).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, " ");
function fail(msg) { console.log(`design-explore jury: ${clean(msg)}`); process.exit(1); }
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const validId = (v) => typeof v === "string" && ID.test(v) && !RESERVED.test(v);

// A file the jury copies must be a real image file INSIDE the directory it was found through: not a
// symlink, not a path a meta names anywhere else under the root. A meta that said `png: ".env"` had
// the repo's secrets dealt to a model as an item (S1 attack B1); a symlink in the pack did the same
// through the reference branch (S1 attack L4).
function inside(file, dir, what) {
  let st;
  try { st = lstatSync(file); } catch { fail(`${what} is missing`); }
  if (st.isSymbolicLink() || !st.isFile()) fail(`${what} is not a regular file`);
  let rel;
  try { rel = relative(realpathSync(dir), realpathSync(file)); } catch { fail(`${what} could not be resolved`); }
  if (!rel || rel.split(sep).includes("..") || /^[A-Za-z]:/.test(rel) || rel.startsWith(sep)) fail(`${what} is outside ${dir}`);
  if (!IMAGE_EXT.has(extname(file).toLowerCase())) fail(`${what} is not an image file`);
}

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
  const o = parse(argv, new Set(["--root", "--id", "--n", "--seed", "--viewport", "--ref", "--rubric", "--control", "--rival"]), new Set(["--ref", "--rival"]));
  const root = o["--root"];
  if (!root) fail("--root is required");
  const ex = exploreOf(root, o["--id"]);
  if (!/^[1-9][0-9]?$/.test(o["--n"] ?? "")) fail("--n takes the item count, a whole number with no leading zero");
  const n = Number(o["--n"]);
  if (!/^[0-9]{1,10}$/.test(o["--seed"] ?? "") || Number(o["--seed"]) > 4294967295) fail("--seed takes a whole number below 2^32");
  const seed = Number(o["--seed"]);
  const viewport = o["--viewport"] ?? "1440x900";
  if (!/^[0-9]{2,5}x[0-9]{2,5}$/.test(viewport)) fail("--viewport takes WxH");
  const refs = o["--ref"] ?? [];
  // The rubric and its anchors are fixed BEFORE the run: its sha goes into the key, and a score over a rubric
  // edited after the deal is refused (ADR-1411; the rabbit hole of tuning the rubric until the score rises).
  const rubricRel = o["--rubric"];
  if (!rubricRel || !/^docs\/design\/rubrics\/[a-z0-9][a-z0-9-]*\.md$/.test(rubricRel)) fail("--rubric docs/design/rubrics/<name>.md is required: the owner scores against a rubric fixed before the deal");
  const rubricFile = join(root, rubricRel);
  if (!existsSync(rubricFile) || lstatSync(rubricFile).isSymbolicLink()) fail(`no rubric at ${rubricRel}`);
  const rubricSha = sha256(readFileSync(rubricFile));
  const control = o["--control"] ?? null;
  if (control !== null && !/^[a-z]$/.test(control)) fail("--control names one variant letter");
  if (refs.length === 0) fail("a jury needs at least one reference item from the brief's pack (--ref <sha16>) -- best-of-the-variants is not a bar");
  if (existsSync(ex.jury)) fail(`this explore was already dealt (${ex.jury}); a re-deal after rankings is a re-roll, so it is refused`);

  const items = [];
  // Variants: every variant-<x>/ with an index.html, its highest-iter render at this viewport.
  const variants = readdirSync(ex.dir).filter((d) => /^variant-[a-z]$/.test(d) && existsSync(join(ex.dir, d, "index.html"))).sort();
  if (variants.length < 2) fail(`a jury ranks at least two variants; ${variants.length} found`);
  // The highest-iter render of one dir at this viewport, re-hashed against its meta. Variants and rivals
  // go through this one reader, so a rival cannot arrive by a path the variants do not take.
  const latestRender = (v) => {
    const sess = join(root, ".claude", "state", "design", "renders", `${basename(ex.dir)}--${v}`);
    const metas = existsSync(sess) ? readdirSync(sess).filter((f) => f.endsWith(".json")) : [];
    let best = null;
    for (const f of metas) {
      let m;
      try { m = JSON.parse(readFileSync(join(sess, f), "utf8")); } catch { continue; }
      if (!m || m.viewport !== `${viewport}@1` || typeof m.png !== "string" || !/^[0-9a-f]{64}$/.test(m.screenshot_sha256 || "")) continue;
      const iter = Number.isInteger(m.iter) ? m.iter : 0;
      if (best && best.iter === iter && best.m.route !== m.route) fail(`${v} has two routes rendered at ${viewport}; the jury judges one screen per variant`);
      // Two different renders at one iter: which is dealt would be readdir's order, not the explore's (attack 65d01cc L2).
      if (best && best.iter === iter && best.m.screenshot_sha256 !== m.screenshot_sha256) fail(`${v} has two different renders at iter ${iter} and ${viewport}; render it again so one is the latest`);
      if (!best || iter > best.iter) best = { m, iter, meta: join(sess, f) };
    }
    if (!best) fail(`${v} has no render at ${viewport} (render it first)`);
    const file = join(root, best.m.png);
    inside(file, sess, `${v}'s render ${best.m.png}`);
    const bytes = readFileSync(file);
    if (sha256(bytes) !== best.m.screenshot_sha256) fail(`${v}'s render bytes no longer match its meta; render again`);
    return { file, sha: best.m.screenshot_sha256, meta: best.meta };
  };
  for (const v of variants) {
    const r = latestRender(v);
    items.push({ kind: control === v.slice(-1) ? "control" : "variant", source: v, provenance: "arc", path: r.file, sha256: r.sha, ext: extname(r.file).toLowerCase() });
  }
  // Rivals: each --rival is one provider whose adapter DRAFTED into rival-<provider>/. Provenance comes from
  // the adapter receipt, never from the dir name, so the Phase 08 packager has a record to refuse on.
  const rivals = o["--rival"] ?? [];
  const seenRival = new Set();
  let rivalsLeftOut = 0;
  for (const p of rivals) {
    // The name becomes the path rival-<p>, so it carries the reserved-device half of the grammar too (attack 65d01cc B7).
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(p) || p.endsWith("-") || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(p)) fail(`--rival takes a provider name, got '${p}'`);
    if (seenRival.has(p)) fail(`--rival ${p} given twice`);
    seenRival.add(p);
    const recFile = join(root, ".claude", "state", "design", "rivals", ex.brief, basename(ex.dir), p, "receipt.json");
    let rec = null;
    if (existsSync(recFile)) {
      try { rec = JSON.parse(readRegular(recFile, `the ${p} receipt`).toString("utf8")); } catch { rec = null; }
    }
    const page = join(ex.dir, `rival-${p}`, "index.html");
    if (!rec || rec.status !== "DRAFTED" || !existsSync(page)) {
      const log = join(root, ".claude", "state", "design", "rivals", ex.brief, basename(ex.dir), "status.log");
      const last = existsSync(log) ? readFileSync(log, "utf8").split(/\r?\n/).filter((l) => l.split("\t")[1] === p).pop() : undefined;
      console.log(clean(`design-explore jury: rival ${p} LEFT OUT -- ${last ? last.split("\t").slice(2).join(" ") : "it never drafted for this explore"}; the deal is arc-only for it`));
      rivalsLeftOut++;
      continue;
    }
    // The page on disk must be the page this receipt vendored: a failed later attempt leaves an earlier page
    // in place, and a receipt is only about the bytes it hashed (attack 65d01cc B6).
    const pageSha = rec.vendored && typeof rec.vendored.page_sha256 === "string" ? rec.vendored.page_sha256 : "";
    if (!/^[0-9a-f]{64}$/.test(pageSha)) fail(`the ${p} receipt says DRAFTED but records no vendored page hash; draft it again`);
    if (sha256(readRegular(page, `the ${p} page`)) !== pageSha) fail(`rival-${p}/index.html is not the page its receipt vendored; draft it again`);
    // The version is the stamp Phase 08's packager refuses on, so a receipt without one is refused here rather
    // than dealt as `rival:<p>@` (attack 65d01cc L3), and the stamp is rival:<p>@<version>, one `@` (L15).
    // The receipt must name THIS provider and ITS pinned package: a copied or hand-written receipt naming any
    // package at any version would otherwise stamp a draft Stitch never made (attack ae0aeb8 L5, L10, L14).
    const pinned = Object.hasOwn(PROVIDERS, p) ? PROVIDERS[p].pkg : null;
    if (!pinned) fail(`--rival ${p} is not a rival arc knows (${Object.keys(PROVIDERS).join(", ")})`);
    if (rec.provider !== p || rec.sdk !== pinned) fail(`the ${p} receipt names provider '${clean(String(rec.provider ?? "")).slice(0, 32)}' and package '${clean(String(rec.sdk ?? "")).slice(0, 60)}', not ${p} on the pinned ${pinned}`);
    const ver = /^(@?[a-z0-9][a-z0-9._/-]*)@([0-9][0-9A-Za-z.+-]{0,40})$/.exec(pinned);
    if (!ver) fail(`the ${p} receipt names no pinned package version (sdk '${clean(String(rec.sdk ?? "")).slice(0, 60)}')`);
    const r = latestRender(`rival-${p}`);
    // The render must be newer than the draft it shows: the meta carries no page hash, and a re-draft after a
    // render left the older picture of an older page in the session (attack ae0aeb8 B5).
    const drafted = Date.parse(String(rec.finishedAt ?? ""));
    if (!Number.isFinite(drafted)) fail(`the ${p} receipt records no finish time; draft it again`);
    if (statSync(r.meta).mtimeMs < drafted) fail(`rival-${p}'s render is older than its draft; render it again`);
    items.push({ kind: "rival", source: `rival-${p}`, provenance: `rival:${p}@${ver[2]}`, package: pinned, path: r.file, sha256: r.sha, ext: extname(r.file).toLowerCase() });
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
    inside(file, packDir, `--ref ${r}`);
    const full = sha256(readFileSync(file));
    if (!full.startsWith(r)) fail(`--ref ${r}: the file's bytes hash to ${full.slice(0, 16)}; the pack was changed`);
    // The hash must sit in the sha256 COLUMN of exactly one row: any cell of any row admitted a screen a
    // licensing table or a note merely mentioned (attack ae0aeb8 L6).
    const owning = rows.split(/\r?\n/).filter((l) => l.startsWith("|") && (l.split("|")[3] ?? "").trim() === full);
    if (owning.length === 0) fail(`--ref ${r} has no provenance row in ${sourcesMd}; an unattributed screen never enters a jury`);
    if (owning.length > 1) fail(`--ref ${r} has ${owning.length} provenance rows in ${sourcesMd}; exactly one row attributes a screen`);
    // REQ-09: every item is rendered by arc's own renderer. A pack file dealt as itself stayed a JPEG, or a 2x
    // PNG carrying the gallery's iTXt source URL, and the blindness gate told every reference apart at the file
    // level (2026-10-07). So the deal takes the render of the ref-<sha16>/ frame, whose image must still be
    // these exact pack bytes; the pack hash is kept in the key as the provenance.
    const framed = join(ex.dir, `ref-${r}`, `image${ext}`);
    if (!existsSync(framed)) fail(`--ref ${r} is not framed for this explore; run: design-explore.sh ref ${basename(ex.dir)} --ref ${r}`);
    if (sha256(readRegular(framed, `ref-${r}/image${ext}`)) !== full) fail(`ref-${r}/image${ext} is not the pack screen it names; frame it again`);
    const rr = latestRender(`ref-${r}`);
    if (statSync(rr.meta).mtimeMs < statSync(framed).mtimeMs) fail(`ref-${r}'s render is older than its frame; render it again`);
    items.push({ kind: "reference", source: basename(file, ext), provenance: "reference", pack_sha256: full, path: rr.file, sha256: rr.sha, ext: extname(rr.file).toLowerCase() });
  }
  if (control !== null && !items.some((i) => i.kind === "control")) fail(`--control ${control}: there is no variant-${control} to mark`);
  if (!items.some((i) => i.kind === "variant")) fail("every variant is the control; a jury needs at least one arc variant");
  const rivalCount = items.filter((i) => i.kind === "rival").length;
  if (items.length !== n) fail(`--n ${n} was declared, and ${items.length} items are dealt (${variants.length} variants and ${refs.length} reference(s)${rivals.length ? `, ${rivalCount} rival(s)${rivalsLeftOut ? `, ${rivalsLeftOut} left out` : ""}` : ""}); the count is a contract, so name it right`);
  if (n > LABELS.length) fail(`at most ${LABELS.length} items`);

  // Every item is judged on its bytes BEFORE the jury dir is claimed, so a refusal never leaves a half-dealt
  // jury behind (attack 1773af3 B1). One format, no chunk that can carry where an image came from, and the
  // same chunk set on every item -- a chunk all items share tells none apart (attack 1773af3 L8).
  let chunkSet = null;
  for (const it of items) {
    if (it.ext !== ".png") fail(`${it.source} would be dealt as ${it.ext}; every item is a PNG render, so the format names no kind`);
    const types = pngChunks(readFileSync(it.path));
    if (types === null) fail(`${it.source}'s render is not a well-formed PNG`);
    const telling = types.filter((t) => TELLING_CHUNKS.has(t));
    if (telling.length) fail(`a dealt item carries PNG metadata (${telling.join(", ")}); a dealt item carries none`);
    const sig = types.join(",");
    if (chunkSet === null) chunkSet = sig;
    else if (sig !== chunkSet) fail("the items do not share one PNG chunk set; a different encoder would tell one apart");
  }

  // Fisher-Yates under the seed.
  const next = rng(seed);
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  // The claim: a non-recursive mkdir is atomic, so of two concurrent deals exactly one owns the jury dir, and it
  // is taken only after every check passed. The loser never touches the winner's items (S1 attack B2).
  mkdirSync(dirname(ex.jury), { recursive: true });
  try { mkdirSync(ex.jury); } catch (e) {
    fail(e.code === "EEXIST" ? "this explore was already dealt by another run" : `the jury dir could not be claimed (${e.code || e.message})`);
  }
  const itemsDir = join(ex.jury, "items");
  mkdirSync(itemsDir);
  const key = { id: basename(ex.dir), brief: ex.brief, n, seed, viewport, rubric: { path: rubricRel, sha256: rubricSha }, dealt: new Date().toISOString(), items: [] };
  // Every item leaves the deal looking the same at the file level: one format, no ancillary metadata, one
  // timestamp. Checked on the bytes, not assumed from the pipeline (Phase 07 blindness gate, 2026-10-07).
  const at = new Date(key.dealt);
  // A failure after the claim -- a copy, a re-hash, a timestamp -- releases the claim before it fails, so no
  // half-dealt jury blocks the write-once deal that follows (attack bb0c9a7 L3 L12 B2). Only this run's own
  // fresh dir is removed: the claim above is a non-recursive mkdir that this run won.
  const release = (msg) => { try { rmSync(ex.jury, { recursive: true, force: true }); } catch { /* left for the operator */ } fail(msg); };
  items.forEach((it, i) => {
    const label = `item-${LABELS[i]}`;
    const file = `${label}${it.ext}`;
    try { copyFileSync(it.path, join(itemsDir, file)); } catch (e) { release(`${label} could not be copied (${e.code || e.message})`); }
    if (sha256(readFileSync(join(itemsDir, file))) !== it.sha256) release(`${label} did not copy byte for byte`);
    try { utimesSync(join(itemsDir, file), at, at); } catch (e) { release(`${label}'s timestamp could not be set (${e.code || e.message})`); }
    key.items.push({ label, file, kind: it.kind, source: it.source, provenance: it.provenance, ...(it.package ? { package: it.package } : {}), ...(it.pack_sha256 ? { pack_sha256: it.pack_sha256 } : {}), sha256: it.sha256 });
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
  const files = readdirSync(ex.dir).filter((f) => /^ranking-[1-9][0-9]*\.md$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
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
  // Bound to the exact sealed key it was checked against: id, n and a time all survive a re-deal of the same
  // explore with the same N, and the labels then name other items (attack ae0aeb8 L3).
  const result = { id: key.id, n: key.n, key_sha256: sha256(readFileSync(keyPath)), checked: new Date().toISOString(), deviations: devs.length, rankings };
  const tmp = join(ex.jury, `result.json.${process.pid}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(result, null, 2)}\n`);
  renameSync(tmp, join(ex.jury, "result.json"));
  for (const d of devs) console.log(`design-explore jury-check: DEVIATION ${d.file} ${d.cls} ${clean(d.detail)}`);
  console.log(`design-explore jury-check: ${files.length} ranking(s), ${devs.length} deviation(s)`);
  process.exit(devs.length ? 1 : 0);
}

function loadKey(root, id) {
  const ex = exploreOf(root, id);
  const keyPath = join(ex.jury, "key.json");
  if (!existsSync(keyPath)) fail(`no deal for this explore (${keyPath}); run jury first`);
  let key;
  try { key = JSON.parse(readFileSync(keyPath, "utf8")); } catch { fail("the sealed key does not parse"); }
  return { ex, key };
}

// Write-once: `wx` fails if the file exists, so a second score or a second unblind is refused, not layered.
function writeOnce(file, obj, what) {
  try { writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`, { flag: "wx" }); } catch (e) {
    fail(e.code === "EEXIST" ? `${what} was already recorded (${file}); a ritual step happens once` : `${what} could not be written (${e.code || e.message})`);
  }
}

// Every file the ritual decides on is read as a regular file: a symlink could point anywhere, and a
// directory where a file belongs crashed the read into a stack trace (S4 attack B2 B4).
function readRegular(file, what) {
  let st;
  try { st = lstatSync(file); } catch { fail(`${what} is missing`); }
  if (st.isSymbolicLink() || !st.isFile()) fail(`${what} is not a regular file`);
  try { return readFileSync(file); } catch (e) { fail(`${what} could not be read (${e.code || e.message})`); }
}

function sealedPredictions(root) {
  const dir = join(root, "docs", "adr");
  const adrs = existsSync(dir) ? readdirSync(dir).filter((n) => n.startsWith("1411-")) : [];
  // The first of two is directory order, not the record (S4 attack B1).
  if (adrs.length > 1) fail(`docs/adr holds ${adrs.length} files numbered 1411; exactly one ADR-1411 is the record`);
  const text = adrs.length ? readRegular(join(dir, adrs[0]), `docs/adr/${adrs[0]}`).toString("utf8") : "";
  return /Sealed at kickoff/.test(text) && /1\. post-Phase-03 controlled blind score/.test(text) && /2\. rival-beats-all-arc rate/.test(text) && /3\. the EXP-A1 prediction/.test(text);
}

function score(argv) {
  const o = parse(argv, new Set(["--root", "--id", "--scores"]));
  const root = o["--root"];
  if (!root) fail("--root is required");
  const { ex, key } = loadKey(root, o["--id"]);
  if (existsSync(join(ex.jury, "unblind.json"))) fail("this explore was already unblinded; a score recorded now is not a blind score");
  if (!sealedPredictions(root)) fail("ADR-1411's three sealed predictions are not on the record; they are sealed BEFORE the owner scores");
  if (!key.rubric || !existsSync(join(root, key.rubric.path)) || sha256(readRegular(join(root, key.rubric.path), key.rubric.path)) !== key.rubric.sha256) {
    fail("the rubric changed after the deal (or is gone); anchors are fixed before the run, and a changed one is a recorded decision, not an edit");
  }
  const labels = key.items.map((i) => i.label);
  const scores = {};
  for (const part of String(o["--scores"] ?? "").split(",")) {
    const m = part.trim().match(/^(item-[a-z])=(0|[1-9][0-9]?|100)$/);
    if (!m) fail(`--scores takes item-x=0..100 pairs, got '${part.trim()}'`);
    if (!labels.includes(m[1])) fail(`${m[1]} is not an item of this deal`);
    if (m[1] in scores) fail(`${m[1]} scored twice`);
    scores[m[1]] = Number(m[2]);
  }
  const missing = labels.filter((l) => !(l in scores));
  if (missing.length) fail(`every item is scored, blind: missing ${missing.join(" ")}`);
  const rec = { id: key.id, scored: new Date().toISOString(), by: "owner", rubric: key.rubric, scores };
  writeOnce(join(ex.jury, "score.json"), rec, "the owner's score");
  // The receipt ADR-1411 asks for. The file above is the ordering proof; the spine refuses from a linked worktree
  // by design, so its answer is reported, never assumed.
  const emitted = emitNote(root, join(ex.jury, "score.payload.json"), { lens: "design", what: "owner blind score", explore: key.id, scored: rec.scored, scores }, "score");
  console.log(`design-explore score: ${labels.length} item(s) scored blind at ${rec.scored}; unblind next`);
  if (!emitted) process.exitCode = 4;
}

function unblind(argv) {
  const o = parse(argv, new Set(["--root", "--id"]));
  const root = o["--root"];
  if (!root) fail("--root is required");
  const { ex, key } = loadKey(root, o["--id"]);
  const scorePath = join(ex.jury, "score.json");
  if (!existsSync(scorePath)) fail("no blind score yet; the owner scores BEFORE unblinding, or the score is not blind");
  let sc;
  try { sc = JSON.parse(readFileSync(scorePath, "utf8")); } catch { fail("the score record does not parse"); }
  const at = new Date().toISOString();
  if (!(Date.parse(sc.scored) <= Date.parse(at))) fail("the score's timestamp is not before this unblinding");
  const rows = key.items.map((i) => ({ label: i.label, kind: i.kind, source: i.source, score: sc.scores[i.label] }));
  const best = (kind) => rows.filter((r) => r.kind === kind).reduce((m, r) => (m === null || r.score > m.score ? r : m), null);
  const arc = best("variant"), ctl = best("control"), ref = best("reference"), riv = best("rival");
  const bar = ctl ? { arc: arc.score, control: ctl.score, beats: arc.score > ctl.score } : null;
  // rival-beats-all-arc (the second ADR-1411 sealed prediction), recorded WHICHEVER way it lands: by the
  // owner blind score, and across the panel valid rankings (the rival above every arc variant).
  let rivalRate = null;
  if (riv) {
    const arcLabels = new Set(key.items.filter((i) => i.kind === "variant").map((i) => i.label));
    const rivLabels = new Set(key.items.filter((i) => i.kind === "rival").map((i) => i.label));
    const allLabels = new Set(key.items.map((i) => i.label));
    // The jury half of the rate is read from the CHECKED rankings of THIS deal: a result.json from an earlier
    // deal, or one checked before this deal was made, is refused rather than counted (attack 65d01cc L5).
    let res = null;
    try { res = JSON.parse(readRegular(join(ex.jury, "result.json"), "the checked rankings (result.json)").toString("utf8")); } catch { res = null; }
    const keySha = sha256(readRegular(join(ex.jury, "key.json"), "the sealed key"));
    if (!res || res.id !== key.id || res.n !== key.n || res.key_sha256 !== keySha || !(Date.parse(res.checked) >= Date.parse(key.dealt)) || !Array.isArray(res.rankings)) {
      fail("the rival rate is read from this deal's checked rankings; run jury-check on this deal before unblinding");
    }
    const valid = res.rankings.filter((r) => r && r.valid && Array.isArray(r.ranked));
    for (const r of valid) if (r.ranked.length !== key.n || r.ranked.some((x) => !allLabels.has(x))) fail("a checked ranking names items this deal does not have; run jury-check again");
    const beats = valid.filter((r) => {
      const rp = r.ranked.findIndex((x) => rivLabels.has(x));
      const ap = r.ranked.findIndex((x) => arcLabels.has(x));
      return rp >= 0 && ap >= 0 && rp < ap;
    }).length;
    // A tie is not a win (the sealed prediction is "beats"), and it is NAMED, so the record is unambiguous (L6).
    rivalRate = { owner: { rival: riv.score, bestArc: arc.score, rivalBeatsAllArc: riv.score > arc.score, tie: riv.score === arc.score }, jury: { beats, of: valid.length } };
  }
  writeOnce(join(ex.jury, "unblind.json"), { id: key.id, unblinded: at, scored: sc.scored, rows, bestArc: arc, bestControl: ctl, bestReference: ref, bestRival: riv, bar, rivalBeatsAllArc: rivalRate }, "the unblinding");
  // The key and the score are files on disk; what they carry is printed as text, never as terminal control (S4 attack B3).
  for (const r of rows) console.log(clean(`design-explore unblind: ${r.label} = ${r.kind} ${r.source} -- ${r.score}/100`));
  console.log(clean(`design-explore unblind: best arc ${arc.score}${ctl ? `, plain-prompt control ${ctl.score} (${bar.beats ? "arc beats it" : "arc does NOT beat it"})` : ", no control in this deal"}${ref ? `, reference ${ref.score}` : ""}`));
  if (rivalRate) {
    console.log(clean(`design-explore unblind: rival-beats-all-arc -- owner ${rivalRate.owner.rivalBeatsAllArc ? "YES" : rivalRate.owner.tie ? "no (a tie)" : "no"} (rival ${riv.score} vs best arc ${arc.score}), jury ${rivalRate.jury.beats} of ${rivalRate.jury.of} valid ranking(s)`));
    if (rivalRate.owner.rivalBeatsAllArc) console.log("design-explore unblind: a rival win routes to design-director for a NEW thesis; its markup is never copied (Phase 07)");
    // The sealed prediction's receipt is not optional: a failed emit is a non-zero exit, with the payload kept
    // beside the unblinding so the same receipt can be emitted from the main clone (attack 65d01cc B12).
    if (!emitNote(root, join(ex.jury, "rival-rate.payload.json"), { lens: "design", what: "rival-beats-all-arc", explore: key.id, unblinded: at, ...rivalRate }, "unblind")) process.exitCode = 4;
  }
}

// One note.logged receipt: the payload goes through a file (never argv, which MSYS bash rewrites), the emit
// is bounded in time, and the answer is read. Returns true when emitted.
function emitNote(root, payloadBase, payload, step) {
  // A name only this call uses, written exclusively: a fixed name could already be a link planted in the
  // jury dir, and a truncating write follows it (attack ae0aeb8 B6).
  const payloadFile = payloadBase.replace(/\.json$/, `.${Date.now()}-${process.pid}.json`);
  try { writeFileSync(payloadFile, `${JSON.stringify(payload)}\n`, { flag: "wx" }); } catch (e) { fail(`the ${step} payload could not be written (${e.code || e.message})`); }
  const script = join(root, ".claude", "scripts", "hq", "arc-event.sh");
  const em = spawnSync("bash", [script, "emit", "note.logged", "--payload-file", payloadFile], { encoding: "utf8", timeout: 60000 });
  if (em.status === 0) { console.log(`design-explore ${step}: note.logged receipt emitted`); return true; }
  const why = em.error ? (em.error.code === "ETIMEDOUT" ? "timed out" : em.error.code || em.error.message) : String(em.stderr || "").split("\n").find(Boolean) || `exit ${em.status}`;
  console.log(clean(`design-explore ${step}: note.logged receipt NOT emitted (${clean(String(why)).slice(0, 160)}); the payload is kept at ${relative(root, payloadFile).split(sep).join("/")} -- emit it from the main clone: bash .claude/scripts/hq/arc-event.sh emit note.logged --payload-file <that file>`));
  return false;
}

function catchRate(argv) {
  const o = parse(argv, new Set(["--root", "--id"]));
  const root = o["--root"];
  if (!root) fail("--root is required");
  const ex = exploreOf(root, o["--id"]);
  let iters = 0, caught = 0;
  const per = [];
  for (const v of readdirSync(ex.dir).filter((d) => /^variant-[a-z]$/.test(d)).sort()) {
    const man = join(ex.dir, v, "self-review", "manifest.md");
    // lstat, not existsSync: a dangling symlink is a planted input, not an absent manifest.
    try { lstatSync(man); } catch { continue; }
    const rows = readRegular(man, `${v}/self-review/manifest.md`).toString("utf8").split(/\r?\n/).filter((l) => /^\|\s*[0-9]+\s*\|/.test(l));
    let c = 0;
    for (const r of rows) {
      const cells = r.split("|").map((x) => x.trim());
      if (cells[4] && !/^unchanged/i.test(cells[4])) c++;
    }
    iters += rows.length; caught += c;
    per.push(`${v} ${c}/${rows.length}`);
  }
  if (iters === 0) fail("no self-review iterations recorded in this explore; a rate over nothing is not a rate");
  console.log(`design-explore catch-rate: ${caught}/${iters} iteration(s) caught a defect (${per.join(", ")})`);
}

// Chunks that can carry where an image came from, or when: text, time, EXIF, colour-profile names.
const TELLING_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "tIME", "eXIf", "iCCP"]);

// The ancillary chunk types of a PNG (beyond the four that draw it), or null when the bytes are not a whole PNG.
export function pngAncillary(buf) {
  const t = pngChunks(buf);
  return t === null ? null : t.filter((x) => !["IHDR", "PLTE", "IDAT", "IEND"].includes(x));
}

// Every chunk type of a PNG, de-duplicated in order of first appearance, or null when it is not a whole PNG.
export function pngChunks(buf) {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) return null;
  const extra = [];
  let at = 8;
  let ended = false;
  while (at + 12 <= buf.length) {
    const len = buf.readUInt32BE(at);
    const type = buf.subarray(at + 4, at + 8).toString("latin1");
    if (!/^[A-Za-z]{4}$/.test(type) || at + 12 + len > buf.length) return null;
    extra.push(type);
    at += 12 + len;
    if (type === "IEND") { ended = true; break; }
  }
  // Anything after IEND is a place to hide bytes too.
  if (!ended || at !== buf.length) return null;
  return [...new Set(extra)];
}

// frame: one pack screen copied into the explore's gitignored ref-<sha16>/ dir under a one-image page, so the
// SAME renderer that renders every variant renders it too (REQ-09). Exactly one pack file, its bytes hashed to
// the prefix, its provenance row in the sha256 column of exactly one row -- the deal's own checks, run first.
function frame(argv) {
  const o = parse(argv, new Set(["--root", "--id", "--ref"]));
  const root = o["--root"];
  if (!root) fail("--root is required");
  const ex = exploreOf(root, o["--id"]);
  const r = o["--ref"] ?? "";
  if (!/^[0-9a-f]{16}$/.test(r)) fail(`--ref takes a 16-hex sha prefix, got '${r}'`);
  const packDir = join(root, ".claude", "state", "design", "refpacks", ex.brief);
  const hits = existsSync(packDir) ? readdirSync(packDir).filter((f) => new RegExp(`^[a-z0-9-]+-${r}\\.(png|jpg|jpeg|webp)$`).test(f)) : [];
  if (hits.length !== 1) fail(`--ref ${r}: ${hits.length} pack image(s) match in ${packDir}; exactly one is needed`);
  const file = join(packDir, hits[0]);
  inside(file, packDir, `--ref ${r}`);
  const bytes = readRegular(file, `--ref ${r}`);
  const full = sha256(bytes);
  if (!full.startsWith(r)) fail(`--ref ${r}: the file's bytes hash to ${full.slice(0, 16)}; the pack was changed`);
  const sourcesMd = join(root, "docs", "design", "refpacks", ex.brief, "sources.md");
  const rows = existsSync(sourcesMd) ? readRegular(sourcesMd, "sources.md").toString("utf8") : "";
  const owning = rows.split(/\r?\n/).filter((l) => l.startsWith("|") && (l.split("|")[3] ?? "").trim() === full);
  if (owning.length !== 1) fail(`--ref ${r} has ${owning.length} provenance rows in ${sourcesMd}; exactly one row attributes a screen`);
  const dir = join(ex.dir, `ref-${r}`);
  let st = null;
  try { st = lstatSync(dir); } catch { st = null; }
  if (st && (st.isSymbolicLink() || !st.isDirectory())) fail(`ref-${r} is a link or not a directory`);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (lstatSync(p).isFile() && /^(image\.(png|jpg|jpeg|webp)|index\.html)$/.test(f)) unlinkSync(p);
  }
  const ext = extname(file).toLowerCase();
  writeFileSync(join(dir, `image${ext}`), bytes, { flag: "wx" });
  // The page adds nothing the jury could read: no title text, no caption, the image at the viewport width.
  writeFileSync(join(dir, "index.html"), `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>item</title><style>html,body{margin:0;background:#ffffff}img{display:block;width:100%;height:auto}</style></head><body><main data-arc-surface="product"><img src="image${ext}" alt=""></main></body></html>\n`, { flag: "wx" });
  console.log(`design-explore ref: framed ${r} at docs/design/explore/${basename(ex.dir)}/ref-${r}/ -- render it next`);
}

// Runs as a command only when this file IS the command (both sides realpath-d, so a symlinked checkout
// still runs), so pngAncillary can be imported without the CLI firing.
const realOf = (p) => { try { return realpathSync(p); } catch { return p; } };
const invoked = process.argv[1] ? realOf(process.argv[1]) : "";
const self = realOf(fileURLToPath(import.meta.url));
if (invoked && (invoked === self || basename(invoked) === basename(self))) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "deal") deal(rest);
  else if (cmd === "frame") frame(rest);
  else if (cmd === "check") check(rest);
  else if (cmd === "score") score(rest);
  else if (cmd === "unblind") unblind(rest);
  else if (cmd === "catch-rate") catchRate(rest);
  else fail("usage: design-jury.mjs deal|frame|check|score|unblind|catch-rate --root R --id ID ...");
}
