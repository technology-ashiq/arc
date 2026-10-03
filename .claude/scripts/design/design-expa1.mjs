// design-expa1.mjs -- EXP-A1's harness (design Phase 04; ADR-1400, ADR-1416, ADR-0070).
// Called by design-explore.sh `seal`, `seal-check`, `pair`, `pair-guard` and `exp-a1`.
//
//   seal       --root R --id ID
//       Hash every file of the model-policy phase-02 bundle and copy ADR-1416's sealed prediction,
//       its authorship and the pre-registered formula into
//       initiatives/design/evidence/phase-04/seal-<id>.json. Written once, and only before any
//       composer has armed or written a page for this explore.
//   seal-check --root R --id ID [--bundle DIR]
//       Re-hash the bundle against the seal. Any added, missing or changed file exits 1.
//       --bundle points the same check at another copy (the failing control's scratch copy).
//   pair       --root R --id ID --from X --to Y --from-arm TIER --to-arm TIER
//       Copy variant-X/thesis.txt byte-for-byte to variant-Y and record the pair. Needs the seal.
//   pair-guard --root R --id ID --variant V
//       Run by `compose` before it arms. No pairs file: a no-op. Otherwise the bundle must still
//       match the seal and, if V is paired, both theses must still hash as recorded.
//   exp-a1     --root R --id ID
//       After `unblind`: per pair, which arm the owner scored higher, the mean gap, and the
//       formula's verdict on the gain half. Promotion also needs the owner's cost acceptance,
//       which no script can give.
//
// Arms are router TIERS, never models: the composer's `model:` line is never edited, and the
// tier is a per-invocation override (ADR-0069, ADR-0070).
//
// Exit: 0 ok | 1 refused, or the bundle does not match the seal.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const TIERS = new Set(["balanced-workhorse", "high-judgment"]);
const BUNDLE = "initiatives/model-policy/evidence/phase-02";
const ADR = "docs/adr/1416-the-exp-a1-prediction-is-session-authored-on-the-owners-delegation.md";
const ID = /^[abcdefghijklmnopqrstuvwxyz0123456789-]+$/;
// Pre-registered before the run (Phase 04 spec, 2026-10-04): the formula's "material,
// owner-visible gain", which ADR-0070 named and never quantified.
const FORMULA = {
  gain: "high-judgment wins at least 2 of the 3 same-thesis pairs on the owner's blind score AND its mean beats balanced-workhorse's by at least 10 points out of 100",
  minPairsWon: 2,
  minMeanGap: 10,
  cost: "and the owner explicitly accepts the cost/time of the high-judgment seat; either half failing means no promotion",
};

const clean = (v) => String(v).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, " ");
function fail(msg) {
  console.log(`design-explore exp-a1: ${clean(msg)}`);
  process.exit(1);
}
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function parse(argv, known) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!known.has(k)) fail(`unknown argument '${k}'`);
    if (i + 1 >= argv.length || argv[i + 1] === "" || argv[i + 1].startsWith("--")) fail(`${k} needs a value`);
    if (k in o) fail(`${k} given twice`);
    o[k] = argv[i + 1];
  }
  if (!o["--root"]) fail("--root is required");
  if (!o["--id"] || !ID.test(o["--id"])) fail("--id must be lowercase kebab");
  // A Windows device name passes the grammar and breaks mkdir on one CI leg (attack fab6c70 B4).
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(o["--id"])) fail(`--id '${o["--id"]}' is a reserved device name`);
  return o;
}

// A regular file or nothing: a symlink or a directory where a record belongs is a planted input.
function readRegular(file, what) {
  let st;
  try { st = lstatSync(file); } catch (e) { fail(e.code === "ENOENT" ? `${what} is missing` : `${what} could not be read (${e.code || "error"})`); }
  if (st.isSymbolicLink() || !st.isFile()) fail(`${what} is not a regular file`);
  return readFileSync(file);
}

// Codepoint order, never localeCompare: the host locale would give two CI legs two orders.
const byCodepoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function hashTree(dir) {
  let st;
  try { st = lstatSync(dir); } catch { fail(`the bundle ${dir} is missing`); }
  if (st.isSymbolicLink() || !st.isDirectory()) fail(`the bundle ${dir} is not a directory`);
  const out = {};
  const walk = (d) => {
    for (const n of readdirSync(d).sort(byCodepoint)) {
      const p = join(d, n);
      const s = lstatSync(p);
      const rel = relative(dir, p).split(sep).join("/");
      if (s.isSymbolicLink()) fail(`the bundle holds a link (${rel}); a seal over a link seals whatever it points at`);
      if (s.isDirectory()) walk(p);
      else if (s.isFile()) out[rel] = sha256(readFileSync(p));
      else fail(`the bundle holds something that is not a file (${rel})`);
    }
  };
  walk(dir);
  if (Object.keys(out).length === 0) fail(`the bundle ${dir} holds no files; a seal over nothing proves nothing`);
  return out;
}

const sealPath = (root, id) => join(root, "initiatives", "design", "evidence", "phase-04", `seal-${id}.json`);
const pairsPath = (root, id) => join(root, "docs", "design", "explore", id, "pairs.json");
const exploreDir = (root, id) => {
  const d = join(root, "docs", "design", "explore", id);
  if (!existsSync(d)) fail(`no explore '${id}' -- run init first`);
  return d;
};

function loadJson(file, what) {
  const raw = readRegular(file, what).toString("utf8");
  try { return JSON.parse(raw); } catch { fail(`${what} does not parse`); }
}

function prediction(root) {
  const text = readRegular(join(root, ADR), ADR).toString("utf8");
  if (!/session-authored/i.test(text) || !/Sealed prediction, authored by the kickoff session/.test(text)) {
    fail(`${ADR} no longer carries the session-authored sealed prediction; the seal copies it, it never writes one`);
  }
  const quote = text.split(/\r?\n/).filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s?/, "")).join("\n").trim();
  if (!quote) fail(`${ADR} has no quoted prediction to seal`);
  return { adr: ADR, adrSha256: sha256(Buffer.from(text, "utf8")), authorship: "session-authored on the owner's delegation (ADR-1416); it calibrates the session, not the owner", text: quote };
}

function seal(argv) {
  const o = parse(argv, new Set(["--root", "--id"]));
  const root = o["--root"], id = o["--id"];
  const ex = exploreDir(root, id);
  // Before any composer: no armed marker and no page in any variant of this explore.
  const state = join(root, ".claude", "state", "design");
  if (existsSync(state) && readdirSync(state).some((n) => n.startsWith(`composer-session--${id}--`))) {
    fail("a composer is already armed for this explore; the prediction is sealed before the run, not during it");
  }
  for (const v of readdirSync(ex).filter((d) => /^variant-[a-z]$/.test(d))) {
    if (existsSync(join(ex, v, "index.html"))) fail(`${v} already has a page; the prediction is sealed before the run, not after it`);
  }
  const rec = { id, sealed: new Date().toISOString(), bundle: BUNDLE, files: hashTree(join(root, BUNDLE)), prediction: prediction(root), formula: FORMULA };
  const out = sealPath(root, id);
  mkdirSync(join(out, ".."), { recursive: true });
  try { writeFileSync(out, `${JSON.stringify(rec, null, 2)}\n`, { flag: "wx" }); } catch (e) {
    fail(e.code === "EEXIST" ? `the seal for '${id}' already exists; a prediction is sealed once` : `the seal could not be written (${e.code || e.message})`);
  }
  console.log(`design-explore seal: ${Object.keys(rec.files).length} bundle file(s) hashed, ADR-1416's prediction sealed at ${rec.sealed} -> ${relative(root, out).split(sep).join("/")}`);
}

// Returns the list of differences; empty means the bundle matches the seal.
function compare(rec, dir) {
  const now = hashTree(dir);
  const diffs = [];
  for (const [f, h] of Object.entries(rec.files)) {
    if (!Object.hasOwn(now, f)) diffs.push(`missing ${f}`);
    else if (now[f] !== h) diffs.push(`changed ${f}`);
  }
  for (const f of Object.keys(now)) if (!Object.hasOwn(rec.files, f)) diffs.push(`added ${f}`);
  return diffs;
}

// The seal is a plain file. What it records for the formula must be the formula this code
// pre-registered, or a hand-edited seal could lower the bar (attack fab6c70 L3 L4 B10).
function loadSeal(root, id) {
  const rec = loadJson(sealPath(root, id), `the seal for '${id}'`);
  if (!rec || typeof rec.files !== "object" || rec.files === null || Array.isArray(rec.files)) fail("the seal carries no file hashes");
  if (JSON.stringify(rec.formula) !== JSON.stringify(FORMULA)) fail("the seal's formula is not the pre-registered one; a bar changed after sealing is not a bar");
  if (!Number.isFinite(Date.parse(rec.sealed))) fail("the seal carries no readable timestamp");
  const pr = rec.prediction;
  if (!pr || pr.adr !== ADR || !/^[0-9a-f]{64}$/.test(pr.adrSha256 ?? "") || !/session-authored/.test(pr.authorship ?? "") || typeof pr.text !== "string" || pr.text.trim() === "") {
    fail("the seal carries no sealed prediction with its authorship; a seal without the prediction seals nothing (attack 67551f8 B3)");
  }
  return rec;
}

// pairs.json is a plain file too: every entry is re-validated before it is believed (L8 L10 B7).
function loadPairs(root, id) {
  const pairs = loadJson(pairsPath(root, id), "pairs.json");
  if (!pairs || !Array.isArray(pairs.pairs)) fail("pairs.json carries no pairs list");
  const seen = new Set();
  for (const p of pairs.pairs) {
    if (!p || !/^[a-z]$/.test(p.from) || !/^[a-z]$/.test(p.to) || p.from === p.to) fail("pairs.json holds a pair that does not name two variant letters");
    if (!TIERS.has(p.fromArm) || !TIERS.has(p.toArm) || p.fromArm === p.toArm) fail("pairs.json holds a pair whose arms are not the two tiers");
    if (!/^[0-9a-f]{64}$/.test(p.thesisSha256 ?? "")) fail("pairs.json holds a pair with no thesis hash");
    for (const v of [p.from, p.to]) { if (seen.has(v)) fail(`variant-${v} is in two pairs`); seen.add(v); }
  }
  return pairs;
}

function sealCheck(argv) {
  const o = parse(argv, new Set(["--root", "--id", "--bundle"]));
  const root = o["--root"], id = o["--id"];
  const rec = loadSeal(root, id);
  const dir = o["--bundle"] ?? join(root, BUNDLE);
  const diffs = compare(rec, dir);
  if (diffs.length) fail(`TAMPERED -- ${diffs.length} difference(s) against the seal: ${diffs.join(", ")}`);
  console.log(`design-explore seal-check: ${Object.keys(rec.files).length} file(s) match the seal of ${rec.sealed}`);
}

const letter = (v, flag) => {
  if (!/^[a-z]$/.test(v ?? "")) fail(`${flag} names one variant letter`);
  return v;
};

function pair(argv) {
  const o = parse(argv, new Set(["--root", "--id", "--from", "--to", "--from-arm", "--to-arm"]));
  const root = o["--root"], id = o["--id"];
  const ex = exploreDir(root, id);
  const from = letter(o["--from"], "--from"), to = letter(o["--to"], "--to");
  if (from === to) fail("a variant cannot be paired with itself");
  const fa = o["--from-arm"], ta = o["--to-arm"];
  if (!TIERS.has(fa) || !TIERS.has(ta)) fail(`an arm is a router tier: ${[...TIERS].join(" or ")} (never a model)`);
  if (fa === ta) fail("both sides of a pair on one tier is not an experiment on the tier");
  if (!existsSync(sealPath(root, id))) fail("no seal for this explore; seal the prediction before pairing");
  const thesis = readRegular(join(ex, `variant-${from}`, "thesis.txt"), `variant-${from}/thesis.txt`);
  const toDir = join(ex, `variant-${to}`);
  if (existsSync(toDir) || (() => { try { lstatSync(toDir); return true; } catch { return false; } })()) {
    const st = lstatSync(toDir);
    if (st.isSymbolicLink() || !st.isDirectory()) fail(`variant-${to} is not a real directory`);
  }
  for (const side of [from, to]) {
    if (existsSync(join(ex, `variant-${side}`, "index.html"))) fail(`variant-${side} already has a page; a pair is made before either side composes`);
    if (existsSync(join(root, ".claude", "state", "design", `composer-session--${id}--variant-${side}`))) fail(`variant-${side} has a composer armed; a pair is made before either side composes`);
  }
  const pp = pairsPath(root, id);
  const pairs = existsSync(pp) ? loadPairs(root, id) : { id, base: null, pairs: [] };
  for (const p of pairs.pairs) {
    if ([p.from, p.to].includes(from) || [p.from, p.to].includes(to)) fail(`variant-${[p.from, p.to].includes(from) ? from : to} is already in a pair`);
  }
  const basePath = join(ex, "base-revision.txt");
  const base = existsSync(basePath) ? readRegular(basePath, "base-revision.txt").toString("utf8").trim() : null;
  if (!base) fail("the explore records no base revision; a pair is asserted at one commit");
  if (pairs.base !== null && pairs.base !== base) fail("the base revision moved since the first pair; both arms run at one commit");
  mkdirSync(toDir, { recursive: true });
  const toThesis = join(toDir, "thesis.txt");
  if (existsSync(toThesis) && sha256(readRegular(toThesis, `variant-${to}/thesis.txt`)) !== sha256(thesis)) {
    fail(`variant-${to} already holds a different thesis; a pair copies one thesis, it never merges two`);
  }
  const tmpT = `${toThesis}.tmp-${process.pid}`;
  writeFileSync(tmpT, thesis, { flag: "wx" });
  renameSync(tmpT, toThesis);
  const sh = sha256(thesis);
  if (sha256(readFileSync(toThesis)) !== sh) fail(`the copy of the thesis into variant-${to} does not hash as the original`);
  pairs.base = base;
  pairs.pairs.push({ from, to, fromArm: fa, toArm: ta, thesisSha256: sh });
  const tmp = `${pp}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(pairs, null, 2)}\n`);
  renameSync(tmp, pp);
  console.log(`design-explore pair: variant-${from} (${fa}) and variant-${to} (${ta}) share thesis ${sh.slice(0, 16)} at ${base.slice(0, 12)}`);
}

function pairGuard(argv) {
  const o = parse(argv, new Set(["--root", "--id", "--variant"]));
  const root = o["--root"], id = o["--id"];
  const pp = pairsPath(root, id);
  const sealed = existsSync(sealPath(root, id));
  if (!existsSync(pp) && !sealed) return;
  // The seal is committed evidence; the pairs file sits in the explore. Deleting pairs.json must
  // not turn the guard off for an explore that was sealed as an experiment (attack fab6c70 B3).
  if (!existsSync(pp)) fail("this explore is sealed for EXP-A1 and has no pairs.json; pair the theses before any composer arms");
  const ex = exploreDir(root, id);
  const pairs = loadPairs(root, id);
  const rec = loadSeal(root, id);
  const diffs = compare(rec, join(root, BUNDLE));
  if (diffs.length) fail(`TAMPERED -- the sealed bundle changed before this composer armed: ${diffs.join(", ")}`);
  const v = o["--variant"];
  for (const p of pairs.pairs) {
    if (p.from !== v && p.to !== v) continue;
    for (const side of [p.from, p.to]) {
      const got = sha256(readRegular(join(ex, `variant-${side}`, "thesis.txt"), `variant-${side}/thesis.txt`));
      if (got !== p.thesisSha256) fail(`variant-${side}'s thesis moved since it was paired; one variable means one thesis`);
    }
    const arm = p.from === v ? p.fromArm : p.toArm;
    console.log(`design-explore pair-guard: variant-${v} is the ${arm} arm; spawn its composer with that tier as a per-invocation override`);
  }
}

function report(argv) {
  const o = parse(argv, new Set(["--root", "--id"]));
  const root = o["--root"], id = o["--id"];
  const pairs = loadPairs(root, id);
  const rec = loadSeal(root, id);
  const ex = exploreDir(root, id);
  const drift = compare(rec, join(root, BUNDLE));
  if (drift.length) fail(`TAMPERED -- the sealed bundle changed: ${drift.join(", ")}`);
  for (const p of pairs.pairs) {
    for (const side of [p.from, p.to]) {
      if (sha256(readRegular(join(ex, `variant-${side}`, "thesis.txt"), `variant-${side}/thesis.txt`)) !== p.thesisSha256) fail(`variant-${side}'s thesis moved since it was paired; this pair compares two variables (attack 67551f8 B4)`);
    }
  }
  const ub = loadJson(join(root, ".claude", "state", "design", "explore", id, "jury", "unblind.json"), "the unblinding (run unblind first)");
  if (!Number.isFinite(Date.parse(ub.scored))) fail("the unblinding carries no readable score timestamp");
  if (!(Date.parse(rec.sealed) < Date.parse(ub.scored))) fail("the seal is not dated before the owner's score; it is not a prediction");
  if (!Array.isArray(ub.rows)) fail("the unblinding carries no rows");
  const scoreOf = (v) => {
    const rs = ub.rows.filter((x) => x && x.source === `variant-${v}`);
    if (rs.length !== 1) fail(`variant-${v} has ${rs.length} rows in the unblinding; exactly one is the record`);
    const sc = rs[0].score;
    if (!Number.isInteger(sc) || sc < 0 || sc > 100) fail(`variant-${v}'s score is not a whole number 0-100`);
    return sc;
  };
  const hj = [], wh = [];
  let hjWins = 0;
  for (const p of pairs.pairs) {
    const s = { [p.fromArm]: scoreOf(p.from), [p.toArm]: scoreOf(p.to) };
    hj.push(s["high-judgment"]); wh.push(s["balanced-workhorse"]);
    const won = s["high-judgment"] > s["balanced-workhorse"] ? "high-judgment" : s["high-judgment"] < s["balanced-workhorse"] ? "balanced-workhorse" : "tie";
    if (won === "high-judgment") hjWins++;
    console.log(`design-explore exp-a1: thesis ${p.thesisSha256.slice(0, 16)} -- balanced-workhorse ${s["balanced-workhorse"]}, high-judgment ${s["high-judgment"]} -> ${won}`);
  }
  if (pairs.pairs.length === 0) fail("no pairs recorded; there is nothing to compare");
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const gap = mean(hj) - mean(wh);
  const gain = hjWins >= rec.formula.minPairsWon && gap >= rec.formula.minMeanGap;
  console.log(`design-explore exp-a1: high-judgment won ${hjWins}/${pairs.pairs.length} pairs, mean gap ${gap.toFixed(1)} (high-judgment ${mean(hj).toFixed(1)} vs balanced-workhorse ${mean(wh).toFixed(1)})`);
  console.log(`design-explore exp-a1: formula gain half ${gain ? "MET" : "NOT MET"} (${rec.formula.gain}); ${gain ? "promotion still needs the owner's explicit cost/time acceptance" : "no promotion"}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "seal") seal(rest);
else if (cmd === "seal-check") sealCheck(rest);
else if (cmd === "pair") pair(rest);
else if (cmd === "pair-guard") pairGuard(rest);
else if (cmd === "exp-a1") report(rest);
else fail("usage: design-expa1.mjs seal|seal-check|pair|pair-guard|exp-a1 --root R --id ID ...");
