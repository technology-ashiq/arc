#!/usr/bin/env node
/**
 * tests/engine-data-boundary-probe.mjs -- the Node half of tests/engine-data-boundary.bats.
 *
 * In a file rather than inside `node -e`, because these cases carry quotes and apostrophes and a
 * program embedded in a shell string carries neither. Enforced by tests/embedded-program-guard.
 *
 * Every case prints a terminal marker so the caller can assert the probe RAN before asserting
 * what it printed.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { boundaryRefusal, findInternalMarkers, EXIT_DATA_BOUNDARY, BoundaryScanIncomplete } from "../.claude/scripts/engine/data-boundary.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_ROOT = join(HERE, "..");

const cases = {
  /**
   * A scan that cannot finish must refuse. Two shapes: a cyclic document, and one nested past
   * the depth cap. Both are inputs an attacker can supply, and both used to be answerable only
   * by a crash or by a silent partial walk.
   */
  incomplete() {
    const cyclic = { a: {} };
    cyclic.a.self = cyclic;
    let deep = { end: "ARC-INTERNAL-ONLY" };
    for (let i = 0; i < 40; i++) deep = { n: deep };

    const results = [];
    for (const [name, doc] of [["cyclic", cyclic], ["too-deep", deep]]) {
      const r = boundaryRefusal({ input: doc, processName: "p", hosted: "" });
      results.push(`${name}=${r && r.code === EXIT_DATA_BOUNDARY ? "refused" : "ALLOWED"}`);
    }

    // And the raw scanner must THROW rather than return empty, so a future caller that forgets
    // to handle it fails loudly instead of reading an incomplete scan as clean.
    let threw = false;
    try { findInternalMarkers(cyclic); } catch (e) { threw = e instanceof BoundaryScanIncomplete; }
    results.push(`scanner_throws=${threw}`);

    console.log(results.join(" "));
    const ok = results.every((r) => !r.includes("ALLOWED")) && threw;
    console.log(ok ? "REFUSED_INCOMPLETE" : "INCOMPLETE_SCAN_ALLOWED");
  },

  /** Fixture 3: the same refusal, with the routing fact attached. */
  cloud() {
    const r = boundaryRefusal({
      input: { classification: "internal-only" },
      processName: "build-in-public-draft",
      hosted: "cloud",
    });
    if (!r) { console.log("NOT_REFUSED"); return; }
    console.log(r.reason);
    // And the LOCAL case must not claim the routing fact, or the message is decoration.
    const local = boundaryRefusal({ input: { classification: "internal-only" }, processName: "p", hosted: "local" });
    console.log(`local_mentions_cloud=${local.reason.includes("cloud")}`);
  },

  /**
   * The refusal must EMIT before it exits. Asserted on the source rather than by running a whole
   * dispatch, because the spine emitter refuses to write from this worktree by design — a
   * receipt written here would be real, valid and invisible to arc-inbox.
   */
  "receipt-shape"() {
    const src = readFileSync(join(ARC_ROOT, ".claude", "scripts", "engine", "arc-run.mjs"), "utf8");
    const at = src.indexOf("const refusal = boundaryRefusal(");
    if (at < 0) { console.log("NO_CALL_SITE"); return; }
    const block = src.slice(at, at + 1200);
    const emitAt = block.indexOf("emitRun(");
    const exitAt = block.indexOf(`process.exit(refusal.code)`);
    console.log(`emit_at=${emitAt} exit_at=${exitAt}`);
    console.log(emitAt >= 0 && exitAt >= 0 && emitAt < exitAt ? "EMITS_BEFORE_EXIT" : "NO_RECEIPT_BEFORE_EXIT");
  },
};

const fn = cases[process.argv[2]];
if (!fn) {
  process.stderr.write(`unknown case: ${process.argv[2]} (want ${Object.keys(cases).join(", ")})\n`);
  process.exit(64);
}
fn();
