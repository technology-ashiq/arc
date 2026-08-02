/**
 * quality.mjs -- prior art on decisions, alternatives on risky slices (Phase 07).
 *
 * Two checks, both triggered rather than ambient, because the risk this phase carries is
 * process tax: a gate that fires on every slice costs on every slice and pays on few.
 *
 *   Pattern Annex     runs ONLY on a slice that declares a decision. Every row carries a
 *                     source and an adopted-or-rejected verdict, and the annex is capped at
 *                     20 lines. A list of what others do with no decision attached is
 *                     research theatre that reads as diligence.
 *
 *   Approach sketches run ONLY on a slice whose own paths match a risk glob. Two or three,
 *                     one picked, `rejected-because` on each loser. Economics are words and
 *                     COMPUTED COUNTS -- never durations. "~6 months of maintenance" is the
 *                     same trap as a confidence score: it reads as measurement and is a vibe.
 *
 * The grammar is not a new one. Both sections are read through ledger.mjs's hardened block
 * parser by rewriting their markers, exactly as learning.mjs does for `learning:` rows -- a
 * second grammar would start at zero and be attacked the same way.
 *
 * Zero dependencies, Node 18+.
 */

import { isFilled, parseLedger } from "./ledger.mjs";

/**
 * The risk classes, and the ONE place they are declared.
 *
 * They used to live inline in develop.mjs, which the debt ledger records: two places
 * describing "risky paths" drift, and a glob added to one never reaches the other. Phase 07
 * needs the same list to decide which slices owe sketches, so it moved here rather than
 * being copied. Still not read from `.claude/rules/security-sensitive.md` — that row stays
 * open — but there is one definition now instead of two.
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

/** The source hierarchy the miner must respect, best first. Recorded here so the lint can name it. */
export const SOURCE_TIERS = ["primary documentation", "engineering blog", "teardown", "trend commentary"];

const ANNEX_CAP = 20;

/**
 * A duration presented as a cost. This is the check the phase is really about.
 *
 * It matches a number next to a time unit. It deliberately does NOT match a bare number --
 * "touches 3 call sites" and "deps +0, services +0, config +1" are exactly the computed
 * counts the sketch is supposed to carry, and a check that rejected those would push authors
 * back to prose, which is the opposite of the point.
 */
export const INVENTED_DURATION =
  /\b~?\d+(?:\.\d+)?\s*(?:-|–|to)?\s*\d*\s*(min|mins|minute|minutes|hr|hrs|hour|hours|day|days|week|weeks|month|months|quarter|quarters|year|years|sprint|sprints)\b/i;

/** Paths a slice's own title names. Per-slice and mechanical: nothing self-assessed. */
export function slicePaths(slice) {
  return [...String(slice?.fields?.title ?? "").matchAll(/`([^`\n]+)`/g)]
    .map((m) => m[1].trim())
    .filter((t) => /[/.]/.test(t) && !/\s/.test(t))
    .map((t) => t.replace(/\\/g, "/").replace(/^\.\//, ""));
}

/**
 * Which risk classes a slice trips, by PATH.
 *
 * Never by the slice's own `risk:` field. "Is this slice risky?" is exactly the judgement a
 * model under time pressure gets wrong, and always in the same direction — which is why
 * Phase 03's checkpoint path-matches too. A slice naming no path trips nothing, and that is
 * a real answer rather than a failure to decide.
 */
export function riskClasses(slice) {
  const paths = slicePaths(slice);
  return RISK_GLOBS.filter((g) => paths.some((p) => g.re.test(p))).map((g) => g.name);
}

/** Section body by heading, fence-aware, to the next heading of the same or higher level. */
function sectionOf(text, re) {
  const lines = String(text ?? "").split(/\r?\n/);
  let inFence = false, start = -1, level = 0;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^[ \t]*(```|~~~)/.test(l)) { inFence = !inFence; if (start >= 0) out.push({ line: i + 1, text: l }); continue; }
    if (inFence) { if (start >= 0) out.push({ line: i + 1, text: l }); continue; }
    const h = l.match(/^[ \t]*(#{1,6})[ \t]+\S/);
    if (start < 0) {
      if (h && re.test(l)) { start = i; level = h[1].length; }
      continue;
    }
    if (h && h[1].length <= level) break;
    out.push({ line: i + 1, text: l });
  }
  return start < 0 ? null : out;
}

// ---------------------------------------------------------------------------
// The Pattern Annex
// ---------------------------------------------------------------------------

/**
 * Validate every Pattern Annex in a ledger.
 *
 * An annex belongs to a slice, named in its heading: `### Pattern Annex — slice 03`. That is
 * what makes "runs only on a declared decision" ASSERTABLE rather than assumed: an annex whose
 * slice declares no `decision-type:` is invalid, and a slice that declares one and has no
 * annex is invalid too. Both directions, or the trigger is decoration.
 */
export function validateAnnex(text) {
  const fails = [];
  const { slices } = parseLedger(String(text ?? ""));
  const lines = String(text ?? "").split(/\r?\n/);

  const found = new Map();          // slice id -> { at, body }
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^[ \t]*#{1,6}[ \t]*Pattern Annex\b[^\n]*?\bslice[ \t]*:?[ \t]*([0-9][0-9a-z-]*)/i);
    if (!m) continue;
    const body = sectionOf(lines.slice(i).join("\n"), /Pattern Annex/i) ?? [];
    found.set(m[1], { at: i + 1, body });
  }
  // A heading a person reads as an annex but that names no slice must fail closed, never be
  // skipped — the same discipline NEAR_SLICE applies in the ledger grammar.
  lines.forEach((l, i) => {
    if (/^[ \t]*#{1,6}[ \t]*Pattern Annex/i.test(l) &&
        !/\bslice[ \t]*:?[ \t]*[0-9]/i.test(l)) {
      fails.push({ at: i + 1, msg: "a Pattern Annex heading that names no slice — it belongs to nothing and is checked against nothing" });
    }
  });

  for (const s of slices) {
    const dtRaw = String(s.fields?.["decision-type"] ?? "").trim();
    const declared = isFilled(dtRaw);
    const annex = found.get(s.id);

    if (declared && !DECISION_TYPES.includes(dtRaw.toLowerCase())) {
      fails.push({ at: s.line, id: s.id, msg: `slice ${s.id} decision-type "${dtRaw}" is outside ${DECISION_TYPES.join(" | ")}` });
    }
    if (declared && !annex) {
      fails.push({ at: s.line, id: s.id, msg: `slice ${s.id} declares a ${dtRaw} decision but carries no Pattern Annex` });
    }
    if (!declared && annex) {
      fails.push({ at: annex.at, id: s.id, msg: `slice ${s.id} carries a Pattern Annex but declares no \`decision-type:\` — mining runs on a declared decision or not at all` });
    }
    if (!annex) continue;

    const body = annex.body.filter((l) => l.text.trim() !== "");
    if (body.length > ANNEX_CAP) {
      fails.push({ at: annex.at, id: s.id, msg: `slice ${s.id}'s Pattern Annex is ${body.length} lines, over the ${ANNEX_CAP}-line cap` });
    }

    let rows = 0;
    for (const l of annex.body) {
      const cells = l.text.split("|").map((c) => c.trim());
      if (cells.length < 4) continue;                          // not a table row
      if (/^[-: ]+$/.test(cells[1] ?? "")) continue;           // the separator
      if (/^pattern$/i.test(cells[1] ?? "")) continue;         // the header
      rows++;
      const [, pattern, source, verdict] = cells;
      if (!isFilled(source)) {
        fails.push({ at: l.line, id: s.id, msg: `annex row "${(pattern || "").slice(0, 40)}" carries no source` });
      }
      if (!/^(adopted|rejected)\b/i.test(String(verdict ?? "").trim())) {
        fails.push({ at: l.line, id: s.id, msg: `annex row "${(pattern || "").slice(0, 40)}" has no adopted-or-rejected verdict — a row with no decision attached is research theatre` });
      }
    }
    if (rows === 0) {
      fails.push({ at: annex.at, id: s.id, msg: `slice ${s.id}'s Pattern Annex holds no rows — an empty annex records that nothing was looked at, which is not what it says` });
    }
  }
  return { fails };
}

// ---------------------------------------------------------------------------
// Approach sketches
// ---------------------------------------------------------------------------

const SKETCH_FIELDS = ["summary", "trade-offs", "blast-radius", "maintenance", "operational-surface", "deletion-opportunity", "verdict"];

/**
 * Validate the approach sketches in a ledger.
 *
 * Returns `{ fails, warns }`. The COUNT is a WARN — a risky slice with no sketches is a
 * process gap and the phase spec says WARN — while everything about a sketch that DOES exist
 * is a FAIL, because a malformed sketch is worse than an absent one: it reads as a weighed
 * decision and is not.
 */
export function validateSketches(text) {
  const fails = [], warns = [];
  const src = String(text ?? "");
  const { slices } = parseLedger(src);
  const lines = src.split(/\r?\n/);

  const found = new Map();          // slice id -> { at, body }
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^[ \t]*#{1,6}[ \t]*Approach sketches\b[^\n]*?\bslice[ \t]*:?[ \t]*([0-9][0-9a-z-]*)/i);
    if (!m) continue;
    found.set(m[1], { at: i + 1, body: sectionOf(lines.slice(i).join("\n"), /Approach sketches/i) ?? [] });
  }

  for (const s of slices) {
    const classes = riskClasses(s);
    const sketch = found.get(s.id);

    if (!sketch) {
      if (classes.length) {
        warns.push({ at: s.line, id: s.id, msg: `slice ${s.id} touches ${classes.join(", ")} and carries no approach sketches — 2 or 3 are expected before code` });
      }
      continue;                     // a non-risk slice with no sketches is untouched, by design
    }

    // Sketch blocks reuse the ledger's hardened block reader: `approach: 1` becomes `slice: 1`.
    const body = sketch.body.map((l) => l.text).join("\n");
    const rewritten = body.replace(
      /^([ \t]*(?:[-*+][ \t]+)?(?:#{1,6}[ \t]*)?(?:\*{1,2}|_{1,2})?[ \t]*)approach[ \t]*:[ \t]*([0-9][0-9a-z-]*)/gim,
      (_m, lead, id) => `${lead}slice: ${id}`,
    );
    const markers = (body.match(/^[\s>*_+#-]*approach[ \t]*:/gim) || []).length;
    const { slices: approaches } = parseLedger(rewritten);
    if (markers !== approaches.length) {
      fails.push({ at: sketch.at, id: s.id, msg: `${markers} line(s) read as an approach marker but ${approaches.length} parsed — an approach that is not parsed is one whose economics are never checked` });
    }

    if (approaches.length < 2 || approaches.length > 3) {
      fails.push({ at: sketch.at, id: s.id, msg: `slice ${s.id} has ${approaches.length} approach(es); the comparison is 2 or 3 — one is a defence, four is a survey` });
    }

    let picked = 0;
    for (const a of approaches) {
      const f = a.fields ?? {};
      for (const k of SKETCH_FIELDS) {
        if (!isFilled(f[k])) {
          fails.push({ at: sketch.at, id: s.id, msg: `approach ${a.id} on slice ${s.id} has no \`${k}:\`` });
        }
      }
      const verdict = String(f.verdict ?? "").trim().toLowerCase();
      if (verdict === "picked") picked++;
      else if (verdict === "rejected" && !isFilled(f["rejected-because"])) {
        fails.push({ at: sketch.at, id: s.id, msg: `approach ${a.id} on slice ${s.id} is rejected with no \`rejected-because:\` — the losing options are where the reasoning lives` });
      } else if (verdict && verdict !== "picked" && verdict !== "rejected") {
        fails.push({ at: sketch.at, id: s.id, msg: `approach ${a.id} on slice ${s.id} has verdict "${verdict}", outside picked | rejected` });
      }

      // Operational surface is COUNTED, not described. Words there are how "a few extra
      // config keys" becomes a number nobody ever wrote down.
      const surface = String(f["operational-surface"] ?? "");
      if (isFilled(surface) && !/\d/.test(surface)) {
        fails.push({ at: sketch.at, id: s.id, msg: `approach ${a.id} on slice ${s.id} states an operational surface with no counts — deps, services and config keys are counted` });
      }

      // The check this phase is really about, applied to every field of the sketch.
      for (const [k, v] of Object.entries(f)) {
        if (typeof v !== "string") continue;
        const m = v.match(INVENTED_DURATION);
        if (m) {
          fails.push({ at: sketch.at, id: s.id, msg: `approach ${a.id} on slice ${s.id} costs \`${k}\` in time ("${m[0].trim()}") — an invented duration reads as measurement and is a vibe` });
        }
      }
    }
    if (approaches.length && picked !== 1) {
      fails.push({ at: sketch.at, id: s.id, msg: `slice ${s.id} has ${picked} picked approach(es); exactly one is picked and the rest carry \`rejected-because\`` });
    }
  }
  return { fails, warns };
}
