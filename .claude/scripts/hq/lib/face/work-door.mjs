// work-door -- the WORK door behind arc-dash (face v2 Phase 05; ADR-1326 · ADR-1334 · ADR-1339).
//
// Three verbs, and no logic of its own:
//
//   plan(op, input)    validate the owner's fields against the face-ops row, run the row's PLAN argv (a dry run that
//                      writes nothing), and hold the result under a one-shot plan id. The apply argv is fixed HERE,
//                      at plan time -- from the row, from the emit line the tool itself printed, or from the row
//                      plus the digest the plan printed (--expect: the tool re-checks and writes only what was
//                      planned) -- so what the owner read on the plan card is exactly what the click runs.
//   apply(planId)      claim the plan (synchronously -- two clicks, or two tabs, start ONE run), run the held apply
//                      argv, and find the receipt the tool wrote by reading the spine, never by trusting an exit code.
//                      A repeat of a claimed plan replays its run; it never runs twice.
//   run(planId)        the run as it stands: the tool's lines so far, then its result. This is how apply "streams":
//                      the face reads it while the tool is still writing.
//
// The door never builds a payload, never decides a verdict and never picks an argument. Every child is spawned from
// the argv list with no shell between the door and the tool, in the door's own repo, with childEnv() (git's location
// variables and preload hooks withheld). A tool's refusal comes back in its own words, scrubbed of machine paths.

import { randomBytes } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { join, sep } from "node:path";
import { StringDecoder } from "node:string_decoder";

import { spawnBounded } from "../../../core/spawn-bounded.mjs";
import { query } from "../../spine.mjs";
import { OPS, OpError, validateInput, emitPlanFrom, expectFrom, commandLine, registryView } from "../../face-ops.mjs";
import { childEnv, scrub, scrubDeep } from "./reads.mjs";

const PLAN_TTL_MS = 15 * 60_000;
const PLAN_TIMEOUT_MS = 2 * 60_000;
const APPLY_TIMEOUT_MS = 30 * 60_000;
// What the door holds of one child's output. A run past it keeps the TAIL and says how much it dropped -- a silently
// truncated log reads exactly like a short one.
const OUTPUT_CAP = 256 * 1024;
const LINES_KEPT = 400;
const LINE_CAP = 8192;
// Plans held at once. Past it the oldest UNCLAIMED plan is dropped (a running or finished one is kept: its replay is
// what stops a repeat from running twice).
const PLANS_CAP = 128;
// A finished run is kept this long so a repeat apply REPLAYS it. Past that the plan id is forgotten, and a late repeat
// answers UNKNOWN_PLAN -- it never runs again, so forgetting is the safe direction.
const DONE_KEEP_MS = 60 * 60_000;
const SCRIPT_RE = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*\.mjs$/;
const PLAN_ID_RE = /^[A-Za-z0-9_-]{24}$/;

/**
 * What an op changes besides the spine, in the owner's words, for the plan card. A file-touching op's own dry run prints
 * its diff; the apply writes it to a NEW feat/face-* branch and never to main (ADR-1340).
 * @param {{ touchesFiles?: boolean, touchesOs?: boolean, touchesTree?: boolean }} op
 */
function effectOf(op) {
  if (op.touchesFiles) return "the diff is in the plan's output above; apply commits it to a new feat/face-* branch, never to main -- a human merges it or does not";
  if (op.touchesOs) return "no file changes -- apply registers a task with this machine's scheduler, and the receipt records it";
  if (op.touchesTree) return "apply writes the lane's own tracker in place -- the one change the plan above names, on your checkout, and nothing else (ADR-1341)";
  return "no file changes -- this op writes one receipt to the spine";
}

/** The HTTP status each work-door refusal carries (arc-dash maps codes through its own table; these are the door's). */
export const WORK_STATUS = Object.freeze({
  UNKNOWN_OP: 404, UNKNOWN_PLAN: 404,
  BAD_INPUT: 400, BAD_PLAN_ID: 400,
  PLAN_OTHER_OP: 409, PLAN_EXPIRED: 410, CONFIRM_REQUIRED: 428,
  SIM_SPEND: 403, SIM_EFFECT: 403,
  NO_EMIT_PLAN: 502, EMIT_PLAN_MISMATCH: 502, NO_EXPECT: 502, TOOL_MISSING: 503,
});

/**
 * Spawn one tool, collect what it says, and never let it outlive its timeout.
 * @param {{ repo: string }} ctx @param {{ script: string, args: string[] }} cmd
 * @param {{ timeoutMs: number, onLine?: (stream: "out" | "err", line: string) => void, outputCap?: number }} opts
 * @returns {Promise<{ exit: number | null, signal: string | null, stdout: string, stderr: string, timedOut: boolean, dropped: number, droppedOut: number, droppedErr: number }>}
 */
export function runTool(ctx, cmd, { timeoutMs, onLine, outputCap = OUTPUT_CAP }) {
  if (!SCRIPT_RE.test(cmd.script)) throw new OpError("TOOL_MISSING", `the registry names "${cmd.script}", which is not a script path the door runs`);
  const script = join(ctx.repo, ".claude", "scripts", ...cmd.script.split("/"));
  if (!existsSync(script)) throw new OpError("TOOL_MISSING", `.claude/scripts/${cmd.script} is not on this tree`);
  // The resolved file must be THIS tree's: a junction under .claude/scripts ran another tree's tool under this door's
  // name, which is the Phase 04 SOURCE_OUTSIDE class on the write side.
  const real = realpathSync(script);
  const root = realpathSync(ctx.repo);
  if (!real.startsWith(root + sep)) throw new OpError("TOOL_MISSING", `.claude/scripts/${cmd.script} resolves outside this tree -- not run`);

  /** @type {{ out: string, err: string }} */
  const buf = { out: "", err: "" };
  const partial = { out: "", err: "" };
  // Per stream: a caller that serves stdout must not refuse it for what stderr overflowed (PR 2 logic attack: a paid,
  // complete ask answer was thrown away because a failed driver's long stderr came first).
  const droppedBy = { out: 0, err: 0 };
  // One line is capped too: a tool writing with no newline grew the pending fragment without bound, past the
  // output cap that bounds everything else.
  const cut = (l) => (l.length > LINE_CAP ? `${l.slice(0, LINE_CAP)} [line cut at ${LINE_CAP} characters]` : l);
  // One decoder per stream: a character split across two chunks is held until its last byte arrives. Decoding each
  // chunk on its own turned a split euro sign into three U+FFFD (round-2 shell attack).
  const decoder = { out: new StringDecoder("utf8"), err: new StringDecoder("utf8") };
  /** @param {"out" | "err"} stream @param {Buffer} chunk */
  const take = (stream, chunk) => {
    const s = decoder[stream].write(chunk);
    buf[stream] += s;
    if (buf[stream].length > outputCap) { droppedBy[stream] += buf[stream].length - outputCap; buf[stream] = buf[stream].slice(-outputCap); }
    if (onLine) {
      const lines = (partial[stream] + s).split(/\r?\n/);
      partial[stream] = lines.pop() || "";
      for (const l of lines) onLine(stream, cut(l));
      if (partial[stream].length > LINE_CAP) { onLine(stream, cut(partial[stream])); partial[stream] = ""; }
    }
  };
  // The spawn, the tree kill and the settle-on-exit live in core/spawn-bounded.mjs, shared with the proposal writer's
  // git calls: killing only the direct child left a driver it started running, and spending, after the door called the
  // run over (face v2 Phase 05 shell attack).
  return spawnBounded(process.execPath, [real, ...cmd.args], { cwd: ctx.repo, env: childEnv(), timeoutMs, onData: take })
    .then(({ exit, signal, timedOut }) => {
      for (const st of /** @type {const} */ (["out", "err"])) { const rest = decoder[st].end(); if (rest) { buf[st] += rest; partial[st] += rest; } }
      if (onLine) for (const st of /** @type {const} */ (["out", "err"])) if (partial[st]) { onLine(st, cut(partial[st])); partial[st] = ""; }
      return { exit, signal, stdout: buf.out, stderr: buf.err, timedOut, dropped: droppedBy.out + droppedBy.err, droppedOut: droppedBy.out, droppedErr: droppedBy.err };
    });
}

// Every read here is the SCAN engine, never "auto": auto picks derived/state.db once arc-replay has built one, and
// nothing but arc-replay updates it, so a receipt written a second ago was invisible and every apply read
// "no receipt" -- an owner who then runs it again pays twice (face v2 Phase 05 logic attack).
const SCAN = "scan";
const ULID_ANYWHERE = /(?<![0-9A-Z])[0-7][0-9A-HJKMNP-TV-Z]{25}(?![0-9A-Z])/g;

/** The ids of one kind already on the spine: the set a new receipt is checked AGAINST. */
async function kindIds(ctx, kind) {
  const { events } = await query(ctx.root, { kind, engine: SCAN });
  return new Set(events.map((e) => e.event.id));
}

/**
 * The receipt THIS run wrote. Every op's tool prints the id the spine gave its receipt (arc-event's last line,
 * develop's "receipt: ...", bench's "receipt <id> is in events/"), so the door takes an id the tool PRINTED, and
 * accepts it only if it names an event of the row's kind (and process) that was not on the spine before the run.
 * The first cut took the newest new event of the kind, and six concurrent captures came back with each other's
 * receipts -- another writer's event is new too (face v2 Phase 05 logic attack). No printed id, no receipt: never a
 * guess.
 * @param {{ root: string }} ctx @param {{ kind: string, process?: string }} receipt @param {Set<string>} before
 * @param {string} stdout
 */
async function findReceipt(ctx, receipt, before, stdout) {
  const printed = [...String(stdout).matchAll(ULID_ANYWHERE)].map((m) => m[0]);
  if (!printed.length) return null;
  const { events } = await query(ctx.root, { kind: receipt.kind, engine: SCAN });
  const byId = new Map(events.map((e) => [e.event.id, e.event]));
  // The LAST id the tool printed that qualifies: a tool that names several ids names its own receipt last.
  for (let i = printed.length - 1; i >= 0; i--) {
    const ev = byId.get(printed[i]);
    if (!ev || before.has(ev.id)) continue;
    if (receipt.process && ev.process !== receipt.process) continue;
    return { id: ev.id, kind: ev.kind, ts: ev.ts, outcome: ev.outcome, process: ev.process, payload: ev.payload };
  }
  return null;
}

const refusalOf = (res, repo) => ({
  exit: res.exit, signal: res.signal, timedOut: res.timedOut,
  // The tool's own words, scrubbed of machine paths and addresses (ADR-1312) -- never paraphrased. What the cap cut is
  // said, never silent: a refusal whose first line was dropped reads like a different refusal.
  stderr: scrub(res.stderr, repo), stdout: scrub(res.stdout, repo), dropped: res.dropped,
});

/**
 * @param {{ mode: string, root: string, repo: string }} ctx
 * @param {{ registry?: readonly any[], journal?: (entry: Record<string, unknown>) => void, now?: () => number }} [opts]
 */
export function createWorkDoor(ctx, opts = {}) {
  const registry = opts.registry || OPS;
  const journal = opts.journal || (() => {});
  const now = opts.now || Date.now;
  /** @type {Map<string, any>} */
  const plans = new Map();

  const opOf = (id) => {
    const op = registry.find((o) => o.id === id);
    if (!op) throw new OpError("UNKNOWN_OP", `"${id}" is not an op on this door (GET /api/ops lists them)`);
    return op;
  };

  function prune() {
    const t = now();
    for (const [id, p] of plans) {
      if (p.state === "planned" && p.expiresAt <= t) plans.delete(id);
      else if (p.state === "done" && p.finishedAt + DONE_KEEP_MS <= t) plans.delete(id);
    }
    if (plans.size <= PLANS_CAP) return;
    for (const [id, p] of plans) {
      if (plans.size <= PLANS_CAP) break;
      if (p.state === "planned") plans.delete(id);
    }
  }

  function list() {
    return { mode: ctx.mode, ops: registryView(registry) };
  }

  /** @param {string} opId @param {unknown} body */
  async function plan(opId, body) {
    const op = opOf(opId);
    if (body !== null && typeof body === "object" && !Array.isArray(body)) {
      for (const k of Object.keys(body)) if (k !== "input") throw new OpError("BAD_INPUT", `a plan takes { input }, not "${k}"`);
    } else throw new OpError("BAD_INPUT", "a plan takes { input: { ...fields } }");
    const values = validateInput(op, /** @type {any} */ (body).input);
    // A sim door answers against a fixture spine; a paid model called from one would spend real money to write a
    // receipt nobody can trust. The row says when its run is free (the mock driver); nothing else runs here.
    if (ctx.mode === "sim" && op.spends && !(typeof op.simSafe === "function" && op.simSafe(values)))
      throw new OpError("SIM_SPEND", `${op.id} spends real money, and this door is in sim mode -- it runs here only in the form that spends nothing`);
    const planCmd = op.plan(values);
    const res = await runTool(ctx, planCmd, { timeoutMs: PLAN_TIMEOUT_MS });
    const base = {
      mode: ctx.mode, op: op.id, label: op.label, command: commandLine(planCmd),
      receipt: op.receipt, humanRun: op.humanRun, spends: op.spends,
    };
    if (res.exit !== 0) {
      journal({ op: op.id, phase: "plan", refused: true, exit: res.exit });
      return { ...base, ok: false, refusal: refusalOf(res, ctx.repo) };
    }
    // The apply is fixed HERE. An expect row's apply carries the digest its plan printed, so the tool writes what the
    // owner read or refuses PLAN_STALE -- never what the world looks like fifteen minutes later (ADR-1340 amended).
    const applyCmd = op.apply === "emit-plan"
      ? { script: "hq/arc-event.mjs", args: emitPlanFrom(op, res.stdout) }
      : op.expect === true
        ? (() => { const cmd = op.apply(values); return { ...cmd, args: [...cmd.args, "--expect", expectFrom(op, res.stdout)] }; })()
        : op.apply(values);
    prune();
    const planId = randomBytes(18).toString("base64url");
    const expiresAt = now() + PLAN_TTL_MS;
    plans.set(planId, { id: planId, opId: op.id, applyCmd, values, humanRun: op.humanRun, receipt: op.receipt, expiresAt, state: "planned", lines: [], linesDropped: 0, bytesDropped: 0, result: null, done: null });
    journal({ op: op.id, phase: "plan", planId });
    return {
      ...base, ok: true, planId, expiresInMs: PLAN_TTL_MS,
      apply: commandLine(applyCmd),
      // The tool's own plan output, first -- it is the review the owner reads before the click.
      output: scrub(res.stdout, ctx.repo), notes: scrub(res.stderr, ctx.repo), outputDropped: res.dropped,
      diff: effectOf(op),
      estimate: typeof op.estimate === "function" ? op.estimate(values) : "₹0 -- no model is called",
    };
  }

  /** The held run, as the face reads it. @param {any} p */
  function view(p) {
    return {
      mode: ctx.mode, planId: p.id, op: p.opId, state: p.state,
      lines: p.lines.slice(-LINES_KEPT), linesDropped: p.linesDropped + Math.max(0, p.lines.length - LINES_KEPT), bytesDropped: p.bytesDropped,
      result: p.result,
    };
  }

  /** @param {string} opId @param {unknown} body */
  function apply(opId, body) {
    const op = opOf(opId);
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new OpError("BAD_PLAN_ID", "apply takes { planId } -- one plan, never a list");
    for (const k of Object.keys(body)) if (k !== "planId" && k !== "confirm") throw new OpError("BAD_PLAN_ID", `apply takes { planId, confirm }, not "${k}"`);
    const { planId, confirm } = /** @type {any} */ (body);
    if (typeof planId !== "string" || !PLAN_ID_RE.test(planId)) throw new OpError("BAD_PLAN_ID", "apply takes the planId its plan returned -- one plan, never a list");
    const p = plans.get(planId);
    if (!p) throw new OpError("UNKNOWN_PLAN", "no plan with that id is held -- plan again (plans are one-shot and expire)");
    if (p.opId !== op.id) throw new OpError("PLAN_OTHER_OP", `that plan is for ${p.opId}, not ${op.id}`);
    // Everything above is checked on EVERY call, replays included: a replay answers only the caller who could have
    // started the run.
    if (p.humanRun && confirm !== op.id)
      throw new OpError("CONFIRM_REQUIRED", `${op.id} is human-run: apply carries confirm: "${op.id}", sent only by the owner's confirming click`);
    // An effect past the spine never runs on a sim door (ADR-1340): the plan was the tool's own dry run and wrote nothing;
    // the apply would register a real task, or write a real branch, to rehearse something. Refused before the claim, so
    // the plan stays held and a repeat is refused the same way.
    if (ctx.mode === "sim" && (op.touchesOs || op.touchesFiles || op.touchesTree) && !(typeof op.simSafe === "function" && op.simSafe(p.values)))
      throw new OpError("SIM_EFFECT", `${op.id} ${op.touchesOs ? "registers a task with this machine's scheduler" : op.touchesTree ? "writes a lane's tracker in this checkout" : "writes a proposal branch to this repository"}, and this door is in sim mode -- the plan above is the whole rehearsal`);
    if (p.state !== "planned") return { ...view(p), replayed: true };
    if (p.expiresAt <= now()) { plans.delete(planId); throw new OpError("PLAN_EXPIRED", "that plan expired before it was applied -- plan again, and read the new one"); }

    // THE CLAIM. Synchronous, before the first await: a second apply of this plan id, from anywhere, sees "running"
    // and replays -- it cannot start a second run.
    p.state = "running";
    p.done = (async () => {
      const t0 = now();
      let result;
      try {
        const before = await kindIds(ctx, p.receipt.kind);
        const res = await runTool(ctx, p.applyCmd, {
          timeoutMs: APPLY_TIMEOUT_MS,
          onLine: (stream, line) => {
            p.lines.push({ s: stream, t: scrub(line, ctx.repo) });
            if (p.lines.length > LINES_KEPT * 4) { const n = p.lines.length - LINES_KEPT; p.lines.splice(0, n); p.linesDropped += n; }
          },
        });
        p.bytesDropped += res.dropped;
        // Looked for whatever the exit: a tool can refuse part of the work and still write its receipt (bench exits 1 on a
        // partial run and records it), and a receipt the face does not show is a receipt the owner cannot find.
        const receipt = await findReceipt(ctx, p.receipt, before, res.stdout);
        result = {
          ok: res.exit === 0 && receipt !== null,
          exit: res.exit, ms: now() - t0,
          // The envelope fields are the spine's own grammar (a ULID, a kind, an IST ts, `name@x.y.z`) and are served as
          // they are -- the address scrub read `arc-event@1.0.0` as an email. The PAYLOAD is scrubbed: it is free text.
          receipt: receipt ? { ...receipt, payload: scrubDeep(receipt.payload, ctx.repo) } : null,
          ...(res.exit !== 0 ? { refusal: refusalOf(res, ctx.repo) } : {}),
          // Exit 0 with no receipt is the tool and the registry disagreeing about what the op writes. Said, not hidden.
          ...(res.exit === 0 && receipt === null ? { noReceipt: `the tool exited 0 and no new ${p.receipt.kind}${p.receipt.process ? ` from ${p.receipt.process}` : ""} is on the spine` } : {}),
        };
      } catch (err) {
        result = { ok: false, exit: null, ms: now() - t0, receipt: null, error: err instanceof OpError ? err.code : "INTERNAL", message: err instanceof OpError ? scrub(err.message, ctx.repo) : "the run failed in a way the door has no name for" };
      }
      p.result = result;
      p.finishedAt = now();
      p.state = "done";
      journal({ op: p.opId, phase: "apply", planId: p.id, ok: result.ok, receipt: result.receipt ? result.receipt.id : null });
    })();
    return view(p);
  }

  /** @param {string} planId */
  function run(planId) {
    if (typeof planId !== "string" || !PLAN_ID_RE.test(planId)) throw new OpError("BAD_PLAN_ID", "a run is read by its planId");
    const p = plans.get(planId);
    if (!p) throw new OpError("UNKNOWN_PLAN", "no plan with that id is held");
    return view(p);
  }

  /** For tests and shutdown: every run this door started, settled. */
  async function settled() {
    await Promise.all([...plans.values()].map((p) => p.done).filter(Boolean));
  }

  return { list, plan, apply, run, settled };
}
