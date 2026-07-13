#!/usr/bin/env node
/**
 * kickoff-lint — deterministic gate for /arc-kickoff, /arc-change and /arc-phase-done.
 * Zero deps. Exit 0 = plan structurally complete; exit 1 = named failures listed.
 * v3 check groups: [tier] [adr] [spike] [phase-deps]. A plan is "v3" when PLAN.md has a
 * `**Tier:**` line under Appetite — plans written before v3 get WARNs (grandfathered),
 * v3 plans get hard FAILs. New kickoffs always write the Tier line, so v3 is strict.
 * NOTE: the vague-acceptance gate and placeholder detection are HEURISTICS — they catch
 * common failure shapes, not all of them. A pass is structural, not a quality guarantee.
 * Usage: node .claude/scripts/kickoff-lint.mjs [repo-root]
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || ".";
const failures = [];
const warnings = [];
const fail = (check, msg) => failures.push(`[${check}] ${msg}`);
const warn = (check, msg) => warnings.push(`[${check}] ${msg}`);

// ---------- helpers ----------
const read = (p) => readFileSync(join(root, p), "utf8");

function sections(md) {
  const out = {};
  const parts = md.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = part.slice(0, nl).trim().toLowerCase();
    out[heading] = part.slice(nl + 1);
  }
  return out;
}

function section(secs, needle) {
  const key = Object.keys(secs).find((h) => h.includes(needle.toLowerCase()));
  return key ? secs[key] : null;
}

function tableRows(body) {
  if (!body) return [];
  return body
    .split("\n")
    .filter((l) => /^\s*\|/.test(l))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()))
    .filter((cells) => !cells.every((c) => /^[-: ]*$/.test(c)))
    .slice(1);
}

function hasContent(body) {
  if (!body) return false;
  const stripped = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*[|>\-#\s]*$/gm, "")
    .trim();
  return stripped.length > 20 && !/TODO|TBD|<[a-z- ]+>/i.test(stripped);
}

// ---------- 1. PLAN.md exists ----------
if (!existsSync(join(root, "PLAN.md"))) {
  fail("plan-exists", "PLAN.md not found — run /arc-kickoff first");
  report();
}
const plan = read("PLAN.md");
const secs = sections(plan);

// ---------- 2. required sections non-empty ----------
const required = [
  "goal", "appetite", "architecture", "key decisions", "success requirements",
  "non-negotiables", "no-gos", "rabbit holes", "assumptions", "external dependencies",
  "pre-mortem", "phases",
];
for (const name of required) {
  const body = section(secs, name);
  if (body === null) fail("sections", `missing "## ${name}" section`);
  else if (!hasContent(body)) fail("sections", `"## ${name}" is empty or placeholder`);
}

// ---------- 2b. tier (kickoff v3): derived from appetite, sets caps ----------
const appetiteBody = section(secs, "appetite") || "";
const tierStrict = appetiteBody.match(/\*\*Tier:\*\*\s*([SML])\s*$/m);
const tierLoose = /\*\*Tier:\*\*/.test(appetiteBody);
const isV3 = tierLoose;
let tier = null;
if (!isV3)
  warn("tier", "no `**Tier:** S|M|L` line under Appetite — plan pre-dates kickoff v3 (new kickoffs must set it; v3 checks relaxed to WARN)");
else if (!tierStrict)
  fail("tier", "Tier line present but not exactly one of S | M | L (template placeholder left in?)");
else tier = tierStrict[1];
const REQ_CAP = tier === "S" ? 5 : 10;
const v3check = isV3 ? fail : warn;

// ---------- 3. success requirements: status lifecycle, tier-capped active rows, phase mapping ----------
const VAGUE =
  /\b(fast|quick(?:ly)?|easy|easily|simple|simply|properly|robust|seamless(?:ly)?|user-friendly|intuitive|should work|good|better|nice|nicely|clean|smooth(?:ly)?|performant|scalable|efficient(?:ly)?)\b/i;
const VERIFIABLE = /[\d<>%]|\bms\b|\bsec(?:ond)?s?\b|`[^`]+`/;
const isVague = (t) => VAGUE.test(t) && !VERIFIABLE.test(t);

// Status lifecycle (GSD borrow, Arc-weight): active | validated | dropped.
// dropped rows are scope-cut HISTORY — never deleted, exempt from mapping/acceptance
// checks, and don't count toward the cap.
const REQ_STATUS = new Set(["active", "validated", "dropped"]);
const reqRows = tableRows(section(secs, "success requirements"));
const reqPhases = new Set();
let activeReqs = 0;
if (reqRows.length === 0) fail("reqs", "no REQ rows in Success requirements table");
for (const r of reqRows) {
  const id = r[0] || "?";
  if (!/^REQ-\d+/i.test(id)) fail("reqs", `row "${id}" — id must be REQ-NN`);
  const status = (r[4] || "").trim().toLowerCase();
  if (!REQ_STATUS.has(status)) {
    fail("reqs", `${id} status "${(r[4] || "").trim() || "(empty)"}" — must be active | validated | dropped`);
    continue;
  }
  if (status === "dropped") continue;
  if (status === "active") activeReqs++;
  const phase = r[3] || "";
  const m = phase.match(/\d+/);
  if (!m) fail("reqs", `${id} has no phase mapping`);
  else reqPhases.add(Number(m[0]));
  const acc = (r[2] || "").trim();
  if (!acc || acc.length < 8)
    fail("reqs", `${id} acceptance criterion missing or not measurable`);
  else if (isVague(acc))
    fail("vague", `${id} acceptance "${acc.slice(0, 50)}" — vague word without a verifiable token (number, < > %, ms, or \`command\`). Make it falsifiable.`);
  else if (VAGUE.test(acc))
    warn("vague", `${id} acceptance "${acc.slice(0, 50)}" — vague word next to a verifiable token; confirm the token actually measures the claim (heuristic).`);
}
if (activeReqs > REQ_CAP)
  fail(tier ? "tier" : "reqs", `${activeReqs} active REQs — hard cap${tier ? ` for tier ${tier}` : ""} is ${REQ_CAP}, cut scope`);

// ---------- 4. phases: spec files exist, every phase >0 serves a live REQ ----------
const phaseRows = tableRows(section(secs, "phases"));
if (phaseRows.length === 0) fail("phases", "no rows in Phases table");
const phaseNums = [];
for (const r of phaseRows) {
  const m = (r[0] || "").match(/\d+/);
  if (!m) continue;
  const n = Number(m[0]);
  phaseNums.push(n);
  const specPath = `phases/phase-${String(n).padStart(2, "0")}-spec.md`;
  if (!existsSync(join(root, specPath))) fail("phases", `${specPath} missing (phase ${n})`);
  if (n > 0 && !reqPhases.has(n))
    fail("phases", `phase ${n} serves no active/validated REQ — phase without a goal`);
}
if (!phaseNums.includes(0)) fail("phase0", "no Phase 0 (steel thread) in Phases table");
for (const p of reqPhases)
  if (!phaseNums.includes(p)) fail("reqs", `REQ maps to phase ${p} which doesn't exist`);

// ---------- 4b. phase dependency lines (kickoff v3): exist, valid refs, no cycles ----------
const depGraph = new Map();
for (const n of phaseNums) {
  const specPath = `phases/phase-${String(n).padStart(2, "0")}-spec.md`;
  if (!existsSync(join(root, specPath))) continue; // missing spec already failed above
  const spec = read(specPath);
  const depLine = spec.match(/\*\*Depends on:\*\*\s*(.+)/);
  if (!depLine) {
    v3check("phase-deps", `${specPath}: missing **Depends on:** line${isV3 ? "" : " (required from kickoff v3)"}`);
    continue;
  }
  const val = depLine[1].trim();
  if (/^phase-NN/.test(val)) {
    v3check("phase-deps", `${specPath}: **Depends on:** still the template placeholder`);
    continue;
  }
  if (/^none\b/i.test(val)) {
    depGraph.set(n, []);
    continue;
  }
  const deps = [...val.matchAll(/phase-(\d+)/gi)].map((m) => Number(m[1]));
  if (deps.length === 0) {
    v3check("phase-deps", `${specPath}: **Depends on:** "${val.slice(0, 40)}" — use \`none\` or a phase-NN list`);
    continue;
  }
  if (n === 0) fail("phase-deps", "phase-00 must depend on `none` — the steel thread comes first");
  for (const d of deps)
    if (!phaseNums.includes(d))
      fail("phase-deps", `${specPath} depends on phase-${String(d).padStart(2, "0")} which doesn't exist`);
  depGraph.set(n, deps);
}
{
  // cycle detection — DFS with visiting/done states
  const state = new Map();
  const visit = (n, path) => {
    if (state.get(n) === 1) return;
    if (state.get(n) === 0) {
      fail("phase-deps", `dependency cycle: ${[...path, n].map((x) => `phase-${String(x).padStart(2, "0")}`).join(" → ")}`);
      return;
    }
    state.set(n, 0);
    for (const d of depGraph.get(n) || []) visit(d, [...path, n]);
    state.set(n, 1);
  };
  for (const n of depGraph.keys()) visit(n, []);
}

// ---------- 5. assumptions ledger: cap 7, every row has a trigger ----------
const asmRows = tableRows(section(secs, "assumptions"));
if (asmRows.length > 7) fail("assumptions", `${asmRows.length} entries — hard cap is 7`);
asmRows.forEach((r, i) => {
  const trigger = (r[1] || "").trim();
  if (!trigger || trigger.length < 8)
    fail("assumptions", `row ${i + 1} ("${(r[0] || "").slice(0, 40)}") has no falsification trigger — not an assumption, filler`);
  else if (isVague(trigger))
    warn("vague", `assumption trigger "${trigger.slice(0, 50)}" uses vague language — consider a verifiable token`);
});

// ---------- 6. pre-mortem: >=5 rows, each mitigated or accepted ----------
const pmRows = tableRows(section(secs, "pre-mortem"));
if (pmRows.length < 5) fail("pre-mortem", `${pmRows.length} rows — need top 5 failure causes`);
pmRows.forEach((r, i) => {
  if (!(r[2] || r[1] || "").trim())
    fail("pre-mortem", `row ${i + 1} has no mitigation / accepted-risk entry`);
});

// ---------- 7. external dependencies ----------
const depRows = tableRows(section(secs, "external dependencies"));
depRows.forEach((r) => {
  const dep = r[0] || "?";
  const cols = ["interface", "fake impl", "real impl", "contract test"];
  cols.forEach((c, i) => {
    if (!(r[i + 1] || "").trim()) fail("deps", `${dep}: "${c}" column empty`);
  });
});
if (depRows.length === 0)
  warn("deps", "External dependencies table empty — fine only if the build truly has none");

// ---------- 8. ADR index rows: matching files + [adr] reversibility + [spike] deferred ----------
const adrRows = tableRows(section(secs, "key decisions"));
const adrDir = join(root, "docs", "adr");
const adrFiles = existsSync(adrDir) ? readdirSync(adrDir) : [];
adrRows.forEach((r) => {
  const num = (r[0] || "").match(/\d{4}/)?.[0];
  if (!num) return;
  const file = adrFiles.find((f) => f.startsWith(num));
  if (!file) {
    fail("adr", `ADR ${num} in index but docs/adr/${num}-*.md not found`);
    return;
  }
  const adr = read(`docs/adr/${file}`);
  // [adr] reversibility (kickoff v3): every decision declares its door type
  const rev = adr.match(/\*\*Reversibility:\*\*\s*(one-way|two-way)\s*$/m);
  if (!rev) {
    v3check("adr", `ADR ${num}: missing/invalid **Reversibility:** — must be exactly \`one-way\` or \`two-way\`${isV3 ? "" : " (required from kickoff v3)"}`);
  } else if (rev[1] === "one-way") {
    const rt = adr.match(/\*\*Revisit trigger:\*\*\s*(.+)/);
    const rtVal = rt ? rt[1].trim() : "";
    if (!rtVal || rtVal.length < 8 || rtVal.startsWith("<"))
      v3check("adr", `ADR ${num}: one-way door without a real **Revisit trigger:** — one-way decisions must name what reopens them`);
  }
  // [spike] — DEFERRED ADRs must have a quarantined spike task in phase-00
  const statusLine = (adr.match(/\*\*Status:\*\*.*$/m) || [""])[0];
  if (/\bDEFERRED\b/.test(statusLine)) {
    const p0Path = "phases/phase-00-spec.md";
    const p0 = existsSync(join(root, p0Path)) ? read(p0Path) : "";
    if (!(/spike/i.test(p0) && p0.includes(num)))
      fail("spike", `ADR ${num} is DEFERRED but ${p0Path} has no spike task referencing ${num} — a deferred decision needs its scheduled spike (blocks Phase-0 close)`);
  }
});
if (adrRows.length === 0) fail("adr", "ADR index empty — no fork was resolved? Unlikely.");

// ---------- 9. kill criteria present under appetite ----------
if (!/kill|50%|scope-cut/i.test(section(secs, "appetite") || ""))
  fail("kill-criteria", "Appetite section has no kill criteria / 50% tripwire line");

// ---------- 10. current state: if present, must not be placeholder ----------
const curState = section(secs, "current state");
if (curState !== null && !hasContent(curState))
  warn("current-state", '"## Current state" present but empty/placeholder — fill it (brownfield) or delete the section (greenfield)');

// ---------- 11. retro-log present (pre-mortem seed source) ----------
if (!existsSync(join(root, "docs", "retro-log.md")))
  warn("retro-log", "docs/retro-log.md missing — pre-mortem has no history to seed (copy docs/templates/retro-log.md)");

// ---------- 12. PROGRESS.md exists with ## Now ----------
if (!existsSync(join(root, "PROGRESS.md"))) fail("progress", "PROGRESS.md not found");
else if (!/##\s*Now/i.test(read("PROGRESS.md"))) fail("progress", "PROGRESS.md missing '## Now' section");

report();

function report() {
  for (const w of warnings) console.log(`WARN  ${w}`);
  if (failures.length) {
    console.error(`\nkickoff-lint: ${failures.length} check(s) FAILED\n`);
    for (const f of failures) console.error(`FAIL  ${f}`);
    console.error("\nFix and rerun. Prose assurances don't count.");
    process.exit(1);
  }
  console.log("kickoff-lint: all checks passed ✔");
  process.exit(0);
}
