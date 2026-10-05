// dup-keys.mjs -- the face contract gates refuse a duplicate JSON key (org Cycle 20 Phase 04, REQ-06, ADR-1630).
// The three face contract files, each mutated to hold one key twice (same value, so JSON.parse sees no change),
// run through face-sections --check and face-coverage on a full copy of this tree. Prints "RAN dup-keys N checks";
// exits 1 on any failure.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
let checks = 0;
let failed = 0;
const ok = (cond, what, detail = "") => { checks += 1; if (!cond) { failed += 1; console.log(`FAIL ${what}${detail ? ` -- ${String(detail).slice(0, 400)}` : ""}`); } };
const CONTRACTS = join("initiatives", "face", "contracts");
const gates = {
  "face-sections": (root) => spawnSync(process.execPath, [join(root, ".claude", "scripts", "core", "face-sections.mjs"), root, "--check"], { encoding: "utf8", timeout: 120_000 }),
  "face-coverage": (root) => spawnSync(process.execPath, [join(root, ".claude", "scripts", "core", "face-coverage.mjs"), root], { encoding: "utf8", timeout: 300_000 }),
};

// The control: both gates pass on this tree as it is.
for (const [g, run] of Object.entries(gates)) {
  const r = run(REPO);
  ok(r.status === 0, `${g} passes on the tree with no duplicate key`, `${r.status} ${r.stdout} ${r.stderr}`);
}

/** Duplicate the FIRST `"key": value,` line at two-space-or-deeper indent, so the parsed value is unchanged. */
function duplicateOneKey(text) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /^\s{4,}"[^"]+": ("[^"]*"|\d+|true|false|null),$/.test(l));
  if (i < 0) return null;
  lines.splice(i, 0, lines[i]);
  return { text: lines.join("\n"), key: /"([^"]+)"/.exec(lines[i])[1] };
}

const tmp = mkdtempSync(join(tmpdir(), "org-dup-keys-"));
for (const file of ["expected-set.json", "room-copy.json", "rooms.generated.json"]) {
  const root = join(tmp, file.replace(/\W/g, "-"));
  for (const d of [".claude/scripts", "initiatives/face", "products", "processes", "org", "face", "docs", ".claude/agents", ".claude/commands", ".claude/skills", ".claude/rules", "engine", ".github"]) {
    try { cpSync(join(REPO, d), join(root, d), { recursive: true, filter: (s) => !/node_modules|[\\/]dist[\\/]/.test(s) }); } catch { /* absent on this tree */ }
  }
  for (const f of ["ventures.yaml", "hq.policy.yaml", "PORTFOLIO.md", "CLAUDE.md", "sync-to-project.sh"]) {
    try { writeFileSync(join(root, f), readFileSync(join(REPO, f))); } catch { /* absent */ }
  }
  const p = join(root, CONTRACTS, file);
  const original = readFileSync(p, "utf8");
  const mut = duplicateOneKey(original);
  ok(mut !== null, `${file}: the fixture found a key to duplicate (vacuous-pass guard)`);
  if (!mut) continue;
  ok(JSON.stringify(JSON.parse(mut.text)) === JSON.stringify(JSON.parse(original)), `${file}: the mutant parses to the same value (it is only the bytes that differ)`);
  writeFileSync(p, mut.text);
  for (const [g, run] of Object.entries(gates)) {
    const r = run(root);
    const out = `${r.stdout}${r.stderr}`;
    ok(r.status !== 0, `${g} fails on ${file} with "${mut.key}" twice`, `passed with a duplicate key: ${out.slice(-300)}`);
    ok(out.includes(file) && /duplicate/i.test(out), `${g} names ${file} and the duplicate`, out.slice(-300));
  }
}

console.log(`RAN dup-keys ${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
