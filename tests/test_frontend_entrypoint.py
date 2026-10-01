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
        self.assertNotRegex(
            source,
            r"(?m)^\s*(import|export)\b",
            "Home Assistant js_url panel entry must be a classic script, not an ES module",
        )
        self.assertIn("jamesui-panel.js", source, "Entry loader must load the stable panel implementation")
        self.assertIn("jamesui-home.js", source, "Entry loader must load the Start-page enhancement")
        self.assertLess(
            source.index("jamesui-panel.js"),
            source.index("jamesui-home.js"),
            "The stable panel must load before the Start-page enhancement",
        )

    def test_release_version_invalidates_all_frontend_cache_tokens(self):
        const_text = Path("custom_components/jamesui/const.py").read_text(encoding="utf-8")
        version_match = re.search(r'^VERSION\s*=\s*"([^"]+)"', const_text, re.MULTILINE)
        self.assertIsNotNone(version_match, "VERSION must be defined")
        version = version_match.group(1)

        # Portrait-first Alpine Start V3 is the next cache-visible release.
        self.assertEqual(version, "0.5.1")

        manifest = json.loads(Path("custom_components/jamesui/manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["version"], version)

        setup_source = Path("custom_components/jamesui/__init__.py").read_text(encoding="utf-8")
        self.assertIn('f"{STATIC_URL}/{FRONTEND_FILE}?v={VERSION}"', setup_source)

        entry = Path("custom_components/jamesui/frontend/jamesui-entry.js").read_text(encoding="utf-8")
        home_entry = Path("custom_components/jamesui/frontend/jamesui-home-entry.js").read_text(encoding="utf-8")

        self.assertIn(f"jamesui-panel.js?v={version}", entry)
        self.assertIn(f"jamesui-home.js?v={version}", entry)
        self.assertIn(f"jamesui-home-entry.js?v={version}", entry)
        self.assertIn(f'./jamesui-home.js?v={version}', home_entry)


if __name__ == "__main__":
    unittest.main()
