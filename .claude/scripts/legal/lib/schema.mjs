/**
 * The facts schema: three risk tiers, every field in exactly one (ADR-1002).
 *
 *   ENUM / INT / BOOL / DATE -- safe. Closed vocabulary, parsed not matched.
 *   FORMAT                   -- low risk. An ANCHORED regex, with the near-miss failing closed.
 *   FREE-TEXT                -- dangerous. Length- and charset-bounded here, and denylisted
 *                               again on the RENDERED bytes, because an input-side check alone
 *                               is defeated by any encoding the renderer later undoes.
 *
 * A violation here is a HARD error (exit 2): these are the conditions under which the render
 * cannot produce trustworthy bytes at all. The soft, TRIAL-level findings live in lints.mjs
 * and run on the output.
 */

// Allowed characters in a FREE-TEXT value. Deliberately small. Everything a policy page
// legitimately needs for a name, a trade name or an address -- and nothing that can open a
// tag, a template expression, a shell word or a markdown link.
const FREETEXT_OK = /^[A-Za-z0-9 .,'\-&/()@:#]+$/;
// `[ ]{2,}`, never ` {2,}` and never `{2,}`. A quantifier with nothing before it is not a
// syntax error in JS -- Annex B reads a bare `{2,}` as the LITERAL text, so the regex compiles,
// matches nothing, and the check reports clean forever. The character class makes the target
// of the quantifier impossible to misread.
const FREETEXT_BAD_RUN = /[ ]{2,}/;
const FREETEXT_URLISH = /(https?:\/\/|www\.)/i;

export const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const PHONE = /^\+?[0-9 -]{6,20}$/;
export const HTTPS_URL = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[A-Za-z0-9._~\-/]*)?$/;
export const GSTIN = /^[0-9A-Z]{15}$/;
export const ROUTE = /^\/[a-z0-9/-]{1,64}$/;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const FIELDS = [
  { path: "venture", tier: "FORMAT", type: "format", pattern: /^[a-z][a-z0-9-]{0,63}$/, required: true },
  { path: "site_url", tier: "FORMAT", type: "format", pattern: HTTPS_URL, required: true },
  { path: "effective_date", tier: "DATE", type: "date", required: true },

  { path: "operator.type", tier: "ENUM", type: "enum", vocab: "operator_type", required: true },
  { path: "operator.legal_name", tier: "FREE-TEXT", type: "freetext", max: 80, required: true },
  { path: "operator.trade_name", tier: "FREE-TEXT", type: "freetext", max: 80, required: true },
  { path: "geographic_address", tier: "FREE-TEXT", type: "freetext", max: 200, required: true },

  { path: "support.email", tier: "FORMAT", type: "format", pattern: EMAIL, required: true },
  { path: "support.phone", tier: "FORMAT", type: "format", pattern: PHONE, required: true },

  { path: "grievance.name", tier: "FREE-TEXT", type: "freetext", max: 80, required: true },
  { path: "grievance.email", tier: "FORMAT", type: "format", pattern: EMAIL, required: true },
  { path: "grievance.address", tier: "FREE-TEXT", type: "freetext", max: 200, required: true },

  { path: "data_categories", tier: "ENUM", type: "enum[]", vocab: "data_categories", required: true, minItems: 1 },
  { path: "purposes", tier: "ENUM", type: "enum[]", vocab: "purposes", required: true, minItems: 1 },
  { path: "analytics", tier: "ENUM", type: "enum[]", vocab: "analytics", required: true, minItems: 1 },
  { path: "retention", tier: "ENUM", type: "enum", vocab: "retention", required: true },
  { path: "deletion_route.mailbox", tier: "FORMAT", type: "format", pattern: EMAIL, required: true },

  { path: "payment_model", tier: "ENUM", type: "enum", vocab: "payment_model", required: true },
  { path: "payment_provider", tier: "ENUM", type: "enum", vocab: "payment_provider", required: true },
  { path: "refund_window_days", tier: "INT", type: "int", min: 0, max: 365, required: true },

  { path: "gst_registered", tier: "BOOL", type: "bool", required: true },
  { path: "gstin", tier: "FORMAT", type: "format", pattern: GSTIN, requiredWhen: "gst_registered=true", forbiddenWhen: "gst_registered=false" },

  { path: "stores_third_party_client_data", tier: "BOOL", type: "bool", required: true },
  { path: "sub_processors", tier: "FREE-TEXT", type: "freetext[]", max: 80, requiredWhen: "stores_third_party_client_data=true", minItemsWhen: 1 },

  { path: "routes", tier: "FORMAT", type: "routes", required: false },
];

export function getPath(obj, dotted) {
  let cur = obj;
  for (const part of dotted.split(".")) {
    if (cur === null || typeof cur !== "object" || !Object.prototype.hasOwnProperty.call(cur, part)) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** Render a fact value as the exact string a `when=field=value` condition compares against. */
export function condValue(v) {
  if (v === true) return "true";
  if (v === false) return "false";
  if (v === null || v === undefined) return "";
  return String(v);
}

export function conditionHolds(facts, cond) {
  if (!cond) return true;
  const eq = cond.indexOf("=");
  if (eq < 0) return false;
  const field = cond.slice(0, eq).trim();
  const want = cond.slice(eq + 1).trim();
  return condValue(getPath(facts, field)) === want;
}

function checkFreeText(value, field, errs) {
  if (typeof value !== "string")
    return errs.push(`${field.path}: must be a quoted string (FREE-TEXT tier)`);
  if (value.length === 0) return errs.push(`${field.path}: is empty`);
  if (value.length > field.max) return errs.push(`${field.path}: is ${value.length} characters, over the ${field.max} limit for this field`);
  if (!FREETEXT_OK.test(value))
    return errs.push(`${field.path}: contains a character outside the FREE-TEXT set (letters, digits, space, and . , ' - & / ( ) @ : #). Angle brackets, braces, brackets, pipes, backslashes and backticks are refused because each of them opens something.`);
  if (FREETEXT_BAD_RUN.test(value)) return errs.push(`${field.path}: contains a run of two or more spaces`);
  if (FREETEXT_URLISH.test(value)) return errs.push(`${field.path}: contains a URL. A link smuggled into a name field becomes a link in a sentence.`);
}

/**
 * Validate a parsed facts object. Returns an array of human-readable error strings; empty
 * means valid. Never throws on bad DATA -- only the caller decides what a failure means.
 */
export function validateFacts(facts, vocab) {
  const errs = [];
  if (facts === null || typeof facts !== "object" || Array.isArray(facts)) {
    errs.push("the facts file is not a mapping");
    return errs;
  }

  const known = new Set();
  for (const f of FIELDS) known.add(f.path.split(".")[0]);
  for (const k of Object.keys(facts)) {
    if (!known.has(k)) errs.push(`unknown top-level field "${k}". Unknown keys are refused, never ignored -- a typo in a field name would otherwise silently drop a legal fact.`);
  }

  for (const field of FIELDS) {
    const value = getPath(facts, field.path);
    const requiredHere =
      field.required === true ||
      (field.requiredWhen && conditionHolds(facts, field.requiredWhen));

    if (value === undefined || value === null) {
      if (requiredHere) errs.push(`${field.path}: required${field.requiredWhen ? ` when ${field.requiredWhen}` : ""}, and it is missing`);
      continue;
    }
    if (field.forbiddenWhen && conditionHolds(facts, field.forbiddenWhen)) {
      errs.push(`${field.path}: must NOT be set when ${field.forbiddenWhen}`);
      continue;
    }

    switch (field.type) {
      case "enum": {
        const allowed = vocab[field.vocab] || [];
        if (typeof value !== "string" || !allowed.includes(value))
          errs.push(`${field.path}: "${String(value)}" is not one of ${allowed.join(" / ")}`);
        break;
      }
      case "enum[]": {
        const allowed = vocab[field.vocab] || [];
        if (!Array.isArray(value)) { errs.push(`${field.path}: must be a \`- \` sequence`); break; }
        if (field.minItems && value.length < field.minItems) errs.push(`${field.path}: needs at least ${field.minItems} entry`);
        const seen = new Set();
        for (const item of value) {
          if (typeof item !== "string" || !allowed.includes(item))
            errs.push(`${field.path}: "${String(item)}" is not one of ${allowed.join(" / ")}`);
          if (seen.has(item)) errs.push(`${field.path}: "${String(item)}" is listed twice`);
          seen.add(item);
        }
        break;
      }
      case "freetext[]": {
        if (!Array.isArray(value)) { errs.push(`${field.path}: must be a \`- \` sequence`); break; }
        if (requiredHere && field.minItemsWhen && value.length < field.minItemsWhen)
          errs.push(`${field.path}: is empty, but ${field.requiredWhen} means the page must name who else touches the data. An empty list renders a dangling sentence, which is worse than no sentence.`);
        value.forEach((item, i) => checkFreeText(item, { ...field, path: `${field.path}[${i}]` }, errs));
        break;
      }
      case "freetext":
        checkFreeText(value, field, errs);
        break;
      case "format":
        if (typeof value !== "string" || !field.pattern.test(value))
          errs.push(`${field.path}: "${String(value)}" does not match ${field.pattern}`);
        break;
      case "int":
        if (typeof value !== "number" || !Number.isInteger(value))
          errs.push(`${field.path}: must be a bare integer (a quoted "12" is text, not a number)`);
        else if (value < field.min || value > field.max)
          errs.push(`${field.path}: ${value} is outside ${field.min}..${field.max}`);
        break;
      case "bool":
        if (typeof value !== "boolean") errs.push(`${field.path}: must be bare true or false`);
        break;
      case "date":
        if (typeof value !== "string" || !ISO_DATE.test(value)) { errs.push(`${field.path}: must be an ISO date, YYYY-MM-DD`); break; }
        {
          const [y, m, d] = value.split("-").map(Number);
          const dt = new Date(Date.UTC(y, m - 1, d));
          if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d)
            errs.push(`${field.path}: "${value}" is not a real calendar date`);
        }
        break;
      case "routes":
        if (typeof value !== "object" || Array.isArray(value)) { errs.push(`${field.path}: must be a mapping of page id to path`); break; }
        for (const [page, route] of Object.entries(value)) {
          if (typeof route !== "string" || !ROUTE.test(route))
            errs.push(`routes.${page}: "${String(route)}" is not an absolute lowercase path (${ROUTE})`);
        }
        break;
      default:
        errs.push(`${field.path}: no validator for type ${field.type}`);
    }
  }

  return errs;
}
