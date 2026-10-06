// seat-assign.mjs -- who sits a role, set from the face (face Phase 13, REQ-17, ADR-1352): org-own.mjs --assign.
// Pure checks on the card splice, then the command in a scratch repository committed on main. Prints
// "RAN seat-assign N checks, F failed"; exits 1 on any failure.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "../../.claude/scripts/engine/yaml-subset.mjs";
import { assignCard, parseAssignArgs, tierOfAgents } from "../../.claude/scripts/org/org-own.mjs";
import { chartModel, renderChart } from "../../.claude/scripts/org/org-catalog.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
let checks = 0;
let failed = 0;
const ok = (cond, what, detail = "") => { checks += 1; if (!cond) { failed += 1; console.log(`FAIL ${what}${detail ? ` -- ${String(detail).slice(0, 600)}` : ""}`); } };
const tmp = mkdtempSync(join(tmpdir(), "org-seat-"));
const refusal = (fn) => { try { fn(); return ""; } catch (e) { return String(e && e.message); } };

const card = (id, dept, seat, agents, tier, extra = "") => `# ${id} -- role card (fixture). Binds; never rewrites an agent file.
# Edit by hand; org-catalog --draft never overwrites an existing card.
id: '${id}'
title: '${id} title'
dept: '${dept}'
mission: 'A fixture mission.'
stages:
  - 'build'
seat: '${seat}'
origin: 'own'
hire: null
binds:
${agents.length ? `  agents:\n${agents.map((a) => `    - '${a}'`).join("\n")}` : "  agents: []"}
  skills: []
  scripts: []
  process: null
  tier: ${tier === null ? "null" : `'${tier}'`}
reports_to: 'ceo'
escalate_to: 'ceo'
e2: []
${extra}history: []
`;
const VACANT = card("seat-probe", "e-engineering", "vacant", [], null);

// ---- the card splice, pure ----
const r = assignCard(VACANT, { seat: "agent", agents: ["alpha", "gamma"], tier: "balanced-workhorse" });
const want = VACANT.replace("seat: 'vacant'", "seat: 'agent'").replace("  agents: []", "  agents:\n    - 'alpha'\n    - 'gamma'").replace("  tier: null", "  tier: 'balanced-workhorse'");
ok(r.text === want, "only seat, binds.agents and binds.tier change -- every other byte of the card is its own", r.text);
ok(r.was.seat === "vacant" && r.was.agents.length === 0 && r.was.tier === null, "the card's seat before the change is reported", JSON.stringify(r.was));
const back = assignCard(r.text, { seat: "vacant", agents: [], tier: null });
ok(back.text === VACANT, "vacating the seat again gives the original card back, byte for byte", back.text);
ok(/NOT_OWN/.test(refusal(() => assignCard(VACANT.replace("origin: 'own'", "origin: 'hired'"), { seat: "agent", agents: ["alpha"], tier: "balanced-workhorse" }))), "a hired card is refused NOT_OWN");
ok(/SEAT_BY_HAND/.test(refusal(() => assignCard(VACANT.replace("seat: 'vacant'", "seat: 'script'"), { seat: "agent", agents: ["alpha"], tier: "balanced-workhorse" }))), "a script seat is a hand edit");
ok(/SEAT_BINDS_DISAGREE/.test(refusal(() => assignCard(card("p", "e-engineering", "agent", ["alpha"], "balanced-workhorse").replace("  process: null", "  process: 'council-convene'"), { seat: "vacant", agents: [], tier: null }))), "vacating a seat that still binds a process is refused");
ok(/LEGITIMISED/.test(refusal(() => assignCard(card("p", "e-engineering", "agent", ["alpha"], "balanced-workhorse", "legitimacy: 'genesis'\nreview_by: '2026-12-01'\n"), { seat: "vacant", agents: [], tier: null }))), "vacating a legitimised seat is refused");
ok(/NOTHING_TO_CHANGE/.test(refusal(() => assignCard(VACANT, { seat: "vacant", agents: [], tier: null }))), "a change to what the card already says is refused");
const texts = new Map([["alpha", "---\nname: alpha\nmodel: sonnet\n---\n"], ["beta", "---\nname: beta\nmodel: haiku\n---\n"], ["loose", "---\nname: loose\n---\n"]]);
ok(tierOfAgents(["alpha"], texts) === "balanced-workhorse" && tierOfAgents(["beta"], texts) === "cheap-scan" && tierOfAgents(["loose"], texts) === "balanced-workhorse", "the tier is derived from each agent's own model, as org-catalog derives it");
ok(/TIER_MIXED/.test(refusal(() => tierOfAgents(["alpha", "beta"], texts))), "agents on two tiers are refused, never averaged");
ok(tierOfAgents([], texts) === null, "no agents, no tier");

// ---- the arguments ----
const args = (...a) => refusal(() => parseAssignArgs(["--assign", ...a]));
ok(/--tier is not taken/.test(args("--role", "x", "--seat", "agent", "--agents", "alpha", "--tier", "high-judgment", "--dry-run")), "a typed tier is refused: the tier follows the agents (ADR-0069)");
ok(/SEAT_BINDS_DISAGREE/.test(args("--role", "x", "--seat", "vacant", "--agents", "alpha", "--dry-run")), "a vacant seat with agents is refused");
ok(/SEAT_BINDS_DISAGREE/.test(args("--role", "x", "--seat", "agent", "--dry-run")), "an agent seat with no agents is refused");
ok(/only agent or vacant/.test(args("--role", "x", "--seat", "human", "--dry-run")), "any other seat is refused");
ok(/not an agent name/.test(args("--role", "x", "--seat", "agent", "--agents", "alpha, beta", "--dry-run")), "a spaced or malformed agent list is refused");
ok(/reads as a model name/.test(args("--role", "x", "--seat", "agent", "--agents", "claude-helper", "--dry-run")), "an agent named like a model is refused (org-coverage's MODEL_RE)");
ok(/names an agent twice/.test(args("--role", "x", "--seat", "agent", "--agents", "alpha,alpha", "--dry-run")), "an agent named twice is refused");
ok(/given twice/.test(args("--role", "x", "--role", "y", "--seat", "vacant", "--dry-run")), "a flag given twice is refused");

// ---- the command, in a scratch repository committed on main ----
const repo = join(tmp, "repo");
cpSync(join(REPO, ".claude", "scripts"), join(repo, ".claude", "scripts"), { recursive: true });
const put = (p, text) => { mkdirSync(dirname(join(repo, p)), { recursive: true }); writeFileSync(join(repo, p), text); };
for (const [n, t] of [["alpha", texts.get("alpha")], ["gamma", "---\nname: gamma\nmodel: sonnet\n---\n"], ["beta", texts.get("beta")]]) put(`.claude/agents/${n}.md`, t);
const cards = [
  ["e-engineering", VACANT],
  ["e-engineering", card("staffed-probe", "e-engineering", "agent", ["alpha"], "balanced-workhorse")],
  ["e-engineering", card("dup-role", "e-engineering", "vacant", [], null)],
  ["d-product", card("dup-role", "d-product", "vacant", [], null)],
  ["d-product", card("beta-home", "d-product", "agent", ["beta"], "cheap-scan")],
];
for (const [d, t] of cards) put(`org/roles/${d}/${/id: '([^']+)'/.exec(t)[1]}.role.yaml`, t);
const model = chartModel({ cards: cards.map(([, t]) => ({ card: parseYamlSubset(t).value })) });
put("org/CHART.md", renderChart(model));
put("org/chart.json", JSON.stringify(model, null, 2) + "\n");
const g = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
g("init", "-q", "-b", "main");
g("config", "user.name", "fixture"); g("config", "user.email", "fixture@example.invalid"); g("config", "commit.gpgsign", "false"); g("config", "core.autocrlf", "false");
g("add", "-A"); g("commit", "-q", "-m", "scratch");
const mainBefore = g("rev-parse", "refs/heads/main").stdout.trim();
ok(/^[0-9a-f]{40}$/.test(mainBefore), "scratch repository committed on main (vacuous-pass guard)");
const spine = join(tmp, "spine");
mkdirSync(join(spine, "events"), { recursive: true });
const events = () => readdirSync(join(spine, "events")).filter((n) => n.endsWith(".jsonl"))
  .flatMap((n) => readFileSync(join(spine, "events", n), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const branches = () => g("for-each-ref", "--format=%(refname:short)", "refs/heads/").stdout.split("\n").filter(Boolean);
const clean = () => g("status", "--porcelain").stdout === "" && g("rev-parse", "refs/heads/main").stdout.trim() === mainBefore;
const tool = (...a) => spawnSync(process.execPath, [join(repo, ".claude", "scripts", "org", "org-own.mjs"), "--assign", ...a],
  { cwd: repo, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: spine }, timeout: 120_000 });

for (const [a, re, what] of [
  [["--role", "seat-probe", "--seat", "agent", "--agents", "nobody"], /NO_AGENT/, "an agent with no .claude/agents file"],
  [["--role", "dup-role", "--seat", "agent", "--agents", "alpha"], /DUPLICATE_ID/, "a card id held by two departments"],
  [["--role", "staffed-probe", "--seat", "vacant"], /ORPHAN_AGENT/, "a change that leaves an agent in no role"],
  [["--role", "seat-probe", "--seat", "agent", "--agents", "alpha,beta"], /TIER_MIXED/, "agents on two tiers"],
  [["--role", "no-such-role", "--seat", "vacant"], /NO_ROLE/, "a role with no card"],
]) {
  const x = tool(...a, "--dry-run");
  ok(x.status === 2 && re.test(x.stderr), `the command refuses ${what}`, `${x.status} ${x.stderr}`);
}
ok(branches().length === 1 && events().length === 0 && clean(), "no refusal wrote a branch, an event or the checkout", branches().join(","));

const plan = tool("--role", "seat-probe", "--seat", "agent", "--agents", "alpha,gamma", "--dry-run");
ok(plan.status === 0 && /would set role seat-probe: seat vacant -> agent \(alpha, gamma\); tier none -> balanced-workhorse/.test(plan.stdout), "the seat plans, naming the derived tier", `${plan.status} ${plan.stderr}`);
ok(branches().length === 1 && events().length === 0 && clean(), "the plan wrote nothing");
let expect = null;
try { expect = JSON.parse(plan.stdout.trim().split(/\r?\n/).pop()).expect; } catch { /* checked below */ }
ok(/^[0-9a-f]{64}$/.test(expect || ""), "the plan ends with its digest");
const stale = tool("--role", "seat-probe", "--seat", "agent", "--agents", "alpha", "--expect", expect || "");
ok(stale.status === 2 && branches().length === 1 && events().length === 0, "an apply whose plan differs from the one read is refused", `${stale.status} ${stale.stderr}`);
const ap = tool("--role", "seat-probe", "--seat", "agent", "--agents", "alpha,gamma", "--expect", expect || "");
ok(ap.status === 0 && /receipt: approval.requested [0-9A-HJKMNP-TV-Z]{26}/.test(ap.stdout), "the apply writes the branch and raises the approval", `${ap.status} ${ap.stdout} ${ap.stderr}`);
const branch = "feat/face-org-seat-seat-probe";
ok(branches().includes(branch) && clean(), "the branch exists; the checkout and main are untouched", branches().join(","));
const changed = g("diff", "--name-only", `main...${branch}`).stdout.split("\n").filter(Boolean).sort();
ok(JSON.stringify(changed) === JSON.stringify(["org/CHART.md", "org/chart.json", "org/roles/e-engineering/seat-probe.role.yaml"]), "the branch changes ONE card and the chart rendered from it, nothing else", changed.join(","));
ok(g("show", `${branch}:org/roles/e-engineering/seat-probe.role.yaml`).stdout === want, "the branch's card is the original with only seat and binds changed");
const after = chartModel({ cards: cards.map(([, t]) => ({ card: parseYamlSubset(t === VACANT ? want : t).value })) });
ok(g("show", `${branch}:org/chart.json`).stdout === JSON.stringify(after, null, 2) + "\n", "the branch's chart is exactly what its cards render (org-chart stays green)");
const appr = events().filter((e) => e.kind === "approval.requested");
ok(appr.length === 1 && appr[0].payload.gate === "org-seat" && appr[0].payload.adr === "ADR-1352" && appr[0].payload.tier === "balanced-workhorse"
  && JSON.stringify(appr[0].payload.agents) === JSON.stringify(["alpha", "gamma"]) && appr[0].payload.role === "seat-probe", "one approval, gated org-seat, the tier derived", JSON.stringify(appr.map((e) => e.payload)));
const second = tool("--role", "staffed-probe", "--seat", "agent", "--agents", "alpha,gamma", "--dry-run");
ok(second.status === 2 && /already open/.test(second.stderr), "a second seat proposal is refused while one is open (both rewrite the chart)", `${second.status} ${second.stderr}`);
const again = tool("--role", "seat-probe", "--seat", "agent", "--agents", "alpha,gamma", "--dry-run");
ok(again.status === 2 && events().length === 1, "the same change is not requested twice", `${again.status} ${again.stderr}`);
ok(existsSync(join(spine, "events")), "the spine the tool wrote is the one this fixture reads (vacuous-pass guard)");

console.log(`RAN seat-assign ${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
