// spine `decision.recorded` -> records. Pure: no I/O, no spine access of its own.
//
// ADR-0703 forbids memory from opening `events/**`, `*.jsonl` or `state.db`; the spine is
// reached ONLY through `.claude/scripts/hq/spine.mjs`, and `spine-reader-lint.sh` greps for
// exactly those tokens. So this adapter has no text to parse and takes no path: the builder
// does the reading through the reader library and hands over the already-read event array,
// which is what keeps this file pure AND keeps the lint green.
//
// `decision.recorded` has a CLOSED payload -- decides / verdict / reason, nothing else. A row
// missing any of the three is a named exclusion, not a half-record: a decision whose verdict
// or reason cannot be read is not a decision anyone should be shown.

const VERDICTS = new Set(["approve", "reject"]);

/** @param events array of `{ event, day, seq }` as returned by spine.mjs query()/readAll(). */
export function fromEvents(events) {
  const records = [];
  const exclusions = [];

  for (const wrapper of events ?? []) {
    const e = wrapper?.event ?? wrapper;
    if (!e || e.kind !== "decision.recorded") continue;

    const p = e.payload ?? {};
    const where = { kind: "malformed", line: wrapper?.seq ?? 0, text: e.id ?? "(no id)" };

    if (!e.id) { exclusions.push({ ...where, reason: "decision.recorded with no event id" }); continue; }
    if (!VERDICTS.has(p.verdict)) {
      exclusions.push({ ...where, reason: `verdict "${p.verdict}" is not exactly approve or reject` });
      continue;
    }
    if (typeof p.reason !== "string" || !p.reason.trim()) {
      exclusions.push({ ...where, reason: "decision.recorded with an empty reason" });
      continue;
    }

    records.push({
      id: `spine:decision/${e.id}`,
      organ: "decisions",
      line: 0, // a spine event has no file line; the citation is the ULID itself
      title: p.reason,
      body: `${p.verdict}: ${p.reason}`,
      tags: ["decision", p.verdict],
      fields: { ulid: e.id, ts: e.ts ?? null, decides: p.decides ?? null, verdict: p.verdict, reason: p.reason },
    });
  }

  // ULID-ascending, so the index order is a property of the data and not of how the spine
  // happened to be read. ADR-0030 warns that same-millisecond ULIDs from separate processes
  // carry no relative order -- which is exactly why the index sorts by a total, stable key of
  // its own rather than inheriting append order.
  records.sort((a, b) => (a.fields.ulid < b.fields.ulid ? -1 : a.fields.ulid > b.fields.ulid ? 1 : 0));
  return { records, exclusions };
}
