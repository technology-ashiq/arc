// records.mjs -- the Records tab's decisions (face v3 Cycle 17 P01; REQ-02, ADR-1365).
//
// A fold declares its long lists as collections on `records`; the frame draws every declared collection on one
// Records tab through one shared table, so a long room opens short. What a declaration may say, which rows a search
// keeps and how many rows are drawn are decided here, where node can check them with no install.

/**
 * @typedef {{ key: string, label: string }} RecordColumn
 * @typedef {{ code: string, human: string }} RecordRefusal
 * @typedef {{
 *   key: string, title: string, columns: RecordColumn[], search: string[], cap: number,
 *   rows: Record<string, unknown>[], isReading: boolean, isRefused: boolean, refusal: RecordRefusal,
 *   toneKey?: string,
 * }} RecordCollection   toneKey names a row field drawn as the row's `data-record-tone`, never as a column
 */

/** "show all" draws at most this many rows; the rest are named, never drawn (a 5,000-row read stays one screen of DOM). */
export const RECORDS_ALL_MAX = 200;

/** The collections a folded room declares: none when the fold says nothing. @param {unknown} f @returns {RecordCollection[]} */
export function recordCollections(f) {
  const r = f !== null && typeof f === "object" ? /** @type {any} */ (f).records : undefined;
  return Array.isArray(r) ? r : [];
}

/**
 * What is wrong with one declaration -- empty when it can be drawn. A column its rows lack, a cap that draws nothing
 * and a search over a field no column shows are each named, because each one draws a table that quietly lies.
 * @param {RecordCollection} c @returns {string[]}
 */
export function recordsShapeProblems(c) {
  const name = c && typeof c.key === "string" && c.key ? c.key : "(unnamed)";
  /** @type {string[]} */
  const out = [];
  if (!c || typeof c !== "object") return [`collection ${name} is not an object`];
  const cols = Array.isArray(c.columns) ? c.columns.map((x) => (x && typeof x.key === "string" ? x.key : "")) : [];
  if (cols.length === 0) out.push(`collection ${name} declares no columns`);
  if (!Number.isInteger(c.cap) || c.cap <= 0) out.push(`cap ${String(c.cap)} in ${name} draws nothing -- a cap is a whole number above 0`);
  for (const s of Array.isArray(c.search) ? c.search : []) if (!cols.includes(s)) out.push(`search field ${String(s)} in ${name} is not a column`);
  const rows = Array.isArray(c.rows) ? c.rows : [];
  for (const col of cols) {
    if (rows.some((r) => !r || typeof r !== "object" || !Object.hasOwn(r, col))) { out.push(`unknown column ${col} in ${name}`); }
  }
  return out;
}

/** A cell as text: the table never draws `[object Object]`. @param {unknown} v @returns {string} */
export function cellText(v) {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
}

/**
 * The rows a search keeps: a literal, case-insensitive substring over the declared fields. The query is never a
 * pattern, so `.*` or `(` matches itself and nothing throws.
 * @param {readonly Record<string, unknown>[]} rows @param {string} query @param {readonly string[]} fields
 */
export function recordsMatch(rows, query, fields) {
  const q = String(query ?? "").trim().toLowerCase();
  if (q === "") return [...rows];
  return rows.filter((r) => fields.some((k) => cellText(r[k]).toLowerCase().includes(q)));
}

/**
 * The rows to draw: `cap` of them, or with "show all" at most RECORDS_ALL_MAX, and the remainder named.
 * @param {readonly Record<string, unknown>[]} rows @param {number} cap @param {boolean} showAll
 * @returns {{ rows: Record<string, unknown>[], hidden: number, more: string }}
 */
export function recordsWindow(rows, cap, showAll) {
  const limit = showAll ? RECORDS_ALL_MAX : cap;
  const drawn = rows.slice(0, limit);
  const hidden = rows.length - drawn.length;
  const more = hidden <= 0 ? "" : showAll ? `${hidden} more -- narrow the search` : `show all ${rows.length}`;
  return { rows: drawn, hidden, more };
}
