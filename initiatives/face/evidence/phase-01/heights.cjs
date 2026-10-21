// heights.cjs -- Phase 01 evidence tool (Cycle 17, REQ-02): page height and the tallest panels of the four long rooms at
// 1366x768, Overview tab. Evidence tooling like phase-00/audit.cjs: never ships, never runs in CI.
//   APP=... ARC_DASH_TOKEN=... PLAYWRIGHT_PATH=... node heights.cjs > heights-SHA.md
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "/opt/npm-tools/node_modules/playwright");
const APP = process.env.APP || "http://localhost:5180/";
const TOK = process.env.ARC_DASH_TOKEN;
if (!TOK) { console.error("heights: ARC_DASH_TOKEN is required"); process.exit(2); }
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  console.log("| room | page height (px) | tallest panels (px) |\n|---|---|---|");
  for (const id of ["ventures", "money", "story", "org"]) {
    await p.goto(`${APP}#/${id}&token=${TOK}`); await p.waitForTimeout(3000);
    const m = await p.evaluate(() => ({
      h: document.documentElement.scrollHeight,
      panels: [...document.querySelectorAll("section")].map((s) => ({ t: (s.querySelector("h2,h3")?.textContent || "?").trim().slice(0, 40), h: Math.round(s.getBoundingClientRect().height) })).sort((a, b) => b.h - a.h).slice(0, 5),
    }));
    console.log(`| ${id} | ${m.h} | ${m.panels.map((x) => `${x.t} ${x.h}`).join(" · ")} |`);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
