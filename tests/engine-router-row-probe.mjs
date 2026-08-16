#!/usr/bin/env node
/**
 * tests/engine-router-row-probe.mjs -- the Node half of tests/engine-router-row.bats.
 *
 * REQ-04 asks for hostile fixtures covering FOUR malformed inputs per field across FOUR fields.
 * That is sixteen cases, and enumerating them here rather than writing sixteen bats blocks keeps
 * the matrix visible as a matrix -- a reader can see at a glance that no cell is missing, which
 * is the property that actually matters.
 *
 * In a file rather than inside `node -e` because these cases carry quotes and brackets.
 */

import { rowFaults, routerFaults, isExpired } from "../.claude/scripts/engine/router-row.mjs";

const GOOD = {
  driver: "hermes",
  tier: "balanced-workhorse",
  cap: "L1-drafts",
  hosted: "local",
  judge: "ashiq",
  review_by: "2026-11-13",
};

const FIELDS = ["cap", "hosted", "judge", "review_by"];
/** The four ways a field can be there and mean nothing. Each is a separate hostile input. */
const BAD = {
  absent: (row, k) => { const r = { ...row }; delete r[k]; return r; },
  empty: (row, k) => ({ ...row, [k]: "" }),
  null: (row, k) => ({ ...row, [k]: null }),
  malformed: (row, k) => ({ ...row, [k]: k === "judge" ? ["ashiq"] : (k === "review_by" ? "13-11-2026" : "anything-else") }),
};

const cases = {
  /** The sixteen-cell matrix. Every cell must produce at least one fault. */
  matrix() {
    const holes = [];
    let cells = 0;
    for (const f of FIELDS) {
      for (const [shape, mutate] of Object.entries(BAD)) {
        cells += 1;
        const faults = rowFaults("exec-draft", mutate(GOOD, f));
        // The fault must NAME the field, or a four-field row takes four round trips to fix.
        if (!faults.some((x) => x.includes(`\`${f}\``))) holes.push(`${f}/${shape}`);
      }
    }
    console.log(`cells=${cells}`);
    console.log(`unguarded=${holes.join(",") || "none"}`);
    console.log(cells === 16 && !holes.length ? "MATRIX_COMPLETE" : "MATRIX_HAS_HOLES");
  },

  /** The sound row loads, or every cell above passes by refusing everything. */
  good() {
    const faults = rowFaults("exec-draft", GOOD);
    console.log(`faults=${faults.length}`);
    for (const f of faults) console.log(`  ${f}`);
    console.log(faults.length === 0 ? "GOOD_ROW_LOADS" : "GOOD_ROW_REFUSED");
  },

  /** An ordinary row carrying NONE of the four is untouched — this lands as one diff, not a rewrite. */
  untouched() {
    const ordinary = { driver: "claude-code", tier: "balanced-workhorse", fallback: ["codex"] };
    const faults = rowFaults("commit-msg-draft", ordinary);
    console.log(`ordinary_faults=${faults.length}`);
    // ...but a PARTIAL row must not sneak through by not being a runtime row.
    const partial = { ...ordinary, cap: "L1-drafts" };
    const pf = rowFaults("commit-msg-draft", partial);
    console.log(`partial_faults=${pf.length}`);
    console.log(faults.length === 0 && pf.length === 3 ? "PARTIAL_CAUGHT" : "PARTIAL_SLIPPED");
  },

  /** Tenure is a boundary, and the boundary is the only interesting day. */
  tenure() {
    const row = { ...GOOD, review_by: "2026-11-13" };
    const r = {
      day_before: isExpired(row, "2026-11-12"),
      on_the_day: isExpired(row, "2026-11-13"),
      day_after: isExpired(row, "2026-11-14"),
    };
    console.log(JSON.stringify(r));
    // Expired strictly AFTER the date: a row reviewed BY the 13th is still good ON the 13th.
    console.log(!r.day_before && !r.on_the_day && r.day_after ? "TENURE_BOUNDARY_CORRECT" : "TENURE_BOUNDARY_WRONG");
  },

  /** A date that parses but does not exist would be a tenure nobody set. */
  "impossible-date"() {
    const faults = rowFaults("exec-draft", { ...GOOD, review_by: "2026-02-31" });
    console.log(`faults=${faults.length}`);
    console.log(faults.some((f) => f.includes("real calendar date")) ? "IMPOSSIBLE_DATE_REFUSED" : "IMPOSSIBLE_DATE_ACCEPTED");
  },

  /** The real router.yaml must load clean, or this lands broken. */
  "real-router"() {
    // Imported lazily so a parse failure in the yaml subset does not look like a probe failure.
    import("node:fs").then(async (fs) => {
      const { parseYamlSubset } = await import("../.claude/scripts/engine/yaml-subset.mjs");
      const p = new URL("../engine/router.yaml", import.meta.url);
      const r = parseYamlSubset(fs.readFileSync(p, "utf8"));
      if (!r.ok) { console.log("ROUTER_DOES_NOT_PARSE"); return; }
      const faults = routerFaults(r.value);
      console.log(`faults=${faults.length}`);
      for (const f of faults) console.log(`  ${f}`);
      console.log(faults.length === 0 ? "REAL_ROUTER_CLEAN" : "REAL_ROUTER_FAULTY");
    });
  },
};

const fn = cases[process.argv[2]];
if (!fn) {
  process.stderr.write(`unknown case: ${process.argv[2]} (want ${Object.keys(cases).join(", ")})\n`);
  process.exit(64);
}
fn();
