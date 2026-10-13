// tests/distribute/self-render-probe.mjs -- drives the self-render owner rule (ADR-2023) with planted renders, for
// tests/distribute-self-render.bats. The real renders collide only on .agents/skills/, so a second collision can be
// induced only here.
// Usage: node tests/distribute/self-render-probe.mjs double|shared   Last line: `RAN self-render-probe`.
import { selfPlanFrom } from "../../.claude/scripts/engine/install-targets/self-render.mjs";
import { Refused } from "../../.claude/scripts/engine/install-targets/common.mjs";

const mode = process.argv[2];
const m = (pairs) => new Map(pairs);
const renders = {
  // Two targets claim one path outside the shared skills root: refused by name.
  double: [["codex", m([[".codex/a.toml", "a"]])], ["opencode", m([[".opencode/x", "first"]])], ["skills-only", m([[".opencode/x", "second"]])]],
  // codex then skills-only claim one skill: skills-only's bytes are kept, in either order.
  shared: [["codex", m([[".agents/skills/s/SKILL.md", "codex"]])], ["skills-only", m([[".agents/skills/s/SKILL.md", "skills-only"], [".agents/skills/t/SKILL.md", "t"]])]],
}[mode];
if (!renders) throw new Error(`mode must be double or shared, got ${mode}`);
process.stdout.write("RAN self-render-probe\n");
try {
  const plan = selfPlanFrom(renders);
  const rev = selfPlanFrom([...renders].reverse());
  for (const [p, { text, target }] of plan) process.stdout.write(`plan ${p} ${target} ${text}\n`);
  for (const [p, { target }] of rev) process.stdout.write(`reversed ${p} ${target}\n`);
} catch (e) {
  if (!(e instanceof Refused)) throw e;
  process.stdout.write(`refused [${e.reason}] ${e.message.slice(e.reason.length + 2)}\n`);
  process.exitCode = 1;
}
