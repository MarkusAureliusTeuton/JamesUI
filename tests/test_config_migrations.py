import importlib.util
from pathlib import Path
import sys
import types
import unittest


ROOT = Path("custom_components/jamesui")


def load_module(name, filename):
    if "custom_components" not in sys.modules:
        package = types.ModuleType("custom_components")
        package.__path__ = [str(ROOT.parent)]
        sys.modules["custom_components"] = package
    if "custom_components.jamesui" not in sys.modules:
        package = types.ModuleType("custom_components.jamesui")
        package.__path__ = [str(ROOT)]
        sys.modules["custom_components.jamesui"] = package
    full_name = f"custom_components.jamesui.{name}"
    spec = importlib.util.spec_from_file_location(full_name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[full_name] = module
    spec.loader.exec_module(module)
    return module


schema = load_module("config_schema", "config_schema.py")


class ConfigMigrationsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.migrations = load_module("config_migrations", "config_migrations.py")

    def test_legacy_key_set_and_all_15_mappings(self):
        legacy = {
            "weather_entity": "weather.home",
            "outdoor_temperature_entity": "sensor.outdoor",
            "moon_entity": "sensor.moon",
            "illuminance_entity": "sensor.lux",
            "media_spotify_entity": "media_player.spotify",
            "media_onkyo_entity": "media_player.onkyo",
            "media_ma_player_entity": "media_player.ma",
            "background_mode": "manual",
            "background_scene": "clear-night",
            "home_scene_entities": ["scene.arrive", "scene.evening"],
            "media_route": "music_assistant",
            "media_spotify_source": "Living Room",
            "media_onkyo_source": "NET",
            "media_playlist_name": "Favorites",
            "media_playlist_uri": "spotify:playlist:1",
        }
        self.assertEqual(set(self.migrations.LEGACY_OPTION_KEYS), set(legacy))
        config = self.migrations.migrate_legacy_options(legacy)
        self.assertEqual(config["data_sources"], {
            "weather": {
                "entity_id": "weather.home",
                "outdoor_temperature_entity_id": "sensor.outdoor",
                "moon_entity_id": "sensor.moon",
                "illuminance_entity_id": "sensor.lux",
            },
            "media": {
                "spotify_entity_id": "media_player.spotify",
                "onkyo_entity_id": "media_player.onkyo",
                "music_assistant_player_entity_id": "media_player.ma",
            },
        })
        self.assertEqual(config["module_settings"], {
            "start": {
                "background": {"mode": "manual", "scene": "clear-night"},
                "favorite_scene_entity_ids": ["scene.arrive", "scene.evening"],
            },
            "media": {
                "route": "music_assistant",
                "spotify_source": "Living Room",
                "onkyo_source": "NET",
                "playlist": {"name": "Favorites", "uri": "spotify:playlist:1"},
            },
        })
        for section in ("pages", "layouts", "widget_instances", "dynamic_buttons"):
            self.assertEqual(config[section], {})

    def test_sparse_empty_values_are_omitted_and_display_calibration_is_never_migrated(self):
        config = self.migrations.migrate_legacy_options({
            "weather_entity": "  ",
            "background_mode": None,
            "jamesui-display-calibration": {"top": 10, "scale": 0.9},
            "top": 10,
            "scale": 0.9,
        })
        self.assertEqual(config, schema.empty_config())
        projected = self.migrations.project_legacy_options(config)
        self.assertNotIn("jamesui-display-calibration", projected)
        self.assertNotIn("top", projected)
        self.assertNotIn("scale", projected)

    def test_projection_round_trip_is_deterministic_and_idempotent(self):
        legacy = {
            "weather_entity": "weather.home",
            "background_mode": "auto",
            "home_scene_entities": ["scene.a", "scene.b"],
            "media_playlist_uri": "spotify:playlist:x",
        }
        first = self.migrations.migrate_legacy_options(legacy)
        projection = self.migrations.project_legacy_options(first)
        second = self.migrations.migrate_legacy_options(projection)
        self.assertEqual(first, second)
        self.assertEqual(projection, legacy)

    def test_legacy_patch_preserves_unrelated_structured_sections(self):
        config = schema.empty_config()
        config["pages"]["home"] = {"layout": "hero"}
        config["module_settings"]["custom"] = {"keep": True}
        config["data_sources"]["weather"] = {"entity_id": "weather.old"}

        updated = self.migrations.apply_legacy_changes(config, {
            "weather_entity": "weather.new",
            "background_mode": "manual",
        })

        self.assertEqual(updated["pages"], config["pages"])
        self.assertEqual(updated["module_settings"]["custom"], {"keep": True})
        self.assertEqual(updated["data_sources"]["weather"]["entity_id"], "weather.new")
        self.assertEqual(updated["module_settings"]["start"]["background"]["mode"], "manual")
        self.assertEqual(config["data_sources"]["weather"]["entity_id"], "weather.old")

    def test_legacy_patch_removes_empty_values_and_normalizes_scenes(self):
        config = self.migrations.migrate_legacy_options({
            "weather_entity": "weather.old",
            "background_mode": "auto",
            "home_scene_entities": ["scene.old"],
        })
        updated = self.migrations.apply_legacy_changes(config, {
            "weather_entity": " ",
            "background_mode": None,
            "home_scene_entities": [" scene.a ", "scene.a", "", "scene.b", "scene.c", "scene.d", "scene.e"],
        })
        projected = self.migrations.project_legacy_options(updated)
        self.assertNotIn("weather_entity", projected)
        self.assertNotIn("background_mode", projected)
        self.assertEqual(projected["home_scene_entities"], ["scene.a", "scene.b", "scene.c", "scene.d"])

    def test_stored_schema_version_requires_explicit_supported_migration(self):
        config = schema.empty_config()
        self.assertEqual(self.migrations.migrate_stored_config(1, config), config)
        with self.assertRaises(self.migrations.UnsupportedConfigVersion):
            self.migrations.migrate_stored_config(2, config)
        with self.assertRaises(self.migrations.UnsupportedConfigVersion):
            self.migrations.migrate_stored_config(0, config)


if __name__ == "__main__":
    unittest.main()
