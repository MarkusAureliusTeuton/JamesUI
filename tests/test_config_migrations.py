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
    spec = importlib.util.spec_from_file_location(f"custom_components.jamesui.{name}", ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module

schema = load_module("config_schema", "config_schema.py")

class NextConfigMigrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.migrations = load_module("config_migrations", "config_migrations.py")

    def test_stored_schema_1_is_validated_and_preserved(self):
        config = schema.empty_config()
        config["pages"]["home"] = {"kind": "dashboard"}
        self.assertEqual(self.migrations.migrate_stored_config(1, config), config)
        invalid = schema.empty_config()
        invalid["layouts"] = []
        with self.assertRaisesRegex(ValueError, "layouts: must be an object"):
            self.migrations.migrate_stored_config(1, invalid)

    def test_unsupported_versions_are_rejected_without_migrating_old_data(self):
        config = schema.empty_config()
        for version in (0, 2):
            with self.assertRaises(self.migrations.UnsupportedConfigVersion):
                self.migrations.migrate_stored_config(version, config)

if __name__ == "__main__":
    unittest.main()
