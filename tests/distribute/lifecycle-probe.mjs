// tests/distribute/lifecycle-probe.mjs -- drives `outdated` / `upgrade` (install-targets/lifecycle.mjs) against a
// fixture arc tree, for tests/distribute-lifecycle.bats. bin/arc.mjs always renders from its own checkout; the probe
// names the tree, so a fixture repo with its own tags and history can stand in for arc.
// Usage: node tests/distribute/lifecycle-probe.mjs outdated|upgrade DIR TREE [--to TAG] [--confirm] [--force]
// Last line: `RAN lifecycle-probe <code>`; exit = the verb's code.
import { outdated, upgrade } from "../../.claude/scripts/engine/install-targets/lifecycle.mjs";
import { TARGETS } from "../../.claude/scripts/engine/arc-install.mjs";
import { Refused, targetDir } from "../../.claude/scripts/engine/install-targets/common.mjs";

const [verb, dir, tree, ...rest] = process.argv.slice(2);
if (!["outdated", "upgrade"].includes(verb) || !dir || !tree) throw new Error("usage: outdated|upgrade DIR TREE [...]");
const opt = { to: null, confirm: false, force: false };
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--to") opt.to = rest[++i];
  else if (rest[i] === "--confirm") opt.confirm = true;
  else if (rest[i] === "--force") opt.force = true;
  else throw new Error(`unknown ${rest[i]}`);
}
let code;
try {
  const d = targetDir(dir);
  const r = verb === "outdated" ? outdated(d, tree) : upgrade(d, tree, TARGETS, opt);
  for (const l of r.lines) process.stdout.write(`${l}\n`);
  code = r.code;
} catch (e) {
  if (!(e instanceof Refused)) throw e;
  process.stdout.write(`refused [${e.reason}] ${e.message.slice(e.reason.length + 2)}\n`);
  code = 2;
}
process.stdout.write(`RAN lifecycle-probe ${code}\n`);
process.exitCode = code;
