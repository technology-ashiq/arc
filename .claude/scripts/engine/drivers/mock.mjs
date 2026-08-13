#!/usr/bin/env node
/**
 * drivers/mock.mjs -- the replay driver. Returns pinned bytes, reaches no provider, costs zero.
 *
 * WHY THIS EXISTS AS A NAMED DRIVER rather than reusing ARC_DRIVER_FAKE (ADR-0902):
 *   1. `--driver mock` is selectable and therefore NAMEABLE in a provenance record. The env
 *      fake is not: a run under ARC_DRIVER_FAKE looks, on its receipt, exactly like a run
 *      that reached a provider.
 *   2. ARC_DRIVER_FAKE short-circuits the real code path -- common.mjs:180-191 returns before
 *      `await produce()` ever runs -- so "every driver satisfies the same contract" is vacuous
 *      for all three drivers today (retro-log 2026-08-03, still open, engine's to repair).
 *      This driver takes the OPPOSITE approach on purpose: it IS a produce(), so it runs the
 *      whole of runDriver's real path -- policy gate, budget parse, cost sidecar, exit
 *      discipline -- and swaps only the RESPONSE. Slice 02's negative control proves it.
 *
 * SELECTION IS BY FIXTURE ID, NEVER BY INPUT HASH. `commit-msg-draft` declares `inputs: []`,
 * so all five of its fixtures carry the identical input `{}` -- an input hash would collide
 * across every one of them and hand them all the same recording. The thing that varies is the
 * repo state, which the input never sees. Bench sets ARC_MOCK_FIXTURE per attempt.
 *
 * COST IS ABSENT, NOT ZERO. No provider was called, so there is no measured cost to report,
 * and an absent field is a fact about the instrument (ADR-0069 b5 / ADR-0904). Reporting a
 * confident 0 would put a number where no measurement happened.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { parseModelJson, runDriver, settle } from "./common.mjs";

const ROOT = process.env.ARC_ROOT || process.cwd();
const MOCK_DIR = process.env.ARC_MOCK_DIR || join(ROOT, "tests", "fixtures", "bench", "mock-replay");

/**
 * A stable digest of the whole recording directory, so a replay run carries an identity that
 * changes the moment its recordings do. Sorted, POSIX-normalised, content-hashed -- a walk that
 * depended on readdir order would hash the same bytes differently on two machines and turn a
 * provenance field into noise.
 */
function fixtureDirSha(dir) {
  const files = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) files.push(p);
    }
  };
  walk(dir);
  const h = createHash("sha256");
  for (const f of files.sort()) {
    h.update(relative(dir, f).split(sep).join("/"));
    h.update("\0");
    h.update(readFileSync(f));
    h.update("\0");
  }
  return h.digest("hex").slice(0, 12);
}

// Confinement root for every recording lookup, and the thing the version digests.
const BASE = resolve(MOCK_DIR);

await runDriver("mock", async ({ processName }) => {
  const id = process.env.ARC_MOCK_FIXTURE || "default";

  // Confine the resolved path to MOCK_DIR. `processName` and the fixture id both arrive from
  // outside this function, and a `..` in either would otherwise read an arbitrary file and
  // replay it as a model response.
  const base = BASE;
  const path = resolve(join(base, processName, `${id}.json`));
  if (path !== base && !path.startsWith(base + sep)) {
    throw new Error(`recording path escapes ARC_MOCK_DIR: ${processName}/${id}.json`);
  }

  let raw;
  try {
    if (!statSync(path).isFile()) throw new Error("not a file");
    raw = readFileSync(path, "utf8");
  } catch {
    // Name the path that was looked for. A silent empty response here would make an
    // unreachable fixture read as a passing one -- the exact shape this driver exists to avoid.
    throw new Error(`no recording for ${processName}/${id} at ${path}`);
  }

  const doc = parseModelJson(raw, `the mock recording ${processName}/${id}`);

  // A recording MAY declare a cost, and it is stripped from the output before it is returned.
  //
  // Without this there is no offline way to exercise post-call reconciliation or the overrun
  // case at all -- the ARC_DRIVER_FAKE path already supports `__cost`, but that path short-
  // circuits `produce()` entirely, so it proves nothing about the real one. A recording with no
  // `__cost` stays ABSENT rather than zero: no provider was called, so there is no measurement,
  // and a confident 0 would put a number where none was taken (ADR-0069 b5 / ADR-0904).
  //
  // Stripped, not passed through: the process output schemas are `additionalProperties: false`,
  // so leaving the key in would make every costed recording fail its own contract.
  const { __cost, ...output } = doc;
  if (__cost) {
    // REFUSE HERE, LOUDLY, rather than let the spine refuse it silently later. `writeCost` makes
    // `source` mandatory but never checks it against the spine's closed set, and `arc-run` emits
    // `run.completed` WITHOUT `--strict` -- so a free-text source came back `BAD_COST` in hook
    // mode, which exits 0 and quarantines. Fifteen receipts vanished that way and the run
    // reported success. Found by this lane's own probe expecting a cost that never arrived.
    const SOURCES = ["measured", "estimated", "manual"];
    if (!SOURCES.includes(__cost.source)) {
      throw new Error(`recording ${processName}/${id} declares __cost.source ${JSON.stringify(__cost.source)}, outside ${SOURCES.join("|")} -- the spine would quarantine this receipt and the run would still exit 0`);
    }
  }
  return { output, ...(__cost ? { cost: __cost } : {}) };
}, {
  // This driver's version is its RECORDING SET, not its source, because the recordings are
  // what determine its output -- the code merely reads them. A version pinned to the source
  // would stay constant while the answers changed underneath it, which is a constant wearing
  // a version's label.
  version: () => `mock@${fixtureDirSha(BASE)}`,
});

settle();
