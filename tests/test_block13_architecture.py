from pathlib import Path
import unittest

FRONTEND = Path("custom_components/jamesui/frontend")
MODULES = FRONTEND / "modules"
CORE = FRONTEND / "core"
PROVIDER = MODULES / "provider.control-state"
WIDGET = MODULES / "widget.dynamic-buttons"

EXPECTED_FILES = {
    PROVIDER: {"manifest.js", "config.js", "normalize.js", "provider.js", "index.js"},
    WIDGET: {"manifest.js", "config.js", "model.js", "styles.js", "widget.js", "index.js"},
}

class Block13ArchitectureTest(unittest.TestCase):
    def test_exact_module_boundaries(self):
        for root, expected in EXPECTED_FILES.items():
            self.assertTrue(root.is_dir(), f"missing Block 13 module directory: {root}")
            actual = {path.name for path in root.iterdir() if path.is_file()}
            self.assertEqual(actual, expected, f"unexpected Block 13 module boundary in {root}")

    def test_widget_is_capability_action_only_and_legacy_free(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in WIDGET.glob("*.js"))
        for token in (
            "homeAssistant", "hass.", "callService", "callWS", "subscribeMessage",
            "config-service", "router.js", "health-service", "module-registry", "module-loader",
            "jamesui-panel", "jamesui-v11", "jamesui-home-entry", "Panel.prototype",
        ):
            self.assertNotIn(token, source, f"Dynamic Buttons must not contain coupling: {token}")
        self.assertIn('"control.states"', (WIDGET / "manifest.js").read_text(encoding="utf-8"))
        self.assertIn("context.actions.execute", (WIDGET / "widget.js").read_text(encoding="utf-8"))

    def test_provider_is_presentation_free(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in PROVIDER.glob("*.js"))
        for token in (
            "document.", "window.", "createElement", "innerHTML", "outerHTML",
            "<svg", "<style", "data:image", "/design/", "/icons/", "createIcon", "createButton",
        ):
            self.assertNotIn(token, source, f"Control State provider must stay presentation-free: {token}")

    def test_core_contains_no_block13_domain_behavior(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in CORE.glob("*.js"))
        for token in ("provider.control-state", "widget.dynamic-buttons", "control.states", "data-jui-dynamic-button"):
            self.assertNotIn(token, source, f"Core must not own Block 13 behavior: {token}")

    def test_block13_is_not_wired_into_legacy_or_production_bootstrap(self):
        production_files = (
            FRONTEND / "jamesui-entry.js",
            FRONTEND / "jamesui-home-entry.js",
            FRONTEND / "jamesui-home.js",
            FRONTEND / "jamesui-panel.js",
        )
        for path in production_files:
            source = path.read_text(encoding="utf-8")
            for token in ("provider.control-state", "widget.dynamic-buttons", "control.states"):
                self.assertNotIn(token, source, f"Block 13 must not cut over production yet: {path} contains {token}")

    def test_widget_does_not_pull_block14_editor_forward(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in WIDGET.glob("*.js"))
        for token in ("pointerdown", "pointermove", "dragstart", "draggable=", "grid-column", "grid-row"):
            self.assertNotIn(token, source, f"Block 14 editor behavior leaked into Block 13: {token}")

    def test_widget_uses_semantic_icon_system_and_no_raw_svg_or_external_icons(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in WIDGET.glob("*.js"))
        self.assertIn("hasIcon", (WIDGET / "config.js").read_text(encoding="utf-8"))
        self.assertIn("createIcon", (WIDGET / "widget.js").read_text(encoding="utf-8"))
        for token in ("<svg", "data:image", "cdn.jsdelivr", "unpkg.com"):
            self.assertNotIn(token, source)

    def test_validate_workflow_contains_block13_gate(self):
        workflow = Path(".github/workflows/validate.yml").read_text(encoding="utf-8")
        self.assertIn("Test JamesUI Block 13 Dynamic Buttons", workflow)
        self.assertIn("tests/test_block13_architecture.py", workflow)
        self.assertIn("tests/jamesui-block13-loader.test.js", workflow)

if __name__ == "__main__":
    unittest.main()
