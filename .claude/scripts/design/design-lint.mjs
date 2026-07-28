#!/usr/bin/env node
// design-lint v0 -- the deterministic half of the design contract (REQ-05, ADR-0046/0048).
//
// What this lint is FOR: the brief is the anchor every critique judges against, so a brief
// that displays legitimacy while dodging the contract (missing section, unfilled boilerplate,
// stale answer count, failing contrast pair) must fail loudly BEFORE any pixels exist.
//
// Division of labour (ADR-0048 -- agents judge, scripts measure): the critic reports what it
// sees and may only SUSPECT a measurable defect; this lint owns every number. Contrast is
// computed here from the pairs the brief declares; both floors (contrast ratio, target px)
// are parsed from the brief's own a11y line -- NEVER hardcoded, a lint that hardcodes a floor
// silently overrides the product's contract. `--floors` exports them as JSON so downstream
// measurement (Phase 2's browser-driven task-flow verification) consumes the same authority.
//
// Grammar discipline (retro-log markdown-contract checklist): tolerant DETECTION is not
// tolerant GRAMMAR. Section headings match exactly (level-2, exact case -- case-folding is
// how a validator becomes a suggestion); a repeated section is an error, never a
// last-one-wins; every regex that anchors a line uses /m with explicit \n discipline; dates
// are validated against the real calendar, not their digit shape.
//
// Usage:
//   design-lint.mjs <brief.md> [...]          lint one or more briefs
//   design-lint.mjs --template <t> <brief>    override the template (tests; default is live)
//   design-lint.mjs --route <file>            lorem-ipsum scan of one route file
//   design-lint.mjs --floors <brief.md>       print the brief's declared floors as JSON
//   design-lint.mjs                           gate mode: all briefs under docs/design/briefs/
//                                             + lorem scan of every critiqued route
//
// Exit: 0 clean | 1 findings or unusable input. Never 2 (the design gate is warn-tier this
// cycle; a lint that can exit 2 is a lint that can block a session by accident).
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.cwd();
const DEFAULT_TEMPLATE = join(ROOT, "docs", "templates", "design-brief-template.md");
const BRIEFS_DIR = join(ROOT, "docs", "design", "briefs");
const CRITIQUE_DIR = join(ROOT, "docs", "design", "critique");

let errors = 0;
const err = (id, file, msg) => { errors++; console.log(`ERR  [${id}] ${file}: ${msg}`); };

// ---------- pure helpers ----------

// WCAG relative luminance -> contrast ratio. Same arithmetic the critic got RIGHT for the
// colour it invented -- the whole point of ADR-0048 is that the input here is declared, not
// sampled by eye.
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hexRgb = (h) => [h.slice(1, 3), h.slice(3, 5), h.slice(5, 7)].map((x) => parseInt(x, 16));
const contrast = (fg, bg) => {
  const a = lum(hexRgb(fg)), b = lum(hexRgb(bg));
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
};

// Everything STRUCTURAL is parsed on fence-stripped text. The adversarial pass proved why:
// a brief with section D deleted and its heading quoted inside a ```md fence passed the
// section check outright -- the reader sees an example, the machine sees a contract. Lorem
// scanning stays on the RAW text (lorem inside a fence is still lorem on the page).
// Newlines are preserved so nothing downstream loses line structure.
const stripFences = (s) => s.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ""));

// Section slice: text between this level-2 heading and the next level-2 heading (or EOF).
// The heading must be EXACT: level 2, exact case, optionally followed by an em-dash suffix.
// More than one match is an error at the call site -- a doctored brief can carry a complete
// section for the reader and an empty twin for the machine, and last-one-wins picks wrong.
const SECTIONS = Object.freeze([
  ["A", "Interaction model"],
  ["B", "Art direction"],
  ["C", "Platform contract"],
  ["D", "Content contract"],
]);
function findSections(text) {
  const found = new Map(); // letter -> { count, body }
  for (const [letter, name] of SECTIONS) {
    const re = new RegExp(`^## ${letter}\\. ${name}(?: —.*)?$`, "gm");
    const starts = [];
    let m;
    while ((m = re.exec(text)) !== null) starts.push(m.index + m[0].length);
    let body = null;
    if (starts.length === 1) {
      const rest = text.slice(starts[0]);
      const next = rest.search(/^## /m);
      body = next < 0 ? rest : rest.slice(0, next);
    }
    found.set(letter, { name, count: starts.length, body });
  }
  return found;
}

// Numbered items in a section: `N. text` at line start. Returns [{n, text}].
function numberedItems(body) {
  const out = [];
  const re = /^(\d+)\.[ \t]+(.*)$/gm;
  let m;
  while ((m = re.exec(body)) !== null) out.push({ n: Number(m[1]), text: m[2] });
  return out;
}

// Real-calendar date check (the validate.mjs pattern): ranges pass 2026-02-30, a UTC
// round-trip does not.
function validDate(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

// Parse the declared floors off the a11y line. Strict grammar: the line is the contract.
// Returns { floors, count } -- more than one floor line is a finding, not a choice: the
// adversarial pass planted a 1:1 line for the machine above a 4.5:1 line for the reader,
// and first-match-wins silently enforced nothing.
const FLOOR_RE = /^- \*\*a11y floor:\*\* contrast ≥(\d+(?:\.\d+)?):1 · targets ≥(\d+)px\b.*$/gm;
function parseFloors(text) {
  const all = [...text.matchAll(FLOOR_RE)];
  if (all.length === 0) return { floors: null, count: 0 };
  const m = all[0];
  return { floors: { contrast_ratio: Number(m[1]), target_px: Number(m[2]) }, count: all.length };
}

const LOREM = /lorem\s+ipsum/i;

// ---------- checks ----------

function lintBrief(briefPath, templatePath) {
  const rel = briefPath.startsWith(ROOT) ? briefPath.slice(ROOT.length + 1).replace(/\\/g, "/") : briefPath;
  let raw;
  try { raw = readFileSync(briefPath, "utf8"); } catch {
    err("brief-unreadable", rel, "brief not found or unreadable");
    return;
  }
  const text = stripFences(raw);

  // 1. sections: present exactly once each, and actually carrying content -- a heading over
  // an empty body is a section for the reader and nothing for the contract.
  const sections = findSections(text);
  for (const [letter, { name, count, body }] of sections) {
    if (count === 0) err("section-missing", rel, `section ${letter} (${name}) missing — a level-2 "## ${letter}. ${name}" heading, exact case`);
    else if (count > 1) err("section-repeated", rel, `section ${letter} (${name}) appears ${count} times — a brief carries each contract exactly once`);
    else if (!body.trim()) err("section-empty", rel, `section ${letter} (${name}) has a heading and no content`);
  }

  // 2. header: real-calendar date
  const dm = /^- \*\*date:\*\* (\d{4})-(\d{2})-(\d{2})$/m.exec(text);
  if (!dm) err("date-missing", rel, "no `- **date:** YYYY-MM-DD` line");
  else if (!validDate(Number(dm[1]), Number(dm[2]), Number(dm[3])))
    err("date-invalid", rel, `date ${dm[1]}-${dm[2]}-${dm[3]} is not a real calendar date`);

  // 3. the drift gate: answers in A vs the template's LIVE question count
  const secA = sections.get("A");
  if (secA.count === 1) {
    let tpl;
    try { tpl = readFileSync(templatePath, "utf8"); } catch {
      err("template-unreadable", rel, `cannot read the template at ${templatePath} — the drift gate has no reference`);
      tpl = null;
    }
    if (tpl) {
      const tplA = findSections(tpl).get("A");
      const want = tplA.count === 1 ? numberedItems(tplA.body).length : 0;
      if (want === 0) {
        err("template-broken", rel, "the template's interaction-model section has no numbered questions — fix the template first");
      } else {
        const answers = numberedItems(secA.body);
        if (answers.length !== want)
          err("answer-count", rel, `${answers.length} answer(s) in the interaction model vs ${want} question(s) in the live template — every question gets an answer, no more, no fewer`);
        for (const a of answers) {
          // an item that is only the copied question (bold label, nothing after) is unanswered
          const label = /^\*\*.*?\*\*[ \t]*[—-]?[ \t]*(.*)$/.exec(a.text);
          const answer = label ? label[1] : a.text;
          if (!answer.trim()) err("answer-empty", rel, `answer ${a.n} restates the question and answers nothing`);
        }
      }
    }
  }

  // 4. platform contract: 5 surfaces, strict yes|no values, boilerplate rejected
  const secC = sections.get("C");
  if (secC.count === 1) {
    for (const surface of ["Desktop", "Mobile", "Tablet", "Keyboard-first", "Reduced motion"]) {
      const row = new RegExp(`^\\| ${surface} \\| ([^|\\n]+) \\|$`, "m").exec(secC.body);
      if (!row) { err("platform-row-missing", rel, `platform contract has no row for ${surface}`); continue; }
      const v = row[1].trim();
      if (v !== "yes" && v !== "no")
        err("platform-value", rel, `platform row ${surface} is "${v}" — the contract takes exactly yes or no (an unfilled template is not a brief)`);
    }
  }

  // 5. floors + declared contrast pairs (ADR-0048: this lint is the number authority)
  const secB = sections.get("B");
  if (secB.count === 1) {
    const { floors, count: floorCount } = parseFloors(secB.body);
    if (floorCount > 1)
      err("floor-repeated", rel, `${floorCount} a11y-floor lines — one line is the contract; two is one for the machine and one for the reader`);
    if (!floors) {
      err("floor-missing", rel, "no parseable a11y-floor line (`- **a11y floor:** contrast ≥N:1 · targets ≥Npx …`) — downstream measurement has no declared floor to check against");
    } else {
      const rows = [...secB.body.matchAll(/^\| (.+?) \| (#[0-9a-fA-F]{6}) \| (#[0-9a-fA-F]{6}) \|$/gm)]
        .filter(([, name]) => name !== "pair"); // header row
      const placeholder = /^\| <name> \|/m.test(secB.body);
      if (placeholder) err("pairs-boilerplate", rel, "the contrast-pairs table still carries the template's <name> placeholder row");
      // A row that LOOKS like a pair but fails the grammar (3-digit hex, missing #) must be
      // named, not silently dropped -- dropped rows made a malformed table read as "no pairs",
      // which points the author at the wrong fix.
      for (const line of secB.body.split("\n")) {
        if (/^\|.*#[0-9a-fA-F]{1,5}\b(?![0-9a-fA-F])/.test(line) && !/^\| .+? \| #[0-9a-fA-F]{6} \| #[0-9a-fA-F]{6} \|$/.test(line))
          err("pair-malformed", rel, `pair row does not parse (want \`| name | #rrggbb | #rrggbb |\`, 6-digit hex): ${line.trim()}`);
      }
      if (rows.length === 0 && !placeholder)
        err("pairs-missing", rel, "no declared contrast pairs — the direction relies on colour it never declared, so nothing downstream can verify it");
      for (const [, name, fg, bg] of rows) {
        const r = contrast(fg, bg);
        if (r < floors.contrast_ratio)
          err("contrast", rel, `pair "${name}" (${fg} on ${bg}) is ${r.toFixed(2)}:1 against the brief's declared floor of ${floors.contrast_ratio}:1`);
      }
    }
  }

  // 6. lorem ipsum anywhere in the brief -- checked on the RAW text: a fence hides a
  // heading from the structure, it does not make placeholder copy real.
  if (LOREM.test(raw)) err("lorem", rel, "lorem ipsum in the brief — realistic content is the contract, placeholders are always a violation");
}

function lintRoute(routePath) {
  const rel = routePath.startsWith(ROOT) ? routePath.slice(ROOT.length + 1).replace(/\\/g, "/") : routePath;
  let text;
  try { text = readFileSync(routePath, "utf8"); } catch {
    err("route-unreadable", rel, "route not found or unreadable");
    return;
  }
  if (LOREM.test(text)) err("lorem", rel, "lorem ipsum shipped in a reviewed route");
}

// Critiqued routes: the targets declared by critique artifacts (fences stripped, same
// discipline as design-gate.sh). Only files that exist on this checkout are scanned.
function critiquedRoutes() {
  if (!existsSync(CRITIQUE_DIR)) return [];
  const routes = [];
  for (const f of readdirSync(CRITIQUE_DIR)) {
    if (!/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f)) continue;
    let text;
    try { text = readFileSync(join(CRITIQUE_DIR, f), "utf8"); } catch { continue; }
    text = text.replace(/```[\s\S]*?```/g, "");
    const m = /^[-*]?\s*target:\s*`?([^`\n]+?)`?\s*$/m.exec(text);
    if (!m) continue;
    const p = resolve(ROOT, m[1].trim());
    // Fixture routes are excluded BY LOCATION: the planted-defect fixtures under tests/
    // carry lorem ipsum on purpose (that is the defect being planted), and scanning them
    // would make the gate warn forever about a file whose whole job is to be broken.
    const relP = p.slice(ROOT.length + 1).replace(/\\/g, "/");
    if (relP.startsWith("tests/")) continue;
    if (existsSync(p) && statSync(p).isFile()) routes.push(p);
  }
  return routes;
}

// ---------- CLI ----------

const argv = process.argv.slice(2);
let templatePath = DEFAULT_TEMPLATE;
let floorsMode = false;
const briefs = [];
const routes = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--template") { templatePath = resolve(ROOT, argv[++i] ?? ""); continue; }
  if (a === "--route") { routes.push(resolve(ROOT, argv[++i] ?? "")); continue; }
  if (a === "--floors") { floorsMode = true; continue; }
  if (a.startsWith("--")) { console.log(`ERR  [usage] unknown flag ${a}`); process.exit(1); }
  briefs.push(resolve(ROOT, a));
}

if (floorsMode) {
  // floors are an EXPORT, so parse errors here are loud: downstream measuring against a
  // silently-defaulted floor would be hardcoding with extra steps.
  const target = briefs[0];
  if (!target) { console.log("ERR  [usage] --floors needs a brief path"); process.exit(1); }
  let text;
  try { text = stripFences(readFileSync(target, "utf8")); } catch { console.log(`ERR  [brief-unreadable] ${target}`); process.exit(1); }
  const secB = findSections(text).get("B");
  const parsed = secB.count === 1 ? parseFloors(secB.body) : { floors: null, count: 0 };
  if (parsed.count > 1) { console.log("ERR  [floor-repeated] more than one a11y-floor line — the export refuses an ambiguous authority"); process.exit(1); }
  if (!parsed.floors) { console.log("ERR  [floor-missing] no parseable a11y-floor line"); process.exit(1); }
  process.stdout.write(JSON.stringify(parsed.floors) + "\n");
  process.exit(0);
}

if (briefs.length === 0 && routes.length === 0) {
  // gate mode: every brief in the repo + every critiqued route. Nothing to lint -> clean
  // pass (a repo with no design work must not nag -- same no-nag rule as design-gate.sh).
  if (existsSync(BRIEFS_DIR)) {
    for (const d of readdirSync(BRIEFS_DIR)) {
      const b = join(BRIEFS_DIR, d, "brief.md");
      if (existsSync(b)) briefs.push(b);
    }
  }
  routes.push(...critiquedRoutes());
}

for (const b of briefs) lintBrief(b, templatePath);
for (const r of routes) lintRoute(r);

if (errors > 0) {
  console.log(`design-lint: ${errors} error(s)`);
  process.exit(1);
}
console.log("design-lint: all checks passed ✔");
process.exit(0);
