#!/usr/bin/env node
// arc discover -- turn a niche into a scored, evidenced, deduped shortlist (ADR-1900..1916).
//
//   arc-discover hunt (--niche-file F | --niche TEXT) [--query Q]... [--hits N]
//                     [--offline-fixture FILE] [--out DIR] [--emit]
//   arc-discover score    --in DIR [--weights FILE]
//   arc-discover judge    --in DIR [--emit] [--run --driver NAME]
//   arc-discover verdicts --in DIR
//   arc-discover propose  --in DIR --emit
//   arc-discover export   --in DIR [--ventures-dir DIR]
//
// hunt mines HN through growth's adapter (ADR-1915), normalizes, dedupes and clusters (ADR-1902)
// and marks clusters the owner already rejected (ADR-1907/1916). score applies the owner's weights
// (ADR-1903); judge fixes the council question per finalist (ADR-1910) and, only with --run, spends
// on a council session; propose asks the owner; export turns an APPROVED winner into a venture.yaml
// launch's own loadProfile accepts (ADR-1905/1912). Nothing here invokes launch.
//
// Exit: 0 done · 1 the source or the spine failed (never an empty result) · 2 refused.
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureFetch, mine, pacer } from "./miners/hn.mjs";
import { cluster, clustersDocument, sha256 } from "./lib/cluster.mjs";
import { capturedIds, decisionFor, DiscoverError, emit, readRejects, verdictsByHash, weightsApproved, WINNER_GATE } from "./lib/spine.mjs";
import { KICKOFF_DECISION, loadWeights, scoreDocument } from "./lib/score.mjs";
import { finalists } from "./lib/judge.mjs";
import { buildProfile, huntMarkdown, overridesFrom, ventureYaml } from "./lib/export.mjs";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const SCORE_YAML = join(REPO, "products", "discover", "score.yaml");
const VENTURES = join(REPO, "products", "launch", "ventures");
const ARC_RUN = join(REPO, ".claude", "scripts", "engine", "arc-run.mjs");
export const NICHE_RE = /^[a-z0-9][a-z0-9 -]{1,58}[a-z0-9]$/;
const VERBS = {
  hunt: { values: ["--niche-file", "--niche", "--query", "--hits", "--offline-fixture", "--out"], bools: ["--emit"] },
  score: { values: ["--in", "--weights"], bools: [] },
  judge: { values: ["--in", "--driver"], bools: ["--emit", "--run"] },
  verdicts: { values: ["--in"], bools: [] },
  propose: { values: ["--in"], bools: ["--emit"] },
  export: { values: ["--in", "--ventures-dir"], bools: [] },
};

export function parseArgs(argv) {
  const [verb, ...rest] = argv;
  if (!verb) return { error: `a verb is required: ${Object.keys(VERBS).join(" | ")}` };
  const spec = VERBS[verb];
  if (!spec) return { error: `unknown verb ${JSON.stringify(verb)}` };
  const o = { verb, queries: [], flags: new Set() };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (spec.bools.includes(a)) { o.flags.add(a); continue; }
    if (!spec.values.includes(a)) return { error: `unknown argument ${JSON.stringify(a)} for ${verb}` };
    const v = rest[i + 1];
    // A missing or empty value is refused; it never swallows the next flag (fixed-defects c).
    if (v === undefined || v === "" || v.startsWith("--")) return { error: `${a} needs a value` };
    i++;
    if (a === "--query") o.queries.push(v);
    else if (o[a] !== undefined) return { error: `${a} given twice` };
    else o[a] = v;
  }
  if (verb === "hunt") {
    if ((o["--niche"] === undefined) === (o["--niche-file"] === undefined)) return { error: "exactly one of --niche or --niche-file is required" };
    if (o["--hits"] !== undefined && !/^[1-9][0-9]?$/.test(o["--hits"])) return { error: "--hits must be 1-99" };
  } else if (o["--in"] === undefined) return { error: `${verb} needs --in DIR` };
  if (verb === "judge" && o.flags.has("--run") !== (o["--driver"] !== undefined)) return { error: "--run and --driver go together" };
  if (verb === "propose" && !o.flags.has("--emit")) return { error: "propose needs --emit: asking the owner IS the receipt" };
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

class Refusal extends Error {}
const refuse = (msg) => { throw new Refusal(msg); };
const say = (s) => process.stdout.write(s + "\n");
const readJson = (p, what) => { if (!existsSync(p)) refuse(`${what} not found in --in (${p})`); return JSON.parse(readFileSync(p, "utf8")); };
const inDir = (o) => confine(o["--in"]) ?? refuse("--in is outside the repo/temp roots");

function scoreConfig(path = SCORE_YAML) {
  const r = parseYamlSubset(readFileSync(path, "utf8"));
  if (!r.ok) throw new DiscoverError("WEIGHTS_YAML", `${path}:${r.error.line} ${r.error.what}`);
  return r.value || {};
}

async function cmdHunt(o) {
  let raw = o["--niche"];
  if (o["--niche-file"] !== undefined) {
    const nf = confine(o["--niche-file"]);
    if (!nf || !existsSync(nf)) refuse("--niche-file is outside the repo/temp roots or does not exist");
    raw = readFileSync(nf, "utf8");
  }
  const niche = parseNiche(raw) ?? refuse("the niche must be 3-60 chars of lowercase letters, digits, spaces and hyphens");
  const out = confine(o["--out"] ?? join(REPO, ".claude", "state", "discover", "last")) ?? refuse("--out is outside the repo/temp roots");
  let fetchFn = globalThis.fetch, pace = pacer();
  if (o["--offline-fixture"] !== undefined) {
    const fx = confine(o["--offline-fixture"]);
    if (!fx || !existsSync(fx)) refuse("--offline-fixture is outside the repo/temp roots or does not exist");
    fetchFn = fixtureFetch(JSON.parse(readFileSync(fx, "utf8")));
    pace = async () => {}; // a fixture is not a server; pacing protects real ones only
  }
  const queries = o.queries.length ? o.queries : [niche];
  const { records, skipped } = await mine(queries, { fetchImpl: fetchFn, hitsPerQuery: Number(o["--hits"] || 20), pace });
  const rejects = await readRejects();
  const result = cluster(records, { rejects });
  const doc = clustersDocument(niche, records, skipped, result);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "records.ndjson"), records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : ""));
  writeFileSync(join(out, "clusters.json"), doc);
  const hash = sha256(doc);
  const rejected = result.clusters.filter((c) => c.previously_rejected).length;
  say(`hunt "${niche}": ${records.length} records, ${result.clusters.length} clusters (${rejected} previously rejected) -- clusters.json sha256 ${hash}`);
  // The top five, plus every cluster the owner already rejected: a reject is never hidden below the fold.
  for (const c of result.clusters.filter((x, i) => i < 5 || x.previously_rejected))
    say(`  [${c.size}] ${c.top_tokens.join(" ")}${c.previously_rejected ? ` -- previously rejected ${c.previously_rejected}` : ""} -- ${c.members[0].source_url}`);
  if (o.flags.has("--emit")) {
    const seen = await capturedIds();
    let fresh = 0;
    for (const r of records) {
      if (seen.has(r.source_id)) continue;
      emit("idea.captured", { source_id: r.source_id, source_url: r.source_url, title: r.title, niche }, { idem: sha256(`discover|${r.source_id}`) });
      seen.add(r.source_id);
      fresh++;
    }
    const runId = emit("run.completed", { step: "hunt", niche, records: records.length, clusters: result.clusters.length, captured: fresh, clusters_sha256: hash, outcome: "ok" });
    say(`emitted ${fresh} idea.captured, run.completed ${runId}`);
  }
}

async function cmdScore(o) {
  const dir = inDir(o);
  const weightsPath = o["--weights"] !== undefined ? (confine(o["--weights"]) ?? refuse("--weights is outside the repo/temp roots")) : SCORE_YAML;
  const w = loadWeights(weightsPath);
  if (w.decision !== KICKOFF_DECISION && !(await weightsApproved(w.decision, w.weights_sha256)))
    throw new DiscoverError("WEIGHTS_UNRECEIPTED", `decision ${w.decision} is not an approved discover-weights request for sha ${w.weights_sha256}`);
  const doc = scoreDocument(readJson(join(dir, "clusters.json"), "clusters.json"), w);
  writeFileSync(join(dir, "scores.json"), doc);
  const parsed = JSON.parse(doc);
  say(`score: ${parsed.scores.length} scored, ${parsed.not_scored.length} previously rejected -- scores.json sha256 ${sha256(doc)}`);
  for (const s of parsed.scores.slice(0, 5)) say(`  ${String(s.score).padStart(3)} ${s.cluster_fp.slice(0, 12)} evidence ${s.evidence.length}${s.dropped.length ? ` dropped ${s.dropped.join(",")}` : ""}`);
}

async function cmdJudge(o) {
  const dir = inDir(o);
  const signal = String(scoreConfig().council_signal || "");
  if (!/^[a-z0-9][a-z0-9 -]{2,80}$/.test(signal)) throw new DiscoverError("WEIGHTS_YAML", "score.yaml council_signal must be plain lowercase words");
  const fin = finalists(readJson(join(dir, "scores.json"), "scores.json"), readJson(join(dir, "clusters.json"), "clusters.json"), signal);
  if (fin.length === 0) {
    writeFileSync(join(dir, "judge.json"), JSON.stringify({ version: 1, finalists: [] }, null, 1) + "\n");
    say("judge: no-finalists -- nothing scorable, no council session and no approval request");
    if (o.flags.has("--emit")) say(`run.completed ${emit("run.completed", { step: "judge", outcome: "no-finalists", finalists: 0 })}`);
    return;
  }
  if (o.flags.has("--run")) {
    for (const [i, f] of fin.entries()) {
      const input = join(dir, `council-input-${i + 1}.json`);
      writeFileSync(input, JSON.stringify({ question: f.question }) + "\n");
      const r = spawnSync(process.execPath, [ARC_RUN, "--process", "council-convene", "--driver", o["--driver"], "--input", `@${input}`, "--root", REPO], { encoding: "utf8", timeout: 3_600_000 });
      const m = (r.stdout || "").match(/"receipt_id"\s*:\s*"([0-9A-HJKMNP-TV-Z]{26})"/);
      f.council = r.status === 0 && m ? { receipt: m[1] } : { failed: `exit ${r.status}: ${(r.stderr || "").trim().split("\n").pop() || "no receipt_id"}` };
    }
  }
  writeFileSync(join(dir, "judge.json"), JSON.stringify({ version: 1, finalists: fin }, null, 1) + "\n");
  say(`judge: ${fin.length} finalist(s)`);
  for (const f of fin) say(`  ${f.slug} (score ${f.score}) -- ${f.question} -- question_hash ${f.question_hash}${f.council ? ` -- ${f.council.receipt || f.council.failed}` : ""}`);
  if (o.flags.has("--emit")) say(`run.completed ${emit("run.completed", { step: "judge", outcome: "ok", finalists: fin.length, question_hashes: fin.map((f) => f.question_hash) })}`);
}

async function cmdVerdicts(o) {
  const dir = inDir(o);
  const j = readJson(join(dir, "judge.json"), "judge.json");
  const got = await verdictsByHash(j.finalists.map((f) => f.question_hash));
  for (const f of j.finalists) {
    const v = got.get(f.question_hash);
    f.verdict = v || null;
    say(`  ${f.slug}: ${v ? `${v.call} (${v.confidence}) ${v.session_id} ${v.receipt}` : "no council.verdict yet"}`);
  }
  writeFileSync(join(dir, "judge.json"), JSON.stringify(j, null, 1) + "\n");
}

async function cmdPropose(o) {
  const dir = inDir(o);
  const j = readJson(join(dir, "judge.json"), "judge.json");
  if (j.finalists.length === 0) refuse("no finalists: nothing to propose");
  const win = j.finalists[0]; // finalists are already score-desc, tie by cluster_fp (REQ-05)
  const niche = readJson(join(dir, "clusters.json"), "clusters.json").niche;
  const call = win.verdict ? `${win.verdict.call}/${win.verdict.confidence}` : "no verdict";
  const id = emit("approval.requested", { what: `discover winner ${win.slug} (council ${call}) -- approve to export a venture.yaml`, gate: WINNER_GATE, slug: win.slug, niche, cluster_fp: win.cluster_fp, cluster_tokens: win.top_tokens, score: win.score });
  writeFileSync(join(dir, "proposal.json"), JSON.stringify({ request: id, slug: win.slug, cluster_fp: win.cluster_fp }, null, 1) + "\n");
  say(`propose: approval.requested ${id} for ${win.slug}`);
  say(`  owner: node .claude/scripts/hq/arc-inbox.mjs approve ${id} --reason "..."   (reject records why; the next hunt reads it)`);
}

async function cmdExport(o) {
  const dir = inDir(o);
  const prop = readJson(join(dir, "proposal.json"), "proposal.json");
  const dec = await decisionFor(prop.request);
  if (!dec) refuse(`approval ${prop.request} is still open -- nothing is exported before the owner decides`);
  if (dec.verdict !== "approve") refuse(`approval ${prop.request} was ${dec.verdict}ed (${dec.id}) -- nothing to export`);
  const clusters = readJson(join(dir, "clusters.json"), "clusters.json");
  const scores = readJson(join(dir, "scores.json"), "scores.json");
  const judge = readJson(join(dir, "judge.json"), "judge.json");
  const c = clusters.clusters.find((x) => x.cluster_fp === prop.cluster_fp) ?? refuse("the approved cluster is not in clusters.json");
  const s = scores.scores.find((x) => x.cluster_fp === prop.cluster_fp) ?? refuse("the approved cluster has no score");
  const f = judge.finalists.find((x) => x.cluster_fp === prop.cluster_fp) ?? refuse("the approved cluster was not a finalist");
  if (f.slug !== prop.slug) refuse("the proposal slug and the judged slug differ");
  const cfg = scoreConfig();
  const profile = buildProfile({ slug: prop.slug, niche: clusters.niche, defaults: cfg.venture_defaults || {}, overrides: overridesFrom(dec.reason) });
  const ventures = o["--ventures-dir"] !== undefined ? (confine(o["--ventures-dir"]) ?? refuse("--ventures-dir is outside the repo/temp roots")) : VENTURES;
  const yamlPath = join(ventures, `${profile.slug}.venture.yaml`);
  const huntPath = join(ventures, `${profile.slug}.hunt.md`);
  if (existsSync(yamlPath) || existsSync(huntPath)) refuse(`${profile.slug} already exists in ${ventures} -- an approved venture is never overwritten`);
  const yaml = ventureYaml(profile, { seed: s.money_signal, huntFile: `${profile.slug}.hunt.md` });
  // Launch's own acceptor decides, before the file lands where launch looks (ADR-1912).
  const stage = join(tmpdir(), `discover-export-${process.pid}-${Date.now()}`);
  mkdirSync(stage, { recursive: true });
  try {
    writeFileSync(join(stage, `${profile.slug}.venture.yaml`), yaml);
    const { loadProfile, loadCatalog, resolveBoard } = await import("../launch/lib/catalog.mjs");
    const accepted = loadProfile(profile.slug, stage);
    const board = resolveBoard(loadCatalog(), accepted);
    mkdirSync(ventures, { recursive: true });
    writeFileSync(huntPath, huntMarkdown({ slug: profile.slug, niche: clusters.niche, question: f.question, cluster: c, score: s, decision: dec.id, request: prop.request }));
    renameSync(join(stage, `${profile.slug}.venture.yaml`), yamlPath);
    say(`export: ${relative(REPO, yamlPath).split(sep).join("/")} accepted by launch loadProfile (${[...board.values()].filter((r) => r.applies).length} of ${board.size} slots apply) -- honesty_class ${profile.honesty_class}`);
    say(`  next (owner): arc launch new ${profile.slug}`);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

export async function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.error) { process.stderr.write(`arc-discover: ${parsed.error}\n`); return 2; }
  const o = parsed.opts;
  try {
    await { hunt: cmdHunt, score: cmdScore, judge: cmdJudge, verdicts: cmdVerdicts, propose: cmdPropose, export: cmdExport }[o.verb](o);
    return 0;
  } catch (e) {
    if (e instanceof Refusal) { process.stderr.write(`arc-discover: ${e.message}\n`); return 2; }
    process.stderr.write(`arc-discover: ${e.code || "ERROR"}: ${e.message}\n`);
    return e.code && /^(BAD_|SHAPE|WEIGHTS_)/.test(e.code) ? 2 : 1;
  }
}

// realpath can throw (a deleted cwd, a dangling link); that is "not invoked as this file", never a stack trace.
function isMain() {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (isMain()) process.exitCode = await main(process.argv.slice(2));
