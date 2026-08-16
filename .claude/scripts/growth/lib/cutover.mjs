// growth/cutover — Phase 01 criterion 5. Re-pin a pre-cutover receipt to the permanent host.
//
// THE WHOLE POINT: a receipt is never edited. `site` is in the idem preimage (ADR-1101), so a
// re-pin is a genuinely new fact about the same article, and it lands as a SECOND receipt whose
// event-level `supersedes` names the first. Editing the first in place would destroy the only
// evidence of what the article's address used to be, which is the thing a reader weeks later needs
// in order to understand a URL that stopped receiving traffic.
//
// TWO defects in the surrounding code were found while building this, both by running the cutover
// shape through the existing readers rather than by reading them, and both are pinned as negative
// controls in tests/growth-site-cutover.bats:
//
//   1. `content.published` payloads CANNOT carry `supersedes`. The shape is closed to eight fields
//      with `optional: []`, so `assertContent` refuses the key outright. Any reader that resolves a
//      supersede chain by looking for `payload.supersedes` is therefore reading a field that can
//      never be present: its "superseded" set is always empty and every receipt looks like a head.
//      That fails silently and always, which is why it survived a phase close.
//   2. The chain is resolved by ULID, not by `content_sha`. A site re-pin changes `site` and `url`
//      and leaves the bytes ALONE, so both receipts carry the SAME `content_sha`. A reader that
//      compares `supersedes` against `content_sha` filters BOTH of them out and the article
//      disappears from the join entirely -- a whole week of real clicks silently unjoined.
//
// So the supersede pointer here is an EVENT id, and this module never invents one: the caller
// passes the prior event as it was read from the spine.

export class CutoverError extends Error {
  constructor(code, message) { super(message); this.name = "CutoverError"; this.code = code; }
}

// Matches validate-content.mjs. Duplicated deliberately rather than imported: this module must
// refuse a bad host BEFORE building a payload, and importing the validator here would make the
// growth lane depend on a company organ for a string check. The test asserts the two agree.
const SITE_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * The eight fields a `content.published` payload carries. Named here so an added field fails LOUDLY
 * in this module rather than being quietly dropped from the corrected receipt -- a re-pin that
 * silently lost a field would look like a correction and be a truncation.
 */
const PAYLOAD_FIELDS = Object.freeze(
  ["site", "slug", "url", "title", "template_id", "cluster_id", "content_sha", "pr_ref"],
);

/**
 * Replace ONLY the host of a published URL, preserving the path byte-for-byte.
 *
 * Re-deriving the path from the slug was the obvious alternative and is rejected: it assumes the
 * route shape (`/blog/<slug>`), and the moment the site serves an article anywhere else the
 * cutover would silently rewrite a correct URL into a 404 that still looks well-formed. The host
 * is the only thing this phase is changing, so it is the only thing this function touches.
 */
export function repinUrl(oldUrl, newSite) {
  if (typeof oldUrl !== "string" || !oldUrl.startsWith("https://"))
    throw new CutoverError("BAD_URL", `cannot re-pin ${JSON.stringify(oldUrl)} — a published URL is https and absolute`);
  if (typeof newSite !== "string" || !SITE_RE.test(newSite))
    throw new CutoverError("BAD_SITE", `${JSON.stringify(newSite)} is not a bare lowercase hostname`);

  const rest = oldUrl.slice("https://".length);
  const slash = rest.indexOf("/");
  // A URL with no path at all is not an article URL. Refused rather than defaulted, because
  // defaulting would invent the path this function exists to preserve.
  if (slash === -1)
    throw new CutoverError("BAD_URL", `${JSON.stringify(oldUrl)} has no path — a published article URL always has one`);
  return `https://${newSite}${rest.slice(slash)}`;
}

/**
 * Build the corrected receipt for ONE pre-cutover event.
 *
 * `priorEvent` is the event as read from the spine: `{id, payload}`. Returns the payload for the
 * new receipt plus the `supersedes` ULID it must be emitted with. It does NOT emit — emission is
 * the emitter's job and it derives its own idem, which is what makes the "different idem" property
 * a fact about the spine rather than a claim by this module.
 */
export function repinReceipt(priorEvent, newSite) {
  if (!priorEvent || typeof priorEvent !== "object")
    throw new CutoverError("BAD_INPUT", "repinReceipt needs the prior event as read from the spine");
  const { id, payload } = priorEvent;
  if (typeof id !== "string" || !ULID_RE.test(id))
    throw new CutoverError("BAD_PRIOR_ID",
      "the prior event needs its ULID — `supersedes` names an EVENT, and a chain keyed on content_sha breaks on exactly this correction, where the bytes do not change");
  if (!payload || typeof payload !== "object")
    throw new CutoverError("BAD_INPUT", "the prior event needs its payload");

  const unknown = Object.keys(payload).filter((k) => !PAYLOAD_FIELDS.includes(k));
  if (unknown.length)
    throw new CutoverError("UNKNOWN_FIELD",
      `prior payload carries ${unknown.join(", ")}, which this module does not know how to carry forward — a correction that drops a field is a truncation wearing a correction's name`);
  for (const f of PAYLOAD_FIELDS)
    if (typeof payload[f] !== "string")
      throw new CutoverError("INCOMPLETE_PRIOR", `prior payload is missing ${f}`);

  if (payload.site === newSite)
    throw new CutoverError("ALREADY_PINNED",
      `${payload.slug} is already pinned to ${newSite} — emitting an identical receipt would be refused as DUP_IDEM, and calling that a successful correction is how a no-op gets reported as work`);

  return {
    supersedes: id,
    payload: { ...payload, site: newSite, url: repinUrl(payload.url, newSite) },
  };
}

/**
 * Phase 01 criterion 4: read the ONE pinned value for `content.published.site`.
 *
 * Takes the parsed JSON rather than a path, because this module has no filesystem access by
 * design -- the same reason `publish.mjs` has no exec capability. The caller reads the file.
 *
 * The host is re-checked against the grammar HERE, at read time. A bad value would otherwise
 * surface as a refused receipt at the spine, which is late, loud in the wrong place, and blames
 * the emit rather than the config.
 */
export function loadSiteConfig(json) {
  if (!json || typeof json !== "object" || Array.isArray(json))
    throw new CutoverError("BAD_SITE_CONFIG", "the site config must be a JSON object");
  if (json.schema !== 1)
    throw new CutoverError("BAD_SITE_CONFIG", `unsupported site config schema ${JSON.stringify(json.schema)} — expected 1`);
  if (typeof json.site !== "string" || !SITE_RE.test(json.site))
    throw new CutoverError("BAD_SITE_CONFIG",
      `site ${JSON.stringify(json.site)} is not a bare lowercase hostname — no scheme, no port, no path, no trailing dot`);
  return { site: json.site };
}

/**
 * Phase 01 criterion 6 / fixture `sitemap-includes-published-slugs`: the sitemap and the spine
 * agree about which articles exist.
 *
 * Compared BOTH ways, because the two directions are different bugs. A published slug missing from
 * the sitemap is an article no crawler is told about; a sitemap entry with no receipt behind it is
 * a page claiming to be published that the spine has no record of, which is the more alarming of
 * the two and the one a one-way check would miss.
 *
 * Only `/blog/` paths are compared. The homepage is in the sitemap and has no receipt, and it
 * should stay that way -- "nothing else does" means no stray ARTICLE, not that the site may serve
 * nothing but articles.
 */
export function checkSitemapCoverage(sitemapXml, publishedSlugs) {
  if (typeof sitemapXml !== "string")
    throw new CutoverError("BAD_INPUT", "checkSitemapCoverage needs the sitemap XML as a string");
  if (!Array.isArray(publishedSlugs))
    throw new CutoverError("BAD_INPUT", "checkSitemapCoverage needs an array of published slugs");

  const inSitemap = new Set();
  for (const m of sitemapXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    // Trailing slash is a rendering choice of the static host, not part of the slug identity.
    const path = m[1].replace(/^https:\/\/[^/]+/, "").replace(/\/$/, "");
    if (path.startsWith("/blog/")) inSitemap.add(path.slice("/blog/".length));
  }
  const published = new Set(publishedSlugs);

  const missing = [...published].filter((s) => !inSitemap.has(s)).sort();
  const extra = [...inSitemap].filter((s) => !published.has(s)).sort();
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

/**
 * Plan the whole cutover: every receipt that is still a HEAD and is not already on the new host.
 *
 * Heads only, and by ULID. Re-pinning a receipt that something already supersedes would fork the
 * chain into two live branches, and `resolveSlugUrl` answers "which receipt describes this URL" by
 * finding the one nobody supersedes — two of those is not a tie, it is an unanswerable question.
 */
export function planCutover(events, newSite) {
  if (!Array.isArray(events))
    throw new CutoverError("BAD_INPUT", "planCutover needs an array of content.published events");
  for (const e of events)
    if (!e || typeof e.id !== "string" || !ULID_RE.test(e.id))
      throw new CutoverError("BAD_EVENT",
        "every event needs its ULID before a chain can be resolved — silently treating an id-less record as a head is the failure this refusal exists to prevent");

  const superseded = new Set(events.map((e) => e.supersedes).filter(Boolean));
  const heads = events.filter((e) => !superseded.has(e.id));
  const todo = heads.filter((e) => e.payload && e.payload.site !== newSite);

  return {
    todo: todo.map((e) => repinReceipt(e, newSite)),
    // Counted and returned rather than logged, so a caller that expected work and got none can say
    // so. A cutover that silently plans zero corrections looks identical to one that succeeded.
    headCount: heads.length,
    alreadyPinned: heads.length - todo.length,
  };
}
