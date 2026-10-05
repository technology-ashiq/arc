#!/usr/bin/env node
// arc discover -- turn a niche into a scored, evidenced, deduped shortlist (ADR-1900..1916).
//
//   arc-discover hunt (--niche-file F | --niche TEXT) [--query Q]... [--hits N]
//                     [--offline-fixture FILE] [--out DIR] [--emit]
//
// Mines HN through growth's adapter (ADR-1915), normalizes, dedupes and clusters (ADR-1902), marks
// clusters the owner already rejected (ADR-1907/1916), and writes records.ndjson + clusters.json.
// `--emit` puts one idea.captured per NEW item and one run.completed on the spine (main clone only).
//
// Exit: 0 done · 1 the source or the spine failed (never an empty result) · 2 refused (usage).
import { mkdirSync, readFileSync, realpathSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureFetch, mine, pacer } from "./miners/hn.mjs";
import { cluster, clustersDocument, sha256 } from "./lib/cluster.mjs";
import { capturedIds, DiscoverError, emit, readRejects } from "./lib/spine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
export const NICHE_RE = /^[a-z0-9][a-z0-9 -]{1,58}[a-z0-9]$/;
const VALUE_FLAGS = new Set(["--niche-file", "--niche", "--query", "--hits", "--offline-fixture", "--out"]);
const BOOL_FLAGS = new Set(["--emit"]);

export function parseArgs(argv) {
  const o = { queries: [], emit: false };
  const [verb, ...rest] = argv;
  if (verb !== "hunt") return { error: verb ? `unknown verb ${JSON.stringify(verb)}` : "a verb is required: hunt" };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (BOOL_FLAGS.has(a)) { o.emit = true; continue; }
    if (!VALUE_FLAGS.has(a)) return { error: `unknown argument ${JSON.stringify(a)}` };
    const v = rest[i + 1];
    // A missing or empty value is refused; it never swallows the next flag (fixed-defects c).
    if (v === undefined || v === "" || v.startsWith("--")) return { error: `${a} needs a value` };
    i++;
    if (a === "--query") o.queries.push(v);
    else if (o[a] !== undefined) return { error: `${a} given twice` };
    else o[a] = v;
  }
  if ((o["--niche"] === undefined) === (o["--niche-file"] === undefined)) return { error: "exactly one of --niche or --niche-file is required" };
  if (o["--hits"] !== undefined && !/^[1-9][0-9]?$/.test(o["--hits"])) return { error: "--hits must be 1-99" };
  return { opts: o };
}

/** The niche grammar: lowercase words, digits, single spaces and hyphens -- nothing a shell or yaml reads. */
export function parseNiche(text) {
  const n = String(text).replace(/\r?\n$/, "").trim().toLowerCase().replace(/\s+/g, " ");
  return NICHE_RE.test(n) ? n : null;
}

function realBase(p) {
  // The nearest existing ancestor, resolved through links; the rest is appended unresolved.
  let cur = p;
  const tail = [];
  while (!existsSync(cur)) { tail.unshift(cur.slice(dirname(cur).length + 1)); const up = dirname(cur); if (up === cur) break; cur = up; }
  return join(realpathSync(cur), ...tail);
}

/** The ONE confinement function (fixed-defects d): a path must land inside the repo or the OS temp dir. */
export function confine(p, roots = [REPO, tmpdir()]) {
  const abs = realBase(resolve(p));
  for (const r of roots) {
    const rr = realpathSync(r);
    const rel = relative(rr, abs);
    if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel) && !rel.split(sep).includes(".."))) return abs;
  }
  return null;
}

function refuse(msg) { process.stderr.write(`arc-discover: ${msg}\n`); return 2; }

export async function main(argv, { fetchImpl = globalThis.fetch } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.error) return refuse(parsed.error);
  const o = parsed.opts;
  let raw = o["--niche"];
  if (o["--niche-file"] !== undefined) {
    const nf = confine(o["--niche-file"]);
    if (!nf || !existsSync(nf)) return refuse("--niche-file is outside the repo/temp roots or does not exist");
    raw = readFileSync(nf, "utf8");
  }
  const niche = parseNiche(raw);
  if (!niche) return refuse("the niche must be 3-60 chars of lowercase letters, digits, spaces and hyphens");
  const out = confine(o["--out"] ?? join(REPO, ".claude", "state", "discover", "last"));
  if (!out) return refuse("--out is outside the repo/temp roots");
  let fetchFn = fetchImpl, pace;
  if (o["--offline-fixture"] !== undefined) {
    const fx = confine(o["--offline-fixture"]);
    if (!fx || !existsSync(fx)) return refuse("--offline-fixture is outside the repo/temp roots or does not exist");
    fetchFn = fixtureFetch(JSON.parse(readFileSync(fx, "utf8")));
    pace = async () => {}; // a fixture is not a server; pacing protects real ones only
  }
  const queries = o.queries.length ? o.queries : [niche];
  try {
    const { records, skipped } = await mine(queries, { fetchImpl: fetchFn, hitsPerQuery: Number(o["--hits"] || 20), pace: pace || pacer() });
    const rejects = await readRejects();
    const result = cluster(records, { rejects });
    const doc = clustersDocument(niche, records, skipped, result);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "records.ndjson"), records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : ""));
    writeFileSync(join(out, "clusters.json"), doc);
    const hash = sha256(doc);
    const rejected = result.clusters.filter((c) => c.previously_rejected).length;
    process.stdout.write(`hunt "${niche}": ${records.length} records, ${result.clusters.length} clusters (${rejected} previously rejected) -- clusters.json sha256 ${hash}\n`);
    for (const c of result.clusters.slice(0, 5))
      process.stdout.write(`  [${c.size}] ${c.top_tokens.join(" ")}${c.previously_rejected ? ` -- previously rejected ${c.previously_rejected}` : ""} -- ${c.members[0].source_url}\n`);
    if (o.emit) {
      const seen = await capturedIds();
      let fresh = 0;
      for (const r of records) {
        if (seen.has(r.source_id)) continue;
        emit("idea.captured", { source_id: r.source_id, source_url: r.source_url, title: r.title, niche }, { idem: sha256(`discover|${r.source_id}`) });
        seen.add(r.source_id);
        fresh++;
      }
      const runId = emit("run.completed", { niche, records: records.length, clusters: result.clusters.length, captured: fresh, clusters_sha256: hash, outcome: "ok" });
      process.stdout.write(`emitted ${fresh} idea.captured, run.completed ${runId}\n`);
    }
    return 0;
  } catch (e) {
    process.stderr.write(`arc-discover: ${e.code || "ERROR"}: ${e.message}\n`);
    return e instanceof DiscoverError || e.name === "MineError" ? 1 : 1;
  }
}

// realpath can throw (a deleted cwd, a dangling link); that is "not invoked as this file", never a stack trace.
function isMain() {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (isMain()) process.exitCode = await main(process.argv.slice(2));
