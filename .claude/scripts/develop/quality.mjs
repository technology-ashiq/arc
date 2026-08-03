/**
 * quality.mjs -- prior art on decisions, alternatives on risky slices (Phase 07).
 *
 * Two checks, both triggered rather than ambient, because the risk this phase carries is
 * process tax: a gate that fires on every slice costs on every slice and pays on few.
 *
 *   Pattern Annex     owed ONLY by a slice that declares a decision. Every row carries a
 *                     source and an adopted-or-rejected verdict, and the annex is capped at
 *                     20 lines. A list of what others do with no decision attached is
 *                     research theatre that reads as diligence.
 *
 *   Approach sketches owed ONLY by a slice whose own paths match a risk glob. Two or three,
 *                     one picked, `rejected-because` on each loser. The ECONOMICS are words
 *                     and computed counts -- never durations. "~6 months of maintenance" is
 *                     the same trap as a confidence score: it reads as measurement, is a vibe.
 *
 * BOTH LIVE IN A SEPARATE FILE: `phase-NN-quality.md`, beside the ledger.
 *
 * They used to live in the ledger itself, and a fresh adversarial pass showed that made the
 * feature unusable rather than merely awkward. `parseLedger` closes a slice block on any
 * heading, so `#### approach: 2` ended the slice and dropped its seven fields into the brief
 * namespace, where they collided with approach 1's -- seven `[ledger-unparseable] brief
 * repeats key` BLOCKs on a perfectly valid pair of sketches. An annex placed between slices
 * swallowed every slice after it, and the next slice was parsed as an approach.
 *
 * The alternative was teaching the Phase-00 parser about two new section types. That parser is
 * pinned by 45 adversarial fixtures and every consumer reads through it; a separate file costs
 * one path and touches none of it.
 *
 * Zero dependencies, Node 18+.
 */

import { parseLedger } from "./ledger.mjs";

/**
 * The risk classes, and the ONE place they are declared.
 *
 * They used to be inline in develop.mjs, which the debt ledger records: two places describing
 * "risky paths" drift, and a glob added to one never reaches the other. Phase 07 needs the
 * same list to decide which slices owe sketches, so it moved here rather than being copied.
 */
export const RISK_GLOBS = [
  { name: "auth", re: /(^|\/)(auth|session|token|login|permission|rbac)([./_-]|$)/i },
  { name: "migrations", re: /(^|\/)(migrations?|schema)([./_-]|$)|\.sql$/i },
  { name: "public-api", re: /(^|\/)(api|routes?|handlers?|controllers?)([./_-]|$)/i },
  { name: "security-sensitive", re: /(^|\/)(secrets?|crypto|webhook|payment|stripe|billing)([./_-]|$)/i },
  { name: "the gate itself", re: /(^|\/)(develop-lint|kickoff-lint|validate|lane-resolve)\.(mjs|sh)$/i },
];

/** The decisions that earn an annex. Closed, because "a decision" is otherwise every slice. */
export const DECISION_TYPES = ["product", "ux", "architecture", "external-api"];

/** Where the annex and the sketches live, given a ledger filename. */
export const qualityFileFor = (ledgerFile) => String(ledgerFile).replace(/-tasks\.md$/i, "-quality.md");

const ANNEX_CAP = 20;

/** The economics fields, and the only ones the duration ban applies to. */
const ECONOMICS = ["maintenance", "operational-surface", "deletion-opportunity"];
const SKETCH_FIELDS = ["summary", "trade-offs", "blast-radius", ...ECONOMICS, "verdict"];

/**
 * A duration presented as a COST OF THE WORK.
 *
 * Two things this had to learn from an adversarial pass. It caught exactly one spelling —
 * `\d+` immediately before a unit — so `half a year of migration work`, `roughly 6mo`,
 * `a couple of sprints` and `6 person-months` all sailed through. And it was applied to every
 * field, so on an auth slice it flagged `a 30 day session TTL` and `adds 2 minutes to every CI
 * run, measured` — real, measured, factual durations, in exactly the domain where token
 * lifetimes ARE the design. The ban is on pricing the WORK in time, so it now applies to the
 * economics fields only, and it knows how people actually write a guess.
 *
 * Written without nested quantifiers on purpose: the previous form had three adjacent
 * `\s*`/`\d*`/`\s*` groups and took 16.8 seconds on a field holding 3000 spaces, scaling
 * cubically. A gate that can be hung by whitespace is a denial of service on the build.
 */
const NUMBER_WORD = "(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|dozen|couple|few|several|half)";
const UNIT = "(?:mins?|minutes?|hrs?|hours?|days?|weeks?|wks?|months?|mos?|quarters?|years?|yrs?|sprints?|person-(?:days?|weeks?|months?|years?))";
export const INVENTED_DURATION = new RegExp(
  `(?:~|about |roughly |around |approx[.]? )?\\d{1,4}[ ]?${UNIT}\\b` +
  `|\\b${NUMBER_WORD}[ ]${UNIT}\\b` +
  `|\\b${NUMBER_WORD}[ ]of[ ]a[ ]${UNIT}\\b`,
  "i",
);

/** Normalise for MATCHING only. NFKC folds full-width punctuation; invisibles are stripped. */
const INVISIBLE = /[​-‏⁠᠎﻿­]/g;
const clean = (s) => String(s ?? "").replace(INVISIBLE, "").normalize("NFKC");
/** Emphasis and surrounding punctuation, stripped from a VALUE before comparing it. */
const bare = (s) => clean(s).trim().replace(/^[*_`]+/, "").replace(/[*_`]+$/, "").trim();

/**
 * A value counts as filled. Deliberately NOT ledger.mjs's `isFilled`: that one treats "none"
 * as empty, and `deletion-opportunity: none` is the honest answer to "what does this let us
 * delete?" — the suite's own passing fixture was rejected by it.
 */
const filled = (v) => bare(v).length > 0;

/** Path-like tokens a slice's title names, backticked or not. */
export function slicePaths(slice) {
  const title = clean(slice?.fields?.title ?? "");
  const out = new Set();
  for (const m of title.matchAll(/`([^`\n]+)`/g)) out.add(m[1].trim());
  // Unbackticked too. A title reading `verify the token in src/auth/session.js` names a path
  // to every reader, and requiring backticks made the trigger opt-in for the author whose
  // slice it fires on.
  for (const m of title.matchAll(/(?:^|[\s(])([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)/g)) out.add(m[1]);
  return [...out]
    .filter((t) => /[/.]/.test(t) && !/\s/.test(t))
    .map((t) => t.replace(/\\/g, "/").replace(/^\.\//, "").replace(/[.,;:)]+$/, ""));
}

/**
 * Which risk classes a slice trips, BY PATH.
 *
 * Never by the slice's own `risk:` field. "Is this slice risky?" is exactly the judgement a
 * model under time pressure gets wrong, and always in the same direction.
 */
export function riskClasses(slice) {
  const paths = slicePaths(slice);
  return RISK_GLOBS.filter((g) => paths.some((p) => g.re.test(p))).map((g) => g.name);
}

/**
 * Sections of a quality file, keyed by slice id, with absolute line numbers.
 *
 * Fence-aware, because ADR-0100 sanctions fenced proof output and a heading quoted inside a
 * fence is content: a fenced annex used to be validated as a real one, and the miner agent's
 * own `slice NN` template, quoted, was reported as an annex naming no slice.
 *
 * DUPLICATES ARE AN ERROR, never last-wins. Two annexes for one slice hid an invalid one
 * behind a valid one, and split a 44-line annex under two headings to walk past the cap.
 */
function sectionsOf(text, label) {
  const lines = clean(text).split(/\r?\n/);
  const found = new Map();
  const errors = [];
  const head = new RegExp(`^[ \\t]*(#{1,6})[ \\t]*${label}\\b(.*)$`, "i");
  let fence = false, open = null;

  const close = (i) => {
    if (!open) return;
    open.end = i;
    if (found.has(open.id)) {
      errors.push({ at: open.at, id: open.id, msg: `slice ${open.id} has more than one ${label} section (also at line ${found.get(open.id).at}) — two of them hide each other, and split one is how a cap is walked past` });
    } else found.set(open.id, open);
    open = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^[ \t]*(```|~~~)/.test(l)) { fence = !fence; continue; }
    if (fence) continue;
    const m = l.match(head);
    if (m) {
      close(i);
      const id = (m[2].match(/\bslice[ \t]*:?[ \t]*([0-9][0-9a-z-]*)/i) || [])[1];
      if (!id) { errors.push({ at: i + 1, msg: `a ${label} heading that names no slice — it belongs to nothing and is checked against nothing` }); continue; }
      open = { id, at: i + 1, level: m[1].length, body: [] };
      continue;
    }
    const h = l.match(/^[ \t]*(#{1,6})[ \t]+\S/);
    if (open && h && h[1].length <= open.level) { close(i); continue; }
    if (open) open.body.push({ line: i + 1, text: l });
  }
  close(lines.length);
  return { found, errors };
}

// ---------------------------------------------------------------------------
// The Pattern Annex
// ---------------------------------------------------------------------------

export function validateAnnex(ledgerText, qualityText = "") {
  const fails = [];
  const { slices } = parseLedger(String(ledgerText ?? ""));
  const { found, errors } = sectionsOf(qualityText, "Pattern Annex");
  fails.push(...errors);

  const ids = new Set(slices.map((s) => s.id));
  for (const [id, sec] of found) {
    // A section naming a slice that does not exist was never validated and never reported —
    // one digit of padding (`slice: 1` against `slice 01`) orphaned a whole annex silently.
    if (!ids.has(id)) fails.push({ at: sec.at, id, msg: `a Pattern Annex names slice ${id}, which this phase has no slice for` });
  }

  for (const s of slices) {
    const dt = bare(s.fields?.["decision-type"] ?? "");
    const declared = dt.length > 0;
    const annex = found.get(s.id);

    if (declared && !DECISION_TYPES.includes(dt.toLowerCase())) {
      fails.push({ at: s.line, id: s.id, msg: `slice ${s.id} decision-type "${dt}" is outside ${DECISION_TYPES.join(" | ")}` });
    }
    if (declared && !annex) fails.push({ at: s.line, id: s.id, msg: `slice ${s.id} declares a ${dt} decision but carries no Pattern Annex` });
    if (!declared && annex) fails.push({ at: annex.at, id: s.id, msg: `slice ${s.id} carries a Pattern Annex but declares no \`decision-type:\` — mining runs on a declared decision or not at all` });
    if (!annex) continue;

    const body = annex.body.filter((l) => l.text.trim() !== "");
    if (body.length > ANNEX_CAP) {
      fails.push({ at: annex.at, id: s.id, msg: `slice ${s.id}'s Pattern Annex is ${body.length} lines, over the ${ANNEX_CAP}-line cap` });
    }

    // Rows. A GFM table may omit its outer pipes, so a row is "at least three cells", and the
    // HEADER is whichever row precedes the `---` separator rather than one literally named
    // `pattern` — a header reading `prior art` was validated as data and reported as a finding.
    let rows = 0, seenSeparator = false;
    let prev = null;
    for (const l of annex.body) {
      const cells = l.text.split("|").map((c) => c.trim()).filter((c, i, a) => !(c === "" && (i === 0 || i === a.length - 1)));
      if (cells.length < 3) { prev = null; continue; }
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) { seenSeparator = true; prev = null; continue; }
      if (!seenSeparator) { prev = l; continue; }          // still in the header block
      rows++;
      const [pattern, source, verdict] = cells;
      if (!filled(source)) fails.push({ at: l.line, id: s.id, msg: `annex row "${(pattern || "").slice(0, 40)}" carries no source` });
      if (!/^(adopted|rejected)\b/i.test(bare(verdict))) {
        fails.push({ at: l.line, id: s.id, msg: `annex row "${(pattern || "").slice(0, 40)}" has no adopted-or-rejected verdict — a row with no decision attached is research theatre` });
      }
    }
    void prev;
    if (rows === 0) {
      fails.push({ at: annex.at, id: s.id, msg: `slice ${s.id}'s Pattern Annex holds no rows — an empty annex records that nothing was looked at, which is not what it says` });
    }
  }
  return { fails };
}

// ---------------------------------------------------------------------------
// Approach sketches
// ---------------------------------------------------------------------------

export function validateSketches(ledgerText, qualityText = "") {
  const fails = [], warns = [];
  const { slices } = parseLedger(String(ledgerText ?? ""));
  const { found, errors } = sectionsOf(qualityText, "Approach sketches");
  fails.push(...errors);

  const ids = new Set(slices.map((s) => s.id));
  for (const [id, sec] of found) {
    if (!ids.has(id)) fails.push({ at: sec.at, id, msg: `an Approach sketches section names slice ${id}, which this phase has no slice for` });
  }

  for (const s of slices) {
    const classes = riskClasses(s);
    const sketch = found.get(s.id);
    if (!sketch) {
      if (classes.length) warns.push({ at: s.line, id: s.id, msg: `slice ${s.id} touches ${classes.join(", ")} and carries no approach sketches — 2 or 3 are expected before code` });
      continue;
    }

    const body = sketch.body.map((l) => l.text).join("\n");
    const rewritten = body.replace(
      /^([ \t]*(?:[-*+][ \t]+)?(?:#{1,6}[ \t]*)?(?:\*{1,2}|_{1,2})?[ \t]*)approach[ \t]*:[ \t]*([0-9][0-9a-z-]*)/gim,
      (_m, lead, id) => `${lead}slice: ${id}`,
    );
    // Fence-aware, matching parseLedger. The counter and the parser disagreed by construction:
    // a fenced approach TEMPLATE was counted as a marker and not parsed as one.
    let fence = false, markers = 0;
    for (const l of body.split("\n")) {
      if (/^[ \t]*(```|~~~)/.test(l)) { fence = !fence; continue; }
      if (!fence && /^[\s>*_+#-]*approach[ \t]*:/i.test(l)) markers++;
    }
    const { slices: approaches, errors: aErrors } = parseLedger(rewritten);
    if (markers !== approaches.length) {
      fails.push({ at: sketch.at, id: s.id, msg: `${markers} line(s) read as an approach marker but ${approaches.length} parsed — an approach that is not parsed is one whose economics are never checked` });
    }
    for (const e of aErrors) {
      // A repeated key inside an approach hid a duration behind a first, innocent value.
      fails.push({ at: sketch.at, id: s.id, msg: `slice ${s.id}'s sketches: ${e.msg}` });
    }
    if (approaches.length < 2 || approaches.length > 3) {
      fails.push({ at: sketch.at, id: s.id, msg: `slice ${s.id} has ${approaches.length} approach(es); the comparison is 2 or 3 — one is a defence, four is a survey` });
    }

    let picked = 0;
    for (const a of approaches) {
      const f = a.fields ?? {};
      for (const k of SKETCH_FIELDS) {
        if (!filled(f[k])) fails.push({ at: sketch.at, id: s.id, msg: `approach ${a.id} on slice ${s.id} has no \`${k}:\`` });
      }
      // Prefix-matched, like the annex verdict. `picked — one place to change beats fourteen`
      // was rejected by string equality while `adopted — reason` was fine, in one document.
      const verdict = bare(f.verdict ?? "").toLowerCase();
      if (/^picked\b/.test(verdict)) picked++;
      else if (/^rejected\b/.test(verdict)) {
        if (!filled(f["rejected-because"])) fails.push({ at: sketch.at, id: s.id, msg: `approach ${a.id} on slice ${s.id} is rejected with no \`rejected-because:\` — the losing options are where the reasoning lives` });
      } else if (verdict) {
        fails.push({ at: sketch.at, id: s.id, msg: `approach ${a.id} on slice ${s.id} has verdict "${verdict}", outside picked | rejected` });
      }

      const surface = f["operational-surface"] ?? "";
      if (filled(surface) && !/\d/.test(clean(surface))) {
        fails.push({ at: sketch.at, id: s.id, msg: `approach ${a.id} on slice ${s.id} states an operational surface with no counts — deps, services and config keys are counted` });
      }

      // The economics fields only. Applied everywhere, this flagged `a 30 day session TTL` on
      // an auth slice: a real, measured, factual duration in the one domain where token
      // lifetimes are the design. The ban is on pricing the WORK.
      //
      // Joined, so a duration split across two fields is still one duration.
      const econ = ECONOMICS.map((k) => clean(f[k] ?? "")).join(" ");
      const m = econ.match(INVENTED_DURATION);
      if (m) {
        fails.push({ at: sketch.at, id: s.id, msg: `approach ${a.id} on slice ${s.id} prices the work in time ("${m[0].trim()}") — an invented duration reads as measurement and is a vibe` });
      }
    }
    if (approaches.length && picked !== 1) {
      fails.push({ at: sketch.at, id: s.id, msg: `slice ${s.id} has ${picked} picked approach(es); exactly one is picked and the rest carry \`rejected-because\`` });
    }
  }
  return { fails, warns };
}
