// docs/develop/learning-ledger.md -> records. Pure: no I/O, no spine, no globals.
//
// `#### learning: L-NNN` blocks of `key: value` lines, some of them typed links (adr:, rule:,
// fixture:, phase:, lane:) that are the whole point of the organ -- they encode bug -> root cause
// -> ADR -> rule -> fixture as committed markdown.
//
// There are no expected exclusions here, so a malformed block is a NAMED ERROR rather than a
// quiet skip: a learning that fails to parse is exactly what must not disappear. The first
// version said that in a comment and did not do it -- its near-miss guard was `####`-exact and
// case-sensitive, so `### learning:`, `####learning:` and `#### Learning:` were all invisible,
// each yielding zero records and zero exclusions. Three more things the adversarial pass found
// and this version fixes: a REPEATED key silently kept the last value and discarded the first; a
// wrapped (continuation) line was dropped mid-value; and a fenced example block inside a learning
// supplied the record's own tags and links.

import { normalize, fenceScanner } from "../lib/fields.mjs";

const HEAD_EXACT = /^####\s+learning:\s*(L-\d+)\s*$/;
const HEAD_LOOSE = /^#{1,6}\s*learning\s*:/i;
const KV = /^([a-z][a-z-]*):\s*(.*)$/;
const CONT = /^\s+\S/;
const LINK_KEYS = new Set(["adr", "rule", "fixture", "phase", "lane", "area", "check"]);

export function parse(text) {
  const lines = normalize(text).split("\n");
  const records = [];
  const exclusions = [];

  // Fence map first, so both passes below agree on which lines are quoted examples.
  const scan = fenceScanner();
  const fenced = lines.map((l) => scan(l));

  // Block boundaries next, so a block's extent never depends on how the previous one parsed.
  const heads = [];
  for (const [i, line] of lines.entries()) {
    if (fenced[i]) continue;
    const m = HEAD_EXACT.exec(line);
    if (m) { heads.push({ id: m[1], line: i + 1 }); continue; }
    if (HEAD_LOOSE.test(line)) {
      exclusions.push({ kind: "malformed", line: i + 1, reason: "learning heading that is not exactly `#### learning: L-NNN` -- it would have been skipped without trace", text: line.trim() });
    }
  }

  for (const [h, head] of heads.entries()) {
    const from = head.line; // 1-based; the body starts on the next line
    const to = h + 1 < heads.length ? heads[h + 1].line - 1 : lines.length;
    const fields = {};
    const links = {};
    let last = null;

    for (let i = from; i < to; i++) {
      const line = lines[i];
      if (fenced[i]) { last = null; continue; }
      const m = KV.exec(line);
      if (m) {
        const [, key, value] = m;
        const bag = LINK_KEYS.has(key) ? links : fields;
        if (Object.prototype.hasOwnProperty.call(bag, key)) {
          exclusions.push({ kind: "malformed", line: i + 1, reason: `learning ${head.id} repeats the key "${key}"; the first value would have been silently discarded`, text: line.trim().slice(0, 120) });
          last = null;
          continue;
        }
        bag[key] = value.trim();
        last = { bag, key };
        continue;
      }
      // A wrapped value. Keep it: the prevention text is the actionable half, and dropping its
      // second line loses the fix while leaving the record looking complete.
      if (last && CONT.test(line)) last.bag[last.key] += ` ${line.trim()}`;
      else last = null;
    }

    if (!fields.prevention && !fields["what-failed"]) {
      exclusions.push({ kind: "malformed", line: head.line, reason: `learning ${head.id} carries neither what-failed nor prevention`, text: lines[head.line - 1] });
      continue;
    }

    records.push({
      id: `learn:${head.id}`,
      organ: "learning-ledger",
      line: head.line,
      title: fields["what-failed"] ?? head.id,
      body: [fields.prevention, fields["what-failed"], fields["why-missed"]].filter(Boolean).join("\n"),
      tags: [fields.type, fields.tag, links.area, fields.verdict].filter(Boolean),
      fields: { ...fields, links },
    });
  }

  return { records, exclusions };
}
