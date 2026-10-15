// arc-harnesses slot (ADR-1763, ADR-1751). The venture is born with arc in every harness: scaffold asks arc to install
// itself into the venture's working tree, and verify reads arc's own install doctor there. Both go through
// ctx.probe.arc, so this adapter runs nothing and reads no file itself. A doctor that is already clean skips the
// install, so a resumed slot writes nothing twice.
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 160) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const HARNESSES = ["claude-code", "codex", "opencode", "skills-only"];
const refuse = (code, message) => Object.assign(new Error(message), { code });

export function envContract() {
  return [];
}

// Clean means: installed, 0 missing, 0 unmanaged-conflict, and every one of the four harnesses named by the install.
function judge(d) {
  if (!d || d.installed !== true) return { ok: false, reason: `arc is not installed in the venture (${say(d && d.summary)})` };
  const c = d.counts || {};
  const missing = Number(c.missing), conflict = Number(c["unmanaged-conflict"]), placed = Number(c.placed);
  if (!Number.isSafeInteger(missing) || !Number.isSafeInteger(conflict) || !Number.isSafeInteger(placed)) return { ok: false, reason: "arc doctor answered without counts" };
  if (missing || conflict) return { ok: false, reason: `arc doctor: ${missing} missing, ${conflict} unmanaged-conflict` };
  if (placed < 1) return { ok: false, reason: "arc doctor placed no file" };
  const targets = Array.isArray(d.targets) ? d.targets.map(String) : [];
  const absent = HARNESSES.filter((h) => !targets.includes(h));
  if (absent.length) return { ok: false, reason: `the install lacks ${absent.join(", ")}` };
  return { ok: true, evidence: { placed, degraded: Number(c.degraded) || 0, missing, unmanaged_conflict: conflict, harnesses: HARNESSES.length } };
}

export async function scaffold(ctx) {
  if (!(ctx.upstream && Array.isArray(ctx.upstream.repo) && ctx.upstream.repo.length)) throw refuse("UPSTREAM_MISSING", "repo is not verified; arc installs into the repo launch made");
  const ask = ctx.probe.arc;
  const slug = say((ctx.profile && ctx.profile.slug) || "", 60);
  if (!judge(await ask("harnesses")).ok) {
    const r = await ask("harness-install");
    if (r.exit !== 0) throw refuse("INSTALL_FAILED", `arc init exited ${r.exit}${r.conflicts ? ` with ${r.conflicts} unmanaged-conflict(s)` : ""}: ${say(r.last)}`);
  }
  ctx.report({ kind: "arc-install", id: slug });
  return { files: [], resources: [{ kind: "arc-install", id: slug }], notes: ["the install is in the venture's working tree; committing it is the venture repo's next commit"] };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // The answer comes from arc's own organs through ctx.probe.arc (ADR-1751); never from state.
  const ask = ctx.probe.arc;
  try {
    const v = judge(await ask("harnesses"));
    return v.ok ? { ok: true, answerer: "arc doctor --dir", evidence: v.evidence } : v;
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// `arc uninstall` is the owner's call, not an exit step: the install is files in the venture's tree, parked with it.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "arc-install").map((r, i) => ({ order: i + 1, action: "none (arc uninstall --dir is the owner's)", resource: say(r.id, 60) })) };
}
