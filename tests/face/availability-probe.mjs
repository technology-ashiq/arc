#!/usr/bin/env node
// availability-probe.mjs -- the FIELD_UNKNOWN half of tests/face/availability.mjs, run as its own process so the
// environment (ARC_VENTURES_FILE, ARC_SPINE_ROOT) reaches face-ops exactly as the door's would (face v2 Phase 15).
//
// For each gated op it PLANS through the work door's own plan path: a refusal thrown before the tool is spawned is
// `ran: false`. ventures.register is only validated -- its plan writes a proposal branch, and the question asked of it
// is only whether it is gated. Prints one JSON line.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OPS = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "face-ops.mjs")).href);
const DOOR = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "face", "work-door.mjs")).href);

const INPUTS = {
  "money.ingest": { provider: "razorpay", export: "no-such-export.csv", venture: "lexos", interval: "monthly" },
  "ventures.kill-review": { venture: "lexos", reason: "the availability probe asks" },
};
const door = DOOR.createWorkDoor({ repo: REPO, mode: "live" });
const results = {};
for (const [id, input] of Object.entries(INPUTS)) {
  try {
    await door.plan(id, { input });
    results[id] = { code: "", status: 0, ran: true, message: "" };
  } catch (e) {
    const code = e && e.code ? String(e.code) : "THREW";
    results[id] = { code, status: DOOR.WORK_STATUS[code] ?? 0, ran: false, message: String(e && e.message) };
  }
}
try {
  OPS.validateInput(OPS.opById("ventures.register"), { slug: "availability-probe", days: "60", floor: "50", repository: "acme/availability-probe" });
  results["ventures.register"] = { code: "" };
} catch (e) {
  results["ventures.register"] = { code: e && e.code ? String(e.code) : "THREW", message: String(e && e.message) };
}
console.log(JSON.stringify({ gated: Object.keys(OPS.FIELD_SOURCES).sort(), results }));
