// dup-keys.mjs -- the face contract gates refuse a duplicate JSON key (org Cycle 20 Phase 04, REQ-06, ADR-1630).
// Each face contract file is mutated to hold one key twice (same value, so JSON.parse sees no change) inside an
// exact copy of the committed tree (git archive HEAD), and run through each gate that reads it. A clean copy must
// pass both gates first, or every refusal below could be about something else. Prints "RAN dup-keys N checks";
// exits 1 on any failure.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
let checks = 0;
let failed = 0;
const ok = (cond, what, detail = "") => { checks += 1; if (!cond) { failed += 1; console.log(`FAIL ${what}${detail ? ` -- ${String(detail).slice(0, 400)}` : ""}`); } };
const CONTRACTS = join("initiatives", "face", "contracts");
const gates = {
  "face-sections": (root) => spawnSync(process.execPath, [join(root, ".claude", "scripts", "core", "face-sections.mjs"), root, "--check"], { cwd: root, encoding: "utf8", timeout: 120_000 }),
  "face-coverage": (root) => spawnSync(process.execPath, [join(root, ".claude", "scripts", "core", "face-coverage.mjs"), root], { cwd: root, encoding: "utf8", timeout: 300_000 }),
};
// Which gate PARSES which file. face-coverage never reads room-copy.json; face-sections compares
// rooms.generated.json byte-for-byte against what it derives, so a duplicate there is caught as drift.
const READS = {
  "expected-set.json": { "face-sections": /duplicate object key/, "face-coverage": /duplicate object key/ },
  "room-copy.json": { "face-sections": /duplicate object key/ },
  "rooms.generated.json": { "face-sections": /face-registry-drift/, "face-coverage": /duplicate object key/ },
};

/** An exact copy of the committed tree: what CI checked out, nothing more and nothing less. */
function treeCopy(root) {
  mkdirSync(root, { recursive: true });
  const tar = spawnSync("git", ["-C", REPO, "archive", "--format=tar", "HEAD"], { maxBuffer: 1024 * 1024 * 1024 });
  if (tar.status !== 0) return `git archive: ${String(tar.stderr).slice(0, 200)}`;
  const x = spawnSync("tar", ["-xf", "-", "-C", root], { input: tar.stdout, maxBuffer: 64 * 1024 * 1024 });
  return x.status === 0 ? null : `tar: ${String(x.stderr).slice(0, 200)}`;
}

/** Duplicate the FIRST `"key": scalar,` line at four-space-or-deeper indent, so the parsed value is unchanged. */
function duplicateOneKey(text) {
  // CRLF kept as it is: a Windows checkout may end each line in a CR.
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /^\s{4,}"[^"]+": ("[^"]*"|\d+|true|false|null),\r?$/.test(l));
  if (i < 0) return null;
  lines.splice(i, 0, lines[i]);
  return { text: lines.join("\n"), key: /"([^"]+)"/.exec(lines[i])[1] };
}

const tmp = mkdtempSync(join(tmpdir(), "org-dup-keys-"));
try {
  // The control, on a copy: both gates pass, so a refusal below is the duplicate's and nothing else's.
  const clean = join(tmp, "clean");
  const err = treeCopy(clean);
  ok(err === null, "the fixture copied the committed tree", err);
  for (const [g, run] of Object.entries(gates)) {
    const r = run(clean);
    ok(r.status === 0, `${g} passes on a clean copy of the tree`, `status ${r.status}: ${`${r.stdout}${r.stderr}`.slice(-400)}`);
  }
  for (const [file, byGate] of Object.entries(READS)) {
    const root = join(tmp, file.replace(/\W/g, "-"));
    const e = treeCopy(root);
    ok(e === null, `${file}: the fixture copied the committed tree`, e);
    if (e) continue;
    const p = join(root, CONTRACTS, file);
    const original = readFileSync(p, "utf8");
    const mut = duplicateOneKey(original);
    ok(mut !== null, `${file}: the fixture found a key to duplicate (vacuous-pass guard)`);
    if (!mut) continue;
    ok(JSON.stringify(JSON.parse(mut.text)) === JSON.stringify(JSON.parse(original)), `${file}: the mutant parses to the same value (only the bytes differ)`);
    writeFileSync(p, mut.text);
    for (const [g, want] of Object.entries(byGate)) {
      const r = gates[g](root);
      const out = `${r.stdout}${r.stderr}`;
      // A number and not 0: a gate killed by the timeout has status null, which is a hang, not a refusal.
      ok(typeof r.status === "number" && r.status !== 0, `${g} fails on ${file} with "${mut.key}" twice`, `status ${r.status} signal ${r.signal}: ${out.slice(-300)}`);
      ok(out.includes(file) && want.test(out), `${g} names ${file} and why`, out.slice(-300));
    }
  }
} finally {
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`RAN dup-keys ${checks} checks, ${failed} failed`);
// exitCode, never exit(): exit() right after a burst of logs can cut piped stdout on Windows.
process.exitCode = failed ? 1 : 0;
