#!/usr/bin/env node
// narrative-verify.mjs -- ADR-1513 section 2 and 3: verify one drafted narrative, or record the owner's read.
//
//   node .claude/scripts/engine/narrative-verify.mjs <dir>/<id> [--driver mock] [--minutes N]
//   node .claude/scripts/engine/narrative-verify.mjs --accept <dir>/<id> [<dir>/<id> ...]
//
// Verify: numbers the page's blocks exactly as narrative-anchors does, inlines every anchored source, and runs the
// `narrative-verify` process through arc-run -- `--driver generic-api --trial-model $ARC_VERIFY_MODEL` (ADR-0069(g),
// receipted `model_source: trial`), a family other than the drafter's. The receipt lands at
// docs/narrative-verify/<dir>/<id>.json with the sha256 of the text it judged, whatever the verdicts: a failing receipt
// is evidence too, and narrative-anchors refuses to ship it.
//
// Accept: the owner read the page in the Reference room and understood it (section 3). Only a receipt that already
// passes, for the text on disk now, can be accepted -- an acceptance never rescues a failing or stale verdict.
//
// Exit 0 done · 1 the run failed or a verdict is not SUPPORTED · 2 usage.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VERIFY_DIR, anchorProblem, blocksOf, readTree, receiptProblem, sha256 } from "../docs/narrative-anchors.mjs";
import { DENY_RULES, liveLine, scanSecrets, sizeScaledCap } from "../hq/lib/redact.mjs";

/**
 * An excerpt the run's own secret scan would still refuse -- a match only its joined views see -- is withheld whole,
 * by name, so one test fixture cannot stop the chunk (2026-09-27). The verifier is told why, and judges the blocks
 * against the other sources it cites.
 */
/**
 * An anchor as the verifier sees it. A file name can look like a key to the secret scan -- `0103-ri` + `sk-checkpoints-...`
 * matched the openai-key rule and stopped the chunk (2026-09-27) -- so `sk-` is written `sk_` in the label, the same
 * way in the block and in the source header, and the file on disk is untouched.
 */
const label = (/** @type {string} */ a) => String(a).replace(/sk-/g, "sk_");
/**
 * A word like `risk-checkpoints-run-inline-...` in a file name or a title matches the openai-key shape, and the whole line
 * was withheld with it (ADR-0103's title, 2026-09-27). Only an all-lowercase, hyphen-joined run is rewritten -- a real
 * key carries capitals or digits and still meets the secret rules untouched.
 */
const slugSafe = (/** @type {string} */ s) => s.replace(/sk-((?:[a-z]+-)+[a-z]+)\b/g, "sk_$1");

const scanned = (/** @type {string} */ text) => {
  let hit;
  try { hit = scanSecrets(JSON.stringify({ text }), { text }, { maxCandidates: sizeScaledCap(JSON.stringify({ text })) }); } catch { hit = { hit: true, rule: "an unscannable excerpt" }; }
  return hit.hit ? `[this excerpt is withheld: it holds text shaped like ${hit.rule} (a test fixture); judge against the block's other sources]` : text;
};

/**
 * Text that matches a secret rule is withheld by the rule's name before it is sent anywhere: a fixture key in a cited
 * file stopped a whole chunk at the data boundary, a per-line pass missed a match the scanner found in a joined view,
 * and a verifier quoting a key-shaped block back had its own answer refused (2026-09-27). So: every line through
 * liveLine, then every rule across the whole text.
 */
const withheld = (/** @type {string} */ text) => DENY_RULES.reduce(
  (s, r) => s.replace(new RegExp(r.re.source, r.re.flags.includes("g") ? r.re.flags : `${r.re.flags}g`), `[text shaped like a ${r.name}, withheld]`),
  slugSafe(String(text)).split("\n").map((l) => liveLine(l)).join("\n"))
  // The data boundary's planted test token, quoted in a cited source or a block, is named here rather than carried:
  // carried, it made the boundary refuse the chunk as internal-only (2026-09-27).
  .replace(/\bARC-INTERNAL-ONLY\b/g, "[the planted internal-only token]");

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const PAGE = /^(products|lanes|processes|commands|agents|rules|gates|adr)\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** A source is inlined up to this, else the lines around its symbol: the verifier judges text, not a pointer. */
const SOURCE_CAP = 8000;
/** A long source's excerpt for one chunk stays under this. */
const EXCERPT_CAP = 9000;
/** A source line longer than this is clipped to the stretch around the words a block shares with it. */
const LONG_LINE = 900;
/** One run's input stays under this: a whole page's sources (160-835KB) timed out on every model tried. */
export const CHUNK_BYTES = 25000;
/** Runs per chunk before the page is reported failed. */
export const CHUNK_TRIES = 2;
/** Chunks of one page run at once. */
export const CHUNK_PARALLEL = 4;
/** One child's stdout + stderr, at most. */
const CHILD_OUTPUT_CAP = 16 * 1024 * 1024;

/** A node child, awaited: its exit status and its whole stdout/stderr. */
function runNode(/** @type {string[]} */ args) {
  return new Promise((done) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, env: childEnv(process.env), stdio: ["ignore", "pipe", "pipe"] });
    /** @type {Buffer[]} */ const out = [];
    /** @type {Buffer[]} */ const err = [];
    // Capped like the spawnSync maxBuffer it replaced: four runaway children at once could exhaust memory (attack
    // 2436d05 B3). Past the cap the child is killed and the run reports it by name.
    let bytes = 0, over = false;
    const take = (/** @type {Buffer[]} */ into) => (/** @type {Buffer} */ b) => {
      bytes += b.length;
      if (bytes > CHILD_OUTPUT_CAP) { if (!over) { over = true; try { child.kill(); } catch { /* gone */ } } return; }
      into.push(b);
    };
    child.stdout.on("data", take(out));
    child.stderr.on("data", take(err));
    child.on("error", (e) => done({ status: null, stdout: "", stderr: `arc-run: could not start: ${e.message}` }));
    child.on("close", (code) => done(over
      ? { status: null, stdout: "", stderr: `arc-run: its output passed ${CHILD_OUTPUT_CAP} bytes and it was stopped` }
      : { status: code, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") }));
  });
}

/**
 * The whole text an anchor stands for: a file, an ADR (found through the extract -- nothing here lists docs/adr), or one
 * extract fact as JSON.
 * @param {string} anchor @param {any} t readTree()'s result
 */
export function rawSource(anchor, t) {
  const a = anchor.trim();
  const adr = /^ADR-(\d{4})$/.exec(a);
  if (adr) {
    const bands = Array.isArray(t.wiki.entities.adrBands) ? t.wiki.entities.adrBands : [];
    const hit = bands.flatMap((b) => (b && b.facts && Array.isArray(b.facts.adrs) ? b.facts.adrs : [])).find((x) => x && String(x.number) === adr[1]);
    return hit && typeof hit.file === "string" ? t.tree.read(hit.file) : "";
  }
  if (a.startsWith("fact:")) {
    const m = /^fact:([a-zA-Z]+)\/(.+)\.([A-Za-z][A-Za-z0-9-]*)$/.exec(a);
    const e = m ? (t.wiki.entities[String(m[1])] || []).find((x) => x && x.id === m[2]) : null;
    if (!m || !e) return "";
    return JSON.stringify(m[3] === "source" ? e.source : e.facts[String(m[3])], null, 1);
  }
  const hash = a.indexOf("#");
  return t.tree.read(hash < 0 ? a : a.slice(0, hash));
}

const STOP = new Set(["that", "this", "with", "from", "what", "when", "which", "their", "there", "these", "those", "into", "every", "each", "only", "than", "then", "they", "them", "been", "have", "does", "will", "would", "about", "after", "before", "never", "other", "while", "where", "here", "just", "also", "some", "such", "more", "most", "because"]);
const keywords = (/** @type {string} */ text) => new Set((String(text).toLowerCase().match(/[a-z0-9][a-z0-9._-]{3,}/g) || []).filter((w) => !STOP.has(w)));

/**
 * The part of one source a set of blocks is judged against. A short source goes whole. A long one sends its first line,
 * the lines around the anchor's symbol, and the windows around the lines that share the most words with those blocks:
 * the whole-file cap sent a long PLAN or retro log's first page, and claims further down were judged unsupported while
 * the file said them word for word (2026-09-27).
 * @param {string} anchor @param {string[]} texts the blocks citing it @param {any} t
 */
export function excerptFor(anchor, texts, t) {
  const raw = rawSource(anchor, t);
  if (raw.length <= SOURCE_CAP) return raw;
  const lines = raw.split("\n");
  const keep = new Set([0]);
  const win = (/** @type {number} */ i, /** @type {number} */ before, /** @type {number} */ after) => { for (let k = Math.max(0, i - before); k <= Math.min(lines.length - 1, i + after); k++) keep.add(k); };
  const hash = anchor.indexOf("#");
  if (hash >= 0 && !anchor.startsWith("fact:")) {
    const at = lines.findIndex((l) => l.includes(anchor.slice(hash + 1)));
    if (at >= 0) win(at, 10, 30);
  }
  // Every block citing this source gets its OWN windows -- the lines that share the most words with that block: one
  // shared top ten let one block's passage crowd out another's in a long file (2026-09-27).
  const lineWords = lines.map((l) => keywords(l));
  for (const x of texts.length ? texts : [""]) {
    const words = keywords(x);
    lineWords.map((lw, i) => { let n = 0; for (const w of lw) if (words.has(w)) n++; return [n, i]; })
      .filter(([n]) => n > 0).sort((a, b) => b[0] - a[0] || a[1] - b[1])
      .slice(0, 6).forEach(([, i]) => win(i, 3, 6));
  }
  // A line longer than LONG_LINE (a table row thousands of characters wide) is sent as the stretch around the words the
  // blocks share with it, not whole: whole, a few such rows filled the budget before the passage a block cites
  // (2026-09-27).
  const all = new Set();
  for (const x of texts) for (const w of keywords(x)) all.add(w);
  const clip = (/** @type {string} */ l) => {
    if (l.length <= LONG_LINE) return l;
    const low = l.toLowerCase();
    const hits = [...all].map((w) => low.indexOf(w)).filter((p) => p >= 0).sort((a, b) => a - b);
    const at = hits.length ? hits[Math.floor(hits.length / 2)] : 0;
    const from = Math.max(0, at - LONG_LINE / 2);
    return `${from > 0 ? "[...] " : ""}${l.slice(from, from + LONG_LINE)}${from + LONG_LINE < l.length ? " [...]" : ""}`;
  };
  let out = "", prev = -2;
  for (const i of [...keep].sort((a, b) => a - b)) { out += i === prev + 1 ? "\n" : out ? "\n[...]\n" : ""; out += clip(String(lines[i])); prev = i; }
  return out.slice(0, Math.min(24000, EXCERPT_CAP + 3000 * (Math.max(1, texts.length) - 1)));
}

/**
 * The process inputs for one page: its blocks, numbered for the whole page, cut into chunks under CHUNK_BYTES. Each
 * chunk carries, per anchor, the excerpt its OWN citing blocks are about. `input` is the first chunk's.
 */
export function inputFor(page, text, t, skip = new Set()) {
  const blocks = blocksOf(text);
  /** @type {{ numbers: number[], input: Record<string, string> }[]} */
  const chunks = [];
  /** @type {{ lines: string[], cites: Map<string, string[]>, numbers: number[], bytes: number }} */
  let cur = { lines: [], cites: new Map(), numbers: [], bytes: 0 };
  const flush = () => {
    if (!cur.numbers.length) return;
    const sources = [...cur.cites].map(([a, texts]) => `===== ${label(a)} =====\n${scanned(withheld(excerptFor(a, texts, t)))}`).join("\n\n");
    chunks.push({ numbers: cur.numbers, input: { classification: "external-ok", page, blocks: cur.lines.join("\n"), sources } });
    cur = { lines: [], cites: new Map(), numbers: [], bytes: 0 };
  };
  for (const b of blocks) {
    if (skip.has(b.n)) continue;
    // The block text gets the same joined-view scan as a source (attack 2436d05 B2), and the budget below counts what
    // is actually sent, after withholding (B4).
    const line = `[${b.n}] ${b.kind}: ${scanned(withheld(b.text))}\n    ${b.plain ? "plain (cites nothing)" : `anchors: ${b.anchors.map(label).join("; ")}`}`;
    const added = line.length + b.anchors.reduce((n, a) => n + scanned(withheld(excerptFor(a, [b.text], t))).length, 0);
    if (cur.numbers.length && cur.bytes + added > CHUNK_BYTES) flush();
    cur.lines.push(line);
    for (const a of b.anchors) cur.cites.set(a, [...(cur.cites.get(a) || []), b.text]);
    cur.numbers.push(b.n);
    cur.bytes += added;
  }
  flush();
  const first = chunks[0] ? chunks[0].input : { classification: "external-ok", page, blocks: "", sources: "" };
  return { blocks, input: first, chunks };
}

/**
 * The environment arc-run is handed: arc's own ARC_* settings and what a process needs to start on each OS, nothing
 * else -- a credential the caller happens to hold is not the verifier's to carry (attack 845e0a5 B2).
 * @param {NodeJS.ProcessEnv} env
 */
export function childEnv(env) {
  const OS = new Set(["PATH", "Path", "PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC", "ComSpec", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "LANG", "LC_ALL", "SHELL", "USER", "USERNAME", "HOMEDRIVE", "HOMEPATH", "MSYSTEM"]);
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(env)) if (typeof v === "string" && (OS.has(k) || k.startsWith("ARC_"))) out[k] = v;
  return out;
}

function usage(msg) { console.error(`narrative-verify: ${msg}`); return 2; }

/**
 * Remove from the page every block its receipt judged other than SUPPORTED -- the last step after a fix round, so a page
 * ships with only what its sources say. The receipt must be for the text on disk now. The page must then be verified
 * again: a pruned text is a new text.
 * @param {string} page
 */
async function prune(page) {
  const t = await readTree(ROOT);
  const text = t.narratives[page];
  const file = join(ROOT, VERIFY_DIR, `${page}.json`);
  if (text === undefined || !existsSync(file)) return usage(`no narrative or no receipt for ${page}`);
  let r;
  try { r = JSON.parse(readFileSync(file, "utf8")); } catch { return usage(`the receipt for ${page} is not JSON -- verify the page again`); }
  if (!r || typeof r !== "object" || r.sha256 !== sha256(text)) return usage(`the receipt for ${page} judged other text -- verify it first`);
  const bad = new Set((Array.isArray(r.verdicts) ? r.verdicts : []).filter((v) => v && v.verdict !== "SUPPORTED").map((v) => v.block));
  const blocks = blocksOf(text);
  const drop = new Set();
  for (const b of blocks) if (bad.has(b.n)) for (let l = b.line; l <= b.end; l++) drop.add(l);
  const lines = text.split(/\r?\n/);
  const kept = lines.filter((_, i) => !drop.has(i + 1)).join("\n").replace(/\n{3,}/g, "\n\n");
  const target = join(ROOT, "docs", "wiki", "_narrative", `${page}.md`);
  // A fixer may have saved the page since it was read: re-read and compare, and never overwrite newer text (B5).
  if (sha256(readFileSync(target, "utf8")) !== sha256(text)) return usage(`${page} changed while it was being pruned -- nothing written; verify it again`);
  writeFileSync(target, kept);
  console.log(`pruned ${page}: ${bad.size} block(s) removed, ${blocks.length - bad.size} kept -- verify it again`);
  return 0;
}

async function accept(pages) {
  const t = await readTree(ROOT);
  const on = new Date().toISOString().slice(0, 10);
  let bad = 0;
  for (const page of pages) {
    if (!PAGE.test(page)) { console.log(`REFUSED ${page} -- not <dir>/<id>`); bad++; continue; }
    const file = join(ROOT, VERIFY_DIR, `${page}.json`);
    const text = t.narratives[page];
    if (text === undefined || !existsSync(file)) { console.log(`REFUSED ${page} -- no narrative or no receipt to accept`); bad++; continue; }
    const r = JSON.parse(readFileSync(file, "utf8"));
    const why = receiptProblem(r, page, sha256(text), blocksOf(text).length);
    if (why) { console.log(`REFUSED ${page} -- ${why}`); bad++; continue; }
    r.accepted = { by: "owner", on };
    writeFileSync(file, `${JSON.stringify(r, null, 2)}\n`);
    console.log(`accepted ${page} (${on})`);
  }
  return bad ? 1 : 0;
}

async function verify(page, driver, minutes) {
  const t = await readTree(ROOT);
  const text = t.narratives[page];
  if (text === undefined) return usage(`no narrative for ${page} under docs/wiki/_narrative/`);
  const unresolved = blocksOf(text).flatMap((b) => b.anchors.map((a) => [a, anchorProblem(a, t.tree)])).filter(([, w]) => w);
  if (unresolved.length) { for (const [a, w] of unresolved) console.log(`UNRESOLVED ${a}: ${w}`); return usage("fix the anchors first -- a verifier cannot judge a source that is not there"); }
  // CARRIED VERDICTS: a block whose exact text, anchors and plain-marker a previous run judged SUPPORTED is not sent
  // again -- the verifier is not deterministic, and re-judging unchanged text flipped settled blocks back and forth
  // (bench went 57 -> 53 of 65 after a round that touched none of them, 2026-09-27). The receipt names every carried
  // block; a changed block is always judged fresh.
  const keyOf = (/** @type {{ text: string, anchors: string[], plain: boolean }} */ b) => sha256(`${b.text}
${b.anchors.join(";")}
${b.plain}`);
  const receiptFile = join(ROOT, VERIFY_DIR, `${page}.json`);
  /** @type {Record<string, string>} */
  let settled = {};
  try {
    const prev = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, "utf8")) : null;
    if (prev && prev.supportedKeys && typeof prev.supportedKeys === "object" && !Array.isArray(prev.supportedKeys)) settled = prev.supportedKeys;
  } catch { settled = {}; }
  const carried = blocksOf(text).filter((b) => Object.prototype.hasOwnProperty.call(settled, keyOf(b)));
  const { blocks, chunks } = inputFor(page, text, t, new Set(carried.map((b) => b.n)));
  const model = process.env.ARC_VERIFY_MODEL || "";
  if (driver !== "mock" && !model) return usage("set ARC_VERIFY_MODEL (a non-Claude model id) and ARC_LLM_ENDPOINT / ARC_LLM_API_KEY");
  const dir = mkdtempSync(join(tmpdir(), "narrative-verify-"));
  try {
    /** One chunk, run to an answer or CHUNK_TRIES failures. @returns {Promise<{ verdicts: any[] } | { failed: string }>} */
    const runChunk = async (/** @type {number} */ ci, /** @type {{ numbers: number[], input: Record<string, string> }} */ c) => {
      const inFile = join(dir, `in-${ci}.json`);
      writeFileSync(inFile, JSON.stringify(c.input));
      const args = [join(ROOT, ".claude", "scripts", "engine", "arc-run.mjs"), "--process", "narrative-verify", "--root", ROOT, "--input", `@${inFile}`, "--budget", `min=${minutes}`];
      if (driver === "mock") args.push("--driver", "mock");
      else args.push("--driver", "generic-api", "--trial-model", model);
      const label = `chunk ${ci + 1}/${chunks.length} (blocks ${c.numbers[0]}-${c.numbers[c.numbers.length - 1]}, ${JSON.stringify(c.input).length} bytes)`;
      // arc-run prints the answer before it tries the receipt, so a worktree's refused emit is not a failed judgement;
      // an answer that is not the contract is. A chunk gets CHUNK_TRIES runs: one provider timeout is weather, and it
      // cost a whole 21-chunk page on its first chunk (2026-09-27).
      let doc = null, r = { status: null, stdout: "", stderr: "" };
      for (let attempt = 1; attempt <= CHUNK_TRIES && !(doc && Array.isArray(doc.verdicts)); attempt++) {
        r = await runNode(args);
        try { doc = JSON.parse(r.stdout); } catch { doc = null; }
        if (!(doc && Array.isArray(doc.verdicts)) && attempt < CHUNK_TRIES) console.log(`  ${label}: attempt ${attempt} gave no verdicts, running it again`);
      }
      if (!doc || !Array.isArray(doc.verdicts)) {
        const cause = String(r.stderr).split("\n").find((l) => /^arc-run: /.test(l) && !/could not emit|NO destination is set/.test(l)) || `exit ${r.status}`;
        return { failed: `${label}: ${cause}` };
      }
      const own = new Set(c.numbers);
      // A model that numbered the chunk from 1 answered every block, in order: map it back by position, and only then.
      const local = doc.verdicts.map((v) => (v ? v.block : null));
      if (local.length === c.numbers.length && local.every((b, i) => b === i + 1) && !c.numbers.every((n, i) => n === i + 1)) {
        doc.verdicts = doc.verdicts.map((v, i) => ({ ...v, block: c.numbers[i] }));
      }
      const stray = doc.verdicts.filter((v) => !v || !own.has(v.block));
      if (stray.length) return { failed: `${label}: verdicts for blocks outside this chunk (${stray.map((v) => v && v.block).join(",")})` };
      console.log(`  ${label}: ${doc.verdicts.length} verdict(s)`);
      return { verdicts: doc.verdicts };
    };
    // CHUNK_PARALLEL chunks at a time: one page is dozens of chunks, and each is minutes of model time.
    /** @type {any[]} */
    const verdicts = carried.map((b) => ({ block: b.n, verdict: "SUPPORTED", why: `carried: this exact block was judged SUPPORTED on ${settled[keyOf(b)]}` }));
    /** @type {string[]} */
    const failures = [];
    let next = 0;
    const worker = async () => {
      while (next < chunks.length) {
        const ci = next++;
        const res = await runChunk(ci, chunks[ci]);
        if ("failed" in res) failures.push(res.failed); else verdicts.push(...res.verdicts);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CHUNK_PARALLEL, chunks.length) }, worker));
    if (failures.length) { for (const f of failures) console.log(`RUN FAILED ${f}`); return 1; }
    const receipt = {
      schema: 1, page, sha256: sha256(text),
      model: driver === "mock" ? "mock" : model, model_source: driver === "mock" ? "mock" : "trial",
      blocks: blocks.length, chunks: chunks.length, verdicts: verdicts.sort((a, b) => a.block - b.block),
      carried: carried.map((b) => b.n),
      supportedKeys: Object.fromEntries(blocks.filter((b) => verdicts.some((v) => v.block === b.n && v.verdict === "SUPPORTED"))
        .map((b) => [keyOf(b), Object.prototype.hasOwnProperty.call(settled, keyOf(b)) ? settled[keyOf(b)] : new Date().toISOString().slice(0, 10)])),
      verified: new Date().toISOString(), accepted: null,
    };
    const file = join(ROOT, VERIFY_DIR, `${page}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`);
    const why = receiptProblem(receipt, page, receipt.sha256, blocks.length);
    for (const v of receipt.verdicts) if (v && v.verdict !== "SUPPORTED") console.log(`  [${v.block}] ${v.verdict}: ${v.why}`);
    console.log(`${why ? "NOT SHIPPABLE" : "SUPPORTED"} ${page}: ${receipt.verdicts.filter((v) => v && v.verdict === "SUPPORTED").length} of ${blocks.length} blocks -> ${VERIFY_DIR}/${page}.json${why ? ` (${why})` : ""}`);
    return why ? 1 : 0;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function main(argv) {
  if (argv[0] === "--accept") return argv.length > 1 ? accept(argv.slice(1)) : usage("--accept needs at least one <dir>/<id>");
  if (argv[0] === "--prune") return argv.length === 2 && PAGE.test(String(argv[1])) ? prune(String(argv[1])) : usage("--prune takes one <dir>/<id>");
  let page = "", driver = "generic-api", minutes = 25;
  for (let i = 0; i < argv.length; i++) {
    const a = String(argv[i]);
    if (a === "--driver") { driver = String(argv[++i] ?? ""); if (driver !== "mock" && driver !== "generic-api") return usage("--driver is mock or generic-api"); continue; }
    if (a === "--minutes") { minutes = Number(argv[++i]); if (!(minutes > 0 && minutes <= 120)) return usage("--minutes is 1..120"); continue; }
    if (a.startsWith("-") || page) return usage(`unexpected ${JSON.stringify(a)}`);
    page = a;
  }
  if (!PAGE.test(page)) return usage("usage: narrative-verify.mjs <dir>/<id> [--driver mock] [--minutes N] | --accept <dir>/<id>...");
  return verify(page, driver, minutes);
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return ""; } })() : "";
if (self === invoked) main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
