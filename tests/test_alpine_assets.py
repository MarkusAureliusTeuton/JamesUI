from pathlib import Path
import hashlib
import re
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
            declared_size = int.from_bytes(data[4:8], "little") + 8
            self.assertEqual(
                declared_size,
                len(data),
                f"Truncated or malformed WebP asset: {name}",
            )

    def test_alpine_assets_match_committed_sha256_manifest(self):
        root = Path("custom_components/jamesui/frontend/assets/alpine")
        expected_names = {
            "clear-day.webp",
            "cloudy-day.webp",
            "rain-day.webp",
            "snow-day.webp",
            "fog.webp",
            "dusk.webp",
            "clear-night.webp",
            "cloudy-night.webp",
        }
        line_pattern = re.compile(
            r"^([0-9a-f]{64})\s+(\S+)\s+\((\d+) bytes\)$"
        )
        entries = {}
        manifest = (root / "SHA256.txt").read_text(encoding="utf-8")
        for raw_line in manifest.splitlines():
            line = raw_line.strip()
            if not line or line == "SHA256":
                continue
            match = line_pattern.fullmatch(line)
            self.assertIsNotNone(match, f"Malformed SHA256 manifest line: {line}")
            declared_hash, name, declared_bytes = match.groups()
            entries[name] = (declared_hash, int(declared_bytes))

        self.assertEqual(set(entries), expected_names)
        for name, (declared_hash, declared_bytes) in entries.items():
            path = root / name
            self.assertTrue(path.exists(), f"Missing Alpine asset: {name}")
            self.assertEqual(
                path.stat().st_size,
                declared_bytes,
                f"Alpine asset size does not match manifest: {name}",
            )
            self.assertEqual(
                hashlib.sha256(path.read_bytes()).hexdigest(),
                declared_hash,
                f"Alpine asset hash does not match manifest: {name}",
            )

    def test_r7_night_assets_have_photographic_detail(self):
        root = Path("custom_components/jamesui/frontend/assets/alpine")
        for name in ("clear-night.webp", "cloudy-night.webp"):
            data = (root / name).read_bytes()
            self.assertGreater(len(data), 10000, f"Night asset lacks photographic detail: {name}")


if __name__ == "__main__":
    unittest.main()
