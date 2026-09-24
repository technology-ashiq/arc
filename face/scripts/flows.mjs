// flows.mjs -- the work door's flows, in a real browser (face v2 Phase 05; REQ-07, REQ-09, REQ-11, ADR-1330, ADR-1339).
//
// v0.7 shipped its own write-path flows (docs/design/reference/face-hq/assets/arcface/scripts/flows.mjs): each typed
// into a room by placeholder, clicked by button text, and asserted against an in-page world of invented kinds. This is
// that harness ported to arc's door: the same way of driving a room -- a placeholder finds an input, a button's text
// finds a button, and those strings are FROZEN -- and every assertion is a receipt read back through the door, never
// something the page says about itself.
//
//   runFlows(opts)   one Chrome session after the smoke: every op the door serves is driven through its room's dock
//                    (fields, "Plan it", the owner's tick for a human-run op, "Run it"), and its receipt is read back
//                    from /api/spine. Then the LIVE flow: the spine room is open, a receipt is appended to the fixture
//                    spine behind the page's back, and the room must show it within 5 s without a reload (REQ-11).
//   frozenDrift(src) which frozen button text the dock's source no longer carries -- a planted change to one FAILs.
//
// The flows mutate the fixture spine, so the harness runs them AFTER both moods' smoke has counted it.

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { openPage } from "./cdp.mjs";
import { withChrome, collectErrors, until, redactSecrets, oneLine } from "./smoke.mjs";
import { unescapeDoorText } from "../src/lib/door.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The dock's button text. Frozen: the flows find buttons by it, and a change to either is a change to this file. */
export const FROZEN = Object.freeze({ plan: "Plan it", run: "Run it" });

/** REQ-11's bound: a change under the open room shows within this. */
export const LIVE_MS = 5000;

/**
 * Which frozen button text the dock's source no longer carries as a button's whole label. Empty on the real tree; a
 * planted rename of either button makes it name the string.
 * @param {string} dockSource the text of face/src/shell/OpsDock.tsx
 * @returns {string[]}
 */
export function frozenDrift(dockSource) {
  return Object.values(FROZEN).filter((t) => !new RegExp(`>\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*</`).test(String(dockSource)));
}

/**
 * The inputs each op's flow types, for a fixture spine and a scratch directory. An op with no row here has no flow,
 * and runFlows says so as a FAIL -- REQ-09: every shipped op has one.
 * @param {{ tmp: string, closeMonth: string }} ctx
 * @returns {Record<string, Record<string, string>>}
 */
export function flowInputs(ctx) {
  return {
    "today.capture-idea": { text: "a flow in the browser captured this" },
    "develop.checkpoint": { lane: "face" },
    "money.criteria": { what: "a browser flow asks for a criteria change" },
    "money.close-month": { month: ctx.closeMonth, totals: `razorpay:INR=${FLOW_PAYMENT_MINOR}` },
    "growth.publish": { slug: "flow-probe", article: join(ctx.tmp, "flow-probe.mdx"), cluster: "c-001", title: "A browser flow, sealed", pr: "9" },
    "bench.run-model": { driver: "mock", model: "mock", inr: "1", minutes: "5" },
    // The kernel ring (ADR-1340).
    "scheduler.register-job": { job: "day-close-roll" },
    "engine-room.driver-switch": { class: "review-diff", to: "codex" },
    "model-policy.tier-proposal": { class: "face-ask", to: "high-judgment" },
    "policy.cap-proposal": { kind: "process:kickoff-plan", capability: "write", to: "L2", evidence: "docs/trial-ledger.md#browser-flow" },
    "evolve.open-experiment": { experiment: "x-browser-flow", module: "core", surface: "hero", target: "app/home/hero.tsx", arms: "+champion,+challenger" },
    "evolve.measure": { experiment: "x-browser-flow", unit: "u-1", metric: "signup_conversion", value: "1", count: "1", window: "2026-09-01..2026-09-07", source: "src-1" },
    "evolve.conclude": { experiment: "x-browser-flow" },
    "bench.propose": { from: join(ctx.tmp, "no-bench-run"), champion: join(ctx.tmp, "no-champion-run") },
    "absorb.pin-source": { root: ctx.tmp, pin: "0123456789abcdef", license: "MIT, in LICENSE at the source root", report: "initiatives/absorb/evidence/browser-flow.md" },
    "absorb.trial": { candidate: "T-01", variants: "harbor,quartz", fixtures: "f1,f2,f3", evidence: "initiatives/absorb/evidence/browser-flow-trial", correlation: "browser-flow-trial-1" },
    // The factory ring (ADR-1341).
    "develop.slice": { lane: "browser-flow-no-lane" },
    "toolbelt.pin-tool": { tool: "command:arc-review", action: "pin" },
    "design-studio.open-brief": { id: "browser-flow", brief: "docs/how-it-works.md" },
    "design-studio.record-pick": { explore: "hq-dashboard-v1", pick: "a", why: "a browser flow picks the first" },
    "council-chamber.send-to-council": { question: "does a browser flow reach the council chamber" },
    "factory.switch-profile": { to: "strict", why: "a browser flow asks for the strict profile" },
    "executor.terminate": { class: "build-in-public-draft" },
    "agents.add-agent": { name: "browser-flow-probe", description: "Reads a diff and names its riskiest hunk", tools: "Read, Grep", tier: "cheap-scan", room: "review-ship", product: "review" },
    // The money ring (ADR-1342). The fixture spine holds no approved criteria, so the register and the kill review end
    // on their tools' refusals; their receipt paths are proven on scratch spines (tests/face/money-work.mjs).
    "money.ingest": { provider: "razorpay", export: join(ctx.tmp, "no-export.csv"), venture: "lexos", interval: "monthly" },
    "ventures.register": { slug: "browser-flow-probe", days: "60", floor: "50", repository: "acme/browser-flow-probe" },
    "ventures.kill-review": { venture: "lexos", reason: "a browser flow asks for a review" },
    // The live lanes (ADR-1344). No warmed sending domain exists yet, so the send ends on the leads lane's own gate
    // (ADR-0402/0413) wherever it runs; the legal gate renders a FIXTURE venture and raises its question for real.
    "leads.daily-send": { campaign: "browser-flow" },
    "legal.full-read": { venture: "fixture-gateway-gst" },
    // The company ring (ADR-1343): both write a proposal branch, so a sim door refuses them at apply.
    "org.lane-status": { lane: "face", status: "QUEUED" },
    "concepts.define-term": { term: "browser flow probe", room: "today", station: "needs-you cards" },
  };
}

/**
 * What each refusal flow's card must SHOW, BY NAME. "Any refusal" passed a sim door that RAN an effect op and failed
 * later -- propose's exit 1 after a branch was written reads as a refusal too (PR 3a logic attack). An effect op (its
 * apply writes a branch or registers a task) ends on the door's SIM_EFFECT, or on its tool's own plan-time refusal on a
 * runner that cannot plan it at all: NO_BASE where a CI checkout has no main, the scheduler's non-Windows refusal. The
 * evolve verbs refuse by name on a tree where no product declares an evolve section. Keyed by op id, never by the
 * effect flags the flows exist to check (tests/face/live-pulse.mjs holds every effect op to a SIM_EFFECT entry here).
 */
export const REFUSALS = Object.freeze({
  "scheduler.register-job": "SIM_EFFECT|registration targets Windows",
  "engine-room.driver-switch": "SIM_EFFECT|NO_BASE",
  "model-policy.tier-proposal": "SIM_EFFECT|NO_BASE",
  "evolve.open-experiment": "NO_EVOLVE_SECTION",
  "evolve.measure": "NOT_OPEN",
  "evolve.conclude": "NOT_OPEN",
  // bench.propose proposes from a run that already happened, and the browser flow has none to point it at: the tool's
  // own refusal is what the card must show. Its receipt path is the parity suite's, which runs a mock bench first.
  "bench.propose": "has no scorecard\\.json|no scorecard\\.json",
  "absorb.pin-source": "SIM_EFFECT|NO_BASE",
  "absorb.trial": "SIM_EFFECT|NO_BASE",
  // The factory ring. develop.slice names a lane that does not exist: its real apply writes a lane ledger in place, and
  // is proven in a scratch tree (tests/face/factory-ring.mjs).
  "develop.slice": "SIM_EFFECT|unknown lane",
  "design-studio.open-brief": "SIM_EFFECT|NO_BASE",
  "executor.terminate": "SIM_EFFECT|NO_BASE",
  "agents.add-agent": "SIM_EFFECT|NO_BASE",
  // The money ring. Ingest is pointed at an export that does not exist: recording money is the owner's hand-run, and
  // its apply path is money-work.mjs's. The register refuses where a CI checkout has no main, and elsewhere because the
  // fixture's criteria were never approved; the kill review refuses the same unapproved criteria.
  "money.ingest": "the export cannot be found",
  // On a runner whose checkout HAS a main, the register reads the spine next -- and the fixture spine carries a torn
  // line on purpose (the spine room draws it), which the register refuses rather than reading as "nothing requested"
  // (main CI after PR 5a: green on the PR, where NO_BASE came first).
  "ventures.register": "SIM_EFFECT|NO_BASE|no approved criteria receipt|torn line",
  "ventures.kill-review": "UNRECEIPTED",
  // A send needs a warmed sending domain, and none is evidenced yet (ADR-0413): the leads lane's own gate is what the
  // card must show, wherever this runs. The plan and its binding are proven on a scratch config in
  // tests/face/live-work.mjs; a real send waits for that lane's Phase 03.
  "leads.daily-send": "SIM_EFFECT|no sending_domain configured",
  // The legal gate plans anywhere (a fixture venture) and its apply acts outside the spine, so a sim door refuses it.
  "legal.full-read": "SIM_EFFECT",
  // The company ring: branch writers, refused SIM_EFFECT at apply, or NO_BASE where a CI checkout has no main.
  // Or, on a checkout WITH a main, the fixture spine's deliberate torn line: an unknown read is never "nothing
  // requested" (the register's twin -- main CI after PR 5a).
  "org.lane-status": "SIM_EFFECT|NO_BASE|torn line",
  "concepts.define-term": "SIM_EFFECT|NO_BASE|torn line",
});

/**
 * What a flow must end on: a receipt, or a refusal the card shows in the words REFUSALS names.
 * @param {{ id: string }} op @returns {"receipt" | "refusal"}
 */
export function flowExpect(op) {
  return Object.hasOwn(REFUSALS, op.id) ? "refusal" : "receipt";
}

const FLOW_PAYMENT_MINOR = 120000;

/**
 * The month the close flow closes: two months back, mid-month. The fixture spine covers the last ten days, so this
 * month holds exactly the one payment the flow seeds -- a close that could match the fixture's own rails would be
 * judged against data the flow did not choose.
 * @param {Date} now
 */
export function closeMonthFor(now) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 15, 6, 0, 0));
  return { month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, at: d.getTime() };
}

/**
 * The in-page driver for one op, run with Runtime.evaluate. Self-contained: it is serialised with toString(), so it
 * may use nothing from this module's scope. It types by placeholder, picks by button text, clicks the frozen buttons,
 * and returns what the card ended on.
 * @param {{ id: string, fields: { name: string, type: string, placeholder: string }[], input: Record<string, string>,
 *   humanRun: boolean, frozen: { plan: string, run: string }, capMs: number }} arg
 */
export function pageFlow(arg) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (f, cap) => { const t0 = Date.now(); while (Date.now() - t0 < cap) { const v = f(); if (v) return v; await sleep(100); } return null; };
  return (async () => {
    const card = await until(() => {
      const c = document.querySelector('section[data-room] [data-op="' + arg.id + '"]');
      return c && c.getAttribute("data-op-state") === "idle" ? c : null;
    }, 20000);
    if (!card) return { ok: false, step: "the op card never came up idle" };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    for (const f of arg.fields) {
      const v = arg.input[f.name];
      if (v === undefined) continue;
      if (f.type === "select") {
        const b = Array.from(card.querySelectorAll("button")).find((x) => x.textContent.trim() === v);
        if (!b) return { ok: false, step: "no option button " + JSON.stringify(v) + " for " + f.name };
        b.click();
      } else {
        const i = Array.from(card.querySelectorAll("input")).find((x) => x.placeholder === f.placeholder);
        if (!i) return { ok: false, step: "no input with the placeholder " + JSON.stringify(f.placeholder) };
        setter.call(i, v);
        i.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await sleep(40);
    }
    const button = (t) => Array.from(card.querySelectorAll("button")).find((x) => x.textContent.trim() === t);
    const plan = button(arg.frozen.plan);
    if (!plan) return { ok: false, step: "no button " + JSON.stringify(arg.frozen.plan) };
    // A disabled Plan button is a form the flow did not fill: say so now, rather than wait out the page timeout.
    if (plan.disabled) return { ok: false, step: "the Plan button is disabled -- a required field was not filled", text: card.innerText.slice(-300) };
    plan.click();
    const planned = await until(() => { const s = card.getAttribute("data-op-state"); return s !== "planning" && s !== "idle" ? s : null; }, arg.capMs);
    // A refusal flow: the card must SHOW a refusal -- the tool's own, at plan, or the door's, at apply -- never a receipt.
    const refusedText = () => { const r = card.querySelector("[data-op-refused]"); return r ? r.textContent.trim() : ""; };
    // A refusal counts only when the card shows the one this op must end on, by name.
    const named = (t) => new RegExp(arg.refusal).test(t);
    if (arg.expect === "refusal" && (planned === "plan-refused" || planned === "error")) {
      const t = refusedText();
      if (!t) return { ok: false, step: "the plan was refused and the card shows no refusal", text: card.innerText.slice(-500) };
      return named(t) ? { ok: true, refused: t.slice(0, 160) } : { ok: false, step: "the plan was refused, but not by the refusal this op must end on (" + arg.refusal + ")", text: t.slice(0, 300) };
    }
    if (planned !== "planned") return { ok: false, step: "the plan ended " + String(planned), text: card.innerText.slice(-500) };
    if (arg.humanRun) {
      const tick = card.querySelector("[data-op-confirm]");
      if (!tick) return { ok: false, step: "no confirmation tick on a human-run op" };
      tick.click();
      await sleep(60);
    }
    const run = button(arg.frozen.run);
    if (!run) return { ok: false, step: "no button " + JSON.stringify(arg.frozen.run) };
    run.click();
    if (arg.expect === "refusal") {
      const ended = await until(() => (refusedText() ? "refused" : card.querySelector("[data-op-receipt]") ? "receipt" : null), arg.capMs);
      if (ended === "refused") {
        const t = refusedText();
        return named(t) ? { ok: true, refused: t.slice(0, 160), atApply: true } : { ok: false, step: "the apply was refused, but not by the refusal this op must end on (" + arg.refusal + ")", text: t.slice(0, 300) };
      }
      return { ok: false, step: ended === "receipt" ? "a sim door RAN an effect op and drew a receipt" : "the apply was neither refused nor ended", text: card.innerText.slice(-500) };
    }
    const done = await until(() => card.getAttribute("data-op-state") === "done", arg.capMs);
    const rec = card.querySelector("[data-op-receipt]");
    return done && rec
      ? { ok: true, receipt: rec.getAttribute("data-op-receipt") }
      : { ok: false, step: done ? "done with no receipt drawn" : "the run never finished", text: card.innerText.slice(-500) };
  })();
}

/** The figure a KPI tile shows, read in the page. Self-contained, like pageFlow. @param {string} key */
function kpiFigure(key) {
  const el = document.querySelector('section[data-room] [data-kpi="' + key + '"] [data-kpi-v]');
  if (!el) return null;
  const n = Number(String(el.textContent).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && String(el.textContent).trim() !== "" ? n : null;
}

/**
 * @param {{ base: string, door: string, token: string, spine: string, repo: string, tmp: string, now?: Date }} opts
 * @param {(line: string) => void} [log]
 * @returns {Promise<{ ops: number, ok: number, failed: string[], live: { ok: boolean, ms: number | null, why: string }, errors: number }>}
 */
export async function runFlows(opts, log = (line) => process.stdout.write(line + "\n")) {
  const headers = { Authorization: `Bearer ${opts.token}` };
  const reg = await (await fetch(new URL("/api/ops", opts.door), { headers })).json();
  const ops = Array.isArray(reg.ops) ? reg.ops : [];
  const close = closeMonthFor(opts.now ?? new Date());
  const inputs = flowInputs({ tmp: opts.tmp, closeMonth: close.month });
  // The fixtures the flows need, made here and nowhere else: the payment the close reconciles, and the article the
  // seal hashes.
  writeFileSync(join(opts.tmp, "flow-charge.json"), JSON.stringify({ amount: FLOW_PAYMENT_MINOR, currency: "INR", venture: "arc", provider: "razorpay", provider_payment_id: "razorpay:pay_flow1" }));
  const seeded = spawnSync(process.execPath, [join(opts.repo, ".claude", "scripts", "hq", "arc-event.mjs"), "ingest", "revenue.received", "--json", join(opts.tmp, "flow-charge.json"), "--venture", "arc", "--run-id", "r-flow1"],
    { cwd: opts.repo, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: opts.spine, ARC_SPINE_NOW: String(close.at) } });
  if (seeded.status !== 0) log(`flows: WARN the close flow's payment was not seeded -- ${oneLine(String(seeded.stderr).slice(0, 200))}`);
  writeFileSync(join(opts.tmp, "flow-probe.mdx"), "---\ntitle: A browser flow, sealed\n---\n\nAn article the browser flow seals.\n");

  // EVERY page, through the door's own cursor: the first page of a kind the fixture already holds many of ends before
  // a receipt written a second ago, and the flow read "no such id" for a receipt that was there (CI, PR 2 run 1).
  const spineIds = async (kind) => {
    const ids = new Set();
    let since = "";
    for (let pages = 0; pages < 200; pages++) {
      const r = await fetch(new URL(`/api/spine?kind=${encodeURIComponent(kind)}&limit=500${since ? `&since=${since}` : ""}`, opts.door), { headers });
      const b = await r.json();
      const evs = Array.isArray(b.events) ? b.events : [];
      for (const e of evs) if (e && e.event && e.event.id) ids.add(e.event.id);
      if (!b.more || !b.next || b.next === since) break;
      since = b.next;
    }
    return ids;
  };

  return withChrome(async (session) => {
    const page = await openPage(session);
    const errors = [];
    const current = { room: "flows" };
    collectErrors(page, errors, current);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Log.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    const failed = [];
    let ok = 0;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      current.room = op.room;
      const input = Object.hasOwn(inputs, op.id) ? inputs[op.id] : null;
      if (!input) { failed.push(op.id); log(`flow: FAIL ${op.id} -- no flow drives this op (REQ-09: every shipped op has one)`); continue; }
      try {
        await page.send("Page.navigate", { url: `${opts.base}?flow=${i}#/${encodeURIComponent(op.room)}&token=${encodeURIComponent(opts.token)}` });
        const t0 = Date.now();
        // The door HTML-escapes every string it serves and the face decodes it before drawing; the flow finds inputs by
        // what the page DRAWS, so it decodes with the face's own function (CI, PR 2 run 1: a placeholder with an apostrophe
        // arrived as &#39; and matched nothing).
        const fields = (Array.isArray(op.fields) ? op.fields : []).map((f) => ({ ...f, placeholder: unescapeDoorText(String(f.placeholder ?? "")) }));
        const expect = flowExpect(op);
        const arg = { id: op.id, fields, input, humanRun: op.humanRun === true, frozen: FROZEN, capMs: 180000, expect, refusal: REFUSALS[op.id] || "" };
        const errorsBefore = errors.length;
        const r = await page.send("Runtime.evaluate", { expression: `(${pageFlow.toString()})(${JSON.stringify(arg)})`, awaitPromise: true, returnByValue: true });
        const res = r.result && r.result.value ? r.result.value : { ok: false, step: "the page returned nothing" };
        if (!res.ok) { failed.push(op.id); log(`flow: FAIL ${op.id} -- ${oneLine(redactSecrets(res.step + (res.text ? ` :: ${res.text}` : ""), [opts.token]))}`); continue; }
        if (expect === "refusal") {
          // A door refusal at apply is an HTTP 403, and Chrome logs every non-2xx response as a resource error. That ONE
          // entry -- this op's own /apply, answered 403, when the card showed SIM_EFFECT -- is the flow's expected
          // outcome, not a page error; anything else logged meanwhile still counts (Windows CI, PR 3a: the only leg where
          // the scheduler op plans, so the only one that reached the apply).
          if (res.atApply && /SIM_EFFECT/.test(String(res.refused))) {
            const k = errors.findIndex((e, i) => i >= errorsBefore && e.type === "log" && /status of 403/.test(e.text) && String(e.url || "").endsWith(`/api/op/${op.id}/apply`));
            if (k >= 0) errors.splice(k, 1);
          }
          ok++;
          log(`flow: ok ${op.id} refused-as-shown=${oneLine(redactSecrets(String(res.refused), [opts.token])).slice(0, 100)} ms=${Date.now() - t0}`);
          continue;
        }
        // The assertion is the RECEIPT, read back through the door -- never what the card says about itself.
        const kind = op.receipt && op.receipt.kind;
        const landed = (await spineIds(kind)).has(res.receipt);
        if (!landed) { failed.push(op.id); log(`flow: FAIL ${op.id} -- the card drew ${res.receipt}, and /api/spine has no ${kind} with that id`); continue; }
        ok++;
        log(`flow: ok ${op.id} receipt=${kind} ${res.receipt} ms=${Date.now() - t0}`);
      } catch (e) {
        failed.push(op.id);
        log(`flow: FAIL ${op.id} -- ${oneLine(redactSecrets(String(e && e.message ? e.message : e), [opts.token]))}`);
      }
    }

    // THE LIVE FLOW (REQ-11): the spine room open, a receipt appended behind the page's back, the room re-reads on
    // the door's pulse and shows it -- no reload, no click.
    const live = { ok: false, ms: /** @type {number | null} */ (null), why: "" };
    try {
      current.room = "spine";
      await page.send("Page.navigate", { url: `${opts.base}?flow=live#/spine&token=${encodeURIComponent(opts.token)}` });
      const read = async () => { const r = await page.send("Runtime.evaluate", { expression: `(${kpiFigure.toString()})("total")`, returnByValue: true }); return typeof r.result?.value === "number" ? r.result.value : null; };
      let before = null;
      await until(async () => { before = await read(); return before !== null; }, 20000);
      if (before === null) live.why = "the spine room never drew its event count";
      else {
        const appended = spawnSync(process.execPath, [join(opts.repo, ".claude", "scripts", "hq", "arc-event.mjs"), "emit", "note.logged", "--payload", JSON.stringify({ note: "live-pulse flow" }), "--strict"],
          { cwd: opts.repo, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: opts.spine } });
        if (appended.status !== 0) live.why = `the append was refused: ${oneLine(String(appended.stderr).slice(0, 160))}`;
        else {
          const t0 = Date.now();
          let after = before;
          const seen = await until(async () => { after = await read(); return after !== null && after > /** @type {number} */ (before); }, LIVE_MS * 2);
          live.ms = seen ? Date.now() - t0 : null;
          live.ok = seen && /** @type {number} */ (live.ms) <= LIVE_MS;
          live.why = seen ? (live.ok ? "" : `the room showed it after ${live.ms} ms, past ${LIVE_MS}`) : `the room still showed ${after} after ${LIVE_MS * 2} ms`;
        }
      }
    } catch (e) {
      live.why = oneLine(redactSecrets(String(e && e.message ? e.message : e), [opts.token]));
    }
    log(`flow: live ${live.ok ? "ok" : "FAIL"} ms=${live.ms ?? "none"}${live.why ? ` -- ${live.why}` : ""}`);

    // THE SESSION FLOW (face v2 Phase 06, REQ-08): no session starts without a click.
    const sessions = await sessionFlow({ ...opts, page, errors, current }, log);
    log(sessionsLine(sessions));

    for (const e of errors.slice(0, 10)) log(`flow: page-error room=${e.room} ${e.type} ${oneLine(redactSecrets(e.text, [opts.token]))}`);
    return { ops: ops.length, ok, failed, live, sessions, errors: errors.length };
  });
}

/** The session dock's frozen button text: the flow finds its buttons by it. */
export const SESSION_FROZEN = Object.freeze({ start: "Start session", attach: "Attach" });

/**
 * How many START requests the door has journalled -- refused or not, since a start that was refused was still a start
 * the page asked for. The door journals every request to a mutating route (arc-dash's dispatcher), so this counts what
 * the PAGE did, not what the door allowed. FAIL-CLOSED (attack a320d86 B5): a torn line that names the start route
 * counts as a start, the path is compared as a URL's pathname (a query string or a trailing slash still counts), and a
 * journal that cannot be read answers null -- UNMEASURED, never the passing 0.
 * @param {string} journalDir @returns {number | null}
 */
export function startRequests(journalDir) {
  let files;
  try { files = readdirSync(journalDir).filter((f) => /^journal-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)); }
  catch { return null; }
  // The door journals every request it refuses and every mutating one it serves; a journal with NO file is a journal
  // this flow is not reading -- a wrong directory, never "no starts" (round-2 attack d90c3b1 B8).
  if (files.length === 0) return null;
  let n = 0;
  for (const f of files) {
    let text;
    try { text = readFileSync(join(journalDir, f), "utf8"); } catch { return null; }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let e;
      // A line that does not parse cannot be judged either way: the whole count is UNMEASURED (B8).
      try { e = JSON.parse(line); } catch { return null; }
      if (e === null || typeof e !== "object" || Array.isArray(e)) return null;
      // Only the dispatcher's request records carry `method`; each must carry the path it answered. Another writer's
      // line (the work door's, the session door's own) carries neither and is not a request.
      if (!("method" in e)) continue;
      if (typeof e.path !== "string") return null;
      let path = e.path;
      try { path = new URL(e.path, "http://door.invalid").pathname; } catch { return null; }
      if (/^\/api\/session\/[^/]+\/start\/?$/.test(path)) n++;
    }
  }
  return n;
}

/** The session dock as the page draws it, read in the page. Self-contained, like pageFlow. */
function dockState() {
  const dock = document.querySelector("section[data-room] [data-session-dock]");
  const mark = /** @type {any} */ (window).__arcSessionFlowMark === 1;
  if (!dock) return { room: "", cards: 0, runs: 0, lines: 0, mark, runState: "" };
  const run = dock.querySelector("[data-session-run]");
  return { room: String(dock.getAttribute("data-session-dock")), cards: dock.querySelectorAll("[data-session]").length, runs: dock.querySelectorAll("[data-session-run]").length, lines: dock.querySelectorAll("[data-session-lines]").length, mark, runState: run ? String(run.getAttribute("data-session-run-state")) : "" };
}

/** Mark THIS document, so a navigation is proven by the mark being gone. Self-contained. */
function markDocument() {
  /** @type {any} */ (window).__arcSessionFlowMark = 1;
  return "";
}

/** Click the button with this text inside the element matching `scope`, in the page. Self-contained. @param {{ scope: string, text: string }} arg */
function clickIn(arg) {
  const el = document.querySelector(arg.scope);
  if (!el) return "no element " + arg.scope;
  const b = Array.from(el.querySelectorAll("button")).find((x) => x.textContent.trim() === arg.text);
  if (!b) return "no button " + arg.text;
  if (b.disabled) return "the button " + arg.text + " is disabled";
  b.click();
  return "";
}

/** The refusal a session card shows, read in the page. Self-contained. @param {string} scope */
function refusalIn(scope) {
  const el = document.querySelector(scope + " [data-session-refused]");
  return el ? el.textContent.trim() : "";
}

/**
 * Open every served room that carries a session verb, reload it, and attach to a running session -- then count the
 * door's start requests: 0. Then the positive control: one click on Start, and the count is exactly 1. A flow whose
 * counter cannot move proves nothing, so the control is part of the pass. The control is DETERMINISTIC: the harness
 * door is a sim door and the card starts on the default driver (auto), so the door answers SIM_SPEND before any spawn,
 * on every branch and every runner -- the flow never starts a real session (attack a320d86 B1, B2).
 * @param {{ door: string, base: string, token: string, tmp: string, repo: string, journal?: string, page: any, errors: any[], current: { room: string } }} o
 * @param {(line: string) => void} log
 */
export async function sessionFlow(o, log) {
  const res = { ok: false, rooms: 0, reloads: 0, attach: false, starts: -1, control: -1, why: "" };
  const journal = o.journal ?? join(o.tmp, "journal");
  const headers = { Authorization: `Bearer ${o.token}` };
  const page = o.page;
  // A page-side exception is thrown, never read as the permissive answer (attack a320d86 B4).
  const evalPage = async (fn, arg) => {
    const r = await page.send("Runtime.evaluate", { expression: `(${fn.toString()})(${arg === undefined ? "" : JSON.stringify(arg)})`, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`the page threw in ${fn.name}: ${oneLine(redactSecrets(String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? "an exception"), [o.token]))}`);
    return r.result ? r.result.value : undefined;
  };
  // A predicate that throws mid-navigation (the context is being replaced) is "not yet", never the flow's failure.
  const tryState = async () => { try { return await evalPage(dockState); } catch { return null; } };
  const clicked = async (arg) => {
    const v = await evalPage(clickIn, arg);
    if (typeof v !== "string") throw new Error(`clickIn answered ${JSON.stringify(v)}, not a string`);
    return v;
  };
  // Bounded, and every failure named by its own cause: a status the door refused, or a body that would not read --
  // never blamed on the registry's contents (attack a320d86 B7, round-2 B10).
  const getJson = async (path) => {
    const r = await fetch(new URL(path, o.door), { headers, signal: AbortSignal.timeout(15_000) });
    let body;
    try { body = await r.json(); }
    catch (e) { throw new Error(`GET ${path} (${r.status}) body unreadable: ${e && e.message ? e.message : e}`); }
    if (!r.ok) throw new Error(`GET ${path} answered ${r.status} ${body && (body.error || body.code) ? String(body.error || body.code) : ""}`.trim());
    return body;
  };
  // Open a room and wait for THIS room's dock on a NEW document: the mark set on the old one must be gone, and the
  // dock must name the room -- the previous room's dock, or another room's, never counts (round-2 attack B9).
  const openRoom = async (room, tag) => {
    await evalPage(markDocument).catch(() => "");
    await page.send("Page.navigate", { url: `${o.base}?sessions=${tag}#/${encodeURIComponent(room)}&token=${encodeURIComponent(o.token)}` });
    let st = null;
    await until(async () => { st = await tryState(); return st !== null && !st.mark && st.room === room && st.cards > 0; }, 20000);
    return st;
  };
  /** Set the reason and hand back the result: every exit is logged below, in finally (round-2 attack B2). */
  const fail = (why) => { res.why = why; return res; };
  /** @type {import("node:child_process").ChildProcess | null} */
  let holder = null;
  try {
    // The expected rooms come from the REGISTRY FILE, not from the door under test: every row's room must be served
    // and swept, and one that is not fails by name (attack a320d86 B8).
    const { SESSIONS } = await import(pathToFileURL(join(o.repo, ".claude", "scripts", "hq", "face-sessions.mjs")).href);
    const served = new Set(((await getJson("/api/rooms")).rooms || []).map((r) => r.id));
    const wanted = [...new Set(SESSIONS.map((s) => s.room))].sort();
    const unserved = wanted.filter((r) => !served.has(r));
    if (unserved.length) return fail(`session rows name rooms the face does not serve: ${unserved.join(", ")}`);
    const reg = await getJson("/api/sessions");
    const regRooms = new Set((reg.sessions || []).map((s) => s.room));
    const missing = wanted.filter((r) => !regRooms.has(r));
    if (missing.length) return fail(`the door's registry is missing rooms the registry file names: ${missing.join(", ")}`);

    // A RUNNING session to attach to: a child THIS flow owns and kills, so the door's liveness reads a real process
    // started for the purpose (attack a320d86 B6). Its spawn failing is a named failure, never an uncaught 'error', and
    // no record is seeded without its pid (round-2 attack B3).
    holder = spawn(process.execPath, ["-e", "setTimeout(() => {}, 600000)"], { stdio: "ignore", windowsHide: true });
    const spawnError = new Promise((resolveP) => { /** @type {any} */ (holder).once("error", (e) => resolveP(e)); });
    const early = await Promise.race([spawnError, new Promise((r) => setTimeout(() => r(null), 300))]);
    if (early || !Number.isInteger(holder.pid)) return fail(`the seeded run's holder did not start: ${early ? oneLine(String(/** @type {any} */ (early).message)) : "no pid"}`);
    const sid = `${Date.now().toString(36).padStart(9, "0").slice(-9)}flowrun`;
    const dir = join(journal, "sessions", sid);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "session.json"), JSON.stringify({ sid, session: "review-ship.review", room: "review-ship", process: "review-diff", driver: "mock", startedAt: Date.now(), digest: "flow", argv: ["node", ".claude/scripts/engine/arc-run.mjs", "--process", "review-diff", "--driver", "mock"], receipt: { kind: "review.completed" }, pid: holder.pid }));
    writeFileSync(join(dir, "run.log"), "phase: seeded by the browser flow\n");

    for (const room of wanted) {
      o.current.room = room;
      let st = await openRoom(room, room);
      if (!st || st.room !== room || st.cards === 0) return fail(`the ${room} room drew no session dock of its own`);
      res.rooms++;
      // A reload counts only once the NEW document has drawn this room's dock (attack a320d86 B3).
      await evalPage(markDocument);
      await page.send("Page.reload", { ignoreCache: false });
      st = null;
      await until(async () => { st = await tryState(); return st !== null && !st.mark && st.room === room && st.cards > 0; }, 20000);
      if (!st || st.mark || st.room !== room || st.cards === 0) return fail(`the ${room} room did not redraw its session dock after a reload`);
      res.reloads++;
      log(`sessions: room=${room} opened and reloaded`);
    }

    // Attach: a read, in the room the seeded run belongs to -- and the run must read RUNNING, or the attach poll (the
    // path a start-from-poll mutant would use) never ran (attack a320d86 B6).
    o.current.room = "review-ship";
    const at = await openRoom("review-ship", "attach");
    if (!at || at.runs === 0) return fail("the review-ship room listed no session to attach to");
    const attachWhy = await clicked({ scope: `[data-session-run="${sid}"]`, text: SESSION_FROZEN.attach });
    if (attachWhy) return fail(`attach: ${attachWhy}`);
    let st = null;
    res.attach = await until(async () => { st = await tryState(); return st !== null && st.lines > 0 && st.runState === "running"; }, 20000);
    if (!res.attach) return fail(`attach did not show the seeded run RUNNING with its lines (state ${st ? st.runState : "none"})`);
    // Past two of the attach poll's own intervals, so a start fired by the poll is counted too.
    await sleep(4000);

    res.starts = startRequests(journal) ?? -1;
    if (res.starts !== 0) return fail(res.starts < 0 ? "the door journal could not be read whole -- UNMEASURED" : `${res.starts} start request(s) with no click -- across ${res.rooms} rooms, ${res.reloads} reloads and an attach`);

    // THE POSITIVE CONTROL: one click on the default driver, one start request, refused SIM_SPEND by name.
    const errorsBefore = o.errors.length;
    const scope = '[data-session="review-ship.review"]';
    const startWhy = await clicked({ scope, text: SESSION_FROZEN.start });
    if (startWhy) return fail(`control: ${startWhy}`);
    let refused = "";
    await until(async () => { try { refused = await evalPage(refusalIn, scope); } catch { refused = ""; } return refused !== ""; }, 20000);
    res.control = startRequests(journal) ?? -1;
    // The refused start is a 403 the browser logs as a resource error: THAT one entry is the control's expected outcome.
    const k = o.errors.findIndex((e, i) => i >= errorsBefore && e.type === "log" && /status of 403/.test(e.text) && /\/api\/session\/review-ship\.review\/start$/.test(String(e.url || "")));
    if (k >= 0) o.errors.splice(k, 1);
    if (!/SIM_SPEND/.test(refused)) return fail(`the control was not refused SIM_SPEND: ${oneLine(refused).slice(0, 160) || "no refusal drawn"}`);
    if (res.control !== 1) return fail(`one click made ${res.control} start request(s), not 1`);
    res.ok = true;
    return res;
  } catch (e) {
    return fail(oneLine(redactSecrets(String(e && e.message ? e.message : e), [o.token])));
  } finally {
    if (holder) {
      const gone = new Promise((r) => { if (holder.exitCode !== null || holder.signalCode !== null) r(null); else holder.once("exit", () => r(null)); });
      try { holder.kill(); } catch { /* already gone */ }
      await Promise.race([gone, new Promise((r) => setTimeout(r, 5000))]);
    }
    if (!res.ok) log(`sessions: FAIL -- ${res.why}`);
  }
}

/** The session line the browser suite reads. A failed line carries its reason. @param {Awaited<ReturnType<typeof sessionFlow>>} s */
export function sessionsLine(s) {
  return `sessions: ${s.ok ? "ok" : "FAIL"} rooms=${s.rooms} reloads=${s.reloads} attach=${s.attach ? "ok" : "FAIL"} starts=${s.starts} control=${s.control}${s.ok ? "" : ` -- ${s.why}`}`;
}

/** The line the browser suite reads. @param {Awaited<ReturnType<typeof runFlows>>} r */
export function flowsLine(r) {
  return `flows: ops=${r.ops} ok=${r.ok} fail=${r.failed.length} live=${r.live.ok ? "ok" : "FAIL"} live-ms=${r.live.ms ?? "none"} page-errors=${r.errors}`;
}
