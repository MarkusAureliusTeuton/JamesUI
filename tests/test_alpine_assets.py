from pathlib import Path
import unittest


class AlpineAssetTest(unittest.TestCase):
    def test_alpine_webp_assets_are_valid_webp_files(self):
        root = Path("custom_components/jamesui/frontend/assets/alpine")
        expected = [
            "clear-day.webp",
            "cloudy-day.webp",
            "rain-day.webp",
            "snow-day.webp",
            "dusk.webp",
            "clear-night.webp",
            "cloudy-night.webp",
            "fog.webp",
        ]
        for name in expected:
            path = root / name
            self.assertTrue(path.exists(), f"Missing Alpine asset: {name}")
            data = path.read_bytes()
            self.assertGreaterEqual(len(data), 12, f"Alpine asset too small: {name}")
            self.assertEqual(data[:4], b"RIFF", f"Invalid RIFF header: {name}")
            self.assertEqual(data[8:12], b"WEBP", f"Invalid WEBP signature: {name}")


if __name__ == "__main__":
    unittest.main()
