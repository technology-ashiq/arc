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
import { conditionHolds, conditionVerdict, getPath } from "./schema.mjs";

export const GROUPS = ["value", "trace", "completeness", "consistency"];
// Nothing has been promoted yet. Promotion is /arc-retro's act against docs/trial-ledger.md,
// never this cycle's convenience (ADR-1009).
export const TRIAL = new Set(["value", "trace", "completeness", "consistency"]);

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

/**
 * Collapse every run of separator characters to one space. The denylist matched raw lowercased
 * bytes, so "ISO 27001" fired and "ISO-27001" did not -- and the whole exploit was a FREE-TEXT
 * value the charset already permits, needing no code or template access at all. Adding more
 * tokens is not the fix: a token list can never enumerate separator variants.
 */
function flatten(s) {
  return s.toLowerCase().replace(/[-/_.\s]+/g, " ");
}

export function valueLint(page, text, denylist, ownHost) {
  const out = [];
  const lower = flatten(text);

  // Phrases that legitimately CONTAIN a denylisted token because they are its honest
  // negation. Matched first; an occurrence inside one of them does not fire.
  const exempt = [];
  for (const phrase of (denylist.allowed_in_context || {}).phrases || []) {
    let from = 0;
    for (;;) {
      const flat = flatten(phrase);
      const at = lower.indexOf(flat, from);
      if (at < 0) break;
      // The RANGE must be measured in the flattened string too. Measuring the span with the
      // raw phrase length shifted every exemption window, so "this is not legal advice" stopped
      // exempting the token it exists to exempt -- a fix introducing a false positive in the
      // check it was fixing.
      exempt.push([at, at + flat.length]);
      from = at + 1;
    }
  }
  const inExempt = (i) => exempt.some(([a, b]) => i >= a && i < b);

  for (const token of denylist.tokens || []) {
    const t = flatten(token);
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

  // The check this comment used to only DESCRIBE. A vocab label, a window value or template
  // prose never passes the FREE-TEXT charset, so a markdown link can be introduced through any
  // of them -- and a gate that states its contract and compares against nothing is the
  // arc-memory 2026-08-12 defect recurring in a different file.
  const links = text.match(/\]\((https?:)?\/\/[^)]*\)/g) || [];
  for (const l of links)
    out.push(finding("value", page, "-", "FAIL", `the rendered page contains an EXTERNAL link ${l.slice(0, 60)}. Policy pages link only to the venture's own routes; an outbound link is a claim about somebody else's page.`));
  // The venture's OWN site is not an outbound claim -- the pages name it on purpose. Anything
  // else is a link to somebody else's page, which a policy document should not carry.
  const bare = (text.match(/(?<![(\w])https?:\/\/[^\s)]+/g) || [])
    .filter((u) => !ownHost || !u.replace(/[.,;:]+$/, "").toLowerCase().startsWith(ownHost.toLowerCase()));
  for (const b of bare)
    out.push(finding("value", page, "-", "FAIL", `the rendered page contains a bare URL ${b.slice(0, 60)} outside a link. If it is evidence, it belongs in the run record, not in the prose.`));

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

export function completenessLint(page, text, required, facts, bodies, scenarios, templateClauses) {
  const out = [];
  const emitted = new Set(markersIn(text));

  // A page that emitted NOTHING is its own, louder finding, and it is checked BEFORE the
  // missing-list early return. It used to sit after it, which made it unreachable for exactly
  // the page it was written for -- an authored page with no required-clause entry rendered to
  // a heading and one line of prose and reported a single WARN.
  if (emitted.size === 0)
    out.push(finding("completeness", page, "-", "FAIL", "the page emitted ZERO clauses"));

  // PRESENCE IS MEASURED IN BYTES, NOT IN MARKERS. A clause emptied to
  // `{{#clause id=X}}{{/clause}}` still emits its marker, so the whole liability limitation
  // could disappear from a page while completeness reported it present. Found by an adversarial
  // pass, ranked critical, and it is the purest form of the failure this lint exists to catch:
  // provenance perfect, page empty.
  const MIN_BODY = 40;
  if (bodies) {
    for (const [id, len] of Object.entries(bodies)) {
      if (len < MIN_BODY)
        out.push(finding("completeness", page, id, "FAIL", `this clause rendered ${len} byte(s) of body. A marker is not a clause -- presence is measured in bytes, or an emptied block passes as present.`));
    }
  }

  const rows = required[page];
  if (!rows) {
    out.push(finding("completeness", page, "-", "FAIL", "this page has a template but no required-clause list, so nothing checks what it must contain. An authored page with no list is a data gap, not a warning."));
    // NOT an early return. It used to be, which meant a page missing its required-clause list
    // ALSO silently skipped the answerability check below -- one data gap disabling two
    // different classes of check, and the second one invisibly.
  } else {
    for (const row of rows) {
      // conditionHolds fails CLOSED in the renderer (clause not emitted) and used to fail OPEN
      // here (check skipped), so a one-character typo in a `when` field name silently disabled a
      // mandatory-clause check. "Condition is false" and "condition is unevaluable" are now
      // different answers.
      if (row.when) {
        const verdict = conditionVerdict(facts, row.when);
        if (verdict === null) {
          out.push(finding("completeness", page, row.id, "FAIL", `the required-clause condition "${row.when}" names a field that does not exist, or has no "=". An unevaluable condition disables the check it guards.`));
          continue;
        }
        if (verdict === false) continue;
      }
      if (!emitted.has(row.id))
        out.push(finding("completeness", page, row.id, "FAIL", `mandatory clause missing${row.when ? ` (required when ${row.when})` : ""}. Provenance alone cannot pass an empty page.`));
    }
  }

  // ---- UNANSWERED: the class that fails for INSUFFICIENCY (ADR-1009 / LEG-I) ----
  //
  // Everything above this line fails for rule-breaking. A page can satisfy all of it and still
  // leave the reader without the answer they came for, and `arc-design-cycle3` 2026-07-30 is the
  // scar: "PASS was defined as an absence, so compliant characterless work passed five
  // consecutive runs and no part of the loop could report that it was simply not good enough."
  // This is the branch that fails for insufficiency.
  if (!Array.isArray(scenarios)) {
    out.push(finding("completeness", page, "-", "FAIL", "the scenario set is missing or unreadable, so the answerability check is disabled. A gate that cannot load its own pass condition reports nothing and looks identical to a clean run."));
    return out;
  }

  for (const s of scenarios) {
    if (s.page !== page) continue;

    // A malformed guard is a FAILURE, never a skip. `conditionVerdict` returns null for
    // "unevaluable", and treating that as "not applicable" is precisely how a typo disables a
    // mandatory check -- fixed-defect-list row 11, found on the clause path, and the reason this
    // path was written to answer it the same way from the start rather than inherit the bug.
    if (s.when) {
      const verdict = conditionVerdict(facts, s.when);
      if (verdict === null) {
        out.push(finding("completeness", page, s.id, "FAIL", `the scenario guard "${s.when}" names a field that does not exist, or has no "=". An unevaluable guard silently excuses the scenario it guards.`));
        continue;
      }
      if (verdict === false) continue; // genuinely not applicable to this venture
    }

    const ids = Array.isArray(s.answered_by) ? s.answered_by : [];
    if (!ids.length) {
      out.push(finding("completeness", page, s.id, "FAIL", "this scenario names no answering clause, so it can never fail. A row that cannot fail is not a test."));
      continue;
    }

    for (const id of ids) {
      // ORPHANED is separated from UNANSWERED on purpose: they have different repairs. Orphaned
      // means a template edit deleted or renamed the clause out from under the scenario, and the
      // fix is in the template or the set. Unanswered means the clause exists but this venture's
      // page did not get it, and the fix is a guard or a facts value.
      // `templateClauses` is the array of DECLARATIONS trace-lint takes -- `{id, when}` records,
      // not a Set of ids. Reading it as a Set is silently wrong rather than loudly wrong on any
      // shape that happens to expose `.has`, so the id lookup is written against the real shape.
      const declared = Array.isArray(templateClauses) ? templateClauses.some((d) => d.id === id) : true;
      if (!declared) {
        out.push(finding("completeness", page, s.id, "FAIL", `ORPHANED scenario: no template block on this page declares "${id}" any more. A template edit that orphans a scenario is a failure, not a silent pass (ADR-1009).`));
        continue;
      }
      if (!emitted.has(id))
        out.push(finding("completeness", page, s.id, "FAIL", `UNANSWERED: "${s.question}" -- the clause that answers it (${id}) is not on this page.`));
    }
  }

  return out;
}

/**
 * CROSS-PAGE consistency (ADR-1013), run once over every rendered page.
 *
 * Every other lint here reads a single page's bytes, and that is where the pages were worst:
 * three reader panels, blind to each other, each put a cross-page contradiction in their top
 * four findings. Pricing, terms and refunds stated three different price-rise rules; shipping
 * granted a refund entitlement the refunds page refused.
 *
 * The check is deliberately narrow, because a general prose-contradiction detector is not a
 * thing that exists. A CLAIM is a numeric commitment stated on more than one page; wherever a
 * listed page makes it, the rendered value of the SAME facts field must appear on it.
 *
 * That catches the vague half, which is the half that actually bit: pricing said "we tell you
 * before your next payment" -- no number, so nothing could disagree with it numerically, and it
 * was the page read before paying.
 */
export function crossPageLint(rendered, claims, facts) {
  const out = [];
  if (!claims || !Array.isArray(claims.claims)) {
    out.push(finding("consistency", "-", "-", "FAIL", "cross-page-claims.json is missing or unreadable, so no cross-page check ran at all"));
    return out;
  }
  const byPage = new Map(rendered.map((p) => [p.page, p.text]));

  for (const claim of claims.claims) {
    if (claim.when) {
      const verdict = conditionVerdict(facts, claim.when);
      // Same three-answer rule as everywhere else in this file: unevaluable is a FAILURE, not a
      // skip. A guard nobody can evaluate excuses the claim it guards, silently.
      if (verdict === null) {
        out.push(finding("consistency", "-", claim.id, "FAIL", `the claim guard "${claim.when}" names a field that does not exist, or has no "=".`));
        continue;
      }
      if (verdict === false) continue;
    }

    const value = getPath(facts, claim.fact);
    if (value === undefined || value === null || value === "") {
      out.push(finding("consistency", "-", claim.id, "FAIL", `this claim is anchored to "${claim.fact}", which the facts do not set. A cross-page check with nothing to compare passes every page and proves nothing.`));
      continue;
    }
    const needle = String(value);

    for (const page of claim.pages) {
      const text = byPage.get(page);
      if (text === undefined) {
        out.push(finding("consistency", page, claim.id, "FAIL", `this claim names page "${page}", which the pinned set does not render.`));
        continue;
      }
      // Word-bounded so 14 does not match inside 140, and so a page stating the right commitment
      // with the wrong number is caught rather than passing on a substring.
      const hit = new RegExp(`(?<![0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![0-9])`).test(text);
      if (!hit)
        out.push(finding("consistency", page, claim.id, "FAIL", `this page is required to state ${claim.what} as a number, and "${needle}" (from ${claim.fact}) does not appear on it. Another page states it; a reader who reads only this one gets the vaguer promise.`));
    }
  }
  return out;
}

/**
 * Whole-SET answerability checks, run once rather than per page.
 *
 * A scenario pointing at a page that no longer renders is invisible to the per-page pass -- the
 * loop that would have caught it never runs for a page that does not exist. That is the same
 * shape as the required-clause early return above: the check is disabled by the very condition
 * it exists to detect.
 */
export function scenarioSetLint(scenarios, renderedPageIds) {
  const out = [];
  if (!Array.isArray(scenarios)) {
    out.push(finding("completeness", "-", "-", "FAIL", "the scenario set is missing or unreadable"));
    return out;
  }
  const have = new Set(renderedPageIds);
  const seen = new Set();
  for (const s of scenarios) {
    if (seen.has(s.id)) out.push(finding("completeness", "-", s.id, "FAIL", "duplicate scenario id: two rows with one id means one of them can never be reported separately"));
    seen.add(s.id);
    if (!have.has(s.page))
      out.push(finding("completeness", s.page ?? "-", s.id, "FAIL", `this scenario names page "${s.page}", which the pinned set does not render. A scenario aimed at a page that does not exist can never fail, so it silently stops being a check.`));
  }
  return out;
}

export function runAllLints({ page, text, facts, clauseMap, required, denylist, templateClauses, bodies, ownHost, scenarios }) {
  return [
    ...valueLint(page, text, denylist, ownHost),
    ...traceLint(page, text, clauseMap, facts, templateClauses),
    ...completenessLint(page, text, required, facts, bodies, scenarios, templateClauses),
  ];
}

/** Does this finding set move the exit code? Only a FAIL in a group promoted OUT of trial. */
export function findingsAreFatal(findings) {
  return findings.some((f) => f.level === "FAIL" && !TRIAL.has(f.group));
}
