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
import { basename, dirname, join, resolve } from "node:path";
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
const EXPECTS = new Set(["flagged", "clean"]);
const CATEGORIES = ["spec-drift", "false-confidence", "missing-edge-case", "bad-gate", "flailing", "clean"];

// ---------------------------------------------------------------------------
// parse -- validate the ledger
// ---------------------------------------------------------------------------

/**
 * Rows in a learning ledger reuse the slice-block reader: `learning: L-001` opens one.
 *
 * Exported so the Context Pack reads rows through THIS function rather than re-deriving the
 * marker rewrite. A second reader would be a second grammar, and the five ways an adversarial
 * pass hid a row from this one are pinned against this function, not against the idea of it.
 */
export function readRows(text) {
  // ledger.mjs keys blocks on `slice:`; the learning ledger uses `learning:`. Rewriting the
  // marker for the reader keeps ONE parser rather than forking a second grammar.
  //
  // The ids also differ in shape: a slice id must start with a digit (`01`), while learning
  // ids read `L-001`. Rather than widen the slice grammar — which is hardened and pinned by
  // 45 adversarial fixtures — the prefix is stripped for the reader and restored for every
  // message, so an operator only ever sees the id they actually wrote.
  // The lead MIRRORS SLICE_RE's own tolerance — bullet, heading, emphasis — because a
  // rewrite stricter than the grammar it feeds is a hole, not a safeguard. An adversarial
  // pass hid a row five ways through exactly that gap: `- **learning: L-203**` was not
  // rewritten, so it became an ordinary field, landed in the brief, and every violation it
  // carried went unchecked. That row broke all six rules and the gate said "all rows valid".
  const LEAD = "[ \\t]*(?:[-*+][ \\t]+)?(?:#{1,6}[ \\t]*)?(?:\\*{1,2}|_{1,2})?[ \\t]*";
  const rewritten = text.replace(
    new RegExp(`^(${LEAD})learning[ \\t]*:[ \\t]*(?:[A-Za-z][A-Za-z0-9]*-)?([0-9][0-9a-z-]*)`, "gim"),
    (_m, lead, id) => `${lead}slice: ${id}`,
  );

  const { slices, errors } = parseLedger(rewritten);
  const label = (id) => (id === undefined ? id : `L-${id}`);
  const out = {
    rows: slices.map((s) => ({ ...s, id: label(s.id) })),
    errors: errors.map((e) => ({ ...e, id: label(e.id), msg: e.msg.replace(/slice '(\d[0-9a-z-]*)'/g, "row 'L-$1'") })),
  };

  // FAIL CLOSED on the whole class rather than on the five forms already known. Anything
  // that reads as a row marker to a person must become a row or become an error — never
  // silently become a field. This is the same discipline NEAR_SLICE already applies in
  // ledger.mjs, and it covers the forms nobody has thought of yet.
  const markers = (text.match(/^[\s>*_+#-]*learning[ \t]*:/gim) || []).length;
  if (markers !== out.rows.length) {
    out.errors.push({
      line: 1,
      msg: `${markers} line(s) read as a learning-row marker but ${out.rows.length} row(s) parsed — a row that is not parsed is a row whose violations are never checked`,
    });
  }
  // A ledger with no rows at all is not "valid", it is unread. An unterminated fence above
  // the rows produced exactly that, and the gate reported success.
  if (out.rows.length === 0 && /learning[ \t]*:/i.test(text)) {
    out.errors.push({ line: 1, msg: "the file mentions learning rows but none parsed — check for an unterminated fence or a marker the grammar does not accept" });
  }
  return out;
}

export function validate(text, { withheldIds = new Set(), checkExists = null } = {}) {
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

    // A number the row asserts about its own quality (the governing rule) — checked ONLY in
    // the prose fields, never in a path or a link.
    //
    // This scoping is not tidiness. Applied to every field, the check FAILED on
    // `fixture: tests/fixtures/develop-evals/false-confidence/F-003.md` — a legitimate path
    // whose directory name contains "confidence" and whose filename contains a number. That
    // is a textbook false block: the gate firing on correct work, which teaches people to
    // ignore it. A path is a reference; only prose can make a claim.
    // DENY BY DEFAULT: every field except the typed links and `check:`, which are paths.
    // The previous allowlist of six prose fields was the bug — `approved-by: ashiq — 97%
    // confidence this one generalises` and `catches: a 92% success-rate` both sailed through,
    // and those are precisely where a promoting author writes a score. An allowlist cannot
    // cover a field nobody has invented yet; a denylist of two path keys can.
    const NOT_PROSE = new Set([...LINK_KEYS, "check"]);
    for (const [k, v] of Object.entries(f)) {
      if (NOT_PROSE.has(k) || typeof v !== "string") continue;
      if (SELF_DECLARED.test(v))
        fails.push({ at, id, msg: `row ${id} field \`${k}\` asserts a number about its own quality` });
    }

    // Typed links: zero is legal but is a note, not a link in a chain.
    const links = LINK_KEYS.filter((k) => isFilled(f[k]));
    if (links.length === 0)
      warns.push({ at, id, msg: `row ${id} carries no typed link — it records a fact but joins nothing` });

    // The holdout: EVERY field, case-insensitively. Scanning three named keys let a citation
    // hide in `prevention:`, in `note:`, or behind a lowercased filename (REQ-04, ADR-0109).
    for (const [k, v] of Object.entries(f)) {
      if (typeof v !== "string") continue;
      const hay = v.toLowerCase();
      for (const wid of withheldIds) {
        if (hay.includes(wid.toLowerCase()))
          fails.push({ at, id, msg: `row ${id} cites withheld fixture ${wid} in \`${k}:\` — the holdout is not evidence for the candidate it withheld` });
      }
    }

    // Promotion needs all three inputs, and each must SAY something (REQ-03). Testing only
    // for non-emptiness let `replay: not run yet`, `evaluated-by: the same session that wrote
    // the candidate` and `approved-by: pending Ashiq's review` all satisfy a promotion.
    if ((f.verdict || "").trim() === "promoted") {
      const rp = (f.replay || "").trim();
      if (!isFilled(rp)) fails.push({ at, id, msg: `row ${id} is promoted but carries no \`replay:\`` });
      else if (!/caught\s+\d+\s+of\s+\d+/i.test(rp) || !/false-blocked\s+\d+\s+of\s+\d+/i.test(rp))
        fails.push({ at, id, msg: `row ${id}'s \`replay:\` must carry BOTH computed counts — "caught N of M" and "false-blocked N of M"` });

      if (!isFilled(f["evaluated-by"])) fails.push({ at, id, msg: `row ${id} is promoted but carries no \`evaluated-by:\`` });

      const ap = (f["approved-by"] || "").trim();
      if (!isFilled(ap)) fails.push({ at, id, msg: `row ${id} is promoted but carries no \`approved-by:\`` });
      else if (!/^ashiq\b/i.test(ap) || !/\b\d{4}-\d{2}-\d{2}\b/.test(ap))
        fails.push({ at, id, msg: `row ${id}'s \`approved-by:\` must name the approver and an ISO date — "pending review" is not an approval` });

      // ADR-0109: time-forward measurement pays out in a LATER cycle. `phase 04` on a row
      // promoted IN phase 04 is the one thing the field must not be allowed to say, and a
      // loose /phase \d+/ accepted it — along with an earlier phase, and a sentence asserting
      // the opposite of the field's meaning.
      const fv = (f["forward-verified"] || "").trim().toLowerCase();
      const own = Number((f.phase || "").trim().match(/\d+/)?.[0] ?? NaN);
      const named = fv.match(/^phase[ -]?(\d+)$/);
      if (fv !== "no" && !named)
        fails.push({ at, id, msg: `row ${id} must carry \`forward-verified: no\`, or exactly \`phase NN\` naming the later phase that measured it` });
      else if (named && Number.isFinite(own) && Number(named[1]) <= own)
        fails.push({ at, id, msg: `row ${id} claims forward-verification by phase ${named[1]}, which is not later than the phase ${own} that promoted it — time-forward means later` });
    }

    // `check:` must resolve, and "must not carry" is about the KEY, not its value: `(none)`
    // reads as empty to isFilled, so a checklist could carry a check: line and never trip.
    if (Object.hasOwn(f, "check") && !EXECUTABLE.has(type))
      fails.push({ at, id, msg: `row ${id} is type ${type}, which is applied rather than executed — remove \`check:\`` });
    if (EXECUTABLE.has(type) && isFilled(f.check) && checkExists && !checkExists(f.check.trim()))
      fails.push({ at, id, msg: `row ${id}'s \`check:\` points at ${f.check.trim()}, which does not exist` });
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
  // Strip ONLY the leading contiguous header block. Filtering every `key:`-looking line from
  // the whole file deleted the artifact itself whenever the artifact was one of this
  // product's own records — a ledger fragment, a PROGRESS header, a receipt — handing the
  // candidate an EMPTY body while the fixture still counted in the denominator. A permanent,
  // silent, uncatchable miss.
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length && /^[a-z][a-z0-9-]*[ \t]*:/i.test(lines[i])) i++;
  const artifact = lines.slice(i).join("\n").trim();

  if (!EXPECTS.has(head.expect))
    throw new Error(`${path}: expect: must be exactly "flagged" or "clean" — found "${head.expect ?? "(absent)"}". A fixture in neither class shrinks a denominator silently.`);
  if (!artifact)
    throw new Error(`${path}: the artifact is empty. A fixture with no body counts in a denominator and can never be caught.`);

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
  const seen = new Map();
  for (const c of dirs) {
    const d = join(base, c);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((f) => f.endsWith(".md")).sort()) {
      const fx = readFixture(join(d, f));
      // A duplicate id makes the withheld set vanish: `held` is computed by subtracting ids,
      // so a withheld fixture sharing an id with a visible one is dropped entirely, and the
      // holdout reports `0 of 0` — an empty holdout that reads like a passing one.
      if (seen.has(fx.id))
        throw new Error(`duplicate fixture id ${fx.id}: ${seen.get(fx.id)} and ${fx.path}`);
      seen.set(fx.id, fx.path);
      out.push(fx);
    }
  }
  return out;
}

/**
 * The withheld ids, keyed by BOTH filename and declared header id. Keying on the filename
 * alone let a withheld fixture declaring a different `id:` be cited by its real id — the
 * citation check would look for the filename and never see it.
 *
 * A missing `withheld/` is a hard STOP, not a quiet skip. The identical ledger that produced
 * three FAILs inside the repo printed "all rows valid" when run from a directory without one,
 * with no statement of which corpus had been consulted.
 */
export function withheldIds(root, { required = true } = {}) {
  const d = join(EVALS(root), "withheld");
  if (!existsSync(d)) {
    if (required) throw new Error(`no withheld holdout at ${d} — refusing to validate against a corpus with no holdout rather than reporting success over one`);
    return new Set();
  }
  const ids = new Set();
  for (const f of readdirSync(d).filter((f) => f.endsWith(".md"))) {
    ids.add(basename(f, ".md"));
    const declared = readFileSync(join(d, f), "utf8").match(/^id[ \t]*:[ \t]*(\S+)/im);
    if (declared) ids.add(declared[1]);
  }
  return ids;
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
  // The candidate is untrusted code and runs in its own process (replay-child.mjs). It
  // receives frozen BODIES only and returns booleans only; every label stays here. An
  // adversarial pass walked past the in-process version four separate ways — an oracle
  // reading `fixture.expect`, a mutation of `expect` that erased the clean denominator, an
  // exfiltration of the withheld ids through the runner, and a fabricated report printed at
  // import time before `check` was ever called.
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, readFileSync: rf, existsSync: ex } = await import("node:fs");
  const { tmpdir } = await import("node:os");

  const visible = corpus(root);
  const held = corpus(root, { includeWithheld: true }).filter((f) => !visible.some((v) => v.id === f.id));
  const all = [...visible, ...held];

  const dir = mkdtempSync(join(tmpdir(), "arc-replay-"));
  const bodiesPath = join(dir, "bodies.json");
  const outPath = join(dir, "flags.json");
  writeFileSync(bodiesPath, JSON.stringify(all.map((f) => f.body)), "utf8");

  const child = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "replay-child.mjs");
  try {
    // stdio ignored on purpose: nothing the candidate prints is evidence of anything.
    execFileSync(process.execPath, [child, resolve(candidatePath), bodiesPath, outPath], { stdio: "ignore" });
  } catch {
    throw new Error(`replay failed: the candidate process exited early or crashed — a replay that did not complete is not a result`);
  }
  if (!ex(outPath)) throw new Error("replay failed: the candidate process wrote no results");
  const parsed = JSON.parse(rf(outPath, "utf8"));
  if (parsed.error) throw new Error(`replay failed: ${parsed.error}`);
  if (!Array.isArray(parsed.flags) || parsed.flags.length !== all.length)
    throw new Error(`replay failed: expected ${all.length} verdicts, got ${Array.isArray(parsed.flags) ? parsed.flags.length : "none"}`);

  // Counting happens HERE, against labels the candidate never saw.
  const tally = (list, offset) => {
    let caught = 0, flaggedTotal = 0, falseBlocked = 0, cleanTotal = 0;
    const detail = [];
    list.forEach((fx, i) => {
      const flagged = parsed.flags[offset + i] === true;
      if (fx.expect === "flagged") { flaggedTotal++; if (flagged) caught++; }
      else if (fx.expect === "clean") { cleanTotal++; if (flagged) falseBlocked++; }
      detail.push({ id: fx.id, category: fx.category, expect: fx.expect, flagged });
    });
    return { caught, flaggedTotal, falseBlocked, cleanTotal, detail };
  };

  return { visible: tally(visible, 0), withheld: tally(held, visible.length) };
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
    // Deliberately avoids the word its own test forbids in this output: a report that talks
    // about a single number is one edit away from printing one.
    console.log("Two numbers, reported separately and never combined into one. Collapsing them");
    console.log("would hide the trade that both of them exist to show.");
    process.exit(0);
  }

  console.log("usage: learning.mjs parse <ledger.md> | replay --candidate <f.mjs> | list --visible [--root PATH]");
  process.exit(mode ? 2 : 0);
}
