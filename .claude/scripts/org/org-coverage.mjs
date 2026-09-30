#!/usr/bin/env node
/**
 * org-coverage.mjs -- the role catalog and the tree can never disagree silently (org Phase 00).
 *
 * REQ-01 · REQ-03 · REQ-13 · REQ-11's gate arms · ADR-1609 / ADR-1610 / ADR-1614 / ADR-1615 / ADR-1620.
 *
 * FAIL-FROM-BIRTH, bidirectional: every agent in the tree has a role, and every name a role
 * binds exists in the tree. Every expected set is DERIVED from the source on disk through the
 * walkers `face-coverage.mjs` exports (ADR-1610) -- a gate whose expected set is its own list
 * measures its own memory (retro 2026-08-24).
 *
 * Usage: node .claude/scripts/org/org-coverage.mjs [--root DIR] [--mutant-selftest]
 * Exit:  0 covered · 1 findings (or a failed self-test arm) · 2 usage
 */
import { readFileSync, readdirSync, existsSync, lstatSync, statSync, realpathSync, mkdtempSync,
  mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mdStems, yamlStems, treeScripts, treeCapabilities, treeKinds, treeVentures } from "../core/face-coverage.mjs";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";
import { parsePolicyYaml } from "../hq/lib/policy/yaml.mjs";
import { validateCard, isStaffed, DEPTS, OWNER } from "./lib/card.mjs";
import { emitYaml } from "./lib/emit.mjs";
import { validateMap } from "./lib/attribution.mjs";
import { validateTeam } from "./lib/team.mjs";
import { validateStages } from "./lib/dispatch.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const ROLE_SUFFIX = ".role.yaml";
const TEAM_SUFFIX = ".team.yaml";

// ---------- collect: everything the checks read, and nothing they compute ----------

/**
 * @param repo    tree root
 * @param inject  test seam for the self-test: { agents, scripts, kinds } replace a walker's
 *                answer so M10 can prove an EMPTY walker is refused, never read as "covered".
 */
export async function collect(repo, inject = {}) {
  const w = { repo, errors: [] };
  const agentsDir = join(repo, ".claude", "agents");
  w.agents = inject.agents ?? mdStems(agentsDir);
  // The floor: an independent count of the same directory. A walker that disconnects from its
  // input returns [] and every "every agent has a role" check passes over nothing.
  w.agentFloor = existsSync(agentsDir) ? readdirSync(agentsDir).filter((n) => n.endsWith(".md")).length : 0;
  w.scripts = inject.scripts ?? treeScripts(repo);
  w.processes = yamlStems(join(repo, "processes"));
  const caps = treeCapabilities(repo);
  if (caps.unreadable) w.errors.push(`capabilities unreadable: ${caps.unreadable}`);
  w.skills = caps.names.filter((n) => n.startsWith("skill:")).map((n) => n.slice(6));
  w.kinds = new Set(inject.kinds ?? await treeKinds(repo));
  const v = await treeVentures(repo);
  if (v.unreadable) w.errors.push(`ventures.yaml unreadable: ${v.unreadable}`);
  w.ventures = v.names;

  const router = parseYamlSubset(readText(join(repo, "engine", "router.yaml")) ?? "");
  w.tiers = new Set(router.ok && Array.isArray(router.value?.tiers) ? router.value.tiers : []);
  if (!w.tiers.size) w.errors.push("engine/router.yaml yields no tiers: list -- no card tier can be judged");

  let policy = null;
  try { policy = parsePolicyYaml(readText(join(repo, "hq.policy.yaml")) ?? ""); }
  catch (e) { w.errors.push(`hq.policy.yaml unreadable: ${e.message}`); }
  w.ungrantable = new Set(Array.isArray(policy?.ungrantable_actions) ? policy.ungrantable_actions : []);
  if (!w.ungrantable.size) w.errors.push("hq.policy.yaml yields no ungrantable_actions -- E2 cannot be judged");
  w.processE2 = new Map(Object.entries(policy?.kinds ?? {})
    .filter(([k]) => k.startsWith("process:")).map(([k, row]) => [k.slice(8), Array.isArray(row?.e2) ? row.e2 : []]));

  const drv = join(repo, ".claude", "scripts", "engine", "drivers");
  w.drivers = new Set(existsSync(drv) ? readdirSync(drv).filter((n) => n.endsWith(".mjs"))
    .map((n) => n.slice(0, -4)).filter((n) => n !== "common" && n !== "mock") : []);

  w.cards = [];
  const roles = join(repo, "org", "roles");
  if (existsSync(roles)) {
    for (const d of readdirSync(roles).sort()) {
      const dp = join(roles, d);
      if (!isDir(dp)) { w.errors.push(`org/roles/${d} is not a department directory`); continue; }
      if (!DEPTS.includes(d)) w.errors.push(`org/roles/${d} is not one of the ten departments`);
      for (const n of readdirSync(dp).sort()) {
        const rel = `org/roles/${d}/${n}`;
        if (!n.endsWith(ROLE_SUFFIX) || !isFile(join(dp, n))) { w.errors.push(`${rel} is not a *${ROLE_SUFFIX} file`); continue; }
        const r = parseYamlSubset(readText(join(dp, n)) ?? "");
        if (!r.ok) { w.errors.push(`${rel}: ${r.error.message}`); continue; }
        w.cards.push({ stem: n.slice(0, -ROLE_SUFFIX.length), dept: d, rel, card: r.value });
      }
    }
  }
  const teams = join(repo, "org", "teams");
  w.teams = existsSync(teams) ? readdirSync(teams).filter((n) => n.endsWith(TEAM_SUFFIX)).map((n) => n.slice(0, -TEAM_SUFFIX.length)) : [];
  // Phase 02: each team manifest is parsed here and judged in check(), statically. Its GOVERNANCE
  // (an approved digest) needs the spine and lives in org-team --check.
  w.teamDocs = w.teams.map((stem) => {
    const r = parseYamlSubset(readText(join(teams, `${stem}${TEAM_SUFFIX}`)) ?? "");
    return r.ok ? { stem, doc: r.value } : { stem, error: r.error.message };
  });
  const stagesText = readText(join(repo, "org", "stages.yaml"));
  if (stagesText !== null) { const r = parseYamlSubset(stagesText); w.stages = r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error.message }; }
  const amap = readText(join(repo, "org", "attribution.yaml"));
  if (amap !== null) {
    const r = parseYamlSubset(amap);
    w.attribution = r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error.message };
  }
  return w;
}

// ---------- check: pure over a collected world ----------

export function check(w) {
  const f = [...w.errors];
  if (w.agents.length === 0) f.push("WALKER EMPTY: agents -- the agent walker returned nothing; refusing to call that covered");
  if (w.scripts.length === 0) f.push("WALKER EMPTY: scripts -- the scripts walker returned nothing; refusing to call that covered");
  if (w.agents.length !== w.agentFloor)
    f.push(`walker disagrees with the tree: ${w.agents.length} agent(s) walked, ${w.agentFloor} file(s) on disk`);
  if (w.cards.length === 0) f.push("no role cards under org/roles/ -- an empty catalog is never covered");

  const ctxBase = { tiers: w.tiers, ungrantable: w.ungrantable, drivers: w.drivers, kinds: w.kinds };
  const byId = new Map();
  for (const c of w.cards) {
    f.push(...validateCard(c.card, { ...ctxBase, stem: c.stem, dept: c.dept }));
    const id = c.card?.id;
    if (typeof id === "string") {
      if (byId.has(id)) f.push(`${id}: duplicate role id (${byId.get(id).rel} and ${c.rel})`);
      else byId.set(id, c);
    }
  }
  const cards = w.cards.map((c) => c.card).filter((c) => c && typeof c === "object");

  // Bidirectional agent coverage (REQ-01).
  const agentSet = new Set(w.agents);
  const bound = new Set();
  const skills = new Set(w.skills), scripts = new Set(w.scripts), processes = new Set(w.processes);
  for (const c of cards) {
    const b = c.binds || {};
    for (const a of arr(b.agents)) { bound.add(a); if (!agentSet.has(a)) f.push(`${c.id}: binds agent "${a}", which does not exist in .claude/agents/`); }
    for (const s of arr(b.skills)) if (!skills.has(s)) f.push(`${c.id}: binds skill "${s}", which does not exist in .claude/skills/`);
    for (const s of arr(b.scripts)) if (!scripts.has(s)) f.push(`${c.id}: binds script "${s}", which does not exist under .claude/scripts/`);
    if (typeof b.process === "string" && !processes.has(b.process)) f.push(`${c.id}: binds process "${b.process}", which does not exist in processes/`);
    // ORG-I: a bound process's own E2 list is the source of truth; the card may not under-declare it.
    if (typeof b.process === "string" && w.processE2.has(b.process))
      for (const e of w.processE2.get(b.process)) if (!arr(c.e2).includes(e)) f.push(`${c.id}: binds process "${b.process}" whose policy row carries E2 "${e}", but the card does not declare it`);
  }
  for (const a of w.agents) if (!bound.has(a)) f.push(`agent "${a}" belongs to no role (REQ-01)`);

  // Reporting lines resolve.
  for (const c of cards) for (const k of ["reports_to", "escalate_to"]) {
    const t = c[k];
    if (typeof t === "string" && t !== OWNER && !byId.has(t)) f.push(`${c.id}: ${k} "${t}" is not a role id`);
  }

  // Heads judge, they do not relay (ORG-O): a seated head needs >= 2 staffed workers.
  const workers = new Map();
  for (const c of cards) if (typeof c.reports_to === "string" && c.reports_to !== OWNER)
    workers.set(c.reports_to, [...(workers.get(c.reports_to) || []), c]);
  for (const [head, ws] of workers) {
    const h = byId.get(head)?.card;
    if (!h || h.seat === "vacant" || h.seat === "human") continue;
    const staffed = ws.filter(isStaffed).length;
    if (staffed < 2) f.push(`${head}: a seated head over ${staffed} staffed worker(s) -- a head needs >= 2 to judge (ORG-O)`);
  }

  // Every handoff has a producer (REQ-13). Phase 00 scope: anywhere in the catalog.
  const produced = new Set(cards.map((c) => c.produces?.kind).filter(Boolean));
  for (const c of cards) for (const k of arr(c.consumes)) if (!produced.has(k)) f.push(`${c.id}: consumes "${k}", which no role produces (REQ-13)`);

  // A staffed role is measured, never merely listed (ORG-J).
  for (const c of cards) if (isStaffed(c) && c.kpi === "pending") f.push(`${c.id}: staffed with kpi: pending -- a staffed seat must be measurable over the spine`);

  // Ventures <-> teams. A venture no card is seated for is printed as unstaffed, never hidden.
  const teamSet = new Set(w.teams), ventureSet = new Set(w.ventures);
  w.unstaffed = [];
  for (const v of w.ventures) {
    if (teamSet.has(v)) continue;
    const seated = cards.filter((c) => arr(c.ventures).includes(v));
    if (seated.length) f.push(`venture "${v}" has ${seated.length} seated role(s) (${seated.map((c) => c.id).join(", ")}) but no org/teams/${v}${TEAM_SUFFIX}`);
    else w.unstaffed.push(v);
  }
  for (const t of w.teams) if (!ventureSet.has(t)) f.push(`org/teams/${t}${TEAM_SUFFIX} names no venture in ventures.yaml`);
  for (const c of cards) for (const v of arr(c.ventures)) if (!ventureSet.has(v)) f.push(`${c.id}: seated for venture "${v}", which is not in ventures.yaml`);

  // The attribution map (Phase 01, ADR-1604) points at roles too: a rule naming a role that is not
  // a card places receipts on a seat nobody holds, and the scorecard would count them silently.
  // Team manifests (REQ-06/REQ-13 team scope, ADR-1615 heads, ADR-1616 budgets).
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  for (const t of w.teamDocs || []) {
    if (t.error) { f.push(`org/teams/${t.stem}${TEAM_SUFFIX}: ${t.error}`); continue; }
    f.push(...validateTeam(t.doc, { stem: t.stem, ventures: ventureSet, cards: cardMap }));
  }

  // REQ-11 on the spine: an `interview:ULID` must be an owner APPROVE over an org.role request that
  // names this role. Checked only when a spine is given (--spine-dir); CI has none, and the grammar
  // check above still runs everywhere.
  if (w.spineEvents) {
    const byId = new Map(w.spineEvents.map((e) => [e.id, e]));
    for (const c of cards) {
      if (typeof c.legitimacy !== "string" || !c.legitimacy.startsWith("interview:")) continue;
      const d = byId.get(c.legitimacy.slice(10));
      const req = d && d.kind === "decision.recorded" ? byId.get(d.payload?.decides) : null;
      if (!d || d.kind !== "decision.recorded") f.push(`${c.id}: interview ${c.legitimacy.slice(10)} is not a decision on this spine (REQ-11)`);
      else if (d.payload?.verdict !== "approve") f.push(`${c.id}: interview ${d.id} was not approved (REQ-11)`);
      else if (!req || req.kind !== "approval.requested" || req.payload?.subject !== "org.role" || req.payload?.role !== c.id)
        f.push(`${c.id}: interview ${d.id} decides no org.role request naming this role (REQ-11)`);
    }
  }

  // The dispatcher's stage criteria point at roles and kinds too (ADR-1606).
  if (w.stages) {
    if (!w.stages.ok) f.push(`org/stages.yaml: ${w.stages.error}`);
    else f.push(...validateStages(w.stages.value, new Set(byId.keys()), w.kinds));
  }

  if (w.attribution) {
    if (!w.attribution.ok) f.push(`org/attribution.yaml: ${w.attribution.error}`);
    else f.push(...validateMap(w.attribution.value, byId, w.kinds));
  }
  return f;
}

// ---------- mutant self-test: the gate is attacked, and each plant must be named ----------

const PLANT_ID = "zz-mutant-plant";

function plantCard(over = {}) {
  return {
    id: PLANT_ID, title: "Mutant plant", dept: "e-engineering", mission: "A self-test plant.",
    stages: ["build"], seat: "vacant", origin: "own", hire: null,
    binds: { agents: [], skills: [], scripts: [], process: null, tier: null },
    reports_to: OWNER, escalate_to: OWNER, e2: [],
    produces: { kind: `${PLANT_ID}-output`, schema: "pending", receipt: "handoff.ready" },
    consumes: [], fixtures: "pending", ventures: [], kpi: "pending",
    autonomy_ceiling: "L1", history: [], ...over,
  };
}

/** Each arm: a plant, and the text its finding must contain. M0 is the clean control. */
function arms(firstAgent) {
  const agentSeat = (over) => plantCard({ seat: "agent", legitimacy: "genesis", review_by: "2026-10-29",
    kpi: [{ name: "runs", over: "run.completed", via: "attribution-map" }],
    binds: { agents: [firstAgent], skills: [], scripts: [], process: null, tier: "balanced-workhorse" }, ...over });
  return [
    { id: "M0", what: "clean tree", expect: null },
    { id: "M1", what: "orphan agent", files: { ".claude/agents/zz-orphan-agent.md": "---\nname: zz-orphan-agent\n---\n" }, expect: 'agent "zz-orphan-agent" belongs to no role' },
    { id: "M2", what: "role binds a ghost agent", card: plantCard({ binds: { agents: ["ghost-agent"], skills: [], scripts: [], process: null, tier: null } }), expect: 'binds agent "ghost-agent"' },
    { id: "M3", what: "E2 role seated by an agent", card: agentSeat({ e2: ["moving money"] }), expect: "only human:ashiq may hold it" },
    { id: "M4", what: "non-verbatim e2 string", card: plantCard({ seat: "human", e2: ["publish"] }), expect: 'e2 "publish" is not a verbatim' },
    { id: "M5", what: "hired seat with no hire.runtime", card: plantCard({ origin: "hired", hire: { source: "openrouter:x/y", vetted_by: "capability-scout" } }), expect: "is not an arc-run driver" },
    { id: "M6", what: "hired seat staffed with no fixture verdict", card: agentSeat({ origin: "hired", legitimacy: "interview:01ARZ3NDEKTSV4RRFFQ69G5FAV", fixtures: "pending", hire: { runtime: "generic-api", source: "openrouter:x/y", vetted_by: "capability-scout" } }), expect: "fixture" },
    { id: "M7", what: "consumes an unproduced kind", card: plantCard({ consumes: ["ghost-brief"] }), expect: 'consumes "ghost-brief", which no role produces' },
    { id: "M8", what: "head over fewer than 2 staffed workers", cards: [agentSeat({}), agentSeat({ id: `${PLANT_ID}-w`, reports_to: PLANT_ID, produces: { kind: `${PLANT_ID}-w-output`, schema: "pending", receipt: "handoff.ready" } })], expect: "a head needs >= 2" },
    { id: "M9", what: "a model string as the tier", card: agentSeat({ binds: { agents: [firstAgent], skills: [], scripts: [], process: null, tier: "claude-opus" } }), expect: "names a model" },
    { id: "M10", what: "agent and script walkers return nothing", inject: { agents: [], scripts: [] }, expect: "WALKER EMPTY: agents" },
    { id: "M11", what: "venture with a seated card and no team manifest", card: plantCard({ ventures: ["__FIRST_VENTURE__"] }), expect: "but no org/teams/" },
    { id: "M12", what: "ghost agent planted in the LAST card in sort order", last: true, expect: 'binds agent "ghost-agent"' },
    { id: "M13", what: "attribution rule placing receipts on a role that is not a card", mapRule: { id: "zz-ghost-rule", match: { process: "zz-nothing" }, role: "ghost-role" }, expect: 'role "ghost-role" is not a card id' },
    { id: "M14", what: "team manifest seating an E2 role without the owner", team: true, expect: "touches E2" },
  ];
}

/** A scratch tree holding exactly what collect() reads. Scripts become empty placeholders:
 *  the gate reads their NAMES, and copying their bytes would only slow every arm. */
function buildScratch(repo, w, s) {
  for (const d of [".claude/agents", ".claude/skills", "processes", "org"]) {
    const src = join(repo, d);
    if (existsSync(src)) cpSync(src, join(s, d), { recursive: true });
  }
  for (const p of ["engine/router.yaml", "hq.policy.yaml", "ventures.yaml", ".mcp.json"]) {
    if (existsSync(join(repo, p))) { mkdirSync(dirname(join(s, p)), { recursive: true }); cpSync(join(repo, p), join(s, p)); }
  }
  // Real bytes, not placeholders: each arm runs the CLI against this tree, and the walkers IMPORT
  // code from the tree they read (the YAML parser, the spine vocabulary in validate.mjs).
  cpSync(join(repo, ".claude", "scripts"), join(s, ".claude", "scripts"), {
    recursive: true, filter: (src) => !/[\\/]node_modules([\\/]|$)/.test(src),
  });
  return s;
}

const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Run THIS gate as a child process on a tree, and return what a caller of the CLI would see. */
function runCli(root) {
  // A hard per-arm ceiling: a hung child must fail its arm, not hold the self-test until the CI job limit.
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--root", root], { encoding: "utf8", timeout: 120_000, killSignal: "SIGKILL" });
  const findings = (r.stdout || "").split(/\r?\n/).filter((l) => l.startsWith("FAIL ")).map((l) => l.slice(5));
  return { exit: r.error ? `timeout/${r.error.code}` : r.status, findings, ran: /^org-coverage: /m.test(r.stdout || ""), stderr: r.stderr || "" };
}

async function mutantSelftest(repo) {
  const real = await collect(repo);
  const kinds = [...real.kinds];
  // The dir exists before anything can throw, and every exit path -- a throw inside the build, a
  // failed arm, Ctrl+C -- removes it (attack d62ae10 B8).
  const scratch = mkdtempSync(join(tmpdir(), `org-selftest-${process.pid}-`));
  const cleanup = () => rmSync(scratch, { recursive: true, force: true });
  const onSig = () => { cleanup(); process.exit(130); };
  process.once("SIGINT", onSig);
  const table = arms(real.agents[0]);
  let ran = 0, failed = 0;
  const lines = [];
  try {
    buildScratch(repo, real, scratch);
    for (const a of table) {
      const written = [];
      const put = (rel, text) => { const p = join(scratch, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); written.push(p); };
      let restore = null;
      try {
        for (const [rel, text] of Object.entries(a.files || {})) put(rel, text);
        for (const c of a.cards || (a.card ? [a.card] : [])) {
          const card = JSON.parse(JSON.stringify(c).replace("__FIRST_VENTURE__", real.ventures[0] ?? "no-venture"));
          put(`org/roles/${card.dept}/${card.id}${ROLE_SUFFIX}`, emitYaml(card));
        }
        if (a.team) {
          const v = real.ventures[0];
          if (!v) throw new Error("self-test: M14 needs one venture in ventures.yaml");
          put(`org/teams/${v}${TEAM_SUFFIX}`, emitYaml({ venture: v, stage: "validate", mission: "private",
            on_shift: { validate: ["pricing-strategist"] }, seats: { "pricing-strategist": { holder: "card" } },
            dispatch: { heartbeat: "daily", queue_cap: 7 } }));
        }
        if (a.mapRule) {
          const p = join(scratch, "org", "attribution.yaml");
          const before = readFileSync(p, "utf8");
          const doc = parseYamlSubset(before);
          if (!doc.ok) throw new Error(`self-test: the real attribution map does not parse (${doc.error.message})`);
          doc.value.rules = [...doc.value.rules, a.mapRule];
          writeFileSync(p, emitYaml(doc.value));
          restore = () => writeFileSync(p, before);
        }
        if (a.last) {
          const last = [...real.cards].sort((x, y) => byCode(String(x.card?.id), String(y.card?.id))).at(-1);
          const p = join(scratch, last.rel);
          const before = readFileSync(p, "utf8");
          const card = JSON.parse(JSON.stringify(last.card));
          card.binds.agents = [...(card.binds.agents || []), "ghost-agent"];
          writeFileSync(p, emitYaml(card));
          restore = () => writeFileSync(p, before);
        }
        // Every arm runs the real CLI in a child process and reads its real exit status (attack
        // 4a4a17b B7): an in-process check() never passes through parseArgs, main or the exit code.
        // The one exception is an arm that stubs a WALKER, which only the in-process seam can do;
        // its line says so rather than printing a synthetic exit as if the CLI had produced it.
        let exit, findings, how;
        if (a.inject) {
          findings = check(await collect(scratch, { kinds, ...a.inject }));
          exit = findings.length ? 1 : 0;
          how = "in-process";
        } else {
          const r = runCli(scratch);
          if (!r.ran) { failed++; ran++; lines.push(`${a.id} ${a.what}: FAILED-ARM (the CLI did not run: exit ${r.status ?? r.exit}; ${r.stderr.trim().split("\n").pop() || "no stderr"})`); continue; }
          ({ exit, findings } = r);
          how = "cli";
        }
        ran++;
        const hit = a.expect ? findings.find((x) => x.includes(a.expect)) : null;
        const ok = a.expect === null ? findings.length === 0 && exit === 0 : !!hit && exit === 1;
        if (!ok) failed++;
        lines.push(`${a.id} ${a.what}: ${ok ? "PASS" : "FAILED-ARM"} (exit ${exit}, ${how})`);
        if (a.expect && hit) lines.push(`   EXPECTED-FAIL ${hit}`);
        if (!ok) lines.push(`   wanted ${a.expect === null ? "no findings" : `a finding containing "${a.expect}"`}; got ${findings.length ? findings.slice(0, 3).join(" | ") : "none"}`);
      } finally {
        for (const p of written) rmSync(p, { force: true });
        if (restore) restore();
      }
    }
  } finally {
    process.removeListener("SIGINT", onSig);
    cleanup();
  }
  for (const l of lines) console.log(l);
  console.log(`mutant-selftest: ran ${ran} of ${table.length}`);
  return failed === 0 && ran === table.length ? 0 : 1;
}

// ---------- helpers + CLI ----------

// A UTF-8 BOM (Notepad) would become part of the first key, `\uFEFFid`, and fail a card for a byte nobody sees.
function readText(p) { try { return readFileSync(p, "utf8").replace(/^\uFEFF/, ""); } catch { return null; } }
// statSync, not lstat: a root reached through a symlink or junction is a directory to every caller (B8).
function isDir(p) { try { return statSync(p).isDirectory(); } catch { return false; } }
function isFile(p) { try { return lstatSync(p).isFile(); } catch { return false; } }
function arr(v) { return Array.isArray(v) ? v : []; }

function parseArgs(argv) {
  const o = { root: REPO, selftest: false, spineDir: null };
  // A flag given twice is an operator error, never last-wins (lanes.md; attack c7eddd6 B4).
  const given = new Set();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { if (given.has(argv[i])) return { error: `${argv[i]} given twice` }; given.add(argv[i]); }
    const a = argv[i];
    if (a === "--mutant-selftest") o.selftest = true;
    else if (a === "--spine-dir") {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) return { error: "--spine-dir needs a directory" };
      o.spineDir = v;
    } else if (a === "--root") {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) return { error: "--root needs a directory" };
      o.root = v;
    } else return { error: `unknown flag ${JSON.stringify(a)} -- known flags are --root, --spine-dir, --mutant-selftest` };
  }
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.error) { console.error(`org-coverage: ${o.error}`); return 2; }
  if (!isDir(o.root)) { console.error(`org-coverage: no such directory: ${o.root}`); return 2; }
  if (o.selftest) return mutantSelftest(o.root);
  const w = await collect(o.root);
  if (o.spineDir) {
    if (!isDir(o.spineDir)) { console.error(`org-coverage: no spine at ${o.spineDir}`); return 2; }
    const { scanAll } = await import(pathToFileURL(join(o.root, ".claude", "scripts", "hq", "spine.mjs")).href);
    w.spineEvents = scanAll(o.spineDir).events.map((x) => x.event);
  }
  const f = check(w);
  for (const x of f) console.log(`FAIL ${x}`);
  const staffed = w.cards.filter((c) => isStaffed(c.card)).length;
  const summary = `${w.cards.length} roles (${staffed} staffed), ${w.agents.length} agents, ${w.scripts.length} scripts, ${w.ventures.length} venture(s)`;
  if (w.unstaffed?.length) console.log(`unstaffed: ${w.unstaffed.map((v) => `unstaffed:${v}`).join(" ")} (${w.unstaffed.length}, no card seated for them)`);
  if (f.length) { console.log(`org-coverage: ${summary} -- ${f.length} finding(s)`); return 1; }
  console.log(`org-coverage: ${summary} -- all covered`);
  return 0;
}

function isMainModule() {
  try {
    const invoked = process.argv[1];
    return !!invoked && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}
// exitCode, not exit(): a hard exit right after a burst of console.log can cut a piped stdout short.
// And a reader that closes early (`| head -1`) is not an error of THIS program: EPIPE is ignored
// rather than crashing with a code that no longer says what the gate found (attack 4a4a17b B5).
if (isMainModule()) process.stdout.on("error", (e) => { if (e.code !== "EPIPE") throw e; });
if (isMainModule()) main().then((c) => { process.exitCode = c; }, (e) => { console.error(`org-coverage: ${e.stack || e}`); process.exitCode = 2; });
