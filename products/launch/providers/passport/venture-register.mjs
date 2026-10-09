// passport slot on venture-register (ADR-1704, ADR-1711, ADR-1751). A venture's passport is its kill lines on
// ventures.yaml and its PORTFOLIO row, written on a proposal branch behind an approved receipt (ADR-1342). A rehearsal
// venture never gets one: this slot runs `venture-register --dry-run` with the profile's kill lines and repository,
// and the dry run's exit 0 and digest line are the receipt (REQ-10). A real venture's passport is the owner's run.
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");

export function envContract() {
  return [];
}

export async function scaffold(ctx) {
  const slug = String((ctx.profile && ctx.profile.slug) || "");
  ctx.report({ kind: "passport-dry-run", id: slug });
  return { files: [], resources: [{ kind: "passport-dry-run", id: slug }], notes: ctx.profile && ctx.profile.honesty_class === "rehearsal" ? ["rehearsal: dry run only"] : ["the owner runs venture-register --expect to write the passport"] };
}

async function probe(ctx, ask) {
  const p = await ask("passport");
  if (!p || p.exit !== 0) return { ok: false, reason: `venture-register --dry-run exited ${say(p && p.exit, 6)}: ${say(p && p.last, 160)}` };
  return { ok: true, answerer: "arc venture-register --dry-run", evidence: { exit: 0, digest: say(p.digest, 160) } };
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

// A dry run wrote nothing; a real passport is retired by the owner's own venture-register change.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "passport-dry-run").map((r, i) => ({ order: i + 1, action: "none (dry run wrote nothing)", resource: say(r.id, 60) })) };
}
