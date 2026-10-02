import copy
import importlib.util
import math
from pathlib import Path
import unittest


MODULE_PATH = Path("custom_components/jamesui/config_schema.py")


def load_module():
    spec = importlib.util.spec_from_file_location("jamesui_config_schema", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ConfigSchemaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = load_module()

    def test_empty_config_has_exact_v1_shape_and_is_fresh(self):
        first = self.schema.empty_config()
        second = self.schema.empty_config()
        self.assertEqual(first, {
            "schema_version": 1,
            "pages": {},
            "layouts": {},
            "widget_instances": {},
            "dynamic_buttons": {},
            "data_sources": {},
            "module_settings": {},
        })
        self.assertEqual(tuple(first)[1:], self.schema.CONFIG_SECTION_NAMES)
        first["pages"]["home"] = {"layout": "main"}
        self.assertEqual(second["pages"], {})

    def test_validate_returns_detached_copy(self):
        source = self.schema.empty_config()
        source["pages"]["home"] = {"widgets": ["clock"], "enabled": True}
        validated = self.schema.validate_config(source)
        source["pages"]["home"]["widgets"].append("weather")
        self.assertEqual(validated["pages"]["home"]["widgets"], ["clock"])
        validated["pages"]["home"]["widgets"].append("calendar")
        self.assertEqual(source["pages"]["home"]["widgets"], ["clock", "weather"])

    def test_rejects_unknown_top_level_and_wrong_schema_version(self):
        config = self.schema.empty_config()
        config["extra"] = {}
        with self.assertRaisesRegex(self.schema.ConfigValidationError, r"extra"):
            self.schema.validate_config(config)

        config = self.schema.empty_config()
        config["schema_version"] = 2
        with self.assertRaisesRegex(self.schema.ConfigValidationError, r"schema_version"):
            self.schema.validate_config(config)

    def test_rejects_each_non_mapping_section(self):
        for section in self.schema.CONFIG_SECTION_NAMES:
            with self.subTest(section=section):
                config = self.schema.empty_config()
                config[section] = []
                with self.assertRaisesRegex(self.schema.ConfigValidationError, section):
                    self.schema.validate_config(config)

    def test_rejects_invalid_nested_keys_values_and_non_finite_numbers(self):
        cases = [
            ({"": "value"}, r"pages"),
            ({1: "value"}, r"pages"),
            ({"home": {"bad": object()}}, r"pages\.home\.bad"),
            ({"home": {"bad": math.nan}}, r"pages\.home\.bad"),
            ({"home": {"bad": math.inf}}, r"pages\.home\.bad"),
            ({"home": [{"": 1}]}, r"pages\.home\[0\]"),
        ]
        for value, pattern in cases:
            with self.subTest(value=repr(value)):
                config = self.schema.empty_config()
                config["pages"] = value
                with self.assertRaisesRegex(self.schema.ConfigValidationError, pattern):
                    self.schema.validate_config(config)

    def test_accepts_json_safe_nested_values(self):
        config = self.schema.empty_config()
        config["module_settings"] = {
            "demo": {
                "name": "x",
                "items": [1, 2.5, True, None, {"nested": "ok"}],
            }
        }
        self.assertEqual(self.schema.validate_config(config), config)


if __name__ == "__main__":
    unittest.main()
