#!/usr/bin/env node
// generate-paste.mjs -- policy cycle 2, Phase 02 (REQ-05, ADR-0510/0511). Builds the owner paste as WHOLE FILES from the
// LIVE files, never as diffs (the Phase 04 lesson: three diffs sat undone for a day; two whole files closed in one
// sitting). Every edit is asserted to apply exactly once, so a live file that drifted refuses to generate rather than
// producing a paste that silently reverts someone else's change.
//
//   node initiatives/policy/evidence/phase-02/generate-paste.mjs        (from the repo root)
//
// Writes initiatives/policy/evidence/phase-02/paste/<repo-relative path> and manifest.json (sha256 per file). It never
// writes a live file: every target is deny-listed for an agent, by design (ADR-0502).
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = "initiatives/policy/evidence/phase-02/paste";
// Hashed with CRLF folded to LF: a Windows checkout with autocrlf holds the same text in other bytes (attack p02 B6).
const sha = (s) => createHash("sha256").update(s.replace(/\r\n/g, "\n")).digest("hex");
const files = {};

function edit(rel, steps) {
  let t = readFileSync(rel, "utf8");
  for (const [label, from, to, times = 1] of steps) {
    const n = typeof from === "string" ? t.split(from).length - 1 : (t.match(from) || []).length;
    if (n !== times) throw new Error(`${rel}: step "${label}" matched ${n} time(s), expected ${times} -- the live file drifted; regenerate from a fresh read`);
    t = typeof from === "string" ? t.split(from).join(to) : t.replace(from, to);
  }
  files[rel] = t;
}

// 1. hq.policy.yaml -- N next to the level on every in-scope grant at L1, and the evidence code on the guarded list.
edit("hq.policy.yaml", [
  ["shell L1 grants get N", /^    shell: \{ level: L1 \}$/gm, "    shell: { level: L1, evidence_days: 35 }", 11],
  ["network L1 grants get N", /^    network: \{ level: L1 \}$/gm, "    network: { level: L1, evidence_days: 35 }", 6],
  ["evidence code is guard code",
    '  - ".claude/scripts/hq/policy-matrix.mjs"\n',
    '  - ".claude/scripts/hq/policy-matrix.mjs"\n' +
    '  # POL-L (ADR-0511): the evidence fold, its reader and the refusal profile decide whether the guard reports\n' +
    '  # clean. A guard an agent can edit to report clean is not a guard -- the same sentence as the policy lib above.\n' +
    '  - ".claude/scripts/hq/lib/policy-evidence/**"\n' +
    '  - ".claude/scripts/hq/policy-evidence.mjs"\n' +
    '  - ".claude/scripts/hq/lib/validate-policy-refusal.mjs"\n'],
  ["the N is explained where it is declared",
    "\nkinds:\n",
    "\n# evidence_days (POL-L, ADR-0510): how many IST days a refusal receipt stays FRESH for that pair. A pair at\n" +
    "# effective L1+ on spend/publish/deploy/network/shell with no fresh typed refusal reads BELOW-BAR -- a configured\n" +
    "# level is not an evidenced one. It never changes a level. 35 = the monthly guard's cadence plus 4 days' grace.\n" +
    "kinds:\n"],
]);

// 2. lib/policy/lint.mjs -- a declared N must be usable. Absent is fine (BELOW-BAR no-bar-declared); 0 is not.
edit(".claude/scripts/hq/lib/policy/lint.mjs", [
  ["evidence_days validation",
    '      const above1 = rank(level) > rank("L1");\n',
    '      const above1 = rank(level) > rank("L1");\n\n' +
    "      // POL-L (ADR-0510): N is a whole number of days, or absent. A declared 0, a negative, a fraction or a string is a\n" +
    "      // grant that claims a bar and sets none -- the evidence fold reads it as invalid-bar, and the law refuses it here.\n" +
    '      if (Object.prototype.hasOwnProperty.call(grant, "evidence_days") &&\n' +
    "          !(Number.isInteger(grant.evidence_days) && grant.evidence_days >= 1 && grant.evidence_days <= 3650))\n" +
    "        add(`${where}.${capability}.evidence_days ${JSON.stringify(grant.evidence_days)} must be a whole number of days, 1..3650 (ADR-0510)`);\n"],
]);

// 3. policy-lint.mjs -- `--evidence` delegates to the ONE implementation of BELOW-BAR (POL-D, ADR-0511).
edit(".claude/scripts/hq/policy-lint.mjs", [
  ["usage line",
    " *   node .claude/scripts/hq/policy-lint.mjs [path]     default: hq.policy.yaml\n *\n * Exit codes: 0 clean · 1 usage/IO · 2 the file is not law.\n",
    " *   node .claude/scripts/hq/policy-lint.mjs [path] [--evidence]     default: hq.policy.yaml\n *\n" +
    " * Exit codes: 0 clean · 1 usage/IO · 2 the file is not law · 3 (--evidence only) law, but a level is BELOW-BAR.\n" +
    " * `--evidence` runs `policy-evidence.mjs check` after the file is law -- BELOW-BAR lives there once (POL-L, ADR-0511).\n"],
  ["import spawnSync", 'import { readFileSync, existsSync } from "node:fs";\n',
    'import { spawnSync } from "node:child_process";\nimport { readFileSync, existsSync, realpathSync } from "node:fs";\n'],
  ["flag parse", '  const args = argv.filter((a) => a !== "--");\n',
    '  const evidence = argv.includes("--evidence");\n  const args = argv.filter((a) => a !== "--" && a !== "--evidence");\n'],
  ["delegate after law",
    "    printDerivedTable(text);\n    return 0;\n",
    "    printDerivedTable(text);\n    if (!evidence) return 0;\n" +
    "    // --evidence judges the GOVERNING policy and spine; a verdict about another file would be confident and wrong.\n" +
    "    // By filesystem identity, not string: Windows names one temp dir two ways (RUNNER~1 vs runneradmin), and a\n" +
    "    // string compare refused the governing file itself on CI (attack p02 r2 B8, closed).\n" +
    "    const real = (p) => { try { const r = realpathSync.native(p); return process.platform === \"win32\" ? r.toLowerCase() : r; } catch { return null; } };\n" +
    '    if (real(path) === null || real(path) !== real(resolve(ROOT, "hq.policy.yaml"))) {\n' +
    '      process.stderr.write(`policy-lint: --evidence judges the governing ${resolve(ROOT, "hq.policy.yaml")}, not ${target}\\n`);\n' +
    '      return 1;\n    }\n' +
    "    // The delegate judges THIS root: cwd and both selectors pinned, never inherited (attack p02 r2 B1).\n" +
    '    const r = spawnSync(process.execPath, [join(HERE, "policy-evidence.mjs"), "check"], { stdio: "inherit", cwd: ROOT,\n' +
    '      env: { ...process.env, ARC_ROOT: ROOT, ARC_SPINE_ROOT: join(ROOT, ".claude", "state", "hq") } });\n' +
    "    if (r.status === null) {\n" +
    '      process.stderr.write(`policy-lint: policy-evidence check did not run (${r.error ? r.error.message : r.signal})\\n`);\n' +
    "      return 1;\n    }\n" +
    "    return r.status;\n"],
]);

// 4. policy-hook.mjs -- an interactive refusal becomes evidence (REQ-05). Best effort, bounded, never changes the block.
edit(".claude/scripts/hq/policy-hook.mjs", [
  ["imports", 'import { SESSION_KIND } from "./lib/policy/model.mjs";\n',
    'import { SESSION_KIND } from "./lib/policy/model.mjs";\n' +
    'import { execFileSync } from "node:child_process";\n' +
    'import { closeSync, openSync, statSync, unlinkSync } from "node:fs";\n' +
    'import { canonicalSpine, sameSpine, sealedRefusalToday } from "./lib/policy-evidence/load.mjs";\n' +
    'import { capReason } from "./lib/validate-policy-refusal.mjs";\n' +
    'import { formatIst, nowMs } from "./lib/canonical.mjs";\n'],
  ["recordRefusal", "function main() {\n",
    "// POL-L (REQ-05, ADR-0509): a refusal at L1+ is EVIDENCE that the level's refusal path works, so it becomes a typed\n" +
    "// `policy.refusal` receipt -- at most one per (capability, decision, IST day), only on the canonical spine, bounded,\n" +
    "// and never able to change the block: a lost receipt goes to stderr and the exit code is decided before this runs.\n" +
    "// 3000 ms, not 500: measured 2026-10-07, a warm emit is ~300 ms and the first of a session 2077 ms, so a 500 ms\n" +
    "// bound would drop the first receipt of every session -- the very evidence this exists to record.\n" +
    "// A slow runner may raise the bound through ARC_POLICY_REFUSAL_TIMEOUT_MS; it is a wait, never a selector (p02 r2 B5).\n" +
    "const REFUSAL_EMIT_TIMEOUT_MS = Number(process.env.ARC_POLICY_REFUSAL_TIMEOUT_MS) > 0 ? Number(process.env.ARC_POLICY_REFUSAL_TIMEOUT_MS) : 3000;\n" +
    'const REFUSAL_PROCESS = "policy-hook@1.0.0";\n' +
    "function recordRefusal({ root, capability, level, decision, reason }) {\n" +
    '  if (level === "L0") return; // the deny IS the level: nothing to evidence (ADR-0510, n/a)\n' +
    "  let lockFd = null, lock = null;\n" +
    "  try {\n" +
    '    const writerSpine = process.env.ARC_SPINE_ROOT || join(root, ".claude", "state", "hq");\n' +
    "    if (!sameSpine(writerSpine, canonicalSpine(root))) return;\n" +
    "    // ONE writer at a time across the check and the emit (attack p02 r2 L1): parallel tool calls run parallel hooks,\n" +
    "    // and a check-then-emit with no lock seals two. A fresh lock is another hook mid-write -- its receipt is today's,\n" +
    "    // so this one has nothing to add. A lock older than a minute is a crashed writer's, taken over once.\n" +
    '    lock = join(writerSpine, ".policy-refusal.lock");\n' +
    '    try { lockFd = openSync(lock, "wx"); } catch {\n' +
    "      if (Date.now() - statSync(lock).mtimeMs < 60000) { lock = null; return; }\n" +
    '      unlinkSync(lock); lockFd = openSync(lock, "wx");\n' +
    "    }\n" +
    "    const day = formatIst(nowMs()).slice(0, 10);\n" +
    '    if (sealedRefusalToday({ eventsDir: join(writerSpine, "events"), day, actionKind: SESSION_KIND, capability,\n' +
    '      process: REFUSAL_PROCESS, decision, surface: "interactive", level })) return;\n' +
    '    execFileSync("bash", [join(root, ".claude", "scripts", "hq", "arc-event.sh"), "emit", "note.logged", "--payload",\n' +
    '      JSON.stringify({ subject: "policy.refusal", action_kind: SESSION_KIND, capability, level, decision,\n' +
    '        surface: "interactive", reason: capReason(reason) }),\n' +
    '      "--strict", "--process", REFUSAL_PROCESS, "--outcome", "fail"],\n' +
    '    { encoding: "utf8", cwd: root, timeout: REFUSAL_EMIT_TIMEOUT_MS, killSignal: "SIGKILL", stdio: ["ignore", "pipe", "pipe"],\n' +
    '      // The spine that was checked is the spine that is written: both selectors pinned (attack p02 B3).\n' +
    '      env: { ...process.env, ARC_SPINE_ROOT: writerSpine, ARC_ROOT: root } });\n' +
    "  } catch (e) {\n" +
    '    // Even the report cannot throw: a closed stderr must not turn the block into exit 1 (attack p02 B5).\n' +
    '    try { process.stderr.write(`policy: refusal evidence not recorded (${String(e && e.message).split("\\n")[0]}) -- the block stands\\n`); } catch { /* the block stands either way */ }\n' +
    "  } finally {\n" +
    "    if (lockFd !== null) try { closeSync(lockFd); } catch { /* released below */ }\n" +
    "    if (lockFd !== null && lock) try { unlinkSync(lock); } catch { /* a stale lock is taken over after a minute */ }\n" +
    "  }\n}\n\nfunction main() {\n"],
  ["deny records", "        process.stdout.write(`policy: WARN the overreach was NOT recorded -- ${bite.reason}\\n`);\n      return 2;\n",
    "        process.stdout.write(`policy: WARN the overreach was NOT recorded -- ${bite.reason}\\n`);\n" +
    '      recordRefusal({ root, capability, level: verdict.effective, decision: "deny", reason: verdict.reason });\n      return 2;\n'],
  ["propose records", "        `decision citing trial-ledger evidence (${verdict.reason})\\n`\n      );\n      return 2;\n",
    "        `decision citing trial-ledger evidence (${verdict.reason})\\n`\n      );\n" +
    '      recordRefusal({ root, capability, level: verdict.effective, decision: "propose", reason: verdict.reason });\n      return 2;\n'],
]);

// 5. The fold learns the interactive writer exists -- in the SAME paste as the writer, so a cell never reads
//    "absent" (a writer exists and never fired) on a day the hook still writes nothing.
edit(".claude/scripts/hq/lib/policy-evidence/fold.mjs", [
  ["interactive writer", "  interactive: Object.freeze([]),\n", '  interactive: Object.freeze(["L1", "L2", "L3"]),\n'],
]);

// 6. settings.json -- the static deny floor (ADR-0501 layer 2) covers the evidence code too.
edit(".claude/settings.json", [
  ["deny floor",
    '      "Write(./.claude/scripts/hq/policy-lint.mjs)",\n',
    '      "Write(./.claude/scripts/hq/policy-lint.mjs)",\n' +
    '      "Edit(./.claude/scripts/hq/lib/policy-evidence/**)",\n' +
    '      "Write(./.claude/scripts/hq/lib/policy-evidence/**)",\n' +
    '      "Edit(./.claude/scripts/hq/policy-evidence.mjs)",\n' +
    '      "Write(./.claude/scripts/hq/policy-evidence.mjs)",\n' +
    '      "Edit(./.claude/scripts/hq/lib/validate-policy-refusal.mjs)",\n' +
    '      "Write(./.claude/scripts/hq/lib/validate-policy-refusal.mjs)",\n'],
]);

const manifest = {};
for (const [rel, text] of Object.entries(files)) {
  const out = join(OUT, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text, "utf8");
  manifest[rel] = { live_before: sha(readFileSync(rel, "utf8")), paste: sha(text) };
}
writeFileSync(join(dirname(OUT), "paste-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
for (const [rel, m] of Object.entries(manifest)) console.log(`${m.paste.slice(0, 12)}  ${rel}`);
