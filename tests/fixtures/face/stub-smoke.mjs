// A smoke that exits 0 WITHOUT navigating: the mutant control face v2 Phase 00's verification
// plan keeps. It prints the same summary lines harness-run prints, from the committed stub
// report (0 opened, 0 errors) with the openable and expected counts derived at run time from
// the served contract, so tests/face-browser.bats can prove its summary verdict FAILS a run that
// looked at nothing -- "errors=0" is exactly what such a run prints.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const smoke = await import(pathToFileURL(join(REPO, "face", "scripts", "smoke.mjs")).href);
const harness = await import(pathToFileURL(join(REPO, "face", "scripts", "harness-run.mjs")).href);

const report = JSON.parse(readFileSync(join(REPO, "tests", "fixtures", "face", "smoke-stub-report.json"), "utf8"));
const expected = harness.expectedOpenable(REPO);
if (expected.length === 0) {
  console.error("stub-smoke: the contract names no openable room, so this control would prove nothing");
  process.exitCode = 2;
} else {
  report.openable = expected.length;
  report.expected = expected.length;
  console.log("face-browser: RAN leg=stub (a smoke that never navigates)");
  for (const line of smoke.summaryLines(report)) console.log(line);
}
