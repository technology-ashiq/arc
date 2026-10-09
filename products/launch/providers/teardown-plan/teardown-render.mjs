// teardown-plan slot (ADR-1704, ADR-1714, ADR-1751). The exit is rendered, never applied in v1: export, notice, cancel,
// park (every recorded resource in reverse dependency order), archive. This slot creates nothing; it is verified by the
// render arc's runner produces from the board, which must carry all five steps.
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const STEPS = ["1. export", "2. notice", "3. cancel", "4. park", "5. archive"];

export function envContract() {
  return [];
}

export async function scaffold(ctx) {
  const slug = String((ctx.profile && ctx.profile.slug) || "");
  ctx.report({ kind: "teardown-render", id: slug });
  return { files: [], resources: [{ kind: "teardown-render", id: slug }], notes: ["arc-launch teardown --plan prints it"] };
}

async function probe(ctx, ask) {
  const t = await ask("teardown");
  const lines = Array.isArray(t && t.lines) ? t.lines.map(String) : [];
  const missing = STEPS.filter((s) => !lines.some((l) => l.startsWith(s)));
  if (missing.length) return { ok: false, reason: `the rendered exit lacks ${missing.join(", ")}` };
  return { ok: true, answerer: "arc teardown render", evidence: { steps: STEPS.length, resources: Number(t.resources) || 0 } };
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
  return { steps: ctx.resources.filter((r) => r.kind === "teardown-render").map((r, i) => ({ order: i + 1, action: "none (a render)", resource: say(r.id, 60) })) };
}
