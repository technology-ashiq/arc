// spine-read.mjs — reader-only access to the spine, for leads' derivations.
//
// Reader-only is the house rule and it is load-bearing here specifically: ADR-0403 derives
// every cap and suppression count from receipts, so if anything in this lane could WRITE
// derived state, a cap would become a number someone can edit.
//
// It also FAILS CLOSED. An unreadable day file is an error, never an empty day: a fold that
// treats "I could not read it" as "there was nothing there" reports zero sends and lets the
// 21st send of the day through. That is the same class as the quarantined-receipt failure
// pre-mortem row 1 records, arriving from the read side instead of the write side.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spineRoot, eventsDir } from "../../hq/lib/spine-io.mjs";

const DAY_RE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;

export function readAllEvents({ root = spineRoot() } = {}) {
  const dir = eventsDir(root);
  if (!existsSync(dir)) return [];
  const days = readdirSync(dir).filter((f) => DAY_RE.test(f)).sort();

  const out = [];
  for (const day of days) {
    const path = join(dir, day);
    let text;
    try { text = readFileSync(path, "utf8"); }
    catch (e) { throw new Error(`spine day file ${path} is unreadable (${e.code}) — refusing to fold, because an unreadable day counted as an empty one would under-report every cap`); }

    let lineNo = 0;
    for (const line of text.split("\n")) {
      lineNo++;
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); }
      catch { throw new Error(`spine day file ${path}:${lineNo} is not valid JSON — refusing to fold a partially-read day`); }
      out.push(ev);
    }
  }
  // Sort by id (ULID: lexicographic order is time order). The fold must not depend on the
  // order lines happen to sit in on disk -- that is the order-independence property the
  // Phase-00 fixture asserts, and sorting here is what makes it true rather than lucky.
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}
