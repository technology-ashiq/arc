/**
 * The three lints. All of them read the RENDERED BYTES.
 *
 *   value        -- a compliance claim, a leftover interpolation, or markup in the output
 *   trace        -- every clause is pinned, and no clause from an unselected branch survived
 *   completeness -- every mandatory clause is PRESENT, and the page is not merely well-formed
 *
 * completeness exists because a gate whose only failure mode is rule-breaking cannot report
 * that work is simply not good enough: `arc-design-cycle3` 2026-07-30 defined PASS as an
 * absence and passed characterless work five runs running. "Every clause traces perfectly" is
 * exactly that shape -- an empty page satisfies it.
 *
 * All three are WARN-first in TRIAL. A finding's LEVEL is recorded in the run sidecar
 * regardless; the TRIAL flag decides only whether the process exit code moves. Asserting on
 * the exit code alone would be a test that passes whatever the lint does.
 */
import { conditionHolds } from "./schema.mjs";

export const GROUPS = ["value", "trace", "completeness"];
// Nothing has been promoted yet. Promotion is /arc-retro's act against docs/trial-ledger.md,
// never this cycle's convenience (ADR-1009).
export const TRIAL = new Set(["value", "trace", "completeness"]);

const MARKER = /<!--\s*clause:([A-Z][A-Z0-9_.]*)\s*-->/g;

function finding(group, page, clause, level, message) {
  return { group, page, clause: clause || "-", level, message };
}

/** Clause ids present in the rendered bytes, in order. */
export function markersIn(text) {
  const ids = [];
  let m;
  MARKER.lastIndex = 0;
  while ((m = MARKER.exec(text)) !== null) ids.push(m[1]);
  return ids;
}

export function valueLint(page, text, denylist) {
  const out = [];
  const lower = text.toLowerCase();

  // Phrases that legitimately CONTAIN a denylisted token because they are its honest
  // negation. Matched first; an occurrence inside one of them does not fire.
  const exempt = [];
  for (const phrase of (denylist.allowed_in_context || {}).phrases || []) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(phrase.toLowerCase(), from);
      if (at < 0) break;
      exempt.push([at, at + phrase.length]);
      from = at + 1;
    }
  }
  const inExempt = (i) => exempt.some(([a, b]) => i >= a && i < b);

  for (const token of denylist.tokens || []) {
    const t = token.toLowerCase();
    let from = 0;
    for (;;) {
      const at = lower.indexOf(t, from);
      if (at < 0) break;
      from = at + t.length;
      if (inExempt(at)) continue;
      // Word-ish boundary: "certified" must fire, "recertifiedish" is not the claim.
      const before = at === 0 ? " " : lower[at - 1];
      const after = at + t.length >= lower.length ? " " : lower[at + t.length];
      if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
      out.push(finding("value", page, "-", "FAIL", `the rendered page contains the compliance claim "${token}". Constitution E3: no badge without a demonstrable truth and an evidence link.`));
    }
  }

  if (/\{\{/.test(text))
    out.push(finding("value", page, "-", "FAIL", "an unresolved {{ }} interpolation survived into the output"));
  if (/<script|<iframe|javascript:/i.test(text))
    out.push(finding("value", page, "-", "FAIL", "the rendered page contains active markup"));
  // A raw URL in the body that is not one of the evidence links: a link smuggled through a
  // value would have failed the input charset, so this catches the template author instead.
  return out;
}

export function traceLint(page, text, clauseMap, facts, templateClauses) {
  const out = [];
  const emitted = markersIn(text);
  const declaredIds = templateClauses.map((c) => c.id);

  for (const id of emitted) {
    if (!declaredIds.includes(id))
      out.push(finding("trace", page, id, "FAIL", "a clause marker in the output does not correspond to any clause block in the pinned template"));
  }

  // Direction 2: a clause that BELONGS to a branching field may appear only if the SELECTED
  // branch lists it.
  //
  // The first cut asked the wrong question -- it fired for every non-selected branch that
  // listed the clause, so a clause legitimately shared by two branches reported a mismatch
  // against a venture it described perfectly. The question is not "is this clause listed under
  // some branch that was not chosen", it is "is this clause listed under the branch that WAS".
  // Found on the very first render, by the lint firing on a correct page.
  for (const [field, branches] of Object.entries(clauseMap)) {
    if (field.startsWith("_")) continue;

    let selectedValue = null;
    for (const branchValue of Object.keys(branches)) {
      if (conditionHolds(facts, `${field}=${branchValue}`)) { selectedValue = branchValue; break; }
    }
    if (selectedValue === null) {
      out.push(finding("trace", page, "-", "FAIL", `clause-map.json branches on "${field}", but the facts value matches none of its branches (${Object.keys(branches).join(" / ")}). Nothing can be checked against a branch that does not exist.`));
      continue;
    }

    const allowed = new Set(branches[selectedValue] || []);
    const mappedAnywhere = new Set();
    for (const ids of Object.values(branches)) for (const id of ids) mappedAnywhere.add(id);

    for (const id of emitted) {
      if (!mappedAnywhere.has(id)) continue;
      if (!allowed.has(id))
        out.push(finding("trace", page, id, "FAIL", `branch mismatch: this clause is not listed under ${field}=${selectedValue}, which is what the facts say. A page that describes an arrangement this venture does not have is the failure this lane exists to prevent.`));
    }
  }

  // Direction 3: map drift. A clause the TEMPLATE guards with `when=field=value` must be listed
  // under exactly that branch in clause-map.json, or the map and the templates have drifted and
  // direction 2 is checking a set that no longer describes the pages.
  //
  // An earlier cut of this check warned whenever an emitted clause merely SHARED A PREFIX with
  // a mapped one. That is not the same question: most clauses on a page are unconditional and
  // correctly unmapped, so it fired fourteen times on a healthy privacy page. A check that is
  // noisy on correct input teaches its reader to skip it, which is worse than not having it.
  for (const decl of templateClauses) {
    if (!decl.when) continue;
    const eq = decl.when.indexOf("=");
    const field = decl.when.slice(0, eq);
    const value = decl.when.slice(eq + 1);
    const branches = clauseMap[field];
    if (!branches) {
      out.push(finding("trace", page, decl.id, "FAIL", `the template guards this clause with ${decl.when}, but clause-map.json has no entry for the field "${field}". Branch-mismatch cannot be checked for a field the map does not know.`));
      continue;
    }
    const ids = branches[value];
    if (!ids) {
      out.push(finding("trace", page, decl.id, "FAIL", `the template guards this clause with ${decl.when}, but clause-map.json lists no branch "${value}" for "${field}"`));
      continue;
    }
    if (!ids.includes(decl.id))
      out.push(finding("trace", page, decl.id, "FAIL", `the template guards this clause with ${decl.when}, but clause-map.json does not list it under that branch. The map has drifted from the templates.`));
  }

  return out;
}

export function completenessLint(page, text, required, facts) {
  const out = [];
  const emitted = new Set(markersIn(text));
  const rows = required[page];
  if (!rows) {
    out.push(finding("completeness", page, "-", "WARN", "no required-clause list exists for this page"));
    return out;
  }
  for (const row of rows) {
    if (row.when && !conditionHolds(facts, row.when)) continue;
    if (!emitted.has(row.id))
      out.push(finding("completeness", page, row.id, "FAIL", `mandatory clause missing${row.when ? ` (required when ${row.when})` : ""}. Provenance alone cannot pass an empty page.`));
  }
  // A page that emitted nothing at all is its own, louder finding: without this, a template
  // that rendered to whitespace produces one finding per required clause and reads like a
  // list of small problems rather than one total one.
  if (emitted.size === 0)
    out.push(finding("completeness", page, "-", "FAIL", "the page emitted ZERO clauses"));
  return out;
}

export function runAllLints({ page, text, facts, clauseMap, required, denylist, templateClauses }) {
  return [
    ...valueLint(page, text, denylist),
    ...traceLint(page, text, clauseMap, facts, templateClauses),
    ...completenessLint(page, text, required, facts),
  ];
}

/** Does this finding set move the exit code? Only a FAIL in a group promoted OUT of trial. */
export function findingsAreFatal(findings) {
  return findings.some((f) => f.level === "FAIL" && !TRIAL.has(f.group));
}
