/**
 * The clause template renderer -- a pure function, and deliberately not a language.
 *
 * Two constructs, no expressions, no loops the author controls, no conditionals beyond a
 * single field=value equality. Anything cleverer would make trace-lint an NLP project instead
 * of a lookup (ADR-1009's rabbit hole), and would put arbitrary evaluation between a facts
 * file and a sentence a stranger relies on.
 *
 *   {{#clause id=REFUND.WINDOW when=payment_model=gateway}} ... {{/clause}}
 *   {{ facts.refund_window_days }}      a dotted path, HTML-escaped
 *   {{ label.data_categories }}         enum values rendered as their WORDS, never the token
 *   {{ list.sub_processors }}           a free-text array as a bullet list
 *   {{ window.ack_hours }}              the strictest in-force grievance window
 *
 * Every emitted clause writes a marker into the OUTPUT, so trace-lint reads rendered bytes and
 * never the template source. A lint that reads the source is checking the author's intent; the
 * bytes are what a customer gets.
 */

export class TemplateError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
  }
}

import { getPath, condValue, conditionHolds } from "./schema.mjs";

const OPEN = /\{\{#clause\s+id=([A-Z][A-Z0-9_.]*)(?:\s+when=([A-Za-z0-9_.]+=[A-Za-z0-9_-]+))?\s*\}\}/;
const CLOSE = "{{/clause}}";

/**
 * MDX-safe escaping. The FREE-TEXT charset already refuses < > { } [ ] | \ and backtick, so
 * this is the second layer, not the only one -- and `&` IS allowed in a name ("Rao & Sons"),
 * so it genuinely has to be escaped here.
 *
 * WHAT THIS TRANSFORM DESTROYS, stated because a transform added for one property has twice
 * silently deleted another (retro-log 2026-07-30, design-render.sh pinning Arial for hash
 * stability and judging every design with its typography deleted):
 *   - it makes `&` render as `&` and not as the start of an entity: no legal signal lost;
 *   - it does NOT alter letters, digits, punctuation, spacing or word order, so nothing that
 *     carries legal meaning is touched;
 *   - it is applied to INTERPOLATED VALUES ONLY, never to the authored template prose, so a
 *     drafted sentence is never silently reshaped.
 */
export function escapeValue(s) {
  return String(s)
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split("{").join("&#123;")
    .split("}").join("&#125;");
}

function bulletList(items) {
  if (!items.length) return "_none_";
  return items.map((t) => "- " + t).join("\n");
}

/** Strictest ack/resolve windows across instruments already in force on `asOf`. */
export function strictestWindow(rows, asOf) {
  const live = rows.filter((r) => String(r.in_force_from) <= String(asOf));
  const min = (key) => {
    // A null means the instrument sets no window. It is NOT a zero, and folding it to one
    // would print the tightest possible promise from an instrument that made none.
    const vals = live.map((r) => r[key]).filter((v) => typeof v === "number");
    return vals.length ? Math.min(...vals) : null;
  };
  return {
    ack_hours: min("ack_hours"),
    resolve_days: min("resolve_days"),
    instruments: live.map((r) => r.instrument),
    pending: rows.filter((r) => String(r.in_force_from) > String(asOf)).map((r) => `${r.instrument} (from ${r.in_force_from})`),
  };
}

function resolveToken(expr, ctx) {
  const { facts, vocab, windows } = ctx;

  if (expr.startsWith("facts.")) {
    const v = getPath(facts, expr.slice(6));
    if (v === undefined || v === null) throw new TemplateError("UNRESOLVED_FACT", `${expr} is not set in the facts file`);
    if (Array.isArray(v) || typeof v === "object") throw new TemplateError("NOT_A_SCALAR", `${expr} is a list or a mapping; use label. or list. for those`);
    ctx.used.add(expr);
    return escapeValue(condValue(v));
  }

  if (expr.startsWith("label.")) {
    const field = expr.slice(6);
    const v = getPath(facts, field);
    if (v === undefined || v === null) throw new TemplateError("UNRESOLVED_FACT", `${expr} is not set in the facts file`);
    const table = (vocab.labels || {})[field];
    if (!table) throw new TemplateError("NO_LABEL_TABLE", `vocab.json has no labels for "${field}". A value with no words is a token printed at a customer.`);
    ctx.used.add(expr);
    if (Array.isArray(v)) {
      return bulletList(v.map((item) => {
        const w = table[item];
        if (!w) throw new TemplateError("NO_LABEL", `vocab.json has no label for ${field}.${item}`);
        return escapeValue(w);
      }));
    }
    const w = table[v];
    if (!w) throw new TemplateError("NO_LABEL", `vocab.json has no label for ${field}.${v}`);
    return escapeValue(w);
  }

  if (expr.startsWith("list.")) {
    const v = getPath(facts, expr.slice(5));
    if (!Array.isArray(v)) throw new TemplateError("NOT_A_LIST", `${expr} is not a list`);
    ctx.used.add(expr);
    return bulletList(v.map(escapeValue));
  }

  if (expr === "table.pricing") {
    // The one paired rendering in the set. Parallel arrays are the shape ADR-1012 chose, and
    // this is the single place they are zipped -- so a length mismatch has exactly one way to
    // reach a page, and the schema has already refused it before we get here. The belt is kept
    // anyway: a renderer that trusts an upstream check is a renderer that ships whatever the
    // check missed.
    const names = getPath(facts, "pricing.plan_names");
    const amounts = getPath(facts, "pricing.plan_amounts_inr");
    const period = getPath(facts, "pricing.period");
    if (!Array.isArray(names) || !Array.isArray(amounts))
      throw new TemplateError("NOT_A_LIST", "pricing.plan_names and pricing.plan_amounts_inr must both be lists");
    if (names.length !== amounts.length)
      throw new TemplateError("PLAN_MISMATCH", `${names.length} plan name(s) against ${amounts.length} amount(s); the page will not pair a price with the wrong plan`);
    const periodLabel = ((vocab.labels || {})["pricing.period"] || {})[period];
    if (!periodLabel) throw new TemplateError("NO_LABEL", `vocab.json has no label for pricing.period.${period}`);
    ctx.used.add(expr);
    return names
      .map((n, i) => `- **${escapeValue(n)}** ${escapeValue(String(amounts[i]))} INR ${escapeValue(periodLabel)}`)
      .join("\n");
  }

  if (expr.startsWith("window.")) {
    const key = expr.slice(7);
    if (!(key in windows)) throw new TemplateError("UNKNOWN_WINDOW", `${expr} is not one of ${Object.keys(windows).join(", ")}`);
    const v = windows[key];
    if (v === null || (Array.isArray(v) && v.length === 0))
      throw new TemplateError("NO_WINDOW", `${expr} has no in-force value. The page may not print a window no instrument sets.`);
    ctx.used.add(expr);
    return Array.isArray(v) ? escapeValue(v.join("; ")) : escapeValue(String(v));
  }

  throw new TemplateError("UNKNOWN_NAMESPACE", `"${expr}" is not facts. label. list. or window.`);
}

/**
 * Render one template. Returns { body, clauses, skipped } where `clauses` are the ids actually
 * emitted, in order.
 */
export function renderTemplate(source, ctx) {
  const out = [];
  const clauses = [];
  const skipped = [];
  let rest = source;

  while (rest.length) {
    const m = rest.match(OPEN);
    if (!m) {
      if (rest.includes(CLOSE)) throw new TemplateError("UNBALANCED_CLAUSE", "a {{/clause}} appears with no matching {{#clause}}");
      out.push(rest);
      break;
    }
    out.push(rest.slice(0, m.index));
    const afterOpen = rest.slice(m.index + m[0].length);
    const closeAt = afterOpen.indexOf(CLOSE);
    if (closeAt < 0) throw new TemplateError("UNBALANCED_CLAUSE", `clause ${m[1]} is opened and never closed`);
    const inner = afterOpen.slice(0, closeAt);
    if (OPEN.test(inner)) throw new TemplateError("NESTED_CLAUSE", `clause ${m[1]} contains another clause; clauses do not nest`);

    const id = m[1];
    const when = m[2] || null;
    if (clauses.includes(id)) throw new TemplateError("DUPLICATE_CLAUSE", `clause ${id} appears twice in one page`);

    if (conditionHolds(ctx.facts, when)) {
      const bodyText = inner.replace(/\{\{\s*([^#/}][^}]*?)\s*\}\}/g, (_, expr) => resolveToken(expr.trim(), ctx));
      clauses.push(id);
      out.push(`<!-- clause:${id} -->\n${bodyText.trim()}\n<!-- /clause:${id} -->\n`);
    } else {
      skipped.push({ id, when });
    }
    rest = afterOpen.slice(closeAt + CLOSE.length);
  }

  let body = out.join("");
  // Collapse the blank-line runs that dropping a clause leaves behind, so a `none` render and
  // a `gateway` render differ in their CLAUSES and not in their whitespace. Deterministic
  // output must not encode which branches were skipped.
  body = body.split("\r\n").join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  return { body, clauses, skipped };
}

/** The transforms this renderer applies, named so a reader can check what they destroy. */
export const TRANSFORMS = [
  "crlf-to-lf",
  "nfc-normalise-on-hash",
  "html-escape-interpolated-values",
  "collapse-blank-line-runs",
];
