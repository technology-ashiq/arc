// paste-lint-probe.mjs -- run a (pasted) lintPolicy over a policy file with one grant's evidence_days replaced.
//
//   node paste-lint-probe.mjs <lint.mjs> <hq.policy.yaml> <repo-root> <evidence_days-literal|keep>
//
// Prints `VIOLATIONS <n>` and then each violation. `keep` lints the file as it is.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [lintPath, yamlPath, root, literal] = process.argv.slice(2);
const { lintPolicy } = await import(pathToFileURL(resolve(lintPath)).href);
const { processNames } = await import(pathToFileURL(resolve(root, ".claude/scripts/hq/lib/policy/subjects.mjs")).href);
let text = readFileSync(yamlPath, "utf8");
if (literal !== "keep") {
  const from = "shell: { level: L1, evidence_days: 35 }";
  if (!text.includes(from)) { console.log("FIXTURE-MISSING no evidence_days grant to replace"); process.exit(2); }
  text = text.replace(from, `shell: { level: L1, evidence_days: ${literal} }`);
}
const v = lintPolicy(text, { constitutionBuffer: readFileSync(join(resolve(root), "CONSTITUTION.md")), processNames: processNames(resolve(root)) });
console.log(`VIOLATIONS ${v.length}`);
for (const x of v) console.log(x);
