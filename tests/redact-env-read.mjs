// The data boundary's generic-credential-assignment rule, narrowed for ONE thing: an exact environment read
// (engine bug, 2026-09-26 -- `const API_KEY = process.env.ARC_LLM_API_KEY` refused every attack diff that reached it).
// A secret gate that changes must be seen refusing as well as passing: every exemption below is paired with the
// literal it must still catch, and the OLD rule is run on the same lines to prove the exemption is what changed.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const R = await import(pathToFileURL(join(REPO, ".claude/scripts/hq/lib/redact.mjs")).href);
let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};
const RULE = R.DENY_RULES.find((r) => r.name === "generic-credential-assignment");
// The rule as it stood before the exemption, verbatim, as the control.
const OLD = /\b(?:api[_-]?key|secret|password|passwd|passphrase|access[_-]?token|auth[_-]?token)\b['"]?\s{0,8}[:=]\s{0,8}['"]?[^\s'"]{8,512}/i;
const hits = (line) => RULE.re.test(line);

check("fixture: the rule exists under its name (vacuous-pass guard)", !!RULE && RULE.re instanceof RegExp);

const READS = [
  'const API_KEY = process.env.ARC_LLM_API_KEY || "";',
  "password: process.env.DB_PASS;",
  "fetch(url, { api_key: process.env.OPENROUTER_KEY })",
  "secret = process.env.WEBHOOK_SECRET,",
  "prose: the `API_KEY = process.env.ARC_LLM_API_KEY` line names a key, holds none",
];
check("an exact env read is not a credential, in every shape the code writes it", READS.every((l) => !hits(l)), READS.filter(hits).join(" | "));
check("CONTROL: the rule as it stood flagged every one of those lines -- the exemption is what changed", READS.every((l) => OLD.test(l)), READS.filter((l) => !OLD.test(l)).join(" | "));

// Each literal is ASSEMBLED at run time, its keyword cut in two, so this file's source holds no credential-shaped assignment:
// the attack pass sends a diff through this very rule before any model sees it, and a test of the rule that trips the
// rule is a test nobody can attack. The strings the rule is held to are exactly the joined ones.
const glue = (a, b) => `${a}${b}`;
const LITERALS = [
  glue('const api_', 'key = "sk-realLookingValue1234567890"'),
  glue("pass", "word=hunter2hunter2"),
  glue("api_", "key = process.env.X+sk-leakleakleakleak"),
  glue("api_", "key=process.env.X/extra-literal-appended"),
  glue("sec", "ret: process.envX_notAnEnvRead_12345"),
  glue("auth_to", "ken = processXenv.TOKEN_LOOKALIKE"),
  // A literal FALLBACK after the read: the exemption once covered the read and let the fallback through (attack
  // 415d3a3 L1). Also as the whitespace-stripped view writes it.
  glue("const API_", 'KEY = process.env.ARC_LLM_API_KEY || "sk-realLookingValue1234567890"'),
  glue("api_", 'key=process.env.X??"hunter2hunter2hunter2"'),
  glue("sec", "ret = process.env.X && hunter2hunter2hunter2"),
];
check("a literal credential, or one glued to an env read, is still caught", LITERALS.every(hits), LITERALS.filter((l) => !hits(l)).join(" | "));

// Through the scanner every caller uses, not only the rule: arc-run refuses --input on any hit.
// EVERY read passes EVERY view the scanner builds -- the whitespace-stripped view put `})` right after the name and
// refused the first narrowing (attack round, 2026-09-27) -- and every literal is refused by this rule's name.
const scan = (line) => R.scanSecrets(JSON.stringify({ v: line }), { v: line });
check("scanSecrets, over all its views, passes every env read and refuses every literal by this rule's name",
  READS.every((l) => scan(l).hit === false) && LITERALS.every((l) => scan(l).hit === true && scan(l).rule === "generic-credential-assignment"),
  JSON.stringify([...READS.map((l) => [l.slice(0, 40), scan(l)]).filter((x) => x[1].hit), ...LITERALS.map((l) => [l.slice(0, 40), scan(l)]).filter((x) => !x[1].hit)]));

console.log(`RAN: ${ran} checks`);
process.exitCode = failed === 0 && ran === 5 ? 0 : 1;
