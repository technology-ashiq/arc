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
//   design-lint.mjs --library <entry.md>      tag-completeness check on one library entry
//   design-lint.mjs                           gate mode: all briefs under docs/design/briefs/
//                                             + lorem scan of every critiqued route
//                                             + every entry under docs/design/library/
//
// Exit: 0 clean | 1 findings or unusable input. Never 2 (the design gate is warn-tier this
// cycle; a lint that can exit 2 is a lint that can block a session by accident).
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const ROOT = process.cwd();
const DEFAULT_TEMPLATE = join(ROOT, "docs", "templates", "design-brief-template.md");
const BRIEFS_DIR = join(ROOT, "docs", "design", "briefs");
const CRITIQUE_DIR = join(ROOT, "docs", "design", "critique");
const LIBRARY_DIR = join(ROOT, "docs", "design", "library");

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
// An UNTERMINATED fence must strip to end of document, not be ignored. Requiring a closing
// fence was a three-character bypass: open ```md, never close it, and every heading below is
// invisible to a reader (CommonMark runs the block to EOF) while the checker read them as
// satisfied contract. `~~~` is the other fence form -- design-gate.sh already handles it and
// this lint did not, which is two components disagreeing about what a fence is.
//
// LINE-ANCHORED, and that is not a detail. The first cut of the strip-to-EOF branch matched a
// delimiter ANYWHERE on a line, so one inline mention of ``` in prose blanked the rest of the
// document. The shipped template mentions it once in its own guidance, so filling that template
// in correctly -- the path the README tells every author and every consumer project to walk --
// produced ten errors about tags and headings plainly visible on the page. CommonMark opens a
// fence only at line start with at most three spaces of indent, so that is what this matches.
// The backreference pins the closing delimiter to the opening one: ~~~ does not close ```.
// The CLOSER grammar matters as much as the opener, and being lax about it reopens the same
// hole from the other end. CommonMark forbids an info string on a closing fence and requires
// the closer to be at least as long as the opener, so ```md ... ```js and ````md ... ``` both
// run to EOF for a reader while a lax matcher ended the block early and read the headings
// below as real. `{3,}` captures the FULL opener run so the backreference can compare lengths;
// `\1(?:`*|~*)[ \t]*` accepts same-or-longer with nothing but whitespace after it.
const stripFences = (s) => s.replace(
  /(?:^|\n)[ \t]{0,3}(`{3,}|~{3,})[^\n]*(?:[\s\S]*?\n[ \t]{0,3}\1(?:`*|~*)[ \t]*(?=\n|$)|[\s\S]*$)/g,
  (m) => m.replace(/[^\n]/g, ""));

// Same treatment for HTML comments, and for the same reason. The library lint's adversarial
// pass found the twin of the fenced-heading hole: an entry whose "## Principle" and
// "## Do not copy" headings sat inside a <!-- --> block passed the section check outright.
// The reader sees an entry with no principle in it; the machine saw both contracts met.
// Newlines are preserved so every line-anchored regex downstream keeps its line numbering --
// collapsing them would let two separate lines fuse into one and match things neither said.
// Same three-character bypass as the fence above, and it defeated the very hole this helper
// was added to close: an UNTERMINATED `<!--` runs to end of document (CommonMark HTML block
// type 2), so the reader sees nothing after it while a close-requiring regex saw a normal
// document. `--!>` is the malformed close browsers still honour.
//
// The `-?>` branch is the abrupt-close pair `<!-->` and `<!--->`, and it must come FIRST.
// Without it those parse as unterminated and strip the rest of the file -- content a reader
// can plainly see. That direction is fail-CLOSED (the entry gets reported as missing its
// sections) so it was never dangerous, but a checker that hides visible text is wrong about
// the document, and "wrong in a safe direction" is still wrong.
const stripComments = (s) =>
  s.replace(/<!--(?:-?>|[\s\S]*?(?:--!?>|$))/g, (m) => m.replace(/[^\n]/g, ""));

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
  // Comments stripped here too. The library lint's adversarial pass found that a heading
  // inside <!-- --> satisfied its section check; the brief lint had the identical hole and
  // nobody had gone looking, because the brief's own pass had only attacked FENCES. A whole
  // section of a brief could be commented out and the lint called it complete. Same class,
  // same fix, and the fix belongs on both paths or it is half a fix.
  const text = stripComments(stripFences(raw));

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

// ---------- library entries (PLAN-design 2.8) ----------
//
// "Untagged observations don't enter" is the entire gate, so every key is required and
// `outcome` is required too — written `unknown` when unknown. Optional-when-unknown would
// mean the difference between "we looked and do not know" and "nobody filled it in" is
// invisible, which is the state the plan is trying to prevent.
//
// This MEASURES structure. It does not judge whether a principle is any good — that is the
// ADR-0048 line: agents judge, scripts measure. The one content-shaped rule below (a
// principle cannot be only a link or an image) is still structure: it is the mechanical half
// of "the PRINCIPLE recorded, never just the screenshot".
const LIB_TYPES = Object.freeze(["Pattern", "Craft", "Brand", "Anti"]);
const LIB_CONFIDENCE = Object.freeze(["high", "medium", "low"]);
// Same surface vocabulary as the brief's platform contract, lower-cased for a tag line.
const LIB_PLATFORMS = Object.freeze(["desktop", "mobile", "tablet", "keyboard-first", "reduced-motion"]);
const LIB_KEYS = Object.freeze(["type", "domain", "user", "platform", "problem", "confidence", "outcome", "source"]);
const LIB_HEADINGS = Object.freeze(["Principle", "Do not copy"]);

// A body that is ONLY links, images, code or punctuation carries no transferable principle.
const stripMarkup = (s) => s
  .replace(/^\s*\[[^\]]*\]:\s*\S+.*$/gm, " ") // reference-link definitions
  .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")   // inline images
  .replace(/!\[[^\]]*\]\[[^\]]*\]/g, " ")  // reference images
  .replace(/\[[^\]]*\]\([^)]*\)/g, " ")    // inline links (label goes too: "see Linear" is not a principle)
  .replace(/\[[^\]]*\]\[[^\]]*\]/g, " ")   // full reference links -- walked past the first cut
  .replace(/\[[^\]]*\]/g, " ")             // shortcut reference links `[Linear]` -- the THIRD form
                                           // of the same rule. Closing one link syntax at a time
                                           // is how a floor stays bypassable for three rounds.
  .replace(/<\/?[a-zA-Z][^>]*>/g, " ")     // html tags ONLY: a bare `<` in prose ("runway < 12 months")
                                           // is a real sentence, and eating it failed principles
                                           // for containing arithmetic
  .replace(/`[^`]*`/g, " ")                // inline code
  .replace(/https?:\/\/\S+/g, " ");        // bare urls

function libSection(text, name) {
  const re = new RegExp(`^## ${name}\\s*$`, "gm");
  let count = 0, start = -1;
  for (let m; (m = re.exec(text)) !== null; ) { count++; if (start < 0) start = m.index + m[0].length; }
  if (count !== 1) return { count, body: "" };
  const rest = text.slice(start);
  const next = /^## /m.exec(rest);
  return { count, body: next ? rest.slice(0, next.index) : rest };
}

function lintLibraryEntry(entryPath) {
  const rel = entryPath.startsWith(ROOT) ? entryPath.slice(ROOT.length + 1).replace(/\\/g, "/") : entryPath;
  let raw;
  try { raw = readFileSync(entryPath, "utf8"); } catch {
    err("library-unreadable", rel, "library entry not found or unreadable");
    return;
  }
  // ONE structural text for every check: fences AND comments removed. Two different
  // structural views is how the fenced-heading hole survived in the brief lint -- a checker
  // that parses tags on one text and headings on another is two checkers disagreeing about
  // what the document says.
  const text = stripComments(stripFences(raw));

  // Tags anchored at line start, so a key named mid-sentence is prose, not a tag.
  const body = text;
  const tags = new Map();
  const dupes = new Set();
  const tagRe = /^[-*]\s+([a-z]+):[ \t]*(.*)$/gm;
  for (let m; (m = tagRe.exec(body)) !== null; ) {
    const k = m[1], v = m[2].trim();
    if (!LIB_KEYS.includes(k)) continue;
    if (tags.has(k)) dupes.add(k); else tags.set(k, v);
  }
  for (const k of dupes)
    err("library-tag-repeated", rel, `tag "${k}" appears more than once — two values is one for the reader and one for the machine`);
  for (const k of LIB_KEYS) {
    if (!tags.has(k)) { err("library-tag-missing", rel, `no "${k}:" tag — untagged observations do not enter the library`); continue; }
    if (tags.get(k) === "") { err("library-tag-empty", rel, `tag "${k}" has no value — an empty tag is an untagged entry wearing the shape of a tagged one`); continue; }
    // Unfilled template placeholders. The template ships four tags pre-filled with VALID
    // values (type/platform/confidence/outcome) and the rest as <angle-bracket prompts>, so
    // copying it and writing only the prose passed every other check here. That defeats
    // "untagged observations don't enter" by copy-paste rather than by attack -- and since
    // the template is synced to consumer projects, copy-paste is their default path.
    // An autolink is angle-wrapped and legitimate -- and `source:` is exactly where one belongs,
    // since the template asks for "a run, a receipt id, a route". Exempting it is not a
    // loophole: an unreplaced prompt never looks like a URL.
    if (/^<.*>$/.test(tags.get(k)) && !/^<(?:https?:\/\/|mailto:)[^>]*>$/.test(tags.get(k)))
      err("library-tag-boilerplate", rel, `tag "${k}" is ${tags.get(k)} — an angle-bracket value reads as an unreplaced template prompt; write plain text (autolinks <https://…> are fine)`);
  }

  const type = tags.get("type");
  if (type && !LIB_TYPES.includes(type))
    err("library-type", rel, `type "${type}" is not one of ${LIB_TYPES.join(" | ")} (exact case — a case-folded vocabulary is a suggestion)`);

  const conf = tags.get("confidence");
  if (conf && !LIB_CONFIDENCE.includes(conf))
    err("library-confidence", rel, `confidence "${conf}" is not one of ${LIB_CONFIDENCE.join(" | ")}`);

  const plat = tags.get("platform");
  if (plat) {
    const vals = plat.split(",").map((s) => s.trim()).filter((s) => s !== "");
    if (vals.length === 0) err("library-platform", rel, "platform lists no surface");
    for (const v of vals)
      if (!LIB_PLATFORMS.includes(v))
        err("library-platform", rel, `platform "${v}" is not one of ${LIB_PLATFORMS.join(", ")}`);
  }

  // Both sections are required. `Do not copy` is not ceremony: references are for patterns
  // and vocabulary, and an entry that never says what must not be lifted is how a library
  // becomes a copy list.
  for (const h of LIB_HEADINGS) {
    const sec = libSection(text, h);
    if (sec.count === 0) { err("library-section-missing", rel, `no "## ${h}" section`); continue; }
    if (sec.count > 1) { err("library-section-repeated", rel, `"## ${h}" appears ${sec.count} times`); continue; }
    // Words, not tokens: digits and single letters do not count. `1 2 3 4 5 6 7 8` cleared a
    // token count, and a row of bare numbers is precisely the screenshot-with-no-principle
    // shape this floor exists to catch. The floor is a floor, not a judge -- eight filler
    // words still pass, and whether a principle is any GOOD stays an agent's call (ADR-0048).
    const words = (stripMarkup(sec.body).match(/[A-Za-z]{2,}/g) || []).length;
    if (words < 8)
      err("library-section-thin", rel,
        `"## ${h}" carries no prose — a screenshot, a link or a product name is not a principle (PLAN-design 2.8: the PRINCIPLE recorded, never just the screenshot)`);
  }

  if (LOREM.test(raw)) err("lorem", rel, "lorem ipsum in a library entry");
}

// Every committed library entry. The template lives under docs/templates/ and is deliberately
// NOT here — it is an unfilled contract by design, and linting it would fail forever.
//
// Every .md here is linted, NOT only the ones whose name fits. The adversarial pass found that
// skipping non-conforming names let an untagged `notes.md` sit in the library and pass the gate
// in silence -- and "untagged observations don't enter" is the entire point of this gate, so a
// filename was deciding whether the rule applied. A stray file now fails twice: once on its
// name, once on its missing tags. README.md is exempt as documentation, matching the existing
// convention in docs/design/critique/.
function libraryEntries() {
  if (!existsSync(LIBRARY_DIR)) return [];
  const out = [];
  for (const f of readdirSync(LIBRARY_DIR)) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    const p = join(LIBRARY_DIR, f);
    if (!statSync(p).isFile()) continue;
    if (!/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f))
      err("library-filename", `docs/design/library/${f}`,
        "library entries are named <YYYY-MM-DD>-<slug>.md — an entry with no date is an observation with no when");
    out.push(p);
  }
  return out;
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
    // stripFences, not a second private copy of it: a file that defines "what a fence is" twice
    // has two answers, and the one nobody maintains is the one that gets exploited. (This lint
    // and design-gate.sh already disagreed about `~~~` for exactly that reason.)
    text = stripFences(text);
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
let viewportsMode = false;
let surfacesMode = false;
const briefs = [];
const routes = [];
const libEntries = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--template") { templatePath = resolve(ROOT, argv[++i] ?? ""); continue; }
  if (a === "--route") { routes.push(resolve(ROOT, argv[++i] ?? "")); continue; }
  if (a === "--library") { libEntries.push(resolve(ROOT, argv[++i] ?? "")); continue; }
  if (a === "--floors") { floorsMode = true; continue; }
  if (a === "--viewports") { viewportsMode = true; continue; }
  if (a === "--surfaces") { surfacesMode = true; continue; }
  if (a.startsWith("--")) { console.log(`ERR  [usage] unknown flag ${a}`); process.exit(1); }
  briefs.push(resolve(ROOT, a));
}

// ---------- --viewports: the platform contract becomes the render set (ADR-1403) ----------
//
// Cycle 3 rendered desktop only while section C sat there declaring surfaces nobody consumed.
// A platform contract the pipeline never renders is a contract nobody signed. This is an
// EXPORT, so its parse errors are loud for the same reason --floors' are: a silently
// defaulted viewport set is the original defect wearing a fix's clothes.
const VIEWPORT_FOR = Object.freeze({ Desktop: "1440x900", Mobile: "390x844" });
function platformRowAnswers(body, surface) {
  // Anchored to a real table row, never a prose mention. The 2026-07-16 cosmetic-variant
  // lesson and the 2026-08-02 prose-mention regex are the same lesson twice: tolerant
  // DETECTION, strict GRAMMAR, and a sentence naming the label must never satisfy the check.
  const re = new RegExp("^\\|[ \\t]*" + surface + "[ \\t]*\\|[ \\t]*([^|]*?)[ \\t]*\\|", "gmi");
  const hits = [];
  let m;
  while ((m = re.exec(body)) !== null) hits.push(m[1].trim().toLowerCase());
  return hits;
}
if (viewportsMode) {
  const target = briefs[0];
  if (!target) { console.log("ERR  [usage] --viewports needs a brief path"); process.exit(1); }
  let text;
  try { text = stripComments(stripFences(readFileSync(target, "utf8"))); }
  catch { console.log("ERR  [brief-unreadable] " + target); process.exit(1); }
  const secC = findSections(text).get("C");
  if (secC.count !== 1) {
    console.log('ERR  [platform-contract-missing] no single "## C. Platform contract" section -- refusing to default to desktop, because a defaulted set is how the contract stopped being consumed in the first place');
    process.exit(1);
  }
  const out = [VIEWPORT_FOR.Desktop];
  const hits = platformRowAnswers(secC.body, "Mobile");
  if (hits.length !== 1) {
    console.log("ERR  [platform-row] section C has " + hits.length + " rows for Mobile -- need exactly one");
    process.exit(1);
  }
  if (hits[0] === "yes") out.push(VIEWPORT_FOR.Mobile);
  else if (hits[0] !== "no") {
    console.log('ERR  [platform-answer] the Mobile row answers "' + hits[0] + '" -- a platform contract answers yes or no, and this one is not guessed');
    process.exit(1);
  }
  process.stdout.write(out.join("\n") + "\n");
  process.exit(0);
}

// ---------- --surfaces: product canvas vs documentation, by MARKER (ADR-1407) ----------
//
// Cycle 3's variants spent 30-60% of their scroll on state-matrix and keyboard documentation
// and the jury ranked them UP for it. The obvious gate -- refuse pages whose text says
// "Reference" or "States" -- is the shape this lane has a scar from: design-explore.sh once
// refused a correct variant over the rupee entity, because a text rule cannot tell a colour
// literal from a currency sign. Classification is DECLARED. Nothing here reads page prose.
if (surfacesMode) {
  const target = briefs[0];
  if (!target) { console.log("ERR  [usage] --surfaces needs a variant html path"); process.exit(1); }
  let html;
  try { html = readFileSync(target, "utf8"); }
  catch { console.log("ERR  [variant-unreadable] " + target); process.exit(1); }
  const rel = relative(ROOT, target).split("\\").join("/");
  let bad = 0;

  // COMMENTS, <script> and <style> are removed before anything looks at this page.
  //
  // Everything below judges markup, and all three of those carry text that LOOKS like markup
  // without being any. A fresh attacker passed a page with zero real surfaces three ways --
  // `<!-- data-arc-surface="product" was here once -->`, a CSS selector in a <style> block,
  // and a JS string in a <script> -- each of which satisfied the "declares no surface at all"
  // rule while the page declared nothing. Blanked rather than deleted so byte offsets and the
  // tag walk stay aligned with the file a human is reading.
  const inert = (s) => s.replace(/[^\n]/g, " ");
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, inert)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, inert)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, inert);

  // Walk tags, tracking nesting. This is a MARKER check and not an HTML parser, so it tracks
  // only the containers that can carry a marker and closes them by name.
  const TOKEN = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
  const CONTAINER = /^(section|div|main|article)$/;
  // Double, single AND unquoted. `data-arc-surface='doc'` nested inside a product surface used
  // to sail past the doc-on-canvas ERR -- the one refusal this gate exists for -- because the
  // pattern only knew double quotes. HTML permits all three spellings and a composer writing
  // the page has no idea which one the gate happens to recognise.
  const ATTR = /\bdata-arc-surface\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/;
  const stack = [];
  // Counted on the WALK, not by a regex over the raw file. See the blanking above: the raw-text
  // form was satisfied by a marker in a comment.
  let declared = 0;
  let m;
  while ((m = TOKEN.exec(markup)) !== null) {
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const attrs = m[3];
    if (!CONTAINER.test(tag)) continue;
    if (closing) {
      // Pop BY NAME. An unconditional pop desyncs the stack on unbalanced markup, and one
      // stray `</div>` was enough to pop "product" off and let a doc surface nested inside it
      // read as top-level -- defeating doc-on-canvas, the refusal this gate exists for.
      // Unbalanced markup is now its own refusal rather than a silent re-interpretation.
      const top = stack.length ? stack[stack.length - 1] : null;
      if (top && top.tag === tag) { stack.pop(); }
      else {
        console.log("ERR  [surface-unbalanced] " + rel + ": </" + tag + "> closes " + (top ? "<" + top.tag + ">" : "nothing") + " -- unbalanced container markup, so nesting cannot be judged and a doc region inside a product surface would read as top-level");
        bad++;
      }
      continue;
    }
    if (/\/\s*$/.test(attrs)) continue;   // self-closing: opens nothing
    const a = ATTR.exec(attrs);
    if (a) {
      const kind = (a[1] !== undefined ? a[1] : a[2] !== undefined ? a[2] : a[3]).trim();
      declared++;
      if (kind !== "product" && kind !== "doc") {
        console.log("ERR  [surface-unknown] " + rel + ': data-arc-surface="' + kind + '" -- the vocabulary is product or doc, and an unknown value fails closed');
        bad++;
      }
      // Documentation ON the product canvas is the deterministic ERR this gate exists for.
      // A doc surface as its own top-level sibling is legitimate; nested inside product is not.
      if (kind === "doc" && stack.some((e) => e.kind === "product")) {
        console.log("ERR  [doc-on-canvas] " + rel + ': a data-arc-surface="doc" region is nested inside a product surface -- reference material may be its own surface, never part of the canvas being judged');
        bad++;
      }
      stack.push({ tag, kind });
    } else if (tag === "section" && !stack.some((e) => e.kind === "product" || e.kind === "doc")) {
      // A section that sits inside no MARKED surface fails CLOSED. The first cut asked for
      // stack.length === 0, which sounded like "top level" and was not: <main> is itself a
      // container and pushes, so a section inside <main> -- i.e. every real one -- never
      // looked top-level and the check silently passed everything. Caught by running the gate
      // against its own fixtures rather than by reading it; `node --check` was perfectly happy.
      // A section nested inside an already-marked surface needs no marker of its own: it is
      // part of that surface. One outside every marked surface is simply unclassified, and a
      // composer who forgets the attribute gets a refusal rather than a guess.
      console.log("ERR  [surface-unmarked] " + rel + ": a top-level <section> carries no data-arc-surface -- unmarked is refused, never assumed to be product");
      bad++;
      stack.push({ tag, kind: "unmarked" });
    } else {
      stack.push({ tag, kind: stack.length ? stack[stack.length - 1].kind : "" });
    }
  }
  // A page that declares NO surface at all cannot be classified, and REQ-03 says unmarked
  // fails closed. Everything above walks MARKED regions and top-level <section>s; a page
  // built entirely from <div>s trips neither, carries zero markers, and passed. Cycle 3's
  // variants -- the pages this gate was written against -- were div-built, so the gate did
  // not cover the shape it exists for.
  //
  // The rule is deliberately not "every div needs a marker": that would demand an attribute
  // on every layout wrapper and buy nothing. It is that zero declarations is the emptiest
  // possible result, and an empty result set is the one thing a broken scanner and a clean
  // page agree on.
  //
  // COUNTED ON THE WALK. The first cut counted on the raw html, reasoning that a marker on a
  // tag the walker skips should still count. A fresh attacker showed what that admitted:
  // `<!-- data-arc-surface="product" was here once -->`, a CSS selector inside <style>, and a
  // JS string inside <script> each satisfied it while the page declared nothing -- and this
  // rule exists precisely FOR pages that declare nothing. There is no tag a marker can sit on
  // that the walker skips, since CONTAINER covers every element that can be a surface, so the
  // raw-text reading bought nothing and cost the rule.
  if (declared === 0) {
    console.log("ERR  [surface-undeclared] " + rel + ": the page declares no data-arc-surface region at all -- a page that classifies nothing cannot be judged as product canvas, and unmarked fails closed");
    bad++;
  }
  if (bad > 0) { console.log("design-lint: " + bad + " surface error(s)"); process.exit(1); }
  console.log("design-lint: surfaces ok");
  process.exit(0);
}

if (floorsMode) {
  // floors are an EXPORT, so parse errors here are loud: downstream measuring against a
  // silently-defaulted floor would be hardcoding with extra steps.
  const target = briefs[0];
  if (!target) { console.log("ERR  [usage] --floors needs a brief path"); process.exit(1); }
  let text;
  try { text = stripComments(stripFences(readFileSync(target, "utf8"))); } catch { console.log(`ERR  [brief-unreadable] ${target}`); process.exit(1); }
  const secB = findSections(text).get("B");
  const parsed = secB.count === 1 ? parseFloors(secB.body) : { floors: null, count: 0 };
  if (parsed.count > 1) { console.log("ERR  [floor-repeated] more than one a11y-floor line — the export refuses an ambiguous authority"); process.exit(1); }
  if (!parsed.floors) { console.log("ERR  [floor-missing] no parseable a11y-floor line"); process.exit(1); }
  process.stdout.write(JSON.stringify(parsed.floors) + "\n");
  process.exit(0);
}

if (briefs.length === 0 && routes.length === 0 && libEntries.length === 0) {
  // gate mode: every brief in the repo + every critiqued route. Nothing to lint -> clean
  // pass (a repo with no design work must not nag -- same no-nag rule as design-gate.sh).
  if (existsSync(BRIEFS_DIR)) {
    for (const d of readdirSync(BRIEFS_DIR)) {
      const b = join(BRIEFS_DIR, d, "brief.md");
      if (existsSync(b)) briefs.push(b);
    }
  }
  routes.push(...critiquedRoutes());
  libEntries.push(...libraryEntries());
}

for (const b of briefs) lintBrief(b, templatePath);
for (const r of routes) lintRoute(r);
for (const e of libEntries) lintLibraryEntry(e);

if (errors > 0) {
  console.log(`design-lint: ${errors} error(s)`);
  process.exit(1);
}
console.log("design-lint: all checks passed ✔");
process.exit(0);
