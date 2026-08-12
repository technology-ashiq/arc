// The surfaced->cited log (REQ-06, ADR-0706).
//
// OBSERVATIONAL FOREVER. This file is disqualified from ever gating or promoting anything. It
// answers one question -- "does anyone use what the hook surfaces?" -- as a TREND, and if after
// roughly three hooked kickoffs the trend is about zero, that is a retro input questioning the
// module's premise. It is never a number to improve, and no gate may read it. `golden-check
// --gate` is the gate; it does not import this module, and tests/memory-golden.bats proves that
// by grep with a positive control.
//
// It lives in instance state (`.claude/state/memory/`, gitignored, beside the index), which is
// consistent with memory emitting nothing to the spine (ADR-0703): a search is not a fact about
// the business, so it does not belong in company history.
//
// BEST EFFORT, ALWAYS. Every failure mode here -- read-only tree, missing directory, full disk,
// a concurrent writer -- must leave recall answering normally at exit 0. An observational log
// that can break the surface it observes has become a dependency, and this one is explicitly not
// allowed to be one. So this module never throws and never reports failure to its caller: there
// is no branch in recall that could act on the answer, and a caller that cannot act on a return
// value should not be handed one it will only ignore.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export const OBSERVE_FILE = ".claude/state/memory/surfaced-cited.jsonl";

/** One JSONL row per ranked recall: what was asked, and which ids came back. `cited` is null and
 *  stays null until something outside this module records a citation -- the "->cited" half is a
 *  trend to be read later, not a claim this write can make. */
export function recordSurfaced(root, { query, ids, surface, now }) {
  try {
    const path = join(root, OBSERVE_FILE);
    mkdirSync(dirname(path), { recursive: true });
    const row = {
      // Injectable, so a fixture can assert on a stable row instead of on the clock.
      ts: now ?? new Date().toISOString(),
      surface: String(surface ?? "recall"),
      query: String(query ?? ""),
      surfaced: Array.isArray(ids) ? ids.map(String) : [],
      cited: null,
    };
    // ONE line, newline-terminated, written in a single append: a partially-written row would
    // make the whole file unparseable to the reader that eventually reads the trend.
    appendFileSync(path, `${JSON.stringify(row)}\n`, "utf8");
  } catch {
    // Deliberate, and see the header: recall must answer whether or not this succeeded.
  }
}
