// Real Chromium smoke test with a locally served JamesUI Next module tree.
// This validates browser layout and initialization, not real HA or Fully Kiosk.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../", import.meta.url));
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
const server = createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname).replace(/^\/+/, "");
    const file = path.resolve(root, requested);
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    const bytes = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream" }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});

let browser;
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const base = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 800, height: 1280 }, { width: 1024, height: 1366 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/tests/browser/fixture.html", { waitUntil: "load" });
    await page.waitForFunction(() => ["ready", "error"].includes(window.__juiTest?.status), null, { timeout: 20000 });
    const outcome = await page.evaluate(() => ({
      status: window.__juiTest.status,
      error: window.__juiTest.error,
    }));
    assert.equal(outcome.status, "ready", outcome.error ?? "JamesUI browser mount failed");
    assert.equal(await page.locator('[data-jui-dashboard-item]').count(), 3);
    assert.equal(await page.locator('[data-jui-widget-error]').count(), 0);
    assert.equal(await page.locator('[data-jui-widget="calendar-agenda"]').count(), 1);
    assert.equal(await page.locator('[data-jui-widget="house-quick"]').count(), 1);
    assert.equal(await page.locator('[data-jui-widget="dynamic-buttons"]').count(), 1);
    const nav = page.locator('[data-role="bottom-navigation"]');
    assert.equal(await nav.count(), 1);
    const metrics = await page.evaluate(() => {
      const nav = document.querySelector('[data-role="bottom-navigation"]');
      const bounds = nav.getBoundingClientRect();
      return {
        documentWidth: document.documentElement.scrollWidth,
        width: innerWidth, height: innerHeight,
        navTop: bounds.top, navBottom: bounds.bottom,
        availableButtons: [...nav.querySelectorAll("button")].filter((button) => !button.disabled).length,
      };
    });
    assert.ok(metrics.documentWidth <= metrics.width + 2,
      "Horizontal overflow at " + JSON.stringify(viewport) + ": " + JSON.stringify(metrics));
    assert.ok(metrics.navTop >= -2 && metrics.navBottom <= metrics.height + 2,
      "Navigation outside viewport: " + JSON.stringify(metrics));
    assert.equal(metrics.availableButtons, 1);
    assert.deepEqual(errors, [], "Browser JavaScript errors");
    await page.evaluate(() => window.__juiTest.app.destroy());
    assert.equal(await page.locator('[data-role="app-shell"]').count(), 0);
    await page.close();
    console.log("PASS browser viewport " + viewport.width + "x" + viewport.height);
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
