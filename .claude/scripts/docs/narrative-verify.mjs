#!/usr/bin/env node
// narrative-verify.mjs -- ADR-1513 section 2 and 3: verify one drafted narrative, or record the owner's read.
//
//   node .claude/scripts/docs/narrative-verify.mjs <dir>/<id> [--driver mock] [--minutes N]
//   node .claude/scripts/docs/narrative-verify.mjs --accept <dir>/<id> [<dir>/<id> ...]
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
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VERIFY_DIR, anchorProblem, blocksOf, readTree, receiptProblem, sha256 } from "./narrative-anchors.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const PAGE = /^(products|lanes|processes|commands|agents|rules|gates|adr)\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** A source is inlined up to this, else the lines around its symbol: the verifier judges text, not a pointer. */
const SOURCE_CAP = 5000;
/** One run's input stays under this: a whole page's sources (160-835KB) timed out on every model tried. */
export const CHUNK_BYTES = 50000;

/**
 * The text an anchor stands for, labelled. A file with a symbol gives the 60 lines around its first mention.
 * @param {string} anchor @param {any} t readTree()'s result
 */
export function sourceOf(anchor, t) {
  const a = anchor.trim();
  const adr = /^ADR-(\d{4})$/.exec(a);
  if (adr) {
    const f = execFileSync("git", ["ls-files", `docs/adr/${adr[1]}-*.md`], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean)[0] || "";
    if (!f) return "";
    // An ADR's title and its Decision are what a claim cites; the context before them is where the cap would cut.
    const text = t.tree.read(f);
    const d = text.indexOf("## Decision");
    return d < 0 ? text.slice(0, SOURCE_CAP) : `${text.split("\n")[0]}\n...\n${text.slice(d, d + SOURCE_CAP)}`;
  }
  if (a.startsWith("fact:")) {
    const m = /^fact:([a-zA-Z]+)\/(.+)\.([A-Za-z][A-Za-z0-9-]*)$/.exec(a);
    const e = m ? (t.wiki.entities[String(m[1])] || []).find((x) => x && x.id === m[2]) : null;
    if (!m || !e) return "";
    return JSON.stringify(m[3] === "source" ? e.source : e.facts[String(m[3])], null, 1).slice(0, SOURCE_CAP);
  }
  const hash = a.indexOf("#");
  const path = hash < 0 ? a : a.slice(0, hash);
  const text = t.tree.read(path);
  if (hash < 0 || text.length <= SOURCE_CAP) return text.slice(0, SOURCE_CAP);
  const lines = text.split("\n");
  const at = Math.max(0, lines.findIndex((l) => l.includes(a.slice(hash + 1))));
  return lines.slice(Math.max(0, at - 15), at + 35).join("\n").slice(0, SOURCE_CAP);
}

/**
 * The process inputs for one page: its blocks, numbered for the whole page, cut into chunks that each carry only the
 * sources their own blocks cite and stay under CHUNK_BYTES. A block too big for a chunk of its own still gets one.
 * `input` is the first chunk's (a page that fits is one chunk).
 */
export function inputFor(page, text, t) {
  const blocks = blocksOf(text);
  /** @type {Map<string, string>} */
  const src = new Map();
  const sourceText = (/** @type {string} */ a) => { if (!src.has(a)) src.set(a, `===== ${a} =====\n${sourceOf(a, t)}`); return String(src.get(a)); };
  /** @type {{ numbers: number[], input: Record<string, string> }[]} */
  const chunks = [];
  /** @type {{ lines: string[], anchors: Set<string>, numbers: number[], bytes: number }} */
  let cur = { lines: [], anchors: new Set(), numbers: [], bytes: 0 };
  const flush = () => {
    if (!cur.numbers.length) return;
    chunks.push({ numbers: cur.numbers, input: { classification: "external-ok", page, blocks: cur.lines.join("\n"), sources: [...cur.anchors].map(sourceText).join("\n\n") } });
    cur = { lines: [], anchors: new Set(), numbers: [], bytes: 0 };
  };
  for (const b of blocks) {
    const line = `[${b.n}] ${b.kind}: ${b.text}\n    ${b.plain ? "plain (cites nothing)" : `anchors: ${b.anchors.join("; ")}`}`;
    const added = line.length + b.anchors.filter((a) => !cur.anchors.has(a)).reduce((n, a) => n + sourceText(a).length, 0);
    if (cur.numbers.length && cur.bytes + added > CHUNK_BYTES) flush();
    cur.lines.push(line);
    for (const a of b.anchors) cur.anchors.add(a);
    cur.numbers.push(b.n);
    cur.bytes += line.length + b.anchors.reduce((n, a) => n + sourceText(a).length, 0);
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
  const { blocks, chunks } = inputFor(page, text, t);
  const model = process.env.ARC_VERIFY_MODEL || "";
  if (driver !== "mock" && !model) return usage("set ARC_VERIFY_MODEL (a non-Claude model id) and ARC_LLM_ENDPOINT / ARC_LLM_API_KEY");
  const dir = mkdtempSync(join(tmpdir(), "narrative-verify-"));
  try {
    /** @type {any[]} */
    const verdicts = [];
    for (const [ci, c] of chunks.entries()) {
      const inFile = join(dir, `in-${ci}.json`);
      writeFileSync(inFile, JSON.stringify(c.input));
      const args = [join(ROOT, ".claude", "scripts", "engine", "arc-run.mjs"), "--process", "narrative-verify", "--root", ROOT, "--input", `@${inFile}`, "--budget", `min=${minutes}`];
      if (driver === "mock") args.push("--driver", "mock");
      else args.push("--driver", "generic-api", "--trial-model", model);
      const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, env: childEnv(process.env) });
      const label = `chunk ${ci + 1}/${chunks.length} (blocks ${c.numbers[0]}-${c.numbers[c.numbers.length - 1]}, ${JSON.stringify(c.input).length} bytes)`;
      // arc-run prints the answer before it tries the receipt, so a worktree's refused emit is not a failed judgement;
      // an answer that is not the contract is.
      let doc = null;
      try { doc = JSON.parse(r.stdout); } catch { doc = null; }
      if (!doc || !Array.isArray(doc.verdicts)) {
        const cause = String(r.stderr).split("\n").find((l) => /^arc-run: /.test(l) && !/could not emit|NO destination is set/.test(l)) || `exit ${r.status}`;
        console.log(`RUN FAILED ${label}: ${cause}`);
        return 1;
      }
      const own = new Set(c.numbers);
      const stray = doc.verdicts.filter((v) => !v || !own.has(v.block));
      if (stray.length) { console.log(`RUN FAILED ${label}: verdicts for blocks outside this chunk (${stray.map((v) => v && v.block).join(",")})`); return 1; }
      verdicts.push(...doc.verdicts);
      console.log(`  ${label}: ${doc.verdicts.length} verdict(s)`);
    }
    const receipt = {
      schema: 1, page, sha256: sha256(text),
      model: driver === "mock" ? "mock" : model, model_source: driver === "mock" ? "mock" : "trial",
      blocks: blocks.length, chunks: chunks.length, verdicts: verdicts.sort((a, b) => a.block - b.block),
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
