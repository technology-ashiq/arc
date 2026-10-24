// org Phase 02 -- `sync-to-project --team` installs exactly what `--products <closure>` installs (REQ-07, ADR-1619).
// Split out of team.test.mjs (ci Phase 02 pilot): two full installs take ~80 s, and node:test runs the tests of one
// file in series but files in parallel, so in its own file this case no longer holds the rest of team.test.mjs back.
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ARC_ROOT, runNode, runBash, tmpDir, treeManifest, suite } from "../_lib/arc.mjs";

const { test } = suite(import.meta.url);

test("org-team: sync --team installs byte-for-byte what --products <the team closure> installs (REQ-07)", (t) => {
  const tmp = tmpDir(t, "team-sync-");
  const src = join(tmp, "src");
  mkdirSync(src, { recursive: true });
  // git archive HEAD | tar -x, as the bats file did: the committed tree, never the working copy
  // tar runs IN src, never `-C <path>`: GNU tar reads a `C:\...` argument as host:path on Windows.
  const a = spawnSync("bash", ["-c", 'git -C "$1" archive HEAD | tar -x', "sh", ARC_ROOT], { encoding: "utf8", cwd: src });
  assert.equal(a.status, 0, `archive failed: ${a.stderr}`);
  assert.ok(existsSync(join(src, "sync-to-project.sh")), "archive is empty");
  assert.equal(runNode(join(src, ".claude/scripts/org/org-team.mjs"), ["--init", "lexos", "--root", src]).status, 0, "init failed");
  let r = runNode(join(src, ".claude/scripts/org/org-team.mjs"), ["--products-for", "lexos", "--root", src]);
  assert.equal(r.status, 0, r.output);
  const closure = r.output;
  assert.ok(`,${closure},`.includes(",core,"), `core missing from ${closure}`);
  mkdirSync(join(tmp, "a")); mkdirSync(join(tmp, "b"));
  r = runBash(join(src, "sync-to-project.sh"), [join(tmp, "a"), "--team", "lexos"]);
  assert.equal(r.status, 0, r.output);
  assert.ok(r.output.includes(`sync: team lexos -> products ${closure}`), r.output);
  r = runBash(join(src, "sync-to-project.sh"), [join(tmp, "b"), "--products", closure]);
  assert.equal(r.status, 0, r.output);
  const ma = treeManifest(join(tmp, "a"));
  assert.ok(ma.trim().length > 0, "nothing installed");
  assert.equal(ma, treeManifest(join(tmp, "b")));
});
