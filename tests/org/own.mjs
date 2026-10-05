// own.mjs -- hire-to-own: a hired seat becomes an own agent in one branch (org Cycle 20 Phase 03, REQ-05, ADR-1629).
// A scratch repository committed on main with one HIRED card; prints "RAN own N checks"; exits 1 on any failure.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "../../.claude/scripts/engine/yaml-subset.mjs";
import { ownCard } from "../../.claude/scripts/org/org-own.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
let checks = 0;
let failed = 0;
const ok = (cond, what, detail = "") => { checks += 1; if (!cond) { failed += 1; console.log(`FAIL ${what}${detail ? ` -- ${String(detail).slice(0, 600)}` : ""}`); } };
const tmp = mkdtempSync(join(tmpdir(), "org-own-"));

const HIRED = `# A hired seat (fixture).
id: 'probe-role'
title: 'Probe role'
dept: 'e-engineering'
mission: 'Read a diff and name its riskiest hunk.'
stages:
  - 'build'
seat: 'agent'
origin: 'hired'
hire:
  runtime: 'hermes'
  source: 'registry:probe-skill@1.0.0'
  vetted_by: 'capability-scout'
binds:
  agents:
    - 'code-reviewer'
  skills: []
  scripts: []
  process: null
  tier: 'cheap-scan'
reports_to: 'solution-architect'
escalate_to: 'solution-architect'
e2: []
history: []
`;
const OWN = HIRED.replace("origin: 'hired'", "origin: 'own'").replace(/hire:\n(  .*\n)+/, "hire: null\n");
const NO_TIER = HIRED.replace("  tier: 'cheap-scan'\n", "");

// ---- the card rewrite, pure ----
const r = ownCard(HIRED, "probe-agent", "2026-10-05");
const v = parseYamlSubset(r.text).value;
ok(v.origin === "own" && v.hire === null, "origin own, hire null", r.text);
ok(JSON.stringify(v.binds.agents) === JSON.stringify(["probe-agent", "code-reviewer"]), "the new agent is first in binds.agents", JSON.stringify(v.binds.agents));
ok(v.history.length === 1 && v.history[0].includes("hermes:registry:probe-skill@1.0.0") && v.history[0].includes("probe-agent"), "one history line names the replaced hire", JSON.stringify(v.history));
ok(r.tier === "cheap-scan" && r.text.startsWith("# A hired seat (fixture)."), "tier read from the card; comments kept");
const refusal = (text, name = "probe-agent") => { try { ownCard(text, name, "2026-10-05"); return null; } catch (e) { return String(e.message); } };
ok(/NOT_HIRED/.test(refusal(OWN) || ""), "an own card is refused NOT_HIRED");
ok(/NO_TIER/.test(refusal(NO_TIER) || ""), "a card with no tier is refused NO_TIER");
ok(/ALREADY_BOUND/.test(refusal(HIRED, "code-reviewer") || ""), "an agent the card already binds is refused");

// ---- the command, in a scratch repository committed on main ----
const repo = join(tmp, "repo");
cpSync(join(REPO, ".claude", "scripts"), join(repo, ".claude", "scripts"), { recursive: true });
const files = ["engine/router.yaml", "tests/fixtures/sync-golden/tree-manifest.txt", "initiatives/face/contracts/expected-set.json",
  "initiatives/face/contracts/rooms.generated.json", "initiatives/face/contracts/room-copy.json",
  ...readdirSync(join(REPO, "products")).filter((p) => existsSync(join(REPO, "products", p, "manifest.json"))).map((p) => `products/${p}/manifest.json`)];
for (const p of files) { mkdirSync(dirname(join(repo, p)), { recursive: true }); writeFileSync(join(repo, p), readFileSync(join(REPO, p))); }
mkdirSync(join(repo, "org", "roles", "e-engineering"), { recursive: true });
writeFileSync(join(repo, "org", "roles", "e-engineering", "probe-role.role.yaml"), HIRED);
writeFileSync(join(repo, "org", "roles", "e-engineering", "own-role.role.yaml"), OWN.replace("id: 'probe-role'", "id: 'own-role'"));
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
const tool = (...args) => spawnSync(process.execPath, [join(repo, ".claude", "scripts", "org", "org-own.mjs"), ...args],
  { cwd: repo, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: spine }, timeout: 120_000 });
const A = (role = "probe-role", name = "probe-agent") => ["--role", role, "--name", name, "--description", "Reads a diff and names its riskiest hunk",
  "--tools", "Read, Grep", "--room", "review-ship", "--product", "review"];

let x = tool(...A("own-role"), "--dry-run");
ok(x.status === 2 && /NOT_HIRED/.test(x.stderr), "the command refuses an own card", `${x.status} ${x.stderr}`);
x = tool(...A(), "--tier", "cheap-scan", "--dry-run");
ok(x.status === 2 && /--tier is not taken/.test(x.stderr), "a typed tier is refused", x.stderr);
x = tool(...A(), "--role", "probe-role", "--dry-run");
ok(x.status === 2 && /given twice/.test(x.stderr), "a flag given twice is refused", x.stderr);
x = tool(...A("probe-role", "code-reviewer"), "--dry-run");
ok(x.status === 2, "an agent name already bound or on main is refused", x.stderr);
ok(branches().length === 1 && events().length === 0 && clean(), "no refusal wrote a branch, an event or the checkout");

const plan = tool(...A(), "--dry-run");
ok(plan.status === 0 && /would turn the hired seat of probe-role into the own agent "probe-agent"/.test(plan.stdout), "the rewrite plans", `${plan.status} ${plan.stderr}`);
let expect = null;
try { expect = JSON.parse(plan.stdout.trim().split(/\r?\n/).pop()).expect; } catch { /* checked below */ }
ok(/^[0-9a-f]{64}$/.test(expect || ""), "the plan ends with its digest");
const ap = tool(...A(), "--expect", expect || "");
ok(ap.status === 0 && /receipt: approval.requested [0-9A-HJKMNP-TV-Z]{26}/.test(ap.stdout), "the apply writes the branch and raises the approval", `${ap.status} ${ap.stdout} ${ap.stderr}`);
const branch = "feat/face-org-own-probe-agent";
ok(branches().includes(branch) && clean(), "the branch exists; the checkout and main are untouched", branches().join(","));
const changed = g("diff", "--name-only", `main...${branch}`).stdout.split("\n").filter(Boolean).sort();
for (const p of [".claude/agents/probe-agent.md", "org/roles/e-engineering/probe-role.role.yaml", "products/review/manifest.json",
  "tests/fixtures/sync-golden/tree-manifest.txt", "initiatives/face/contracts/expected-set.json"]) ok(changed.includes(p), `the branch holds ${p}`, changed.join(","));
const card = parseYamlSubset(g("show", `${branch}:org/roles/e-engineering/probe-role.role.yaml`).stdout).value;
ok(card.origin === "own" && card.hire === null && card.binds.agents[0] === "probe-agent", "the branch's card is own, first agent the new one");
ok(/^model: /m.test(g("show", `${branch}:.claude/agents/probe-agent.md`).stdout), "the agent file carries the tier's model from the router");
const appr = events().filter((e) => e.kind === "approval.requested");
ok(appr.length === 1 && appr[0].payload.gate === "hire-to-own" && appr[0].payload.adr === "ADR-1629" && appr[0].payload.tier === "cheap-scan" && appr[0].payload.role === "probe-role",
  "one approval, gated hire-to-own, tier from the card", JSON.stringify(appr.map((e) => e.payload)));

console.log(`RAN own ${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
