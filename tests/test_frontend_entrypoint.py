from pathlib import Path
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


if __name__ == "__main__":
    unittest.main()
