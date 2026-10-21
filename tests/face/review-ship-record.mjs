// review-ship-record.mjs -- the review-ship writer and the two processes it seals (face Cycle 17 P02, REQ-06, ADR-1366).
//
// qa lands qa.completed on a scratch spine and is read back by the id it printed; ship over a CI that is not green
// raises no deploy gate and lands nothing; ship-run's steps and the writer name no deploy, publish or push (a planted
// `vercel` step is the negative control). Node only, no install; the green-CI half runs live, on the owner's clone.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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
  // --as-process first: a URL followed later by `name@x.y.z` on one line reads as `scheme://user:pass@` to the scanner.
  const qa = run(["qa", "--as-process", "qa-run@1.0.0", "--url", "http://localhost:3000", "--bugs", "2", "--fixed", "1"]);
  const id = (/^receipt: qa\.completed ([0-9A-HJKMNP-TV-Z]{26})$/m.exec(qa.stdout) || [])[1];
  const hit = events().find((e) => e.id === id);
  check("qa: lands qa.completed, read back off the spine by the id it printed", qa.status === 0 && Boolean(hit) && hit.kind === "qa.completed"
    && hit.payload.url === "http://localhost:3000" && hit.payload.bugs === "2" && hit.payload.fixed === "1", `${qa.status} ${qa.stderr} ${qa.stdout}`);
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

  // ship: a SHA CI has no green run for raises no gate -- the writer reads CI itself, a run cannot vouch for it.
  const ship = run(["ship", "--sha", "0".repeat(40), "--as-process", "ship-run@1.0.0"]);
  check("ship over a CI that is not green: refused, no approval.requested lands", ship.status === 2 && /not green/.test(ship.stderr)
    && events().length === before && !events().some((e) => e.kind === "approval.requested"), `${ship.status} ${ship.stderr}`);

  // No deploy, publish or push anywhere a ship can reach: the process's commands and the writer itself.
  const DEPLOY = /\b(vercel|netlify|wrangler|git\s+push|npm\s+publish|gh\s+release|--prod)\b/i;
  const proc = readFileSync(join(REPO, "processes", "ship-run.process.yaml"), "utf8");
  const commands = [...proc.matchAll(/^\s+- "([^"]+)"$/gm)].map((m) => m[1]);
  check("ship-run grants exactly four commands (vacuous-pass guard)", commands.length === 4, commands.join(" | "));
  const writerCode = readFileSync(WRITER, "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const bodySteps = (proc.split("\nbody: |")[1] || "").split("\n").filter((l) => /`[^`]+`/.test(l) && /^\s+\d\./.test(l)).join("\n");
  check("no step or command of ship-run, and no line of the writer, deploys, publishes or pushes",
    commands.every((c) => !DEPLOY.test(c)) && !DEPLOY.test(bodySteps) && !DEPLOY.test(writerCode) && !/spawnSync\([^)]*git/.test(writerCode));
  check("MUTANT CONTROL: a planted `vercel --prod` step is caught", DEPLOY.test([...commands, "vercel --prod:*"].join("\n")));
  // Approving the deploy gate triggers nothing: no script under .claude/scripts reacts to gate deploy.
  // POSIX classes, not \s: git grep -E has no \s, and a pattern that matches nothing passes this check on silence.
  const reacts = spawnSync("git", ["grep", "-lE", "gate[\"']?[[:space:]]*[:=]+[[:space:]]*[\"']deploy[\"']", "--", ".claude/scripts"], { cwd: REPO, encoding: "utf8" });
  const named = String(reacts.stdout).split("\n").filter(Boolean);
  check("positive control: the gate search finds the writer itself", named.some((f) => f.endsWith("review-ship-record.mjs")), named.join(","));
  const readers = named.filter((f) => !f.endsWith("review-ship-record.mjs"));
  check("approving {gate: deploy} triggers nothing: only the writer names the gate", reacts.status === 0 && readers.length === 0, readers.join(","));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 12 ? 0 : 1;
