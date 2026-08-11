// docs/develop/learning-ledger.md -> records. Pure: no I/O, no spine, no globals.
//
// `#### learning: L-NNN` blocks of `key: value` lines, some of them typed links (adr:, rule:,
// fixture:, phase:, lane:) that are the whole point of the organ -- they encode bug -> root
// cause -> ADR -> rule -> fixture as committed markdown.
//
// Unlike the other two text organs there are no expected exclusions here, so a malformed block
// is a NAMED ERROR rather than a quiet skip: a learning that fails to parse is exactly the kind
// of thing that must not disappear.

import { normalize } from "../lib/fields.mjs";

const HEAD = /^####\s+learning:\s*(L-\d+)\s*$/;
const KV = /^([a-z][a-z-]*):\s*(.*)$/;
const LINK_KEYS = new Set(["adr", "rule", "fixture", "phase", "lane", "area", "check"]);

export function parse(text) {
  const lines = normalize(text).split("\n");
  const records = [];
  const exclusions = [];

  // Block boundaries first, so a block's extent never depends on how the previous one parsed.
  const heads = [];
  for (const [i, line] of lines.entries()) {
    const m = HEAD.exec(line);
    if (m) heads.push({ id: m[1], line: i + 1 });
    else if (/^####\s+learning:/.test(line)) {
      exclusions.push({ kind: "malformed", line: i + 1, reason: "learning block heading with an unreadable id", text: line });
    }
  }

  for (const [h, head] of heads.entries()) {
    const from = head.line; // 1-based; body starts on the next line
    const to = h + 1 < heads.length ? heads[h + 1].line - 1 : lines.length;
    const fields = {};
    const links = {};
    for (let i = from; i < to; i++) {
      const m = KV.exec(lines[i]);
      if (!m) continue;
      const [, key, value] = m;
      if (LINK_KEYS.has(key)) links[key] = value.trim();
      else fields[key] = value.trim();
    }

    if (!fields.prevention && !fields["what-failed"]) {
      exclusions.push({
        kind: "malformed",
        line: head.line,
        reason: `learning ${head.id} carries neither what-failed nor prevention`,
        text: lines[head.line - 1],
      });
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
