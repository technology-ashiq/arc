#!/usr/bin/env node
// node-floor.mjs -- does this Node meet L3's build floor? Vite 8 declares engines.node
// "^20.19.0 || >=22.12.0" and @tailwindcss/oxide ">= 20" (ADR-1323, ADR-1335), so the floor is
// the Vite range. The browser suite skips on Node 18 ONLY, and fails on any other Node below
// the floor, so a Node-20 leg pinned low can never pass by skipping.
//
// Usage: node-floor.mjs            prints `node=vX.Y.Z floor=ok|below major=N` and exits 0
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** @param {string} version like "v20.19.1" or "20.19.1" */
export function meetsFloor(version) {
  const m = String(version).match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return { ok: false, major: null, reason: `unparseable version ${JSON.stringify(version)}` };
  const [major, minor] = [Number(m[1]), Number(m[2])];
  const ok = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 23;
  return { ok, major, reason: ok ? "" : `Node ${m[0]} is below ^20.19.0 || >=22.12.0` };
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) {
  if (process.argv.length > 2) {
    console.error(`node-floor: takes no arguments, got ${JSON.stringify(process.argv.slice(2))}`);
    process.exitCode = 2;
  } else {
    const r = meetsFloor(process.version);
    console.log(`node=${process.version} floor=${r.ok ? "ok" : "below"} major=${r.major}`);
  }
}
