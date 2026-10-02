from pathlib import Path
import json
import re
import unittest


class FrontendEntrypointTest(unittest.TestCase):
    def test_home_assistant_panel_entry_is_classic_script(self):
        const_text = Path("custom_components/jamesui/const.py").read_text(encoding="utf-8")
        match = re.search(r'^FRONTEND_FILE\s*=\s*"([^"]+)"', const_text, re.MULTILINE)
        self.assertIsNotNone(match, "FRONTEND_FILE must be defined")
        self.assertEqual(match.group(1), "jamesui-entry.js", "JamesUI must use the guarded classic entry loader")

        frontend_path = Path("custom_components/jamesui/frontend") / match.group(1)
        source = frontend_path.read_text(encoding="utf-8")
        self.assertNotRegex(source, r"(?m)^\s*(import|export)\b", "Home Assistant js_url panel entry must be a classic script, not an ES module")
        self.assertIn("jamesui-panel.js", source, "Entry loader must load the stable panel implementation")
        self.assertIn("jamesui-home-entry.js", source, "Entry loader must load the Start enhancement bridge")
        self.assertLess(source.index("jamesui-panel.js"), source.index("jamesui-home-entry.js"), "The stable panel must load before the Start-page enhancement")

    def test_frontend_revision_propagates_without_hard_coded_nested_versions(self):
        const_text = Path("custom_components/jamesui/const.py").read_text(encoding="utf-8")
        version_match = re.search(r'^VERSION\s*=\s*"([^"]+)"', const_text, re.MULTILINE)
        revision_match = re.search(r'^FRONTEND_REVISION\s*=\s*"([^"]+)"', const_text, re.MULTILINE)
        self.assertIsNotNone(version_match, "VERSION must be defined")
        self.assertIsNotNone(revision_match, "FRONTEND_REVISION must be defined")
        version = version_match.group(1)
        revision = revision_match.group(1)
        self.assertNotEqual(version, "")
        self.assertEqual(revision, "0.5.1-r10")

        manifest = json.loads(Path("custom_components/jamesui/manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["version"], version)

        setup_source = Path("custom_components/jamesui/__init__.py").read_text(encoding="utf-8")
        self.assertIn("FRONTEND_REVISION", setup_source)
        self.assertIn('f"{STATIC_URL}/{FRONTEND_FILE}?v={FRONTEND_REVISION}"', setup_source)

        entry = Path("custom_components/jamesui/frontend/jamesui-entry.js").read_text(encoding="utf-8")
        home_entry = Path("custom_components/jamesui/frontend/jamesui-home-entry.js").read_text(encoding="utf-8")
        self.assertIn('current.searchParams.get("v")', entry)
        self.assertIn('url.searchParams.set("v", revision)', entry)
        self.assertIn('current.searchParams.get("v")', home_entry)
        self.assertIn('homeModuleUrl.searchParams.set("v", revision)', home_entry)
        self.assertIn('dataModuleUrl.searchParams.set("v", revision)', home_entry)
        self.assertIn('backgroundModuleUrl.searchParams.set("v", revision)', home_entry)
        self.assertIn('jamesui-home-data.js', home_entry)
        self.assertNotRegex(entry, r'jamesui-(?:panel|home|home-entry)\.js\?v=\d')
        self.assertNotRegex(home_entry, r'jamesui-home(?:-data)?\.js\?v=\d')

    def test_loader_finds_nested_panel_and_rerenders_after_home_enhancement(self):
        entry = Path("custom_components/jamesui/frontend/jamesui-entry.js").read_text(encoding="utf-8")
        home_entry = Path("custom_components/jamesui/frontend/jamesui-home-entry.js").read_text(encoding="utf-8")

        self.assertIn("findJamesPanels", entry)
        self.assertIn("shadowRoot", entry)
        self.assertIn("window.__jamesUIFindPanels", entry)
        self.assertIn("upgradePredefinedProperty", entry)
        self.assertIn('["hass", "narrow", "route", "panel"]', entry)
        self.assertNotIn('document.querySelectorAll("jamesui-panel")', entry)

        self.assertIn("window.__jamesUIFindPanels", home_entry)
        self.assertIn("panel.render?.()", home_entry)
        self.assertNotIn('document.querySelectorAll("jamesui-panel")', home_entry)


if __name__ == "__main__":
    unittest.main()
