#!/usr/bin/env node
/**
 * learning.mjs -- the Learning System's record and its replay (Phase 04).
 *
 * A failure that escaped once becomes a written, linked, replayable row. A proposed
 * safeguard is judged by whether it catches real past failures -- by someone who never saw
 * why it was written (ADR-0108).
 *
 * The grammar reuses ledger.mjs's hardened reader rather than inventing a second markdown
 * contract. That parser survived 45 adversarial inputs across two rounds, nine of which an
 * unanchored agent found after the author's own 26 attacks found none; a fresh grammar
 * would start at zero and be attacked the same way.
 *
 * Commands:
 *   parse  <ledger.md>                      validate every row; exit 1 on any FAIL
 *   replay --candidate <f.mjs> [--root R]   run a candidate over the corpus, print 2 counts
 *   list --visible [--root R]               the fixture inventory, withheld/ omitted
 *
 * Zero dependencies, Node 18+.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { SELF_DECLARED, isFilled, parseLedger } from "./ledger.mjs";

export const TYPES = ["rule", "fixture", "checklist", "template", "skill", "capability-policy"];
export const AREAS = ["auth", "data", "api", "ui", "infra", "build"];
export const VERDICTS = ["proposed", "promoted", "rejected", "rolled-back"];
export const TAGS = ["pattern", "anti-pattern", "library-verdict", "fix-recipe", "common-mistake"];

/** Only these two types point at code. The rest are procedures a person or agent applies. */
const EXECUTABLE = new Set(["rule", "fixture"]);
/** The typed links that make a record compound instead of accumulate. */
const LINK_KEYS = ["adr", "rule", "fixture", "phase"];
/** Everything a promoted row must carry. Absent any one, it is not promoted (REQ-03). */
const PROMOTION_INPUTS = ["replay", "evaluated-by", "approved-by"];

const EVALS = (root) => join(root, "tests", "fixtures", "develop-evals");
const CATEGORIES = ["spec-drift", "false-confidence", "missing-edge-case", "bad-gate", "flailing", "clean"];

// ---------------------------------------------------------------------------
// parse -- validate the ledger
// ---------------------------------------------------------------------------

/** Rows in a learning ledger reuse the slice-block reader: `learning: L-001` opens one. */
function readRows(text) {
  // ledger.mjs keys blocks on `slice:`; the learning ledger uses `learning:`. Rewriting the
  // marker for the reader keeps ONE parser rather than forking a second grammar.
  //
  // The ids also differ in shape: a slice id must start with a digit (`01`), while learning
  // ids read `L-001`. Rather than widen the slice grammar — which is hardened and pinned by
  // 45 adversarial fixtures — the prefix is stripped for the reader and restored for every
  // message, so an operator only ever sees the id they actually wrote.
  const rewritten = text.replace(
    /^([ \t]*#{0,6}[ \t]*)learning[ \t]*:[ \t]*([A-Za-z]+-)?([0-9][0-9a-z-]*)/gim,
    (_m, lead, _prefix, id) => `${lead}slice: ${id}`,
  );
  const { slices, errors } = parseLedger(rewritten);
  const label = (id) => (id === undefined ? id : `L-${id}`);
  return {
    rows: slices.map((s) => ({ ...s, id: label(s.id) })),
    errors: errors.map((e) => ({ ...e, id: label(e.id), msg: e.msg.replace(/slice '(\d[0-9a-z-]*)'/g, "row 'L-$1'") })),
  };
}

export function validate(text, { withheldIds = new Set() } = {}) {
  const fails = [], warns = [];
  const { rows, errors } = readRows(text);

  for (const e of errors) {
    fails.push({ at: e.line, id: e.id, msg: e.msg });
  }

  for (const r of rows) {
    const f = r.fields;
    const at = r.line, id = r.id;
    const need = (k) => {
      if (!isFilled(f[k])) { fails.push({ at, id, msg: `row ${id} has no \`${k}:\`` }); return false; }
      return true;
    };

    need("what-failed"); need("why-missed"); need("prevention");

    if (need("type") && !TYPES.includes(f.type.trim()))
      fails.push({ at, id, msg: `row ${id} type "${f.type.trim()}" is outside ${TYPES.join(" | ")}` });
    if (need("area") && !AREAS.includes(f.area.trim()))
      fails.push({ at, id, msg: `row ${id} area "${f.area.trim()}" is outside ${AREAS.join(" | ")}` });
    if (need("verdict") && !VERDICTS.includes(f.verdict.trim()))
      fails.push({ at, id, msg: `row ${id} verdict "${f.verdict.trim()}" is outside ${VERDICTS.join(" | ")}` });
    if (isFilled(f.tag) && !TAGS.includes(f.tag.trim()))
      fails.push({ at, id, msg: `row ${id} tag "${f.tag.trim()}" is outside ${TAGS.join(" | ")}` });

    // An executable candidate must point at the thing that runs, and the other four types
    // must not -- a `check:` on a checklist would be a file nothing ever executes.
    const type = (f.type || "").trim();
    if (EXECUTABLE.has(type) && isFilled(f.check) === false && (f.verdict || "").trim() === "promoted")
      fails.push({ at, id, msg: `row ${id} is type ${type} and promoted but carries no \`check:\`` });
    if (!EXECUTABLE.has(type) && isFilled(f.check))
      fails.push({ at, id, msg: `row ${id} is type ${type}, which is applied rather than executed — remove \`check:\`` });

    // A number the row asserts about its own quality (the governing rule) — checked ONLY in
    // the prose fields, never in a path or a link.
    //
    // This scoping is not tidiness. Applied to every field, the check FAILED on
    // `fixture: tests/fixtures/develop-evals/false-confidence/F-003.md` — a legitimate path
    // whose directory name contains "confidence" and whose filename contains a number. That
    // is a textbook false block: the gate firing on correct work, which teaches people to
    // ignore it. A path is a reference; only prose can make a claim.
    const PROSE = ["what-failed", "why-missed", "prevention", "cost", "replay", "evaluated-by"];
    for (const k of PROSE) {
      const v = f[k];
      if (typeof v === "string" && SELF_DECLARED.test(v))
        fails.push({ at, id, msg: `row ${id} field \`${k}\` asserts a number about its own quality` });
    }

    // Typed links: zero is legal but is a note, not a link in a chain.
    const links = LINK_KEYS.filter((k) => isFilled(f[k]));
    if (links.length === 0)
      warns.push({ at, id, msg: `row ${id} carries no typed link — it records a fact but joins nothing` });

    // The holdout: a candidate written against a withheld fixture was written against the
    // thing meant to test it (REQ-04, ADR-0109).
    for (const k of ["fixture", "catches", "replay"]) {
      const v = f[k];
      if (typeof v !== "string") continue;
      for (const wid of withheldIds) {
        if (v.includes(wid))
          fails.push({ at, id, msg: `row ${id} cites withheld fixture ${wid} in \`${k}:\` — the holdout is not evidence for the candidate it withheld` });
      }
    }

    // Promotion needs all three inputs, each reported separately (REQ-03).
    if ((f.verdict || "").trim() === "promoted") {
      for (const k of PROMOTION_INPUTS)
        if (!isFilled(f[k])) fails.push({ at, id, msg: `row ${id} is promoted but carries no \`${k}:\`` });
      // ADR-0109: time-forward measurement pays out in a LATER cycle. A row cannot claim it
      // on the day it is promoted, or it reads identical to one that survived a real test.
      const fv = (f["forward-verified"] || "").trim().toLowerCase();
      if (fv !== "no" && !/phase[ -]?\d+/i.test(fv))
        fails.push({ at, id, msg: `row ${id} must carry \`forward-verified: no\` until a later phase measures it, then name that phase` });
    }
  }

  return { rows, fails, warns };
}

// ---------------------------------------------------------------------------
// the corpus
// ---------------------------------------------------------------------------

function readFixture(path) {
  const raw = readFileSync(path, "utf8");
  const head = Object.create(null);
  for (const line of raw.split("\n")) {
    const m = line.match(/^([a-z][a-z0-9-]*)[ \t]*:[ \t]*(.*?)[ \t]*$/i);
    if (!m) { if (line.trim().startsWith("#")) break; continue; }
    head[m[1].toLowerCase()] = m[2];
  }
  // The BODY is the artifact under test, never the header and never the note explaining
  // why the fixture exists. A fixture that mixes the artifact with commentary about it makes
  // the commentary part of what a candidate matches -- which is how two clean controls,
  // written to prove a matcher over-fires, made a corrected matcher over-fire on them.
  const artifact = raw
    .split("\n")
    .filter((l) => !/^[a-z][a-z0-9-]*[ \t]*:/i.test(l))
    .join("\n")
    .trim();
  return {
    id: head.id || basename(path, ".md"),
    category: head.category || "?",
    expect: head.expect || "?",
    note: head.note || "",
    body: artifact,
    path,
  };
}

/** Visible corpus: everything except withheld/ and the control candidates. */
export function corpus(root, { includeWithheld = false } = {}) {
  const base = EVALS(root);
  const dirs = [...CATEGORIES, ...(includeWithheld ? ["withheld"] : [])];
  const out = [];
  for (const c of dirs) {
    const d = join(base, c);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((f) => f.endsWith(".md")).sort()) out.push(readFixture(join(d, f)));
  }
  return out;
}

export function withheldIds(root) {
  const d = join(EVALS(root), "withheld");
  if (!existsSync(d)) return new Set();
  return new Set(readdirSync(d).filter((f) => f.endsWith(".md")).map((f) => basename(f, ".md")));
}

/**
 * Replay: run a candidate over every fixture and COUNT. Two numbers, never one.
 *
 * catch-count      flagged among `expect: flagged`
 * false-block-count flagged among `expect: clean`
 *
 * The clean controls are why both numbers mean something: without them a candidate that
 * flags everything scores a perfect catch-count and a false-block count of zero, which is
 * indistinguishable from a gate that works.
 */
export async function replay(root, candidatePath) {
  const mod = await import(pathToFileURL(resolve(candidatePath)).href);
  if (typeof mod.check !== "function") throw new Error(`${candidatePath} exports no check(fixture) function`);

  // The withheld set is REPLAYED (it is the holdout, it must be measured) but never
  // identified: only its two totals leave this function.
  const visible = corpus(root);
  const held = corpus(root, { includeWithheld: true }).filter((f) => !visible.some((v) => v.id === f.id));

  const tally = (list) => {
    let caught = 0, flaggedTotal = 0, falseBlocked = 0, cleanTotal = 0;
    const detail = [];
    for (const fx of list) {
      const { flagged, why } = mod.check(fx) || {};
      if (fx.expect === "flagged") { flaggedTotal++; if (flagged) caught++; }
      else if (fx.expect === "clean") { cleanTotal++; if (flagged) falseBlocked++; }
      detail.push({ id: fx.id, category: fx.category, expect: fx.expect, flagged: !!flagged, why: why || "" });
    }
    return { caught, flaggedTotal, falseBlocked, cleanTotal, detail };
  };

  return { visible: tally(visible), withheld: tally(held) };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] && /learning\.mjs$/.test(process.argv[1].replace(/\\/g, "/"))) {
  const argv = process.argv.slice(2);
  const mode = argv[0];
  const valOf = (n) => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : ""; };
  let root = valOf("--root");
  if (!root) {
    try {
      const { execFileSync } = await import("node:child_process");
      root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { root = ""; }
    if (!root) root = process.cwd();
  }
  root = resolve(root);

  if (mode === "parse") {
    const file = argv[1];
    if (!file || !existsSync(file)) { console.log(`STOP: no ledger at ${file}`); process.exit(2); }
    const { rows, fails, warns } = validate(readFileSync(file, "utf8"), { withheldIds: withheldIds(root) });
    for (const w of warns) console.log(`WARN  [learning-row] ${basename(file)}:${w.at} — ${w.msg}`);
    console.log(`${rows.length} learning row(s): ${rows.map((r) => r.id).join(", ") || "(none)"}`);
    if (fails.length) {
      console.log("");
      for (const f of fails) console.log(`FAIL  [learning-row] ${basename(file)}:${f.at} — ${f.msg}`);
      console.log("");
      console.log(`learning: ${fails.length} check(s) FAILED`);
      process.exit(1);
    }
    console.log("learning: all rows valid ✔");
    process.exit(0);
  }

  if (mode === "list") {
    // --visible is the inventory a candidate is authored against. It omits withheld/
    // entirely, so the holdout cannot arrive in authoring context by accident.
    for (const f of corpus(root)) console.log(`${f.id}\t${f.category}\t${f.expect}`);
    process.exit(0);
  }

  if (mode === "replay") {
    const cand = valOf("--candidate");
    if (!cand || !existsSync(cand)) { console.log(`STOP: no candidate at ${cand}`); process.exit(2); }
    const r = await replay(root, cand);
    for (const d of r.visible.detail) console.log(`  ${d.flagged ? "FLAG" : "    "}  ${d.id}\t${d.category}\t(expect ${d.expect})`);
    console.log("");
    console.log(`visible:  caught ${r.visible.caught} of ${r.visible.flaggedTotal} · false-blocked ${r.visible.falseBlocked} of ${r.visible.cleanTotal}`);
    // The holdout reports TOTALS ONLY -- never an id, a category or a body (ADR-0109).
    console.log(`withheld: caught ${r.withheld.caught} of ${r.withheld.flaggedTotal} · false-blocked ${r.withheld.falseBlocked} of ${r.withheld.cleanTotal}`);
    console.log("");
    console.log("Two numbers, reported separately and never combined. A single score would hide");
    console.log("the trade the two of them exist to show.");
    process.exit(0);
  }

  console.log("usage: learning.mjs parse <ledger.md> | replay --candidate <f.mjs> | list --visible [--root PATH]");
  process.exit(mode ? 2 : 0);
}
