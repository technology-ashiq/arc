#!/usr/bin/env node
/**
 * kickoff-lint — deterministic gate for /arc-kickoff, /arc-change and /arc-phase-done.
 * Zero deps. Exit 0 = plan structurally complete; exit 1 = named failures listed.
 *
 * v3 check groups: [tier] [adr] [spike] [phase-deps]. A plan is "v3" when PLAN.md has a
 * `**Tier:**` line under Appetite — plans written before v3 get WARNs (grandfathered),
 * v3 plans get hard FAILs. New kickoffs always write the Tier line, so v3 is strict.
 *
 * v3.5 substance groups: [pre-mortem-cite] [appetite-sum] [adr-wired] [adr-confidence]
 * [architecture] [current-state-structure] [nonneg-drift] — plus the G4 multi-phase fix
 * in [reqs]. These raise the substance FLOOR; they do not guarantee substance (a
 * determined author can still write "scope creep on REQ-03"). Honest limits stay honest.
 *
 * v4 substance group: [verify-red] — Phase 0 (and any already-detailed Phase 1) verification
 * must name a Test command + an Expected-failure-first line (red before green). WARN-first.
 *
 * WARN-FIRST TRIAL: every v3.5 substance group starts in TRIAL (always WARN, even on v3
 * plans). Promotion to FAIL = remove the group from the TRIAL set below after a build's
 * retro has judged the gate useful. One line per promotion, auditable in git. v4 F1 makes
 * that promotion evidence-driven (fixture-proven + >=3 clean dogfood runs, logged in
 * docs/trial-ledger.md) and prints a [trial-status] footer of live-vs-trial counts.
 *
 * NOTE: the vague-acceptance gate and placeholder detection are HEURISTICS — they catch
 * common failure shapes, not all of them. A pass is structural, not a quality guarantee.
 * Usage: node .claude/scripts/plan/kickoff-lint.mjs [repo-root]
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || ".";
const failures = [];
const warnings = [];
const fail = (check, msg) => failures.push(`[${check}] ${msg}`);
const warn = (check, msg) => warnings.push(`[${check}] ${msg}`);
let trialStatusLine = ""; // v4 F1: set once TRIAL/SUBSTANCE are known; printed by report()

// ---------- helpers ----------
const read = (p) => readFileSync(join(root, p), "utf8");
const pad = (n) => String(n).padStart(2, "0");
const normLine = (l) => l.replace(/\s+/g, " ").trim();

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
// What each section is FOR, in one line. A gate that only says "missing" makes the operator
// guess -- and four of these became required on 2026-07-11, so a plan written before that fails
// here through no fault of its author, who never touched the file. Found by dogfooding into a
// real consumer (Phase 04). On a solo project there is nobody to ask, so the message carries the fix.
const SECTION_HELP = {
  "success requirements":
    "one REQ row per measurable outcome — `| REQ-01 | outcome | how you'd verify it | phase | active |`. Without it no phase has a definition of done",
  assumptions:
    "what the plan is betting on, and the trigger that would tell you the bet is wrong",
  "external dependencies":
    "every service or API the build leans on, each with an interface + fake so the build runs offline",
  "non-negotiables": "the rules that hold even when the schedule slips",
  "pre-mortem": "how this build fails, written before it does",
};
for (const name of required) {
  const body = section(secs, name);
  const why = SECTION_HELP[name] ? ` — ${SECTION_HELP[name]}` : "";
  const from = " Copy the block from docs/templates/PLAN-template.md.";
  if (body === null) fail("sections", `missing "## ${name}" section${why}.${from}`);
  else if (!hasContent(body)) fail("sections", `"## ${name}" is empty or placeholder${why}.${from}`);
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

// v3.5 WARN-first trial set — remove a group to promote it to the v3check path (FAIL on
// v3 plans). Promote only after /arc-retro reviews the gate's first-build usefulness.
const TRIAL = new Set([
  "pre-mortem-cite", "appetite-sum", "adr-wired", "adr-confidence",
  "architecture", "current-state-structure", "nonneg-drift", "verify-red",
]);
const gate = (group, msg) => (TRIAL.has(group) ? warn(group, `${msg} [trial]`) : v3check(group, msg));

// v4 F1: the full substance-gate set (superset of TRIAL). A group leaves TRIAL — becomes a
// real FAIL-capable gate — only when /arc-retro promotes it against docs/trial-ledger.md
// (fixture-proven + >=3 clean dogfood runs, zero false-positives). Promotion removes the
// group from TRIAL but keeps it here, so the footer counts it as live.
const SUBSTANCE = new Set([
  "pre-mortem-cite", "appetite-sum", "adr-wired", "adr-confidence",
  "architecture", "current-state-structure", "nonneg-drift", "verify-red",
]);
trialStatusLine =
  `[trial-status] ${[...SUBSTANCE].filter((g) => !TRIAL.has(g)).length} substance gate(s) live, ` +
  `${TRIAL.size} in trial — promote via /arc-retro (criteria: docs/trial-ledger.md)`;

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
if (reqRows.length === 0)
  fail(
    "reqs",
    "no REQ rows in Success requirements table — add one row per measurable outcome, e.g. `| REQ-01 | a user can X | acceptance you could run | 1 | active |`. A phase with no REQ has nothing to close against. See docs/templates/PLAN-template.md."
  );
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
  // v3.5 G4: exactly ONE phase per REQ — match ALL integers, not just the first.
  const ms = phase.match(/\d+/g);
  if (!ms) fail("reqs", `${id} has no phase mapping`);
  else if (ms.length > 1) fail("reqs", `${id} maps to ${ms.length} phases (${ms.join(", ")}) — every REQ maps to exactly one phase`);
  else reqPhases.add(Number(ms[0]));
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
const nextCycle = new Set();
for (const r of phaseRows) {
  const m = (r[0] || "").match(/\d+/);
  if (!m) continue;
  const n = Number(m[0]);
  phaseNums.push(n);
  if (/next cycle|parked/i.test(r.join(" "))) nextCycle.add(n);
  const specPath = `phases/phase-${pad(n)}-spec.md`;
  if (!existsSync(join(root, specPath))) fail("phases", `${specPath} missing (phase ${n})`);
  if (n > 0 && !reqPhases.has(n))
    fail(
      "phases",
      `phase ${n} serves no active/validated REQ — phase without a goal. Either point some REQ's phase column at ${n}, or mark the phase CUT if it is no longer in scope.`
    );
}
if (!phaseNums.includes(0)) fail("phase0", "no Phase 0 (steel thread) in Phases table");
for (const p of reqPhases)
  if (!phaseNums.includes(p)) fail("reqs", `REQ maps to phase ${p} which doesn't exist`);

// ---------- 4b. phase dependency lines (kickoff v3): exist, valid refs, no cycles ----------
const specTexts = new Map(); // n -> spec file text (reused by v3.5 checks)
const depGraph = new Map();
for (const n of phaseNums) {
  const specPath = `phases/phase-${pad(n)}-spec.md`;
  if (!existsSync(join(root, specPath))) continue; // missing spec already failed above
  const spec = read(specPath);
  specTexts.set(n, spec);
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
      fail("phase-deps", `${specPath} depends on phase-${pad(d)} which doesn't exist`);
  depGraph.set(n, deps);
}
{
  // cycle detection — DFS with visiting/done states
  const state = new Map();
  const visit = (n, path) => {
    if (state.get(n) === 1) return;
    if (state.get(n) === 0) {
      fail("phase-deps", `dependency cycle: ${[...path, n].map((x) => `phase-${pad(x)}`).join(" → ")}`);
      return;
    }
    state.set(n, 0);
    for (const d of depGraph.get(n) || []) visit(d, [...path, n]);
    state.set(n, 1);
  };
  for (const n of depGraph.keys()) visit(n, []);
}

// ---------- 4c. appetite arithmetic (v3.5 G3) — 1 week = 5 working days ----------
{
  const parseApp = (text) => {
    const m = (text || "").match(/(\d+(?:\.\d+)?)\s*(day|week)s?\b/i);
    return m ? Number(m[1]) * (/week/i.test(m[2]) ? 5 : 1) : null;
  };
  const totalDays = parseApp(appetiteBody);
  if (totalDays === null)
    warn("appetite-sum", "PLAN Appetite has no parseable `<N> days|weeks` — arithmetic skipped (never a FAIL)");
  else {
    let sumDays = 0;
    const unparsed = [];
    for (const [n, spec] of specTexts) {
      if (nextCycle.has(n)) continue; // next-cycle/parked phases don't count against this cycle
      const line = (spec.match(/\*\*Appetite:\*\*\s*(.+)/) || [, ""])[1];
      const d = parseApp(line);
      if (d === null) unparsed.push(`phase-${pad(n)}`);
      else sumDays += d;
    }
    if (unparsed.length)
      warn("appetite-sum", `unparseable phase appetites skipped: ${unparsed.join(", ")}`);
    if (sumDays > totalDays)
      gate("appetite-sum", `phase appetites sum to ${sumDays}d > total ${totalDays}d (1w=5d) — the plan over-commits; cut or re-scope`);
    else if (sumDays > 0.8 * totalDays)
      warn("appetite-sum", `phase appetites sum to ${sumDays}d = ${Math.round((100 * sumDays) / totalDays)}% of ${totalDays}d total — zero slack is its own fiction`);
  }
}

// ---------- 5. assumptions ledger: cap 7, every row has a trigger ----------
const asmBody = section(secs, "assumptions") || "";
const asmRows = tableRows(asmBody);
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
  // mitigation = col 3 in the (# | cause | mitigation) template; col 2 in 2-col tables.
  // (v3.5 G1 fixture exposed the old r[2]||r[1] fallback as a hole: a blanked mitigation
  // cell passed because the CAUSE cell was non-empty.)
  const mit = ((r.length >= 3 ? r[2] : r[1]) || "").trim();
  if (!mit)
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
const nonnegBody = section(secs, "non-negotiables") || "";
const adrNums = [];
adrRows.forEach((r) => {
  const num = (r[0] || "").match(/\d{4}/)?.[0];
  if (!num) return;
  adrNums.push(num);
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
  // [adr-wired] (v3.5 G6): a decision nobody consumes is decoration
  const wired = [...specTexts.values()].some((t) => t.includes(num)) || nonnegBody.includes(num);
  if (!wired)
    gate("adr-wired", `ADR ${num} is never consumed — cite it in ≥1 phase spec or in ## Non-negotiables`);
  // [adr-confidence] (v3.5 G8): low-confidence decisions must be tracked as assumptions
  if (/\*\*Confidence:\*\*\s*low\b/i.test(adr) && !asmBody.includes(num))
    gate("adr-confidence", `ADR ${num} has Confidence: low but no Assumptions-ledger row cites it — research it, spike it, or accept it explicitly`);
});
if (adrRows.length === 0) fail("adr", "ADR index empty — no fork was resolved? Unlikely.");

// ---------- 8b. pre-mortem must cite THIS plan (v3.5 G2) ----------
{
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const depNames = depRows.map((r) => (r[0] || "").split(/[\s(]/)[0]).filter((w) => w.length > 2);
  const cites = (t) =>
    /REQ-\d+/i.test(t) ||
    /phase[- ]?\d+/i.test(t) ||
    adrNums.some((n) => t.includes(n)) ||
    depNames.some((d) => new RegExp(`\\b${esc(d)}\\b`, "i").test(t));
  const nonCiting = pmRows.filter((r) => !cites(r.join(" ")));
  if (pmRows.length >= 5 && nonCiting.length > 1)
    gate("pre-mortem-cite", `pre-mortem looks generic — ${nonCiting.length} of ${pmRows.length} rows reference nothing in this plan (no REQ / phase N / ADR / dep name); max 1 plan-external row`);
}

// ---------- 8c. architecture diagram syntax (v3.5 G5) — family check, not correctness ----------
{
  const archBody = section(secs, "architecture") || "";
  const fence = archBody.match(/```mermaid([\s\S]*?)```/);
  if (!fence) gate("architecture", "## Architecture has no ```mermaid fence");
  else if (/C4Context|C4Container/.test(fence[1]))
    gate("architecture", "experimental C4 syntax (C4Context/C4Container) — use a plain flowchart with C4 vocabulary");
  else if (!/flowchart/.test(fence[1]))
    gate("architecture", "mermaid block is not a `flowchart`");
}

// ---------- 8d. non-negotiables verbatim blocks (v3.5 G7) — copies must not drift ----------
{
  const planBullets = nonnegBody.split("\n").filter((l) => /^\s*-\s+/.test(l)).map(normLine);
  if (planBullets.length > 0) {
    for (const [n, txt] of specTexts) {
      const m = txt.match(/##\s*Non-negotiables \(verbatim from PLAN\)([\s\S]*?)(?=\n##\s|$)/);
      if (!m) {
        gate("nonneg-drift", `phase-${pad(n)}-spec.md: missing "## Non-negotiables (verbatim from PLAN)" block — context-isolated executors never see PLAN`);
        continue;
      }
      const specBullets = m[1].split("\n").filter((l) => /^\s*-\s+/.test(l)).map(normLine);
      if (planBullets.length !== specBullets.length || planBullets.some((b, i) => b !== specBullets[i]))
        gate("nonneg-drift", `phase-${pad(n)}-spec.md: Non-negotiables block drifted from PLAN — resync (a stale copy lies; /arc-change resyncs on every PLAN nonneg change)`);
    }
  }
}

// ---------- 8e. expected-fail-first named for Phase 0–1 (v4 H1) ----------
// Phase 0 (steel thread) MUST name a red-first test at kickoff. Phase 1 is gated only once
// it has been detailed (a Test command present) — a coarse "refine when the phase starts"
// line stays legal at kickoff, refined later via /arc-change. WARN-first (TRIAL).
for (const vn of [0, 1]) {
  const vspec = specTexts.get(vn);
  if (!vspec) continue; // a missing spec already failed in [phases]
  const vm = vspec.match(/##\s*Verification plan([\s\S]*?)(?=\n##\s|$)/i);
  const vbody = vm ? vm[1] : "";
  const filled = (label) => {
    const m = vbody.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, "i"));
    const val = m ? m[1].trim() : "";
    return val && !/^[(<]/.test(val) ? val : ""; // reject template placeholders (…) / <…>
  };
  const hasTestCmd = !!filled("Test command");
  const hasRed = !!filled("Expected failure first");
  if (!(vn === 0 || hasTestCmd)) continue; // phase-1 coarse line is legal at kickoff
  if (!hasTestCmd)
    gate("verify-red", `phase-${pad(vn)}-spec.md: Verification plan names no concrete **Test command:** — Phase 0 needs a real test before code`);
  else if (!hasRed)
    gate("verify-red", `phase-${pad(vn)}-spec.md: Verification plan has no **Expected failure first:** — name the test that fails RED before this phase is built`);
}

// ---------- 9. kill criteria present under appetite ----------
if (!/kill|50%|scope-cut/i.test(appetiteBody))
  fail("kill-criteria", "Appetite section has no kill criteria / 50% tripwire line");

// ---------- 10. current state: if present, must not be placeholder; v3.5 G9 structure ----------
const curState = section(secs, "current state");
if (curState !== null && !hasContent(curState))
  warn("current-state", '"## Current state" present but empty/placeholder — fill it (brownfield) or delete the section (greenfield)');
if (curState !== null && hasContent(curState)) {
  for (const label of ["Stack", "Entry points", "Conventions", "Do-not-touch"])
    if (!new RegExp(`${label}\\s*:`, "i").test(curState))
      gate("current-state-structure", `## Current state missing "${label}:" line (codebase-surveyor output contract)`);
}

// ---------- 11. retro-log present (pre-mortem seed source) ----------
if (!existsSync(join(root, "docs", "retro-log.md")))
  warn("retro-log", "docs/retro-log.md missing — pre-mortem has no history to seed (copy docs/templates/retro-log.md)");

// ---------- 12. PROGRESS.md exists with ## Now ----------
if (!existsSync(join(root, "PROGRESS.md"))) fail("progress", "PROGRESS.md not found");
else if (!/##\s*Now/i.test(read("PROGRESS.md"))) fail("progress", "PROGRESS.md missing '## Now' section");

report();

function report() {
  for (const w of warnings) console.log(`WARN  ${w}`);
  if (trialStatusLine) console.log(trialStatusLine);
  if (failures.length) {
    console.error(`\nkickoff-lint: ${failures.length} check(s) FAILED\n`);
    for (const f of failures) console.error(`FAIL  ${f}`);
    console.error("\nFix and rerun. Prose assurances don't count.");
    process.exit(1);
  }
  console.log("kickoff-lint: all checks passed ✔");
  process.exit(0);
}
