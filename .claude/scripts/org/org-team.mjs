#!/usr/bin/env node
/**
 * org-team.mjs -- staff a venture from the catalog, and refuse a team that changed silently (org Phase 02).
 *
 *   --init V            propose org/teams/V.team.yaml for stage `discover`: the roles on shift there,
 *                       E2 roles seated by the owner, heads left out (none has two staffed workers
 *                       on a fresh team), a default budget line per staffed seat. Never overwrites.
 *   --validate V        the grammar and the cross-checks against the cards (no spine needed).
 *   --digest V          sha256 over the PARSED manifest -- what an org.team approval must carry.
 *   --check V           REQ-06: exit 0 only when the current digest is approved on the spine;
 *                       otherwise print UNRECEIPTED TEAM CHANGE and exit 1.
 *   --products-for V    the products the team's staffed seats need, comma-separated (for
 *                       sync-to-project --team). Exit 1 if a bound file belongs to no product.
 *   --root DIR · --spine-dir DIR
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";
import { collect } from "./org-coverage.mjs";
import { isId, isStaffed, OWNER } from "./lib/card.mjs";
import { emitYaml } from "./lib/emit.mjs";
import { validateTeam, teamDigest, teamApproval, productsFor, TEAM_SUBJECT } from "./lib/team.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const DEFAULT_BUDGET = { tokens_month: 400000, inr_month: 0, cap_action: "stop-and-propose" };
const INIT_STAGE = "discover";

function isDir(p) { try { return statSync(p).isDirectory(); } catch { return false; } }
const teamPath = (root, v) => join(root, "org", "teams", `${v}.team.yaml`);

async function context(root) {
  const w = await collect(root);
  return { w, cards: new Map(w.cards.map((c) => [c.card?.id, c.card]).filter(([id]) => typeof id === "string")), ventures: new Set(w.ventures) };
}

function readTeam(root, v) {
  let text;
  try { text = readFileSync(teamPath(root, v), "utf8").replace(/^﻿/, ""); }
  catch { return { error: `org/teams/${v}.team.yaml does not exist` }; }
  const r = parseYamlSubset(text);
  return r.ok ? { doc: r.value } : { error: `org/teams/${v}.team.yaml: ${r.error.message}` };
}

function initDoc(v, cards) {
  // VACANT roles are on shift too: the stage needs them whether or not anyone holds them, and a
  // vacancy the dispatcher never sees is a demand the counter never counts (ADR-1602).
  const onShift = [...cards.values()].filter((c) => Array.isArray(c.stages) && c.stages.includes(INIT_STAGE))
    .map((c) => c.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const seats = {};
  for (const id of onShift) {
    const c = cards.get(id);
    if (Array.isArray(c.e2) && c.e2.length) seats[id] = { holder: OWNER };
    else if (isStaffed(c)) seats[id] = { holder: "card", budget: { ...DEFAULT_BUDGET } };
  }
  return { venture: v, stage: INIT_STAGE, mission: "private", on_shift: { [INIT_STAGE]: onShift }, seats, dispatch: { heartbeat: "daily", queue_cap: 7 } };
}

function readManifests(root) {
  const out = new Map();
  let names = [];
  try { names = readdirSync(join(root, "products")); } catch { return out; }
  for (const n of names) {
    try { out.set(n, JSON.parse(readFileSync(join(root, "products", n, "manifest.json"), "utf8"))); } catch { /* not a product */ }
  }
  return out;
}

function parseArgs(argv) {
  const o = { root: REPO, spineDir: null, mode: null, venture: null };
  const given = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { if (given.has(a)) throw new Error(`${a} given twice`); given.add(a); }
    const val = () => { const v = argv[++i]; if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`); return v; };
    if (["--init", "--validate", "--digest", "--check", "--products-for"].includes(a)) {
      if (o.mode) throw new Error(`${a} and --${o.mode} are separate modes`);
      o.mode = a.slice(2); o.venture = val();
    } else if (a === "--root") o.root = val();
    else if (a === "--spine-dir") o.spineDir = val();
    else throw new Error(`unknown flag ${JSON.stringify(a)} -- known flags are --init --validate --digest --check --products-for --root --spine-dir`);
  }
  if (!o.mode) throw new Error("one of --init, --validate, --digest, --check, --products-for is required");
  if (!isId(o.venture)) throw new Error(`venture "${o.venture}" is not a valid slug`);
  return o;
}

async function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`org-team: ${e.message}`); return 2; }
  if (!isDir(join(o.root, ".claude", "agents"))) { console.error(`org-team: ${o.root} is not an arc tree`); return 2; }
  const { cards, ventures } = await context(o.root);
  const v = o.venture;

  if (o.mode === "init") {
    if (!ventures.has(v)) { console.error(`org-team: "${v}" is not in ventures.yaml -- register it with venture-register first (ADR-1612)`); return 1; }
    const doc = initDoc(v, cards);
    const p = teamPath(o.root, v);
    mkdirSync(dirname(p), { recursive: true });
    try {
      writeFileSync(p, emitYaml(doc, [`${v} -- team manifest (org, ADR-1606 / ADR-1619). Governed: every change needs an org.team`,
        "approval over its digest (org-team --digest), decided by the owner. Mission stays `private` unless approved."]), { flag: "wx" });
    } catch (e) { if (e.code === "EEXIST") { console.error(`org-team: org/teams/${v}.team.yaml exists -- never overwritten`); return 1; } throw e; }
    console.log(`org-team: proposed org/teams/${v}.team.yaml -- ${doc.on_shift[INIT_STAGE].length} role(s) on shift at ${INIT_STAGE}, ${Object.keys(doc.seats).length} seat line(s)`);
    console.log(`digest: ${teamDigest(doc)}`);
    return 0;
  }

  const t = readTeam(o.root, v);
  if (t.error) { console.log(`FAIL ${t.error}`); return 1; }
  const findings = validateTeam(t.doc, { stem: v, ventures, cards });
  if (findings.length) { for (const f of findings) console.log(`FAIL ${f}`); console.log(`org-team: ${findings.length} finding(s)`); return 1; }
  const digest = teamDigest(t.doc);

  if (o.mode === "validate") { console.log(`org-team: ${v} valid -- digest ${digest}`); return 0; }
  if (o.mode === "digest") { console.log(`digest: ${digest}`); console.log(`subject: ${TEAM_SUBJECT} · venture: ${v}`); return 0; }

  if (o.mode === "products-for") {
    const r = productsFor(t.doc, cards, readManifests(o.root));
    for (const u of r.unowned) console.error(`org-team: UNOWNED ${u} -- a bound file no product ships`);
    if (r.unowned.length) return 1;
    console.log(r.products.join(","));
    return 0;
  }

  // --check: REQ-06
  let spineDir = o.spineDir;
  if (!spineDir) {
    try { spineDir = (await import(pathToFileURL(join(o.root, ".claude", "scripts", "hq", "lib", "spine-io.mjs")).href)).spineRoot(); }
    catch (e) { console.error(`org-team: ${e.message || e}`); return 2; }
  }
  if (!isDir(spineDir)) { console.error(`org-team: no spine at ${spineDir}`); return 2; }
  const { scanAll } = await import(pathToFileURL(join(o.root, ".claude", "scripts", "hq", "spine.mjs")).href);
  const events = scanAll(spineDir).events.map((x) => x.event);
  const a = teamApproval(events, v, digest);
  if (!a.approved) {
    console.log(`UNRECEIPTED TEAM CHANGE: org/teams/${v}.team.yaml digest ${digest} -- ${a.why}${a.request ? ` (request ${a.request})` : ""}`);
    console.log(`  emit: approval.requested {"subject":"${TEAM_SUBJECT}","venture":"${v}","digest":"${digest}","what":"..."} and have the owner decide it`);
    return 1;
  }
  console.log(`org-team: ${v} governed -- digest ${digest} approved by ${a.decision} (request ${a.request})`);
  return 0;
}

function isMainModule() {
  try {
    const invoked = process.argv[1];
    return !!invoked && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}
if (isMainModule()) process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });
if (isMainModule()) main().then((c) => { process.exitCode = c; }, (e) => { console.error(`org-team: ${e.stack || e}`); process.exitCode = 2; });
