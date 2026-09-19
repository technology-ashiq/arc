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

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { openPage } from "./cdp.mjs";
import { withChrome, collectErrors, until, redactSecrets, oneLine } from "./smoke.mjs";
import { unescapeDoorText } from "../src/lib/door.mjs";

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
    for (const e of errors.slice(0, 10)) log(`flow: page-error room=${e.room} ${e.type} ${oneLine(redactSecrets(e.text, [opts.token]))}`);
    return { ops: ops.length, ok, failed, live, errors: errors.length };
  });
}

/** The line the browser suite reads. @param {Awaited<ReturnType<typeof runFlows>>} r */
export function flowsLine(r) {
  return `flows: ops=${r.ops} ok=${r.ok} fail=${r.failed.length} live=${r.live.ok ? "ok" : "FAIL"} live-ms=${r.live.ms ?? "none"} page-errors=${r.errors}`;
}
