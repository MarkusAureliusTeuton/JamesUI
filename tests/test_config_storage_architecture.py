from pathlib import Path
import unittest


class ConfigStorageArchitectureTest(unittest.TestCase):
    def test_store_wrapper_uses_versioned_atomic_home_assistant_store(self):
        source = Path("custom_components/jamesui/config_store.py").read_text(encoding="utf-8")
        self.assertIn("Store[dict[str, Any]]", source)
        self.assertIn('CONFIG_STORE_KEY = "jamesui.config"', source)
        self.assertRegex(source, r"super\(\).__init__\(\s*hass,\s*CONFIG_SCHEMA_VERSION,\s*CONFIG_STORE_KEY,")
        self.assertIn("atomic_writes=True", source)
        self.assertIn("async def _async_migrate_func", source)
        self.assertIn("migrate_stored_config(old_major_version, old_data)", source)

    def test_setup_initializes_canonical_store_before_cleaning_legacy_options(self):
        source = Path("custom_components/jamesui/__init__.py").read_text(encoding="utf-8")
        self.assertIn("JamesUIConfigStore", source)
        self.assertIn("JamesUIConfigService", source)
        self.assertIn("migrate_legacy_options", source)
        self.assertIn("LEGACY_OPTION_KEYS", source)
        self.assertIn('["config"] = config_service', source)
        self.assertNotIn('data={"config"', source)

        initialize_at = source.index("await config_service.async_initialize")
        publish_at = source.index('["config"] = config_service')
        cleanup_at = source.index("async_update_entry", initialize_at)
        self.assertLess(initialize_at, publish_at)
        self.assertLess(publish_at, cleanup_at)

    def test_setup_preserves_unknown_options_and_removes_only_known_legacy_keys(self):
        source = Path("custom_components/jamesui/__init__.py").read_text(encoding="utf-8")
        self.assertRegex(source, r"for\s+key\s+in\s+LEGACY_OPTION_KEYS")
        self.assertRegex(source, r"options\.pop\(key,\s*None\)")
        self.assertRegex(source, r"options\s*=\s*dict\(entry\.options\)")
        self.assertNotRegex(source, r"options\s*=\s*\{\}\s*$")


if __name__ == "__main__":
    unittest.main()
