// The slot DAG (ADR-1717): every edge resolves, no cycle, no edge from a core slot into a non-core one.
// `after: all` (teardown-plan) is not an edge; it orders the slot last and is exempt from the edge rules by name.

export function dagFindings(slots) {
  const byId = new Map(slots.map((s) => [s.id, s]));
  const out = [];
  for (const s of slots) {
    for (const d of s.depends_on || []) {
      const dep = byId.get(d);
      if (!dep) { out.push({ rule: "edge-unresolved", id: s.id, msg: `depends_on ${d}, which is not a slot` }); continue; }
      if (s.tier === "core" && dep.tier !== "core")
        out.push({ rule: "core-to-noncore", id: s.id, msg: `core slot depends on ${d} (tier ${dep.tier}); the steel thread may never need Cycle 2` });
    }
  }
  const cyc = findCycle(slots, byId);
  if (cyc) out.push({ rule: "dag-cycle", id: cyc[0], msg: `depends_on cycle ${cyc.join(" -> ")}` });
  return out;
}

function findCycle(slots, byId) {
  const color = new Map();
  const stack = [];
  const visit = (id) => {
    color.set(id, 1);
    stack.push(id);
    for (const d of (byId.get(id) || {}).depends_on || []) {
      if (!byId.has(d)) continue;
      if (color.get(d) === 1) return [...stack.slice(stack.indexOf(d)), d];
      if (!color.get(d)) { const c = visit(d); if (c) return c; }
    }
    stack.pop();
    color.set(id, 2);
    return null;
  };
  for (const s of slots) if (!color.get(s.id)) { const c = visit(s.id); if (c) return c; }
  return null;
}

// Apply order: a deterministic topological walk (Kahn, ties by catalog order); `after: all` slots go last.
export function topoOrder(slots) {
  const ids = slots.filter((s) => s.after !== "all").map((s) => s.id);
  const deps = new Map(slots.map((s) => [s.id, new Set((s.depends_on || []).filter((d) => ids.includes(d)))]));
  const order = [];
  const done = new Set();
  while (order.length < ids.length) {
    const next = ids.find((id) => !done.has(id) && [...deps.get(id)].every((d) => done.has(d)));
    if (!next) throw new Error("topoOrder: cycle -- run launch-lint");
    done.add(next);
    order.push(next);
  }
  return [...order, ...slots.filter((s) => s.after === "all").map((s) => s.id)];
}
