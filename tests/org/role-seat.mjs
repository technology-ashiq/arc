// role-seat.mjs -- the org role resolver (Cycle 20 Phase 00, REQ-01/02, ADR-1626). Pure: no spine, no repo.
// Prints "RAN role-seat N checks" first and exits 1 on any failure, so a caller asserts it RAN before reading results.
import { resolveSeat, personaOf, tally, MIN_RUNS } from "../../.claude/scripts/engine/role-seat.mjs";

let checks = 0;
let failed = 0;
const ok = (cond, what) => { checks += 1; if (!cond) { failed += 1; console.log(`FAIL ${what}`); } };
const run = (role, agent, outcome, trial = false) => ({
  kind: "run.completed",
  payload: { ...(trial ? { trial_role: role } : { role }), role_agent: agent, role_agent_source: trial ? "trial" : "card", outcome },
});
const many = (n, role, agent, outcome, trial) => Array.from({ length: n }, () => run(role, agent, outcome, trial));
const card = { id: "reviewer", binds: { agents: ["alpha", "beta", "gamma"] } };

// no evidence -> the first listed agent, source card
let s = resolveSeat(card, []);
ok(s.agent === "alpha" && s.source === "card", `no evidence: ${JSON.stringify(s)}`);

// below MIN_RUNS nobody qualifies, however good
s = resolveSeat(card, many(MIN_RUNS - 1, "reviewer", "beta", "ok"));
ok(s.agent === "alpha" && s.source === "card", `under ${MIN_RUNS} runs: ${JSON.stringify(s)}`);

// a qualifying agent with the better ok rate wins, scored
s = resolveSeat(card, [...many(3, "reviewer", "alpha", "ok"), ...many(1, "reviewer", "alpha", "fail"), ...many(3, "reviewer", "beta", "ok")]);
ok(s.agent === "beta" && s.source === "scored", `best rate: ${JSON.stringify(s)}`);

// trial receipts count toward qualifying (trial_role), so a second agent can earn the seat
s = resolveSeat(card, [...many(3, "reviewer", "alpha", "fail"), ...many(3, "reviewer", "gamma", "ok", true)]);
ok(s.agent === "gamma" && s.source === "scored", `trial evidence qualifies: ${JSON.stringify(s)}`);

// a tie at the top -> first listed OF THE TIED, source card
s = resolveSeat(card, [...many(3, "reviewer", "beta", "ok"), ...many(3, "reviewer", "gamma", "ok"), ...many(3, "reviewer", "alpha", "fail")]);
ok(s.agent === "beta" && s.source === "card", `tie: ${JSON.stringify(s)}`);

// receipts for another role, another kind, or an unbound agent are not counted
s = resolveSeat(card, [...many(5, "other-role", "beta", "ok"), ...many(5, "reviewer", "stranger", "ok"),
  ...Array.from({ length: 5 }, () => ({ kind: "handoff.ready", payload: { role: "reviewer", role_agent: "beta", outcome: "ok" } }))]);
ok(s.agent === "alpha" && s.source === "card", `foreign receipts ignored: ${JSON.stringify(s)}`);
ok(tally("reviewer", ["alpha"], [run("reviewer", "alpha", "ok")]).get("alpha").runs === 1, "tally counts a matching run");

// a card with no bound agent seats nobody
s = resolveSeat({ id: "empty", binds: { agents: [] } }, []);
ok(s.agent === null && s.source === "none", `no agents: ${JSON.stringify(s)}`);

// a duplicate listing cannot move an agent ahead of the order
s = resolveSeat({ id: "dup", binds: { agents: ["beta", "alpha", "beta"] } }, []);
ok(s.agent === "beta" && s.source === "card", `duplicates: ${JSON.stringify(s)}`);

// trial wins over everything; a bad trial id throws
s = resolveSeat(card, many(9, "reviewer", "beta", "ok"), { trial: "zeta" });
ok(s.agent === "zeta" && s.source === "trial", `trial: ${JSON.stringify(s)}`);
let threw = false;
try { resolveSeat(card, [], { trial: "../etc" }); } catch { threw = true; }
ok(threw, "a trial id outside the agent grammar throws");

// deterministic: the same input twice, the same answer
const ev = [...many(4, "reviewer", "alpha", "ok"), ...many(4, "reviewer", "gamma", "ok")];
ok(JSON.stringify(resolveSeat(card, ev)) === JSON.stringify(resolveSeat(card, [...ev].reverse())), "order of receipts does not change the seat");

// persona: frontmatter stripped, CRLF tolerated
ok(personaOf("---\r\nname: a\r\nmodel: x\r\n---\r\nYou review.\r\n") === "You review.", "persona strips frontmatter");
ok(personaOf("No frontmatter.") === "No frontmatter.", "persona without frontmatter");

console.log(`RAN role-seat ${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
