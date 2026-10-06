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
HOUSE_QUICK = MODULES / "widget.house-quick"

EXPECTED_FILES = {
    HEATING: {"manifest.js", "config.js", "normalize.js", "provider.js", "index.js"},
    LIGHTING: {"manifest.js", "config.js", "normalize.js", "provider.js", "index.js"},
    DEVICES: {"manifest.js", "config.js", "normalize.js", "provider.js", "index.js"},
    ENERGY: {"manifest.js", "config.js", "history.js", "provider.js", "index.js"},
    HOUSE_QUICK: {"manifest.js", "config.js", "model.js", "styles.js", "widget.js", "index.js"},
}

MODULE_IDS = (
    "provider.house-heating",
    "provider.house-lighting",
    "provider.house-devices",
    "provider.house-energy",
    "widget.house-quick",
)
CAPABILITIES = (
    "house.heatingZones",
    "house.lights",
    "house.ambientLights",
    "house.devices",
    "house.energy",
)


class Block12ArchitectureTest(unittest.TestCase):
    def test_exact_block12_module_file_boundaries(self):
        for root, expected in EXPECTED_FILES.items():
            self.assertTrue(root.is_dir(), f"missing Block 12 module directory: {root}")
            actual = {path.name for path in root.iterdir() if path.is_file()}
            self.assertEqual(actual, expected, f"unexpected Block 12 module boundary in {root}")
        self.assertTrue((SHARED / "house-source.js").is_file())

    def test_house_quick_is_capability_action_only_and_legacy_free(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in HOUSE_QUICK.glob("*.js"))
        for token in (
            "homeAssistant", "hass.", "callWS", "callService", "subscribeMessage",
            "jamesui-panel", "jamesui-v11", "jamesui-home-entry", "Panel.prototype",
            "config-service", "router.js", "health-service", "module-registry",
            "module-loader", "capability-registry", "action-registry",
        ):
            self.assertNotIn(token, source, f"House Quick must not contain coupling: {token}")
        widget_source = (HOUSE_QUICK / "widget.js").read_text(encoding="utf-8")
        for capability in CAPABILITIES:
            self.assertIn(capability, widget_source)
        self.assertIn('type: "navigate"', widget_source)

    def test_house_providers_are_presentation_free(self):
        for root in (HEATING, LIGHTING, DEVICES, ENERGY):
            source = "\n".join(path.read_text(encoding="utf-8") for path in root.glob("*.js"))
            for token in (
                "document.", "window.", "createElement", "innerHTML", "outerHTML",
                "<svg", "<style", "data:image", "/design/", "/icons/", "createIcon", "createButton",
            ):
                self.assertNotIn(token, source, f"House provider must stay presentation-free: {root} contains {token}")

    def test_shared_house_source_is_infrastructure_free(self):
        source = (SHARED / "house-source.js").read_text(encoding="utf-8")
        for token in ("document.", "window.", "homeAssistant", "hass.", "callService", "callWS", "subscribeMessage"):
            self.assertNotIn(token, source, f"house-source helper must stay infrastructure-free: {token}")

    def test_core_contains_no_block12_domain_behavior(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in CORE.glob("*.js"))
        for token in (*MODULE_IDS, *CAPABILITIES, "data-jui-house-quick"):
            self.assertNotIn(token, source, f"Core must not own Block 12 behavior: {token}")

    def test_block12_is_not_wired_into_legacy_or_production_bootstrap(self):
        production_files = (
            FRONTEND / "jamesui-entry.js",
            FRONTEND / "jamesui-home-entry.js",
            FRONTEND / "jamesui-home.js",
            FRONTEND / "jamesui-panel.js",
        )
        for path in production_files:
            source = path.read_text(encoding="utf-8")
            for module_id in MODULE_IDS:
                self.assertNotIn(module_id, source, f"Block 12 must not cut over production yet: {path} contains {module_id}")

    def test_house_quick_uses_existing_semantic_icon_ids_only(self):
        definitions = (ICONS / "icon-definitions.js").read_text(encoding="utf-8")
        for icon_id in ("home.climate", "home.light", "home.device", "home.energy"):
            self.assertEqual(definitions.count(f'"{icon_id}"'), 1, f"semantic icon must exist exactly once: {icon_id}")
        source = "\n".join(path.read_text(encoding="utf-8") for path in HOUSE_QUICK.glob("*.js"))
        for token in ("<svg", "data:image", "cdn.jsdelivr", "unpkg", "http://", "https://"):
            self.assertNotIn(token, source, f"House Quick must not bypass icon registry: {token}")

    def test_validate_workflow_contains_block12_gate(self):
        workflow = Path(".github/workflows/validate.yml").read_text(encoding="utf-8")
        self.assertIn("Test JamesUI Block 12 House Quick", workflow)
        self.assertIn("tests/test_block12_architecture.py", workflow)
        self.assertIn("tests/jamesui-block12-loader.test.js", workflow)


if __name__ == "__main__":
    unittest.main()
