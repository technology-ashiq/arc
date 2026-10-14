#!/usr/bin/env node
/**
 * version-lint.mjs -- VERSION, package.json and CHANGELOG.md say the same thing, and the tags agree (distribute
 * P09, ADR-2025).
 *
 *   node .claude/scripts/core/version-lint.mjs [--root DIR]
 *
 * Checks: VERSION is one semver line; package.json `version` equals it; CHANGELOG.md opens with `## [Unreleased]`;
 * every other section is `## [x.y.z] - YYYY-MM-DD`, and their versions strictly descend; no section is newer than
 * VERSION. Tags: a `vX.Y.Z` tag for VERSION with no `[X.Y.Z]` section is a FAIL. A clone with no tags at all (CI
 * checkouts are shallow) reports `tags: not fetched` and skips that clause by name, never as a pass.
 *
 * Exit: 0 clean · 1 a FAIL · 2 usage or a file missing. Last line `RAN version-lint`. Zero dependencies, Node 18+.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const parse = (v) => v.split(".").map(Number);
const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

export function lint(root) {
  const lines = [];
  let fails = 0;
  const fail = (m) => { lines.push(`FAIL ${m}`); fails++; };
  const read = (f) => { try { return readFileSync(join(root, f), "utf8").replace(/\r/g, ""); } catch { return null; } };
  const version = read("VERSION");
  const pkg = read("package.json");
  const log = read("CHANGELOG.md");
  if (version === null || pkg === null || log === null) return { code: 2, lines: [`version-lint: ${root} lacks ${["VERSION", "package.json", "CHANGELOG.md"].filter((f) => read(f) === null).join(", ")}`] };
  const v = version.trim();
  if (!SEMVER.test(v) || version.split("\n").filter(Boolean).length !== 1) fail(`VERSION is not one semver line: ${JSON.stringify(version)}`);
  let pv = null;
  try { pv = JSON.parse(pkg).version; } catch { fail("package.json does not parse"); }
  if (pv !== null && pv !== v) fail(`package.json version ${pv} is not VERSION ${v}`);
  const heads = log.split("\n").filter((l) => /^## /.test(l)).map((l) => l.trimEnd());
  if (heads[0] !== "## [Unreleased]") fail(`CHANGELOG.md: [Unreleased] is not the first section (found ${JSON.stringify(heads[0] ?? "none")})`);
  const versions = [];
  for (const h of heads.slice(heads[0] === "## [Unreleased]" ? 1 : 0)) {
    const m = /^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/.exec(h);
    if (!m) { if (h !== "## [Unreleased]") fail(`CHANGELOG.md: section ${JSON.stringify(h)} is not "## [x.y.z] - YYYY-MM-DD"`); else fail("CHANGELOG.md: [Unreleased] appears twice or below a release"); continue; }
    versions.push(m[1]);
  }
  for (let i = 1; i < versions.length; i++) if (cmp(parse(versions[i - 1]), parse(versions[i])) <= 0) { fail(`CHANGELOG.md: sections do not descend (${versions[i - 1]} then ${versions[i]})`); break; }
  if (SEMVER.test(v)) for (const s of versions) if (cmp(parse(s), parse(v)) > 0) fail(`CHANGELOG.md: [${s}] is newer than VERSION ${v}`);
  const tags = spawnSync("git", ["-C", root, "tag", "--list", "v[0-9]*"], { encoding: "utf8" });
  const list = tags.status === 0 ? tags.stdout.split(/\r?\n/).filter(Boolean) : [];
  if (!list.length) lines.push("tags: not fetched (or none yet) -- the tag clause is skipped, by name");
  else if (list.includes(`v${v}`) && !versions.includes(v)) fail(`tag v${v} exists but CHANGELOG.md has no [${v}] section`);
  else lines.push(`tags: ${list.length} read; v${v} ${list.includes(`v${v}`) ? "has its section" : "not tagged yet"}`);
  lines.push(`version-lint: VERSION ${v}, ${versions.length} release section(s), ${fails} failure(s)`);
  return { code: fails ? 1 : 0, lines };
}

function main(argv) {
  let root = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1] && !argv[i + 1].startsWith("--") && root === null) root = argv[++i];
    else { console.error("usage: version-lint.mjs [--root DIR]"); return 2; }
  }
  const r = lint(resolve(root ?? join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..")));
  for (const l of r.lines) console.log(l);
  console.log("RAN version-lint");
  return r.code;
}

const self = (() => { try { return realpathSync(fileURLToPath(import.meta.url)); } catch { return ""; } })();
const invoked = (() => { try { return realpathSync(process.argv[1] ?? ""); } catch { return ""; } })();
if (self && self === invoked) process.exitCode = main(process.argv.slice(2));
