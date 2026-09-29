/**
 * emit.mjs -- write a role card or team manifest back as YAML the ADR-0200 subset parser reads.
 *
 * The subset rejects non-empty flow collections, so lists and maps are always written in block
 * form and only the empty literals `[]` / `{}` are inline. Every string is single-quoted (a
 * lone `'` doubled): a plain scalar like `no`, `null` or `L1: x` would otherwise be read back as
 * something other than the text that was written. The round trip parse(emit(x)) == x is what
 * org-catalog's own test asserts, so a card written here is a card the gate reads unchanged.
 */

import { parseYamlSubset } from "../../engine/yaml-subset.mjs";

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function scalar(v) {
  if (v === null || v === undefined) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (typeof v === "number") return String(v);
  return q(v);
}

function emitValue(key, v, indent, out) {
  const pad = " ".repeat(indent);
  const head = key === null ? `${pad}-` : `${pad}${key}:`;
  if (Array.isArray(v)) {
    if (v.length === 0) { out.push(`${head} []`); return; }
    out.push(head);
    for (const item of v) emitItem(item, indent + 2, out);
  } else if (v !== null && typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 0) { out.push(`${head} {}`); return; }
    out.push(head);
    for (const k of keys) emitValue(k, v[k], indent + 2, out);
  } else out.push(`${head} ${scalar(v)}`);
}

function emitItem(item, indent, out) {
  const pad = " ".repeat(indent);
  if (item !== null && typeof item === "object" && !Array.isArray(item) && Object.keys(item).length) {
    // `- key: value` then the siblings aligned under the first key.
    const [first, ...rest] = Object.keys(item);
    const sub = [];
    emitValue(first, item[first], indent + 2, sub);
    sub[0] = `${pad}- ${sub[0].trimStart()}`;
    out.push(...sub);
    for (const k of rest) emitValue(k, item[k], indent + 2, out);
  } else if (Array.isArray(item)) {
    throw new Error("emit: a list directly inside a list is outside the card grammar");
  } else {
    // The subset parser reads a sequence item holding ": " as a one-key MAPPING even when the
    // item is quoted (`- 'a: b'` -> {"'a": "b'"}) -- found writing the first org cards. Refuse
    // loudly here rather than write a file the gate would read back as something else.
    if (typeof item === "string" && /:(\s|$)/.test(item))
      throw new Error(`emit: list item ${JSON.stringify(item)} contains a key separator (":" then a space or line end), which the yaml subset misreads as a mapping`);
    out.push(`${pad}- ${scalar(item)}`);
  }
}

/** @param doc a plain object; @param header optional leading comment lines */
export function emitYaml(doc, header = []) {
  const out = header.map((l) => (l ? `# ${l}` : "#"));
  for (const k of Object.keys(doc)) emitValue(k, doc[k], 0, out);
  const text = out.join("\n") + "\n";
  // The guard above names ONE misread the parser is known for; this proves there is no other.
  // Whatever this module writes must read back as exactly what it was given, or nothing is written.
  const back = parseYamlSubset(text);
  if (!back.ok || JSON.stringify(back.value) !== JSON.stringify(doc))
    throw new Error(`emit: the yaml subset does not read this document back unchanged (${back.ok ? "values differ" : back.error.message})`);
  return text;
}
