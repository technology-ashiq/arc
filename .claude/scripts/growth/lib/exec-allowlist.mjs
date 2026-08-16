// growth/exec-allowlist -- THE ONE PLACE growth may run a subprocess.
//
// E2 (Tier E, unamendable): the machine writes branches and drafts; a human merges every publish.
// ADR-1102 puts the enforcement in the command itself and makes the guard a PARSE of the module
// graph rather than a grep.
//
// THE DESIGN PROBLEM, STATED PLAINLY. "No merge path" cannot mean "no subprocess", because opening
// a pull request requires running git and gh. A module graph can only prove the ABSENCE of a
// capability, so the capability is confined instead: `node:child_process` is imported by THIS FILE
// AND NOTHING ELSE in the publish graph, and every invocation is checked against an allowlist that
// contains no merge, no default-branch push, and no deploy.
//
// That gives the guard two checkable facts rather than a vague one:
//   1. exactly one module in the graph can spawn anything, and it is this one;
//   2. this one cannot spawn a merge, a push to the default branch, or a deploy.
//
// A mutant that adds `merge` to a table below, or that imports child_process anywhere else, is
// rejected by `guard.mjs` and NAMED -- so the negative control cannot pass by crashing.

import { spawnSync } from "node:child_process";

export class ExecError extends Error {
  constructor(code, message) { super(message); this.name = "ExecError"; this.code = code; }
}

// Verbs that may never appear, whatever else is allowed. Checked against the FIRST argument and
// against every argument, because `gh pr merge` hides the banned verb in position 2.
export const BANNED_VERBS = Object.freeze(["merge", "promote", "deploy", "ship", "rebase", "reset", "force-push"]);

// Branch names that are never a push target. A push to any of these is a publish without a human.
export const PROTECTED_BRANCHES = Object.freeze(["main", "master", "HEAD", "trunk", "default"]);

// git subcommands growth may run. Read-only or branch-local, every one.
export const GIT_ALLOWED = Object.freeze(["rev-parse", "status", "diff", "checkout", "switch", "add", "commit", "push", "branch", "show", "log"]);
// gh subcommands. `pr create` and `pr view` only -- `pr merge` is refused by BANNED_VERBS above,
// and named here too so the table reads as a whitelist rather than as the absence of a blacklist.
export const GH_ALLOWED = Object.freeze(["pr"]);
export const GH_PR_ALLOWED = Object.freeze(["create", "view", "diff", "list"]);

function assertNoBannedVerb(argv) {
  for (const a of argv) {
    const bare = String(a).toLowerCase().replace(/^--?/, "");
    if (BANNED_VERBS.includes(bare))
      throw new ExecError("BANNED_VERB", `refusing to run a command containing ${JSON.stringify(a)} -- E2 is Tier E and unamendable: a human merges every publish`);
  }
}

/**
 * A push is allowed ONLY to a non-protected branch, and only in the `push -u origin <branch>` or
 * `push origin <branch>` shape. `git push` with no refspec pushes the current branch to its
 * upstream, which on a checked-out default branch is a push to the default branch -- so the bare
 * form is refused rather than reasoned about.
 */
function assertPushIsSafe(args) {
  const rest = args.filter((a) => !a.startsWith("-"));
  // rest[0] === "push"
  const remote = rest[1];
  const ref = rest[2];
  if (!remote || !ref)
    throw new ExecError("UNSAFE_PUSH", "refusing `git push` without an explicit remote and branch -- the bare form pushes the current branch to its upstream, which is the default branch when one is checked out");
  const target = String(ref).split(":").pop();
  if (PROTECTED_BRANCHES.some((b) => b.toLowerCase() === String(target).toLowerCase()))
    throw new ExecError("PROTECTED_BRANCH", `refusing to push to ${JSON.stringify(target)} -- publishing is a pull request a human merges (E2, ADR-1102)`);
  if (args.some((a) => a === "--force" || a === "-f" || a === "--force-with-lease"))
    throw new ExecError("UNSAFE_PUSH", "refusing a force push");
}

/** Run git with an allowlisted subcommand. */
export function runGit(args, { cwd = process.cwd(), env = process.env } = {}) {
  if (!Array.isArray(args) || args.length === 0)
    throw new ExecError("BAD_ARGS", "runGit needs an argv array");
  // An ARRAY, never a joined string: a shell string is where quoting bugs become command injection,
  // and `shell: false` below means no shell parses any of this.
  for (const a of args)
    if (typeof a !== "string") throw new ExecError("BAD_ARGS", "every git argument must be a string");
  assertNoBannedVerb(args);
  const sub = args.find((a) => !a.startsWith("-"));
  if (!GIT_ALLOWED.includes(sub))
    throw new ExecError("NOT_ALLOWED", `git ${sub} is not in growth's allowlist (${GIT_ALLOWED.join(", ")})`);
  if (sub === "push") assertPushIsSafe(args);
  return spawnSync("git", args, { cwd, env, encoding: "utf8", shell: false });
}

/** Run gh with an allowlisted subcommand. */
export function runGh(args, { cwd = process.cwd(), env = process.env } = {}) {
  if (!Array.isArray(args) || args.length === 0)
    throw new ExecError("BAD_ARGS", "runGh needs an argv array");
  for (const a of args)
    if (typeof a !== "string") throw new ExecError("BAD_ARGS", "every gh argument must be a string");
  assertNoBannedVerb(args);
  const bare = args.filter((a) => !a.startsWith("-"));
  if (!GH_ALLOWED.includes(bare[0]))
    throw new ExecError("NOT_ALLOWED", `gh ${bare[0]} is not in growth's allowlist (${GH_ALLOWED.join(", ")})`);
  if (bare[0] === "pr" && !GH_PR_ALLOWED.includes(bare[1]))
    throw new ExecError("NOT_ALLOWED", `gh pr ${bare[1]} is not in growth's allowlist (${GH_PR_ALLOWED.join(", ")})`);
  return spawnSync("gh", args, { cwd, env, encoding: "utf8", shell: false });
}
