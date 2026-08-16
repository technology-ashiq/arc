// growth/ingest -- REQ-05(b), ADR-1108. The weekly Search Console read, and every refusal in it.
//
// THE FAILURE THIS MODULE EXISTS TO PREVENT DOES NOT ERROR. A mis-set date range in the export UI,
// or a week boundary defined in the wrong timezone, produces PLAUSIBLE WRONG DATA attributed to
// the wrong week. That is worse than a gap, because a gap is visible. Every guard below therefore
// REFUSES rather than guesses, and every refusal names both of the things it compared.
//
// The timezone arithmetic is the load-bearing part. Search Console reports in
// `America/Los_Angeles`; arc stamps IST. The two are ~12.5h apart, so an independently-defined
// Monday-IST boundary covers a DIFFERENT SPAN OF INSTANTS than the PT week the CSV actually
// reports. An adversarial pass killed the first version of ADR-1108 for exactly that. The bounds
// here are derived FROM THE VERIFIED PT DAYS, so the receipt describes the data that produced it.

// One chain validator for the whole lane. `resolveSlugUrl` and `planCutover` read the same
// supersede structure, and when each had its own notion of "valid" they disagreed in exactly the
// ways ADR-1119 documents.
import { assertChainIntegrity } from "./cutover.mjs";

export class IngestError extends Error {
  constructor(code, message) { super(message); this.name = "IngestError"; this.code = code; }
}

const ISO_WEEK_RE = /^(\d{4})-W(\d{2})$/;
const PT_ZONE = "America/Los_Angeles";
const DAY_MS = 86400000;

/**
 * The seven calendar dates of an ISO week, as `YYYY-MM-DD` strings.
 *
 * ISO-8601: week 1 is the week containing the first Thursday of the year, and weeks start Monday.
 * Computed in UTC and rendered as plain dates -- these are CALENDAR DATES, not instants, which is
 * why no timezone appears until `istBoundsForPacificDays` turns them into one.
 */
export function isoWeekDays(week) {
  const m = ISO_WEEK_RE.exec(String(week));
  if (!m) throw new IngestError("BAD_WEEK", `--week ${JSON.stringify(week)} must be ISO-8601 like 2026-W36`);
  const year = Number(m[1]);
  const wk = Number(m[2]);
  if (wk < 1 || wk > 53) throw new IngestError("BAD_WEEK", `week number ${wk} is outside 1-53`);
  // 4 January is always in ISO week 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7; // Monday = 0
  const week1Monday = new Date(jan4.getTime() - jan4Dow * DAY_MS);
  const monday = new Date(week1Monday.getTime() + (wk - 1) * 7 * DAY_MS);
  // A 53rd week that does not exist in this year rolls into the next one; refuse rather than
  // silently reporting on a week the caller did not ask for.
  if (wk === 53) {
    const backJan4 = new Date(Date.UTC(year + 1, 0, 4));
    if (monday.getTime() >= backJan4.getTime() - ((backJan4.getUTCDay() + 6) % 7) * DAY_MS)
      throw new IngestError("BAD_WEEK", `${week} does not exist -- ${year} has 52 ISO weeks`);
  }
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * DAY_MS);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * The UTC offset of a Pacific-time wall-clock date, in minutes, at that date's midnight.
 *
 * Uses `Intl` with a real IANA zone rather than a hardcoded -7/-8, because DST transitions fall
 * inside the year and a fixed offset silently shifts every week on one side of them.
 */
function pacificOffsetMinutes(dateStr) {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_ZONE, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(probe).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute));
  return Math.round((asUtc - probe.getTime()) / 60000);
}

const pad = (n) => String(n).padStart(2, "0");

/** Render an instant as the exact `YYYY-MM-DDTHH:MM:SS+05:30` the live validator demands. */
export function toIstStamp(ms) {
  const ist = new Date(ms + 330 * 60000); // +05:30
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T` +
    `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}+05:30`;
}

/**
 * The half-open IST window for a set of Pacific calendar days.
 *
 * `[first PT day 00:00 PT, day after the last PT day 00:00 PT)`, both rendered as IST instants.
 * Distinct bounds by construction, which is what the live validator requires (it refuses
 * `start >= end`) and what ADR-1109's D2 recorded.
 */
export function istBoundsForPacificDays(days) {
  if (!Array.isArray(days) || days.length === 0)
    throw new IngestError("BAD_DAYS", "istBoundsForPacificDays needs the verified PT days");
  const sorted = [...days].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const dayAfter = new Date(new Date(`${last}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
  const startMs = Date.parse(`${first}T00:00:00Z`) - pacificOffsetMinutes(first) * 60000;
  const endMs = Date.parse(`${dayAfter}T00:00:00Z`) - pacificOffsetMinutes(dayAfter) * 60000;
  if (!(startMs < endMs)) throw new IngestError("BAD_DAYS", "the derived window has non-increasing bounds");
  return { window_start: toIstStamp(startMs), window_end: toIstStamp(endMs), startMs, endMs };
}

/**
 * THE RANGE-MATCH GUARD. The export's own date range against the seven PT days of `--week`.
 *
 * A mismatch is REFUSED and BOTH ranges are named. This is the guard against the failure that does
 * not error: a CSV exported with whatever range the UI happened to have, ingested under a week
 * label that does not describe it.
 */
export function assertRangeMatch(exportRange, weekDays) {
  if (!exportRange || typeof exportRange.start !== "string" || typeof exportRange.end !== "string")
    throw new IngestError("NO_EXPORT_RANGE",
      "the export declares no date range, so the range-match guard cannot run -- refusing rather than assuming the file covers the week asked for");
  const want = { start: weekDays[0], end: weekDays[weekDays.length - 1] };
  if (exportRange.start !== want.start || exportRange.end !== want.end)
    throw new IngestError("RANGE_MISMATCH",
      `the export covers ${exportRange.start}..${exportRange.end} (Pacific) but --week asks for ${want.start}..${want.end}. ` +
      "Refusing: a mis-set range does not error, it attributes real numbers to the wrong week.");
  return true;
}

/**
 * THE LAG FLOOR. A week whose last PT day is under 3 days old is refused.
 *
 * It is a FLOOR, NOT A COMPLETENESS GUARANTEE. The CSV cannot say "preliminary", so a re-ingest
 * yielding different numbers is EXPECTED and lands as a new receipt with `supersedes` -- never an
 * overwrite. The correction path is load-bearing, not defensive decoration.
 */
export function assertLagFloor(weekDays, nowMs, { minDays = 3 } = {}) {
  if (typeof nowMs !== "number" || !Number.isFinite(nowMs))
    throw new IngestError("BAD_NOW", "assertLagFloor needs an explicit clock -- an implicit one cannot be tested");
  const last = weekDays[weekDays.length - 1];
  const lastEndMs = Date.parse(`${last}T00:00:00Z`) - pacificOffsetMinutes(last) * 60000 + DAY_MS;
  const ageDays = (nowMs - lastEndMs) / DAY_MS;
  if (ageDays < minDays)
    throw new IngestError("TOO_EARLY",
      `the week ending ${last} (PT) is ${ageDays.toFixed(1)} days old; the floor is ${minDays}. Search Console backfills for days, so an early read is a wrong read.`);
  return { ageDays };
}

// Header synonyms, matched by CONTENT. The exact filenames inside the export ZIP and whether
// headers localize to the account's UI language could not be verified from any primary source, so
// the parser identifies columns defensively and REFUSES an unrecognized header set rather than
// guessing positionally (ADR-1108).
const HEADER_SYNONYMS = Object.freeze({
  url: ["page", "top pages", "url", "landing page", "address"],
  clicks: ["clicks", "click"],
  impressions: ["impressions", "impression"],
});

const splitCsvLine = (line) => {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQ = false; continue; }
      cur += c; continue;
    }
    if (c === '"') { inQ = true; continue; }
    if (c === ",") { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
};

/**
 * Parse the export. BY HEADER CONTENT, never by column position or filename.
 *
 * NEVER SUMS ROWS INTO A SITE TOTAL. Search Console anonymizes low-volume rows, so a per-row sum
 * UNDER-REPORTS -- and a total that is quietly too low is exactly the plausible-wrong-number this
 * whole module is built against. Only per-URL figures come out of here, and no site-total metric
 * is claimed anywhere downstream.
 */
export function parseGscCsv(text) {
  if (typeof text !== "string") throw new IngestError("BAD_INPUT", "the export must be text");
  const lines = String(text).replace(/^﻿/, "").split(/\r\n|\r|\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) throw new IngestError("EMPTY_EXPORT", "the export is empty -- that is not a week with no traffic, it is a file with no rows");
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [field, names] of Object.entries(HEADER_SYNONYMS)) {
    const idx = header.findIndex((h) => names.includes(h));
    if (idx !== -1) col[field] = idx;
  }
  if (col.url === undefined || col.clicks === undefined)
    throw new IngestError("UNRECOGNISED_HEADERS",
      `cannot identify the url and clicks columns from ${JSON.stringify(header)} -- refusing rather than guessing by position, because a positional guess silently reads the wrong column`);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const url = (cells[col.url] ?? "").trim();
    if (url === "") continue;
    const clicksRaw = (cells[col.clicks] ?? "").trim().replace(/,/g, "");
    const clicks = Number(clicksRaw);
    if (!Number.isFinite(clicks) || clicks < 0)
      throw new IngestError("BAD_ROW", `row ${i + 1} has a non-numeric clicks value ${JSON.stringify(clicksRaw)}`);
    const row = { url, clicks };
    if (col.impressions !== undefined) {
      const impRaw = (cells[col.impressions] ?? "").trim().replace(/,/g, "");
      const imp = Number(impRaw);
      if (Number.isFinite(imp) && imp >= 0) row.impressions = imp;
    }
    rows.push(row);
  }
  if (rows.length === 0) throw new IngestError("EMPTY_EXPORT", "the export has headers but no data rows");
  return { rows, columns: col };
}

/**
 * Resolve a URL to the `content.published` receipt that describes it, taking THE HEAD OF THE
 * SUPERSEDES CHAIN -- the receipt no other receipt's `supersedes` names.
 *
 * The Phase 1 domain cutover leaves TWO receipts per pre-cutover slug, so a join on slug alone
 * picks the stale preview one and attributes a week of real clicks to a URL nobody visited. A URL
 * with no matching receipt is REPORTED, never silently dropped: an unjoinable row is information,
 * and dropping it is how a feed quietly under-reports.
 */
export function resolveSlugUrl(rows, receipts) {
  if (!Array.isArray(receipts)) throw new IngestError("BAD_INPUT", "receipts must be an array");
  // Every receipt must carry the EVENT id it was read from. Two defects lived in the four lines
  // below until 2026-08-16 and both were invisible because they fail silently:
  //
  //   1. The chain was resolved against `r.supersedes` read from a PAYLOAD. `content.published`
  //      closes its payload to eight fields with `optional: []`, so `assertContent` refuses that
  //      key outright and it can NEVER be present on a real receipt. The superseded set was
  //      therefore always empty, every receipt was a head, and the URL map silently resolved
  //      last-wins by array order.
  //   2. It compared `supersedes` against `content_sha`. The Phase 01 cutover changes `site` and
  //      `url` and leaves the BYTES ALONE, so both receipts share one `content_sha` — and the
  //      comparison filtered BOTH of them out, dropping a real week of clicks from the join.
  //
  // The test that was supposed to cover this used two DIFFERENT content_shas, which is the single
  // shape in which a content_sha-keyed chain happens to work. It is now written against the real
  // cutover shape and would go red against either defect.
  //
  // An id-less record is REFUSED rather than treated as a head, because "treated as a head" is
  // precisely how defect 1 stayed invisible through a phase close.
  // Checked for its VALUE, not merely its presence. The first version of this guard tested
  // `typeof r.id === "string"` only, which is the enforce-the-name-never-the-value defect already
  // recorded twice in this lane — and `--receipts` is an operator-built projection the spine never
  // sees, so nothing else would catch a content_sha sitting where a ULID belongs. With a sha in
  // both fields the chain resolves to nothing and BOTH receipts drop out, reproducing the exact
  // defect ADR-1119 fixed, one file over.
  // ONE chain validator, shared with `planCutover`. It used to be a local loop here that checked
  // only that `id` was a non-empty string, and the two readers then disagreed about what a valid
  // chain is: this one accepted a fork (resolving last-wins by array order — ADR-1119 defect 1
  // verbatim), a two-event cycle (dropping both receipts so real clicks landed unjoined with no
  // error — defect 2 verbatim), and a duplicate id. Two readers of one structure disagreeing about
  // validity IS the twin-defect shape this lane keeps paying for, so there is one function now.
  //
  // Wrapped so the caller still sees an IngestError: the ingest's error vocabulary is what its own
  // tests and its CLI report on, and leaking a CutoverError here would make the ingest fail with
  // the name of a module the operator is not running.
  let heads;
  try {
    heads = assertChainIntegrity(receipts);
  } catch (e) {
    throw new IngestError("BAD_RECEIPT",
      `the receipt set is not a resolvable supersede chain (${e.code}): ${e.message}`);
  }
  const byUrl = new Map();
  for (const r of heads) if (r.url) byUrl.set(String(r.url).replace(/\/$/, ""), r);
  const joined = [], unjoined = [];
  for (const row of rows) {
    const key = String(row.url).replace(/\/$/, "");
    const hit = byUrl.get(key);
    if (hit) joined.push({ ...row, slug: hit.slug, template_id: hit.template_id, content_sha: hit.content_sha });
    else unjoined.push(row);
  }
  return { joined, unjoined };
}

/**
 * Completeness. COMPLETE only after strict idempotent emission SUCCEEDED.
 *
 * Failed, pending or spooled leaves the window MISSING -- never zero. A zero is a claim that the
 * week had no traffic; MISSING is the truth, which is that nobody knows. This lane has already
 * paid for that confusion once: an emitter exited 0 while every receipt it wrote was quarantined.
 */
export function windowState({ emitted, attempted }) {
  if (typeof emitted !== "number" || typeof attempted !== "number")
    throw new IngestError("BAD_INPUT", "windowState needs emitted and attempted counts");
  if (attempted === 0) return { state: "MISSING", reason: "nothing was attempted for this window" };
  if (emitted < attempted)
    return { state: "MISSING", reason: `${emitted} of ${attempted} receipts confirmed on the spine -- a partial window is MISSING, never zero` };
  return { state: "COMPLETE", reason: `${emitted} of ${attempted} receipts confirmed present in events/ and absent from _quarantine/` };
}

/**
 * `source_id` for a week. `gsc-<ISO-week>`, and `gsc-<ISO-week>-r<N>` for a correction (ADR-1117).
 * Satisfies the live SOURCE_ID_RE. No URL, no PII.
 *
 * THE REVISION EXISTS BECAUSE A CORRECTION OTHERWISE VANISHES. The idem preimage deliberately
 * excludes `value` -- it identifies WHICH measurement this is, not what it said -- and the emitter
 * derives the leads key WITHOUT `supersedes`, though it passes `supersedes` for the experiment
 * family two lines down. So a re-ingest with different numbers hashed identically and was dropped
 * as DUP_IDEM, silently, while the code that was supposed to make corrections land looked correct
 * in every file you could read on its own.
 *
 * `source_id` IS in the preimage, so a revisioned id gives the correction a distinct key with no
 * change to any file growth does not own. Re-ingesting the SAME export stays idempotent, because
 * the same week at the same revision is the same key.
 */
export function sourceIdFor(week, revision = 1) {
  if (!ISO_WEEK_RE.test(String(week))) throw new IngestError("BAD_WEEK", `${JSON.stringify(week)} is not an ISO week`);
  if (!Number.isInteger(revision) || revision < 1)
    throw new IngestError("BAD_REVISION", `revision must be an integer >= 1, got ${JSON.stringify(revision)}`);
  return revision === 1 ? `gsc-${week}` : `gsc-${week}-r${revision}`;
}
