// review-ship-record.mjs -- the review-ship writer and the two processes it seals (face Cycle 17 P02, REQ-06, ADR-1366).
//
// qa lands qa.completed on a scratch spine and is read back by the id it printed; ship over a CI that is not green
// raises no deploy gate and lands nothing; ship-run's steps and the writer name no deploy, publish or push (a planted
// `vercel` step is the negative control). Node only, no install; the green-CI half runs live, on the owner's clone.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WRITER = join(REPO, ".claude", "scripts", "hq", "review-ship-record.mjs");
let ran = 0, failed = 0;
const check = (name, cond, detail = "") => { ran++; if (cond) console.log(`ok ${name}`); else { failed++; console.log(`FAIL ${name} ${detail}`); } };

const tmp = mkdtempSync(join(tmpdir(), "review-ship-"));
const SPINE = join(tmp, "spine");
mkdirSync(join(SPINE, "events"), { recursive: true });
const run = (args) => spawnSync(process.execPath, [WRITER, ...args], { cwd: REPO, encoding: "utf8", timeout: 120_000, env: { ...process.env, ARC_SPINE_ROOT: SPINE } });
const events = () => readdirSync(join(SPINE, "events")).filter((f) => f.endsWith(".jsonl"))
  .flatMap((f) => readFileSync(join(SPINE, "events", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));

try {
  console.log("RAN review-ship-record checks");
  // qa: the receipt lands, its kind and payload are the writer's, and its id is the one printed.
  // --as-process first: a URL followed later by `name@x.y.z` on one line reads as a credential-bearing URL to the scanner.
  const qa = run(["qa", "--as-process", "qa-run@1.0.0", "--url", "http://localhost:3000", "--bugs", "2", "--fixed", "1"]);
  const id = (/^receipt: qa\.completed ([0-9A-HJKMNP-TV-Z]{26})$/m.exec(qa.stdout) || [])[1];
  const hit = events().find((e) => e.id === id);
  check("qa: lands qa.completed, read back off the spine by the id it printed", qa.status === 0 && Boolean(hit) && hit.kind === "qa.completed"
    && hit.payload.host === "localhost:3000" && hit.payload.path === "/" && hit.payload.tls === false && hit.payload.bugs === "2" && hit.payload.fixed === "1", `${qa.status} ${qa.stderr} ${qa.stdout}`);
  const before = events().length;
  const dry = run(["qa", "--url", "http://localhost:3000", "--bugs", "0", "--fixed", "0", "--dry-run"]);
  check("qa --dry-run lands nothing", dry.status === 0 && events().length === before, dry.stderr);
  for (const [why, args] of [
    ["more fixed than found", ["qa", "--url", "http://localhost:3000", "--bugs", "1", "--fixed", "2"]],
    ["a URL with a query", ["qa", "--url", "http://x.test/?a=1", "--bugs", "0", "--fixed", "0"]],
    ["a non-http URL", ["qa", "--url", "file:///etc/passwd", "--bugs", "0", "--fixed", "0"]],
    ["an unknown verb", ["deploy"]],
    ["a short SHA", ["ship", "--sha", "abc123"]],
  ]) { const r = run(args); check(`refused, nothing landed: ${why}`, r.status === 2 && events().length === before, `${r.status} ${r.stderr}`); }

  // qa cannot be credited to another process (attack 09a1c07 B2).
  const forged = run(["qa", "--as-process", "ship-run@1.0.0", "--url", "http://localhost:3000", "--bugs", "0", "--fixed", "0"]);
  check("qa credited to another process: refused, nothing landed", forged.status === 2 && /credited to qa-run only/.test(forged.stderr) && events().length === before, forged.stderr);

  // ship reads CI itself, through a fixture reader on this scratch spine: green raises the gate for HEAD, red and an
  // unreachable CI each raise nothing and are named apart, and a SHA that is not HEAD raises nothing (B3, B4).
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8", timeout: 30_000 }).stdout.trim();
  check("the checkout's HEAD was read (vacuous-pass guard)", /^[0-9a-f]{40}$/.test(head), head);
  const digest = (code) => { const f = join(tmp, `digest-${code}.mjs`); writeFileSync(f, `process.stdout.write("fixture digest exit ${code}\\n"); process.exitCode = ${code};\n`); return f; };
  const ship = (code, sha = head) => spawnSync(process.execPath, [WRITER, "ship", "--sha", sha, "--as-process", "ship-run@1.0.0"],
    { cwd: REPO, encoding: "utf8", timeout: 120_000, env: { ...process.env, ARC_SPINE_ROOT: SPINE, ARC_REVIEW_SHIP_CI_DIGEST: digest(code) } });
  const gates = () => events().filter((e) => e.kind === "approval.requested");
  const red = ship(1);
  check("ship over red CI: refused as red, no gate lands", red.status === 2 && /is red/.test(red.stderr) && gates().length === 0, red.stderr);
  const gone = ship(2);
  check("ship over a CI that could not be read: named as unreadable, never as red, no gate lands", gone.status === 2 && /could not be read/.test(gone.stderr) && !/is red/.test(gone.stderr) && gates().length === 0, gone.stderr);
  const other = ship(0, "0".repeat(40));
  check("ship naming a SHA that is not HEAD: refused, no gate lands, even over green CI", other.status === 2 && /not this checkout's HEAD/.test(other.stderr) && gates().length === 0, other.stderr);
  const green = ship(0);
  const gid = (/^receipt: approval\.requested ([0-9A-HJKMNP-TV-Z]{26})$/m.exec(green.stdout) || [])[1];
  const gate = events().find((e) => e.id === gid);
  check("ship over green CI: approval.requested{gate: deploy} for HEAD lands, read back by its id", green.status === 0 && Boolean(gate)
    && gate.payload.gate === "deploy" && gate.payload.sha === head && gates().length === 1, `${green.status} ${green.stderr} ${green.stdout}`);

  // No deploy, publish or push anywhere a ship can reach: the process's commands and the writer itself.
  const DEPLOY = /\b(vercel|netlify|wrangler|git\s+push|npm\s+publish|gh\s+release|--prod)\b/i;
  const proc = readFileSync(join(REPO, "processes", "ship-run.process.yaml"), "utf8");
  const commands = [...proc.matchAll(/^\s+- "([^"]+)"$/gm)].map((m) => m[1]);
  check("ship-run grants exactly four commands (vacuous-pass guard)", commands.length === 4, commands.join(" | "));
  check("ship-run's three fixed commands are exact grants; only the writer takes arguments (B5)",
    commands.filter((c) => c.endsWith(":*")).length === 1 && commands.some((c) => c === "node .claude/scripts/hq/review-ship-record.mjs ship:*"), commands.join(" | "));
  const writerCode = readFileSync(WRITER, "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const bodySteps = (proc.split("\nbody: |")[1] || "").split("\n").filter((l) => /`[^`]+`/.test(l) && /^\s+\d\./.test(l)).join("\n");
  check("no step or command of ship-run, and no line of the writer, deploys, publishes or pushes",
    commands.every((c) => !DEPLOY.test(c)) && !DEPLOY.test(bodySteps) && !DEPLOY.test(writerCode)
    // The writer's one git call reads HEAD; any other git verb from it fails this (round-1 B3 added the read).
    && [...writerCode.matchAll(/spawnSync\("git", \[([^\]]*)\]/g)].every((m) => m[1].trim() === '"rev-parse", "HEAD"')
    && [...writerCode.matchAll(/spawnSync\("git"/g)].length === 1);
  check("MUTANT CONTROL: a planted `vercel --prod` step is caught", DEPLOY.test([...commands, "vercel --prod:*"].join("\n")));
  // Approving the deploy gate triggers nothing: no script under .claude/scripts reacts to gate deploy.
  // POSIX classes, not \s: git grep -E has no \s, and a pattern that matches nothing passes this check on silence.
  // Bounded, and its spawn error read first: a git that hangs or is missing is a named FAIL, never a hang (B1).
  const reacts = spawnSync("git", ["grep", "-lE", "gate[\"']?[[:space:]]*[:=]+[[:space:]]*[\"']deploy[\"']", "--", ".claude/scripts"], { cwd: REPO, encoding: "utf8", timeout: 60_000, killSignal: "SIGKILL" });
  check("the gate search ran (git found, finished in time)", !reacts.error && reacts.status !== null, reacts.error ? reacts.error.message : `signal ${reacts.signal}`);
  const named = String(reacts.stdout).split("\n").filter(Boolean);
  check("positive control: the gate search finds the writer itself", named.some((f) => f.endsWith("review-ship-record.mjs")), named.join(","));
  const readers = named.filter((f) => !f.endsWith("review-ship-record.mjs"));
  check("approving {gate: deploy} triggers nothing: only the writer names the gate", reacts.status === 0 && readers.length === 0, readers.join(","));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 20 ? 0 : 1;
