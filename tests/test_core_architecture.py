from pathlib import Path
import re
import unittest


FRONTEND_ROOT = Path("custom_components/jamesui/frontend")
CORE_ROOT = FRONTEND_ROOT / "core"
HA_ROOT = FRONTEND_ROOT / "ha"
DESIGN_ROOT = FRONTEND_ROOT / "design"
ICON_ROOT = FRONTEND_ROOT / "icons"
MODULES_ROOT = FRONTEND_ROOT / "modules"
HOME_HERO_DECK_ROOT = MODULES_ROOT / "layout.home-hero-deck"
WEATHER_PROVIDER_ROOT = MODULES_ROOT / "provider.weather"
WEATHER_TODAY_ROOT = MODULES_ROOT / "widget.weather-today"
CORE_REQUIRED = {
    "routes.js",
    "router.js",
    "event-bus.js",
    "overlay-service.js",
    "health-service.js",
    "shell.js",
    "host-context.js",
    "core-api.js",
    "module-manifest.js",
    "module-registry.js",
    "module-loader.js",
    "capability-registry.js",
    "action-registry.js",
    "core-action-providers.js",
    "config-service.js",
    "index.js",
}
HA_REQUIRED = {
    "home-assistant-adapter.js",
    "ha-action-providers.js",
}
DESIGN_REQUIRED = {
    "tokens.js",
    "base-styles.js",
    "design-system.js",
    "primitives.js",
}
ICON_REQUIRED = {
    "icon-definitions.js",
    "icon-registry.js",
    "icon.js",
    "ICONS_LICENSE.md",
}
HOME_HERO_DECK_REQUIRED = {
    "manifest.js",
    "index.js",
    "styles.js",
}
WEATHER_PROVIDER_REQUIRED = {
    "manifest.js",
    "config.js",
    "normalize.js",
    "forecast.js",
    "atmosphere.js",
    "moon.js",
    "provider.js",
    "index.js",
    "ASTRONOMY_LICENSE.md",
}
WEATHER_TODAY_REQUIRED = {
    "manifest.js",
    "config.js",
    "assets.js",
    "format.js",
    "model.js",
    "overlay.js",
    "styles.js",
    "widget.js",
    "index.js",
}
DIRECT_HA_TOKENS = (
    "hass.states",
    "hass.callService",
    "hass.callWS",
    "sendMessagePromise",
    "connection.subscribeMessage",
)
HA_ACTION_TYPES = ("entity.toggle", "ha.service", "scene.activate")


class CoreArchitectureTest(unittest.TestCase):
    def test_required_runtime_boundary_files_exist_without_release_version_names(self):
        core_present = {path.name for path in CORE_ROOT.glob("*.js")}
        ha_present = {path.name for path in HA_ROOT.glob("*.js")}
        design_present = {path.name for path in DESIGN_ROOT.glob("*.js")}
        icon_present = {path.name for path in ICON_ROOT.iterdir() if path.is_file()}
        home_hero_deck_present = {path.name for path in HOME_HERO_DECK_ROOT.iterdir() if path.is_file()}
        weather_provider_present = {path.name for path in WEATHER_PROVIDER_ROOT.iterdir() if path.is_file()}
        weather_today_present = {path.name for path in WEATHER_TODAY_ROOT.iterdir() if path.is_file()}
        self.assertTrue(CORE_REQUIRED.issubset(core_present))
        self.assertTrue(HA_REQUIRED.issubset(ha_present))
        self.assertTrue(DESIGN_REQUIRED.issubset(design_present))
        self.assertEqual(icon_present, ICON_REQUIRED)
        self.assertEqual(home_hero_deck_present, HOME_HERO_DECK_REQUIRED)
        self.assertEqual(weather_provider_present, WEATHER_PROVIDER_REQUIRED)
        self.assertEqual(weather_today_present, WEATHER_TODAY_REQUIRED)
        for root in (
            CORE_ROOT,
            HA_ROOT,
            DESIGN_ROOT,
            ICON_ROOT,
            HOME_HERO_DECK_ROOT,
            WEATHER_PROVIDER_ROOT,
            WEATHER_TODAY_ROOT,
        ):
            for path in root.rglob("*"):
                if path.is_file():
                    self.assertNotRegex(str(path), r"(?:^|[-_/])v(?:9|10|11)(?:[-_.\\/]|$)")

    def test_core_has_no_legacy_or_direct_home_assistant_access(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in CORE_ROOT.glob("*.js"))
        forbidden = [
            "Panel.prototype",
            "jamesui-home",
            "jamesui-v11-polish",
            "jamesui-panel.js",
            *DIRECT_HA_TOKENS,
            "weather.",
            "calendar.",
            "media_player",
            "spotify",
            "onkyo",
            "doorbell",
        ]
        for token in forbidden:
            self.assertNotIn(token, source, f"Core must not contain forbidden coupling: {token}")

    def test_ha_backed_actions_live_only_in_ha_boundary(self):
        core_source = "\n".join(path.read_text(encoding="utf-8") for path in CORE_ROOT.glob("*.js"))
        ha_source = "\n".join(path.read_text(encoding="utf-8") for path in HA_ROOT.glob("*.js"))
        for action_type in HA_ACTION_TYPES:
            self.assertNotIn(action_type, core_source, f"Core must not implement HA action: {action_type}")
            self.assertIn(action_type, ha_source, f"HA boundary must implement action: {action_type}")

    def test_new_runtime_direct_ha_access_is_confined_to_ha_boundary(self):
        # r11 remains production until cutover and intentionally still contains direct HA access.
        new_runtime_non_ha_roots = (
            CORE_ROOT,
            DESIGN_ROOT,
            ICON_ROOT,
            HOME_HERO_DECK_ROOT,
            WEATHER_PROVIDER_ROOT,
            WEATHER_TODAY_ROOT,
        )
        for root in new_runtime_non_ha_roots:
            for path in root.rglob("*.js"):
                source = path.read_text(encoding="utf-8")
                for token in DIRECT_HA_TOKENS:
                    self.assertNotIn(
                        token,
                        source,
                        f"Direct HA access outside frontend/ha is forbidden: {path} contains {token}",
                    )

    def test_block_5_config_service_uses_adapter_and_local_calibration_stays_out_of_shared_config(self):
        config_service = (CORE_ROOT / "config-service.js").read_text(encoding="utf-8")
        self.assertIn("homeAssistant.callWS", config_service)
        for token in DIRECT_HA_TOKENS:
            self.assertNotIn(token, config_service)

        backend_files = (
            "config_schema.py",
            "config_migrations.py",
            "config_service.py",
            "config_store.py",
        )
        backend_source = "\n".join(
            Path("custom_components/jamesui", name).read_text(encoding="utf-8")
            for name in backend_files
        )
        self.assertNotIn("jamesui-display-calibration", backend_source)

        core_index = (CORE_ROOT / "index.js").read_text(encoding="utf-8")
        self.assertIn("createConfigService", core_index)
        self.assertIn("config.destroy()", core_index)
        self.assertLess(core_index.index("config.destroy()"), core_index.index("homeAssistant.destroy()"))

    def test_block_6_design_boundary_is_centralized_and_asset_free(self):
        design_files = tuple(DESIGN_ROOT.glob("*.js"))
        design_source = "\n".join(path.read_text(encoding="utf-8") for path in design_files)
        for token in (
            "Panel.prototype",
            "jamesui-home",
            "jamesui-v11-polish",
            "jamesui-panel.js",
            "url(",
            "data:image",
            "<svg",
            "!important",
        ):
            self.assertNotIn(token, design_source, f"Design boundary must not contain {token}")

        raw_palette = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(")
        for name in ("base-styles.js", "design-system.js", "primitives.js"):
            source = (DESIGN_ROOT / name).read_text(encoding="utf-8")
            self.assertIsNone(raw_palette.search(source), f"Raw palette value outside tokens.js: {name}")

        core_index = (CORE_ROOT / "index.js").read_text(encoding="utf-8")
        shell = (CORE_ROOT / "shell.js").read_text(encoding="utf-8")
        self.assertIn("createDesignSystem", core_index)
        self.assertIn("createButton", shell)
        self.assertNotIn("designSystem", "\n".join(
            line for line in core_index.splitlines()
            if "const context =" in line or "context." in line
        ))

    def test_block_7_icon_boundary_is_local_safe_and_dependency_free(self):
        icon_js = tuple(ICON_ROOT.glob("*.js"))
        source = "\n".join(path.read_text(encoding="utf-8") for path in icon_js)
        forbidden = (
            "Panel.prototype",
            "jamesui-home",
            "jamesui-v11-polish",
            "jamesui-panel.js",
            "fetch(",
            "XMLHttpRequest",
            "DOMParser",
            "innerHTML",
            "outerHTML",
            "data:image",
            "<svg",
            "@tabler/",
            "cdn.jsdelivr",
            "unpkg",
            "config-service",
            "capability-registry",
            "action-registry",
            "home-assistant-adapter",
            "hass.",
            "callService",
            "callWS",
        )
        for token in (*DIRECT_HA_TOKENS, *forbidden):
            self.assertNotIn(token, source, f"Icon boundary must not contain coupling/runtime loader: {token}")

        urls = re.findall(r"https?://[^\"'\s)]+", source)
        self.assertEqual(urls, ["http://www.w3.org/2000/svg"])
        self.assertIn("createElementNS", (ICON_ROOT / "icon.js").read_text(encoding="utf-8"))
        self.assertIn('stroke", "currentColor"', (ICON_ROOT / "icon.js").read_text(encoding="utf-8"))
        self.assertIn('stroke-width", "2"', (ICON_ROOT / "icon.js").read_text(encoding="utf-8"))

    def test_block_7_core_navigation_uses_semantic_icons_without_legacy_glyphs(self):
        shell = (CORE_ROOT / "shell.js").read_text(encoding="utf-8")
        self.assertIn("createIcon", shell)
        for icon_id in ("nav.start", "nav.house", "nav.climate", "nav.media", "nav.door"):
            self.assertIn(icon_id, shell)
        for glyph in ("✦", "⌁", "▱", "▥", "≋", "▶", "◌"):
            self.assertNotIn(glyph, shell)
        self.assertNotIn("data:image", shell)
        self.assertNotIn("<svg", shell)

    def test_block_8_home_hero_deck_is_layout_only_and_core_free(self):
        index_source = (HOME_HERO_DECK_ROOT / "index.js").read_text(encoding="utf-8")
        styles_source = (HOME_HERO_DECK_ROOT / "styles.js").read_text(encoding="utf-8")
        module_source = "\n".join(
            path.read_text(encoding="utf-8") for path in HOME_HERO_DECK_ROOT.glob("*.js")
        )
        forbidden_module_tokens = (
            "Panel.prototype",
            "jamesui-home",
            "jamesui-v11-polish",
            "jamesui-panel.js",
            "home-assistant-adapter",
            "config-service",
            "capability-registry",
            "action-registry",
            "provider.weather",
            "provider.calendar",
            "provider.house",
            "provider.media",
            "weather.",
            "calendar.",
            "media_player",
            "widget.weather",
            "widget.calendar",
            "widget.house",
            "widget.dynamic",
            "fetch(",
            "XMLHttpRequest",
            "DOMParser",
        )
        for token in (*DIRECT_HA_TOKENS, *forbidden_module_tokens):
            self.assertNotIn(token, module_source, f"Block 8 layout must not contain coupling: {token}")

        self.assertIn("target.ownerDocument", index_source)
        for token in (
            "globalThis.document",
            "window.document",
            "window.",
            "innerWidth",
            "resize",
            "narrow",
        ):
            self.assertNotIn(token, index_source, f"Block 8 layout must not use browser/device shortcut: {token}")

        self.assertIn('[data-jui-layout="home-hero-deck"]', styles_source)
        self.assertIn("@container (max-width: 44rem)", styles_source)
        raw_palette = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(")
        self.assertIsNone(raw_palette.search(styles_source), "Block 8 styles must use shared design tokens")
        for token in (
            "!important",
            "url(",
            "data:image",
            ".jamesui-home",
            "html {",
            "body {",
            "[data-jui-widget",
            ".widget-",
        ):
            self.assertNotIn(token, styles_source, f"Block 8 styles must remain layout-scoped: {token}")

        core_source = "\n".join(path.read_text(encoding="utf-8") for path in CORE_ROOT.glob("*.js"))
        for token in (
            "layout.home-hero-deck",
            "data-jui-layout-slot",
            "widget-left",
            "widget-right-main",
            "widget-right-footer",
        ):
            self.assertNotIn(token, core_source, f"Core must not own Block 8 Start layout markup: {token}")

    def test_block_9_weather_provider_is_data_only_adapter_based_and_asset_free(self):
        js_files = tuple(WEATHER_PROVIDER_ROOT.glob("*.js"))
        source = "\n".join(path.read_text(encoding="utf-8") for path in js_files)
        forbidden = (
            "Panel.prototype",
            "jamesui-panel",
            "jamesui-v11",
            "jamesui-home-entry",
            "config-service",
            "config_service",
            "createConfigService",
            "window.",
            "document.",
            "createElement",
            "innerHTML",
            "outerHTML",
            "<svg",
            "<style",
            ".webp",
            "/assets/alpine",
            "/assets/weather",
            "fetch(",
            "XMLHttpRequest",
            "toLocaleDateString",
            "toLocaleTimeString",
            ".getFullYear(",
            ".getMonth(",
            ".getDate(",
        )
        for token in (*DIRECT_HA_TOKENS, *forbidden):
            self.assertNotIn(token, source, f"Block 9 provider must not contain forbidden coupling: {token}")

        self.assertIn("homeAssistant", (WEATHER_PROVIDER_ROOT / "provider.js").read_text(encoding="utf-8"))
        self.assertIn("Intl.DateTimeFormat", (WEATHER_PROVIDER_ROOT / "forecast.js").read_text(encoding="utf-8"))
        self.assertTrue((WEATHER_PROVIDER_ROOT / "ASTRONOMY_LICENSE.md").is_file())
        license_source = (WEATHER_PROVIDER_ROOT / "ASTRONOMY_LICENSE.md").read_text(encoding="utf-8")
        self.assertIn("SunCalc v1.9.0", license_source)
        self.assertIn("BSD 2-Clause", license_source)

    def test_block_10_weather_today_is_capability_only_local_and_legacy_free(self):
        js_files = tuple(WEATHER_TODAY_ROOT.glob("*.js"))
        source = "\n".join(path.read_text(encoding="utf-8") for path in js_files)
        forbidden = (
            "Panel.prototype",
            "jamesui-panel",
            "jamesui-v11",
            "jamesui-home-entry",
            "home-assistant-adapter",
            "config-service",
            "createConfigService",
            "module-registry",
            "module-loader",
            "health-service",
            "hass.",
            "callService",
            "callWS",
            "fetch(",
            "XMLHttpRequest",
            "cdn.jsdelivr",
            "unpkg",
            "data:image",
            "/assets/weather",
            "calculateMoon",
            "findNextPrecipitation",
        )
        for token in (*DIRECT_HA_TOKENS, *forbidden):
            self.assertNotIn(token, source, f"Block 10 widget must not contain forbidden coupling: {token}")

        assets = (WEATHER_TODAY_ROOT / "assets.js").read_text(encoding="utf-8")
        self.assertIn('const ROOT = "/jamesui_static/assets/alpine/";', assets)
        asset_files = set(re.findall(r"\$\{ROOT\}([^`]+\.webp)", assets))
        self.assertEqual(asset_files, {
            "clear-day.webp",
            "cloudy-day.webp",
            "rain-day.webp",
            "snow-day.webp",
            "fog.webp",
            "dusk.webp",
            "clear-night.webp",
            "cloudy-night.webp",
        })
        self.assertIsNone(re.search(r"https?://|data:image", assets))

        styles = (WEATHER_TODAY_ROOT / "styles.js").read_text(encoding="utf-8")
        raw_palette = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(")
        self.assertIsNone(raw_palette.search(styles), "Block 10 styles must use shared design tokens")
        for token in ("!important", "html {", "body {", ":root", "url(", "data:image"):
            self.assertNotIn(token, styles, f"Block 10 styles must remain scoped and local: {token}")

        core_shell = (CORE_ROOT / "shell.js").read_text(encoding="utf-8")
        for token in (
            "widget.weather-today",
            "conditionPresentation",
            "/jamesui_static/assets/alpine/",
            "clear-day.webp",
            "cloudy-day.webp",
            "rain-day.webp",
        ):
            self.assertNotIn(token, core_shell, f"Core shell must stay weather-neutral: {token}")

        design_styles = (DESIGN_ROOT / "base-styles.js").read_text(encoding="utf-8")
        self.assertIn("[data-jui-overlay]", design_styles)
        self.assertIn("z-index: 100", design_styles)
        self.assertNotIn("z-index: 100", styles)

    def test_production_entry_remains_on_legacy_runtime_during_block_10(self):
        source = Path("custom_components/jamesui/frontend/jamesui-entry.js").read_text(encoding="utf-8")
        self.assertIn("jamesui-panel.js", source)
        self.assertIn("jamesui-home-entry.js", source)
        self.assertNotIn("frontend/core", source)
        self.assertNotIn("frontend/ha", source)
        self.assertNotIn("frontend/design", source)
        self.assertNotIn("frontend/icons", source)
        self.assertNotIn("frontend/modules", source)
        self.assertNotIn("layout.home-hero-deck", source)
        self.assertNotIn("provider.weather", source)
        self.assertNotIn("widget.weather-today", source)
        self.assertNotRegex(source, r"(?:^|[\"'/])core/index\.js")
        self.assertNotIn("module-loader", source)
        self.assertNotIn("module-registry", source)
        self.assertNotIn("capability-registry", source)
        self.assertNotIn("action-registry", source)
        self.assertNotIn("home-assistant-adapter", source)
        self.assertNotIn("config-service", source)
        self.assertNotIn("design-system", source)
        self.assertNotIn("icon-registry", source)
        self.assertNotRegex(source, r"(?:^|[\"'/])icon\.js")


if __name__ == "__main__":
    unittest.main()