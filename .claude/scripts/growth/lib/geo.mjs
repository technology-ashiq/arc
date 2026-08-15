// growth/geo -- REQ-03 criterion 11. The template's machine-readable parts.
//
// ADR-1113 governs the tone of this whole file: `llms.txt` and IndexNow ship as CHEAP HEDGES, and
// the ADR forbids either from appearing in any exit criterion as a lever. So the criterion here is
// "well-formed", never "improves anything". Nothing in this module is allowed to be described as
// growth. The IndexNow ping is CUT outright -- it reaches no Google surface.
//
// E3 applies to structured data as much as to prose: JSON-LD that claims an author, a date or a
// publisher arc cannot evidence is a fabricated claim in a machine-readable field, which is worse
// than one in prose because nothing reads it sceptically.

export class GeoError extends Error {
  constructor(code, message) { super(message); this.name = "GeoError"; this.code = code; }
}

const HTTPS_RE = /^https:\/\/[a-z0-9.-]+(\/[^\s]*)?$/i;

/**
 * schema.org Article. Only fields arc can actually evidence.
 *
 * `datePublished` is REQUIRED and passed in rather than taken from the clock: a build that stamps
 * "now" re-stamps every rebuild, and the date on a published article is a fact about the
 * publication, not about when the site was last generated.
 */
export function articleJsonLd({ title, description, url, datePublished, dateModified, authorName, authorUrl, publisherName }) {
  for (const [k, v] of Object.entries({ title, description, url, datePublished, authorName, publisherName }))
    if (typeof v !== "string" || v.trim() === "")
      throw new GeoError("BAD_ARTICLE", `${k} must be a non-empty string`);
  if (!HTTPS_RE.test(url)) throw new GeoError("BAD_ARTICLE", `url ${JSON.stringify(url)} must be an https URL`);
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(datePublished))
    throw new GeoError("BAD_ARTICLE", `datePublished ${JSON.stringify(datePublished)} must be ISO-8601`);
  if (dateModified !== undefined && !/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(dateModified))
    throw new GeoError("BAD_ARTICLE", `dateModified ${JSON.stringify(dateModified)} must be ISO-8601`);
  const author = { "@type": "Organization", name: authorName };
  if (authorUrl !== undefined) {
    if (!HTTPS_RE.test(authorUrl)) throw new GeoError("BAD_ARTICLE", "authorUrl must be an https URL");
    author.url = authorUrl;
  }
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished,
    ...(dateModified ? { dateModified } : {}),
    author,
    publisher: { "@type": "Organization", name: publisherName },
  };
}

/**
 * schema.org FAQPage.
 *
 * An FAQ block is NOT required of any article -- requiring one would be structure prescription and
 * ADR-1110 makes that a one-way door. This renders a block when the writer wrote one, and refuses
 * to render an EMPTY FAQPage: a FAQPage with no questions is a structured-data claim that the page
 * answers questions it does not answer.
 */
export function faqJsonLd(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0)
    throw new GeoError("EMPTY_FAQ", "a FAQPage with no questions claims the page answers questions it does not -- omit the block instead");
  const mainEntity = pairs.map((p, i) => {
    if (!p || typeof p.question !== "string" || p.question.trim() === "")
      throw new GeoError("BAD_FAQ", `FAQ entry ${i} has no question`);
    if (typeof p.answer !== "string" || p.answer.trim() === "")
      throw new GeoError("BAD_FAQ", `FAQ entry ${i} has no answer`);
    return {
      "@type": "Question",
      name: p.question,
      acceptedAnswer: { "@type": "Answer", text: p.answer },
    };
  });
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity };
}

/**
 * The disclaimer footer. ADR-1111 requires every article to state plainly that it is information
 * rather than professional advice, and to name arc as the author entity.
 */
export function disclaimerFooter({ authorName }) {
  if (typeof authorName !== "string" || authorName.trim() === "")
    throw new GeoError("BAD_DISCLAIMER", "the disclaimer must name the author entity");
  return [
    "---",
    "",
    `*Published by ${authorName}. This article is information, not professional advice.*`,
    "",
    "*Where it cites arc's own results, a receipt exists for them on the spine. Anything simulated",
    "is labelled simulated.*",
  ].join("\n");
}

/**
 * `llms.txt`. A HEDGE (ADR-1113), and the only thing asserted about it is that it is well-formed.
 *
 * No claim is made here or anywhere that it improves retrieval, inclusion, or anything else. If a
 * measurement ever shows it does, that is a finding for a retro, not a line in this comment.
 */
export function llmsTxt({ siteName, siteUrl, summary, links = [] }) {
  for (const [k, v] of Object.entries({ siteName, siteUrl, summary }))
    if (typeof v !== "string" || v.trim() === "")
      throw new GeoError("BAD_LLMS", `${k} must be a non-empty string`);
  if (!HTTPS_RE.test(siteUrl)) throw new GeoError("BAD_LLMS", "siteUrl must be an https URL");
  const lines = [`# ${siteName}`, "", `> ${summary}`, ""];
  if (links.length > 0) {
    lines.push("## Articles", "");
    for (const l of links) {
      if (!l || typeof l.title !== "string" || !HTTPS_RE.test(l.url || ""))
        throw new GeoError("BAD_LLMS", `link ${JSON.stringify(l)} needs a title and an https url`);
      lines.push(`- [${l.title}](${l.url})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Render a JSON-LD object as the script tag that goes in the page head. */
export function jsonLdScript(obj) {
  // `</script>` inside a JSON string ends the tag in an HTML parser. The escape is the standard
  // one and it survives JSON.parse on the other side.
  const json = JSON.stringify(obj, null, 2).replace(/<\//g, "<\\/");
  return `<script type="application/ld+json">\n${json}\n</script>`;
}
