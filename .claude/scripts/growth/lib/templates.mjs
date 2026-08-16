// growth/templates -- REQ-04, ADR-1106. Two title templates, versioned as files, assigned by
// sha256(slug), tagged in the payload.
//
// WHAT THIS IS NOT. It is not an A/B framework. Evolve owns experiments; this is two files and a
// hash, and the spec names "a general A/B framework" as a rabbit hole by title. There is no
// optimisation logic here, no winner, no verdict -- and there cannot be one at this volume:
// five articles per arm against evolve's ~1,900-per-arm floor is a COLLECTABLE STREAM AND NOTHING
// MORE. Anyone reading a CTR difference between the arms during this cycle is reading noise.
//
// Assignment is a pure function of the slug, so a replay re-derives the same arm for every article
// that ever published, and no human can move an article between arms without changing its slug --
// which changes its URL, which is already a visible act.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../../hq/lib/canonical.mjs";

export class TemplateError extends Error {
  constructor(code, message) { super(message); this.name = "TemplateError"; this.code = code; }
}

// THE CLOSED SET. `validate-content.mjs` enforces the same two values on the receipt, and
// `tests/growth-publish.bats` derives the list from the FILES on disk and compares it to this
// constant -- one list, two readers, and a test that fails when they drift apart.
//
// A validator that read the directory itself would be a validator with a filesystem dependency,
// which is how a spine check becomes environment-dependent. A constant plus a drift test is the
// honest trade: the coupling is visible and something fails when it breaks.
export const TEMPLATE_IDS = Object.freeze(["title-a", "title-b"]);
const TEMPLATE_ID_SET = new Set(TEMPLATE_IDS);

export const isTemplateId = (id) => typeof id === "string" && TEMPLATE_ID_SET.has(id);

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Read the versioned template files and check they are the set this code believes in.
 *
 * The frontmatter's `template_id` must match the FILENAME. A file named `title-b.md` declaring
 * `template_id: title-a` would give two files one identity, and the arm a slug resolved to would
 * depend on which file happened to be read second.
 */
export function loadTemplates(dir) {
  let names;
  try {
    names = readdirSync(dir).filter((f) => /^title-[a-z0-9-]+\.md$/.test(f)).sort();
  } catch (e) {
    throw new TemplateError("NO_TEMPLATES", `template directory ${dir} cannot be read: ${e.message}`);
  }
  const out = [];
  for (const name of names) {
    const text = readFileSync(join(dir, name), "utf8").replace(/^﻿/, "");
    const m = text.match(FM_RE);
    if (!m) throw new TemplateError("BAD_TEMPLATE", `${name} has no frontmatter block`);
    const id = (m[1].match(/^template_id:\s*(\S+)\s*$/m) || [])[1];
    const version = (m[1].match(/^version:\s*(\S+)\s*$/m) || [])[1];
    if (!id) throw new TemplateError("BAD_TEMPLATE", `${name} declares no template_id`);
    if (!version) throw new TemplateError("BAD_TEMPLATE", `${name} declares no version`);
    if (id !== name.replace(/\.md$/, ""))
      throw new TemplateError("BAD_TEMPLATE", `${name} declares template_id ${JSON.stringify(id)} -- the id must equal the filename, or two files can claim one identity`);
    if (!isTemplateId(id))
      throw new TemplateError("UNKNOWN_TEMPLATE", `${name} is not in the enumerated set ${TEMPLATE_IDS.join(", ")} -- adding a template is an ADR (ADR-1106), not a file drop`);
    out.push({ template_id: id, version, file: name });
  }
  if (out.length !== TEMPLATE_IDS.length)
    throw new TemplateError("BAD_TEMPLATE", `${dir} holds ${out.length} template(s), the enumerated set has ${TEMPLATE_IDS.length} (${TEMPLATE_IDS.join(", ")})`);
  return out;
}

/**
 * Assign an arm. `sha256(slug)` reduced to one of the enumerated templates.
 *
 * DETERMINISTIC AND REPLAYABLE, which is the whole requirement. The reduction reads the FIRST BYTE
 * of the digest rather than the last character of the hex string: both are uniform, but a byte is
 * what the digest actually is and a hex character is a rendering of it.
 *
 * Random assignment is refused (it does not replay) and a human may not cherry-pick an arm (that
 * confounds the arms at the source) -- ADR-1106 decided both.
 */
export function assignArm(slug) {
  if (typeof slug !== "string" || slug === "")
    throw new TemplateError("BAD_SLUG", "assignArm needs a non-empty slug string");
  const digest = sha256Hex(slug);
  if (!/^[0-9a-f]{64}$/.test(digest))
    throw new TemplateError("BAD_DIGEST", `sha256Hex returned ${JSON.stringify(digest)}, which is not a sha256 hex digest`);
  const firstByte = parseInt(digest.slice(0, 2), 16);
  return TEMPLATE_IDS[firstByte % TEMPLATE_IDS.length];
}

/**
 * Reject a template_id that is not in the enumerated set.
 *
 * The field is validated on its VALUES, never merely on its presence. The memory lane shipped an
 * enum enforced on a field's NAME on 2026-08-12 and a confident wrong value passed as clean for a
 * whole cycle.
 */
export function assertTemplateId(id) {
  if (typeof id !== "string")
    throw new TemplateError("BAD_TEMPLATE_ID", `template_id must be a string, got ${typeof id}`);
  if (!isTemplateId(id))
    throw new TemplateError("BAD_TEMPLATE_ID", `template_id ${JSON.stringify(id)} is not one of ${TEMPLATE_IDS.join(", ")}`);
  return id;
}
