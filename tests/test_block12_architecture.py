from pathlib import Path
import unittest

FRONTEND = Path("custom_components/jamesui/frontend")
MODULES = FRONTEND / "modules"
CORE = FRONTEND / "core"
ICONS = FRONTEND / "icons"
SHARED = FRONTEND / "shared"
HEATING = MODULES / "provider.house-heating"
LIGHTING = MODULES / "provider.house-lighting"
DEVICES = MODULES / "provider.house-devices"
ENERGY = MODULES / "provider.house-energy"
QUICK = MODULES / "widget.house-quick"

EXPECTED_FILES = {
    HEATING: {"manifest.js", "config.js", "normalize.js", "provider.js", "index.js"},
    LIGHTING: {"manifest.js", "config.js", "normalize.js", "provider.js", "index.js"},
    DEVICES: {"manifest.js", "config.js", "normalize.js", "provider.js", "index.js"},
    ENERGY: {"manifest.js", "config.js", "history.js", "provider.js", "index.js"},
    QUICK: {"manifest.js", "config.js", "model.js", "styles.js", "widget.js", "index.js"},
}

RAW_HA_WIDGET_TOKENS = (
    "homeAssistant", "hass.", "callWS", "callService", "subscribeMessage",
    "history/history_during_period",
)
LEGACY_TOKENS = ("Panel.prototype", "jamesui-panel", "jamesui-v11", "jamesui-home-entry")
BLOCK12_CORE_TOKENS = (
    "provider.house-heating", "provider.house-lighting", "provider.house-devices",
    "provider.house-energy", "widget.house-quick", "house.heatingZones", "house.lights",
    "house.ambientLights", "house.devices", "house.energy", "data-jui-house-quick",
)


class Block12ArchitectureTest(unittest.TestCase):
    def test_exact_block12_module_file_boundaries(self):
        for root, expected in EXPECTED_FILES.items():
            self.assertTrue(root.is_dir(), f"missing Block 12 module directory: {root}")
            actual = {path.name for path in root.iterdir() if path.is_file()}
            self.assertEqual(actual, expected, f"unexpected Block 12 module boundary in {root}")
        self.assertTrue((SHARED / "house-source.js").is_file())

    def test_house_quick_is_capability_action_only_and_legacy_free(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in QUICK.glob("*.js"))
        for token in (*RAW_HA_WIDGET_TOKENS, *LEGACY_TOKENS):
            self.assertNotIn(token, source, f"House Quick must not contain coupling: {token}")
        for token in (
            "config-service", "createConfigService", "router.js", "health-service",
            "module-registry", "module-loader", "capability-registry", "action-registry",
        ):
            self.assertNotIn(token, source, f"House Quick must not import Core service internals: {token}")
        widget = (QUICK / "widget.js").read_text(encoding="utf-8")
        for capability in ("house.heatingZones", "house.lights", "house.ambientLights", "house.devices", "house.energy"):
            self.assertIn(capability, widget)
        self.assertIn('type: "navigate"', widget)

    def test_house_providers_are_presentation_free(self):
        for root in (HEATING, LIGHTING, DEVICES, ENERGY):
            source = "\n".join(path.read_text(encoding="utf-8") for path in root.glob("*.js"))
            for token in (
                "document.", "createElement", "innerHTML", "outerHTML", "<svg",
                "<style", "data:image", "/design/", "/icons/", "createIcon", "createButton",
            ):
                self.assertNotIn(token, source, f"House provider must stay presentation-free: {root} contains {token}")
            self.assertIn("homeAssistant", source)

    def test_shared_house_source_is_infrastructure_free(self):
        source = (SHARED / "house-source.js").read_text(encoding="utf-8")
        for token in ("document.", "window.", "homeAssistant", "hass.", "callService", "callWS", "subscribeMessage"):
            self.assertNotIn(token, source, f"shared house helper must stay infrastructure-free: {token}")

    def test_core_contains_no_block12_domain_behavior(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in CORE.glob("*.js"))
        for token in BLOCK12_CORE_TOKENS:
            self.assertNotIn(token, source, f"Core must not own Block 12 behavior: {token}")

    def test_house_quick_uses_registered_semantic_icons_only(self):
        definitions = (ICONS / "icon-definitions.js").read_text(encoding="utf-8")
        for icon_id in ("home.climate", "home.light", "home.device", "home.energy"):
            self.assertEqual(definitions.count(f'"{icon_id}"'), 1, f"House icon must be declared exactly once: {icon_id}")
        source = "\n".join(path.read_text(encoding="utf-8") for path in QUICK.glob("*.js"))
        self.assertIn("createIcon", source)
        for token in ("<svg", "data:image", "cdn.jsdelivr", "unpkg", "http://", "https://"):
            self.assertNotIn(token, source, f"House Quick must not bypass local icon registry: {token}")

    def test_block12_is_not_wired_into_legacy_start_or_production_bootstrap(self):
        production_files = (
            FRONTEND / "jamesui-entry.js", FRONTEND / "jamesui-home-entry.js",
            FRONTEND / "jamesui-home.js", FRONTEND / "jamesui-panel.js",
        )
        module_ids = (
            "provider.house-heating", "provider.house-lighting", "provider.house-devices",
            "provider.house-energy", "widget.house-quick",
        )
        for path in production_files:
            source = path.read_text(encoding="utf-8")
            for module_id in module_ids:
                self.assertNotIn(module_id, source, f"Block 12 must not cut over production/Start yet: {path} contains {module_id}")


if __name__ == "__main__":
    unittest.main()
