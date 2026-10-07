// mutants.mjs -- writes ONE named mutant of a policy-evidence module beside the original (same directory, so its
// relative imports still resolve) and prints the mutant's path.
//
//   node mutants.mjs <module.mjs> <mutant-name>
//
// Each mutant must apply EXACTLY once. A replacement that matched nothing would hand the caller an unmutated copy,
// and the "mutant is killed" assertion would then be testing the real code -- a silent pass generator.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";

const MUTANTS = {
  // invariant (a): an absent receipt stops counting as BELOW-BAR
  "M-a": ['below_bar: inScope && state !== "fresh",', 'below_bar: inScope && state !== "fresh" && state !== "absent",'],
  // invariant (b): the age read from the clock instead of the injected as-of day
  "M-b": ["if (qualifying) age = dayDiff(istDay(qualifying.ts), asOf);", "if (qualifying) age = Math.floor((Date.now() - Date.parse(qualifying.ts)) / 86400000);"],
  // invariant (b): the boundary moved one day early
  "M-b2": ["else if (age > n) {", "else if (age >= n) {"],
  // IST bucketing replaced by UTC
  "M-utc": ["const m = typeof ts === \"string\" ? TS_DAY_RE.exec(ts) : null;\n  return m ? m[1] : null;", "return typeof ts === \"string\" ? new Date(ts).toISOString().slice(0, 10) : null;"],
  // events after the as-of day folded
  "M-future": ["return d !== null && dayDiff(d, asOf) >= 0;", "return d !== null;"],
  // a refusal at any level refreshes the pair
  "M-l0": ["if (p.level === effective && effective !== \"L0\" && (effective !== \"L1\" || p.decision === \"propose\")) qualifying = e;", "qualifying = e;"],
  // a deny at L1 counted as proof of the L1 (propose) path (attack r2 L2)
  "M-l1deny": ["(effective !== \"L1\" || p.decision === \"propose\")", "true"],
  // the receipt-surface-must-match-subject check deleted (attack r2 L3)
  "M-surface": ["if (p.surface !== surface) { unverified++; continue; }", "if (false) { unverified++; continue; }"],
  // the level-consistency check deleted
  "M-noforge": ["if (!consistent(e, then)) { inconsistent++; continue; }", "if (false) { inconsistent++; continue; }"],
  // the incident corroboration deleted
  "M-ref": ["if (!inc || !(inc.id < e.id) || inc.process !== e.process || istDay(inc.ts) !== istDay(e.ts) || !denied) { unverified++; continue; }", "if (false) { unverified++; continue; }"],
  // the incident-precedes-refusal order check deleted (attack r1 L2)
  "M-order": ["!(inc.id < e.id) || ", ""],
  // the typed-denials corroboration deleted (attack r1 L3)
  "M-denials": [" || !denied) { unverified++", ") { unverified++"],
  // the same-process@version check weakened to the stem (attack r1 L5)
  "M-version": ["inc.process !== e.process", "String(inc.process).split(\"@\")[0] !== String(e.process).split(\"@\")[0]"],
  // calendar validity deleted (attack r1 L7/B4)
  "M-calendar": ["return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3];", "return true;"],
  // the no-writer-means-forged check deleted
  "M-writer": ["if (!Object.prototype.hasOwnProperty.call(writers, p.surface) || !writers[p.surface].includes(p.level)) { unverified++; continue; }", "if (false) { unverified++; continue; }"],
  // policy-evidence.mjs guard, invariant (c): the guard judges a list with one BELOW-BAR cell dropped
  "M-c": ["const all = r.cells;", "const all = r.cells.filter((c, i) => i !== r.cells.findIndex((x) => x.below_bar));"],
  // load.mjs: the sha recompute deleted
  "M-sha": ["return typeof e.sha === \"string\" && e.sha === sealed ? e : null;", "void sealed; return e;"],
};

const [src, name] = process.argv.slice(2);
const m = MUTANTS[name];
if (!m) { process.stderr.write(`mutants: unknown mutant ${JSON.stringify(name)}\n`); process.exit(2); }
const text = readFileSync(src, "utf8");
const count = text.split(m[0]).length - 1;
if (count !== 1) { process.stderr.write(`mutants: ${name} matched ${count} times in ${src}, expected exactly 1\n`); process.exit(2); }
const out = join(dirname(src), `${basename(src, ".mjs")}.mut-${name}.mjs`);
writeFileSync(out, text.replace(m[0], m[1]), "utf8");
process.stdout.write(out + "\n");
