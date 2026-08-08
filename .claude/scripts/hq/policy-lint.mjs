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

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lintPolicy } from "./lib/policy/lint.mjs";
import { parsePolicyYaml } from "./lib/policy/yaml.mjs";
import { CAPABILITIES, minLevel } from "./lib/policy/model.mjs";
import { resolveEffectivePolicy } from "./lib/policy/reduce.mjs";
import { reproducedBy } from "./lib/policy/authorize.mjs";
// The subject-set resolution moved to lib/policy/subjects.mjs in Phase 03: kickoff-lint's
// birth rule consumes the SAME relation from the other direction, and a relation computed in
// two files is a relation that drifts (POL-D). This file's behaviour is unchanged.
import { processNames } from "./lib/policy/subjects.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");

/**
 * Print the DERIVED kind x capability x level table -- what the file actually means once
 * ADR-0507's shell derivation and the birth cap are applied, not what it appears to say.
 * A reviewer reading only the YAML cannot see either, and an adversarial pass showed a
 * one-line file mutation that changed every grant while the lint printed a bare count.
 */
function printDerivedTable(text) {
  let doc;
  try {
    doc = parsePolicyYaml(text);
  } catch {
    return;
  }
  const kinds = Object.keys(doc.kinds || {});
  if (kinds.length === 0) {
    process.stdout.write("  (no kinds declared -- every action kind is read-only at L1)\n");
    return;
  }
  const pad = (s, n) => String(s).padEnd(n);
  process.stdout.write(`  ${pad("action kind", 28)}${CAPABILITIES.map((c) => pad(c, 9)).join("")}\n`);
  for (const kind of kinds) {
    const cells = CAPABILITIES.map((capability) => {
      const declared = resolveEffectivePolicy(kind, capability, { policy: doc, events: [] });
      let level = declared.effective;
      if (capability === "shell") {
        const grant = doc.kinds[kind].shell || {};
        for (const c of reproducedBy(grant.argv0_allow, doc.argv0_classes))
          level = minLevel(level, resolveEffectivePolicy(kind, c, { policy: doc, events: [] }).effective);
      }
      return pad(level, 9);
    });
    process.stdout.write(`  ${pad(kind, 28)}${cells.join("")}\n`);
  }
  process.stdout.write("  (effective at birth: every cap starts at L1, so nothing above L1 executes yet)\n");
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
  // A missing file is a VIOLATION raised by lintPolicy, never a warning printed here: both E2
  // checks are on the never-cut list, so "is law" with them skipped is the poster document.
  const constitutionBuffer = existsSync(constitutionPath) ? readFileSync(constitutionPath) : null;

  const violations = lintPolicy(text, { constitutionBuffer, processNames: processNames(ROOT) });

  if (violations.length === 0) {
    // The path is printed RESOLVED. A CI step run from the wrong cwd once reported
    // "hq.policy.yaml is law" about an entirely different file.
    process.stdout.write(`policy-lint: ${path} is law -- 0 violations\n`);
    printDerivedTable(text);
    return 0;
  }
  process.stderr.write(`policy-lint: ${target} is NOT law -- ${violations.length} violation(s)\n`);
  for (const v of violations) process.stderr.write(`  - ${v}\n`);
  return 2;
}

process.exit(main(process.argv.slice(2)));
