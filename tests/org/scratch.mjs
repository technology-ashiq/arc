// org lane test helper: a scratch arc tree holding exactly what the org scripts read (the org_scratch /
// team_tree / judge_tree functions the org bats files each carried). Scratch only: the repo is never written.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ARC_ROOT, tmpDir, copyTree, runNode } from "../_lib/arc.mjs";

/** A fixture program in tests/org/ ran (its banner) before its count is believed, then the exit status. */
export function fixtureClean(name) {
  const r = runNode(join(ARC_ROOT, `tests/org/${name}.mjs`));
  assert.ok(r.output.includes(`RAN ${name} `), `the fixture never ran: ${r.output}`);
  assert.ok(r.output.includes(", 0 failed"), r.output);
  assert.equal(r.status, 0);
}

/** opts.products copies products/ too; opts.init runs `org-team --init <venture>` and asserts the manifest. */
export function orgScratch(t, { products = false, init = null } = {}) {
  const d = join(tmpDir(t, "org-"), "tree");
  mkdirSync(join(d, ".claude"), { recursive: true });
  mkdirSync(join(d, "engine"), { recursive: true });
  copyTree(d, [".claude/agents", ".claude/skills", ".claude/scripts", "processes", "org", "engine/router.yaml", "hq.policy.yaml", "ventures.yaml",
    ...(products ? ["products"] : [])], { optional: [".mcp.json"] });
  if (init) {
    const r = runNode(join(ARC_ROOT, ".claude/scripts/org/org-team.mjs"), ["--init", init, "--root", d]);
    if (r.status !== 0) throw new Error(`org-team --init ${init} failed: ${r.output}`);
  }
  return d;
}
