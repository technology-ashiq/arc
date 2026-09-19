#!/usr/bin/env node
// factory-ring.mjs -- the factory ring's tools, APPLIED in scratch repositories (face v2 Phase 05 PR 4, ADR-1341).
//
// Each tool's apply path is proven here and never on the real repo: a scratch repository with the files the tool reads
// on main, a spine of its own, and the owner's tree checked unmoved after every write.
//   develop next      plan (--dry-run) -> apply (--expect): the ledger's sources: line, a note.logged receipt
//   open-brief        design-explore.sh init into a scratch dir -> a proposal branch, approval.requested (design-explore)
//   pick              approval.requested (design-pick) bound to the three variants' bytes; recorded once
//   profile-request   approval.requested (gate profile, ADR-0008); .claude/settings.json never written
//   propose retire    a hire ended on a proposal branch: its driver back to the default, its tenure terms gone
//   agent-scaffold    four files on a proposal branch -- the agent, its manifest line, its golden line, its room
//   the door          touchesTree is an effect a sim door refuses at apply (SIM_EFFECT)
//
// VACUOUS-PASS GUARD: every scratch repository is proven committed on main, every plan proven to print a digest; the
// last line is "RAN: <n> checks".

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
const tmp = mkdtempSync(join(tmpdir(), "face-factory-ring-"));
const spine = (name) => { const d = join(tmp, name); mkdirSync(join(d, "events"), { recursive: true }); return d; };
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const spineEvents = (root) => readdirSync(join(root, "events")).filter((n) => n.endsWith(".jsonl")).sort()
  .flatMap((n) => readFileSync(join(root, "events", n), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const approvals = (root) => spineEvents(root).filter((e) => e.kind === "approval.requested");
const lastExpect = (stdout) => {
  try { const j = JSON.parse(String(stdout).trim().split(/\r?\n/).pop() || ""); return typeof j.expect === "string" && /^[0-9a-f]{64}$/.test(j.expect) ? j.expect : null; } catch { return null; }
};
const receiptOf = (stdout) => (/receipt: \S+ ([0-9A-HJKMNP-TV-Z]{26})/.exec(String(stdout)) || [])[1] || "";

/**
 * A scratch repository: the scripts, the named files copied from this repo (or written), committed on main.
 * @param {string} name @param {Record<string, string | true>} files -- true copies the repo's own file
 */
function scratchRepo(name, files) {
  const repo = join(tmp, name);
  cpSync(join(REPO, ".claude", "scripts"), join(repo, ".claude", "scripts"), { recursive: true });
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, p)), { recursive: true });
    writeFileSync(join(repo, p), content === true ? readFileSync(join(REPO, p)) : content);
  }
  const g = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
  g("init", "-q", "-b", "main");
  g("config", "user.name", "fixture"); g("config", "user.email", "fixture@example.invalid"); g("config", "commit.gpgsign", "false"); g("config", "core.autocrlf", "false");
  g("add", "-A"); g("commit", "-q", "-m", "scratch");
  const mainBefore = g("rev-parse", "refs/heads/main").stdout.trim();
  const clean = () => g("status", "--porcelain").stdout === "" && g("symbolic-ref", "HEAD").stdout.trim() === "refs/heads/main" && g("rev-parse", "refs/heads/main").stdout.trim() === mainBefore;
  check(`${name}: scratch repository committed on main (vacuous-pass guard)`, /^[0-9a-f]{40}$/.test(mainBefore));
  const sp = spine(`${name}-spine`);
  const tool = (script, args, env = {}) => spawnSync(process.execPath, [join(repo, ".claude", "scripts", ...script.split("/")), ...args],
    { cwd: repo, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: sp, ...env }, timeout: 120_000 });
  return { repo, g, clean, mainBefore, sp, tool };
}

// ---- develop next: the plan shows the slice and writes nothing; the apply writes exactly the planned ledger ----
{
  const t = join(tmp, "develop-tree");
  cpSync(join(REPO, "tests", "fixtures", "develop", "fake-phase"), t, { recursive: true });
  // The room shows a slice only for a LIVE lane whose header names a numbered phase, and the verb writes only there.
  writeFileSync(join(t, "initiatives", "develop", "PROGRESS.md"), "# PROGRESS\n\nstatus: LIVE\nphase: 00\n\n## Now\n");
  const sp = spine("develop-spine");
  const dev = (...a) => spawnSync(process.execPath, [S("develop", "develop.mjs"), ...a, "--lane", "develop", "--root", t], { cwd: REPO, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: sp }, timeout: 120_000 });
  const started = dev("start", "0");
  const ledger = join(t, "initiatives", "develop", "phases", "phase-00-tasks.md");
  check("develop fixture: start 0 wrote the slice ledger (vacuous-pass guard)", started.status === 0 && existsSync(ledger), `${started.status} ${started.stdout.slice(-200)}`);
  const ledgerBefore = existsSync(ledger) ? sha256(readFileSync(ledger)) : "";
  const eventsBefore = spineEvents(sp).length;
  const plan = dev("next", "--dry-run");
  const d = lastExpect(plan.stdout);
  check("develop next, planned: the slice and a digest, the ledger unchanged and no receipt", plan.status === 0 && !!d && /slice 01/.test(plan.stdout) && sha256(readFileSync(ledger)) === ledgerBefore && spineEvents(sp).length === eventsBefore, `${plan.status} ${plan.stdout.slice(-300)}`);
  const stale = dev("next", "--expect", ZERO);
  check("develop next with a digest no plan printed refuses (PLAN_STALE) and writes nothing", stale.status !== 0 && /PLAN_STALE/.test(stale.stdout + stale.stderr) && sha256(readFileSync(ledger)) === ledgerBefore && spineEvents(sp).length === eventsBefore, `${stale.status} ${stale.stdout.slice(-200)}`);
  const both = dev("next", "--dry-run", "--expect", d || ZERO);
  check("develop next refuses --dry-run and --expect together", both.status !== 0 && sha256(readFileSync(ledger)) === ledgerBefore, `${both.status}`);
  const ap = dev("next", "--expect", d || ZERO);
  const rec = spineEvents(sp).find((e) => e.id === receiptOf(ap.stdout));
  check("develop next, applied: the ledger moved and its receipt names the slice (note.logged develop.next)", ap.status === 0 && sha256(readFileSync(ledger)) !== ledgerBefore && !!rec && rec.kind === "note.logged" && rec.payload.note === "develop.next" && rec.payload.slice === "01", `${ap.status} ${ap.stdout.slice(-300)}`);
  const ledgerApplied = sha256(readFileSync(ledger));
  const again = dev("next", "--expect", d || ZERO);
  // Either refusal holds the line: the no-op check ("nothing to record") runs before the digest is compared, and a
  // second apply of a pack already written is exactly that no-op.
  check("develop next, the same plan applied twice: refused (nothing to record, or PLAN_STALE) and the ledger holds", ap.status === 0 && again.status !== 0 && /PLAN_STALE|nothing to record/.test(again.stdout + again.stderr) && sha256(readFileSync(ledger)) === ledgerApplied, `${again.status} ${again.stdout.slice(-200)} ${again.stderr.slice(-200)}`);
  // A plan that would write nothing is refused: applied, it only emitted receipts, one per click (PR 4 logic attack).
  const noop = dev("next", "--dry-run");
  check("develop next with nothing left to record refuses its plan -- no receipt per click", noop.status === 2 && /nothing to record/.test(noop.stdout), `${noop.status} ${noop.stdout.slice(-200)}`);
}

// ---- develop next writes only where the room shows a slice, and raises slice.done once per slice ----
{
  const tree = (name, header) => {
    const t = join(tmp, name);
    cpSync(join(REPO, "tests", "fixtures", "develop", "fake-phase"), t, { recursive: true });
    writeFileSync(join(t, "initiatives", "develop", "PROGRESS.md"), `# PROGRESS\n\n${header}\n\n## Now\n`);
    return t;
  };
  const devIn = (t, sp, ...a) => spawnSync(process.execPath, [S("develop", "develop.mjs"), ...a, "--lane", "develop", "--root", t], { cwd: REPO, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: sp }, timeout: 120_000 });
  // A closed cycle's ledger is never the verb's: the room does not show it (PR 4 round-2 logic attack).
  for (const [name, header, re] of [
    ["develop-idle", "status: IDLE\nphase: 00", /lane is IDLE/],
    ["develop-closed", "status: LIVE\nphase: 08 (cycle closed)", /names no phase number/],
  ]) {
    const t = tree(name, header);
    const sp = spine(`${name}-spine`);
    const st = devIn(t, sp, "start", "0");
    const ledger = join(t, "initiatives", "develop", "phases", "phase-00-tasks.md");
    const before = existsSync(ledger) ? sha256(readFileSync(ledger)) : "";
    const r = devIn(t, sp, "next", "--dry-run");
    check(`develop next refuses a lane the room does not show (${name}) and writes nothing`, st.status === 0 && r.status === 2 && re.test(r.stdout) && sha256(readFileSync(ledger)) === before, `${r.status} ${r.stdout.slice(-240)}`);
  }
  // Slice 01 proven, slice 02 next: two applies (the session reset slice 02's sources between them) raise ONE slice.done.
  const t = tree("develop-once", "status: LIVE\nphase: 00");
  const sp = spine("develop-once-spine");
  const st = devIn(t, sp, "start", "0");
  const ledger = join(t, "initiatives", "develop", "phases", "phase-00-tasks.md");
  const text0 = readFileSync(ledger, "utf8");
  const blockAt = (txt, id) => txt.indexOf(`#### slice: ${id}`);
  const proveOne = (txt) => {
    const a = blockAt(txt, "01"), b = blockAt(txt, "02");
    return txt.slice(0, a) + txt.slice(a, b).replace(/^result: .*$/m, "result: passed").replace(/^commit: .*$/m, "commit: abc1234") + txt.slice(b);
  };
  writeFileSync(ledger, proveOne(text0));
  const resetTwo = () => {
    const txt = readFileSync(ledger, "utf8");
    const a = blockAt(txt, "02");
    const end = txt.indexOf("#### slice:", a + 5);
    const block = txt.slice(a, end < 0 ? txt.length : end).replace(/^sources: .*$/m, "sources: phase-00-spec.md");
    writeFileSync(ledger, txt.slice(0, a) + block + (end < 0 ? "" : txt.slice(end)));
  };
  const applyOnce = () => { const d = lastExpect(devIn(t, sp, "next", "--dry-run").stdout); return { d, r: devIn(t, sp, "next", "--expect", d || ZERO) }; };
  const first = applyOnce();
  resetTwo();
  const second = applyOnce();
  const dones = spineEvents(sp).filter((e) => e.kind === "slice.done" && e.payload.slice === "01").length;
  check("develop next: two applies after slice 01 is proven raise ONE slice.done for it (both applies ran)", st.status === 0 && !!first.d && !!second.d && first.r.status === 0 && second.r.status === 0 && dones === 1, `first=${first.r.status} second=${second.r.status} dones=${dones} ${second.r.stdout.slice(-200)}`);
  // Re-proven at a NEW commit, the slice raises its slice.done again: the match carries the commit (PR 4 round 3).
  {
    const txt = readFileSync(ledger, "utf8");
    const a = blockAt(txt, "01"), b = blockAt(txt, "02");
    writeFileSync(ledger, txt.slice(0, a) + txt.slice(a, b).replace(/^commit: .*$/m, "commit: 9f8e7d6c") + txt.slice(b));
    resetTwo();
    const third = applyOnce();
    const byCommit = spineEvents(sp).filter((e) => e.kind === "slice.done" && e.payload.slice === "01").map((e) => e.payload.commit).sort();
    check("develop next: a slice re-proven at a new commit raises its slice.done for that commit", third.r.status === 0 && JSON.stringify(byCommit) === JSON.stringify(["9f8e7d6c", "abc1234"]), `${third.r.status} ${JSON.stringify(byCommit)} ${third.r.stdout.slice(-200)}`);
  }
  // A day the spine cannot read: whether slice.done is due is unknown, so the apply refuses with nothing written.
  {
    const txt = readFileSync(ledger, "utf8");
    const a = blockAt(txt, "01"), b = blockAt(txt, "02");
    writeFileSync(ledger, txt.slice(0, a) + txt.slice(a, b).replace(/^commit: .*$/m, "commit: 1a2b3c4d") + txt.slice(b));
    resetTwo();
    mkdirSync(join(sp, "events", "2020-01-01.jsonl"), { recursive: true });
    const before = sha256(readFileSync(ledger));
    const d4 = lastExpect(devIn(t, sp, "next", "--dry-run").stdout);
    const r4 = devIn(t, sp, "next", "--expect", d4 || ZERO);
    check("develop next: a day file the spine cannot read refuses the apply before the ledger is written", !!d4 && r4.status === 2 && /cannot be read/.test(r4.stdout) && sha256(readFileSync(ledger)) === before, `${r4.status} ${r4.stdout.slice(-240)}`);
    rmSync(join(sp, "events", "2020-01-01.jsonl"), { recursive: true, force: true });
  }
  // The lane's status compared EXACTLY as the room compares it: "live" is not LIVE (PR 4 round 3).
  {
    const tl = tree("develop-lower", "status: live\nphase: 00");
    const spl = spine("develop-lower-spine");
    devIn(tl, spl, "start", "0");
    const rl = devIn(tl, spl, "next", "--dry-run");
    check("develop next refuses a lane whose status is lowercase live -- the room shows LIVE alone", rl.status === 2 && /lane is live/.test(rl.stdout), `${rl.status} ${rl.stdout.slice(-200)}`);
  }
}

// ---- open-brief: design-explore init into a scratch dir, committed to a proposal branch ----
{
  const { g, clean, mainBefore, sp, tool } = scratchRepo("open-brief-repo", { "docs/briefs/probe.md": "# A brief\n\nOne surface, three explores.\n" });
  const A = ["--id", "probe-explore", "--brief", "docs/briefs/probe.md"];
  const plan = tool("design/open-brief.mjs", [...A, "--dry-run"]);
  const d = lastExpect(plan.stdout);
  check("open-brief, planned: the scaffold's diff and a digest; nothing written", plan.status === 0 && !!d && /variant-a\/tokens\.css/.test(plan.stdout) && clean() && approvals(sp).length === 0, `${plan.status} ${plan.stderr}`);
  const stale = tool("design/open-brief.mjs", [...A, "--expect", ZERO]);
  check("open-brief with a digest no plan printed refuses (PLAN_STALE) and writes nothing", stale.status === 2 && /PLAN_STALE/.test(stale.stderr) && clean() && approvals(sp).length === 0, stale.stderr);
  const unbound = tool("design/open-brief.mjs", A);
  check("open-brief with no plan digest refuses -- an apply is bound to a plan", unbound.status === 2 && /bound to a plan/.test(unbound.stderr), unbound.stderr);
  const ap = tool("design/open-brief.mjs", [...A, "--expect", d || ZERO]);
  const branch = "feat/face-design-explore-probe-explore";
  const files = g("ls-tree", "-r", "--name-only", branch, "--", "docs/design/explore/probe-explore").stdout.trim().split("\n").filter(Boolean).sort();
  const explore = g("show", `${branch}:docs/design/explore/probe-explore/explore.txt`).stdout;
  check("open-brief, applied: the scaffold is on its branch -- explore.txt, base-revision.txt, three variants -- and the tree unmoved",
    ap.status === 0 && files.length === 5 && ["a", "b", "c"].every((v) => files.includes(`docs/design/explore/probe-explore/variant-${v}/tokens.css`)) && /^brief=docs\/briefs\/probe\.md$/m.test(explore) && explore.includes(`base=${mainBefore.slice(0, 12)}`) && clean(),
    `${ap.status} ${ap.stderr} ${files.join(",")}`);
  const appr = approvals(sp).find((e) => e.id === receiptOf(ap.stdout));
  check("open-brief, applied: the approval (gate design-explore) names the branch and its commit", !!appr && appr.payload.gate === "design-explore" && appr.payload.branch === branch && appr.payload.commit === g("rev-parse", branch).stdout.trim() && appr.payload.brief === "docs/briefs/probe.md");
  const twice = tool("design/open-brief.mjs", [...A, "--dry-run"]);
  check("open-brief of the same id again refuses (BRANCH_EXISTS)", twice.status === 2 && /BRANCH_EXISTS/.test(twice.stderr), twice.stderr);
  const missing = tool("design/open-brief.mjs", ["--id", "probe-two", "--brief", "docs/briefs/missing.md", "--dry-run"]);
  check("open-brief of a brief main does not hold refuses, and names it", missing.status === 2 && /not on main/.test(missing.stderr), missing.stderr);
}

// ---- pick: an approval bound to the variants' bytes, recorded once ----
{
  const variants = Object.fromEntries(["a", "b", "c"].map((v) => [`docs/design/explore/pick-probe/variant-${v}/index.html`, `<!doctype html><title>${v}</title>\n`]));
  const { repo, g, clean, sp, tool } = scratchRepo("pick-repo", {
    ...variants,
    "docs/design/explore/picked-already/variant-a/index.html": "a\n", "docs/design/explore/picked-already/variant-b/index.html": "b\n",
    "docs/design/explore/picked-already/variant-c/index.html": "c\n", "docs/design/explore/picked-already/PICK.md": "picked: a\n",
  });
  const A = ["--explore", "pick-probe", "--pick", "b", "--why", "b reads clearest at a glance"];
  const plan = tool("design/pick.mjs", [...A, "--dry-run"]);
  const d = lastExpect(plan.stdout);
  check("pick, planned: a digest, and nothing raised", plan.status === 0 && !!d && approvals(sp).length === 0 && clean(), `${plan.status} ${plan.stderr}`);
  // A variant rebuilt between the plan and the click is a new plan (the digest binds every variant's bytes).
  writeFileSync(join(repo, "docs", "design", "explore", "pick-probe", "variant-c", "index.html"), "<!doctype html><title>c, rebuilt</title>\n");
  const moved = tool("design/pick.mjs", [...A, "--expect", d || ZERO]);
  check("pick, applied after a variant was rebuilt, refuses (PLAN_STALE) and raises nothing", moved.status === 2 && /PLAN_STALE/.test(moved.stderr) && approvals(sp).length === 0, moved.stderr);
  const d2 = lastExpect(tool("design/pick.mjs", [...A, "--dry-run"]).stdout);
  const ap = tool("design/pick.mjs", [...A, "--expect", d2 || ZERO]);
  const appr = approvals(sp).find((e) => e.id === receiptOf(ap.stdout));
  const fp = (() => {
    const dir = join(repo, "docs", "design", "explore", "pick-probe", "variant-b");
    return sha256(readdirSync(dir).sort().map((n) => `${n}\t${sha256(readFileSync(join(dir, n)))}`).join("\n"));
  })();
  check("pick, applied: approval.requested (gate design-pick) names the explore, the variant, the reason and the variant's fingerprint",
    ap.status === 0 && !!appr && appr.payload.gate === "design-pick" && appr.payload.explore_dir === "docs/design/explore/pick-probe/" && appr.payload.pick === "b" && appr.payload.why === "b reads clearest at a glance" && appr.payload.variant_sha === fp, `${ap.status} ${ap.stderr}`);
  const again = tool("design/pick.mjs", [...A, "--dry-run"]);
  check("pick of the same explore again refuses -- a pick is recorded once (the spine holds it)", again.status === 2 && /recorded once/.test(again.stderr), again.stderr);
  const done = tool("design/pick.mjs", ["--explore", "picked-already", "--pick", "a", "--why", "x", "--dry-run"]);
  check("pick of an explore that has a PICK.md refuses", done.status === 2 && /PICK\.md/.test(done.stderr), done.stderr);
  const noWhy = tool("design/pick.mjs", ["--explore", "pick-probe", "--pick", "a", "--dry-run"]);
  check("pick without a reason refuses -- a pick carries its reason", noWhy.status === 2 && /--why is required/.test(noWhy.stderr), noWhy.stderr);
  // The one change in the tree is the variant the suite rebuilt itself; pick wrote nothing.
  check("pick wrote no file: the only change in the tree is the variant the suite rebuilt", g("status", "--porcelain").stdout.trim() === "M docs/design/explore/pick-probe/variant-c/index.html", g("status", "--porcelain").stdout);
}

// ---- profile-request: the approval that asks; settings.json is never written ----
{
  const { repo, clean, sp, tool } = scratchRepo("profile-repo", { ".claude/settings.json": true });
  const settingsBefore = sha256(readFileSync(join(repo, ".claude", "settings.json")));
  const tries = ["starter", "standard", "strict"].map((to) => ({ to, r: tool("core/profile-request.mjs", ["--to", to, "--why", "the factory suite asks", "--dry-run"]) }));
  const current = tries.find((x) => x.r.status === 2 && /already/.test(x.r.stderr));
  const other = tries.find((x) => x.r.status === 0);
  check("profile-request: exactly one profile is in force, and a switch to it is refused (vacuous-pass guard)", !!current && !!other && tries.filter((x) => x.r.status === 0).length === 2, tries.map((x) => `${x.to}:${x.r.status}`).join(" "));
  const d = other ? lastExpect(other.r.stdout) : null;
  const stale = tool("core/profile-request.mjs", ["--to", other ? other.to : "strict", "--why", "the factory suite asks", "--expect", ZERO]);
  check("profile-request with a digest no plan printed refuses (PLAN_STALE)", stale.status === 2 && /PLAN_STALE/.test(stale.stderr) && approvals(sp).length === 0, stale.stderr);
  const ap = tool("core/profile-request.mjs", ["--to", other ? other.to : "strict", "--why", "the factory suite asks", "--expect", d || ZERO]);
  const appr = approvals(sp).find((e) => e.id === receiptOf(ap.stdout));
  check("profile-request, applied: approval.requested (gate profile, ADR-0008) from the profile in force to the one asked",
    ap.status === 0 && !!appr && appr.payload.gate === "profile" && appr.payload.adr === "ADR-0008" && appr.payload.from === (current && current.to) && appr.payload.to === (other && other.to) && appr.payload.why === "the factory suite asks", `${ap.status} ${ap.stderr}`);
  check("profile-request never writes .claude/settings.json (ADR-0502), and the tree is as committed", sha256(readFileSync(join(repo, ".claude", "settings.json"))) === settingsBefore && clean());
  const noWhy = tool("core/profile-request.mjs", ["--to", other ? other.to : "strict", "--dry-run"]);
  check("profile-request without a reason refuses -- a profile switch is written down", noWhy.status === 2, noWhy.stderr);
}

// ---- propose retire: a hire ended on a proposal branch ----
{
  const { g, clean, sp, tool } = scratchRepo("retire-repo", { "engine/router.yaml": true });
  const Y = await import(pathToFileURL(S("engine", "yaml-subset.mjs")).href);
  const router = Y.parseYamlSubset(readFileSync(join(REPO, "engine", "router.yaml"), "utf8")).value;
  const TENURE = ["cap", "hosted", "judge", "review_by"];
  const hires = Object.keys(router.classes).filter((c) => TENURE.some((k) => Object.hasOwn(router.classes[c], k)));
  const notHire = Object.keys(router.classes).find((c) => !hires.includes(c));
  check("retire fixture: the router has a hire and a class that is not one (vacuous-pass guard)", hires.length > 0 && !!notHire, hires.join(","));
  const cls = hires[0];
  const plan = tool("engine/propose.mjs", ["retire", "--class", cls, "--why", "the factory suite ends it", "--dry-run"]);
  const d = lastExpect(plan.stdout);
  check("propose retire, planned: the router diff (tenure lines out, the default driver in) and a digest", plan.status === 0 && !!d && /^-\s+(cap|hosted|judge|review_by):/m.test(plan.stdout) && new RegExp(`^\\+\\s+driver: ${router.default.driver}$`, "m").test(plan.stdout) && clean(), `${plan.status} ${plan.stderr}`);
  const ap = tool("engine/propose.mjs", ["retire", "--class", cls, "--why", "the factory suite ends it", "--expect", d || ZERO]);
  const branch = `feat/face-engine-retire-${cls}`.replace(/sk-/g, "sk");
  const onBranch = Y.parseYamlSubset(g("show", `${branch}:engine/router.yaml`).stdout).value;
  check("propose retire, applied: on the branch the class routes to the default driver and carries no tenure term",
    ap.status === 0 && !!onBranch && onBranch.classes[cls].driver === router.default.driver && TENURE.every((k) => !Object.hasOwn(onBranch.classes[cls], k)) && clean(), `${ap.status} ${ap.stderr}`);
  const others = Object.keys(router.classes).filter((c) => c !== cls);
  check("propose retire, applied: every other class is byte-for-byte what main holds", !!onBranch && others.every((c) => JSON.stringify(onBranch.classes[c]) === JSON.stringify(router.classes[c])));
  const appr = approvals(sp).find((e) => e.id === receiptOf(ap.stdout));
  check("propose retire, applied: approval.requested (gate router-merge) names the branch and its commit", !!appr && appr.payload.gate === "router-merge" && appr.payload.branch === branch && appr.payload.commit === g("rev-parse", branch).stdout.trim());
  const not = tool("engine/propose.mjs", ["retire", "--class", notHire, "--dry-run"]);
  check("propose retire of a class that is not a hire refuses -- there is nothing to end", not.status === 2 && /not a hire/.test(not.stderr), not.stderr);
  const withTo = tool("engine/propose.mjs", ["retire", "--class", cls, "--to", "codex", "--dry-run"]);
  check("propose retire refuses --to: an ended hire goes back to the router's default", withTo.status === 2 && /takes no --to/.test(withTo.stderr), withTo.stderr);
}

// ---- agent-scaffold: four files on a proposal branch, so main stays green when it merges ----
{
  const GOLDEN = "tests/fixtures/sync-golden/tree-manifest.txt";
  const CONTRACT = "initiatives/face/contracts/expected-set.json";
  const REGISTRY = "initiatives/face/contracts/rooms.generated.json";
  const COPY = "initiatives/face/contracts/room-copy.json";
  const productFiles = Object.fromEntries(readdirSync(join(REPO, "products")).filter((p) => existsSync(join(REPO, "products", p, "manifest.json"))).map((p) => [`products/${p}/manifest.json`, true]));
  const { g, clean, sp, tool } = scratchRepo("agent-repo", { "engine/router.yaml": true, [GOLDEN]: true, [CONTRACT]: true, [REGISTRY]: true, [COPY]: true, ...productFiles });
  const A = ["--name", "probe-agent", "--description", "Reads a diff and names its riskiest hunk", "--tools", "Read, Grep", "--tier", "cheap-scan", "--room", "review-ship", "--product", "review"];
  const plan = tool("engine/agent-scaffold.mjs", [...A, "--dry-run"]);
  const d = lastExpect(plan.stdout);
  // The commit message the branch will carry is in the plan, so the owner reads it and the door's whole-plan check
  // covers a why that holds a path or an address (PR 4 round-3 logic attack).
  const whyPlan = tool("engine/agent-scaffold.mjs", [...A, "--why", "the roster needs a diff reader now", "--dry-run"]);
  check("agent-scaffold, planned: the commit message -- the why included -- is printed in the plan", whyPlan.status === 0 && /commit message:/.test(whyPlan.stdout) && /the roster needs a diff reader now/.test(whyPlan.stdout), `${whyPlan.status} ${whyPlan.stderr}`);
  check("agent-scaffold, planned: the agent, its manifest line, its golden line, its contract row and the registry the contract derives -- and a digest; nothing written",
    plan.status === 0 && !!d && [".claude/agents/probe-agent.md", "products/review/manifest.json", GOLDEN, CONTRACT, REGISTRY].every((p) => plan.stdout.includes(`b/${p}`)) && clean(), `${plan.status} ${plan.stderr}`);
  const stale = tool("engine/agent-scaffold.mjs", [...A, "--expect", ZERO]);
  check("agent-scaffold with a digest no plan printed refuses (PLAN_STALE)", stale.status === 2 && /PLAN_STALE/.test(stale.stderr) && approvals(sp).length === 0, stale.stderr);
  const ap = tool("engine/agent-scaffold.mjs", [...A, "--expect", d || ZERO]);
  const branch = "feat/face-agents-add-probe-agent";
  const show = (p) => g("show", `${branch}:${p}`).stdout;
  const agent = show(".claude/agents/probe-agent.md");
  check("agent-scaffold, applied: the agent file carries its name, tools, the tier's model (haiku for cheap-scan) and its description QUOTED",
    ap.status === 0 && /^name: probe-agent$/m.test(agent) && /^tools: Read, Grep$/m.test(agent) && /^model: haiku$/m.test(agent) && /^description: "Reads a diff and names its riskiest hunk"$/m.test(agent) && /cheap-scan \(ADR-0069\)/.test(agent) && clean(), `${ap.status} ${ap.stderr}`);
  // THE BRANCH KEEPS MAIN GREEN: what face-sections derives from the branch's contract is what the branch holds (PR 4
  // logic attack: the four files alone failed face-sections --check once merged).
  {
    const FS = await import(pathToFileURL(S("core", "face-sections.mjs")).href);
    const branchContract = JSON.parse(show(CONTRACT));
    const branchCopy = JSON.parse(show(COPY));
    const manifestsOnBranch = Object.fromEntries(Object.keys(productFiles).map((p) => [p.split("/")[1], show(p)]));
    const derived = FS.deriveFromContract(branchContract, branchCopy, manifestsOnBranch);
    check("agent-scaffold, applied: the branch's registry and every face: section are exactly what the generator derives from its contract",
      derived.registryText === show(REGISTRY) && Object.keys(derived.manifests).length === 0, `registry=${derived.registryText === show(REGISTRY)} drifted=${Object.keys(derived.manifests).join(",")}`);
  }
  let manifest = null; try { manifest = JSON.parse(show("products/review/manifest.json")); } catch { /* reported */ }
  check("agent-scaffold, applied: the product's manifest lists it, and is still JSON", !!manifest && manifest.agents[manifest.agents.length - 1] === ".claude/agents/probe-agent.md");
  const golden = show(GOLDEN).split("\n").filter(Boolean);
  const paths = golden.map((l) => l.split("\t")[0]);
  const sorted = [...paths].sort((x, y) => Buffer.compare(Buffer.from(x), Buffer.from(y)));
  const line = golden.find((l) => l.startsWith(".claude/agents/probe-agent.md\t"));
  check("agent-scaffold, applied: the golden holds its line -- sha256 of the bytes, CR stripped -- in byte order",
    !!line && line.split("\t")[1] === sha256(agent.replace(/\r/g, "")) && JSON.stringify(paths) === JSON.stringify(sorted) && golden.length === readFileSync(join(REPO, GOLDEN), "utf8").split("\n").filter(Boolean).length + 1, line || "no line");
  let contract = null; try { contract = JSON.parse(show(CONTRACT)); } catch { /* reported */ }
  const mainContract = JSON.parse(readFileSync(join(REPO, CONTRACT), "utf8"));
  const census = (c) => Number((/^(\d+);/.exec(c.agents.$comment) || [])[1]);
  check("agent-scaffold, applied: the contract seats it in its room and moves the census by one",
    !!contract && contract.agents.map["probe-agent"] === "review-ship" && census(contract) === census(mainContract) + 1 && Object.keys(contract.agents.map).length === Object.keys(mainContract.agents.map).length + 1);
  const appr = approvals(sp).find((e) => e.id === receiptOf(ap.stdout));
  check("agent-scaffold, applied: approval.requested (gate agent-roster, ADR-0069) names the tier, the model, the branch and its commit",
    !!appr && appr.payload.gate === "agent-roster" && appr.payload.adr === "ADR-0069" && appr.payload.agent_file === ".claude/agents/probe-agent.md" && appr.payload.tier === "cheap-scan" && appr.payload.model === "haiku" && appr.payload.branch === branch && appr.payload.commit === g("rev-parse", branch).stdout.trim());
  for (const [why, args, re] of [
    // The scratch repo holds the contract, not the agent files: the contract's own row is the refusal here.
    ["an agent main already has", ["--name", "code-reviewer"], /already on main|already has a room/],
    ["a tier ADR-0069 does not name", ["--tier", "gold-plated"], /not a tier/],
    ["a tier with no claude-code model yet", ["--tier", "independent-family-verifier"], /no claude-code model/],
    ["a room that seats no agent", ["--room", "money"], /not a room that hosts agents/],
    ["a product that ships no agents", ["--product", "engine"], /no "agents" array|ships no agents/],
    ["a tool outside the set", ["--tools", "Read, Teleport"], /--tools/],
    ["a description with an invisible character", ["--description", "Reviews\u200bdiffs"], /--description/],
  ]) {
    const merged = [...A];
    for (let i = 0; i < args.length; i += 2) merged[merged.indexOf(args[i]) + 1] = args[i + 1];
    const r = tool("engine/agent-scaffold.mjs", [...merged, "--dry-run"]);
    check(`agent-scaffold refuses ${why}`, r.status === 2 && re.test(r.stderr), `${r.status} ${r.stderr}`);
  }
}

// ---- the door: touchesTree is an effect past the spine, refused on a sim door at apply ----
{
  const DOOR = await import(pathToFileURL(S("hq", "lib", "face", "work-door.mjs")).href);
  const fx = join(tmp, "tree-effect-repo");
  mkdirSync(join(fx, ".claude", "scripts", "fixture"), { recursive: true });
  const marker = join(tmp, "tree-effect-ran.txt");
  writeFileSync(join(fx, ".claude", "scripts", "fixture", "tree.mjs"),
    `import { writeFileSync } from "node:fs";\nif (process.argv[2] === "--dry-run") { console.log("would write the lane's own ledger"); process.exit(0); }\nwriteFileSync(${JSON.stringify(marker)}, "ran");\n`);
  const registry = [{ id: "fixture.tree", room: "fixture", label: "tree", receipt: { kind: "note.logged" }, humanRun: true, spends: false, touchesFiles: false, touchesTree: true, fields: [],
    plan: () => ({ script: "fixture/tree.mjs", args: ["--dry-run"] }), apply: () => ({ script: "fixture/tree.mjs", args: [] }) }];
  const sp = spine("door-tree");
  const sim = DOOR.createWorkDoor({ mode: "sim", root: sp, repo: fx }, { registry });
  const p = await sim.plan("fixture.tree", { input: {} });
  let code = null;
  try { sim.apply("fixture.tree", { planId: p.planId, confirm: "fixture.tree" }); } catch (e) { code = e.code; }
  check("door: a sim door refuses a touchesTree apply -> SIM_EFFECT, and the tool never ran", p.ok === true && code === "SIM_EFFECT" && !existsSync(marker), `plan=${p.ok} code=${code}`);
  const live = DOOR.createWorkDoor({ mode: "live", root: sp, repo: fx }, { registry });
  const lp = await live.plan("fixture.tree", { input: {} });
  live.apply("fixture.tree", { planId: lp.planId, confirm: "fixture.tree" });
  await live.settled();
  check("door: a LIVE door runs the same touchesTree apply (the refusal is the sim door's)", existsSync(marker));

  // PLAN_HIDDEN: a digest row whose plan text holds an absolute path is not held (the scrub withholds from the path to
  // the end, so the digest the apply is bound to would never reach the page) -- while an emit-plan row, whose last line
  // IS the receipt and names the owner's own file (growth.publish), is held.
  const digest = "a".repeat(64);
  const pathy = process.platform === "win32" ? "C:\\Users\\someone\\notes.txt" : "/home/someone/notes.txt";
  writeFileSync(join(fx, ".claude", "scripts", "fixture", "bound.mjs"),
    `console.log("slice title: " + ${JSON.stringify(pathy)});\nconsole.log(JSON.stringify({ expect: ${JSON.stringify(digest)} }));\n`);
  writeFileSync(join(fx, ".claude", "scripts", "fixture", "emits.mjs"),
    `console.log(JSON.stringify({ emit: ["emit", "note.logged", "--payload", JSON.stringify({ note: "seal", article: ${JSON.stringify(pathy)} }), "--strict"] }));\n`);
  const hideReg = [
    { id: "fixture.bound", room: "fixture", label: "bound", receipt: { kind: "note.logged" }, humanRun: true, spends: false, touchesFiles: false, expect: true, fields: [],
      plan: () => ({ script: "fixture/bound.mjs", args: [] }), apply: () => ({ script: "fixture/bound.mjs", args: [] }) },
    { id: "fixture.emits", room: "fixture", label: "emits", receipt: { kind: "note.logged" }, humanRun: true, spends: false, touchesFiles: false, fields: [],
      plan: () => ({ script: "fixture/emits.mjs", args: [] }), apply: "emit-plan" },
  ];
  const hd = DOOR.createWorkDoor({ mode: "sim", root: spine("door-hidden"), repo: fx }, { registry: hideReg });
  let hiddenCode = null;
  try { await hd.plan("fixture.bound", { input: {} }); } catch (e) { hiddenCode = e.code; }
  check("door: a digest plan whose text holds an absolute path is not held (PLAN_HIDDEN)", hiddenCode === "PLAN_HIDDEN", `code=${hiddenCode}`);
  let emitPlan = null, emitCode = null;
  try { emitPlan = await hd.plan("fixture.emits", { input: {} }); } catch (e) { emitCode = e.code; }
  check("door: an emit-plan whose receipt names an absolute path IS held (growth.publish's article)", !!emitPlan && emitPlan.ok === true && emitCode === null, `code=${emitCode}`);
  // The WHOLE plan (PR 4 round-2 attacks): the scrub rewrites mid-text with the digest line untouched -- the repo's own
  // path in forward slashes (served as a relative path, no marker) and an address. A clean digest plan is the control.
  const midText = [
    ["repo path", `Reads the notes at ${fx.split("\\").join("/")}/.claude/notes.md`],
    ["address", "Mails release@example.org when it is done"],
    ["clean", "Reads the notes at .claude/notes.md"],
  ];
  const midReg = midText.map(([why, line], i) => {
    writeFileSync(join(fx, ".claude", "scripts", "fixture", `mid${i}.mjs`), `console.log(${JSON.stringify(line)});\nconsole.log(JSON.stringify({ expect: ${JSON.stringify(digest)} }));\n`);
    return { id: `fixture.mid${i}`, room: "fixture", label: why, receipt: { kind: "note.logged" }, humanRun: true, spends: false, touchesFiles: false, expect: true, fields: [],
      plan: () => ({ script: `fixture/mid${i}.mjs`, args: [] }), apply: () => ({ script: `fixture/mid${i}.mjs`, args: [] }) };
  });
  const md = DOOR.createWorkDoor({ mode: "sim", root: spine("door-midtext"), repo: fx }, { registry: midReg });
  const midCodes = [];
  for (let i = 0; i < midText.length; i++) {
    let code = "held";
    try { const r = await md.plan(`fixture.mid${i}`, { input: {} }); if (!r.ok) code = "refused"; } catch (e) { code = e.code; }
    midCodes.push(code);
  }
  check("door: a digest plan the scrub rewrites MID-TEXT is not held (the repo's path, an address); a clean one is (the control)",
    midCodes[0] === "PLAN_HIDDEN" && midCodes[1] === "PLAN_HIDDEN" && midCodes[2] === "held", JSON.stringify(midCodes));
  // PR 4 round 3: a bound plan longer than the door keeps is not held (its head was never checked), and a package spec
  // or a bracketed route segment is text, not an address or a path -- those plans are held.
  const extra = [
    ["long", "x".repeat(300 * 1024)],
    ["package spec", "pins left-pad@1.3.0 and golang.org/x/text@v0.14.0"],
    ["route segment", "touches app/[locale]/home/hero.tsx"],
  ];
  const extraReg = extra.map(([why, line], i) => {
    writeFileSync(join(fx, ".claude", "scripts", "fixture", `ex${i}.mjs`), `process.stdout.write(${JSON.stringify(line)} + "\\n");\nconsole.log(JSON.stringify({ expect: ${JSON.stringify(digest)} }));\n`);
    return { id: `fixture.ex${i}`, room: "fixture", label: why, receipt: { kind: "note.logged" }, humanRun: true, spends: false, touchesFiles: false, expect: true, fields: [],
      plan: () => ({ script: `fixture/ex${i}.mjs`, args: [] }), apply: () => ({ script: `fixture/ex${i}.mjs`, args: [] }) };
  });
  const xd = DOOR.createWorkDoor({ mode: "sim", root: spine("door-extra"), repo: fx }, { registry: extraReg });
  const extraCodes = [];
  for (let i = 0; i < extra.length; i++) {
    let code = "held";
    try { const r = await xd.plan(`fixture.ex${i}`, { input: {} }); if (!r.ok) code = "refused"; } catch (e) { code = e.code; }
    extraCodes.push(code);
  }
  check("door: a bound plan past the output cap is not held; a package spec and a bracketed route segment are (the scrub's false positives, PR 4 round 3)",
    extraCodes[0] === "PLAN_HIDDEN" && extraCodes[1] === "held" && extraCodes[2] === "held", JSON.stringify(extraCodes));
  // childEnv keeps bash's rules: an exported function, SHELLOPTS and ARC_NODE never reach a door child (PR 4 round 3).
  const READS = await import(pathToFileURL(S("hq", "lib", "face", "reads.mjs")).href);
  const keep = { f: process.env["BASH_FUNC_jq%%"], o: process.env.SHELLOPTS, n: process.env.ARC_NODE };
  process.env["BASH_FUNC_jq%%"] = "() { echo starter; }"; process.env.SHELLOPTS = "xtrace"; process.env.ARC_NODE = "evil-node";
  const envSeen = READS.childEnv();
  for (const [k, v] of [["BASH_FUNC_jq%%", keep.f], ["SHELLOPTS", keep.o], ["ARC_NODE", keep.n]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  check("door: childEnv drops an exported bash function, SHELLOPTS and ARC_NODE", !Object.keys(envSeen).some((k) => /^(BASH_FUNC_|SHELLOPTS$|ARC_NODE$)/i.test(k)), Object.keys(envSeen).filter((k) => /BASH|SHELL|ARC_NODE/i.test(k)).join(","));
}

// ---- design-explore --out-dir: a share or device path, and a . or .. segment, are refused (PR 4 round 3) ----
{
  const ex = (od) => spawnSync("bash", [S("design", "design-explore.sh"), "init", "probe-od", "--brief", "docs/briefs/none.md", "--out-dir", od], { cwd: REPO, encoding: "utf8" });
  const unc = ex("//localhost/C$/x/y");
  // Built as a string: path.join would resolve the .. away before the script ever saw it.
  const dots = ex(`${tmp.split("\\").join("/")}/j/../new-od`);
  check("design-explore --out-dir refuses a share or device path, and a . or .. segment",
    unc.status === 1 && /share or device path/.test(unc.stderr) && dots.status === 1 && /\. or \.\. segment/.test(dots.stderr), `${unc.status} ${unc.stderr} | ${dots.status} ${dots.stderr}`);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran >= 45 ? 0 : 1);
