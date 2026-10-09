// face-room slot (ADR-1704, ADR-1711, ADR-1751). The venture appears in the face when the face contract seats it: in
// the ventures room (a registered venture) or a planned room (`planned` is allowed in v1). Seating is the face lane's
// contract edit, never launch's: this slot creates nothing and is verified by the contract arc holds.
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");

export function envContract() {
  return [];
}

export async function scaffold(ctx) {
  const slug = String((ctx.profile && ctx.profile.slug) || "");
  ctx.report({ kind: "face-seat", id: slug });
  return { files: [], resources: [{ kind: "face-seat", id: slug }], notes: ["the face lane seats the venture in initiatives/face/contracts/expected-set.json"] };
}

async function probe(ctx, ask) {
  const f = await ask("face");
  if (f && f.room) return { ok: true, answerer: "arc face contract", evidence: { room: say(f.room, 40), status: "built" } };
  if (f && f.planned) return { ok: true, answerer: "arc face contract", evidence: { room: say(f.planned, 40), status: "planned" } };
  return { ok: false, reason: "the face contract seats this venture in no room (ventures or planned)" };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // The answer comes from arc's own organs through ctx.probe.arc (ADR-1751); never from state.
  const ask = ctx.probe.arc;
  try {
    return await probe(ctx, ask);
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "face-seat").map((r, i) => ({ order: i + 1, action: "the face lane un-seats the venture at archive", resource: say(r.id, 60) })) };
}
