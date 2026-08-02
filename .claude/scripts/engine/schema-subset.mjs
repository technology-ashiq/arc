#!/usr/bin/env node
/**
 * schema-subset.mjs -- the ADR-0200 frozen JSON-Schema subset.
 *
 * Node's stdlib has no JSON-Schema validator and arc core is zero-dep, so the output
 * contract is a SUBSET validated by hand. The subset is closed at eight keywords, and an
 * unsupported keyword is a lint failure at AUTHORING time rather than a silently
 * unenforced field at run time. That ordering is the whole point: a schema that claims a
 * constraint nobody checks is worse than no schema, because it reads as a guarantee.
 *
 * Keywords: type · properties · required · enum · items · additionalProperties ·
 *           minLength · pattern
 * Types:    object · array · string · number · integer · boolean · null
 *
 * Deliberately absent, and rejected by name rather than ignored: $ref, oneOf/anyOf/allOf,
 * format, minimum/maximum, additionalItems, patternProperties, definitions. If the output
 * contract ever needs draft-07 semantics it cannot express, ADR-0200's consequences say
 * the contract narrows to "shape plus required keys" and SAYS so -- it never implies a
 * conformance it does not have.
 *
 * Zero dependencies, Node 18+.
 */

export const KEYWORDS = Object.freeze([
  "type", "properties", "required", "enum", "items", "additionalProperties", "minLength", "pattern",
]);

export const TYPES = Object.freeze(["object", "array", "string", "number", "integer", "boolean", "null"]);

const KW = new Set(KEYWORDS);
const TY = new Set(TYPES);

/**
 * Validate the SCHEMA DOCUMENT itself against the subset.
 * Returns a list of findings; empty means the schema is expressible and fully enforced.
 * `path` is dotted for humans -- "properties.commits.items" beats "node 4".
 */
export function validateSchemaDoc(schema, path = "output") {
  const out = [];
  const at = (p, what, expected, found, example) => out.push({ path: p, what, expected, found, example });

  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    at(path, "schema node is not an object", "a mapping of keywords", String(schema), "type: object");
    return out;
  }

  const keys = Object.keys(schema);

  // An EMPTY schema constrains nothing while reading as a contract. `output: {}` passed the
  // caller's truthiness guard and then validated every possible document.
  if (keys.length === 0) {
    at(path, "schema node is empty", "at least a `type`", "{}", "type: object");
    return out;
  }

  // A keyword that can never fire for this node's `type` is a claimed constraint nobody
  // checks -- exactly what this module's header says cannot exist. It read as a guarantee
  // and enforced nothing: `{type: object, minLength: 5}`, `{type: number, pattern: ...}` and
  // `{type: string, required: [x]}` all linted clean and were provable no-ops against data.
  const APPLIES_TO = {
    properties: ["object"], required: ["object"], additionalProperties: ["object"],
    items: ["array"], minLength: ["string"], pattern: ["string"],
  };
  const t = typeof schema.type === "string" ? schema.type : null;
  for (const k of keys) {
    const only = APPLIES_TO[k];
    if (!only) continue;
    if (!t) {
      at(`${path}.${k}`, `\`${k}\` needs an explicit \`type\` to be enforceable`, `type: ${only.join(" or ")}`, "no type declared", `type: ${only[0]}`);
    } else if (!only.includes(t)) {
      at(`${path}.${k}`, `\`${k}\` never applies to type \`${t}\` — it would be silently unenforced`, `type: ${only.join(" or ")}`, `type: ${t}`, `drop \`${k}\`, or correct the type`);
    }
  }

  // `additionalProperties: false` and `required` are both no-ops without `properties`:
  // validateData guards on `schema.properties`, so dropping it deletes the constraint AND
  // the cross-check that `required` names real properties.
  for (const k of ["additionalProperties", "required"]) {
    if (k in schema && !("properties" in schema)) {
      at(`${path}.${k}`, `\`${k}\` without \`properties\` enforces nothing`, "a properties block alongside it", `${k} declared alone`, "add properties, or drop this keyword");
    }
  }

  for (const k of keys) {
    if (!KW.has(k)) {
      at(
        `${path}.${k}`,
        `unsupported schema keyword \`${k}\``,
        `one of: ${KEYWORDS.join(", ")}`,
        k,
        "drop it, or narrow the contract and say so (ADR-0200)",
      );
    }
  }

  if ("type" in schema) {
    const t = schema.type;
    if (typeof t !== "string" || !TY.has(t)) {
      at(`${path}.type`, "unknown or non-string `type`", `one of: ${TYPES.join(", ")}`, JSON.stringify(t), "type: object");
    }
  }

  if ("required" in schema) {
    const r = schema.required;
    if (!Array.isArray(r) || r.some((x) => typeof x !== "string")) {
      at(`${path}.required`, "`required` is not a list of strings", "a list of property names", JSON.stringify(r), "required: [sha, subject]");
    } else if (schema.properties && typeof schema.properties === "object") {
      for (const name of r) {
        if (!(name in schema.properties)) {
          at(
            `${path}.required`,
            `\`required\` names \`${name}\`, which \`properties\` does not define`,
            "every required name defined in properties",
            name,
            "add it to properties, or remove it from required",
          );
        }
      }
    }
  }

  if ("enum" in schema) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) {
      at(`${path}.enum`, "`enum` is not a non-empty list", "a list of allowed values", JSON.stringify(schema.enum), "enum: [ok, fail, partial]");
    }
  }

  if ("minLength" in schema && (!Number.isInteger(schema.minLength) || schema.minLength < 0)) {
    at(`${path}.minLength`, "`minLength` is not a non-negative integer", "an integer >= 0", JSON.stringify(schema.minLength), "minLength: 1");
  }

  if ("pattern" in schema) {
    if (typeof schema.pattern !== "string") {
      at(`${path}.pattern`, "`pattern` is not a string", "a regex string", JSON.stringify(schema.pattern), 'pattern: "^[0-9a-f]{7,40}$"');
    } else {
      try {
        new RegExp(schema.pattern);
      } catch (e) {
        at(`${path}.pattern`, `\`pattern\` is not a valid regex (${e.message})`, "a compilable regex", schema.pattern, 'pattern: "^[a-z-]+$"');
      }
    }
  }

  if ("additionalProperties" in schema && typeof schema.additionalProperties !== "boolean") {
    at(
      `${path}.additionalProperties`,
      "`additionalProperties` is not a boolean",
      "true or false (a schema value is outside the subset)",
      JSON.stringify(schema.additionalProperties),
      "additionalProperties: false",
    );
  }

  if ("properties" in schema) {
    const p = schema.properties;
    if (p === null || typeof p !== "object" || Array.isArray(p)) {
      at(`${path}.properties`, "`properties` is not a mapping", "a mapping of name to schema", JSON.stringify(p), "properties:\n  sha:\n    type: string");
    } else {
      for (const [name, sub] of Object.entries(p)) out.push(...validateSchemaDoc(sub, `${path}.properties.${name}`));
    }
  }

  if ("items" in schema) out.push(...validateSchemaDoc(schema.items, `${path}.items`));

  return out;
}

/**
 * Validate DATA against a schema already known to be within the subset. Used by the eval
 * fixtures in Phase 00 and by `arc-run`'s output check in Phase 02.
 * Returns a list of `{ path, what }`; empty means conforming.
 */
export function validateData(schema, data, path = "$") {
  const out = [];
  const bad = (p, what) => out.push({ path: p, what });
  if (!schema || typeof schema !== "object") return out;

  if ("type" in schema) {
    const t = schema.type;
    const actual = data === null ? "null" : Array.isArray(data) ? "array" : typeof data;
    const ok =
      (t === "integer" && Number.isInteger(data)) ||
      (t === "number" && typeof data === "number") ||
      (t === "null" && data === null) ||
      (t === "array" && Array.isArray(data)) ||
      (t === "object" && actual === "object") ||
      (t === "string" && actual === "string") ||
      (t === "boolean" && actual === "boolean");
    if (!ok) {
      bad(path, `expected type ${t}, found ${actual}`);
      return out; // one type error per node; cascading children would just be noise
    }
  }

  if ("enum" in schema && Array.isArray(schema.enum) && !schema.enum.some((v) => v === data)) {
    bad(path, `value ${JSON.stringify(data)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  if ("minLength" in schema && typeof data === "string" && data.length < schema.minLength) {
    bad(path, `string shorter than minLength ${schema.minLength}`);
  }
  if ("pattern" in schema && typeof data === "string") {
    let re = null;
    try { re = new RegExp(schema.pattern); } catch { /* schema-doc validation already reported it */ }
    if (re && !re.test(data)) bad(path, `string does not match pattern ${schema.pattern}`);
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const name of schema.required || []) {
      if (!(name in data)) bad(`${path}.${name}`, "required property is absent");
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const k of Object.keys(data)) {
        if (!(k in schema.properties)) bad(`${path}.${k}`, "property not allowed (additionalProperties: false)");
      }
    }
    if (schema.properties) {
      for (const [k, sub] of Object.entries(schema.properties)) {
        if (k in data) out.push(...validateData(sub, data[k], `${path}.${k}`));
      }
    }
  }

  if (Array.isArray(data) && schema.items) {
    data.forEach((v, idx) => out.push(...validateData(schema.items, v, `${path}[${idx}]`)));
  }

  return out;
}
