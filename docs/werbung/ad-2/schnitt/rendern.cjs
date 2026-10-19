// Rendert die Text-Ebenen und die Endkarte als PNG 1080x1920 (transparent) mit Chromium.
const { chromium } = require(process.env.USERPROFILE + "/pw-probead/node_modules/playwright");
const path = require("node:path");
(async () => {
  const b = await chromium.launch({ executablePath: process.env.USERPROFILE + "/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe" });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const arten = ["t1", "t2", "t3", "o-hamburg", "o-koeln", "o-leipzig", "t4", "streifen", "endkarte"];
  for (const art of arten) {
    await p.goto("file:///" + path.resolve(__dirname, "ebenen.html").split(path.sep).join("/") + "?art=" + art);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    await p.screenshot({ path: `ebenen/${art}.png`, omitBackground: art !== "endkarte" });
    console.log(art);
  }
  await b.close();
})();
