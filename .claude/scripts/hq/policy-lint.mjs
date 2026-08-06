#!/usr/bin/env node
/**
 * policy-lint -- the validator for hq.policy.yaml.
 *
 * EXIT 2 ON ANY VIOLATION, FROM BIRTH. This is not an advisory lint and it has no WARN-first
 * period: the spine strict-mode precedent applies, because a policy file that parses when it
 * should not is a grant nobody authorised. Every other new lint this cycle starts WARN-first in
 * TRIAL; this one never does.
 *
 *   node .claude/scripts/hq/policy-lint.mjs [path]     default: hq.policy.yaml
 *
 * Exit codes: 0 clean · 1 usage/IO · 2 the file is not law.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lintPolicy } from "./lib/policy/lint.mjs";
import { parsePolicyYaml } from "./lib/policy/yaml.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");

/** The closed subject set is a directory listing, never an invention (ADR-0504). */
function processNames(root) {
  const dir = join(root, "processes");
  if (!existsSync(dir)) return null; // no processes/ at all -- cannot check, do not pretend to
  const names = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".process.yaml")) continue;
    try {
      const doc = parsePolicyYaml(readFileSync(join(dir, file), "utf8"));
      if (doc && typeof doc.name === "string") names.push(doc.name);
      else names.push(file.replace(/\.process\.yaml$/, ""));
    } catch {
      // A process file this narrow parser cannot read still contributes its filename, so a
      // policy row for it is not rejected because of an unrelated parser limitation.
      names.push(file.replace(/\.process\.yaml$/, ""));
    }
  }
  return names;
}

function main(argv) {
  const args = argv.filter((a) => a !== "--");
  const target = args[0] || "hq.policy.yaml";
  const path = resolve(process.cwd(), target);

  if (!existsSync(path)) {
    process.stderr.write(`policy-lint: no such file: ${target}\n`);
    return 1;
  }

  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    process.stderr.write(`policy-lint: cannot read ${target}: ${e.message}\n`);
    return 1;
  }

  const constitutionPath = join(ROOT, "CONSTITUTION.md");
  // ONE buffer for both the hash check and the parse -- no TOCTOU gap between them (ADR-0506).
  const constitutionBuffer = existsSync(constitutionPath) ? readFileSync(constitutionPath) : null;
  if (!constitutionBuffer)
    process.stderr.write("policy-lint: CONSTITUTION.md not found -- E2 checks skipped\n");

  const violations = lintPolicy(text, { constitutionBuffer, processNames: processNames(ROOT) });

  if (violations.length === 0) {
    process.stdout.write(`policy-lint: ${target} is law -- 0 violations\n`);
    return 0;
  }
  process.stderr.write(`policy-lint: ${target} is NOT law -- ${violations.length} violation(s)\n`);
  for (const v of violations) process.stderr.write(`  - ${v}\n`);
  return 2;
}

process.exit(main(process.argv.slice(2)));
