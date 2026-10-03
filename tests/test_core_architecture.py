from pathlib import Path
import re
import unittest


FRONTEND_ROOT = Path("custom_components/jamesui/frontend")
CORE_ROOT = FRONTEND_ROOT / "core"
HA_ROOT = FRONTEND_ROOT / "ha"
DESIGN_ROOT = FRONTEND_ROOT / "design"
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
        self.assertTrue(CORE_REQUIRED.issubset(core_present))
        self.assertTrue(HA_REQUIRED.issubset(ha_present))
        self.assertTrue(DESIGN_REQUIRED.issubset(design_present))
        for root in (CORE_ROOT, HA_ROOT, DESIGN_ROOT):
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
        new_runtime_non_ha_roots = (CORE_ROOT, DESIGN_ROOT)
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

    def test_production_entry_remains_on_legacy_runtime_during_block_6(self):
        source = Path("custom_components/jamesui/frontend/jamesui-entry.js").read_text(encoding="utf-8")
        self.assertIn("jamesui-panel.js", source)
        self.assertIn("jamesui-home-entry.js", source)
        self.assertNotIn("frontend/core", source)
        self.assertNotIn("frontend/ha", source)
        self.assertNotIn("frontend/design", source)
        self.assertNotRegex(source, r"(?:^|[\"'/])core/index\.js")
        self.assertNotIn("module-loader", source)
        self.assertNotIn("module-registry", source)
        self.assertNotIn("capability-registry", source)
        self.assertNotIn("action-registry", source)
        self.assertNotIn("home-assistant-adapter", source)
        self.assertNotIn("config-service", source)
        self.assertNotIn("design-system", source)


if __name__ == "__main__":
    unittest.main()
