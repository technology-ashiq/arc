#!/usr/bin/env node
// dash-health.mjs -- spineHealth() is part of spine.mjs, the ONE public API (ADR-1301):
// quarantine counts by refusal code, idem-index size and torn lines reach a consumer
// THROUGH the reader, so nothing ever opens `_quarantine/` or `derived/` itself.
//
// This lives as a file rather than an inline `node -e` in the bats wrapper, because the
// inline form needed the repo path interpolated into a string and a sed escaping it --
// which produced `D:\d\a\arc\arc` on the Windows CI leg and failed there ONLY. Resolving
// the path from import.meta.url has no escaping step to get wrong.

import { mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const { spineHealth } = await import(pathToFileURL(join(REPO, ".claude/scripts/hq/spine.mjs")).href);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const dir = join(mkdtempSync(join(tmpdir(), "face-health-")), "spine");
const gen = JSON.parse(execFileSync(process.execPath,
  [join(REPO, "tests/fixtures/face/gen-spine.mjs"), "--out", dir, "--count", "300", "--days", "3", "--seed", "health-1"],
  { stdio: ["ignore", "pipe", "inherit"] }).toString());

check("fixture loaded (vacuous-pass guard)", gen.events === 300, `events=${gen.events}`);

const h = spineHealth(dir);
check("spineHealth sees every event", h.events === 300, `saw=${h.events}`);
// The generator tears the tail of the LAST (unsealed) day on purpose: a mid-write line is
// the real shape of an open day, and a reader that silently dropped it would make damage
// look like an empty day.
check("the torn line is REPORTED, not dropped", h.torn.length === 1, JSON.stringify(h.torn));
check("sealed days counted (all but the open one)", h.daysClosed === 2, `daysClosed=${h.daysClosed}`);
check("quarantine counts come back as a grouped object", h.quarantined && typeof h.quarantined === "object");
check("kindsSeen is derived, not assumed", typeof h.kindsSeen === "number" && h.kindsSeen > 0, `kindsSeen=${h.kindsSeen}`);

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 6 ? 0 : 1;
