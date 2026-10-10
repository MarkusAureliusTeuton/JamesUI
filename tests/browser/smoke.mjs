// Real Chromium smoke test with a locally served JamesUI Next module tree.
// This validates browser layout and initialization, not real HA or Fully Kiosk.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
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
    const navigation = await page.goto(base + "/tests/browser/fixture.html", { waitUntil: "load" });
    assert.equal(navigation?.status(), 200, "Browser fixture must be served successfully");
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
    assert.equal(await nav.locator("button:disabled").count(), 4);

    // Real DOM, real click, and real provider-to-capability-to-widget updates.
    const weather = page.locator('[data-jui-widget="weather-today"]');
    const lights = page.locator('[data-jui-house-quick-id="lights"]');
    const dynamic = page.locator('[data-jui-dynamic-button]');
    await page.waitForFunction(() =>
      document.querySelector('[data-jui-weather-temperature]')?.textContent?.includes("21"));
    assert.match(await lights.innerText(), /0 von 1 an/);
    assert.equal(await lights.getAttribute("data-jui-house-quick-status"), "neutral");
    assert.match(await page.locator('[data-jui-agenda-source-notice]').first().innerText(), /Kalender derzeit nicht verfügbar/);

    // A forecast overlay without daily/hourly HA data must still open and close.
    await weather.locator('[data-jui-weather-forecast-trigger]').click();
    assert.equal(await page.locator('[data-jui-weather-forecast-overlay]').count(), 1);
    await page.locator('[data-jui-weather-forecast-close]').click();
    assert.equal(await page.locator('[data-jui-weather-forecast-overlay]').count(), 0);

    // The configured trigger uses the core navigate action (home is the only route).
    await dynamic.click();
    await page.waitForFunction(() =>
      document.querySelector('[data-jui-dynamic-button]')?.getAttribute("data-jui-dynamic-feedback") === "success");
    assert.equal(await dynamic.getAttribute("data-jui-dynamic-real-status"), "inactive");

    // HA entity change must cross the adapter/provider/widget boundaries.
    await page.evaluate(() => window.__juiTest.setHass({ light: "on", temperature: 23, weather: "rainy" }));
    await page.waitForFunction(() =>
      document.querySelector('[data-jui-weather-temperature]')?.textContent?.includes("23"));
    await page.waitForFunction(() =>
      document.querySelector('[data-jui-house-quick-id="lights"]')?.textContent?.includes("1 von 1 an"));
    assert.equal(await lights.getAttribute("data-jui-house-quick-status"), "active");

    // Connected-but-missing entities must be reported as missing, not left stale.
    await page.evaluate(() => window.__juiTest.setHass({ missingWeather: true, missingLight: true }));
    await page.waitForFunction(() =>
      document.querySelector('[data-jui-weather-temperature]')?.textContent?.includes("—"));
    await page.waitForFunction(() =>
      document.querySelector('[data-jui-house-quick-id="lights"]')?.textContent?.includes("1 nicht erreichbar"));
    assert.match(await lights.innerText(), /0 von 1 an/);
    assert.equal(await lights.getAttribute("data-jui-house-quick-status"), "warning");

    // Disconnect clears values; reconnect must restore fresh values without remount.
    await page.evaluate(() => window.__juiTest.setHass({ connected: false }));
    assert.equal(await page.evaluate(() => window.__juiTest.app.core.homeAssistant.connectionState()), "disconnected");
    await page.evaluate(() => window.__juiTest.setHass({ light: "off", temperature: 19, weather: "cloudy" }));
    await page.waitForFunction(() =>
      document.querySelector('[data-jui-weather-temperature]')?.textContent?.includes("19"));
    await page.waitForFunction(() =>
      document.querySelector('[data-jui-house-quick-id="lights"]')?.textContent?.includes("0 von 1 an"));
    assert.equal(await lights.getAttribute("data-jui-house-quick-status"), "neutral");
    assert.equal(await page.evaluate(() => window.__juiTest.app.core.homeAssistant.connectionState()), "connected");
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
