// docs/adr/*.md -> one record per file. Pure: no I/O, no spine, no globals.
//
// Called once per file with `parse(text, path)`, because ADR-0702 requires the citation to
// carry BOTH `adr:<NNNN>` and the exact repo-relative path, and neither is recoverable from
// the body alone -- the number lives in the filename. The caller globs and supplies the path;
// this adapter still opens nothing.
//
// An unparseable header is never a skip. The ADR is indexed title-only and the defect is named,
// because a decision that cannot be found is worse than one found with a thin body.

import { normalize } from "../lib/fields.mjs";

const FILENAME = /^(\d{4})-(.+)\.md$/;
const STATUS = /^\*\*Status:\*\*\s*(.+?)\s*$/;
const META = /^\*\*[A-Za-z][A-Za-z -]*:\*\*/;

export function parse(text, path) {
  const base = String(path).replace(/\\/g, "/").split("/").pop();
  const m = FILENAME.exec(base ?? "");
  if (!m) {
    return { records: [], exclusions: [{ kind: "malformed", line: 1, reason: `filename "${base}" is not <NNNN>-<slug>.md`, text: path }] };
  }
  const [, number, slug] = m;
  const lines = normalize(text).split("\n");
  const exclusions = [];

  let title = null;
  let titleLine = 1;
  for (const [i, line] of lines.entries()) {
    if (/^#\s+/.test(line)) { title = line.replace(/^#\s+/, "").trim(); titleLine = i + 1; break; }
  }
  if (!title) {
    title = slug.replace(/-/g, " ");
    exclusions.push({ kind: "malformed", line: 1, reason: `ADR ${number} has no H1 title; indexed title-only from its slug`, text: path });
  }

  let status = null;
  for (const line of lines) {
    const s = STATUS.exec(line);
    if (s) { status = s[1]; break; }
  }
  if (!status) {
    status = "unknown";
    exclusions.push({ kind: "malformed", line: 1, reason: `ADR ${number} has no **Status:** line; recorded as unknown`, text: path });
  }

  // First real paragraph: skip the H1, the `**Key:** value` metadata block, and headings.
  const para = [];
  for (let i = titleLine; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { if (para.length) break; else continue; }
    if (META.test(line) || /^#{1,6}\s/.test(line)) { if (para.length) break; else continue; }
    para.push(line.trim());
  }

  return {
    records: [{
      id: `adr:${number}`,
      organ: "adr",
      line: titleLine,
      title,
      body: `${title}\n${para.join(" ")}`,
      tags: ["adr", status.replace(/[^a-z]/gi, "").toLowerCase()].filter(Boolean),
      fields: { number, slug, title, status, summary: para.join(" ") },
    }],
    exclusions,
  };
}
