// hunt-op.mjs -- the face's discover.hunt op (face Cycle 17 P03, REQ-09, ADR-1369), through the work door itself.
//
// The plan runs the hunt WITHOUT --emit and writes no receipt; the apply lands run.completed{step: hunt}; the niche is
// never on any argv the door or the hunt-op spawns; the niche file is named from its hash and gone after the run; a bad
// niche plans nothing and writes no file; a hunt still running refuses a second (HUNT_RUNNING). On a scratch spine the
// hunt reads recorded HN, so this suite never touches the network.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
let ran = 0, failed = 0;
const check = (name, cond, detail = "") => { ran++; if (cond) console.log(`ok ${name}`); else { failed++; console.log(`FAIL ${name} ${detail}`); } };

const tmp = mkdtempSync(join(tmpdir(), "hunt-op-"));
const SPINE = join(tmp, "spine");
mkdirSync(join(SPINE, "events"), { recursive: true });
process.env.ARC_SPINE_ROOT = SPINE;
const OPS = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "face-ops.mjs")).href);
const DOOR = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "face", "work-door.mjs")).href);
const HUNT = await import(pathToFileURL(join(REPO, ".claude", "scripts", "discover", "hunt-op.mjs")).href);
const events = () => readdirSync(join(SPINE, "events")).filter((f) => f.endsWith(".jsonl"))
  .flatMap((f) => readFileSync(join(SPINE, "events", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const NICHE = "invoice reminders";
const files = HUNT.nichePaths(NICHE);

try {
  console.log("RAN hunt-op checks");
  const op = OPS.OPS.find((o) => o.id === "discover.hunt");
  check("discover.hunt is a registry op on the discover room, sealed by run.completed", Boolean(op) && op.room === "discover" && op.receipt.kind === "run.completed");
  const planCmd = op.plan({ niche: NICHE }), applyCmd = op.apply({ niche: NICHE });
  check("the niche is never on argv -- only in the environment", ![...planCmd.args, ...applyCmd.args].join(" ").includes("invoice")
    && planCmd.env.ARC_HUNT_NICHE === NICHE && applyCmd.args.join(" ") === "--emit" && planCmd.args.length === 0, JSON.stringify([planCmd.args, applyCmd.args]));
  check("MUTANT CONTROL: a builder that puts the niche on argv is caught", ["hunt", "--niche", NICHE].join(" ").includes("invoice"));
  // The hunt child's env carries no token and no niche (B4), and a spine inside the repo is not a scratch one.
  const env = HUNT.huntEnv({ PATH: "x", GH_TOKEN: "t", ARC_LLM_API_KEY: "k", ARC_HUNT_NICHE: NICHE, ARC_SPINE_ROOT: "/tmp/s" });
  check("the hunt child gets PATH and the spine, never a token or the niche", env.PATH === "x" && env.ARC_SPINE_ROOT === "/tmp/s" && !("GH_TOKEN" in env) && !("ARC_LLM_API_KEY" in env) && !("ARC_HUNT_NICHE" in env), JSON.stringify(Object.keys(env)));
  check("a spine root inside the repo is not a scratch spine", HUNT.isScratchSpine({ ARC_SPINE_ROOT: join(REPO, ".claude", "state", "hq") }) === false && HUNT.isScratchSpine({ ARC_SPINE_ROOT: SPINE }) === true);

  const door = DOOR.createWorkDoor({ mode: "sim", root: SPINE, repo: REPO }, {});
  const before = events().length;
  let bad = "";
  try { await door.plan("discover.hunt", { input: { niche: "Invoice; rm -rf /" } }); bad = "PLANNED"; } catch (e) { bad = e.code; }
  check("a niche outside discover's grammar is refused at plan, and no niche file is written", bad === "BAD_INPUT" && !existsSync(files.dir) || (bad === "BAD_INPUT" && readdirSync(files.dir).every((f) => !f.startsWith("niche-"))), bad);

  const plan = await door.plan("discover.hunt", { input: { niche: NICHE } });
  check("the plan ran the hunt and wrote no receipt", plan.ok === true && events().length === before && !existsSync(files.file), JSON.stringify(plan).slice(0, 300));
  const run = door.apply("discover.hunt", { planId: plan.planId });
  await door.settled();
  const done = door.run(plan.planId);
  const hunt = events().find((e) => e.kind === "run.completed" && e.payload && e.payload.step === "hunt");
  check("the apply landed run.completed{step: hunt}, credited to the run", done.state === "done" && done.result.ok === true && Boolean(hunt) && done.result.receipt.id === hunt.id, JSON.stringify(done.result).slice(0, 300));
  check("the niche file and its lock are gone after the run", !existsSync(files.file) && !existsSync(files.lock));
  let again = "";
  try { door.apply("discover.hunt", { planId: plan.planId }); again = "APPLIED"; } catch (e) { again = e.code || "THREW"; }
  check("a second apply of one plan id runs nothing new", (again === "APPLIED" ? run.replayed !== true : true) && events().filter((e) => e.kind === "run.completed").length === 1, again);

  // A lock whose holder is dead is stale and is cleared: a killed run never wedges the niche (attack c551846 B2).
  mkdirSync(files.dir, { recursive: true });
  writeFileSync(files.lock, `999999999 ${Date.now()}`);
  const stale = await door.plan("discover.hunt", { input: { niche: NICHE } });
  check("a stale lock (its pid dead) is cleared and the plan runs", stale.ok === true && !existsSync(files.lock), JSON.stringify(stale).slice(0, 200));
  // A hunt for this niche still running (its lock held by a live pid) refuses a second, and writes no niche file.
  writeFileSync(files.lock, `${process.pid} ${Date.now()}`);
  const busy = await door.plan("discover.hunt", { input: { niche: NICHE } });
  check("a plan while a hunt for the niche runs is refused HUNT_RUNNING", busy.ok === false && /HUNT_RUNNING/.test(JSON.stringify(busy.refusal)) && !existsSync(files.file), JSON.stringify(busy).slice(0, 300));
  // A lock held by a live pid but older than any hunt can run is stale: a reused pid never wedges (attack 54ad42f B2).
  writeFileSync(files.lock, `${process.pid} ${Date.now() - 200_000}`);
  const aged = await door.plan("discover.hunt", { input: { niche: NICHE } });
  check("a lock older than any hunt is stale even when its pid is alive", aged.ok === true, JSON.stringify(aged).slice(0, 200));
  rmSync(files.lock, { force: true });
} finally {
  rmSync(files.lock, { force: true });
  rmSync(files.file, { force: true });
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 12 ? 0 : 1;
