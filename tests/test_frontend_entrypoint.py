from pathlib import Path
import json
import re
import unittest

ROOT = Path("custom_components/jamesui")

class NextEntryTest(unittest.TestCase):
    def test_only_next_is_the_home_assistant_panel(self):
        consts = (ROOT / "const.py").read_text(encoding="utf-8")
        self.assertIn('FRONTEND_FILE = "jamesui-entry.js"', consts)
        self.assertIn('PANEL_ELEMENT = "jamesui-next-panel"', consts)
        self.assertNotIn("PREVIEW_PANEL_URL", consts)
        entry = (ROOT / "frontend/jamesui-entry.js").read_text(encoding="utf-8")
        self.assertIn('const TAG = "jamesui-next-panel"', entry)
        self.assertIn("createJamesUI1Preview", entry)
        self.assertNotRegex(entry, r"(?m)^\s*(?:import\s+(?!\()|export\b)")
        for old_script in ("jamesui-panel.js", "jamesui-entry.js",
                           "jamesui-home-entry.js", "jamesui-v11-polish.js"):
            self.assertNotIn(old_script, entry)

    def test_single_registration_and_version_consistency(self):
        consts = (ROOT / "const.py").read_text(encoding="utf-8")
        version = re.search(r'^VERSION\s*=\s*"([^"]+)"', consts, re.MULTILINE).group(1)
        revision = re.search(r'^FRONTEND_REVISION\s*=\s*"([^"]+)"', consts, re.MULTILINE).group(1)
        self.assertIn("next", revision)
        manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["version"], version)
        setup = (ROOT / "__init__.py").read_text(encoding="utf-8")
        self.assertEqual(setup.count("async_register_built_in_panel("), 1)
        self.assertIn('f"{STATIC_URL}/{FRONTEND_FILE}?v={FRONTEND_REVISION}"', setup)
        self.assertNotIn("PREVIEW_PANEL_URL", setup)
        self.assertIn("async_remove_panel(hass, PANEL_URL)", setup)

if __name__ == "__main__":
    unittest.main()
