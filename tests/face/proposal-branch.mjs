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
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, chmodSync } from "node:fs";
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
const plan = PB.planProposal({ repo: r, branch: "feat/face-engine-driver-review-diff", files: [{ path: "engine/router.yaml", content: PROPOSED }], allow: ALLOW });
check("the plan returns a unified diff of the proposed line", /-\s+driver: claude-code/.test(plan.diff) && /\+\s+driver: codex/.test(plan.diff) && plan.diff.includes("engine/router.yaml"), plan.diff.slice(0, 300));
check("the plan's base is main (the scratch repo has no remote, so local main)", plan.base === before.main);
check("the plan wrote NO object", objects(r) === objBefore);
check("the plan wrote NO ref", refs(r) === refsBefore);
check("the plan left HEAD, the index and the working tree as they were", JSON.stringify(state()) === JSON.stringify(before));

// ---- the write adds one ref and nothing else ----
const w = PB.writeProposal({ repo: r, branch: "feat/face-engine-driver-review-diff", files: [{ path: "engine/router.yaml", content: PROPOSED }], allow: ALLOW, message: "engine: route review-diff to codex (proposal)" });
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
const refuse = (name, o, code) => {
  let got = null;
  try { PB.writeProposal({ repo: r, message: "m", allow: ALLOW, files: [{ path: "engine/router.yaml", content: PROPOSED.replace("codex", "hermes") }], ...o }); }
  catch (e) { got = e && e.code; }
  check(`refused: ${name} -> ${code}`, got === code, `got ${got}`);
};
refuse("the branch already exists", { branch: "feat/face-engine-driver-review-diff" }, "BRANCH_EXISTS");
refuse("a branch outside feat/face-*", { branch: "main" }, "BAD_BRANCH");
refuse("a branch name with a double dash", { branch: "feat/face-x--y" }, "BAD_BRANCH");
refuse("a traversal", { branch: "feat/face-t1", files: [{ path: "engine/../README.md", content: "x" }] }, "BAD_PATH");
refuse("git's own directory", { branch: "feat/face-t2", files: [{ path: ".git/config", content: "x" }], allow: [".git/config"] }, "BAD_PATH");
refuse("an absolute path", { branch: "feat/face-t3", files: [{ path: "/etc/passwd", content: "x" }] }, "BAD_PATH");
refuse("hq.policy.yaml, even when the caller allows it", { branch: "feat/face-t4", files: [{ path: "hq.policy.yaml", content: "levels: {x: 1}\n" }] }, "UNGRANTABLE");
refuse(".claude/settings.json, even when allowed", { branch: "feat/face-t5", files: [{ path: ".claude/settings.json", content: "{}" }], allow: [".claude/settings.json"] }, "UNGRANTABLE");
refuse("a hook file, even when allowed", { branch: "feat/face-t6", files: [{ path: ".claude/hooks/x.sh", content: "x" }], allow: [".claude/hooks/x.sh"] }, "UNGRANTABLE");
refuse("a path the caller did not allow", { branch: "feat/face-t7", files: [{ path: "README.md", content: "x" }] }, "NOT_ALLOWED");
refuse("a proposal that changes nothing", { branch: "feat/face-t8", files: [{ path: "engine/router.yaml", content: git(r, "show", "main:engine/router.yaml") + "\n" }] }, "NO_CHANGE");
refuse("a NUL byte", { branch: "feat/face-t9", files: [{ path: "engine/router.yaml", content: "a\u0000b" }] }, "BAD_CONTENT");
refuse("no allow-list at all", { branch: "feat/face-t10", allow: [] }, "NO_ALLOW");
check("none of the refusals left a ref behind", refs(r).split("\n").length === refsBefore.split("\n").length + 1, refs(r));

// ---- the module names no porcelain that could move the owner's tree ----
{
  const src = readFileSync(join(REPO, ".claude", "scripts", "core", "proposal-branch.mjs"), "utf8");
  // Every string literal the file passes as a git argument, read out of the call sites.
  const verbs = [...src.matchAll(/git\((?:repo|tmp), \[\s*"([a-z-]+)"/g)].map((m) => m[1]);
  const banned = ["checkout", "switch", "merge", "push", "reset", "stash", "rebase", "commit", "add", "rm", "restore", "cherry-pick", "pull", "fetch"];
  check("the writer calls git subcommands (vacuous-pass guard for the next check)", verbs.length >= 8, verbs.join(","));
  check("the writer calls no porcelain that moves a tree, a branch or a remote", verbs.every((v) => !banned.includes(v)), verbs.filter((v) => banned.includes(v)).join(","));
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran >= 30 ? 0 : 1);
