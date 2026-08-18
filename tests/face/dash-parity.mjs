#!/usr/bin/env node
// dash-parity.mjs -- THE fixture behind FACE-C/ADR-1302: the decision door emits a
// `decision.recorded` byte-identical to the CLI's, because it IS the CLI's function.
//
// Method: two clones of one seeded fixture spine; the same open approval decided with the
// same reason -- once by `arc-inbox approve` (CLI), once through POST /api/decide (door).
// Every envelope key must be identical EXCEPT id and ts (fresh per emit) and sha (the sha
// covers id+ts, so it differs BECAUSE they do -- derived, not independent; counted off the
// live envelope: 16 keys, 2026-08-19). `actor` is asserted identical BY NAME: the door
// substituting its own actor identity is the exact impersonation this fixture exists to
// catch (second-opinion finding A5).

import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PORT = 8411;

const tmp = mkdtempSync(join(tmpdir(), "face-parity-"));
const BASE = join(tmp, "base");
const CLI_SPINE = join(tmp, "cli");
const DOOR_SPINE = join(tmp, "door");
const REASON = "parity fixture -- one reason, two doors";

const gen = JSON.parse(execFileSync(process.execPath,
  [join(REPO, "tests/fixtures/face/gen-spine.mjs"), "--out", BASE, "--count", "500", "--days", "5", "--seed", "parity-1"],
  { stdio: ["ignore", "pipe", "inherit"] }).toString());

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

check("fixture loaded + open approval exists (vacuous-pass guard)", gen.events === 500 && !!gen.openApproval, JSON.stringify(gen));
const APPROVAL = gen.openApproval;

cpSync(BASE, CLI_SPINE, { recursive: true });
cpSync(BASE, DOOR_SPINE, { recursive: true });

// CLI side
execFileSync(process.execPath, [join(REPO, ".claude/scripts/hq/arc-inbox.mjs"), "approve", APPROVAL, "--reason", REASON],
  { env: { ...process.env, ARC_SPINE_ROOT: CLI_SPINE }, stdio: ["ignore", "ignore", "pipe"] });

// door side
const dash = spawn(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--spine", DOOR_SPINE, "--port", String(PORT)],
  { env: { ...process.env, ARC_DASH_TOKEN: "parity-token", ARC_DASH_JOURNAL_DIR: join(tmp, "journal") }, stdio: "ignore" });
dash.unref();
let up = false;
for (let i = 0; i < 50 && !up; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { up = (await fetch(`http://127.0.0.1:${PORT}/api/health`, { headers: { Authorization: "Bearer parity-token" } })).status === 200; } catch { /* not yet */ }
}
try {
  check("door up", up);
  const resp = await fetch(`http://127.0.0.1:${PORT}/api/decide`, {
    method: "POST",
    headers: { Authorization: "Bearer parity-token", "Content-Type": "application/json", Origin: `http://127.0.0.1:${PORT}` },
    body: JSON.stringify({ id: APPROVAL, verdict: "approve", reason: REASON }),
  });
  const out = await resp.json();
  check("door decide 200 with decision id", resp.status === 200 && !!(out.decision && out.decision.id));
} finally {
  await new Promise((r) => { dash.on("exit", r); dash.kill(); setTimeout(r, 1500); });
}

const lastDecision = (root) => {
  const days = readdirSync(join(root, "events")).filter((f) => f.endsWith(".jsonl")).sort();
  const lines = readFileSync(join(root, "events", days[days.length - 1]), "utf8").trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try { const e = JSON.parse(lines[i]); if (e.kind === "decision.recorded" && e.payload && e.payload.decides === APPROVAL) return e; } catch { /* torn tail */ }
  }
  return null;
};
const cliEv = lastDecision(CLI_SPINE);
const doorEv = lastDecision(DOOR_SPINE);
check("decision landed on BOTH spines (ran, not just green)", !!cliEv && !!doorEv);

if (cliEv && doorEv) {
  const keys = Object.keys(cliEv).sort();
  check("key sets identical (16 on the live envelope)", JSON.stringify(keys) === JSON.stringify(Object.keys(doorEv).sort()) && keys.length === 16, `keys=${keys.length}`);
  const allowed = new Set(["id", "ts", "sha"]);
  const illegal = keys.filter((k) => JSON.stringify(cliEv[k]) !== JSON.stringify(doorEv[k]) && !allowed.has(k));
  check("byte-parity: only id/ts/sha differ", illegal.length === 0, `illegal=${illegal.join(",")}`);
  check("actor named + identical (no door impersonation)", cliEv.actor === "arc-event" && doorEv.actor === "arc-event");
  check("idem identical (same decision, same dedupe key)", cliEv.idem === doorEv.idem);
  check("payload byte-identical incl. reason", JSON.stringify(cliEv.payload) === JSON.stringify(doorEv.payload));
  check("sha differs ONLY because id+ts do (recompute check)", cliEv.sha !== doorEv.sha);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 9 ? 0 : 1;
