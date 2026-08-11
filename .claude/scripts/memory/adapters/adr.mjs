// docs/adr/*.md -> one record per file. Pure: no I/O, no spine, no globals.
//
// Called once per file with `parse(text, path)`, because ADR-0702 requires the citation to carry
// BOTH `adr:<NNNN>` and the exact repo-relative path, and neither is recoverable from the body
// alone -- the number lives in the filename. The caller globs and supplies the path; this adapter
// opens nothing.
//
// An unparseable header is never a skip. The ADR is indexed title-only and the defect is named,
// because a decision that cannot be found is worse than one found with a thin body.
//
// FENCE TRACKING is not decoration. The adversarial pass showed both scans taking the first regex
// match ANYWHERE in the file: an ADR carrying a template block was indexed with the template's
// heading as its title and the template's `**Status:** Proposed` as its status, while the real
// superseded status sat further down. Two of the 150 live ADRs already carry a second
// `**Status:**` line under an `## Amendment` heading -- first-wins is correct there only by luck,
// and the day an amendment records `superseded` the index would keep saying accepted with no
// exclusion at all. So: scan outside fences, and NAME a second status rather than silently
// preferring one.

import { normalize, fenceScanner } from "../lib/fields.mjs";

const FILENAME = /^(\d{4})-(.+)\.md$/i;
const STATUS = /^\*\*Status:\*\*\s*(.+?)\s*$/;
const META = /^\*\*[A-Za-z][A-Za-z -]*:\*\*/;
// The statuses an ADR may carry. A free-text status is kept verbatim in `fields.status`; only the
// TAG is constrained, because a tag is a retrieval key and "Accepted, superseded by ADR-0801"
// must not quietly tag itself `accepted`.
const KNOWN = new Set(["proposed", "accepted", "rejected", "superseded", "deprecated", "amended"]);

export function parse(text, path) {
  const base = String(path).replace(/\\/g, "/").split("/").pop();
  const m = FILENAME.exec(base ?? "");
  if (!m) {
    return { records: [], exclusions: [{ kind: "malformed", line: 1, reason: `filename ${JSON.stringify(base)} is not <NNNN>-<slug>.md`, text: path }] };
  }
  const [, number, slug] = m;
  const lines = normalize(text).split("\n");
  const scan = fenceScanner();
  const fenced = lines.map((l) => scan(l));
  const exclusions = [];

  let title = null;
  let titleLine = 1;
  const statuses = [];
  for (const [i, line] of lines.entries()) {
    if (fenced[i]) continue;
    if (title === null && /^#\s+/.test(line)) { title = line.replace(/^#\s+/, "").trim(); titleLine = i + 1; }
    const s = STATUS.exec(line);
    if (s) statuses.push({ value: s[1], line: i + 1 });
  }

  if (title === null) {
    title = slug.replace(/-/g, " ");
    exclusions.push({ kind: "malformed", line: 1, reason: `ADR ${number} has no H1 title outside a code fence; indexed title-only from its slug`, text: path });
  }

  let status;
  if (statuses.length === 0) {
    status = "unknown";
    exclusions.push({ kind: "malformed", line: 1, reason: `ADR ${number} has no **Status:** line outside a code fence; recorded as unknown`, text: path });
  } else {
    status = statuses[0].value;
    if (statuses.length > 1) {
      exclusions.push({
        kind: "malformed",
        line: statuses[1].line,
        reason: `ADR ${number} carries ${statuses.length} **Status:** lines (also at line ${statuses.map((s) => s.line).slice(1).join(", ")}); the FIRST is indexed and the rest are unread -- an amendment recording a new status would not be seen`,
        text: statuses[1].value.slice(0, 100),
      });
    }
  }

  const words = String(status).toLowerCase().match(/[a-z]+/g) ?? [];
  const found = words.filter((w) => KNOWN.has(w));
  let tag = found[0] ?? "unknown-status";
  if (found.length === 0) {
    exclusions.push({ kind: "malformed", line: statuses[0]?.line ?? 1, reason: `ADR ${number} status ${JSON.stringify(String(status).slice(0, 60))} contains no known status word; tagged unknown-status`, text: path });
  } else if (found.length > 1) {
    // The real ambiguity, and the only one worth a name: TWO status words in one line, e.g.
    // "Accepted, superseded by ADR-0801". Tagging that `accepted` is exactly backwards.
    //
    // Decoration is NOT flagged. 14 of the 150 live ADRs write `**Status:** accepted · 2026-07-09`
    // or `accepted (policy frozen; ...)` -- house style, not a defect, and an earlier version of
    // this rule reported every one of them as malformed. A gate that cries wolf on the normal case
    // makes its own "0 malformed" line worthless, which is the failure mode this phase is about.
    exclusions.push({ kind: "malformed", line: statuses[0].line, reason: `ADR ${number} status names ${found.length} different status words (${found.join(", ")}) in one line: ${JSON.stringify(String(status).slice(0, 70))} -- the tag uses the first, which may be the wrong one`, text: path });
  }

  // First real paragraph, outside fences: skip the H1, the `**Key:** value` metadata, and headings.
  const para = [];
  for (let i = titleLine; i < lines.length; i++) {
    if (fenced[i]) { if (para.length) break; else continue; }
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
      tags: ["adr", tag],
      fields: { number, slug, title, status, summary: para.join(" ") },
    }],
    exclusions,
  };
}
