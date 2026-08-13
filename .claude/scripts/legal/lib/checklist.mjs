/**
 * The launch checklist (Phase 02).
 *
 * Its job is to tell an operator what a payment provider will look for before it activates them,
 * and — more importantly — to be honest about which of those things anyone has actually checked.
 *
 * FOUR OUTCOMES, and the fourth is the point:
 *
 *   PASS            checked, and it holds
 *   FAIL            checked, and it does not
 *   NOT-CHECKED     nobody has looked yet
 *   NOT-APPLICABLE  it does not apply here, WITH the reason
 *
 * `arc-memory` 2026-08-12 shipped a scanner that could not tell SCANNED CLEAN from COULD NOT
 * SCAN, and that is the failure this enumeration exists to prevent: an unchecked row and a clean
 * row are the one thing a broken check and a healthy one otherwise agree on. So NOT-CHECKED is a
 * first-class answer here, not an error and not a blank.
 *
 * **A BLANK row is a FAILURE OF THE RENDERER**, never an outcome. A row that renders with no
 * outcome at all is indistinguishable from a row nobody wrote, which is worse than either.
 *
 * ALL ROWS ARE MANUAL in v1. The URL-fetch probe arm is designated cut #1, taken at kickoff
 * rather than left to fire mid-phase. That means every outcome here is RECORDED EVIDENCE, and
 * the renderer's contract is to present it faithfully -- including presenting its absence.
 */

export const OUTCOMES = ["PASS", "FAIL", "NOT-CHECKED", "NOT-APPLICABLE"];

/**
 * Build the checklist rows. Nothing is hardcoded: every row comes from `provider-pages.json`,
 * and the renderer's only job is to decide applicability and carry recorded evidence in.
 *
 * `evidence` maps a row id to `{ outcome, note }` -- what a human recorded. Absent means
 * NOT-CHECKED, which is the honest default and the one the cut made necessary.
 */
export function buildChecklist({ providerPages, facts, routes, evidence = {} }) {
  const errs = [];
  const rows = [];

  if (!providerPages || !Array.isArray(providerPages.rows) || !providerPages.rows.length) {
    errs.push("provider-pages.json holds no rows. A checklist with no rows renders clean and checks nothing.");
    return { rows, errs };
  }

  const isMerchant = facts.payment_model !== "none";

  for (const row of providerPages.rows) {
    // A row with no evidence LINK fails rather than rendering. The lane's whole posture is that a
    // legal or commercial requirement asserted without a source is exactly what it refuses to
    // print, and a checklist telling an operator "the provider requires this" is such an
    // assertion.
    if (!row.source_url) {
      errs.push(`checklist row "${row.id}" has no source_url. A requirement stated with no evidence link is the thing this product exists not to print.`);
      continue;
    }
    if (!row.id || !row.what) {
      errs.push(`a checklist row is missing an id or a description: ${JSON.stringify(row).slice(0, 80)}`);
      continue;
    }

    const recorded = evidence[row.id];
    let outcome;
    let note;

    if (!isMerchant) {
      // ADR-1011: where the operator is not the merchant there is no activation to pass, and
      // rendering these green would tell them they had cleared a gate they were never at.
      outcome = "NOT-APPLICABLE";
      note = `this venture takes no payments through a provider (payment_model: none), so there is no provider activation to satisfy. The page itself is still published; only the activation requirement is inapplicable.`;
    } else if (recorded && OUTCOMES.includes(recorded.outcome)) {
      outcome = recorded.outcome;
      note = recorded.note || "";
      if (outcome === "NOT-APPLICABLE" && !note)
        errs.push(`row "${row.id}" is NOT-APPLICABLE with no reason. "It does not apply" without a reason is unfalsifiable, and it is the outcome an operator would reach for to clear a row they had not done.`);
    } else if (recorded) {
      errs.push(`row "${row.id}" records outcome "${recorded.outcome}", which is not one of ${OUTCOMES.join(" / ")}`);
      continue;
    } else {
      outcome = "NOT-CHECKED";
      note = "no evidence recorded yet. All rows are manual in v1 (probe automation cut at kickoff), so this stays NOT-CHECKED until a human records what they saw.";
    }

    const built = {
      id: row.id,
      kind: row.kind,
      page: row.page,
      route: routes?.[row.page] ?? null,
      what: row.what,
      condition: row.condition ?? null,
      outcome,
      note,
      source_url: row.source_url,
    };

    // The blank-row guard, applied to the row this function just built rather than to the input.
    // Checking the input would prove the data file is well-formed and say nothing about what the
    // renderer did with it.
    if (!built.outcome || !OUTCOMES.includes(built.outcome))
      errs.push(`row "${row.id}" rendered with no outcome. A blank row is a renderer failure, never an outcome -- it is indistinguishable from a row nobody wrote.`);

    rows.push(built);
  }

  const required = rows.filter((r) => r.kind === "provider-required").length;
  const conditional = rows.filter((r) => r.kind === "provider-conditional").length;
  if (required !== 5)
    errs.push(`expected 5 provider-required rows and built ${required}. ADR-1001 pinned that count against a verified provider page-list; a drift here means the list moved or a row was dropped silently.`);
  if (conditional !== 2)
    errs.push(`expected 2 provider-conditional rows and built ${conditional} (ADR-1001).`);

  return { rows, errs };
}

/** Render as markdown. Every row shows its outcome and its source; none can render empty. */
export function renderChecklist({ rows, venture }) {
  const out = [
    `# Launch checklist — ${venture}`,
    "",
    "Every row is MANUAL. `NOT-CHECKED` means nobody has looked yet, and it is a real answer:",
    "an unchecked row and a clean row are the one thing a broken check and a healthy one agree on.",
    "",
    "| # | requirement | page | outcome | evidence / reason | source |",
    "|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const what = r.condition ? `${r.what} _(only when ${r.condition})_` : r.what;
    out.push(`| ${r.id} | ${what} | ${r.route ?? r.page} | **${r.outcome}** | ${r.note || "—"} | ${r.source_url} |`);
  }
  const counts = {};
  for (const r of rows) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  out.push("", `${rows.length} row(s): ` + OUTCOMES.map((o) => `${counts[o] ?? 0} ${o}`).join(" · "));
  return out.join("\n") + "\n";
}
