#!/usr/bin/env node
/**
 * org-catalog.mjs -- draft the role cards, render the org chart, digest the catalog (org Phase 00).
 *
 *   --draft --seed FILE   write a card for every seed row whose card does not exist yet. Bindings
 *                         come from the seed; each bound agent's TIER comes from its own frontmatter
 *                         (haiku->cheap-scan, sonnet->balanced-workhorse, opus->high-judgment, none->
 *                         balanced-workhorse and listed). An existing card is never overwritten:
 *                         a hand-edited card is the truth, the seed only births missing ones.
 *   --chart [--check]     render org/CHART.md + org/chart.json from the cards; --check fails on any
 *                         difference, so a hand edit to the chart is caught (REQ-04).
 *   --digest              sha256 over the canonical JSON of the PARSED cards, sorted by id -- the
 *                         ADR-1017 rule: reformatting never moves it, changing a value always does.
 *
 * Every count printed is derived from the cards on disk; nothing here carries a number forward.
 */
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";
import { collect, check } from "./org-coverage.mjs";
import { isStaffed, isId, DEPTS, OWNER } from "./lib/card.mjs";
import { emitYaml } from "./lib/emit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const MODEL_TIER = { haiku: "cheap-scan", sonnet: "balanced-workhorse", opus: "high-judgment" };
const TIERED = new Set(["agent", "skill", "partial"]);
const WORKING = new Set(["agent", "skill", "script", "process"]);
export const GENESIS_REVIEW_BY = "2026-10-29"; // ruling date + 30 days (ADR-1607), fixed so the digest never moves

const STAGES_BY_DEPT = {
  "a-board": ["discover", "validate", "build", "launch", "grow", "sell", "support", "operate"],
  "b-ceo-office": ["discover", "validate", "build", "launch", "grow", "sell", "support", "operate"],
  "c-research": ["discover", "validate"],
  "d-product": ["discover", "validate", "build"],
  "e-engineering": ["build", "launch", "support", "operate"],
  "f-design": ["build", "launch"],
  "g-growth": ["launch", "grow"],
  "h-sales": ["sell"],
  "i-support": ["support", "operate"],
  "j-finance-legal-people": ["launch", "operate"],
};
const DEPT_NAME = {
  "a-board": "Board & Governance", "b-ceo-office": "CEO Office", "c-research": "Research & Strategy",
  "d-product": "Product", "e-engineering": "Engineering", "f-design": "Design", "g-growth": "Growth & Marketing",
  "h-sales": "Sales", "i-support": "Customer Success & Support", "j-finance-legal-people": "Finance, Legal & People-Ops",
};

function agentTier(repo, stem, unpinned) {
  let text = "";
  try { text = readFileSync(join(repo, ".claude", "agents", `${stem}.md`), "utf8"); } catch { return null; }
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const m = fm && fm[1].match(/^model:\s*([A-Za-z0-9._-]+)\s*$/m);
  if (!m) { unpinned.push(stem); return "balanced-workhorse"; }
  return MODEL_TIER[m[1].toLowerCase()] ?? null;
}

/** One seed row -> one card, with every default from the Phase 00 spec (I-8b). */
export function cardFromSeed(repo, row, unpinned) {
  const seat = row.seat;
  const agents = row.agents ?? [];
  let tier = null;
  if (row.tier) tier = row.tier;
  else if (TIERED.has(seat)) {
    const tiers = agents.map((a) => agentTier(repo, a, unpinned)).filter(Boolean);
    tier = tiers.includes("high-judgment") && row.head ? "high-judgment" : (tiers[0] ?? "balanced-workhorse");
  }
  const legit = WORKING.has(seat) && row.genesis !== false;
  const card = {
    id: row.id, title: row.title, dept: row.dept,
    mission: row.mission ?? `Owns the ${row.title} job in ${DEPT_NAME[row.dept]}.`,
    stages: row.stages ?? STAGES_BY_DEPT[row.dept], seat,
  };
  if (row.owner_choice) card.owner_choice = true;
  if (row.byline) card.byline = row.byline;
  Object.assign(card, {
    origin: "own", hire: null,
    binds: { agents, skills: row.skills ?? [], scripts: row.scripts ?? [], process: row.process ?? null, tier },
    reports_to: row.reports_to, escalate_to: row.escalate_to ?? row.reports_to,
    e2: row.e2 ?? [],
    produces: { kind: `${row.id}-output`, schema: "pending", receipt: "handoff.ready" },
    consumes: [], fixtures: "pending",
  });
  if (legit) card.legitimacy = "genesis";
  card.ventures = [];
  card.kpi = legit ? [{ name: "runs", over: "run.completed", via: "attribution-map" }] : "pending";
  card.autonomy_ceiling = "L1";
  if (legit) card.review_by = GENESIS_REVIEW_BY;
  card.history = row.history ?? [];
  return card;
}

function draft(repo, seedPath) {
  const r = parseYamlSubset(readFileSync(seedPath, "utf8"));
  if (!r.ok) throw new Error(`seed: ${r.error.message}`);
  const rows = r.value?.roles;
  if (!Array.isArray(rows)) throw new Error("seed: expected a top-level roles: list");
  const unpinned = [];
  // Validate EVERY row and build every card in memory before one byte is written: a bad row 40
  // must not leave rows 1-39 on disk as a half-drafted catalog (attack d62ae10 B6). Ids and agent
  // stems become path segments, so both are held to the id grammar -- `join` would otherwise
  // normalise a `../` id straight out of org/roles/ (B3).
  const seen = new Set();
  const bad = [];
  const built = [];
  for (const [i, row] of rows.entries()) {
    const at = `seed row ${i + 1} (${JSON.stringify(row?.id)})`;
    if (!row || typeof row !== "object") { bad.push(`${at}: not a mapping`); continue; }
    if (!isId(row.id)) { bad.push(`${at}: id is not a valid role id`); continue; }
    if (seen.has(row.id)) { bad.push(`${at}: duplicate id`); continue; }
    seen.add(row.id);
    if (!DEPTS.includes(row.dept)) { bad.push(`${at}: unknown dept ${JSON.stringify(row.dept)}`); continue; }
    const stems = row.agents ?? [];
    if (!Array.isArray(stems) || !stems.every(isId)) { bad.push(`${at}: agents must be a list of agent stems`); continue; }
    try {
      const text = emitYaml(cardFromSeed(repo, row, unpinned), [
        `${row.title} -- role card (org, ADR-1601). Binds; never rewrites an agent file.`,
        "Edit by hand; org-catalog --draft never overwrites an existing card.",
      ]);
      built.push({ path: join(repo, "org", "roles", row.dept, `${row.id}.role.yaml`), text });
    } catch (e) { bad.push(`${at}: ${e.message}`); }
  }
  if (bad.length) {
    for (const b of bad) console.log(`FAIL ${b}`);
    console.log(`org-catalog: ${bad.length} bad seed row(s) -- nothing written`);
    return 1;
  }
  let wrote = 0, kept = 0;
  for (const { path, text } of built) {
    mkdirSync(dirname(path), { recursive: true });
    // `wx` makes "never overwrite" atomic: no gap between a check and the write.
    try { writeFileSync(path, text, { flag: "wx" }); wrote++; }
    catch (e) { if (e.code === "EEXIST") kept++; else throw e; }
  }
  console.log(`org-catalog: drafted ${wrote} card(s), kept ${kept} existing, from ${rows.length} seed row(s)`);
  if (unpinned.length) console.log(`org-catalog: agents with no model line (tier defaulted to balanced-workhorse, owner to review): ${[...new Set(unpinned)].join(", ")}`);
  return 0;
}

// ---------- chart ----------

function classify(c) {
  if (c.seat === "vacant") return "vacant";
  if (c.seat === "human") return "human";
  if (c.seat === "partial") return "partial";
  return isStaffed(c) ? "staffed" : "seated-unlegitimised";
}

export function chartModel(w) {
  const cards = w.cards.map((x) => x.card).sort((a, b) => a.dept.localeCompare(b.dept) || a.id.localeCompare(b.id));
  const counts = { roles: cards.length, staffed: 0, partial: 0, vacant: 0, human: 0, "seated-unlegitimised": 0, own: 0, hired: 0 };
  for (const c of cards) { counts[classify(c)]++; counts[c.origin]++; }
  return {
    counts,
    departments: DEPTS.map((d) => ({
      dept: d, name: DEPT_NAME[d],
      roles: cards.filter((c) => c.dept === d).map((c) => ({
        id: c.id, title: c.title, state: classify(c), seat: c.seat, origin: c.origin,
        e2: c.e2, owner_choice: !!c.owner_choice, binds: c.binds, reports_to: c.reports_to,
      })),
    })),
  };
}

function seatLabel(r) {
  const b = r.binds || {};
  const names = [...(b.agents || []), ...(b.skills || []).map((s) => `skill:${s}`), ...(b.scripts || []).map((s) => s.split("/").pop()), ...(b.process ? [`process:${b.process}`] : [])];
  return names.length ? names.join(", ") : "--";
}

export function renderChart(m) {
  const c = m.counts;
  const out = [
    "# arc's org chart",
    "",
    "<!-- GENERATED by .claude/scripts/org/org-catalog.mjs --chart from org/roles/**. Do not edit:",
    "     `org-catalog --chart --check` fails on any hand edit. Change a card instead. -->",
    "",
    `**${c.roles} roles** — ${c.staffed} staffed · ${c.partial} partial · ${c["seated-unlegitimised"]} seated, not yet legitimised · ${c.human} human · ${c.vacant} vacant — ${c.own} own · ${c.hired} hired.`,
    "",
    "Every count above is derived from the cards on disk. A vacant role is shown, never hidden (REQ-04).",
    "",
  ];
  for (const d of m.departments) {
    out.push(`## ${d.name}`, "", "| Role | State | Seat | Bound to | Reports to |", "|---|---|---|---|---|");
    for (const r of d.roles) {
      const state = r.state === "vacant" ? "**VACANT**" : r.state === "human" ? (r.e2.length ? `human (E2: ${r.e2.join("; ")})` : r.owner_choice ? "human (owner choice)" : "human") : r.state;
      out.push(`| ${r.title} (\`${r.id}\`) | ${state} | ${r.seat} · ${r.origin} | ${seatLabel(r)} | ${r.reports_to === OWNER ? "owner" : `\`${r.reports_to}\``} |`);
    }
    out.push("");
  }
  return out.join("\n");
}

/** A catalog the gate would refuse is never rendered or digested: collect() drops a card it
 *  cannot parse, so a chart or digest over the rest would silently describe a different
 *  catalog -- and a genesis approval would bless it (attack d62ae10 B2). */
async function soundWorld(repo) {
  const w = await collect(repo);
  const f = check(w);
  if (f.length) {
    for (const x of f) console.log(`FAIL ${x}`);
    console.log(`org-catalog: the catalog has ${f.length} finding(s) -- run org-coverage and fix them first; nothing rendered`);
    return null;
  }
  return w;
}

async function chart(repo, checkOnly) {
  const w = await soundWorld(repo);
  if (!w) return 1;
  const m = chartModel(w);
  const md = renderChart(m);
  const json = JSON.stringify(m, null, 2) + "\n";
  const mdPath = join(repo, "org", "CHART.md"), jsonPath = join(repo, "org", "chart.json");
  if (checkOnly) {
    const stale = [];
    if (readOr(mdPath) !== md) stale.push("org/CHART.md");
    if (readOr(jsonPath) !== json) stale.push("org/chart.json");
    if (stale.length) { console.log(`org-catalog: STALE ${stale.join(", ")} -- regenerate with --chart; never hand-edit`); return 1; }
    console.log(`org-catalog: check ${m.counts.roles} roles -- the chart is exactly what the cards render`);
    return 0;
  }
  writeFileSync(mdPath, md);
  writeFileSync(jsonPath, json);
  console.log(`org-catalog: chart written -- ${m.counts.roles} roles, ${m.counts.staffed} staffed, ${m.counts.vacant} vacant`);
  return 0;
}

// ---------- digest ----------

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

export function catalogDigest(w) {
  const cards = w.cards.map((x) => x.card).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return createHash("sha256").update(canonical(cards)).digest("hex");
}

async function digest(repo) {
  const w = await soundWorld(repo);
  if (!w) return 1;
  const genesis = w.cards.filter((x) => x.card?.legitimacy === "genesis").length;
  console.log(`digest: ${catalogDigest(w)}`);
  console.log(`cards: ${w.cards.length} · genesis-legitimised: ${genesis}`);
  return 0;
}

// ---------- CLI ----------

// CRLF is folded to LF before comparing: a checkout with autocrlf turned on is not a hand edit (B4).
function readOr(p) { try { return readFileSync(p, "utf8").replace(/\r\n/g, "\n"); } catch { return null; } }

function parseArgs(argv) {
  const o = { root: REPO, mode: null, check: false, seed: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`); return v; };
    if (a === "--draft" || a === "--chart" || a === "--digest") {
      if (o.mode) throw new Error(`${a} and --${o.mode} are separate modes`);
      o.mode = a.slice(2);
    } else if (a === "--check") o.check = true;
    else if (a === "--seed") o.seed = val();
    else if (a === "--root") o.root = val();
    else throw new Error(`unknown flag ${JSON.stringify(a)} -- known flags are --draft --seed --chart --check --digest --root`);
  }
  if (!o.mode) throw new Error("one of --draft, --chart, --digest is required");
  if (o.mode === "draft" && !o.seed) throw new Error("--draft needs --seed FILE");
  if (o.check && o.mode !== "chart") throw new Error("--check only applies to --chart");
  return o;
}

async function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`org-catalog: ${e.message}`); return 2; }
  if (o.mode === "draft") return draft(o.root, o.seed);
  if (o.mode === "chart") return chart(o.root, o.check);
  return digest(o.root);
}

function isMainModule() {
  try {
    const invoked = process.argv[1];
    return !!invoked && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}
// exitCode, not exit(): a hard exit right after a burst of console.log can cut a piped stdout short.
if (isMainModule()) main().then((c) => { process.exitCode = c; }, (e) => { console.error(`org-catalog: ${e.stack || e}`); process.exitCode = 2; });
