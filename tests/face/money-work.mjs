#!/usr/bin/env node
// money-work.mjs -- the money ring's work verbs, APPLIED in scratch (face v2 Phase 05 PR 5a, ADR-1342).
//
//   ledger-ingest     a settlement export -> one revenue.received per payment, planned then applied, recorded once
//   kill review       arc-pnl --kill-request -> the emit line the door runs (gate venture-kill); refused unreceipted
//   venture-register  ventures.yaml, the passport row and the contract (with what it derives) on a proposal branch,
//                     and the ledger.criteria request for the new digest
//
// Every run uses a scratch spine and a scratch ventures.yaml; the register runs in a scratch repository, and its main is
// checked unmoved. VACUOUS-PASS GUARD: each plan is proven to print a digest, and the last line is "RAN: <n> checks".

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const S = (...p) => join(REPO, ".claude", "scripts", ...p);
const ZERO = "0".repeat(64);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};
const tmp = mkdtempSync(join(tmpdir(), "face-money-work-"));
const spine = (name) => { const d = join(tmp, name); mkdirSync(join(d, "events"), { recursive: true }); return d; };
const spineEvents = (root) => readdirSync(join(root, "events")).filter((n) => n.endsWith(".jsonl")).sort()
  .flatMap((n) => readFileSync(join(root, "events", n), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const lastLine = (out) => String(out).trim().split(/\r?\n/).pop() || "";
const lastExpect = (out) => { try { const j = JSON.parse(lastLine(out)); return typeof j.expect === "string" && /^[0-9a-f]{64}$/.test(j.expect) ? j.expect : null; } catch { return null; } };
const node = (args, env = {}, cwd = REPO) => spawnSync(process.execPath, args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, timeout: 120_000 });

// A registered venture with its kill lines, as the ledger's parser reads them.
const VENTURES = join(tmp, "ventures.yaml");
writeFileSync(VENTURES, "version: 1\nventures:\n  lexos:\n    kill:\n      days_without_revenue: 90\n      traffic_floor_monthly: 100\n");

// ---- ledger-ingest: planned, applied, recorded once ----
{
  const sp = spine("ingest-spine");
  const env = { ARC_SPINE_ROOT: sp, ARC_VENTURES_FILE: VENTURES };
  const exportFile = join(REPO, "tests", "fixtures", "ledger", "razorpay", "01-good-multi-row.csv");
  const A = ["--export", `razorpay=${exportFile}`, "--venture", "lexos"];
  const ing = (...a) => node([S("hq", "ledger-ingest.mjs"), ...a], env);
  const plan = ing(...A, "--dry-run");
  const d = lastExpect(plan.stdout);
  const rows = (plan.stdout.match(/^ {2}record /gm) || []).length;
  check("ingest, planned: a row per payment and a digest; nothing on the spine", plan.status === 0 && !!d && rows >= 2 && spineEvents(sp).length === 0, `${plan.status} ${plan.stderr} ${plan.stdout.slice(-300)}`);
  // The face withholds a plan from the first absolute path on: the export is named by provider and digest, never path.
  check("ingest, planned: the plan names the export by its digest, never by its path", !plan.stdout.includes(exportFile) && /sha256 [0-9a-f]{12}/.test(plan.stdout), plan.stdout.slice(0, 200));
  const unbound = ing(...A);
  check("ingest without a plan's digest refuses -- recording money is bound to a plan", unbound.status === 2 && /bound to a plan/.test(unbound.stderr) && spineEvents(sp).length === 0, unbound.stderr);
  const stale = ing(...A, "--expect", ZERO);
  check("ingest with a digest no plan printed refuses PLAN_STALE and records nothing", stale.status === 2 && /PLAN_STALE/.test(stale.stderr) && spineEvents(sp).length === 0, stale.stderr);
  const ap = ing(...A, "--expect", d || ZERO);
  const got = spineEvents(sp).filter((e) => e.kind === "revenue.received");
  check("ingest, applied: one revenue.received per payment, each for the venture, each printed as a receipt",
    ap.status === 0 && got.length === rows && got.every((e) => e.venture === "lexos" && e.payload.venture === "lexos") && (ap.stdout.match(/receipt: revenue\.received [0-9A-HJKMNP-TV-Z]{26}/g) || []).length === rows,
    `${ap.status} ${ap.stderr} got=${got.length} rows=${rows}`);
  const again = ing(...A, "--dry-run");
  check("ingest, again: every payment already recorded -- refused, nothing to record", again.status === 2 && /already recorded/.test(again.stderr) && spineEvents(sp).filter((e) => e.kind === "revenue.received").length === rows, `${again.status} ${again.stderr}`);
  const other = node([S("hq", "ledger-ingest.mjs"), "--export", `razorpay=${exportFile}`, "--venture", "notreg", "--dry-run"], env);
  check("ingest refuses a venture ventures.yaml does not register", other.status === 2 && /not a registered venture/.test(other.stderr), other.stderr);
  const dup = node([S("hq", "ledger-ingest.mjs"), "--export", `razorpay=${exportFile}`, "--venture", "lexos", "--dry-run"], { ...env, ARC_VENTURES_FILE: (() => { const v = join(tmp, "ventures-two.yaml"); writeFileSync(v, readFileSync(VENTURES, "utf8") + "  other:\n    kill:\n      days_without_revenue: 30\n      traffic_floor_monthly: 10\n"); return v; })() });
  check("ingest with every payment recorded for its venture refuses cleanly under a wider ventures.yaml too", dup.status === 2, dup.stderr);
}

// ---- the kill review: arc-pnl --kill-request prints the emit the door runs ----
{
  const sp = spine("kill-spine");
  const env = { ARC_SPINE_ROOT: sp, ARC_VENTURES_FILE: VENTURES };
  const pnl = (...a) => node([S("hq", "arc-pnl.mjs"), ...a], env);
  const unreceipted = pnl("--kill-request", "lexos", "--reason", "ninety days without a sale");
  check("kill review refuses while the criteria are unreceipted -- the lines are not the owner's yet", unreceipted.status === 2 && /UNRECEIPTED/.test(unreceipted.stderr), `${unreceipted.status} ${unreceipted.stderr}`);
  // Receipt the criteria: the request (its idem welded to the digest) and an approval through arc-inbox.
  const digest = pnl("--criteria-digest").stdout.trim();
  const idem = createHash("sha256").update(`ledger.criteria|${digest}`).digest("hex");
  const req = node([S("hq", "arc-event.mjs"), "emit", "approval.requested", "--payload", JSON.stringify({ subject: "ledger.criteria", digest, what: "money-work fixture" }), "--idem", idem, "--strict"], env);
  const approve = node([S("hq", "arc-inbox.mjs"), "approve", req.stdout.trim(), "--reason", "money-work fixture"], env);
  check("kill fixture: the criteria are receipted (vacuous-pass guard)", /^[0-9a-f]{64}$/.test(digest) && req.status === 0 && approve.status === 0, `${req.stderr} ${approve.stderr}`);
  const r = pnl("--kill-request", "lexos", "--reason", "ninety days without a sale");
  let emit = null;
  try { emit = JSON.parse(lastLine(r.stdout)).emit; } catch { /* checked below */ }
  const payload = emit ? JSON.parse(emit[emit.indexOf("--payload") + 1]) : null;
  check("kill review: the last line is the emit -- approval.requested, gate venture-kill, the criteria digest, the lines read now",
    r.status === 0 && Array.isArray(emit) && emit[1] === "approval.requested" && payload && payload.gate === "venture-kill" && payload.venture === "lexos" && payload.criteria_digest === digest && Array.isArray(payload.lines) && payload.lines.length === 2 && Array.isArray(payload.crossed),
    `${r.status} ${r.stderr} ${lastLine(r.stdout).slice(0, 200)}`);
  const OPS = await import(pathToFileURL(S("hq", "face-ops.mjs")).href);
  const row = OPS.OPS.find((o) => o.id === "ventures.kill-review");
  let doorArgv = null;
  try { doorArgv = OPS.emitPlanFrom(row, r.stdout); } catch (e) { doorArgv = String(e.code || e); }
  check("kill review: the door accepts the emit line for its row (the kind, the closed flag set, --strict)", Array.isArray(doorArgv) && doorArgv[1] === "approval.requested", JSON.stringify(doorArgv));
  const nobody = pnl("--kill-request", "nobody", "--reason", "x");
  check("kill review refuses a venture ventures.yaml does not name", nobody.status === 2 && /NO_VENTURE/.test(nobody.stderr), nobody.stderr);
  const stray = pnl("--reason", "x");
  check("--reason without --kill-request is refused, never dropped", stray.status === 2 && /belongs with --kill-request/.test(stray.stderr), stray.stderr);
}

// ---- venture-register: a proposal branch and the criteria request ----
{
  const repo = join(tmp, "register-repo");
  cpSync(join(REPO, ".claude", "scripts"), join(repo, ".claude", "scripts"), { recursive: true });
  const files = ["ventures.yaml", "PORTFOLIO.md", "initiatives/face/contracts/expected-set.json", "initiatives/face/contracts/room-copy.json", "initiatives/face/contracts/rooms.generated.json"];
  for (const p of readdirSync(join(REPO, "products"))) if (existsSync(join(REPO, "products", p, "manifest.json"))) files.push(`products/${p}/manifest.json`);
  for (const p of files) { mkdirSync(dirname(join(repo, p)), { recursive: true }); writeFileSync(join(repo, p), readFileSync(join(REPO, p))); }
  const g = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
  g("init", "-q", "-b", "main");
  g("config", "user.name", "fixture"); g("config", "user.email", "fixture@example.invalid"); g("config", "commit.gpgsign", "false"); g("config", "core.autocrlf", "false");
  g("add", "-A"); g("commit", "-q", "-m", "scratch");
  const mainBefore = g("rev-parse", "refs/heads/main").stdout.trim();
  const clean = () => g("status", "--porcelain").stdout === "" && g("rev-parse", "refs/heads/main").stdout.trim() === mainBefore;
  check("register fixture: the scratch repository is committed on main (vacuous-pass guard)", /^[0-9a-f]{40}$/.test(mainBefore));
  const sp = spine("register-spine");
  const reg = (...a) => node([join(repo, ".claude", "scripts", "hq", "venture-register.mjs"), ...a], { ARC_SPINE_ROOT: sp }, repo);
  const A = ["--slug", "probe-venture", "--days-without-revenue", "60", "--traffic-floor", "50", "--repository", "private, separate repo"];
  const plan = reg(...A, "--dry-run");
  const d = lastExpect(plan.stdout);
  check("register, planned: ventures.yaml, the passport row and the contract on one branch, a digest; nothing written",
    plan.status === 0 && !!d && ["ventures.yaml", "PORTFOLIO.md", "initiatives/face/contracts/expected-set.json"].every((p) => plan.stdout.includes(`b/${p}`)) && clean() && spineEvents(sp).length === 0,
    `${plan.status} ${plan.stderr}`);
  const ap = reg(...A, "--expect", d || ZERO);
  const branch = "feat/face-ventures-register-probe-venture";
  const onBranch = g("show", `${branch}:ventures.yaml`).stdout;
  const VEN = await import(pathToFileURL(S("hq", "lib", "ledger", "ventures.mjs")).href);
  let newDigest = "";
  try { newDigest = VEN.parseVentures(onBranch).digest; } catch { /* checked below */ }
  const req = spineEvents(sp).find((e) => e.kind === "approval.requested");
  check("register, applied: the branch holds the new venture, main is untouched, and the criteria request carries the NEW digest",
    ap.status === 0 && /probe-venture:/.test(onBranch) && clean() && !!req && req.payload.subject === "ledger.criteria" && req.payload.digest === newDigest && req.idem === createHash("sha256").update(`ledger.criteria|${newDigest}`).digest("hex"),
    `${ap.status} ${ap.stderr} ${JSON.stringify(req && req.payload)}`);
  for (const [why, args, re] of [
    ["a venture already registered", ["--slug", "lexos"], /already in ventures\.yaml/],
    ["arc, the factory's own overhead", ["--slug", "arc"], /overhead/],
  ]) {
    const r = reg(...args, "--days-without-revenue", "60", "--traffic-floor", "50", "--repository", "x", "--dry-run");
    check(`register refuses ${why}`, r.status === 2 && re.test(r.stderr), r.stderr);
  }
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran >= 18 ? 0 : 1);
