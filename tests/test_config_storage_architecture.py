from pathlib import Path
import unittest


class ConfigStorageArchitectureTest(unittest.TestCase):
    def test_store_wrapper_uses_versioned_atomic_home_assistant_store(self):
        source = Path("custom_components/jamesui/config_store.py").read_text(encoding="utf-8")
        self.assertIn("Store[dict[str, Any]]", source)
        self.assertIn('CONFIG_STORE_KEY = "jamesui.next.config"', source)
        self.assertRegex(source, r"super\(\).__init__\(\s*hass,\s*CONFIG_SCHEMA_VERSION,\s*CONFIG_STORE_KEY,")
        self.assertIn("atomic_writes=True", source)
        self.assertIn("async def _async_migrate_func", source)
        self.assertIn("migrate_stored_config(old_major_version, old_data)", source)

    def test_next_uses_new_store_and_ignores_legacy_options(self):
        source = Path("custom_components/jamesui/__init__.py").read_text(encoding="utf-8")
        self.assertIn("JamesUIConfigStore", source)
        self.assertIn("JamesUIConfigService", source)
        self.assertIn("await config_service.async_initialize(empty_config())", source)
        self.assertIn('["config"] = config_service', source)
        self.assertNotIn("migrate_legacy_options", source)
        self.assertNotIn("LEGACY_OPTION_KEYS", source)
        self.assertNotIn("async_update_entry", source)


if __name__ == "__main__":
    unittest.main()
