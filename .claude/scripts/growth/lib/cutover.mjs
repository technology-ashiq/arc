// growth/cutover — Phase 01 criterion 5. Re-pin a pre-cutover receipt to the permanent host.
//
// THE WHOLE POINT: a receipt is never edited. `site` is in the idem preimage (ADR-1101), so a
// re-pin is a genuinely new fact about the same article, and it lands as a SECOND receipt whose
// event-level `supersedes` names the first BY ULID.
//
// Two defects in the surrounding code were found while building this (ADR-1119), both silent:
// a chain resolved from `payload.supersedes`, a key the closed payload shape can never carry; and
// that value compared against `content_sha`, which a re-pin leaves unchanged, so both receipts
// were filtered out and a week of clicks fell out of the join.
//
// A FRESH ADVERSARIAL PASS on the first version of this file then returned 14 findings, and the
// ones it found in THIS module are fixed here rather than argued with. Each is named at its guard,
// because the general lesson never transfers — only the specific one does:
//
//   - `SITE_RE` was duplicated from validate-content.mjs under a comment claiming a test asserted
//     the two agree. No such test existed and none could: neither copy was exported. Now imported.
//   - `checkSitemapCoverage` stripped the host and never compared it — in the one phase whose
//     entire subject is a host change. A sitemap still pointing at the preview host passed.
//   - `alreadyPinned` counted a head whose payload could not be read as "already on the permanent
//     host", which is the reported-number-is-not-the-measured-number defect this lane keeps
//     re-finding. Unreadable is now a refusal, not a tally.
//   - `planCutover` grammar-checked every `id` and then trusted `supersedes` unvalidated, so a
//     projection carrying the pre-ADR-1119 sha resolved to no predecessor and the stale receipt
//     was re-pinned alongside its own successor.
//   - Nothing detected a fork, a cycle, or a planned correction that would collide on idem with a
//     receipt already on the spine. All three were reported as work and refused by the spine.
//   - `repinReceipt` read fields through the prototype chain and rebuilt with own keys only, so an
//     inherited field was silently dropped — the truncation its own guard exists to refuse.

import { SITE_RE, assertContent, contentIdem } from "../../hq/lib/validate-content.mjs";

export class CutoverError extends Error {
  constructor(code, message) { super(message); this.name = "CutoverError"; this.code = code; }
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * The eight fields a `content.published` payload carries. Named here so an added field fails LOUDLY
 * rather than being quietly dropped from the corrected receipt — a re-pin that silently lost a
 * field would look like a correction and be a truncation.
 */
const PAYLOAD_FIELDS = Object.freeze(
  ["site", "slug", "url", "title", "template_id", "cluster_id", "content_sha", "pr_ref"],
);

/**
 * The seven fields the spine's idem is taken over, in `validate-content.mjs`'s order. Mirrored so
 * this module can predict a collision BEFORE emitting; the spine remains the authority and the
 * test asserts a planned correction really does hash differently there.
 *
 * Joined with the SAME `|` the spine uses, and that is not cosmetic. The spine refuses `|` in
 * every one of these fields precisely so the join cannot be forged — with any other separator
 * (a space, say) `site="a", slug="b c"` and `site="a b", slug="c"` would produce one tuple here
 * and two different idems there, so this module would predict a collision that does not exist and
 * miss one that does. A collision predictor keyed differently from the thing it predicts is worse
 * than none.
 */
const IDEM_FIELDS = Object.freeze(
  ["site", "slug", "content_sha", "title", "template_id", "cluster_id", "url"],
);

const idemTuple = (p) => IDEM_FIELDS.map((f) => p[f]).join("|");

/** Own property only. The prototype chain does not count — `validate-content.mjs` fixed this exact
 * shape one file over, and this module inherited the bug by reading with `typeof payload[f]`. */
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Read the ONE pinned value for `content.published.site` (criterion 4).
 *
 * Takes parsed JSON rather than a path: this module has no filesystem access by design, the same
 * reason `publish.mjs` has no exec capability. The host is re-checked at read time so a bad value
 * blames the config rather than surfacing later as a refused receipt at the spine.
 */
export function loadSiteConfig(input) {
  // Accepts the raw TEXT as well as parsed JSON, because the parse is where two of this function's
  // failures lived. A caller doing `JSON.parse(readFileSync(p, "utf8"))` throws a bare SyntaxError
  // on a BOM-prefixed file — which is what Notepad and PowerShell write on the primary platform —
  // so criterion 4 died with an uncaught parse error on the Windows leg only, and never reached
  // the BAD_SITE_CONFIG it was supposed to report.
  let json = input;
  if (typeof input === "string") {
    const text = input.replace(/^\uFEFF/, "");
    // A duplicate key is legal JSON and last-one-wins silently. This file is the single pinned,
    // explicitly ONE-WAY source for the host (ADR-1118) and is hand-edited around a long comment
    // block, so a second `site` line is a realistic edit and would validate cleanly as whichever
    // value happened to come last.
    const keys = [...text.matchAll(/"([^"\\]*)"\s*:/g)].map((m) => m[1]);
    const dup = keys.find((k, i) => keys.indexOf(k) !== i);
    if (dup !== undefined)
      throw new CutoverError("BAD_SITE_CONFIG",
        `the site config declares ${JSON.stringify(dup)} more than once — JSON takes the last silently, and this file pins a one-way decision`);
    try { json = JSON.parse(text); }
    catch (e) { throw new CutoverError("BAD_SITE_CONFIG", `the site config is not valid JSON: ${e.message}`); }
  }

  if (!json || typeof json !== "object" || Array.isArray(json))
    throw new CutoverError("BAD_SITE_CONFIG", "the site config must be a JSON object");
  if (json.schema !== 1)
    throw new CutoverError("BAD_SITE_CONFIG", `unsupported site config schema ${JSON.stringify(json.schema)} — expected 1`);
  // CLOSED to unknown keys, matching `repinReceipt` in this same file. It was open while its
  // sibling refused an unexpected field as "a truncation wearing a correction's name" — and an
  // ignored `site_OLD` or a misspelled `sites` is exactly how a config appears to be edited while
  // the value in force never changes.
  const KNOWN = new Set(["schema", "site", "_comment"]);
  const unknown = Object.keys(json).filter((k) => !KNOWN.has(k));
  if (unknown.length)
    throw new CutoverError("BAD_SITE_CONFIG",
      `the site config carries unknown key(s) ${unknown.join(", ")} — a key this loader ignores is a key an editor believes they changed`);
  if (typeof json.site !== "string" || !SITE_RE.test(json.site))
    throw new CutoverError("BAD_SITE_CONFIG",
      `site ${JSON.stringify(json.site)} is not a bare lowercase hostname — no scheme, no port, no path, no trailing dot`);
  return { site: json.site };
}

/**
 * Replace ONLY the host of a published URL, preserving the path byte-for-byte.
 *
 * Re-deriving the path from the slug was the alternative and is rejected: it assumes the route
 * shape (`/blog/<slug>`), so the moment an article is served from anywhere else the cutover would
 * silently rewrite a correct URL into a well-formed 404.
 */
export function repinUrl(oldUrl, newSite) {
  if (typeof oldUrl !== "string" || !oldUrl.startsWith("https://"))
    throw new CutoverError("BAD_URL", `cannot re-pin ${JSON.stringify(oldUrl)} — a published URL is https and absolute`);
  if (typeof newSite !== "string" || !SITE_RE.test(newSite))
    throw new CutoverError("BAD_SITE", `${JSON.stringify(newSite)} is not a bare lowercase hostname`);

  const rest = oldUrl.slice("https://".length);
  // The authority ends at the FIRST of `/`, `?` or `#`, not at `/` alone. Splitting on `/` only
  // meant a query, a fragment or a password became the new path:
  //   https://old.test?next=/evil/path  ->  https://arc.automemory.ai/evil/path
  //   https://user:p/w@old.test/blog/x  ->  https://arc.automemory.ai/w@old.test/blog/x
  // That is not preserving a path, it is inventing one. Found by an adversarial pass 2026-08-16.
  const cut = rest.search(/[/?#]/);
  if (cut === -1)
    throw new CutoverError("BAD_URL", `${JSON.stringify(oldUrl)} has no path — a published article URL always has one`);
  const authority = rest.slice(0, cut);
  const path = rest.slice(cut);
  // Userinfo, a port, or anything else the host grammar refuses. A published receipt's URL must be
  // reducible to a bare host plus a path, or the re-pin is guessing which part was the host.
  if (!SITE_RE.test(authority))
    throw new CutoverError("BAD_URL",
      `${JSON.stringify(oldUrl)} does not carry a bare hostname (found ${JSON.stringify(authority)}) — userinfo, a port or an escaped host makes "replace only the host" ambiguous`);
  // `?` and `#` are refused outright rather than carried: the spine's URL grammar excludes both,
  // so carrying one produces a payload that quarantines at emit, and dropping one silently changes
  // the address. Neither is a correction.
  if (path === "" || path === "/")
    throw new CutoverError("BAD_URL",
      `${JSON.stringify(oldUrl)} points at the site root — re-pinning it would claim the article lives at the homepage`);
  if (/[?#]/.test(path))
    throw new CutoverError("BAD_URL",
      `${JSON.stringify(oldUrl)} carries a query or fragment — the spine's URL grammar refuses both, and silently dropping one changes the address the receipt claims`);
  return `https://${newSite}${path}`;
}

/** Every event must carry a ULID id, and a ULID-or-null supersedes. Validated together, because
 * checking one and trusting the other is how the stale receipt got re-pinned beside its successor. */
function assertEventIds(e, where) {
  if (!e || typeof e !== "object")
    throw new CutoverError("BAD_EVENT", `${where}: not an event object`);
  if (typeof e.id !== "string" || !ULID_RE.test(e.id))
    throw new CutoverError("BAD_EVENT",
      `${where}: every event needs its ULID before a chain can be resolved — silently treating an id-less record as a head is the failure this refusal exists to prevent`);
  if (e.supersedes !== undefined && e.supersedes !== null && !ULID_RE.test(String(e.supersedes)))
    throw new CutoverError("BAD_SUPERSEDES",
      `${where}: supersedes ${JSON.stringify(e.supersedes)} is not a ULID — a content_sha here resolves to no predecessor, and the stale receipt is then re-pinned alongside its own successor`);
  if (e.supersedes && e.supersedes === e.id)
    throw new CutoverError("BAD_SUPERSEDES", `${where}: an event superseding itself is a cycle no fold can resolve`);
}

/**
 * Build the corrected receipt for ONE pre-cutover event.
 *
 * Returns the new payload plus the `supersedes` ULID it must be emitted with. It does NOT emit —
 * emission is the emitter's job and it derives its own idem, which is what makes "the idem
 * differs" a fact about the spine rather than a claim by this module.
 */
export function repinReceipt(priorEvent, newSite) {
  if (!priorEvent || typeof priorEvent !== "object")
    throw new CutoverError("BAD_INPUT", "repinReceipt needs the prior event as read from the spine");
  assertEventIds(priorEvent, "prior event");
  const { id, payload } = priorEvent;
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new CutoverError("BAD_INPUT", "the prior event needs its payload");

  const unknown = Object.keys(payload).filter((k) => !PAYLOAD_FIELDS.includes(k));
  if (unknown.length)
    throw new CutoverError("UNKNOWN_FIELD",
      `prior payload carries ${unknown.join(", ")}, which this module does not know how to carry forward — a correction that drops a field is a truncation wearing a correction's name`);
  for (const f of PAYLOAD_FIELDS)
    if (!hasOwn(payload, f) || typeof payload[f] !== "string")
      throw new CutoverError("INCOMPLETE_PRIOR",
        `prior payload is missing ${f} as an OWN property — an inherited value would pass a typeof check and then vanish from the rebuilt object`);

  if (payload.site === newSite)
    throw new CutoverError("ALREADY_PINNED",
      `${payload.slug} is already pinned to ${newSite} — emitting an identical receipt would be refused as DUP_IDEM, and calling that a successful correction is how a no-op gets reported as work`);

  const next = {};
  for (const f of PAYLOAD_FIELDS) next[f] = payload[f];
  next.site = newSite;
  next.url = repinUrl(payload.url, newSite);

  // Validate the OUTPUT against the real spine validator, not just the input against local
  // grammars. Without this, a prior payload the spine would refuse produced a "planned correction"
  // that quarantined at emit — the no-op-reported-as-success shape this module refuses everywhere
  // else. Running the actual validator rather than re-checking a copy of its rules is the point:
  // a second implementation of a grammar is a second thing to drift.
  try {
    assertContent({ kind: "content.published", payload: next, idem: contentIdem("content.published", next) });
  } catch (e) {
    throw new CutoverError("INVALID_CORRECTION",
      `the correction for ${payload.slug} would be refused by the spine (${e.code || e.name}: ${e.message}) — planning it would report work that quarantines at emit`);
  }
  return { supersedes: id, payload: next };
}

/**
 * Do the sitemap and the spine agree about which articles exist?
 *
 * `expectedSite` is REQUIRED. The first version stripped the host and compared slugs only, so a
 * sitemap still advertising every article on the preview host returned `{ok: true}` — in the one
 * phase whose entire subject is moving hosts. A coverage check that cannot see the thing being
 * changed is decoration.
 *
 * Compared BOTH ways, because the directions are different bugs: a published slug missing from the
 * sitemap is an article no crawler is told about; a sitemap entry with no receipt behind it is a
 * page claiming to be published that the spine has no record of.
 *
 * Only `/blog/` paths are compared — the homepage is in every sitemap and has no receipt, and
 * "nothing else" means no stray ARTICLE, not that the site may serve nothing but articles.
 */
export function checkSitemapCoverage(sitemapXml, publishedSlugs, expectedSite) {
  if (typeof sitemapXml !== "string")
    throw new CutoverError("BAD_INPUT", "checkSitemapCoverage needs the sitemap XML as a string");
  if (!Array.isArray(publishedSlugs))
    throw new CutoverError("BAD_INPUT", "checkSitemapCoverage needs an array of published slugs");
  if (typeof expectedSite !== "string" || !SITE_RE.test(expectedSite))
    throw new CutoverError("BAD_SITE",
      "checkSitemapCoverage needs the expected host — without it a sitemap pointing entirely at the old host passes, which is the one thing this phase changes");

  // A sitemap INDEX is not a sitemap. It lists other sitemaps, so every article looks missing —
  // and `vercel.json` now 308s the conventional /sitemap.xml onto exactly that shape, so the most
  // likely URL a caller passes is the one this function cannot answer. Refused by name rather than
  // silently reporting every article missing.
  if (/<sitemapindex[\s>]/i.test(sitemapXml))
    throw new CutoverError("SITEMAP_INDEX",
      "this is a sitemap INDEX, not a sitemap — it lists sitemaps, so every article would read as missing. Fetch the child sitemap it names and check that");

  // Comments are stripped: a <loc> inside one is not a live entry, and counting it produced both a
  // false alarm (a ghost for a page not really listed) and a false pass (a commented-out entry
  // satisfying coverage) out of the same hole.
  //
  // CDATA needs the OPPOSITE treatment in each direction, and stripping it wholesale — the first
  // fix here — was itself wrong. `<loc><![CDATA[https://…]]></loc>` is a perfectly ordinary and
  // valid sitemap encoding whose URL is live, so removing it hides a real entry. But
  // `<![CDATA[<loc>https://…</loc>]]>` is inert TEXT that merely looks like markup.
  //
  // The distinguishing property is whether the section contains markup: unwrap it to its literal
  // text when it does not, drop it when it does.
  const live = sitemapXml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, inner) => (inner.includes("<") ? "" : inner));

  const inSitemap = new Set();
  const wrongHost = [];
  const malformed = [];
  let parsed = 0;
  // Tolerates a namespace prefix and attributes, and is case-insensitive on the tag. The first
  // version matched only a bare lowercase `<loc>`, so `<ns:loc>`, `<loc xml:lang="en">` and
  // `<LOC>` were invisible — and `parsed` counted the same regex, so the counter added to detect
  // an unreadable sitemap could not see the entries it was failing to read.
  for (const m of live.matchAll(/<(?:[A-Za-z0-9_.-]+:)?loc\b[^>]*>\s*([^<\s]+)\s*<\/(?:[A-Za-z0-9_.-]+:)?loc\s*>/gi)) {
    parsed++;
    const loc = m[1];
    const hostMatch = /^https:\/\/([^/]+)(\/.*)?$/.exec(loc);
    // A relative <loc> is not a valid sitemap entry; counted as parsed and reported, never
    // silently skipped, because a skipped entry is indistinguishable from an absent one.
    if (!hostMatch) { wrongHost.push(loc); continue; }
    const [, host, path = "/"] = hostMatch;
    const clean = path.replace(/\/$/, "");
    // Classified case-INSENSITIVELY so `/BLOG/d/` is seen, then required to be exactly `/blog/`.
    // Skipping it silently meant a near-miss article path was neither matched nor reported, which
    // is the same invisible-entry hole as the tag regex one layer up. URL paths are case-sensitive,
    // so a differently-cased prefix is a real anomaly and not a synonym.
    if (!/^\/blog\//i.test(clean)) continue;
    if (!clean.startsWith("/blog/")) { malformed.push(loc); continue; }
    if (host !== expectedSite) { wrongHost.push(loc); continue; }
    inSitemap.add(clean.slice("/blog/".length));
  }
  const published = new Set(publishedSlugs);

  const missing = [...published].filter((s) => !inSitemap.has(s)).sort();
  const extra = [...inSitemap].filter((s) => !published.has(s)).sort();
  return {
    ok: missing.length === 0 && extra.length === 0 && wrongHost.length === 0 && malformed.length === 0,
    missing,
    extra,
    wrongHost: wrongHost.sort(),
    malformed: malformed.sort(),
    // Returned so an unparseable or empty sitemap is distinguishable from a correct one. Zero
    // entries and zero published slugs would otherwise report `ok: true` — MISSING read as zero.
    parsed,
  };
}

/**
 * Plan the whole cutover: every receipt that is still a HEAD and is not already on the new host.
 *
 * Refuses rather than guesses on every ambiguity the adversarial pass surfaced — a fork, a cycle,
 * two live heads for one slug, an unreadable payload, or a planned correction that would collide
 * on idem with a receipt already on the spine. Each of those was previously counted as work and
 * then refused by the spine, which reports a no-op as a success.
 */
export function planCutover(events, newSite) {
  if (!Array.isArray(events))
    throw new CutoverError("BAD_INPUT", "planCutover needs an array of content.published events");
  if (typeof newSite !== "string" || !SITE_RE.test(newSite))
    throw new CutoverError("BAD_SITE", `${JSON.stringify(newSite)} is not a bare lowercase hostname`);
  events.forEach((e, i) => assertEventIds(e, `event ${i}`));

  const seenId = new Set();
  for (const e of events) {
    if (seenId.has(e.id)) throw new CutoverError("DUPLICATE_EVENT", `event ${e.id} appears twice`);
    seenId.add(e.id);
  }

  // A fork: two receipts superseding the same predecessor. Heads-only does not prevent this, it
  // propagates it — and "which receipt describes this URL" then has two answers, which is not a
  // tie but an unanswerable question.
  const targets = new Map();
  for (const e of events) {
    if (!e.supersedes) continue;
    if (targets.has(e.supersedes))
      throw new CutoverError("FORKED_CHAIN",
        `events ${targets.get(e.supersedes)} and ${e.id} both supersede ${e.supersedes} — the chain has two live branches and no single head`);
    targets.set(e.supersedes, e.id);
  }

  const superseded = new Set(targets.keys());
  const heads = events.filter((e) => !superseded.has(e.id));
  if (events.length > 0 && heads.length === 0)
    throw new CutoverError("CHAIN_CYCLE", "every event is superseded by another — the chain is a cycle and has no head");

  for (const h of heads)
    if (!h.payload || typeof h.payload !== "object" || Array.isArray(h.payload))
      throw new CutoverError("UNREADABLE_HEAD",
        `head ${h.id} has no readable payload — counting it as already-pinned would report a record we cannot read as a record needing no work`);

  const bySlug = new Map();
  for (const h of heads) {
    const prev = bySlug.get(h.payload.slug);
    if (prev)
      throw new CutoverError("AMBIGUOUS_SLUG",
        `slug ${h.payload.slug} has two live heads (${prev}, ${h.id}) — a join on it would pick one by array order`);
    bySlug.set(h.payload.slug, h.id);
  }

  const stale = heads.filter((h) => h.payload.site !== newSite);
  const todo = stale.map((h) => repinReceipt(h, newSite));

  // Would any planned correction hash to a receipt the spine already holds? `contentIdem` does not
  // include `supersedes`, so an orphan re-pin that already happened without a link produces an
  // identical preimage and is dropped as DUP_IDEM — reported here instead of discovered there.
  const existing = new Set(events.filter((e) => e.payload && typeof e.payload === "object").map((e) => idemTuple(e.payload)));
  for (const t of todo)
    if (existing.has(idemTuple(t.payload)))
      throw new CutoverError("WOULD_COLLIDE",
        `the correction for ${t.payload.slug} is byte-identical to a receipt already on the spine — it would be dropped as DUP_IDEM, and a plan that counts it is counting a no-op`);

  return {
    todo,
    headCount: heads.length,
    // Named for what it counts: heads whose payload we READ and whose site already matches.
    alreadyPinned: heads.length - stale.length,
  };
}
