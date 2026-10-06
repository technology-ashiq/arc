// discover/export -- an approved winner -> products/launch/ventures/<slug>.venture.yaml + .hunt.md
// (ADR-1905, ADR-1912). Parser-class: everything written here came from the web or the inbox.
//
// The yaml is written by a SERIALIZER that emits exactly launch's LAU-J fields, each value checked
// against launch's own PROFILE_FIELDS (imported, never copied) or a closed grammar before a byte
// is written. No value is interpolated from mined text: the slug and brand name come from the
// owner's niche grammar, evidence ids from `hn:<digits>`, money as an integer.

import { PROFILE_FIELDS } from "../../launch/lib/catalog.mjs";
import { ABSENT } from "./normalize.mjs";

export const SLUG_RE = /^[a-z][a-z0-9-]{1,40}$/;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const NAME_RE = /^[a-z0-9][a-z0-9 -]{1,58}[a-z0-9]$/;
const TAG_RE = /^[a-z][a-z0-9-]{1,20}$/;
const EVID_RE = /^hn:[0-9]{1,12}$/;
const OVERRIDABLE = ["type", "region", "payment_model", "tenancy", "ai", "honesty_class"];

export class ExportError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/**
 * The approval reason may carry `key=value` overrides for the profile enums, nothing else.
 * Any token shaped `x=y` with an unknown key or a value outside launch's enum is REFUSED -- an
 * override the owner typed wrong must not silently fall back to a default.
 */
export function overridesFrom(reason) {
  const out = {};
  for (const m of String(reason || "").matchAll(/([A-Za-z_]+)=(\S+)/g)) {
    const [, k, v] = m;
    if (!OVERRIDABLE.includes(k)) throw new ExportError("BAD_OVERRIDE", `override ${k} is not one of ${OVERRIDABLE.join(", ")}`);
    if (!PROFILE_FIELDS[k].has(v)) throw new ExportError("BAD_OVERRIDE", `override ${k}=${JSON.stringify(v)} is not one of ${[...PROFILE_FIELDS[k]].join(" | ")}`);
    out[k] = v;
  }
  return out;
}

/** Build the profile object and check every field; throws ExportError naming the field. */
export function buildProfile({ slug, niche, defaults, overrides }) {
  if (!SLUG_RE.test(slug) || RESERVED.test(slug)) throw new ExportError("BAD_SLUG", `slug ${JSON.stringify(slug)} fails launch's slug grammar`);
  if (!NAME_RE.test(niche)) throw new ExportError("BAD_NAME", "brand name must be the niche grammar");
  const p = { slug };
  for (const k of ["type", "region", "payment_model", "tenancy", "ai"]) p[k] = String(overrides[k] ?? defaults[k]);
  p.honesty_class = overrides.honesty_class ?? "rehearsal";
  for (const k of Object.keys(PROFILE_FIELDS))
    if (!PROFILE_FIELDS[k].has(p[k])) throw new ExportError("SHAPE", `profile field ${k}=${JSON.stringify(p[k])} is not one of ${[...PROFILE_FIELDS[k]].join(" | ")}`);
  const comp = Array.isArray(defaults.compliance) ? defaults.compliance : [];
  if (comp.length === 0 || !comp.every((c) => TAG_RE.test(c))) throw new ExportError("SHAPE", "venture_defaults.compliance must be a non-empty list of lowercase tags");
  p.compliance = comp;
  p.brand = { name: niche, domain: "unassigned" };
  return p;
}

/** The serializer: fixed field order, LF, one scalar per line, nothing that needs quoting. */
export function ventureYaml(p, { seed, huntFile }) {
  const seedIds = (seed.evidence || []).filter((e) => EVID_RE.test(e));
  if (seedIds.length !== (seed.evidence || []).length) throw new ExportError("SHAPE", "money seed evidence must be hn:<digits> ids");
  const est = seed.estimate_minor === ABSENT ? ABSENT : seed.estimate_minor;
  if (est !== ABSENT && !Number.isSafeInteger(est)) throw new ExportError("SHAPE", "estimate_minor must be an integer or ABSENT");
  if (!/^[a-z0-9-]+\.hunt\.md$/.test(huntFile)) throw new ExportError("SHAPE", "hunt file name");
  const lines = [
    "# venture.yaml -- written by arc discover from an owner-approved hunt (ADR-1905); launch reads it (ADR-1710).",
    `# evidence: ${huntFile}`,
    `# money_signal.estimate_minor: ${est}${est === ABSENT ? "" : " USD"} -- seed for the first revenue.simulated, never emitted by discover (REQ-09); evidence: ${seedIds.join(", ") || "none"}`,
    `slug: ${p.slug}`,
    `type: ${p.type}`,
    `region: ${p.region}`,
    `payment_model: ${p.payment_model}`,
    `tenancy: ${p.tenancy}`,
    `ai: ${p.ai}`,
    `honesty_class: ${p.honesty_class}`,
    "compliance:",
    ...p.compliance.map((c) => `  - ${c}`),
    "brand:",
    `  name: ${p.brand.name}`,
    `  domain: ${p.brand.domain}`,
  ];
  return lines.join("\n") + "\n";
}

/** Markdown-escape a normalized single-line title so it cannot open a link, an html tag or a code span. */
const md = (s) => String(s).replace(/[\\`*_[\]<>|#!]/g, (c) => "\\" + c);

export function huntMarkdown({ slug, niche, question, cluster, score, decision, request }) {
  const out = [
    `# ${slug} -- hunt evidence`,
    "",
    `- niche: ${niche}`,
    `- council question: ${md(question)}`,
    `- score: ${score.score} (dropped terms: ${score.dropped.join(", ") || "none"})`,
    `- approval request: ${request} · decision: ${decision}`,
    `- cluster: ${cluster.cluster_fp} · tokens: ${cluster.top_tokens.map(md).join(", ")}`,
    "",
    "## Evidence",
    "",
    ...cluster.members.map((m) => `- [${m.source_id}](${m.source_url}) ${md(m.title)}`),
    "",
  ];
  return out.join("\n");
}
