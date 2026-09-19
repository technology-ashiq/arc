#!/usr/bin/env node
// company-work.mjs -- the company ring's work verbs, APPLIED in scratch (face v2 Phase 05 PR 5b, ADR-1343).
//
//   lane-status     a lane's PROGRESS header and its board row on one proposal branch, and approval.requested
//                   (gate lane-status); board-lint finds no drift on the branch, and does find a header-only edit
//   concept-define  the contract's concepts.map with the term homed (and what it derives) on a proposal branch, and
//                   approval.requested (gate concept-define)
//
// Every run uses a scratch spine and a scratch repository whose main is checked unmoved. VACUOUS-PASS GUARD: each plan
// is proven to print a digest, board-lint is proven to have run, and the last line is "RAN: <n> checks".

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const ZERO = "0".repeat(64);
const DASH = "—";

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};
const tmp = mkdtempSync(join(tmpdir(), "face-company-work-"));
const spine = (name) => { const d = join(tmp, name); mkdirSync(join(d, "events"), { recursive: true }); return d; };
const spineEvents = (root) => readdirSync(join(root, "events")).filter((n) => n.endsWith(".jsonl")).sort()
  .flatMap((n) => readFileSync(join(root, "events", n), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const lastLine = (out) => String(out).trim().split(/\r?\n/).pop() || "";
const lastExpect = (out) => { try { const j = JSON.parse(lastLine(out)); return typeof j.expect === "string" && /^[0-9a-f]{64}$/.test(j.expect) ? j.expect : null; } catch { return null; } };
const node = (args, env = {}, cwd = REPO) => spawnSync(process.execPath, args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, timeout: 120_000 });

// ---- one scratch repository: the files both tools read on main, committed ----
const repo = join(tmp, "company-repo");
cpSync(join(REPO, ".claude", "scripts"), join(repo, ".claude", "scripts"), { recursive: true });
const files = ["PORTFOLIO.md", "initiatives/face/PROGRESS.md", "initiatives/face/contracts/expected-set.json", "initiatives/face/contracts/room-copy.json", "initiatives/face/contracts/rooms.generated.json"];
for (const p of readdirSync(join(REPO, "products"))) if (existsSync(join(REPO, "products", p, "manifest.json"))) files.push(`products/${p}/manifest.json`);
for (const p of files) { mkdirSync(dirname(join(repo, p)), { recursive: true }); writeFileSync(join(repo, p), readFileSync(join(REPO, p))); }
const g = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
g("init", "-q", "-b", "main");
g("config", "user.name", "fixture"); g("config", "user.email", "fixture@example.invalid"); g("config", "commit.gpgsign", "false"); g("config", "core.autocrlf", "false");
g("add", "-A"); g("commit", "-q", "-m", "scratch");
const mainBefore = g("rev-parse", "refs/heads/main").stdout.trim();
const clean = () => g("status", "--porcelain").stdout === "" && g("rev-parse", "refs/heads/main").stdout.trim() === mainBefore;
check("fixture: the scratch repository is committed on main (vacuous-pass guard)", /^[0-9a-f]{40}$/.test(mainBefore));
const faceStatus = readFileSync(join(repo, "initiatives", "face", "PROGRESS.md"), "utf8").match(/^status: (\S+)$/m);
check("fixture: the face lane's header carries a status on main", !!faceStatus, "no status: line");
// A status the face lane does not have on main, so the change is a change.
const to = faceStatus && faceStatus[1] === "IDLE" ? "QUEUED" : "IDLE";

/** board-lint's WARN lines naming the face lane, and whether it ran at all (it prints for the rows this repo lacks). */
const boardLint = () => {
  const r = spawnSync("bash", [join(repo, ".claude", "scripts", "core", "board-lint.sh").replace(/\\/g, "/"), "--root", repo.replace(/\\/g, "/")], { cwd: repo, encoding: "utf8" });
  const warns = String(r.stdout || "").split(/\r?\n/).filter((l) => l.startsWith("WARN"));
  return { ran: r.status === 0 && warns.length > 0, face: warns.filter((l) => l.includes("`face`")) };
};

// ---- lane-status ----
{
  const sp = spine("status-spine");
  const ls = (...a) => node([join(repo, ".claude", "scripts", "core", "lane-status.mjs"), ...a], { ARC_SPINE_ROOT: sp }, repo);
  const before = boardLint();
  check("board-lint ran on the scratch main, and names no drift in the face lane (vacuous-pass guard)", before.ran && before.face.length === 0, before.face.join(" | "));

  for (const [why, args, re] of [
    ["BLOCKED with no blocker", ["--lane", "face", "--status", "BLOCKED"], /names what blocks the lane/],
    ["a blocker on a status that clears it", ["--lane", "face", "--status", to, "--blocked-on", `owner ${DASH} a reason`], /belongs with BLOCKED/],
    ["a blocker outside ADR-0051's grammar", ["--lane", "face", "--status", "BLOCKED", "--blocked-on", "owner - a reason"], /ADR-0051/],
    ["a blocker holding a machine path", ["--lane", "face", "--status", "BLOCKED", "--blocked-on", `owner ${DASH} see C:\\Users\\someone\\notes.txt`], /machine path or an address/],
    ["a lane main does not hold", ["--lane", "nolane", "--status", "IDLE"], /only \/arc-kickoff births a lane/],
    ["a status that is not one of the four", ["--lane", "face", "--status", "AWAKE"], /one of LIVE, IDLE, QUEUED, BLOCKED/],
    ["the status the lane already has", ["--lane", "face", "--status", faceStatus ? faceStatus[1] : "LIVE"], /already/],
  ]) {
    const r = ls(...args, "--dry-run");
    check(`lane-status refuses ${why}`, r.status === 2 && re.test(r.stderr) && clean(), r.stderr);
  }
  const blockedPlan = ls("--lane", "face", "--status", "BLOCKED", "--blocked-on", `owner ${DASH} the phase demo`, "--dry-run");
  check("lane-status, BLOCKED planned: the header's blocker and the board's column 6 move together",
    blockedPlan.status === 0 && !!lastExpect(blockedPlan.stdout) && blockedPlan.stdout.includes(`+blocked-on: owner ${DASH} the phase demo`) && /\+\| face \| BLOCKED \|.*\| owner — the phase demo \/ /.test(blockedPlan.stdout) && clean(),
    `${blockedPlan.status} ${blockedPlan.stderr}`);

  const eventsBefore = spineEvents(sp).length;
  const plan = ls("--lane", "face", "--status", to, "--dry-run");
  const d = lastExpect(plan.stdout);
  check("lane-status, planned: the PROGRESS header and the board row on one branch, a digest; nothing written",
    plan.status === 0 && !!d && ["initiatives/face/PROGRESS.md", "PORTFOLIO.md"].every((p) => plan.stdout.includes(`b/${p}`)) && clean() && spineEvents(sp).length === eventsBefore,
    `${plan.status} ${plan.stderr}`);
  const stale = ls("--lane", "face", "--status", to, "--expect", ZERO);
  check("lane-status refuses an apply whose digest is not the plan's (PLAN_STALE), writing nothing", stale.status === 2 && clean() && g("rev-parse", "--verify", "--quiet", `feat/face-lane-status-face-${to.toLowerCase()}`).status !== 0, stale.stderr);
  const ap = ls("--lane", "face", "--status", to, "--expect", d || ZERO);
  const branch = `feat/face-lane-status-face-${to.toLowerCase()}`;
  const progress = g("show", `${branch}:initiatives/face/PROGRESS.md`).stdout;
  const board = g("show", `${branch}:PORTFOLIO.md`).stdout;
  const req = spineEvents(sp).find((e) => e.kind === "approval.requested" && e.payload && e.payload.gate === "lane-status");
  check("lane-status, applied: the branch holds the new header and the new board row, main is untouched, and the request is in the inbox",
    ap.status === 0 && new RegExp(`^status: ${to}$`, "m").test(progress) && new RegExp(`^\\| face \\| ${to} \\|`, "m").test(board) && clean() && !!req && req.payload.lane === "face" && req.payload.status === to && req.payload.branch === branch
      && req.idem === createHash("sha256").update(`lane.status|face|${to}|${DASH}|${mainBefore}`).digest("hex"),
    `${ap.status} ${ap.stderr} ${JSON.stringify(req && req.payload)}`);

  // board-lint on the branch's tree: no drift in the face lane. The MUTANT CONTROL is the header changed alone.
  g("checkout", "-q", branch);
  const onBranch = boardLint();
  check("board-lint on the branch: the header and the board row agree", onBranch.ran && onBranch.face.length === 0, onBranch.face.join(" | "));
  g("checkout", "-q", "main");
  const headerOnly = readFileSync(join(repo, "initiatives", "face", "PROGRESS.md"), "utf8").replace(/^status: \S+$/m, `status: ${to}`);
  writeFileSync(join(repo, "initiatives", "face", "PROGRESS.md"), headerOnly);
  const mutant = boardLint();
  g("checkout", "-q", "--", "initiatives/face/PROGRESS.md");
  check("MUTANT CONTROL: board-lint names the face lane when the header moves without its board row", mutant.face.length > 0 && clean(), `face warns: ${mutant.face.length}`);

  const second = ls("--lane", "face", "--status", "QUEUED" === to ? "IDLE" : "QUEUED", "--dry-run");
  check("lane-status refuses a second status while one proposal of it is open", second.status === 2 && /already open/.test(second.stderr) && clean(), second.stderr);
}

// ---- concept-define ----
{
  const sp = spine("concept-spine");
  const cd = (...a) => node([join(repo, ".claude", "scripts", "core", "concept-define.mjs"), ...a], { ARC_SPINE_ROOT: sp }, repo);
  const contract = JSON.parse(readFileSync(join(repo, "initiatives", "face", "contracts", "expected-set.json"), "utf8"));
  const planned = contract.rooms.list.find((r) => r.status === "planned");
  check("fixture: the contract holds a planned room to refuse (vacuous-pass guard)", !!planned);
  for (const [why, args, re] of [
    ["a word already defined, in another case", ["--term", "ulid", "--room", "spine", "--station", "emit"], /already a term/],
    ["a planned room", ["--term", "probe term", "--room", planned ? planned.id : "x", "--station", "emit"], /planned room/],
    ["a room the contract does not hold", ["--term", "probe term", "--room", "nowhere", "--station", "emit"], /not a room in the contract/],
    ["a term with a backtick", ["--term", "a`b", "--room", "today", "--station", "emit"], /no \| or backtick/],
    ["a station outside its shape", ["--term", "probe term", "--room", "today", "--station", "a|b"], /stop on the room's line/],
  ]) {
    const r = cd(...args, "--dry-run");
    check(`concept-define refuses ${why}`, r.status === 2 && re.test(r.stderr) && clean(), r.stderr);
  }
  const eventsBefore = spineEvents(sp).length;
  const plan = cd("--term", "probe term", "--room", "today", "--station", "needs-you cards", "--dry-run");
  const d = lastExpect(plan.stdout);
  check("concept-define, planned: the contract on a branch, a digest; nothing written",
    plan.status === 0 && !!d && plan.stdout.includes("b/initiatives/face/contracts/expected-set.json") && clean() && spineEvents(sp).length === eventsBefore, `${plan.status} ${plan.stderr}`);
  const ap = cd("--term", "probe term", "--room", "today", "--station", "needs-you cards", "--expect", d || ZERO);
  const branch = "feat/face-concept-define-probe-term";
  let onBranch = null;
  try { onBranch = JSON.parse(g("show", `${branch}:initiatives/face/contracts/expected-set.json`).stdout); } catch { /* checked below */ }
  const req = spineEvents(sp).find((e) => e.kind === "approval.requested" && e.payload && e.payload.gate === "concept-define");
  check("concept-define, applied: the branch homes the term, main is untouched, and the request is in the inbox",
    ap.status === 0 && !!onBranch && JSON.stringify(onBranch.concepts.map["probe term"]) === JSON.stringify({ room: "today", station: "needs-you cards" }) && clean() && !!req && req.payload.term === "probe term" && req.payload.branch === branch,
    `${ap.status} ${ap.stderr} ${JSON.stringify(req && req.payload)}`);
  const second = cd("--term", "another term", "--room", "today", "--station", "needs-you cards", "--dry-run");
  check("concept-define refuses a second definition while one is open -- two would conflict in the contract", second.status === 2 && /already open/.test(second.stderr) && clean(), second.stderr);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran >= 26 ? 0 : 1);
