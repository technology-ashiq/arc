// audit.cjs -- Phase 00 evidence tool (Cycle 17, ADR-1364): the re-run audit that found the v3 faults, as a script.
// Evidence tooling, not product code: it never ships, never runs in CI, and needs Playwright from the RUNNER's
// environment (PLAYWRIGHT_PATH, default the cloud session's /opt/npm-tools/node_modules/playwright).
//
// It reads the ops and sessions the door SERVES (never a copied list), opens every served room at 1366x768,
// and prints one markdown table: room, verbs it should draw, first-verb top (px), page height (px), console
// errors. Rooms with verbs pass when first-verb top < 768; the summary line counts them. Then three more counts,
// each from the page or the door, never from a copied number: the org chart (role chips, department boxes, chips
// left by the Vacant filter), the not-ready sessions (door `processReady: false` vs strip badges marked not
// ready), and every op planned with its own placeholders through `POST /api/op/:id/plan` (status 200 counted).
//
//   APP=http://localhost:5180/ DOOR=http://127.0.0.1:8317 ARC_DASH_TOKEN=... node audit.cjs > audit-SHA.md
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "/opt/npm-tools/node_modules/playwright");
const APP = process.env.APP || "http://localhost:5180/";
const DOOR = process.env.DOOR || "http://127.0.0.1:8317";
const TOK = process.env.ARC_DASH_TOKEN;
if (!TOK) { console.error("audit: ARC_DASH_TOKEN is required"); process.exit(2); }
const post = async (p, body) => (await fetch(DOOR + p, { method: "POST", headers: { Authorization: "Bearer " + TOK, "Content-Type": "application/json" }, body: JSON.stringify(body) })).status;
const get = async (p) => { const r = await fetch(DOOR + p, { headers: { Authorization: "Bearer " + TOK } }); if (!r.ok) throw new Error(p + " -> " + r.status); return r.json(); };
(async () => {
  const rr = await get("/api/rooms"); const rooms = Array.isArray(rr) ? rr : rr.rooms;
  const [ops, sess] = [(await get("/api/ops")).ops, (await get("/api/sessions")).sessions];
  const verbs = {};
  for (const o of ops) (verbs[o.room] ||= []).push(o.id);
  for (const s of sess) (verbs[s.room] ||= []).push(s.id);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const rows = [];
  for (const r of rooms) {
    if (r.status === "template") continue;
    const p = await ctx.newPage(); let errs = 0;
    p.on("console", (m) => { if (m.type() === "error" && !/ERR_TUNNEL_CONNECTION_FAILED/.test(m.text())) errs++; });
    p.on("pageerror", () => errs++);
    await p.goto(`${APP}#/${r.id}&token=${TOK}`); await p.waitForTimeout(3000);
    const m = await p.evaluate(() => {
      const strip = [...document.querySelectorAll("[data-strip-item]")].filter((e) => e.offsetParent);
      return { top: strip.length ? Math.round(Math.min(...strip.map((e) => e.getBoundingClientRect().top))) : null, h: document.documentElement.scrollHeight };
    });
    rows.push({ id: r.id, n: (verbs[r.id] || []).length, ...m, errs }); await p.close();
  }
  // org chart: chips and department boxes as drawn, then the Vacant filter.
  const op = await ctx.newPage();
  await op.goto(`${APP}#/org&token=${TOK}`); await op.waitForTimeout(3500);
  const chart = await op.evaluate(() => ({ chips: document.querySelectorAll("[data-org-chip]").length, depts: document.querySelectorAll("[data-org-dept]").length }));
  await op.getByRole("button", { name: /^Vacant$/ }).first().click().catch(() => {}); await op.waitForTimeout(800);
  chart.vacant = await op.evaluate(() => document.querySelectorAll("[data-org-chip]").length);
  await op.close();
  await b.close();
  // not-ready sessions: the door's flag, and the strip's own badge for each.
  const notReady = sess.filter((x) => x.processReady === false).map((x) => x.id);
  // every op planned with its own placeholders (a select takes its first served option).
  let planned = 0;
  for (const o of ops) {
    const input = {};
    for (const f of o.fields || []) input[f.name] = f.options && f.options.length ? (typeof f.options[0] === "object" ? f.options[0].value : f.options[0]) : (f.placeholder || "");
    if ((await post(`/api/op/${o.id}/plan`, { input })) === 200) planned++;
  }
  const withVerbs = rows.filter((x) => x.n > 0), pass = withVerbs.filter((x) => x.top !== null && x.top < 768);
  console.log("| room | verbs | first verb top (px) | page height (px) | console errors |\n|---|---|---|---|---|");
  for (const x of rows) console.log(`| ${x.id} | ${x.n} | ${x.top ?? "—"} | ${x.h} | ${x.errs} |`);
  console.log(`\nfirst verb < 768 px: ${pass.length}/${withVerbs.length} rooms with verbs · console errors: ${rows.reduce((a, x) => a + x.errs, 0)}`);
  console.log(`org chart: ${chart.chips} role chips · ${chart.depts} department boxes · ${chart.vacant} after the Vacant filter`);
  console.log(`not-ready sessions (door): ${notReady.length} -- ${notReady.join(", ")}`);
  console.log(`ops planned 200 with their own placeholders: ${planned}/${ops.length}`);
})().catch((e) => { console.error("audit:", e.message); process.exit(1); });
