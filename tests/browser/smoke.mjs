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
    // Validate actual browser geometry, not just the presence of DOM nodes.
    const geometry = await page.evaluate(() => {
      const navRect = document.querySelector('[data-role="bottom-navigation"]').getBoundingClientRect();
      const rects = [...document.querySelectorAll('[data-jui-dashboard-item]')].map((element) => {
        const r = element.getBoundingClientRect();
        return { id: element.getAttribute("data-jui-dashboard-item"),
          left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      });
      return { rects, navTop: navRect.top, viewportWidth: innerWidth };
    });
    assert.equal(geometry.rects.length, 3);
    for (const item of geometry.rects) {
      assert.ok(item.width > 0 && item.height > 0, "Empty dashboard tile: " + JSON.stringify(item));
      assert.ok(item.left >= -2 && item.right <= geometry.viewportWidth + 2,
        "Clipped dashboard tile horizontally: " + JSON.stringify(item));
      assert.ok(item.top >= -2 && item.bottom <= geometry.navTop + 2,
        "Dashboard tile overlaps navigation: " + JSON.stringify(item));
    }
    for (let first = 0; first < geometry.rects.length; first++) {
      for (let second = first + 1; second < geometry.rects.length; second++) {
        const a = geometry.rects[first], b = geometry.rects[second];
        const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        assert.ok(overlapWidth * overlapHeight < 2,
          "Overlapping dashboard tiles: " + JSON.stringify([a, b]));
      }
    }

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

    // End-to-end touch-style dashboard editing: long press, move, undo,
    // and a single atomic write through the canonical HA config transport.
    const houseItem = page.locator('[data-jui-dashboard-item="house"]');
    const houseBox = await houseItem.boundingBox();
    assert.ok(houseBox?.width > 0 && houseBox?.height > 0, "House tile must have measurable bounds");
    const anchor = { x: houseBox.x + houseBox.width / 2, y: houseBox.y + houseBox.height / 2 };
    await page.mouse.move(anchor.x, anchor.y);
    await page.mouse.down();
    await page.waitForTimeout(650); // Above the configured 550 ms long-press threshold.
    await page.mouse.up();
    const toolbar = page.locator('[data-jui-editor-toolbar]');
    await toolbar.waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => window.__juiTest.writes), 0);

    const dragHouseDown = async () => {
      await page.mouse.move(anchor.x, anchor.y);
      await page.mouse.down();
      await page.mouse.move(anchor.x, anchor.y + houseBox.height + 12, { steps: 6 });
      await page.mouse.up();
    };
    await dragHouseDown();
    await page.waitForFunction(() =>
      document.querySelector('[data-jui-dashboard-item="house"]')?.style.gridRow?.startsWith("5 /"));
    await toolbar.getByRole("button", { name: "Rückgängig" }).click();
    await page.waitForFunction(() =>
      document.querySelector('[data-jui-dashboard-item="house"]')?.style.gridRow?.startsWith("1 /"));
    assert.equal(await page.evaluate(() => window.__juiTest.writes), 0);
    await dragHouseDown();
    await toolbar.getByRole("button", { name: "Fertig" }).click();
    await page.waitForFunction(() => window.__juiTest.writes === 1);
    await toolbar.waitFor({ state: "hidden" });
    const saved = await page.evaluate(() => window.__juiTest.persisted);
    assert.equal(saved.pages.home.elements.find((item) => item.id === "house")?.row, 4);
    assert.equal(saved.pages.home.elements.find((item) => item.id === "agenda")?.row, 0);
    assert.equal(saved.data_sources["provider.weather"].entity_id, "weather.browser_fixture");

    // A failed HA write must retain both the previous remote state and
    // the local unsaved edit. Retrying commits exactly the pending change.
    const movedHouseBox = await houseItem.boundingBox();
    assert.ok(movedHouseBox, "Moved house tile must remain available");
    const movedAnchor = {
      x: movedHouseBox.x + movedHouseBox.width / 2,
      y: movedHouseBox.y + movedHouseBox.height / 2,
    };
    await page.mouse.move(movedAnchor.x, movedAnchor.y);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    await toolbar.waitFor({ state: "visible" });
    await page.mouse.move(movedAnchor.x, movedAnchor.y);
    await page.mouse.down();
    await page.mouse.move(movedAnchor.x, movedAnchor.y - movedHouseBox.height - 12, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction(() =>
      document.querySelector('[data-jui-dashboard-item="house"]')?.style.gridRow?.startsWith("1 /"));

    await page.evaluate(() => { window.__juiTest.rejectNextReplace = true; });
    await toolbar.getByRole("button", { name: "Fertig" }).click();
    await page.locator('[data-jui-editor-save-error]').waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => window.__juiTest.writes), 1);
    assert.equal(await page.evaluate(() =>
      window.__juiTest.persisted.pages.home.elements.find((item) => item.id === "house").row), 4);
    assert.equal(await toolbar.isVisible(), true);
    assert.equal(await houseItem.evaluate((node) => node.style.gridRow), "1 / span 4");

    await toolbar.getByRole("button", { name: "Fertig" }).click();
    await page.waitForFunction(() => window.__juiTest.writes === 2);
    await toolbar.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() =>
      window.__juiTest.persisted.pages.home.elements.find((item) => item.id === "house").row), 0);

    // The editor must also be reachable without any long-press (including
    // an initially empty page). The catalog refuses incomplete input and
    // commits both a valid widget and its real source IDs together.
    await page.locator('[data-jui-dashboard-edit-entry]').click();
    await toolbar.waitFor({ state: "visible" });
    await toolbar.getByRole("button", { name: "+ Hinzufügen" }).click();
    const catalog = page.locator('[data-jui-dashboard-catalog]');
    await catalog.waitFor({ state: "visible" });
    await catalog.locator('[data-jui-catalog-module="widget.calendar-agenda"]').click();
    await catalog.locator('[data-jui-catalog-confirm]').click();
    assert.match(await catalog.locator('[data-jui-catalog-error]').innerText(), /Mindestens eine/);
    assert.equal(await page.locator('[data-jui-dashboard-item]').count(), 3);
    assert.equal(await page.evaluate(() => window.__juiTest.writes), 2);

    await catalog.locator('[data-jui-catalog-field="calendars"]').fill("calendar.family");
    await catalog.locator('[data-jui-catalog-field="tasks"]').fill("todo.family");
    await catalog.locator('[data-jui-catalog-confirm]').click();
    await catalog.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.querySelectorAll('[data-jui-dashboard-item]').length === 4);
    assert.equal(await page.locator('[data-jui-widget-error]').count(), 0);
    await toolbar.getByRole("button", { name: "Fertig" }).click();
    await page.waitForFunction(() => window.__juiTest.writes === 3);
    const latest = await page.evaluate(() => window.__juiTest.persisted);
    const agendaInstance = latest.pages.home.elements.find((item) => item.id.startsWith("widget-calendar-agenda-"));
    assert.ok(agendaInstance, "A unique, separate Agenda widget instance must be persisted");
    assert.equal(latest.widget_instances[agendaInstance.ref_id].config.instance_id, agendaInstance.ref_id);
    assert.deepEqual(latest.data_sources["provider.calendar"].source_entity_ids, ["calendar.family"]);
    assert.deepEqual(latest.data_sources["provider.tasks"].source_entity_ids, ["todo.family"]);
    await page.waitForFunction(() =>
      window.__juiTest.app.core.moduleLoader.isLoaded("provider.calendar") &&
      window.__juiTest.app.core.moduleLoader.isLoaded("provider.tasks"));
    assert.equal(await page.evaluate(() => window.__juiTest.app.core.capabilities.get("calendar.events").status), "available");
    assert.equal(await page.evaluate(() => window.__juiTest.app.core.capabilities.get("tasks.items").status), "available");
    assert.equal(latest.widget_instances.agenda.config.instance_id, "browser-agenda");
    assert.deepEqual(errors, [], "Browser JavaScript errors");
    await page.evaluate(() => window.__juiTest.app.destroy());
    assert.equal(await page.locator('[data-role="app-shell"]').count(), 0);
    await page.close();
    console.log("PASS browser viewport " + viewport.width + "x" + viewport.height);
  }

  // A fresh installation starts with no page and no configured widgets.
  // The first-run initialization must be editable even without a tile to long-press.
  const emptyPage = await browser.newPage({ viewport: { width: 800, height: 1280 }, isMobile: true, hasTouch: true });
  const emptyErrors = [];
  emptyPage.on("pageerror", (error) => emptyErrors.push(error.message));
  await emptyPage.goto(base + "/tests/browser/fixture.html?empty=1", { waitUntil: "load" });
  await emptyPage.waitForFunction(() => ["ready", "error"].includes(window.__juiTest?.status), null, { timeout: 20000 });
  assert.equal(await emptyPage.evaluate(() => window.__juiTest.status),
    "ready", await emptyPage.evaluate(() => window.__juiTest.error));
  assert.equal(await emptyPage.locator('[data-jui-dashboard-item]').count(), 0);
  assert.equal(await emptyPage.evaluate(() => window.__juiTest.writes), 1, "Empty first-run config was initialized once");
  await emptyPage.locator('[data-jui-dashboard-edit-entry]').click();
  const blankToolbar = emptyPage.locator('[data-jui-editor-toolbar]');
  await blankToolbar.waitFor({ state: "visible" });
  await blankToolbar.getByRole("button", { name: "+ Hinzufügen" }).click();
  const blankCatalog = emptyPage.locator('[data-jui-dashboard-catalog]');
  await blankCatalog.locator('[data-jui-catalog-module="widget.weather-today"]').click();
  await blankCatalog.locator('[data-jui-catalog-confirm]').click();
  assert.match(await blankCatalog.locator('[data-jui-catalog-error]').innerText(), /Wetter-Entität/);
  await blankCatalog.locator('[data-jui-catalog-field="weatherEntityId"]').fill("weather.browser_fixture");
  await blankCatalog.locator('[data-jui-catalog-confirm]').click();
  await emptyPage.waitForFunction(() => document.querySelectorAll('[data-jui-dashboard-item]').length === 1);
  assert.equal(await emptyPage.locator('[data-jui-widget-error]').count(), 0);
  await blankToolbar.getByRole("button", { name: "Fertig" }).click();
  await emptyPage.waitForFunction(() => window.__juiTest.writes === 2);
  assert.equal(await emptyPage.evaluate(() =>
    window.__juiTest.persisted.pages.home.elements.length), 1);
  assert.deepEqual(await emptyPage.evaluate(() => window.__juiTest.persisted.data_sources),
    { "provider.weather": { entity_id: "weather.browser_fixture" } });
  await emptyPage.waitForFunction(() => window.__juiTest.app.core.moduleLoader.isLoaded("provider.weather"));
  assert.equal(await emptyPage.evaluate(() => window.__juiTest.app.core.capabilities.get("weather.current").status), "available");

  // The same empty-installation editor can compose an existing Block-12
  // heating-zone widget with explicit signals and immediately bind its provider.
  await emptyPage.locator('[data-jui-dashboard-edit-entry]').click();
  await blankToolbar.waitFor({ state: "visible" });
  await blankToolbar.getByRole("button", { name: "+ Hinzufügen" }).click();
  await blankCatalog.locator('[data-jui-catalog-module="widget.house-quick"]').click();
  await blankCatalog.locator('[data-jui-catalog-field="houseType"]').selectOption("heating_zone");
  await blankCatalog.locator('[data-jui-catalog-field="heatingName"]').fill("Wohnzimmer");
  await blankCatalog.locator('[data-jui-catalog-field="currentTemperature"]').fill("sensor.living_actual");
  await blankCatalog.locator('[data-jui-catalog-field="targetTemperature"]').fill("sensor.living_target");
  await blankCatalog.locator('[data-jui-catalog-field="heatingDemand"]').fill("binary_sensor.living_heat");
  await blankCatalog.locator('[data-jui-catalog-field="autoRegulation"]').fill("binary_sensor.living_auto");
  await blankCatalog.locator('[data-jui-catalog-confirm]').click();
  await blankCatalog.waitFor({ state: "hidden" });
  await emptyPage.waitForFunction(() => document.querySelectorAll('[data-jui-dashboard-item]').length === 2);
  assert.equal(await emptyPage.locator('[data-jui-widget-error]').count(), 0);
  await blankToolbar.getByRole("button", { name: "Fertig" }).click();
  await emptyPage.waitForFunction(() => window.__juiTest.writes === 3);
  await emptyPage.waitForFunction(() => window.__juiTest.app.core.moduleLoader.isLoaded("provider.house-heating"));
  const heating = await emptyPage.evaluate(() => ({
    zone: window.__juiTest.persisted.data_sources["provider.house-heating"].zones[0],
    instance: window.__juiTest.persisted.pages.home.elements.find((element) =>
      element.ref_id.startsWith("widget-house-quick-")),
    status: window.__juiTest.app.core.capabilities.get("house.heatingZones").status,
  }));
  assert.equal(heating.zone.name, "Wohnzimmer");
  assert.equal(heating.zone.auto_regulation_enabled.entity_id, "binary_sensor.living_auto");
  assert.ok(heating.instance, "Configured heating widget is saved");
  assert.equal(heating.status, "available");
  assert.deepEqual(emptyErrors, []);
  await emptyPage.evaluate(() => window.__juiTest.app.destroy());
  await emptyPage.close();
  console.log("PASS empty first-run dashboard editor");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
