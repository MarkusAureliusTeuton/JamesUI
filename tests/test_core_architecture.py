from pathlib import Path
import unittest


CORE_ROOT = Path("custom_components/jamesui/frontend/core")
REQUIRED = {
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
    "index.js",
}


class CoreArchitectureTest(unittest.TestCase):
    def test_required_core_files_exist_without_release_version_names(self):
        present = {path.name for path in CORE_ROOT.glob("*.js")}
        self.assertTrue(REQUIRED.issubset(present))
        for path in CORE_ROOT.rglob("*"):
            if path.is_file():
                self.assertNotRegex(str(path), r"(?:^|[-_/])v(?:9|10|11)(?:[-_.\\/]|$)")

    def test_core_has_no_legacy_or_direct_home_assistant_access(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in CORE_ROOT.glob("*.js"))
        forbidden = [
            "Panel.prototype",
            "jamesui-home",
            "jamesui-v11-polish",
            "jamesui-panel.js",
            "hass.states",
            "hass.callService",
            "hass.callWS",
            "sendMessagePromise",
            "connection.subscribeMessage",
            "weather.",
            "calendar.",
            "media_player",
            "spotify",
            "onkyo",
            "doorbell",
        ]
        for token in forbidden:
            self.assertNotIn(token, source, f"Core must not contain forbidden coupling: {token}")

    def test_production_entry_remains_on_legacy_runtime_during_block_2(self):
        source = Path("custom_components/jamesui/frontend/jamesui-entry.js").read_text(encoding="utf-8")
        self.assertIn("jamesui-panel.js", source)
        self.assertIn("jamesui-home-entry.js", source)
        self.assertNotIn("frontend/core", source)
        self.assertNotRegex(source, r"(?:^|[\"'/])core/index\.js")
        self.assertNotIn("module-loader", source)
        self.assertNotIn("module-registry", source)


if __name__ == "__main__":
    unittest.main()
