#!/usr/bin/env node
// session-door.mjs -- the SESSION door's contract suite (face v2 Phase 06; REQ-08, ADR-1326 · ADR-1339).
//
// What it holds, per exit criterion 1 of phase-06-spec.md, and every hole attack 60c13e9 found:
//   A. DRIVER-ONLY, every row. Each face-sessions row is started through createSessionDoor with a recording spawn, and
//      the recorded argv must be `node <tree>/.claude/scripts/engine/arc-run.mjs --process <row's process> --driver
//      <name>`, list-built -- except ship, which is refused until its confirm stop is enforced. The row count is
//      asserted, so a registry that shrinks cannot pass on fewer.
//   B. THE MUTANTS the check must refuse: a harness binary as the command (claude, codex, hermes), a harness as a stray
//      argument, a joined argv, --driver missing, empty or unknown, a repeated flag, a flag with no value.
//   C. CLICK-STARTED ONLY and the other start guards: no, forged, spent or expired token; a bad body still spends its
//      click; a sim door on a paid driver; a checkout on main or no branch; a process that is a directory; a second
//      running start of the same input; a door past its running cap. Each refused by name, with 0 spawns.
//   D. NO SESSION STATE IN THE DOOR. A door in ANOTHER process starts a real run (a fake arc-run on a scratch git tree
//      on a feat/* branch) and ends. A fresh door here attaches: the run is still there, its lines stream in the order
//      written, it ends as "ended", and its receipt is read back off the spine the DOOR named (the suite's own env
//      carries no ARC_SPINE_ROOT). The run never saw the door's token, and a key it printed is redacted.
//   E. ATTACH FROM DISK: a log past the tail cap is served as its tail with the dropped bytes counted and no torn
//      character; a torn exit.json reads "unknown", never a terminal answer.
//   F. THE ROUTES, through arc-dash in sim mode on a free port: the registry is served, a start with no click is 428,
//      a start without Origin is refused, and a sim start on a paid driver is SIM_SPEND after its click was spent.
//
// VACUOUS-PASS GUARD: each part proves its fixture seeded before judging it, and the last line is "RAN: <n> checks",
// which the bats wrapper requires -- a suite that dies half-way cannot read green.

import { spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const TOKEN = "session-door-token";
const EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");

const SESS = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "face-sessions.mjs")).href);
const DOOR = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "face", "session-door.mjs")).href);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const codeOf = (fn) => { try { fn(); return null; } catch (e) { return /** @type {any} */ (e).code || String(e); } };

// The suite's own env names NO spine: whatever spine a session writes to, the door must have named it (attack B2).
delete process.env.ARC_SPINE_ROOT;

const tmp = mkdtempSync(join(tmpdir(), "face-session-door-"));
const SPINE = join(tmp, "spine");
mkdirSync(join(SPINE, "events"), { recursive: true });

// ---- the scratch tree: a git checkout on a feat/* branch, a fake arc-run, and a process file for every row ----
const TREE = join(tmp, "tree");
mkdirSync(join(TREE, ".claude", "scripts", "engine"), { recursive: true });
mkdirSync(join(TREE, "processes"), { recursive: true });
const git = (args) => spawnSync("git", args, { cwd: TREE, encoding: "utf8" });
const gi = git(["init", "-q"]);
const gb = git(["symbolic-ref", "HEAD", "refs/heads/feat/session-fixture"]);
const RELEASE = join(tmp, "release");
// The fake reads its config from a file beside it: the session env is an allow-list, so a SESSION_FIXTURE_* variable
// would never reach it (and a fixture that widened the allow-list to pass one would test nothing).
writeFileSync(join(TREE, ".claude", "scripts", "engine", "fixture.json"), JSON.stringify({ event: EVENT, release: RELEASE }));
// It prints two phase lines; says which of the door's token and the owner's deploy/VCS tokens it can see; prints a
// planted key; writes two real note.logged receipts through arc-event (to whatever spine its env names) -- the first
// named the way arc-run names a receipt, the second named as a kind it is not, then printed bare; then waits for the
// suite to release it -- so the suite can attach while it is provably still running.
writeFileSync(join(TREE, ".claude", "scripts", "engine", "arc-run.mjs"), [
  "import { spawnSync } from \"node:child_process\";",
  "import { existsSync, readFileSync } from \"node:fs\";",
  "const cfg = JSON.parse(readFileSync(new URL(\"./fixture.json\", import.meta.url), \"utf8\"));",
  "console.log(\"phase: one -- \" + process.argv.slice(2, 6).join(\" | \"));",
  "console.log(\"phase: two\");",
  "const seen = [\"ARC_DASH_TOKEN\", \"VERCEL_TOKEN\", \"GH_TOKEN\", \"LEADS_CONFIG\"].filter((k) => process.env[k] !== undefined);",
  "console.log(\"env-leak: \" + (seen.length ? seen.join(\",\") : \"none\"));",
  "console.log(\"leak: sk-ant-api03-\" + \"A\".repeat(40));",
  "const emit = () => String(spawnSync(process.execPath, [cfg.event, \"emit\", \"note.logged\", \"--payload\", JSON.stringify({ note: \"session-fixture\" })], { encoding: \"utf8\" }).stdout).trim().split(/\\r?\\n/).pop();",
  "const id = emit();",
  "console.error(\"arc-run: receipt note.logged \" + id);",
  "const other = emit();",
  "console.error(\"arc-run: receipt council.verdict \" + other);",
  "console.log(\"bare: \" + other);",
  "const until = Date.now() + 20000;",
  "while (!existsSync(cfg.release) && Date.now() < until) await new Promise((res) => setTimeout(res, 50));",
  "console.log(\"phase: three\");",
  "",
].join("\n"));
for (const s of SESS.SESSIONS) if (s.process) writeFileSync(join(TREE, "processes", `${s.process}.process.yaml`), `name: ${s.process}\n`);
const DRIVERS = ["claude-code", "codex", "generic-api", "hermes", "mock"];
const drivers = () => DRIVERS;
const onFeat = () => "feat/session-fixture";
check("fixture: the scratch tree is a git checkout on feat/session-fixture with a fake arc-run and a process file per row (vacuous-pass guard)",
  gi.status === 0 && gb.status === 0 && existsSync(join(TREE, ".claude", "scripts", "engine", "arc-run.mjs"))
  && SESS.SESSIONS.filter((s) => s.process).every((s) => existsSync(join(TREE, "processes", `${s.process}.process.yaml`))), `${gi.stderr} ${gb.stderr}`);

/** A spawn that starts nothing and records what it was asked to start. @param {number | undefined} pid */
function recorder(pid) {
  const calls = [];
  const fake = (file, args, opts) => {
    calls.push({ file, args, opts });
    const child = new EventEmitter();
    Object.assign(child, { pid, unref() {} });
    return child;
  };
  return { calls, spawn: /** @type {any} */ (fake) };
}
const inputFor = (s) => Object.fromEntries(s.fields.filter((f) => f.required).map((f) => [f.name, f.name === "lane" ? "face" : f.name === "phase" ? "06" : f.name === "url" ? "http://localhost:3000" : "a question with spaces"]));
const door = (repo, journal, o = {}) => DOOR.createSessionDoor({ mode: o.mode || "live", root: SPINE, repo, journalDir: join(tmp, journal) }, { drivers, branch: onFeat, ...o });

// Planted in the door's own env: a session is a model with shell tools, and none of these is its business (attack 8e389a5 B2).
process.env.ARC_DASH_TOKEN = "planted-dash-token-0123456789";
process.env.VERCEL_TOKEN = "planted-vercel-token";
process.env.GH_TOKEN = "planted-gh-token";
process.env.LEADS_CONFIG = "planted-leads-config";

// ---- R. the residue file is held to the registry (Phase 06 DoD, ADR-1339) ----
// evidence/phase-06/residue.md splits the 15 SESSION rows into the ones that ship and the residue the owner approves as a
// whole. Its row ids equal the registry both ways, and each side is still true of the REAL tree: a shipped row has its
// process file (dispatch excepted -- it runs the one the owner picks), and a residue row has none, or is held by its
// confirm stop. When a lane adds a residue row's process file, this fails until the file moves the row. The "ships"
// header is matched as a prefix on purpose: it also reads the start-only table (receipt not yet shown), whose rows
// need their process file just the same.
{
  const tableRows = (text, header) => {
    const lines = text.split(/\r?\n/);
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      if (!header.test(lines[i])) continue;
      for (let j = i + 2; j < lines.length && lines[j].startsWith("|"); j++) rows.push(lines[j].split("|").slice(1, -1).map((c) => c.trim()));
    }
    return rows;
  };
  const text = readFileSync(join(REPO, "initiatives", "face", "evidence", "phase-06", "residue.md"), "utf8");
  const idOf = (r) => r[0].replace(/`/g, "");
  const ships = tableRows(text, /^\| row id \| process file \| receipt kind \|/).map(idOf);
  const residue = tableRows(text, /^\| row id \| door today \| missing piece \| filed to \|/).map(idOf);
  const registry = new Set(SESS.SESSIONS.map((s) => s.id));
  const sameBothWays = (list) => list.length === registry.size && new Set(list).size === list.length && list.every((id) => registry.has(id));
  check("residue: both tables parse (vacuous-pass guard)", ships.length > 0 && residue.length > 0, `ships=${ships.length} residue=${residue.length}`);
  check("residue: shipped + residue rows equal the registry both ways", sameBothWays([...ships, ...residue]),
    [...ships, ...residue].filter((id) => !registry.has(id)).join(",") || [...registry].filter((id) => ![...ships, ...residue].includes(id)).join(","));
  const hasFile = (s) => existsSync(join(REPO, "processes", `${s.process}.process.yaml`));
  const row = (id) => SESS.sessionById(id);
  const badShip = ships.filter((id) => registry.has(id)).filter((id) => !(row(id).pickProcess || hasFile(row(id))));
  check("residue: every shipped row has its process file in the tree", badShip.length === 0, badShip.join(","));
  const badResidue = residue.filter((id) => registry.has(id)).filter((id) => !(row(id).confirmStep || !hasFile(row(id))));
  check("residue: every residue row still refuses (no process file, or a confirm stop) -- a new file moves its row", badResidue.length === 0, badResidue.join(","));
  // The start-only rows (receipt not yet READ BACK) at least carry a process that says it emits the row's kind. This
  // narrows the debt-ledger row; it does not pay it -- a sentence in a body is not a receipt on the spine.
  const startOnly = tableRows(text, /^\| row id \| process file \| receipt kind \| not yet shown \|/).map(idOf).filter((id) => registry.has(id));
  const emitsKind = (s) => s.pickProcess || s.receipt && new RegExp(`emit ${s.receipt.kind.replace(/\./g, "\\.")}\\b`).test(readFileSync(join(REPO, "processes", `${s.process}.process.yaml`), "utf8"));
  const silent = startOnly.filter((id) => hasFile(row(id)) || row(id).pickProcess).filter((id) => !emitsKind(row(id)));
  check("residue: the start-only table parses (vacuous-pass guard)", startOnly.length === 4, `rows=${startOnly.length}`);
  check("residue: every start-only row's process body emits the row's own kind", silent.length === 0, silent.join(","));
  check("MUTANT CONTROL: a row claiming a kind its process never emits is caught",
    !emitsKind({ ...row(startOnly.find((id) => !row(id).pickProcess) || "review-ship.review"), receipt: { kind: "council.verdict" } }));
  check("MUTANT CONTROL: a residue file with one row dropped is caught", !sameBothWays([...ships, ...residue].slice(1)));
  check("MUTANT CONTROL: a residue file naming a row the registry does not hold is caught", !sameBothWays([...[...ships, ...residue].slice(1), "invented.verb"]));
}

// ---- A. driver-only, every row ----
{
  check("registry: the 15 SESSION verbs of the Phase 05 probe, no fewer", SESS.SESSIONS.length === 15, `rows=${SESS.SESSIONS.length}`);
  const rec = recorder(undefined);
  const d = door(TREE, "journal-a", { spawn: rec.spawn });
  const arcRun = realpathSync(join(TREE, ".claude", "scripts", "engine", "arc-run.mjs"));
  let started = 0;
  for (const s of SESS.SESSIONS) {
    const body = { click: d.click().click, input: inputFor(s), driver: "auto", ...(s.pickProcess ? { process: SESS.SESSIONS.find((x) => x.process).process } : {}) };
    const before = rec.calls.length;
    let out = null, err = null;
    try { out = d.start(s.id, body); } catch (e) { err = e; }
    if (s.confirmStep) {
      check(`${s.id}: REFUSED until its ${s.confirmStep} stop is enforced -- a process file alone never makes it one click`,
        err && err.code === "CONFIRM_STEP_UNENFORCED" && rec.calls.length === before, err ? err.code : "started");
      continue;
    }
    const call = rec.calls[rec.calls.length - 1];
    const ok = !err && out && rec.calls.length === before + 1 && call.file === process.execPath && call.args[0] === arcRun
      && call.args[1] === "--process" && call.args[2] === (body.process || s.process) && call.args[3] === "--driver" && call.args[4] === "auto"
      && SESS.driverOnly({ script: "engine/arc-run.mjs", args: call.args.slice(1) }, DRIVERS) === null
      && call.opts.detached === true && call.opts.stdio[0] === "ignore";
    if (ok) started++;
    check(`${s.id}: starts node arc-run.mjs --process ${body.process || s.process} --driver auto, list-built and detached`, ok,
      err ? `${err.code}: ${err.message}` : JSON.stringify(call && call.args.slice(1, 5)));
  }
  const confirmRows = SESS.SESSIONS.filter((s) => s.confirmStep).length;
  check("every other row reached a spawn (the loop judged real starts, not refusals)", confirmRows === 1 && started === 14 && rec.calls.length === 14, `started=${started} spawns=${rec.calls.length}`);
  const env = rec.calls[0] && rec.calls[0].opts.env;
  check("the child is told the door's spine, keeps PATH, and sees none of the door's ARC_DASH_*, the owner's deploy/VCS tokens or the leads steering list",
    env && env.ARC_SPINE_ROOT === SPINE && Object.keys(env).some((k) => k.toUpperCase() === "PATH")
    && Object.keys(env).every((k) => !k.toUpperCase().startsWith("ARC_DASH_") && !["VERCEL_TOKEN", "GH_TOKEN", "LEADS_CONFIG"].includes(k.toUpperCase())),
    JSON.stringify(env && Object.keys(env).filter((k) => /TOKEN|DASH|LEADS/i.test(k))));
  const words = d.start("council.convene", { click: d.click().click, input: { question: "should we --driver claude ship now" }, driver: "codex" });
  const wc = rec.calls[rec.calls.length - 1];
  check("the owner's words stay ONE value: a question holding a flag and a space is the --input JSON, never an argument; the named driver is the --driver value",
    words.state === "running" && wc.args.filter((a) => a === "--driver").length === 1 && JSON.parse(wc.args[6]).question === "should we --driver claude ship now" && wc.args[4] === "codex", JSON.stringify(wc.args.slice(1)));
}

// ---- B. the mutants driverOnly must refuse ----
{
  const good = SESS.sessionCommand("review-diff", "auto", { base: "main" }, join(tmp, "some dir", "with space"));
  check("positive control: the real argv passes, a transcript path with a space included", SESS.driverOnly(good, DRIVERS) === null, SESS.driverOnly(good, DRIVERS) || "");
  const mutants = [
    ["the harness claude as the command", { script: "claude", args: ["-p", "review the diff"] }],
    ["the harness codex as the command", { script: "codex", args: ["exec", "review"] }],
    ["the harness hermes as the command", { script: "engine/drivers/hermes.sh", args: good.args }],
    ["the harness named as a stray argument", { script: "engine/arc-run.mjs", args: [...good.args, "claude"] }],
    ["a joined argv: flag and value in one slot", { script: "engine/arc-run.mjs", args: ["--process review-diff --driver auto"] }],
    ["a joined argv: two words in the --driver slot", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", "auto --dry-run"] }],
    ["--driver missing", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--input", "{}"] }],
    ["--driver empty", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", ""] }],
    ["--driver naming no driver", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", "bash"] }],
    ["--process given twice", { script: "engine/arc-run.mjs", args: [...good.args, "--process", "kickoff-plan"] }],
    ["a flag with no value", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", "auto", "--input"] }],
    ["--input that is no JSON object", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", "auto", "--input", "[1]"] }],
    ["an empty --transcript-dir", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", "auto", "--transcript-dir", ""] }],
    ["a relative --transcript-dir (resolves into the tracked repo)", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", "auto", "--transcript-dir", ".."] }],
  ];
  // "REFUSED", never the word the bats wrapper reads as a failed check (attack B1).
  for (const [name, cmd] of mutants) check(`MUTANT REFUSED by driver-only: ${name}`, SESS.driverOnly(cmd, DRIVERS) !== null);
}

// ---- C. click-started only, and the other start guards ----
{
  const rec = recorder(undefined);
  let t = 1_000_000;
  const d = door(TREE, "journal-c", { spawn: rec.spawn, now: () => t });
  const row = "review-ship.review";
  check("no token: CLICK_REQUIRED", codeOf(() => d.start(row, { input: {} })) === "CLICK_REQUIRED");
  check("a forged token of the right shape: CLICK_REQUIRED", codeOf(() => d.start(row, { click: "A".repeat(24), input: {} })) === "CLICK_REQUIRED");
  const c1 = d.click().click;
  check("a token spent once starts once", codeOf(() => d.start(row, { click: c1, input: {} })) === null && rec.calls.length === 1, `spawns=${rec.calls.length}`);
  check("the same token replayed: CLICK_REQUIRED, no second spawn", codeOf(() => d.start(row, { click: c1, input: {} })) === "CLICK_REQUIRED" && rec.calls.length === 1);
  const c2 = d.click().click;
  t += 61_000;
  check("an expired token: CLICK_REQUIRED", codeOf(() => d.start(row, { click: c2, input: {} })) === "CLICK_REQUIRED" && rec.calls.length === 1);
  const c3 = d.click().click;
  check("a bad body still SPENDS its click: one click can never be retried into two starts",
    codeOf(() => d.start(row, { click: c3, input: { nope: "x" } })) === "BAD_INPUT" && codeOf(() => d.start(row, { click: c3, input: {} })) === "CLICK_REQUIRED" && rec.calls.length === 1);
  d.list();
  check("list() spawns nothing", rec.calls.length === 1);
  check("dispatch takes only a process on this tree", codeOf(() => d.start("executor.dispatch", { click: d.click().click, input: {}, process: "../../etc" })) === "NO_PROCESS" && rec.calls.length === 1);
  check("positive control: ship-run's process file IS on the scratch tree", existsSync(join(TREE, "processes", "ship-run.process.yaml")));
  check("dispatch naming ship's process is held back BY NAME: CONFIRM_STEP_UNENFORCED, nothing started",
    codeOf(() => d.start("executor.dispatch", { click: d.click().click, input: {}, process: "ship-run" })) === "CONFIRM_STEP_UNENFORCED" && rec.calls.length === 1);

  // A scratch tree of its own for NO_PROCESS: never the repo, whose processes/ other lanes grow (attack B11).
  const BARE = join(tmp, "bare");
  mkdirSync(join(BARE, "processes", "qa-run.process.yaml"), { recursive: true });
  const bare = door(BARE, "journal-c2", { spawn: rec.spawn, now: () => t });
  check("a process that is a DIRECTORY of the right name is not a process: NOT SHIPPABLE, named",
    codeOf(() => bare.start("review-ship.qa", { click: bare.click().click, input: { url: "http://localhost:3000" } })) === "NO_PROCESS" && rec.calls.length === 1);
  const sim = door(TREE, "journal-c3", { spawn: rec.spawn, now: () => t, mode: "sim" });
  check("a sim door runs a session on the mock driver or not at all", codeOf(() => sim.start(row, { click: sim.click().click, input: {}, driver: "auto" })) === "SIM_SPEND" && rec.calls.length === 1);
  const onMain = door(TREE, "journal-c4", { spawn: rec.spawn, now: () => t, branch: () => "main" });
  check("a checkout on main: BRANCH_REFUSED, nothing started", codeOf(() => onMain.start(row, { click: onMain.click().click, input: {} })) === "BRANCH_REFUSED" && rec.calls.length === 1);
  const noBranch = door(TREE, "journal-c5", { spawn: rec.spawn, now: () => t, branch: () => null });
  check("a detached or unreadable checkout: BRANCH_REFUSED", codeOf(() => noBranch.start(row, { click: noBranch.click().click, input: {} })) === "BRANCH_REFUSED" && rec.calls.length === 1);
  const realBranch = DOOR.createSessionDoor({ mode: "live", root: SPINE, repo: TREE, journalDir: join(tmp, "journal-c6") }, { drivers, spawn: rec.spawn });
  const beforeReal = rec.calls.length;
  check("the REAL branch reader (git, no stub) passes the scratch tree's feat/* branch and the start spawns",
    codeOf(() => realBranch.start(row, { click: realBranch.click().click, input: {} })) === null && rec.calls.length === beforeReal + 1, `spawns ${beforeReal}->${rec.calls.length}`);

  // Running children read as running from DISK: a recorder whose children carry THIS process's pid.
  const live = recorder(process.pid);
  const busy = door(TREE, "journal-c7", { spawn: live.spawn });
  const q = (question) => ({ click: busy.click().click, input: { question }, driver: "auto" });
  check("seed: a first council starts", codeOf(() => busy.start("council.convene", q("one"))) === null && live.calls.length === 1);
  check("the same session with the same input while it runs: SESSION_RUNNING, no second paid child",
    codeOf(() => busy.start("council.convene", q("one"))) === "SESSION_RUNNING" && live.calls.length === 1);
  busy.start("council.convene", q("two"));
  busy.start("council.convene", q("three"));
  check("past the running cap: SESSIONS_BUSY", live.calls.length === 3 && codeOf(() => busy.start("council.convene", q("four"))) === "SESSIONS_BUSY" && live.calls.length === 3, `spawns=${live.calls.length}`);
}

// ---- D. no session state in the door: start in one process, attach from another ----
{
  const JOURNAL = join(tmp, "journal-d");
  const starter = join(tmp, "door-a.mjs");
  // No process.exit(): the detached child is unref'd, so the loop ends by itself once the line is written (attack B12).
  // The starter inherits this suite's env, planted tokens and all: the door must strip them, not the suite.
  writeFileSync(starter, [
    `const DOOR = await import(${JSON.stringify(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "face", "session-door.mjs")).href)});`,
    `const door = DOOR.createSessionDoor({ mode: "live", root: ${JSON.stringify(SPINE)}, repo: ${JSON.stringify(TREE)}, journalDir: ${JSON.stringify(JOURNAL)} }, { drivers: () => ${JSON.stringify(DRIVERS)} });`,
    "const out = door.start(\"memory.log-lesson\", { click: door.click().click, input: { lesson: \"a session is its directory\" }, driver: \"mock\" });",
    "console.log(JSON.stringify(out));",
    "",
  ].join("\n"));
  const a = spawnSync(process.execPath, [starter], { cwd: REPO, encoding: "utf8", env: process.env, timeout: 30_000 });
  let started = null;
  try { started = JSON.parse(String(a.stdout).trim().split(/\r?\n/).pop()); } catch { /* checked below */ }
  check("door A started a session on the REAL branch reader and ENDED (vacuous-pass guard)",
    a.status === 0 && started && /^[0-9a-z]{9}[A-Za-z0-9_-]{7}$/.test(started.sid) && started.branch === "feat/session-fixture", `${a.status} ${a.stderr}`);
  if (started) {
    const b = DOOR.createSessionDoor({ mode: "live", root: SPINE, repo: TREE, journalDir: JOURNAL }, { drivers });
    let mid = null;
    for (let i = 0; i < 200; i++) {
      mid = await b.read(started.sid);
      if (mid.lines.some((l) => l.startsWith("bare: "))) break;
      await sleep(50);
    }
    check("a FRESH door attaches to the run door A started, while it runs", mid && mid.state === "running" && mid.session === "memory.log-lesson" && Number.isInteger(mid.pid), JSON.stringify(mid && { state: mid.state, lines: mid.lines }));
    check("the command it shows is arc-run with --process and --driver", mid && mid.command[1] === ".claude/scripts/engine/arc-run.mjs" && mid.command[2] === "--process" && mid.command[4] === "--driver" && mid.command[5] === "mock", JSON.stringify(mid && mid.command));
    check("the checkout has not moved, and attach does not claim it has", mid && mid.branch === "feat/session-fixture" && mid.branchMoved === undefined, JSON.stringify(mid && mid.branchMoved));
    writeFileSync(RELEASE, "go");
    let end = null;
    for (let i = 0; i < 200; i++) {
      end = await b.read(started.sid);
      if (end.state !== "running") break;
      await sleep(50);
    }
    const idx = (p) => end.lines.findIndex((l) => l.startsWith(p));
    check("the lines stream in the order the run wrote them, stdout and stderr in one file",
      end && idx("phase: one") >= 0 && idx("phase: one") < idx("phase: two") && idx("phase: two") < idx("arc-run: receipt") && idx("arc-run: receipt") < idx("phase: three"), JSON.stringify(end && end.lines));
    check("no door saw the end, and the attach says so rather than inventing an exit", end && end.state === "ended" && end.exit === null && typeof end.note === "string", JSON.stringify(end && { state: end.state, exit: end.exit }));
    const namedLines = end.lines.filter((l) => l.startsWith("arc-run: receipt"));
    const credited = (namedLines[0] || "").split(" ").pop();
    const miskinded = (namedLines[1] || "").split(" ").pop();
    check("fixture: the run named two receipts, one as its own kind and one as a kind it is not (vacuous-pass guard)", namedLines.length === 2 && credited !== miskinded, JSON.stringify(namedLines));
    check("its receipt is read back OFF THE SPINE THE DOOR NAMED, credited because arc-run's line named the row's own kind",
      end.receipts.length === 1 && end.receipts[0].id === credited && end.receipts[0].kind === "note.logged" && end.receipts[0].attributedBy === "named-line", JSON.stringify(end.receipts));
    check("a real event the run named as ANOTHER kind, and printed bare, is unattributed -- never a receipt",
      Array.isArray(end.unattributed) && end.unattributed.includes(miskinded) && !end.receipts.some((r) => r.id === miskinded), JSON.stringify(end.unattributed));
    check("the run never saw the door's token, the owner's deploy/VCS tokens or the leads steering list", end.lines.includes("env-leak: none"), JSON.stringify(end.lines.filter((l) => l.startsWith("env-leak"))));
    check("a key the run printed is served redacted, never as written",
      end.lines.every((l) => !l.includes("sk-ant-api03-")) && end.lines.some((l) => l.includes("[anthropic-key redacted]")), JSON.stringify(end.lines));
    const listed = b.list().runs.find((r) => r.sid === started.sid);
    check("the run is on the fresh door's list, read from disk", listed && listed.session === "memory.log-lesson");
    check("the child was told only its transcript directory, never the door's session directory",
      !end.command.some((a) => a.includes(`sessions${sep}${started.sid}`) || a.includes(`sessions/${started.sid}`)), JSON.stringify(end.command));
  }
  const c = DOOR.createSessionDoor({ mode: "live", root: SPINE, repo: TREE, journalDir: JOURNAL }, { drivers });
  check("attach refuses an id that is not a session id, and one that is not on disk",
    (await c.read("../../etc").then(() => null, (e) => e.code)) === "BAD_RUN_ID" && (await c.read("000000000AAAAAAA").then(() => null, (e) => e.code)) === "UNKNOWN_RUN");
}

// ---- E. attach from disk: the tail cap, a cut key, torn and forged state, stale and moved sessions ----
{
  const JOURNAL = join(tmp, "journal-e");
  const mk = (sid, log, exitRaw, meta = {}) => {
    const d = join(JOURNAL, "sessions", sid);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "session.json"), JSON.stringify({ sid, session: "review-ship.review", process: "review-diff", driver: "mock", startedAt: Date.now(), pid: 2 ** 30, argv: [], ...meta }));
    writeFileSync(join(d, "run.log"), log);
    if (exitRaw !== undefined) writeFileSync(join(d, "exit.json"), exitRaw);
  };
  const done = JSON.stringify({ exit: 0, signal: null, endedAt: Date.now() });
  // 300 KB of three-byte characters ending in a planted key, then one last line: the tail's head lands mid-line, and
  // mid-character, inside the key's line.
  mk("000000001biglog0", Buffer.from("அ".repeat(100_000) + " sk-ant-api03-" + "B".repeat(40) + "\ntail-line\n", "utf8"), done);
  // A key straddling the 8192-character line cap: redacted whole BEFORE the cut.
  mk("000000002keycap0", "y".repeat(8185) + " sk-ant-api03-" + "C".repeat(40) + "\n", done);
  mk("000000003tornex0", "one\n", "{\"exit\": 0");
  mk("000000004nullex0", "one\n", "null");
  mk("000000005stale00", "one\n", undefined, { pid: process.pid, startedAt: Date.now() - 7 * 3_600_000 });
  mk("000000006moved00", "one\n", undefined, { pid: process.pid, branch: "feat/session-fixture" });
  const d = DOOR.createSessionDoor({ mode: "live", root: SPINE, repo: TREE, journalDir: JOURNAL }, { drivers, branch: () => "main" });
  const big = await d.read("000000001biglog0");
  check("a log past the cap: its TAIL, the partial first line dropped and counted, the key in it never served",
    big.lines.length === 1 && big.lines[0] === "tail-line" && big.bytesDropped > 256 * 1024 / 8 && big.lines.every((l) => !l.includes("api03")) && big.state === "done",
    `dropped=${big.bytesDropped} lines=${JSON.stringify(big.lines.map((l) => l.slice(0, 12)))}`);
  const cap = await d.read("000000002keycap0");
  // The marker itself may be cut at 8192; what must hold is that the key was replaced before the cut, not after.
  // The key sits across character 8192, so the cut lands inside the redaction marker (CI: "[anthr [line cut...").
  // What must hold: the line was cut, and no byte of the key -- its prefix or its body -- survived to be served.
  check("a key straddling the line cap is redacted whole, then cut",
    /\[line cut at 8192 characters\]$/.test(cap.lines[0]) && cap.lines[0].includes("[anth") && !cap.lines[0].includes("sk-ant") && !cap.lines[0].includes("CCCC"), cap.lines[0].slice(-80));
  const torn = await d.read("000000003tornex0");
  check("a torn exit.json reads UNKNOWN (read again), never a terminal answer", torn.state === "unknown" && typeof torn.note === "string", torn.state);
  const forged = await d.read("000000004nullex0");
  check("an exit.json of the wrong shape (null) is not state: UNKNOWN, never done or ended", forged.state === "unknown", forged.state);
  const stale = await d.read("000000005stale00");
  check("a live pid past the age ceiling is STALE and holds no slot", stale.state === "stale" && typeof stale.note === "string", stale.state);
  const moved = await d.read("000000006moved00");
  check("a running session whose checkout moved off its branch says so", moved.state === "running" && moved.branchMoved && moved.branchMoved.from === "feat/session-fixture" && moved.branchMoved.to === "main", JSON.stringify(moved.branchMoved));
}

// ---- F. the routes, through arc-dash in sim mode, on a free port ----
{
  const PORT = await new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
  const ORIGIN = `http://127.0.0.1:${PORT}`;
  const dash = spawn(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--spine", SPINE, "--port", String(PORT)],
    { cwd: REPO, env: { ...process.env, ARC_DASH_TOKEN: TOKEN, ARC_DASH_JOURNAL_DIR: join(tmp, "journal-f") }, stdio: ["ignore", "ignore", "pipe"] });
  let doorErr = "";
  dash.stderr.on("data", (c) => { doorErr += c; });
  try {
    const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
    const j = async (path, opts = {}) => {
      const r = await fetch(`${ORIGIN}${path}`, opts);
      let body; try { body = await r.json(); } catch { body = {}; }
      return { status: r.status, body };
    };
    const post = (path, body, extra = {}) => j(path, { method: "POST", headers: { ...H, ...extra }, body: JSON.stringify(body) });
    let up = false;
    for (let i = 0; i < 100 && !up && dash.exitCode === null; i++) { try { up = (await j("/api/health", { headers: H })).status === 200; } catch { await sleep(100); } }
    // The child THIS suite spawned is the one answering: it is still alive, and the port was free a moment ago.
    check("the door came up in sim mode, and it is this suite's child answering (vacuous-pass guard)", up && dash.exitCode === null, doorErr);
    if (up) {
      const list = await j("/api/sessions", { headers: H });
      check("GET /api/sessions serves the 15 rows", list.status === 200 && list.body.sessions.length === 15, `${list.status}`);
      const none = await post("/api/session/review-ship.review/start", { input: {} }, { Origin: ORIGIN });
      check("a start with no click is 428 CLICK_REQUIRED", none.status === 428 && none.body.error === "CLICK_REQUIRED", `${none.status} ${none.body.error}`);
      const tok = await j("/api/session-click", { method: "POST", headers: H });
      check("a click token is minted", tok.status === 200 && typeof tok.body.click === "string", `${tok.status}`);
      const noOrigin = await post("/api/session/review-ship.review/start", { click: tok.body.click, input: {} });
      check("a start without Origin is refused before anything runs", noOrigin.status === 403 && noOrigin.body.error === "NO_ORIGIN", `${noOrigin.status} ${noOrigin.body.error}`);
      const tok2 = await j("/api/session-click", { method: "POST", headers: H });
      const paid = await post("/api/session/review-ship.review/start", { click: tok2.body.click, input: {}, driver: "auto" }, { Origin: ORIGIN });
      check("a sim start on a paid driver is SIM_SPEND", paid.status === 403 && paid.body.error === "SIM_SPEND", `${paid.status} ${paid.body.error}`);
      const again = await post("/api/session/review-ship.review/start", { click: tok2.body.click, input: {}, driver: "mock" }, { Origin: ORIGIN });
      check("...and its click was spent: the same token again is CLICK_REQUIRED", again.status === 428, `${again.status} ${again.body.error}`);
    }
  } finally {
    dash.kill();
  }
}

try { rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
catch (e) { console.log(`WARN the scratch dir was not removed: ${tmp} (${/** @type {any} */ (e).code || "error"})`); }
console.log(`RAN: ${ran} checks`);
// exitCode, never exit(): exit() behind a pending pipe write can cut the RAN line on Windows (attack B12).
process.exitCode = failed === 0 && ran >= 50 ? 0 : 1;
