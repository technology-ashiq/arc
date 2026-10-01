#!/usr/bin/env node
/**
 * org-dispatch.mjs -- the dispatcher script-job: propose a venture's next jobs, never do them (org Phase 03).
 *
 * ADR-1605 / ADR-1623: a deterministic `type: script` job at ₹0 on the scheduler heartbeat, actor
 * `scheduler:org-dispatch`, subject `process:org-dispatch`. Proposals only -- `approval.requested`
 * with subject org.dispatch and full goal ancestry -- plus `note.logged` vacancy-demand signals. It
 * never executes, never calls an agent, never talks to one. A team that is not governed (its digest
 * has no owner approval) gets no proposals at all.
 *
 *   --venture V | --all      which team(s); --all walks org/teams/*.team.yaml
 *   --emit                   write the proposals to the spine (from the MAIN clone; the scheduler does this)
 *   --today YYYY-MM-DD       the dispatch day (default: today in Asia/Kolkata)
 *   --spine-dir DIR · --root DIR · --json
 * Exit: 0 dispatched (or nothing to do) · 1 a team is ungoverned or invalid · 2 usage
 */
import { readFileSync, writeFileSync, readdirSync, statSync, realpathSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";
import { collect } from "./org-coverage.mjs";
import { loadOrg, readSpine } from "./org-review.mjs";
import { placeAll } from "./lib/attribution.mjs";
import { validateTeam, teamDigest, teamApproval } from "./lib/team.mjs";
import { validateStages, dispatch } from "./lib/dispatch.mjs";
import { isId } from "./lib/card.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
export const ACTOR = "scheduler:org-dispatch";

function isDir(p) { try { return statSync(p).isDirectory(); } catch { return false; } }
const readYaml = (p) => { try { return parseYamlSubset(readFileSync(p, "utf8").replace(/^﻿/, "")); } catch (e) { return { ok: false, error: { message: `${p}: ${e.code || e.message}` } }; } };
function istToday() { return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); }

function parseArgs(argv) {
  const o = { root: REPO, spineDir: null, venture: null, all: false, emit: false, today: null, json: false };
  const given = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { if (given.has(a)) throw new Error(`${a} given twice`); given.add(a); }
    const val = () => { const v = argv[++i]; if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`); return v; };
    if (a === "--venture") o.venture = val();
    else if (a === "--all") o.all = true;
    else if (a === "--emit") o.emit = true;
    else if (a === "--json") o.json = true;
    else if (a === "--today") { o.today = val(); if (!/^\d{4}-\d{2}-\d{2}$/.test(o.today)) throw new Error("--today must be YYYY-MM-DD"); }
    else if (a === "--spine-dir") o.spineDir = val();
    else if (a === "--root") o.root = val();
    else throw new Error(`unknown flag ${JSON.stringify(a)} -- known flags are --venture --all --emit --today --spine-dir --root --json`);
  }
  if (!!o.venture === o.all) throw new Error("exactly one of --venture V or --all is required");
  if (o.venture && !isId(o.venture)) throw new Error(`venture "${o.venture}" is not a valid slug`);
  // --emit writes to the canonical spine arc-event resolves; reading governance and open proposals
  // from a DIFFERENT spine would dedupe and cap against state that is not where the writes land.
  if (o.emit && o.spineDir) throw new Error("--emit writes the canonical spine and cannot be combined with --spine-dir");
  return o;
}

function emit(root, kind, payload) {
  const dir = mkdtempSync(join(tmpdir(), "org-dispatch-"));
  try {
    const f = join(dir, "payload.json");
    writeFileSync(f, JSON.stringify(payload));
    return execFileSync(process.execPath, [join(root, ".claude", "scripts", "hq", "arc-event.mjs"), "emit", kind, "--payload-file", f, "--actor", ACTOR],
      { cwd: root, encoding: "utf8", timeout: 8_000 }).trim().split("\n").pop();
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`org-dispatch: ${e.message}`); return 2; }
  if (!isDir(join(o.root, ".claude", "agents"))) { console.error(`org-dispatch: ${o.root} is not an arc tree`); return 2; }
  const today = o.today ?? istToday();
  const w = await collect(o.root);
  const cards = new Map(w.cards.map((c) => [c.card?.id, c.card]).filter(([id]) => typeof id === "string"));
  const st = readYaml(join(o.root, "org", "stages.yaml"));
  if (!st.ok) { console.log(`FAIL org/stages.yaml: ${st.error.message}`); return 1; }
  const sf = validateStages(st.value, new Set(cards.keys()), w.kinds);
  if (sf.length) { for (const f of sf) console.log(`FAIL ${f}`); return 1; }
  const org = await loadOrg(o.root);
  if (org.findings.length) { for (const f of org.findings) console.log(`FAIL ${f}`); return 1; }

  let spineDir = o.spineDir;
  if (!spineDir) {
    try { spineDir = (await import(pathToFileURL(join(o.root, ".claude", "scripts", "hq", "lib", "spine-io.mjs")).href)).spineRoot(); }
    catch (e) { console.error(`org-dispatch: ${e.message || e}`); return 2; }
  }
  if (!isDir(spineDir)) { console.error(`org-dispatch: no spine at ${spineDir}`); return 2; }
  const { events } = await readSpine(o.root, spineDir);
  const { placements } = placeAll(events, org.rules, org.roleIds);

  const teamsDir = join(o.root, "org", "teams");
  const ventures = o.all ? (() => { try { return readdirSync(teamsDir).filter((n) => n.endsWith(".team.yaml")).map((n) => n.slice(0, -10)).sort(); } catch { return []; } })() : [o.venture];
  if (!ventures.length) { console.log("org-dispatch: no team manifests -- nothing to dispatch"); return 0; }

  let bad = 0;
  const report = [];
  for (const v of ventures) {
    const t = readYaml(join(teamsDir, `${v}.team.yaml`));
    if (!t.ok) { console.log(`FAIL ${v}: ${t.error.message}`); bad++; continue; }
    const tf = validateTeam(t.value, { stem: v, ventures: new Set(w.ventures), cards });
    if (tf.length) { for (const f of tf) console.log(`FAIL ${f}`); bad++; continue; }
    const digest = teamDigest(t.value);
    const gov = teamApproval(events, v, digest);
    if (!gov.approved) { console.log(`UNRECEIPTED TEAM CHANGE: ${v} digest ${digest} -- ${gov.why}; no proposals for an ungoverned team`); bad++; continue; }
    const r = dispatch({ venture: v, team: t.value, cards, stagesDoc: st.value, events, today, placements });
    report.push({ venture: v, stage: t.value.stage, ...r });
    if (!o.json) {
      console.log(`${v} @ ${t.value.stage}: ${r.proposals.length} proposal(s), ${r.notes.length} vacancy demand(s); ${r.todays} already today of cap ${r.cap}${r.overCap ? " -- OVER CAP (printed, REQ-10)" : ""}`);
      for (const p of r.proposals) console.log(`  PROPOSE ${p.role}: ${p.task}  [${p.why_now}] ancestry: ${p.goal_ancestry.join(" > ")}`);
      for (const n of r.notes) console.log(`  DEMAND ${n.role} (${n.demand} of 3) for ${n.criterion}`);
      for (const s of r.skipped) console.log(`  skip ${s}`);
    }
    if (o.emit) {
      for (const p of r.proposals) console.log(`  emitted approval.requested ${emit(o.root, "approval.requested", p)} -> ${p.role}`);
      for (const n of r.notes) console.log(`  emitted note.logged ${emit(o.root, "note.logged", n)} (vacancy demand ${n.role})`);
    }
  }
  if (o.json) console.log(JSON.stringify({ today, dispatched: report }, null, 2));
  return bad ? 1 : 0;
}

function isMainModule() {
  try {
    const invoked = process.argv[1];
    return !!invoked && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}
if (isMainModule()) process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });
if (isMainModule()) main().then((c) => { process.exitCode = c; }, (e) => { console.error(`org-dispatch: ${e.stack || e}`); process.exitCode = 2; });
