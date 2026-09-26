#!/usr/bin/env node
// proposal-branch.mjs -- the ONE proposal-branch writer's contract (face v2 Phase 05 kernel ring, ADR-1340).
//
// In a scratch repository with a dirty working tree and a hook that would leave a mark: the plan writes NOTHING (no
// object, no ref); the write adds exactly one ref -- a new feat/face-* branch whose parent is main and whose tree holds
// the proposed bytes -- and leaves HEAD, the index, the working tree and main exactly as they were, with no hook run.
// Every refusal is by name: an existing branch, a traversal, git's own directory, an un-grantable target even when
// "allowed", a path the caller did not allow, a bad branch name, a proposal that changes nothing.
//
// VACUOUS-PASS GUARD: the scratch repo is proven built, and each "unchanged" detector is proven able to FIRE by
// changing the thing it watches in a throwaway clone; the last line is "RAN: <n> checks".

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PB = await import(pathToFileURL(join(REPO, ".claude", "scripts", "core", "proposal-branch.mjs")).href);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const cleanEnv = () => { const e = {}; for (const [k, v] of Object.entries(process.env)) if (!k.toUpperCase().startsWith("GIT_")) e[k] = v; return e; };
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", env: cleanEnv() }).trim();
const sha = (p) => (existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex") : "absent");
const refs = (cwd) => git(cwd, "for-each-ref", "--format=%(refname) %(objectname)");
const objects = (cwd) => {
  // Every loose object and pack, by name: a plan that wrote even one blob moves this.
  const dir = join(cwd, ".git", "objects");
  const out = [];
  for (const d of readdirSync(dir).sort()) for (const f of (existsSync(join(dir, d)) && !d.includes(".") ? readdirSync(join(dir, d)).sort() : [])) out.push(`${d}/${f}`);
  return out.join(",");
};

function scratch(name) {
  const r = mkdtempSync(join(tmpdir(), `face-proposal-${name}-`));
  git(r, "init", "-q", "-b", "main");
  // Repo-local identity: a clean CI runner has none, and the environment form does not survive every shell.
  git(r, "config", "user.name", "fixture");
  git(r, "config", "user.email", "fixture@example.invalid");
  git(r, "config", "commit.gpgsign", "false");
  mkdirSync(join(r, "engine"), { recursive: true });
  writeFileSync(join(r, "engine", "router.yaml"), "classes:\n  review-diff:\n    driver: claude-code\n    tier: balanced\n");
  writeFileSync(join(r, "hq.policy.yaml"), "levels: {}\n");
  writeFileSync(join(r, "README.md"), "fixture\n");
  git(r, "add", "-A");
  git(r, "commit", "-q", "-m", "fixture");
  return r;
}

const ALLOW = ["engine/router.yaml", "hq.policy.yaml"];
const PROPOSED = "classes:\n  review-diff:\n    driver: codex\n    tier: balanced\n";

// ---- the scratch repo, dirty, with a hook that would leave a mark ----
const r = scratch("main");
check("scratch repository built on main (vacuous-pass guard)", git(r, "rev-parse", "--abbrev-ref", "HEAD") === "main");
git(r, "checkout", "-q", "-b", "owner-work");
writeFileSync(join(r, "README.md"), "the owner is mid-edit\n");
writeFileSync(join(r, "untracked.txt"), "untracked\n");
const marker = join(r, "hook-ran.txt");
for (const h of ["reference-transaction", "post-commit", "post-checkout"]) {
  const hp = join(r, ".git", "hooks", h);
  writeFileSync(hp, `#!/bin/sh\necho ran > "${marker.replace(/\\/g, "/")}"\n`);
  try { chmodSync(hp, 0o755); } catch { /* windows */ }
}
const state = () => ({
  head: git(r, "symbolic-ref", "HEAD"), main: git(r, "rev-parse", "refs/heads/main"),
  index: sha(join(r, ".git", "index")), readme: sha(join(r, "README.md")), untracked: sha(join(r, "untracked.txt")),
  router: sha(join(r, "engine", "router.yaml")), status: git(r, "status", "--porcelain"),
});
const before = state();
const refsBefore = refs(r);
const objBefore = objects(r);

// ---- the detectors can fire (negative controls, in a throwaway clone) ----
{
  const c = scratch("control");
  const s0 = { head: git(c, "symbolic-ref", "HEAD"), index: sha(join(c, ".git", "index")), refs: refs(c), obj: objects(c) };
  git(c, "checkout", "-q", "-b", "feat/face-mutant");
  writeFileSync(join(c, "README.md"), "mutant\n");
  git(c, "add", "README.md"); // staging writes the blob: the object detector must see it
  check("MUTANT CONTROL: a checkout moves the HEAD detector", git(c, "symbolic-ref", "HEAD") !== s0.head);
  check("MUTANT CONTROL: staging moves the index detector", sha(join(c, ".git", "index")) !== s0.index);
  check("MUTANT CONTROL: a new branch moves the ref detector", refs(c) !== s0.refs);
  check("MUTANT CONTROL: a written blob moves the object detector", objects(c) !== s0.obj);
}

// ---- the plan writes nothing ----
const plan = await PB.planProposal({ repo: r, branch: "feat/face-engine-driver-review-diff", files: [{ path: "engine/router.yaml", content: PROPOSED }], allow: ALLOW });
check("the plan returns a unified diff of the proposed line", /-\s+driver: claude-code/.test(plan.diff) && /\+\s+driver: codex/.test(plan.diff) && plan.diff.includes("engine/router.yaml"), plan.diff.slice(0, 300));
check("the plan's base is main (the scratch repo has no remote, so local main)", plan.base === before.main);
check("the plan wrote NO object", objects(r) === objBefore);
check("the plan wrote NO ref", refs(r) === refsBefore);
check("the plan left HEAD, the index and the working tree as they were", JSON.stringify(state()) === JSON.stringify(before));

// ---- the write adds one ref and nothing else ----
const w = await PB.writeProposal({ repo: r, branch: "feat/face-engine-driver-review-diff", files: [{ path: "engine/router.yaml", content: PROPOSED }], allow: ALLOW, message: "engine: route review-diff to codex (proposal)" });
check("the write returns a commit", /^[0-9a-f]{40,64}$/.test(w.commit));
check("the branch exists and points at that commit", git(r, "rev-parse", "refs/heads/feat/face-engine-driver-review-diff") === w.commit);
check("its parent is main", git(r, "rev-parse", `${w.commit}^`) === before.main);
check("its tree holds the proposed bytes exactly", git(r, "cat-file", "blob", `${w.commit}:engine/router.yaml`) + "\n" === PROPOSED);
check("it changes that one file and nothing else", git(r, "diff", "--name-only", before.main, w.commit) === "engine/router.yaml");
check("the write left HEAD, the index, the working tree and main as they were", JSON.stringify(state()) === JSON.stringify(before), JSON.stringify(state()));
const added = refs(r).split("\n").filter((l) => !refsBefore.split("\n").includes(l));
check("exactly one ref was added, and it is the proposal branch", added.length === 1 && added[0].startsWith("refs/heads/feat/face-engine-driver-review-diff "), added.join(" | "));
check("no hook ran (reference-transaction, post-commit, post-checkout)", !existsSync(marker));
check("the commit is written under the machine identity, not the owner's", git(r, "log", "-1", "--format=%an <%ae>", w.commit) === "arc face <face@arc.invalid>");

// ---- refusals, by name ----
const refuse = async (name, o, code) => {
  let got = null;
  try { await PB.writeProposal({ repo: r, message: "m", allow: ALLOW, files: [{ path: "engine/router.yaml", content: PROPOSED.replace("codex", "hermes") }], ...o }); }
  catch (e) { got = e && e.code; }
  check(`refused: ${name} -> ${code}`, got === code, `got ${got}`);
};
await refuse("the branch already exists", { branch: "feat/face-engine-driver-review-diff" }, "BRANCH_EXISTS");
await refuse("a branch outside feat/face-*", { branch: "main" }, "BAD_BRANCH");
await refuse("a branch name with a double dash", { branch: "feat/face-x--y" }, "BAD_BRANCH");
await refuse("a traversal", { branch: "feat/face-t1", files: [{ path: "engine/../README.md", content: "x" }] }, "BAD_PATH");
await refuse("git's own directory", { branch: "feat/face-t2", files: [{ path: ".git/config", content: "x" }], allow: [".git/config"] }, "BAD_PATH");
await refuse("an absolute path", { branch: "feat/face-t3", files: [{ path: "/etc/passwd", content: "x" }] }, "BAD_PATH");
await refuse("hq.policy.yaml, even when the caller allows it", { branch: "feat/face-t4", files: [{ path: "hq.policy.yaml", content: "levels: {x: 1}\n" }] }, "UNGRANTABLE");
await refuse(".claude/settings.json, even when allowed", { branch: "feat/face-t5", files: [{ path: ".claude/settings.json", content: "{}" }], allow: [".claude/settings.json"] }, "UNGRANTABLE");
await refuse("a hook file, even when allowed", { branch: "feat/face-t6", files: [{ path: ".claude/hooks/x.sh", content: "x" }], allow: [".claude/hooks/x.sh"] }, "UNGRANTABLE");
await refuse("a path the caller did not allow", { branch: "feat/face-t7", files: [{ path: "README.md", content: "x" }] }, "NOT_ALLOWED");
await refuse("a proposal that changes nothing", { branch: "feat/face-t8", files: [{ path: "engine/router.yaml", content: git(r, "show", "main:engine/router.yaml") + "\n" }] }, "NO_CHANGE");
await refuse("a NUL byte", { branch: "feat/face-t9", files: [{ path: "engine/router.yaml", content: "a\u0000b" }] }, "BAD_CONTENT");
await refuse("no allow-list at all", { branch: "feat/face-t10", allow: [] }, "NO_ALLOW");
check("none of the refusals left a ref behind", refs(r).split("\n").length === refsBefore.split("\n").length + 1, refs(r));

// ---- names a case-insensitive or Windows checkout reads as another (PR 3a attacks) ----
await refuse("a trailing dot on an un-grantable name (Windows reads hq.policy.yaml. as hq.policy.yaml)", { branch: "feat/face-t11", files: [{ path: "hq.policy.yaml.", content: "x" }], allow: ["hq.policy.yaml."] }, "BAD_PATH");
await refuse("git's directory spelled .git.", { branch: "feat/face-t12", files: [{ path: ".git./config", content: "x" }], allow: [".git./config"] }, "BAD_PATH");
await refuse("a Windows device name", { branch: "feat/face-t13", files: [{ path: "engine/nul", content: "x" }], allow: ["engine/nul"] }, "BAD_PATH");
await refuse("a device name with an extension", { branch: "feat/face-t14", files: [{ path: "engine/com1.yaml", content: "x" }], allow: ["engine/com1.yaml"] }, "BAD_PATH");
await refuse("a name that opens with a dash", { branch: "feat/face-t15", files: [{ path: "-x/y", content: "x" }], allow: ["-x/y"] }, "BAD_PATH");
// A path main holds under another CASE: the branch would hold both, and a Windows or macOS checkout cannot (PR 3b shell
// attack). A directory in another case is the same clash one level up; a file where a directory is needed is refused.
await refuse("a file main holds under another case", { branch: "feat/face-t16", files: [{ path: "engine/Router.yaml", content: "x" }], allow: ["engine/Router.yaml"] }, "CASE_CLASH");
await refuse("a directory main holds under another case", { branch: "feat/face-t17", files: [{ path: "Engine/new.yaml", content: "x" }], allow: ["Engine/new.yaml"] }, "CASE_CLASH");
await refuse("a path that needs main's file to be a directory", { branch: "feat/face-t18", files: [{ path: "README.md/x.md", content: "x" }], allow: ["README.md/x.md"] }, "BAD_PATH");
{
  let code = null;
  try { await PB.checkProposal({ repo: r, branch: "feat/face-t19", paths: ["engine/Router.yaml"], allow: ["engine/Router.yaml"] }); } catch (e) { code = e && e.code; }
  const fine = await PB.checkProposal({ repo: r, branch: "feat/face-t20", paths: ["engine/new.yaml"], allow: ["engine/new.yaml"] }).catch((e) => ({ err: e.code }));
  check("the pre-seal check refuses a case clash too (CASE_CLASH), and passes a new path (vacuous-pass guard)", code === "CASE_CLASH" && fine.base === before.main, `${code} ${JSON.stringify(fine)}`);
}

// ---- an existing branch in ANOTHER CASE, or as a directory, is a collision (PR 3a shell attack: on a case-insensitive
// filesystem a loose feat/face-p2-f shadowed the owner's packed feat/face-P2-F and moved it) ----
{
  git(r, "branch", "feat/face-Case-Clash", "main");
  git(r, "pack-refs", "--all");
  const ownerTip = git(r, "rev-parse", "refs/heads/feat/face-Case-Clash");
  await refuse("a branch that differs only in case from the owner's (packed) branch", { branch: "feat/face-case-clash" }, "BRANCH_EXISTS");
  check("... and the owner's branch still points where it did", git(r, "rev-parse", "refs/heads/feat/face-Case-Clash") === ownerTip);
  git(r, "branch", "feat/face-dir/wip", "main");
  await refuse("a branch whose name is another branch's directory", { branch: "feat/face-dir" }, "BRANCH_EXISTS");
}

// ---- a stale ref lock is named for what it is, never "the branch appeared" (PR 3a shell attack) ----
{
  const lock = join(r, ".git", "refs", "heads", "feat", "face-locked.lock");
  mkdirSync(dirname(lock), { recursive: true });
  writeFileSync(lock, "");
  let code = null, msg = "";
  try { await PB.writeProposal({ repo: r, message: "m", allow: ALLOW, branch: "feat/face-locked", files: [{ path: "engine/router.yaml", content: PROPOSED.replace("codex", "lock") }] }); }
  catch (e) { code = e.code; msg = e.message; }
  // The check NAMES never carry the word the bats wrapper forbids in the output, so the code is compared, not printed.
  check("a stale .lock refuses as git's own error, in git's words, not BRANCH_EXISTS", code === "GIT_FAILED" && /lock/i.test(msg), `${code} ${msg}`);
  check("... and no branch was created behind the lock", !refs(r).includes("refs/heads/feat/face-locked "));
  rmSync(lock, { force: true });
}

// ---- the base the caller read from is the base, or nothing is written ----
{
  let code = null;
  try { await PB.writeProposal({ repo: r, message: "m", allow: ALLOW, branch: "feat/face-moved", files: [{ path: "engine/router.yaml", content: PROPOSED.replace("codex", "moved") }], base: "0".repeat(40) }); }
  catch (e) { code = e.code; }
  check("a write whose base is not main's commit refuses (BASE_MOVED) and adds no ref", code === "BASE_MOVED" && !refs(r).includes("refs/heads/feat/face-moved "), `code=${code}`);
}

// ---- main's bytes are read strictly: a non-UTF-8 router is refused, never rewritten through U+FFFD ----
{
  const c = scratch("latin1");
  writeFileSync(join(c, "engine", "router.yaml"), Buffer.concat([Buffer.from("classes:\n  # caf"), Buffer.from([0xe9]), Buffer.from("\n  review-diff:\n    driver: claude-code\n")]));
  git(c, "commit", "-q", "-am", "a latin-1 byte");
  let code = null;
  try { await PB.baseText({ repo: c, path: "engine/router.yaml" }); } catch (e) { code = e.code; }
  check("a router that is not valid UTF-8 on main refuses (NOT_UTF8)", code === "NOT_UTF8", `code=${code}`);
  const clean = await PB.baseText({ repo: r, path: "engine/router.yaml" });
  check("... and a valid one reads as its text, BOM-safe (vacuous-pass guard)", typeof clean.text === "string" && clean.text.startsWith("classes:") && clean.base === before.main);
}

// ---- config in the owner's repo that runs programs or hides the diff is overridden (PR 3a shell attack) ----
{
  const c = scratch("config");
  const mark = join(c, "..", `fsmonitor-${Date.now()}.txt`);
  const hook = join(c, "fsmon.sh");
  writeFileSync(hook, `#!/bin/sh\necho ran >> "${mark.replace(/\\/g, "/")}"\nexit 1\n`);
  try { chmodSync(hook, 0o755); } catch { /* windows */ }
  git(c, "config", "core.fsmonitor", hook.replace(/\\/g, "/"));
  git(c, "config", "core.splitIndex", "true");
  // MUTANT CONTROL: plain git, with the owner's config, does run the hook -- so its absence below is a measurement.
  try { execFileSync("git", ["status", "--porcelain"], { cwd: c, env: cleanEnv(), stdio: "ignore" }); } catch { /* the hook's exit 1 is fine */ }
  check("MUTANT CONTROL: the owner's fsmonitor hook runs under plain git", existsSync(mark));
  const marksBefore = existsSync(mark) ? readFileSync(mark, "utf8") : "";
  const shared = () => readdirSync(join(c, ".git")).filter((n) => n.startsWith("sharedindex.")).sort().join(",");
  const sharedBefore = shared();
  await PB.writeProposal({ repo: c, message: "m", allow: ALLOW, branch: "feat/face-config", files: [{ path: "engine/router.yaml", content: PROPOSED }] });
  check("the writer ran no fsmonitor hook", (existsSync(mark) ? readFileSync(mark, "utf8") : "") === marksBefore);
  check("the writer left no sharedindex.* in the owner's .git (split index off)", shared() === sharedBefore, `${sharedBefore} -> ${shared()}`);
  // A per-user attributes file marking YAML as binary made the plan read "Binary files differ" (PR 3a shell attack).
  const xdg = mkdtempSync(join(tmpdir(), "face-proposal-xdg-"));
  mkdirSync(join(xdg, "git"), { recursive: true });
  writeFileSync(join(xdg, "git", "attributes"), "*.yaml -diff\n");
  // MUTANT CONTROL: plain `git diff --no-index` under that file does print "Binary files" -- the detector can fire.
  const pair = mkdtempSync(join(tmpdir(), "face-proposal-pair-"));
  writeFileSync(join(pair, "a.yaml"), "k: 1\n");
  writeFileSync(join(pair, "b.yaml"), "k: 2\n");
  let plain = "";
  try { plain = execFileSync("git", ["diff", "--no-index", "--", "a.yaml", "b.yaml"], { cwd: pair, encoding: "utf8", env: { ...cleanEnv(), XDG_CONFIG_HOME: xdg } }); }
  catch (e) { plain = String(e.stdout || ""); }
  check("MUTANT CONTROL: plain git honours the per-user attributes file and hides the diff", /Binary files/.test(plain), plain.slice(0, 200));
  const saved = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = xdg;
  try {
    const p = await PB.planProposal({ repo: c, branch: "feat/face-attrs", files: [{ path: "engine/router.yaml", content: PROPOSED.replace("codex", "attrs") }], allow: ALLOW });
    check("a per-user attributes file cannot hide the plan's diff", /\+\s+driver: attrs/.test(p.diff) && !/Binary files/.test(p.diff), p.diff.slice(0, 200));
  } finally {
    if (saved === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = saved;
  }
}

// ---- CONFIG hooks (git 2.54: hook.<name>.command / .event) are disabled by name, not only core.hooksPath (PR 3a
// round-2 shell attack: a reference-transaction hook in the owner's config ran three times inside a write) ----
{
  const c = scratch("cfghook");
  const mark = join(c, "..", `cfghook-${Date.now()}.txt`);
  const markPosix = mark.replace(/\\/g, "/");
  git(c, "config", "hook.mark.command", `echo ran >> "${markPosix}"`);
  git(c, "config", "--add", "hook.mark.event", "reference-transaction");
  git(c, "config", "--add", "hook.mark.event", "post-index-change");
  // MUTANT CONTROL: plain git, under the owner's config, runs it -- on a git that has config hooks at all.
  git(c, "branch", "feat/face-cfg-control", "main");
  const controlFired = existsSync(mark);
  const before = controlFired ? readFileSync(mark, "utf8") : "";
  await PB.writeProposal({ repo: c, message: "m", allow: ALLOW, branch: "feat/face-cfghook", files: [{ path: "engine/router.yaml", content: PROPOSED }] });
  const after = existsSync(mark) ? readFileSync(mark, "utf8") : "";
  check(controlFired ? "a config hook the owner's plain git runs is NOT run by the writer" : "a config hook: this git has no config hooks, so there is nothing to run (checked, not assumed)",
    after === before && refs(c).includes("refs/heads/feat/face-cfghook "), `control=${controlFired} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
}

// ---- a config hook whose NAME holds "=" is disabled too (PR 3b shell attack: git splits -c at the first "=", so
// `-c hook.x=y.enabled=false` set hook.x to "y.enabled=false" and the hook ran three times inside a write) ----
{
  const c = scratch("cfgeq");
  const mark = join(c, "..", `cfgeq-${Date.now()}.txt`);
  const markPosix = mark.replace(/\\/g, "/");
  git(c, "config", "hook.x=y.command", `echo ran >> "${markPosix}"`);
  git(c, "config", "--add", "hook.x=y.event", "reference-transaction");
  git(c, "branch", "feat/face-cfgeq-control", "main");
  const controlFired = existsSync(mark);
  const before = controlFired ? readFileSync(mark, "utf8") : "";
  await PB.writeProposal({ repo: c, message: "m", allow: ALLOW, branch: "feat/face-cfgeq", files: [{ path: "engine/router.yaml", content: PROPOSED }] });
  const after = existsSync(mark) ? readFileSync(mark, "utf8") : "";
  check(controlFired ? "a config hook NAMED x=y that plain git runs is NOT run by the writer" : "a config hook named x=y: this git has no config hooks, so there is nothing to run (checked, not assumed)",
    after === before && refs(c).includes("refs/heads/feat/face-cfgeq "), `control=${controlFired} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
}

// ---- config hook NAMES the line parse could not read: CR, U+2028, the empty name -- disabled; a name that is not UTF-8
// -- refused before anything is written (PR 3b round-2 shell attack: each ran six times inside a write) ----
{
  for (const [label, nameBytes, expectRefusal] of [["CR", Buffer.from("a\rb"), false], ["U+2028", Buffer.from("a b"), false], ["the empty name", Buffer.alloc(0), false], ["a non-UTF-8 byte", Buffer.from([0x61, 0xff, 0x62]), true]]) {
    const c = scratch("hookname");
    const mark = join(c, "..", `hookname-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`).replace(/\\/g, "/");
    writeFileSync(join(c, ".git", "config"), Buffer.concat([readFileSync(join(c, ".git", "config")), Buffer.from("[hook \""), nameBytes, Buffer.from(`"]\n\tevent = reference-transaction\n\tcommand = echo r >> ${mark}\n`)]));
    git(c, "branch", "feat/face-hookname-control", "main");
    const control = existsSync(mark) ? readFileSync(mark, "utf8").length : 0;
    let code = null;
    try { await PB.writeProposal({ repo: c, message: "m", allow: ALLOW, branch: "feat/face-hookname", files: [{ path: "engine/router.yaml", content: PROPOSED }] }); } catch (e) { code = e.code; }
    const ranInWrite = (existsSync(mark) ? readFileSync(mark, "utf8").length : 0) - control;
    check(expectRefusal
      ? `a config hook named with ${label} is refused (HOOK_NAME) before anything is written${control ? "" : " (this git runs no config hooks)"}`
      : `a config hook named with ${label} is disabled inside the write${control ? " (plain git runs it)" : " (this git runs no config hooks)"}`,
      expectRefusal ? code === "HOOK_NAME" && !refs(c).includes("refs/heads/feat/face-hookname ") : code === null && ranInWrite === 0 && refs(c).includes("refs/heads/feat/face-hookname "),
      `code=${code} control=${control} ran=${ranInWrite}`);
  }
}

// ---- one plan, three writers at once: exactly one branch, and only its writer claims it (PR 3b round-2 shell attack:
// the same second gave one commit, and the update-ref catch told all three writers the branch was theirs) ----
{
  const c = scratch("concurrent");
  const results = await Promise.all([0, 1, 2].map(() => PB.writeProposal({ repo: c, message: "m", allow: ALLOW, branch: "feat/face-concurrent", files: [{ path: "engine/router.yaml", content: PROPOSED }] }).then((w) => ({ ok: w.commit }), (e) => ({ code: e.code, msg: e.message }))));
  const tip = git(c, "rev-parse", "refs/heads/feat/face-concurrent");
  check("three writers of one plan at once: one writes and claims the branch, the others refuse (BRANCH_EXISTS)",
    results.filter((r) => r.ok).length === 1 && results.find((r) => r.ok).ok === tip && results.filter((r) => r.code === "BRANCH_EXISTS").length === 2, JSON.stringify(results));
}

// ---- the object-write retry, driven on demand (attack da7d131 L4, B1): the three-writers arm above fails 2 of 80
// rounds without the fix, so it cannot prove the retry ran. An injected git makes the race happen every time. ----
{
  const race = () => Object.assign(new PB.ProposalError("GIT_FAILED", "git hash-object failed: error: unable to write file .git/objects/98/ab: Permission denied"),
    { gitExit: { code: 128, stderr: "error: unable to write file .git/objects/98/abcdef: Permission denied\n" } });
  const full = () => Object.assign(new PB.ProposalError("GIT_FAILED", "git hash-object failed: error: unable to write file .git/objects/98/ab: No space left on device"),
    { gitExit: { code: 128, stderr: "error: unable to write file .git/objects/98/abcdef: No space left on device\n" } });
  const timedOut = () => new PB.ProposalError("GIT_FAILED", "git hash-object failed: did not finish in 60 s");
  const scripted = (plan) => { let calls = 0; const run = async () => { const step = plan[Math.min(calls, plan.length - 1)]; calls++; if (step === "ok") return { buf: Buffer.from("abc\n"), out: "abc\n", status: 0 }; throw step(); }; return { run, count: () => calls }; };
  const outcome = async (fn) => { try { return { value: await fn() }; } catch (e) { return { error: e }; } };

  const twice = scripted([race, race, "ok"]);
  const a = await outcome(() => PB.gitObjectWrite("repo", ["hash-object", "-w"], {}, twice.run));
  check("object-write retry: two lost races then a win -- the write succeeds on the third call (a no-retry mutant stops at one)",
    a.value && a.value.out === "abc\n" && twice.count() === 3, `calls=${twice.count()} ${a.error && a.error.message}`);
  const disk = scripted([full, "ok"]);
  const b = await outcome(() => PB.gitObjectWrite("repo", ["hash-object", "-w"], {}, disk.run));
  check("object-write retry: a full disk is NOT the race -- thrown on the first call, never retried",
    b.error && disk.count() === 1 && /No space left/.test(b.error.message), `calls=${disk.count()}`);
  // A timeout message that even STARTS like an exit is not retried: the decision reads gitExit, not the text (L1, B2).
  const slow = scripted([timedOut, "ok"]);
  const c = await outcome(() => PB.gitObjectWrite("repo", ["hash-object", "-w"], {}, slow.run));
  check("object-write retry: an error with no gitExit (a timeout, an overrun) is thrown at once, whatever its text says",
    c.error && slow.count() === 1, `calls=${slow.count()}`);
  const forever = scripted([race]);
  const t0 = Date.now();
  const d = await outcome(() => PB.gitObjectWrite("repo", ["hash-object", "-w"], {}, forever.run));
  const took = Date.now() - t0;
  check("object-write retry: a race that never clears stops -- bounded in tries and time, and the error says how long it tried",
    d.error && forever.count() >= 2 && forever.count() <= 12 && took < 9000 && /retried \d+ time\(s\) over \d+ ms/.test(d.error.message), `calls=${forever.count()} ms=${took} ${d.error && d.error.message}`);
  check("object-write retry: the race signature matches the Windows loss and nothing else",
    PB.OBJECT_WRITE_RACE_RE.test("error: unable to write file .git\\objects\\98\\ab: Permission denied")
    && !PB.OBJECT_WRITE_RACE_RE.test("error: unable to write file .git/objects/98/ab: No space left on device")
    && !PB.OBJECT_WRITE_RACE_RE.test("fatal: the pre-commit hook declined"));
}

// ---- a symbolic link on main is not a file a proposal edits (PR 3b round-2 shell attack: the plan showed a text edit
// while the branch turned the link into a file) ----
{
  const c = scratch("symlink");
  const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: c, input: "../hq.policy.yaml", encoding: "utf8", env: cleanEnv() }).trim();
  git(c, "update-index", "--add", "--cacheinfo", `120000,${blob},docs/report.md`);
  git(c, "commit", "-q", "-m", "a link on main");
  let code = null, msg = "";
  try { await PB.planProposal({ repo: c, branch: "feat/face-symlink", files: [{ path: "docs/report.md", content: "text\n" }], allow: ["docs/report.md"] }); } catch (e) { code = e.code; msg = e.message; }
  check("a path main holds as a symbolic link refuses (BAD_PATH), plan and all", code === "BAD_PATH" && /symbolic link/.test(msg), `${code} ${msg}`);
}

// ---- a RELATIVE temp dir is refused (NO_TEMP): git drops a relative ceiling, and the diff read the surrounding repo's
// config (PR 3b round-2 shell attack) ----
{
  const probe = join(r, "..", `reltmp-probe-${Date.now()}.mjs`);
  writeFileSync(probe, [
    `const PB = await import(${JSON.stringify(pathToFileURL(join(REPO, ".claude", "scripts", "core", "proposal-branch.mjs")).href)});`,
    `try { await PB.checkProposal({ repo: ${JSON.stringify(r)}, branch: "feat/face-reltmp", paths: ["engine/router.yaml"], allow: ["engine/router.yaml"] }); console.log("PASSED"); }`,
    "catch (e) { console.log(e.code); }",
    "",
  ].join("\n"));
  const out = execFileSync(process.execPath, [probe], { encoding: "utf8", cwd: dirname(probe), env: { ...cleanEnv(), TMPDIR: "rel-tmp", TMP: "rel-tmp", TEMP: "rel-tmp" } }).trim();
  check("a relative temp directory refuses (NO_TEMP) before git is asked anything", out === "NO_TEMP", out);
}

// ---- the open proposals holding a path: a second trial into one bundle while the first one's branch is unmerged ----
{
  const c = scratch("holding");
  const w = await PB.writeProposal({ repo: c, message: "m", allow: ["docs/bundle/commitment.txt"], branch: "feat/face-absorb-trial-one", files: [{ path: "docs/bundle/commitment.txt", content: "a".repeat(64) + "\n" }] });
  const held = await PB.openProposalsHolding({ repo: c, prefix: "feat/face-absorb-trial-", path: "docs/bundle/commitment.txt" });
  const none = await PB.openProposalsHolding({ repo: c, prefix: "feat/face-absorb-trial-", path: "docs/other/commitment.txt" });
  check("openProposalsHolding names the open branch that holds the path, and none for a path no branch holds", !!w.commit && JSON.stringify(held) === JSON.stringify(["feat/face-absorb-trial-one"]) && none.length === 0, `${JSON.stringify(held)} ${JSON.stringify(none)}`);
  // Without case, and on remote-tracking branches too (PR 3b round-3 logic attack): a bundle named in another case, and
  // a branch pushed and then deleted locally, were invisible.
  const cased = await PB.openProposalsHolding({ repo: c, prefix: "feat/face-absorb-trial-", path: "docs/BUNDLE/commitment.txt" });
  git(c, "update-ref", "refs/remotes/origin/feat/face-absorb-trial-two", w.commit);
  git(c, "branch", "-D", "feat/face-absorb-trial-one");
  const remote = await PB.openProposalsHolding({ repo: c, prefix: "feat/face-absorb-trial-", path: "docs/bundle/commitment.txt" });
  check("openProposalsHolding matches a path in another case, and a remote-tracking branch after the local one is gone (named as git names it)",
    JSON.stringify(cased) === JSON.stringify(["feat/face-absorb-trial-one"]) && JSON.stringify(remote) === JSON.stringify(["origin/feat/face-absorb-trial-two"]), `${JSON.stringify(cased)} ${JSON.stringify(remote)}`);
  // A remote whose NAME holds a slash (PR 3b round-4 logic attack: cut at the first one, its branches were never seen).
  git(c, "remote", "add", "up/stream", c);
  git(c, "update-ref", "refs/remotes/up/stream/feat/face-absorb-trial-three", w.commit);
  const slashed = await PB.openProposalsHolding({ repo: c, prefix: "feat/face-absorb-trial-", path: "docs/bundle/commitment.txt" });
  check("openProposalsHolding sees a branch under a remote whose name holds a slash",
    JSON.stringify(slashed) === JSON.stringify(["origin/feat/face-absorb-trial-two", "up/stream/feat/face-absorb-trial-three"]), JSON.stringify(slashed));
  // A removed remote's refs under a SHORTER configured one ("up" beside a gone "up/river"): cut after "up", the name did
  // not match and the prefix search never ran (PR 3b round-5 shell attack).
  // The removed remote's refs stay: its config section goes (git remote add refuses "up" beside "up/stream" on newer
  // git, CI), and "up" is configured by git config directly.
  git(c, "config", "--remove-section", "remote.up/stream");
  git(c, "config", "remote.up.url", c);
  git(c, "update-ref", "refs/remotes/up/river/feat/face-absorb-trial-four", w.commit);
  const orphan = await PB.openProposalsHolding({ repo: c, prefix: "feat/face-absorb-trial-", path: "docs/bundle/commitment.txt" });
  check("openProposalsHolding sees a removed remote's branches under a shorter configured remote",
    orphan.includes("up/river/feat/face-absorb-trial-four") && orphan.includes("up/stream/feat/face-absorb-trial-three"), JSON.stringify(orphan));
}

// ---- beforeRef: the caller judges the real receipt, with its commit, before the ref exists; a throw writes no branch
// (PR 3b attacks: a dry run judged a zero commit, and the branch was written before the real one was refused) ----
{
  const c = scratch("beforeref");
  let seen = "", refYet = true;
  const w = await PB.writeProposal({ repo: c, message: "m", allow: ALLOW, branch: "feat/face-beforeref", files: [{ path: "engine/router.yaml", content: PROPOSED }],
    beforeRef: (commit) => { seen = commit; refYet = refs(c).includes("refs/heads/feat/face-beforeref "); } });
  check("beforeRef sees the commit the branch will point at, before the branch exists", seen === w.commit && refYet === false && refs(c).includes(`refs/heads/feat/face-beforeref ${w.commit}`), `${seen} ${w.commit} ${refYet}`);
  let code = null;
  try { await PB.writeProposal({ repo: c, message: "m", allow: ALLOW, branch: "feat/face-vetoed", files: [{ path: "engine/router.yaml", content: PROPOSED }], beforeRef: () => { throw Object.assign(new Error("no"), { code: "VETOED" }); } }); }
  catch (e) { code = e && e.code; }
  check("a beforeRef that throws writes no branch, and its own error comes back", code === "VETOED" && !refs(c).includes("refs/heads/feat/face-vetoed "), `${code}`);
}

// ---- a branch the writer DID create is the writer's, even when the update-ref call reports a failure (PR 3a round-2
// shell attack: it was reported as someone else's branch, propose exited 2, and every retry refused) ----
{
  const c = scratch("ownref");
  // A preload that runs the real `git update-ref` and then reports exit 1: the transaction committed, the call "failed".
  const fake = join(c, "..", `fake-update-ref-${Date.now()}.mjs`);
  writeFileSync(fake, [
    "import { spawnSync } from \"node:child_process\";",
    "import { readFileSync } from \"node:fs\";",
    "const input = readFileSync(0);",
    "const r = spawnSync(\"git\", process.argv.slice(2), { input, stdio: [\"pipe\", \"inherit\", \"inherit\"] });",
    "process.exit(r.status === 0 ? 1 : 2);",
    "",
  ].join("\n"));
  const shim = join(c, "..", `shim-update-ref-${Date.now()}.mjs`);
  writeFileSync(shim, [
    "import cp from \"node:child_process\";",
    "import { syncBuiltinESMExports } from \"node:module\";",
    "const real = cp.spawn;",
    `cp.spawn = (file, args, opts) => (file === "git" && Array.isArray(args) && args.includes("update-ref") ? real(process.execPath, [${JSON.stringify(fake)}, ...args], opts) : real(file, args, opts));`,
    "syncBuiltinESMExports();",
    "",
  ].join("\n"));
  const probe = join(c, "..", `own-ref-probe-${Date.now()}.mjs`);
  writeFileSync(probe, [
    `const PB = await import(${JSON.stringify(pathToFileURL(join(REPO, ".claude", "scripts", "core", "proposal-branch.mjs")).href)});`,
    `const w = await PB.writeProposal({ repo: ${JSON.stringify(c)}, message: "m", allow: ["engine/router.yaml"], branch: "feat/face-ownref", files: [{ path: "engine/router.yaml", content: ${JSON.stringify(PROPOSED)} }] });`,
    "console.log(JSON.stringify({ commit: w.commit }));",
    "",
  ].join("\n"));
  let out = "", code = 0;
  try { out = execFileSync(process.execPath, ["--import", pathToFileURL(shim).href, probe], { encoding: "utf8", env: cleanEnv() }); }
  catch (e) { code = e.status; out = String(e.stdout || "") + String(e.stderr || ""); }
  let commit = "";
  try { commit = JSON.parse(out.trim().split(/\r?\n/).pop()).commit; } catch { /* reported below */ }
  check("a branch the writer created is returned as written when update-ref reports a failure after committing it",
    code === 0 && /^[0-9a-f]{40,64}$/.test(commit) && git(c, "rev-parse", "refs/heads/feat/face-ownref") === commit, `code=${code} ${out.slice(0, 300)}`);

  // THE MUTANT'S CASE (PR 3b shell attack): the same failure, and the branch that now exists is SOMEONE ELSE'S -- it
  // points at main, not at the writer's commit. Returned as written, the caller would raise an approval for a branch
  // that does not carry the proposal. A writer that dropped the "is it my commit" comparison passed both tests above.
  const foreignFake = join(c, "..", `foreign-update-ref-${Date.now()}.mjs`);
  writeFileSync(foreignFake, [
    "import { spawnSync } from \"node:child_process\";",
    "import { readFileSync } from \"node:fs\";",
    "readFileSync(0);",
    "spawnSync(\"git\", [\"update-ref\", \"refs/heads/feat/face-foreign\", \"main\"], { stdio: \"inherit\" });",
    "process.exit(1);",
    "",
  ].join("\n"));
  const foreignShim = join(c, "..", `foreign-shim-${Date.now()}.mjs`);
  writeFileSync(foreignShim, [
    "import cp from \"node:child_process\";",
    "import { syncBuiltinESMExports } from \"node:module\";",
    "const real = cp.spawn;",
    `cp.spawn = (file, args, opts) => (file === "git" && Array.isArray(args) && args.includes("update-ref") ? real(process.execPath, [${JSON.stringify(foreignFake)}, ...args], opts) : real(file, args, opts));`,
    "syncBuiltinESMExports();",
    "",
  ].join("\n"));
  const foreignProbe = join(c, "..", `foreign-probe-${Date.now()}.mjs`);
  writeFileSync(foreignProbe, [
    `const PB = await import(${JSON.stringify(pathToFileURL(join(REPO, ".claude", "scripts", "core", "proposal-branch.mjs")).href)});`,
    "try {",
    `  const w = await PB.writeProposal({ repo: ${JSON.stringify(c)}, message: "m2", allow: ["engine/router.yaml"], branch: "feat/face-foreign", files: [{ path: "engine/router.yaml", content: ${JSON.stringify(PROPOSED.replace("codex", "hermes"))} }] });`,
    "  console.log(JSON.stringify({ written: w.commit }));",
    "} catch (e) { console.log(JSON.stringify({ code: e.code })); }",
    "",
  ].join("\n"));
  let fOut = "";
  try { fOut = execFileSync(process.execPath, ["--import", pathToFileURL(foreignShim).href, foreignProbe], { encoding: "utf8", env: cleanEnv() }); }
  catch (e) { fOut = String(e.stdout || "") + String(e.stderr || ""); }
  let fGot = {};
  try { fGot = JSON.parse(fOut.trim().split(/\r?\n/).pop()); } catch { /* reported below */ }
  const foreignTip = (() => { try { return git(c, "rev-parse", "refs/heads/feat/face-foreign"); } catch { return ""; } })();
  check("a branch that appeared during a failed update-ref and is NOT the writer's commit refuses (BRANCH_EXISTS), never returned as written",
    fGot.code === "BRANCH_EXISTS" && foreignTip === git(c, "rev-parse", "main"), `${fOut.slice(0, 300)} tip=${foreignTip}`);
}

// ---- the module names no porcelain that could move the owner's tree ----
{
  const src = readFileSync(join(REPO, ".claude", "scripts", "core", "proposal-branch.mjs"), "utf8");
  // Every string literal the file passes as a git argument, read out of the call sites.
  const verbs = [...src.matchAll(/git\((?:repo|tmp), \[\s*"([a-z-]+)"/g)].map((m) => m[1]);
  const banned = ["checkout", "switch", "merge", "push", "reset", "stash", "rebase", "commit", "add", "rm", "restore", "cherry-pick", "pull", "fetch"];
  check("the writer calls git subcommands (vacuous-pass guard for the next check)", verbs.length >= 8, verbs.join(","));
  check("the writer calls no porcelain that moves a tree, a branch or a remote", verbs.every((v) => !banned.includes(v)), verbs.filter((v) => banned.includes(v)).join(","));
}

// mainDirNames reads MAIN's tree, never the checkout (PR 4 round 2: add-agent listed products from the checkout and a
// product main held got no manifest line). The checkout here has lost one product and gained another; main has neither
// change.
{
  const r = scratch("dirnames");
  mkdirSync(join(r, "products", "alpha"), { recursive: true });
  mkdirSync(join(r, "products", "beta", "deep"), { recursive: true });
  writeFileSync(join(r, "products", "alpha", "manifest.json"), "{}\n");
  writeFileSync(join(r, "products", "beta", "deep", "x.txt"), "x\n");
  git(r, "add", "-A");
  git(r, "commit", "-q", "-m", "products");
  rmSync(join(r, "products", "beta"), { recursive: true, force: true });
  mkdirSync(join(r, "products", "gamma"), { recursive: true });
  writeFileSync(join(r, "products", "gamma", "manifest.json"), "{}\n");
  const listed = await PB.mainDirNames({ repo: r, dir: "products" });
  check("mainDirNames lists main's folders -- one the checkout deleted, none it only added, no nested names", JSON.stringify(listed.names) === JSON.stringify(["alpha", "beta"]) && /^[0-9a-f]{40}$/.test(listed.base), JSON.stringify(listed));
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran >= 50 ? 0 : 1);
